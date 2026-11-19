import { NextResponse } from "next/server";

import { getTimingsCache } from "@/lib/prayer-data/cache";
import { getTimingsForRange } from "@/lib/prayer-data/preview";
import { previewRequestSchema } from "@/lib/sync/schema";

/** `POST /api/prayers/preview` — cached timings for a date range (plan §4.10). */
const MAX_BODY_BYTES = 10_000;

/**
 * Same-origin only. Browsers always send `Origin` on a cross-site POST, and
 * requiring `application/json` forces a CORS preflight that we never answer,
 * so other sites cannot use this route. Requests without `Origin` (curl,
 * server-to-server) are allowed; real abuse limits are a Cloudflare rate-limit
 * rule (plan §10, PR 9).
 */
function isForeignOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (origin === null) {
		return false;
	}
	return origin !== new URL(request.url).origin;
}

export async function POST(request: Request) {
	if (isForeignOrigin(request)) {
		return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
	}
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().startsWith("application/json")) {
		return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
	}
	// Fast path on the declared length, then check the real length: a chunked
	// body has no Content-Length header.
	if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
		return NextResponse.json({ error: "Request body too large" }, { status: 413 });
	}
	const text = await request.text();
	if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
		return NextResponse.json({ error: "Request body too large" }, { status: 413 });
	}

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
	}

	const parsed = previewRequestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	try {
		const days = await getTimingsForRange(parsed.data, { cache: getTimingsCache() });
		return NextResponse.json({ days });
	} catch (error) {
		if (error instanceof RangeError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		return NextResponse.json({ error: "Failed to fetch prayer times" }, { status: 502 });
	}
}
