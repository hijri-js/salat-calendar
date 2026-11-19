/**
 * The preview query request body, built from the wizard config and checked
 * against the shared `previewRequestSchema` on the client too — the API
 * route validates it again, but the client gets the same contract so the
 * query is disabled while the place is incomplete.
 */
import type { SyncConfig } from "@/lib/prayer-engine/types";
import { previewRequestSchema, type PreviewRequestValue } from "@/lib/sync/schema";

/**
 * Valid request body for `POST /api/prayers/preview`, or `null` while the
 * config cannot satisfy the schema (e.g. no timezone yet — no city picked).
 */
export function buildPreviewBody(
	config: SyncConfig,
	from: string,
	to: string,
): PreviewRequestValue | null {
	const parsed = previewRequestSchema.safeParse({
		latitude: config.location.latitude,
		longitude: config.location.longitude,
		timezone: config.location.timezone ?? "",
		method: config.method,
		school: config.school,
		from,
		to,
	});
	return parsed.success ? parsed.data : null;
}
