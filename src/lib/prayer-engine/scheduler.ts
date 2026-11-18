/**
 * The scheduler: the per-day, per-prayer pipeline from plan §4.3.
 *
 * Pure functions only — no I/O, no framework imports, no timezone math.
 * Times are wall-clock minutes; DST is the calendar's problem.
 */

import {
	type DayPlan,
	type DayTimings,
	type OooEvent,
	type PlannedEvent,
	PRAYERS,
	type Prayer,
	type Skipped,
	type SkipReason,
	type SyncConfig,
} from "./types";
import {
	addDays,
	applyOffset,
	isWithinWindow,
	localIsoToMinutes,
	parseTime,
	roundToGrid,
	toLocalIso,
	weekdayOf,
} from "./time";
import { formatTitle } from "./titles";

/** Friday in `Date#getDay()` numbering. */
const FRIDAY = 5;

/** Position of a prayer in the stable event id, e.g. `sc20261113p2`. */
function prayerIndex(prayer: Prayer): number {
	return PRAYERS.indexOf(prayer);
}

/**
 * Resolve the Friday (Jummah) rule for Dhuhr. Only meaningful when the day is
 * a Friday, the prayer is Dhuhr, and the mode is not "same" (plan §4.3).
 * Returns what to schedule, or that the slot is skipped as `jummah-off`.
 */
export function resolveJummah(
	prayer: Prayer,
	weekday: number,
	rawMinutes: number,
	config: SyncConfig,
): { action: "normal" } | { action: "skip"; reason: SkipReason } | { action: "override"; start: number; duration: number } {
	const { jummah, defaults } = config;
	if (prayer !== "dhuhr" || weekday !== FRIDAY || jummah.mode === "same") {
		return { action: "normal" };
	}
	if (jummah.mode === "none") {
		return { action: "skip", reason: "jummah-off" };
	}
	if (jummah.mode === "fixed") {
		if (!jummah.fixedTime) {
			throw new Error("JummahRule mode 'fixed' requires fixedTime");
		}
		return {
			action: "override",
			start: parseTime(jummah.fixedTime),
			duration: jummah.durationMin ?? defaults.durationMin,
		};
	}
	return {
		action: "override",
		start: applyOffset(rawMinutes, jummah.offsetMin ?? defaults.offsetMin),
		duration: jummah.durationMin ?? defaults.durationMin,
	};
}

/**
 * Does any out-of-office span exclude this event? An all-day span removes the
 * whole day; a Google-reported outOfOffice event or a keyword-matched title
 * removes only prayers overlapping it (plan §2, §4.3). Events with no marker
 * never block anything.
 */
export function isExcludedByOoo(
	oooEvents: OooEvent[],
	keywords: string[],
	startLocal: string,
	endLocal: string,
): boolean {
	if (oooEvents.length === 0) {
		return false;
	}
	const start = localIsoToMinutes(startLocal);
	const end = localIsoToMinutes(endLocal);
	return oooEvents.some((event) => {
		if (event.allDay) {
			// An all-day span covers every minute of its start date through the
			// whole end date, so a multi-day vacation can be passed as one span.
			const oStart = localIsoToMinutes(`${event.startLocal.slice(0, 10)}T00:00`);
			const oEnd = localIsoToMinutes(`${event.endLocal.slice(0, 10)}T00:00`) + 1440;
			return oStart < end && oEnd > start;
		}
		const title = event.title;
		const keywordMatch =
			title !== undefined &&
			keywords.some((keyword) => keyword !== "" && title.toLowerCase().includes(keyword.toLowerCase()));
		if (event.fromGoogle || keywordMatch) {
			const oooStart = localIsoToMinutes(event.startLocal);
			const oooEnd = localIsoToMinutes(event.endLocal);
			return oooStart < end && oooEnd > start;
		}
		return false;
	});
}

/** Run the §4.3 pipeline for one day and produce events plus skips. */
export function planDay(timings: DayTimings, config: SyncConfig, oooEvents: OooEvent[] = []): DayPlan {
	const events: PlannedEvent[] = [];
	const skipped: Skipped[] = [];
	const { date, timezone } = timings;
	const weekday = weekdayOf(date);

	for (const prayer of PRAYERS) {
		// Plan §4.3 checks prayer-enabled first, then weekday-enabled.
		const rule = config.prayers[prayer];
		if (!rule.enabled) {
			skipped.push({ date, prayer, reason: "prayer-off" });
			continue;
		}
		if (!config.days.includes(weekday)) {
			skipped.push({ date, prayer, reason: "day-off" });
			continue;
		}
		const raw = timings.times[prayer];
		// AlAdhan always supplies all five times; a missing one is a data gap,
		// reported under the same umbrella as a switched-off prayer.
		if (raw === undefined) {
			skipped.push({ date, prayer, reason: "prayer-off" });
			continue;
		}
		const rawMinutes = parseTime(raw);

		const jummah = resolveJummah(prayer, weekday, rawMinutes, config);
		if (jummah.action === "skip") {
			skipped.push({ date, prayer, reason: jummah.reason });
			continue;
		}
		let start: number;
		let duration: number;
		if (jummah.action === "override") {
			start = jummah.start;
			duration = jummah.duration;
		} else {
			start = applyOffset(rawMinutes, rule.offsetMin ?? config.defaults.offsetMin);
			duration = rule.durationMin ?? config.defaults.durationMin;
		}

		start = roundToGrid(start, config.rounding.grid, config.rounding.direction);

		if (!isWithinWindow(start, config.window)) {
			skipped.push({ date, prayer, reason: "outside-window" });
			continue;
		}

		const startLocal = toLocalIso(date, start);
		const endLocal = toLocalIso(date, start + duration);

		if (config.ooo.enabled && isExcludedByOoo(oooEvents, config.ooo.keywords, startLocal, endLocal)) {
			skipped.push({ date, prayer, reason: "ooo" });
			continue;
		}

		events.push({
			// Built from the prayer's own date, not the (possibly shifted) start
			// date: two days that cross midnight must never share an id.
			id: `sc${date.replaceAll("-", "")}p${prayerIndex(prayer)}`,
			prayer,
			startLocal,
			endLocal,
			timezone,
			title: formatTitle(prayer, config.titleLocale, rule.emoji, rule.title),
			transparency: rule.transparency ?? config.defaults.transparency,
			reminderMin: config.defaults.reminderMin,
			colorId: config.defaults.colorId,
		});
	}

	return { date, events, skipped };
}

/**
 * Chain `planDay` across a range, with per-date out-of-office spans. An offset
 * can move an event onto the previous or next date, so each day also sees the
 * spans of its neighbours (the overlap check works on absolute minutes).
 */
export function planRange(
	days: DayTimings[],
	config: SyncConfig,
	oooByDate?: Map<string, OooEvent[]>,
): DayPlan[] {
	return days.map((timings) => {
		const spans = oooByDate
			? [-1, 0, 1].flatMap((n) => oooByDate.get(addDays(timings.date, n)) ?? [])
			: [];
		return planDay(timings, config, spans);
	});
}
