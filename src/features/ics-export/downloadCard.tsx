"use client";

/**
 * The "Download a file (.ics)" card on the Get it step (plan §6, §4.10).
 *
 * The button is never `disabled` while working: disabling a focused button
 * drops keyboard focus to <body>. It sets `aria-busy` and ignores repeat
 * clicks instead. Progress, the result and errors go to a polite live region.
 * The trade-offs of a static file are stated plainly (plan §4.10).
 */
import { useLocale, useTranslations } from "next-intl";
import { Download, LoaderCircle } from "lucide-react";

import type { SyncConfig } from "@/lib/prayer-engine/types";

import { useIcsDownload } from "./useIcsDownload";

interface DownloadCardProps {
	config: SyncConfig;
	/** False until a place is set; the button is disabled with the reason. */
	placeSet: boolean;
	/** id of the visible "pick a city" message, for aria-describedby. */
	problemId: string;
}

const STATUS_ID = "ics-status";

/** "Nov 19, 2026 – Nov 18, 2027" with Latin digits in every locale. */
function formatRange(from: string, to: string, locale: string): string {
	const format = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
		timeZone: "UTC",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	return format.formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
}

export default function DownloadCard({ config, placeSet, problemId }: DownloadCardProps) {
	const t = useTranslations("ics");
	const locale = useLocale();
	const { state, start } = useIcsDownload(config);
	const working = state.status === "working";

	return (
		<article className="flex flex-col gap-3 bg-paper-raised p-5">
			<h3 className="text-lg">{t("heading")}</h3>
			<p className="text-sm text-muted">{t("body")}</p>
			<ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted">
				<li>{t("snapshot")}</li>
				<li>{t("separateCalendar")}</li>
				{config.ooo.enabled ? <li>{t("noVacationSkip")}</li> : null}
			</ul>
			<div className="mt-auto flex flex-col items-start gap-1.5 pt-2">
				<button
					type="button"
					disabled={!placeSet}
					aria-busy={working}
					aria-describedby={placeSet ? STATUS_ID : problemId}
					onClick={() => void start()}
					className="btn"
				>
					{working ? (
						<LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
					) : (
						<Download aria-hidden className="size-4" />
					)}
					{working ? t("preparing") : state.status === "done" ? t("downloadAgain") : t("download")}
				</button>
				<p id={STATUS_ID} role="status" className="text-xs text-muted">
					{state.status === "working" ? t("progress", { done: String(state.done), total: String(state.total) }) : null}
					{state.status === "done" ? (
						<>
							{t("done", {
								count: state.eventCount,
								countLatin: String(state.eventCount),
								range: formatRange(state.from, state.to, locale),
							})}{" "}
							<bdi dir="ltr" className="font-medium text-ink">
								{state.fileName}
							</bdi>
						</>
					) : null}
					{state.status === "error" ? <span className="text-danger">{t("error")}</span> : null}
				</p>
				{state.status === "done" && state.usedLocal ? (
					<p className="text-xs text-muted">{t("usedLocal")}</p>
				) : null}
			</div>
		</article>
	);
}
