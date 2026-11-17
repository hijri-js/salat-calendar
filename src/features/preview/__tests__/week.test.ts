import { afterEach, describe, expect, it, vi } from "vitest";

import {
	addWeeks,
	estimateYearEvents,
	todayIso,
	weekDates,
	weekStartOf,
} from "@/features/preview/week";

describe("weekStartOf (Monday-based)", () => {
	it("returns the same date for a Monday", () => {
		expect(weekStartOf("2026-11-16")).toBe("2026-11-16"); // Monday
	});

	it("steps back to the Monday of the week", () => {
		expect(weekStartOf("2026-11-19")).toBe("2026-11-16"); // Thursday
		expect(weekStartOf("2026-11-15")).toBe("2026-11-09"); // Sunday
		expect(weekStartOf("2026-11-14")).toBe("2026-11-09"); // Saturday
		expect(weekStartOf("2026-11-22")).toBe("2026-11-16"); // Sunday → next week's Monday
	});

	it("crosses month and year boundaries", () => {
		expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
		expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
	});
});

describe("addWeeks", () => {
	it("moves a Monday by whole weeks and stays a Monday", () => {
		expect(addWeeks("2026-11-16", 1)).toBe("2026-11-23");
		expect(addWeeks("2026-11-16", 4)).toBe("2026-12-14");
		expect(addWeeks("2026-11-23", -1)).toBe("2026-11-16");
	});
});

describe("weekDates", () => {
	it("lists the seven days Monday to Sunday", () => {
		expect(weekDates("2026-11-16")).toEqual([
			"2026-11-16",
			"2026-11-17",
			"2026-11-18",
			"2026-11-19",
			"2026-11-20",
			"2026-11-21",
			"2026-11-22",
		]);
	});
});

describe("estimateYearEvents", () => {
	it("scales a week over 365 days", () => {
		expect(estimateYearEvents(7)).toBe(365);
		expect(estimateYearEvents(0)).toBe(0);
		expect(estimateYearEvents(5)).toBe(261); // 5 * 365 / 7 ≈ 260.7
		expect(estimateYearEvents(15)).toBe(782); // 782.14 → 782
	});
});

describe("todayIso", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the frozen date in local time", () => {
		// Freeze the clock so the test cannot race a real midnight rollover.
		vi.setSystemTime(new Date("2025-06-15T23:30:00"));
		expect(todayIso()).toBe("2025-06-15");
	});
});
