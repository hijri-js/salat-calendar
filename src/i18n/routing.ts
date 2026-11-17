import { defineRouting } from "next-intl/routing";

/** Locale routing for next-intl: /en and /ar, English as the default. */
export const routing = defineRouting({
	locales: ["en", "ar"],
	defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
