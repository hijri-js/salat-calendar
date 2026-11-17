/**
 * Root layout: a pass-through only. The real <html> element lives in
 * src/app/[locale]/layout.tsx, where the locale (lang, dir, fonts) is known.
 * All pages are routed through [locale]; middleware sends "/" there.
 */
export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
