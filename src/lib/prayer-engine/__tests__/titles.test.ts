import { describe, expect, it } from "vitest";

import { formatTitle } from "@/lib/prayer-engine/titles";

describe("formatTitle", () => {
	it("uses the locale name by default", () => {
		expect(formatTitle("dhuhr", "en")).toBe("Dhuhr");
		expect(formatTitle("dhuhr", "ar")).toBe("الظهر");
		expect(formatTitle("isha", "ar")).toBe("العشاء");
	});

	it("prepends an emoji when given", () => {
		expect(formatTitle("dhuhr", "en", "☀️")).toBe("☀️ Dhuhr");
	});

	it("lets a non-empty override win", () => {
		expect(formatTitle("dhuhr", "en", "☀️", "Lunch prayer")).toBe("Lunch prayer");
	});

	it("falls back to the name when the override is blank", () => {
		expect(formatTitle("dhuhr", "en", "☀️", "  ")).toBe("☀️ Dhuhr");
	});
});
