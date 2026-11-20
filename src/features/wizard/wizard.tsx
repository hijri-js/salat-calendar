"use client";

/**
 * The wizard shell (plan §6): header with the language switcher and GitHub
 * link, the freely clickable stepper, the active step, and the always
 * visible mini preview. Only the place is required; every other step is
 * pre-filled with working defaults.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MiniPreview, StepPreview } from "@/features/preview";
import { StepPlace } from "@/features/location";
import { StepCalendar, StepPrayers, StepTiming } from "@/features/rules";
import { Link } from "@/i18n/navigation";
import type { TitleLocale } from "@/lib/prayer-engine/types";

import GetIt from "./getIt";
import LanguageSwitcher from "./languageSwitcher";
import { selectPlaceSet, useWizardConfig } from "./configStore";
import Stepper from "./stepper";
import type { WizardStep } from "./steps";

const GITHUB_URL = "https://github.com/hijri-js/salat-calendar";

/** The brand mark: the sun's arc over a horizon, the thing the app tracks. */
function SunArc() {
	return (
		<svg aria-hidden viewBox="0 0 32 20" className="h-5 w-8 text-accent" fill="none">
			<path
				d="M3 17a13 13 0 0 1 26 0"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeDasharray="2 2.5"
			/>
			<circle cx="22.5" cy="6.6" r="3" fill="currentColor" />
			<path d="M1 17.5h30" stroke="var(--ink)" strokeWidth="1.5" />
		</svg>
	);
}

export default function Wizard() {
	const t = useTranslations();
	const locale = useLocale() as TitleLocale;
	const [active, setActive] = useState<WizardStep>("place");
	const placeSet = useWizardConfig(selectPlaceSet);
	const adoptUiLocale = useWizardConfig((s) => s.adoptUiLocale);

	const reset = useWizardConfig((s) => s.reset);

	// Load saved settings after mount (the server cannot read localStorage),
	// then let titles follow the UI language unless the user chose one.
	// Effects run in order, so the saved choice is in place first.
	useEffect(() => {
		void useWizardConfig.persist.rehydrate();
	}, []);

	// Event titles follow the UI language by default (Arabic UI → Arabic titles).
	useEffect(() => {
		adoptUiLocale(locale);
	}, [adoptUiLocale, locale]);

	const problems = placeSet ? undefined : { place: t("validity.pickACity") };

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
			<header className="flex items-center justify-between gap-3 border-b border-line pb-4">
				<Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
					<SunArc />
					<span dir="ltr">{t("app.name")}</span>
				</Link>
				<div className="flex items-center gap-2 text-sm">
					<LanguageSwitcher />
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="touch-target inline-flex min-h-10 items-center px-2 text-muted underline-offset-4 hover:text-ink hover:underline"
					>
						{t("header.github")}
					</a>
				</div>
			</header>

			<div className="flex flex-col gap-5">
				<h1 className="max-w-[22ch] text-(length:--text-display) leading-[1.1]">
					{t("app.tagline")}
				</h1>
				<Stepper active={active} onSelect={setActive} problems={problems} />
				<p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
					{t("settings.saved")}
					<button
						type="button"
						onClick={() => {
							reset();
							setActive("place");
						}}
						className="touch-target min-h-8 font-medium text-ink underline underline-offset-4"
					>
						{t("settings.reset")}
					</button>
				</p>
			</div>

			<div className="flex flex-1 flex-col gap-8 lg:flex-row lg:items-start">
				<main className="min-w-0 flex-1">
					{active === "place" ? <StepPlace onNext={() => setActive("prayers")} /> : null}
					{active === "prayers" ? (
						<StepPrayers
							onBack={() => setActive("place")}
							onNext={() => setActive("timing")}
						/>
					) : null}
					{active === "timing" ? (
						<StepTiming
							onBack={() => setActive("prayers")}
							onNext={() => setActive("calendar")}
						/>
					) : null}
					{active === "calendar" ? (
						<StepCalendar
							onBack={() => setActive("timing")}
							onNext={() => setActive("preview")}
						/>
					) : null}
					{active === "preview" ? (
						<StepPreview
							onBack={() => setActive("calendar")}
							onNext={() => setActive("getIt")}
						/>
					) : null}
					{active === "getIt" ? <GetIt onBack={() => setActive("preview")} /> : null}
				</main>
				<aside className="w-full shrink-0 lg:w-72">
					<MiniPreview />
				</aside>
			</div>
		</div>
	);
}
