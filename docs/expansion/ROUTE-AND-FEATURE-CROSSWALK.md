# Route and feature crosswalk — Master Implementation Brief v1/v2 against the app

The briefs (`docs/expansion/Semester-Master-Implementation-Brief-v2.md`, and the
v1 PDF it supersedes) describe Semester in product language: *Today, My Path,
Search, Plan, Me*. The app already has a navigation model, `app/src/lib/nav.ts`,
with its own reasons for every shelf. This file maps one onto the other so a
brief item is built **into the screen that already answers that question**,
not beside it.

Read `CLAUDE.md` first. The rule that matters most here: check `origin/main`
for the thing before building it.

## Brief destinations → existing screens

| Brief destination | Existing screens (nav id) | Notes |
|---|---|---|
| Today | `home` (Today), `brief` (Reports), `behind` (When you are behind) | Adaptive decision briefing landed in #761. Don't add a second Today |
| My Path | `degree` (The degree), `yes` (Registration), `registrar` (Term deadlines), `pathway` (Pathway), `applying` | Degree ships no requirements and never will; the brief agrees |
| Search | Global search over `nav.ts` labels, blurbs and keywords | New features add keywords to the entry they live in, not new entries |
| Plan | `calendar`, `activities`, `runway` (Exam runway), `costs` (Money), `meals`, `housing` | |
| Me | `me`, `account`, `profile`, `privacy`, `export`, `connect`, `settings`, `family`, `career` | |

## v2 expansion items → where they live

| Brief item (§28) | Built into | Status in this branch |
|---|---|---|
| Registration Day Mode (§28.1) | `yes` → Search & plan → **Registration day** tab (`components/RegistrationDay.tsx`, `lib/registration-day.ts`) | **Built.** Countdown, ranked backups (≤5, other sections first, clash-free), checklist, readiness, copy/download section list. Stored on the device under `semester.registration-day.v1`, beside the existing `semester.registration.v1` whose shape is unchanged |
| Graduation simulator + cost of delay (§28.2) | `degree` → **Scenarios** tab (`components/GraduationSimulator.tsx`, `lib/graduation.ts`) | **Built.** Term-by-term projection, summers only when taken, six presets, editable scenarios, advisor summary. Hours finished come from the Taken tab. Stored under `semester.graduation.v1` |
| Money planner (§28.3) | `costs` (Money) | Already covers the bill and spending. Cost-per-term from Money into Scenarios is a follow-up |
| Transfer credit tool (§28.4) | `degree` / `pathway` | DB ready (`articulation_rules`, `transfer_evaluations`). UI is E3 |
| Course reviews (§28.5) | Course detail in `yes` catalog | DB ready. UI is E7 |
| Crunch-week forecast (§28.6) | `calendar` / `lib/weekpage.ts` already flags heavy weeks | Check `weekpage.ts` before building anything |
| Accommodations passport (§28.7) | `me` | DB ready. UI is E8 |
| AI memory, check-ins, voice (§28.8) | `ask` and the Intelligence modules | DB ready (`ai_memories`, `weekly_checkins`). UI is E6 |
| Widgets, SMS, offline, Wrapped, study matching (§28.9) | `notifs`, `classmates` | Push already exists (`push_queue`). SMS needs a server sender (E6) |
| Skills, talent pool, opportunities, alumni (§28.10) | `career` | DB ready. UI is E9 |
| Demand forecasting, outcomes, office actions (§28.11) | `university` (institution-facing) | DB ready. UI is E4/E5 |

## Database

`supabase/migrations/20260926150000_expansion_roles_and_features.sql` adds the
27 roles, 19 capabilities, 37 matrix rows and 30 tables in brief §29–30, all in
the existing `app_roles` / `role_capabilities` / `role_grants` model.
`supabase/expansion.check.sql` walks each permission as the account it is
about (64 checks).

**The client does not write any of the new tables yet.** Both features built
in this branch are device-first, like the registration workspace they extend.
When a client module starts writing one of them, it must be added to
`OWNED_TABLES` in `app/src/lib/cloud.ts` in the same change (brief §31.2).

## Not in this branch, deliberately

Sprints E3–E10. Each one needs its own branch, preview deployment and review,
because each opens a surface to a new role. Brief §32 has the order and the
definition of done for each.
