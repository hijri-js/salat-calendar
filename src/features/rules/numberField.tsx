"use client";

/**
 * A number input that lets people type freely. The draft text stays local
 * while editing; the store gets a value only when the draft is a whole number
 * inside the shared contract's range (schema.ts). On blur or Enter, an
 * out-of-range number is clamped, and junk reverts to the last good value.
 * Before this, every keystroke was clamped: typing "15" over "20" became
 * "5" then "55".
 */
import { useState, type InputHTMLAttributes } from "react";

import { commitDraft, liveValue, type Bounds } from "./numberDraft";

interface NumberFieldProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> {
	value: number | undefined;
	bounds: Bounds;
	/** Empty means "use the default" (per-prayer overrides). */
	optional?: boolean;
	onCommit: (value: number | undefined) => void;
}

export default function NumberField({
	value,
	bounds,
	optional = false,
	onCommit,
	onBlur,
	onKeyDown,
	...rest
}: NumberFieldProps) {
	// null = not editing: show the stored value.
	const [draft, setDraft] = useState<string | null>(null);

	// Blur and Enter end an edit the same way.
	const finish = (input: HTMLInputElement) => {
		if (input.validity.badInput) {
			// Junk ("-", "1e"): keep the stored value and put it back in the field.
			input.value = value === undefined ? "" : String(value);
			setDraft(null);
			return;
		}
		if (draft === null) {
			return;
		}
		const next = commitDraft(draft, value, bounds, optional);
		if (next !== value) {
			onCommit(next);
		}
		setDraft(null);
	};

	return (
		<input
			{...rest}
			type="number"
			// iOS's numeric keypad has no minus key; signed fields keep the
			// full keyboard so offsets before the adhan can be typed.
			inputMode={bounds.min < 0 ? undefined : "numeric"}
			step={1}
			min={bounds.min}
			max={bounds.max}
			value={draft ?? (value === undefined ? "" : String(value))}
			onChange={(event) => {
				// Half-typed text ("-", "1e") reads as "" with badInput set; that
				// is not "empty", so commit nothing. The draft still has to change:
				// a controlled input whose onChange sets no state is reset to the
				// stored value, and the next digit lands after it ("15" + "-10").
				// "" equals the input's own .value here, so React leaves the
				// visible "-" alone.
				if (event.target.validity.badInput) {
					setDraft("");
					return;
				}
				const raw = event.target.value;
				setDraft(raw);
				const live = liveValue(raw, bounds, optional);
				if (live !== "skip" && live !== value) {
					onCommit(live);
				}
			}}
			onBlur={(event) => {
				finish(event.currentTarget);
				onBlur?.(event);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					finish(event.currentTarget);
				}
				onKeyDown?.(event);
			}}
		/>
	);
}
