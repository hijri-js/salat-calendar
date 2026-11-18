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

	const finish = () => {
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
			inputMode="numeric"
			step={1}
			min={bounds.min}
			max={bounds.max}
			value={draft ?? (value === undefined ? "" : String(value))}
			onChange={(event) => {
				const raw = event.target.value;
				setDraft(raw);
				const live = liveValue(raw, bounds, optional);
				if (live !== "skip" && live !== value) {
					onCommit(live);
				}
			}}
			onBlur={(event) => {
				finish();
				onBlur?.(event);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					finish();
				}
				onKeyDown?.(event);
			}}
		/>
	);
}
