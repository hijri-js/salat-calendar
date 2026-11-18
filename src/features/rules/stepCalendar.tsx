"use client";

/**
 * Step 4: Calendar (plan §6). Title language, event colour from the Google
 * `colorId` palette, reminder, Google target, the out-of-office skip rule
 * with its keyword chips, and "replace earlier syncs" — all bound to the
 * config store.
 */
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";

import { useWizardConfig } from "@/features/wizard";

import { GOOGLE_COLORS } from "./colors";
import NavButtons from "./navButtons";

interface StepCalendarProps {
	onBack?: () => void;
	onNext?: () => void;
}

/** Reminder choices in minutes before the event (0 = none). */
const REMINDER_CHOICES = [5, 10, 15, 30] as const;

export default function StepCalendar({ onBack, onNext }: StepCalendarProps) {
	const t = useTranslations("calendar");
	const locale = useLocale();
	const config = useWizardConfig((s) => s.config);
	const setTitleLocale = useWizardConfig((s) => s.setTitleLocale);
	const setTarget = useWizardConfig((s) => s.setTarget);
	const updateOoo = useWizardConfig((s) => s.updateOoo);
	const updateDefaults = useWizardConfig((s) => s.updateDefaults);
	const setReplaceExisting = useWizardConfig((s) => s.setReplaceExisting);

	const [keyword, setKeyword] = useState("");

	const addKeyword = (event: FormEvent) => {
		event.preventDefault();
		const value = keyword.trim();
		if (value === "") {
			return;
		}
		updateOoo({ keywords: [...config.ooo.keywords, value] });
		setKeyword("");
	};

	const removeKeyword = (target: string) => {
		updateOoo({ keywords: config.ooo.keywords.filter((k) => k !== target) });
	};

	return (
		<section aria-labelledby="calendar-heading" className="flex flex-col gap-4">
			<h2 id="calendar-heading" className="text-(length:--text-title)">
				{t("heading")}
			</h2>

			<fieldset className="flex items-center gap-4 text-sm">
				<legend className="font-medium">{t("titleLocaleLabel")}</legend>
				<label className="flex items-center gap-1.5">
					<input
						type="radio"
						name="title-locale"
						checked={config.titleLocale === "en"}
						onChange={() => setTitleLocale("en")}
					/>
					{t("titleLocaleEn")}
				</label>
				<label className="flex items-center gap-1.5">
					<input
						type="radio"
						name="title-locale"
						checked={config.titleLocale === "ar"}
						onChange={() => setTitleLocale("ar")}
					/>
					{t("titleLocaleAr")}
				</label>
			</fieldset>

			<div className="flex flex-wrap gap-4">
				<label className="flex flex-col gap-1 text-sm">
					{t("colourLabel")}
					<select
						value={config.defaults.colorId ?? ""}
						onChange={(event) =>
							updateDefaults({
								colorId: event.target.value === "" ? undefined : event.target.value,
							})
						}
						className="rounded-lg border border-line-strong px-2 py-1.5"
					>
						<option value="">{t("colourDefault")}</option>
						{GOOGLE_COLORS.map((color) => (
							<option key={color.id} value={color.id}>
								{locale === "ar" ? color.ar : color.en}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1 text-sm">
					{t("reminderLabel")}
					<select
						value={config.defaults.reminderMin ?? 0}
						onChange={(event) =>
							updateDefaults({
								reminderMin: Number(event.target.value) || undefined,
							})
						}
						className="rounded-lg border border-line-strong px-2 py-1.5"
					>
						<option value={0}>{t("reminderNone")}</option>
						{REMINDER_CHOICES.map((minutes) => (
							<option key={minutes} value={minutes}>
								{t("reminderMinutes", { count: minutes, countLatin: String(minutes) })}
							</option>
						))}
					</select>
				</label>
			</div>

			<h3 className="text-lg">{t("googleHeading")}</h3>
			<fieldset className="flex flex-col gap-1.5 text-sm">
				<legend className="font-medium">{t("targetLabel")}</legend>
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="target"
						checked={config.target.kind === "dedicated"}
						onChange={() => setTarget({ kind: "dedicated" })}
					/>
					{t("targetDedicated")}
					<em className="text-muted">({t("recommended")})</em>
				</label>
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="target"
						checked={config.target.kind === "primary"}
						onChange={() => setTarget({ kind: "primary" })}
					/>
					{t("targetPrimary")}
					<em className="text-muted">({t("extraPermission")})</em>
				</label>
			</fieldset>

			<label className="flex items-center gap-2 text-sm font-medium">
				<input
					type="checkbox"
					checked={config.ooo.enabled}
					onChange={(event) => updateOoo({ enabled: event.target.checked })}
				/>
				{t("oooLabel")}
			</label>
			<p className="ps-6 text-sm text-muted">{t("oooHint")}</p>
			<ul className="flex flex-wrap gap-1.5 ps-6">
				{config.ooo.keywords.map((keywordItem) => (
					<li
						key={keywordItem}
						className="flex items-center gap-1 rounded-full border border-line bg-paper-raised py-0.5 pe-1 ps-3 text-sm"
					>
						{keywordItem}
						<button
							type="button"
							aria-label={t("removeKeyword", { keyword: keywordItem })}
							onClick={() => removeKeyword(keywordItem)}
							className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-ink"
						>
							<X aria-hidden className="size-3.5" />
						</button>
					</li>
				))}
			</ul>
			<form onSubmit={addKeyword} className="flex items-center gap-2 ps-6">
				<input
					type="text"
					value={keyword}
					onChange={(event) => setKeyword(event.target.value)}
					placeholder={t("keywordPlaceholder")}
					className="rounded-lg border border-line-strong px-2 py-1.5 text-sm"
				/>
				<button
					type="submit"
					className="btn"
				>
					{t("addKeyword")}
				</button>
			</form>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={config.replaceExisting}
					onChange={(event) => setReplaceExisting(event.target.checked)}
				/>
				{t("replaceLabel")}
			</label>

			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
