# UX enhancement plan — feature expansion, Phase A

**Baseline:** `semester-unified-platform` at `1c8ab70` (on `origin/main`
`c029822`), audited 27 Sep 2026.

**Scope:** Phase A is audit and plan only. No product behaviour, UI or data
model was changed to produce this document.

**Companion documents:**

- [DESIGN-SYSTEM-IMPROVEMENTS.md](DESIGN-SYSTEM-IMPROVEMENTS.md): the tokens to
  keep and the fourteen component patterns to add.
- [FEATURE-EXPANSION-CROSSWALK.md](FEATURE-EXPANSION-CROSSWALK.md): where each
  of Phases B–O lands, and what already exists for it.

**How this was measured:**

- The dev server was driven in headless Chromium at 390×844 and 1280×900,
  per `.claude/skills/run`, with the default nav (`tabs`), the default shell
  and the shipped sample courses.
- Screens captured: `home`, `course/econ`, `degree`, `yes` and `privacy`. No
  `pageerror` fired on any of them.
- The static figures below come from `grep` over `app/src`, and each one names
  its command.
- Figures from the running app are labelled *observed*.

---

## 1. What the student sees today

### 1.1 Visual hierarchy problems

| # | Problem | Evidence | Why it matters |
|---|---|---|---|
| H-1 | **Three visual languages on one screen.** The shared frame is the "drawn" language: Barlow Condensed caps, blueprint crosshairs, metal buttons. The Course hub and Registration portal switch to rounded panels and **Arial** headings. A third look is UA-default buttons (H-2). | `styles/features.css:22,27,33,171` sets `font-family: Arial` on `.portal-workspace` headings, buttons and inputs, and on `.study-studio`. *Observed* on `#/course/econ` and `#/yes`. | The student can't tell from the chrome whether they are in the same product. It reads as bolted-on, and hurts consumer appeal most of all. |
| H-2 | **Unstyled buttons on Today.** "View My Path →", "Not now" and "See full plan →" render as grey UA buttons in the system font. The four "What is coming up" rows render as grey UA buttons with white borders. | `.workspace-text-button` has only a `:hover` rule (`features.css:11`) and no base rule. `.today-timeline-row` (`app.css:7327`) never resets `background`, `border` or `font`. *Observed* at both widths. | This is the most visible defect on the most-visited screen, and it was introduced by #761. The fix is in §5.1. |
| H-3 | **The type scale is too finely divided to create hierarchy.** There are 21 `--type-*` steps from 9px to 28px, six of them half-pixel steps. Body is 13px. | `app.css:99-162`. `grep -o "font-size: *[^;]*" styles/*.css` finds 49 distinct values. Most are on-scale `calc(Npx * var(--text-scale))`, and the lint style audit reports 16 type uses still off the scale across 17 files. Non-test TSX has 2,464 raw numeric `fontSize:` values. | Neighbouring steps (13 vs 13.5, 14 vs 14.5) cannot be told apart. Hierarchy then falls to caps, tracking and weight, and every section label looks equally important. |
| H-4 | **The primary action and the dismiss control are the same weight as secondary prose.** The Next Best Step's "Not now" is a small grey pill below a large metal CTA. "Why am I seeing this?" is plain body text. | *Observed*, `home` at 390px. | Snooze, dismiss and correct are required by rule 3. Today they are either missing (snooze, correct) or hard to find. |
| H-5 | **Screen titles leak internal names.** Registration shows **"YES"** (Vanderbilt's system name) under the kicker "Registration, and the road back". | *Observed*, `#/yes` desktop. | Rule O asks every page to answer "Where am I?". "YES" answers it only for people who already know. |
| H-6 | **Disclaimers are louder than content.** The degree screen opens with a 60-word framed "Your arithmetic, not the registrar's" block. Privacy opens with a single paragraph of about 220 words. | *Observed*, `#/degree` and `#/privacy` at 390px. | The honesty is right and must stay. The *form* is wrong: a source badge plus an expandable explanation says the same thing in a line. |

### 1.2 Dashboard clutter (Today)

Today (`screens/Today.tsx`, 1,928 lines) stacks up to **eleven** blocks before
the student reaches their own feed:

```
Header · sample-data banner · "Collapse all"
Segmented: Today | Hours | This week | Done
TodayDecisionSurface  → Your path · Next best step · Next 72 hours · sync line
FlightPlanHomeSlot
RecommendedJourney    ("Also useful")
TodayFeed             → Feed_next (NextClassCard, OverdueBanner, Waiting)
                        Feed_due · Feed_tasks · Feed_since · Feed_walks
                        Feed_rail · Feed_dropby · Feed_registrar · Feed_bill
```

What is wrong with that stack:

- **The same items are listed three times.** The next class and the next
  deadline appear in:
  - "What is coming up" (72 h);
  - `NextClassCard` / `Feed_due`;
  - "The next seven days" (`ThisWeek`).

  `.today-decision-surface ~ .today-next-class-legacy` (`app.css:7220`) hides
  one duplicate with CSS, and only in some navs. The `feed` nav
  (`FeedHome`, `Today.tsx:1754`) renders `TodayDecisionSurface` *and*
  `NextClassCard` together.
- **The student's first screen is almost all framing.** At 390px the
  first viewport shows the path card and the Next Best Step and nothing
  else. The student's own commitments begin below the fold.
- **"Done for today" does not exist as a state.** When everything is ticked,
  the surface still shows the path card and a Next Best Step, with
  "Nothing unfinished is recorded in the next 72 hours" in small print.
- **The FAB overlaps content.** At 390px the Ask button (✦) covers "Not
  now" on Today and the last lines of Privacy. *Observed*.

### 1.3 Empty, loading and error states

Existing primitives, found by the component inventory in
[DESIGN-SYSTEM-IMPROVEMENTS.md §2](DESIGN-SYSTEM-IMPROVEMENTS.md#2-what-exists-and-must-be-preserved):

| State | Exists | Gap |
|---|---|---|
| Empty | `EmptyState` (`components/ui.tsx:739`), with a required-when-possible `action`. Used in 24 files. | Many screens still write an ad-hoc `<p role="status">`, for example `CourseHub` "No assignments match this view." Registration's empty catalog uses a fourth style, `.portal-empty`. |
| Loading | `Loading()` skeleton in `App.tsx:119`, for route-level Suspense only. `ai/Turns.tsx` `Waiting` covers the assistant. | There is **no in-screen skeleton and no `aria-busy`**. Sections that compute or fetch either render nothing (`fallback={null}` in 4 places) or render final layout late, which causes layout shift. |
| Error | `ScreenTrouble` boundary (`components/Boundary.tsx:83`); `Trouble` inline retry (`components/Trouble.tsx`); `Notice alert`. | These are good and should be reused. The gap is consistency: new modules must use `Trouble` rather than inventing a fourth. |
| Stale or offline | `public/sw.js` serves the cached shell, and `ScreenTrouble` handles "offline, never downloaded". | Nothing tells the student that **what they are looking at** is stale. There is no last-sync line outside Today's `syncLabel`. |
| Undo | `Undone` toast (`components/Undone.tsx`), 8 s, polite. `TypeToConfirm` handles irreversible actions. | The Next Best Step's dismiss uses its own inline "Undo" (`TodayDecisionSurface.tsx:44`), which is lost on navigation because it is `useState` only. |

### 1.4 Mobile responsiveness gaps

- **Breakpoints.** There are 19 distinct width and height breakpoints. The
  canonical ones are `lib/media.ts`: `TABLET_AT = 760`, `DESKTOP_AT = 1180`
  and `TALL_AT = 600`. `features.css` alone adds five non-canonical widths:
  480, 640, 800, 950 and 1300. **Rule: new CSS uses only 760 and 1180, via
  `lib/media.ts` in script.**
- **No shared bottom sheet.** Three hand-rolled ones exist:
  - `ai/Panel.tsx`, with a drag threshold of 40;
  - `nav/TileSheet.tsx`, with a swipe threshold of 70;
  - `desk/Customize.tsx`.

  Every "Why this?" detail in the new phases needs one.
- **No desktop detail drawer.** At 1280px, `home` is a single centred column
  (≈820px) with ≈100px of dead gutter on each side of the content. The
  requested desktop context pane belongs in that gutter at ≥1180px.
- **Tab rows overflow on mobile without a cue.** For example, CourseHub
  shows "Readings & m…" clipped at 390px. `ChipScroll` exists and should be
  used instead.
- **Inline styles block responsive fixes.** `grep -rc "style={{"`
  counts 5,401 lines across 268 files; the heaviest are Calendar (169),
  Guide (161) and Today (128). A media query cannot override an inline style,
  so a responsive fix to those screens first needs the style moved into a
  class. New components are class-only.

### 1.5 Accessibility gaps

The guards are strong and are the floor for everything new:

| Guard | Covers |
|---|---|
| `app/src/a11y/*.test.ts` (10 files) | Labels, landmarks, modal focus, titles, focus rings, motion, drag alternatives, non-colour tellings, font size |
| `lib/contrast.test.ts` | Every accent × ground |
| `scripts/labels.mjs` | Label audit |
| `useModal` | Focus trap |

The remaining gaps:

- **A-1 · Disclosure controls are `<details>` with body-text summaries.**
  Examples are "Why am I seeing this?" and "How this status is calculated".
  They work with a keyboard, but they are not recognisable as controls and
  they hold long prose inline. They move to the Explanation Sheet (§3).
- **A-2 · UA-default buttons fall outside the contrast work.** Grey `#efefef`
  UA buttons with white text on the timeline rows (H-2) have never been
  measured by `contrast.test.ts`, because they are not tokens.
- **A-3 · Status is carried by position and weight, not announced.** The
  path state (`incomplete | review | moving`) is shown only as a heading.
  There is no programmatic state for screen readers to query. The new
  `StatusChip` has a text label and is never colour-only.
- **A-4 · Snooze and dismiss have no keyboard-reachable alternative to
  hidden controls in feed rows.** TAB compact items in
  `docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md` note the same. The rule
  for new work: **no swipe-only action**, per `a11y/dragging.test.ts`.
- **A-5 · The FAB covers content (§1.4).** Content under it is unreachable by
  pointer at 390px without scrolling past the end.

---

## 2. Principles for every phase

These restate the command's product rules as testable checks. A PR that
cannot tick each one is not ready.

1. **One Today.** New Today content extends `TodayDecisionSurface`, per
   DECISION-LOG D-006. Anything it duplicates is removed from the feed in the
   same PR, not hidden with CSS.
2. **Progressive disclosure, three levels.**
   - Today shows a one-line summary.
   - The **Explanation Sheet** says why: a bottom sheet under 760px, a detail
     drawer at 1180px and above.
   - The focused workspace, the existing screen, is where the action is
     completed.
3. **Every figure carries one `SourceBadge`.** It uses one of the five labels,
   which match the DB enum `source_label`:
   - `institution_verified`
   - `imported`
   - `student_entered`
   - `estimated`
   - `needs_review`

   A `FreshnessBadge` is added wherever the data can go stale.
4. **Every recommendation has the seven parts:**
   - why now
   - why this
   - sources
   - expected impact
   - limitations
   - alternatives
   - snooze / dismiss / correct

   `lib/actions.ts` makes them required fields, so an incomplete
   recommendation does not type-check.
5. **Every write, share, export, delete, calendar or handoff previews and
   confirms.** Reversible actions use `ConfirmDialog` followed by an `Undone`
   toast. Irreversible ones use `TypeToConfirm`, which already exists.
6. **Calm language.** Never write "at risk", "failing" or "behind" in new
   copy. The existing `behind` screen label ("When you are behind") is
   logged as a conflict in the crosswalk. Never use streaks, leaderboards or
   shame.
7. **Answer the six questions** of Phase O on every new page:
   - where am I
   - what matters now
   - what next
   - why
   - what options
   - what source

   The page header, the `SourceBadge` and the single primary `ActionCard`
   answer four of them by construction.
8. **No new top-level destination.** Modules live contextually in
   Today / My Path / Search / Plan / Me, as mapped in the crosswalk. The
   five-tab relabel itself is D-003, which the owner approved on 27 Sep. It
   ships as BL-1.13 behind `journeyNavigation`, with screen ids and routes
   unchanged.
9. **Class-only styling in new components**, tokens only, and the two
   canonical breakpoints only.

---

## 3. The Explanation Sheet, which the whole programme leans on

Every phase needs "Why this?". Built once, it is:

- **Under 760px:** a `BottomSheet`.
  - `role="dialog" aria-modal="true"`, using `useModal`.
  - A drag handle plus a visible **Close** button, because dragging is never
    the only way out.
  - Opens to 60% of the height and expands to full.
- **At 760–1179px:** the same sheet, capped at 560px wide and centred.
- **At 1180px and above:** a `DetailDrawer` docked right, 400px.
  - `aria-modal="false"`, and it does not steal the page.
  - Escape closes it and focus returns to the opener.

Its contents are fixed by the `Explanation` type
([DESIGN-SYSTEM-IMPROVEMENTS.md §4.4](DESIGN-SYSTEM-IMPROVEMENTS.md#44-recommendation-explanation-sheet)).
The same component serves Today, Registration backups, graduation scenarios,
course fit, crunch weeks and office actions.

---

## 4. Plan by destination

| Destination | Now | After Phases B–O |
|---|---|---|
| **Today** (`home`) | Up to 11 stacked blocks, with duplicates | Path Snapshot, then **one** Next Best Step, then ≤1 urgent card and ≤4 upcoming rows, then Quick Actions. Done-for-today replaces all of it when appropriate. At 1180px and above there is a context pane: schedule, planning status, freshness and advisor context. Registration Day Mode takes over the Next Best Step slot while it is active. |
| **My Path** (`degree`, `yes`, `pathway`) | Honest but heavy disclaimers; Scenarios and Registration day exist (#762) | A source badge replaces the framed disclaimer, with the long text moved into the sheet. Scenario Comparison Cards. Registration Day Mode. Advisor Meeting Mode. Course Detail v2 as a drawer from search and the cart. |
| **Search** (`Command`, `ask`) | Command palette, ranked | Course results open Course Detail v2. New modules add `nav.ts` keywords only. |
| **Plan** (`calendar`, `runway`, `costs`) | Calendar and runway | Academic Life Balance and the Crunch Week Forecast inside Calendar's week view. The cost planner joins graduation scenarios. |
| **Me** (`me`, `privacy`, `export`, `career`) | Privacy as long prose; export misses some device stores (see crosswalk N-3) | The Trust Center organises Privacy, Data, Export and shares into a scannable panel. Career Evidence goes into Career. Semester Wrapped goes into Progress (`me`). |

---

## 5. Phase B — exact files (awaiting confirmation)

Nothing below has been changed. This is the complete intended change set for
**Phase B: Today + Action Center**, on the branch named in
[DECISION-LOG D-017](DECISION-LOG.md).

### 5.1 First commit: shared-component fixes (non-breaking CSS)

| File | Change |
|---|---|
| `app/src/styles/features.css` | Give `.workspace-text-button` a base rule: `.bare` reset, `--app-accent-deep` text, underline offset, `min-height: 44px` touch target, focus ring inherited. Fixes H-2 on Today and in `CourseHub`. |
| `app/src/styles/app.css` | Reset `.today-timeline-row`: `background: none; border: 0; border-bottom: 1px solid var(--app-line-soft); font: inherit`. Fixes H-2 and A-2. |

Verification: 390px and 1280px screenshots before and after, plus
`lib/contrast.test.ts` still green.

### 5.2 New files

| File | Purpose |
|---|---|
| `app/src/lib/source.ts` (+ `source.test.ts`) | `SourceLabel` union (5 values = DB enum), display text, `freshness(at, now)` wording ("Updated today", "Updated 3 days ago", "Not synced since …"), `isStale`. Replaces `TicketSource` in `lib/registration-day.ts` by widening its type, with no stored-shape change. |
| `app/src/components/SourceBadge.tsx` (+ test) | `SourceBadge`, `FreshnessBadge`, `ConfidenceBadge`. Text-labelled and never colour-only. The "Report incorrect" affordance is a prop. |
| `app/src/lib/actions.ts` (+ `actions.test.ts`) | Canonical `Action`: `id`, `kind`, `title`, `whyNow`, `explanation: Explanation`, `source`, `due`, `group`, `state: open, snoozed, dismissed, done, corrected`. Lifecycle transitions, with invalid ones refused. `rankActions()` = urgency + impact + actionability + confidence − fatigue. `timeFirstLabel()` = Today / Tomorrow / In N days. `groupRelated()`. Pure, with revert checks. |
| `app/src/lib/action-store.ts` (+ test) | `semester.actions.v1` via `useDeviceLibrary`. Stores **only the student's choices**: snoozes (until), dismissals (reason), corrections (text), completions, and a history capped at 200 entries. Derived actions are recomputed, never stored. |
| `app/src/components/ActionCard.tsx` (+ test) | Primary and compact variants. Explore, Snooze (Later today / Tomorrow / Next week), Dismiss (with an optional reason), and "Correct information". All are buttons; there is no swipe. |
| `app/src/components/ExplanationSheet.tsx` (+ test) | §3: `BottomSheet` and `DetailDrawer` behind one API, using `useModal` and `lib/media.ts`. |
| `app/src/components/QuickActions.tsx` (+ test) | Five compact actions: Search (opens `Command`), Build plan (`degree` → Scenarios), Add course (`import`), View schedule (`calendar`), Prepare for advising (`degree` → advisor summary until Phase G). |
| `app/src/components/TodayContextPane.tsx` (+ test) | At 1180px and above only: upcoming schedule, planning status, data freshness, and selected course/scenario impact. Advisor context stays hidden until Phase G. |
| `docs/TODAY-ACTION-CENTER.md` | Feature doc: states, analytics event *definitions* (D-005), the responsive checklist, and rollback. |

### 5.3 Modified files

| File | Change |
|---|---|
| `app/src/lib/experience-flags.ts` (+ new `experience-flags.test.ts`) | Add the 14 named flags as `FeatureState`, all `'off'` unless their `VITE_*` var is set. There is **no preview default** for these 14; see D-012. Phase B's own changes sit behind a 15th flag, `today_action_center`, which the command's list does not name; this **needs the owner** (D-013). |
| `app/src/lib/today-decision.ts` (+ test) | Status language reduced to the three approved sentences. `nextTodayDecision` returns an `Action` with a full `Explanation`. New `doneForToday()`. Commitments get ≤1 urgent card and ≤4 rows, with time-first labels. |
| `app/src/components/TodayDecisionSurface.tsx` | Renders `ActionCard`, `SourceBadge`, `ExplanationSheet`, Done-for-today and `QuickActions`. Dismiss and snooze persist through the action store (replacing `useState`). |
| `app/src/screens/Today.tsx` | Removes the `NextClassCard` duplicate beside the surface in `FeedHome`, mounts `TodayContextPane` at 1180px and above, and adds FAB clearance at the end of the page. The feed sections are otherwise untouched. |
| `app/src/styles/app.css` | Class rules for the new components (§5.2), tokens only, 760/1180 only, and a `data-calm` pass. |
| `app/src/lib/workspace-backup.ts` | Add `semester.actions.v1` so Export includes it. |
| `docs/DECISION-LOG.md`, `docs/PRODUCT-ROADMAP.md` | Phase B entries. |

**Not touched in Phase B:**

- `state/shape.ts`: no synced-state change.
- `lib/migrate.ts`: no `SCHEMA` bump.
- `supabase/`: no migration.
- `lib/nav.ts`: no new destination.
- `ANALYTICS.md` and the activity check constraint. Per the approved D-005,
  Phase B ships event definitions and on-device counts only.

### 5.4 Phase B tests and gates

Tests to add:

- Unit tests for ranking, lifecycle and time labels.
- Store round-trip plus corrupt-read refusal (the `device-library` contract).
- Component tests that snooze, dismiss and correct are keyboard-operable and
  labelled.
- The Explanation Sheet traps focus under 760px and does not at 1180px.
- Done-for-today renders when the last important action completes.
- **No banned words** ("at risk", "failing", "behind") appear in any
  `today-decision` output.
- Each new guard is shown red against a revert.

Gates, all run from `app/`:

- `npx tsc -b`
- `npm run lint`, with **0 new warnings** (D-010)
- `npm test`
- `npm run test:shuffle`
- `npm run build`
- A secret scan of the changed files
- Screenshots at 390px and 1280px

### 5.5 Rollback

Set `today_action_center` to `off` (the default) and the Today surface
renders as on main. The only always-on change is the §5.1 CSS, which is reverted by
reverting its commit. `semester.actions.v1` is additive and ignored when
absent. No migration is involved.
