# Institutional implementation and customer success system

| Control | Value |
| --- | --- |
| Status | **CONTROLLED SYSTEM OF TEMPLATES AND GATES — NO INSTITUTION HAS BEEN RUN THROUGH IT** |
| Owner | Implementation lead and customer success manager seats (today Harrison Rubin; every backup unassigned) |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Decision | recorded in `docs/decisions/` under the number of the pull request that introduced this folder |
| Guard | `app/src/lib/ops/implementation-system.test.ts` |

This folder is the repeatable path from a signed evaluation to steady operation,
renewal and — when it comes to it — a clean exit. It is built so that a delivery
is **repeatable** (every tenant is a copy of the same templates), **auditable**
(a gate is passed by a link to evidence, every decision is a row) and **not
dependent on any one person** (work is organized into seats with backups, and a
seat without a backup is a recorded risk, not a silent assumption).

It sits on top of what `main` already had. It does not restate those
documents; it adds what they lacked, and where this folder and an older document
disagree on a fact, the older document is the one to correct.

## Where each of the ten deliverables lives

| # | Deliverable | Document |
| --- | --- | --- |
| 1 | Implementation methodology: discover, design, configure, integrate, migrate, pilot, parallel run, go-live, hypercare, optimize | [`METHODOLOGY.md`](METHODOLOGY.md) |
| 2 | Roles, responsibilities, cadence, artifacts, acceptance criteria and risk controls by phase | [`METHODOLOGY.md`](METHODOLOGY.md) (seats; the ten phase tables) |
| 3a | Tenant configuration workbook | [`TENANT-CONFIGURATION-WORKBOOK.md`](TENANT-CONFIGURATION-WORKBOOK.md) |
| 3b | Integration workbook | [`INTEGRATION-WORKBOOK.md`](INTEGRATION-WORKBOOK.md) |
| 3c | Migration workbook | [`MIGRATION-WORKBOOK.md`](MIGRATION-WORKBOOK.md) |
| 3d | Training plan | [`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md) |
| 3e | Cutover checklist, rollback plan, go-live checklist | [`CUTOVER-ROLLBACK-GO-LIVE.md`](CUTOVER-ROLLBACK-GO-LIVE.md) |
| 4 | Health score, adoption metrics, stakeholder map, success plan, renewal risk model, expansion triggers | [`SUCCESS-SYSTEM.md`](SUCCESS-SYSTEM.md) |
| 5 | Training academy: students, faculty, staff, admins, support, IT | [`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md) |
| 6 | In-product guidance and enablement requirements | [`IN-PRODUCT-ENABLEMENT.md`](IN-PRODUCT-ENABLEMENT.md) |
| 7 | Hypercare support model and handoff to steady-state support | [`HYPERCARE-AND-HANDOFF.md`](HYPERCARE-AND-HANDOFF.md) |
| 8 | Executive business review template | [`EXECUTIVE-BUSINESS-REVIEW.md`](EXECUTIVE-BUSINESS-REVIEW.md) |
| 9 | Customer feedback intake and product escalation loop | [`FEEDBACK-AND-ESCALATION.md`](FEEDBACK-AND-ESCALATION.md) |
| 10 | Offboarding and export process | [`OFFBOARDING-AND-EXPORT.md`](OFFBOARDING-AND-EXPORT.md) |

## What `main` already had, and what this adds

| Existing document | What it already holds | What this folder adds |
| --- | --- | --- |
| [`../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md) | the nine stored stages, delivery rules, stop conditions | the ten-phase method on top of them, with seats, cadence, artifacts and acceptance per phase |
| [`../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md`](../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md), [`../commercial/CUSTOMER-HEALTH-SCORE.md`](../commercial/CUSTOMER-HEALTH-SCORE.md), [`../commercial/CHURN-AND-RISK-PLAYBOOK.md`](../commercial/CHURN-AND-RISK-PLAYBOOK.md), [`../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md) | lifecycle, proposed dimensions and weights, risk domains, renewal cadence | review mechanics, stakeholder map, success plan, rules-based renewal posture, expansion triggers and gates |
| [`../market-readiness/GO_LIVE_CHECKLIST.md`](../market-readiness/GO_LIVE_CHECKLIST.md) | the **company-level** go-live gate | the per-tenant checklist, cutover timeline, tiered rollback and the inheritance rule |
| [`../market-readiness/MIGRATION_PLAYBOOK.md`](../market-readiness/MIGRATION_PLAYBOOK.md), Migration Center, roster staging | schema migration rules; Migration Center; staged roster import | a workbook over the real gates and the explicit list of what a production load path still needs. Part B of that playbook was stale and has been corrected to match |
| [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) | the eight-step offboarding case | the customer-facing process around it, the export package, closure checklist, and an honest list of what is not built |
| [`../LAUNCH-CONTENT-AND-TRAINING.md`](../LAUNCH-CONTENT-AND-TRAINING.md), [`../launch/`](../launch/FIRST-DAY-CHECKLISTS.md) | role guides, first-day checklists, content register | an Academy curriculum for six audiences, seat-readiness rules, and in-product requirements |
| [`../commercial/SUPPORT-OPERATIONS.md`](../commercial/SUPPORT-OPERATIONS.md), [`../LAUNCH-WAR-ROOM.md`](../LAUNCH-WAR-ROOM.md) | support loop, severity, the launch board | the hypercare model with entry/exit criteria and the handoff packet |
| [`../commercial/FEEDBACK-AND-VOICE-OF-CUSTOMER-PROGRAM.md`](../commercial/FEEDBACK-AND-VOICE-OF-CUSTOMER-PROGRAM.md) | voluntary feedback rules | the intake record, triage, escalation ladder and the product loop |
| [`../CONFIGURATION-STUDIO.md`](../CONFIGURATION-STUDIO.md), [`../INTEGRATION-OPERATOR-RUNBOOK.md`](../INTEGRATION-OPERATOR-RUNBOOK.md), [`../SSO-TENANT-ONBOARDING.md`](../SSO-TENANT-ONBOARDING.md) | the product mechanics | workbooks that record intent, applied value and evidence for each of them |

## Starting a tenant (the whole procedure)

1. Open the project: `implementation_projects` row at stage `discover`, with an
   owner; create `docs/evidence/implementation/<tenant-id>/` and copy the three
   workbooks and the cutover document into it.
2. Fill the seat table in the project record: a primary **and a backup** for every
   seat on both sides. Any empty backup is `at_risk`.
3. Run [phase 1](METHODOLOGY.md#phase-1--discover): stakeholder map, no-fit screen,
   charter and RACI.
4. Move forward one stage at a time. At each stage exit, file the gate evidence
   and the handoff packet; do not advance on a recollection.
5. At every step ask the same four questions: *Is this live or excluded? Who is the
   checker? What is the evidence? How do we undo it?*
6. Record every scope change, exception and stop in the decision register.
7. Before production, run the shadow test: the backup does a named step from the
   workbook while the primary stays silent.
8. When something is done by hand twice, it becomes a workbook line. When a
   workbook cannot express a need, it is a product escalation, never a one-off.

## The honest state

| Fact | State |
| --- | --- |
| Institutions run through this method | none |
| Seats with a named, shadow-tested backup | none |
| Configuration Studio settings that a feature reads | none (record only) |
| Customer-data load path for any domain | none (Migration Center records evidence; roster staging is a server foundation nothing reads) |
| Integrations certified against a customer sandbox | none |
| Offboarding used on a real school | no (one author rehearsal on synthetic data) |
| Staffed support rota, SLA, response times | none |
| Customer health, risk or renewal measured | none |

A document in this folder that is quoted outside the company must keep its
**claim ceiling**. Every legal conclusion, contract term and retention length
belongs to qualified counsel and the institution; this folder names the gate and
never states the conclusion.

## Evidence state

**Repository evidence.** The tables, functions, screens, runbooks and checks the
documents name exist on `main`; the guard test holds this folder's stage,
rollout, migration and status vocabulary to the migrations that define them and
holds its links, anchors and required sections.

**Operational evidence.** None.

**Missing test/proof.** One end-to-end implementation with a second person
shadowing every phase, followed by the template changes it teaches.

## Claim ceiling

Semester may describe this as its intended, controlled implementation and
success system, and use it for conditional planning and sandbox work.

## Prohibited claims

Do not claim any institution is implemented, integrated, migrated, live,
supported, healthy, retained or expanded, or that delivery is independent of any
one person, from this folder.
