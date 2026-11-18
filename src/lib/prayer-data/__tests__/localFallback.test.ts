import { describe, expect, it } from "vitest";

import { computeLocalMonthTimings, supportedLocalMethods } from "@/lib/prayer-data/localFallback";
import type { DayTimings, Prayer } from "@/lib/prayer-engine/types";
import { parseTime } from "@/lib/prayer-engine/time";

/** The fallback always fills all five times; unwrap for assertions. */
function timeOf(day: DayTimings, prayer: Prayer): string {
	const value = day.times[prayer];
	if (value === undefined) {
		throw new Error(`missing ${prayer}`);
	}
	return value;
}

describe("computeLocalMonthTimings", () => {
	it("computes a full month of wall-clock times for London", () => {
		const days = computeLocalMonthTimings({
			latitude: 51.5,
			longitude: -0.12,
			method: 3,
			school: "standard",
			year: 2026,
			month: 11,
			timezone: "Europe/London",
		});
		expect(days).toHaveLength(30);
		expect(days[0]).toMatchObject({ date: "2026-11-01", timezone: "Europe/London", source: "local" });
		for (const day of days) {
			for (const time of Object.values(day.times)) {
				expect(parseTime(time)).toBeLessThanOrEqual(1439);
			}
			const m = (t: string) => parseTime(t);
			// Sanity ordering within each day.
			expect(m(timeOf(day, "fajr"))).toBeLessThan(m(timeOf(day, "dhuhr")));
			expect(m(timeOf(day, "asr"))).toBeLessThan(m(timeOf(day, "maghrib")));
			expect(m(timeOf(day, "maghrib"))).toBeLessThan(m(timeOf(day, "isha")));
		}
	});

	it("matches adhan's own numbers for a known day (MWL London 2026-11-15)", () => {
		const days = computeLocalMonthTimings({
			latitude: 51.5,
			longitude: -0.12,
			method: 3,
			school: "standard",
			year: 2026,
			month: 11,
			timezone: "Europe/London",
		});
		expect(days[14]!.times).toEqual({ fajr: "05:21", dhuhr: "11:46", asr: "13:48", maghrib: "16:11", isha: "18:02" });
	});

	it("returns local wall-clock times, not UTC, for a UTC+3 city (Cairo, July)", () => {
		const days = computeLocalMonthTimings({
			latitude: 30.04, longitude: 31.24, method: 5, school: "standard", year: 2026, month: 7, timezone: "Africa/Cairo",
		});
		expect(days[0]!.times).toEqual({ fajr: "04:12", dhuhr: "13:00", asr: "16:35", maghrib: "20:00", isha: "21:33" });
	});

	it("returns British Summer Time in June, not UTC (London, 21 June)", () => {
		const days = computeLocalMonthTimings({
			latitude: 51.5, longitude: -0.12, method: 3, school: "standard", year: 2026, month: 6, timezone: "Europe/London",
		});
		expect(days[20]!.times).toEqual({ fajr: "02:31", dhuhr: "13:03", asr: "17:25", maghrib: "21:22", isha: "23:27" });
	});

	it("handles a far-east timezone (Auckland, UTC+13)", () => {
		const days = computeLocalMonthTimings({
			latitude: -36.85, longitude: 174.76, method: 3, school: "standard", year: 2026, month: 11, timezone: "Pacific/Auckland",
		});
		expect(days[14]!.times.dhuhr).toBe("13:06");
	});

	it("handles February in a leap year", () => {
		const days = computeLocalMonthTimings({
			latitude: 51.5,
			longitude: -0.12,
			method: 3,
			school: "standard",
			year: 2024,
			month: 2,
			timezone: "Europe/London",
		});
		expect(days).toHaveLength(29);
		expect(days[28]!.date).toBe("2024-02-29");
	});

	it("uses the Hanafi madhab when asked (Asr moves later)", () => {
		const standard = computeLocalMonthTimings({
			latitude: 51.5, longitude: -0.12, method: 3, school: "standard", year: 2026, month: 11, timezone: "Europe/London",
		});
		const hanafi = computeLocalMonthTimings({
			latitude: 51.5, longitude: -0.12, method: 3, school: "hanafi", year: 2026, month: 11, timezone: "Europe/London",
		});
		expect(timeOf(standard[0]!, "asr") < timeOf(hanafi[0]!, "asr")).toBe(true);
	});

	it("refuses method ids it cannot reproduce instead of silently using another method", () => {
		expect(() =>
			computeLocalMonthTimings({
				latitude: 51.5, longitude: -0.12, method: 999, school: "standard", year: 2026, month: 11, timezone: "Europe/London",
			}),
		).toThrow(/method 999/);
	});

	it("reports the supported method ids: every method the UI offers", () => {
		// Mirrors CALCULATION_METHOD_IDS in the location feature (lib must not
		// import features); a fallback gap would turn an AlAdhan outage into a 502.
		expect(supportedLocalMethods()).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
		expect(supportedLocalMethods()).not.toContain(999);
	});

	it("Gulf Region (8) puts Isha 90 minutes after Maghrib, like AlAdhan", () => {
		const [day] = computeLocalMonthTimings({
			latitude: 25.2, longitude: 55.27, method: 8, school: "standard", year: 2026, month: 11, timezone: "Asia/Dubai",
		});
		const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
		expect(toMin(day!.times.isha!) - toMin(day!.times.maghrib!)).toBe(90);
	});

	it("France (12) and Russia (14) use their own Fajr angles (12° and 16°)", () => {
		const base = { latitude: 48.85, longitude: 2.35, school: "standard" as const, year: 2026, month: 11, timezone: "Europe/Paris" };
		const [france] = computeLocalMonthTimings({ ...base, method: 12 });
		const [russia] = computeLocalMonthTimings({ ...base, method: 14 });
		// A smaller depression angle means a later Fajr.
		expect(france!.times.fajr! > russia!.times.fajr!).toBe(true);
	});
});
