"use client";

/**
 * MiniPreview (plan §6 wireframe, side panel): today's five prayers for the
 * chosen place, run through the same engine as the week preview, so every
 * rule change shows up here at once. Each row shows the adhan time, and
 * under it when the event starts (offset, rounding, Jummah applied) or why
 * the prayer is off or skipped today. Showing only the event time read as
 * "wrong prayer times" (it is the adhan plus the offset).
 */
import { useTranslations } from "next-intl";

import { PRAYERS, type Prayer } from "@/lib/prayer-engine/types";
import { useWizardConfig } from "@/features/wizard";

import { usePreview } from "./usePreview";
import { useToday } from "./useToday";

const PRAYER_EMOJI: Record<Prayer, string> = {
	fajr: "🌅",
	dhuhr: "☀️",
	asr: "🌤️",
	maghrib: "🌇",
	isha: "🌙",
};

export default function MiniPreview() {
	const today = useToday();
	// The prerendered shell has no clock; the browser fills it in at once.
	return today === null ? <MiniPreviewShell /> : <MiniPreviewToday today={today} />;
}

function MiniPreviewShell() {
	const t = useTranslations("miniPreview");
	return (
		<section className="rounded-2xl border border-line bg-paper-raised p-4">
			<p className="text-lg font-semibold">{t("headingNoCity")}</p>
			<p className="text-sm text-muted">{t("loading")}</p>
		</section>
	);
}

function MiniPreviewToday({ today }: { today: string }) {
	const t = useTranslations("miniPreview");
	const tPrayers = useTranslations("prayers");
	const tPreview = useTranslations("preview");
	const config = useWizardConfig((s) => s.config);

	const preview = usePreview(config, today, today);
	const plan = preview.days.find((day) => day.date === today);
	const adhan = preview.timings.find((day) => day.date === today)?.times;
	const eventCount = plan?.events.length ?? 0;

	return (
		<section
			aria-labelledby="miniPreview-heading"
			className="flex flex-col gap-3 rounded-2xl border border-line bg-paper-raised p-4 lg:sticky lg:top-6"
		>
			<h2 id="miniPreview-heading" className="text-lg leading-snug">
				{config.location.label
					? t("heading", { city: config.location.label })
					: t("headingNoCity")}
			</h2>

			{preview.disabled ? (
				<p className="text-sm text-muted">{t("noCity")}</p>
			) : preview.isError ? (
				<p role="alert" className="text-sm text-danger">
					{tPreview("loadError")}
				</p>
			) : plan === undefined ? (
				<p className="text-sm text-muted">{t("loading")}</p>
			) : (
				<>
					<p className="text-xs text-muted">{t("caption")}</p>
					<ul className="flex flex-col divide-y divide-line text-sm">
						{PRAYERS.map((prayer) => {
							const event = plan.events.find((e) => e.prayer === prayer);
							const skipped = plan.skipped.find((s) => s.prayer === prayer);
							const off = skipped?.reason === "prayer-off";
							return (
								<li key={prayer} className="flex items-center gap-2 py-1.5">
									<span aria-hidden className="w-5 text-center">
										{config.prayers[prayer].emoji || PRAYER_EMOJI[prayer]}
									</span>
									<span className={event ? "font-medium" : "text-muted"}>
										{tPrayers(`prayer.${prayer}`)}
									</span>
									<span className="ms-auto flex flex-col items-end tabular-nums">
										{adhan?.[prayer] ? (
											<span className={event ? "font-medium" : "text-muted"}>
												<span className="sr-only">{t("adhan")} </span>
												<bdi dir="ltr">{adhan[prayer]}</bdi>
											</span>
										) : null}
										<span className="text-xs text-muted">
											{event ? (
												<>
													{t("eventAt")} <bdi dir="ltr">{event.startLocal.slice(11, 16)}</bdi>
													{/* An offset can push the event past midnight either way. */}
													{event.startLocal.slice(0, 10) > today
														? ` ${t("nextDay")}`
														: event.startLocal.slice(0, 10) < today
															? ` ${t("previousDay")}`
															: null}
												</>
											) : off ? (
												t("off")
											) : skipped ? (
												tPreview(`skipReason.${skipped.reason}`)
											) : (
												t("skipped")
											)}
										</span>
									</span>
								</li>
							);
						})}
					</ul>
					<p className="text-sm font-semibold">
						{t("eventsToday", { count: eventCount, countLatin: String(eventCount) })}
					</p>
				</>
			)}

			{config.location.timezone ? (
				<p className="text-xs text-muted">
					{t("timezoneLabel")}: <bdi dir="ltr">{config.location.timezone}</bdi>
				</p>
			) : null}
		</section>
	);
}
