import { describe, expect, it } from "vitest";

import { defaultConfig } from "@/features/wizard";
import { buildYearIcs, calendarNameFor, chunkDays, icsFileName, progressFraction, monthChunks, todayIn, yearRange } from "@/features/ics-export/icsFile";
import type { DayTimings, SyncConfig } from "@/lib/prayer-engine/types";

const LONDON: SyncConfig = {
	...defaultConfig,
	location: { latitude: 51.51, longitude: -0.13, timezone: "Europe/London", label: "London, England, United Kingdom" },
};

function day(date: string, source: DayTimings["source"] = "aladhan"): DayTimings {
	return {
		date,
		timezone: "Europe/London",
		times: { fajr: "05:10", dhuhr: "12:10", asr: "15:30", maghrib: "18:20", isha: "19:50" },
		source,
	};
}

describe("todayIn", () => {
	it("uses the place's date, not the device's", () => {
		// 23:30 UTC on Nov 18 is already Nov 19 in Riyadh (UTC+3).
		const now = new Date("2026-11-18T23:30:00Z");
		expect(todayIn("Asia/Riyadh", now)).toBe("2026-11-19");
		expect(todayIn("America/New_York", now)).toBe("2026-11-18");
	});
});

describe("yearRange", () => {
	it("covers 12 months ending the day before the same date next year", () => {
		expect(yearRange("2026-11-19")).toEqual({ from: "2026-11-19", to: "2027-11-18" });
		expect(yearRange("2027-01-01")).toEqual({ from: "2027-01-01", to: "2027-12-31" });
	});

	it("ends on Feb 28 when it starts on Feb 29", () => {
		expect(yearRange("2028-02-29")).toEqual({ from: "2028-02-29", to: "2029-02-28" });
	});
});

describe("monthChunks", () => {
	it("splits a rolling year into 13 calendar-month pieces", () => {
		const chunks = monthChunks("2026-11-19", "2027-11-18");
		expect(chunks).toHaveLength(13);
		expect(chunks[0]).toEqual({ from: "2026-11-19", to: "2026-11-30" });
		expect(chunks[1]).toEqual({ from: "2026-12-01", to: "2026-12-31" });
		expect(chunks[3]).toEqual({ from: "2027-02-01", to: "2027-02-28" });
		expect(chunks[12]).toEqual({ from: "2027-11-01", to: "2027-11-18" });
	});

	it("gives 12 pieces when the year starts on the 1st", () => {
		expect(monthChunks("2027-01-01", "2027-12-31")).toHaveLength(12);
	});

	it("handles a range inside one month", () => {
		expect(monthChunks("2026-11-19", "2026-11-25")).toEqual([{ from: "2026-11-19", to: "2026-11-25" }]);
	});
});

describe("icsFileName", () => {
	it("slugs the city part of the label", () => {
		expect(icsFileName("London, England, United Kingdom", "2026-11-19")).toBe("salat-london-2026.ics");
		expect(icsFileName("São Paulo, Brazil", "2026-11-19")).toBe("salat-sao-paulo-2026.ics");
	});

	it("falls back when the label has no ASCII letters or is missing", () => {
		expect(icsFileName("مكة المكرمة، السعودية", "2026-11-19")).toBe("salat-calendar-2026.ics");
		expect(icsFileName(undefined, "2027-01-01")).toBe("salat-calendar-2027.ics");
	});
});

describe("buildYearIcs", () => {
	const now = new Date("2026-11-19T10:00:00Z");

	it("plans every enabled prayer and counts the events", () => {
		const result = buildYearIcs([day("2026-11-19"), day("2026-11-20")], LONDON, { now, calendarName: "Salat" });
		// 5 prayers × 2 days; Nov 20 2026 is a Friday, and Dhuhr stays on its
		// adhan by default, still one event.
		expect(result.eventCount).toBe(10);
		expect(result.text.match(/BEGIN:VEVENT/g)).toHaveLength(10);
		expect(result.text).toContain("X-WR-CALNAME:Salat");
		expect(result.usedLocal).toBe(false);
	});

	it("ignores vacation skip: the file cannot read the user's calendar", () => {
		const result = buildYearIcs([day("2026-11-19")], { ...LONDON, ooo: { enabled: true, keywords: ["Vacation"] } }, { now });
		expect(result.eventCount).toBe(5);
	});

	it("flags days that came from the local fallback", () => {
		expect(buildYearIcs([day("2026-11-19", "local")], LONDON, { now }).usedLocal).toBe(true);
	});

	it("keeps wall-clock times across the London DST change (Mar 28 2027)", () => {
		const result = buildYearIcs([day("2027-03-27"), day("2027-03-29")], LONDON, { now });
		// Fajr at the 05:10 adhan (default offset 0): GMT before, BST (UTC+1) after.
		expect(result.text).toContain("DTSTART:20270327T051000Z");
		expect(result.text).toContain("DTSTART:20270329T041000Z");
	});
});

describe("calendarNameFor", () => {
	it("names the calendar in the event-title language", () => {
		expect(calendarNameFor("en")).toBe("Salat");
		expect(calendarNameFor("ar")).toBe("الصلاة");
	});
});

describe("chunkDays / progressFraction", () => {
	it("counts inclusive days, and the chunks of a year add up to the year", () => {
		expect(chunkDays({ from: "2026-11-19", to: "2026-11-30" })).toBe(12);
		expect(chunkDays({ from: "2027-02-01", to: "2027-02-28" })).toBe(28);
		const total = monthChunks("2026-11-19", "2027-11-18").reduce((sum, c) => sum + chunkDays(c), 0);
		expect(total).toBe(365);
	});

	it("is a 0..1 share and safe for an empty total", () => {
		expect(progressFraction(0, 365)).toBe(0);
		expect(progressFraction(73, 365)).toBeCloseTo(0.2);
		expect(progressFraction(400, 365)).toBe(1);
		expect(progressFraction(5, 0)).toBe(0);
	});
});
