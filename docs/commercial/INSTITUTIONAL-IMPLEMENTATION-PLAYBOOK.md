# Institutional Implementation Playbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAYBOOK — REPOSITORY CAPABILITY PRESENT; NAMED IMPLEMENTATION NOT STARTED** |
| Owner | Harrison Rubin — company-side implementation authority; backup engineer/program lead and customer technical authority unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Source | [`../market-readiness/IMPLEMENTATION_PLAYBOOK.md`](../market-readiness/IMPLEMENTATION_PLAYBOOK.md) |

## Phases and gates

| Phase | Required decision and evidence |
| --- | --- |
| discover | authorized problem, cohort/workflow, stakeholders, current process/systems, authority/data/risk, success/guardrails, budget/procurement, exclusions and no-fit criteria |
| design | signed charter/RACI, minimum data flow, role/tenant/source/retention model, manual/read-only fallback, support/recovery/offboarding and acceptance plan |
| configure | exact revision/environment, tenant/cohort/roles/flags/content, least-privilege access, configuration export/readback and rollback path |
| integrate | only approved provider/adapter/scope; sandbox contract tests, identity mapping, freshness, rate/error/idempotency/reconciliation/degraded behavior and authoritative readback |
| validate | representative role/cross-tenant, critical-flow, accessibility/device, privacy/security, rights, monitoring/alert, incident, rollback/restore, support and capacity UAT |
| launch | signed customer/Semester GO with no open P0/P1, staffed support/escalation, approved communication/cohort, frozen baseline and safe stop controls |
| operate | weekly evidence/guardrails, change/incident/problem management, access review, billing/delivery reconciliation and midpoint/final decisions |
| convert/expand/offboard | new authorized order/scope and capacity for conversion/adjacent expansion, or export/revocation/deletion/retention/transition and closure confirmation |

## Delivery rules

Never configure a customer to depend on an unavailable capability. Label roadmap items excluded; do not simulate them as delivered. A repository feature is not a configured target, sandbox success is not production activation, and commercial entitlement is not authorization. Use synthetic/minimum data until customer authority and target controls pass. Stop for isolation/access/rights failure, inaccessible critical path, unsupported official write, unstaffed operation, unreconciled external action or customer withdrawal.

Required company roles: implementation/program lead, engineer, security/privacy, accessibility, support/incident, measurement/success and commercial/finance, each with trained backup appropriate to risk. One person may temporarily hold multiple roles only when disclosed, access remains least-privilege and independent approval requirements are not bypassed.

## Evidence state

**Repository evidence.** Architecture, configuration, integration, trust, release, support and institutional-readiness controls support planning and isolated validation.

**Operational evidence.** No named institutional implementation, customer-approved configuration, live provider, target UAT, staffed delivery team, launch or operated handoff is evidenced.

**Missing test/proof.** Qualify/freeze a named scope; execute paper/data authority; assign roles/backups; configure isolated target; complete provider/role/accessibility/security/recovery/support UAT; obtain launch/operation/offboarding acceptance.

## Claim ceiling

Semester may use this playbook for conditional institutional implementation planning and evidence-gated sandbox work.

## Prohibited claims

Do not claim an institution is implemented, integrated, migrated, live, accepted, supported or ready to scale from repository controls, demos or unsigned plans.
