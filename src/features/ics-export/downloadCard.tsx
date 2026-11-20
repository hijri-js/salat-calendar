"use client";

/**
 * The "Download a file (.ics)" card on the Get it step (plan §6, §4.10).
 *
 * The button is never `disabled` while working: disabling a focused button
 * drops keyboard focus to <body>. It sets `aria-busy` and ignores repeat
 * clicks instead. The result, notes and errors go to a polite live region.
 * The trade-offs of a static file are stated plainly (plan §4.10).
 */
import { useLocale, useTranslations } from "next-intl";
import { Download, LoaderCircle } from "lucide-react";

import { PRAYERS, type SyncConfig } from "@/lib/prayer-engine/types";

import { calendarNameFor, progressFraction } from "./icsFile";
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
	const tPrayers = useTranslations("prayers");
	const locale = useLocale();
	const calendarName = calendarNameFor(config.titleLocale);
	// Say what the file will hold before it is made: settings live in memory
	// only, so a reload quietly brings back all five prayers.
	const included = PRAYERS.filter((prayer) => config.prayers[prayer].enabled).map((prayer) =>
		tPrayers(`prayer.${prayer}`),
	);
	const { state, start } = useIcsDownload(config, calendarName);
	const working = state.status === "working";

	return (
		<article className="flex flex-col gap-3 bg-paper-raised p-5">
			<h3 className="text-lg">{t("heading")}</h3>
			<p className="text-sm text-muted">{t("body")}</p>
			<ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted">
				<li>{t("snapshot")}</li>
				{config.ooo.enabled ? <li>{t("noVacationSkip")}</li> : null}
			</ul>
			<details className="text-sm text-muted">
				<summary className="cursor-pointer font-medium text-ink">{t("importHeading")}</summary>
				<div className="flex flex-col gap-2 pt-2">
					<p>{t("importIntro")}</p>
					<ol className="flex list-decimal flex-col gap-1 ps-5">
						<li>{t("importGoogleCreate", { name: calendarName })}</li>
						<li>{t("importGoogleImport", { name: calendarName })}</li>
						<li>{t("importGoogleRemove", { name: calendarName })}</li>
					</ol>
					<p>{t("importApple")}</p>
					<p>{t("importOutlook")}</p>
				</div>
			</details>
			{included.length > 0 ? (
				<p className="text-sm">
					<span className="text-muted">{t("contains")}</span>{" "}
					<span className="font-medium text-ink">
						{new Intl.ListFormat(locale, { type: "conjunction" }).format(included)}
					</span>
				</p>
			) : null}
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
				{/* Progress is visible, not announced: thirteen polite updates would be
				    noise, and the button label already says "Preparing…". The native
				    <progress> still exposes its value to screen readers on demand. */}
				{state.status === "working" ? (
					<div className="flex w-full flex-col gap-1">
						<div className="flex items-center gap-3">
							<progress
								className="ics-progress"
								value={state.doneDays}
								max={state.totalDays}
								aria-label={t("progressLabel")}
							/>
							<span aria-hidden className="text-sm font-medium tabular-nums text-ink">
								{new Intl.NumberFormat(`${locale}-u-nu-latn`, { style: "percent" }).format(
									progressFraction(state.doneDays, state.totalDays),
								)}
							</span>
						</div>
						<p aria-hidden className="text-xs text-muted">
							{t("progress", { done: String(state.done), total: String(state.total) })}
						</p>
					</div>
				) : null}
				<div id={STATUS_ID} role="status" className="flex flex-col gap-1 text-xs text-muted">
					{state.status === "done" ? (
						<p>
							{t("done", {
								count: state.eventCount,
								countLatin: new Intl.NumberFormat(`${locale}-u-nu-latn`).format(state.eventCount),
								range: formatRange(state.from, state.to, locale),
							})}{" "}
							<bdi dir="ltr" className="font-medium text-ink">
								{state.fileName}
							</bdi>
						</p>
					) : null}
					{state.status === "done" && state.usedLocal ? <p>{t("usedLocal")}</p> : null}
					{state.status === "empty" ? <p>{t("empty")}</p> : null}
					{state.status === "error" ? <p className="text-danger">{t("error")}</p> : null}
				</div>
			</div>
		</article>
	);
}
