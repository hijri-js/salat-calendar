import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { composeLabel, parseCityEntry, parseGeocodingResponse } from "@/features/location/geocoding";

function fixture(name: string): unknown {
	return JSON.parse(
		readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8"),
	);
}

/** The recorded first result of the real API for "London". */
const FIRST_LONDON = {
	name: "London",
	latitude: 51.50853,
	longitude: -0.12574,
	timezone: "Europe/London",
	country_code: "GB",
	country: "United Kingdom",
	admin1: "England",
};

describe("parseGeocodingResponse (recorded fixtures)", () => {
	it("parses the recorded London fixture into typed results", () => {
		const cities = parseGeocodingResponse(fixture("geocoding-london.json"));
		expect(cities).not.toBeNull();
		expect(cities?.length).toBe(8);

		const london = cities?.[0];
		expect(london).toMatchObject({
			latitude: 51.50853,
			longitude: -0.12574,
			timezone: "Europe/London",
			countryCode: "GB",
			label: "London, England, United Kingdom",
			country: "United Kingdom",
		});
	});

	it("parses the recorded Arabic fixture with the Arabic label", () => {
		const cities = parseGeocodingResponse(fixture("geocoding-arabic.json"));
		expect(cities).not.toBeNull();
		const first = cities?.[0];
		expect(first?.timezone).toBe("Europe/London");
		expect(first?.countryCode).toBe("GB");
		expect(first?.label).toBe("لندن, إنجلترا, المملكة المتحدة");
	});

	it("returns [] when the query matched nothing", () => {
		expect(parseGeocodingResponse({ generationtime_ms: 0.1 })).toEqual([]);
	});

	it("returns null for malformed bodies", () => {
		expect(parseGeocodingResponse(null)).toBeNull();
		expect(parseGeocodingResponse("nope")).toBeNull();
		expect(parseGeocodingResponse({ results: "not-an-array" })).toBeNull();
	});

	it("drops entries without coordinates or timezone", () => {
		const cities = parseGeocodingResponse({
			results: [FIRST_LONDON, { name: "Nowhere" }],
		});
		expect(cities?.length).toBe(1);
		expect(cities?.[0]?.label).toBe("London, England, United Kingdom");
	});
});

describe("parseCityEntry", () => {
	it("returns null when the timezone is missing", () => {
		expect(parseCityEntry({ name: "X", latitude: 1, longitude: 2 })).toBeNull();
	});

	it("returns null when coordinates are missing", () => {
		expect(parseCityEntry({ name: "X", timezone: "UTC" })).toBeNull();
	});

	it("tolerates absent admin1 and country", () => {
		expect(parseCityEntry({ name: "X", latitude: 1, longitude: 2, timezone: "UTC" })).toEqual({
			latitude: 1,
			longitude: 2,
			timezone: "UTC",
			label: "X",
			countryCode: "",
			country: "",
		});
	});
});

describe("composeLabel", () => {
	it("joins name, admin1 and country, skipping duplicates", () => {
		expect(composeLabel("London", "England", "United Kingdom")).toBe(
			"London, England, United Kingdom",
		);
	});

	it("skips a repeated admin1 and empty parts", () => {
		expect(composeLabel("Dubai", "Dubai", "United Arab Emirates")).toBe(
			"Dubai, United Arab Emirates",
		);
		expect(composeLabel("Kuwait City", undefined, undefined)).toBe("Kuwait City");
		expect(composeLabel("", "England", undefined)).toBe("England");
	});
});
