import { afterEach, describe, expect, it, vi } from "vitest";

import {
	addWeeks,
	estimateYearEvents,
	todayIso,
	weekDates,
} from "@/features/preview/week";

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
