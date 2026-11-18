/**
 * Pure rules behind NumberField: what a half-typed draft means for the store.
 * No React, so they are unit-tested directly.
 */
export interface Bounds {
	min: number;
	max: number;
}

function parseWhole(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === "" || !/^[-+]?\d+(\.\d+)?$/.test(trimmed)) {
		return null;
	}
	return Number(trimmed);
}

/**
 * While typing: a whole number inside the bounds is committed at once (the
 * preview updates live); an empty optional field means "use the default";
 * anything else (e.g. "-", "1" on the way to "15" when min is 5) waits.
 */
export function liveValue(raw: string, bounds: Bounds, optional: boolean): number | undefined | "skip" {
	if (raw.trim() === "") {
		return optional ? undefined : "skip";
	}
	const n = parseWhole(raw);
	if (n === null || !Number.isInteger(n) || n < bounds.min || n > bounds.max) {
		return "skip";
	}
	return n;
}

/**
 * On blur or Enter: clamp a finite number into the bounds (rounded), keep
 * the previous value for junk, and clear an optional field to "default".
 */
export function commitDraft(
	raw: string,
	previous: number | undefined,
	bounds: Bounds,
	optional: boolean,
): number | undefined {
	if (raw.trim() === "") {
		return optional ? undefined : previous;
	}
	const n = parseWhole(raw);
	if (n === null) {
		return previous;
	}
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(n)));
}
