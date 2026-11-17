import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

/**
 * Fallback redirect to the default locale. The middleware normally handles
 * "/" already; this covers direct requests that bypass it.
 */
export default function RootPage() {
	redirect(`/${routing.defaultLocale}`);
}
