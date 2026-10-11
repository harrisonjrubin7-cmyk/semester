# Role and screen gap analysis

> **Type:** explanation · **Audience:** contributors, implementers · **Owner:** `product` · **Truth:** reviewed · **Reviewed:** 2026-10-08 · **Held by:** —

Assessed against `origin/main` at `55adab11` on 2026-10-08.

This revision-bound snapshot informs, but does not replace, the canonical build order in [`docs/product/EDUCATION_OS_BACKLOG.md`](../product/EDUCATION_OS_BACKLOG.md).

## Rule

A route or polished screen is design/implementation evidence only. A role surface is operationally complete only when identity context, tenant boundary, relationship/grant, permitted fields, commands, workflow, audit, failure states, support ownership and target-specific release evidence agree.

## Role families

| Role family | Current repository evidence | Principal gap | Phase |
| --- | --- | --- | --- |
| Student | Broad production UI, local persistence, account flows, planning, study, registration preparation and sandbox institution gateway | One server-issued readiness projection joining local plan and approved institutional sources | P0 |
| Applicant | Product/design and lifecycle material exist | Separate authenticated applicant boundary, transition-to-student contract and operational evidence | P2 |
| Faculty | Course, grading, assessment and policy foundations exist | Cohesive Course Studio release workflow with live LMS/SIS mappings and faculty UAT | P1 |
| Teaching assistant | Scoped concepts and some permission evidence exist | Assigned-section enforcement and accommodation-minimized grading queue end to end | P1 |
| Advisor | Advisor data, sharing, meeting and policy relationship evidence exists | Governed readiness caseload/queue using the same projection as the student | P0 |
| Registrar | Registrar dates, registration sandbox, institution policy and operational metrics exist | Cohort readiness/reconciliation console backed by approved SIS data | P0 |
| Finance/student accounts | Finance models, operations material and governed adapter patterns exist | Approved processor/ERP integrations, separation of duties, ledger reconciliation and legal readiness | P2 |
| Student affairs/support | Support, case, access and operations foundations exist | Purpose-limited case projection, staffed SLA and live escalation evidence | P1 |
| Institution administrator | Tenant, exposure, policy, evidence and console foundations exist | Unified institution console adoption and target-specific administration/UAT | P0–P2 |
| IT/security/privacy | Strong repository control/evidence surfaces exist | Named operators, independent assurance, live monitoring and exercised response | P0 |
| Family/guardian | Expiring/revocable grant and product foundations exist | Institution-authorized payer/guardian relationship plus live revocation propagation evidence | P2 |
| Alumni | Lifecycle/career surfaces exist | Separate alumni identity boundary and consented transition evidence | P2 |
| Employer/partner | Career, partner and developer concepts exist | Separate scoped portal, consented disclosure ledger and verified organizations | P2–P3 |
| Semester operations | Broad operations console/governance code exists | Staffed queues, SLOs, live signals and evidence of exercised runbooks | P0–P3 |
| Company functions | Extensive company operating documents and console material exist | Keep separate from education records; connect only to verified business systems | P3 |

## Screen families

| Screen family | Reusable pattern already present | Missing evidence or behavior |
| --- | --- | --- |
| Personal dashboard | Today, planning and action-center patterns | Target-specific institutional source freshness and operational metrics |
| List/queue | Shared row/table, filters and operations surfaces | One readiness task model with owner, SLA, evidence, decision and receipt |
| Record detail | Source badges, school records, course and account detail | Uniform record envelope and field-level policy obligations across legacy views |
| Controlled action | Institution gateway review/execute/receipt pattern | Adoption by every consequential legacy mutation; real adapters remain gated |
| Planner | Registration day, calendar and degree planning | Governed server projection joining official and student-owned facts |
| Editor/publish | Course/content authoring and version patterns | Cohesive faculty publish/grade-release workflow with official sync |
| Review queue | Operations and approval surfaces | Advisor/registrar registration-readiness queue with cross-role E2E tests |
| Analytics | Numerous definitions and dashboards | Production baselines, privacy validation and observed outcome evidence |
| Settings/permissions | Account, privacy, connection and delegation patterns | Same-place revoke propagation and live access-history evidence |
| Onboarding/context selection | Account/profile/institution setup | Explicit active-role/context switch across every protected request |
| External portal | Several audience-specific product surfaces | Strong physical/logical isolation and independent route/access test suites |

## Required screen-state contract

Every newly adopted screen must cover ready, loading, empty, error with recovery, forbidden, stale, offline and disabled states where applicable. It must name source authority and freshness in words, retain a usable primary action at 320 px, use the existing semantic-token system, and emit or link the applicable audit evidence. No new parallel design system is warranted.

## P0 screen backlog

1. Student registration-readiness view consuming a governed projection, with local-planning fallback explicitly labeled.
2. Assigned-advisor student-readiness detail with minimized fields and a referral/escalation action.
3. Registrar cohort queue with stale/unknown filters, reconciliation status and immutable receipt links.
4. Operations queue for connector failures, dead letters and manual review.
5. Institution integration-health view showing scope, freshness, last success, failure reason and reauthorization path.
