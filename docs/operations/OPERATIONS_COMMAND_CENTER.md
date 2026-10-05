# Operations Command Center

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. It reconciles with, and does not replace, [`docs/OPERATIONS-CONSOLE-MAP.md`](../OPERATIONS-CONSOLE-MAP.md) (rendered from `app/src/lib/ops/console.ts`; wins on any disagreement) and the Phase 0 audit in [`docs/ops/`](../ops/OPERATIONS_CONSOLE_CURRENT_STATE.md).

> **Duplicate check.** A console already exists, at `#/console`, with eleven tabs. The brief's "build the Operations Command Center" therefore means *extend that screen*, not create `/app/ops`. Adopted from [`OPERATIONS_CONSOLE_BACKLOG.md`](../ops/OPERATIONS_CONSOLE_BACKLOG.md) B-00: routes stay `#/console/<view>`; the brief's `/app/ops/<name>` paths are documented aliases. A new navigation root needs portfolio approval (`DO-NOT-BUILD` rule 1) and is not requested.

## 1. Purpose

A system of controlled actions and evidence for Semester's operators, not an analytics dashboard. Its three jobs: **see** (one scoped queue of what needs a person, each item with source, freshness, owner, next safe step), **decide** (approvals through the one pattern in [`CONTROLLED_ACTION_PATTERNS.md`](CONTROLLED_ACTION_PATTERNS.md)), **prove** (every action leaves a receipt and a content-free audit event). Green means *the scoped exception queue is empty*, never "no data".

## 2. Route and view map

State is what exists in code today (Console tab list at `Console.tsx`; capability gate `console:operate` at platform scope). Tier is the delivery priority.

| Brief route (`/app/ops/…`) | Console view (`#/console/…`) | State | Tier |
| --- | --- | --- | --- |
| *(index)* Executive Overview | `overview` | Partial: **Command center** tab is a release-gate/exception queue, not an executive overview | P0 |
| `inbox` | `inbox` | **Missing** (no work item entity) | P0 |
| `work` (My Work) | `work` | **Missing** | P0 |
| `approvals` | `approvals` | **Built** (request, decide, act) | P0 (extend executors) |
| `tenants`, `tenants/:id` | `tenants`, `tenants/<id>` | **Missing** (Customers tab lists customers only) | P0 |
| `customers`, `customers/:id` | `customers`, `customers/<id>` | List built; **360 missing** | P0 |
| `pilots`, `implementations` | `pilots`, `implementation` | **Missing** (tables exist) | P0 |
| `customer-health` | `health` | **Missing** (`account_health_snapshots` table only) | P1 |
| `renewals` | `renewals` | **Missing** | P1 (date only in P0 billing) |
| `billing`, `reconciliation` | `billing`, `reconciliation` | **Missing** operator screens (Stripe functions + tables exist) | P0 basic / P1 |
| `support` | `support` | **Built** (flag default off; `support:ticket`) | P0 (turn on after staffing statement) |
| `releases`, `feature-flags`, `rollouts` | `releases` | **Read-only** report; no write path | P0 write path |
| `integrations`, `migrations` | `integrations`, `migrations` | **Missing** in Console (components exist in University) | P0 visibility |
| `security`, `privacy`, `trust` | `security`, `privacy`, `trust` | **Missing** in Console; trust room is a separate screen | P1 (P0 evidence view exists: **Evidence**) |
| `access-reviews` | `access-reviews` | **Missing**; ⊕`access:review` | P1 |
| `break-glass` | `break-glass` | **Built** | — |
| `incidents`, `reliability` | `incidents`, `slo` | **Missing**; no tables | P0 basic / P1 |
| `audit` | `audit` | **Built** (chain status + recent events); explorer missing | P0 (explorer) |
| `risks` | `risks` | **Missing**; registers are docs | P1 |
| `vendors` | `vendors` | **Missing** | P1 |
| `finance`, `forecast` | `finance` | Client-side **Finance model** tab, no DB | P1 |
| `board`, `people` | `board`, `people` | **Missing** | P1 / P2 |
| *(preferences)* | `views` | **Built** (`operator_preference`) | — |

Existing tabs with **no** brief equivalent and kept: **Figures** (the metric contract), **Evidence** (+ StandardsCrosswalk), **Customers**. Gap count matches [`SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md`](../master/SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md): of the brief's 31 sections, 8 exist, 9 partial, 14 missing.

## 3. Context bar (unchanged from the console map)

Environment (word + shape, from the deployment, never a setting), scope (tenant/customer or All), operator (real identity; no preview-as, no impersonation), roles in force (from grants), MFA freshness, session expiry, support access in force. A production write carries *Production change. This will affect a live customer.* Reused as-is on the institution command center.

## 4. The inbox, the one entity everything shares

`private.work_item` (proposed, [`SHARED_CONTROL_PLANE.md`](SHARED_CONTROL_PLANE.md#5-database-rls-and-rpc-plan) row 4) is the only work entity in either operating system. The institution command center, the company inbox and My Work are the same table under different RLS-filtered views, so there is no second queue to reconcile.

| Field | Meaning |
| --- | --- |
| `kind` | `approval`, `support_case`, `exception`, `incident`, `integration_failure`, `release_gate`, `access_review`, `dsr`, `renewal`, `manual` |
| `source_ref` | id of the authoritative row (never a copy of it) |
| `tenant_id` | scope; null only for company-internal items |
| `severity`, `due_at`, `assignee`, `state` | `open → acknowledged → in_progress → resolved/dismissed`; dismissal needs a reason |
| `next_safe_step` | text the producer supplies; required |
| `freshness`, `authority` | from the producing projection; `unknown` allowed |

**Producers** are domain events (approval requested, support severity raised, rollout gate red, integration failure, break-glass review overdue, DSR clock) via the outbox in the same transaction as the cause. An item resolves when its cause resolves; the operator cannot resolve an item whose source is still red. **Optimistic actions** are the allow-list only (acknowledge, assign, note, personal view).

## 5. Read model contracts

All `public.ops_*` read RPCs return the envelope `{data, freshness, authority, warnings, request_id}`, authorise in-body with `console:operate` **and** the domain capability from the permission matrix, distinguish *forbidden* from *empty*, redact via a deny-list, and write a sensitive-read audit event for the classes that need it. Seventeen contracts are named in the brief; none exists by name, and the nearest are `console_command_center`, `console_figures`, `console_audit_read`, `integration_health`, `help_inbox` ([gap register](../master/SEMESTER_GAP_AND_STATUS_REGISTER.md)). Build order: `ops_operations_inbox`, `ops_tenant_overview`, `ops_projection_dashboard`, `ops_executive_overview`, then the rest on demand.

Freshness is a class, not a feeling ([`PROJECTION_AND_CACHE_POLICY.md`](../ops/PROJECTION_AND_CACHE_POLICY.md)): the proposed SLOs await founder confirmation (B-04). The console shows the class and the age of every panel; a stale panel says so and its figures stop counting toward green.

## 6. Tenant 360 and Customer 360

Two views of one tenant record, joined by `customer ↔ tenant`.

- **Tenant 360 (operational):** lifecycle state (pre-contract/pilot/annual/offboarding, reusing `tenant_rollout` and `school_offboarding`), enabled modules and mode, rollout cohort, integration health and last sync, open work items, open incidents, support access in force, release version, entitlement.
- **Customer 360 (commercial):** contract and commitments, quotes, invoices (when institutional billing exists), stakeholders (`champion` is a vacant seat; the field exists), success plan, health with its components and their sources, renewal date, outcome figures.
- **What neither shows:** any student's row, support message content, or compensation data. A support-message count is permitted; content needs a student-consented grant.

Both start read-only; the only first-release action is "request lifecycle transition", which becomes an approval.

## 7. Institution command center

The institution-side counterpart ([`INSTITUTION_CONSOLE_CATALOG.md`](INSTITUTION_CONSOLE_CATALOG.md#13-institutional-command-center)) uses the same `work_item` and approval entities filtered to one tenant by RLS and capability. It adds no table and no authorization logic; if it needs a field the company view does not, the field goes on the shared entity.

## 8. Support and escalation

Support tab exists (default off). Flipping it on is itself a controlled action and requires a published staffing statement (hours, owner, escalation) first, because an unstaffed queue is worse than none. Escalation ladder and severities: [`coo/04`](coo/04-support-operating-model.md), [`coo/05`](coo/05-incident-and-continuity.md); SEV1–4 ↔ P0–P3 mapped there. Elevated access to a student's content is the student-consented grant; emergencies use break-glass.

## 9. Operations dossier (nineteen dimensions)

- **Model/Data/Screens:** §2, §4–6. **Roles/Isolation:** `console:operate` + domain capability; RLS and in-body checks; the three INVOKER readers that return all tenants to any `console:operate` holder are fixed first (permission matrix §7).
- **Workflows/Approvals/Policy/Consent:** [`OPERATIONS_WORKFLOW_CATALOG.md`](OPERATIONS_WORKFLOW_CATALOG.md); approvals per the duty table; policy: read-only default; consent: support content only by grant.
- **Audit/SAF:** [`OPERATIONS_AUDIT_AND_EVIDENCE.md`](OPERATIONS_AUDIT_AND_EVIDENCE.md). **Review:** security review of every `ops_*` RPC; accessibility per [`OPERATIONS_RELEASE_GATES.md`](OPERATIONS_RELEASE_GATES.md).
- **SLO/Support:** console read p95 and projection lag per the release-gates page; operator support is the owner. **Rollback:** a view is hidden by flag; a producer is disabled by kill switch; projections rebuild from the outbox.
- **Tests/Gate:** T-01..T-06; gates T, S, X, A11y. **Owner:** operations seat [engineering seat]. **Commercial:** this is the console the first design partner's security reviewer will ask to see; its audit and approval proof is the sales asset.
