"use client";

/**
 * EN | ع switcher: links between /en and /ar on the current page. The labels
 * are language endonyms, not translatable UI strings.
 */
import { Fragment } from "react";
import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const ENDONYMS: Record<(typeof routing.locales)[number], string> = {
	en: "EN",
	ar: "ع",
};

export default function LanguageSwitcher() {
	const locale = useLocale();
	const pathname = usePathname();

	return (
		<div className="flex items-center gap-1 text-sm">
			{routing.locales.map((target, index) => (
				<Fragment key={target}>
					{index > 0 ? (
						<span aria-hidden className="opacity-50">
							|
						</span>
					) : null}
					<Link
						href={pathname}
						locale={target}
						aria-current={target === locale ? "true" : undefined}
						className={
							target === locale
								? "font-semibold"
								: "opacity-60 hover:opacity-100"
						}
					>
						{ENDONYMS[target]}
					</Link>
				</Fragment>
			))}
		</div>
	);
}
