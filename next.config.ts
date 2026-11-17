import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// next-intl picks up src/i18n/request.ts by convention.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
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
