# Semester UI/UX audit

This audit follows the template in the design-system audit brief. It covers
four source documents: the design-system and UI audit, the market-leader
teardown, the "further enhance" competitive memo, and a proposed `tokens.css`.
It records where each of their recommendations stands in the code: built,
fixed in this change, or open. An open item gets a file to start from.

## Audit scope

- **Audit date:** 2026-09-27
- **Release/branch:** `main` at `cbc6c5a`, and the branch that adds this file
- **Screens reviewed:** the course hub (`#/course/<id>`), registration
  (`#/yes`), Today, the graduation simulator, and the study studio, all by
  code. Course hub and registration were also screenshotted.
- **Viewports:** 420 × 900 (phone), 1024 × 800 (tablet with the rail),
  1440 × 900 (desktop)
- **Tools used:** `npm run lint` (style, label audits), `lib/contrast.test.ts`,
  `scripts/targets-sweep.mjs`, `scripts/accessibility-smoke.mjs`, and
  Playwright computed-style probes
- **Roles represented:** student only. Staff and admin screens are not
  covered here.

## Overall scores

No 1–5 scores are given. The brief's scorecard is meant to come from the
5–8 student task tests it describes, such as "What should you do first?" and
"Find your next official deadline and show how you know it is current".
Those tests have not been run. A number written without them would be a
guess. So each category has evidence and a status instead.

| Category | Status | Evidence |
|---|---|---|
| Visual consistency | Improved here | `features.css` overrode the Typeface and Corners settings on every screen that uses it. Fixed below. |
| Layout coherence | Improved here | `features.css` used five breakpoints of its own. It now uses the app's two (760, 1180). |
| Typography hierarchy | Built | Six named steps × `--text-scale` (`styles/rules.ts`). The lint fails on any raw font size. |
| Spacing consistency | Built | `--sp-1…7` × `--density`, with a per-file ledger in `styles/budget.ts` that may shrink but not grow. |
| Action hierarchy | Partial | Today has one "Next best step". `ActionCenter` shows the top item plus five more; the brief asks for three at most. |
| Responsive behavior | Built, not in CI | 320px reflow is checked in `scripts/accessibility-smoke.mjs`, which is outside `npm test`. |
| Accessibility | Built | Contrast is measured on 13 grounds × 11 accents. There are label, target, focus and motion tests under `a11y/`. |
| Source/trust clarity | Partial | `SourceBadge` has 5 labels plus freshness. There is no AI or External label, and no badge that expands. |
| Empty/error/sync states | Built | `EmptyState`, `ScreenTrouble`, `Trouble`, `Notice`, `freshnessSentence` |
| Onboarding/activation | Partial | `screens/Onboarding.tsx` has 5 steps. None of them is an accessibility step or a data-sources step. |

## Why the proposed `tokens.css` was not imported

The brief says not to treat its sample values as final, and to test every
pairing in every state. Measured against this codebase, importing the file
as written would undo things the app already guarantees:

| `tokens.css` says | This app already has | Why the app's version stays |
|---|---|---|
| One light palette (`--gray-*`, `--blue-*`) | 13 grounds (8 dark, 5 light) × 11 accents in `lib/look.ts`, written to `:root` by `App.tsx` | Every ground defines every token (`look.test.ts`). A fixed light palette would be one ground that ignores the theme setting. |
| `--space-1…9` at 4/8/12/16/24/32/48/64/96 | `--sp-1…7` at 2–16px × `--density` | Density is a student setting. A space scale without the multiplier turns it off wherever it is used. |
| `--type-*` as `font` shorthands in rem | `--type-*` × `--text-scale`, plus the student's `--font-heading`/`--font-body` | Text size and typeface are student settings. `a11y/type.test.ts` guards them. |
| `--radius-xs…xl` | `--r-sm/md/lg` from the Corners setting | `app.css` already notes that "the fix for two [radius scales] is not a third". |
| `[data-contrast="high"]` | Follows the device's `prefers-contrast: more` and `forced-colors` | A student-selectable high-contrast ground is a real gap (see P1 below). It belongs in `GROUNDS`, measured by `contrast.test.ts`, not in a second override block. |
| Motion tokens (100/160/220/320ms) | `--ease`, plus `data-calm` (a setting as well as the media query), guarded by `a11y/motion.test.ts` and `a11y/calm.test.ts` | Same intent. The app's version also honours the in-app setting. |

The brief's rules survive the translation: semantic tokens in components,
no hard-coded values, and every pair contrast-tested. They are enforced by
`styles/rules.ts` and `lib/contrast.test.ts`, not by a parallel vocabulary.

## Screen findings

| Route | Screen family | Issue | Severity | Evidence | Fix | Status |
|---|---|---|---|---|---|---|
| `#/course/<id>`, `#/yes`, study studio, graduation, journal | Ported "portal" screens | Headings, buttons and fields were set in `Arial`, overriding the student's Typeface setting | P1 | Computed `font-family: Arial, sans-serif` before; theme face after | `var(--font-heading)` and `var(--font-body)` | **Fixed here** |
| same | same | 27 literal radii (6–26px) overrode the Corners setting. On Square, panels were still 22px. | P1 | Computed `border-radius: 22px` with Square selected before; `0px` after | `--r-md` for controls, `--r-lg` for cards, `999px` for pills | **Fixed here** |
| same | same | Breakpoints at 480, 640, 800, 950 and 1300px. The rest of the app uses 760 and 1180. | P2 | `@media` census of `features.css` | Mapped onto the app's phone, tablet and desktop tiers. No horizontal overflow at 420, 1024 or 1440. | **Fixed here** |
| Calendar all-day band | Calendar | `4px` bar ends ignored Corners | P3 | `app.css` `.adband-bar` | `var(--r-sm)` | **Fixed here** |
| Graduation simulator | Planning | Never said "not an official degree audit" | P1 | The feature map; the brief's "Graduation and cost simulator" section | Stated in the body text, and pinned by `GraduationSimulator.test.tsx` | **Fixed here** |
| Today | Home | `ActionCenter` lists up to 6 rows. The brief says 3 priority rows before "View all". | P2 | `components/ActionCenter.tsx` | Cap the list at 3 and add "View all" | Open |
| Today | Home | No quick-capture field and no "continue where you left off" | P2 | `QuickActions.tsx` is navigation only | Put the existing `Capture` on Today, and add a resume row | Open |
| Source badges | Trust | No AI-generated or External label, and the explanation is a `title` tooltip only | P1 | `components/SourceBadge.tsx`, `lib/source.ts` | Add both labels, and make the badge a disclosure button | Open |
| Notifications | Trust | No per-notification "Why am I seeing this?" | P2 | `lib/notify.ts`, `screens/settings/Alerts.tsx` | Reuse `ExplanationSheet` | Open |
| External handoffs | Services | `window.confirm` names the destination only | P2 | `ActionCenter.tsx` | A handoff sheet giving destination, source and return path | Open |

## Token violations

| Token type | Location | Before | After | Priority |
|---|---|---|---|---|
| Font family | `features.css` (4 rules) | `Arial, sans-serif` | `var(--font-heading)` / `var(--font-body)` | P1, fixed |
| Radius | `features.css` (27) | 6, 7, 8, 10, 12, 13, 15, 16, 18, 20, 22, 24, 26px | `var(--r-md)`, `var(--r-lg)`, `999px` | P1, fixed |
| Radius | `app.css` `.adband-bar` (4) | `4px` | `var(--r-sm)` | P3, fixed |
| Breakpoint | `features.css` (6 queries) | 480, 640, 800, 950, 1300 | 759, 1179, 1180 | P2, fixed |

**The guard.** `sheetLiterals` in `styles/rules.ts` now makes `npm run lint`
and `scale.test.ts` fail on two things in any stylesheet:

- a named font face
- a radius from 3px to 998px

Two radii are listed as fixed geometry, each with its reason: the desktop
window frame and the chat composer. It was proven red against `main`'s
`features.css` (32 problems in that file) and green against the fix.

## Accessibility findings

| Criterion | Screen | Failure | User impact | Remediation | Test status |
|---|---|---|---|---|---|
| 1.4.12 / user settings | Portal screens | Typeface and Corners settings ignored | A student who picked a face for legibility got Arial here | Fixed here | `scale.test.ts` |
| 1.4.11 non-text contrast | High contrast on demand | No in-app high-contrast choice; the device setting only | Students on shared or lab machines cannot turn it on | Add a high-contrast ground to `GROUNDS` | Open |
| 1.1.1 / charts | `Plot`, `SheetChart` | `aria-label` summary only, with no table equivalent | Screen-reader and low-vision users cannot read the values | "Show as table" beside every chart | Open |
| 1.4.10 reflow | All | 320px is checked by a smoke script, not by CI | A regression can land without anyone seeing it | Move reflow into a CI job | Open |

## Everything else in the four documents

| Recommendation | Where it stands |
|---|---|
| Design-system folder (`foundations/components/patterns`) | Not adopted as a move. The foundations live in `lib/look.ts` + `styles/app.css`, and the components live in `components/ui.tsx`. `docs/DESIGN-SYSTEM-IMPROVEMENTS.md` §2 lists what exists. Moving 1,600 lines for the folder shape alone would be churn, not consistency. |
| Button component with an a11y contract | `ActionButton` in `ui.tsx` (46px), `.tappable`, and the targets sweep. The brief's contract (native `<button>`, `aria-busy`, 44px) is already met. |
| Automated contrast checker in CI | `lib/contrast.test.ts` covers every ground and every surface, not one pair. `scripts/contrast-sweep.mjs` does it in the browser. |
| 24px/44px target checker | `styles/taps.test.ts`, `scripts/targets-sweep.mjs` |
| Motion tokens and reduced motion | `--ease`, `data-calm`, `a11y/motion.test.ts`, `a11y/calm.test.ts` |
| Tabular figures | In about 26 files. It is not yet a single token for money and grades (P3). |
| Registration Day mode | `components/RegistrationDay.tsx`. Holds are only a self-check, and the official handoff has no link or return path (P2). |
| "Life happens" support | Split across `screens/Behind.tsx`, `lib/misses.ts`, `lib/support.ts` and `components/GetHelp.tsx` (9 needs). It has no single entry point (P2). |
| Source-aware AI | `intelligence/contracts.ts` and `intelligence/Disclosure.tsx` cover origin, authority, freshness and uncertainty. There is no route to a human inside an answer (P1). |
| Student trust dashboard | Split across `screens/Privacy.tsx`, `Data.tsx` and `Export.tsx`. There is no single "What Semester knows about me" page (P2). |
| Onboarding: accessibility step and data-sources step | Neither exists (P1). Start at `screens/Onboarding.tsx`. |
| Command bar wording | `components/Command.tsx` says "Search Semester". The brief wants "Ask Semester, search campus, or add an action" (P3). |
| Community: study groups, verified orgs, RSVP | Classmates, Groupwork and the clubs directory exist. Matching, verification and RSVP are open. The brief says not to launch these without moderation. |
| Integration maturity labels and freshness SLA | `lib/integration/catalog.ts` and `docs/data-contract.md` cover these. There is no maturity label that students can see (P3). |
| "Semester Launch in 90 Days" and outcome metrics | `docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md` is `NOT_STARTED`. `ANALYTICS.md` has activation but not "first meaningful action" or "time-to-help" (business, P2). |
| Visual regression tests | `scripts/baseline.mjs` takes screenshots but does no pixel diff and is not in CI (P2). |

## Migration plan

### P0: Blocking
- [x] None found in this pass.

### P1: High-impact
- [x] Portal screens follow the Typeface and Corners settings
- [x] The graduation simulator says it is not an official degree audit
- [ ] An accessibility step in onboarding (text size, motion, contrast)
- [ ] A high-contrast ground that students can pick
- [ ] AI and External source labels, and badges that expand
- [ ] A human-support route inside AI answers

### P2: Consistency
- [x] `features.css` on the app's two breakpoints
- [x] A lint guard against named faces and card radii in stylesheets
- [ ] Today: 3 priority rows at most, quick capture, and resume
- [ ] "Why am I seeing this?" on notifications
- [ ] A handoff sheet giving destination, source and return path
- [ ] Reflow and visual regression in CI

### P3: Polish
- [x] Calendar all-day bars follow Corners
- [ ] A tabular-figures token for money and grades
- [ ] The command bar placeholder
