/**
 * City search over the Open-Meteo geocoding API (plan §2: type-ahead
 * allowed, results carry a top-level IANA `timezone` — Step 0 spike 7).
 * Called from the user's browser, debounced, so load spreads across users.
 *
 * The response parser is pure and exported for tests; a recorded fixture of
 * the real API lives in `__tests__/fixtures/`.
 */

/** One city suggestion, already shaped for the wizard config store. */
export interface CityResult {
	latitude: number;
	longitude: number;
	/** IANA timezone of the city, straight from the API's `timezone` field. */
	timezone: string;
	/** Human-readable label composed per locale, e.g. "London, United Kingdom". */
	label: string;
	/** ISO 3166-1 alpha-2 country code, e.g. "GB". */
	countryCode: string;
	/** Localised country name from the API (for the "suggested for …" hint). */
	country: string;
}

/** The union tag of Open-Meteo geocoding error responses we care about. */
interface RawGeocodingError {
	error?: unknown;
	reason?: unknown;
}

interface RawGeocodingResult {
	name?: unknown;
	latitude?: unknown;
	longitude?: unknown;
	timezone?: unknown;
	country_code?: unknown;
	country?: unknown;
	admin1?: unknown;
	admin2?: unknown;
}

/** `https://geocoding-api.open-meteo.com/v1/search` for one query. */
export interface SearchCitiesOptions {
	language: "en" | "ar";
	/** Aborted when the debounced query changes; also honoured in tests. */
	signal?: AbortSignal;
}

/**
 * Compose the display label. English reads "name, admin1, country" (parts
 * skipped when absent or duplicated); Arabic mirrors the API's own naming
 * and drops the same duplicates. Kept deterministic for tests.
 */
export function composeLabel(
	name: string,
	admin1: string | undefined,
	country: string | undefined,
): string {
	const parts: string[] = [];
	if (name !== "") parts.push(name);
	if (admin1 !== undefined && admin1 !== "" && admin1 !== name) parts.push(admin1);
	if (country !== undefined && country !== "" && country !== name && country !== admin1) {
		parts.push(country);
	}
	return parts.join(", ");
}

/**
 * Parse one raw API entry. Returns `null` for entries missing coordinates
 * or a timezone — both are required to plan prayer times.
 */
export function parseCityEntry(raw: RawGeocodingResult): CityResult | null {
	if (
		typeof raw.latitude !== "number" ||
		typeof raw.longitude !== "number" ||
		typeof raw.timezone !== "string" ||
		raw.timezone === ""
	) {
		return null;
	}
	const name = typeof raw.name === "string" ? raw.name : "";
	const admin1 = typeof raw.admin1 === "string" ? raw.admin1 : undefined;
	const country = typeof raw.country === "string" ? raw.country : undefined;
	const countryCode =
		typeof raw.country_code === "string" ? raw.country_code : "";
	return {
		latitude: raw.latitude,
		longitude: raw.longitude,
		timezone: raw.timezone,
		label: composeLabel(name, admin1, country),
		countryCode,
		country: country ?? "",
	};
}

/**
 * Parse the full response body. Returns `[]` for empty results, `null` when
 * the body is not shaped like a geocoding response (caller decides whether
 * that is a network error).
 */
export function parseGeocodingResponse(body: unknown): CityResult[] | null {
	if (body === null || typeof body !== "object") {
		return null;
	}
	const results = (body as { results?: unknown }).results;
	if (results === undefined) {
		// A valid response with no matches simply omits `results`.
		return [];
	}
	if (!Array.isArray(results)) {
		return null;
	}
	return results
		.map((entry) => parseCityEntry((entry ?? {}) as RawGeocodingResult))
		.filter((city): city is CityResult => city !== null);
}

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Search cities by name (plan §2 decision). Throws on non-OK responses. */
export async function searchCities(
	query: string,
	{ language, signal }: SearchCitiesOptions,
): Promise<CityResult[]> {
	const url = new URL(GEOCODING_URL);
	url.searchParams.set("name", query);
	url.searchParams.set("count", "8");
	url.searchParams.set("language", language);
	url.searchParams.set("format", "json");

	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(`Geocoding failed with status ${response.status}`);
	}
	const body: unknown = await response.json();
	const errorReason = (body as RawGeocodingError)?.reason;
	if (
		(body as RawGeocodingError)?.error === true ||
		(typeof errorReason === "string" && errorReason !== "")
	) {
		throw new Error(`Geocoding error: ${String(errorReason)}`);
	}
	const parsed = parseGeocodingResponse(body);
	if (parsed === null) {
		throw new Error("Geocoding response had an unexpected shape");
	}
	return parsed;
}
