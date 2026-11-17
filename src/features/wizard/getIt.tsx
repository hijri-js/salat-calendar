"use client";

/**
 * The "Get it" step: sync and download cards, both disabled until a place
 * is set (plan §6 — the buttons say what is missing).
 */
import { useTranslations } from "next-intl";

import { selectPlaceSet, useWizardConfig } from "./configStore";

export default function GetIt() {
	const t = useTranslations("getIt");
	const placeSet = useWizardConfig(selectPlaceSet);

	return (
		<section aria-labelledby="getIt-heading" className="flex flex-col gap-4">
			<h2 id="getIt-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				<article className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/15">
					<h3 className="font-medium">{t("syncHeading")}</h3>
					<p className="text-sm opacity-70">{t("syncBody")}</p>
					<button
						type="button"
						disabled={!placeSet}
						aria-describedby={placeSet ? undefined : "getit-place-problem"}
						className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
					>
						{t("connectButton")}
					</button>
				</article>
				<article className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/15">
					<h3 className="font-medium">{t("icsHeading")}</h3>
					<p className="text-sm opacity-70">{t("icsBody")}</p>
					<button
						type="button"
						disabled={!placeSet}
						aria-describedby={placeSet ? undefined : "getit-place-problem"}
						className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/15"
					>
						{t("downloadButton")}
					</button>
				</article>
			</div>
			<p id="getit-place-problem" className="sr-only" aria-live="polite">
				{placeSet ? undefined : t("pickACityFirst")}
			</p>
		</section>
	);
}
