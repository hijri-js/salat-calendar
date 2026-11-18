import { describe, expect, it } from "vitest";

import {
	addDays,
	applyOffset,
	dayShift,
	formatMinutes,
	isWithinWindow,
	localIsoToMinutes,
	parseTime,
	roundToGrid,
	toLocalIso,
	weekdayOf,
	withinDay,
} from "@/lib/prayer-engine/time";

describe("parseTime", () => {
	it("parses HH:MM", () => {
		expect(parseTime("04:32")).toBe(272);
	});

	it("strips a parenthetical timezone marker and whitespace", () => {
		expect(parseTime("4:32 (BST)")).toBe(272);
		expect(parseTime(" 23:59 ")).toBe(1439);
	});

	it("ignores seconds", () => {
		expect(parseTime("04:32:10")).toBe(272);
	});

	it("rejects malformed or out-of-range times", () => {
		expect(() => parseTime("25:00")).toThrow("Invalid time");
		expect(() => parseTime("12:60")).toThrow("Invalid time");
		expect(() => parseTime("abc")).toThrow("Invalid time");
		expect(() => parseTime("")).toThrow("Invalid time");
	});
});

describe("applyOffset / dayShift / withinDay", () => {
	it("adds offsets", () => {
		expect(applyOffset(272, 15)).toBe(287);
		expect(applyOffset(272, -20)).toBe(252);
	});

	it("classifies day shifts for allowed offsets", () => {
		expect(dayShift(0)).toBe(0);
		expect(dayShift(1439)).toBe(0);
		expect(dayShift(1440)).toBe(1);
		expect(dayShift(1500)).toBe(1);
		expect(dayShift(-5)).toBe(-1);
	});

	it("normalises minutes into the day", () => {
		expect(withinDay(1445)).toBe(5);
		expect(withinDay(-5)).toBe(1435);
		expect(withinDay(1440)).toBe(0);
	});
});

describe("roundToGrid", () => {
	it("passes minutes through when the grid is off", () => {
		expect(roundToGrid(273, "off", "nearest")).toBe(273);
	});

	it("rounds nearest on a 5-minute grid, ties up", () => {
		expect(roundToGrid(272, 5, "nearest")).toBe(270);
		expect(roundToGrid(273, 5, "nearest")).toBe(275);
		expect(roundToGrid(272.5, 5, "nearest")).toBe(275);
	});

	it("rounds up and down on a 5-minute grid", () => {
		expect(roundToGrid(273, 5, "up")).toBe(275);
		expect(roundToGrid(270, 5, "up")).toBe(270);
		expect(roundToGrid(273, 5, "down")).toBe(270);
		expect(roundToGrid(270, 5, "down")).toBe(270);
	});

	it("works on a 10-minute grid", () => {
		expect(roundToGrid(275, 10, "nearest")).toBe(280);
		expect(roundToGrid(274, 10, "up")).toBe(280);
		expect(roundToGrid(279, 10, "down")).toBe(270);
	});
});

describe("isWithinWindow", () => {
	it("always allows when there is no window", () => {
		expect(isWithinWindow(0, undefined)).toBe(true);
	});

	it("applies a normal half-open window", () => {
		const window = { startMin: 480, endMin: 960 };
		expect(isWithinWindow(480, window)).toBe(true);
		expect(isWithinWindow(959, window)).toBe(true);
		expect(isWithinWindow(960, window)).toBe(false);
		expect(isWithinWindow(479, window)).toBe(false);
	});

	it("wraps overnight windows such as 22:00-06:00", () => {
		const window = { startMin: 1320, endMin: 360 };
		expect(isWithinWindow(1320, window)).toBe(true);
		expect(isWithinWindow(1439, window)).toBe(true);
		expect(isWithinWindow(0, window)).toBe(true);
		expect(isWithinWindow(359, window)).toBe(true);
		expect(isWithinWindow(360, window)).toBe(false);
		expect(isWithinWindow(1319, window)).toBe(false);
	});

	it("treats a zero-length window as never open", () => {
		expect(isWithinWindow(480, { startMin: 480, endMin: 480 })).toBe(false);
	});
});

describe("formatMinutes", () => {
	it("formats within-day minutes", () => {
		expect(formatMinutes(272)).toBe("04:32");
		expect(formatMinutes(0)).toBe("00:00");
		expect(formatMinutes(1439)).toBe("23:59");
	});
});

describe("addDays / weekdayOf", () => {
	it("adds days across month boundaries", () => {
		expect(addDays("2026-01-01", 1)).toBe("2026-01-02");
		expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
		expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
		expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
	});

	it("knows days of the week", () => {
		expect(weekdayOf("2026-11-13")).toBe(5); // Friday
		expect(weekdayOf("2026-11-15")).toBe(0); // Sunday
	});

	it("rejects malformed dates", () => {
		expect(() => weekdayOf("not-a-date")).toThrow("Invalid date");
		expect(() => weekdayOf("2026-13-01")).toThrow("Invalid date");
		expect(() => addDays("2026-00-10", 1)).toThrow("Invalid date");
	});
});

describe("toLocalIso / localIsoToMinutes", () => {
	it("formats within-day starts", () => {
		expect(toLocalIso("2026-11-13", 272)).toBe("2026-11-13T04:32");
	});

	it("moves the event date when an offset crosses midnight", () => {
		expect(toLocalIso("2026-11-13", 1445)).toBe("2026-11-14T00:05");
		expect(toLocalIso("2026-11-13", -5)).toBe("2026-11-12T23:55");
	});

	it("round-trips through absolute minutes", () => {
		expect(localIsoToMinutes("2026-11-13T04:32")).toBe(
			localIsoToMinutes("2026-11-13T00:00") + 272,
		);
	});

	it("rejects malformed timestamps", () => {
		expect(() => localIsoToMinutes("nonsense")).toThrow("Invalid local ISO timestamp");
		expect(() => localIsoToMinutes("2026-11-13T24:00")).toThrow("Invalid local ISO timestamp");
		expect(() => localIsoToMinutes("2026-11-13T12:60")).toThrow("Invalid local ISO timestamp");
		expect(() => localIsoToMinutes("2026-13-01T10:00")).toThrow("Invalid local ISO timestamp");
		expect(() => localIsoToMinutes("2026-02-30T10:00")).toThrow("Invalid local ISO timestamp");
	});
});
