import { getTranslations } from "next-intl/server";

/** Rendered inside the locale layout for invalid routes. */
export default async function NotFoundPage() {
	const t = await getTranslations("notFound");
	return (
		<main className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
			<h1 className="text-2xl font-bold">{t("title")}</h1>
			<p className="text-sm opacity-70">{t("body")}</p>
		</main>
	);
}
