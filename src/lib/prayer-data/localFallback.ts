/**
 * Local fallback: compute prayer times with the `adhan` library when AlAdhan
 * is unreachable or rate-limited (plan §2, §4.9). Results are flagged
 * `source: "local"` and are never cached (plan §4.9).
 *
 * adhan-js returns real instants (`Date`s in UTC). Each one is formatted as a
 * wall-clock time in the place's IANA timezone, so DST and the UTC offset are
 * applied. Unsupported method ids throw rather than silently computing with a
 * different method (tests: Cairo July, London June, Auckland).
 */

import * as adhanModule from "adhan";

import type { AsrSchool, DayTimings, Prayer } from "@/lib/prayer-engine/types";
import { PRAYERS } from "@/lib/prayer-engine/types";

// adhan ships CommonJS; under ESM interop the real API may sit on `.default`.
const adhan = ((adhanModule as unknown as { default?: typeof adhanModule }).default ?? adhanModule) as typeof adhanModule;

type MethodFactory = () => ReturnType<(typeof adhan.CalculationMethod.MuslimWorldLeague)>;

/** AlAdhan method ids the local library can reproduce (12 of the 15 in
 * plan §2; verified against AlAdhan's own /v1/methods endpoint, 2026-11-14). */
const METHOD_FACTORIES: Record<number, MethodFactory> = {
	1: adhan.CalculationMethod.Karachi,
	2: adhan.CalculationMethod.NorthAmerica, // ISNA
	3: adhan.CalculationMethod.MuslimWorldLeague,
	4: adhan.CalculationMethod.UmmAlQura,
	5: adhan.CalculationMethod.Egyptian,
	7: adhan.CalculationMethod.Tehran,
	9: adhan.CalculationMethod.Kuwait,
	10: adhan.CalculationMethod.Qatar,
	11: adhan.CalculationMethod.Singapore,
	13: adhan.CalculationMethod.Turkey,
	15: adhan.CalculationMethod.MoonsightingCommittee,
	16: adhan.CalculationMethod.Dubai,
};

export function supportedLocalMethods(): number[] {
	return Object.keys(METHOD_FACTORIES).map(Number).sort((a, b) => a - b);
}

/** Number of days in a month, by Gregorian rules (leap years included). */
function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Compute one month of prayer times locally. */
export function computeLocalMonthTimings(params: {
	latitude: number;
	longitude: number;
	method: number;
	school: AsrSchool;
	year: number;
	month: number;
	timezone: string;
}): DayTimings[] {
	const factory = METHOD_FACTORIES[params.method];
	if (!factory) {
		throw new Error(`Local fallback cannot reproduce calculation method ${params.method}`);
	}
	const calculationParams = factory();
	const clock = new Intl.DateTimeFormat("en-GB", {
		timeZone: params.timezone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
	calculationParams.madhab = params.school === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
	// AlAdhan uses angle-based twilight adjustment at high latitudes; adhan-js
	// defaults to MiddleOfTheNight, which diverges by hours in e.g. London June
	// (reviewer-verified against the recorded fixtures).
	calculationParams.highLatitudeRule = adhan.HighLatitudeRule.TwilightAngle;
	const coordinates = new adhan.Coordinates(params.latitude, params.longitude);

	const days: DayTimings[] = [];
	for (let day = 1; day <= daysInMonth(params.year, params.month); day += 1) {
		// adhan-js reads the Date's local calendar components; local-midnight
		// construction is canonical and yields identical results under any
		// runtime timezone (tests pass under TZ=UTC, America/Los_Angeles and
		// Pacific/Kiritimati).
		const date = new Date(params.year, params.month - 1, day);
		const times = new adhan.PrayerTimes(coordinates, date, calculationParams);
		const clockTimes = {} as Record<Prayer, string>;
		for (const prayer of PRAYERS) {
			const at = times[prayer];
			// Polar latitudes can yield null times; fail loudly instead of
			// emitting nonsense that would be labeled as usable data.
			if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
				throw new Error(`adhan could not compute ${prayer} for ${params.year}-${params.month}-${day}`);
			}
			clockTimes[prayer] = clock.format(at);
		}
		days.push({
			date: `${params.year}-${String(params.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
			timezone: params.timezone,
			times: clockTimes,
			source: "local",
		});
	}
	return days;
}
