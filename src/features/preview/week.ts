/**
 * Pure week maths and the year estimate for the preview step (plan §6
 * step 5). No I/O, no framework imports.
 */
import { addDays, weekdayOf } from "@/lib/prayer-engine";

/** "YYYY-MM-DD" of today, in the device's own timezone (client only). */
export function todayIso(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Monday-based week start of a "YYYY-MM-DD" date. */
export function weekStartOf(date: string): string {
	const weekday = weekdayOf(date); // 0 = Sunday … 6 = Saturday
	const backToMonday = (weekday + 6) % 7;
	return addDays(date, -backToMonday);
}

/** Move a week start by `n` whole weeks (Monday stays Monday). */
export function addWeeks(date: string, weeks: number): string {
	return addDays(date, weeks * 7);
}

/** The seven "YYYY-MM-DD" dates of the week starting on `monday`. */
export function weekDates(monday: string): string[] {
	return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * Rough year total from the previewed week (plan §6: "about M for the
 * year"): `Math.round(weekCount * 365 / 7)`.
 */
export function estimateYearEvents(weekCount: number): number {
	return Math.round((weekCount * 365) / 7);
}
