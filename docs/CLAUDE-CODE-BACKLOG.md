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
| BL-1.4 | Action Center on Today | M | 1.3 | Extends `TodayDecisionSurface`: Most Important + ≤5 Next, snooze/dismiss/correct/ask-for-help without swipe (TAB compact items). Explanation via `intelligence/Disclosure` |
| BL-1.5 | Path profile step in onboarding | M | 1.1 | Optional program / target term / credit target / goals; `semester.path-profile.v1` |
| BL-1.6 | Path Snapshot on My Path (`degree`) | M | 1.5 | Complete/planned/remaining against the student's own total; "planning estimate, not official degree clearance" |
| BL-1.7 | Personal/work/study blocks vs course meetings | M | — | Extends `lib/registration.ts` `conflicts()` |
| BL-1.8 | Registration readiness as a grouped action workflow | S | 1.4 | From `registration-day.ts` `CHECKLIST` |
| BL-1.9 | Advisor Meeting Mode | M | 1.6 | `lib/agenda.ts`; agenda + questions + plan snapshot; export only after a full preview and explicit confirm; no link-sharing |
| BL-1.10 | Clarity question + report-incorrect from any source label | S | 1.1 | Signed-out fallback |
| BL-1.11 | Analytics event definitions (docs only) | S | — | **Collection is Blocked on D-005** |
| BL-1.12 | Pilot flow E2E (390 px and 1280 px) | M | all | Playwright, per Sprint-1 acceptance item 1 |
| BL-1.13 | Five-destination tab labels | M | — | **Blocked on D-003** |
| BL-1.14 | Auth settings into `config.toml` `[auth]` (S-7) | S | — | Review only; applying them is a production change |

## Phase 2 — Public site & membership

| ID | Item | Size | Notes |
|---|---|---|---|
| BL-2.1 | `site/` prerendered entry + shared tokens | L | **Blocked on D-011** |
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
