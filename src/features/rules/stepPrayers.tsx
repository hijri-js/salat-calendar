"use client";

/**
 * Step 2: Prayers and days (plan §6). Prayer checkboxes with per-prayer
 * transparency, an expandable "Customise" row per prayer (offset, length,
 * emoji, custom title), and day chips with presets — all bound to the
 * config store.
 */
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";
import type { Prayer, Weekday } from "@/lib/prayer-engine/types";
import { PRAYERS } from "@/lib/prayer-engine/types";

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

/** Shared contract bounds (schema.ts): offset −180..180, duration 5..180. */
const OFFSET_BOUNDS = { min: -180, max: 180 } as const;
const DURATION_BOUNDS = { min: 5, max: 180 } as const;

/**
 * Keeps NaN out of the store while a number field is being edited, and
 * clamps any finite value into the shared contract's inclusive range.
 */
function toClampedInt(
	value: number,
	bounds: { min: number; max: number },
): number | undefined {
	if (!Number.isFinite(value)) {
		return undefined;
	}
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
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
							className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15"
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
									className="rounded-lg border border-black/15 px-2 py-1 text-sm dark:border-white/20"
								>
									<option value="opaque">{t("busy")}</option>
									<option value="transparent">{t("free")}</option>
								</select>
								<details className="ms-auto">
									<summary className="cursor-pointer text-sm underline-offset-4 hover:underline">
										{t("customise")}
									</summary>
									<div className="mt-2 flex flex-wrap items-end gap-3 border-s-2 border-black/10 ps-3 text-sm dark:border-white/15">
										<label className="flex flex-col gap-1">
											{t("offsetLabel")}
											<input
												type="number"
												min={OFFSET_BOUNDS.min}
												max={OFFSET_BOUNDS.max}
												step={1}
												value={rule.offsetMin ?? ""}
												placeholder={String(defaults.offsetMin)}
												onChange={(event) =>
													updatePrayer(prayer, {
														offsetMin: toClampedInt(event.target.valueAsNumber, OFFSET_BOUNDS),
													})
												}
												className="w-20 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
											/>
										</label>
										<label className="flex flex-col gap-1">
											{t("durationLabel")}
											<input
												type="number"
												min={DURATION_BOUNDS.min}
												max={DURATION_BOUNDS.max}
												step={1}
												value={rule.durationMin ?? ""}
												placeholder={String(defaults.durationMin)}
												onChange={(event) =>
													updatePrayer(prayer, {
														durationMin: toClampedInt(event.target.valueAsNumber, DURATION_BOUNDS),
													})
												}
												className="w-20 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
											/>
										</label>
										<label className="flex flex-col gap-1">
											{t("emojiLabel")}
											<input
												type="text"
												maxLength={4}
												value={rule.emoji ?? ""}
												placeholder={PRAYER_EMOJI[prayer]}
												onChange={(event) =>
													updatePrayer(prayer, {
														emoji: event.target.value || undefined,
													})
												}
												className="w-16 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
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
												className="w-40 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
											/>
										</label>
									</div>
								</details>
							</div>
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
					onClick={() => setDays([...ALL_DAYS])}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetAll")}
				</button>
				<button
					type="button"
					onClick={() => setDays([...SUN_THU])}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetSunThu")}
				</button>
				<button
					type="button"
					onClick={() => setDays([...MON_FRI])}
					className="rounded-full px-2 py-1 text-xs underline underline-offset-4"
				>
					{t("presetMonFri")}
				</button>
			</div>

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
