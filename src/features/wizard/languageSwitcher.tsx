"use client";

/**
 * EN | ع switcher: links between /en and /ar on the current page. The labels
 * are language endonyms, not translatable UI strings. Each target is at
 * least 40×40 px (WCAG 2.5.8 asks for 24).
 */
import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const ENDONYMS: Record<(typeof routing.locales)[number], { label: string; name: string }> = {
	en: { label: "EN", name: "English" },
	ar: { label: "ع", name: "العربية" },
};

export default function LanguageSwitcher() {
	const locale = useLocale();
	const pathname = usePathname();

	return (
		<div className="flex items-center rounded-full border border-line p-0.5 text-sm">
			{routing.locales.map((target) => {
				const current = target === locale;
				return (
					<Link
						key={target}
						href={pathname}
						locale={target}
						hrefLang={target}
						lang={target}
						aria-label={ENDONYMS[target].name}
						aria-current={current ? "true" : undefined}
						className={`inline-flex min-h-9 min-w-10 items-center justify-center rounded-full px-2 ${
							current ? "bg-ink font-semibold text-paper" : "text-muted hover:text-ink"
						}`}
					>
						{ENDONYMS[target].label}
					</Link>
				);
			})}
		</div>
	);
}
