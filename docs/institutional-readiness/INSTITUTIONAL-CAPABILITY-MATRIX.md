# Institutional Capability Matrix

| Control | Value |
| --- | --- |
| Status | **CONTROLLED CAPABILITY REGISTER — REPOSITORY STATE ONLY; NO NAMED-INSTITUTION ACCEPTANCE** |
| Owner | Harrison Rubin — company-side product/engineering owner; customer workflow, system and acceptance owners unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md), [`../OPERATIONAL-REALITY-REGISTER.md`](../OPERATIONAL-REALITY-REGISTER.md), and [`../CAPABILITY-PARITY-MATRIX.md`](../CAPABILITY-PARITY-MATRIX.md) |

## Status vocabulary

- **Repository-tested:** implementation and focused automated checks exist for the stated boundary.
- **Building/partial:** implementation or control exists with a material gap.
- **Designed:** documentation/contract exists without complete executable capability.
- **Not implemented:** no usable implementation exists.
- **Target-accepted:** named target configuration and representative UAT have passed with customer acceptance.
- **Operated:** staffed, monitored use over the agreed period has evidence.

No row is target-accepted or operated merely because it is repository-tested.

## Capability register

| Domain / capability | Repository state | Current boundary | Missing before institutional use |
| --- | --- | --- | --- |
| student planning / Today / calendar / assignments | repository-tested at product level | personal planning and source-labelled guidance; not official record/action | target cohort UAT, accessibility, source/freshness, support and customer acceptance |
| degree/registration planning | repository-tested/partial | planning from published/entered information; official SIS/degree audit remains authoritative | approved target content/feed, disclaimer/accuracy UAT and escalation |
| institutional tenant, roles and policies | repository-tested for defined paths | scoped capabilities/RLS; older account-scoped paths limit blanket tenancy claim | complete target data-path review, two-tenant/role tests and access acceptance |
| SAML/SCIM identity lifecycle | repository-tested, off/unconfigured | SAML/SCIM controls exist; OIDC absent; no real IdP acceptance | target IdP/claims/groups/rotation/JML tests and customer approval |
| LTI 1.3 launch / Deep Linking / AGS | repository-tested at protocol/control level | no real LMS acceptance; NRPS absent; writeback off unless separately approved | bound target registration, sandbox UAT, key lifecycle, unbound-path disposition, reconciliation |
| OneRoster / real SIS-LMS APIs | designed/not implemented | generic mocks/pipeline only; production adapter registry empty | implementation, provider contract tests, target sandbox, mapping/reconciliation and acceptance |
| institutional gateway/integration control plane | repository-tested/partial | contracts, permissions, journaling and pipeline controls; no live provider operation | deployed readback, real adapter, monitoring/support/recovery and customer UAT |
| native course/learning/grade workflows | building/partial | selected Course Studio/gradebook components; not proven LMS/gradebook of record | full scope, migration, academic governance, representative UAT and record-authority decision |
| AI/student study toolkit | repository-tested/partial | bounded product tools and governance controls; institutional provider/data path separately gated | provider/terms/data authority, evaluation, disclosure, human oversight, target monitoring/kill test |
| admin/operations console | repository-tested/partial | controlled preview/flagged operations with selected approvals/audit | target configuration, MFA/access review, staffing, monitoring, exercise and customer acceptance |
| accessibility | automation/self-assessment partial | critical automated checks and design guidance; no formal conformance/ACR | qualified manual/AT workflow review, remediation, accommodation route and customer acceptance |
| security/privacy/audit/recovery | broad repository controls, partial assurance | specific controls may be cited; independent/target/operated proof incomplete | exact candidate, target configuration, independent review, restore/incident/access exercises and acceptance |
| support/implementation/pilot governance | designed/controlled templates | no staffed institutional operation or named pilot | named primary/backups/customer owners, exercised channels, signed scope/go-live and operation |
| commercial/contract/billing | controlled templates only | no approved price/order, payment activation, customer or revenue claim | authorized quote/terms, executed order, billing/entitlement reconciliation and accounting review |

## Per-capability acceptance record

Record capability ID/version, workflow/users, repository evidence, target/environment/configuration, data/source authority, identity/roles, integrations/providers, accessibility, security/privacy, monitoring/support/recovery, limitations/fallback, tests/UAT, defects/residual risk, customer approver, activation state/date, observed operation and review/expiry. Keep capability, deployment, entitlement, activation and operation as separate facts.

## Evidence state

**Repository evidence.** Extensive capability registers, implementations, tests, designs and control documents describe a broad product and institutional direction.

**Operational evidence.** No named institution has accepted this matrix; it does not establish complete parity, provider connections, official-record authority, staffed operations, live tenant activation or observed institutional outcomes.

**Missing test/proof.** Choose a bounded initial workflow; freeze exact scope/target; assemble cited evidence; close target trust/accessibility/integration/support gates; run representative UAT and recovery/rollback; obtain customer acceptance; observe operation before raising status.

## Claim ceiling

Semester may describe exact repository-tested, partial, designed and absent capabilities with their limitations. Institutional availability must be stated per target and accepted scope.

## Prohibited claims

Do not claim full LMS/SIS replacement, feature parity, complete enterprise readiness, universal interoperability, production support, compliance/certification, named-institution readiness, live customer use, migration completion, official-record authority or institutional outcomes from this repository register.
