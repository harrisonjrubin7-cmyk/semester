# Connect, replace, operate

Status: Phase 0 strategy, assessed 2026-10-05 at `790ebbf`. Doctrine from the founding brief, constrained by what the repository can evidence. Read with [DOMAIN_AUTHORITY_MATRIX.md](DOMAIN_AUTHORITY_MATRIX.md) and [DOMAIN_REPLACEMENT_MATRIX.md](DOMAIN_REPLACEMENT_MATRIX.md).

> Build every major domain natively. Integrate during transition. Replace only after evidence. Operate every domain as one coherent system.

## The four ways a domain runs behind Semester

The student never needs to know which is active. Each domain, per tenant, is in exactly one:

| Mode | Meaning | Authority |
| --- | --- | --- |
| 1. Native | Semester operates the domain | Semester, if and only if gates pass and the institution approved |
| 2. Synchronized | Semester mirrors a transitional external domain and governs access to it | The external system |
| 3. Partnered | A specialist provider holds regulated or specialized infrastructure (payments processor, card office, proctoring) | The partner |
| 4. Handoff | Semester prepares and routes; the student acts in the official system | The official system |

The database already holds this shape for modules: `tenant_module_mode` has a per-module Connect or Core switch with two approvers, an immediate way back, a freeze not a delete, and a kill switch that overrides (`supabase/module_mode.check.sql`; `ModulesPanel.tsx`). Core mode "is a boundary, not a deployment claim." That table is the control that this strategy extends to every domain in the authority matrix.

## Lifecycle of a connection

From the brief's integration map. Each stage has an owner and an exit test; skipping a stage is refused by `tenant_rollout`'s gate model once that table is made an enforcement gate (EOS-103).

| Stage | Exit test |
| --- | --- |
| Inventory | Every system, owner and data flow listed; a business purpose per integration (no "connect everything" scope) |
| Data classification | Each field mapped to a T-tier (`data_classification`); T4 and above never moves (`app/src/lib/migration/scope.ts`: "nothing T4 or above moves") |
| Security and privacy review | Reviewer other than the author; subprocessor entry current |
| Scope approval | Minimum fields only; recorded in the approval system |
| Sandbox | Connection against a vendor sandbox or the mock; no production credential |
| Read-only sync | Freshness target set; source states shown to users |
| Mapping and reconciliation | Mapping version proposed, simulated, approved, live (`app/src/lib/integration/mapping-versions.ts`); reconciliation scheduled |
| Pilot workflow | One workflow, named users, measured |
| Controlled write approval | Idempotency key, rollback, audit, institution approval |
| Production monitoring | SLOs measured, not asserted |
| Periodic scope review | Access and scope reviewed on a date |
| Retirement or native replacement | Gates in the replacement matrix |

The brief's `IntegrationConnection` record (status `draft`, `security_review`, `approved`, `sandbox`, `read_only`, `write_enabled`, `paused`, `retired`; direction; approved scopes; data classes; owner role; last successful sync; freshness target; reconciliation status; rollback plan; approval reference) maps onto the existing `integration_*` tables and `app/src/lib/integration/`. The gap is not the model; it is that `ADAPTERS` is empty in all three registries, so no connection can leave `sandbox`.

## Eight rules for integrations (from the brief)

1. Existing official records remain authoritative until a formal migration is approved.
2. Pull only the fields the workflow needs.
3. Read before write; writes only after reconciliation, governance, rollback and approval.
4. Every integration has a purpose.
5. Every field has provenance: source, freshness, transformation, owner, conflict state.
6. Every write has an idempotency key.
7. Every migration has a rollback.
8. Every external model is policy-governed.

Where the code enforces each today: 1 by the authority matrix and `scope.ts`; 3 by `writeback.*` tenant flags and the gradebook passback decision `lti_passback_decision`; 5 partly by `freshness.ts` and `source.ts`; 6 by `app/server/productivity` command pipeline and the roster manifest hash, but **not** by LTI AGS passback (no idempotency key, one POST, no retry); 7 by `rehearsal.ts` tooling; 8 only on the gateway path.

## Phases

The brief's five phases, each with the entry condition this repository can actually measure.

**Phase 1: Connect.** Existing SIS, LMS, email, calendar, storage and AI stay authoritative. Semester provides one identity-aware workspace, one action center, one planning layer, one search layer, one student journey, one support route, one governed AI interface and one control plane. *Entry condition not yet met:* no adapter is live; the first design-partner acceptance run (EOS-300 series) is what opens this phase. Value in the meantime is the individual student product, held to invitation-only.

**Phase 2: Replace visible workflows.** Student portal, planner, advising action center, registration readiness, course workspace, support intake, community, career center, AI assistant. These are where Semester is already furthest: Today, Action Center, Path, Plan, Study and the AI copilot exist (product map section 2). *Condition:* a pilot institution's workflow baseline frozen with a sponsor (`docs/launch/PILOT-MEASURES-BASELINE-WORKSHEET.md`).

**Phase 3: Replace operational domains.** Productivity workspace, Course Studio, student tasks and actions, support workflows, institutional communications, community, campus services, career workflows, student-success operations, tenant policy, commercial lifecycle. *Condition:* the domain's gates 1 to 6 are `●` with evidence and the tenant's module is set to Core by two approvers.

**Phase 4: Replace core institutional systems.** Registration, academic records, gradebook, student accounts, payment plans, degree progression, institutional analytics, identity provisioning, multi-campus governance. *Condition, from the brief:* governance, migration, auditability, legal review, operational readiness and institutional approval all exist. Not before gates 7 to 14.

**Phase 5: Education operating system.** Semester is the primary system through which operations, learning, student life, administration, intelligence and services run, **where the institution chooses it**. The end state is not "Semester sits beside the SIS forever"; it is "authoritative where the institution chooses, with portability, auditability, interoperability and controlled transition."

## Per-category plan

From the founding comparison table, with today's real step.

| Legacy category | Connect (now) | Replace visible | Replace operational / core | Today |
| --- | --- | --- | --- | --- |
| LMS (Canvas, Brightspace, Blackboard, Top Hat) | LTI launch, roster and course sync | Course Studio, study packs | Assignments, submissions, gradebook, governed AI | LTI tested on synthetic platforms; gradebook in DB, off; no submissions |
| SIS / registrar | Read-only roster, catalog, term, hold sync | Registration readiness, Registration Day | Native enrollment, catalog, prerequisites, overrides, record | Registration and record in DB, off; no SIS adapter |
| Degree audit, advising | Import requirements and progress | Path, scenarios | Advisor workflow, source-aware checks | Student estimates only |
| Student success (EAB, Starfish) | Authorized signals and referrals | Action Center, check-ins | Case management, outcome intelligence | Student-controlled share only; no signal model |
| Productivity (Google, Microsoft, Apple) | Calendar, file, account integration | Tasks, notes, plan | Native workspace with academic context | Native device and blob; Google and Microsoft calendar with fake-fetch tests; Apple via ICS |
| AI (ChatGPT, Claude, Perplexity) | Approved-model routing through a gateway | Copilot, tutor, research, writing | Policy, provenance, course rules, human escalation | Gateway built and undeployed; BYO key routes ungoverned |
| Search | Federated search and indexing | Permission-aware search | Official-source search with citations | Client-side only |
| Campus services | Read-only feeds, official handoffs | Service action layer | Native where the institution chooses | Dining native in DB, UA; others handoff |
| Billing and student accounts | Account balance and status | Notices linked to deadlines | Ledger, payment plans, reconciliation | Ledger in DB, **UA** |
| Career | Opportunity import, approved profile sharing | Career graph, portfolio | Mentoring, employer relationships | Device-local; no employer UI |
| Family | Identity linking, consent-aware handoff | Scoped grants | Time-bound sharing, audit history | Share codes built; K-12 `UA` |
| Company operations | Read-model integration | Command center | Internal controls | Console shell only |

## What this strategy forbids

- Marking a mode 1 or "native" on a domain served by a mock adapter.
- Enabling any `writeback.*` flag or Core mode for a tenant without gates 5, 6, 8, 13 and a named approver.
- Treating `rollout-capabilities.ts`'s `currentState: 'verified'` as an operational claim.
- A domain moving up a step on the strength of a sandbox demo in `app/server/institution/*.ts` (they are labelled demonstrations in a SQLite file, not the store-backed paths).
- Any external claim in the "Do not say" column of [the thesis](SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md).

## The migration moat as a product

Each migration leaves reusable assets: field maps, quality rules, reconciliation evidence and implementation expertise. The repository already has the shape of that product (`app/src/lib/migration/*`, about 6,300 lines; the Migration Center; the evidence ledger), and nothing to show it works on real data. The first design-partner migration rehearsal on non-production extracts is the single most valuable piece of evidence the program can produce, and is the head of the interoperability epic in [the backlog](EDUCATION_OS_BACKLOG.md).
