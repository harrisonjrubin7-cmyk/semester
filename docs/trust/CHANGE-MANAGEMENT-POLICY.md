# Semester change management policy — controlled draft

- **Status:** `PARTIAL / NOT FULLY OPERATED`
- **Owner:** Harrison Rubin, Engineering/Operations/Security/Privacy/Accessibility/Product primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** product, code, schema, infrastructure, configuration, providers, integrations, policies and customer-affecting operations

## Policy

Every material change requires an accountable owner, reason, affected systems/users/customers, risk tier, dependencies, data/authority impact, review, test evidence, release/rollback or forward-fix path, communication, monitoring and retained decision. Emergency changes preserve the same evidence after containment and receive prompt independent review.

Changes involving identity/tenant boundaries, student or sensitive data, official writes, AI/providers, payments, accessibility, retention/deletion, security controls, schema compatibility, service commitments or customer obligations require the relevant specialist and customer authority before activation.

## Change classes and gates

| Class | Examples | Minimum gate |
| --- | --- | --- |
| standard/low | reversible documentation or preapproved routine configuration | owner, review, verification and record |
| normal | feature, dependency, workflow, provider or non-breaking schema change | risk review, tests, rollback/flag, release approval and monitoring |
| high/critical | auth/tenant/data/security/AI/payment/official write/destructive migration | cross-functional review, target acceptance, incident/rollback readiness and executive/customer authority as applicable |
| emergency | active incident/exposure/outage | incident authority, minimum safe change, live verification, retrospective and corrective action |

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| source/change history | Git, PR and workflow records | current branch/rule enforcement and reviewer evidence incomplete | `PARTIAL` | Engineering | protected-branch and sample approval export |
| feature/config rollout | feature flags, cohort policy and kill-switch tests | target rollout/rollback acceptance absent | `PARTIAL` | Product/Operations | representative target change exercise |
| schema compatibility | migration history/checks and rollback rules | target migration/forward-fix operation incomplete | `PARTIAL` | Data/Engineering | expand-contract and failure drill |
| institutional adoption | [`docs/operating-model/CHANGE-MANAGEMENT.md`](../operating-model/CHANGE-MANAGEMENT.md) | no named-customer change governance | `DESIGNED` | Implementation/Customer | customer communication/training/UAT record |
| emergency change | incident/rollback runbooks | no complete target exercise | **DESIGNED / PARTIAL** | Incident/Operations | emergency change tabletop |

## Required record

`[CHANGE ID]`, owner/back-up, reason/urgency, systems/data/tenants/audiences, risk/class, dependencies, legal/privacy/security/accessibility/AI/customer review, test/scan results, migration compatibility, artifact/config, rollout/flag, rollback/forward fix, monitoring/support, approvals, execution timestamps, outcome, exceptions and evidence expiry.

## Claim ceiling and blockers

Permitted: “Semester maintains source history, extensive CI checks and scoped rollout controls.” Prohibited: every change approved, complete segregation of duties, zero-downtime change, proven emergency process, or customer-accepted operation. Blocks: adopted authority matrix, branch/reviewer evidence, risk criteria, target rollout/rollback/migration exercises, emergency path, configuration/provider inventory, customer communications, metrics, exception review and named owners.
