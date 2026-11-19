"use client";

/**
 * Shared Back / Next footer used by the step shells. Next is the one
 * primary action; Back is quiet. Chevrons point the reading direction, so
 * they mirror in Arabic.
 */
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NavButtonsProps {
	onBack?: () => void;
	onNext?: () => void;
}

export default function NavButtons({ onBack, onNext }: NavButtonsProps) {
	const t = useTranslations("common");

	return (
		<div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-5">
			{onBack ? (
				<button type="button" onClick={onBack} className="btn">
					<ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
					{t("back")}
				</button>
			) : (
				<span />
			)}
			{onNext ? (
				<button type="button" onClick={onNext} className="btn btn-primary">
					{t("next")}
					<ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
				</button>
			) : null}
		</div>
	);
}
