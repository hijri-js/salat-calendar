# 01 — Progress bar with percentage for the .ics download

Status: resolved
Type: task
Requested: 2026-11-19, by the user, after PR 6 (#20). Do it in the next PR.

## Why

A download fetches 13 months one by one. When AlAdhan is slow or hanging, each month can wait up to the 10 s upstream timeout, so the whole download can take about 2 minutes. Today the card only shows a small "month 2 of 13" line, which is easy to miss and gives no sense of how far along it is.

## What

On the Download card (`src/features/ics-export/downloadCard.tsx`), while `state.status === "working"`:

- Show a visible progress bar with a percentage, e.g. `[██████░░░░░░] 46%`, next to or above the "month 6 of 13" text.
- Use the native `<progress>` element (`value={done}` `max={total}`), styled with the design tokens (accent fill, `line` track), so it has the right role and value for screen readers without extra ARIA.
- Percentage = `Math.round(done / total * 100)`, formatted with `Intl.NumberFormat(\`${locale}-u-nu-latn\`, { style: "percent" })`, so Arabic keeps Latin digits and gets the right `%` placement.
- Give the bar an accessible name (e.g. `aria-label={t("progressLabel")}`); keep it out of the polite live region (no announcement per month, as decided in PR 6).
- Optional: move from 13 coarse steps to smoother progress by counting days fetched instead of months (`done` += days in the chunk, `total` = days in the year).
- Respect `prefers-reduced-motion`: no animated stripes; a plain width change is fine.
- New message keys in both `en.json` and `ar.json`; keep key parity.

## Acceptance

- [ ] While downloading, a bar and a percentage are visible and move as months arrive; they disappear when done, empty or error.
- [ ] Arabic: Latin digits, correct `%` placement, bar fills from the start edge (right) in RTL.
- [ ] 320 px: no sideways scroll.
- [ ] Screen reader: the bar is reachable and reports its value; the live region still announces only the result.
- [ ] Tested in the browser with a slow network (DevTools throttling) so the bar is seen moving.

## Related

- 02-faster-fallback-when-aladhan-is-down.md shortens the wait itself.

## Answer

Done in PR 6.1. A native `<progress>` fills by **days** fetched (not 13 month jumps), with a percentage next to it from `Intl.NumberFormat(locale-u-nu-latn, {style: "percent"})`, so Arabic keeps Latin digits. It has an `aria-label` and sits outside the live region, so nothing is announced every month; the "month N of 13" line stays under it. It's styled with the colour tokens in `globals.css` (`.ics-progress`), mirrors in RTL because the browser handles it, and the fill transition is cancelled by the global reduced-motion rule. The pure helpers `chunkDays` and `progressFraction` are tested in `icsFile.test.ts`.
