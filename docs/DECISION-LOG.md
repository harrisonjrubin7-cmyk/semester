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

**Proposed — needs owner.**

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

---

# Phase 4 onward, this session (D-100–D-119)

The feature-expansion session writes D-040 onward, and reached D-053 on
27 Sep 2026. This session's decisions from here take D-100–D-119, so the two
logs can merge without renumbering. (D-030–D-039 are this session's earlier
block.)

## D-100 · Faculty Course Studio: F1–F7 decided as recommended

**Decided by the owner, 27 Sep 2026.** The design is in
[FACULTY-COURSE-STUDIO-DESIGN.md](FACULTY-COURSE-STUDIO-DESIGN.md).

- An instructor holding `faculty` at course scope publishes course AI rules,
  guidance and study packs.
- Publishing adds an audited, versioned record.
- Students at the school see these labelled "Set by your instructor", and the
  toolkit's existing rules engine applies them as the instructor course layer.
- There is no gradebook, no file hosting and no roster, and faculty see
  nothing about students.

The owner approved F1–F7 as recommended:
- **F1:** the institution grants `faculty` at course scope; nothing is granted
  from an LMS launch.
- **F2:** a course is `school/CODE` plus term.
- **F3:** "final answers" can be allowed only as its own explicit, confirmed
  setting.
- **F4:** published material is readable by the school.
- **F5:** faculty see nothing about students.
- **F6:** Course Studio is a contextual module behind a flag.
- **F7:** this session numbers its decisions D-100–D-119.


## D-101 · Course Studio slice 1: publishing is append-only, and the rows are the audit

**Decided 27 Sep 2026, building slice 1 of D-100.** The server half is
`20260928150000_course_studio.sql`.

- **One capability.** `course:publish` goes to `faculty` and is checked at
  course scope, `<school>/<CODE>`. The school is always the caller's own
  profile school, never a parameter. So a grant for another school's course
  publishes nothing here, even if the code matches (F1, F2).
- **Three tables.** `course_ai_rules`, `course_guidance` and `study_packs`,
  per course and term, one row per version.
  - Nobody writes them directly. Four security-definer functions do:
    `publish_course_rules`, `publish_course_guidance`, `publish_study_pack`,
    and `my_course_studio_courses`, which lists the courses the caller may
    publish for.
  - Nothing is updated or deleted through the API, by anybody, the author
    included.
  - Each version records who published it and when, so **the rows are the
    audit trail**. The design proposed `tenant_policy_audit_event`, but it was
    not used: its entity list is redefined by several open branches, and a
    table that is never changed has nothing for it to record.
- **Rules use the toolkit's own vocabulary.** A column check allows only the
  ten `USES` and four states. `unavailable` means "nobody said", so it is never
  written. A test holds `USES` to the migration's list.
- **A pack's references live in the pack** (title, citation, http link,
  authority), not in `approved_source`. That table feeds server-side AI
  grounding and is school-scoped, and connecting packs to it is a later
  decision. A new version of a pack must stay in its own course and term.
- **Reads (F4).** Any signed-in member of the school can read. Another
  school's members can't; signed-out visitors can't ask. No table has a column
  naming a student (F5), and the check suite asserts it.

Proved by `supabase/coursestudio.check.sql` (45 checks). Five guards were
each removed in turn: the capability check, the caller's-school rule, the
school-scoped read policy, the pack staying in its course, and the uses list.
The suite failed every time.

**Applying the migration to production needs owner approval.**

## D-102 · Course Studio slice 2: the instructor outranks the student's note, and Study Studio uses the same engine

**Decided 27 Sep 2026, building slice 2 of D-100.** This is the student's side.

- **Instructor rules are a layer.** Published rules become
  `fromInstructor()`, a `course`-layer `PolicySource` with
  `by: 'instructor'`, the publish date and the instructor's own words and
  link.
- **Authority within a layer.** `resolve()` now asks the sources in one layer
  in order of authority (instructor, then institution, then the student's
  record). Each source answers with the rule naming that use, or else its
  blanket. So an instructor's blanket beats a student's named note, and the
  student's note decides only what the instructor left unsaid.
- **F3 floor.** A blanket "allowed" is never read as permitting
  `final-answers`, exactly as `fromCourse` already did.
- **Study Studio moves onto `resolve()`.** A guide both explains material and
  asks practice questions, so `explanation` and `practice` must both be
  permitted:
  - either prohibited → blocked, with the source named;
  - either unknown → the existing "I checked the policy" confirmation;
  - either allowed with disclosure → a disclosure acknowledgement.
  The prompt gets what each use resolved to, and on whose word, instead of the
  raw stance.
- **Nothing changes until something is published.** With nothing published
  (or the module off, or signed out, or a failed read), everything behaves
  exactly as before. The student's own note is all there is.
- **Guidance shows** in Study Studio as "From your instructor · published
  <date>".
- **Flag.** `course_studio` (`VITE_COURSE_STUDIO`) is a module flag, off by
  default (F6), registered in `experience-flags.ts`, the Pages workflow and
  `SECRETS.md`. Off, nothing published is read.
- **Account deletion.** The three tables are `KEPT_TABLES` with their reasons:
  they are course policy the class relies on, and students only read them.
