# salat-calendar — agent instructions

This repo is **salat-calendar** (the folder was originally named `salaat-sync`). It is a Next.js web app that turns a year of prayer times into real Google Calendar events or a downloadable `.ics` file. The full product plan, decisions, architecture, and PR-by-PR build order live in `docs/PLAN.md` — read it before any implementation work. The plan is the source of truth; if code or instructions contradict it, surface the conflict instead of silently choosing.

## Hard rules

- **pnpm only.** Never generate `package-lock.json` or `yarn.lock`.
- **CI audit runs `pnpm audit --audit-level high --ignore-unfixable`.** Unfixable
  advisories (no patched release upstream) are skipped deliberately — Dependabot
  re-covers them the moment a fix ships. Do not add per-GHSA ignores unless a
  reviewer asks; if a new advisory is fixable, bump or override the dependency
  instead.
- **Source files are camelCase** (`localFallback.ts`, not `local-fallback.ts`). Test files mirror the source name (`localFallback.test.ts`). Keep standard kebab-case only where ecosystems expect it: fixture data files, `.github/` workflows, and tool config files (`eslint.config.mjs`, `next.config.ts`).
- **Use `@/` imports** for anything outside the current folder (e.g. `@/lib/prayer-engine/types`); plain relative `./` imports only within the same folder. The alias is configured in `tsconfig.json` and mirrored in `vitest.config.ts` — keep the two in sync if either changes.
- **TypeScript strict**; Next.js App Router; Tailwind CSS v4 + shadcn/ui (Radix) + Lucide icons.
- **i18n:** `next-intl`, routes `/en` and `/ar`, `dir="rtl"` for Arabic, numerals stay Latin, logical CSS properties (`ms-`, `pe-`).
- **No database.** User rules live in browser memory; event ownership lives on the Google event tags.
- **Google access token never stored** — not in cookies, localStorage, server, or logs. No refresh token. Token travels in the `Authorization` header per request and is forgotten.
- **Server never trusts client times.** Prayer times come from AlAdhan (cached) or the local `adhan` fallback, always server-side or via the shared engine.
- The sync API touches only events tagged `extendedProperties.private.app = "salat-calendar"`.

## Architecture invariants

- `src/lib/prayer-engine/` contains **pure functions only** (no I/O, no framework imports). Vitest coverage thresholds are 100% lines/branches/functions for this folder.
- Feature-folder layout: code for one feature sits together in `src/features/<feature>/` with its own `__tests__/`. An ESLint rule blocks one feature importing another feature's internals. Shared framework-free logic lives in `src/lib/`.
- `src/app/` holds routing only — thin files that import features.
- Zod schemas (`src/lib/sync/schema.ts`, engine types) are shared contracts between client and API routes; change them first, deliberately.
- Times are wall-clock minutes + IANA timezone; Google events are sent as local `dateTime` + `timeZone` so DST is Google's problem. Offsets crossing midnight move the event date.

## Workflow

- One feature branch and one PR per slice, against `hijri-js/salat-calendar`. CI (Gitleaks, audit, `tsc`, ESLint, Vitest) must be green before a PR is opened.
- Every PR gets an independent review pass (use the `reviewer` subagent) before it is opened; fix every high and medium finding.
- Specs and issues live under `.scratch/<feature>/` per the issue-tracker convention below.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Subagents

A `subagent` tool is available (user-level Pi extension). Roles defined in `~/.pi/agent/agents/`: `scout` (read-only recon), `planner`, `worker` (implementation), `reviewer` (read-only review — the review-loop reviewer of record), `docs-writer` (PR-2 style docs). Parallel implementation agents require separate git worktrees per the plan's subagent section; do not run two write-agents against one working tree.
