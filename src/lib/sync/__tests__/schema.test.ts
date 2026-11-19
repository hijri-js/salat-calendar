import { describe, expect, it } from "vitest";

import { jummahRuleSchema, syncConfigSchema, timeWindowSchema } from "@/lib/sync/schema";
import { defaultConfig } from "@/features/wizard/configStore";

describe("syncConfigSchema", () => {
	it("accepts the wizard's default config", () => {
		const config = { ...defaultConfig, location: { latitude: 21.42, longitude: 39.83, timezone: "Asia/Riyadh", label: "Makkah" } };
		expect(syncConfigSchema.safeParse(config).success).toBe(true);
	});

	it("rejects a timezone that is not an IANA name", () => {
		const config = { ...defaultConfig, location: { latitude: 0, longitude: 0, timezone: "Mars/Olympus" } };
		expect(syncConfigSchema.safeParse(config).success).toBe(false);
	});

	it("caps the place label length", () => {
		const config = { ...defaultConfig, location: { latitude: 0, longitude: 0, label: "x".repeat(121) } };
		expect(syncConfigSchema.safeParse(config).success).toBe(false);
	});

	it("rejects repeated or out-of-range weekdays", () => {
		expect(syncConfigSchema.safeParse({ ...defaultConfig, days: [1, 1] }).success).toBe(false);
		expect(syncConfigSchema.safeParse({ ...defaultConfig, days: [7] }).success).toBe(false);
	});
});

describe("jummahRuleSchema", () => {
	it("requires a time when the mode is fixed", () => {
		expect(jummahRuleSchema.safeParse({ mode: "fixed" }).success).toBe(false);
		expect(jummahRuleSchema.safeParse({ mode: "fixed", fixedTime: "12:30" }).success).toBe(true);
	});

	it("does not need a time for the other modes", () => {
		for (const mode of ["same", "custom", "none"] as const) {
			expect(jummahRuleSchema.safeParse({ mode }).success).toBe(true);
		}
	});
});

describe("timeWindowSchema", () => {
	it("rejects an empty window (start equals end)", () => {
		expect(timeWindowSchema.safeParse({ startMin: 480, endMin: 480 }).success).toBe(false);
	});

	it("accepts normal and overnight windows", () => {
		expect(timeWindowSchema.safeParse({ startMin: 480, endMin: 960 }).success).toBe(true);
		expect(timeWindowSchema.safeParse({ startMin: 1320, endMin: 360 }).success).toBe(true);
	});
});
