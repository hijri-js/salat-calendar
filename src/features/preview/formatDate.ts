/**
 * Locale-aware labels for "YYYY-MM-DD" dates. Numerals stay Latin in
 * Arabic (AGENTS.md), so the locale gets the `-u-nu-latn` extension. The
 * date is read as a UTC calendar day so no device timezone can shift it.
 */
function toUtcDate(date: string): Date {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function latnLocale(locale: string): string {
	return `${locale}-u-nu-latn`;
}

/** "Wed" / "الأربعاء" and "18" for one week-grid column header. */
export function dayLabels(date: string, locale: string): { weekday: string; day: string } {
	const value = toUtcDate(date);
	return {
		weekday: new Intl.DateTimeFormat(latnLocale(locale), {
			weekday: "short",
			timeZone: "UTC",
		}).format(value),
		day: new Intl.DateTimeFormat(latnLocale(locale), {
			day: "numeric",
			timeZone: "UTC",
		}).format(value),
	};
}

/** "18–24 Nov 2026" style range, collapsed the way the locale prefers. */
export function rangeLabel(from: string, to: string, locale: string): string {
	return new Intl.DateTimeFormat(latnLocale(locale), {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).formatRange(toUtcDate(from), toUtcDate(to));
}
