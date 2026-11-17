"use client";

/**
 * GPS detect flow (plan §2, adapted from salat-time's `useLocation` for
 * this codebase). Calls `navigator.geolocation` with loading/error states;
 * on success the caller writes the store location using the device
 * timezone and a localised "My location" label.
 */
import { useCallback, useRef, useState } from "react";

import { browserTimezone } from "./cityInput";

/** The geolocation failure modes we surface to the user. */
export type GeolocationError = "permission" | "unavailable" | "timeout" | "error";

export interface GeolocationState {
	/** True while `navigator.geolocation` is working. */
	locating: boolean;
	/** The last failure, or `null` while the request is running/absent. */
	error: GeolocationError | null;
	/** Ask the browser for a one-shot position. */
	locate: () => Promise<GeolocationResult | null>;
}

export interface GeolocationResult {
	latitude: number;
	longitude: number;
	/** Device timezone via `Intl` — the place's own timezone comes from geocoding. */
	timezone: string;
}

/** Maps a `GeolocationPositionError.code` to a user-facing failure. */
function toError(code: number): GeolocationError {
	switch (code) {
		case 1: // PERMISSION_DENIED
			return "permission";
		case 2: // POSITION_UNAVAILABLE
			return "unavailable";
		case 3: // TIMEOUT
			return "timeout";
		default:
			return "error";
	}
}

/** A 10 s cap so the button never spins forever (salat-time parity). */
const GEOLOCATION_TIMEOUT_MS = 10_000;

export function useGeolocation(): GeolocationState {
	const [locating, setLocating] = useState(false);
	const [error, setError] = useState<GeolocationError | null>(null);
	const sequence = useRef(0);

	const locate = useCallback((): Promise<GeolocationResult | null> => {
		if (typeof navigator === "undefined" || navigator.geolocation === undefined) {
			return Promise.resolve(null);
		}
		const current = ++sequence.current;
		return new Promise((resolve) => {
			setLocating(true);
			setError(null);
			navigator.geolocation.getCurrentPosition(
				(position) => {
					if (sequence.current !== current) {
						resolve(null);
						return;
					}
					setLocating(false);
					resolve({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
						timezone: browserTimezone(),
					});
				},
				(positionError) => {
					if (sequence.current !== current) {
						resolve(null);
						return;
					}
					setLocating(false);
					const failure = toError(positionError.code);
					setError(failure);
					resolve(null);
				},
				{
					enableHighAccuracy: false,
					timeout: GEOLOCATION_TIMEOUT_MS,
					maximumAge: 5 * 60_000,
				},
			);
		});
	}, []);

	return { locating, error, locate };
}
