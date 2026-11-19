import { afterEach, describe, expect, it, vi } from "vitest";

import { aladhanCalendarUrl, ApiError, fetchMonthRaw } from "@/lib/prayer-data/aladhan";

const base = { latitude: 51.5, longitude: -0.12, method: 3, school: "standard" as const, year: 2026, month: 11 };

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("aladhanCalendarUrl", () => {
	it("uses the path form with lat, lng, method and school", () => {
		expect(aladhanCalendarUrl(base)).toBe(
			"https://api.aladhan.com/v1/calendar/2026/11?latitude=51.5&longitude=-0.12&method=3&school=0",
		);
		expect(aladhanCalendarUrl({ ...base, school: "hanafi" })).toContain("school=1");
	});
});

describe("fetchMonthRaw", () => {
	it("returns the parsed body on HTTP 200", async () => {
		const body = { code: 200, data: [] };
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
		await expect(fetchMonthRaw(base)).resolves.toEqual(body);
	});

	it("throws NETWORK when fetch rejects", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => {
			throw new TypeError("fetch failed");
		}));
		try {
			await fetchMonthRaw(base);
			expect.unreachable();
		} catch (error) {
			expect((error as ApiError).code).toBe("NETWORK");
		}
	});

	it("throws RATE_LIMIT on HTTP 429", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
		try {
			await fetchMonthRaw(base);
			expect.unreachable();
		} catch (error) {
			expect((error as ApiError).code).toBe("RATE_LIMIT");
			expect((error as ApiError).status).toBe(429);
		}
	});

	it("throws SERVER on other HTTP errors", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
		try {
			await fetchMonthRaw(base);
			expect.unreachable();
		} catch (error) {
			expect((error as ApiError).code).toBe("SERVER");
			expect((error as ApiError).status).toBe(503);
		}
	});

	it("throws UNEXPECTED on a non-JSON body", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
		try {
			await fetchMonthRaw(base);
			expect.unreachable();
		} catch (error) {
			expect((error as ApiError).code).toBe("UNEXPECTED");
		}
	});

	it("passes an abort signal through to fetch", async () => {
		const controller = new AbortController();
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			expect(init?.signal).toBe(controller.signal);
			return new Response("{}", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);
		await fetchMonthRaw({ ...base, signal: controller.signal });
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
