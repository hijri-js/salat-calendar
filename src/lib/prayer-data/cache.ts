/**
 * Timings cache (plan §4.9): one interface, two implementations.
 *
 * - `CacheApiTimingsCache`: Cloudflare's built-in Cache API on Workers
 *   (viable per Step 0 spike 6 — OpenNext's own adapter uses the Cache API).
 *   Entries live 30 days per data centre.
 * - `MemoryTimingsCache`: plain Map for local dev and tests.
 *
 * Cache keys are built from coordinates rounded to 2 decimals + method +
 * school + year-month, exactly per plan §4.9. Fallback results are never
 * cached.
 */

import type { AsrSchool, DayTimings } from "@/lib/prayer-engine/types";

/** 30-day entries (plan §4.9). */
export const TIMINGS_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface TimingsCache {
	get(key: string): Promise<DayTimings[] | undefined>;
	set(key: string, value: DayTimings[], ttlSeconds: number): Promise<void>;
}

export interface CacheKeyParams {
	latitude: number;
	longitude: number;
	method: number;
	school: AsrSchool;
	year: number;
	month: number;
}

export function cacheKey(params: CacheKeyParams): string {
	const lat = params.latitude.toFixed(2);
	const lng = params.longitude.toFixed(2);
	const month = String(params.month).padStart(2, "0");
	return `salat-cal:v1:${lat}:${lng}:${params.method}:${params.school}:${params.year}-${month}`;
}

export class MemoryTimingsCache implements TimingsCache {
	private readonly entries = new Map<string, { value: DayTimings[]; expiresAt: number }>();

	/** Public route + coordinate-derived keys: cap memory (reviewer finding). */
	private static readonly MAX_ENTRIES = 500;

	constructor(private readonly now: () => number = () => Date.now()) {}

	async get(key: string): Promise<DayTimings[] | undefined> {
		const entry = this.entries.get(key);
		if (!entry) {
			return undefined;
		}
		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value;
	}

	async set(key: string, value: DayTimings[], ttlSeconds: number): Promise<void> {
		if (this.entries.size >= MemoryTimingsCache.MAX_ENTRIES && !this.entries.has(key)) {
			// Map iteration is insertion-ordered: drop the oldest entry.
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) {
				this.entries.delete(oldest);
			}
		}
		this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
	}
}

/** The Cache API matches whole `Request`s, so keys ride in a URL. */
function cacheUrl(key: string): string {
	return `https://salat-calendar.cache/timings/${encodeURIComponent(key)}`;
}

export class CacheApiTimingsCache implements TimingsCache {
	constructor(private readonly cache: Cache) {}

	async get(key: string): Promise<DayTimings[] | undefined> {
		const response = await this.cache.match(cacheUrl(key));
		if (!response) {
			return undefined;
		}
		const value: unknown = await response.json();
		// Cheap structural guard: never serve a corrupted entry as data.
		if (
			!Array.isArray(value) ||
			value.some(
				(day) =>
					typeof day !== "object" || day === null ||
					typeof (day as { date?: unknown }).date !== "string" ||
					typeof (day as { timezone?: unknown }).timezone !== "string" ||
					typeof (day as { times?: unknown }).times !== "object",
			)
		) {
			return undefined;
		}
		return value as DayTimings[];
	}

	async set(key: string, value: DayTimings[], ttlSeconds: number): Promise<void> {
		await this.cache.put(
			cacheUrl(key),
			new Response(JSON.stringify(value), {
				headers: {
					"content-type": "application/json",
					"cache-control": `public, max-age=${ttlSeconds}`,
				},
			}),
		);
	}
}

let memorySingleton: MemoryTimingsCache | undefined;

/** Pick the right implementation for the current runtime. */
export function getTimingsCache(): TimingsCache {
	const caches = (globalThis as { caches?: { default?: Cache } }).caches;
	if (caches?.default) {
		return new CacheApiTimingsCache(caches.default);
	}
	memorySingleton ??= new MemoryTimingsCache();
	return memorySingleton;
}

/** Test hook: drop the process-wide memory singleton between test cases. */
export function resetTimingsCacheForTest(): void {
	memorySingleton = undefined;
}
