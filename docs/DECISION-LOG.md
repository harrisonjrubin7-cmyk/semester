# Decision log — Semester unified platform

Running log for the unified-platform programme. Settled, long-lived product
decisions stay in [`/DECISIONS.md`](../DECISIONS.md); architecture decisions in
[`docs/architecture/`](architecture/README.md). This file records the
programme's own decisions and every **conflict between the new briefs and a
decision already on main**. Where they conflict, the existing decision holds
until the owner (Harrison Rubin) reopens it here.

Status values: **Decided** · **Proposed — needs owner** · **Superseded**.

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

**Proposed — needs owner.** The blueprint mandates five primary destinations
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

**Proposed — needs owner.** `ANALYTICS.md` limits collection to three marks
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

**Proposed — needs owner.** The app is a hash-routed SPA on GitHub Pages
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
