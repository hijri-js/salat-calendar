"use client";

/**
 * WeekGrid (plan §6 step 5 wireframe): one column per day, one row per hour
 * band (05:00–23:00 or adaptive when events fall outside), events as
 * blocks — Busy solid, Free hatched at 50% opacity — skipped slots greyed
 * with the SkipReason as tooltip and sr-only text, window markers inline at
 * their hour position, a legend, and the "N events this week · about M for
 * the year" line.
 *
 * While placeholder data from the previous week is shown (TanStack
 * `isPlaceholderData`), the caller passes `placeholder` and the grid is
 * dimmed so stale data is never mistaken for the current week.
 *
 * All strings come through the messages; numerals stay Latin.
 */
import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { DayPlan, DayTimings, TimeWindow, Weekday } from "@/lib/prayer-engine/types";
import { weekdayOf } from "@/lib/prayer-engine";

import { estimateYearEvents } from "./week";

/** Hour bands rendered when there is nothing to say otherwise (plan §6). */
const DEFAULT_FIRST_HOUR = 5;
const DEFAULT_LAST_HOUR = 23; // exclusive

interface WeekGridProps {
	plans: DayPlan[];
	timings: DayTimings[];
	window?: TimeWindow;
	/** True while the grid shows the previous week's placeholder data. */
	placeholder?: boolean;
}

/** One renderable block inside a day/hour cell. */
interface Block {
	title: string;
	time: string;
	kind: "busy" | "free" | "skip";
	/** Skip reason key, present only on skipped blocks. */
	reason?: string;
}

/** One full-width window boundary marker row, keyed by its hour band. */
interface WindowMarker {
	text: string;
	hour: number;
}

function hourOfLocalIso(iso: string): number {
	return Number(iso.slice(11, 13));
}

/** Raw adhan time "HH:MM" of a prayer on one day, as an hour band. */
function rawHourOf(timing: DayTimings | undefined, prayer: string): number | null {
	const raw = timing?.times[prayer as keyof typeof timing.times];
	if (raw === undefined) {
		return null;
	}
	return Number(raw.slice(0, 2));
}

/** Minutes-from-midnight → "HH:MM". */
function minToLabel(min: number): string {
	return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default function WeekGrid({
	plans,
	timings,
	window: timeWindow,
	placeholder = false,
}: WeekGridProps) {
	const t = useTranslations("preview");
	const tPrayers = useTranslations("prayers");

	// ---- collect blocks and derive the adaptive hour range ----
	const cells = new Map<string, Block[]>();
	let minHour = DEFAULT_FIRST_HOUR;
	let maxHour = DEFAULT_LAST_HOUR;
	let eventCount = 0;

	const pushBlock = (dateIndex: number, hour: number, block: Block) => {
		const key = `${dateIndex}-${hour}`;
		const existing = cells.get(key);
		if (existing === undefined) {
			cells.set(key, [block]);
		} else {
			existing.push(block);
		}
		if (hour < minHour) {
			minHour = hour;
		}
		if (hour + 1 > maxHour) {
			maxHour = hour + 1;
		}
	};

	const byDate = new Map(timings.map((timing) => [timing.date, timing]));
	const dates = plans.map((plan) => plan.date);
	const dayIndex = new Map(dates.map((date, index) => [date, index]));

	plans.forEach((plan, dateIndex) => {
		const timing = byDate.get(plan.date);
		for (const event of plan.events) {
			// Midnight-crossing events are bucketed by the date they start on,
			// not the plan's date, so they land in the correct day column;
			// events outside the displayed week are simply not shown.
			const eventDateIndex = dayIndex.get(event.startLocal.slice(0, 10));
			if (eventDateIndex === undefined) {
				continue;
			}
			const hour = hourOfLocalIso(event.startLocal);
			const time = event.startLocal.slice(11, 16);
			const end = event.endLocal.slice(11, 16);
			pushBlock(eventDateIndex, hour, {
				title: event.title,
				time: `${time}–${end}`,
				kind: event.transparency === "transparent" ? "free" : "busy",
			});
			eventCount += 1;
		}
		for (const skipped of plan.skipped) {
			const hour = rawHourOf(timing, skipped.prayer);
			if (hour === null) {
				continue;
			}
			pushBlock(dateIndex, hour, {
				title: tPrayers(`prayer.${skipped.prayer}`),
				time: timing?.times[skipped.prayer] ?? "",
				kind: "skip",
				reason: t(`skipReason.${skipped.reason}`),
			});
		}
	});

	const hours: number[] = [];
	for (let hour = minHour; hour < maxHour; hour += 1) {
		hours.push(hour);
	}

	const yearEstimate = estimateYearEvents(eventCount);

	// Window boundary markers, rendered inline at their own hour position
	// inside the loop below — including an overnight window's end marker
	// whenever its hour falls within the displayed range.
	const markersByHour = new Map<number, WindowMarker[]>();
	if (timeWindow !== undefined) {
		const markers: WindowMarker[] = [
			{
				text: t("windowStarts", { time: minToLabel(timeWindow.startMin) }),
				hour: Math.floor(timeWindow.startMin / 60),
			},
			{
				text: t("windowEnds", { time: minToLabel(timeWindow.endMin) }),
				hour: Math.floor(timeWindow.endMin / 60),
			},
		];
		for (const marker of markers) {
			if (marker.hour >= minHour && marker.hour < maxHour) {
				const existing = markersByHour.get(marker.hour) ?? [];
				existing.push(marker);
				markersByHour.set(marker.hour, existing);
			}
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<div
				className={`grid overflow-hidden rounded-lg border border-black/10 text-xs dark:border-white/15${
					placeholder ? " opacity-60" : ""
				}`}
				style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}
			>
				{/* header row */}
				<div className="bg-black/5 p-1 dark:bg-white/10" aria-hidden />
				{dates.map((date) => (
					<div
						key={date}
						className="bg-black/5 p-1 text-center font-medium dark:bg-white/10"
					>
						<div className="truncate">
							{tPrayers(`days.${weekdayOf(date) as Weekday}`)}
						</div>
						<div className="opacity-60">{date.slice(8, 10)}</div>
					</div>
				))}

				{/* hour rows, each followed by its window marker (if any) */}
				{hours.map((hour) => (
					<Fragment key={hour}>
						<BlockFragment hour={hour}>
							{dates.map((date, dateIndex) => (
								<div
									key={date}
									className="relative flex min-h-10 flex-col gap-0.5 border border-black/5 p-0.5 dark:border-white/10"
								>
									{(cells.get(`${dateIndex}-${hour}`) ?? []).map((block, index) => {
										if (block.kind === "skip") {
											return (
												<div
													key={index}
													title={`${block.title} — ${t("skipped", { reason: block.reason ?? "" })}`}
													className="rounded bg-black/10 px-1 py-0.5 text-black/50 dark:bg-white/10 dark:text-white/50"
												>
													<div className="truncate">
														{block.title} {t("skippedShort")}
													</div>
													<div className="truncate opacity-70">{block.reason}</div>
													<span className="sr-only">
														{t("skipped", { reason: block.reason ?? "" })}
													</span>
												</div>
											);
										}
										const busy = block.kind === "busy";
										return (
											<div
												key={index}
												title={`${block.title} ${block.time}`}
												className={`rounded px-1 py-0.5 ${
													busy
														? "bg-foreground text-background"
														: "border border-black/20 opacity-50 dark:border-white/30"
												}`}
												style={
													busy
														? undefined
														: {
																backgroundImage:
																	"repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 6px)",
															}
												}
											>
												<div className="truncate font-medium">{block.title}</div>
												<div className="truncate opacity-80">{block.time}</div>
											</div>
										);
									})}
								</div>
							))}
						</BlockFragment>
						{(markersByHour.get(hour) ?? []).map((marker, index) => (
							<div
								key={`${marker.text}-${index}`}
								style={{ gridColumn: "1 / -1" }}
								className="border-t border-dashed border-black/40 px-2 py-0.5 text-center text-[10px] opacity-60 dark:border-white/40"
							>
								— {marker.text} —
							</div>
						))}
					</Fragment>
				))}
			</div>

			{/* legend */}
			<ul className="flex flex-wrap items-center gap-3 text-xs">
				<li className="flex items-center gap-1.5">
					<span
						aria-hidden
						className="inline-block h-3 w-5 rounded bg-foreground"
					/>
					{t("legendBusy")}
				</li>
				<li className="flex items-center gap-1.5">
					<span
						aria-hidden
						className="inline-block h-3 w-5 rounded border border-current opacity-50"
						style={{
							backgroundImage:
								"repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 6px)",
						}}
					/>
					{t("legendFree")}
				</li>
				<li className="flex items-center gap-1.5">
					<span
						aria-hidden
						className="inline-block h-3 w-5 rounded bg-black/10 dark:bg-white/10"
					/>
					{t("legendSkipped")}
				</li>
			</ul>

			<p className="text-sm">
				{t("eventsWeek", { count: eventCount, countLatin: String(eventCount) })}
				{" · "}
				{t("yearEstimate", { count: yearEstimate, countLatin: String(yearEstimate) })}
			</p>
		</div>
	);
}

/** Keeps the time label and its seven day cells on one grid row. */
function BlockFragment({
	hour,
	children,
}: {
	hour: number;
	children: ReactNode;
}) {
	return (
		<>
			<div
				className="border-t border-black/5 p-1 text-end tabular-nums opacity-60 dark:border-white/10"
				aria-hidden
			>
				{String(hour).padStart(2, "0")}
			</div>
			{children}
		</>
	);
}
