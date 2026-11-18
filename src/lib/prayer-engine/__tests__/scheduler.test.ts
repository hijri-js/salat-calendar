import { describe, expect, it } from "vitest";

import type { DayTimings, OooEvent, PrayerRule, SyncConfig } from "@/lib/prayer-engine/types";
import { isExcludedByOoo, planDay, planRange, resolveJummah } from "@/lib/prayer-engine/scheduler";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as SyncConfig["days"];

/** A full config with working defaults; tests override slices. */
function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
	const prayer = (extra: Partial<PrayerRule> = {}): PrayerRule => ({
		enabled: true,
		...extra,
	});
	return {
		location: { latitude: 51.5, longitude: -0.12 },
		method: 3,
		school: "standard",
		prayers: {
			fajr: prayer(),
			dhuhr: prayer(),
			asr: prayer(),
			maghrib: prayer(),
			isha: prayer(),
		},
		days: ALL_DAYS,
		defaults: {
			offsetMin: 15,
			durationMin: 20,
			transparency: "opaque",
		},
		rounding: { grid: "off", direction: "nearest" },
		jummah: { mode: "same" },
		ooo: { enabled: false, keywords: [] },
		titleLocale: "en",
		target: { kind: "dedicated" },
		replaceExisting: true,
		...overrides,
	};
}

function makeTimings(date: string, times: Partial<Record<string, string>>): DayTimings {
	return {
		date,
		timezone: "Europe/London",
		times: {
			fajr: "05:00",
			dhuhr: "12:00",
			asr: "15:00",
			maghrib: "18:00",
			isha: "19:30",
			...times,
		},
		source: "aladhan",
	};
}

/** 2026-11-13 is a Friday; 2026-11-15 is a Sunday. */
const FRIDAY = "2026-11-13";
const SUNDAY = "2026-11-15";

describe("planDay: the normal pipeline", () => {
	it("schedules every prayer with the default offset and duration", () => {
		const plan = planDay(makeTimings(SUNDAY, {}), makeConfig());
		expect(plan.events).toHaveLength(5);
		expect(plan.skipped).toHaveLength(0);

		const fajr = plan.events[0];
		expect(fajr.prayer).toBe("fajr");
		expect(fajr.startLocal).toBe(`${SUNDAY}T05:15`);
		expect(fajr.endLocal).toBe(`${SUNDAY}T05:35`);
		expect(fajr.id).toBe(`sc${SUNDAY.replaceAll("-", "")}p0`);
		expect(fajr.timezone).toBe("Europe/London");
		expect(fajr.title).toBe("Fajr");
		expect(fajr.transparency).toBe("opaque");

		const isha = plan.events[4];
		expect(isha.id).toBe(`sc${SUNDAY.replaceAll("-", "")}p4`);
		expect(isha.startLocal).toBe(`${SUNDAY}T19:45`);
	});

	it("lets a per-prayer rule override offset, duration and transparency", () => {
		const config = makeConfig({
			prayers: {
				fajr: { enabled: true, offsetMin: 30, durationMin: 45, transparency: "transparent" },
				dhuhr: { enabled: true },
				asr: { enabled: true },
				maghrib: { enabled: true },
				isha: { enabled: true },
			},
			defaults: {
				offsetMin: 15,
				durationMin: 20,
				transparency: "opaque",
				reminderMin: 10,
				colorId: "4",
			},
		});
		const plan = planDay(makeTimings(SUNDAY, {}), config);
		const fajr = plan.events[0];
		expect(fajr.startLocal).toBe(`${SUNDAY}T05:30`);
		expect(fajr.endLocal).toBe(`${SUNDAY}T06:15`);
		expect(fajr.transparency).toBe("transparent");
		const dhuhr = plan.events[1];
		expect(dhuhr.transparency).toBe("opaque");
		expect(dhuhr.reminderMin).toBe(10);
		expect(dhuhr.colorId).toBe("4");
	});
});

describe("planDay: skips", () => {
	it("skips disabled prayers as prayer-off", () => {
		const config = makeConfig({
			prayers: {
				fajr: { enabled: true },
				dhuhr: { enabled: false },
				asr: { enabled: true },
				maghrib: { enabled: false },
				isha: { enabled: true },
			},
		});
		const plan = planDay(makeTimings(SUNDAY, {}), config);
		expect(plan.events).toHaveLength(3);
		expect(plan.skipped).toEqual([
			{ date: SUNDAY, prayer: "dhuhr", reason: "prayer-off" },
			{ date: SUNDAY, prayer: "maghrib", reason: "prayer-off" },
		]);
	});

	it("skips every prayer as day-off when the weekday is not enabled", () => {
		const config = makeConfig({ days: [1, 2, 3, 4, 5] });
		const plan = planDay(makeTimings(SUNDAY, {}), config);
		expect(plan.events).toHaveLength(0);
		expect(plan.skipped).toHaveLength(5);
		expect(plan.skipped.every((s) => s.reason === "day-off")).toBe(true);
	});

	it("treats a missing adhan time as prayer-off", () => {
		const timings = makeTimings(SUNDAY, { asr: undefined });
		delete timings.times.asr;
		const plan = planDay(timings, makeConfig());
		expect(plan.skipped).toContainEqual({ date: SUNDAY, prayer: "asr", reason: "prayer-off" });
		expect(plan.events).toHaveLength(4);
	});
});

describe("planDay: rounding", () => {
	it("snaps to the 5-minute grid in all three directions", () => {
		// Dhuhr 12:00 + 15 = 12:15 (already on the grid); use asr 15:07 + 15 = 15:22.
		const nearest = planDay(
			makeTimings(SUNDAY, { asr: "15:07" }),
			makeConfig({ rounding: { grid: 5, direction: "nearest" } }),
		);
		expect(nearest.events[2].startLocal).toBe(`${SUNDAY}T15:20`);
		const up = planDay(
			makeTimings(SUNDAY, { asr: "15:07" }),
			makeConfig({ rounding: { grid: 5, direction: "up" } }),
		);
		expect(up.events[2].startLocal).toBe(`${SUNDAY}T15:25`);
		const down = planDay(
			makeTimings(SUNDAY, { asr: "15:07" }),
			makeConfig({ rounding: { grid: 5, direction: "down" } }),
		);
		expect(down.events[2].startLocal).toBe(`${SUNDAY}T15:20`);
	});

	it("snaps to the 10-minute grid", () => {
		const plan = planDay(
			makeTimings(SUNDAY, { asr: "15:07" }),
			makeConfig({ rounding: { grid: 10, direction: "nearest" } }),
		);
		// 15:22 nearest 10-grid is 15:20.
		expect(plan.events[2].startLocal).toBe(`${SUNDAY}T15:20`);
	});
});

describe("planDay: midnight crossings", () => {
	it("moves an Isha event to the next date when the offset crosses midnight", () => {
		const plan = planDay(makeTimings(SUNDAY, { isha: "23:50" }), makeConfig());
		const isha = plan.events[4];
		expect(isha.startLocal).toBe("2026-11-16T00:05");
		expect(isha.endLocal).toBe("2026-11-16T00:25");
		// The id follows the prayer's own (source) date, not the shifted one,
		// so two days crossing midnight can never share an id.
		expect(isha.id).toBe("sc20261115p4");
	});

	it("moves a Fajr event to the previous date for a negative offset", () => {
		const plan = planDay(
			makeTimings(SUNDAY, { fajr: "00:05" }),
			makeConfig({
				prayers: { fajr: { enabled: true, offsetMin: -15 }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: false }, isha: { enabled: false } },
			}),
		);
		const fajr = plan.events[0];
		expect(fajr.startLocal).toBe("2026-11-14T23:50");
		expect(fajr.endLocal).toBe("2026-11-15T00:10");
		expect(fajr.id).toBe("sc20261115p0");
	});
});

describe("event ids are unique across a midnight crossing", () => {
	it("gives two consecutive Ishas different ids when only the first crosses midnight", () => {
		// +10: day 1 Isha 23:51 -> day 2 00:01; day 2 Isha 23:49 -> day 2 23:59.
		const config = makeConfig({ defaults: { offsetMin: 10, durationMin: 20, transparency: "opaque" } });
		const plans = planRange(
			[makeTimings("2026-06-20", { isha: "23:51" }), makeTimings("2026-06-21", { isha: "23:49" })],
			config,
		);
		const first = plans[0].events.find((e) => e.prayer === "isha");
		const second = plans[1].events.find((e) => e.prayer === "isha");
		expect(first?.startLocal).toBe("2026-06-21T00:01");
		expect(second?.startLocal).toBe("2026-06-21T23:59");
		expect(first?.id).not.toBe(second?.id);
		expect(first?.id).toBe("sc20260620p4");
		expect(second?.id).toBe("sc20260621p4");
	});

	it("never excludes anything when there are no out-of-office spans", () => {
		expect(isExcludedByOoo([], ["OOO"], "2026-06-21T00:01", "2026-06-21T00:21")).toBe(false);
	});

	it("checks out-of-office spans on the date the event actually lands", () => {
		// Isha on 20 Jun is pushed to 21 Jun 00:01; 21 Jun is an all-day vacation.
		const config = makeConfig({
			defaults: { offsetMin: 10, durationMin: 20, transparency: "opaque" },
			ooo: { enabled: true, keywords: [] },
		});
		const oooByDate = new Map([
			["2026-06-21", [{ startLocal: "2026-06-21T00:00", endLocal: "2026-06-21T23:59", allDay: true }]],
		]);
		const [plan] = planRange([makeTimings("2026-06-20", { isha: "23:51" })], config, oooByDate);
		expect(plan.events.find((e) => e.prayer === "isha")).toBeUndefined();
		expect(plan.skipped).toContainEqual({ date: "2026-06-20", prayer: "isha", reason: "ooo" });
	});
});

describe("planDay: time window", () => {
	it("keeps December Maghrib inside an 08:00-16:00 window and drops June's", () => {
		const config = makeConfig({ window: { startMin: 480, endMin: 960 } });
		const december = planDay(
			makeTimings("2026-12-15", { maghrib: "15:40" }),
			{ ...config, prayers: { fajr: { enabled: false }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: true }, isha: { enabled: false } } },
		);
		expect(december.events[0].startLocal).toBe("2026-12-15T15:55");
		const june = planDay(
			makeTimings("2026-06-15", { maghrib: "21:21" }),
			{ ...config, prayers: { fajr: { enabled: false }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: true }, isha: { enabled: false } } },
		);
		expect(june.events).toHaveLength(0);
		expect(june.skipped.find((s) => s.prayer === "maghrib")?.reason).toBe("outside-window");
	});

	it("wraps an overnight window 22:00-06:00", () => {
		const config = makeConfig({ window: { startMin: 1320, endMin: 360 } });
		const plan = planDay(
			makeTimings(SUNDAY, { fajr: "05:00", dhuhr: "12:00", isha: "22:10" }),
			{ ...config, prayers: { fajr: { enabled: true }, dhuhr: { enabled: true }, asr: { enabled: false }, maghrib: { enabled: false }, isha: { enabled: true } } },
		);
		expect(plan.events.map((e) => e.prayer).sort()).toEqual(["fajr", "isha"]);
		expect(plan.skipped).toContainEqual({ date: SUNDAY, prayer: "dhuhr", reason: "outside-window" });
	});
});

describe("planDay: the four Jummah modes (plan §2)", () => {
	const fridayTimings = makeTimings(FRIDAY, { dhuhr: "12:30" });

	it("mode 'same': Friday Dhuhr follows the normal rule", () => {
		const plan = planDay(fridayTimings, makeConfig({ jummah: { mode: "same" } }));
		const dhuhr = plan.events[1];
		expect(dhuhr.startLocal).toBe(`${FRIDAY}T12:45`);
		expect(dhuhr.endLocal).toBe(`${FRIDAY}T13:05`);
	});

	it("mode 'none': no Friday slot, only Dhuhr is skipped as jummah-off", () => {
		const config = makeConfig({ jummah: { mode: "none" } });
		const plan = planDay(fridayTimings, config);
		expect(plan.skipped).toContainEqual({ date: FRIDAY, prayer: "dhuhr", reason: "jummah-off" });
		expect(plan.events).toHaveLength(4);
		expect(plan.events[1].prayer).toBe("asr");
	});

	it("mode 'fixed': uses the fixed clock time and its own length", () => {
		const config = makeConfig({ jummah: { mode: "fixed", fixedTime: "12:30", durationMin: 60 } });
		const plan = planDay(fridayTimings, config);
		const dhuhr = plan.events[1];
		expect(dhuhr.startLocal).toBe(`${FRIDAY}T12:30`);
		expect(dhuhr.endLocal).toBe(`${FRIDAY}T13:30`);
	});

	it("mode 'fixed': falls back to the default duration", () => {
		const config = makeConfig({ jummah: { mode: "fixed", fixedTime: "12:30" } });
		const plan = planDay(fridayTimings, config);
		expect(plan.events[1].endLocal).toBe(`${FRIDAY}T12:50`);
	});

	it("mode 'fixed' without a fixedTime throws", () => {
		const config = makeConfig({ jummah: { mode: "fixed" } });
		expect(() => planDay(fridayTimings, config)).toThrow("requires fixedTime");
	});

	it("mode 'custom': offset from the Dhuhr adhan, own length, rounding applies", () => {
		const config = makeConfig({
			jummah: { mode: "custom", offsetMin: 0, durationMin: 45 },
			rounding: { grid: 10, direction: "down" },
		});
		const plan = planDay(fridayTimings, config);
		const dhuhr = plan.events[1];
		expect(dhuhr.startLocal).toBe(`${FRIDAY}T12:30`);
		expect(dhuhr.endLocal).toBe(`${FRIDAY}T13:15`);
	});

	it("mode 'custom': falls back to the default offset", () => {
		const config = makeConfig({ jummah: { mode: "custom", durationMin: 45 } });
		const plan = planDay(fridayTimings, config);
		expect(plan.events[1].startLocal).toBe(`${FRIDAY}T12:45`);
	});

	it("mode 'custom': falls back to the default duration", () => {
		const config = makeConfig({ jummah: { mode: "custom", offsetMin: 0 } });
		const plan = planDay(fridayTimings, config);
		expect(plan.events[1].endLocal).toBe(`${FRIDAY}T12:50`);
	});

	it("only changes Friday Dhuhr, not other days or other prayers", () => {
		const config = makeConfig({ jummah: { mode: "none" } });
		const saturday = planDay(makeTimings("2026-11-14", { dhuhr: "12:30" }), config);
		expect(saturday.events).toHaveLength(5);
		const resolve = resolveJummah("asr", 5, 900, config);
		expect(resolve.action).toBe("normal");
	});
});

describe("planDay: out-of-office skip (plan §2)", () => {
	const vacation: OooEvent = {
		startLocal: `${SUNDAY}T00:00`,
		endLocal: `${SUNDAY}T23:59`,
		allDay: true,
	};

	it("an all-day OOO removes the whole day", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: [] } });
		const plan = planDay(makeTimings(SUNDAY, {}), config, [vacation]);
		expect(plan.events).toHaveLength(0);
		expect(plan.skipped.every((s) => s.reason === "ooo")).toBe(true);
	});

	it("does nothing while OOO skip is off", () => {
		const config = makeConfig({ ooo: { enabled: false, keywords: ["Vacation"] } });
		const plan = planDay(makeTimings(SUNDAY, {}), config, [vacation]);
		expect(plan.events).toHaveLength(5);
	});

	it("a multi-day all-day vacation excludes every day inside its range", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: [] } });
		const trip: OooEvent = {
			startLocal: "2026-11-15T00:00",
			endLocal: "2026-11-17T23:59",
			allDay: true,
		};
		expect(planDay(makeTimings(SUNDAY, {}), config, [trip]).events).toHaveLength(0);
		expect(planDay(makeTimings("2026-11-17", {}), config, [trip]).events).toHaveLength(0);
		// The day after the trip ends is untouched.
		expect(planDay(makeTimings("2026-11-18", {}), config, [trip]).events).toHaveLength(5);
	});

	it("touching OOO endpoints do not exclude (half-open intervals)", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: [] } });
		const adjacent: OooEvent = {
			startLocal: `${SUNDAY}T13:00`,
			endLocal: `${SUNDAY}T15:15`,
			allDay: false,
			fromGoogle: true,
		};
		// Asr runs 15:15-15:35; the span ends exactly as it starts.
		const plan = planDay(makeTimings(SUNDAY, { asr: "15:00" }), config, [adjacent]);
		expect(plan.skipped).toHaveLength(0);
	});

	it("a Google outOfOffice event removes only overlapping prayers", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: [] } });
		const meeting: OooEvent = {
			startLocal: `${SUNDAY}T15:10`,
			endLocal: `${SUNDAY}T16:30`,
			allDay: false,
			fromGoogle: true,
		};
		const plan = planDay(makeTimings(SUNDAY, { asr: "15:00" }), config, [meeting]);
		// Asr 15:15-15:35 overlaps; Maghrib 18:15-18:35 does not.
		expect(plan.skipped).toContainEqual({ date: SUNDAY, prayer: "asr", reason: "ooo" });
		expect(plan.events.map((e) => e.prayer)).toContain("maghrib");
	});

	it("a keyword-matched title removes only overlapping prayers", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: ["vacation", "إجازة"] } });
		const flight: OooEvent = {
			startLocal: `${SUNDAY}T19:00`,
			endLocal: `${SUNDAY}T21:00`,
			allDay: false,
			title: "Flight to VACATION land",
		};
		const plan = planDay(makeTimings(SUNDAY, { isha: "19:30", maghrib: "17:00" }), config, [flight]);
		expect(plan.skipped).toContainEqual({ date: SUNDAY, prayer: "isha", reason: "ooo" });
		expect(plan.events.map((e) => e.prayer)).toContain("maghrib");
	});

	it("ignores ordinary events that match no keyword and are not outOfOffice", () => {
		const config = makeConfig({ ooo: { enabled: true, keywords: ["vacation"] } });
		const meeting: OooEvent = {
			startLocal: `${SUNDAY}T12:00`,
			endLocal: `${SUNDAY}T13:00`,
			allDay: false,
			title: "Team meeting",
		};
		const plan = planDay(makeTimings(SUNDAY, { dhuhr: "12:00" }), config, [meeting]);
		expect(plan.skipped).toHaveLength(0);
	});

	it("an empty keyword never matches every title", () => {
		const events: OooEvent[] = [
			{ startLocal: `${SUNDAY}T12:00`, endLocal: `${SUNDAY}T13:00`, allDay: false, title: "Anything" },
		];
		expect(isExcludedByOoo(events, [""], `${SUNDAY}T12:05`, `${SUNDAY}T12:25`)).toBe(false);
	});
});

describe("planDay: titles", () => {
	it("uses emoji, override and Arabic locale per the rules", () => {
		const config = makeConfig({
			titleLocale: "ar",
			prayers: {
				fajr: { enabled: true, emoji: "🌅" },
				dhuhr: { enabled: true, title: "Lunch block" },
				asr: { enabled: true },
				maghrib: { enabled: true, emoji: "🌇", title: "" },
				isha: { enabled: true },
			},
		});
		const plan = planDay(makeTimings(SUNDAY, {}), config);
		const titles = Object.fromEntries(plan.events.map((e) => [e.prayer, e.title]));
		expect(titles.fajr).toBe("🌅 الفجر");
		expect(titles.dhuhr).toBe("Lunch block");
		expect(titles.asr).toBe("العصر");
		expect(titles.maghrib).toBe("🌇 المغرب"); // blank override falls back to emoji + name
	});
});

describe("planRange", () => {

	it("chains planDay across days", () => {
		const days = [makeTimings("2026-11-15", {}), makeTimings("2026-11-16", {})];
		const plans = planRange(days, makeConfig());
		expect(plans.map((p) => p.date)).toEqual(["2026-11-15", "2026-11-16"]);
		expect(plans[0].events).toHaveLength(5);
	});

	it("applies per-date OOO spans only to their own date", () => {
		const days = [makeTimings("2026-11-15", {}), makeTimings("2026-11-16", {})];
		const oooByDate = new Map([["2026-11-15", [{ startLocal: "2026-11-15T00:00", endLocal: "2026-11-15T23:59", allDay: true }]]]);
		const plans = planRange(days, makeConfig({ ooo: { enabled: true, keywords: [] } }), oooByDate);
		expect(plans[0].events).toHaveLength(0);
		expect(plans[1].events).toHaveLength(5);
	});
});

describe("planDay: DST weeks stay wall-clock (plan §10)", () => {
	it("follows the input clock across the London DST change (25 Oct 2026)", () => {
		const config = makeConfig({
			prayers: { fajr: { enabled: false }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: true }, isha: { enabled: false } },
		});
		// AlAdhan reports wall-clock times; sunset jumps 17:57 (BST) to 16:53 (GMT).
		const days = [
			makeTimings("2026-10-24", { maghrib: "17:57" }),
			makeTimings("2026-10-25", { maghrib: "16:53" }),
			makeTimings("2026-10-26", { maghrib: "16:51" }),
		];
		const plans = planRange(days, config);
		expect(plans.map((p) => p.events[0].startLocal)).toEqual([
			"2026-10-24T18:12",
			"2026-10-25T17:08",
			"2026-10-26T17:06",
		]);
	});

	it("does the same across the New York DST change (1 Nov 2026)", () => {
		const config = makeConfig({
			prayers: { fajr: { enabled: false }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: true }, isha: { enabled: false } },
		});
		const days = [
			{ ...makeTimings("2026-10-31", { maghrib: "17:52" }), timezone: "America/New_York" },
			{ ...makeTimings("2026-11-01", { maghrib: "16:50" }), timezone: "America/New_York" },
		];
		const plans = planRange(days, config);
		expect(plans.map((p) => p.events[0].startLocal)).toEqual([
			"2026-10-31T18:07",
			"2026-11-01T17:05",
		]);
		expect(plans.every((p) => p.events[0].timezone === "America/New_York")).toBe(true);
	});

	it("handles Riyadh, which has no DST at all", () => {
		const config = makeConfig({
			prayers: { fajr: { enabled: false }, dhuhr: { enabled: false }, asr: { enabled: false }, maghrib: { enabled: true }, isha: { enabled: false } },
		});
		const days = [
			{ ...makeTimings("2026-06-01", { maghrib: "18:57" }), timezone: "Asia/Riyadh" },
			{ ...makeTimings("2026-12-01", { maghrib: "17:36" }), timezone: "Asia/Riyadh" },
		];
		const plans = planRange(days, config);
		expect(plans.map((p) => p.events[0].startLocal)).toEqual([
			"2026-06-01T19:12",
			"2026-12-01T17:51",
		]);
	});
});
