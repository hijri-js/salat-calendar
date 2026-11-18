"use client";

/**
 * The wizard stepper: six steps, freely clickable in any order (plan §6).
 * A step with missing required input shows a small amber dot and its
 * problem as text (visible on hover via `title`, read by screen readers).
 * On narrow screens only the active step keeps its name; the others show
 * their number, so the row never wraps into a wall of pills.
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
	const activeIndex = WIZARD_STEPS.indexOf(active);

	return (
		<nav aria-label={t("label")} className="flex flex-col gap-2">
			<ol className="flex items-center gap-1 sm:gap-1.5">
				{WIZARD_STEPS.map((step, index) => {
					const problem = problems?.[step];
					const isActive = step === active;
					const isDone = index < activeIndex;
					return (
						<li key={step} className={isActive ? "min-w-0" : "flex-none"}>
							<button
								type="button"
								onClick={() => onSelect(step)}
								aria-current={isActive ? "step" : undefined}
								title={problem}
								className={`flex min-h-10 items-center gap-2 rounded-full border px-2 text-sm transition-colors sm:px-3 ${
									isActive
										? "border-ink bg-ink font-medium text-paper"
										: "border-line text-ink hover:border-line-strong hover:bg-wash"
								}`}
							>
								<span
									aria-hidden
									className={`inline-flex size-6 flex-none items-center justify-center rounded-full text-xs tabular-nums ${
										isActive
											? "bg-accent text-ink"
											: isDone
												? "bg-ink/10"
												: "border border-line-strong"
									}`}
								>
									{index + 1}
								</span>
								<span className={isActive ? "truncate" : "sr-only md:not-sr-only"}>
									{t(`steps.${step}`)}
								</span>
								{problem ? (
									<>
										<span aria-hidden className="size-2 flex-none rounded-full bg-warn" />
										<span className="sr-only">{problem}</span>
									</>
								) : null}
							</button>
						</li>
					);
				})}
			</ol>
			<p className="text-xs text-muted md:hidden" aria-hidden>
				{t("stepOf", { current: activeIndex + 1, total: WIZARD_STEPS.length })}
			</p>
		</nav>
	);
}
