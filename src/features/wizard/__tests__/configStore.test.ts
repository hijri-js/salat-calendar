import { beforeEach, describe, expect, it } from "vitest";

import {
	defaultConfig,
	selectEnabledPrayers,
	selectPlaceSet,
	useWizardConfig,
} from "@/features/wizard/configStore";

const store = () => useWizardConfig.getState();

beforeEach(() => {
	useWizardConfig.setState({ config: defaultConfig, titleLocaleChosen: false, methodChosen: false });
});

describe("defaults (plan §2/§6)", () => {
	it("seeds the full SyncConfig with working defaults", () => {
		const { config } = store();

		expect(config.method).toBe(3);
		expect(config.school).toBe("standard");
		expect(config.prayers).toEqual({
			fajr: { enabled: true },
			dhuhr: { enabled: true },
			asr: { enabled: true },
			maghrib: { enabled: true },
			isha: { enabled: true },
		});
		expect(config.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(config.defaults).toEqual({
			offsetMin: 15,
			durationMin: 20,
			transparency: "opaque",
		});
		expect(config.rounding).toEqual({ grid: "off", direction: "nearest" });
		expect(config.window).toBeUndefined();
		expect(config.jummah).toEqual({
			mode: "fixed",
			fixedTime: "12:30",
			durationMin: 60,
		});
		expect(config.ooo).toEqual({
			enabled: true,
			keywords: ["Vacation", "OOO", "Out of Office", "Flight", "إجازة"],
		});
		expect(config.titleLocale).toBe("en");
		expect(config.target).toEqual({ kind: "dedicated" });
		expect(config.replaceExisting).toBe(true);
	});

	it("starts with no place set", () => {
		expect(store().config.location).toEqual({ latitude: 0, longitude: 0 });
		expect(selectPlaceSet(store())).toBe(false);
		expect(selectEnabledPrayers(store())).toEqual([
			"fajr",
			"dhuhr",
			"asr",
			"maghrib",
			"isha",
		]);
	});
});

describe("actions", () => {
	it("merges location updates", () => {
		store().setLocation({
			latitude: 51.5074,
			longitude: -0.1278,
			timezone: "Europe/London",
			label: "London",
		});

		expect(store().config.location).toEqual({
			latitude: 51.5074,
			longitude: -0.1278,
			timezone: "Europe/London",
			label: "London",
		});
	});

	it("updates method and school independently", () => {
		store().setMethod(4);
		store().setSchool("hanafi");

		expect(store().config.method).toBe(4);
		expect(store().config.school).toBe("hanafi");
	});

	it("patches a single prayer without touching the others", () => {
		store().updatePrayer("maghrib", { enabled: false, offsetMin: 10 });

		expect(store().config.prayers.maghrib).toEqual({
			enabled: false,
			offsetMin: 10,
		});
		expect(store().config.prayers.fajr.enabled).toBe(true);
		expect(selectEnabledPrayers(store())).toEqual([
			"fajr",
			"dhuhr",
			"asr",
			"isha",
		]);
	});

	it("replaces the day list and toggles days", () => {
		store().setDays([0, 4]);
		expect(store().config.days).toEqual([0, 4]);

		store().toggleDay(6);
		expect(store().config.days).toEqual([0, 4, 6]);

		store().toggleDay(6);
		expect(store().config.days).toEqual([0, 4]);
	});

	it("keeps days sorted after toggling", () => {
		store().setDays([5]);
		store().toggleDay(1);

		expect(store().config.days).toEqual([1, 5]);
	});

	it("updates global defaults and rounding", () => {
		store().updateDefaults({ offsetMin: 0, transparency: "transparent" });
		store().updateRounding({ grid: 10, direction: "up" });

		expect(store().config.defaults).toEqual({
			offsetMin: 0,
			durationMin: 20,
			transparency: "transparent",
		});
		expect(store().config.rounding).toEqual({ grid: 10, direction: "up" });
	});

	it("sets and removes the time window", () => {
		store().setWindow({ startMin: 8 * 60, endMin: 16 * 60 });
		expect(store().config.window).toEqual({ startMin: 480, endMin: 960 });

		store().setWindow(null);
		expect(store().config.window).toBeUndefined();
		expect("window" in store().config).toBe(false);
	});

	it("patches jummah and ooo settings", () => {
		store().updateJummah({ mode: "none" });
		expect(store().config.jummah).toEqual({
			mode: "none",
			fixedTime: "12:30",
			durationMin: 60,
		});

		store().updateOoo({ keywords: ["OOO"], enabled: false });
		expect(store().config.ooo).toEqual({ enabled: false, keywords: ["OOO"] });
	});

	it("updates title locale, target and replace", () => {
		store().setTitleLocale("ar");
		store().setTarget({ kind: "primary" });
		store().setReplaceExisting(false);

		expect(store().config.titleLocale).toBe("ar");
		expect(store().config.target).toEqual({ kind: "primary" });
		expect(store().config.replaceExisting).toBe(false);
	});

	it("titles follow the UI language until the user picks one (L7)", () => {
		store().adoptUiLocale("ar");
		expect(store().config.titleLocale).toBe("ar");

		const before = store();
		store().adoptUiLocale("ar");
		expect(store()).toBe(before); // no-op keeps the same state object

		store().setTitleLocale("en");
		store().adoptUiLocale("ar");
		expect(store().config.titleLocale).toBe("en");
		expect(store().titleLocaleChosen).toBe(true);
	});

	it("a city's suggested method applies until the user picks one, across re-picks", () => {
		store().suggestMethod(4); // Saudi Arabia → Umm al-Qura
		expect(store().config.method).toBe(4);

		store().setMethod(2); // user chooses ISNA by hand
		store().suggestMethod(5); // a later city pick (e.g. after leaving the step)
		expect(store().config.method).toBe(2);
		expect(store().methodChosen).toBe(true);

		store().reset();
		expect(store().methodChosen).toBe(false);
	});

	it("reset returns to the defaults", () => {
		store().setMethod(4);
		store().setTitleLocale("ar");
		store().reset();

		expect(store().config).toEqual(defaultConfig);
		expect(store().titleLocaleChosen).toBe(false);
	});
});

describe("selectPlaceSet", () => {
	it("needs a label and a timezone", () => {
		store().setLocation({ label: "London" });
		expect(selectPlaceSet(store())).toBe(false);

		store().setLocation({ timezone: "Europe/London" });
		expect(selectPlaceSet(store())).toBe(true);
	});

	it("stays false for empty strings", () => {
		store().setLocation({ label: "", timezone: "Europe/London" });
		expect(selectPlaceSet(store())).toBe(false);
	});
});
