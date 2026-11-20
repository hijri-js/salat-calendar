/**
 * Pure helpers for the .ics download (plan §4.10): the date window, the
 * month chunks it is fetched in, the file name, and the finished document.
 * No I/O and no React, so every rule here is unit-tested.
 */
import { planRange } from "@/lib/prayer-engine";
import type { DayTimings, SyncConfig } from "@/lib/prayer-engine/types";

import { buildIcs } from "./ics";

/** Today's "YYYY-MM-DD" in the place's timezone (not the device's). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
	// Read the parts instead of trusting one locale's date layout.
	const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

function toUtcDate(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

function isoOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * The rolling 12 months of plan §2: from today up to the day before the
 * same date next year (365 or 366 days). From Feb 29 the year step
 * overflows to Mar 1, so the window ends on Feb 28.
 */
export function yearRange(today: string): { from: string; to: string } {
	const end = toUtcDate(today);
	end.setUTCFullYear(end.getUTCFullYear() + 1);
	end.setUTCDate(end.getUTCDate() - 1);
	return { from: today, to: isoOf(end) };
}

/**
 * Split an inclusive range into calendar-month pieces. The download fetches
 * one month per request: each matches one cached AlAdhan month on the
 * server and stays far inside the Worker's per-request limits (plan §4.6).
 */
export function monthChunks(from: string, to: string): Array<{ from: string; to: string }> {
	const chunks: Array<{ from: string; to: string }> = [];
	let cursor = toUtcDate(from);
	const last = toUtcDate(to);
	while (cursor <= last) {
		const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
		const end = monthEnd < last ? monthEnd : last;
		chunks.push({ from: isoOf(cursor), to: isoOf(end) });
		cursor = new Date(end);
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return chunks;
}

/** Days in an inclusive chunk, for day-based progress. */
export function chunkDays(chunk: { from: string; to: string }): number {
	return Math.round((toUtcDate(chunk.to).getTime() - toUtcDate(chunk.from).getTime()) / 86_400_000) + 1;
}

/** Share of the work done, 0..1, for the progress bar. */
export function progressFraction(doneDays: number, totalDays: number): number {
	return totalDays > 0 ? Math.min(1, Math.max(0, doneDays / totalDays)) : 0;
}

/**
 * "salat-london-2026.ics" from a label like "London, England, United
 * Kingdom". Only the first comma part is used, reduced to ASCII letters and
 * digits; a label with none (e.g. an Arabic one) gives "salat-calendar-2026.ics".
 */
export function icsFileName(label: string | undefined, from: string): string {
	const year = from.slice(0, 4);
	const city = (label ?? "")
		.split(/[,،]/)[0]!
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return city === "" ? `salat-calendar-${year}.ics` : `salat-${city}-${year}.ics`;
}

/** The file's calendar name, in the language the event titles use. */
export function calendarNameFor(titleLocale: SyncConfig["titleLocale"]): string {
	return titleLocale === "ar" ? "الصلاة" : "Salat";
}

export interface YearIcs {
	text: string;
	eventCount: number;
	/** True when any day came from the local fallback, not AlAdhan. */
	usedLocal: boolean;
}

/**
 * Run the engine over the timings and build the document. No vacation skip:
 * the file cannot read the user's calendar (plan §4.10), so no OOO map.
 */
export function buildYearIcs(
	timings: readonly DayTimings[],
	config: SyncConfig,
	options: { now?: Date; calendarName?: string } = {},
): YearIcs {
	const events = planRange([...timings], config).flatMap((day) => day.events);
	return {
		text: buildIcs(events, options),
		eventCount: events.length,
		usedLocal: timings.some((day) => day.source === "local"),
	};
}
