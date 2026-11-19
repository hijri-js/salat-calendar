import { describe, expect, it } from "vitest";

import { dayLabels, rangeLabel } from "@/features/preview/formatDate";

describe("dayLabels", () => {
	it("gives a short weekday and the day number", () => {
		expect(dayLabels("2026-11-18", "en")).toEqual({ weekday: "Wed", day: "18" });
	});

	it("keeps Latin digits in Arabic", () => {
		const { day, weekday } = dayLabels("2026-11-18", "ar");
		expect(day).toBe("18");
		expect(weekday).toMatch(/[؀-ۿ]/);
	});
});

describe("rangeLabel", () => {
	it("collapses a same-month range", () => {
		expect(rangeLabel("2026-11-18", "2026-11-24", "en")).toMatch(/Nov 18\s*–\s*24, 2026/);
	});

	it("uses Latin digits in Arabic", () => {
		const label = rangeLabel("2026-11-18", "2026-11-24", "ar");
		expect(label).toContain("18");
		expect(label).toContain("2026");
		expect(label).not.toMatch(/[٠-٩]/);
	});
});
