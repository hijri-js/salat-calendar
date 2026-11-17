import { NextResponse } from "next/server";

import { getTimingsCache } from "@/lib/prayer-data/cache";
import { getTimingsForRange } from "@/lib/prayer-data/preview";
import { previewRequestSchema } from "@/lib/sync/schema";

/** `POST /api/prayers/preview` — cached timings for a date range (plan §4.10). */
const MAX_BODY_BYTES = 10_000;

export async function POST(request: Request) {
	const contentLength = Number(request.headers.get("content-length") ?? "0");
	if (contentLength > MAX_BODY_BYTES) {
		return NextResponse.json({ error: "Request body too large" }, { status: 413 });
	}

	let body: unknown;
	try {
		body = await request.json();
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
