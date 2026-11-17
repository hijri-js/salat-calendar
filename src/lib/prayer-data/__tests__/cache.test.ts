import { describe, expect, it } from "vitest";

import { cacheKey, CacheApiTimingsCache, MemoryTimingsCache, TIMINGS_TTL_SECONDS } from "../cache";
import type { DayTimings } from "@/lib/prayer-engine/types";

const value: DayTimings[] = [
	{ date: "2026-11-01", timezone: "Europe/London", times: { fajr: "05:00", dhuhr: "12:00", asr: "14:00", maghrib: "16:30", isha: "18:00" }, source: "aladhan" },
];

describe("cacheKey", () => {
	it("rounds coordinates to 2 decimals and includes method, school and month", () => {
		expect(
			cacheKey({ latitude: 51.50853, longitude: -0.12574, method: 3, school: "standard", year: 2026, month: 11 }),
		).toBe("salat-cal:v1:51.51:-0.13:3:standard:2026-11");
		expect(
			cacheKey({ latitude: 51.5, longitude: -0.12, method: 4, school: "hanafi", year: 2026, month: 1 }),
		).toBe("salat-cal:v1:51.50:-0.12:4:hanafi:2026-01");
	});
});

describe("MemoryTimingsCache", () => {
	it("stores and returns entries", async () => {
		const cache = new MemoryTimingsCache();
		await cache.set("k", value, 60);
		await expect(cache.get("k")).resolves.toEqual(value);
	});

	it("returns undefined for unknown keys", async () => {
		const cache = new MemoryTimingsCache();
		await expect(cache.get("missing")).resolves.toBeUndefined();
	});

	it("evicts the oldest entry beyond the cap (public route, bounded memory)", async () => {
		const cache = new MemoryTimingsCache();
		const fill = async (n: number) => {
			for (let i = 0; i < n; i += 1) {
				await cache.set(`k${i}`, value, 60);
			}
		};
		await fill(500);
		await expect(cache.get("k0")).resolves.toEqual(value); // exactly at cap, nothing evicted
		await cache.set("fresh", value, 60); // evicts k0
		await expect(cache.get("k0")).resolves.toBeUndefined();
		await expect(cache.get("fresh")).resolves.toEqual(value);
		await expect(cache.get("k499")).resolves.toEqual(value); // newest survivors intact
	});

	it("expires entries after the ttl", async () => {
		let now = 1_000_000;
		const cache = new MemoryTimingsCache(() => now);
		await cache.set("k", value, TIMINGS_TTL_SECONDS);
		now += TIMINGS_TTL_SECONDS * 1000 - 1;
		await expect(cache.get("k")).resolves.toEqual(value);
		now += 1;
		await expect(cache.get("k")).resolves.toBeUndefined();
		// The expired entry is gone, not just stale.
		now -= 1000;
		await expect(cache.get("k")).resolves.toBeUndefined();
	});
});

describe("CacheApiTimingsCache", () => {
	/** Minimal Cache API double recording put/match behaviour. */
	function makeFakeCache(): Cache & { store: Map<string, string> } {
		const store = new Map<string, string>();
		return {
			store,
			async match(request: RequestInfo) {
				const body = store.get(String(request));
				return body === undefined ? undefined : new Response(body);
			},
			async put(request: RequestInfo, response: Response) {
				store.set(String(request), await response.text());
			},
		} as Cache & { store: Map<string, string> };
	}

	it("round-trips a value through the Cache API shape", async () => {
		const fake = makeFakeCache();
		const cache = new CacheApiTimingsCache(fake);
		await cache.set("k", value, 60);
		await expect(cache.get("k")).resolves.toEqual(value);
		// The stored entry carries the 30-day-style cache-control header.
		const storedUrl = fake.store.keys().next().value as string;
		expect(storedUrl).toContain("salat-calendar.cache/timings/");
	});

	it("returns undefined on a miss", async () => {
		const cache = new CacheApiTimingsCache(makeFakeCache());
		await expect(cache.get("nothing")).resolves.toBeUndefined();
	});
});
