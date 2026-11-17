import { describe, expect, it } from "vitest";

import { ApiError } from "../aladhan";
import { normalizeMonth } from "../normalize";
import type { Prayer } from "@/lib/prayer-engine/types";
import londonNov from "./fixtures/london-nov-2026-mwl.json";
import londonJun from "./fixtures/london-jun-2026-mwl.json";
import makkahHanafi from "./fixtures/makkah-nov-2026-umm-alqura-hanafi.json";

/** The normaliser always fills all five times; unwrap for assertions. */
function timeOf(times: Partial<Record<Prayer, string>>, prayer: Prayer): string {
	const value = times[prayer];
	if (value === undefined) {
		throw new Error(`missing ${prayer}`);
	}
	return value;
}

describe("normalizeMonth with recorded fixtures", () => {
	it("normalises the London November fixture (GMT, MWL, standard)", () => {
		const days = normalizeMonth(londonNov, { method: 3, school: "standard" });
		expect(days).toHaveLength(3);
		// Literal values from the recorded fixture (reviewer: no tautologies).
		expect(days[0]!.times).toEqual({
			fajr: "05:00",
			dhuhr: "11:44",
			asr: "14:08",
			maghrib: "16:33",
			isha: "18:20",
		});
		expect(days[0]!.date).toBe("2026-11-01");
		expect(days[0]!.timezone).toBe("Europe/London");
		expect(days[0]!.source).toBe("aladhan");
	});

	it("carries the IANA timezone from meta and strips the (GMT) suffix", () => {
		const days = normalizeMonth(londonNov, { method: 3, school: "standard" });
		const rawFajr = (
			londonNov.data[0] as { timings: { Fajr: string } }
		).timings.Fajr;
		expect(rawFajr).toContain("(");
		expect(timeOf(days[0]!.times, "fajr")).not.toContain("(");
		expect(days.every((d) => d.timezone === "Europe/London")).toBe(true);
	});

	it("handles the June fixture with (BST) suffixes identically", () => {
		const days = normalizeMonth(londonJun, { method: 3, school: "standard" });
		expect(days[0].timezone).toBe("Europe/London");
		expect(timeOf(days[0]!.times, "fajr")).toMatch(/^\d{2}:\d{2}$/);
	});

	it("normalises the Makkah fixture (Umm al-Qura, Hanafi)", () => {
		const days = normalizeMonth(makkahHanafi, { method: 4, school: "hanafi" });
		expect(days[0].timezone).toBe("Asia/Riyadh");
		expect(days[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("converts dd-mm-yyyy gregorian dates to ISO across a month boundary", () => {
		const days = normalizeMonth(londonNov, { method: 3, school: "standard" });
		expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
	});
});

describe("normalizeMonth validation", () => {
	const valid = { code: 200, status: "OK", data: londonNov.data };

	it("rejects a non-200 code as SERVER", () => {
		expect(() => normalizeMonth({ code: 400, data: "bad" }, { method: 3, school: "standard" })).toThrow(ApiError);
		try {
			normalizeMonth({ code: 400, data: "bad" }, { method: 3, school: "standard" });
		} catch (error) {
			expect((error as ApiError).code).toBe("SERVER");
		}
	});

	it("rejects a shape that is not an AlAdhan response", () => {
		expect(() => normalizeMonth({ hello: true }, { method: 3, school: "standard" })).toThrow(ApiError);
		try {
			normalizeMonth({ hello: true }, { method: 3, school: "standard" });
		} catch (error) {
			expect((error as ApiError).code).toBe("UNEXPECTED");
		}
	});

	it("rejects an echoed method mismatch (the silent method=999 gotcha)", () => {
		const tampered = JSON.parse(JSON.stringify(valid));
		tampered.data[0].meta.method.id = 2;
		try {
			normalizeMonth(tampered, { method: 3, school: "standard" });
			expect.unreachable("should have thrown");
		} catch (error) {
			expect((error as ApiError).code).toBe("UNEXPECTED");
			expect((error as ApiError).message).toMatch(/method/);
		}
	});

	it("rejects an echoed school mismatch", () => {
		const tampered = JSON.parse(JSON.stringify(valid));
		tampered.data[0].meta.school = "HANAFI";
		try {
			normalizeMonth(tampered, { method: 3, school: "standard" });
			expect.unreachable("should have thrown");
		} catch (error) {
			expect((error as ApiError).message).toMatch(/school/);
		}
	});

	it("rejects out-of-range time components", () => {
		const tampered = JSON.parse(JSON.stringify(valid));
		tampered.data[0].timings.Fajr = "25:00 (GMT)";
		expect(() => normalizeMonth(tampered, { method: 3, school: "standard" })).toThrow(/Out-of-range/);
	});

	it("rejects an unparseable time string", () => {
		const tampered = JSON.parse(JSON.stringify(valid));
		tampered.data[0].timings.Fajr = "not-a-time";
		expect(() => normalizeMonth(tampered, { method: 3, school: "standard" })).toThrow(/Unparseable/);
	});
});
