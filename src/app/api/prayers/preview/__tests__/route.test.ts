import { afterEach, describe, expect, it, vi } from "vitest";

import { resetTimingsCacheForTest } from "@/lib/prayer-data/cache";
import { resetRateLimitPauseForTest } from "@/lib/prayer-data/preview";
import { POST } from "../route";

const validBody = {
	latitude: 51.5,
	longitude: -0.12,
	timezone: "Europe/London",
	method: 3,
	school: "standard",
	from: "2026-11-01",
	to: "2026-11-02",
};

function post(body: unknown): Promise<Response> {
	return POST(
		new Request("http://localhost/api/prayers/preview", {
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
			headers: { "content-type": "application/json" },
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
	resetTimingsCacheForTest();
	resetRateLimitPauseForTest();
});

/** Stub fetch with a realistic one-day AlAdhan-shaped answer. */
function stubAladhan() {
	const day = (date: string, fajr: string) => ({
		timings: { Fajr: `${fajr} (GMT)`, Sunrise: "07:00 (GMT)", Dhuhr: "12:00 (GMT)", Asr: "14:00 (GMT)", Sunset: "16:30 (GMT)", Maghrib: "16:30 (GMT)", Isha: "18:00 (GMT)", Imsak: "04:50 (GMT)", Midnight: "23:44 (GMT)", Firstthird: "21:20 (GMT)", Lastthird: "02:07 (GMT)" },
		date: { gregorian: { date } },
		meta: { timezone: "Europe/London", method: { id: 3 }, school: "STANDARD" },
	});
	const payload = {
		code: 200,
		status: "OK",
		data: [day("01-11-2026", "05:00"), day("02-11-2026", "05:02")],
	};
	vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
}

describe("POST /api/prayers/preview", () => {
	it("returns cached timings for a valid request", async () => {
		stubAladhan();
		const response = await post(validBody);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { days: { date: string; times: { fajr: string } }[] };
		expect(body.days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02"]);
		expect(body.days[0].times.fajr).toBe("05:00");
	});

	it("serves the second identical request without calling AlAdhan again", async () => {
		stubAladhan();
		await post(validBody);
		await post(validBody);
		expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
	});

	it("rejects a cross-origin request", async () => {
		const response = await POST(
			new Request("http://localhost/api/prayers/preview", {
				method: "POST",
				body: JSON.stringify(validBody),
				headers: { "content-type": "application/json", origin: "https://evil.example" },
			}),
		);
		expect(response.status).toBe(403);
	});

	it("accepts a same-origin request", async () => {
		stubAladhan();
		const response = await POST(
			new Request("http://localhost/api/prayers/preview", {
				method: "POST",
				body: JSON.stringify(validBody),
				headers: { "content-type": "application/json", origin: "http://localhost" },
			}),
		);
		expect(response.status).toBe(200);
	});

	it("rejects bodies that are not declared as JSON (blocks simple cross-site form posts)", async () => {
		const response = await POST(
			new Request("http://localhost/api/prayers/preview", {
				method: "POST",
				body: JSON.stringify(validBody),
				headers: { "content-type": "text/plain" },
			}),
		);
		expect(response.status).toBe(415);
	});

	it("measures the real body size, not only the Content-Length header", async () => {
		const response = await POST(
			new Request("http://localhost/api/prayers/preview", {
				method: "POST",
				body: JSON.stringify({ ...validBody, padding: "x".repeat(11_000) }),
				headers: { "content-type": "application/json" },
			}),
		);
		expect(response.status).toBe(413);
	});

	it("rejects invalid JSON", async () => {
		const response = await post("{not json");
		expect(response.status).toBe(400);
	});

	it("rejects schema-invalid bodies", async () => {
		const response = await post({ ...validBody, method: 0 });
		expect(response.status).toBe(400);
		const body = (await response.json()) as { issues: unknown[] };
		expect(body.issues).toHaveLength(1);
	});

	it("rejects invalid dates (2026-02-30)", async () => {
		const response = await post({ ...validBody, from: "2026-02-30" });
		expect(response.status).toBe(400);
	});

	it("rejects out-of-range years that JS would silently remap", async () => {
		const response = await post({ ...validBody, from: "0050-01-01", to: "0050-01-02" });
		expect(response.status).toBe(400);
	});

	it("rejects garbage timezone strings", async () => {
		const response = await post({ ...validBody, timezone: "Not/AZone!!" });
		expect(response.status).toBe(400);
	});

	it("rejects oversized bodies before parsing", async () => {
		const response = await POST(
			new Request("http://localhost/api/prayers/preview", {
				method: "POST",
				body: "x".repeat(11_000),
				headers: { "content-type": "application/json", "content-length": "11000" },
			}),
		);
		expect(response.status).toBe(413);
	});

	it("falls back locally when AlAdhan fails and still answers 200", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
		const response = await post(validBody);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { days: { source: string }[] };
		expect(body.days.every((d) => d.source === "local")).toBe(true);
	});

	it("rejects ranges beyond the cap", async () => {
		const response = await post({ ...validBody, to: "2028-01-01" });
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toMatch(/range/i);
	});
});
