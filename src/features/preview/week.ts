/**
 * Pure week maths and the year estimate for the preview step (plan §6
 * step 5). No I/O, no framework imports.
 */
import { addDays } from "@/lib/prayer-engine";

/** "YYYY-MM-DD" of today, in the device's own timezone (client only). */
export function todayIso(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Move a week start by `n` whole weeks (the weekday stays the same). */
export function addWeeks(date: string, weeks: number): string {
	return addDays(date, weeks * 7);
}

/** The seven "YYYY-MM-DD" dates starting on `start` (the preview starts today). */
export function weekDates(start: string): string[] {
	return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/**
 * Rough year total from the previewed week (plan §6: "about M for the
 * year"): `Math.round(weekCount * 365 / 7)`.
 */
export function estimateYearEvents(weekCount: number): number {
	return Math.round((weekCount * 365) / 7);
}
