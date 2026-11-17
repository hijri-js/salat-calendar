import { describe, expect, it } from "vitest";

import {
	CALCULATION_METHOD_IDS,
	methodName,
	suggestMethod,
} from "@/features/location/methods";

describe("CALCULATION_METHOD_IDS", () => {
	it("holds the 15 AlAdhan methods (no id 6)", () => {
		expect(CALCULATION_METHOD_IDS).toEqual([
			1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
		]);
	});
});

describe("suggestMethod (copied-in table from salat-time)", () => {
	it("maps North America to ISNA", () => {
		expect(suggestMethod("US")).toBe(2);
		expect(suggestMethod("ca")).toBe(2);
	});

	it("maps the Gulf to Umm al-Qura", () => {
		expect(suggestMethod("SA")).toBe(4);
		expect(suggestMethod("AE")).toBe(4);
		expect(suggestMethod("KW")).toBe(4);
		expect(suggestMethod("QA")).toBe(4);
		expect(suggestMethod("BH")).toBe(4);
	});

	it("maps Egypt and Libya to the Egyptian authority", () => {
		expect(suggestMethod("EG")).toBe(5);
		expect(suggestMethod("LY")).toBe(5);
	});

	it("maps South-East Asia to MUIS Singapore", () => {
		expect(suggestMethod("MY")).toBe(11);
		expect(suggestMethod("SG")).toBe(11);
		expect(suggestMethod("ID")).toBe(11);
	});

	it("maps South Asia to Karachi", () => {
		expect(suggestMethod("PK")).toBe(1);
		expect(suggestMethod("IN")).toBe(1);
		expect(suggestMethod("BD")).toBe(1);
	});

	it("maps single-country specialties", () => {
		expect(suggestMethod("TR")).toBe(13);
		expect(suggestMethod("IR")).toBe(7);
		expect(suggestMethod("FR")).toBe(12);
		expect(suggestMethod("RU")).toBe(14);
	});

	it("defaults to Muslim World League", () => {
		expect(suggestMethod("GB")).toBe(3);
		expect(suggestMethod("")).toBe(3);
		expect(suggestMethod("ZZ")).toBe(3);
	});
});

describe("methodName", () => {
	it("exposes the copied-in EN/AR names", () => {
		expect(methodName(2, "en")).toBe("Islamic Society of North America (ISNA)");
		expect(methodName(4, "ar")).toBe("جامعة أم القرى، مكة المكرمة");
		expect(methodName(16, "en")).toBe("Dubai (experimental)");
		expect(methodName(16, "ar")).toBe("دبي (تجريبي)");
	});
});
