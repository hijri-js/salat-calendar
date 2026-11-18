import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// next-intl picks up src/i18n/request.ts by convention.
const withNextIntl = createNextIntlPlugin();

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy without nonces (Next.js CSP guide, "Without
 * Nonces"): nonces force every page to render per request, which would turn
 * off the static shell from `cacheComponents`. So inline scripts are allowed
 * for now. Before PR 7 handles Google tokens, tighten `script-src` (nonces or
 * experimental SRI hashes) and add Google's sign-in origins.
 * Dev needs 'unsafe-eval' (React error overlays); production does not.
 */
const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' blob: data:",
	"font-src 'self'",
	// The city search runs in the browser against Open-Meteo (plan §2).
	"connect-src 'self' https://geocoding-api.open-meteo.com",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: csp },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Frame-Options", value: "DENY" },
	// Geolocation stays allowed for this origin ("Use my location").
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
	poweredByHeader: false,
	async headers() {
		return [{ source: "/(.*)", headers: securityHeaders }];
	},
	cacheComponents: true,
	partialPrefetching: true,
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
		},
	},
};

export default withNextIntl(nextConfig);
