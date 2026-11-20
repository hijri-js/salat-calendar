/**
 * Saved wizard settings: the user's rules kept in this browser's
 * localStorage so a reload does not silently bring back the defaults.
 *
 * Only the wizard settings are stored, never a Google token (AGENTS.md).
 * What comes back is untrusted: it is checked against the shared Zod
 * contract, and anything that fails (an old shape, a hand edit) is dropped
 * in favour of the defaults.
 */
import type { StateStorage } from "zustand/middleware";

import { syncConfigSchema } from "@/lib/sync/schema";
import type { SyncConfig } from "@/lib/prayer-engine/types";

export const SETTINGS_KEY = "salat-calendar:settings";
/** Bump when the stored shape changes in a way old data cannot satisfy. */
export const SETTINGS_VERSION = 1;

export interface SavedSettings {
	config: SyncConfig;
	titleLocaleChosen: boolean;
	methodChosen: boolean;
}

/** A validated copy of stored settings, or null when they cannot be trusted. */
export function restoreSettings(stored: unknown): SavedSettings | null {
	if (typeof stored !== "object" || stored === null) {
		return null;
	}
	const { config, titleLocaleChosen, methodChosen } = stored as Record<string, unknown>;
	const parsed = syncConfigSchema.safeParse(config);
	if (!parsed.success) {
		return null;
	}
	return {
		config: parsed.data as SyncConfig,
		titleLocaleChosen: titleLocaleChosen === true,
		methodChosen: methodChosen === true,
	};
}

/**
 * localStorage that never throws: private windows, blocked site data and
 * full quotas make the settings memory-only instead of breaking the wizard.
 */
export const safeLocalStorage: StateStorage = {
	getItem: (name) => {
		try {
			return globalThis.localStorage?.getItem(name) ?? null;
		} catch {
			return null;
		}
	},
	setItem: (name, value) => {
		try {
			globalThis.localStorage?.setItem(name, value);
		} catch {
			// Not saved; the settings still work for this visit.
		}
	},
	removeItem: (name) => {
		try {
			globalThis.localStorage?.removeItem(name);
		} catch {
			// Nothing to do.
		}
	},
};
