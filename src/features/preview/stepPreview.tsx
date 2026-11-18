"use client";

/**
 * Step 5: Preview (plan §6, §4.10): seven days of engine plans, starting
 * today, rendered as the WeekGrid. Week navigation is clamped to the shared
 * contract's 1900–2100 window. The timings come from the preview API
 * (TanStack Query) and the engine runs here in the browser over the full
 * config; the server never plans events itself.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useWizardConfig } from "@/features/wizard";
import { NavButtons } from "@/features/rules";

import { rangeLabel } from "./formatDate";
import { addWeeks, todayIso, weekDates } from "./week";
import { usePreview } from "./usePreview";
import WeekGrid from "./weekGrid";

interface StepPreviewProps {
	onBack?: () => void;
	onNext?: () => void;
}

/**
 * The preview request schema (plan §4.1) only accepts dates in 1900–2100,
 * so navigation is clamped to 7-day spans that fit entirely inside it.
 */
const MIN_WEEK_START = "1900-01-01";
/** Last start whose 7 days still end within 2100-12-31. */
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
	const locale = useLocale();
	const config = useWizardConfig((s) => s.config);

	const [today] = useState(todayIso);
	const [weekStart, setWeekStart] = useState(() => clampWeekStart(today));
	const dates = weekDates(weekStart);
	const from = dates[0];
	const to = dates[dates.length - 1];

	// Clamped at the boundaries → the buttons disable instead of showing a
	// misleading "pick a city" message.
	const atStart = weekStart <= MIN_WEEK_START;
	const atEnd = weekStart >= MAX_WEEK_START;

	const preview = usePreview(config, from, to);

	return (
		<section aria-labelledby="preview-heading" className="flex flex-col gap-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<h2 id="preview-heading" className="text-(length:--text-title)">
					{t("heading")}
				</h2>

				{preview.disabled ? null : (
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={atStart}
							onClick={() =>
								setWeekStart((start) => clampWeekStart(addWeeks(start, -1)))
							}
							aria-label={t("previousWeek")}
							className="btn btn-icon"
						>
							<ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
						</button>
						<p
							aria-live="polite"
							className="min-w-36 text-center text-sm font-medium tabular-nums"
						>
							{rangeLabel(from, to, locale)}
						</p>
						<button
							type="button"
							disabled={atEnd}
							onClick={() =>
								setWeekStart((start) => clampWeekStart(addWeeks(start, 1)))
							}
							aria-label={t("nextWeek")}
							className="btn btn-icon"
						>
							<ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
						</button>
					</div>
				)}
			</div>

			{preview.disabled ? (
				<p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
					{t("noCity")}
				</p>
			) : preview.isError ? (
				<p role="alert" className="text-sm text-danger">
					{t("loadError")}
				</p>
			) : preview.isPending ? (
				<p className="text-sm text-muted">{t("loading")}</p>
			) : (
				<>
					{preview.isPlaceholderData ? (
						<p className="text-xs text-muted" aria-live="polite">
							{t("loadingWeek")}
						</p>
					) : null}
					<WeekGrid
						plans={preview.days}
						timings={preview.timings}
						window={config.window}
						today={today}
						placeholder={preview.isPlaceholderData}
					/>
				</>
			)}

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
