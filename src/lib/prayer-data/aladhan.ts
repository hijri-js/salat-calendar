/**
 * AlAdhan HTTP client (plan §3: "AlAdhan REST → fallback adhan").
 *
 * I/O lives here only; parsing/normalising is in `normalize.ts`. Facts from
 * the Step 0 recon: use the path form (the query form 302-redirects); an
 * invalid `method` silently computes with another method, so the echoed
 * `meta` is validated downstream; errors carry `data` as a string.
 */

import type { AsrSchool } from "@/lib/prayer-engine/types";

export type ApiErrorCode = "NETWORK" | "RATE_LIMIT" | "SERVER" | "UNEXPECTED";

export class ApiError extends Error {
	readonly code: ApiErrorCode;
	readonly status?: number;

	constructor(code: ApiErrorCode, message: string, status?: number) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.status = status;
	}
}

export interface MonthParams {
	latitude: number;
	longitude: number;
	method: number;
	school: AsrSchool;
	year: number;
	month: number;
	signal?: AbortSignal;
}

export function aladhanCalendarUrl(params: MonthParams): string {
	const school = params.school === "hanafi" ? 1 : 0;
	return `https://api.aladhan.com/v1/calendar/${params.year}/${params.month}` +
		`?latitude=${params.latitude}&longitude=${params.longitude}` +
		`&method=${params.method}&school=${school}`;
}

/** Fetch one month of raw AlAdhan data; throws `ApiError` on any failure. */
export async function fetchMonthRaw(params: MonthParams): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(aladhanCalendarUrl(params), {
			headers: { accept: "application/json" },
			signal: params.signal,
		});
	} catch (cause) {
		throw new ApiError("NETWORK", `AlAdhan request failed: ${String(cause)}`);
	}
	if (response.status === 429) {
		throw new ApiError("RATE_LIMIT", "AlAdhan rate limited the request", 429);
	}
	if (!response.ok) {
		throw new ApiError("SERVER", `AlAdhan returned HTTP ${response.status}`, response.status);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new ApiError("UNEXPECTED", "AlAdhan returned a non-JSON body");
	}
	return body;
}
