/**
 * Shell-era city input helpers. Real geocoding (Open-Meteo, with timezone)
 * lands in PR 5; until then the input is free text with an optional
 * "label, latitude, longitude" suffix so the place can be set by hand.
 */

export interface ParsedCityInput {
	label: string;
	latitude: number;
	longitude: number;
}

/** Matches a trailing ", 51.51, -0.13" coordinate pair. */
const COORDS_PATTERN = /^(.+),\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

/**
 * Parses the free-text city input. With trailing coordinates it returns the
 * label plus numbers; plain text is taken as the label with unset (0, 0)
 * coordinates, which geocoding will fill in later.
 */
export function parseCityInput(raw: string): ParsedCityInput | null {
	const text = raw.trim();
	if (text === "") {
		return null;
	}

	const match = COORDS_PATTERN.exec(text);
	if (match) {
		return {
			label: match[1].trim(),
			latitude: Number(match[2]),
			longitude: Number(match[3]),
		};
	}

	return { label: text, latitude: 0, longitude: 0 };
}

/**
 * Best-guess IANA timezone of the device, used until geocoding supplies the
 * place's real timezone. Never throws; falls back to "UTC".
 */
export function browserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}
