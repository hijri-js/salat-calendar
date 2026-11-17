"use client";

/**
 * Step 5: Preview shell (plan §6). The 7-day week grid arrives with the
 * preview wiring in the next slice; this renders the heading only.
 */
import { useTranslations } from "next-intl";

import { NavButtons } from "@/features/rules";

interface StepPreviewProps {
	onBack?: () => void;
	onNext?: () => void;
}

export default function StepPreview({ onBack, onNext }: StepPreviewProps) {
	const t = useTranslations("preview");

	return (
		<section aria-labelledby="preview-heading" className="flex flex-col gap-4">
			<h2 id="preview-heading" className="text-xl font-semibold">
				{t("heading")}
			</h2>
			<p className="rounded-xl border border-dashed border-black/15 p-6 text-sm opacity-70 dark:border-white/20">
				{t("placeholder")}
			</p>
			<NavButtons onBack={onBack} onNext={onNext} />
		</section>
	);
}
