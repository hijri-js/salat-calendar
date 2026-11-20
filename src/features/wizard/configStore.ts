/**
 * Wizard configuration state (plan §2: in the browser, no database).
 *
 * Saved to this browser's localStorage (`savedSettings.ts`) so a reload keeps
 * the user's rules. Hydration is skipped at creation and run by the wizard
 * after mount, so server and first client render agree (no mismatch).
 *
 * Holds the full `SyncConfig` contract from the prayer engine, seeded with
 * the working defaults from plan §2/§6 so a visitor can pick a city and go
 * straight to "Get it". Actions update one slice each; selectors answer the
 * validity questions the stepper and final buttons need.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
	PRAYERS,
	type AsrSchool,
	type JummahRule,
	type Location,
	type OooRule,
	type Prayer,
	type PrayerRule,
	type Rounding,
	type RuleDefaults,
	type SyncConfig,
	type Target,
	type TimeWindow,
	type TitleLocale,
	type Weekday,
} from "@/lib/prayer-engine/types";

import { restoreSettings, safeLocalStorage, SETTINGS_KEY, SETTINGS_VERSION } from "./savedSettings";

/** Working defaults for every wizard setting (plan §2 and §6 wireframes). */
export const defaultConfig: SyncConfig = {
	location: { latitude: 0, longitude: 0 },
	method: 3, // Muslim World League
	school: "standard",
	prayers: {
		fajr: { enabled: true },
		dhuhr: { enabled: true },
		asr: { enabled: true },
		maghrib: { enabled: true },
		isha: { enabled: true },
	},
	days: [0, 1, 2, 3, 4, 5, 6],
	defaults: {
		offsetMin: 15,
		durationMin: 20,
		transparency: "opaque", // Busy
	},
	rounding: { grid: "off", direction: "nearest" },
	// No window: the key is absent until the user enables one.
	jummah: { mode: "fixed", fixedTime: "12:30", durationMin: 60 },
	ooo: {
		enabled: true,
		keywords: ["Vacation", "OOO", "Out of Office", "Flight", "إجازة"],
	},
	titleLocale: "en",
	target: { kind: "dedicated" },
	replaceExisting: true,
};

export interface WizardState {
	config: SyncConfig;
	/** True once the user picked the title language themselves. */
	titleLocaleChosen: boolean;
	/** True once the user picked a calculation method by hand. */
	methodChosen: boolean;
	setLocation: (location: Partial<Location>) => void;
	/** The user's own pick; from then on a city pick no longer changes it. */
	setMethod: (method: number) => void;
	/** A city's suggested method, applied only if the user has not chosen one. */
	suggestMethod: (method: number) => void;
	setSchool: (school: AsrSchool) => void;
	updatePrayer: (prayer: Prayer, patch: Partial<PrayerRule>) => void;
	setDays: (days: Weekday[]) => void;
	toggleDay: (day: Weekday) => void;
	updateDefaults: (patch: Partial<RuleDefaults>) => void;
	updateRounding: (patch: Partial<Rounding>) => void;
	/** Pass `null` to remove the window entirely. */
	setWindow: (window: TimeWindow | null) => void;
	updateJummah: (patch: Partial<JummahRule>) => void;
	updateOoo: (patch: Partial<OooRule>) => void;
	/** The user's own choice; from then on the UI language no longer overrides it. */
	setTitleLocale: (titleLocale: TitleLocale) => void;
	/** Follow the UI language for titles, unless the user already chose one. */
	adoptUiLocale: (locale: TitleLocale) => void;
	setTarget: (target: Target) => void;
	setReplaceExisting: (replaceExisting: boolean) => void;
	/** Back to the plan defaults. */
	reset: () => void;
}

export const useWizardConfig = create<WizardState>()(
	persist(
		(set) => ({
			config: defaultConfig,
			titleLocaleChosen: false,
			methodChosen: false,
			setLocation: (location) =>
				set(({ config }) => ({
					config: { ...config, location: { ...config.location, ...location } },
				})),
			setMethod: (method) => set(({ config }) => ({ config: { ...config, method }, methodChosen: true })),
			suggestMethod: (method) =>
				set((state) =>
					state.methodChosen || state.config.method === method
						? state
						: { config: { ...state.config, method } },
				),
			setSchool: (school) => set(({ config }) => ({ config: { ...config, school } })),
			updatePrayer: (prayer, patch) =>
				set(({ config }) => ({
					config: {
						...config,
						prayers: {
							...config.prayers,
							[prayer]: { ...config.prayers[prayer], ...patch },
						},
					},
				})),
			setDays: (days) => set(({ config }) => ({ config: { ...config, days } })),
			toggleDay: (day) =>
				set(({ config }) => ({
					config: {
						...config,
						days: config.days.includes(day)
							? config.days.filter((d) => d !== day)
							: [...config.days, day].sort((a, b) => a - b),
					},
				})),
			updateDefaults: (patch) =>
				set(({ config }) => ({
					config: { ...config, defaults: { ...config.defaults, ...patch } },
				})),
			updateRounding: (patch) =>
				set(({ config }) => ({
					config: { ...config, rounding: { ...config.rounding, ...patch } },
				})),
			setWindow: (window) =>
				set(({ config }) => {
					if (window === null) {
						// Drop the key entirely, mirroring the optional contract.
						const rest = { ...config };
						delete rest.window;
						return { config: rest };
					}
					return { config: { ...config, window } };
				}),
			updateJummah: (patch) =>
				set(({ config }) => ({
					config: { ...config, jummah: { ...config.jummah, ...patch } },
				})),
			updateOoo: (patch) =>
				set(({ config }) => ({
					config: { ...config, ooo: { ...config.ooo, ...patch } },
				})),
			setTitleLocale: (titleLocale) =>
				set(({ config }) => ({ config: { ...config, titleLocale }, titleLocaleChosen: true })),
			adoptUiLocale: (locale) =>
				set((state) =>
					state.titleLocaleChosen || state.config.titleLocale === locale
						? state
						: { config: { ...state.config, titleLocale: locale } },
				),
			setTarget: (target) => set(({ config }) => ({ config: { ...config, target } })),
			setReplaceExisting: (replaceExisting) =>
				set(({ config }) => ({ config: { ...config, replaceExisting } })),
			reset: () => set({ config: defaultConfig, titleLocaleChosen: false, methodChosen: false }),
		}),
		{
			name: SETTINGS_KEY,
			version: SETTINGS_VERSION,
			storage: createJSONStorage(() => safeLocalStorage),
			// Settings only; actions are code, and nothing else belongs on disk.
			partialize: ({ config, titleLocaleChosen, methodChosen }) => ({ config, titleLocaleChosen, methodChosen }),
			// Untrusted input: keep the defaults unless it passes the contract.
			merge: (stored, current) => ({ ...current, ...(restoreSettings(stored) ?? {}) }),
			skipHydration: true,
		},
	),
);

/**
 * "Place set?" — the only required input (plan §6). A place is present when
 * it has a label and a timezone; real geocoding (PR 5) fills the rest.
 */
export const selectPlaceSet = (state: WizardState): boolean => {
	const { label, timezone } = state.config.location;
	return Boolean(label && timezone);
};

/** Convenience: every prayer the user has enabled, in engine order. */
export const selectEnabledPrayers = (state: WizardState): Prayer[] =>
	PRAYERS.filter((prayer) => state.config.prayers[prayer].enabled);
