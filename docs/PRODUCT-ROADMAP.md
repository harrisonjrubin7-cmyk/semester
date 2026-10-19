# Product roadmap — Semester unified platform

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Baseline: `origin/main` at `c029822` (26 September 2026). Governing inputs: the
*Unified Product, Company, and Implementation Blueprint* (uploaded .docx, 27
September 2026) and `docs/expansion/Semester-Master-Implementation-Brief-v2.md`.
Where either conflicts with a decision already recorded in `DECISIONS.md`,
`docs/architecture/` or `docs/expansion/ROUTE-AND-FEATURE-CROSSWALK.md`, the
conflict is listed in [DECISION-LOG.md](DECISION-LOG.md) and **the existing
decision holds until the owner reopens it**.

This roadmap sequences work. It does not restate what exists — see
[AUDIT.md](AUDIT.md) — or where it goes — see
[ROUTE-AND-FEATURE-CROSSWALK.md](ROUTE-AND-FEATURE-CROSSWALK.md).

## North star

**Weekly Path Progressed Students**: students completing at least one
meaningful planning, study, support or career action in a week. Core survey
item: *"I understand what I need to do next."* Engagement counts (logins, card
opens) are adoption signals only and are never reported as outcomes.

## Phases

| Phase | Goal | Exit gate (all must hold) | Approval needed before |
|---|---|---|---|
| **0 · Audit** | One source of truth; every gap named | These nine docs merged; gate results recorded | — |
| **1 · Registration & Path pilot** | A student can go from sign-up to an advisor agenda in one sitting | Sprint-1 acceptance tests green; RLS checks for any new table; axe/keyboard pass on the flow; feature flag off by default in production | Any production migration |
| **2 · Public site & membership** | The front door and the account door | Every public route prerenders with metadata; membership UI has no live billing; export/deletion reachable without a plan | Real billing, domain purchase |
| **3 · Study Studio & Workspace** | Source-grounded study assets | No AI output without a source anchor; extraction review screen before indexing; academic-integrity policy honoured | Enabling a live model for new surfaces |
| **4 · Career & campus modules** | Contextual modules inside the five destinations | No new top-level destination; each module behind a flag | — |
| **5 · Institution foundation** | Tenancy, roles, flags, governance | Tenant isolation checks for every new table; aggregates keep n ≥ 10 | Any real institution connection |
| **6 · Integration readiness** | Read-only adapters, idempotent inbox | Webhook replay/idempotency tests; no adapter enabled without agreement | Any credential or data agreement |
| **7 · Production readiness** | Evidence, not assertion | The eight Phase 7 docs; restore rehearsed; incident runbook exercised | Production deploy |
| **8 · Pilot preparation** | Materials for a 25–100 student cohort | Guides, surveys, outcomes template reviewed by a human | Sending any communication |

## Phase 1 ordering (vertical slices)

From the blueprint §18.5 — Today → Path → Registration → Search → Advisor agenda
→ analytics/feedback — adjusted for what already exists (see
[SPRINT-1-REGISTRATION-PATH.md](SPRINT-1-REGISTRATION-PATH.md)):

1. **Source labels + canonical Action model** (shared foundation; everything
   else renders them).
2. **Action Center on the existing Today** (`home`) — extends
   `lib/today-decision.ts`, does not add a second Today.
3. **Path Snapshot** on `degree`, fed by the Scenarios work that landed in #762.
4. **Registration readiness** on `yes` — extends Registration day (#762).
5. **Advisor Meeting Mode** — agenda + view-only export with preview/confirm.
6. **Feedback + analytics event definitions**.
7. **Onboarding/profile gaps** — only what the audit shows is missing.

## Feature expansion (Phases A–P)

The feature-expansion command of 27 Sep 2026 adds fourteen flagged modules. It
does not replace Phases 0–8 above; its modules are mapped onto them in
[FEATURE-EXPANSION-CROSSWALK.md](FEATURE-EXPANSION-CROSSWALK.md). Several of
them already exist in part on main (#761, #762).

| Phase | Module | Status |
|---|---|---|
| A | Design and UX audit: [UX-ENHANCEMENT-PLAN.md](UX-ENHANCEMENT-PLAN.md), [DESIGN-SYSTEM-IMPROVEMENTS.md](DESIGN-SYSTEM-IMPROVEMENTS.md), crosswalk | **Done**, docs only (D-014) |
| B | Today + Action Center: [TODAY-ACTION-CENTER.md](TODAY-ACTION-CENTER.md) | **Built** as an increment on BL-1.4, behind `today_action_center` (off); the H-2 fix is always on. Draft PR (D-021) |
| C | Registration Day Mode (extends #762): [REGISTRATION-DAY-MODE.md](REGISTRATION-DAY-MODE.md) | **Built** behind `registration_day_mode` (off). Draft PR, stacked on Phase B |
| D | Graduation Simulator + Cost Planner (extends #762): [GRADUATION-AND-COST-SIMULATOR.md](GRADUATION-AND-COST-SIMULATOR.md) | **Built** behind `graduation_simulator` and `cost_planner` (off). Carries one additive migration, not applied (D-025). Draft PR, stacked on Phase C |
| E | Academic Life Balance + Crunch Week (extends `lib/clash.ts`) | Queued |
| F | Course Detail V2 | Queued |
| G | Advisor Meeting Mode | Queued; sharing model is D-016 |
| H | Study Readiness + Source Locker | Queued |
| I | Career Evidence | Queued |
| J | Office Action Feed: [OFFICE-ACTION-FEED.md](OFFICE-ACTION-FEED.md) | **Built** behind `office_action_feed` (off). Its migration awaits owner approval (D-048). Draft PR |
| K | Course Demand Forecasting: [COURSE-DEMAND-FORECASTING.md](COURSE-DEMAND-FORECASTING.md) | **Built** behind `demand_forecasting` (off). Its migration awaits owner approval (D-051). Draft PR |
| L | Semester Wrapped: [SEMESTER-WRAPPED.md](SEMESTER-WRAPPED.md) | **Built** behind `semester_wrapped` (off), no server change. Draft PR |
| M | Offline Mode: [OFFLINE-MODE.md](OFFLINE-MODE.md) | **Built** behind `offline_mode` (off), with no server or service-worker change. Draft PR |
| N | Trust Center: [TRUST-CENTER.md](TRUST-CENTER.md) | **Built** behind `trust_center` (off); Export covers every device store (D-018 fixed). Draft PR |
| O | Visual polish (DS-1…DS-8) | Queued |
| P | Docs, tests, PRs per phase | Continuous |

## What this roadmap deliberately does not do

- No second navigation model. The five-destination IA is reached by
  re-labelling and re-grouping `lib/nav.ts`, decided in DECISION-LOG D-003, not
  by building parallel screens.
- No new LMS/SIS adapters outside Vanderbilt's systems until the Stage 4 gate
  (`DECISIONS.md` §1).
- No official degree audit, auto-registration, payment processing, health
  records, emergency workflows, or hidden risk scoring in any phase.
- No claim of outcomes impact without a privacy-governed evaluation.
