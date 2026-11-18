import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import Providers from "@/app/providers";
import "../globals.css";

// Geist for Latin text, Cairo covers Arabic (with a matching Latin set).
const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const cairo = Cairo({
	variable: "--font-cairo",
	subsets: ["arabic", "latin"],
});

/**
 * The root layout must read the locale for <html lang dir>, so it cannot be
 * part of a shared instant shell. Each locale is still prerendered from
 * generateStaticParams; only the dev-time instant-navigation check is opted
 * out here (switching language is a full navigation anyway).
 */
export const instant = false;

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
			className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
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
				<link rel="canonical" href={`/${locale}`} />
				<link rel="alternate" hrefLang="en" href="/en" />
				<link rel="alternate" hrefLang="ar" href="/ar" />
				<Providers>
					<NextIntlClientProvider>{children}</NextIntlClientProvider>
				</Providers>
			</body>
		</html>
	);
}
