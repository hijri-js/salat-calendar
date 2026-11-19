"use client";

/**
 * Today's "YYYY-MM-DD" in the device's timezone, read only in the browser.
 *
 * Cache Components prerenders the page shell, and reading the clock during
 * prerender fails the build ("client rendering was requested outside a
 * Suspense boundary"). The server snapshot is `null`, so the shell renders
 * a loading state; the browser swaps in the real date while hydrating,
 * without a hydration mismatch.
 */
import { useSyncExternalStore } from "react";

import { todayIso } from "./week";

// Read once per page load: a tab left open past midnight keeps the day it
// opened on, so the side preview and the week view never disagree.
let today: string | null = null;
const readToday = () => (today ??= todayIso());
const subscribe = () => () => {};

export function useToday(): string | null {
	return useSyncExternalStore(subscribe, readToday, () => null);
}
