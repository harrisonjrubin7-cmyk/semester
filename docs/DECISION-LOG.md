# Decision log — Semester unified platform

Running log for the unified-platform programme. Settled, long-lived product
decisions stay in [`/DECISIONS.md`](../DECISIONS.md); architecture decisions in
[`docs/architecture/`](architecture/README.md). This file records the
programme's own decisions and every **conflict between the new briefs and a
decision already on main**. Where they conflict, the existing decision holds
until the owner (Harrison Rubin) reopens it here.

Status values: **Decided** · **Proposed — needs owner** · **Superseded**.

Owner approvals: D-003, D-005 and D-011 approved 27 Sep 2026 (in the
session that opened #763). For D-005 the approval covers the recommendation
as written: definitions and on-device counts now, and each server-collected
mark still lands with its `ANALYTICS.md` question and migration in the same
PR, for review.

---

## D-001 · The briefs are reconciled into the repo, not re-applied

**Decided 27 Sep 2026.** The expansion patch, migration SQL and permission
tests supplied with the execution brief are byte-identical to what landed on
main in #762 (`c029822`) — `git apply --check --reverse` succeeds, and
`supabase/migrations/20260926150000_expansion_roles_and_features.sql` and
`supabase/expansion.check.sql` match the uploads exactly. They are not
re-applied. The v2 brief is already in the repo as
`docs/expansion/Semester-Master-Implementation-Brief-v2.md`.

The three documents named as authority —
`Semester_Claude_Code_ChatGPT_Implementation_Master_Brief.md`,
`Semester_Base44_Full_Build_Master_Prompt.md`,
`Semester_VibeCode_Build_Brief.md` — are **not in the repository or its
history**. The *Unified Product, Company, and Implementation Blueprint* (.docx,
supplied 27 Sep) plus the v2 brief stand in for them. If the named files exist,
add them under `docs/expansion/` and re-run this reconciliation.

## D-002 · Source of truth for plans and status

**Decided 27 Sep 2026.** See [AUDIT.md §4 Documents](AUDIT.md#4-documents). The
nine `docs/` files created in Phase 0 are the programme's plan; they
**index** existing documents rather than replacing them. No existing document
is deleted in Phase 0. Consolidating superseded root-level plans is backlog
item BL-0.3, and needs a redirect note in each retired file.

## D-003 · Five student destinations vs the eight-shelf navigation

**Decided by owner 27 Sep 2026 — recommendation approved.** Originally proposed: The blueprint mandates five primary destinations
(Today, My Path, Search, Plan, Me). The app has 59 screens on eight shelves
(`app/src/lib/nav.ts` `GROUPS`), each shelf argued for in that file, with
`ALWAYS_TO_HAND = ['home','me','notifs']`.
`docs/expansion/ROUTE-AND-FEATURE-CROSSWALK.md` already maps the five onto
existing screens.

The default tab bar already has five slots (`lib/tabbar.ts` `DEFAULT_TABS = home, courses, study, calendar, me`; users may customise up to 7), and `REGRESSION-CHECKLIST.md` §Q forbids renaming routes or storage keys.

Recommendation: keep screen ids and URLs stable, which avoids route migration.
Introduce the five as the **primary tab bar** and keep the shelves as the
secondary directory beneath them, behind the existing `journeyNavigation`
flag in `lib/experience-flags.ts`. Rejected: rebuilding screens under new
routes, which would break every deep link and the 700-file test suite's route
assumptions.

## D-004 · Degree requirements are student-entered, never supplied

**Decided (existing), reaffirmed.** `lib/degree.ts` states the app "does not
know your requirements, and will not pretend to", and the crosswalk says
"Degree ships no requirements and never will". The brief's *requirement
categories* are therefore the **student's own categories**, labelled
`student_entered`, with the disclaimer that estimates are not official degree
clearance. This matches the brief's rule against degree certification.

## D-005 · Analytics beyond three marks

**Decided by owner 27 Sep 2026 — recommendation approved.** Originally proposed: `ANALYTICS.md` limits collection to three marks
(`opened`, `course`, `studied`), enforced by a check constraint in
`supabase/migrations/20260921151000_activity.sql`, and says a fourth "needs a
fourth question written down here first". Phase 1 lists eight events.

Recommendation: Sprint 1 ships **event definitions only**, in
`docs/SPRINT-1-REGISTRATION-PATH.md`, and on-device counts the student can see.
Server collection of any new mark needs `ANALYTICS.md` amended with the
question each answers, and a migration widening the check constraint. Both
require owner sign-off.

## D-006 · Only one Today

**Decided (existing), reaffirmed.** The Action Center and Path Snapshot extend
`home` and `components/TodayDecisionSurface.tsx`, which landed as the adaptive
Today in #761. No parallel dashboard.

## D-007 · Vanderbilt depth before breadth still binds integrations

**Decided (existing), reaffirmed.** `DECISIONS.md` §1 (21 Sep 2026) rules out
non-Vanderbilt LMS adapters until the Stage 4 gate. Phase 6 adapters for
Banner, Workday, Microsoft Graph and Calendly are **interfaces and docs
only**. Only Brightspace, the Vanderbilt system, may get a working adapter,
and only after a data agreement.

## D-008 · Branch and PR target

**Decided 27 Sep 2026.** The brief asks for the branch
`semester-unified-platform`. This session's push credentials are scoped to
`claude/epic-carson-pje9tl`. Phase 0 docs are committed there and pushed to
`semester-unified-platform` where the remote permits it. The draft PR targets
`main` and is not merged without approval.

## D-009 · Billing stays out

**Decided 27 Sep 2026.** The membership UI (Phase 2) shows plans, placeholders
and export/deletion only. No Stripe keys, checkout or webhooks without a
server-side environment and explicit approval. Export, deletion and access to
saved plans are never paywalled (blueprint §12).

## D-010 · Lint budget is full

**Noted 27 Sep 2026.** `npm run lint` runs with `--max-warnings=25` and main
has exactly 25 warnings, most of them `react(purity)` and
`preserve-manual-memoization` in `screens/Sheet.tsx`. Any new warning fails
lint. New code must add none; reducing the count is backlog BL-0.4.

## D-011 · Public site as a separate prerendered entry

**Decided by owner 27 Sep 2026 — recommendation approved.** Originally proposed: The app is a hash-routed SPA on GitHub Pages
(`app/src/lib/route.ts`, `app/index.html`), and GitHub Pages cannot rewrite
paths. The blueprint's public routes (`/pricing`, `/about`, …) need real,
indexable paths.

Recommendation: a second Vite entry (`site/`), prerendered to static HTML at
real paths, sharing tokens from `lib/look.ts`. It hands off to the app at a
stable URL. Rejected alternatives: hash routes for marketing pages, which are
not indexable and bloat the app shell; and moving the app to path routing,
which would migrate 59 screens and every stored deep link. Changing the
production host (e.g. to Vercel, where `app/vercel.json` already exists) is a
production change and needs approval.

---

# Feature-expansion command (27 Sep 2026)

Entries D-012 onward come from the feature-expansion command (Phases A–P). The
Phase A documents are [UX-ENHANCEMENT-PLAN.md](UX-ENHANCEMENT-PLAN.md),
[DESIGN-SYSTEM-IMPROVEMENTS.md](DESIGN-SYSTEM-IMPROVEMENTS.md) and
[FEATURE-EXPANSION-CROSSWALK.md](FEATURE-EXPANSION-CROSSWALK.md).

## D-012 · The 14 module flags extend `experience-flags.ts`, off by default

**Decided 27 Sep 2026.**

- The command's 14 flags (`registration_day_mode` … `trust_center`) become
  keys on the existing `ExperienceFlags`. Each is a `FeatureState` read from
  `VITE_<NAME>`.
- There is no second flag system. Tenant-level flags stay in
  `tenant_feature_policy` (Phase 5).
- **Unlike the six existing flags, these 14 do not default to `preview` under
  `institutionalPreview`.** They are `off` unless set explicitly. Each module
  is enabled on purpose, one at a time.

## D-013 · A flag for the Today polish itself

**Proposed — needs owner.**

- Phase B changes the existing Today, but the command names no flag for it.
- **Recommendation:** add `today_action_center`, off by default, so the
  whole of Phase B except the §5.1 CSS defect fix can be switched back.
- **Alternative:** gate Phase B under the existing `journeyNavigation`. This
  is rejected because it already gates Directory, and the two would then
  roll back together.

## D-014 · Phase A changes no code

**Decided 27 Sep 2026.**

- The command allows non-breaking token and shared-component fixes in
  Phase A, but also says to wait for confirmation before UI changes.
- The stricter reading holds. The one real defect found, UX plan **H-2**
  (unstyled `.workspace-text-button` and `.today-timeline-row` on Today,
  from #761), is documented with its exact fix as the first commit of
  Phase B rather than applied here.

## D-015 · "Behind" in new copy, and the existing `behind` screen

**Decided / Proposed.**

- **Decided:** new copy never uses "at risk", "failing" or "behind". A
  Phase B test enforces this on `today-decision` output.
- **Proposed — needs owner:** relabel the existing screen `behind` ("When you
  are behind", `lib/nav.ts:571`). For example, "Catching up". The screen id
  and route stay unchanged (REGRESSION-CHECKLIST §Q).

## D-016 · Advisor sharing: authorized grants, not bearer links, in the pilot

**Decided 27 Sep 2026 by the owner (Phase G): signed-in grants, no view-only
links.** Built as below; see D-042 and D-043.

- BL-1.9 said "no link-sharing". The command asks for a view-only link or an
  authorized advisor share, with expiry and revocation.
- **Recommendation:**
  - Ship the agenda and a confirmed export/print first.
  - Then add authorized shares through a new `advisor_shares` table
    modelled on `accommodation_shares`: required term-bounded
    `expires_at`, `revoked_at`, and access events the student sees
    (SECURITY-GAP S-8).
  - Anonymous view-only links wait until after the pilot.
- The migration is additive, and applying it to production needs approval.

## D-017 · Branches for the feature expansion

**Decided 27 Sep 2026.**

- The command lists `feature/*` branches with draft PRs into
  `semester-unified-platform`. This session can push only its designated
  branch (`claude/keen-turing-ao1rin`).
- Phase A is committed there, and its draft PR targets
  `semester-unified-platform`.
- Later phases use a `feature/*` branch where the session's credentials
  allow it, and otherwise the designated branch. Each gets one draft PR per
  phase into `semester-unified-platform`.
- Nothing is merged to `main`.

## D-018 · Export misses two device stores

**Noted 27 Sep 2026.**

- `lib/workspace-backup.ts` does not include `semester.registration-day.v1`
  or `semester.graduation.v1`, both from #762, so Export omits them.
- Erase is unaffected, because it empties all of `localStorage`.
- The fix goes in whichever of Phases C, D or N touches those stores first,
  and it comes with a test that every `useDeviceLibrary` key is backed up
  (crosswalk N-3).

## D-019 · Owner approval of the Phase A recommendations

**Decided by owner 27 Sep 2026.** "Start Phase B with the recommended
defaults" approves these recommendations as written:

- **D-013:** `today_action_center` flag, off by default.
- **D-015:** relabel `behind`. This is approved but not done in Phase B; it is
  a label-only change in `lib/nav.ts`, with the route unchanged.
- **D-016:** authorized expiring advisor grants in the pilot, not bearer links.
- **D-017:** one draft PR per phase into `semester-unified-platform`.

D-012 is implemented as a second map, `MODULE_FLAGS`, beside `ExperienceFlags`
rather than as 15 more keys on it. That keeps
`experience-preservation.test.ts`'s six-flag contract intact, and the new
flags never inherit the preview default.

## D-020 · Phase B stacks on the other session's BL-1.1 to BL-1.3

**Decided 27 Sep 2026.** A second session is working the same backlog:

- BL-1.1 source labels landed on `feature/source-labels` at `7096529`.
- BL-1.2/1.3, the canonical action model and store, landed on
  `feature/action-model` at `e153146`.

Both landed while Phase B was being built. Phase B had its own
`lib/actions.ts`, and it was **dropped** for the canonical one, per
`CLAUDE.md`: two action models under one storage key would be the duplicate
that file warns about. Phase B is now the BL-1.4 slice (the Action Center on
Today) on that model.

The Phase B PR carries those two commits and the Phase A docs until they
reach `semester-unified-platform`, and should merge after them. The other
session could not be messaged from here; its next backlog item, BL-1.4, is
this PR.

## D-021 · Two Action Centers: this Phase B and `feature/action-center`

**Decided by owner 27 Sep 2026: recommendation approved** ("rebase onto
action-center"). Phase B is now an increment on BL-1.4. That means:

- BL-1.4's `ActionCenter`, `lib/today-actions.ts` and its controls are kept.
- Their inline `<details>` explanation moved into the sheet/drawer, keeping
  "How it was ranked".
- The whole thing is behind `today_action_center`. With the flag off, Today is
  the #761 briefing.
- Phase B's own action list, card, controls and hook were deleted, because
  BL-1.4's cover the same ground.
- The remaining helpers were renamed to `lib/today-center.ts`, so the two
  `today-actions.ts` files no longer collide.

The original proposal is kept below for the record.

- At 16:26 the other session pushed BL-1.4 as `feature/action-center`
  (`45d3877`). That is an Action Center on the same model, built while this
  Phase B was being finished. Both change `TodayDecisionSurface`, both add a
  file named `lib/today-actions.ts`, and both fix H-2. They cannot both merge
  as they stand.

| | `feature/action-center` (BL-1.4) | This Phase B |
|---|---|---|
| Flag | **None**: it replaces the Next best step for every student | `today_action_center`, off by default (D-013, approved) |
| Scope | The Next best step block becomes a ranked list (1 + 5 + View all); the #761 path card and 72-hour rail stay | The whole Today surface |
| Controls | Start, Done, Snooze until tomorrow, Not relevant, Something is wrong, Ask for help | Snooze (3 times), Dismiss with a reason, Correct |
| Explanation | Inline `<details>`, including how the action was ranked | Bottom sheet / desktop drawer |
| Only here | Start / Done / Ask for help; "View all"; the ranking breakdown; the calendar-day due-line fix | The three approved status sentences; Done for today; ≤1 urgent + ≤4 time-first commitment rows; Quick Actions; the desktop context pane; `MODULE_FLAGS`; the undo that leaves no fatigue trace; the H-2 guard test |

**Recommendation:**

1. Merge `feature/action-center` first, since it is the backlog's BL-1.4.
2. Rebase this Phase B onto it as an increment: its ranked list and controls
   stay, and this adds the flag gate, the status sentences, Done for today,
   the commitment rules, Quick Actions, the sheet/drawer and the context
   pane.
3. Rename or merge the two `today-actions.ts` files.

**Rejected:** merging both as they are, which would mean two Todays; or
dropping either outright, which loses tested work the other lacks.

## D-022 · Registration Day Mode reminders ride the registrar-deadline rule

**Decided 27 Sep 2026 (Phase C).**

- The window's two reminders (the day before, and the hour before) use the
  existing `term` rule rather than a new `NotifKey`. A new key would change
  the synced `notifs` record and the settings screen for one date.
- To the student it is a registrar date: the same toggle and the same
  quiet-hours rule apply.
- The ids are `regday:…` so they land on `yes`, not `registrar`.

## D-023 · Flagged Today surfaces are lazy-loaded

**Decided 27 Sep 2026 (Phase C).**

- `TodayDecisionSurface` loads Phase B's `TodayActionCenter` and Phase C's
  `RegistrationDayCard` with `lazy()`.
- With both flags off, the default, neither is in the first download.
- The entry chunk went from 627.65 kB (Phase B base) to 602.68 kB, which is
  below BL-1.4's recorded 613.71 kB.
- The notifier's needs moved to `lib/registration-window.ts`, so the
  always-loaded reminder code does not pull in the catalog parser.

## D-024 · Registration readiness actions and BL-1.8

**Proposed — needs owner if BL-1.8 lands separately.**

- The Phase 0 backlog's BL-1.8 ("Registration readiness as a grouped action
  workflow") is what `lib/registration-actions.ts` does, under the
  `registration_day_mode` flag.
- No BL-1.8 branch existed when Phase C was finished (checked at 17:20 UTC on
  27 Sep, after the other session had pushed BL-1.10 to BL-1.13).
- If the other session pushes one, reconcile as in D-021: keep one proposer,
  and one "Registration readiness" group.

## D-025 · Phase D carries one additive migration

**Proposed — needs owner before any merge to `main`.**

- Saving graduation drafts to the account (`graduation_simulator`) writes
  `graduation_scenarios`.
- `ltiaccount.test.ts` requires every table the app writes to be visible to
  `lti_account_untouched`, so account linking never retires an account that
  holds work.
- `20260927181500_untouched_graduation_drafts.sql` redefines that function
  with the table added. It changes no table and no data.
- It has been checked on a throwaway Postgres 16 with all migrations and the
  expansion, deletion and three LTI suites.
- It is **not applied**. Merging this branch to `main` would apply it through
  Supabase Branching, so that merge needs approval.
- **Renumbered on 27 Sep 2026** from `20260927180000`: two other branches
  (`help_requests`, `lti_integration_binding`) claim that version, and
  `migrationorder.test.ts` allows each version once.
- **Alternative:** keep drafts device-only and drop both the adaptor and the
  migration. The simulator still works, but drafts do not follow a student to
  a new device.

## D-026 · Cost lines are student entered or imported, never verified

**Decided 27 Sep 2026 (Phase D).**

- A cost the student copies from their school's published figures is
  `imported`, with where and when it was copied.
- `institution_verified` is refused, because nothing here comes from an
  institution feed.
- Aid is neither estimated nor subtracted. Every total says "before any aid".

## D-027 · The Crunch Week Forecast has its own flag

**Decided 27 Sep 2026 (Phase E).**

- `academic_life_balance` draws the week's hours in Plan. `crunch_week_forecast`
  (`VITE_CRUNCH_WEEK_FORECAST`) adds the forecast under it and the one card on
  Today.
- The card needs both flags, because its suggestions live in the balance view.
- A pilot can show the hours without any recommendation, which is the smaller
  and safer first step.

## D-028 · A crunch is three major deadlines in six days, one to four weeks out

**Decided 27 Sep 2026 (Phase E).**

- **Major:** an exam, a project, paper, essay, presentation or report, or
  anything the syllabus weights at 10% or more.
- **Window:** 7 to 27 days away. Closer than a week is `lib/clash.ts`'s
  territory, and too late to move much.
- **Suggestions:** one or two earlier starts (count − 2, at most two), in open
  blocks of the week before, one a day, never before 9am in the default day.
  Each is 90 minutes, or half the student's own past time for that kind of
  work, between one and two hours.
- These are counts, not a model of the student. The thresholds are constants
  in `lib/life-balance.ts`, named and tested.

## D-029 · Balance counts hours; it never scores a week or a person

**Decided 27 Sep 2026 (Phase E).**

- The view reports hours by category, overlaps, long stretches and open
  blocks. It has no "healthy" range, no score, and no wellbeing or burnout
  wording; a test holds the forecast's words to that.
- Rest blocks are the student's own. They count as personal time but are never
  called a conflict or part of a long stretch.
- The commute is the one new input. It is device-only
  (`semester.life-balance.v1`), is counted as hours, and is never placed on
  the clock.
- A suggested study block is written to the student's own Semester calendar
  only after a preview and a confirmation. Nothing is written to an external
  calendar.

## D-040 · Course Detail V2 lives in the registration workspace, as a sheet or a drawer

**Decided 27 Sep 2026 (Phase F).** (D-030 to D-039 are left to the other
session's range.)

- With `course_detail_v2` on, a catalog result opens Course Detail V2 in place
  of the side panel:
  - under 1180px, a modal sheet;
  - from 1180px, a non-modal drawer, so another result can be opened without
    closing it first.
- The page reads only the imported catalog and the student's own records. It
  adds no table and makes no network call.
- The saved-course shortlist is a new device store,
  `semester.course-shortlist.v1`, rather than a field in the registration
  store, so older builds reading that store neither drop nor trip on it.
- Search and a `course/:id` route are not wired yet. The crosswalk lists them
  as later entry points.

## D-041 · Prerequisites are read, never judged

**Decided 27 Sep 2026 (Phase F).**

- Course codes are read from the catalog's own wording. The wording is always
  shown verbatim beside the reading.
- Each code is compared with what the student recorded: recorded, in progress,
  in the cart (corequisites only), or not recorded.
- The page never says "eligible" and always says the department decides.
  Other wording ("consent of instructor", "junior standing") is flagged, not
  interpreted.
- Seats are "reported in the catalog file", never available. There is no
  workload claim and no professor rating. The moderated-insight, study-pack
  and syllabus slots are placeholders with nothing estimated in their place.

## D-042 · How a student names an advisor

**Decided 27 Sep 2026 (Phase G).**

- The student types their advisor's school email address.
- `share_with_advisor` matches it only against accounts that hold a live
  `academic_advisor` grant scoped to the student's own school (from the
  student's profile). A classmate, faculty member, advisor at another school,
  lapsed advisor or unknown address all get the same message, so the RPC
  cannot be used to learn whether an address has an account.
- The advisor never reads `advisor_shares` directly.
  `list_advisor_shares` returns titles and dates. `read_advisor_share`
  returns the snapshot and logs the read, which the student sees.
- A share is a snapshot the student previewed. It can be revoked (never
  un-revoked) or deleted; it cannot be edited or extended.
- Expiry is required, at most 120 days (a term), with choices of a week, a
  month, three months or the maximum.

## D-043 · Phase G carries one additive migration

**Proposed — needs owner before any merge to `main`.**

- `20260927201500_advisor_shares.sql` adds `advisor_shares`,
  `advisor_share_events` and three functions, and redefines
  `lti_account_untouched` with the new table (both ends).
- Checked on a throwaway Postgres 16: every migration applies, and
  `advisor` (45 new checks), `expansion`, `deletion`, `lti`, `ltiags`,
  `ltiidentity` and `support-access` pass.
- **Not applied anywhere.** Merging this branch to `main` would apply it
  through Supabase Branching, so that merge needs approval, as with D-025.
- Numbered `20260927201500`, not `20260927200000`: two other branches
  (`help_request_identity`, `integration_hardening`) claim that version.
- **Alternative:** hold the migration back. Advisor Meeting Mode still
  prepares, exports and prints, and the sharing section says sharing is not
  available.

## D-044 · Source Locker joins existing stores, and records provenance from now on

**Decided 27 Sep 2026 (Phase H).**

- The locker is a view over the four places materials already live:
  - Drive files;
  - added materials (`state.updates`);
  - the syllabus and prepared guide;
  - the reading list (`state.sources`).

  It adds no fifth store of materials. This follows
  `docs/ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md`.
- What is new is `semester.source-locker.v1`, which is device-only and holds
  two things: the materials the student blocked from AI, and which materials
  each saved Study Studio guide was built from.
- Guides saved before Phase H have no record, and the locker cannot claim a
  link it never saw. Links it can read from existing data are shown too: an
  added material's `fileIds`, and notes' attachments.
- **Removing** a file moves it to Drive trash (30 days) and detaches it from
  notes.
- **Notes are never deleted:** they are the student's own writing.
- **Generated items** (added materials read from the file, guides built from
  it) are deleted only if the student ticks the box in the confirmation that
  lists them.
- The syllabus cannot be removed here. Removing the course is the way.

## D-045 · Readiness is the student's mark; Semester only counts

**Decided 27 Sep 2026 (Phase H).**

- The student marks each topic Reviewed, Practicing or Needs review, and rates
  their own confidence from 1 to 5. Semester never sets either.
- Practice signals are counts the app already holds: cards practiced, right,
  missed and due; and practice papers as taken.
- The one recommended session is 25 minutes. It goes to a topic in this order:
  1. a topic marked Needs review;
  2. then an unmarked topic;
  3. then one being practiced;
  4. within each, the lowest confidence, then the most cards due.
- No grade prediction, pass likelihood, score or comparison with other
  students. A test holds those words out.

## D-046 · Career evidence: nothing reaches a résumé that the student did not confirm or write

**Decided 27 Sep 2026 (Phase I).**

- **Skills.** Suggested skills from `lib/skills-graph.ts` stay "suggested"
  until the student confirms, renames or rejects them. Only confirmed skills
  appear on a résumé, a pitch or an artifact. A skill the student adds must
  cite a course or an entry of theirs.
- **Bullets.** Bullets are composed only from the student's answers to the
  three metric prompts. An unanswered prompt is left out, never filled in.
  The only words Semester adds are "using", "reaching" and "people". A test
  checks that a bullet holds no other word, and no number the student did
  not give.
- **Entries and artifacts.** Every bullet belongs to an entry the student
  made. Every artifact is tied to such an entry or to a course, and is
  tagged only with confirmed skills.
- **Pitch.** It uses the student's own name, headline, latest entry and
  confirmed skills, and leaves a `[bracket]` wherever something is missing.
- **No applications.** Nothing is ever applied for. A fair contact reaches
  the student's own tracker only when they press "Add to my tracker".

## D-047 · Career evidence stays on the device for now

**Decided 27 Sep 2026 (Phase I).**

- `semester.career-evidence.v1:<account|device>:<term>` is scoped like the
  career library it builds on. It holds:
  - skill decisions and the student's own skills;
  - artifacts and bullets;
  - résumé versions;
  - interview ticks;
  - fair plans.
- The server's `skill_claim` tables (`20260923211000_evidence_graphs.sql`)
  are not written from the app yet. Syncing confirmed skills to them is
  follow-up work that needs a cloud adaptor and deletion wiring. That work
  has to map the server's `rejected` state, which the app's `SkillClaim`
  type lacks.


## D-048 · Phase J finishes `institution_actions` with one additive migration

**Proposed — needs owner before any merge to `main`.**

- `20260927224500_office_action_feed.sql` finishes the table from
  `20260926150000`. It:
  - requires an office, an https link, a source note and an update time on
    every new row, as a check constraint;
  - adds audiences by school, program and student-selected eligibility,
    alongside cohort;
  - adds a draft → review → published → withdrawn workflow, where someone
    other than the author approves;
  - adds `institution_action_audiences` and `institution_action_progress`,
    which only the student can read;
  - adds six functions. The completion count is null below ten.
- **Direct writes are revoked.** Insert, update and the old
  `update (withdrawn_at)` column grant all go; writes go through
  `draft_office_action` and `move_office_action`. Nothing in the app wrote
  the table before this.
- **Rows from before stay.** They are marked `published` (or `withdrawn`)
  with no office. The app shows only rows with an office, so they stay out of
  the feed until an office republishes them properly.
- **Offices.** A table lists the eleven from the command, plus the Counseling
  Center and the Learning Center (resources and events only), and names the
  roles that may publish for each.
  - The migration adds four new roles for offices that had none:
    `career_center_staff`, `disability_services_staff`,
    `study_abroad_advisor` and `first_year_staff`.
  - **No existing role gains a capability.**
- **A named student is no longer an audience.** The command scopes by tenant,
  cohort, office, program or student-selected eligibility, so the new
  workflow does not offer one student. The column stays, for rows that
  already use it.
- **Checked on a throwaway Postgres 16.** Every migration applies. `expansion`
  passes (65), with its institution-action section rewritten for the
  workflow, and `officeactions` passes (79 new checks).
  - Seven faithful reverts each turned the suite red: self-approval, the
    threshold, eligibility matching, the office-role match, a staff read of
    audiences, the feed showing old rows, and the https check. The seventh
    was caught by the constraint as well as the function.
- **Not applied anywhere.** Merging to `main` would apply it through Supabase
  Branching, so that merge needs approval, as with D-025 and D-043.
- **Alternative:** hold the migration back. The feed then shows "could not
  load", and nothing else changes.

## D-049 · Completion reaches an office only when the student says so

**Decided 27 Sep 2026 (Phase J).**

- A student marks an office action done with **Mark done…** in the feed. The
  confirmation says the office sees only a count, and only at ten or more,
  and never a name.
- **Done** in the Action Center stays on the device, like every other
  Action Center choice. It is the student's own record, not a report to the
  office.
- The count is the database's: `office_desk_actions` returns null below
  ten, and the desk prints "Fewer than 10 students have marked this done, so
  no count is shown." It never prints a smaller number, even one it was
  given.
- An office never reads the progress or audience tables, never sees which
  students an action reached, and gains no access to plans by publishing.
  `officeactions.check.sql` holds each of those as the office account.

## D-050 · What a student can say applies to them

**Decided 27 Sep 2026 (Phase J).**

- There are nine eligibilities:
  - aid applicant;
  - international;
  - veteran or military education benefits;
  - varsity athlete;
  - campus housing;
  - study abroad;
  - first year;
  - transfer;
  - graduating.
- A student can also choose a program from the ones offices at their school
  publish to.
- **Deliberately nothing about health or disability.** Disability Services
  publishes to the whole school, and a student never has to tell Semester
  they are registered in order to see its reminders.
- **Nothing is inferred.** The existing `student_context.self_segments` is
  not reused: those drive module visibility, and a student choosing which
  office notices to see is a separate decision.
- Saving shows the whole list first, and says no office can see it.
