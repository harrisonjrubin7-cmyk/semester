# Graduation Simulator + Cost Planner: Phase D

**Flags:**

- `graduation_simulator` (`VITE_GRADUATION_SIMULATOR`)
- `cost_planner` (`VITE_COST_PLANNER`)

Both are off by default (D-012). With both off, the degree screen's Scenarios
tab is #762's simulator exactly, and a test holds that.

**Destination:** My Path, at `degree` › Scenarios.

**Builds on:** #762's `lib/graduation.ts` and `GraduationSimulator`
(term-by-term projection, six presets, editable scenarios, cost per term,
advisor summary) and the `graduation_scenarios` table. It extends that work;
it does not replace it.

## What it answers

| Student question | How |
|---|---|
| What if I drop this course? | #762 preset (+3 credits) |
| What if I add a minor? | #762 preset (+18) |
| What if I change majors? | #762 preset (+24) |
| **What if I study abroad?** | New preset. The first N fall/spring terms earn the credits the student expects to transfer, at their own cost (blank means the same as home). The student can edit the terms, credits and cost |
| **What if I take 12 instead of 15?** | New preset |
| What if I take summer courses? | #762 preset (6 each summer) |
| **What is the effect of an extra term?** | New preset. It adds a term's worth of credits, and the comparison shows the added term and its cost |

## `graduation_simulator`

**Scenario Comparison Card** (DESIGN-SYSTEM §4.11):

- **Rows:** finish, fall and spring terms left, summers, credits needed,
  credits still to earn, term load and estimated remaining cost.
- **Changes** are written in words with a sign: "+2 terms", "−3 credits a
  term", "12 abroad for 1 term", "+$40,000", "Not estimated".
- **At 760px and wider:** a `<table>` with column and row headers.
- **On a phone:** "What changes" (only the rows that changed) comes first,
  then a Current plan / proposed switch shows the whole of either plan.
- **Labels:** **Estimated** and "Planning guidance only. Not a degree audit,
  not a bill, and not a promise of when you finish."

**What this can't tell you** is always listed:

- **Always:** sequencing ("Semester cannot see which courses must be taken in
  order, or which are offered only once a year").
- **When the change makes them likely:**
  - over 18 credits a term: "Check your school's rule";
  - under 12: "below the full-time line at many schools … ask the office
    concerned";
  - study abroad: "Transfer credit … is decided by your school";
  - negative credits: "counts only once your school has accepted it";
  - any cost: "before any aid … not a bill and not an aid decision".

**Save draft to your account** (signed in only):

- A `ConfirmDialog` lists every field that will be stored (`draftPreview`),
  with focus starting on Cancel.
- Nothing is written until the student confirms.
- The draft is upserted into `graduation_scenarios` with
  `source_label = 'estimated'`, and its id is kept on the device scenario, so
  the next save updates the same row.
- **Remove from account** also goes through a confirmation.
- Signed out, the screen says scenarios are saved on the device, and that
  signing in allows drafts to be saved to the account as well.

**Share with your advisor:**

- A preview of the exact text (the #762 summary plus the comparison) is
  shown first.
- Confirming copies the text, or downloads it if copying is blocked.
- **Semester sends nothing**, and the preview and the result both say so.
  Authorized advisor shares are Phase G (D-016).

## `cost_planner`

**Cost lines:**

- The kinds are tuition, fees, housing, food, books and supplies, travel, and
  other, each per fall/spring term or per summer.
- Each line records **where it came from**:
  - **Student entered**: the student's own estimate.
  - **Imported**: copied from the school's published figure, with "Copied
    from" and "Copied on". A figure copied more than a year ago is flagged,
    because published costs change each year.
- **Never "Institution verified":** the reader refuses it, because nothing
  here comes from an institution feed.

**Totals:**

- The lines' totals become the plan's cost per term and per summer, so the
  projection and comparison read the same two numbers they always did.
- Once lines exist, the two plain cost fields step aside.
- A total claims only its weakest source: one student-entered line makes the
  total student entered.

**What it is not:** "These are costs before any aid — Semester does not know
your aid and does not estimate it. Not a bill."

## What it never does

- It never guarantees a graduation term, and every figure is Estimated.
- It never determines, estimates or subtracts financial aid.
- It never presents a cost as an official bill.
- It never makes an enrollment decision or writes to a registration system.
- It never sends a plan to anybody. Sharing is a copy the student sends
  themselves.

## Data

**Device.**

- `semester.graduation.v1` stores the new optional fields:
  - `plan.costLines`;
  - `scenario.abroad` (`{ terms 1–4, credits 0–30, costPerTerm | null }`);
  - `scenario.cloudId` (a UUID).
- Plans saved before these existed read unchanged (tested).

**Account.**

- The drafts go into `graduation_scenarios` (#762): row-level security, owner
  only, `estimated` or `needs_review` only.
- `OWNED_TABLES` in `lib/cloud.ts` now lists the table, so **Delete my account**
  deletes the rows, and `privacy.test.ts` holds that.

**Migration: `supabase/migrations/20260928300000_untouched_graduation_drafts.sql`.**

- **What it does:** redefines `lti_account_untouched` with
  `graduation_scenarios` added. An LTI-provisioned account holding a draft is
  not empty, so account linking must not retire it. `ltiaccount.test.ts`
  requires this of every table the app writes.
- **Restated after help requests:**
  `20260928303000_untouched_graduation_after_help.sql`.
  `20260927230000_help_requests.sql`, merged into the base later, redefines
  the function from the definition before this one. Migrations apply in
  version order, so that definition would win and drop the graduation row.
  This file is the help-requests definition with the row added back.
  `ltiaccount.test.ts` failed on the merged branch without it.
- **Scope:** additive — `CREATE OR REPLACE`, no table or data change, safe to
  re-run.
- **Checked** locally with `SEMESTER_CHECK_PG_ANY=1 supabase/check.sh` on a
  throwaway Postgres 16:
  - every migration applies;
  - the `expansion` (64), `deletion` (23), `lti` (25), `ltiags` (17) and
    `ltiidentity` (32) suites pass;
  - `ltiidentity` gains two checks (untouched without a draft, not untouched
    with one), and it fails without the migration.
- **Not applied anywhere.** It reaches production only if this branch is
  merged to `main` (Supabase Branching applies migrations on merge). That
  needs owner approval (D-025).

## Files

| New | Purpose |
|---|---|
| `lib/scenario-compare.ts` | `compareRows`, `limits`, `MORE_PRESETS`, `comparisonText` |
| `lib/cost-plan.ts` | `CostLine`, `readCostLines`, `totals`, `totalSource`, `staleness` |
| `lib/graduation-cloud.ts` | `draftRow`, `draftPreview`, `saveDraft`, `deleteDraft` |
| `components/ScenarioComparison.tsx` | The comparison card |
| `components/CostPlanner.tsx` | The cost lines |
| `supabase/migrations/20260928300000_untouched_graduation_drafts.sql` | See above |
| `supabase/migrations/20260928303000_untouched_graduation_after_help.sql` | The same row, restated after `help_requests` |

| Changed | Change |
|---|---|
| `lib/graduation.ts` | `Abroad`, `scenario.abroad` and `cloudId`, `plan.costLines`; `project()` walks terms abroad |
| `components/GraduationSimulator.tsx` | `simulator` and `costs` props (default: the flags) and an `accountId` prop; new presets, abroad fields, Compare, Save/Remove from account, Share, and the cost planner |
| `screens/Degree.tsx` | Passes `accountId` |
| `lib/cloud.ts` | `graduation_scenarios` in `OWNED_TABLES` |
| `supabase/ltiidentity.check.sql` | Two checks for drafts |
| `vite.config.ts` | The two new `vi.mock` test files in `MOCKS_MODULES` (`isolation.test.ts`) |
| `styles/app.css` | Table, lists and cost lines |

## Tests

| File | Covers |
|---|---|
| `lib/scenario-compare.test.ts` | The abroad projection (credits, cost, a term that transfers nothing still passes); reading and refusing abroad plans and account ids; rows in words and signs; 12 instead of 15; an extra term; abroad in the load row; cost "Not estimated"; limits by change; no promises, calm words |
| `lib/cost-plan.test.ts` | Totals; weakest source; "institution verified" refused; where and when kept; bad dates refused; stale after a year; round-trip inside a graduation plan |
| `lib/graduation-cloud.test.ts` | The row is always `estimated`, in the table's units; the preview lists every field; upsert keeps its id; a fresh id first; the server's refusal thrown; delete by id |
| `components/GraduationSimulator.phase-d.test.tsx` | Flags off is #762, and the default follows the flags; the new presets; a wide table with headers; phone "What changes" plus the switch; editing abroad; save only after the preview (focus on Cancel), then remove; no account option when signed out; share previews, then copies and never sends; cost lines drive the plan and the plain fields step aside; an imported line is labelled and asks where and when |
| `lib/privacy.test.ts`, `lib/ltiaccount.test.ts` (existing) | Now see `graduation_scenarios` |
| `supabase/ltiidentity.check.sql` | A draft makes an account not untouched |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- The table left out of `OWNED_TABLES`.
- Abroad ignored.
- The cost reader accepting any label.
- Saving before the confirmation.
- The simulator ignoring its flag.
- The sequencing note dropped.
- The migration's new row removed (both the vitest and the SQL suite).

## Responsive manual-test checklist

Checked in Chromium with both flags on, a study-abroad scenario and two cost
lines:

- [x] 1280px: the comparison is a four-column table, and changed rows are bold
  in Change.
- [x] 390px: "What changes", the Current/Study abroad switch, and a two-column
  list (label, value).
- [x] 390 and 1280px: the cost lines fit; the Imported badge shows age and
  source.
- [x] No overflow (measured), no `pageerror`.
- [ ] Signed-in save against a live project. Not run here, because no project
  is configured; the adaptor is tested with a mocked client, and the RLS
  policy is checked by `expansion.check.sql`.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `scenario_added` | Preset chosen (`preset`) |
| `scenario_compared` | Comparison shown (`preset`) |
| `scenario_draft_saved` / `_removed` | After confirmation |
| `scenario_shared` | Share confirmed; never the text |
| `cost_line_added` | Line added (`kind`, `source`) |

## Rollback

- **The feature.** Leave both flags unset (the default). The simulator is then
  #762's, and drafts are not offered. Saved cost lines stay stored but are not
  shown; the projection uses the plan's cost per term and per summer, which
  hold the lines' last totals and are editable again as plain fields.
- **The data.** Rows already saved to accounts stay until the student removes
  them or deletes their account. The migration is harmless to leave; to undo
  it, re-run the previous definition from `20260925103000_support_access.sql`
  in a new migration.
