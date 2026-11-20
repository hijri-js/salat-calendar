# 02 — Fall back faster when AlAdhan is down or hanging

Status: resolved
Type: task
Raised: 2026-11-19, during PR 6 (#20) testing, while AlAdhan was returning 502.

## Why

`src/lib/prayer-data/preview.ts` pauses AlAdhan for 60 s only after a 429. On a timeout (10 s) or a 5xx, every following month request tries AlAdhan again, so a hanging AlAdhan costs up to 10 s per month: about 2 minutes for a year download. Observed in PR 6: the first months took 7–10 s each.

## What (to discuss before building)

- Also trip the existing per-isolate pause on a timeout or a 5xx, perhaps with a shorter pause than for 429.
- Consider a shorter upstream timeout for month requests (e.g. 5 s).
- Keep the rule that local fallback results are never cached (plan §4.9).
- Tests: a timeout and a 502 each trip the pause; the next request goes straight to the local fallback.

## Related

- 01-download-progress-bar.md makes the wait visible; this ticket shortens it.

## Answer

Done in PR 6.1, on the server only. `preview.ts` now pauses AlAdhan for 30 s (`OUTAGE_PAUSE_MS`) after a network failure or timeout (`NETWORK`) or a 5xx, alongside the existing 60 s pause after a 429. During a pause, later months go straight to the local `adhan` fallback, so a hung AlAdhan costs about 10 s for the first month, not about 2 minutes for the year. A 4xx or an odd response shape does not pause, because it says nothing about AlAdhan's health. The 10 s timeout itself is unchanged: a shorter one would push slow but healthy months onto the fallback for no gain once the pause exists.
