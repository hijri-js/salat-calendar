"use client";

/**
 * Step 2: Prayers and days (plan §6). A table of the five prayers: an
 * include checkbox (untick = no events at all), Busy/Free, and a
 * "Customise" panel per prayer (offset, length, emoji, custom title); then
 * day chips with presets. All bound to the config store.
 */
import { useState } from "react";
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
	const [open, setOpen] = useState<Record<Prayer, boolean>>({
		fajr: false,
		dhuhr: false,
		asr: false,
		maghrib: false,
		isha: false,
	});

	return (
		<section aria-labelledby="prayers-heading" className="flex flex-col gap-4">
			<h2 id="prayers-heading" className="text-(length:--text-title)">
				{t("heading")}
			</h2>

			<p className="text-sm text-muted">{t("hint")}</p>

			{/* One grid for the whole list: every row is a subgrid, so the
			    columns line up like a table whatever the names or open panels.
			    The header row is visual only; each control has its own label. */}
			<ul role="list" className="@container grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-xl border border-line bg-paper-raised">
				<li
					aria-hidden
					className="col-span-full grid grid-cols-subgrid border-b border-line px-3 py-2 text-xs font-medium text-muted"
				>
					<span>{t("colInclude")}</span>
					<span>{t("colPrayer")}</span>
					<span>{t("colShowAs")}</span>
					<span />
				</li>
				{PRAYERS.map((prayer) => {
					const rule = prayers[prayer];
					const name = t(`prayer.${prayer}`);
					const checkboxId = `prayer-${prayer}-enabled`;
					const panelId = `prayer-${prayer}-customise`;
					const isOpen = open[prayer];
					return (
						<li
							key={prayer}
							className={`col-span-full grid grid-cols-subgrid items-center border-b border-line px-3 py-1.5 last:border-b-0 ${rule.enabled ? "" : "text-muted"}`}
						>
							<input
								id={checkboxId}
								type="checkbox"
								checked={rule.enabled}
								onChange={(event) => updatePrayer(prayer, { enabled: event.target.checked })}
								className="size-4 justify-self-center"
							/>
							<label htmlFor={checkboxId} className="touch-tall flex min-h-10 min-w-0 cursor-pointer items-center gap-2 text-sm font-medium">
								<span aria-hidden>{PRAYER_EMOJI[prayer]}</span>
								<span className="truncate">{name}</span>
							</label>
							<select
								aria-label={t("transparencyLabel", { prayer: name })}
								value={rule.transparency ?? defaults.transparency}
								disabled={!rule.enabled}
								onChange={(event) =>
									updatePrayer(prayer, {
										transparency: event.target.value as "opaque" | "transparent",
									})
								}
								className="rounded-lg border border-line-strong px-2 py-1 text-sm disabled:opacity-50"
							>
								<option value="opaque">{t("busy")}</option>
								<option value="transparent">{t("free")}</option>
							</select>
							<button
								type="button"
								aria-expanded={isOpen}
								aria-controls={panelId}
								aria-label={t("customiseFor", { prayer: name })}
								onClick={() => setOpen((current) => ({ ...current, [prayer]: !current[prayer] }))}
								className="touch-target inline-flex min-h-10 items-center justify-end gap-1 text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
							>
								<span className="@max-[22rem]:sr-only">{t("customise")}</span>
								<ChevronDown
									aria-hidden
									className={`size-4 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
								/>
							</button>
							{isOpen ? (
								<div
									id={panelId}
									className="col-span-full mb-2 mt-1 flex flex-wrap items-end gap-3 border-s-2 border-line ps-3 text-sm"
								>
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
									<label className="flex min-w-0 flex-col gap-1">
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
											className="w-40 max-w-full rounded-lg border border-line-strong px-2 py-1"
										/>
									</label>
								</div>
							) : null}
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
