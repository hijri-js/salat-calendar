import type { Prayer, TitleLocale } from "./types";

/** Display names per locale (plan §7: copied-in EN/AR names stay Latin numerals). */
const NAMES: Record<TitleLocale, Record<Prayer, string>> = {
	en: {
		fajr: "Fajr",
		dhuhr: "Dhuhr",
		asr: "Asr",
		maghrib: "Maghrib",
		isha: "Isha",
	},
	ar: {
		fajr: "الفجر",
		dhuhr: "الظهر",
		asr: "العصر",
		maghrib: "المغرب",
		isha: "العشاء",
	},
};

/**
 * Build the event title: custom override wins, else `emoji + name` with the
 * emoji dropped when absent, so titles never have stray whitespace.
 */
export function formatTitle(
	prayer: Prayer,
	locale: TitleLocale,
	emoji?: string,
	titleOverride?: string,
): string {
	if (titleOverride !== undefined && titleOverride.trim() !== "") {
		return titleOverride;
	}
	const name = NAMES[locale][prayer];
	return emoji ? `${emoji} ${name}` : name;
}
