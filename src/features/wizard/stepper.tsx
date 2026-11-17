"use client";

/**
 * The wizard stepper: six steps, freely clickable in any order (plan §6).
 * A step with missing required input shows a small mark ("●") whose tooltip
 * explains what is missing. Today only Place can have a problem.
 */
import { useTranslations } from "next-intl";

import { WIZARD_STEPS, type WizardStep } from "./steps";

interface StepperProps {
	active: WizardStep;
	onSelect: (step: WizardStep) => void;
	/** Step id → human-readable problem, e.g. "pick a city". */
	problems?: Partial<Record<WizardStep, string>>;
}

export default function Stepper({ active, onSelect, problems }: StepperProps) {
	const t = useTranslations("stepper");

	return (
		<nav aria-label={t("label")}>
			<ol className="flex flex-wrap items-center gap-1.5">
				{WIZARD_STEPS.map((step, index) => {
					const problem = problems?.[step];
					const isActive = step === active;
					return (
						<li key={step}>
							<button
								type="button"
								onClick={() => onSelect(step)}
								aria-current={isActive ? "step" : undefined}
								title={problem}
								className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
									isActive
										? "bg-foreground text-background font-medium"
										: "hover:bg-black/5 dark:hover:bg-white/10"
								}`}
							>
								<span
									aria-hidden
									className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs"
								>
									{index + 1}
								</span>
								{t(`steps.${step}`)}
								{problem ? (
									<>
										<span aria-hidden className="text-amber-600">
											●
										</span>
										<span className="sr-only">{problem}</span>
									</>
								) : null}
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
