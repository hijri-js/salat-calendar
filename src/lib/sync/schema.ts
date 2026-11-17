/**
 * Zod schemas: the shared contract between client and API routes (AGENTS.md).
 * They mirror the engine types in `src/lib/prayer-engine/types.ts` — change
 * the two together, deliberately. Limits follow plan §4.12: offsets ±180 min,
 * durations 5–180 min.
 */
import { z } from "zod";

export const prayerSchema = z.enum(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
export type PrayerValue = z.infer<typeof prayerSchema>;

const clockDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const [y, m, d] = value.split("-").map(Number);
		if (y < 1900 || y > 2100) {
			return false;
		}
		const check = new Date(Date.UTC(y, m - 1, d));
		return check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
	}, "Must be a valid YYYY-MM-DD date between 1900 and 2100");

const timezoneName = z.string().min(1).max(60).refine((value) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}, "Must be an IANA timezone name");

export const transparencySchema = z.enum(["opaque", "transparent"]);

export const prayerRuleSchema = z.object({
	enabled: z.boolean(),
	offsetMin: z.number().int().min(-180).max(180).optional(),
	durationMin: z.number().int().min(5).max(180).optional(),
	transparency: transparencySchema.optional(),
	emoji: z.string().max(16).optional(),
	title: z.string().max(60).optional(),
});

export const ruleDefaultsSchema = z.object({
	offsetMin: z.number().int().min(-180).max(180),
	durationMin: z.number().int().min(5).max(180),
	transparency: transparencySchema,
	reminderMin: z.number().int().min(0).max(120).optional(),
	colorId: z.string().max(10).optional(),
});

export const roundingSchema = z.object({
	grid: z.union([z.literal("off"), z.literal(5), z.literal(10)]),
	direction: z.enum(["nearest", "up", "down"]),
});

export const timeWindowSchema = z
	.object({
		startMin: z.number().int().min(0).max(1439),
		endMin: z.number().int().min(0).max(1439),
	});

const clockTime = z.string().regex(/^\d{2}:\d{2}$/).refine((value) => {
	const [h, m] = value.split(":").map(Number);
	return h <= 23 && m <= 59;
}, "Must be a valid HH:MM clock time");

export const jummahRuleSchema = z.object({
	mode: z.enum(["same", "fixed", "custom", "none"]),
	fixedTime: clockTime.optional(),
	offsetMin: z.number().int().min(-180).max(180).optional(),
	durationMin: z.number().int().min(5).max(180).optional(),
});

export const oooRuleSchema = z.object({
	enabled: z.boolean(),
	keywords: z.array(z.string().max(40)).max(20),
});

export const targetSchema = z.object({
	kind: z.enum(["dedicated", "primary"]),
});

export const syncConfigSchema = z.object({
	location: z.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
		// Present once a place is chosen (engine types gained these in PR 5a).
		timezone: z.string().optional(),
		label: z.string().optional(),
	}),
	method: z.number().int().min(1).max(30),
	school: z.enum(["standard", "hanafi"]),
	prayers: z.record(prayerSchema, prayerRuleSchema),
	days: z.array(z.number().int().min(0).max(6)).max(7),
	defaults: ruleDefaultsSchema,
	rounding: roundingSchema,
	window: timeWindowSchema.optional(),
	jummah: jummahRuleSchema,
	ooo: oooRuleSchema,
	titleLocale: z.enum(["en", "ar"]),
	target: targetSchema,
	replaceExisting: z.boolean(),
});

export type SyncConfigValue = z.infer<typeof syncConfigSchema>;

/** `POST /api/prayers/preview` request (plan §4.10: timings for a range). */
export const previewRequestSchema = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	/** IANA timezone for the place, from the Open-Meteo city search. */
	timezone: timezoneName,
	method: z.number().int().min(1).max(30),
	school: z.enum(["standard", "hanafi"]),
	/** Inclusive local calendar dates, "YYYY-MM-DD". */
	from: clockDate,
	to: clockDate,
});

export type PreviewRequestValue = z.infer<typeof previewRequestSchema>;

/** `POST /api/prayers/preview` response body. */
export const previewResponseSchema = z.object({
	days: z.array(
		z.object({
			date: clockDate,
			timezone: z.string().min(1).max(60),
			times: z.record(prayerSchema, z.string()),
			source: z.enum(["aladhan", "local"]),
		}),
	),
});
