"use client";

/**
 * Debounced city type-ahead hook (plan §6 step 1): 250 ms after the last
 * keystroke, minimum 2 characters, in-flight requests aborted when the
 * query or language changes. `loading` is derived from the query text, so
 * no state is set synchronously inside the effect.
 */
import { useEffect, useRef, useState } from "react";

import { searchCities, type CityResult } from "./geocoding";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface SearchState {
	/** The trimmed query the stored results belong to. */
	query: string;
	results: CityResult[];
	error: boolean;
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export function useCitySearch(query: string, language: "en" | "ar"): {
	loading: boolean;
	error: boolean;
	results: CityResult[];
} {
	const [state, setState] = useState<SearchState>({
		query: "",
		results: [],
		error: false,
	});
	// Increments on every keystroke so late responses are discarded.
	const sequence = useRef(0);

	useEffect(() => {
		const trimmed = query.trim();
		const current = ++sequence.current;
		const controller = new AbortController();

		const timer = setTimeout(() => {
			if (trimmed.length < MIN_QUERY_LENGTH) {
				setState({ query: trimmed, results: [], error: false });
				return;
			}
			searchCities(trimmed, { language, signal: controller.signal })
				.then((results) => {
					if (sequence.current !== current) {
						return;
					}
					setState({ query: trimmed, results, error: false });
				})
				.catch((error: unknown) => {
					if (isAbortError(error) || sequence.current !== current) {
						return;
					}
					setState({ query: trimmed, results: [], error: true });
				});
		}, DEBOUNCE_MS);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query, language]);

	const trimmed = query.trim();
	// Results are shown only while they belong to the text on screen.
	const active = state.query === trimmed && trimmed.length >= MIN_QUERY_LENGTH;
	const loading = trimmed.length >= MIN_QUERY_LENGTH && !active;

	return {
		loading,
		error: active ? state.error : false,
		results: active ? state.results : [],
	};
}
