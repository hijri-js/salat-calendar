"use client";

/**
 * MiniPreview (plan §6 assumptions): a small card that stays visible on
 * every step. Shell slice: it reads the store only — the event count is the
 * number of enabled prayers, not an engine call yet.
 */
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";

export default function MiniPreview() {
	const t = useTranslations("miniPreview");
	const location = useWizardConfig((s) => s.config.location);
	const prayers = useWizardConfig((s) => s.config.prayers);

	// Placeholder count: enabled prayers, until the engine is wired (next slice).
	const eventCount = Object.values(prayers).filter((rule) => rule.enabled).length;

	return (
		<section
			aria-labelledby="miniPreview-heading"
			className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
		>
			<h2 id="miniPreview-heading" className="font-semibold">
				{location.label ? t("heading", { city: location.label }) : t("headingNoCity")}
			</h2>
			<p>
				{t("eventsToday", { count: eventCount, countLatin: String(eventCount) })}
			</p>
			<p className="opacity-60">
				{t("timezoneLabel")}: {location.timezone ?? "—"}
			</p>
			<p className="mt-2 text-xs opacity-60">{t("placeholder")}</p>
		</section>
	);
}
