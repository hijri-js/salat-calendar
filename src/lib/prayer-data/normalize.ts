/**
 * AlAdhan response → engine `DayTimings` normaliser.
 *
 * Pure: validation and transformation only. Facts from the Step 0 recon:
 * times look like "05:04 (BST)" — strip the suffix, never whitelist it;
 * `meta.timezone` is the IANA zone; `meta.method.id`/`meta.school` echo what
 * AlAdhan *actually* used, and must match the request (an invalid method id
 * silently computes with a different method).
 */

import { z } from "zod";

import { PRAYERS, type AsrSchool, type DayTimings, type Prayer } from "@/lib/prayer-engine/types";
import { ApiError } from "./aladhan";

const metaSchema = z.object({
	timezone: z.string().min(1),
	method: z.object({ id: z.number() }),
	school: z.string(),
});

const daySchema = z.object({
	timings: z.object({
		Fajr: z.string(),
		Dhuhr: z.string(),
		Asr: z.string(),
		Maghrib: z.string(),
		Isha: z.string(),
	}),
	date: z.object({
		gregorian: z.object({
			date: z.string().regex(/^\d{2}-\d{2}-\d{4}$/),
		}),
	}),
	meta: metaSchema,
});

const bodySchema = z.object({
	code: z.number(),
	data: z.array(daySchema),
});

/** The five timings we keep, keyed by AlAdhan's field names. */
const FIELD_BY_PRAYER: Record<Prayer, "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"> = {
	fajr: "Fajr",
	dhuhr: "Dhuhr",
	asr: "Asr",
	maghrib: "Maghrib",
	isha: "Isha",
};

/** "01-11-2026" → "2026-11-01" (plan §7: dates are local wall-clock). */
function gregorianToIsoDate(ddmmyyyy: string): string {
	const [d, m, y] = ddmmyyyy.split("-");
	return `${y}-${m}-${d}`;
}

/** "05:04 (BST)" → "05:04"; anchored, range-validated, suffix-agnostic. */
function stripSuffix(raw: string): string {
	const match = /^(\d{1,2}):(\d{2})(?:\s*\(|$)/.exec(raw);
	if (!match) {
		throw new ApiError("UNEXPECTED", `Unparseable AlAdhan time: ${raw}`);
	}
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) {
		throw new ApiError("UNEXPECTED", `Out-of-range AlAdhan time: ${raw}`);
	}
	return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function echoSchool(school: string): AsrSchool {
	if (school === "STANDARD") {
		return "standard";
	}
	if (school === "HANAFI") {
		return "hanafi";
	}
	throw new ApiError("UNEXPECTED", `Unknown AlAdhan school: ${school}`);
}

/**
 * Normalise one month of raw AlAdhan calendar data into engine `DayTimings`.
 * Throws `ApiError` (usually "UNEXPECTED") when the shape or the echoed
 * method/school do not match the request.
 */
export function normalizeMonth(
	raw: unknown,
	expected: { method: number; school: AsrSchool },
): DayTimings[] {
	const firstPass = z.object({ code: z.number(), data: z.unknown() }).safeParse(raw);
	if (!firstPass.success) {
		throw new ApiError("UNEXPECTED", "AlAdhan response shape unexpected");
	}
	if (firstPass.data.code !== 200) {
		// AlAdhan error bodies carry `data` as a string (Step 0 recon).
		throw new ApiError("SERVER", `AlAdhan answered code ${firstPass.data.code}`);
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) {
		throw new ApiError("UNEXPECTED", "AlAdhan response shape unexpected");
	}
	const body = parsed.data;
	if (body.data.length === 0) {
		throw new ApiError("UNEXPECTED", "AlAdhan returned no days");
	}

	const meta = body.data[0]?.meta;
	if (!meta || meta.method.id !== expected.method) {
		throw new ApiError("UNEXPECTED", "AlAdhan meta echoes a different method");
	}
	if (echoSchool(meta.school) !== expected.school) {
		throw new ApiError("UNEXPECTED", "AlAdhan meta echoes a different school");
	}

	return body.data.map((day) => {
		const times = {} as Record<Prayer, string>;
		for (const prayer of PRAYERS) {
			times[prayer] = stripSuffix(day.timings[FIELD_BY_PRAYER[prayer]]);
		}
		return {
			date: gregorianToIsoDate(day.date.gregorian.date),
			timezone: meta.timezone,
			times,
			source: "aladhan",
		} satisfies DayTimings;
	});
}
