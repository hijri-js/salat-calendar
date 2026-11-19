import { afterEach, describe, expect, it, vi } from "vitest";

import { browserTimezone } from "@/features/location/cityInput";

describe("browserTimezone", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the device timezone", () => {
		expect(browserTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
	});

	it("falls back to UTC when Intl throws", () => {
		vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
			throw new Error("no Intl");
		});
		expect(browserTimezone()).toBe("UTC");
	});
});
