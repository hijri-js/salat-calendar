"use client";

/**
 * Step 1: Place (plan §6) — fully functional: debounced city type-ahead
 * (keyboard-navigable listbox, aria-combobox pattern), "Use my location"
 * GPS button, calculation-method select with the suggested method for the
 * chosen country first, and the Asr school radios — all writing to the
 * wizard config store.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";

import { useWizardConfig } from "@/features/wizard";
import type { AsrSchool } from "@/lib/prayer-engine/types";

import {
	CALCULATION_METHOD_IDS,
	methodName,
	suggestMethod,
	type CalculationMethodId,
} from "./methods";
import type { CityResult } from "./geocoding";
import { useCitySearch } from "./useCitySearch";
import { useGeolocation } from "./useGeolocation";
import { NavButtons } from "@/features/rules";

interface StepPlaceProps {
	onNext?: () => void;
}

/** Suggested method first, then the remaining ids in their natural order. */
function orderedMethodIds(suggested: CalculationMethodId | null): CalculationMethodId[] {
	if (suggested === null) {
		return [...CALCULATION_METHOD_IDS];
	}
	return [suggested, ...CALCULATION_METHOD_IDS.filter((id) => id !== suggested)];
}

export default function StepPlace({ onNext }: StepPlaceProps) {
	const t = useTranslations("place");
	const locale = useLocale();
	const location = useWizardConfig((s) => s.config.location);
	const method = useWizardConfig((s) => s.config.method);
	const school = useWizardConfig((s) => s.config.school);
	const setLocation = useWizardConfig((s) => s.setLocation);
	const setMethod = useWizardConfig((s) => s.setMethod);
	const applySuggestedMethod = useWizardConfig((s) => s.suggestMethod);
	const setSchool = useWizardConfig((s) => s.setSchool);

	const listId = useId();
	const inputId = useId();

	const [query, setQuery] = useState("");
	const [highlighted, setHighlighted] = useState(0);
	const [open, setOpen] = useState(false);
	// The country of the chosen city, for the "suggested for …" hint. Kept
	// outside the store because `Location` has no country field.
	const [chosenCountry, setChosenCountry] = useState<{
		code: string;
		name: string;
	} | null>(null);
	// True once the device GPS flow set the place (device timezone hint).
	const [usedGps, setUsedGps] = useState(false);

	const { results, loading, error } = useCitySearch(query, locale as "en" | "ar");
	const geolocation = useGeolocation();

	const methodOrder = orderedMethodIds(
		chosenCountry === null ? null : suggestMethod(chosenCountry.code),
	);

	const hasResults = results.length > 0;
	const showList = open && (hasResults || loading);

	const pickCity = (city: CityResult) => {
		setLocation({
			latitude: city.latitude,
			longitude: city.longitude,
			timezone: city.timezone,
			label: city.label,
		});
		// The country (name + code) feeds the "suggested for …" hint.
		setChosenCountry({ code: city.countryCode, name: city.country });
		// Applies the country's method unless the user already chose one
		// (kept in the store, so it survives leaving and re-opening this step).
		applySuggestedMethod(suggestMethod(city.countryCode));
		// A manual pick replaces the device timezone with the city's own.
		setUsedGps(false);
		setQuery("");
		setOpen(false);
		setHighlighted(0);
	};

	const pickHighlighted = () => {
		// Only picks while the listbox is open — a form submit (e.g. Enter with
		// the list closed) must not silently grab the stale highlight.
		if (!open) {
			return;
		}
		const city = results[highlighted];
		if (city !== undefined) {
			pickCity(city);
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setHighlighted((current) =>
				results.length === 0 ? 0 : (current + 1) % results.length,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlighted((current) =>
				results.length === 0 || current === 0
					? Math.max(results.length - 1, 0)
					: current - 1,
			);
		} else if (event.key === "Enter") {
			if (showList && hasResults) {
				event.preventDefault();
				pickHighlighted();
			}
		} else if (event.key === "Escape") {
			// Close the list and drop the stale results with it.
			setOpen(false);
			setHighlighted(0);
		}
	};

	// Keep the highlighted option visible without scrolling the page.
	const listRef = useRef<HTMLUListElement>(null);
	useEffect(() => {
		if (!open || !hasResults) {
			return;
		}
		listRef.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
	}, [open, hasResults, highlighted]);

	const detectLocation = async () => {
		const result = await geolocation.locate();
		if (result !== null) {
			setLocation({
				latitude: result.latitude,
				longitude: result.longitude,
				timezone: result.timezone,
				label: t("myLocation"),
			});
			// A raw coordinate carries no country; the suggestion hint hides.
			setChosenCountry(null);
			// The GPS flow uses the device timezone — surface that hint.
			setUsedGps(true);
		}
	};

	const gpsErrorMessage = (() => {
		switch (geolocation.error) {
			case "permission":
				return t("gpsErrorPermission");
			case "unavailable":
				return t("gpsErrorUnavailable");
			case "timeout":
				return t("gpsErrorTimeout");
			case "error":
				return t("gpsErrorGeneric");
			default:
				return null;
		}
	})();

	return (
		<section aria-labelledby="place-heading" className="flex flex-col gap-4">
			<h2 id="place-heading" className="text-(length:--text-title)">
				{t("heading")}
			</h2>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					pickHighlighted();
				}}
				className="flex flex-col gap-2"
			>
				<label htmlFor={inputId} className="text-sm font-medium">
					{t("cityLabel")}
				</label>
				<input
					id={inputId}
					type="text"
					role="combobox"
					aria-expanded={showList}
					aria-controls={showList ? listId : undefined}
					aria-activedescendant={
						showList && hasResults ? `${listId}-${highlighted}` : undefined
					}
					aria-autocomplete="list"
					autoComplete="off"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setHighlighted(0);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onKeyDown={onKeyDown}
					placeholder={t("cityPlaceholder")}
					className="rounded-lg border border-line-strong px-3 py-2"
				/>
				{error ? (
					<p role="alert" className="text-xs text-danger">
						{t("searchError")}
					</p>
				) : (
					<p id={`${inputId}-hint`} className="text-xs text-muted">
						{loading ? t("searching") : t("searchHint")}
					</p>
				)}
				{showList ? (
					<ul
						ref={listRef}
						id={listId}
						role="listbox"
						aria-label={t("cityResults")}
						className="max-h-60 overflow-y-auto rounded-lg border border-line-strong bg-background shadow-sm"
					>
						{hasResults ? (
							results.map((city, index) => (
								<li
									key={`${city.latitude}-${city.longitude}-${index}`}
									id={`${listId}-${index}`}
									role="option"
									aria-selected={index === highlighted}
									onMouseDown={(event) => {
										// Before the input's blur hides the list.
										event.preventDefault();
										pickCity(city);
									}}
									onMouseEnter={() => setHighlighted(index)}
									className={`cursor-pointer px-3 py-2 text-sm ${
										index === highlighted
											? "bg-wash"
											: ""
									}`}
								>
									{city.label}
									<span className="ms-2 text-xs text-muted">{city.timezone}</span>
								</li>
							))
						) : (
							<li
								aria-live="polite"
								className="px-3 py-2 text-sm text-muted"
							>
								{loading ? t("searching") : t("searchNoResults")}
							</li>
						)}
					</ul>
				) : null}

				<button
					type="button"
					disabled={geolocation.locating}
					onClick={() => void detectLocation()}
					className="btn w-fit"
				>
					<LocateFixed aria-hidden className="size-4" />
					{geolocation.locating ? t("gpsLocating") : t("gpsButton")}
				</button>
				{gpsErrorMessage ? (
					<p role="alert" className="text-xs text-danger">
						{gpsErrorMessage}
					</p>
				) : null}
			</form>

			{/* Only once a place is set: 0, 0 is not a real answer. */}
			{location.label ? (
				<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-xl bg-wash px-4 py-3 text-sm">
					<dt className="text-muted">{t("currentPlace")}</dt>
					<dd className="font-medium">{location.label}</dd>
					<dt className="text-muted">{t("coordinates")}</dt>
					<dd className="tabular-nums">
						<bdi dir="ltr">
							{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
						</bdi>
					</dd>
					<dt className="text-muted">{t("timezoneLabel")}</dt>
					<dd>
						<bdi dir="ltr">{location.timezone ?? t("notSet")}</bdi>
					</dd>
				</dl>
			) : null}
			{usedGps ? (
				<p className="text-xs text-muted">{t("gpsTimezoneHint")}</p>
			) : null}

			<label htmlFor="method-input" className="text-sm font-medium">
				{t("methodLabel")}
			</label>
			<select
				id="method-input"
				value={method}
				onChange={(event) => setMethod(Number(event.target.value))}
				className="rounded-lg border border-line-strong px-3 py-2"
			>
				{methodOrder.map((id) => (
					<option key={id} value={id}>
						{methodName(id, locale as "en" | "ar")}
					</option>
				))}
			</select>
			{chosenCountry !== null && chosenCountry.name !== "" ? (
				<p className="text-xs text-muted">
					{t("suggestedFor", { country: chosenCountry.name })}
				</p>
			) : null}

			<fieldset className="flex flex-col gap-1.5">
				<legend className="text-sm font-medium">{t("schoolLabel")}</legend>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="asr-school"
						value="standard"
						checked={school === "standard"}
						onChange={() => setSchool("standard" satisfies AsrSchool)}
					/>
					{t("schoolStandard")}
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="asr-school"
						value="hanafi"
						checked={school === "hanafi"}
						onChange={() => setSchool("hanafi" satisfies AsrSchool)}
					/>
					{t("schoolHanafi")}
				</label>
			</fieldset>

			<NavButtons onNext={onNext} />
		</section>
	);
}
