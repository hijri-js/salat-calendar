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

// The date only matters at mount; a tab left open past midnight keeps the
// day it opened on, like the rest of the preview.
const subscribe = () => () => {};

export function useToday(): string | null {
	return useSyncExternalStore(subscribe, todayIso, () => null);
}
