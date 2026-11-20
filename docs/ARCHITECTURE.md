# salat-calendar — Architecture

Source of truth: [docs/PLAN.md](./PLAN.md), sections 4 and 5. This document transcribes and adapts them. It changes no plan decision.

Two updates from the Step 0 spikes (`.scratch/step-0/spikes.md`, checked 2026-11-14):

- The Google daily request cap (1,000,000 per project per 24 h) is now **confirmed from Google's own quota page**. It was marked "(confirm)" in the plan; it no longer is.
- `caches.default` (Cloudflare Cache API) works under OpenNext on Workers, so the `TimingsCache` design is viable as planned. The exact Open-Meteo fair-use number is still unconfirmed and stays marked "(confirm)".

Everything here is plain English, short sentences, diagrams first.

## 1. System context

```mermaid
flowchart LR
    U[User browser<br/>wizard + preview + sync loop<br/>token in memory]
    subgraph CF[Cloudflare Worker: Next.js]
        P[/api/prayers/preview/]
        S[/api/calendar/sync-month/]
        C[/api/calendar/cleanup/]
        K[(Timings cache)]
        E[prayer-engine<br/>pure functions]
    end
    OM[Open-Meteo<br/>city search]
    GIS[Google sign-in popup]
    AL[AlAdhan API]
    L[adhan lib<br/>local fallback]
    G[Google Calendar API v3]

    U -->|city search| OM
    U -->|get token| GIS
    U --> P
    U -->|token in header| S & C
    P & S --> K --> AL
    AL -.fails.-> L
    S & C --> G
    S --> E
    U -->|same engine: preview + .ics| E
```

One important rule runs through the whole design: **the engine is the same code in two places**. The browser runs it for the live preview and for building the `.ics` file. The Worker runs it again for the Google sync. The server never trusts times sent by the client; it recomputes everything from prayer data it fetched itself.

## 2. User journey

```mermaid
flowchart TD
    A[Landing /en or /ar<br/>defaults already filled] --> B[1 Place]
    B <--> C[2 Prayers + days]
    C <--> D[3 Timing]
    D <--> E[4 Calendar look]
    E <--> F[5 Preview week]
    F <--> G[6 Get it]
    G --> ICS[Download .ics<br/>no login]
    G --> H[Connect Google popup]
    H --> K[Sync 12 months, month by month, progress bar]
    K --> L[Summary: created / updated / skipped]
    L --> M[Remove all salat-calendar events]
    K -->|a month fails| R[Retry that month]
    R --> K
```

The wizard has six steps. Any step can be opened at any time from the stepper; Back and Next are shortcuts, not gates. Only the place is required. The final buttons stay disabled until it is set, and say what is missing. Every setting has a working default, so a visitor in a hurry can pick a city and go straight to step 6.

## 3. Engine pipeline (per day, per prayer)

```mermaid
flowchart LR
    T[Raw adhan time<br/>HH:MM local] --> P{Prayer enabled?}
    P -->|no| X[skip: prayer-off]
    P -->|yes| W{Weekday enabled?}
    W -->|no| X2[skip: day-off]
    W -->|yes| J{Friday Dhuhr?}
    J -->|rule = none| X5[skip: jummah-off]
    J -->|fixed time| F[use fixed clock time]
    J -->|custom| O2[Jummah offset + length]
    J -->|same / not Friday| O[apply offset]
    F & O2 & O --> R[round: nearest / up / down<br/>5 or 10 min grid]
    R --> WIN{inside active window?}
    WIN -->|no| X3[skip: outside-window]
    WIN -->|yes| V{OOO day or overlap?}
    V -->|yes| X4[skip: ooo]
    V -->|no| EV[Event: title, start, end,<br/>Busy/Free, colour, reminder]
```

Every skip carries a reason: `prayer-off`, `day-off`, `jummah-off`, `outside-window`, or `ooo`. The preview shows skipped slots greyed out with that reason, and the sync summary counts them.

How times are represented:

- Times stay as **wall-clock minutes plus an IANA timezone** (for example `Europe/London`). No UTC offset maths in our code.
- Google events are sent as local `dateTime` + `timeZone`, so **DST is Google's problem**, not ours.
- An offset that crosses midnight **moves the event to the next date**.

## 4. Sync sequence (one month chunk)

```mermaid
sequenceDiagram
    actor User
    participant B as Browser (TanStack Query)
    participant GI as Google sign-in popup
    participant W as Worker /api/calendar/sync-month
    participant AL as Cache then AlAdhan
    participant G as Google Calendar

    User->>B: Click "Connect Google and sync"
    B->>GI: request token (only the scopes needed)
    GI-->>B: access token (kept in memory)
    loop each month chunk, one at a time, paced
        B->>W: POST config, from, to, syncBatchId, calendarId, Authorization Bearer token
        W->>W: Zod-validate config, check Origin
        W->>AL: timings for month
        alt AlAdhan fails
            W->>W: compute with adhan lib, mark source=local
        end
        opt OOO skip on
            W->>G: events.list primary (outOfOffice + keywords)
            G-->>W: OOO ranges
        end
        W->>W: prayer-engine produces desired events
        W->>G: events.list target (app=salat-calendar, showDeleted)
        G-->>W: existing events
        W->>W: diff: insert / update / delete
        W->>G: batch request (tagged extendedProperties)
        G-->>W: per-item results
        W-->>B: created, updated, deleted, skipped, failed, calendarId
        B->>B: progress += 1
    end
    B-->>User: Summary + "Remove all" button
```

Each month is one HTTP request from the browser to our Worker, and one batch of calls from the Worker to Google. The server holds no job state between requests. The browser holds the queue.

## 5. Reconcile logic (why re-sync is safe)

Each event gets a deterministic ID built from date and prayer, for example `sc20261113p2`. Google rejects a second insert of the same ID, even after delete, so the server compares instead of blindly inserting.

```mermaid
flowchart TD
    D[Desired events for the month] --> CMP{ID already in calendar?}
    X[Existing salat-calendar events] --> CMP
    CMP -->|no| INS[insert]
    CMP -->|yes, differs or was deleted| UPD[update, set confirmed]
    CMP -->|yes, identical| NOP[leave]
    X --> ORPH{Existing but not desired?}
    ORPH -->|replace ON| DEL[delete]
    ORPH -->|replace OFF| KEEP[keep]
```

The result is idempotent: a retry or a double click produces the same calendar. Every event carries this tag, and cleanup only ever touches events with it:

```json
"extendedProperties": { "private": { "app": "salat-calendar", "syncBatchId": "<uuid>", "prayer": "dhuhr" } }
```

## 6. Why the client drives monthly requests

A free Cloudflare Worker gets about 10 ms of CPU and 50 outgoing calls per request. One year in one request is up to 1,825 events and would be killed. One month is at most 155 events and about 4 outgoing calls. So **the browser, not the server, drives the sync**, one month at a time:

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running: Sync clicked
    Running --> Running: month ok, next month
    Running --> Paused: month failed (after 2 retries)
    Paused --> Running: Retry month
    Running --> Done: last month ok
    Done --> Cleaning: Remove all
    Cleaning --> Cleaning: more events left
    Cleaning --> Idle: nothing left
```

Details of the chunked sync:

- A rolling year from today touches **13 calendar months** (the first and last are partial).
- The chunk size is a **parameter** (`sync/chunks.ts`), so a half-month fallback is a config change, not a rewrite.
- A failed month pauses the sync after 2 retries and offers a Retry button for that month only. Successful months stay written.
- Cleanup works the same way: each call deletes one page of tagged events and reports whether more remain.

## 7. Token and permissions

**Where the token lives**

```mermaid
flowchart LR
    POP[Google popup] -->|access token, about 1 hour| MEM[JS memory in the open tab]
    MEM -->|Authorization header, per request| W[Worker]
    W -->|forwards to Google, then forgets| G[Google Calendar]
    MEM -.tab closed or Disconnect.-> GONE["gone; Disconnect also revokes it at Google"]
```

- The access token is **never stored**: not in a cookie, not in `localStorage`, not on our server, not in logs. No refresh token is ever requested.
- There is no page redirect (it is a popup), so the wizard state is not lost and needs no storage either.
- Cost: a script injected into the page could read memory. Mitigation: strict CSP, and the only third-party script is Google's own sign-in script.
- No client secret exists in this flow, so there is no secret to leak.

**Which permissions are asked**

```mermaid
flowchart TD
    S[Connect Google] --> B[Always: calendar.app.created<br/>create + manage our own Salat calendar]
    B --> O{OOO skip on?}
    O -->|yes| R[+ calendar.events.readonly<br/>read primary to find vacations]
    O -->|no| T
    R --> T{Target = primary?}
    T -->|yes| E[+ calendar.events<br/>write events on primary]
    T -->|no| OK[Sync]
    E --> OK
```

Scopes are incremental. The user is only asked for what their choices need. The privacy page lists each scope and why it is needed.

## 8. Core types

Shared Zod schemas (`src/lib/sync/schema.ts`) and engine types are the contract between client and API routes. Change them first, deliberately.

```mermaid
classDiagram
    class SyncConfig {
      Location location
      number method
      AsrSchool school
      Record~Prayer,PrayerRule~ prayers
      Weekday[] days
      RuleDefaults defaults
      Rounding rounding
      TimeWindow? window
      JummahRule jummah
      OooRule ooo
      Locale titleLocale
      Target target
      boolean replaceExisting
    }
    class PrayerRule {
      boolean enabled
      number? offsetMin
      number? durationMin
      Transparency? transparency
      string? emoji
      string? title
    }
    class RuleDefaults {
      number offsetMin
      number durationMin
      Transparency transparency
      number? reminderMin
      string? colorId
    }
    class Rounding {
      grid: off, 5, or 10 minutes
      direction: nearest, up, or down
    }
    class JummahRule {
      mode: same, fixed, custom, or none
      string? fixedTime
      number? offsetMin
      number? durationMin
    }
    class DayTimings {
      string date
      string timezone
      Record~Prayer,string~ times
      source: aladhan or local
    }
    class PlannedEvent {
      string id
      Prayer prayer
      string startLocal
      string endLocal
      string timezone
      string title
      Transparency transparency
    }
    class Skipped {
      string date
      Prayer prayer
      reason: prayer-off, day-off, jummah-off, outside-window, or ooo
    }
    SyncConfig --> PrayerRule
    SyncConfig --> RuleDefaults
    SyncConfig --> Rounding
    SyncConfig --> JummahRule
    DayTimings ..> PlannedEvent : engine
    DayTimings ..> Skipped : engine
```

## 9. Timings cache

Prayer times for one place, method and month never change, so every user in the same city can share one stored answer.

```mermaid
flowchart LR
    R[Request: lat, lng, method, school, month] --> K[Key: coords rounded to 2 decimals<br/>+ method + school + YYYY-MM]
    K --> H{In cache?}
    H -->|yes| OUT[Return, no AlAdhan call]
    H -->|no| AL[AlAdhan]
    AL -->|ok| ST[Store 30 days] --> OUT
    AL -->|fails| LF[Local adhan fallback<br/>not cached] --> OUT
```

- Storage: Cloudflare's built-in Cache API (`caches.default`). Free, no extra service, no secret. The Step 0 spike found that OpenNext's own adapter relies on the Cache API inside its generated Worker, so our code can use it the same way.
- A `TimingsCache` interface has two implementations: Cache API on Workers, in-memory `Map` for local dev and tests.
- A cache hit makes no AlAdhan call. The local fallback result is **never cached**.
- Limit: the cache is per Cloudflare data centre, not global. Backlog: swap in Cloudflare KV behind the same interface.

## 10. Static `.ics` download

```mermaid
flowchart LR
    CFG[Wizard config] --> F[Fetch 13 months of timings<br/>/api/prayers/preview, cached]
    F --> ENG[prayer-engine in the browser]
    ENG --> ICS[Build .ics text<br/>UTC times, fixed UIDs]
    ICS --> DL[Browser downloads salat-london-2026.ics]
```

- No login, no Google. Works with Outlook, Apple Calendar, and Google import.
- Same rules as the sync, except vacation skip (a file cannot read the user's calendar). The UI states this trade-off plainly.
- UIDs are fixed per date and prayer, so importing a newer file updates events instead of doubling them (in apps that honour UIDs).
- This is a snapshot for one year. To change rules, download and import again. The UI advises importing into a separate calendar so it can be deleted in one go.

## 11. Why no database

```mermaid
flowchart LR
    A[User rules] -->|live in| B[This browser's localStorage<br/>rules only, checked on load]
    C[Which events are ours] -->|tag on| D[Each Google event<br/>app=salat-calendar]
    E[Which calendar is ours] -->|found by| F[Google name and ownership]
```

| What needs remembering | Where it already lives                            |
| ---------------------- | ------------------------------------------------- |
| The user's rules       | This browser's localStorage (rules only, checked on load) |
| Which events are ours  | The tag on each Google event                      |
| Which calendar is ours | Google (found by name and ownership)              |
| Prayer times           | Cache, rebuildable from AlAdhan                   |
| Login                  | Nothing kept                                      |

A database would only be needed for accounts or automatic monthly re-sync. Both are backlog items (see [docs/BACKLOG.md](./BACKLOG.md)).

## 12. Security

- Token handling as in section 7: memory only, per-request header, revoked on Disconnect.
- Calendar routes require a bearer token, a same-origin `Origin` header, and a Zod-valid body with hard caps: range at most 31 days, offsets within ±180 minutes, duration 5–180 minutes.
- Cleanup and sync only touch events tagged `app=salat-calendar`. A hand-made personal event is never read or deleted.
- Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame denial) in `next.config.ts` — planned to ship with the calendar routes (PR 7).
- `.env*` ignored; Gitleaks and `pnpm audit` run in CI.
- The timings cache also stops the public preview route being used to hammer AlAdhan.

## 13. Capacity and limits

Checked 2026-11-13. Sources: Google Calendar quota docs, AlAdhan community FAQ, Nominatim policy, Cloudflare free plan. The Google daily cap was re-checked 2026-11-14 against Google's own quota page (Step 0 spike 5) and is confirmed.

| Limit                        | Value                                                       | What it means for us                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google, unverified app       | 100 users in total                                          | **The real ceiling until verification.** Everyone else can still use the preview and `.ics`                                                                     |
| Google Calendar, per user    | 600 requests / minute                                       | Worst-case year (5 prayers, 7 days ≈ 1,900 requests) takes about 3–4 minutes; a typical work setup (≈ 800) about 1.5 minutes. The client paces months and backs off on 403/429 |
| Google Calendar, per project | 10,000 requests / minute                                    | About 16 people syncing flat-out at the same moment; more than that queues via backoff. Can be raised on request                                                 |
| Google daily cap             | 1,000,000 requests / day per project (confirmed, Google quota page) | Roughly 500 worst-case full syncs per day; no charges under the threshold                                                                                |
| Cloudflare Workers free      | 100,000 requests / day, 10 ms CPU, 50 outgoing calls per request | A visitor uses about 30 Worker requests (pages and assets are free) → about 3,000 visitors / day. The $5 plan removes this limit                              |
| AlAdhan                      | ~12 requests / second per IP, 70 per 7 seconds              | Only cache misses reach it: one call per new city-month. Fallback covers 429s                                                                                   |
| Open-Meteo geocoding         | Free for non-commercial, fair use (exact number: confirm)   | Called from the user's browser, debounced, so load spreads across users. The `timezone` field was confirmed in the Step 0 spike                                  |
| Google access token          | about 1 hour                                                | Enough for one sync; reconnect if it lapses                                                                                                                     |

```mermaid
flowchart LR
    A[Today: 100 Google users total] -->|Google verification| B[about 500 full syncs/day<br/>about 3,000 visitors/day]
    B -->|Cloudflare 5-dollar plan + Google quota request| C[Tens of thousands of visitors/day]
```

`.ics` downloads and the preview never touch Google quotas, so they scale with Cloudflare alone.
