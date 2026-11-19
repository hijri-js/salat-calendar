# ADR 0001: Native HTML UI instead of shadcn/ui and Radix

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The plan (`docs/PLAN.md` §3) listed shadcn/ui (Radix) for the UI. PR 5 built the wizard without it. Every control we need already works with plain HTML:

- City search is a working ARIA combobox (`src/features/location/stepPlace.tsx`, `useCitySearch.ts`).
- The method picker is a native `<select>`.
- Radios and checkboxes are native inputs.
- The per-prayer "Customise" panel is a `<details>` element.

What shadcn would add:

- Its combobox is two parts: `Popover` plus `Command`, and `Command` wraps the `cmdk` package.
- Its components need `class-variance-authority`, a class-merge helper (`clsx` + `tailwind-merge`, now also offered as a `cn` package), and a primitives library. That library is Radix, or Base UI, which is the default for new projects since July 2026.
- Radix does not read `dir` from the page. An RTL app must wrap everything in a `DirectionProvider`. shadcn's own RTL guide for Next.js asks for the same wrapper.
- shadcn does support Tailwind v4 and React 19 (since February 2025). So version support is not the problem.

Browsers now give us the hard parts for free:

- `<dialog>` with `showModal()` makes the rest of the page inert, moves focus inside, and closes on Esc. Widely available since March 2022.
- The `popover` attribute gives a top-layer popup with light dismiss (click outside or Esc). Widely available since April 2024.
- `<details>` / `<summary>` opens and closes from the keyboard with no script. Widely available since January 2020.

## Decision

- Drop shadcn/ui and Radix. Do not add `cmdk`, `class-variance-authority`, `clsx` or `tailwind-merge`.
- Build components from native HTML elements, styled with Tailwind CSS v4 and logical properties (`ms-`, `pe-`).
- Use Lucide icons through `lucide-react`. Direction icons (chevrons) mirror in Arabic with `rtl:-scale-x-100`.

| Need                              | Native solution                                                                |
| --------------------------------- | ------------------------------------------------------------------------------ |
| City search                       | Our own ARIA combobox (`input` + `listbox`), already built                     |
| Method, colour, calendar pickers  | `<select>`                                                                     |
| Prayer toggles, days, Jummah mode | `<input type="checkbox">` and `<input type="radio">`                           |
| Per-prayer "Customise"            | `<details>` / `<summary>`                                                      |
| "Remove all" confirm (PR 8)       | `<dialog>` opened with `showModal()`                                           |
| Skip-reason hint in the preview   | A `<button>` that opens a `popover` (toggletip), so touch and keyboard users get it too (was a hover-only `title` before PR 5) |
| Week ◀ / ▶ buttons                | Lucide `ChevronLeft` / `ChevronRight`, mirrored with `rtl:-scale-x-100`        |

## Consequences

**Good**

- Smaller bundle. No `cmdk`, no primitives library, no class-merge helpers.
- No RTL provider. The `dir="rtl"` on `<html>` is enough, because native elements and logical properties follow it.
- A design that is our own. The app does not look like every other stock shadcn site.
- Fewer dependencies for Dependabot and `pnpm audit` to track.

**Bad**

- We own more of the accessibility work: ARIA roles, focus order, keyboard keys, labels. Radix would have done some of this for us.
- We mitigate it with checks on every UI PR: a keyboard-only pass (Tab, Shift+Tab, arrows, Enter, Esc), and Chrome DevTools accessibility tree and Lighthouse accessibility audits on `/en` and `/ar`.
- Native elements have small styling limits (for example the `<select>` popup). We accept them.

**Revisit trigger.** If we need a complex widget that HTML does not offer, such as a date-range picker or a data table, we decide again for that one component. Adding one well-tested package for one widget is fine; it does not reopen this whole decision.

## Alternatives considered

- **shadcn/ui on Radix (the old plan).** Good accessibility out of the box. Rejected: extra packages, a `DirectionProvider` for Arabic, and a stock look. Its combobox (`cmdk` + popover) would replace a combobox we already have.
- **shadcn/ui on Base UI (the new shadcn default).** Same trade-offs, and a second migration path to follow.
- **Radix primitives alone, without shadcn.** Still needs the `DirectionProvider`, and the browser now covers dialog, popover and disclosure.

## Sources

Checked on 2026-11-18.

- shadcn/ui Combobox and Command docs (Command uses `cmdk`; combobox = Popover + Command): https://ui.shadcn.com/docs/components/radix/combobox, https://ui.shadcn.com/docs/components/radix/command
- shadcn/ui manual installation (`class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`): https://ui.shadcn.com/docs/installation/manual
- shadcn/ui `cn` migration (replaces `clsx` + `tailwind-merge`): https://ui.shadcn.com/docs/cli
- shadcn/ui changelog, Tailwind v4 and React 19 (February 2025): https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4
- shadcn/ui changelog, Base UI is the default (July 2026): https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- shadcn/ui RTL guide for Next.js (`DirectionProvider`): https://ui.shadcn.com/docs/rtl/next
- Radix Direction Provider ("required for right-to-left (RTL) localized apps"): https://www.radix-ui.com/primitives/docs/utilities/direction-provider
- MDN `<dialog>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- MDN `popover` attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover
- MDN `<details>`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details
