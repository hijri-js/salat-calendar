"use client";

/**
 * WeekGrid (plan §6 step 5 wireframe): one column per day, one row per hour
 * band (05:00–23:00, or wider when events fall outside), events as blocks:
 * Busy solid, Free hatched, skipped slots greyed. A skipped slot is a button
 * that opens its reason in a popover (tap, click or Enter), so touch and
 * keyboard users get it too, not only mouse hover.
 *
 * Skips decided after the timing (outside the window, away) are drawn where
 * the event would have started; earlier skips (prayer or day off) at the
 * adhan time. Times are isolated as LTR so "05:09–05:29" never flips in
 * Arabic. On a narrow container the same data renders as a day list.
 *
 * While placeholder data from the previous week is shown, the caller passes
 * `placeholder` and the grid is dimmed.
 */
import { Fragment, useId, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { DayPlan, DayTimings, TimeWindow } from "@/lib/prayer-engine/types";

import { dayLabels } from "./formatDate";
import { estimateYearEvents } from "./week";

/** Hour bands rendered when there is nothing to say otherwise (plan §6). */
const DEFAULT_FIRST_HOUR = 5;
const DEFAULT_LAST_HOUR = 23; // exclusive

interface WeekGridProps {
	plans: DayPlan[];
	timings: DayTimings[];
	window?: TimeWindow;
	/** "YYYY-MM-DD" of today, highlighted in the header. */
	today?: string;
	/** True while the grid shows the previous week's placeholder data. */
	placeholder?: boolean;
}

/** One renderable block inside a day/hour cell. */
interface Block {
	key: string;
	title: string;
	/** "HH:MM" or "HH:MM–HH:MM". */
	time: string;
	/** Minutes from midnight, for ordering inside a day. */
	sortMin: number;
	hour: number;
	kind: "busy" | "free" | "skip";
	/** Translated skip reason, present only on skipped blocks. */
	reason?: string;
}

/** One full-width window boundary marker row, keyed by its hour band. */
interface WindowMarker {
	text: string;
	hour: number;
	/** On the hour → drawn above that hour's row; otherwise below it. */
	before: boolean;
}

/** Minutes-from-midnight → "HH:MM". */
function minToLabel(min: number): string {
	return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function hhmmToMin(hhmm: string): number {
	return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

const HATCH = "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 6px)";

export default function WeekGrid({
	plans,
	timings,
	window: timeWindow,
	today,
	placeholder = false,
}: WeekGridProps) {
	const t = useTranslations("preview");
	const tPrayers = useTranslations("prayers");
	const locale = useLocale();
	const idBase = useId();

	// ---- collect blocks per day and derive the adaptive hour range ----
	const dates = plans.map((plan) => plan.date);
	const dayIndex = new Map(dates.map((date, index) => [date, index]));
	const byDate = new Map(timings.map((timing) => [timing.date, timing]));
	const perDay: Block[][] = dates.map(() => []);
	let minHour = DEFAULT_FIRST_HOUR;
	let maxHour = DEFAULT_LAST_HOUR;
	let eventCount = 0;

	const push = (dateIndex: number, block: Block) => {
		perDay[dateIndex].push(block);
		minHour = Math.min(minHour, block.hour);
		maxHour = Math.max(maxHour, block.hour + 1);
	};

	plans.forEach((plan, planIndex) => {
		const timing = byDate.get(plan.date);
		for (const event of plan.events) {
			// Midnight-crossing events land in the column of the date they
			// start on; events outside the displayed week are not shown.
			const eventDateIndex = dayIndex.get(event.startLocal.slice(0, 10));
			if (eventDateIndex === undefined) {
				continue;
			}
			const start = event.startLocal.slice(11, 16);
			push(eventDateIndex, {
				key: event.id,
				title: event.title,
				time: `${start}–${event.endLocal.slice(11, 16)}`,
				sortMin: hhmmToMin(start),
				hour: Number(start.slice(0, 2)),
				kind: event.transparency === "transparent" ? "free" : "busy",
			});
			eventCount += 1;
		}
		for (const skipped of plan.skipped) {
			// Prefer where the event would have started; fall back to the adhan.
			const startLocal = skipped.startLocal;
			const targetIndex =
				startLocal === undefined ? planIndex : dayIndex.get(startLocal.slice(0, 10));
			const time = startLocal?.slice(11, 16) ?? timing?.times[skipped.prayer];
			if (targetIndex === undefined || time === undefined) {
				continue;
			}
			push(targetIndex, {
				key: `${plan.date}-${skipped.prayer}-skip`,
				title: tPrayers(`prayer.${skipped.prayer}`),
				time,
				sortMin: hhmmToMin(time),
				hour: Number(time.slice(0, 2)),
				kind: "skip",
				reason: t(`skipReason.${skipped.reason}`),
			});
		}
	});
	for (const blocks of perDay) {
		blocks.sort((a, b) => a.sortMin - b.sortMin);
	}

	const hours: number[] = [];
	for (let hour = minHour; hour < maxHour; hour += 1) {
		hours.push(hour);
	}

	const yearEstimate = estimateYearEvents(eventCount);

	// Window boundary markers, drawn under their hour row.
	const markersByHour = new Map<number, WindowMarker[]>();
	if (timeWindow !== undefined) {
		const markers: WindowMarker[] = [
			{
				text: t("windowStarts", { time: minToLabel(timeWindow.startMin) }),
				hour: Math.floor(timeWindow.startMin / 60),
				before: timeWindow.startMin % 60 === 0,
			},
			{
				text: t("windowEnds", { time: minToLabel(timeWindow.endMin) }),
				hour: Math.floor(timeWindow.endMin / 60),
				before: timeWindow.endMin % 60 === 0,
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

	const renderMarkers = (hour: number, before: boolean) =>
		(markersByHour.get(hour) ?? [])
			.filter((marker) => marker.before === before)
			.map((marker) => (
				<div
					key={marker.text}
					style={{ gridColumn: "1 / -1" }}
					className="flex items-center gap-2 px-2 py-0.5 text-[11px] text-accent-ink"
				>
					<span aria-hidden className="flex-1 border-t border-dashed border-accent" />
					<span>{marker.text}</span>
					<span aria-hidden className="flex-1 border-t border-dashed border-accent" />
				</div>
			));

	// `view` keeps popover ids unique: both layouts are in the DOM.
	const renderBlock = (block: Block, view: "grid" | "list") => {
		const size = view === "grid" ? "text-[11px]" : "text-xs";
		if (block.kind === "skip") {
			const popoverId = `${idBase}-${view}-${block.key}`;
			// Explicit anchor (a valid dashed ident) where anchor positioning
			// exists; elsewhere the popover keeps the browser's centred spot.
			const anchor = `--${popoverId.replace(/[^a-zA-Z0-9-]/g, "")}`;
			return (
				<Fragment key={block.key}>
					<button
						type="button"
						popoverTarget={popoverId}
						style={{ anchorName: anchor } as CSSProperties}
						className={`skip-trigger w-full rounded-md bg-wash px-1.5 py-1 text-start text-muted ${size}`}
					>
						<span className="block truncate line-through decoration-line-strong">
							{block.title}
						</span>
						<bdi dir="ltr" className="block truncate tabular-nums">
							{block.time}
						</bdi>
						<span className="sr-only">
							{t("skipped", { reason: block.reason ?? "" })}
						</span>
					</button>
					<div
						id={popoverId}
						popover="auto"
						style={{ positionAnchor: anchor } as CSSProperties}
						className="skip-tip max-w-60 rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink shadow-lg"
					>
						<strong className="font-semibold">{block.title}</strong>{" "}
						<bdi dir="ltr" className="tabular-nums">
							{block.time}
						</bdi>
						<span className="block text-muted">
							{t("skipped", { reason: block.reason ?? "" })}
						</span>
					</div>
				</Fragment>
			);
		}
		const busy = block.kind === "busy";
		return (
			<div
				key={block.key}
				title={`${block.title} ${block.time}`}
				className={`rounded-md px-1.5 py-1 ${size} ${
					busy ? "bg-ink text-paper" : "border border-ink/40 bg-paper-raised text-ink"
				}`}
			>
				<span className="flex items-center gap-1 truncate font-medium">
					{!busy ? (
						<span
							aria-hidden
							className="inline-block h-2 w-3 flex-none rounded-sm text-muted"
							style={{ backgroundImage: HATCH }}
						/>
					) : null}
					<span className="truncate">{block.title}</span>
				</span>
				<bdi dir="ltr" className="block truncate tabular-nums opacity-80">
					{block.time}
				</bdi>
			</div>
		);
	};

	return (
		<div className="@container flex flex-col gap-4">
			<div className={`transition-opacity ${placeholder ? "opacity-50" : ""}`}>
				{/* Wide container: the hour grid from the wireframe. */}
				<div
					className="hidden overflow-hidden rounded-xl border border-line bg-paper-raised @2xl:grid"
					style={{ gridTemplateColumns: "3.25rem repeat(7, minmax(0, 1fr))" }}
				>
					<div className="border-b border-line bg-wash" aria-hidden />
					{dates.map((date) => {
						const label = dayLabels(date, locale);
						const isToday = date === today;
						return (
							<div
								key={date}
								className={`border-b border-s border-line px-1 py-2 text-center ${
									isToday ? "bg-accent-wash" : "bg-wash"
								}`}
							>
								<div className="truncate text-xs text-muted">{label.weekday}</div>
								<div
									className={`text-base font-semibold tabular-nums ${
										isToday ? "text-accent-ink" : ""
									}`}
								>
									{label.day}
								</div>
							</div>
						);
					})}

					{hours.map((hour) => (
						<Fragment key={hour}>
							{renderMarkers(hour, true)}
							<div
								className="border-t border-line/60 pe-2 pt-1 text-end text-[11px] tabular-nums text-muted"
								aria-hidden
							>
								<bdi dir="ltr">{`${String(hour).padStart(2, "0")}:00`}</bdi>
							</div>
							{dates.map((date, dateIndex) => (
								<div
									key={date}
									className={`flex min-h-9 flex-col gap-0.5 border-s border-t border-line/60 p-0.5 ${
										date === today ? "bg-accent-wash/40" : ""
									}`}
								>
									{perDay[dateIndex]
										.filter((block) => block.hour === hour)
										.map((block) => renderBlock(block, "grid"))}
								</div>
							))}
							{renderMarkers(hour, false)}
						</Fragment>
					))}
				</div>

				{/* Narrow container: one row per day, blocks in time order. */}
				<ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-paper-raised @2xl:hidden">
					{dates.map((date, dateIndex) => {
						const label = dayLabels(date, locale);
						const isToday = date === today;
						return (
							<li
								key={date}
								className={`grid grid-cols-[3rem_minmax(0,1fr)] gap-2 p-2 ${
									isToday ? "bg-accent-wash/50" : ""
								}`}
							>
								<div className="pt-0.5">
									<div className="text-xs text-muted">{label.weekday}</div>
									<div
										className={`text-lg font-semibold leading-tight tabular-nums ${
											isToday ? "text-accent-ink" : ""
										}`}
									>
										{label.day}
									</div>
								</div>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
									{perDay[dateIndex].map((block) => renderBlock(block, "list"))}
								</div>
							</li>
						);
					})}
				</ol>
			</div>

			{/* legend */}
			<ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
				<li className="flex items-center gap-1.5">
					<span aria-hidden className="inline-block h-3 w-5 rounded-sm bg-ink" />
					{t("legendBusy")}
				</li>
				<li className="flex items-center gap-1.5">
					<span
						aria-hidden
						className="inline-block h-3 w-5 rounded-sm border border-ink/40 text-ink/60"
						style={{ backgroundImage: HATCH }}
					/>
					{t("legendFree")}
				</li>
				<li className="flex items-center gap-1.5">
					<span aria-hidden className="inline-block h-3 w-5 rounded-sm bg-wash ring-1 ring-line-strong" />
					{t("legendSkipped")}
				</li>
			</ul>

			<p className="text-sm">
				<span className="font-semibold">
					{t("eventsWeek", { count: eventCount, countLatin: String(eventCount) })}
				</span>
				<span className="text-muted">
					{" · "}
					{t("yearEstimate", { count: yearEstimate, countLatin: String(yearEstimate) })}
				</span>
			</p>
		</div>
	);
}
