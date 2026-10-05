# Design system improvements — feature expansion, Phase A

**Baseline:** `semester-unified-platform` at `1c8ab70`.

This document says:

- what the design system already is (§1–2), and what must not be broken;
- what is wrong with it (§3);
- the exact contract for the fourteen component patterns the feature phases
  need (§4).

Nothing here has been implemented. Every component below is built the first
time a phase needs it, as [UX-ENHANCEMENT-PLAN.md §5](UX-ENHANCEMENT-PLAN.md#5-phase-b--exact-files-awaiting-confirmation)
does for Phase B, and not as a speculative library.

---

## 1. The token system: preserve it exactly

`app/src/lib/look.ts` (1,667 lines) is the design system. It is data, and
`App.tsx` writes it onto `:root` as CSS custom properties. The rules below are
load-bearing; each one was paid for by a bug, as the file's own docblocks
record.

| Keep | Where | Why it must not move |
|---|---|---|
| **Every ground defines every token** | `tokensFor()`, checked by `look.test.ts` | A half-defined theme looks different depending on the previous theme. |
| Colour tokens: `--app-void`, `-bg`, `-panel`, `-hero`, `-raise`, `-fg`, `-dim`, `-faint`, `-row-dim`, `-passing`, `-warn`, `-warn-line`, `-warn-wash`, `-accent`, `-accent-bright`, `-accent-deep`, `-accent-wash`, `-accent-fill`, `-line`, `-line-top`, `-line-soft`, `-track` | `look.ts:1362+` | New components use **only** these. They add no hex values and no new colour tokens without a `contrast.test.ts` row across all 13 grounds. |
| 11 accents × 13 grounds, with `deep` and `shade` measured against the washed panel | `ACCENTS`, `GROUNDS`, `lib/contrast.test.ts` | See `CLAUDE.md` §Contrast. A light ground's void is two steps darker than its panel, so measure against every surface. |
| Chrome tokens: `--chrome`, `--chrome-glint`, `--chrome-ink`, `--glow`, `--tile-*` | `look.ts` | These are the metal CTA. There is one primary per view. |
| Shape: `--r-sm`, `--r-md`, `--r-lg`, `--icon-radius` from `CORNERS`, resolved per ground | `resolveCorners` | Components use `var(--r-*)`, never a literal radius. (`features.css` uses `8px` and `20px`; §3.) |
| Spacing `--sp-1…7` = 2/4/6/8/10/12/16 × `--density` | `app.css:199-205`, `DENSITIES` | Density is a student setting. A literal `px` margin ignores it. |
| Type `--type-*` × `--text-scale`; `--leading-*` | `app.css:99-290`, `SIZES` | Text size is a student setting. `a11y/type.test.ts` guards it. |
| `--font-heading`, `--font-body`, `--font-heading-weight` | `TYPEFACES`, `BODYFACES` | These are student settings. Arial overrides defeat them (§3). |
| `--line-height`, `--reading-width` | `LINE_HEIGHTS`, `READING_WIDTHS` | Student settings. |
| `data-calm` = `device`, `still` or `calm` | `CALMS`, `lib/prefers.ts`, `app.css:8178+`, `a11y/motion.test.ts`, `a11y/calm.test.ts` | Reduced motion is **a setting, not only a media query**. New motion must honour both `prefers-reduced-motion` and `data-calm`. |
| Dark and light via grounds, with `color-scheme` set in `App.tsx:1109` | `resolveGround`, `MATCH_DEVICE` | There is no `prefers-color-scheme` CSS anywhere, and none is to be added. |
| `--ease` | `app.css:298` | The one easing curve. |
| Breakpoints 760 and 1180, with `TALL_AT` 600 | `lib/media.ts` (`WIDE`, `DESKTOP`, `HANDHELD`, `TOUCH`) | These are the canonical breakpoints (§3). |

## 2. What exists and must be preserved

| Pattern | Existing component | Reuse rule |
|---|---|---|
| Focus trap and Escape | `a11y/modal.ts` `useModal` (12 users) | Every new overlay uses it. Never hand-roll a trap. |
| Irreversible confirm | `components/TypeToConfirm.tsx` | Delete account, erase and remove course. New irreversible actions (delete source, revoke share) use it. |
| Undo | `components/Undone.tsx` + `lib/undo.ts` (8 s, polite, never takes focus) | The **only** undo toast. New reversible actions register with it. |
| Announcements | `components/Said.tsx` (`dispatch({type:'say'})`) | The one live region. New components do not add their own `aria-live` except `Undone` and `Trouble`. |
| Empty | `ui.tsx` `EmptyState` (with `action`, `inline`) | Extend it; do not fork it. |
| Error | `Boundary.tsx` `ScreenTrouble`, `Trouble.tsx`, `ui.tsx` `Notice` | Reuse. |
| Route loading | `App.tsx` `Loading()` skeleton | Its reasoning (skeleton over spinner) extends to in-screen loading. |
| Chips and tabs | `ui.tsx` `ChipScroll`, `ChipRow`, `PickChips`, `Segmented`, `TabList`, `Toggle` | Reuse. Overflowing tab rows use `ChipScroll`. |
| Progress | `ui.tsx` `Meter` (`role="progressbar"`, required `label`) | Every new progress bar uses it. |
| Charts | `Plot`, `SheetChart`, `MasteryGraph` (`role="img"` + `aria-label`) | New charts follow the same pattern and also carry a text or table equivalent. |
| Words instead of scores | `components/Standing.tsx` | This is the model for Study Readiness. There is no percentage mastery. |
| Disclaimers | `components/NotOfficial.tsx` | This is the prose disclaimer. `SourceBadge` is its compact form. |
| AI provenance | `intelligence/Disclosure.tsx` | This is the model for Source Locker provenance. |
| Buttons | `ui.tsx` `ActionButton` (`HEIGHT = 46`), `.bare`, `.tappable` | The primary CTA stays `ActionButton`. |

**Orphaned CSS to remove or adopt, never to duplicate:**

- `.dialog`, `.dialog-backdrop` and `.dialog-*` in `industry.css:341-356`
  have no TSX usage. `ConfirmDialog` (§4.9) adopts them.
- `.card-*` in `industry.css:285-297` has no TSX usage.

## 3. Problems to fix

| ID | Problem | Measure | Fix and when |
|---|---|---|---|
| DS-1 | `features.css` hard-codes `font-family: Arial` on the portal and study-studio | 4 rules (`features.css:22,27,33,171`) | Replace with `var(--font-body)` / `var(--font-heading)`. **Phase O**, with screenshots of `yes`, the course hub and study. The change is visible, so it needs sign-off. |
| DS-2 | Literal radii and colours in `features.css` (`8px`, `20px`, `border-radius:999px`) | `grep -c "border-radius:[0-9]" styles/features.css` | Use `var(--r-*)`. Phase O. |
| DS-3 | 19 breakpoints, 5 of them only in `features.css` | See UX plan §1.4 | New CSS uses 760 and 1180 only. Phase O migrates `features.css`. |
| DS-4 | The type scale has 21 steps and 6 half-steps | `app.css:99-162` | **Do not delete steps** (2,528 usages). New components use a **semantic subset** only: `--type-xs` meta, `--type-sm` secondary, `--type-md` body/row, `--type-lg` card title, `--type-display-sm` section, `--type-display-lg` screen. A later pass aliases the half-steps to the nearest semantic step, behind `a11y/type.test.ts`. |
| DS-5 | 5,401 inline-style lines | See UX plan §1.4 | New components are class-only. Existing screens are converted only where a phase already edits them. |
| DS-6 | `.workspace-text-button` has no base rule, and `.today-timeline-row` has no reset | UX plan H-2 | Phase B §5.1. |
| DS-7 | Status has no shared component | Ad-hoc text in `today-decision`, `.portal-warning` | `StatusChip` (§4.1). |
| DS-8 | No stylesheet lint for new literals | — | Extend `npm run lint`'s style audit (`scripts/`) to refuse new hex values and px radii in `styles/` outside `industry.css`. Phase O. |

---

## 4. The fourteen patterns

Every component below meets the same bar, which is listed once here rather
than fourteen times:

- **Mobile and desktop.** It is laid out at 390px and at 1280px, and at 1180px
  and above it may use the extra width.
- **Keyboard.** Every action is reachable by keyboard, focus is visible (the
  `a11y/focus.test.ts` ring), and there is no swipe-only or hover-only action.
- **Screen reader.** It has a name (`scripts/labels.mjs` must pass) and a role
  where a role exists. State is conveyed in text, not colour
  (`a11y/tellings.test.ts`).
- **Reduced motion.** It has no motion under `prefers-reduced-motion: reduce`
  or `data-calm` `still` or `calm`. Under `calm`, shadows and gradients are
  dropped too.
- **Tokens.** Tokens only, with no literals, and it is verified on at least
  one dark ground (`ink`) and one light ground (`parchment`).
- **States.** Loading, empty and error are defined for any component that
  holds data.
- **Tests.** A render test, a keyboard test and a label test, with each guard
  shown red against a revert (`CLAUDE.md`).

Components live in `app/src/components/`, and pure logic lives in
`app/src/lib/`.

### 4.1 Source Badge · Freshness Badge · Confidence Badge · Status Chip

These are the smallest and most-used pieces, so they come first (Phase B).

```ts
// lib/source.ts
export type SourceLabel =
  | 'institution_verified' | 'imported' | 'student_entered' | 'estimated' | 'needs_review';
export const SOURCE_TEXT: Record<SourceLabel, string> = {
  institution_verified: 'Institution verified',
  imported: 'Imported',
  student_entered: 'Student entered',
  estimated: 'Estimated',
  needs_review: 'Needs review',
};
```

**Source Badge.**

- **Anatomy.** A small outlined chip: `--type-xs`, `--app-dim` text,
  `1px var(--app-line)`, `--r-sm`. The first letter-mark is a glyph that is
  never colour-only.
- **Variants.**
  - `needs_review` uses `--app-warn-line`, a glyph *and* the word.
  - `estimated` adds "Planning guidance only" when `long` is set.
- **Behaviour.** An optional `onReport` renders "Report incorrect" beside the
  badge. It is a real button, and it is how rule 3's "correct" control
  reaches every figure.

**Freshness Badge.**

- **Text.** "Updated today", "Updated 3 days ago" or "Last synced
  27 Sep, 9:14". It says "Not current" when `isStale(at, maxAge)` is true.
- **Offline.** It adds "Offline" when `navigator.onLine` is false, which is
  the seed of Phase M's badge.
- **Honesty rule.** It never renders "Live". Nothing in Semester is live
  without an institution feed (D-007).

**Confidence Badge.**

- **Values.** `High`, `Medium` or `Low` confidence, with a one-line reason in
  the Explanation Sheet.
- **Where it may appear.** Only on derived recommendations, and **never on a
  person**: there is no confidence about a student's ability.

**Status Chip.**

- **Values.** `on-track`, `choices`, `needs-details`, `done`, `snoozed` and
  `offline`.
- **Wording.** The text is always the full approved sentence or word. The
  `today-decision` statuses map as:
  - `moving` → "On track based on your current plan"
  - `review` → "A few choices could affect your timeline"
  - `incomplete` → "Add a few details to see a clearer path"

### 4.2 Action Card

- **Anatomy.**
  - Header: `SectionLabel` kicker.
  - Title: specific, one line, with 2 lines at most on mobile.
  - "Why now" line.
  - Primary `ActionButton`: one only.
  - Secondary row with Why this? · Snooze · Dismiss · Correct.
  - `SourceBadge` + `FreshnessBadge`.
- **Variants.**
  - `primary`: the Next Best Step, one per view.
  - `urgent`: at most one on Today.
  - `compact`: a row that is 44px or taller, with the secondary controls
    behind a `Popover` "More" button, never behind a swipe.
- **Snooze options.** Later today, Tomorrow and Next week, with quiet-hours
  awareness in Phase C.
- **Dismiss.** Optional reasons: not relevant, already done, wrong
  information (which opens Correct), or no reason. It is undoable through
  `Undone`.
- **Correct.**
  - Opens a short text field that is stored as a `correction` in the action
    store.
  - Offers "Send to Semester" through the existing `lib/feedback.ts`
    `wrong` kind, only when signed in and after preview.
- **Screen reader.** An `<article aria-labelledby=title>`. The state ("Snoozed
  until tomorrow") is in the accessible description.

### 4.3 Recommendation explanation shape

```ts
// lib/actions.ts — required, so a recommendation missing a part does not compile
export interface Explanation {
  whyNow: string;
  whyThis: string;
  sources: { label: SourceLabel; name: string; at?: number }[];
  impact: string;          // "Keeps Spring registration on your planned timeline"
  limitations: string;     // "Based only on requirements you entered"
  alternatives: { title: string; open?: () => void }[];   // may be [] with a reason in limitations
}
```

### 4.4 Recommendation Explanation Sheet

This is the container for §4.3. It is `ExplanationSheet`, which renders
§4.5 or §4.6 depending on width.

**Sections, in fixed order:**

1. Why now
2. Why this
3. Based on (`SourceBadge` list)
4. What it changes
5. What it can't tell you
6. Other options
7. Controls: Snooze · Dismiss · Correct

Headings are `h3` so the student can navigate by heading, and the first
heading receives focus on open.

### 4.5 Mobile Bottom Sheet

- **Where it applies.** Under 760px. From 760 to 1179px it is capped at 560px
  wide and centred.
- **How it opens and grows.**
  - It is portalled into `.device`, per the existing overlay convention.
  - `role="dialog" aria-modal="true"`, with `useModal` for the trap, Escape
    and focus return.
  - It opens to 60% of the height and grows to 92%, using the drag
    thresholds already used by `ai/Panel.tsx` (40px) and `TileSheet` (70px).
- **How it closes.** A visible **Close** button (the drag handle is never the
  only way out), a tap on the backdrop, or Escape.
- **Layout.**
  - It sits above the bottom chrome, using `--bottom-chrome` from
    `lib/bottomchrome.hook.ts`.
  - Body scroll is locked.
  - It respects `env(safe-area-inset-bottom)`.
- **Motion.** A 200ms translate with `--ease`. With reduced motion there is no
  animation: it simply appears.
- **Consolidation.** `ai/Panel.tsx`, `TileSheet` and `desk/Customize` keep
  their own sheets until Phase O. Migrating them onto this component is a
  separate refactor, because each has tests on its drag behaviour.

### 4.6 Desktop Detail Drawer

- **Placement.** At 1180px and above only. It docks right at 400px and pushes
  the content column rather than covering it, using the ≈100px gutter plus
  the column shrinking to `--reading-width`.
- **Semantics.** A `<aside role="complementary" aria-labelledby>`. It is
  **not modal**: the page stays operable.
- **Focus.** Escape closes it, and focus goes to the drawer on open and back
  to the opener on close.
- **One at a time.** Opening another replaces the content in place and
  announces it through `Said`.
- **Uses.** Explanation Sheet, Course Detail v2 (Phase F), office-action detail
  (Phase J) and the share manager (Phase G).

### 4.7 Empty State: extend `EmptyState`

Add three props:

- `source?`: what would fill this and where it comes from ("Import your
  school's course catalog").
- `secondary?`: a second, quieter action.
- `tone`:
  - `first-run` is the existing full form;
  - `cleared` is Done-for-today: calm, with no icon and no action required;
  - `filtered` is inline, with a "Clear filters" action.

Replace the `.portal-empty` fork in `features.css` in Phase O.

### 4.8 Skeleton Loader

- **API.** `Skeleton({ rows, shape: 'card' | 'row' | 'chip', label })`, whose
  bars are `var(--app-hero)`, as in `App.tsx`'s `Loading()`.
- **Semantics.**
  - The container has `aria-busy="true"` and an `aria-label` ("Loading your
    plan").
  - The bars are `aria-hidden`.
- **Motion.** There is no shimmer at all under `still` or `calm` or with
  reduced motion. Otherwise it is a 1.2s opacity pulse; no gradient sweep.
- **Timing.** It appears only after 150ms, so fast loads don't flash. It
  reserves the final height, so there is no layout shift.

### 4.9 Confirmation Dialog

This is for **reversible or consequential** actions that need a preview:

- share
- export
- calendar write
- email draft
- official-system handoff
- sending feedback

Irreversible actions stay on `TypeToConfirm`.

- **API.** `ConfirmDialog({ title, preview: ReactNode, consequences: string[], confirmLabel, onConfirm, onCancel, tone: 'default' | 'external' })`.
- **The preview is mandatory and is the point.** It shows exactly:
  - what will be written, shared or exported, with the rows or fields;
  - to whom;
  - for how long (the share expiry).
- **The `external` tone.** Used for official-system deep links. It adds
  "You are leaving Semester. Semester cannot see or change what happens
  there."
- **Semantics.** `role="dialog" aria-modal="true"` with `useModal`. The
  initial focus is on **Cancel**, never on Confirm.
- **Styling.** Adopt the orphaned `.dialog-*` classes in `industry.css`.
- **Undo.** If the action is reversible, it registers with `Undone`.

### 4.10 Undo Toast: reuse `Undone`

No new component. New reversible actions go through `lib/undo.ts`:

- dismiss
- snooze
- remove from plan
- revoke-then-restore within 8s

Today's local "Undo" in `TodayDecisionSurface` moves onto it in Phase B.

### 4.11 Scenario Comparison Card

- **Use.** Phase D, and the Phase C backups.
- **Layout.**
  - Two columns (Current plan | Proposed) at 760px and above.
  - Under 760px, one panel with a `Segmented` Current / Proposed switch and a
    "What changes" summary pinned on top.
- **Rows.** Graduation term, total credits, requirements covered, max term
  load, prerequisite chain changes and estimated cost. Each row is a
  `<table>` row: this is real tabular data, so screen readers get headers.
- **Deltas.** Written out in words and a sign ("+1 term", "−3 credits"), never
  colour alone.
- **Labels.** Every figure has a `SourceBadge`, and scenario figures are
  `estimated`. There is a card-level "Planning guidance only" line.
- **Actions.** Save draft, Compare another, and Share with advisor (through
  `ConfirmDialog`).
- **Reuse.** `GraduationSimulator`'s `compareLine`, `project` and `summary`
  in `lib/graduation.ts`. The card is presentation only.

### 4.12 Course Detail Card

- **Use.** Phase F. It is a card in the search results and the cart, and it
  expands into the Detail Drawer at 1180px and above or the Bottom Sheet
  under 760px.
- **Header.** Code, title, term, credits, modality, meeting time and
  `SourceBadge` + `FreshnessBadge`.
- **Fit rows**, each with a text status and an explanation:
  - requirement fit;
  - prerequisites / co-requisites (met, not met or unknown, with **unknown
    shown as unknown**);
  - schedule fit (uses `lib/registration.ts` `conflicts()`);
  - plan impact.
- **Actions.** Save, Compare, and Add to draft (`ConfirmDialog`, with a
  preview of the plan after).
- **Handoff.** An official catalog link through the `external` tone.
- **What it never shows:**
  - seat availability as fact (only "Imported · as of …");
  - a professor rating;
  - a workload claim.

### 4.13 Data Privacy Panel

- **Use.** The Phase N Trust Center, and inline wherever data is shared.
- **Row anatomy.** Each row is:
  - **what**, such as "Registration day plan";
  - **where** it lives: this device, your account, or shared with {name};
  - **source**;
  - **last sync**;
  - **controls**: View, Export, Delete, Revoke.

  Rows are grouped by where they live.
- **Sources.**
  - Rows are generated from `lib/privacy.ts` `CLAIMS` and
    `lib/workspace-backup.ts`, so the panel cannot drift from what is really
    stored.
  - A test asserts that every `semester.*.v1` key read by a `useDeviceLibrary`
    call has a row. That test also closes the export gap noted in the
    crosswalk (N-3).
- **Irreversible controls.** They use `TypeToConfirm`, and Revoke uses
  `ConfirmDialog` + `Undone`.

### 4.14 Quick Actions and the context pane (Phase B supporting pieces)

**Quick Actions.**

- **Layout.** A row of at most five compact buttons: icon + label, never
  icon-only. It scrolls horizontally with `ChipScroll` under 760px.
- **Order.** The order is fixed, with no personalisation or usage-based
  reordering (rule 7).

**Today context pane.**

- **Where.** At 1180px and above only, in the right gutter. It is an
  `<aside aria-label="Today at a glance">`.
- **Contents.** At most four blocks, each with a `FreshnessBadge`.
- **Below 1180px.** It is not rendered, and its content is not duplicated into
  the column.

---

## 5. Rollout order

| Phase | Components first needed |
|---|---|
| B | Source / Freshness / Confidence badges, Status Chip, Action Card, Explanation shape and Sheet, Bottom Sheet, Detail Drawer, Undo via `Undone`, Quick Actions, context pane |
| C | Confirmation Dialog (`external` tone for the registration handoff) |
| D | Scenario Comparison Card |
| E | Skeleton (density view computes) |
| F | Course Detail Card |
| G, N | Data Privacy Panel |
| O | DS-1…DS-5 and DS-8 migrations, sheet consolidation, and the `EmptyState` fork removal |

## 6. Rollback

Each component is additive and used only behind its phase's flag. Removing a
phase's flag usage leaves the component unused and harmless. The Phase O
migrations (DS-1…DS-5) are visible, always-on changes. Each ships as its own
commit with before and after screenshots, so it can be reverted without
touching feature work.
