import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

/**
 * Locale routing: redirects "/" to the default locale and prefixes /en, /ar.
 * Next 16 renamed the middleware convention to `proxy`; the next-intl
 * request handler works unchanged in that slot.
 */
export default createMiddleware(routing);

export const config = {
	// Skip API routes, Next internals and static files.
	matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
