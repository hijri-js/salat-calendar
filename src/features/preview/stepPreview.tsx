"use client";

/**
 * Step 5: Preview (plan §6, §4.10): a week of engine plans rendered as the
 * WeekGrid, with week navigation clamped to the shared contract's 1900–2100
 * window. The timings come from the preview API (TanStack Query) and the
 * engine runs here in the browser over the full config — the server never
 * plans events itself.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";

import { addWeeks, todayIso, weekDates, weekStartOf } from "./week";
import { usePreview } from "./usePreview";
import WeekGrid from "./weekGrid";
import { NavButtons } from "@/features/rules";

interface StepPreviewProps {
	onBack?: () => void;
	onNext?: () => void;
}

/**
 * The preview request schema (plan §4.1) only accepts dates in 1900–2100,
 * so week navigation is clamped to weeks that fit entirely inside it.
 */
const MIN_WEEK_START = "1900-01-01";
/** Last Monday whose full week still ends within 2100-12-31. */
const MAX_WEEK_START = "2100-12-25";

/** ISO date string comparison is valid for "YYYY-MM-DD". */
function clampWeekStart(weekStart: string): string {
	if (weekStart < MIN_WEEK_START) {
		return MIN_WEEK_START;
	}
	if (weekStart > MAX_WEEK_START) {
		return MAX_WEEK_START;
	}
	return weekStart;
}

export default function StepPreview({ onBack, onNext }: StepPreviewProps) {
	const t = useTranslations("preview");
	const config = useWizardConfig((s) => s.config);

	const [weekStart, setWeekStart] = useState(() =>
		clampWeekStart(weekStartOf(todayIso())),
	);
	const dates = weekDates(weekStart);
	const from = dates[0];
	const to = dates[dates.length - 1];

	// Clamped at the boundaries → the buttons disable instead of showing a
	// misleading "pick a city" message.
	const atStart = weekStart <= MIN_WEEK_START;
	const atEnd = weekStart >= MAX_WEEK_START;

	const preview = usePreview(config, from, to);

	return (
		<section aria-labelledby="preview-heading" className="flex flex-col gap-4">
			<h2 id="preview-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>

			{preview.disabled ? (
				<p className="rounded-xl border border-dashed border-black/15 p-6 text-sm opacity-70 dark:border-white/20">
					{t("noCity")}
				</p>
			) : (
				<>
					<div className="flex items-center justify-between gap-2">
						<button
							type="button"
							disabled={atStart}
							onClick={() =>
								setWeekStart((start) => clampWeekStart(addWeeks(start, -1)))
							}
							aria-label={t("previousWeek")}
							className="rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/15"
						>
							<span aria-hidden className="inline-block rtl:rotate-180">◀</span>
						</button>
						<p
							aria-live="polite"
							className="flex items-center gap-2 text-sm font-medium tabular-nums"
						>
							{from} – {to}
							{preview.isPlaceholderData && !preview.isPending ? (
								<span
									aria-hidden
									className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-normal opacity-70 dark:bg-white/10"
								>
									{t("loadingWeek")}
								</span>
							) : null}
						</p>
						<button
							type="button"
							disabled={atEnd}
							onClick={() =>
								setWeekStart((start) => clampWeekStart(addWeeks(start, 1)))
							}
							aria-label={t("nextWeek")}
							className="rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/15"
						>
							<span aria-hidden className="inline-block rtl:rotate-180">▶</span>
						</button>
					</div>

					{preview.isError ? (
						<p role="alert" className="text-sm text-red-600 dark:text-red-400">
							{t("loadError")}
						</p>
					) : preview.isPending ? (
						<p className="text-sm opacity-60">{t("loading")}</p>
					) : (
						<WeekGrid
							plans={preview.days}
							timings={preview.timings}
							window={config.window}
							placeholder={preview.isPlaceholderData}
						/>
					)}
				</>
			)}

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
