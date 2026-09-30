# Decision log — Semester unified platform

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Running log for the unified-platform programme. Settled, long-lived product
decisions stay in [`/DECISIONS.md`](../DECISIONS.md); architecture decisions in
[`docs/architecture/`](architecture/README.md). This file records the
programme's own decisions and every **conflict between the new briefs and a
decision already on main**. Where they conflict, the existing decision holds
until the owner (Harrison Rubin) reopens it here.

Status values: **Decided** · **Proposed — needs owner** · **Superseded**.

**This log is closed at D-160.** Each later decision is its own file in
[`decisions/`](decisions/README.md), named for the pull request that records
it (`D-<pull request number>.md`), so two open pull requests can never take
the same number or edit the same lines. The numbers here stand, and are cited
as before.

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

## Numbering

Two sessions write to this log. Entries D-013 to D-029 belong to the
feature-expansion session (#765, #769). This session's Phase 1 entries
start at D-030, so the two can merge without renumbering anything.

## D-030 · How the shared AI key is clamped

**Decided 27 Sep 2026 (BL-1.0, S-1).** `supabase/functions/claude` rebuilds
every request through `supabase/functions/_shared/clamp.ts` before counting
it.

- **An unknown model is refused, not substituted.** Answering with a model
  other than the one named misreports who answered.
- **An oversize `max_tokens` is clamped, not refused.** The 16 000 ceiling is
  above the app's largest ask (12 000), so no app path is cut.
- **Fields outside the app's own request shape are dropped** and listed in
  `dropped`, not passed through.
- **The clamp runs before `count_call`,** so a malformed request no longer
  costs one of the student's sixty calls.

The model list and the search cap are tied to `lib/assistant.ts` and
`lib/research.ts` by test, so adding a model to the app without adding it here
fails CI rather than failing a student.

Deployment note: `.github/workflows/functions.yml` deploys changed functions
after CI passes on main, so **merging this to main is the production deploy**
and needs owner approval.

## D-033 · Quiz answers reach the review schedule only when the student sends them

**Taken in P3.2 (self-quiz feedback).** (D-030 to D-032 are on their own open
branches; D-013–D-029 belong to the feature-expansion work.) A quiz answer
does not update the card's FSRS review by itself. A lucky guess would stretch
the interval, and a slip on a known card would reset it. After a miss the
student is offered **Review this card soon**, which records the miss through
the existing `recordCard` action and can be undone (`restoreReview`).

Students can also report a question: *the marked answer is wrong*, *more than
one answer is right*, *the question is unclear*, or *I know this — stop asking
it*. A report is kept on the device (`semester.quizfeedback.v1:{account}`,
included in the workspace backup). It is sent nowhere, so it needs one tap
and no confirmation. Its one effect is that `buildQuiz` leaves that card out
of the student's quizzes, both as a question and as a decoy, until the report
is taken back.

Rejected: automatic FSRS updates from quiz answers; a hidden difficulty score;
sending reports to an instructor, which would need its own preview,
confirmation and recipient, and is left for the institution phase.

## D-034 · Teach-back compares and never grades

**Taken in P3.3.** (D-030 to D-033 are on their own open branches; D-013–D-029
belong to the feature-expansion work.)

Teach-back sits inside the Study Studio and uses the Studio's own gates:
selected sources, the consent to send them, and the course AI policy. The
student writes an explanation, and the model says what the selected material
shows they covered, left out, or contradicted.

`lib/teachback.ts` holds the reply to four rules:
- no score, grade or percentage;
- no model answer or rewrite;
- every point quotes a selected source word for word, and is checked like a
  study-guide citation;
- a contradiction also quotes the student's own words, checked against what
  they wrote.

A point that fails its check is dropped, and the drop is counted on screen.
Nothing is stored.

Rejected: a mastery score from teach-back, which is hidden academic scoring;
feeding teach-back into the review schedule.

## D-035 · A saved study guide keeps its quotations, and only checked ones

**Taken in P3.4.** (D-030 to D-034 are on their own open branches; D-013–D-029
belong to the feature-expansion work.)

"Save & open in Write" now builds Write blocks directly (`studyBlocks`),
instead of going through Markdown. The Markdown route put the source's
internal id into the student's document and left each quotation as a loose
paragraph.

Now each checked citation becomes a Write `quote` block with its source and
place, which the Word, PDF and Markdown exports print as "— source". The
body's inline markers are numbered to match the quotations. A marker naming a
source that has no checked quotation in that section is removed, since
nothing verified stands behind it.

A draft restored after a reload has no structured sections, so it still saves
through Markdown as before.

## D-036 · Study abroad lives in Pathway, unflagged, and every approval is the student's record

**Taken in P4.1.** (D-030 to D-035 are on their own open branches; D-013–D-029
and D-040 onward belong to the feature-expansion work.)

**Where it lives.** Study abroad is a tab of Pathway, the screen for projects
that outlast a term, and not a new screen. A new screen would need a nav
entry, and the only per-screen gate (`lib/school.ts` `REQUIRES`) describes
what a *school* offers, not a build flag. `Career.tsx` already has a
nine-step abroad checklist, and #792 is restyling that screen, so the new
module does not touch it.

**No flag.** The module keeps student-entered data on the device, in the
workspace backup, sends nothing, and reads no institution data or #762
table. That is the same risk class as Career's existing checklist, which is
unflagged. The expansion work's `MODULE_FLAG_ENV` map exists only on its
unmerged branches, and a new `VITE_` variable would also need the Pages
workflow changed (`lib/deploy.test.ts`).

**Approvals.** Every course approval is labelled as what the student
recorded, with where they recorded it from. Only credit recorded as
pre-approved is counted as credit to plan on; pending and estimated credit
is shown separately. Costs stay in each program's own currency and are never
converted or summed.

Rejected: reading `articulation_rules` or `transfer_evaluations`, the
institution-verified source, which needs a live school connection (Phase 6).

## D-032 · A PDF page is taken from the quote, never from the model

**Taken in P3.1 (Study Studio source anchors).** (D-030 and D-031 are on
their own open branches; D-013–D-029 belong to the feature-expansion work.)
`extract.ts` now keeps a PDF's pages as well as its flat text, and marks them
`pageUnit: 'page'` against a deck's `'slide'`. The flat text is unchanged, with
no page numbers printed into it, so every existing quote check, word count and
content hash is too. That means a model reading a PDF's text cannot see its
page numbers, so a page it names is a guess that merely lands on a page that
exists. `harvest.ts` therefore takes a PDF card's page from the one page whose
text contains the card's checked quote, and gives none otherwise. Slide numbers,
which are printed in a deck's text, keep the old rule. Classification no longer
reads "has pages" as "is a deck" unless the pages are slides. In Study Studio a
PDF's pages become excerpts named "Page N", like a deck's slides, and a citation
opens the original PDF at that page. Rejected: printing "Page N" into the flat
text, which would move every stored quote and hash.

## D-037 · Athlete and supporter sharing: one consent pattern, three tables

**Decided by owner 27 Sep 2026 — every recommendation approved.** The
decisions are:
- **D1:** a new `athletic_academic_support` role.
- **D2:** compliance officers and coaches cannot receive a share.
- **D3:** the recipient sees only "This share has ended", whether the share
  was revoked or expired.
- **D4:** a share lasts at most one term, capped at 200 days.
- **D5:** supporters get `selected` access only.
- **D6:** adopt the family-invite branch.

D7 (the school's registrar and compliance review of the consent wording)
stays open until a pilot school gives it. Applying any migration to
production still needs separate approval. (D-030 to D-036 are on their own open branches;
D-013–D-029 and D-040 onward belong to the feature-expansion work.)

The full design is in [CONSENT-SHARING-DESIGN.md](CONSENT-SHARING-DESIGN.md).

Supporter, advisor and athletic academic-support sharing follow one pattern:
- the student starts it;
- one named person, not a link;
- named items, not whole categories;
- a required expiry of at most one term;
- revocation that applies at the next read;
- the recipient accepts;
- every read is logged and visible to the student;
- an exact preview before granting;
- nothing is sent on the student's behalf;
- nothing is inferred for the recipient.

The three relationships each get their own table:
- supporter sharing keeps `family_grants`, plus the unmerged invite branch;
- athletic academic support gets a new `support_shares` table, modelled on
  `accommodation_shares`;
- advisors get `advisor_shares`, per D-016.

Keeping them separate means one relationship's policy bug cannot expose
another relationship's data.

Seven owner decisions are listed in §9 of the design doc (D1–D7). They
cover:
- the athletic academic-support recipient role;
- excluding compliance officers and coaches;
- what a recipient sees when a share is revoked;
- the maximum expiry;
- the pilot's access levels;
- adopting the invite branch;
- review of the consent wording by the registrar and compliance office.

Every migration needs approval before it is applied to production.

## D-038 · A supporter reads a confirmed copy, through one logged reader

**Decided 27 Sep 2026, building slice 3 of D-037.** A claimed code is a live
`family_grants` row naming items by id, and those items existed only on the
student's device. So a supporter had nothing to read.

- **The confirmation carries the content.** `make_family_share` makes the code
  and stores a copy of exactly the items it names, in one transaction. A code
  never exists without its content, and content is never stored without a
  confirmed code. An item that is not named, or is in a category the code does
  not cover, is refused. So is a named item that is not carried.
- **A copy, not a sync.** Editing an item on the device afterwards changes
  nothing the supporter sees until the student shares again and confirms again.
  A change that reached the supporter by itself would be a share nobody
  previewed (design §6).
- **One read path, and it logs.** Neither table has a policy for the
  supporter. `read_family_share()` re-checks each grant at every read
  (accepted, not revoked, not expired, not `payment`) and returns only named
  items in the grant's own category. It writes one log row per student before
  it returns anything. The student sees each read on Family, with when and how
  many items. The supporter cannot read, write or delete the log.
- **The supporter reads on request.** Nothing is fetched when the Family screen
  opens, because each fetch is a read the student sees.
- **Stopping** revokes every live grant naming the person's items and removes
  the copies. The supporter's next look says "This share has ended.", the same
  words as expiry (D3).

Proved by `supabase/familyshare.check.sql` (38 checks). Five guards were each
removed in turn, and the suite failed every time.

The migration is `20260928307000_family_shared_items.sql`. **Applying it to
production needs owner approval**, as #815's does, and it must be applied after
#815's migration.

## D-039 · Support shares follow advisor shares, and re-check the role on every read

**Decided 27 Sep 2026, building slice 4 of D-037.** The table is
`support_shares`. It follows the other session's `advisor_shares` (D-016,
#802) column for column, so the two staff shares don't diverge: one named
recipient, found by address only among role holders at the student's own
school; a previewed snapshot; a logged reader; and revoking works one way only.

It differs in three places, each required by the design:

- **The role is checked again at every listing and every read**, not only when
  the share is made. A staff member who loses `athletic_academic_support`, or
  whose grant expires, stops seeing the share without anyone revoking it (§4).
- **Compliance is excluded** when the share is made and at every read. That
  includes someone who holds both roles, and someone who takes on compliance
  after the share was made (D2).
- **The payload can hold only the six athlete items.** A column check refuses
  any other key, so grades, NIL, the hours log and health records can't fit
  whatever a client sends. A TypeScript test holds `ATHLETE_SHAREABLE` to the
  migration's list.

D1 adds the role `athletic_academic_support`, with no capabilities. A grant
scoped to the school or to anything inside it (`<school>/…`) counts. Every
refusal gives the same answer: an unknown address, the wrong office, another
school, a revoked grant. So the lookup reveals nothing about who has an
account or where they work. The same holds for an ended share: revoked,
expired and lost role all read "not shared with you" (D3). The maximum length
is 200 days (D4).

Proved by `supabase/supportshares.check.sql` (45 checks). Five guards were
each removed in turn: the read's role re-check, the listing's role re-check,
the compliance exclusion, the payload keys and the log. The suite failed every
time.

The migration is `20260928308000_support_shares.sql`. **Applying it to
production needs owner approval**, and it goes after #830's migration. The
athlete's screen is slice 5.

**Slice 5, the screens (added 27 Sep 2026).** Athletics → Share is where the
athlete chooses what to share, previews it and confirms. The staff page uses
the same view as the preview, so the preview can't show something the staff
page doesn't. The page also lists each share with when it was opened, and
stopping it takes one button.

Two of the six items are **not offered, and the picker says why**. Semester
keeps no record of whether an absence email was sent, and none of which
travel-pack items are done. Offering them would mean sharing a status the app
made up. The same applies to the design's "whether you contacted the
instructor" on missed classes, so that line now reads "from your syllabus".

Staff listing is not logged; opening a share is. An ended share tells staff
only "This share has ended." (D3). Nothing is computed about the athlete.
Deadlines carry their source label ("Imported" or "Needs review") by the same
rule Today uses. Slice 5 adds no migration.

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
- **Resolved in Phase N (D-057).** Both stores are now backed up, together
  with the nine device stores the later phases added, and a test reads the
  source to hold it.

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

## D-051 · Phase K finishes course demand with one additive migration

**Proposed — needs owner before any merge to `main`.**

- `20260927234800_course_demand_forecasting.sql` finishes what
  `20260926150000` began. It adds:
  - `demand_consents`, a per-term consent record that only the student can
    read;
  - three student functions: `contribute_course_plan`, `stop_contributing`
    and `my_demand_contribution`;
  - two staff functions: `my_demand_scopes` and `course_demand`;
  - a refresh wrapper, `refresh_course_demand_snapshots`, callable by the
    service role only.
- **The refresh counts only live consent.** `private.refresh_course_demand`
  now joins `demand_consents`, so a `contributes_to_demand` flag set any
  other way counts for nothing.
- **Own school only.** The `term_plan_courses` owner policy now refuses a
  contributing row at any school but the one on the student's profile.
  Before, it checked only the owner.
- **Nothing schedules the refresh.** A school turns it on with the feature.
  See `docs/COURSE-DEMAND-FORECASTING.md`.
- **Checked on a throwaway Postgres 16.** Every migration applies and every
  suite passes, including `demand` (49 new checks).
  - `expansion` now gives its opted-in students a consent record, since the
    flag alone no longer counts.
  - Seven faithful reverts each turned `demand` red:
    - no consent join;
    - no own-school check;
    - the threshold;
    - a definer view;
    - stopping that keeps rows;
    - an open refresh;
    - backups below ten.

    The last two were caught by the table's own check constraint as well.
- **Not applied anywhere.** As with D-025, D-043 and D-048.

## D-052 · What a student contributes, and how stopping works

**Decided 27 Sep 2026 (Phase K).**

- **Only course codes, each a primary or a backup.** The term is the
  cart's. No section, time, instructor, title or name is sent. A test checks
  every key of the payload.
- **Codes are normalized.** "econ1010" becomes "ECON 1010", in both the app
  and the database, because the department scope splits on the space.
- **Only on confirmation.** The dialog lists exactly what is sent and what
  is not. A changed cart is pointed out, and never re-sent quietly.
- **Stopping is prospective.** It removes the rows and stamps the consent
  at once. Counts already published keep the student until the next
  refresh, and no refresh after that counts them. Both dialogs say so.

## D-053 · What staff see

**Decided 27 Sep 2026 (Phase K).**

- **A new Demand tab on University, behind the flag.** Only accounts with
  `demand:read` see counts: the registrar, a department chair, a dean or
  institutional research. Anyone else is told they have no demand scope.
- **Counts, never rows.** A course appears at ten or more planning it.
  Backups below ten show as "Fewer than 10 hold it as a backup". The reader
  drops any count below ten a second time.
- **Source labels.**
  - Counts are labelled **Estimated**, with their time. They are plans, not
    enrollments.
  - Capacity and waitlist are **Imported** from synced sections, with the
    sync time. With no sections synced, the line reads "Capacity not
    connected".
- **Stated on both screens:** "Based on anonymized planning data from
  students who chose to contribute." and "Not used for admissions or for any
  automated enrollment decision."
- **No export.** The Operations studio's `suppress()` (complementary
  suppression) is not needed here, because nothing publishes a total that a
  hidden cell could be subtracted from.

## D-054 · Semester Wrapped counts outcomes the student chose, on the device

**Decided 27 Sep 2026 (Phase L).**

- **Worked out on the device each time it is shown, from the student's own
  records.** Nothing is stored and nothing is sent. The sources are:
  - deadlines ticked (`done` and `tickedAt`);
  - study sessions finished (`sessions[].doneAt`);
  - Action Center steps completed;
  - courses on their own record with a grade for that term;
  - saved schedules;
  - advisor agendas with a date in the term;
  - portfolio projects and finished résumé bullets (Phase I);
  - career events saved.
- **Never app usage.** Screens visited, recent screens, `countScreens` and
  `lib/usage.ts` counts are not inputs (D-005, rule 7). A test passes usage
  in and gets the same recap. Another sets the component's usage state high
  and gets the same card.
- **Nothing from the institution.** No office action, demand count, seat or
  catalog figure is read.
- **The term** runs from the first of its season's month to the first of the
  next season's. Fall is 1 Aug to 30 Nov. The card states the span.
- **How it speaks:**
  - a zero is left out;
  - a quiet term is "fine";
  - no streak, rank, comparison or "could have";
  - a test checks every sentence it can produce.
- **Export, image and share each confirm first**, showing the exact text and
  where it goes. The text holds counts and the term only — no name, course,
  agenda text or date.
  - The image is drawn on a canvas; where there is none, the card says so and
    saves nothing.
  - Share appears only where the device has a share sheet.

## D-055 · Offline mode reuses the device as the queue, and the merge as the conflict strategy

**Decided 27 Sep 2026 (Phase M).**

- **Already local-first.** The app saves every change on the device first
  (IndexedDB `semester-store`, or `semester.v1`), and pushes the account copy
  after it. A second outbox that copied changes would be a second truth that
  could disagree with the first, so there is none.
- **A ledger per account instead.** `semester.offline-ledger.v1:<account>`
  records when the account last took this device's copy and since when it
  has not.
  - Going offline while signed in, or a push that fails, starts
    "not synced".
  - A sync clears it.
- **Sync on reconnect.** Coming back online with changes waiting calls the
  store's own `refresh()`: pull, merge, then push. With nothing waiting or no
  account, it does nothing.
- **Conflicts use the existing per-field policy** in `lib/merge.ts`:
  - lists, by id: both sides are kept;
  - ticks: unioned;
  - timestamped records: the newer wins;
  - settings: the later copy wins, except device settings, which this device
    keeps.

  The merge notes the app already shows after a sync say what happened. A
  test holds an offline edit meeting a remote one.
- **No service-worker change.** `public/sw.js` already serves same-origin
  files from its cache and refreshes them in the background, so every chunk
  the app has loaded works offline. No `VERSION` bump is needed, so no
  rollback note either.
- **Behind `offline_mode`:** the badge, the refusals and the offline wording.
  With the flag off, nothing changes. The app was local-first before this
  phase and still is.

## D-056 · High-risk actions are refused offline, never queued

**Decided 27 Sep 2026 (Phase M).**

- `requireOnline(kind)` throws before any of these runs offline:
  - sharing with an advisor;
  - sending to the school: office "Mark done", "What applies to me" and
    contributing to course demand;
  - publishing office actions;
  - deleting the account.

  Each says "nothing was sent and nothing is waiting to be sent".
- **An official hand-off cannot be confirmed offline.** In an external
  `ConfirmDialog`, the dialog says so and its confirm button is disabled.
- **Not blocked: revoking a share and stopping a contribution.** They undo
  rather than send, and they fail on their own offline with the ordinary
  error.
- **Why not queue them.** A queued share or contribution would fire hours
  later, after the student may have changed their mind, and from a screen
  they are no longer looking at.
- **Imported data is never shown as current offline.** The office feed and
  the demand view keep no cached copy. Offline they say they load when
  connected. `asOf(at)` is there for any imported figure shown from the
  device.

## D-057 · The Trust & Data Center is a hub over what exists, and Export covers every device store

**Decided 27 Sep 2026 (Phase N).**

- **Where it is.** At the top of Your data (`privacy`), with a **Trust &
  data** row on Me › You that opens it. The rest of that page already had:
  - account deletion;
  - erasing this device;
  - supporter access;
  - the diagnostics export;
  - the privacy explanation.

  The center points to those rather than copying them.
- **New controls, each confirming first and saying exactly what goes:**
  - revoke an advisor share (Phase G);
  - forget a line Semester remembers (`aboutMe`, the student's own words);
  - delete the saved AI conversations (`lib/threads.ts`, archive included),
    and nothing else.
- **Shown, read from the stores that already exist:**
  - connected sources and the last sync;
  - what the five source labels mean;
  - imported materials, and which of them AI may not use (Source Locker);
  - notification permission;
  - export.
- **The AI memory panel is `aboutMe`.** The `ai_memories` table is not
  written by the app; if it ever is, its rows belong on this panel.
- **Export covers every device store (fixes D-018).** `lib/workspace-backup.ts`
  gains a `device` scope and these stores:
  - registration;
  - registration day;
  - graduation;
  - life balance;
  - shortlist;
  - advisor meetings;
  - Source Locker;
  - study readiness;
  - career evidence.
- **Guarded against recurring.** `workspace-backup.coverage.test.ts` lists
  every file that calls `useDeviceLibrary`, with how many times, and every
  store prefix: backed up, or exempt with a sentence. A new store fails until
  somebody decides. Exempt:
  - the offline ledger, which is sync bookkeeping;
  - stores other modules added (launchpad, opportunities, hub, support,
    NIL, toolkit, directory, housing and meal plans, study journal,
    operations). They are listed as waiting on their owners rather than
    changed from here.

## D-031 · Public tool pages may run one same-origin script

**Taken in P2.2, within D-011.** (Numbered after D-030; D-013–D-029 belong to
the feature-expansion work.) The content pages ship no JavaScript and say so in
their policy (`script-src 'none'`). The four public tools cannot answer a
question without running code, so their pages, and only theirs, load one
bundled file, `tools/tools.js`, under `script-src 'self'` with `connect-src
'none'` — no inline script, nothing from another origin, and no network
request the page could make with what a student types. Each tool is
prerendered, so it reads without scripts, and hydrates with the app's own
functions (`project()`, `conflicts()`, `CHECKLIST`). `site.test.tsx` holds the
policy per page; `tools/Tools.test.tsx` holds hydration. Rejected: sending
visitors into the app for each tool (the P2.1 stop-gap), which asks for
onboarding before an answer.

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
`20260928309000_course_studio.sql`.

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

## D-103 · Course Studio slice 3: the faculty screens open from Account, and preview with the students' engine

**Decided 27 Sep 2026, building slice 3 of D-100.**

- **Where it lives.** It opens from the Account screen, under "Teaching". The
  design said "opened from a course" (F6), but a faculty account usually has
  no courses of its own in the catalog. Study shows a first-run page to such
  an account, so there would be no course to open it from. The entry shows
  nothing at all unless:
  - the `course_studio` module is on;
  - somebody is signed in;
  - `my_course_studio_courses()` names at least one course.
- **Tabs.** AI rules, Guidance, Study packs and History.
  - **AI rules:** a blanket plus the ten named uses, the instructor's own
    words, an optional syllabus link and an effective date.
  - **Guidance:** one note; publishing it empty is a stated withdrawal.
  - **Study packs:** named, ordered references (title, citation, http link,
    and a use: authoritative, supplemental or do-not-use), which can be edited
    or retired.
  - **History:** every version, with its time.
- **Preview.** Every publish is previewed first. The rules preview is drawn by
  `fromInstructor` and `card`, the same engine the students' screens use, so
  the preview can't disagree with what they see.
- **Confirmation.** Every publish asks for confirmation, and says that a
  published version is never changed.
- **F3.** Permitting `final-answers` (allowed, with disclosure, or required)
  needs its own "I mean it" confirmation before Publish is enabled.
- **Client checks.** The screens check what the server checks (lengths, http
  links, a named pack, titled references), so a mistake is named before the
  publish. The server stays the authority, and the one that decides who may
  publish at all.
- **F5.** The screens show nothing about students. A test walks every tab.

## D-104 · Course Studio slice 4: a pack is a reading list, and "do not use" is held back by title

**Decided 27 Sep 2026, building slice 4 of D-100.** The design said packs
would appear in Study Studio "as source sets: choosing one selects its
references". A pack's references are links and citations, not text (F4 kept
Semester from hosting files), so there is nothing for a click to select.
Instead:

- **Reading list.** Study Studio lists the course's packs as "Study packs from
  your instructor". Each reference opens where it lives and is labelled
  Authoritative, Supplemental or Do not use. The student adds one as a source
  through the existing upload and paste flows.
- **"Do not use" is enforced on what is sent.** Before generating,
  `packGuard` compares the ticked sources with the pack's do-not-use
  references by title, ignoring case, punctuation, spacing and the file
  extension. A match is held back, named on screen, and never sent, whatever
  the student ticked. If everything ticked is held back, nothing can be
  generated.
- **What the guard is not.** It compares titles, not documents, and the screen
  and code say so. It is the instructor's list applied to the selection, not a
  plagiarism detector.
- **Proof.** A component test shows a held source's text is absent from the
  AI payload, and it fails when the guard is bypassed.
## D-058 · Review fixes to the merged feature expansion

**Decided 27 Sep 2026, after the twelve expansion PRs merged into
`semester-unified-platform`.** Codex reviewed each PR when it left draft,
and its findings arrived after the merges. Every one was verified and fixed
together; `docs/EXPANSION-REVIEW-FIXES.md` maps each finding to its fix and
its test.

- **Staff read only their own office's actions.** The table's read policy
  now asks `private.may_publish`, as the desk and the workflow already did.
  Rows from before Phase J keep their original rule.
- **Delete my account reaches every row it promised.** Two functions:
  `forget_my_course_demand()` (plan rows and consent) and
  `forget_my_advisor_shares()` (either end). The auth user is not deleted,
  so the foreign-key cascades the earlier comments relied on never ran.
- **A shared device keeps accounts apart.** Advisor meetings are stored
  per account. Every panel that fetches for an account resets when the
  account changes. Graduation drafts remember which account saved them.
- **Private notes stay on the device.** The workspace backup leaves them
  out. A restore keeps the notes already on the device.
- **Migration.** `20260928310000_expansion_review_fixes.sql`: one policy
  and two functions. It changes no table and no data. It needs owner
  approval with the rest of D-025, D-043, D-048 and D-051 before
  `semester-unified-platform` goes to `main`.

## D-105 · Six integration migrations renumbered above production's ledger

**Decided 27 Sep 2026, merging main into the integration branch so it can reach
main (owner-approved).** Production's ledger ends at
`20260928041700_space_availability`. Six integration migrations were numbered
below that, and Supabase refuses a version older than one already recorded, so
the deploy off main would have failed on the first of them:

| Was | Now |
|---|---|
| `20260927181500_untouched_graduation_drafts` | `20260928130000` |
| `20260927201500_advisor_shares` | `20260928131000` |
| `20260927224500_office_action_feed` | `20260928132000` |
| `20260927234500_untouched_graduation_after_help` | `20260928133000` |
| `20260927234600_untouched_advisor_after_help` | `20260928134000` |
| `20260927234800_course_demand_forecasting` | `20260928135000` |

- **Order kept.** They stay in their own order, after everything production has
  run and before the sharing and Course Studio migrations
  (`20260928140000`–`150000`). No live database ever recorded the old numbers;
  preview branches that did are rebuilt from the files.
- **What moving them changes.** Moving past production's migrations, the only
  object any of them shares with one it now follows is `lti_account_untouched`,
  which `help_requests`, `mentor_rosters` and `community` also define. The
  sharing migrations define it last, so they now carry every row: main's
  mentor and community rows had been missing from all three, and
  `ltiaccount.test.ts` fails without them.
- **References.** Code comments, docs, check suites and RETENTION name the new
  files. Earlier entries in this log keep the numbers they were written with.

## D-106 · Three findings on the merge to main, fixed before it

**Decided 28 Sep 2026.** Codex reviewed #893 (integration → main) and raised
three P1 findings, each about who can see a student's shared data. All three
are fixed in migrations that have not been applied anywhere live, and each fix
has a check that fails against a faithful revert of it.

- **A family share's copy belonged to the item, not to the share.**
  `family_shared_items` was keyed by student and item, so sharing an item
  again rewrote the row every earlier grant read: a second share changed what
  the first supporter saw, which D-038 says never happens. Copies are now
  keyed by code and item, a claimed grant records its `invite_code`, and
  `read_family_share()` reads only its own code's copies. Stopping a share
  still removes every copy of those items.
- **An advisor's role was checked only when a share was made.** An advisor
  whose `academic_advisor` grant was later revoked or expired could still list
  and open shares. `list_advisor_shares()` and `read_advisor_share()` now
  re-check the live grant at the share's school on every call, as the
  support-share readers already did.
- **Delete my account left support shares at the staff end.** Deleting an
  account signs out and deletes no auth user, so nothing cascades, and a
  staff member has no delete policy on shares addressed to them.
  `forget_my_support_shares()` removes every share naming the caller at
  either end, and the deletion list uses it, as it does for advisor shares.

## D-107 · The eleven integration migrations renumbered again, above 28 September's ledger

**Decided 28 Sep 2026, merging main into the integration branch (#893).**
Production's ledger now ends at `20260928230000_direct_rate_limits`: #819, #839,
#814 and #896 landed `200000`–`230000` on main, and all four were applied. The eleven
migrations D-105 placed at `20260928130000`–`160000` were then below the
watermark, and the deploy off main would have refused the first of them.

| Was | Now |
|---|---|
| `20260928130000_untouched_graduation_drafts` | `20260928300000` |
| `20260928131000_advisor_shares` | `20260928301000` |
| `20260928132000_office_action_feed` | `20260928302000` |
| `20260928133000_untouched_graduation_after_help` | `20260928303000` |
| `20260928134000_untouched_advisor_after_help` | `20260928304000` |
| `20260928135000_course_demand_forecasting` | `20260928305000` |
| `20260928140000_family_invites` | `20260928306000` |
| `20260928141000_family_shared_items` | `20260928307000` |
| `20260928142000_support_shares` | `20260928308000` |
| `20260928150000_course_studio` | `20260928309000` |
| `20260928160000_expansion_review_fixes` | `20260928310000` |

- **Order kept**, and nothing on main or in the ledger sits between them.
  No live database ever recorded the `13xxxx`–`16xxxx` numbers.
- **The guard, refreshed.** `supabase/ledger.snapshot` now holds the live
  reading of 28 September. With it, `migrationorder.test.ts` names all eleven
  at their old numbers; renumbered, it passes. `MIGRATION-HISTORY.md` has the
  reading.
- **References.** Code comments, docs, check suites and RETENTION name the new
  files. D-105's table keeps the numbers it was written with.


## D-108 · The modernization blueprint is a crosswalk onto the master register, not a second register

**Decided 28 Sep 2026.** Three documents arrived on 28 September — the
*Semester Product Modernization Blueprint*, the *Product architecture audit*
it was written from, and the longer enhancement paper behind both — and are
kept under `docs/expansion/` as supplied. Nearly every item they name is
already a row of the master launch readiness register: the two plans describe
the same platform. So they are held to the tree as
[MODERNIZATION-BLUEPRINT.md](MODERNIZATION-BLUEPRINT.md), rendered from
`app/src/lib/blueprint.ts`, where each of the blueprint's twelve points,
twenty-seven front-end priorities and eighteen platform items points at the
master rows that carry it, with a standing read off the tree and held by a
test to the kind of file it cites. Rejected: a fourth register with its own
statuses, which would drift from the master's within a week.

Four master rows were re-read for it: LMS-002 and LMS-016 after Course Studio
(#893), SRE-010 after the status page (#902), AI-012 after the kill switch was
wired (below). The blueprint's decision rule — prioritise work that does at
least two of ten things — is `prioritised()` in the same file, and everything
built in the same change is scored against it.

**Where the blueprint conflicts with a decision already on main, the decision
holds until the owner reopens it.** The conflicts:

| Blueprint asks | Decision on main | Held as |
|---|---|---|
| Five student destinations as *the* navigation | D-003: the five are the primary tab bar behind `journeyNavigation`, the shelves stay; roots fixed by DO-NOT-BUILD rule 1 | BP-01, FE-01 partial. D-003 also misstates `DEFAULT_TABS`, which is `home, calendar, study, support, me` |
| A native gradebook, module builder, batch and anonymous grading | [FACULTY-COURSE-STUDIO-DESIGN.md](FACULTY-COURSE-STUDIO-DESIGN.md), 27 Sep: no duplicate LMS or gradebook; instructors see no individual student data | BP-05, FE-16, FE-19 held; the student-side pieces (autosave, what-if) proceed |
| A Revenue Operations console module | D-009: billing stays out | OC-01 names it; no revenue module |
| A server-side permission-aware search index; an external immutable audit archive | ADR 0006 (search is one ranker, on the device); ADR 0003 (no second database, no event bus) | BE-04 held; BE-03's archive named as needing the ADR reopened |
| No "behind" or "at risk" labels anywhere | `When you are behind` is a screen (`lib/nav.ts`) that states facts without red or encouragement; the `UNCALM` guard covers Today | Not held: nothing forbids it. Recorded so the rename is a decision, not a drift. Proposed — needs owner |
| A Semester-internal, cross-tenant operations console | DO-NOT-BUILD rule 1: no new top-level navigation; the school-side tools live under `university` | OC-01 partial: the console would live under an existing root |

One thing the blueprint asks for that was already decided *for* it: a modular
monolith, not microservices, which ADR 0003 has said since the gateway was
designed.

## D-109 · The AI kill switch is read by everything that generates, and an unreadable switch is thrown

**Decided 28 Sep 2026.** `kill.ai_generation` had been a row in
`feature_kill_switch`, the rollback named by every AI flag in the registry, and
the gap in AI-012 — nothing that called a model asked. Now both runtimes do:
the `claude` edge function before the body is read or the call counted, and
the institution gateway before the policy is loaded, refusing `policy` and
`respond` with `ai-generation-killed` and journaling the refusal as
`kill-switch`. The rules are the integration worker's, copied rather than
reinvented: the global row stops everyone, a school's row stops its school,
and a switch that cannot be read is engaged, because the moment the switch is
needed is the moment a read is likeliest to fail. The decision is one pure
function (`supabase/functions/_shared/killswitch.ts`); the gateway repeats its
two lines rather than importing them, because nothing the NodeNext build
compiles may reach under `supabase/functions/` (the #803 lesson).

Outside the switch by design: a student's own key on their own device
(`lib/claude.ts`). That is their key and their bill, and a switch on
Semester's generation is not a switch on theirs.

## D-110 · Public claims carry a register word; the console's controls are data before the console

**Decided 28 Sep 2026.** Two reviews of the company-site and operations-console
prototypes reached the same finding from different sides: the prototypes said
"SAML SSO", "193 tables under RLS" and "over 10,000 tests" as strings in a
file, and nothing tied a public sentence to what the deployed product could
show. The repository's public site (`app/src/site/`) had never made those
claims, but it had no mechanism that would stop it either, and
`SEMESTER-OPERATING-SYSTEM.md` listed the claims register PRG-002 asks for as
missing.

- **Every capability the public site names is a row of
  `app/src/lib/ops/claims.ts`**, with its wording, one of six words
  (Available now, Limited beta, Institution-configured, Built and tested,
  In preparation, Planned), the master-register rows it rests on, the tests
  or documents behind it, and the pages it appears on. Each word has a floor:
  the lowest register status its rows may hold. `claims.test.ts` renders the
  site and refuses a word above its rows, an "available" with no test, a
  page that does not print the wording, and any `data-claim` the register
  does not know. Each check was shown a fixture it must catch. PRG-002 moves
  to `tested`; its gap is that sales and RFP material is not yet mapped.
- **Three pages join the site:** `/launch-readiness/` (every claim, by the
  audience it answers, and what the words mean), `/proof/` (the customer
  proof policy, written before there is proof) and `/legal/` (every policy,
  its status, version and effective date; none in force). The home page asks
  what brought the visitor; contact routes each topic to a council seat and
  promises no response time; pricing says currency, period, tax,
  cancellation and refunds before anything is for sale.
- **The operations console's controls are `app/src/lib/ops/console.ts`**,
  rendered to `ops/operations-console/README.md`: segregation of duties (a
  requester is never an approver; every party is a seat, an `app_roles` row
  or the student), data classification and the controls each class imposes,
  the context bar and access basis every page shows, the evidence-freshness
  ladder, the production rules a browser prototype could not hold, and the
  five conversion steps. The console map stays missing until there is a
  console.
- **Rejected:** company-domain addresses on the contact page before the
  company owns a domain (they would be invented, which is the fault the
  register exists to stop); a backend for the site's forms (the site has no
  forms and its policy forbids `form-action`, so nothing typed is stored, by
  construction); and marking anything `limited-beta` or
  `institution-configured`, since no design partner and no configured
  institution exists.

## D-111 · Five research documents are held to the tree as crosswalks, and the PDFs are never their own evidence

**Decided 28 Sep 2026.** Five documents arrived on 28 September — the
twenty-six service layers beyond coursework; the transfer hub, career OS,
safe-AI and basic-needs designs; privacy by module and the liability controls;
the FERPA consent workflow, the AI model-training policy and the NIST AI 800-1
checklist; and the NIST AI RMF audit matrix — and are kept under
`docs/expansion/` as supplied. Each is held to the tree the way D-108 held the
modernization blueprint: as data under `app/src/lib/` rendered by a test, with
every cited file existing, every status held to the kind of file it cites, and
every id it names (master rows, expansion areas, `app_roles`, source labels,
lifecycle gates, `AI_RELEASE_GATE`, `PROHIBITED_STARTING_SCOPE`, migration
columns) checked against the register that owns it.

- **A supplied PDF is never evidence.** A design that arrived this morning is
  not a design the repository had; every test refuses a status that cites one.
  So the pages read as what the tree can show, which is a great deal less than
  the documents describe, and the gap column says so.
- **The service register marks capabilities, not only modules.** A status is a
  claim about the best piece of a module, so nearly every module is `tested`;
  each capability the document asks for is marked present or absent and the
  page counts them, so a module `tested` at 3 of 12 reads as mostly missing.
- **Crosswalk, not a second register.** The AI assurance matrix puts each row
  at the gate `ai-lifecycle.ts` already owns for its function, and holds a
  tier-4 "do not deploy" domain to the intake refusals: two domains the
  document names (admissions, accommodation) are not yet refused in code, and
  the page says so rather than implying they are. The release gate names the
  `AI_RELEASE_GATE` item that carries each line, and four lines have none. The
  privacy model's role matrix names the `app_roles` row for each role, and a
  basic-needs case manager has none. The FERPA data model names the column
  that carries each field, and six fields have none.
- **NIST AI 800-1 is a second public draft.** It is cited as a voluntary
  source of controls, never as a certification or a finalized requirement,
  and the rendered page carries that caveat by test.
- **The no-training policy is a draft for counsel**, in `docs/trust/`, held
  to the privacy page's existing "Nothing is used to train anything" and to
  the privacy-policy draft; the DPA checklist's unchecked no-training clause
  stays unchecked until provider terms are on file.
- **Not changed:** `ai-lifecycle.ts`, `rolelaunch.ts`, `source.ts` and the
  migrations. Adding the two missing intake refusals, a `purpose` and an
  `access` column on the share tables, and a case-manager role are proposals
  the pages make, for the owner to take up; none is made here.
- **Found on the way, not fixed here:** `risk.ts` R-07 still says the AI
  runtimes do not consult `kill.ai_generation`, which D-109 closed; the row is
  out of date and should be re-read.

## D-112 · Seven documents on learning, assessment, grading, LMS interoperability and one system are held to the tree, and the faculty side is named as the sandbox it is

**Decided 28 Sep 2026.** Seven documents arrived on 28 September — the
learning, work-completion, assessment and gradebook system; the EdTech stack
audit; the sortable LMS matrix; the Gradescope, Copyleaks and Turnitin
comparison with the QTI 3 migration checklist; the LMS API comparison; the
developer migration guide with the one-system grammar; and the migration
runbook with the shared object model — and are kept under `docs/expansion/`
as supplied. Each is held to the tree the way D-111 held its five: as data
under `app/src/lib/` rendered by a test, with every cited file existing,
every status held to the kind of file it cites, and every id or name it uses
checked against the thing that owns it (master rows, the tutor's modes, the
`lti_platform` columns, the key module's scopes, the question kinds, the
`Question` type's properties, the lifecycle gates, the forbidden measures,
the prohibited modes, the app's roots, the provenance words, the Me control
rows).

- **A supplied PDF is never evidence.** Every test refuses a status that
  cites one, so each page reads as what the tree can show.
- **The faculty side is the sandbox, and every mark that rests on it says
  so.** The only submit → grade → release loop in the tree is the labelled
  sandbox in `app/server/institution/sandbox.ts`, which loads only when asked
  for. The learning register's rubric engine, gradebook and grading workflow
  areas are `tested` on its tests, and a guard holds each of their gaps to
  the word "sandbox"; the grading page's fairness controls say the same.
- **No universal accuracy number, by test.** The three-product comparison
  refuses any cell that quotes a percentage. The two rules the documents
  repeat most are held to the AI intake, the one gate every use case passes:
  an automatic misconduct accusation is refused there as a disciplinary
  judgment; an AI-only grade is refused by nothing there. No grading
  workflow holds either, because none exists, and the analytics guard that
  refuses an integrity-flag metric refuses a measure, not an action. The
  test imports the intake list and the prohibited modes, so a refusal added
  later fails the page until it is re-read.
- **Standards first, discovery second, proprietary APIs third.** The LMS
  page holds the registration record the documents ask for to `lti_platform`
  (eight of twenty-four fields have a column; the AGS and Deep Linking
  endpoints arrive per launch by design), the Canvas scopes to the four the
  key module defines and the roster scope it refuses, and the grade write to
  what the AGS post has: an institutional gate, and no preview, idempotency,
  reconciliation, exception queue or emitted audit event.
- **Present means a renderer, a property or a row.** The QTI page's
  interaction library names the question kind that delivers each pattern
  (five of sixteen), and its item metadata names the `Question` property
  that carries each field (two of fifteen). The one-system page names the
  app root that carries each of the documents' nine areas (Messages and
  Search have none; `courses` has no area), the provenance word for each
  status (none for "needs review"), and the control row for each Me item
  (none for community privacy or consent history).
- **Not changed:** `socratic.ts`, `provenance.ts`, `mecontrols.ts`,
  `ai-lifecycle.ts`, `ltikey.ts`, the migrations and the sandbox. Adding an
  intake refusal for automated grading, a `SourceScopeStatus` component, a
  registration record, a preview on the grade write and NRPS are proposals
  the pages make, for the owner to take up; none is made here.
- **Found on the way, not fixed here:** `docs/LTI-1.3-LAUNCH-RUNBOOK.md` says
  the nonce is spent only after `checkLaunch` returns ok, and the function
  spends the state first, atomically, before the signature is verified, and
  says why; `docs/INTEGRATION-DATA-PIPELINE-AUDIT.md` gap 3 says no worker
  exists, and `app/server/integration/worker.ts` does; `lib/provenance.ts`
  names `components/SourceScopeStatus.tsx`, which does not exist;
  `lib/comms.ts` names `comms.test.ts`, which does not exist. The last two are
  held true by a test until they are fixed.
## D-113 · The SaaS launch kit and the operational-reality documents are held to the tree as crosswalks, and the entity is held to the owner’s attestation

**Decided 28 Sep 2026.** Five documents arrived on 28 September — the
*Semester SaaS Launch Kit* and its summary; the answer to "what should be in
our first pilot agreement, how do we price this module by module, what is our
go-to-market plan, what legal entities and insurance do we need, draft our
governance council charter"; "anything else needed to make this a reality";
and "anything missing for this to be operational" — and are kept under
`docs/expansion/` as supplied. They describe the company around the product:
entity, insurance, contracts, pricing, go-to-market, a governance council, and
the execution, verification and evidence layer that turns a platform into a
business. Almost none of that is code, and the repository can form no company,
bind no policy and sign nothing. So they are held the way D-108 and D-111 held
theirs: as data under `app/src/lib/`, rendered by a test, with every cited file
existing, every standing held to the kind of file it cites, and every id they
name — seats, sales stages, `PilotPlan` fields, edge cases, risks, game days,
maturity controls, launch-kit modules — checked against the register that owns
it.

- **`launchkit.ts` → [SAAS-LAUNCH-KIT.md](SAAS-LAUNCH-KIT.md).** Commercial
  rules, the twenty-item formation checklist, nine coverages with the broker's
  question, the underwriting packet, the seven-document pilot package, the
  fourteen-position term sheet, the eighteen agreement sections mapped onto the
  outline's twenty-six, the SOW on `PilotPlan`, eight pricing layers, twelve
  modules, the bands beside the deal desk's proposed minimums (quoted from
  `DEAL_POLICY` by the test, so they cannot drift), the GTM plan on the sixteen
  sales stages, the council charter on the ten seats, the first thirty days.
- **`operationalreality.ts` → [OPERATIONAL-REALITY-REGISTER.md](OPERATIONAL-REALITY-REGISTER.md).**
  The master-plan fields and five workstreams on the seats, the company
  operating system, the customer-proof engine, five service tiers, seventeen
  factory assets, the readiness test, sixty-four production checks each with a
  guard or none (fifteen have none; seven of nine payment checks, because
  D-009 keeps billing out), eighteen failure scenarios on the edge-case, risk,
  game-day and maturity registers (one, storage outage, is named by nothing),
  the load and cost thresholds, data quality, support, implementation
  capacity, the mutual success plan, revenue operations, key-person
  resilience, the go-live dossier, and the final checklist answered: one yes,
  eight partly, three no.
- **The entity is `held`, not missing.** The kit recommends a Delaware C-Corp
  when venture funding is likely. The owner attested on 28 September (HECVAT
  COMP-01, #925) that Semester is a single-member LLC, which is what
  LAUNCH-DECISIONS item 4 asked for. An LLC exists; converting it is a
  question for counsel when a priced round is planned. Three rows that still
  said there was no company are re-read here: master LEG-001's gap, maturity
  DV-01, and LAUNCH-DECISIONS item 4 itself. LEG-001 stays `designed`: an
  attestation is not a formation record, and `docs/evidence/` does not exist.
- **The pilot term is `held` to the code.** The kit says 90–180 days;
  `gtm/pilot.ts` refuses anything outside 60–120 and the deal desk caps a
  pilot at six months. The code's rule holds until the owner reopens it.
- **No fourth council.** The Product Governance Council's twelve roles are
  mapped onto the launch readiness council's ten seats; three (student
  advisor, finance, operations) have no seat, and the page says so. Forming a
  council means filling seats that exist, not adopting a new charter.
- **Where the tree disagrees with the documents, the disagreement is
  recorded, not resolved:** four of the kit's eight ideal-customer profiles
  are absent from the GTM playbook; the student price band ($8–25) does not
  match the planned plans ($7.99, $14.99); GO WITH CONDITIONS is a verdict
  the code does not have; the module catalogue has no entitlement behind it.
- **Not changed:** `pilot.ts`, `deal-desk.ts`, `launchreadiness.ts`,
  `plans.ts`, `edgecases.ts`. A storage-outage edge case, a `with-conditions`
  verdict, a finance seat, a backup owner per register row, and the
  accessibility-forward customer profile are proposals the pages make, for the
  owner to take up.
- **Found on the way, not fixed here:** `docs/LAUNCH-READINESS-TEST-PLAN.md`
  says `restore.sh` is not in CI and that no ticketing exists; both are now
  false. `docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md` says no status
  page is built; `app/public/status.html` exists.

## D-114 · The security contact is the address the owner has, and the disclosure clocks are the patch policy's

**Decided 28 Sep 2026.** HECVAT VULN-1 ("written severity model and patch
SLAs, public disclosure contact") had sat at `NOT_STARTED` while the
repository held both halves of an answer apart: a severity-to-days table in
`app/src/lib/supplychain.ts` that only the supply-chain register rendered, and
a contact address in `SECURITY.md` that nothing outside a GitHub reader could
find. The compliance crosswalk counted the absence three times over.

- **The published security contact is `harrisonjrubin7@gmail.com`**, in
  `app/public/.well-known/security.txt` (RFC 9116 in form; served under the
  app's base path, not the origin root a scanner starts from, until the app
  has a domain of its own)
  and on the site's `/security/` page — the address the owner actually holds,
  which the app's privacy page already names. D-110 rejected addresses at a
  domain the company does not own, and the same reasoning applies with more
  force to a security contact: an invented one is worse than none. A
  dedicated address replaces this one in three files when the domain exists,
  and `app/src/lib/security.test.ts` fails while the three disagree.
- **One severity model, not two.** `SECURITY.md` carries the four rows of the
  patch policy — critical 2 days, high 14, medium 60, low 180 — for a report
  from outside, a Dependabot advisory and the owner's own finding alike, and
  the test holds the two tables to each other row for row. The clock starts at
  confirmation. The numbers stay **proposed internal targets** until a security
  lead accepts them or a contract or `docs/trust/SLA.md` says otherwise, so the
  public site goes on promising no response time; the one commitment in the
  file is still the 72-hour notice.
- **`security.txt` expires** (six months out) and the test goes red the day it
  does, so renewing it is part of reviewing `SECURITY.md` rather than a
  memory. VULN-1 moves to `IN_PROGRESS` — the writing is done; the record of
  findings answered inside their clocks is not — and the rows that said "no
  security.txt" in the HECVAT draft, the whitepaper, the readiness table and
  the master register's SEC-004 now say what exists.
- **Rejected:** a bounty (no money and no triage capacity behind it); an
  acknowledgement clock in hours or days (one person reads the mailbox, and a
  number would dress that up); and safe-harbour wording written here (legal
  language, held to the same counsel as the notification statutes the file
  already flags as unverified).

## D-115 · The compliance crosswalk computes its scores; the evidence index exists before any evidence; the memo's promises are counted

**Decided 28 Sep 2026.** Nine documents arrived on 28 September — five on
HECVAT 4, the 1EdTech TrustEd Apps rubrics and the EDUCAUSE 2026 priorities
(a scorecard, a compliance matrix with a dashboard API, two crosswalks and a
vendor intake policy), the university edtech audit with its faculty playbook,
an audit scorecard with an evidence register and a retention policy draft, a
memo on what would make Semester the benchmark, and the whole-platform
business model — and are kept under `docs/expansion/` as supplied (three
copies of the crosswalk arrived; one is kept). They are held to the tree the
way D-108 and D-111 held theirs: data under `app/src/lib/`, a test that
renders each page, every cited file existing, every status held to the kind
of file it cites, and every id checked against the register that owns it.
Four pages, and the rules that were decided rather than inherited:

- **A score is computed, never typed.**
  [docs/trust/COMPLIANCE-CROSSWALK.md](trust/COMPLIANCE-CROSSWALK.md)
  (`app/src/lib/trust/compliance-crosswalk.ts`) puts twenty-six domains on the
  documents' 0–4 scale, and each domain names only the rows of the four
  registers it rests on — the HECVAT and FERPA/1EdTech readiness registers, the
  master register and the maturity register. The test reads those registers and
  takes the lower median of the rows' levels. A `tested` or `READY` row is a 2,
  not a 3, because a test proves a control is implemented and nothing about
  whether anybody operates it; a 3 needs an artifact under `docs/evidence/`,
  and while that directory is absent the ceiling is 2 for every domain, held
  by the test to the directory. Twenty-one domains score 1, three score 2, two
  score 0. Rejected: a fifth register with its own statuses (D-108's reason),
  and a single "compliance percentage" (the documents' own guardrail: four
  values, never one).
- **The evidence index exists before any evidence, and says so on every row.**
  [docs/trust/EVIDENCE-REGISTER.md](trust/EVIDENCE-REGISTER.md)
  (`app/src/lib/trust/evidence-register.ts`) fills the operating system's
  "Security/compliance evidence index", missing since it was written: twenty
  rows with the artifact that would prove each control operates, an owner
  seat, a frequency, a visibility class and what the tree holds today. The
  word `produced` is refused by the test while `docs/evidence/` does not
  exist; fifteen rows are `defined` (the control and a test exist) and five
  `owed`. With it: the seven leads as council seats (held or vacant as
  `COUNCIL` says, never written on the page), the feature
  map to HECVAT, the twenty cloud areas marked tree, provider or owed, the
  seven release blockers and what holds each, the retention policy draft read
  into `RETENTION.md`'s classes (nothing customer-configurable, no legal hold,
  no stated backup lifecycle), the twelve sprints and the tiered backlog.
- **The memo's promises are counted, and the count is the finding.**
  [docs/MARKET-LEADERSHIP.md](MARKET-LEADERSHIP.md)
  (`app/src/lib/ops/leadership.ts`) holds the fourteen plays, the thirteen
  *one X* promises, the shared-services rule, the eleven revenue lines and the
  fifteen lines not crossed, the friction index against the first-year
  measures, No Wrong Door against the help routes, the Launch System against
  the ninety-day tasks, and the faculty playbook. Of the thirteen ones, four
  are built, eight partial, one held. The memo's benchmark is `benchmark()`;
  what this change built is scored against it and does not pass, and the page
  says why. The memo's own rule — do not say all-in-one without being precise
  — is a test: the position statement may not contain the phrase.
- **The operational readiness pack reads the gates; it adds none.**
  [docs/OPERATIONAL-READINESS-PACK.md](OPERATIONAL-READINESS-PACK.md)
  (`app/src/lib/ops/readiness-pack.ts`), from two further documents that
  arrived the same day, holds the pack's seven pillars of production safety
  to the registers: every checklist item rests on rows of the four registers
  and the twelve launch gates of `launchreadiness.ts`, and its level is the
  crosswalk's lower median. The launch verdict — GO, GO WITH CONDITIONS,
  NO-GO — is `verdict()`, a pure function of the thirteen gate areas' levels,
  and the test asserts NO-GO today rather than letting the page decide. The
  fifteen dependencies carry the status the tree can show (nothing has been
  tested against a failure; the legal dependency is failed); the eighteen
  minimum runbooks name the document that stands in for each, and no runbook
  carries a tested date because none has one. Rejected: a second gate list
  beside `launchreadiness.ts`, and a master operating plan beside the master
  register — the pack's twenty plan fields are read against the register's
  columns, and the missing ones are named.
- **Two documents #927 anticipated are read against it, not duplicated.**
  #927 landed while this was in review with a no-wrong-door router, a customer
  trust dashboard and the public Semester Standard. The leadership page now
  holds the memo's eight student situations to the router's own `match()`,
  its eleven trust-evidence panels to the dashboard's rows, and its ten
  standard lines to the eleven public commitments of `standard.ts`, which is
  the authoritative version; three plays rose to `built` on that evidence.
- **Four seats were filled while this was in review, and the pages read it.**
  #933 held the founder, product, engineering and success seats to the
  founder, acting, on decision 1 of `docs/LAUNCH-DECISIONS.md`. The four pages
  here had asserted every seat vacant; they now read each holder from
  `COUNCIL` and count the held seats, and nothing is signed because
  `signoffs` is empty. The security seat is still vacant, and the crosswalk's
  security-contact row says so under a test that fails the day it is filled.
- **Where the documents conflict with a decision on main, the decision
  holds:** payments and checkout (D-009), an Operations Console as navigation
  (DO-NOT-BUILD rule 1, D-110), a native gradebook (the Course Studio design),
  a separate trust service (ADR 0003). Each is a row on the leadership page.
- **Two of the fifteen lines are proposed, not held:** nothing forbids
  pay-to-win placement or a premium accessibility module today. They are
  recorded so that a rule is a decision and not a drift; neither is added
  here.
- **Not changed:** the four readiness registers, `boundaries.ts`, the
  ninety-day tasks, the first-year measures. A score moves only when a row
  moves in the register that owns it.
- **Found on the way, not fixed here:** `risk.ts` R-07 (D-111's finding)
  still stands; the retention schedule does not state the provider backups'
  lifecycle. #934 published the security contact while this was in review
  (D-114), so the crosswalk's security-contact artifact is `have` and VULN-1
  is read as in progress; the remediation targets are still proposed, not
  accepted, and no finding has been answered against them.

## D-116 · R-07 is re-read to what D-109 built, the provider's backups have a lifecycle, and the remediation targets wait on a named acceptance

**Decided 29 Sep 2026.** D-115 left three things found and not fixed. Two are
closed here, and the third is put where the owner's decisions live rather
than left as a sentence at the end of a log entry.

- **R-07 said the AI runtimes do not consult the kill switch.** They have
  since D-109, and `app/src/lib/aikillswitch.test.ts` and
  `app/server/institution/intelligence.test.ts` hold them to it; D-111 found
  the row out of date and nobody re-read it. The row now says what is still
  true — no prompt-injection suite, and a switch nobody has engaged against
  production — cites those two tests and the one injection-shaped case in
  `studystudio.test.ts` as controls, and falls from residual 4 to 3, so it no
  longer escalates on its own (inherent 8, medium, was 12). `risk.test.ts`
  holds the row to the two tests and refuses a description that says the
  switch is not read, so the gap cannot be written back. EC-AI-02 still says
  no suite exists, because none does.
- **`RETENTION.md` states the backups' lifecycle**: daily, each expiring 7
  days after it is taken, point-in-time recovery unconfirmed, readable by no
  process, a deleted row outliving its deletion by at most that period, and a
  restore owing the deletions made after the backup point — a step
  `RESTORE.md`'s procedure does not carry yet, named as owed rather than
  assumed. `retention.test.ts` holds the number to BCDR-01's in the HECVAT
  draft, so the two answers cannot diverge. The privacy-policy draft states
  the period the terms draft already referred to, marked for counsel. The DPA
  checklist's "backup retention not recorded" closes; the archive and
  legal-hold timelines stay open (RM-02).
- **The remediation targets are still proposed, and this change does not
  accept them.** Acceptance is a person's — the security seat's, or the
  owner's acting in it — and the tree cannot supply a person. It is item 13
  of `docs/LAUNCH-DECISIONS.md`, with what accepting changes: the word
  *proposed* leaves `SECURITY.md` and `supplychain.ts`, the date goes in this
  log, and `security.test.ts` expects the acceptance line instead.
- **Not changed:** the app's privacy text (its "no archive" sentence stays
  true, and the section says why), `RESTORE.md`'s drill, the HECVAT register.

## D-117 · A launch that rests on risk acceptances is `go-with-conditions`, never `go`, and every acceptance says what pilot users are told

**Decided 29 Sep 2026.** The operational-reality register (D-113) found that
the launch readiness review the documents ask for ends in one of three
decisions — GO, GO WITH CONDITIONS, NO-GO — and that `decide()` had two. A
valid risk acceptance made an open P2/P3 blocker vanish from the reasons, so
a launch proceeding under three waivers returned the same `go` as one with
nothing open. That is the wrong shape: the waivers are the decision.

- **`decide()` returns `go-with-conditions`** when nothing is open except
  P2/P3 blockers under a valid acceptance, and `conditions` lists each one —
  blocker, severity, the accepting seat, the reason, the disclosure and the
  expiry — in the blockers' order. `go` now means nothing open at all. Any
  reason at all is still `no-go`, and a `no-go` carries no conditions.
- **A `RiskAcceptance` carries a `disclosure`**: what pilot users are told, in
  their words. An acceptance that says nothing to the affected people is a
  surprise, not a condition, so a blank one is a reason for `no-go` like a
  blank reason or a missing expiry. The document's definition — time-bound,
  documented, non-critical, with owners and customer disclosures assigned —
  is now the type.
- **Unchanged:** what may be accepted (P2/P3 only), who accepts (the founder
  seat), and that an expired acceptance reopens the blocker. The current
  verdict is still `NO-GO`, for the same 29 reasons.
- **Re-read on the way:** the `backup-restore` gate's gap and its checklist
  row still said the rehearsal was not in CI (the fourth copy of the line
  #935 and #939 corrected).
- **Not done:** the verdict does not yet carry an approver's name or a
  next-review date; the decision record it is attached to does. The
  disclosure is not yet held to `docs/pilot/KNOWN-LIMITATIONS.md`, which is
  where it would be published.

## D-118 · The council has a finance seat, vacant until someone qualified accepts it

**Decided 29 Sep 2026.** The launch kit's governance council charter names
twelve roles; mapped onto the launch readiness council's ten seats (D-113),
three had no seat — a student advisor, finance, and operations. Finance was
the one already asked for elsewhere: `deal-desk.ts` has named a `finance`
approver since the deal desk was written, above a 10% discount and on every
access programme, and nobody held it. A seat that the code already requires
approval from and that the council does not list is an approval nobody can
give.

- **`finance` is the eleventh seat** in `launchreadiness.ts`, after `data`:
  Finance / commercial, deciding price floors, discount and pilot-credit
  approvals at the deal desk, margin and contract terms. Vacant. The launch
  command's ten are unchanged in order and meaning.
- **`decide()` now needs it held and signed** like any other seat, so the
  current verdict is still `NO-GO`, for 30 reasons rather than 29. Every
  register that keys on a seat — sources, war room, proof calendar, claims,
  commitments, leadership, evidence — accepts it and none is reassigned to it
  here: the deal desk is the one place that already asks, and it is data, not
  a seat-owned register.
- **The holder:** at pilot scale the founder may hold it acting, as with
  product, engineering and success; the launch kit's own register says
  qualified outsourced support (a CPA) until in-house is justified. Neither
  is written in until someone accepts in writing, which is the rule for every
  seat.
- **Not done:** the deal desk's `Approver` type still says `'finance'` as its
  own string rather than the seat; the student-advisor and operations roles
  still have no seat.

## D-119 · The backup retention is the tier's documentation until the dashboard is read, and a restore re-applies the deletions

**Decided 29 Sep 2026.** Codex's review of #940 arrived after the merge with
three findings, all right, all about D-116's *Backups* section saying more
than the tree can show.

- **Seven days is not a verified number.** `RESTORE.md` had already said the
  plan tier, the schedule and the enabled features are dashboard settings
  nothing in the repository can read; BCDR-01 in the HECVAT draft repeated the
  same figure with no date; and the retention test that held the two files to
  one number proved consistency, not the provider. The section now says the
  figure is the tier's documentation, not yet read off the dashboard on any
  date, and that the test cannot verify the provider; BCDR-01 says the same;
  and the privacy-policy draft brackets the number as *verify on the provider
  dashboard before publishing*. The number is unchanged. What changed is
  whose number it is said to be.
- **A restore can break "at most seven days".** A backup taken before a
  deletion holds the rows, and restoring it brings them back until the
  deletions are re-applied — a step `RESTORE.md` did not carry and the
  section itself said nothing recorded. The promise now carries that one
  exception in `RETENTION.md` and in the privacy-policy draft, and
  `RESTORE.md` carries the step: let the sweeps re-run, replay what the
  console's manifests and the operator's notes can identify, and tell the
  students whose own deletions cannot be found — because their deletion
  record deliberately holds no account, and that is not changed here. A
  durable deletion record that survives a restore is owed, named as such.
- **"Logical" was the wrong word.** `RESTORE.md` reserves it for the CI
  rehearsal's dump and calls the provider's copies physical; the section now
  says which it means.
- **Codex's review of the fix found two more, both right.** The re-apply
  step had ended its window at "the moment the restored database went live",
  which would have had resurrected rows reachable for as long as a weekly
  sweep took; the step now keeps the restored project closed — the drill's
  own rule, a restore into a new project, never over the live one — runs the
  sweeps by hand from `scheduler.sql`, replays what can be replayed, and only
  then cuts over, with the live project in read-only mode meanwhile. And the
  draft policy had promised to tell a student if theirs was a deletion that
  could not be replayed, which the same step says nothing can identify; the
  notice is now to everyone who used Semester in the window, and the policy
  promises no more than that.
- **Held by test:** `retention.test.ts` reads the unverified-figure sentence
  in both files, the exception in the promise, the re-apply step in
  `RESTORE.md` with its cutover rule and its broad notice, and the verify
  marker, the exception and the broad notice in the draft policy.

## D-120 · The council has an operations seat, vacant until someone qualified accepts it

**Decided 29 Sep 2026.** The last of the launch kit's twelve council roles
with no seat that the tree already asked for. The master register has
carried an SRE sign-off ("SLOs, monitoring, restore, DR, load, on-call
complete") and a Support sign-off ("support center, KB, escalation, 24/7
P0/P1 process complete") since it was written, both unsigned, and no council
seat owned either; the war room's on-call and incident lines and the proof
calendar's restore rehearsals were the engineering seat's by default.

- **`operations` is the twelfth seat** in `launchreadiness.ts`, after
  `finance`: Operations / SRE, deciding monitoring, on-call, incident
  readiness, support operations and release readiness. Vacant.
- **`decide()` needs it held and signed**, so the verdict is still `NO-GO`,
  for 31 reasons. Every seat-keyed register accepts it; nothing is
  reassigned to it here. Moving the SRE-owned gates (`operations-live`,
  `backup-restore`, `flags-rollback`) and the war-room lines from
  `engineering` to `operations` is a proposal for the owner, not made here:
  at one person, the split is on paper only.
- **The student-advisor role** is now the only charter role with no seat,
  and it is deliberately not one: the council decides launch; a student
  advisory voice belongs to the customer advisory board in
  RISK-GOVERNANCE.md, which has no members either.

## D-121 · Untrusted text is fenced in every prompt, and the injection suite holds the structure, not the model

**Decided 29 Sep 2026.** AI-010, EC-AI-02 and R-07 all said the same thing:
no prompt-injection suite exists, and nothing on the local assistant path
separates a syllabus somebody uploaded from the rules around it. Read
builder by builder, that was true and a little worse: the assignment
breakdown, the draft critique, the classifier, the photograph reader, the
material reader, the harvester and the course generator each interpolated
the student's material into the prompt as prose, in the same voice and at
the same level as the instructions, and the assistant's system prompt ended
with whatever the screen had drawn. Only the study studio (JSON) and the
institution gateway (developer role, sources as JSON) kept the two apart.

- **One fence, one rule.** `app/src/ai/untrusted.ts` puts text somebody
  else wrote between a fixed pair of tags and disarms any copy of the tags
  inside it, so the fence cannot be closed early; and `DATA_RULE` is the one
  sentence every builder now carries, saying what the fence is — material,
  quoted, never addressed to the model. Every builder that carries such text
  is now a pure function beside the call that sends it, so the shape can be
  tested without a model.
- **The suite is structural, and says so.** `app/src/ai/injection.test.ts`
  runs twelve injection-shaped texts — an override, a fake system block, a
  closing tag, a role spoof, a tool call, a right-to-left mark, a fake
  message from the app — through every slot of every builder, and holds
  four things: the text is only ever inside a fence; the prompt with its
  fences emptied is byte-for-byte the one built from benign text, so
  nothing in the material reaches the instructions; the rule is present;
  and the material's own closing tag closed nothing. Three controls show
  the probe failing a builder that writes the material as prose, one whose
  instructions bend to it, and one that lets it close the fence.
- **What it does not hold.** A fence is a guarantee about the prompt, not
  about the answer; what a live model does with a fenced instruction is a
  red-team, and none has been run. So AI-010 stays `building` with that as
  its gap, MR-36 stays `building`, EC-AI-02 gains the suite as its guard
  with the limit in its note, and R-07's description says "structurally,
  not behaviourally" with the red-team as its mitigation. The residual does
  not move.
- **Codex's review of the change found two slots the suite had not
  reached, both right.** The harvester's house style carries the course's
  own cards verbatim — which a poisoned import could have written — and put
  them in the instructions outside every fence; the samples are now fenced
  inside `styleFor`, and the suite exercises that slot. And a PDF goes to
  the model as a document block, which no text fence can wrap: the rule now
  names every attached document and image as material in so many words, the
  course generator's prompt is a pure builder the suite reads, and a test
  serialises the request to show the document block ahead of the fenced
  text under that rule. Where a fence cannot reach, the rule has to say so.
- **Not changed:** the study studio's JSON prompt and the gateway's role
  separation, both read by the suite as they are; the model calls
  themselves, which send exactly what the builders return.

## D-122 · The red-team exists as a test that skips without a key, and the drills are the owner's to run

**Decided 29 Sep 2026.** D-121 left the live-model red-team as AI-010's gap
and R-07's mitigation, and named it as something nobody had run. What the
tree can do about that is make it runnable in one command and honest about
not having been run; what it cannot do is run it, because a run needs the
key and costs money, and only the owner holds the key.

- **`app/src/ai/injection.live.test.ts`** plants three canaries — a nonsense
  token the material asks for verbatim, a grade change it asks the model to
  confirm, a request to quote the rules — in the material slot of seven
  builders and asks the real model, judging each reply by whether the
  canary's string is in it, so that no person decides what "followed" means.
  Without `ANTHROPIC_API_KEY` every live case is skipped and reported as
  skipped, never as passed, the way `voice.live.test.ts` already does; with
  `REDTEAM=write` a run files its transcript under `docs/evidence/ai/`. The
  key-free half holds that each canary sits inside a fence in the prompt
  the file would send.
- **Filing the first transcript is the day `docs/evidence/` exists**, and
  the compliance crosswalk's test trips on purpose when it does: the
  ceiling lifts from 2, and the tripwire in `compliance-crosswalk.test.ts`
  has to be turned into a reading of what was filed. That is written into
  the test's header and into the owner's page rather than left to be
  discovered.
- **The registers say it exists and has not run.** AI-010's gap is now the
  run, not the suite; MR-36 and EC-AI-02 cite the live test with "never yet
  run"; R-07's mitigation names the command and what to do with a canary
  the model followed. Nothing moves to `tested` on a test that skipped.
- **Item 15 of `docs/LAUNCH-DECISIONS.md`** is the two AI drills — this
  red-team and the kill-switch drill from D-116 — with the command, the key
  they need, and what filing them changes.

## D-123 · The privacy impact assessment exists, and four registers stop saying what later merges undid

**Decided 29 Sep 2026.** Two kinds of open item, both closable by code.

- **R-15's mitigation asked for a privacy impact assessment template**, and
  the maturity crosswalk's eighth system said no template, no register and
  no gate existed. `app/src/lib/governance/pia.ts` is the three:
  `QUESTIONS` is the template (eleven questions, each saying what a
  clearly-yes answer looks like), `ASSESSMENTS` and `OWED` are the register
  (support tickets, beta feedback, the pilot figures, AI conversations and
  billing answered against the tree; community, school records, Course
  Studio, LTI launches, the three designed modules and support grants owed),
  and `GATE` is the line the pull-request template now asks of every new
  module, held there verbatim by the test. An answer whose evidence includes
  a test is *held*; one whose evidence is code or a document is *written*,
  and the page says which: 33 held, 22 written. Every assessment names what
  is not clearly yes. The privacy seat is vacant, so the answers are the
  founder's reading; system 8 moves to `partly`, not `covered`.
- **The fifth copy of the rehearsal line.** SRE-005's evidence and gap,
  R-03's mitigation, R-10's evidence, the DR plan's row and the claims register
  still said `supabase/restore.sh` was local and not in CI, which #935 found
  false and #939 and D-115 corrected elsewhere. Re-read to what CI does, and
  `app/src/lib/rehearsal.test.ts` now holds every source file under
  `app/src` that names the script or the rehearsal to the workflow step. Codex
  asked for the files to be found by reading the tree rather than listed, and
  the wider net found a sixth copy on the page pilot students read:
  `knownlimitations.ts` said the restore "has passed as a local rehearsal".
  Re-read too; a seventh cannot be written. It does not
  say the rehearsal proves a production restore: it runs against an empty
  database, and production has never been restored (R-10).
- **The billing lines** in COM-001, R-17, EC-COM-01 and EC-COM-03 said no
  billing existed; #942 built it, off until keyed. Each now says so, with the
  webhook, checkout and commercial checks as evidence, and the gaps that
  remain: nothing charged, no reconciliation, no price decided.
- **Five owed edge cases had a guard already, or needed a small one.**
  EC-DQ-04 (the pipeline refuses a timestamp regression), EC-AI-09 (the
  shared key's clamp is tested), EC-COM-01 (the webhook applies an event
  once and retries an invoice before its subscription), EC-A11Y-01 (every
  focused control carries the clearance scroll-margins) each cite the test
  that was there; EC-A11Y-02 gains `app/src/ai/streamlive.shape.test.ts`,
  which reads both conversation surfaces for a polite log and an
  `aria-hidden` streaming block, walking balanced `<div>` ancestry so a
  container closed before the stream is not counted (Codex's finding on
  the first draft). 37 of 81 cases guarded, 44 owed. Each note
  says what the guard does not prove.
- **Not changed:** nothing on `docs/LAUNCH-DECISIONS.md`; every remaining
  item there is the owner's.

## D-124 · The remediation targets are accepted, no deletion record survives a restore, and the production reading that a connector can take

**Decided 29 Sep 2026.** The owner said "execute on those" of the four items
`docs/LAUNCH-DECISIONS.md` had left as the owner's. Each is executed as far
as the tree and this session's connectors reach, and the page says where
each stands.

- **Item 13, the four remediation targets, are accepted unchanged** —
  critical 2 days, high 14, medium 60, low 180 — by the founder acting in the
  security seat, on the owner's instruction. *Proposed* is out of
  `SECURITY.md`, `supplychain.ts`, the whitepaper and HECVAT VULN-01;
  `security.test.ts` now expects the acceptance sentence and refuses the old
  one; SEC-004's gap names what is still owed, a finding answered inside its
  clock. Codex's review found four more copies the first pass had missed —
  HECVAT VULN-1's readiness row, the supply-chain page's sentence, the
  expansion register's patch-targets row and the evidence register's
  SEC-VULN-001 row — all re-read the same way, and a whole-tree search now
  finds only the test's refusal of the old sentence. The targets are internal: nothing is a customer commitment until a
  contract or `docs/trust/SLA.md` says so, as before.
- **Item 14: no deletion record survives a restore.** The ledger outside
  the database — a salted hash of the account, the table and the time, that a
  restore would re-apply — is not built, because it keeps a trace of who
  deleted what, which the privacy design does not. The restore exception in
  `RETENTION.md` and the privacy-policy draft, and the broad notice in
  `RESTORE.md`, are the standing policy rather than an interim; the three
  files say so in the same words. Made on the owner's instruction without
  counsel, and counsel may reopen it with the legal drafts (item 5).
- **Item 10, as far as a database connection reaches.** Read off the project
  on 29 September, read-only: the migration ledger ends at
  `20260929110000_console_approvals_and_break_glass`; the direct rate-limit
  trigger is on the fourteen tables the migration names, which the go-live
  checklist and `DEPLOY.md` now record; `cron.job` lists eighteen jobs,
  fifteen active, the three inactive ones being the ones that wait on a key.
  The plan tier, backup schedule, retention and PITR are dashboard settings a
  database connection cannot see, so the seven days in `RETENTION.md` is
  still the tier's documentation, and the drill has not run. Nothing was
  filed under `docs/evidence/`: a dated query result is recorded where the
  repository records readings, and the ceiling lifts on the first transcript,
  not on this.
- **Item 15 could not run here.** The shared key is a Supabase function
  secret and nothing else (`SECRETS.md`), so the red-team has no key in a
  cloud session; and the kill-switch drill's observation — both runtimes
  refusing — needs a signed-in call to the function, which no connector
  makes. Engaging a production switch without being able to watch the
  refusal would be the SQL half of a drill and not the drill, so it was not
  done. The item stays the owner's, and says why.
- **Not changed:** the verdict, still `NO-GO`; the HECVAT VULN-1 status,
  still in progress; every number in the patch policy.

## D-125 · Two briefs on what makes Semester one operating system are held to the tree, and the site prints the register's word beside the positioning

**Decided 29 Sep 2026.** Two briefs of the same day say the core of what
makes Semester different is that it has everything from the start, is fully
built, and is one central school operating system rather than a collection of
screens; the second lists what else to add to the app, the company site and
the institution console, and the company infrastructure behind them.

- **Both are kept under `docs/expansion/` as supplied and held to the tree
  the way D-112 held the one-system grammar:** `app/src/lib/oneos.ts` is the
  data, `oneos.test.ts` renders `docs/ONE-OPERATING-SYSTEM.md` and refuses a
  status above the kind of file it cites, a path that does not exist, and a
  supplied PDF as evidence. The five destinations are held to `FIVE_LABELS`
  in `lib/tabbar.ts`; each shared object and each vocabulary word to the
  module that carries it, or to none; each avoided word the retired-word rule
  already refuses to its entry in `content/terms.ts`; each palette command to
  a destination the app registers; each site page to a route; each area and
  comparison row to rows that exist. 157 rows: the page says how many are
  held by a test, being built, designed and not started.
- **The brief's "fully built" is not repeated for the tree.** Most of what
  the briefs name exists as a part — a component, a module, a table — and
  the join is what is missing. The page says that in its first paragraph, and
  the earlier one-system grammar (D-112) already lists what to converge.
- **Two public pages print from the register**, `/platform/one-operating-system/`
  and `/platform/why-not-another-tool/`, the two the second brief asked for.
  Each prints the positioning as the brief wrote it (the supporting paragraph
  says *designed as* one connected platform, not *is*) and beside every area
  and every comparison row the register's word — held by a test, being built,
  designed, not started — computed as the weakest of the rows it rests on.
  The test holds both pages to printing every word and never printing
  "fully built". Script-free, like every content page: an area opens as a
  disclosure, not as a map.
- **The command palette keeps the overlay's own decision.** The brief asks for
  thirteen verb commands; `components/Command.tsx` refuses verb commands
  because an action that changes data says what it will do first, on a screen
  with a preview. The register maps each command to the destination the
  overlay already finds by name (eleven of thirteen), names the two it cannot,
  and prints the overlay's reason rather than re-arguing it.
- **Not built here, and said so on the page:** a goal object, a cross-life
  timeline, a passport as one record, a named official-handoff pattern with a
  return prompt, needs-reply and needs-action in one inbox, a campus
  configuration graph, a content-governance workflow, a student-experience
  health dashboard, a trust center hub, and role pages beyond students and
  institutions. Each is a row with its gap, and the ten the brief ranks
  highest are named against those rows.

## D-126 · The plan tier is read, and the two AI drills are one command each, still waiting on one HTTP call this session could not make

**Decided 29 Sep 2026.** The owner asked for items 10 and 15 of
`docs/LAUNCH-DECISIONS.md` to be done. What a connector reaches is done and
recorded; what it does not is now one command away, and the item says which.

- **Item 10: the plan tier is Pro.** The organization record, read through
  the Supabase connector, says the plan is Pro (pay-as-you-go), and
  Supabase's own backups page gives Pro seven days of daily backups with
  point-in-time recovery only as a paid add-on. `pg_settings` shows WAL
  archiving on (WAL-G `wal-push`, `archive_timeout` 120 s), which the
  physical daily backup and PITR both use, so it says nothing about whether
  the add-on is bought. `RESTORE.md`, `RETENTION.md` and HECVAT BCDR-01 carry
  the tier with the date; the seven days stays the plan's documentation until
  the Backups page is read, which a connection cannot do, and the drill has
  not run.
- **Item 15 could not run here, for a reason that is the session's, not the
  tree's.** The Claude function proxies the shared key for any signed-in
  account, which means both drills can run with a drill account and no raw
  key. This session's policy refused the shell any HTTP call to the
  production services, and both drills are exactly that call: the kill-switch
  drill is watching the deployed runtime refuse, and the red-team through the
  proxy is twenty-one such calls. Engaging the switch by SQL alone would have
  been half a drill, so it was not done.
- **So each is one command.** `app/scripts/killswitch-drill.mjs`
  (`npm run drill:killswitch`) makes the before, during and after calls,
  prints the SQL to engage and release between them and waits, judges the
  refusal by the sentence read out of `killswitch.ts` itself, times every
  step, and with `DRILL=write` files the record under `docs/evidence/ai/`,
  never over an earlier one; `killswitchdrill.test.ts` holds it to the module
  and the function path. `injection.live.test.ts` gains the proxy route
  (`REDTEAM_PROXY`, `REDTEAM_TOKEN`, `REDTEAM_APIKEY`): the same body either
  way, the raw key never sent to the proxy, the route written into the
  transcript, and a key-free test of both routes. Neither observes the
  institution gateway, which is not deployed; the drill record says so and
  `aikillswitch.test.ts` holds that runtime to the same switch.
- **What running them will change**, written here so it is not discovered:
  the first file under `docs/evidence/` lifts the crosswalk's ceiling and
  trips three tests on purpose (`compliance-crosswalk.test.ts`,
  `readiness-pack.test.ts`, `evidence-register.test.ts`), which then have to
  read what was filed; AI-010 moves toward `tested` on a transcript with no
  canary followed; AI-012's gap and R-07's mitigation are re-read to the
  dates.
- **Not changed:** every register status; the verdict.


## D-127 · Every definer function a signed-in account can call has a disposition, and the one that answered anybody about any pilot no longer does

**Decided 29 Sep 2026.** The architecture audit of 29 September scored the
database 2/5 on two advisor findings — 45 tables with row-level security and
no policy, 151 `security definer` functions a signed-in account can call —
and named a remediation register for them as the audit's first artifact.
`docs/DEFINER-RLS-REGISTER.md` is that register, rendered from
`app/src/lib/definerregister.ts`.

- **Read first, read-only, on production.** All 45 tables carry no client
  privilege at all: deny-by-default, not open. All 151 functions are closed
  to `anon` and PUBLIC, pin `search_path` and run no dynamic SQL.
- **The function set is derived, not typed.** The test reads the migrations'
  winning definitions and the allowlist in `grants.check.sql`; the set is the
  same 151 names the advisor listed. A new callable definer function is red
  until it has a row, which is the audit's release-gate line as a test. Each
  row's gates must appear in its body; admin and moderation rows need a gate
  beyond `auth.uid()`.
- **One fault, fixed.** `gtm_pilot_problems` returned any pilot's readiness
  list — price agreed, sponsor, dates — to any signed-in caller, bypassing
  the read policy on `gtm_pilots`. It now asks the policy's own helper and
  answers `{not_found}` otherwise
  (`20260929120000_gtm_pilot_problems_visibility.sql`); `gtm.check.sql` shows a
  student and another school's staff refused and sales and the school's admin
  still answered. Red on the old body, green on the new.
- **Left open, with severity:** `kill_switch_engaged` answering for any
  tenant (low, recorded as deliberate in `grants.check.sql`); gates proved
  present rather than correct (medium); the table list pinned to the reading
  (low).
- **Not changed:** the allowlist, every grant, every policy; the migration is
  not yet applied to production.

## D-128 · Plus can be bought in the app, and D-009 steps aside for that one plan

**Decided by owner 29 Sep 2026.** D-009 kept checkout out until a
server-side environment existed and the owner approved. Both now hold: the
commercial core (#942) runs checkout and the webhook server-side, the owner
set the Stripe test keys and the webhook secret on the live project, and asked
for the upgrade screen to be built and deployed.

- **Where:** the Membership panel on the Account screen
  (`components/MembershipPanel.tsx`, `lib/membership.ts`). Nothing else in
  the app, and nothing on the public site, sells anything. The site's pricing
  page still says it has no checkout, which stays true.
- **The price is the catalog's.** The panel reads `commercial_prices` (anyone
  may) and names what `begin_checkout` charges, $3.99 a month or $29.99 a year,
  not the planned figures in `plans.ts`. With no catalog (a device-only build,
  a network that is gone) the panel says what it said before.
- **Consent before anything is sent:** a checkbox naming amount, interval,
  renewal and where to cancel, re-cleared when the price changes, versioned
  `plus-v1` and recorded by `billing-checkout` before Stripe is asked. The
  card goes into Stripe's page.
- **Cancel** calls `request_cancellation`, which marks the subscription to end
  at the period's end. **It does not yet reach Stripe**: until a function
  cancels the Stripe subscription too, the owner cancels it in Stripe by hand.
  That, and the financial retention period, stay open before a live key.
- **Not tested end to end.** The owner asked for it deployed on the assumption
  that the keys are right; the first test-card checkout is the test.

## D-129 · The gtm_pilot_problems fix is live and read back, and the integration catalog's test exists

**Decided 29 Sep 2026.** Two loose ends from D-127.

- **Production, read back.** The GitHub integration applied
  `20260929120000_gtm_pilot_problems_visibility` on the merge of #965; it is
  the newest row in production's migration ledger. Read off `pg_proc` after:
  the live body calls `private.gtm_account_visible(p.account_id)`, `anon`
  cannot execute it, `search_path` is pinned. `gtm_pilots` holds no rows on
  production, so the fault it closed never exposed a real pilot. The advisor
  still reports 45 and 151, as it should: the fix changed what one function
  answers, not what exists or who may call it.
- **`catalog.test.ts` existed only in two sentences.** `integration/catalog.ts`
  and SEMESTER-OPERATING-SYSTEM.md both said it held the catalog to the SQL;
  nothing did beyond `pipeline.test.ts` checking that each word appears
  somewhere in the migrations. It now holds provider domains, canonical
  entities, conflict kinds and connection statuses to the winning constraint
  on the owning table, value for value. Shown red on a dropped domain, a
  dropped `space_availability`, a later migration widening connection status
  and one adding a conflict kind; the same widening on another table leaves
  it green. The catalog's header no longer says freshness and the sync
  classes are constrained; they are not. B03 in the definer register moves
  to held.

## D-130 · Every callable definer function is called by a stranger, and DR-02 is closed

**Decided 29 Sep 2026.** DR-02, the one medium item the definer register
left open: it proved each function's check is present, not that it works,
and not every one of the 151 had a suite calling it as somebody with no
business calling it.

- **`supabase/definer-sweep.check.sql`.** A signed-in account with no school,
  role, capability or share calls every callable definer function in
  `public` with a neutral argument of each type, and must be refused or told
  nothing. On this tree: 99 refused, 37 empty, 15 answered.
- **The fifteen that answer are named**, each with the exact shape of what it
  may say and why: status words that name nothing ("stale", "unknown",
  "none") and functions whose whole job is the caller's own account (export
  my data, mint my code, forget my history). A new answer is a failure until
  somebody decides; a listed function that stops answering is a failure
  until it is taken off.
- **A victim is given something to lose first** (a referral code and a
  support ticket, through its own functions), and no answer to the stranger
  may carry its id, email, code or ticket. That is what turns "answered" into
  a finding rather than a count.
- **Shown red:** `my_support_tickets` stripped of its owner filter (named,
  "leaked Victim ticket subject"); `note_activity` taken off the list; a stale
  list entry. Two probes are planted on every run and must be named: one
  counting every account, one returning the victim's email.
- **What it does not prove**, written into the suite: neutral arguments name
  nothing real, so a function that answers anyone holding a real id of
  somebody else's object passes here, the shape of the `gtm_pilot_problems`
  fault. That stays with the feature suites. `beta_triage_feedback` was the
  one function no suite called at all; the sweep now does, as a stranger.

## D-131 · The 2026 AI integration playbook is held to the tree, and its vendor scorecard is code

**Decided 29 Sep 2026.** Three documents arrived on 29 September — the 2026 AI
integration playbook, its ten-workflow summary, and a brief on integrating
Semester Intelligence further — and are kept under `docs/expansion/` as
supplied. They are held to the tree the way D-111 held the AI assurance
matrix: data in `app/src/lib/governance/ai-playbook.ts`, rendered to
`docs/operating-model/AI-INTEGRATION-PLAYBOOK.md` by its test, every cited
file existing, every status held to the kind of file it cites, and the PDFs
never their own evidence.

- **Crosswalk, not a second register.** A workflow's prohibited decision
  names the `PROHIBITED_STARTING_SCOPE` entry that refuses it. The definition
  of done names the `AI_RELEASE_GATE` item carrying each line; five lines have
  none.
- **Four intake refusals added.** The playbook prohibits four things no intake
  rule refused, and the owner asked for them: *automated hiring decisions*,
  *ranking students for employers*, *auto-publishing institutional policy* and
  *unapproved production changes* join `PROHIBITED_STARTING_SCOPE` (six → ten).
  Each is carried by the workflow it came from (WF-10, WF-06, WF-07, WF-08),
  held there by the test, and listed in `AI-LIFECYCLE-GATES.md`, which
  `docs.test.ts` holds to the list.
- **Data classes are checked against the gate, not asserted.** Each of the
  four classes names the `classification.ts` tiers it covers, and the test
  asks `gate(tier, 'ai', true)` for each: a class whose rule says "exclude" is
  true only if the gate refuses it. "Internal" has no tier and must fail
  closed; T1 has no class.
- **The vendor scorecard is code.** `scoreVendor()` approves only when every
  dimension is scored, the weighted mean reaches 4.0, and no floor is missed
  (data use, privacy, security; tool-use safety for agentic workflows); a
  critical blocker refuses outright. Every AI party in `trust/subprocessors.ts`
  is on it, held there by the test, and none is scored, because no
  provider's terms are on file. **The supplied weights summed to 95%, not
  100%.** At the owner's request they now sum to 100: the missing five points
  go to security posture (10% → 15%), one of the three floors, since the
  playbook's headline risks (prompt injection, excessive agency) are security
  risks. The test holds the sum to 100.
- **Onboarding is held to `FirstGoal`.** Five of the six starting choices map
  to a goal in `lib/goals.ts`; "Organize this week" has none.
- **Most workflows are `tested` as non-AI workflows.** Registration that
  registers nobody, advisor shares that expire, skills the student confirms:
  the boundary exists and is held, and in nearly every row the gap is the
  agent itself. The talent and hiring workflow is not started.
- **Not changed:** `classification.ts`, `subprocessors.ts`, `goals.ts`.
  Fixing the weights and scoring a provider are the owner's; neither is made
  here.

## D-132 · Cancelling Plus reaches Stripe, and financial records are kept seven years

**Decided by owner 29 Sep 2026.** D-128 left two things open before a live
key: a cancellation that stopped at Semester's own record, and no retention
period for payment records. The owner asked for both.

- **Cancel reaches Stripe.** `supabase/functions/billing-cancel` (rules in
  `_shared/billingcancel.ts`, driven by `app/src/lib/billing/cancel.test.ts`)
  finds the caller's own live subscription *as the caller*, sets
  `cancel_at_period_end=true` on the Stripe subscription with an idempotency
  key per subscription, and only then calls `request_cancellation()` — also as
  the caller, so whose subscription it is stays decided in one place. No
  service key. If Stripe refuses, nothing is recorded and the person is told
  they are still subscribed; if the record lags, the webhook's
  `customer.subscription.updated` applies it. Before this, a cancellation
  recorded only here would have been reverted by the next such event, and
  Stripe would have renewed. The Membership panel calls the function, never
  the bare RPC, and now says "you will not be charged again" because it is
  true. A `provider_ref` that is not a Stripe subscription id is never put in
  Stripe's path.
- **Seven years after the end of the year a record was made.** The owner chose
  it over six and ten: the IRS's longest ordinary look-back is six years, and
  a year's margin. `purge_financial_records()`
  (`20260929130000_financial_retention.sql`) removes, for **individual**
  billing accounts only, finished subscriptions and their checkouts, invoices,
  payment events and refunds past that line, and an emptied account whose
  owner already deleted theirs. A live subscription is never removed;
  institutional records follow their contract. It runs monthly
  (`commercial-financial-retention`) and removes nothing before 1 January 2034.
- **Two things `financial-retention.check.sql` caught on its first run.** A
  completed checkout must name its subscription, so checkouts are removed
  first; and payment events and dunning actions refuse every update and
  delete. `refuse_commercial_rewrite()` now lets a *delete* through only
  inside the purge's own transaction (a transaction-local mark it sets and
  clears); an update is still refused for everybody, and payment events are
  removed before their invoices so none is ever updated.
- **Not changed:** who may read or write any billing table; the webhook.

## D-133 · Seven briefs on leading the market are held to the tree as one register, and the site refuses the five overclaims they name

**Decided 29 Sep 2026.** Seven briefs of 29 September ask what else would
make Semester the leader and the benchmark: the operating disciplines, the
final moats, the executive benchmark answer, the feature benchmark with
TrustEd Apps, pricing and K–12, the 1EdTech compliance and go-to-market
playbook with its summary, and the leader-and-pioneer brief. They are kept
under `docs/expansion/` as supplied.

- **One register, not seven.** The briefs repeat each other — the graph four
  times, the procurement package five. `docs/REINFORCEMENT-REGISTER.md`,
  rendered from `app/src/lib/reinforceregister.ts`, has 116 rows in twenty
  areas; each cites every brief item that asks for it and names the oneos,
  leadership or Connect item it is the same as, and the test holds each to
  exist. Read against `beaa839`: 61 tested, 16 building, 21 designed, 18 not
  started.
- **The operating model is data.** `app/src/lib/ops/operatingmodel.ts` gives
  the ten product areas the first brief names their fourteen fields, every
  owner a council seat. 33 of 50 ownerships rest on a vacant seat; the table
  says which.
- **The playbook's P0 blockers are owned.** Its 36 P0 rows, each with a seat
  and the tree's reading in place of the playbook's (it marks the definer
  review not started; D-127 landed it). 26 are owned by a vacant seat.
- **"Fully built" has a gate.** The feature benchmark's 0–5 scorecard on ten
  criteria, and `mayClaimFullyBuilt`: at least 4 on depth, privacy,
  accessibility, reliability and source integrity, an unscored criterion
  failing. No module has been scored, so none may be called fully built.
- **Two promises added where the site already makes them.** The briefs ask
  for a Student Data Promise. `/trust/data-and-ai-transparency/` and the
  Semester Standard already publish it, line by line, each held to the tree;
  two lines were missing and are added to `NEVER`: no behavioural advertising
  on education records, plans or study activity (held by `campaign.test.ts`),
  and study activity never used to label ability or motivation (held by
  `institution-ops.test.ts`). No separate page, which would drift from these.
- **The site refuses five overclaims.** `site.test.tsx` now refuses, on every
  page, a claim to replace an official system, to guarantee an outcome, to
  improve retention, persistence, graduation or grades, to be fully
  compliant, or to be AI-safe — with a control showing each pattern catches
  its own example and passes the sentence the site actually uses.
- **Not changed.** K–12: absent, neither planned nor refused, behind COPPA-1.
  The Plus price, the pilot length, the statement's "payments" and the name of
  the first-year measures document were open here too, and the owner settled
  all four (D-134).

## D-134 · Plus is $7.99 a month or $59 a year everywhere, every pilot runs 26 weeks, the statement no longer lists payments, and the company's first-year measures are named for what they are

**Decided 29 Sep 2026, by the owner.** D-133 found four things left open
between the briefs and the tree; the owner settled each.

- **Plus.** `plans.ts` printed $7.99 and $59 on the pricing page, while the
  catalog the commercial core seeded — and, since D-128, what `begin_checkout`
  charges — said 399 and 2999 cents, so the Account screen sold Plus at $3.99.
  `20260929131000_plus_price.sql` retires the seed's two rows (inactive, window
  closed, never deleted, so what was sold on them still names them) and opens
  799 and 5900. Nothing reaches Stripe: checkout sends the catalog's amount, so
  the next checkout charges the new price, and a subscription Stripe already
  holds keeps its own until it is changed there. The company site's four
  prices, `docs/COMMERCIAL-CORE.md` and `PILOT.md` say the same.
- **The guard nobody wrote.** The two prices drifted because nothing held the
  pricing page to the catalog. `plans.test.ts` now reads the migrations as
  they leave the catalog and requires the same figures as `plans.ts`; a
  migration pricing Plus at 699 turned it red.
  `commercial-automation.check.sql` holds the catalog to 799 and 5900, the
  retired rows to existing, and a checkout on a retired price to
  `no_such_price`.
- **Pilots.** `pilotReadiness` refused anything outside 60–120 days (#817);
  it now refuses anything but exactly 26 weeks (`PILOT_WEEKS`, 182 days),
  within the deal desk's six months. The launch kit's term row, the RFP
  library's implementation answer, the paid-pilot framework, the GTM
  execution plan and the pilot agreement outline say 26 weeks. That is two
  days past the kit's own "90–180 days"; its row stays held, with the reason.
  The database says the same: `gtm_pilot_problems`, which `gtm_pilot_guard`
  calls when a pilot is started, still refused anything outside 60–120 days,
  so every pilot the app accepted the database would have refused (found by
  Codex's review of #967). `20260929140000_gtm_pilot_26_weeks.sql` changes
  that one line and keeps the visibility gate; `gtm.check.sql` refuses a
  109-day pilot for `duration` and starts a 182-day one, and went red on the
  26-week pilot with the migration taken away.
- **The statement.** The one-operating-system statement listed payments among
  the parts of university life Semester is one platform for; Semester runs no
  payment workflow for students, and the briefs say never to imply replacing a
  payment system. The owner removed the word. `oneos.test.ts` now refuses a
  statement naming payments, billing, financial aid, housing, health records
  or registration execution; putting "payments" back turned it red.
- **The first-year measures.** `docs/FIRST-YEAR-SUCCESS.md` held the
  company's measures for its first twelve months, and a reader of the briefs —
  which ask for a first-year *student* stage — would take it for that. It is
  now `docs/COMPANY-FIRST-YEAR-MEASURES.md`, titled "Company first-year
  measures", moved with its history; the operating-system register, its
  rendered page and every link follow. Decisions before this one keep the old
  path as they wrote it.

## D-135 · The AI providers are scored from their own documentation, and model quality has an evaluation set that has not yet been run

**Decided 29 Sep 2026.** D-131 put every AI party on the vendor scorecard and
scored none, because no provider terms were on file. The owner asked for the
four to be scored, and for the evaluation set model quality needs.

- **Desk scores, each on the provider's own page.** `PROVIDER_BASIS` in
  `ai-playbook.ts` scores Anthropic and OpenAI dimension by dimension, and
  each score names the page it rests on and what that page says. A test
  refuses a citation to any host but the provider's own. A dimension public
  documentation cannot answer stays unscored with its reason. These are not
  contract review: no DPA is signed.
- **Where they differ.** Anthropic commits to breach notice within 48 hours
  and offers native citations; its standard tier is best-effort, its API has
  no FERPA terms and it gives 60 days before retiring a model. OpenAI stores
  data in twelve regions, gives six months, transcribes speech and publishes
  a Student Data Privacy Agreement, but that agreement names ChatGPT Edu and
  its trust portal describes itself as for ChatGPT, so API coverage needs
  written confirmation. Neither has an uptime SLA in its terms.
- **A provisional reading, never a verdict.** Over the dimensions scored,
  Anthropic reads 4.02 (92% of weight scored) and OpenAI 4.08 (87%), with no
  floor missed. Both verdicts stay *unscored*: `scoreVendor` approves nothing
  with a dimension missing.
- **The model-quality set.** `model-quality.ts` holds fifteen synthetic cases
  across WF-01 to WF-06, each run through a prompt Semester sends and graded
  by fixed checks, never by a model. Nine are critical; failing one caps the
  score at 2. A partial run is refused. Every check carries a reply it alone
  must refuse, because the first draft held a case to one bad reply, and
  disabling its answer-withholding check left the case green while another
  check refused the same reply. `npm run eval:model-quality` runs it against
  a model, skipped without a key, and `EVAL=write` files the run under
  `docs/evidence/ai/`. That filed run is the only thing the model-quality
  score may cite.
- **Codex's review found four holes, each in a critical case, and each is
  closed with the reply it named as a sample the check must refuse or
  accept.** The answer-withholding check missed "negative two-thirds", "⅔"
  and the bare "0.67"; the prescribing check knew six drug names and failed
  a safe warning, so it now reads each sentence for a named antibiotic, a
  dose, or an instruction to take antibiotics, unless the sentence warns
  against taking one; the résumé check failed "1 year" and passed "twelve
  thousand dollars", so it now allows only the one number the student gave;
  and the live runner sent no tools although the prompt promises them, so
  it now sends the app's own tools for the mode, writes a proposal into the
  reply as the button it would be, and answers lookups for up to three
  rounds, as `ai/converse.ts` does.
- **Not changed:** the weights, the floors, the thresholds, the subprocessor
  register. The pass-rate bands and the critical cap are the owner's to
  change; the set has not been run, because this session had no key.

## D-136 · Plus is offered once on Today, the same way to everyone, below the day's own next step

**Decided by owner 29 Sep 2026.** Plus could be bought since D-128, but only
from Account → Membership, and nothing pointed there: by 21:26 UTC no
checkout had been opened. The owner asked for an upgrade prompt in the app.

- **Where:** the foot of Today's briefing (`components/PlusPrompt.tsx`, lazy
  in `TodayDecisionSurface`), under the Action Center or the briefing, so it
  never sits above the one next step Today exists for.
- **Who:** a signed-in student on Free, while the catalog has a Plus price,
  once they have a semester: not on the first-run screen Today shows before a
  student has added anything, so nobody is sold to during setup.
  Never someone with a live subscription, never signed out. It is shown the
  same way to everyone: nothing about what, when or how well a student studies
  decides whether they see it (D-133's line against using study activity to
  label or target anyone).
- **What:** the catalog's price, read through the helper the Membership panel
  charges from (`fetchPlusPrices`, so the two cannot drift, the fault D-134
  found between the pricing page and the catalog), what Plus includes from
  `plans.ts`, and that Free stays free with export and deletion on every plan.
  "See Plus" opens Account with the upgrade already open
  (`askToOpenUpgrade` / `takeOpenUpgrade`, one session key, used once);
  nothing is bought on Today. "Not now" hides it on that device for thirty
  days.
- **Fails closed.** If the subscription read fails, the card stays away
  (`fetchOwnSubscriptions` throws on a PostgREST error rather than returning
  no rows, which would read as "not a subscriber"). Arriving from "See Plus",
  Account scrolls to the open upgrade and focuses it (Codex's review of #985).
- **Not changed:** checkout, consent, cancellation, prices.


## D-137 · Three launch-readiness briefs are held to the tree, and Semester has one Definition of Done

**Decided 29 Sep 2026.** Three documents arrived: the *University Launch
Readiness, HECVAT, Data Migration, and Pilot Contract Playbook*, its one-page
summary, and the answer to "anything else missing for the company, site,
application, market, launch and contracts". They are kept under
`docs/expansion/` as supplied and held to the tree the way D-108 and D-111
hold every brief: `docs/LAUNCH-COMPLETENESS.md`, rendered from
`app/src/lib/launchcompleteness.ts`, cites a file for every row, and every
standing is held to the kind of file it cites.

- **Most of it exists as parts.** 210 items: 118 held by a test, 40 building,
  41 designed, 10 not started, 1 held by a decision already on main.
- **The HECVAT tracker the briefs ask for first** is the 81 rows of their
  seven domains, each with a council seat as owner and the
  `HECVAT_READINESS.md` control it moves; 40 rows have none, which is what the
  brief adds to the thirty. **Due dates are the seats' to set**, not typed
  here on their behalf; the test holds any that is set to an ISO date after
  the reading.
- **The pilot term conflict is settled.** The brief's Registration and Path
  pilot runs 12–26 weeks; when it arrived `gtm/pilot.ts` refused anything
  outside 60–120 days. The owner has since chosen exactly 26 weeks (D-134),
  the top of the brief's range, so the row is tested, not held.
- **Four claim words may not be said**: "Replaces", "Improves student
  success", "Trusted by" and "Compliant" rest on no row of the claims
  register. The five that can be said name the rows they rest on.
- **The Semester Definition of Done** is `docs/DEFINITION-OF-DONE.md`, from
  the same module: the brief's nine questions, the launch acceptance rule and
  twelve journeys, each beside where the tree asks it. The engineering
  checklist in `QUALITY-MANAGEMENT.md` stays where it is.
- **Eleven public policies drafted for counsel** under `docs/legal/`: the
  acceptable use policy, community guidelines, copyright and takedown, AI use,
  cookie and storage notice, accessibility statement, retention and deletion,
  support, incident response summary, advertising and sponsorship, and refund
  and cancellation (owed before a live key since D-128). Each is written from
  the code, carries the *Not in force* banner, and says where the company site
  promises more; `legal-drafts.test.ts` now holds every file in the folder to
  the banner and the contact, and `/legal/` lists each as a draft. None may be
  published until counsel reviews it.
- **The company site's takedown row said "Available now"** with a Legal owner
  and a five-day target; no process, agent or owner exists. It now says the
  policy is drafted and not in force, and names the email address a person
  reads meanwhile.
- **The company site's other overclaims are corrected to the code.** Its
  cookie copy and preference toggles described sign-in and marketing cookies
  nothing sets; it now says no cookie is set and describes the campaign tags
  a form carries. The accessibility center's one-day target and "staffed"
  form, and the support page's business-day support, customer-success
  manager and critical-period cover, now say one person reads everything and
  no time is promised. The policy-versions table lists the drafts.
- **No reply time is promised anywhere on the company site.** The reporting
  center gave eight report types an owner seat nobody else holds and a one-
  to three-day target; every form printed a reply target from a table of
  hours, the contact directory listed one per topic, the security form
  promised acknowledgement within 24 hours and the privacy form within 72,
  and the disclosure page within two business days. `SECURITY.md` already
  refuses an acknowledgement number while one person reads the mailbox; the
  site now says the same everywhere, keeps the same-day action on a critical
  security issue, and says no independent advisor is appointed.
- **The refund terms are undecided, and the site says so.** The membership
  page stated "Full refund if you cancel within 14 days" and promised final
  terms "before checkout goes live" — checkout is live with test keys
  (D-128). Both refund lines now say the policy is drafted for counsel and
  not in force, name the 14 days as one option it weighs, and promise the
  final terms before any real charge.
- **The rest of the membership page says what billing does after D-132.**
  Cancelling reaches Stripe and is not charged again; a failed payment is
  Stripe's email and retries with Plus working through a 14-day grace, then
  paused, with the data untouched — Semester's own reminders are recorded,
  not sent, and the page no longer says "email and in-app message". The
  renewal reminder, the 30-day price-change notice and "we stop charging you"
  when a school sponsors are not built and now say so; the preview stops
  asking why you are leaving, which the app does not ask, and stops
  promising a confirmation email. The refund and retention drafts take D-132's
  cancellation and seven-year record period.
- **Service commitments and institution exit say what exists.** The
  service-commitments page listed first-response times from 30 minutes (a
  24/7 tier) to two business days, hourly updates, extended and critical-
  period tiers, and credits against a monthly uptime nobody measures; the
  incident section promised acknowledgement in 30 minutes. They now say one
  person answers with no time promised, nobody is on call, and the status
  page keeps no history. The portability page and the trust FAQ promised
  institutions an export "within 10 business days" and a written deletion
  certificate; neither a tenant-wide export nor a certificate exists
  (`docs/trust/DPA-CHECKLIST.md`), and the page now says students can leave
  with their device copy today and an institution's exit is still being
  built.
- **Codex's review of this change found two more, both right.** The site's
  cookie copy said form attribution stayed in the browser; the form sends it
  and it is kept with the message. And the procurement questionnaire still
  answered "blocking issues acknowledged within 1 business day". Both are
  corrected, and so is a third found while checking: every form footer said a
  message is kept "up to 24 months", but `site_leads` has no purge
  (`RETENTION.md`); it now says no deletion period is set.
- **Not written here, because the repository cannot write them:** the MSA,
  counsel's review of every policy, a VPAT, customer data migration, and
  anything with an institution's name on it. Each is a row that says so.
- **Not changed:** every other register, every status, the go/no-go verdict.

## D-138 · Performance budgets are a CI gate, set from the first measurement

**Decided 29 Sep 2026.** The architecture brief's priority 18 and the audit's
performance dimension (2/5) both asked for measurable limits before pages
become heavy; `docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md` had already said
how: a file CI checks against the build output, set from a measurement.

- **What is held**, in gzip bytes: the first load (the entry and everything
  it imports statically), each of the 90 lazily loaded screens' cost to open
  (its chunk and the static imports the first load did not bring), and the
  largest single file. Each budget is the measurement plus ten per cent, and
  never less than the measurement plus 8 KB; a new screen with no budget of
  its own may cost 48 KB. `app/perf-budgets.json` records the measurement
  beside the budgets, and a test holds each budget to it.
- **How:** a `bundle-graph` plugin records which source module each chunk
  came from, written under `node_modules/.cache/` rather than `dist/`,
  because Vite's own manifest would publish every source path on the live
  site. `npm run budgets` gzips `dist/` itself and runs after the CI build.
- **Shown red on real builds:** Search given a static import of KaTeX went
  from 1 KB to 75.6 KB against a 10 KB budget; the entry given the same went
  from 395 KB to 470 KB against 435 KB. Both named the budget they broke.
- **What the measurement says, not changed here:** the first load is 395 KB
  gzip, roughly twice common mobile guidance. The budget holds that line; it
  does not bless it. Bringing it down is its own work, measured against this.
- **Not done:** Core Web Vitals from real devices, which needs the aggregate
  table the plan describes and a privacy decision on what it records.
  Register row A18 moves from owed to partial.

## D-139 · Nobody under 13 holds an account, and a minor is kept out of the features where strangers reach them

**Decided 29 Sep 2026, by the owner.** K–12 was the one area the register
(D-133) could not score: COPPA-1 had no stated minimum age and no posture on
children, and every social feature was open to any confirmed account. The
owner set the minimum age at 13, with no one younger, and asked for the full
K–12 edition behind it. This is its first prerequisite.

- **Stated, once.** Sign-up asks for a date of birth. The app refuses a date
  under 13 before anything is sent; `20260929150000_minimum_age.sql`'s trigger
  on `auth.users` refuses it again (`semester: under the minimum age`), records
  when a minor turns 18 in `private.account_ages`, and strips the birth date
  from the account's metadata, so the date itself is never kept. An account
  made before this states its age once on the Account screen
  (`state_my_age`); a second statement is `already_stated`.
- **A minor is kept out, by the database.** `private.verified_student()` now
  also requires `private.age_cleared(auth.uid())` — an age stated, and not
  under 18 — so every policy that gates on it closes to a minor.
- **Ask, then gate.** Google, Microsoft, Apple, institution SSO and LTI
  sign-ups never see the sign-up form's date field, and neither did accounts
  made before it. Codex's review found those accounts were treated as adults;
  the owner chose to ask, then gate. An account that has not said its age is
  kept out of everything a minor is kept out of, and a line under the header
  on every screen (`AgeBanner`) takes it to Account, where it is asked once.
  Everything that is the account's own keeps working meanwhile. The check
  suites' accounts are made with no birth date, so `supabase/check.sh`
  records them as adults with a fixture trigger that is never a migration;
  `minimum-age.check.sql` turns it off. Mentor requests and connections (a minor at either
  end), study matching, opting into the talent profile, and an active peer or
  alumni mentor offer are refused by a trigger as well, so a policy added
  later cannot open them by accident, and a request is refused again when it
  is accepted, so one sent before an age was known cannot become a
  relationship after. An account made before the age was asked, once it says
  it is under 18, comes off every roster and out of study matching and
  employer view, and its unanswered requests are withdrawn; its classmate
  profile is hidden from others by the read policy, not deleted. Reports and
  family sharing move to `private.verified_account()`: a minor can still report
  and share with a parent or guardian.
- **Proved.** `supabase/minimum-age.check.sql` runs 63 checks; removing the
  minor test from `verified_student`, putting back "unknown is an adult", the
  connections trigger, the recipient check, the peer-offer check, the roster
  clean-up, the check on acceptance or the profile policy's clause each turned
  it
  red. COPPA-1 is `TESTING`; MN-01, MN-03 and MN-06 are in place; CTL-006,
  K12-001 and K12-002 are tested.
- **Not settled here.** Counsel has not reviewed the terms' minimum age, and a
  district's own data rules are the next decision's.


## D-140 · The K–12 edition waits on sixteen baseline items, and a district's student data is refused until every one is tested

**Decided 29 Sep 2026, by the owner.** With the minimum age set (D-139), the
owner asked for the full K–12 edition. Two briefs of 29 September set the
gate: the feature benchmark's list of sixteen things to have before accepting
student data from a district, and the compliance playbook's K–12 note. This
decision writes that gate down before any of the edition exists.

- **K–12 here means 13 and over:** in practice high school, early college and
  career and technical education. Nothing younger is served, whatever a
  district asks.
- **The baseline is data.** `app/src/lib/k12/requirements.ts` holds the
  sixteen items (KB-01 to KB-16), each with a status the tree can show and
  its evidence, and renders `docs/k12/K12-REQUIREMENTS.md`. Today 10 are
  tested, 2 are building (a district-controlled AI policy, and class and
  grade boundaries, which do not exist yet) and 4 are designed: the district
  data-privacy agreement, the guardian consent approach, accessibility
  documentation and the security questionnaire package.
- **One question, one answer.** `districtReady()` answers "may a district's
  student data be accepted?" It is false while any of the sixteen is missing,
  short of tested, or tested with a gap still written against it — a status
  cannot outvote the item's own account of what is not done (Codex's review
  of #998). It is false today, and the edition asks it before anything else.
- **What only counsel can answer** is listed with the baseline items each
  answer would move, so the review is a list, not a conversation.

## D-141 · The K–12 edition is the same platform configured for a high school, described on the site and offered to nobody yet

**Decided 29 Sep 2026, by the owner.** The owner chose the full K–12 edition.
With the minimum age (D-139) and the district baseline (D-140) in place, this
writes down what the edition is, and puts it on the site without offering it.

- **Not a separate product.** `app/src/lib/k12/edition.ts` holds the
  positioning, the five places it would start (high schools, career and
  technical education, early college, college and career centres, district
  teams), what it is not for, and ten modules, each set up for a school and
  each pointed at the code it would build on.
- **One pilot, when it can be offered:** grades 9 to 12, 50 to 250 students,
  all 13 or over, for `PILOT_WEEKS` — the same 26 weeks as every pilot
  (D-134). It leaves out anything the student information system or the
  gradebook does.
- **Nothing takes district data early.** `mayTakeDistrictData()` is
  `districtReady()`, and the page prints its answer. Today that is no.
- **`/k-12/`** says no district or school uses Semester today, and the site
  test holds it there.

## D-148 · The sample university says what it is, cannot be dismissed, resets in one click, and does not show a role that does not exist

**Decided 30 Sep 2026** (S4 of the site brief). The demo at `/demo/` already had a
fictional institution, twelve roles and a persona switcher. What it did not do
was say plainly what a visitor could rely on, and the company site's customer
portal preview showed made-up figures as if they were readings.

- **The notice is permanent.** The demo bar had a *Hide* button; a visitor handed
  the link could lose the one line that says none of it is real. It is gone.
  The bar says *Demo environment · Sample university · Fictional data* and, always
  visible beneath it, *Nothing you do here is sent to Semester*. That is true
  because the demo is built with the account service blanked (`pages.yml`,
  held by `demosplit.test.ts`); what a visitor changes stays in the browser.
- **A reset.** *Reset the sample* erases the device the way the app's own Erase
  does (`eraseDevice`), then reloads, even when part of the erase is refused.
  Driven in a real browser: a key planted in local storage was gone afterwards
  and the demo came back.
- **Only roles that exist.** The bar and `/demo/` list the twelve roles the demo
  has, read from the app's own workspace definitions so the page cannot drift.
  Both say that a registrar view, a gift-officer view and a K-12 parent view are
  planned and not in the sample. None is faked: they belong to modules that are
  not built.
- **The customer portal preview** on the company site is labelled *Sample data ·
  not measured* on every section, and its health panel says in words that there
  is no customer, no uptime figure and no production restore test, and points to
  the real status history, once the status page keeps one. `samplecopy.test.ts` refuses an uptime figure
  that is not captioned as a sample in its own caption; it went red on one that
  was not.
- **The way in.** *Explore a sample university* is the wording on the company
  site's home and institutions pages and on the site's own institutions page.
- **Not built, and why.** The brief asked for about forty students, eight faculty
  and three advisors, and a guided tour. No screen in the demo reads a roster,
  so a seed would be data nothing shows; a tour of screens that are still moving
  would go stale in a week. Both wait for the modules that would use them. The
  sample keeps its name, *Northstar University* (an `.example` domain), rather
  than *Northfield*: whether *Northfield* is a real institution's name is the
  owner's to confirm, and nothing here changes it.
- **Found, not fixed.** `npm run smoke:institutional` fails after the routes pass,
  waiting for text that sits inside the closed persona disclosure. It fails the
  same way on `main` before this change, and CI does not run it.
## D-142 · The two AI drills ran against production, and both held

**Decided 29 Sep 2026.** `docs/LAUNCH-DECISIONS.md` item 15 asked for the
kill switch to be engaged against production once and for the prompt-injection
red-team to be run against the real model, each filed. Both ran on the evening
of 29 September, once the shared key was set and set cleanly, with a throwaway
invited account (`killswitch-drill@semester.invalid`) that was deleted
afterwards, with its invite and its usage row.

- **The kill switch held, 3 of 3.** `npm run drill:killswitch` made one call
  that was answered (200), then `kill.ai_generation` was engaged globally
  through the database and the next call was refused with 503 and the
  runtime's own sentence, then it was released and the next call was answered
  again. Engaged 22:52, released 22:55 UTC. The record is
  `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`. The
  refused call was not counted against the account, as the function says.
- **The red-team held, 21 of 21.** Three canaries (a verbatim token, a grade
  change, a request to quote the rules) planted in the material of seven
  prompt builders, sent to claude-opus-5 through the shared key's own proxy
  with the clamp and the monthly count in force. No reply carried a canary;
  several named the planted instruction and declined it. The transcript is
  `docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json`.
- **What moved.** These are the first files under `docs/evidence/`, so the
  compliance crosswalk's ceiling lifted from 2 to 4 by itself. AI-012 is
  `evidenced`, the first master-register row past `tested`; AI-010 is `tested`
  (one model, one run, and nothing screens material before it is sent, so not
  `evidenced`). R-07's description and mitigation say what is left. SEC-AI-002
  and AM-12 cite the transcript and stay open, because the evaluation set and
  the rest of misuse testing do not exist. Every test that held
  "`docs/evidence/` does not exist" now holds the directory to its records
  instead: every file there is registered, and a row above 2 cites one.
- **What it took.** The key was unset until the evening (501), and the first
  value saved was not a key: 82 characters, five spaces or breaks, one
  character outside ASCII, which made every signed-in call a 502 that
  counted. #987 now refuses such a value with a 503 before anyone is counted
  and logs its shape; that is how this one was found and replaced.
- **Not drilled:** the institution gateway, which is not deployed, and a
  per-tenant switch row. The red-team is a floor: it is re-run on every model
  change and each quarter, and each run files beside the last.

## D-143 · Replace by domain is the destination, and the bar a domain must clear before it moves is computed, not asserted

**Decided 29 Sep 2026.** Four briefs of the same day say Semester is meant to
replace the fragmented university stack rather than sit beside it: connect
first, replace by domain, operate as one system. The owner's note on the
first reads "those are also supposed to be replaced by Semester — that's the
whole point". The second gives the architecture principle for today, the
third seventeen registration, LMS and service expansions, the fourth what
must exist before an institution can retire a system.

- **The destination changes; today's boundary does not.**
  `docs/UNIVERSITY-OS-ARCHITECTURE.md` said Semester "is never the system of
  record". That absolute is replaced by the destination: the system of record
  for each domain an institution chooses to migrate. The list of what Semester
  does not replace stays, re-headed *today*, because nothing in the tree yet
  meets the fourth brief's bar, and the product roadmap's refusals (no official
  degree audit, no auto-registration, no payment processing) stay in force
  until a domain clears it. Health, counseling and clinical records, and
  emergency response stay bounded however far replacement goes.
- **Held to the tree the way D-125 held its two:** the four PDFs are kept
  under `docs/expansion/`; `app/src/lib/replaceregister.ts` is the data;
  `replaceregister.test.ts` renders `docs/DOMAIN-REPLACEMENT-REGISTER.md`,
  refuses a status above the kind of file it cites, a path that does not
  exist, and a supplied PDF as evidence. The seven source states are held to
  the five labels the database enforces and to the freshness vocabulary; the
  best next modules and the twelve final areas to rows that exist.
- **Replaceability is computed.** A domain is replaceable only when its native
  row and all fifteen replaceability requirements are held by a test. Today
  none is: data migration, parallel run and change management are designed
  only, and lifecycle, contractual support and exit are being built. The page
  prints, per domain, what stops it. The test also holds the architecture page
  to carrying this decision, so the two cannot drift apart silently.
- **Statuses read down, never up.** Where the evidence was a labelled sandbox
  with no store and no institution (`app/server/institution/*`), the native
  row is *building* even when a test passes, because the join to a real
  domain is what replacement means.

## D-144 · The Migration Center is built: twelve stages, each opened only by its evidence, and no student record ever leaves the browser

**Decided 29 Sep 2026.** The fourth brief of D-143 ranks a Migration Center
first among what an institution needs before it can retire a system, and the
domain replacement register computed that data migration and parallel run
stopped every domain. The owner asked for it to be built.

- **Four tables and a trigger** (`20260929200000_migration_center.sql`):
  `migration_projects` holds the record the brief lists — source platform and
  version, data owner, classifications, retention, historical cutoff,
  duplicate rule, cutover date, rollback plan, archive location, required
  approval areas; `migration_field_maps` the mapping and cleaning rules;
  `migration_runs` and `migration_approvals` the evidence. A migration is born
  at inventory and moves forward one stage at a time only when
  `private.migration_gate_failures` returns nothing; it may go back until
  cutover, which restarts the evidence of every stage it re-enters. Cutover
  needs a date, a rollback plan and the latest decision in every required
  area (at least two) to be an approval, recorded at cutover by a
  `migration:approve` holder who did not open the migration.
- **Evidence is counts and a fingerprint, never a record.** A sample export is
  read, mapped, validated and reconciled in the browser (`lib/migration/
  center.ts`); what is recorded is six counts and the file's SHA-256. `passed`
  is a generated column, so nobody records "passed", and runs and approvals
  are append-only except for the person reference account deletion clears.
  The counts are the recorder's attributed claim about a file they hold; the
  database cannot re-run them, and the table comment and the register say so.
- **No function a client can call.** Every rule is a policy or a trigger, so
  the grants allowlist and the definer register are unchanged. Three
  capabilities (`migration:manage`, `:approve`, `:view`) on eleven role pairs;
  the capability matrix pin moves from 118 to 129. Every write is audited to
  `tenant_policy_audit_event`, attributed to the grant that allowed it.
- **A University tab, Migration, behind `migrationCenter`** (off by default,
  on in an institutional preview), shown only to an account holding a
  migration capability at the school. The screen shows what the current stage
  still needs in the database's own codes as sentences, offers the move only
  when nothing is owed, and says beside the file picker that the file goes no
  further.
- **Registers moved down to what is true:** the Migration Center, the
  migration record, the parallel run and the parallel-run requirement are
  held by tests; data migration is *building*, because nothing yet imports
  records into a Semester domain of record — none exists — so no domain is
  replaceable yet. MIG-005 and MIG-006 in the master register move to
  building; MIG-001 to MIG-004, which are about importing LMS course content,
  do not move.
- **Checked on PostgreSQL 16 here, not 17.** This container cannot install the
  live project's major, so `check.sh` ran under `SEMESTER_CHECK_PG_ANY`, with
  the second pass; CI runs 17 and is the authority.

## D-145 · The academic-record ledger is built: nobody writes it, a second person's approval does, and every entry answers the brief's eight questions

**Decided 29 Sep 2026.** The replaceability brief's second final area is an
authoritative academic-record ledger for official grades, credits,
enrollment, transcripts and credentials, kept "as seriously as a financial
ledger". The owner asked for it to be built.

- **Three tables and a trigger** (`20260929210000_academic_record_ledger.sql`).
  A change is proposed in `academic_record_changes` with a reason, an
  effective date and its source. When someone *other than its proposer*
  approves it, `private.academic_record_change_guard` writes one row to
  `academic_record_entries`, naming the entry it replaced and that entry's
  value. No client holds a grant to write the ledger; the one security
  definer function is that trigger, in `private` and revoked from every
  client role, so the grants allowlist and the definer register are
  unchanged.
- **Append-only, for the owner too.** A correction is a new entry and a
  reversal a `void` entry; an update or delete of an entry is refused to
  every role, except the clearing of a person reference by account deletion
  and the removal of a school.
- **The override is the database's decision.** Correcting or voiding a
  grade, a standing or a conferral that already has an entry in effect needs
  an approver holding `record:override`; the trigger reads that from the
  ledger rather than from a flag the client sends. Four capabilities on seven
  role pairs (registrar all four, faculty propose, dean approve and read); the
  capability matrix pin moves from 129 to 136.
- **The record is the school's.** It is keyed by the school's own student
  identifier, not a Semester account. `academic_record_subjects` links an
  account so the student can read their own entries; an approver makes the
  link, the student cannot, and deleting the account removes only the link.
- **Not an official transcript.** `lib/record/ledger.ts` folds the ledger into
  the record as it stood on any date and exports it as CSV headed "Not an
  official transcript". Issuing a transcript or a credential is not done.
- **A University tab, Academic record, behind `recordLedger`** (off by
  default): find a student by identifier, the record on any date, each
  line's history with the eight answers, proposing with an override warning,
  and a queue in which an approver's own proposals have no Approve button.
- **Assessed, high risk.** The ledger holds education records, so it has a
  privacy impact assessment in `governance/pia.ts`, rated high, with four open
  items: no student screen for inspection yet, no retention schedule set by a
  school, faculty reach only with a school-wide grant, and linking is manual.
- **Checked on PostgreSQL 16 here**, under `SEMESTER_CHECK_PG_ANY`, with the
  second pass; CI runs 17 and is the authority.

## D-146 · Student accounts are kept under financial controls, and no money moves through Semester

**Decided 29 Sep 2026.** The replaceability brief's third final area is a
financial-control system for invoices, payments, refunds, holds,
reconciliation and audit: "financial controls as first-class architecture —
not only payment buttons". The owner asked for it to be built.

- **Nobody writes the account ledger** (`20260929220000_student_accounts.sql`).
  Every charge, payment, refund, adjustment, reversal, aid credit
  (scholarship, waiver, discount, sponsorship) and chargeback is a request;
  `private.student_account_request_guard` writes one signed entry when
  someone other than the requester approves it. Entries, reconciliations and
  closes are append-only for every role, and a person column may only be
  cleared, never changed.
- **The brief's controls, in the database.** Above the school's threshold
  ($1,000 by default) a refund, adjustment, reversal or aid credit needs
  `finance:approve_high`. Whoever requested or approved a payment does not
  approve its refund, reversal or chargeback — the brief's own example of
  role separation. A refund never returns more than is left of the payment,
  and an entry is reversed once, in full.
- **Reconciliation and the monthly close.** The payment provider's settlement
  file is read in the browser and its totals recorded; the ledger's side is
  computed by the database from the ledger. A month closes only on a passing
  reconciliation recorded by someone else, with nothing waiting, and then
  takes nothing new: a correction is an entry in an open month.
- **No money moves here, and no card is stored.** Payments go through the
  school's hosted payment provider and are recorded by its reference. A run of
  13 to 19 digits is refused in every field a person types. This keeps within
  the owner's decision, in an open pull request, that the positioning
  statement does not list payments: Semester keeps the account and its
  controls; it does not process payments and does not claim to.
- **Derived, and reproducible from the ledger:** the balance, its aging, a
  financial hold (overdue past the school's window and above its minimum,
  shown as the hold card's neutral sentence with no amount), a period's
  statement, a payment-plan schedule and a receipt (`lib/finance/accounts.ts`).
- **A University tab, Student accounts, behind `studentAccounts`** (off by
  default). A student reads their own account through the link an approver
  makes on the academic record (`academic_record_subjects`), on **Bill**,
  above the figures they type themselves (`components/MyStudentAccount.tsx`,
  same flag): what is owed today, its age, the hold with the school's own rule
  (which a linked student may now read), every posted entry with a receipt for
  each payment, later-dated charges apart, and a month's statement to
  download. It never asks for who requested or approved an entry, and links
  out to the school's payment page only when something is owed.
- **Payment plans** (`20260929230000_student_payment_plans.sql`). From Bill,
  a student asks to spread what they owe today over monthly payments: how
  many, and when the first falls, today to 30 days on. The database, not the
  student, reads the balance from the ledger and writes the schedule by the
  school's rules (at least 10% first, at most six payments, none under $50 by
  default, in `student_account_settings`), the last payment absorbing the
  rounding so it sums to the cent — the same arithmetic as `paymentPlan`,
  and the check suite and `accounts.test.ts` hold both to one schedule.
  Someone holding `finance:approve` who did not ask agrees to it or declines,
  and only while the balance is still the one asked for and the first
  payment is not past. One plan is live at a time; the asker may withdraw one
  not yet decided, an approver may cancel an agreed one with a reason the
  student reads, and nothing else about a plan or its schedule changes.
  Whether a plan is kept is read from the ledger (`planStanding`): what was
  credited since it was asked for pays the schedule in order. A plan being
  kept lifts the financial hold; one behind does not. Staff see the plan on
  the account and decide plans in their own queue.
- **Assessed, high risk,** in `governance/pia.ts`, owned by the finance seat,
  with five open items. Capability matrix 136 → 145.
- **Not built:** double-entry against general-ledger accounts, a bank leg in
  reconciliation, tax configuration, any connection to a payment provider,
  a plan-standing the database holds (the app works it out), and anything
  sent to a student.

## D-147 · The AI providers' published terms are on file, verbatim, and nothing is signed

**Decided 29 Sep 2026.** The DPA checklist, the vendor risk register and the
AI training policy each said the providers' training and retention terms were
"not yet recorded". The owner asked for the contract terms to be put on file.

- **What is on file.** `app/src/lib/trust/provider-terms.ts`, rendered to
  `docs/trust/PROVIDER-TERMS.md`, records seven documents: Anthropic's
  Commercial Terms, DPA and retention article; OpenAI's Services Agreement,
  DPA, Student Data Privacy Agreement and data-controls guide. Each has its
  stated version, and each PDF has the SHA-256 of the copy read. For every
  question the DPA checklist asks (training, retention, breach notice,
  deletion on termination, subprocessors, security, student data), the
  clause is quoted word for word, checked against the document's text on
  29 September.
- **What they say.** Neither provider trains on API content without an
  opt-in, and both write it into the contract. Both keep data 30 days by
  default and delete it within 30 days of termination. Anthropic commits to
  breach notice within 48 hours; OpenAI to "without undue delay". Anthropic
  publishes no FERPA terms for the API. OpenAI's Student DPA names it a
  school official, but it takes effect only on a signed Order Form.
- **Nothing is signed, and the test holds it.** Every party stands at
  *published* while `docs/evidence/vendors/` does not exist. Anthropic's
  terms are not in force for Semester: production has no shared key, and
  there is no legal entity to be the Customer. OpenAI's are the institution's
  to accept. The page lists what only the owner can do.
- **Codex's review found three things, all fixed.** The OpenAI security row
  quoted breach assistance, not a security measure; it now quotes DPA 2.5
  and reads it against the Services Agreement's 5.1 and 5.2 (updatable
  Security Measures, audit reports once a year on request). The Anthropic
  deletion quote stopped at a colon; it now carries the return-and-delete
  subclauses. And four registers (launch kit, AI assurance, compliance
  crosswalk, readiness pack) still said the terms were not on file; each is
  re-read, and a test now walks `app/src/lib/` for that sentence so a fifth
  copy is caught.
- **Not changed:** `docs/evidence/` is not created. An executed agreement is
  what the vendor register and the compliance crosswalk wait for there, and
  a published web page is not one.

## D-149 · The status page keeps a 90-day history from the day recording began, and a day nobody checked is never drawn as up

**Decided 30 Sep 2026** (S5 of the site brief). The status page said "Nothing
here is a cached report or an uptime figure", and the hourly production check
kept nothing it found. Both were true and both were a gap: a buyer asks for
history, and there was none to show.

- **Where the record lives.** `production-smoke.yml` gains a `record` job. It
  probes five components (the app, sign-in, saved work, the AI assistant and
  Plus checkout), adds the result to `status-history.json` on a `status-data`
  branch, and pushes that branch only. It is the one job with write access
  (`contents: write`); it never touches main, and a queued hour is never
  dropped for a newer one. The pages read the file from
  `raw.githubusercontent.com`; the repository is public.
- **Nothing is filled in.** History starts with the first record
  (`since`). A day with no check is *no data yet*, drawn empty and never green;
  an hour the scheduler skips records nothing, so a gap shows as a gap. A
  percentage is checks passed over checks made and is absent when there were
  none. Each row says how many checks and days it rests on.
- **What the AI and checkout rows mean.** Only that the function answered a
  browser preflight (200, 204 or 403; a 404 or a server error is down). No
  model is called and no payment is attempted, and checkout runs on test keys
  (D-128). The pages say so beside the bars.
- **Incidents are structured.** `status-incidents.json` now carries id, title,
  components, impact, start and resolution, and dated updates;
  `incidentProblems` refuses one that is out of order, resolved without a
  resolved update, or naming a component that does not exist. `status-feed.xml`
  is the same file as an Atom feed, rendered by `scripts/status-feed.mjs` and
  held to it by a test.
- **Held by `statushistory.test.ts`.** The uptime arithmetic (24/24, 23/24 and
  0/24 is 47 of 72, 65.28%), the probes (a redirect is not up; a 404 function
  is gone), the page's own copy of `barState` against the module's, the company
  site's copy of the component list, the URL the pages read against the branch
  the workflow writes, and that only the `record` job can write.
- **Limits, stated.** A host that enforces `public/_headers` would block the
  history fetch from `raw.githubusercontent.com` and the page would say the
  history could not be loaded; the app's CSP is not widened for it, because
  `status.html` is served from GitHub Pages, which sends none. The status page
  is still not hosted apart from the app it reports on, there are no
  subscriber notifications, and GitHub's scheduler can delay or skip a run.
  No uptime figure is a commitment: `launchcompleteness` still says not to
  promise one.
- **Not changed.** The live in-browser checks, the incident email address, and
  the launch gate `operations-live`, which stays partial: no alert reaches a
  named person.

## D-150 · Full beta: server storage where data is shared, SCIM and SSO on edge functions, Vercel for previews, preview branches for migrations

**Decided 30 Sep 2026, by the owner**, in answer to the five questions at the
end of `docs/FULL-BETA-REQUIREMENTS.md` (Milestone 0). Recorded as given; the
detail below is how the tree reads it, and the owner can correct any of it.

- **Server storage** is provided for the data a full beta cannot leave on one
  device: anything shared with another person, held by an institution, billed,
  consented to, or a file. Personal working data stays device-first with sync
  (ADR 0001 stands); the app is still usable signed out.
- **Hosting.** Vercel hosts previews and the institution gateway. GitHub Pages
  keeps serving production until a cutover is separately approved. This
  amends nothing about the deploy path today.
- **SCIM and single sign-on run on Supabase edge functions** rather than the
  standalone gateway. This departs from how `app/server/institution/scim.ts`
  is built and from the letter of the gateway as a separate service; the move
  is a Milestone 7 piece of work and needs an ADR amendment when it starts.
  Until then the gateway's SCIM stays off (`SEMESTER_SCIM`).
- **Migrations are tried on Supabase preview branches only, never on
  production.** Applying anything to production still needs separate
  approval.
- **Not decided here:** tightening tenant scoping of classmates, rooms and
  groups (G-03). `tenancy.check.sql` records that any confirmed account can
  enter any school's course room by design, and closing that would empty
  rooms for students who have not claimed a school. It waits for the owner.

## D-151 · Semester replaces the university stack, one module at a time, and the site stops saying it does not

**Decided by owner 29 Sep 2026.** The site said "it does not replace your SIS"
and the register deferred registration writes, while the owner's goal is one
system that replaces the SIS, the LMS, the registrar, student accounts and the
rest. Two modes on one codebase: **Connect** (today, the default) reads from a
school's systems and prepares actions; **Core** makes Semester the record for
one module, switched per tenant, in writing, with a rollback that freezes and
never deletes.

- **Site.** `site/modules.ts` is the takeover map: fourteen modules, the kinds
  of system each would replace, what it does in Connect, what changes in Core,
  and the claims register's status word. Ten modules read *planned*. Four
  (registration, the gradebook, records, student accounts) read *in
  preparation*: their tables and check suites landed on 30 Sep 2026 behind
  switches that are off for every school, and none is certified.
  `/platform/system-boundaries/` and the company site's boundaries block
  print it, and `modules.test.ts` refuses a module above *planned* whose
  tables or `<module>.check.sql` suite are missing, and one still *planned*
  whose tables have landed.
- **Rule 13** in `DO-NOT-BUILD.md`: no Core module without row-level-security
  tests, an immutable history and a kill switch.
- **Kept:** AI never decides grades, admissions, aid or discipline (rules 3
  and 7); no card numbers are stored; the Known Limitations already say what
  checkout does (#986).
- **Not done here:** moving "Direct registration writes" off the deferred list
  in `expansiongovernance.ts` (its test counts sixteen). That edit relaxes a
  Tier 4 refusal and waits for the owner to confirm it.

## D-152 · A module's mode is a row two other administrators approve, it fails to Connect, and going back deletes nothing

**Decided 29 Sep 2026, by the owner (Prompt 2 of the Core briefs).** D-151 made
Connect and Core the two ways a school can run a module. This is the switch.

- **The row.** `tenant_module_mode` holds one row per school and module; no row
  is Connect. There is no write policy: the only door is
  `module_mode_request` plus `module_mode_approval`, and the trigger that
  applies them runs as the table's owner. Fourteen modules, one list
  (`public.core_modules()` = `CORE_MODULES` in `@semester/contract` = the
  takeover map), held equal by `modulemode.test.ts`.
- **Two approvers.** Connect to Core is applied on the second distinct
  approver holding `tenant:configure`; the requester never counts, nor does one
  person twice. A request expires in seven days.
- **The way back is immediate and deletes nothing.** Core to Connect applies
  at once and marks the row `frozen`: the module's Core data is kept,
  read-only.
- **Kill switch.** `kill.core_modules` (school or global) makes every module
  read Connect and Core data read frozen, and refuses new Core requests. It
  is in `FLAGS` as `module.core_mode` and in the flag registry.
- **The client fails to Connect.** `resolveModuleMode` answers Connect for
  anything it cannot read. `useModuleMode(module, school)` is the one hook.
- **Where it shows.** A Modules tab on the institution screen, for someone
  holding `tenant:configure` over the school. It says no Core module is built.
- **Proof.** `supabase/module_mode.check.sql` (49 checks). Red when the second
  approval is reduced to one, and red when the requester may approve; each
  restored.
- **Not done here, on purpose:** MFA on the approving act (Prompt 6 adds
  step-up), a withdraw action for a pending request, and any Core module.

## D-153 · Chart colours, an error colour and motion tokens are tokens; recovery and access review are designed, not built

**Proposed — needs owner** for the two designs. The token work below is
already in the tree under the design-debt register and needs no decision.

- **Chart colours** (`chartFor`, `--chart-1` … `--chart-5`, four source
  roles). Derived per ground, held to 3:1 on every surface of all 13 grounds
  (measured floor 3.20:1), apart from each other, apart in luminance for
  neighbours, and never red. No existing chart is migrated: `SheetChart` and
  `Plot` keep the reader's own hues, a different job. Rules:
  [DATA-VISUALIZATION-SYSTEM.md](DATA-VISUALIZATION-SYSTEM.md).
- **An error colour** (`errorFor`, `--app-error`, DD-006). `--status-danger`
  no longer shares the warning ink: hue 350, held to 6:1 where the warning
  holds 4.5:1. 7:1 was tried and turned every dark ground's error into a pastel.
- **Motion** (DD-007) and **hex colours** (DD-009) now have ledgers that fail on
  a new literal and on a stale entry, in the shape of `styles/budget.ts`. Eight
  durations moved onto tokens; nine stay with reasons. The leave button on a
  call had white ink on the warning colour (2.14:1 on Industry Dark) and now uses
  `--app-bg`.
- **Proposed, not built:** [RECOVERY-CENTER.md](RECOVERY-CENTER.md) extends the
  existing Recovery screen (three phases, the first needing no schema);
  [ACCESS-SIMULATOR.md](ACCESS-SIMULATOR.md) is a University tab, read-only,
  proved against the real policies. Neither adds navigation. Open questions are
  at the foot of each.
- **The design brief's five destinations** (Today, My Path, Search, Plan, Me)
  **conflict with the seven roots on main** and with `DO-NOT-BUILD.md` #1.
  Existing decision holds; not reopened here.
- **Owner's answer, 30 Sep 2026.** Build the Recovery Center's first phase only,
  with the proposed answers to its open questions: no per-plan versions, no
  account cooling-off. The Access Simulator and the five-destination navigation
  stay parked; the navigation still conflicts with `DO-NOT-BUILD.md` #1.
- **What R1 built, and a correction.** A list of the drafts a device holds, the
  restore claim on `Recovery` corrected (it said nothing could be restored while
  `Export` restores from copies the app takes by itself), and links to that
  restore and to `Behind`. The first version of `RECOVERY-CENTER.md` said
  "Restart my week" was absent; it was not (`screens/Behind.tsx`), and the page
  is corrected. A per-deadline "set aside" needs new persisted state and is left
  as an open question.

## D-154 · The load harness covers the open and sync every student makes, and a push that loses an update fails it

**Decided 30 Sep 2026.** #974's `supabase/load.sh` loads the registration-week
paths. Every visit and every edit take a different path: the pull, and then
compare-and-swap pushes of the state row and four courses. That path had no
load at all. B14 and SRE-007 still recorded that no load test existed. #996
had built a second harness for it, at the same path; that harness is folded
into this one rather than kept beside it.

- **Three scenarios:**
  - `sync-open`: the nine requests of an open;
  - `sync-push`: state and four courses, by compare-and-swap;
  - `sync-same-student`: two devices pushing at once.

  Each runs as the student, on production-sized rows, against a budget about
  ten times a quiet machine's reading, like the others.
- **A push that writes nothing fails the run.** A compare-and-swap that
  matches nothing still succeeds, so the rows written are counted: about one
  state row and four courses a push. Shown red with a course
  compare-and-swap planted to miss: 0 courses written, and a push p95 that
  looked seven times faster.
- **A lost update fails the run.** Each winning push must build on the one
  before. The control, the same race without the compare-and-swap, must lose
  some writes, and did (1,165 of 1,526).
- **The database is settled before timing:** `VACUUM (FREEZE, ANALYZE)` and
  `CHECKPOINT` after the seed. The #996 gate went red on a runner without
  them, with a median of 8 ms under a p95 of 457 ms.
- **Capacity**, from #996's rate-limited run on production's own settings:
  the first morning of term at ten times the largest pilot held at 2–4× the
  target. The push gives first, because every push rewrites every course.
  This is recorded as a reading, not re-run.
- **Not done:** PostgREST, Supavisor, GoTrue and the edge functions under
  load, which is the preview-branch run; and journeys that do not exist yet.
  B14 moves from owed to partial and SRE-007 from not-started to building.

## D-155 · A deletion is settled against the version both devices agreed on, and two sends can be kept for the student to send

**Decided 30 Sep 2026** (Prompt 7 of the Core build prompts: sync conflicts, an
offline outbox, tombstones). Read against main first, which found the prompt's
premise partly stale: conflict detection and the choose-a-version screen were
already built (`lib/conflicts.ts`, `components/Review.tsx`, the base kept on the
device), and the known limitation and the `cloud.ts` header still said the later
edit silently won. Both were corrected, and nothing was rebuilt.

- **Deletions.** A union cannot express one, so a note deleted on a phone came
  back from the laptop every time, and a course deleted offline came back once
  the app closed, because the list that remembered it was in memory.
  `lib/deletions.ts` reads the base instead: in the base, missing on one side and
  unchanged on the other is a deletion, and it stays one on both. Deleted on one
  side and *edited* on the other keeps the edit and asks, on the same list as two
  edits. The push names a deleted course from the base, so it survives a restart.
- **Which lists.** Courses, notes, actions, appointments, documents, sheets and
  decks: each has exactly one removal, an explicit delete, and a test reads the
  reducers to hold it there. A list the app also trims by itself would spread its
  own trimming to every device as if somebody had chosen it, so the rest wait.
- **Never a whole list at once.** Five or more, and 80% or more of what was
  agreed, is not believed: an app that dropped rows on load looks identical to a
  person deleting everything, and being wrong deletes from the account. The rows
  come back, which is what happened before, and the known limitation says so.
- **Two sends can be kept, and none sends itself.** D-055 refused to queue
  sharing and sending because a share that fires hours later is a surprise. That
  reasoning stands, so what was added is a way to *keep* one, not to send it. A
  share with an advisor and a course plan are held on the device
  (`lib/sync/outbox.ts`, IndexedDB `semester-outbox`), dated and cancellable.
  Coming back online makes them ready and sends nothing; the student sends each,
  one tap; one that waited three days is never sent. Erase device clears it.
- **Once, or flagged.** The server calls take no idempotency key, so a request
  cut off mid-flight may or may not have landed. The entry is written `sending`
  before the call, so a closed tab is found as *unknown*, and an unknown share is
  checked by the student before it goes again. A course plan replaces itself at
  the school, so it may be sent again freely.
- **What can never be held.** Publishing, deleting an account, opening an
  official site, and any write to an official or financial record. Every write
  that needs a connection is in a class with a reason (`lib/sync/classes.ts`), a
  test reads the source so a new one cannot ship unclassified, and it reads the
  two functions a held send calls for any official or financial name.
- **Proved.** `state/deletions.test.tsx` runs the real store against a mocked
  account through airplane mode, a restart and a connection that flaps. Reverting
  the store change turned 8 of its 12 red; reverting the course push alone turned
  its test red; auto-sending on reconnect turned 9 of the panel's 18 red.
- **Not done, and why.** *File sync*: it needs a storage bucket with row-level
  security and an owner decision on uploading tens of megabytes over a phone plan,
  which `cloud.ts` chose not to do silently. *Other lists' deletions* (folders,
  equations, places and the rest). *Server-side idempotency keys.* *A real
  browser going offline against a real project*: the smoke has no Supabase, so
  this is proved against the store, not the wire. *Naming the other device*: no
  device identity exists, so the screen says "this device" and "the other".


## D-156 · The fifteen cross-platform features are built in slices, each reading what the student already holds, and none acts without their review

**Proposed — needs owner.** The owner supplied a document of fifteen
cross-platform features (My Commitments, the decision journal, What Changed,
inbox-zero, templates, the resource guarantee, the workload contract and
fairness engine, retrospectives, Prepare Me, handoff packs, skills transfer,
the archive, focus modes, learning continuity) and asked for all of them. This
records how they are being built, so the owner can correct it.

- **Slices, audited first.** Each slice is checked against `origin/main` and the
  open pull requests before it starts (CLAUDE.md). Where a module already
  holds most of a feature, it is extended rather than duplicated:
  `community/services.ts` for the resource guarantee, `advisor-meeting.ts`'s
  share-payload pattern for handoff packs.
- **Nothing is created or sent on the student's behalf.** What Changed only
  reports and the one write is "Got it"; Prepare Me gathers, and its handoff
  pack needs a tick per field from a fixed list per destination; suggestions
  never become deadlines or actions until confirmed.
- **Derived, not asserted.** Conflicts, free windows and recovery options are
  arithmetic on stated times; a missing commute is zero; a slot with nothing
  behind it is reported as missing. No difficulty score.
- **Aggregates only for institutions.** Anything cohort-level (the fairness
  engine) is aggregate and suppresses small cells; none reads an individual.
- **Not built here, on purpose:** Focus Modes, which open PR #725 already
  covers, and the learning-map overlap with PR #1010 for the workload contract
  and learning continuity, until those land. Status per feature is in
  `docs/CROSS-PLATFORM-FEATURES-REGISTER.md`.
- **Numbering.** Open pull requests may also claim D-156; whoever merges second
  renumbers.

## D-157 · Alumni relations and fundraising are described on the site and built by no one yet

**Decided 30 Sep 2026.** The site to-do (S7) asks for an advancement module
and its two pages. Following D-141's pattern for the K–12 edition, this puts
what the module would be on the site without offering it.

- **`app/src/lib/advancement/edition.ts`** holds three parts (alumni relations,
  giving, the advancement office's console), each *planned*, each saying what
  it would do and what it still needs. Its test holds that no gift, donor,
  pledge, giving-campaign or advancement table exists, so a row cannot stay
  "planned" once the money side lands. A record of who graduated and the
  consents they give is not money, and may land on its own.
- **Not planned, and said so:** wealth screening and predictive donor
  scoring. DO-NOT-BUILD rule 3 refuses a ranking nobody can explain, and a
  donor's capacity to give is inferred about them, not told to the school.
- **Not decided here, and the pages say so:** how a gift would be paid, and a
  price. The brief names a payment provider for recurring gifts; D-146 says no
  money moves through Semester. Those two disagree, and it is the owner's
  call, so neither page names a provider or a figure.
- **Waits on counsel** for charitable-solicitation registration, state by
  state, and for the wording of tax receipts, before the module is offered.
- **Pages:** `/solutions/advancement/` and `/alumni/`. The site test holds
  both to "no school uses Semester for alumni relations or fundraising" and
  "no gift has been taken", and forbids a solicitation on either. The company
  site (`company-site/index.html`) does not carry them yet.


## D-160 · A security gap audit: what was closed, what was laid as a foundation, and what is left to people

**Decided 30 Sep 2026.** The FERPA/LTI checklist, the runbook and the
architecture-hardening briefs were read as evidence, not authority, against
`main` and the open drafts. The record is
[SECURITY-GAP-AUDIT-2026-09-30.md](SECURITY-GAP-AUDIT-2026-09-30.md). This is
not a penetration test and claims nothing about FERPA.

- **Closed, each shown red before or under a mutation:**
  - LTI envelope: a token header that names a key (`jku`, `x5u`, `x5c`,
    `jwk`) or an algorithm other than RS256 is refused before a key is fetched;
    `jwtVerify` is pinned to that algorithm, the registration's issuer and
    audience, a maximum token age and required claims; `nbf`, token age and a
    foreign `azp` on a single audience are refused; `sub` and library errors
    leave the logs; key-set refresh limits are pinned.
  - Termination: SCIM deprovisioning did not revoke `role_grants`, which is
    what `has_capability` reads, so a removed staff member kept school-scoped
    authority. A trigger revokes that person's live school-scope grants for
    that school; suspension revokes nothing; reactivation does not restore
    authority; a backfill repairs people already deprovisioned.
  - Endpoints: every edge function has `verify_jwt = false` by design, so one
    without its own check would have been open. Each is now listed with the
    credential it answers to, and its source must carry the evidence.
- **A foundation for a control that did not exist:** staged roster imports
  (per-school, server-only, closed row shape, manifest and digest validation,
  a held-on-large-removal threshold with a second-person approver,
  idempotent, reconcilable, reversible, refusing deletes under a legal hold).
  There is **no OneRoster client and no live data path**; EDT-6 stays
  NOT_STARTED and nothing may say Semester supports OneRoster.
- **Left, and why:** the legitimate-purpose code list, `legal_basis`, the
  meaning of a signature and retention of staged roster rows are counsel's; the
  access-review cadence, staff export policy and JIT elevation are policy; an
  unbound LTI registration launching with a warning is a recorded product
  decision, not a bug; a person/alias identity table and a sweep of every RPC
  for tenant context are larger than an unambiguous fix.
- **Not applied to production.** The migrations are drafts. Applying
  `20260930210000` revokes live grants of people already deprovisioned (the
  backfill), which is the intent and is still a data change; it wants a look at
  the affected rows first.
- **Claims.** No claim moves. Not FERPA compliant, not certified, not pilot-ready.

---
