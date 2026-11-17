"use client";

/**
 * Step 2: Prayers and days (plan §6). Prayer checkboxes with per-prayer
 * transparency, day checkboxes with presets, all bound to the store.
 */
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";
import { PRAYERS, type Prayer, type Weekday } from "@/lib/prayer-engine/types";

import NavButtons from "./navButtons";

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
			<h2 id="prayers-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>

			<ul className="flex flex-col gap-2">
				{PRAYERS.map((prayer) => {
					const rule = prayers[prayer];
					return (
						<li
							key={prayer}
							className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15"
						>
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
								aria-label={t(`prayer.${prayer}`)}
								value={rule.transparency ?? defaults.transparency}
								onChange={(event) =>
									updatePrayer(prayer, {
										transparency: event.target.value as "opaque" | "transparent",
									})
								}
								className="rounded-lg border border-black/15 px-2 py-1 text-sm dark:border-white/20"
							>
								<option value="opaque">{t("busy")}</option>
								<option value="transparent">{t("free")}</option>
							</select>
						</li>
					);
				})}
			</ul>

			<h3 className="text-lg font-semibold">{t("daysHeading")}</h3>
			<div className="flex flex-wrap items-center gap-1.5">
				{ALL_DAYS.map((day) => (
					<label
						key={day}
						className="flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-sm dark:border-white/15"
					>
						<input
							type="checkbox"
							checked={days.includes(day)}
							onChange={() => toggleDay(day)}
						/>
						{t(`days.${day}`)}
					</label>
				))}
				<span className="ms-2 text-xs opacity-60">{t("presetsLabel")}:</span>
				<button
					type="button"
					onClick={() => setDays(ALL_DAYS)}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetAll")}
				</button>
				<button
					type="button"
					onClick={() => setDays(SUN_THU)}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetSunThu")}
				</button>
				<button
					type="button"
					onClick={() => setDays(MON_FRI)}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetMonFri")}
				</button>
			</div>

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
