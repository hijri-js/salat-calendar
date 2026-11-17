"use client";

/**
 * Step 1: Place (plan §6). Minimal free-text city input for now — real
 * geocoding and GPS arrive in the next slice. Also hosts the calculation
 * method and Asr school controls.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { useWizardConfig } from "@/features/wizard";

import { browserTimezone, parseCityInput } from "./cityInput";
import { CALCULATION_METHOD_IDS } from "./methods";
import { NavButtons } from "@/features/rules";

interface StepPlaceProps {
	onNext?: () => void;
}

export default function StepPlace({ onNext }: StepPlaceProps) {
	const t = useTranslations("place");
	const methodsT = useTranslations("methods");
	const location = useWizardConfig((s) => s.config.location);
	const method = useWizardConfig((s) => s.config.method);
	const school = useWizardConfig((s) => s.config.school);
	const setLocation = useWizardConfig((s) => s.setLocation);
	const setMethod = useWizardConfig((s) => s.setMethod);
	const setSchool = useWizardConfig((s) => s.setSchool);

	const [text, setText] = useState("");

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = parseCityInput(text);
		if (!parsed) {
			return;
		}
		setLocation({ ...parsed, timezone: browserTimezone() });
	};

	return (
		<section aria-labelledby="place-heading" className="flex flex-col gap-4">
			<h2 id="place-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>

			<form onSubmit={submit} className="flex flex-col gap-2">
				<label htmlFor="cityInput" className="text-sm font-medium">
					{t("cityLabel")}
				</label>
				<input
					id="cityInput"
					type="text"
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder={t("cityPlaceholder")}
					className="rounded-lg border border-black/15 px-3 py-2 dark:border-white/20"
				/>
				<p className="text-xs opacity-60">{t("cityHint")}</p>
				<button
					type="submit"
					className="w-fit rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
				>
					{t("setCity")}
				</button>
			</form>

			<dl className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15">
				<dt className="opacity-60">{t("currentPlace")}</dt>
				<dd className="font-medium">{location.label ?? t("notSet")}</dd>
				<dt className="opacity-60">{t("coordinates")}</dt>
				<dd>
					{location.latitude}, {location.longitude}
				</dd>
				<dt className="opacity-60">{t("timezoneLabel")}</dt>
				<dd>{location.timezone ?? t("notSet")}</dd>
			</dl>

			<label htmlFor="method-input" className="text-sm font-medium">
				{t("methodLabel")}
			</label>
			<select
				id="method-input"
				value={method}
				onChange={(event) => setMethod(Number(event.target.value))}
				className="rounded-lg border border-black/15 px-3 py-2 dark:border-white/20"
			>
				{CALCULATION_METHOD_IDS.map((id) => (
					<option key={id} value={id}>
						{methodsT(String(id))}
					</option>
				))}
			</select>

			<fieldset className="flex flex-col gap-1.5">
				<legend className="text-sm font-medium">{t("schoolLabel")}</legend>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="asr-school"
						value="standard"
						checked={school === "standard"}
						onChange={() => setSchool("standard")}
					/>
					{t("schoolStandard")}
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="asr-school"
						value="hanafi"
						checked={school === "hanafi"}
						onChange={() => setSchool("hanafi")}
					/>
					{t("schoolHanafi")}
				</label>
			</fieldset>

			<NavButtons onNext={onNext} />
		</section>
	);
}
