# Step 0 — Spike results

Status line format: `Status: open | resolved`. Findings committed with PR 1.

## Spike 5: Google daily cap and verification requirements

Status: resolved

Checked 2026-11-14 against https://developers.google.com/calendar/quota (official):

- Per minute per user per project: **600 requests** ✅ (matches plan §5)
- Per minute per project: **10,000 requests** ✅
- Daily threshold: **1,000,000 requests** per project per 24h before charges apply ✅ — the plan's "reported by a third party (confirm)" figure is now confirmed from Google directly. Under the threshold no charges apply.
- Unverified app ceiling: 100 total test users (plan §5, unchanged).

No changes needed to the plan's capacity table.

## Spike 6: `caches.default` under OpenNext on Workers

Status: resolved

Evidence: OpenNext's own Cloudflare adapter uses the Cache API inside the Worker it generates
(`packages/cloudflare/src/api/overrides/incremental-cache/regional-cache.ts`, `caches.open("incremental-cache")`).
So Cache API calls from our route-handler code run fine under OpenNext on Workers.

Conclusions:

- `TimingsCache` Cache-API implementation is viable as planned. No need to switch to KV.
- Local dev (`next dev` / `wrangler dev`) still uses the in-memory `Map` implementation, exactly as the plan specifies — no change.
- Backlog note stays: KV swap-in remains possible behind the same interface.

## Spike 7: Open-Meteo geocoding timezone field

Status: resolved

Checked 2026-11-14, live call:
`https://geocoding-api.open-meteo.com/v1/search?name=London&count=5&language=en&format=json`

- Every result carries a top-level `"timezone"` field with an IANA name (e.g. `"Europe/London"`, `"America/Toronto"`).
- Also returns `latitude`, `longitude`, `country`, `admin1` — everything Step 1 needs in one call.

Conclusions:

- Field name confirmed: `timezone` (not `timezones`, not nested). The plan's geocoding design works as written.
- Fair-use limit still unconfirmed precisely (Open-Meteo states free-for-non-commercial fair use; debounce + browser-side calls keep us well within it). Marked `(confirm)` only for the exact number; not blocking.

## Spikes 1–4 (Google behaviour) — deferred to PR 7 check

Status: open

These need a real OAuth token from the GIS popup (Salat calendar rediscovery, deleted-event ID
behaviour, batch size limit under Worker CPU, incremental scopes for an unverified app).
The Google client now exists, so they run as part of the PR 7 browser check, per plan §10.
No code assumptions depend on them that can't be flipped by then:
- If the Salat calendar can't be rediscovered → keep its ID in the browser (already the planned fallback).
- If deleted-event IDs can't be revived → add a version suffix to event IDs (already the planned fallback).
- If a 155-event month exceeds Worker CPU → `chunks.ts` takes chunk size as a parameter (already planned).
