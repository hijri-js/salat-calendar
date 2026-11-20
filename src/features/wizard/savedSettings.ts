/**
 * Saved wizard settings: the user's rules kept in this browser's
 * localStorage so a reload does not silently bring back the defaults.
 *
 * Only the wizard settings are stored, never a Google token (AGENTS.md).
 * What comes back is untrusted: it is checked against the shared Zod
 * contract. A part that fails (an old shape, a hand edit, an empty window)
 * falls back to its default on its own, so one bad field never wipes out
 * every other setting.
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

/** Limits shared with the UI so it cannot produce settings the contract rejects. */
export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 40;
export const MAX_LABEL_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bring over-long keyword lists and labels inside the limits before checking. */
function tidy(config: Record<string, unknown>): Record<string, unknown> {
	const next = { ...config };
	if (isRecord(next.location) && typeof next.location.label === "string") {
		next.location = { ...next.location, label: next.location.label.slice(0, MAX_LABEL_LENGTH) };
	}
	if (isRecord(next.ooo) && Array.isArray(next.ooo.keywords)) {
		const keywords = next.ooo.keywords
			.filter((k): k is string => typeof k === "string")
			.map((k) => k.slice(0, MAX_KEYWORD_LENGTH));
		next.ooo = { ...next.ooo, keywords: [...new Set(keywords)].slice(0, MAX_KEYWORDS) };
	}
	return next;
}

/**
 * A validated copy of stored settings, or null when there is nothing to
 * restore. Each top-level setting is checked on its own; one that fails
 * takes its value from `defaults` (an optional one, like the window, is
 * dropped).
 */
export function restoreSettings(stored: unknown, defaults: SyncConfig): SavedSettings | null {
	if (!isRecord(stored) || !isRecord(stored.config)) {
		return null;
	}
	const { titleLocaleChosen, methodChosen } = stored;
	const config = tidy(stored.config);
	const salvaged: Record<string, unknown> = {};
	for (const [key, schema] of Object.entries(syncConfigSchema.shape)) {
		const result = schema.safeParse(config[key]);
		if (result.success) {
			if (result.data !== undefined) {
				salvaged[key] = result.data;
			}
		} else if (key in defaults) {
			salvaged[key] = defaults[key as keyof SyncConfig];
		}
	}
	const parsed = syncConfigSchema.safeParse(salvaged);
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
