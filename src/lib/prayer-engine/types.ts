/**
 * Shared contract types for the prayer engine (plan §4.8).
 *
 * Pure data only: no I/O, no framework imports. These types are the contract
 * between the browser (preview, .ics) and the API routes (Google sync) —
 * change them first, deliberately (AGENTS.md).
 */

/** The five daily prayers, in engine output order. */
export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];

/** Asr shadow length: standard (Shafi'i, Maliki, Hanbali) or Hanafi. */
export type AsrSchool = "standard" | "hanafi";

/** Busy (opaque) or Free (transparent) on the calendar. */
export type Transparency = "opaque" | "transparent";

/** Day of week as `Date#getDay()`: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** UI locale for generated event titles. Numerals stay Latin (plan §2). */
export type TitleLocale = "en" | "ar";

export interface Location {
	latitude: number;
	longitude: number;
	/** IANA timezone of the place, from geocoding. Empty until a place is set. */
	timezone?: string;
	/** Human-readable city label, from geocoding. Empty until a place is set. */
	label?: string;
}

/** Per-prayer rule; `undefined` fields fall back to `RuleDefaults`. */
export interface PrayerRule {
	enabled: boolean;
	offsetMin?: number;
	durationMin?: number;
	transparency?: Transparency;
	emoji?: string;
	title?: string;
}

/** Global fallbacks for every prayer that does not override them. */
export interface RuleDefaults {
	offsetMin: number;
	durationMin: number;
	transparency: Transparency;
	reminderMin?: number;
	colorId?: string;
}

/** Snap start times to a minute grid, or leave them off the grid. */
export interface Rounding {
	grid: "off" | 5 | 10;
	direction: "nearest" | "up" | "down";
}

/**
 * Only book events starting inside this window, in minutes from local
 * midnight. `startMin > endMin` means an overnight window (e.g. 22:00–06:00).
 */
export interface TimeWindow {
	startMin: number;
	endMin: number;
}

/** The four Friday (Jummah) choices from plan §2. */
export interface JummahRule {
	mode: "same" | "fixed" | "custom" | "none";
	/** Clock time "HH:MM" for mode "fixed". */
	fixedTime?: string;
	/** Offset from the Dhuhr adhan for mode "custom". */
	offsetMin?: number;
	/** Event length for modes "fixed" and "custom". */
	durationMin?: number;
}

/** Out-of-office skip rule; keywords match event titles (case-insensitive). */
export interface OooRule {
	enabled: boolean;
	keywords: string[];
}

/** Where the sync writes: a dedicated "Salat" calendar (default) or primary. */
export interface Target {
	kind: "dedicated" | "primary";
}

/** The full user configuration, validated by src/lib/sync/schema.ts (PR 4+). */
export interface SyncConfig {
	location: Location;
	/** AlAdhan calculation method id. */
	method: number;
	school: AsrSchool;
	prayers: Record<Prayer, PrayerRule>;
	days: Weekday[];
	defaults: RuleDefaults;
	rounding: Rounding;
	window?: TimeWindow;
	jummah: JummahRule;
	ooo: OooRule;
	titleLocale: TitleLocale;
	target: Target;
	replaceExisting: boolean;
}

/** One day of raw prayer times, wall-clock "HH:MM" strings, as fetched. */
export interface DayTimings {
	/** Local calendar date "YYYY-MM-DD". */
	date: string;
	/** IANA timezone the times are wall-clock in. */
	timezone: string;
	times: Partial<Record<Prayer, string>>;
	source: "aladhan" | "local";
}

/**
 * One out-of-office span the server read from the user's calendar, as local
 * wall-clock ISO strings ("YYYY-MM-DDTHH:MM"). All-day spans cover every
 * minute of the start date through the whole end date (a multi-day vacation
 * is one span); timed spans (including keyword-matched titles) remove only
 * overlapping prayers. Midnight-spanning timed spans should be expanded
 * per date by the caller (PR 4/PR 7 API).
 */
export interface OooEvent {
	startLocal: string;
	endLocal: string;
	allDay: boolean;
	title?: string;
	/** True when Google reported this as an outOfOffice event. */
	fromGoogle?: boolean;
}

/** A concrete event the engine wants on the calendar. */
export interface PlannedEvent {
	/** Stable reconcile id, e.g. `sc20261113p2` (plan §4.5). */
	id: string;
	prayer: Prayer;
	/** Local wall-clock ISO "YYYY-MM-DDTHH:MM"; may cross midnight. */
	startLocal: string;
	endLocal: string;
	timezone: string;
	title: string;
	transparency: Transparency;
	reminderMin?: number;
	colorId?: string;
}

export type SkipReason =
	| "prayer-off"
	| "day-off"
	| "jummah-off"
	| "outside-window"
	| "ooo";

export interface Skipped {
	date: string;
	prayer: Prayer;
	reason: SkipReason;
}

/** Everything the engine decided for one day. */
export interface DayPlan {
	date: string;
	events: PlannedEvent[];
	skipped: Skipped[];
}
