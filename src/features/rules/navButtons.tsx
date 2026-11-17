"use client";

/** Shared Back / Next footer used by the step shells. */
import { useTranslations } from "next-intl";

interface NavButtonsProps {
	onBack?: () => void;
	onNext?: () => void;
}

export default function NavButtons({ onBack, onNext }: NavButtonsProps) {
	const t = useTranslations("common");

	return (
		<div className="flex justify-end gap-2">
			{onBack ? (
				<button
					type="button"
					onClick={onBack}
					className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium dark:border-white/15"
				>
					{t("back")}
				</button>
			) : null}
			{onNext ? (
				<button
					type="button"
					onClick={onNext}
					className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium dark:border-white/15"
				>
					{t("next")}
				</button>
			) : null}
		</div>
	);
}
