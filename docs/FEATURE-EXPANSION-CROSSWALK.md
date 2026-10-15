# Feature-expansion crosswalk: Phases B–O

**Baseline:** `semester-unified-platform` at `1c8ab70`, which is `origin/main`
`c029822` plus the Phase 0 docs.

For every module in the feature-expansion command, this file records:

- where it lives, among the five destinations and the existing screen ids;
- what already exists for it in code or in the #762 tables;
- its feature flag and source labels;
- the conflicts it raises with decisions already on main.

It extends [ROUTE-AND-FEATURE-CROSSWALK.md](ROUTE-AND-FEATURE-CROSSWALK.md) and
[`expansion/ROUTE-AND-FEATURE-CROSSWALK.md`](expansion/ROUTE-AND-FEATURE-CROSSWALK.md).
It does not repeat them.

**Status key:**

- **Exists**: shipped on main; the phase polishes or relabels it.
- **Extend**: there is a real base in code to build on.
- **Table only**: #762 created the schema and RLS, but there is no UI or lib.
- **New**: nothing to build on.

**Why this matters:** `CLAUDE.md` says to check main for the thing itself.
Registration day, graduation scenarios, crunch-week detection, a service
worker and a skills graph are all already here. Building them again would be
the duplicate that file warns about.

---

## Summary

| Phase | Module | Flag | Lands in (destination → screen) | Status | Biggest existing base |
|---|---|---|---|---|---|
| B | Today + Action Center | `today_action_center` *(proposed, D-013)* | Today → `home` | **Extend** | `TodayDecisionSurface`, `lib/today-decision.ts` (#761) |
| C | Registration Day Mode | `registration_day_mode` | Today (takeover of Next Best Step) + My Path → `yes` › Registration day | **Exists → extend** | `lib/registration-day.ts`, `components/RegistrationDay.tsx` (#762); tables `registration_windows`, `registration_time_tickets`, `seat_watches` |
| D | Graduation Simulator | `graduation_simulator` | My Path → `degree` › Scenarios | **Exists → extend** | `lib/graduation.ts`, `components/GraduationSimulator.tsx` (#762); table `graduation_scenarios` |
| D | Cost Planner | `cost_planner` | My Path → `degree` › Scenarios; Plan → `costs` | **Extend** | "Cost of one more semester" in `graduation.ts`; `screens/Costs.tsx`; table `cost_plans` |
| E | Academic Life Balance + Crunch Week Forecast | `academic_life_balance`, `crunch_week_forecast` (D-027) | Plan → `calendar` (week view); Today (one crunch card) | **Extend** | `lib/clash.ts` (deadline pile-ups, 14 days out), `lib/runway.ts`, `lib/registration.ts` `conflicts()`; `state.appointments`; `screens/Work.tsx` hours |
| F | Course Detail V2 | `course_detail_v2` (D-040) | My Path → `yes` › Course search (sheet / drawer; built); Search → drawer and `course/:id` (later) | **Extend** | `screens/Courses.tsx` `CourseDetail`, `components/CourseHub.tsx`, portal search results |
| G | Advisor Meeting Mode | `advisor_meeting_mode` (D-016, D-042) | My Path → `degree` › Advisor meeting (agenda, sharing panel, advisor view; built) | **New** (UI + `advisor_shares`, D-043) | `GraduationSimulator` advisor `.txt`; the `accommodation_shares` pattern (expiry, revocation, access events) |
| H | Study Readiness | `study_readiness` (D-045) | Course Companion → `course/:id` › **Readiness** tab (built) | **Extend** | `lib/standing.ts`, `components/Standing.tsx` (words, not scores); `state.reviews`; `lib/runway.ts` |
| H | Source Locker | `source_locker` (D-044) | Course Companion → `course/:id` › **Sources** tab (built); Me → Trust Center (Phase N) | **Extend** | `lib/sources.ts`, `screens/Sources.tsx`, `lib/studysources.ts`, `intelligence/Disclosure.tsx` |
| I | Career Evidence + resume bullets | `career_evidence` (D-046, D-047) | Me → `career` › **Evidence** tab; course overview › skills panel (built) | **Extend** | `lib/career.ts`, `screens/Career.tsx` (résumé present), `lib/skills-graph.ts` (`careerSkillsGraph` flag); table `skill_records` |
| J | Campus Office Action Feed | `office_action_feed` (D-048, D-049, D-050) | Today: ranked in the Action Center, or the first three on the briefing; Key dates (`registrar`): full feed and the office desk (built) | **Extend** + migration | `institution_actions` finished by `20260928302000_office_action_feed.sql`; `lib/office-actions.ts`, `components/OfficeActionFeed.tsx`, `components/OfficeActionDesk.tsx` |
| K | Course Demand Forecasting | `demand_forecasting` (D-051, D-052, D-053) | Plan › registration **Cart** (student consent); University › **Demand** (staff, by `demand:read` scope) (built) | **Extend** + migration | `20260928305000_course_demand_forecasting.sql`; `lib/course-demand.ts`, `components/DemandContribution.tsx`, `components/DemandDesk.tsx` |
| L | Semester Wrapped | `semester_wrapped` (D-054) | Me → `me` › You: the recap card (built) | **Extend** | `lib/wrapped.ts`, `components/SemesterWrapped.tsx`; reads `state.done`/`tickedAt`/`sessions`/`taken` and the device stores of Phases B, G, I and the registration workspace |
| M | Offline Mode | `offline_mode` (D-055, D-056) | App shell: the offline badge under the header; every screen (refusals in shared `ConfirmDialog` and the remote calls) (built) | **Extend** | `lib/offline-mode.ts`, `components/OfflineBanner.tsx`; reuses `lib/offline.ts`, `lib/merge.ts`, `public/sw.js` (unchanged) |
| P | Task sync engine | `offline_engine_tasks` (D-1190) | No screen of its own: the same actions, saved offline and sent when a connection returns; the sync line says what the account has not confirmed (built, tasks only, device opt-in as well) | **Extend** | `lib/sync/engine/`, `state/useTaskEngine.ts`, `packages/offline-sync`; `lib/cloud.ts` `pull`; uses the existing `public.tasks` table, no migration |
| N | Trust Center | `trust_center` (D-057) | Me › You › **Trust & data** → Your data (`privacy`), the center at the top (built) | **Extend** | `components/TrustCenter.tsx`; `lib/workspace-backup.ts` (device scope, eleven stores), `workspace-backup.coverage.test.ts` |
| O | Visual polish | — (always on, per-commit revert) | Everywhere | — | [DESIGN-SYSTEM-IMPROVEMENTS.md §3](DESIGN-SYSTEM-IMPROVEMENTS.md#3-problems-to-fix) |

All 14 named flags plus the proposed `today_action_center` are added to
`lib/experience-flags.ts` in Phase B, all `off` by default (D-012). Later modules
(`crunch_week_forecast`, `course_studio`, `offline_engine_tasks`) were added the
same way, each `off` until its own variable is set. The
env vars are `VITE_` + the name in upper case, for example
`VITE_REGISTRATION_DAY_MODE`.

---

## Per phase: what is new versus already there

### B · Today + Action Center

Full file list: [UX-ENHANCEMENT-PLAN.md §5](UX-ENHANCEMENT-PLAN.md#5-phase-b--exact-files-awaiting-confirmation).

- **Already there:**
  - Path snapshot with three states and no invented denominator.
  - One Next Best Step with "Why am I seeing this?".
  - Next 72 hours and a sync line.
- **New:**
  - Persistent snooze, dismiss and correct, plus history (`semester.actions.v1`).
  - The full seven-part explanation.
  - Done-for-today.
  - Quick actions.
  - Desktop context pane.
  - Time-first labels.
  - ≤1 urgent card.
  - Removal of the duplicate `NextClassCard` in the `feed` nav.
- **Source labels:**
  - Path figures are `student_entered`.
  - Course dates are `imported` when a syllabus was imported and confirmed,
    otherwise `needs_review`. `item.checked?.confirmed` already carries this.

### C · Registration Day Mode

**Already there (#762):**

- Countdown to the student-entered time ticket.
- Up to five ranked, clash-free backups per cart section.
- Checklist and readiness count.
- Copyable section list.
- "Never registers anybody".
- Seat counts are labelled as imported.

**New:**

- **Contextual activation on Today.** The mode activates within N days of
  `opensAt`, or manually for a pilot or demo. Activation needs a stored
  "manual on".
- **An official-system deep-link placeholder.** It uses `ConfirmDialog`
  `external`. The URL comes from school data (`docs/SCHOOL_DATA_PACK.md`), and
  the placeholder says so when there is none.
- **Reminder settings that respect quiet hours.** They reuse the reminder
  rules in `lib/reach.ts`.
- **Seat-watch UI.** It is labelled `estimated` / "Demo" unless an approved
  seat feed exists (D-007). `seat_watches` exists, but with no feed.
- **Checklist items.** `CHECKLIST` (`registration-day.ts:66+`) has `holds`,
  `advisor` ("Met my advisor or have my registration PIN"), `prereqs`,
  `portal` and `copied`. The command also names:
  - schedule reviewed;
  - credit target checked;
  - backup courses saved;
  - advisor *question* saved.

  The last three can be **derived** from state (no clashes; cart credits
  within target; every cart section has at least one backup; an agenda
  question exists) rather than ticked. That is more honest than a checkbox.
  Existing `checks` ids are unchanged.

**Conflict.** `TicketSource` is `'student_entered' | 'imported'`. It widens to
`SourceLabel` in Phase B with no stored-shape change, because both existing
values are members.

### D · Graduation Simulator + Cost Planner

**Already there:**

- Term-by-term projection.
- Six presets (the brief's seven questions map onto them; one to check is
  "change majors").
- Editable scenarios and cost of one more semester.
- Advisor summary.
- Every figure is labelled an estimate.

**New:**

- Scenario Comparison Card (side by side at 760px and above).
- Prerequisite-sequence impact, which needs prerequisite data. That is
  `student_entered` per D-004, or `imported` from a catalog carrying it.
- A cost input model with separate student-entered and institution-published
  inputs.
- Save a draft to `graduation_scenarios` when signed in.
- Share with advisor, which waits on Phase G grants.

**Hard rules:**

- `graduation_scenarios.source_label` is limited to `estimated` or
  `needs_review` by a check constraint. Keep it that way.
- Never guarantee, never determine aid, never present an official bill.

### E · Academic Life Balance + Crunch Week Forecast

**Already there:**

- `lib/clash.ts` finds deadline pile-ups 14 days out and words them ("In N
  days").
- `lib/runway.ts` counts back four weeks from exams.
- `conflicts()` handles course × course overlaps.

**New:**

- Time categories: class, work, commute, study, personal, athletics, open.
- Personal and work blocks. This is BL-1.7: extend `conflicts()`.
- The week-density view.
- Consecutive-commitment runs.
- Open study blocks.
- Extending the forecast window from 14 to 21 days.
- Suggested earlier study blocks. They are **never auto-placed**: writing to
  the calendar goes through `ConfirmDialog` with a preview of the events.

**Hard rules:**

- No burnout, wellbeing or "overloaded" language.
- Density is described in hours and counts only.

### F · Course Detail V2

**Already there:** `CourseHub`, with Overview, Assignments, Study tools,
Readings and Syllabus. That is the **Course Companion** for *enrolled*
courses.

**New:** a *decision* view for courses that are **not yet taken**:

- search result and cart item;
- the Course Detail Card, opening as a drawer or sheet;
- requirement fit (D-004, student entered);
- schedule fit via `conflicts()`;
- plan impact;
- official catalog link.

**Placeholders only:**

- moderated student insights, which sit on `course_reviews`. Its authorship
  is already separated;
- faculty study pack;
- syllabus links.

**Excluded:** no professor ratings and no workload claims.

### G · Advisor Meeting Mode

**Conflict (D-016).** BL-1.9 in the Phase 0 backlog says "export only after a
full preview and explicit confirm; **no link-sharing**". This command asks for
a view-only link *or* an authorized advisor share, with expiry and
revocation.

**Recommendation:**

- Ship the agenda and the confirmed export/print first.
- Add *authorized* advisor shares as a new `advisor_shares` table. This is
  S-8 in SECURITY-GAP-ANALYSIS. It is modelled on `accommodation_shares`:
  - `expires_at` is required and term-bounded;
  - a `revoked_at` column;
  - an access-events table the student can see;
  - a `SECURITY DEFINER` reader that returns only shared fields.
- **No anonymous bearer links in the pilot.**

A production migration needs approval.

**What the advisor sees:** only the shared agenda, plan, scenario, alternatives
and permitted action items. Never study history, health, finance, supporter
data or notes.

### H · Study Readiness + Source Locker

**Study Readiness**

- **Already there:**
  - `standing.ts` / `Standing.tsx` state the app's refusal to score mastery.
  - `state.reviews` holds spaced-review due dates.
  - `runway.ts`.
- **New:**
  - per-topic Reviewed / Practicing / Needs review, which the student sets;
  - self-rated confidence;
  - a "practice outcome" shown as *what happened*, never a grade prediction;
  - one short session suggestion.

**Source Locker**

- **Already there:**
  - `lib/sources.ts` (citations);
  - `studysources.ts` (course materials for study);
  - `Disclosure.tsx` (provenance on AI output);
  - `sourcebytes.ts`.
- **New:**
  - source → generated-asset relationships;
  - "used by" lists;
  - remove a source and delete its dependants, via `TypeToConfirm` with the
    dependants listed;
  - a per-source AI-use toggle.

**Needs:** a relationship model in `lib/` (device-first), with no synced-state
change unless it is approved.

### I · Career Evidence + resume bullets

- **Already there:**
  - `career.ts` / `Career.tsx`: openings, what you've done, contacts, résumé.
  - `skills-graph.ts` behind `careerSkillsGraph`.
  - The `skill_records` table.
- **New:**
  - suggested skills that the student accepts, edits or rejects;
  - artifact capture;
  - the bullet builder with its three metric prompts;
  - résumé versions;
  - application tracker;
  - interview and career-fair action cards.

**Hard rules:**

- Every bullet is built only from text the student typed.
- A test asserts that the builder never introduces a number, employer or
  tool that is absent from the input.
- No auto-apply.

### J · Campus Office Action Feed

**Already there:**

- `institution_actions`, with publish and withdraw limited to
  `publisher_scope_kind`/`_id` by capability, and tenant-scoped cohorts.
- `Registrar.tsx` term deadlines.

**Resolved in Phase J** by `20260928302000_office_action_feed.sql` (D-048); see [OFFICE-ACTION-FEED.md](OFFICE-ACTION-FEED.md). The gaps as first recorded:


- `official_url` is **nullable**, but the command requires it.
- There is **no `source_label` or `published_at`/`updated_at`** column for the
  "Institution verified · Updated today" line.
- There is **no moderation state** (draft → review → published).
- `target_student` lets an office target one student directly. The command
  scopes by tenant, cohort, office, program or student-selected eligibility.
  Keep it, but document that an office still gains **no read access** to
  that student's plan.
- The aggregate completion view needs n ≥ 10. Mirror
  `course_demand_snapshots`' check.

### K · Course Demand Forecasting

**Already there:**

- A per-row opt-in, `term_plan_courses.contributes_to_demand`, which defaults
  to false.
- `course_demand_snapshots.planned_students >= 10`, enforced by a check
  constraint.
- `demand:read` limited to registrar, department chair, dean and
  institutional researcher.

**Built in Phase K** — see [COURSE-DEMAND-FORECASTING.md](COURSE-DEMAND-FORECASTING.md) (D-051). As first planned:

**New:**

- consent UI with prospective revocation;
- the snapshot refresh job scaffold (not scheduled in production);
- scoped staff views in `university`;
- the source line "Based on anonymized planning data from students who chose
  to contribute".

**Test:** no query path returns a row below 10, or any user id.

### L · Semester Wrapped

- **Already there:**
  - `Reports.tsx` (`brief`);
  - `lib/usage.ts`, which holds per-screen counts **on device only**;
  - `state.done`.
- **New:**
  - a private recap made from student-owned action history (Phase B's store)
    and study data;
  - export only through `ConfirmDialog`, as a client-side image or file.

**Conflict:** rule 7 and D-005. The recap counts *outcomes the student chose*
(plans made, conflicts resolved), never app usage as achievement. There are no
streaks and no leaderboard.

### M · Offline Mode

- **Already there:**
  - `public/sw.js`: network-first shell, cache-first audio, decks and
    handouts, with a `MEDIA_CAP`;
  - `lib/offline.ts`, which believes `navigator.onLine` in one direction only;
  - IndexedDB `semester-store` with the `semester.v1` rollback copy;
  - offline copy in `ScreenTrouble`.
- **New:**
  - an "Offline mode" badge and last-sync time (`FreshnessBadge`);
  - a queue for safe local writes and sync on reconnect, with a stated
    conflict strategy that reuses `lib/merge.ts`'s per-field policy;
  - high-risk actions refused offline: share, export, deletion, official
    handoff;
  - imported data shown as **"as of {time}"**, never as current.

**Warning:** the service worker has its own tests. Any strategy change needs
`VERSION` bumped and a rollback note (`ROLLBACK.md`).

### N · Trust Center

- **Already there:**
  - Privacy claims as data, the screen-open counter toggle, diagnostics
    export, `SupportAccess` (consented support grants, #759/#760), delete
    account and erase device (`TypeToConfirm`);
  - `ai_memories` and `data_requests` tables.
- **New:**
  - a Data Privacy Panel listing sources, scopes and last sync;
  - active shares (Phase G) and support grants in one place;
  - AI source controls;
  - a "What Semester remembers" editor on `ai_memories`;
  - AI history and delete.

**N-3, a gap found in this audit (resolved in Phase N, D-057):** `lib/workspace-backup.ts` covers creations,
athletics, career, university drafts, family and pathway. It does **not**
cover these device-only stores:

- `semester.registration-day.v1`
- `semester.graduation.v1`

So Export omits a student's registration-day plan and scenarios. Erase does
remove them, because `lib/erase.ts` empties all of `localStorage`. The fix is
Phase N, or Phase C/D if either touches those stores first. It adds both
prefixes and a test that every `useDeviceLibrary` key is backed up.

---

## Conflicts raised by this command

These are logged in [DECISION-LOG.md](DECISION-LOG.md). Where a conflict
exists, the existing decision holds until the owner decides.

| Item | Command says | Main says | Log |
|---|---|---|---|
| Navigation | Exactly five primary destinations | Eight shelves, six nav modes, a default five-tab bar with different members | D-003 (**approved**: five as the primary tab bar behind `journeyNavigation`, shelves beneath; BL-1.13) |
| Flags | 14 named flags | 6 env-driven flags that default to `preview` in institutional preview | D-012 |
| Today polish flag | not named | — | D-013 |
| Analytics | Event definitions per feature | Three server marks by check constraint | D-005 (**approved**: definitions and on-device counts now; each server mark lands with its `ANALYTICS.md` question and migration) |
| Advisor share links | View-only link or authorized share | BL-1.9 says no link sharing; no `advisor_shares` table (S-8) | D-016 |
| Banned words | Never "behind" | Screen `behind` is labelled "When you are behind" (`nav.ts:571`) | D-015 |
| Branches | `feature/*` → PR into `semester-unified-platform` | This session can push only its designated branch | D-017 |

## Regression-sensitive surfaces added by these phases

These add to the list in
[ROUTE-AND-FEATURE-CROSSWALK.md](ROUTE-AND-FEATURE-CROSSWALK.md#regression-sensitive-routes):

- `lib/clash.test.ts` and `lib/runway.test.ts` (Phase E).
- `lib/offline.test.ts` and the service-worker tests (Phase M).
- `lib/career.test.ts` and `lib/skills-graph.test.ts` (Phase I).
- `supabase/expansion.check.sql`, which any Phase G, J or K migration must
  extend, plus the Phase J/K policies.
- `lib/workspace-backup` tests (Phase N).
