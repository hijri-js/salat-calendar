"use client";

/**
 * Step 2: Prayers and days (plan §6). Prayer checkboxes with per-prayer
 * transparency, an expandable "Customise" row per prayer (offset, length,
 * emoji, custom title), and day chips with presets — all bound to the
 * config store.
 */
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

import { useWizardConfig } from "@/features/wizard";
import type { Prayer, Weekday } from "@/lib/prayer-engine/types";
import { PRAYERS } from "@/lib/prayer-engine/types";

import NavButtons from "./navButtons";
import NumberField from "./numberField";

/** Language-neutral glyphs shown next to each prayer name. */
const PRAYER_EMOJI: Record<Prayer, string> = {
	fajr: "🌅",
	dhuhr: "☀️",
	asr: "🌤️",
	maghrib: "🌇",
	isha: "🌙",
};

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const SUN_THU: Weekday[] = [0, 1, 2, 3, 4];
const MON_FRI: Weekday[] = [1, 2, 3, 4, 5];

interface StepPrayersProps {
	onBack?: () => void;
	onNext?: () => void;
}

/** Shared contract bounds (schema.ts): offset −180..180, duration 5..180. */
const OFFSET_BOUNDS = { min: -180, max: 180 } as const;
const DURATION_BOUNDS = { min: 5, max: 180 } as const;

export default function StepPrayers({ onBack, onNext }: StepPrayersProps) {
	const t = useTranslations("prayers");
	const prayers = useWizardConfig((s) => s.config.prayers);
	const defaults = useWizardConfig((s) => s.config.defaults);
	const days = useWizardConfig((s) => s.config.days);
	const updatePrayer = useWizardConfig((s) => s.updatePrayer);
	const setDays = useWizardConfig((s) => s.setDays);
	const toggleDay = useWizardConfig((s) => s.toggleDay);

	return (
		<section aria-labelledby="prayers-heading" className="flex flex-col gap-4">
			<h2 id="prayers-heading" className="text-(length:--text-title)">
				{t("heading")}
			</h2>

			<ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-paper-raised">
				{PRAYERS.map((prayer) => {
					const rule = prayers[prayer];
					return (
						<li
							key={prayer}
							className={`flex flex-col gap-2 px-3 py-2.5 ${rule.enabled ? "" : "text-muted"}`}
						>
							<div className="flex flex-wrap items-center gap-3">
								<label className="flex items-center gap-2 text-sm font-medium">
									<input
										type="checkbox"
										checked={rule.enabled}
										onChange={(event) =>
											updatePrayer(prayer, { enabled: event.target.checked })
										}
									/>
									<span aria-hidden>{PRAYER_EMOJI[prayer]}</span>
									{t(`prayer.${prayer}`)}
								</label>
								<select
									aria-label={t("transparencyLabel", { prayer: t(`prayer.${prayer}`) })}
									value={rule.transparency ?? defaults.transparency}
									onChange={(event) =>
										updatePrayer(prayer, {
											transparency: event.target.value as "opaque" | "transparent",
										})
									}
									className="rounded-lg border border-line-strong px-2 py-1 text-sm"
								>
									<option value="opaque">{t("busy")}</option>
									<option value="transparent">{t("free")}</option>
								</select>
								<details className="group ms-auto">
									<summary className="inline-flex min-h-10 list-none items-center gap-1 text-sm font-medium text-accent-ink underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
										{t("customise")}
										<ChevronDown
											aria-hidden
											className="size-4 transition-transform group-open:rotate-180"
										/>
									</summary>
									<div className="mt-2 flex flex-wrap items-end gap-3 border-s-2 border-line ps-3 text-sm">
										<label className="flex flex-col gap-1">
											{t("offsetLabel")}
											<NumberField
												value={rule.offsetMin}
												bounds={OFFSET_BOUNDS}
												optional
												placeholder={String(defaults.offsetMin)}
												onCommit={(next) => updatePrayer(prayer, { offsetMin: next })}
												className="w-20 px-2 py-1"
											/>
										</label>
										<label className="flex flex-col gap-1">
											{t("durationLabel")}
											<NumberField
												value={rule.durationMin}
												bounds={DURATION_BOUNDS}
												optional
												placeholder={String(defaults.durationMin)}
												onCommit={(next) => updatePrayer(prayer, { durationMin: next })}
												className="w-20 px-2 py-1"
											/>
										</label>
										<label className="flex flex-col gap-1">
											{t("emojiLabel")}
											<input
												type="text"
												maxLength={16}
												value={rule.emoji ?? ""}
												placeholder={PRAYER_EMOJI[prayer]}
												onChange={(event) =>
													updatePrayer(prayer, {
														emoji: event.target.value || undefined,
													})
												}
												className="w-16 rounded-lg border border-line-strong px-2 py-1"
											/>
										</label>
										<label className="flex flex-col gap-1">
											{t("titleLabel")}
											<input
												type="text"
												maxLength={60}
												value={rule.title ?? ""}
												placeholder={t("titlePlaceholder")}
												onChange={(event) =>
													updatePrayer(prayer, {
														title: event.target.value || undefined,
													})
												}
												className="w-40 rounded-lg border border-line-strong px-2 py-1"
											/>
										</label>
									</div>
								</details>
							</div>
						</li>
					);
				})}
			</ul>

			<h3 className="text-lg">{t("daysHeading")}</h3>
			<div className="flex flex-wrap items-center gap-1.5">
				{ALL_DAYS.map((day) => (
					<label
						key={day}
						className="inline-flex min-h-10 min-w-12 cursor-pointer items-center justify-center rounded-full border border-line-strong px-3 text-sm has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
					>
						<input
							className="sr-only"
							type="checkbox"
							checked={days.includes(day)}
							onChange={() => toggleDay(day)}
						/>
						{t(`days.${day}`)}
					</label>
				))}
				<span className="ms-2 text-xs text-muted">{t("presetsLabel")}:</span>
				<button
					type="button"
					onClick={() => setDays([...ALL_DAYS])}
					className="inline-flex min-h-8 items-center rounded-full px-2 text-xs underline underline-offset-4 hover:bg-wash"
				>
					{t("presetAll")}
				</button>
				<button
					type="button"
					onClick={() => setDays([...SUN_THU])}
					className="inline-flex min-h-8 items-center rounded-full px-2 text-xs underline underline-offset-4 hover:bg-wash"
				>
					{t("presetSunThu")}
				</button>
				<button
					type="button"
					onClick={() => setDays([...MON_FRI])}
					className="inline-flex min-h-8 items-center rounded-full px-2 text-xs underline underline-offset-4 hover:bg-wash"
				>
					{t("presetMonFri")}
				</button>
			</div>

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
