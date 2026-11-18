/**
 * Preview orchestration (plan §4.10): serve cached AlAdhan timings for a date
 * range, falling back to the local `adhan` computation per month when the API
 * fails — fallback results are never cached (plan §4.9).
 *
 * The browser runs the engine over these timings; the server never plans
 * events here (the server never trusts client rules for the preview — the
 * client computes its own preview with the same engine).
 */

import type { DayTimings } from "@/lib/prayer-engine/types";
import { ApiError, fetchMonthRaw } from "./aladhan";
import { cacheKey, TIMINGS_TTL_SECONDS, type TimingsCache } from "./cache";
import { computeLocalMonthTimings } from "./localFallback";
import { normalizeMonth } from "./normalize";

/** The .ics download needs a rolling year ≈ 13 partial calendar months. */
export const PREVIEW_MAX_DAYS = 400;

export interface PreviewRequest {
	latitude: number;
	longitude: number;
	timezone: string;
	method: number;
	school: "standard" | "hanafi";
	from: string;
	to: string;
}

export interface PreviewDeps {
	cache: TimingsCache;
	fetchMonth?: typeof fetchMonthRaw;
	normalize?: typeof normalizeMonth;
	computeLocal?: typeof computeLocalMonthTimings;
	/** Clock for the rate-limit pause; injectable for tests. */
	now?: () => number;
}

/** After AlAdhan answers 429, skip it for this long and compute locally. */
export const RATE_LIMIT_PAUSE_MS = 60_000;

// Per-isolate circuit breaker: one 429 pauses every request on this isolate,
// so a burst of traffic cannot keep hammering AlAdhan (plan §5: ~12 req/s).
let aladhanPausedUntil = 0;

/** Test helper: clear the rate-limit pause between tests. */
export function resetRateLimitPauseForTest(): void {
	aladhanPausedUntil = 0;
}

/** Round to 2 decimals (~1 km) so upstream calls match the cache key. */
function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

/** Days between two inclusive "YYYY-MM-DD" dates. */
export function daysBetweenInclusive(from: string, to: string): number {
	const start = Date.parse(`${from}T00:00:00Z`);
	const end = Date.parse(`${to}T00:00:00Z`);
	if (Number.isNaN(start) || Number.isNaN(end)) {
		return Number.NaN;
	}
	return Math.round((end - start) / 86_400_000) + 1;
}

/** Every calendar month the range [from, to] touches, in order. */
export function listMonths(from: string, to: string): { year: number; month: number }[] {
	const months: { year: number; month: number }[] = [];
	let [year, month] = from.slice(0, 7).split("-").map(Number);
	const lastYear = Number(to.slice(0, 4));
	const lastMonth = Number(to.slice(5, 7));
	while (year < lastYear || (year === lastYear && month <= lastMonth)) {
		months.push({ year, month });
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return months;
}

/**
 * Timings for the inclusive range. One AlAdhan call (or cache hit) per touched
 * month; a month whose fetch or normalisation fails is computed locally and
 * marked `source: "local"`, never cached.
 */
export async function getTimingsForRange(
	request: PreviewRequest,
	deps: PreviewDeps,
): Promise<DayTimings[]> {
	const span = daysBetweenInclusive(request.from, request.to);
	if (Number.isNaN(span) || span < 1 || span > PREVIEW_MAX_DAYS) {
		throw new RangeError(`Preview range must be 1–${PREVIEW_MAX_DAYS} days`);
	}

	const now = deps.now ?? Date.now;
	const latitude = round2(request.latitude);
	const longitude = round2(request.longitude);
	const days: DayTimings[] = [];
	for (const { year, month } of listMonths(request.from, request.to)) {
		const key = cacheKey({ ...request, year, month });
		// A cache-read failure degrades to a miss; AlAdhan stays healthy.
		let cached: DayTimings[] | undefined;
		try {
			cached = await deps.cache.get(key);
		} catch {
			cached = undefined;
		}
		if (cached) {
			days.push(...cached);
			continue;
		}
		try {
			if (now() < aladhanPausedUntil) {
				throw new ApiError("RATE_LIMIT", "AlAdhan paused after a recent 429", 429);
			}
			const raw = await (deps.fetchMonth ?? fetchMonthRaw)({
				latitude,
				longitude,
				method: request.method,
				school: request.school,
				year,
				month,
				// Bound the upstream call so a hung connection cannot stall the route.
				signal: AbortSignal.timeout(10_000),
			});
			const timings = (deps.normalize ?? normalizeMonth)(raw, { method: request.method, school: request.school });
			try {
				await deps.cache.set(key, timings, TIMINGS_TTL_SECONDS);
			} catch {
				// A cache-write failure must not discard good AlAdhan data.
			}
			days.push(...timings);
		} catch (error) {
			// Network, rate limit, server or shape errors all fall back locally;
			// fallback results are never cached (plan §4.9).
			if (error instanceof ApiError && error.code === "RATE_LIMIT" && now() >= aladhanPausedUntil) {
				aladhanPausedUntil = now() + RATE_LIMIT_PAUSE_MS;
			}
			const local = await (deps.computeLocal ?? computeLocalMonthTimings)({
				latitude,
				longitude,
				method: request.method,
				school: request.school,
				year,
				month,
				timezone: request.timezone,
			});
			days.push(...local);
		}
	}

	return days.filter((day) => day.date >= request.from && day.date <= request.to);
}

/** Re-exported so the route file can raise typed errors without importing internals. */
export { ApiError };
