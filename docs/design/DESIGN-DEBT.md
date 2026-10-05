# Design debt register

Inconsistencies in how Semester looks, reads or behaves, tracked like
technical debt. Every row is measured or pointed at a file; a row without
evidence does not go in.

**How to add a row:** next free ID, the evidence (a command, a file and line,
or a screenshot path), and the canonical pattern it should move to. Close a
row by linking the PR that fixed it and moving it to *Closed*.

**Priorities:** P0 blocks a core student flow or fails WCAG A/AA · P1 is
visible inconsistency on a core screen · P2 is inconsistency elsewhere ·
P3 is cleanup.

**Categories:** duplicate component · hard-coded colour · hard-coded spacing ·
custom type · inconsistent button · inconsistent card · non-standard
dialog/drawer · duplicate navigation · unclear terminology · missing state ·
broken mobile layout · accessibility gap · source/freshness inconsistency ·
legacy CSS.

Figures below are from `npm run census:design` and the lints, on the commit
this file was written at. Re-run them rather than trusting the numbers.

---

## Open

| ID | Where | Category | User impact | A11y impact | Evidence | Canonical pattern | Owner | Pri | Status |
|---|---|---|---|---|---|---|---|---|---|
| DD-002 | "Something went wrong" in `components/HelpInbox.tsx`, `lib/failure.ts`, `lib/trouble.ts`, `lib/ltilanding.ts`; `screens/Opportunities.tsx:193`, `screens/Pathway.tsx:1032` | unclear terminology | A bare "Something went wrong." with no next step; "unverified" where the source labels say "Needs review" | Error without recovery (WCAG 3.3.3) | `content/ledger.ts` | Error pattern (content standards §6); "needs confirmation" | Help / Planning | P1 | Guarded (ledger) |
| DD-003 | `lib/source.ts`, `SourceBadge`, DB enum `term_plan_courses.source_label` | source/freshness inconsistency | The source label says "Institution verified"; the content standard's word is "Official". Two words for the same trust level | — | `lib/source.ts:36` | Decide: keep the five labels (DB-backed) and use "Official" only in prose, or rename the display text only | Product + data | P2 | **Decision needed** |
| DD-004 | Bill, Directory, GapOffer, Grades, Mail, Respond, Search | duplicate navigation / layout | Seven screens draw their own frame with no recorded reason; spacing and search placement differ from their neighbours | Landmark and heading order unverified | `npm run census:design` — "Screens with neither frame" | `<Page>`, or a "No `<Page>` here, deliberately" note (interaction standards §1) | Frontend | P2 | Open |
| DD-005 | Every object but Action | missing contract | Services, courses, events and people are laid out per screen; the same service can show different fields in Help and on a course | — | interaction standards §2 | Written object contract per type | Design system | P2 | Open |
| DD-008 | 27 off-scale type, leading and spacing values | hard-coded spacing / custom type | Text size and density settings do not reach those values | Text-size setting partly ignored | `styles/budget.ts` | `--type-*`, `--leading-*`, `--sp-*` | Frontend | P3 | Guarded (style ledger) |
| DD-010 | Whole app | missing test | No screenshot comparison on pull requests; visual regressions are found by people | — | [GOVERNANCE.md §5](GOVERNANCE.md#5-visual-regression-testing) | Playwright screenshot baselines in CI | Frontend | P2 | Planned |

## Closed

| ID | Where | Category | User impact | A11y impact | Evidence | Canonical pattern | Owner | Pri | Status |
|---|---|---|---|---|---|---|---|---|---|
| DD-006 | `lib/look.ts` | missing state | Error and critical shared the warning treatment; a failure and a "possible conflict" looked the same | Colour never carried it alone, so not a WCAG fail — but rung order was lost | `errorFor` in `lib/look.ts`; `lib/contrast.test.ts` › "the error colour, on every ground" | `--app-error` (hue 350, held to 6:1 on every surface of all 13 grounds; warn stays hue 14 at 4.5:1); `--status-danger` now points at it | Design system | P2 | **Closed** in this change. Measured floor: error 6.10:1, warn 4.61:1. Industry Dark's error is a light rose (`#fdb9c5`) beside a peach warning (`#dba594`): that ground's surfaces are light for a dark ground, so 6:1 forces a light colour. Saturation 0.62 had made it a pastel `#f0c1c9`; 0.95 keeps it a rose. Guarded by mutation: pointing `errorFor` at `warnFor` fails four tests |
| DD-007 | `styles/app.css`, eight inline styles | legacy CSS | Transition durations were literals from 90 ms to 1.6 s; no two components agreed | `data-calm` and reduced motion were honoured, so none | `styles/motion.test.ts` | `--duration-fast`/`-standard`/`-slow`, `--motion-progress` | Design system | P3 | **Closed** in this change: eight literals moved onto tokens (120→130, 140/160/200→180, 220→240 ms), nine stay on a ledger with reasons (the launch splash, three loops, two progress/level meters). A new literal fails the build; a ledger entry whose literal is gone also fails |
| DD-009 | 30 hex literals in `.tsx` (was 31) | hard-coded colour | Colours that do not change with the ground; unmeasured for contrast | Possible contrast failures on some grounds | `styles/hex.test.ts`; `npm run census:design` | `--app-*` and `--chart-*` tokens | Frontend | P2 | **Closed** by a per-file ledger like DD-008's: ten files, each with the reason its colours must not follow the ground (exported canvases, video, a scannable code, Mermaid's theme, Leaflet markers, the call surface, a meta tag). `call/Bar.tsx` had white ink on `--app-warn` — 3.21:1 on Ink, 2.14:1 on Industry Dark, under 4.5 on all seven dark grounds — and now uses `--app-bg`, which measures 5.08:1 or better against warn on all 13 |
| DD-001 | 48 source files across Today, Mine, Calendar, reports, Export, Career, Mail, Nil, Work, Account, Privacy, Onboarding, Command palette, Settings, search, keyboard help, undo, the month grid, the Flight Plan, and the assistant's instructions | unclear terminology | A student's own items were "tasks" in one place and "actions" in the Action Center | WCAG 3.2.4 | Ledger `task` 35 → 0 student-facing; the rule now also reads `.ts` | "Your own actions"; navigation "By task" → "By goal"; coding-project stage "Tasks" → "Steps" | Product | P1 | **Closed** in #849. What stays: Google Tasks / Microsoft To Do names and API scopes (`lib/connect.ts`), search aliases kept so "task" still finds Mine (`lib/nav.ts`), staff-facing charter text, two code false positives, and course material in `data/` |
