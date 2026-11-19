"use client";

/**
 * The live preview query (plan §4.10: the browser runs the engine). The
 * query POSTs the week's range to `/api/prayers/preview` (validated by the
 * shared `previewRequestSchema` on both sides) and returns raw
 * `DayTimings`; the engine's `planRange` then applies the full wizard
 * config to produce `DayPlan`s — the server never plans events itself.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { planRange, type DayPlan, type DayTimings } from "@/lib/prayer-engine";
import type { PreviewRequestValue } from "@/lib/sync/schema";
import { previewResponseSchema } from "@/lib/sync/schema";
import type { SyncConfig } from "@/lib/prayer-engine/types";

import { buildPreviewBody } from "./previewBody";

async function fetchPreview(
	body: PreviewRequestValue,
	signal: AbortSignal,
): Promise<DayTimings[]> {
	const response = await fetch("/api/prayers/preview", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal,
	});
	if (!response.ok) {
		throw new Error(`Preview request failed with status ${response.status}`);
	}
	const data: unknown = await response.json();
	return previewResponseSchema.parse(data).days;
}

export interface PreviewState {
	/** Raw server timings for the week. */
	timings: DayTimings[];
	/** Engine output: events and skips for the same week. */
	days: DayPlan[];
	/** True while the timings request is in flight (first load). */
	isPending: boolean;
	/** True when the request failed. */
	isError: boolean;
	/** True when shown data comes from the previous week (keepPreviousData). */
	isPlaceholderData: boolean;
	/** True when the config is incomplete — no query is issued. */
	disabled: boolean;
}

/**
 * Timings + engine plans for the inclusive week `from`..`from+6`. The
 * engine runs in the browser over the full config; re-planning is memoised
 * on the raw timings and the config object the store produces.
 */
export function usePreview(config: SyncConfig, from: string, to: string): PreviewState {
	const body = useMemo(() => buildPreviewBody(config, from, to), [config, from, to]);

	const query = useQuery({
		queryKey: ["preview", body],
		queryFn: ({ signal }: { signal: AbortSignal }) => {
			if (body === null) {
				throw new Error("Preview request body is not valid");
			}
			return fetchPreview(body, signal);
		},
		enabled: body !== null,
		placeholderData: keepPreviousData,
	});

	const timings = useMemo(() => query.data ?? [], [query.data]);
	const days = useMemo(() => planRange(timings, config), [timings, config]);

	return {
		timings,
		days,
		isPending: query.isPending,
		isError: query.isError,
		isPlaceholderData: query.isPlaceholderData,
		disabled: body === null,
	};
}
