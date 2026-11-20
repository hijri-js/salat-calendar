import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig, useWizardConfig } from "@/features/wizard/configStore";
import { restoreSettings, safeLocalStorage, SETTINGS_KEY } from "@/features/wizard/savedSettings";

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
	};
}

const dhuhrAsrOnly = {
	...defaultConfig,
	location: { latitude: 21.42, longitude: 39.83, timezone: "Asia/Riyadh", label: "Makkah, Saudi Arabia" },
	prayers: {
		fajr: { enabled: false },
		dhuhr: { enabled: true },
		asr: { enabled: true },
		maghrib: { enabled: false },
		isha: { enabled: false },
	},
	days: [0, 1, 2, 3, 4],
};

describe("restoreSettings", () => {
	it("returns valid settings, keeping the two 'chosen' flags", () => {
		const restored = restoreSettings({ config: dhuhrAsrOnly, titleLocaleChosen: true, methodChosen: true });
		expect(restored?.config.prayers.fajr.enabled).toBe(false);
		expect(restored?.config.location.label).toBe("Makkah, Saudi Arabia");
		expect(restored?.titleLocaleChosen).toBe(true);
		expect(restored?.methodChosen).toBe(true);
	});

	it("treats anything but true as not chosen", () => {
		const restored = restoreSettings({ config: defaultConfig, titleLocaleChosen: "yes" });
		expect(restored?.titleLocaleChosen).toBe(false);
		expect(restored?.methodChosen).toBe(false);
	});

	it("rejects data that breaks the contract or is not an object", () => {
		expect(restoreSettings(null)).toBeNull();
		expect(restoreSettings("config")).toBeNull();
		expect(restoreSettings({})).toBeNull();
		expect(restoreSettings({ config: { ...defaultConfig, method: 999 } })).toBeNull();
		expect(restoreSettings({ config: { ...defaultConfig, defaults: { ...defaultConfig.defaults, offsetMin: 9999 } } })).toBeNull();
		expect(restoreSettings({ config: { ...defaultConfig, location: { latitude: 0, longitude: 0, timezone: "Mars/Olympus" } } })).toBeNull();
	});
});

describe("safeLocalStorage", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("never throws when storage is blocked", () => {
		const boom = () => {
			throw new DOMException("blocked", "SecurityError");
		};
		vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
		expect(safeLocalStorage.getItem("k")).toBeNull();
		expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
		expect(() => safeLocalStorage.removeItem("k")).not.toThrow();
	});

	it("is a no-op where there is no localStorage (the server)", () => {
		vi.stubGlobal("localStorage", undefined);
		expect(safeLocalStorage.getItem("k")).toBeNull();
		expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
	});
});

describe("the wizard store with saved settings", () => {
	let storage: ReturnType<typeof memoryStorage>;

	beforeEach(() => {
		storage = memoryStorage();
		vi.stubGlobal("localStorage", storage);
		useWizardConfig.setState({ config: defaultConfig, titleLocaleChosen: false, methodChosen: false });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("saves a change, and a fresh load brings it back", async () => {
		useWizardConfig.getState().updatePrayer("fajr", { enabled: false });
		const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "{}");
		expect(saved.state.config.prayers.fajr.enabled).toBe(false);
		// Only settings are written: no actions, nothing else.
		expect(Object.keys(saved.state).sort()).toEqual(["config", "methodChosen", "titleLocaleChosen"]);

		// A fresh page: memory back at the defaults (this write is saved too,
		// so put the earlier saved text back), then load.
		const raw = storage.getItem(SETTINGS_KEY) ?? "";
		useWizardConfig.setState({ config: defaultConfig });
		storage.setItem(SETTINGS_KEY, raw);
		await useWizardConfig.persist.rehydrate();
		expect(useWizardConfig.getState().config.prayers.fajr.enabled).toBe(false);
	});

	it("loads saved Dhuhr-and-Asr settings into the store", async () => {
		storage.setItem(SETTINGS_KEY, JSON.stringify({ state: { config: dhuhrAsrOnly, titleLocaleChosen: false, methodChosen: true }, version: 1 }));
		await useWizardConfig.persist.rehydrate();
		const { config, methodChosen } = useWizardConfig.getState();
		expect(config.prayers.isha.enabled).toBe(false);
		expect(config.days).toEqual([0, 1, 2, 3, 4]);
		expect(methodChosen).toBe(true);
		// Actions survive the merge.
		expect(typeof useWizardConfig.getState().reset).toBe("function");
	});

	it("keeps the defaults when the saved data is broken", async () => {
		storage.setItem(SETTINGS_KEY, JSON.stringify({ state: { config: { method: "x" } }, version: 1 }));
		await useWizardConfig.persist.rehydrate();
		expect(useWizardConfig.getState().config).toEqual(defaultConfig);

		storage.setItem(SETTINGS_KEY, "not json");
		await useWizardConfig.persist.rehydrate();
		expect(useWizardConfig.getState().config).toEqual(defaultConfig);
	});

	it("reset saves the defaults too, so a reload stays reset", async () => {
		useWizardConfig.getState().updatePrayer("asr", { enabled: false });
		useWizardConfig.getState().reset();
		await useWizardConfig.persist.rehydrate();
		expect(useWizardConfig.getState().config).toEqual(defaultConfig);
	});
});
