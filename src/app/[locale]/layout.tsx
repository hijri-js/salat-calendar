import { Amiri, Fraunces, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import Providers from "@/app/providers";
import "@/app/globals.css";

// One bilingual type system: Plex Sans + Plex Sans Arabic for text,
// Fraunces + Amiri for headings. next/font self-hosts them (CSP font-src 'self').
const plex = IBM_Plex_Sans({
	variable: "--font-plex",
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
	variable: "--font-plex-arabic",
	subsets: ["arabic"],
	weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
	variable: "--font-fraunces",
	subsets: ["latin"],
	axes: ["opsz", "SOFT"],
});

const amiri = Amiri({
	variable: "--font-amiri",
	subsets: ["arabic"],
	weight: ["400", "700"],
});

/**
 * The root layout must read the locale for <html lang dir>, so it cannot be
 * part of a shared instant shell. Each locale is still prerendered from
 * generateStaticParams; only the dev-time instant-navigation check is opted
 * out here (switching language is a full navigation anyway).
 */
export const instant = false;

/** Absolute origin for canonical/hreflang links (search engines need absolute URLs). */
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "app" });

	return (
		<html
			lang={locale}
			dir={locale === "ar" ? "rtl" : "ltr"}
			className={`${plex.variable} ${plexArabic.variable} ${fraunces.variable} ${amiri.variable} h-full antialiased`}
		>
			<body className="flex min-h-full flex-col">
				{/*
				  Per-locale metadata as elements; React hoists them into <head>.
				  A generateMetadata() that reads params is flagged by Partial
				  Prefetching ("URL data in generateMetadata"), and the locale is
				  already resolved here.
				*/}
				<title>{t("title")}</title>
				<meta name="description" content={t("description")} />
				<link rel="canonical" href={`${SITE_URL}/${locale}`} />
				<link rel="alternate" hrefLang="en" href={`${SITE_URL}/en`} />
				<link rel="alternate" hrefLang="ar" href={`${SITE_URL}/ar`} />
				<Providers>
					<NextIntlClientProvider>{children}</NextIntlClientProvider>
				</Providers>
			</body>
		</html>
	);
}
