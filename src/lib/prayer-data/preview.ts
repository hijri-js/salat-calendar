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
import { cacheKey, roundCoord, TIMINGS_TTL_SECONDS, type TimingsCache } from "./cache";
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

/**
 * After AlAdhan times out, cannot be reached or answers 5xx, skip it for
 * this long. Without it every month of a year download waited the full
 * 10 s timeout again (about 2 minutes); now only the first month does.
 */
export const OUTAGE_PAUSE_MS = 30_000;

// Per-isolate circuit breaker: one 429 or outage pauses every request on this
// isolate, so a burst of traffic cannot keep hammering AlAdhan (plan §5:
// ~12 req/s) and a down AlAdhan does not stall each request.
let aladhanPausedUntil = 0;

/** How long a failed AlAdhan call pauses further calls; 0 for no pause. */
function pauseFor(error: unknown): number {
	if (!(error instanceof ApiError)) {
		return 0;
	}
	if (error.code === "RATE_LIMIT") {
		return RATE_LIMIT_PAUSE_MS;
	}
	if (error.code === "NETWORK" || (error.code === "SERVER" && (error.status ?? 0) >= 500)) {
		return OUTAGE_PAUSE_MS;
	}
	// A bad request or an odd response shape says nothing about AlAdhan's health.
	return 0;
}

/** Test helper: clear the rate-limit pause between tests. */
export function resetRateLimitPauseForTest(): void {
	aladhanPausedUntil = 0;
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
	const latitude = roundCoord(request.latitude);
	const longitude = roundCoord(request.longitude);
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
		// Read once: the catch must know whether this was the synthetic
		// "paused" error, even if the pause ends while it is being handled.
		const paused = now() < aladhanPausedUntil;
		try {
			if (paused) {
				throw new ApiError("RATE_LIMIT", "AlAdhan paused after a recent failure", 429);
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
			// Only a real upstream failure starts a pause; the synthetic error
			// thrown while paused must not extend it.
			const pause = paused ? 0 : pauseFor(error);
			if (pause > 0) {
				aladhanPausedUntil = now() + pause;
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
