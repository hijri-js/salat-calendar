"use client";

/**
 * The .ics download flow (plan §4.10): fetch a rolling year of timings one
 * month at a time from the cached preview API, run the engine in the
 * browser, build the file and hand it to the browser as a download.
 *
 * Months are fetched one after another: each request matches one cached
 * AlAdhan month on the server, stays inside the Worker's per-request limits
 * (plan §4.6), and lets the card show progress. No login, no Google.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { buildPreviewBody, fetchPreview } from "@/features/preview";
import type { DayTimings, SyncConfig } from "@/lib/prayer-engine/types";

import { buildYearIcs, chunkDays, icsFileName, monthChunks, todayIn, yearRange } from "./icsFile";

export type IcsDownloadState =
	| { status: "idle" }
	| { status: "working"; done: number; total: number; doneDays: number; totalDays: number }
	| { status: "done"; eventCount: number; fileName: string; usedLocal: boolean; from: string; to: string }
	| { status: "empty" }
	| { status: "error" };

/** Hand a text file to the browser as a download. */
function saveFile(text: string, fileName: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.hidden = true;
	document.body.append(link);
	link.click();
	link.remove();
	// Revoke after the click has been handled; revoking at once can cancel
	// the download in some browsers.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `calendarName` is the file's display name (X-WR-CALNAME), localized by the caller. */
export function useIcsDownload(config: SyncConfig, calendarName: string) {
	const [state, setState] = useState<IcsDownloadState>({ status: "idle" });
	const controller = useRef<AbortController | null>(null);

	// Leaving the step cancels a download in progress.
	useEffect(() => () => controller.current?.abort(), []);

	const start = useCallback(async () => {
		const timeZone = config.location.timezone;
		// A second click while working is ignored (the button stays focusable).
		if (controller.current !== null || timeZone === undefined || timeZone === "") {
			return;
		}
		const abort = new AbortController();
		controller.current = abort;

		// Everything after taking the slot is inside try, so finally always
		// frees it: a throw here (e.g. a timezone this browser's ICU does not
		// know) must show an error, not leave the button silently dead.
		try {
			const { from, to } = yearRange(todayIn(timeZone));
			const chunks = monthChunks(from, to);
			// Progress counts days, so the bar moves smoothly instead of in 13 jumps.
			const totalDays = chunks.reduce((sum, chunk) => sum + chunkDays(chunk), 0);
			let doneDays = 0;
			setState({ status: "working", done: 0, total: chunks.length, doneDays, totalDays });

			const timings: DayTimings[] = [];
			for (const [index, chunk] of chunks.entries()) {
				const body = buildPreviewBody(config, chunk.from, chunk.to);
				if (body === null) {
					throw new Error("Download request is not valid");
				}
				timings.push(...(await fetchPreview(body, abort.signal)));
				doneDays += chunkDays(chunk);
				setState({ status: "working", done: index + 1, total: chunks.length, doneDays, totalDays });
			}
			// The user may have left the step while the last month arrived.
			if (abort.signal.aborted) {
				return;
			}
			const result = buildYearIcs(timings, config, { calendarName });
			if (result.eventCount === 0) {
				// Every prayer or day is off: an empty file helps nobody.
				setState({ status: "empty" });
				return;
			}
			const fileName = icsFileName(config.location.label, from);
			saveFile(result.text, fileName);
			setState({
				status: "done",
				eventCount: result.eventCount,
				fileName,
				usedLocal: result.usedLocal,
				from,
				to,
			});
		} catch {
			if (!abort.signal.aborted) {
				setState({ status: "error" });
			}
		} finally {
			controller.current = null;
		}
	}, [config, calendarName]);

	return { state, start };
}
