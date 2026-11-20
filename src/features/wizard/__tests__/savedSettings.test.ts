import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig, useWizardConfig } from "@/features/wizard/configStore";
import { migrateSettings, restoreSettings, safeLocalStorage, SETTINGS_KEY } from "@/features/wizard/savedSettings";

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
		const restored = restoreSettings({ config: dhuhrAsrOnly, titleLocaleChosen: true, methodChosen: true }, defaultConfig);
		expect(restored?.config.prayers.fajr.enabled).toBe(false);
		expect(restored?.config.location.label).toBe("Makkah, Saudi Arabia");
		expect(restored?.titleLocaleChosen).toBe(true);
		expect(restored?.methodChosen).toBe(true);
	});

	it("treats anything but true as not chosen", () => {
		const restored = restoreSettings({ config: defaultConfig, titleLocaleChosen: "yes" }, defaultConfig);
		expect(restored?.titleLocaleChosen).toBe(false);
		expect(restored?.methodChosen).toBe(false);
	});

	it("restores nothing when there is no saved config", () => {
		expect(restoreSettings(null, defaultConfig)).toBeNull();
		expect(restoreSettings("config", defaultConfig)).toBeNull();
		expect(restoreSettings({}, defaultConfig)).toBeNull();
	});

	it("falls back only on the settings that fail, keeping the rest", () => {
		const restored = restoreSettings(
			{
				config: {
					...dhuhrAsrOnly,
					method: 999,
					defaults: { ...defaultConfig.defaults, offsetMin: 9999 },
					// An empty window (start = end) is shown as a warning in the UI.
					window: { startMin: 480, endMin: 480 },
				},
			},
			defaultConfig,
		);
		expect(restored?.config.method).toBe(defaultConfig.method);
		expect(restored?.config.defaults).toEqual(defaultConfig.defaults);
		expect(restored?.config).not.toHaveProperty("window");
		// Everything else survives.
		expect(restored?.config.prayers.fajr.enabled).toBe(false);
		expect(restored?.config.days).toEqual([0, 1, 2, 3, 4]);
		expect(restored?.config.location.label).toBe("Makkah, Saudi Arabia");
	});

	it("drops a place with a timezone this browser does not know", () => {
		const restored = restoreSettings(
			{ config: { ...dhuhrAsrOnly, location: { latitude: 1, longitude: 2, timezone: "Mars/Olympus" } } },
			defaultConfig,
		);
		expect(restored?.config.location).toEqual(defaultConfig.location);
		expect(restored?.config.prayers.isha.enabled).toBe(false);
	});

	it("trims over-long keywords and labels instead of rejecting them", () => {
		const keywords = [...Array.from({ length: 25 }, (_, i) => `k${i}`), "x".repeat(60), "k1"];
		const restored = restoreSettings(
			{
				config: {
					...dhuhrAsrOnly,
					location: { ...dhuhrAsrOnly.location, label: "L".repeat(200) },
					ooo: { enabled: true, keywords },
				},
			},
			defaultConfig,
		);
		expect(restored?.config.ooo.keywords).toHaveLength(20);
		expect(restored?.config.location.label).toHaveLength(120);
		expect(restored?.config.location.timezone).toBe("Asia/Riyadh");
	});

	it("keeps a valid window and custom titles", () => {
		const restored = restoreSettings(
			{
				config: {
					...dhuhrAsrOnly,
					window: { startMin: 1320, endMin: 360 },
					prayers: { ...dhuhrAsrOnly.prayers, dhuhr: { enabled: true, emoji: "🕌", title: "صلاة الظهر" } },
					jummah: { mode: "none" },
				},
			},
			defaultConfig,
		);
		expect(restored?.config.window).toEqual({ startMin: 1320, endMin: 360 });
		expect(restored?.config.prayers.dhuhr.title).toBe("صلاة الظهر");
		expect(restored?.config.jummah.mode).toBe("none");
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
		storage.setItem(SETTINGS_KEY, JSON.stringify({ state: { config: dhuhrAsrOnly, titleLocaleChosen: false, methodChosen: true }, version: 2 }));
		await useWizardConfig.persist.rehydrate();
		const { config, methodChosen } = useWizardConfig.getState();
		expect(config.prayers.isha.enabled).toBe(false);
		expect(config.days).toEqual([0, 1, 2, 3, 4]);
		expect(methodChosen).toBe(true);
		// Actions survive the merge.
		expect(typeof useWizardConfig.getState().reset).toBe("function");
	});

	it("keeps the defaults when the saved data is broken", async () => {
		storage.setItem(SETTINGS_KEY, JSON.stringify({ state: { config: { method: "x" } }, version: 2 }));
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

describe("migrateSettings (v1 → v2: events at the adhan by default)", () => {
	const v1Defaults = {
		...defaultConfig,
		defaults: { ...defaultConfig.defaults, offsetMin: 15 },
		jummah: { mode: "fixed", fixedTime: "12:30", durationMin: 60 },
	};
	type Stored = { config: typeof defaultConfig; methodChosen?: boolean };

	it("moves the untouched old defaults to the adhan", () => {
		const migrated = migrateSettings({ config: v1Defaults, methodChosen: true }, 1) as Stored;
		expect(migrated.config.defaults.offsetMin).toBe(0);
		expect(migrated.config.jummah.mode).toBe("same");
		expect(migrated.methodChosen).toBe(true);
	});

	it("keeps values the user set", () => {
		const custom = {
			...v1Defaults,
			defaults: { ...v1Defaults.defaults, offsetMin: 10 },
			jummah: { mode: "fixed", fixedTime: "13:15", durationMin: 60 },
		};
		const migrated = migrateSettings({ config: custom }, 1) as Stored;
		expect(migrated.config.defaults.offsetMin).toBe(10);
		expect(migrated.config.jummah).toEqual({ mode: "fixed", fixedTime: "13:15", durationMin: 60 });
	});

	it("leaves current or unreadable data alone", () => {
		const current = { config: v1Defaults };
		expect(migrateSettings(current, 2)).toBe(current);
		expect(migrateSettings(null, 1)).toBeNull();
	});

	it("is applied when the store loads version-1 settings", async () => {
		const data = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k),
		});
		data.set(
			SETTINGS_KEY,
			JSON.stringify({ state: { config: v1Defaults, titleLocaleChosen: false, methodChosen: false }, version: 1 }),
		);
		try {
			await useWizardConfig.persist.rehydrate();
			expect(useWizardConfig.getState().config.defaults.offsetMin).toBe(0);
			expect(useWizardConfig.getState().config.jummah.mode).toBe("same");
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
