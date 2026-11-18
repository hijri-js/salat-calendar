/**
 * Pure `.ics` builder (plan §4.10, §10 PR 6).
 *
 * Takes `PlannedEvent`s from the shared engine and returns a complete
 * RFC 5545 `VCALENDAR` string. No I/O, no framework imports — Intl is used
 * only for the IANA timezone offset lookup. DST is the calendar's problem
 * (plan §4.3): times are exported as UTC instants derived from the event's
 * local wall-clock time + IANA timezone.
 *
 * UIDs are fixed per date and prayer (derived from the engine's reconcile
 * id), so importing a newer file updates events instead of doubling them.
 */

import type { PlannedEvent } from "@/lib/prayer-engine/types";

/** Options for `buildIcs`; every field is optional and injectable for tests. */
export interface IcsOptions {
	/** Calendar name written as `X-WR-CALNAME` when provided. */
	calendarName?: string;
	/** Injected "now" for a deterministic DTSTAMP; defaults to `new Date()`. */
	now?: Date;
}

/**
 * Escape a TEXT property value per RFC 5545 §3.3.11: backslash,
 * semicolon, comma, and newlines (which become a literal `\n`).
 */
export function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r\n|\r|\n/g, "\\n");
}

/** UTF-8 octet length of one code point. */
function codePointOctets(codePoint: number): number {
	if (codePoint < 0x80) {
		return 1;
	}
	if (codePoint < 0x800) {
		return 2;
	}
	if (codePoint < 0x10000) {
		return 3;
	}
	return 4;
}

/**
 * Fold a content line at `limit` octets per RFC 5545 §3.1: the first line
 * is at most `limit` octets, continuations start with a single space (so a
 * continuation's content is at most `limit - 1` octets). Folding counts
 * UTF-8 octets, never splitting a multi-byte character.
 */
export function foldLine(line: string, limit = 75): string {
	const segments: string[] = [];
	let current = "";
	let octets = 0;
	for (const ch of line) {
		// `for...of` iterates code points, so surrogate pairs stay intact.
		const bytes = codePointOctets(ch.codePointAt(0) as number);
		const max = segments.length === 0 ? limit : limit - 1;
		if (octets + bytes > max) {
			segments.push(current);
			current = ch;
			octets = bytes;
		} else {
			current += ch;
			octets += bytes;
		}
	}
	segments.push(current);
	return segments.join("\r\n ");
}

/** Cached `DateTimeFormat` per timezone; Intl formatters are expensive.
 * Bounded in practice: the map grows by one entry per distinct zone used. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let f = formatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		formatters.set(timeZone, f);
	}
	return f;
}

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
	const found = parts.find((p) => p.type === type);
	if (!found) {
		throw new Error(`Missing ${type} in formatted parts`);
	}
	return found.value;
}

/**
 * The zone's UTC offset (ms east of UTC) at the given UTC instant,
 * via `Intl.DateTimeFormat` parts: offset = zone-local wall clock − instant.
 */
export function zoneOffset(instant: number, timeZone: string): number {
	const parts = formatterFor(timeZone).formatToParts(new Date(instant));
	const asIfUtc = Date.UTC(
		Number(partOf(parts, "year")),
		Number(partOf(parts, "month")) - 1,
		Number(partOf(parts, "day")),
		Number(partOf(parts, "hour")),
		Number(partOf(parts, "minute")),
		Number(partOf(parts, "second")),
	);
	return asIfUtc - instant;
}

/**
 * Convert a local wall-clock ISO string ("YYYY-MM-DDTHH:MM", the
 * `PlannedEvent` start/end format) in the given IANA timezone to a UTC
 * instant in ms. Correct across DST boundaries: the offset is looked up
 * with Intl and the fixed point is found in two passes.
 *
 * Wall-clock times inside a DST gap (they do not exist) and ambiguous
 * fall-back times resolve to a deterministic but arbitrary instant; for
 * prayer times the gap hour is practically unreachable. Pinned by test.
 */
export function toUtc(localIso: string, timeZone: string): number {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localIso)) {
		throw new Error(`Invalid local ISO: ${localIso}`);
	}
	// Interpret the wall clock as if it were UTC, then subtract the zone
	// offset at that instant; repeat once so the offset is read at (or near)
	// the true instant, which keeps dates on DST-change days correct. Two
	// passes suffice: a third pass would only differ if two zone transitions
	// fell within the same hour, which no modern IANA zone has.
	const pseudoUtc = Date.parse(`${localIso}:00Z`);
	const instant = pseudoUtc - zoneOffset(pseudoUtc, timeZone);
	return pseudoUtc - zoneOffset(instant, timeZone);
}

/** Format a UTC instant as an RFC 5545 UTC date-time ("YYYYMMDDTHHMMSSZ"). */
function formatUtcBasic(instant: number): string {
	return `${new Date(instant).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** The lines of one VEVENT (unfolded; joined with CRLF by `buildIcs`). */
function eventLines(event: PlannedEvent, now: Date): string[] {
	const lines = [
		"BEGIN:VEVENT",
		`UID:${event.id}@salat-calendar`,
		`DTSTAMP:${formatUtcBasic(now.getTime())}`,
		`DTSTART:${formatUtcBasic(toUtc(event.startLocal, event.timezone))}`,
		`DTEND:${formatUtcBasic(toUtc(event.endLocal, event.timezone))}`,
		...foldLine(`SUMMARY:${escapeText(event.title)}`).split("\r\n"),
		`TRANSP:${event.transparency === "transparent" ? "TRANSPARENT" : "OPAQUE"}`,
	];
	if (event.reminderMin !== undefined) {
		lines.push(
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			// RFC 5545 §3.6.6: DESCRIPTION is REQUIRED for ACTION:DISPLAY.
			...foldLine(`DESCRIPTION:${escapeText(event.title)}`).split("\r\n"),
			`TRIGGER:-PT${event.reminderMin}M`,
			"END:VALARM",
		);
	}
	lines.push("END:VEVENT");
	return lines;
}

/**
 * Build a complete `.ics` document: every line (including the last) is
 * terminated with CRLF, long lines are folded, and text values are escaped.
 */
export function buildIcs(events: readonly PlannedEvent[], options: IcsOptions = {}): string {
	const now = options.now ?? new Date();
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//salat-calendar//EN",
		"CALSCALE:GREGORIAN",
	];
	if (options.calendarName !== undefined) {
		lines.push(...foldLine(`X-WR-CALNAME:${escapeText(options.calendarName)}`).split("\r\n"));
	}
	for (const event of events) {
		lines.push(...eventLines(event, now));
	}
	lines.push("END:VCALENDAR");
	return `${lines.join("\r\n")}\r\n`;
}
