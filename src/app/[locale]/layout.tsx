import type { Metadata } from "next";
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

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "app" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}`,
			languages: {
				en: "/en",
				ar: "/ar",
			},
		},
	};
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

	return (
		<html
			lang={locale}
			dir={locale === "ar" ? "rtl" : "ltr"}
			className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
		>
			<body className="flex min-h-full flex-col">
				<Providers>
					<NextIntlClientProvider>{children}</NextIntlClientProvider>
				</Providers>
			</body>
		</html>
	);
}
