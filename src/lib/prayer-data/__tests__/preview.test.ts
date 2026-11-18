import { afterEach, describe, expect, it, vi } from "vitest";

import type { DayTimings } from "@/lib/prayer-engine/types";
import { ApiError } from "@/lib/prayer-data/aladhan";
import { MemoryTimingsCache, TIMINGS_TTL_SECONDS } from "@/lib/prayer-data/cache";
import {
	daysBetweenInclusive,
	getTimingsForRange,
	listMonths,
	PREVIEW_MAX_DAYS,
	RATE_LIMIT_PAUSE_MS,
	resetRateLimitPauseForTest,
} from "@/lib/prayer-data/preview";

afterEach(() => {
	resetRateLimitPauseForTest();
});

const request = {
	latitude: 51.5,
	longitude: -0.12,
	timezone: "Europe/London",
	method: 3,
	school: "standard" as const,
	from: "2026-11-01",
	to: "2026-11-07",
};

function makeDays(year: number, month: number, count: number, source: "aladhan" | "local" = "aladhan"): DayTimings[] {
	return Array.from({ length: count }, (_, i) => ({
		date: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
		timezone: "Europe/London",
		times: { fajr: "05:00", dhuhr: "12:00", asr: "14:00", maghrib: "16:30", isha: "18:00" },
		source,
	}));
}

describe("daysBetweenInclusive / listMonths", () => {
	it("counts inclusive days", () => {
		expect(daysBetweenInclusive("2026-11-01", "2026-11-07")).toBe(7);
		expect(daysBetweenInclusive("2026-11-01", "2026-11-01")).toBe(1);
	});

	it("rejects nonsense dates", () => {
		expect(Number.isNaN(daysBetweenInclusive("nope", "2026-11-01"))).toBe(true);
	});

	it("counts a crossing-year range", () => {
		expect(daysBetweenInclusive("2026-12-30", "2027-01-02")).toBe(4);
	});

	it("lists every touched month once, in order", () => {
		expect(listMonths("2026-11-20", "2027-01-05")).toEqual([
			{ year: 2026, month: 11 },
			{ year: 2026, month: 12 },
			{ year: 2027, month: 1 },
		]);
		expect(listMonths("2026-11-01", "2026-11-30")).toEqual([{ year: 2026, month: 11 }]);
	});
});

describe("getTimingsForRange", () => {
	it("fetches a miss once, then serves the same range from cache", async () => {
		const cache = new MemoryTimingsCache();
		const fetchMonth = vi.fn(async () => ({ code: 200, data: [] }));
		const normalize = vi.fn(() => makeDays(2026, 11, 30));
		const deps = { cache, fetchMonth, normalize, computeLocal: vi.fn() };

		const first = await getTimingsForRange(request, deps);
		expect(first).toHaveLength(7);
		expect(fetchMonth).toHaveBeenCalledTimes(1);
		expect(deps.computeLocal).not.toHaveBeenCalled();

		const second = await getTimingsForRange(request, deps);
		expect(second).toEqual(first);
		expect(fetchMonth).toHaveBeenCalledTimes(1); // cache hit, no second call
	});

	it("stores results with the 30-day ttl", async () => {
		const cache = new MemoryTimingsCache();
		const setSpy = vi.spyOn(cache, "set");
		await getTimingsForRange(request, {
			cache,
			fetchMonth: async () => ({ code: 200, data: [] }),
			normalize: () => makeDays(2026, 11, 30),
		});
		expect(setSpy).toHaveBeenCalledWith(expect.any(String), expect.anything(), TIMINGS_TTL_SECONDS);
	});

	it("falls back locally on a 429 and does not cache the fallback", async () => {
		const cache = new MemoryTimingsCache();
		const fetchMonth = vi.fn(async () => {
			throw new ApiError("RATE_LIMIT", "slow down", 429);
		});
		const computeLocal = vi.fn(() => makeDays(2026, 11, 30, "local"));

		const days = await getTimingsForRange(request, { cache, fetchMonth, computeLocal });
		expect(fetchMonth).toHaveBeenCalledTimes(1);
		expect(computeLocal).toHaveBeenCalledTimes(1);
		expect(days.every((d) => d.source === "local")).toBe(true);
		// Fallback is not cached: the cache stays empty.
		expect((cache as unknown as { entries: Map<string, unknown> }).entries.size).toBe(0);
	});

	it("pauses AlAdhan for a minute after a 429, then tries again", async () => {
		let clock = 1_000_000;
		const now = () => clock;
		const computeLocal = vi.fn(() => makeDays(2026, 11, 30, "local"));
		const limited = vi.fn(async () => {
			throw new ApiError("RATE_LIMIT", "slow down", 429);
		});
		await getTimingsForRange(request, { cache: new MemoryTimingsCache(), fetchMonth: limited, computeLocal, now });

		// Inside the pause: AlAdhan is not called at all.
		const healthy = vi.fn(async () => ({}));
		const normalize = vi.fn(() => makeDays(2026, 11, 30));
		clock += RATE_LIMIT_PAUSE_MS - 1;
		await getTimingsForRange(request, { cache: new MemoryTimingsCache(), fetchMonth: healthy, normalize, computeLocal, now });
		expect(healthy).not.toHaveBeenCalled();

		// After the pause: AlAdhan is called again.
		clock += 1;
		const days = await getTimingsForRange(request, { cache: new MemoryTimingsCache(), fetchMonth: healthy, normalize, computeLocal, now });
		expect(healthy).toHaveBeenCalledTimes(1);
		expect(days.every((d) => d.source === "aladhan")).toBe(true);
	});

	it("sends coordinates rounded to 2 decimals, matching the cache key", async () => {
		const fetchMonth = vi.fn<(params: { latitude: number; longitude: number }) => Promise<unknown>>(async () => ({}));
		const normalize = vi.fn(() => makeDays(2026, 11, 30));
		await getTimingsForRange(
			{ ...request, latitude: 51.507351, longitude: -0.127758 },
			{ cache: new MemoryTimingsCache(), fetchMonth, normalize },
		);
		expect(fetchMonth.mock.calls[0]![0]).toMatchObject({ latitude: 51.51, longitude: -0.13 });
	});

	it("also falls back when the response shape is unexpected", async () => {
		const cache = new MemoryTimingsCache();
		const computeLocal = vi.fn(() => makeDays(2026, 11, 30, "local"));
		const days = await getTimingsForRange(request, {
			cache,
			fetchMonth: async () => ({ hello: true }),
			computeLocal,
		});
		expect(computeLocal).toHaveBeenCalledTimes(1);
		expect(days.every((d) => d.source === "local")).toBe(true);
	});

	it("filters the full months down to the requested range", async () => {
		const days = await getTimingsForRange(request, {
			cache: new MemoryTimingsCache(),
			fetchMonth: async () => ({ code: 200, data: [] }),
			normalize: () => makeDays(2026, 11, 30),
		});
		expect(days.map((d) => d.date)).toEqual([
			"2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07",
		]);
	});

	it("fetches one month per touched month for a cross-month range", async () => {
		const cache = new MemoryTimingsCache();
		const fetchMonth = vi.fn(async (p: { year: number; month: number }) => ({ code: 200, data: [], echoed: p }));
		const normalize = vi.fn(() => makeDays(2026, 11, 30));

		await getTimingsForRange({ ...request, from: "2026-11-29", to: "2026-12-02" }, { cache, fetchMonth, normalize });
		expect(fetchMonth).toHaveBeenCalledTimes(2);
		const firstCall = fetchMonth.mock.calls[0][0];
		const secondCall = fetchMonth.mock.calls[1][0];
		expect([firstCall.month, secondCall.month]).toEqual([11, 12]);
	});

	it("keeps good AlAdhan data when the cache write fails", async () => {
		const cache = new MemoryTimingsCache();
		vi.spyOn(cache, "set").mockRejectedValue(new Error("cache write failed"));
		const days = await getTimingsForRange(request, {
			cache,
			fetchMonth: async () => ({ code: 200, data: [] }),
			normalize: () => makeDays(2026, 11, 30),
			computeLocal: vi.fn(() => {
				throw new Error("must not be called when the fetch succeeded");
			}),
		});
		expect(days).toHaveLength(7);
		expect(days.every((d) => d.source === "aladhan")).toBe(true);
	});

	it("treats a cache-read failure as a miss", async () => {
		const cache = new MemoryTimingsCache();
		vi.spyOn(cache, "get").mockRejectedValue(new Error("cache read failed"));
		const days = await getTimingsForRange(request, {
			cache,
			fetchMonth: async () => ({ code: 200, data: [] }),
			normalize: () => makeDays(2026, 11, 30),
		});
		expect(days).toHaveLength(7);
	});

	it("rejects ranges beyond the cap", async () => {
		await expect(
			getTimingsForRange({ ...request, to: "2028-01-01" }, { cache: new MemoryTimingsCache() }),
		).rejects.toThrow(RangeError);
		expect(PREVIEW_MAX_DAYS).toBe(400);
	});
});
