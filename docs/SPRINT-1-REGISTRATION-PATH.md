# Sprint 1 — Registration & Path pilot

Baseline `origin/main` `c029822`. Scope from the blueprint §17 and Phase 1 of
the execution brief. The goal:

> A student can create an account, complete onboarding, see a transparent Path
> Snapshot, create a basic term plan, identify schedule conflicts, save backup
> courses, see one explainable Next Best Step, create an advisor meeting
> agenda, submit feedback, and safely return later.

**Most of this exists.** Items already tracked in
[`docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md`](market-readiness/TODAY_ADAPTIVE_BACKLOG.md)
are ticked there, not re-listed here. The sprint is mostly gap-filling and joining things
up, not a rebuild. Each row below says what the audit found on main, with
paths, and what is left.

## Requirement → existing → gap

| # | Requirement | On main today | Gap for Sprint 1 | Decision |
|---|---|---|---|---|
| A | Sign-in / sign-up, verification, recovery | Supabase auth via `app/src/lib/cloud.ts`; account screen `screens/Account.tsx`; app is fully usable signed-out (local-first, ADR 0001) | Confirm recovery flow is reachable from the pilot route; no new auth provider | Preserve |
| A | Onboarding: school, program, target term, credits, goals | `screens/Onboarding.tsx` (5 steps: intro, syllabus, study times, optional account, reminders; `ONB_STEPS` in `data/misc.ts`); `screens/Profile.tsx` + `lib/profile.ts` (name, account, school, role); `onboarding_progress` table (#762, unused by the client) | Program, target term, credit target and goals are collected nowhere. Add them as an optional step. Never require them, and never invent a credit denominator | Extend |
| A | Protected routes | Role gating in `lib/role.ts`; institution surfaces behind `lib/experience-flags.ts` | None for a student-only pilot | Preserve |
| B | Canonical Action entity + lifecycle (open → … → cancelled) | No canonical action. `lib/today-decision.ts` picks one `TodayDecision`; snooze exists only in `lib/mailbox.ts`; `institution_actions` table exists (#762) for institution-sent actions | **New**: `lib/actions.ts` — pure model, lifecycle, history, priority, source + freshness; device store `semester.actions.v1` | Invest |
| B | Most Important + up to three Next; snooze/dismiss/correct/help | One decision surface in `components/TodayDecisionSurface.tsx` | Render the ranked list; controls write lifecycle events | Extend |
| B | Explanation sheet (why, sources, impact, limits, alternatives) | `intelligence/Disclosure.tsx` pattern exists | Reuse Disclosure for action explanations | Extend |
| C | Today: mobile briefing / desktop workspace | `home` + `TodayDecisionSurface` (#761), `components/StartToday.tsx` | Add Action Center + Path Snapshot card; **no second Today** | Extend |
| D | My Path: credits complete/planned/remaining, categories, target term, status (**remaining is only shown against a total the student entered** — `docs/IMPLEMENTATION_STATUS.md` and `TODAY_ADAPTIVE_BACKLOG.md` forbid an invented 120-credit denominator) | `lib/degree.ts` (student-entered requirements, `rollup`), `lib/today-decision.ts` `pathSnapshot()` with `incomplete / review / moving`, `lib/graduation.ts` Scenarios (#762) | Map `moving` → "On track" wording; show planned credits from the term plan; persistent "planning estimate, not official degree clearance" disclaimer | Extend |
| E | Term plan, course search, shortlist, backups | `yes` (Registration) — `components/RegistrationPortal.tsx`, `lib/registration.ts` (catalog import, `conflicts()`), `components/RegistrationDay.tsx` + `lib/registration-day.ts` (≤5 ranked clash-free backups) | Backups and a cart credit total exist (`RegistrationPortal.tsx`) | Preserve |
| E | Weekly schedule with personal/work/study blocks, conflict detection | `lib/registration.ts` `conflicts()` covers course×course; `lib/clash.ts` covers deadline pile-ups | Personal/work/study blocks against course meetings | Extend |
| E | Registration readiness checklist, no enrollment | `lib/registration-day.ts` `CHECKLIST` and readiness count; never registers | Surface readiness as a grouped action workflow | Preserve |
| F | Advisor Meeting Mode: agenda, questions, plan snapshot, view-only export | Graduation Scenarios has an "advisor summary" (#762); no agenda object | **New**: `lib/agenda.ts` + agenda screen inside `degree`/`yes`; export via preview + explicit confirm; no link-sharing until a time-bound share table exists | Invest |
| G | "Did this help you understand what to do next?", report incorrect info, suggest feature | `lib/feedback.ts` kinds include `wrong` and `idea`; `feedback` table + `supabase/feedback.check.sql`. The UI (`components/SaySomething.tsx`) is only reachable from Settings → About and needs an account | Add the one-question clarity prompt on Today. Make "report incorrect information" reachable from any source label. Keep a signed-out fallback to a copyable report | Extend |
| G | Event definitions (activation, path created, plan saved, backup saved, conflict resolved, action completed, agenda created, clarity survey) | `ANALYTICS.md` allows exactly three marks (`opened`, `course`, `studied`), enforced by a check constraint in `20260921151000_activity.sql` | **Definitions only** in Sprint 1; collecting them needs DECISION-LOG D-005 approved and `ANALYTICS.md` amended first | Defer collection |
| H | Persistence | Local-first device store + optional Supabase sync (`lib/cloud.ts` `OWNED_TABLES`) | New device keys versioned `.v1`; any client write to a Supabase table added to `OWNED_TABLES` in the same change | Preserve pattern |
| H | Source labels | Exact five labels exist as a DB check on `term_plan_courses.source_label`; `TicketSource` in `registration-day.ts` | **New**: one shared `SourceLabel` type + `<SourceBadge>` in the client, matching the DB enum | Invest |
| I | Tests | 703 test files on main; structural guards (`rootunmount.test.ts`, `screens.test.ts`, `a11y/*`) | Unit tests per new lib; revert-check each guard; RLS check for any new table | — |

## Acceptance (Sprint 1 is done when)

1. A new student, signed out, can complete onboarding, see a Path Snapshot
   labelled *planning estimate*, add three courses, see one conflict, save one
   backup, and see one Next Best Step with an explanation sheet — in a single
   Playwright run on 390 px and 1280 px widths.
2. Every action card shows a source label and a freshness line.
3. Snooze, dismiss and complete write lifecycle history; reload restores it.
4. Advisor agenda exports only after a preview and explicit confirmation.
5. The clarity question can be answered and dismissed by keyboard alone.
6. `npx tsc -b`, `npm run lint` (≤25 warnings), `npm test`,
   `npm run test:shuffle` and `npm run build` are green from `app/`.
7. Each new guard test has been shown red against a revert of its fix.

## Out of Sprint 1

Live SIS/LMS data, billing, housing/dining/health, parent portal, emergency
features, social, full Study Studio, unrestricted AI agents, institution
analytics — as the brief says.
