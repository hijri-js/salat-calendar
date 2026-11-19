/**
 * Location helpers used until geocoding (Open-Meteo, with timezone) supplies
 * the place's real timezone.
 */

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
