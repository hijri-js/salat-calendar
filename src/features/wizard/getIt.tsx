"use client";

/**
 * The "Get it" step (plan §6): the Google sync and the .ics download. Until
 * a place is set, the reason is shown next to the buttons, not only to
 * screen readers. The .ics download works (PR 6); Google sync is not wired
 * yet (PR 7), so its button stays disabled and says "Coming soon".
 */
import { useTranslations } from "next-intl";
import { CalendarSync } from "lucide-react";

import { DownloadCard } from "@/features/ics-export";
import { NavButtons } from "@/features/rules";

import { selectPlaceSet, useWizardConfig } from "./configStore";

const PROBLEM_ID = "getit-place-problem";

export default function GetIt({ onBack }: { onBack?: () => void }) {
	const t = useTranslations("getIt");
	const placeSet = useWizardConfig(selectPlaceSet);
	const config = useWizardConfig((s) => s.config);

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

			<div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
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
				<DownloadCard config={config} placeSet={placeSet} problemId={PROBLEM_ID} />
			</div>

			<NavButtons onBack={onBack} />
		</section>
	);
}
