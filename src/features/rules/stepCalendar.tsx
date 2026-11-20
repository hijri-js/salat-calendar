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

import { MAX_KEYWORD_LENGTH, MAX_KEYWORDS, useWizardConfig } from "@/features/wizard";

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

	const selectedColour = GOOGLE_COLORS.find((color) => color.id === config.defaults.colorId);
	const [keyword, setKeyword] = useState("");

	const addKeyword = (event: FormEvent) => {
		event.preventDefault();
		const value = keyword.trim();
		// Same limits as the saved-settings contract; a repeat adds nothing.
		if (value === "" || config.ooo.keywords.length >= MAX_KEYWORDS || config.ooo.keywords.includes(value)) {
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

			<fieldset className="flex flex-col gap-2 text-sm">
				<legend className="mb-2">
					{t("colourLabel")}:{" "}
					{/* The chosen name is a visual echo; the checked radio already says it. */}
					<span aria-hidden className="font-medium">
						{selectedColour ? (locale === "ar" ? selectedColour.ar : selectedColour.en) : t("colourDefault")}
					</span>
				</legend>
				{/* Swatches are radios: arrow keys move between them, and each has
				    its colour name as its accessible label. */}
				<div className="flex flex-wrap gap-1.5">
					{[{ id: "", en: t("colourDefault"), ar: t("colourDefault"), hex: "" }, ...GOOGLE_COLORS].map((color) => (
						<label
							key={color.id || "default"}
							title={locale === "ar" ? color.ar : color.en}
							className="touch-target inline-flex size-9 cursor-pointer items-center justify-center rounded-full has-checked:ring-2 has-checked:ring-ink has-checked:ring-offset-2 has-checked:ring-offset-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent"
						>
							<input
								type="radio"
								name="event-colour"
								className="sr-only"
								checked={(selectedColour?.id ?? "") === color.id}
								onChange={() => updateDefaults({ colorId: color.id === "" ? undefined : color.id })}
							/>
							<span className="sr-only">{locale === "ar" ? color.ar : color.en}</span>
							<span
								aria-hidden
								className={`size-7 rounded-full ${color.hex === "" ? "border-2 border-dashed border-line-strong bg-paper" : "ring-1 ring-inset ring-black/15"}`}
								style={color.hex === "" ? undefined : { backgroundColor: color.hex }}
							/>
						</label>
					))}
				</div>
			</fieldset>

			<div className="flex flex-wrap gap-4">
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
					maxLength={MAX_KEYWORD_LENGTH}
					placeholder={t("keywordPlaceholder")}
					className="min-w-0 max-w-64 flex-1 rounded-lg border border-line-strong px-2 py-1.5 text-sm"
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
