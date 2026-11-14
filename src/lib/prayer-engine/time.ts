/**
 * Pure wall-clock time helpers (plan §4.3, §7).
 *
 * All times are minutes from local midnight plus a calendar date string
 * "YYYY-MM-DD". No timezone math happens here: DST is the calendar's problem
 * (plan §4.3), so every helper is deterministic and framework-free.
 */

import type { TimeWindow, Weekday } from "./types";

/** Parse a wall-clock time like "04:32", "4:32 (BST)" or "04:32:10" to minutes since midnight. */
export function parseTime(raw: string): number {
	const cleaned = raw
		.replace(/\(.*?\)/g, "")
		.trim();
	const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(cleaned);
	if (!match) {
		throw new Error(`Invalid time: ${raw}`);
	}
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) {
		throw new Error(`Invalid time: ${raw}`);
	}
	return hours * 60 + minutes;
}

/** Add an offset in minutes; the result may leave the 0–1439 range. */
export function applyOffset(minutes: number, offsetMin: number): number {
	return minutes + offsetMin;
}

/**
 * How many whole days an out-of-range minute count has moved: -1 (previous
 * day), 0, or 1 for the ±180-minute offsets this app allows.
 */
export function dayShift(minutes: number): number {
	return Math.floor(minutes / 1440);
}

/** Minutes since midnight, normalised into the day (0–1439). */
export function withinDay(minutes: number): number {
	return ((minutes % 1440) + 1440) % 1440;
}

/**
 * Snap to a minute grid. `grid: "off"` returns the input unchanged.
 * Direction: nearest (ties round up), up (ceiling), down (floor).
 */
export function roundToGrid(
	minutes: number,
	grid: "off" | 5 | 10,
	direction: "nearest" | "up" | "down",
): number {
	if (grid === "off") {
		return minutes;
	}
	if (direction === "up") {
		return Math.ceil(minutes / grid) * grid;
	}
	if (direction === "down") {
		return Math.floor(minutes / grid) * grid;
	}
	return Math.round(minutes / grid) * grid;
}

/**
 * Is a start minute inside the booking window? No window means always true.
 * A normal window (start < end) is half-open: `[startMin, endMin)`. An
 * overnight window such as 22:00–06:00 (start > end) wraps midnight:
 * `[startMin, 1440) ∪ [0, endMin)`.
 */
export function isWithinWindow(minutes: number, window?: TimeWindow): boolean {
	if (!window) {
		return true;
	}
	const m = withinDay(minutes);
	if (window.startMin <= window.endMin) {
		return m >= window.startMin && m < window.endMin;
	}
	return m >= window.startMin || m < window.endMin;
}

/** Format minutes (already within the day) as "HH:MM". */
export function formatMinutes(minutes: number): string {
	const m = withinDay(minutes);
	const hh = String(Math.floor(m / 60)).padStart(2, "0");
	const mm = String(m % 60).padStart(2, "0");
	return `${hh}:${mm}`;
}

/** Parse "YYYY-MM-DD" into UTC-anchored parts (no timezone involved). */
function dateParts(date: string): { y: number; m: number; d: number } {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) {
		throw new Error(`Invalid date: ${date}`);
	}
	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	if (m < 1 || m > 12 || d < 1 || d > 31) {
		throw new Error(`Invalid date: ${date}`);
	}
	return { y, m, d };
}

/** Format UTC-anchored parts back to "YYYY-MM-DD". */
function isoDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Add n days to a "YYYY-MM-DD" date. */
export function addDays(date: string, n: number): string {
	const { y, m, d } = dateParts(date);
	return isoDate(Date.UTC(y, m - 1, d + n));
}

/** Day of week of a "YYYY-MM-DD" date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): Weekday {
	const { y, m, d } = dateParts(date);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

/**
 * Build a local wall-clock ISO timestamp "YYYY-MM-DDTHH:MM", moving to the
 * next or previous date when `minutes` leaves the 0–1439 range (plan §4.3:
 * an offset that crosses midnight moves the event date).
 */
export function toLocalIso(date: string, minutes: number): string {
	const shifted = addDays(date, dayShift(minutes));
	return `${shifted}T${formatMinutes(minutes)}`;
}

/** Absolute minute count of a local ISO timestamp, for interval overlap. */
export function localIsoToMinutes(iso: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
	if (!match) {
		throw new Error(`Invalid local ISO timestamp: ${iso}`);
	}
	const y = Number(match[1]);
	const mo = Number(match[2]);
	const d = Number(match[3]);
	const h = Number(match[4]);
	const mi = Number(match[5]);
	const utc = Date.UTC(y, mo - 1, d);
	const check = new Date(utc);
	if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) {
		throw new Error(`Invalid local ISO timestamp: ${iso}`);
	}
	return Date.UTC(y, mo - 1, d) / 60000 + h * 60 + mi;
}
