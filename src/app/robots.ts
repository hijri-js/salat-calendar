import type { MetadataRoute } from "next";

/** Everything is public; the API is not for crawlers. */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/", disallow: "/api/" },
	};
}
