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
| DD-001 | Today, Mine, Calendar, reports, Export, Career, Mail, Nil, Work, Account, Privacy, Onboarding, Command palette, settings/Assistant | unclear terminology | A student's own items are "tasks" in 21 files and "actions" in the Action Center — two words for one idea on the same screen | WCAG 3.2.4 (consistent identification) | `content/ledger.ts`: `task` 35 across 21 files, `to-do` 1 | "Your own actions" (content standards §2) | Product | P1 | Guarded (ledger); rename not started |
| DD-002 | `components/HelpInbox.tsx:73`; `screens/Opportunities.tsx:193`, `screens/Pathway.tsx:1032` | unclear terminology | A bare "Something went wrong." with no next step; "unverified" where the source labels say "Needs review" | Error without recovery (WCAG 3.3.3) | `content/ledger.ts` | Error pattern (content standards §6); "needs confirmation" | Help / Planning | P1 | Guarded (ledger) |
| DD-003 | `lib/source.ts`, `SourceBadge`, DB enum `term_plan_courses.source_label` | source/freshness inconsistency | The source label says "Institution verified"; the content standard's word is "Official". Two words for the same trust level | — | `lib/source.ts:36` | Decide: keep the five labels (DB-backed) and use "Official" only in prose, or rename the display text only | Product + data | P2 | **Decision needed** |
| DD-004 | Bill, Directory, GapOffer, Grades, Mail, Respond, Search | duplicate navigation / layout | Seven screens draw their own frame with no recorded reason; spacing and search placement differ from their neighbours | Landmark and heading order unverified | `npm run census:design` — "Screens with neither frame" | `<Page>`, or a "No `<Page>` here, deliberately" note (interaction standards §1) | Frontend | P2 | Open |
| DD-005 | Every object but Action | missing contract | Services, courses, events and people are laid out per screen; the same service can show different fields in Help and on a course | — | interaction standards §2 | Written object contract per type | Design system | P2 | Open |
| DD-006 | `lib/look.ts` | missing state | Error and critical share the warning treatment; a failure and a "possible conflict" look the same | Colour never carries it alone, so not a WCAG fail — but rung order is lost | interaction standards §4 | A measured error token, with `lib/contrast.test.ts` rows across all 13 grounds and every surface | Design system | P2 | Open |
| DD-007 | `styles/*.css` | legacy CSS | Transition durations are literals from 90 ms to 1.6 s; no two components agree | `data-calm` and reduced motion are honoured, so none | `grep -oE "[0-9.]+m?s" styles/*.css` in transitions | `--dur-standard` (150–200 ms), `--dur-panel` (200–250 ms) | Design system | P3 | Open |
| DD-008 | 27 off-scale type, leading and spacing values | hard-coded spacing / custom type | Text size and density settings do not reach those values | Text-size setting partly ignored | `styles/budget.ts` | `--type-*`, `--leading-*`, `--sp-*` | Frontend | P3 | Guarded (style ledger) |
| DD-009 | 28 hex colour literals in `.tsx` | hard-coded colour | Colours that do not change with the ground; unmeasured for contrast | Possible contrast failures on some grounds | `npm run census:design` | `--app-*` tokens | Frontend | P2 | Open — needs a per-file ledger like DD-008 |
| DD-010 | Whole app | missing test | No screenshot comparison on pull requests; visual regressions are found by people | — | [GOVERNANCE.md §5](GOVERNANCE.md#5-visual-regression-testing) | Playwright screenshot baselines in CI | Frontend | P2 | Planned |

## Closed

*(none yet)*
