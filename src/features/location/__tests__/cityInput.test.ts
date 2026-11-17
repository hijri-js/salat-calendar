import { describe, expect, it } from "vitest";

import { parseCityInput } from "@/features/location/cityInput";

describe("parseCityInput", () => {
	it("parses a label with trailing coordinates", () => {
		expect(parseCityInput("London, 51.51, -0.13")).toEqual({
			label: "London",
			latitude: 51.51,
			longitude: -0.13,
		});
	});

	it("takes plain text as the label with unset coordinates", () => {
		expect(parseCityInput("Riyadh")).toEqual({
			label: "Riyadh",
			latitude: 0,
			longitude: 0,
		});
	});

	it("trims whitespace around the input", () => {
		expect(parseCityInput("  Cairo  ")).toEqual({
			label: "Cairo",
			latitude: 0,
			longitude: 0,
		});
	});

	it("returns null for empty input", () => {
		expect(parseCityInput("")).toBeNull();
		expect(parseCityInput("   ")).toBeNull();
	});

	it("keeps non-numeric tails in the label", () => {
		expect(parseCityInput("London, UK")).toEqual({
			label: "London, UK",
			latitude: 0,
			longitude: 0,
		});
	});

	it("accepts integer coordinates", () => {
		expect(parseCityInput("Makkah, 21, 39")).toEqual({
			label: "Makkah",
			latitude: 21,
			longitude: 39,
		});
	});
});
