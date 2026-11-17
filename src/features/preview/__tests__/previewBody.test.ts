import { describe, expect, it } from "vitest";

import { defaultConfig } from "@/features/wizard";
import { buildPreviewBody } from "@/features/preview/previewBody";

describe("buildPreviewBody", () => {
	it("builds a schema-valid body from a complete config", () => {
		const body = buildPreviewBody(
			{
				...defaultConfig,
				location: {
					latitude: 51.5085,
					longitude: -0.1257,
					timezone: "Europe/London",
					label: "London",
				},
				method: 2,
				school: "hanafi",
			},
			"2026-11-16",
			"2026-11-22",
		);
		expect(body).toEqual({
			latitude: 51.5085,
			longitude: -0.1257,
			timezone: "Europe/London",
			method: 2,
			school: "hanafi",
			from: "2026-11-16",
			to: "2026-11-22",
		});
	});

	it("returns null while no city is chosen (missing timezone)", () => {
		expect(buildPreviewBody(defaultConfig, "2026-11-16", "2026-11-22")).toBeNull();
	});

	it("returns null for an invalid date range", () => {
		const config = {
			...defaultConfig,
			location: {
				latitude: 51.5085,
				longitude: -0.1257,
				timezone: "Europe/London",
				label: "London",
			},
		};
		expect(buildPreviewBody(config, "2026-13-01", "2026-11-22")).toBeNull();
		expect(buildPreviewBody(config, "not-a-date", "2026-11-22")).toBeNull();
	});

	it("rejects coordinates outside the schema bounds", () => {
		const config = {
			...defaultConfig,
			location: {
				latitude: 120,
				longitude: -0.1257,
				timezone: "Europe/London",
				label: "London",
			},
		};
		expect(buildPreviewBody(config, "2026-11-16", "2026-11-22")).toBeNull();
	});
});
