# Claude Code backlog — unified platform

Ordered, PR-sized items. Each one follows the rules in `/CLAUDE.md`: check
`origin/main` for the thing first, run the five gates from `app/`, and show a
new guard red against a revert. Items marked **Blocked** wait on an owner
decision in [DECISION-LOG.md](DECISION-LOG.md). Size: S < ½ day, M ≈ 1–2
days, L > 2 days.

Items already tracked in
[`docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md`](market-readiness/TODAY_ADAPTIVE_BACKLOG.md)
are referenced as TAB-n rather than duplicated.

## Phase 0 follow-ups

| ID | Item | Size | Notes |
|---|---|---|---|
| BL-0.1 | Refresh `REGRESSION-CHECKLIST.md` counts | S | It says 72 Screen members (81 now), 4 NavModes (6 now), 7 shelves (8 now) and a test floor of 11,197 (12,805 now). It also disagrees with CLAUDE.md and ci.yml on which gates must pass |
| BL-0.2 | Update ADR 0003/0004 status | S | The serverless institution gateway (#750) and governed OpenAI runtime (`c3e6fc5`) postdate them |
| BL-0.3 | Mark superseded root plans | S | Add a one-line "superseded by docs/AUDIT.md §Documents" banner to the stale plans listed there. Delete nothing |
| BL-0.4 | Bring lint below the 25-warning ceiling | M | Six of the 25 warnings are in `screens/Sheet.tsx` |
| BL-0.5 | Update CHANGELOG for #749–#762 | S | Nothing after 22 Sep is recorded |

## Phase 1 — Registration & Path pilot (order matters)

| ID | Item | Size | Depends | Notes |
|---|---|---|---|---|
| BL-1.0 | **Clamp the AI gateway (S-1)** | M | — | Model allowlist, `max_tokens` clamp, field strip, cost estimate. Security, so first |
| BL-1.1 | `SourceLabel` type + `SourceBadge` + freshness line | S | — | Five values matching the DB enum; replace `TicketSource`; axe + label tests |
| BL-1.2 | `lib/actions.ts` canonical Action model | M | 1.1 | Pure: lifecycle transitions (invalid ones refused), history, priority/ranking (urgency + impact + actionability + confidence − fatigue), explanation shape. Unit tests with revert checks |
| BL-1.3 | Action store `semester.actions.v1` | S | 1.2 | Device library pattern. Store only student choices; derived actions are recomputed |
| BL-1.4 | Action Center on Today | M | 1.3 | Extends `TodayDecisionSurface`: Most Important + ≤3 Next (was ≤5; see EXPERIENCE-CONTINUITY.md §2), snooze/dismiss/correct/ask-for-help without swipe (TAB compact items). Explanation via `intelligence/Disclosure` |
| BL-1.5 | Path profile step in onboarding | M | 1.1 | Optional program / target term / credit target / goals; `semester.path-profile.v1` |
| BL-1.6 | Path Snapshot on My Path (`degree`) | M | 1.5 | Complete/planned/remaining against the student's own total; "planning estimate, not official degree clearance" |
| BL-1.7 | Personal/work/study blocks vs course meetings | M | — | Extends `lib/registration.ts` `conflicts()` |
| BL-1.8 | Registration readiness as a grouped action workflow | S | 1.4 | From `registration-day.ts` `CHECKLIST` |
| BL-1.9 | Advisor Meeting Mode | M | 1.6 | `lib/agenda.ts`; agenda + questions + plan snapshot; export only after a full preview and explicit confirm; no link-sharing |
| BL-1.10 | Clarity question + report-incorrect from any source label | S | 1.1 | Signed-out fallback |
| BL-1.11 | Analytics event definitions (docs only) | S | — | D-005 approved: definitions + on-device counts; each server mark ships with its `ANALYTICS.md` question |
| BL-1.12 | Pilot flow E2E (390 px and 1280 px) | M | all | Playwright, per Sprint-1 acceptance item 1 |
| BL-1.13 | Five-destination tab labels | M | — | D-003 approved |
| BL-1.14 | Auth settings into `config.toml` `[auth]` (S-7) | S | — | Review only; applying them is a production change |

## Phase 2 — Public site & membership

| ID | Item | Size | Notes |
|---|---|---|---|
| BL-2.1 | `site/` prerendered entry + shared tokens | L | D-011 approved |
| BL-2.2 | Home, Product, Students, Institutions, About, Careers, Contact | L | Careers contact: harrisonjrubin7@gmail.com |
| BL-2.3 | Pricing (Free / Plus / Pro / Institution Access) | M | No checkout (D-009) |
| BL-2.4 | Public tools reusing pure libs | M | `graduation.ts`, `registration.ts`, `registration-day.ts` |
| BL-2.5 | Trust Center pages | M | From `SECURITY.md`, the privacy screen, and the a11y guards |
| BL-2.6 | Membership screen under `account` | M | Plan, placeholders, export, deletion |
| BL-2.7 | Server-side account erasure (S-2) | M | Needs approval to deploy the function |

## Phase 3–6 (epics; split when reached)

- **P3** Study Studio: extraction review screen; anchors; the 11 existing modes
  vs the brief's 14 (decide Merge/Invest per mode); self-quiz feedback
  controls; Writing Studio; Math & Data Lab (extend `analyse`, `equations`);
  storage-policy rule (S-13).
- **P4** Career / Campus / Study Abroad / Athlete / Supporter / Faculty /
  Advisor workspaces: UI on the #762 tables (E3–E9 in the expansion
  crosswalk), each behind a flag, with no new top-level destination.
  `advisor_shares` table (S-8) before any advisor access.
- **P5** Tenant flags by cohort/role on `tenant_feature_policy`; tenant-scope
  `data_request:handle` (S-9); domains from `schools.email_domains` (S-11).
- **P6** Adapter interfaces and an idempotent `integration_events` inbox.
  Working adapters only for Brightspace (D-007).

## Phase 7–8

Covered by the documents the brief lists. The evidence gaps to close are
S-3, S-5, S-6, S-10, S-12, S-14, S-15 and S-16 in
[SECURITY-GAP-ANALYSIS.md](SECURITY-GAP-ANALYSIS.md).

## Modernization blueprint (28 Sep) — what the crosswalk left open

From [MODERNIZATION-BLUEPRINT.md](MODERNIZATION-BLUEPRINT.md), in the
blueprint's own order, each scored against its decision rule (at least two of
ten). Items marked **Held** wait on the decision named in D-108.

| ID | Item | Size | Blueprint | Notes |
|---|---|---|---|---|
| BL-M.1 | Make the five destinations the production default | M | FE-01, BP-01 | D-003 approved. Add a `search` destination to `lib/nav.ts`; decide `journeyNavigation` default vs `DEFAULT_TABS`; fix D-003's `DEFAULT_TABS` text |
| BL-M.2 | ContextHeader with a privacy-scope slot on the five destinations | M | BP-01, FE-03 | Extend `components/unity/ContextBar.tsx` with `Visibility`; place on Today, Degree, Search, Calendar, Me |
| BL-M.3 | One trust vocabulary (DD-003) | M | FE-03 | `SourceBadge` through `statusOf`, or one mapping table; `decisionlabels.test.ts` |
| BL-M.4 | A no-access state component and a coverage test for the shared states | S | FE-05 | `unity/States.tsx`; a structural test like `pageframe.test.ts` |
| BL-M.5 | Enforce the release gate: every `VITE_*` in `experience-flags.ts` in `FEATURE-FLAG-REGISTRY.md` with owner, rollback, help route | S | §3.2 gate | 17 module flags and 6 experience flags have no registry row; extend `flags.test.ts` |
| BL-M.6 | 320px reflow on every screen, not six journeys | M | FE-06, FE-07 | `scripts/accessibility-smoke.mjs` JOURNEYS; fix the stale line in WCAG-UI-AUDIT-SCORECARD.md |
| BL-M.7 | Action Center controls: Share, View source, Compare options; a Controls section in the sheet | M | BP-02, FE-09 | `components/ActionCenter.tsx`, `ExplanationSheet.tsx`; `ActionSource` gains a URL or record id |
| BL-M.8 | "Since you were here" covers plan, path and source changes | S | BP-02 | `lib/since.ts` |
| BL-M.9 | An app-wide `UNCALM` wording guard over student-facing copy | S | BP-02 | Today only today; the `behind` label is a D-108 decision, not this item |
| BL-M.10 | A shared `DecisionPacket` model with adapters from the five moments | L | BP-03 | context, sources, assumptions, options, next actions, handoff, share scope, expiry, audit; generalise `advisor-shares.ts` |
| BL-M.11 | Ask honours the source locker's exclusions; source tray before sending; Plan and Execute modes | M | BP-04, FE-13 | `ai/assemble.ts`, `ai/Opening.tsx`, `intelligence/contracts.ts` |
| BL-M.12 | Source label, authority and freshness on search results | S | FE-15 | `lib/find.ts` `Hit`; `screens/Search.tsx`, `components/Command.tsx` |
| BL-M.13 | First-year, athlete and study-abroad pathways, and a pathway that shapes Today | M | FE-26 | `lib/learner-pathways.ts` |
| BL-M.14 | Inbound webhook receiver: HMAC, timestamp window, replay check | M | BP-06, INT-013 | New `supabase/functions/integration-webhook`; the HMAC pattern is in `_shared/escalation.ts`; a case in `integration-hardening.check.sql` |
| BL-M.15 | Automatic circuit breaker per connection | M | BP-06 | `app/server/integration/worker.ts`; breaker columns on `integration_connections` (migration, owner approval) |
| BL-M.16 | Lineage columns: `access_policy`, `conflict_rule`, `official_fallback_url`, `synced_at`; refresh FIELD-LINEAGE's "nothing built" line | M | BP-07 | Migration needs owner approval |
| BL-M.17 | A uniform `policy_versions` record across the ten policy kinds | L | BP-08 | Immutability trigger as in `20260928004730_tenant_plan.sql` |
| BL-M.18 | MFA (aal2) for privileged capabilities; two-person, time-limited break-glass | L | BP-09, IAM-005, OC-03 | `private.has_capability`; a `break_glass_request` table; suites |
| BL-M.19 | Launch Center read-only view of `tenant_rollout` and the phases, named Discover → Expand | M | BP-11, CO-03, FE-22 | `components/institutional/LaunchCenter.tsx` under `University.tsx`; map `governance/rollout.ts` PHASES to the ten steps |
| BL-M.20 | Evidence freshness: `last_verified`/`review_by` on HECVAT and subprocessor rows; a test that fails past the date; create `docs/evidence/` | S | CO-01 | `lib/hecvat-readiness.test.ts`, `lib/trust/subprocessors.ts` |
| BL-M.21 | Public trust pages: Student Data Bill of Rights, the no-surveillance pledge (drafted in TRUST-BRAND-AND-LEGAL.md), AI governance, a link to the status page | M | CO-02 | `app/src/site/pages.tsx`, `site.test.tsx` |
| BL-M.22 | Academic operations modes for the school-side console | M | OC-02, SRE-009 | Needs the academic peak calendar first |
| BL-M.23 | Support-agent queue UI on `support_ticket_queue()` | M | OC-01 | Behind `supportTickets` (off) |
| BL-M.24 | Credential Wallet on `skill_records` verification, with expiring revocable links | L | BP-12, FE-24 | The advisor share model generalised; #904's `CREDENTIAL-WALLET.md` when it lands |
| — | Native gradebook, module builder, batch grading | **Held** | BP-05, FE-16, FE-19 | Faculty Course Studio decision, 27 Sep |
| — | Server-side search index; external audit archive | **Held** | BE-03, BE-04 | ADR 0003, ADR 0006 |
| — | Revenue Operations console | **Held** | OC-01 | D-009 |
