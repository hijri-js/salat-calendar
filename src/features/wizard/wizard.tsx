"use client";

/**
 * The wizard shell (plan §6): header with the language switcher and GitHub
 * link, the freely clickable stepper, the active step, and the always
 * visible mini preview. Only the place is required; every other step is
 * pre-filled with working defaults.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { MiniPreview, StepPreview } from "@/features/preview";
import { StepPlace } from "@/features/location";
import { StepCalendar, StepPrayers, StepTiming } from "@/features/rules";
import { Link } from "@/i18n/navigation";

import GetIt from "./getIt";
import LanguageSwitcher from "./languageSwitcher";
import { selectPlaceSet, useWizardConfig } from "./configStore";
import Stepper from "./stepper";
import type { WizardStep } from "./steps";

const GITHUB_URL = "https://github.com/hijri-js/salat-calendar";

export default function Wizard() {
	const t = useTranslations();
	const [active, setActive] = useState<WizardStep>("place");
	const placeSet = useWizardConfig(selectPlaceSet);

	const problems = placeSet ? undefined : { place: t("validity.pickACity") };

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<Link
					href="/"
					className="flex items-center gap-2 text-lg font-semibold"
				>
					<span aria-hidden>🕌</span>
					{t("app.name")}
				</Link>
				<div className="flex items-center gap-4 text-sm">
					<LanguageSwitcher />
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="underline-offset-4 hover:underline"
					>
						{t("header.github")}
					</a>
				</div>
			</header>

			<Stepper active={active} onSelect={setActive} problems={problems} />

			<div className="flex flex-1 flex-col gap-6 lg:flex-row">
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
						<StepPreview onNext={() => setActive("getIt")} />
					) : null}
					{active === "getIt" ? <GetIt /> : null}
				</main>
				<aside className="w-full shrink-0 lg:w-72">
					<MiniPreview />
				</aside>
			</div>
		</div>
	);
}
