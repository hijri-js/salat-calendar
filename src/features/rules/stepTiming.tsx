"use client";

/**
 * Step 3: Timing (plan §6). Global offset/length defaults, the rounding
 * grid, the booking window, and the four Friday (Jummah) modes — all bound
 * to the store.
 */
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";

import NavButtons from "./navButtons";

interface StepTimingProps {
	onBack?: () => void;
	onNext?: () => void;
}

/** "480" → "08:00". */
function minToTime(min: number): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "08:00" → 480; keeps the old value when the field is emptied. */
function timeToMin(value: string, fallback: number): number {
	const [h, m] = value.split(":").map(Number);
	if (!Number.isFinite(h) || !Number.isFinite(m)) {
		return fallback;
	}
	return h * 60 + m;
}

/** Keeps NaN out of the store while a number field is being edited. */
function toInt(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

export default function StepTiming({ onBack, onNext }: StepTimingProps) {
	const t = useTranslations("timing");
	const defaults = useWizardConfig((s) => s.config.defaults);
	const rounding = useWizardConfig((s) => s.config.rounding);
	const window = useWizardConfig((s) => s.config.window);
	const jummah = useWizardConfig((s) => s.config.jummah);
	const updateDefaults = useWizardConfig((s) => s.updateDefaults);
	const updateRounding = useWizardConfig((s) => s.updateRounding);
	const setWindow = useWizardConfig((s) => s.setWindow);
	const updateJummah = useWizardConfig((s) => s.updateJummah);

	const windowOn = window !== undefined;
	const startMin = window?.startMin ?? 8 * 60;
	const endMin = window?.endMin ?? 16 * 60;

	return (
		<section aria-labelledby="timing-heading" className="flex flex-col gap-4">
			<h2 id="timing-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>

			<div className="flex flex-wrap items-end gap-4">
				<label className="flex flex-col gap-1 text-sm">
					{t("offsetLabel")}
					<input
						type="number"
						value={defaults.offsetMin}
						onChange={(event) =>
							updateDefaults({
								offsetMin: toInt(event.target.valueAsNumber, defaults.offsetMin),
							})
						}
						className="w-24 rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20"
					/>
				</label>
				<label className="flex flex-col gap-1 text-sm">
					{t("durationLabel")}
					<input
						type="number"
						value={defaults.durationMin}
						onChange={(event) =>
							updateDefaults({
								durationMin: toInt(event.target.valueAsNumber, defaults.durationMin),
							})
						}
						className="w-24 rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20"
					/>
				</label>
			</div>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={rounding.grid !== "off"}
					onChange={(event) =>
						updateRounding({ grid: event.target.checked ? 5 : "off" })
					}
				/>
				{t("roundingLabel")}
			</label>
			{rounding.grid !== "off" ? (
				<div className="flex flex-col gap-2 ps-6">
					<fieldset className="flex items-center gap-4 text-sm">
						<legend className="sr-only">{t("gridLabel")}</legend>
						<label className="flex items-center gap-1.5">
							<input
								type="radio"
								name="rounding-grid"
								checked={rounding.grid === 5}
								onChange={() => updateRounding({ grid: 5 })}
							/>
							{t("grid5")}
						</label>
						<label className="flex items-center gap-1.5">
							<input
								type="radio"
								name="rounding-grid"
								checked={rounding.grid === 10}
								onChange={() => updateRounding({ grid: 10 })}
							/>
							{t("grid10")}
						</label>
					</fieldset>
					<fieldset className="flex items-center gap-4 text-sm">
						<legend className="sr-only">{t("directionLabel")}</legend>
						{(["nearest", "up", "down"] as const).map((direction) => (
							<label key={direction} className="flex items-center gap-1.5">
								<input
									type="radio"
									name="rounding-direction"
									checked={rounding.direction === direction}
									onChange={() => updateRounding({ direction })}
								/>
								{t(direction)}
							</label>
						))}
					</fieldset>
				</div>
			) : null}

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={windowOn}
					onChange={(event) =>
						setWindow(event.target.checked ? { startMin, endMin } : null)
					}
				/>
				{t("windowLabel")}
			</label>
			{windowOn ? (
				<div className="flex flex-wrap items-center gap-2 ps-6 text-sm">
					<label className="flex items-center gap-1.5">
						{t("windowFrom")}
						<input
							type="time"
							value={minToTime(startMin)}
							onChange={(event) =>
								setWindow({
									startMin: timeToMin(event.target.value, startMin),
									endMin,
								})
							}
							className="rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20"
						/>
					</label>
					<label className="flex items-center gap-1.5">
						{t("windowTo")}
						<input
							type="time"
							value={minToTime(endMin)}
							onChange={(event) =>
								setWindow({
									startMin,
									endMin: timeToMin(event.target.value, endMin),
								})
							}
							className="rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20"
						/>
					</label>
				</div>
			) : null}

			<h3 className="text-lg font-semibold">{t("jummahHeading")}</h3>
			<fieldset className="flex flex-col gap-1.5 text-sm">
				<div>
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="jummah-mode"
							checked={jummah.mode === "same"}
							onChange={() => updateJummah({ mode: "same" })}
						/>
						{t("same")}
					</label>
				</div>
				<div className="flex flex-col gap-1.5">
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="jummah-mode"
							checked={jummah.mode === "fixed"}
							onChange={() => updateJummah({ mode: "fixed" })}
						/>
						{t("fixed")}
					</label>
					{jummah.mode === "fixed" ? (
						<div className="flex items-center gap-2 ps-7">
							<label htmlFor="jummah-fixed-time" className="sr-only">
								{t("fixedTimeLabel")}
							</label>
							<input
								id="jummah-fixed-time"
								type="time"
								value={jummah.fixedTime ?? "12:30"}
								onChange={(event) =>
									updateJummah({ fixedTime: event.target.value || "12:30" })
								}
								className="rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
							/>
							<label htmlFor="jummah-fixed-duration">
								{t("jummahDurationLabel")}
							</label>
							<input
								id="jummah-fixed-duration"
								type="number"
								value={jummah.durationMin ?? 60}
								onChange={(event) =>
									updateJummah({
										durationMin: toInt(event.target.valueAsNumber, 60),
									})
								}
								className="w-20 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
							/>
						</div>
					) : null}
				</div>
				<div className="flex flex-col gap-1.5">
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="jummah-mode"
							checked={jummah.mode === "custom"}
							onChange={() => updateJummah({ mode: "custom" })}
						/>
						{t("custom")}
					</label>
					{jummah.mode === "custom" ? (
						<div className="flex items-center gap-2 ps-7">
							<label htmlFor="jummah-custom-offset">
								{t("jummahOffsetLabel")}
							</label>
							<input
								id="jummah-custom-offset"
								type="number"
								value={jummah.offsetMin ?? 0}
								onChange={(event) =>
									updateJummah({
										offsetMin: toInt(event.target.valueAsNumber, 0),
									})
								}
								className="w-20 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
							/>
							<label htmlFor="jummah-custom-duration">
								{t("jummahDurationLabel")}
							</label>
							<input
								id="jummah-custom-duration"
								type="number"
								value={jummah.durationMin ?? 45}
								onChange={(event) =>
									updateJummah({
										durationMin: toInt(event.target.valueAsNumber, 45),
									})
								}
								className="w-20 rounded-lg border border-black/15 px-2 py-1 dark:border-white/20"
							/>
						</div>
					) : null}
				</div>
				<div>
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="jummah-mode"
							checked={jummah.mode === "none"}
							onChange={() => updateJummah({ mode: "none" })}
						/>
						{t("none")}
					</label>
				</div>
			</fieldset>

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
