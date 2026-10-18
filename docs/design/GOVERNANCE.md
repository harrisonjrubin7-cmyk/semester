# Design-system governance

Who owns Semester's design system, how a new pattern gets in, how screens are
audited, and what is measured. A design system stays coherent only while
someone owns it; otherwise the fastest way to build a screen is to copy the
last one, and by November the last one is whatever was written last.

## 1. Owners

| Role | Owns |
|---|---|
| Product design | New patterns and the content standards |
| Frontend / design system | `lib/look.ts`, `components/ui.tsx`, `components/Page.tsx`, the lints, this folder |
| Accessibility | The `a11y/` tests, `smoke:a11y`, exceptions |
| Product | Whether a pattern solves the student's actual job |
| Engineering | Implementation and migration quality |
| Student and staff research | Whether it works for real people |

In a small team one person holds several roles. What matters is that every
role has a name against it in the pull request that changes its area.

## 2. Adding a new pattern

1. **Search first.** `components/ui.tsx`, `components/`, and
   [../DESIGN-SYSTEM-IMPROVEMENTS.md](../DESIGN-SYSTEM-IMPROVEMENTS.md) §2
   ("What exists and must be preserved").
2. **Show the existing one cannot serve.** In the PR description, in one
   paragraph.
3. **Propose** with its use cases, screen family
   ([INTERACTION-STANDARDS.md §1](INTERACTION-STANDARDS.md#1-screen-families)),
   states (§5), responsive behaviour at 760 and 1180, and keyboard and
   screen-reader behaviour.
4. **Measure** any new colour across all thirteen grounds (`lib/contrast.test.ts`).
5. **Approve or reject** — product design plus accessibility.
6. **Document** it here or in `DESIGN-SYSTEM-IMPROVEMENTS.md` §2.
7. **Migrate** the equivalents it replaces, or log them in
   [DESIGN-DEBT.md](DESIGN-DEBT.md).

A one-off pattern that skipped this is a review comment, not a follow-up.

## 3. Pull-request checklist

For any PR that adds or changes something a student sees:

- [ ] Screen family named; frame is `<Page>`/`<SettingsPage>`, or the
      "No `<Page>` here, deliberately" note explains why not.
- [ ] One primary action.
- [ ] Words match the [content standards](SEMESTER-CONTENT-STANDARDS.md);
      `npm run lint` is green (it includes the vocabulary rule).
- [ ] Loading, empty, error and permission states handled
      ([INTERACTION-STANDARDS.md §5](INTERACTION-STANDARDS.md#5-states)).
- [ ] Facts that could be mistaken for official carry a `SourceBadge`.
- [ ] Works by keyboard; focus visible; `useModal` for any overlay.
- [ ] Screenshot at phone and desktop width in the PR (`.claude/skills/run`).
      A dark rectangle is a failure to launch, not a dark theme.

## 4. Screen audit

Score each screen 0–2 per row. Record results in a table in this folder
(`SCREEN-AUDIT.md`) as screens are audited, with screenshot paths.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Frame | own/broken | partly shared | `<Page>` or documented exception |
| Structure | no hierarchy | partial | family order (interaction §1) |
| Visual system | one-off styling | mixed | tokens only, nothing in the style ledger |
| Type | inconsistent | mostly clear | `--type-*` scale |
| Action hierarchy | competing CTAs | mostly clear | one `ActionButton` |
| Navigation | inconsistent | mostly | consistent order and labels |
| States | missing | basic | all in interaction §5 |
| Trust / source | hidden | partial | `SourceBadge` + freshness |
| Responsive | desktop only | partial | 320 px → 1440 px and 200 % zoom |
| Accessibility | unverified | basic checks | keyboard, labels, contrast, tested |
| Words | inconsistent | mostly | canonical; nothing in the vocabulary ledger |

**20–22** design-system ready · **16–19** targeted migration · **11–15**
consistency refactor · **0–10** redesign before adding features.

Audit fields per screen: route, family, primary user, main job, primary
action, the eleven scores, priority, owner, target release, screenshots.

## 5. Visual regression testing

**Status: planned (DD-010).** The pieces exist: CI already builds the
production bundle, serves it at the deployed base path, and drives it with
Playwright for `smoke:cold` and `smoke:a11y` (`.github/workflows/ci.yml`).
The contrast sweep does the same per ground (`contrast.yml`). What is missing
is the comparison.

The intended shape:

1. A `smoke:visual` script beside `smoke:a11y`, reusing its browser and seeding.
2. Baselines for the shell, the `ui.tsx` primitives and the core flow (Today,
   Action Center, a course, Calendar, Study, Support) at 375, 768 and 1280 px,
   one light and one dark ground, calm on and off.
3. Pixel diff with a small tolerance; a failure uploads the diff as a CI
   artifact for a person to judge.
4. Baselines updated only by an explicit command, committed with the change
   that moved them.

Why it is not built in this change: font rendering differs between the
container and the CI runner, and a comparison that flakes on anti-aliasing
gets deleted. The baseline has to be produced on the runner, and that needs a
CI round-trip to prove rather than a guess.

Later viewports and states from the brief (320, 430, 1024, 1440 px; 200 %
zoom; hover, focus, disabled, loading, empty, error, permission, long text,
large text) extend the same script once the first set is stable.

## 6. Adoption metrics

```bash
cd app && npm run census:design
```

Figures at the commit this file was written at:

| Metric | Value | Direction |
|---|---|---|
| Screens framed by `<Page>` or `<SettingsPage>` | 73 of 86 (6 documented focus exceptions) | ↑ |
| `<ActionButton>` uses | 314 | — |
| Raw `<button>` elements | 1,089 | informational — most are rows and chips styled by class |
| Files using `EmptyState` | 25 | ↑ |
| Files using `SourceBadge` | 5 | ↑ |
| Hex colour literals in `.tsx` | 28 | ↓ |
| Off-scale style values (`styles/budget.ts`) | 27 | ↓ |
| Retired words in user-facing text (`content/ledger.ts`, `.tsx` and `.ts`) | 22 — none of them a student's own "task" | ↓ |

Tracked by hand until they can be measured: accessibility issues by severity
and age, visual-regression failures per release, audit score by module, and
the time to build a standard new screen.

## 7. Order of work

1. **Done here:** content standards, interaction standards, this governance
   doc, the debt register, the vocabulary lint with its ledger, and the
   census.
2. **Done:** the DD-001 rename, tasks → actions.
3. **Next:** DD-002 (the remaining "Something went wrong" messages); the
   DD-003 decision on source-label wording.
4. **Then:** the DD-010 visual baselines; DD-004 frames; DD-006 error token.
5. **Then:** object contracts (DD-005) starting with Service, and the screen
   audit table.
