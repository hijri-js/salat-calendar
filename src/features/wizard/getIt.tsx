"use client";

/**
 * The "Get it" step (plan §6): the Google sync and the .ics download. Until
 * a place is set, the reason is shown next to the buttons, not only to
 * screen readers. Neither action is wired yet (PR 6 / PR 7), so both
 * buttons stay disabled and say "Coming soon" rather than doing nothing.
 */
import { useTranslations } from "next-intl";
import { CalendarSync, Download } from "lucide-react";

import { NavButtons } from "@/features/rules";

import { selectPlaceSet, useWizardConfig } from "./configStore";

const PROBLEM_ID = "getit-place-problem";

export default function GetIt({ onBack }: { onBack?: () => void }) {
	const t = useTranslations("getIt");
	const placeSet = useWizardConfig(selectPlaceSet);

	return (
		<section aria-labelledby="getIt-heading" className="flex flex-col gap-5">
			<h2 id="getIt-heading" className="text-(length:--text-title)">
				{t("heading")}
			</h2>

			{placeSet ? null : (
				<p
					id={PROBLEM_ID}
					className="flex items-center gap-2 rounded-lg bg-accent-wash px-3 py-2 text-sm font-medium text-accent-ink"
				>
					<span aria-hidden className="size-2 rounded-full bg-accent" />
					{t("pickACityFirst")}
				</p>
			)}

			<div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
				<article className="flex flex-col gap-3 bg-paper-raised p-5">
					<h3 className="text-lg">{t("syncHeading")}</h3>
					<p className="text-sm text-muted">{t("syncBody")}</p>
					<div className="mt-auto flex flex-col items-start gap-1.5 pt-2">
						<button
							type="button"
							disabled
							aria-describedby={placeSet ? "getit-sync-soon" : PROBLEM_ID}
							className="btn btn-primary"
						>
							<CalendarSync aria-hidden className="size-4" />
							{t("connectButton")}
						</button>
						<p id="getit-sync-soon" className="text-xs text-muted">
							<span className="font-semibold">{t("comingSoon")}</span> · {t("syncSoon")}
						</p>
					</div>
				</article>
				<article className="flex flex-col gap-3 bg-paper-raised p-5">
					<h3 className="text-lg">{t("icsHeading")}</h3>
					<p className="text-sm text-muted">{t("icsBody")}</p>
					<div className="mt-auto flex flex-col items-start gap-1.5 pt-2">
						<button
							type="button"
							disabled
							aria-describedby={placeSet ? "getit-ics-soon" : PROBLEM_ID}
							className="btn"
						>
							<Download aria-hidden className="size-4" />
							{t("downloadButton")}
						</button>
						<p id="getit-ics-soon" className="text-xs text-muted">
							<span className="font-semibold">{t("comingSoon")}</span> · {t("icsSoon")}
						</p>
					</div>
				</article>
			</div>

			<NavButtons onBack={onBack} />
		</section>
	);
}
