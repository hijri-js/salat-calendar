import { describe, expect, it } from "vitest";

import { computeLocalMonthTimings, supportedLocalMethods } from "../localFallback";
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

	it("falls back to Muslim World League for unsupported method ids", () => {
		const unsupported = computeLocalMonthTimings({
			latitude: 51.5, longitude: -0.12, method: 999, school: "standard", year: 2026, month: 11, timezone: "Europe/London",
		});
		const mwl = computeLocalMonthTimings({
			latitude: 51.5, longitude: -0.12, method: 3, school: "standard", year: 2026, month: 11, timezone: "Europe/London",
		});
		expect(unsupported).toEqual(mwl);
	});

	it("reports the supported method ids", () => {
		expect(supportedLocalMethods()).toContain(3);
		expect(supportedLocalMethods()).not.toContain(999);
	});
});
