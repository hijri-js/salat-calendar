import { describe, expect, it } from "vitest";

import type { PlannedEvent } from "@/lib/prayer-engine/types";

import { buildIcs, escapeText, foldLine, toUtc } from "../ics";

/** Octet (UTF-8 byte) length of a string, for fold assertions. */
function octets(line: string): number {
	let n = 0;
	for (const ch of line) {
		const cp = ch.codePointAt(0) as number;
		n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
	}
	return n;
}

/** LONDON event in BST (UTC+1) and a version after the DST change (UTC+0). */
function londonEvent(overrides: Partial<PlannedEvent> = {}): PlannedEvent {
	return {
		id: "sc20260615p5",
		prayer: "isha",
		startLocal: "2026-06-15T21:30",
		endLocal: "2026-06-15T22:15",
		timezone: "Europe/London",
		title: "Isha",
		transparency: "opaque",
		...overrides,
	};
}

describe("escapeText", () => {
	it("escapes backslash, semicolon, comma and newlines", () => {
		expect(escapeText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
		expect(escapeText("one\ntwo")).toBe("one\\ntwo");
		expect(escapeText("one\r\ntwo")).toBe("one\\ntwo");
		expect(escapeText("one\rtwo")).toBe("one\\ntwo");
	});

	it("leaves plain text untouched", () => {
		expect(escapeText("Isha — Salat")).toBe("Isha — Salat");
	});
});

describe("foldLine", () => {
	it("leaves short lines unfolded", () => {
		expect(foldLine("short")).toBe("short");
	});

	it("folds at 75 octets with single-space continuations", () => {
		const line = "x".repeat(180);
		const folded = foldLine(line);
		const parts = folded.split("\r\n ");
		expect(parts[0].length).toBe(75);
		for (const part of parts.slice(1, -1)) {
			expect(part.length).toBe(74);
		}
		expect(parts[parts.length - 1].length).toBeLessThanOrEqual(74);
		expect(folded.split("\r\n ").join("")).toBe(line);
	});

	it("never splits a multi-byte character (2-byte Arabic at the boundary)", () => {
		// 73 "a" (73 octets) + a 3-byte dash would exceed 75, so the dash must
		// start the continuation line rather than being split.
		const line = "a".repeat(73) + "—" + "b".repeat(10);
		const folded = foldLine(line);
		expect(folded.startsWith(`${"a".repeat(73)}\r\n —`)).toBe(true);
		expect(folded.split("\r\n ").join("")).toBe(line);
	});

	it("never splits a 4-byte character that would fit exactly", () => {
		const line = "a".repeat(71) + "🎉" + "b".repeat(10);
		const folded = foldLine(line);
		expect(folded.startsWith(`${"a".repeat(71)}🎉\r\n `)).toBe(true);
		expect(folded.split("\r\n ").join("")).toBe(line);
	});

	it("folds a long Arabic title at 75 octets without splitting characters", () => {
		const arabic = "الصلاة على النبي صلاة الإشاء في المُصلى حتى يكتمل الركن الأخير للصلاة";
		const summary = `SUMMARY:${arabic}`;
		const folded = foldLine(summary);
		const lines = folded.split("\r\n");
		expect(lines.length).toBeGreaterThan(1);
		for (const [i, line] of lines.entries()) {
			if (i === 0) {
				expect(octets(line)).toBeLessThanOrEqual(75);
			} else {
				expect(line.startsWith(" ")).toBe(true);
				expect(octets(line)).toBeLessThanOrEqual(75);
			}
		}
		// Unfolding restores the escaped original exactly.
		expect(folded.split("\r\n ").join("")).toBe(summary);
	});
});

describe("toUtc", () => {
	it("converts London BST (UTC+1) and GMT (UTC+0) correctly", () => {
		// 2026-06-15 is BST: 21:30 local → 20:30Z.
		expect(toUtc("2026-06-15T21:30", "Europe/London")).toBe(
			Date.parse("2026-06-15T20:30:00Z"),
		);
		// 2026-11-15 is GMT: 16:30 local → 16:30Z.
		expect(toUtc("2026-11-15T16:30", "Europe/London")).toBe(
			Date.parse("2026-11-15T16:30:00Z"),
		);
	});

	it("converts New York EDT (UTC−4) and EST (UTC−5) correctly", () => {
		// 2026-06-15 is EDT: 21:30 local → 01:30Z on the next day.
		expect(toUtc("2026-06-15T21:30", "America/New_York")).toBe(
			Date.parse("2026-06-16T01:30:00Z"),
		);
		// 2026-11-15 is EST: 16:30 local → 21:30Z the same day.
		expect(toUtc("2026-11-15T16:30", "America/New_York")).toBe(
			Date.parse("2026-11-15T21:30:00Z"),
		);
	});

	it("lands midnight-crossing dates on the right UTC day", () => {
		// Maghrib 23:45 BST ends 00:30 BST next day — both are Jun 15 UTC.
		expect(toUtc("2026-06-15T23:45", "Europe/London")).toBe(
			Date.parse("2026-06-15T22:45:00Z"),
		);
		expect(toUtc("2026-06-16T00:30", "Europe/London")).toBe(
			Date.parse("2026-06-15T23:30:00Z"),
		);
	});

	it("throws on malformed local ISO or an unknown timezone", () => {
		expect(() => toUtc("2026-06-15 21:30", "Europe/London")).toThrow("Invalid local ISO");
		expect(() => toUtc("2026-06-15T21:30", "Not/AZone")).toThrow();
	});
});

describe("buildIcs", () => {
	const now = new Date("2026-01-01T00:00:00Z");

	it("maps transparency: opaque → OPAQUE, transparent → TRANSPARENT", () => {
		const opaque = buildIcs([londonEvent()], { now });
		expect(opaque).toContain("TRANSP:OPAQUE\r\n");
		const transparent = buildIcs([londonEvent({ transparency: "transparent" })], { now });
		expect(transparent).toContain("TRANSP:TRANSPARENT\r\n");
	});

	it("derives a fixed UID from the event id, stable across runs", () => {
		const uid = `UID:${londonEvent().id}@salat-calendar\r\n`;
		expect(buildIcs([londonEvent()], { now })).toContain(uid);
		// Different "now", same UID — re-importing updates instead of doubling.
		const later = new Date("2027-01-01T00:00:00Z");
		expect(buildIcs([londonEvent()], { now: later })).toContain(uid);
	});

	it("includes a VALARM only when reminderMin is present", () => {
		const withReminder = buildIcs([londonEvent({ reminderMin: 15 })], { now });
		expect(withReminder).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\n");
		const withZeroReminder = buildIcs([londonEvent({ reminderMin: 0 })], { now });
		expect(withZeroReminder).toContain("TRIGGER:-PT0M\r\n");
		const without = buildIcs([londonEvent()], { now });
		expect(without).not.toContain("VALARM");
	});

	it("uses the injected now for a deterministic DTSTAMP", () => {
		expect(buildIcs([londonEvent()], { now })).toContain("DTSTAMP:20260101T000000Z\r\n");
		expect(buildIcs([londonEvent()], { now: new Date("2026-12-31T23:59:59Z") })).toContain(
			"DTSTAMP:20261231T235959Z\r\n",
		);
	});

	it("writes X-WR-CALNAME only when a calendarName is given", () => {
		expect(buildIcs([londonEvent()], { now, calendarName: "Salat" })).toContain(
			"X-WR-CALNAME:Salat\r\n",
		);
		expect(buildIcs([londonEvent()], { now })).not.toContain("X-WR-CALNAME");
	});

	it("escapes and folds the SUMMARY", () => {
		const escaped = buildIcs([londonEvent({ title: "Asr; jama'a, on\\time" })], { now });
		expect(escaped).toContain("SUMMARY:Asr\\; jama'a\\, on\\\\time\r\n");
	});

	it("produces an exact document for a small input", () => {
		const out = buildIcs([londonEvent({ reminderMin: 15, title: "Isha — Salat" })], {
			now,
			calendarName: "Salat",
		});
		const doc = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//salat-calendar//EN",
			"CALSCALE:GREGORIAN",
			"X-WR-CALNAME:Salat",
			"BEGIN:VEVENT",
			"UID:sc20260615p5@salat-calendar",
			"DTSTAMP:20260101T000000Z",
			"DTSTART:20260615T203000Z",
			"DTEND:20260615T211500Z",
			"SUMMARY:Isha — Salat",
			"TRANSP:OPAQUE",
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			"TRIGGER:-PT15M",
			"END:VALARM",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		expect(out).toBe(`${doc}\r\n`);
	});
});
