# Capability registry baseline

Status: canonical Phase A documentation entry point. Executable sources remain `app/src/lib/rollout-capabilities.ts`, `app/src/lib/governance/capability-governance.ts`, activation controls and release profiles.

Semester already has 60 typed user-facing capabilities, L0–L9 maturity, activation classes, domain/data rules, safe defaults, fallbacks, owner seats, evidence/approval/integration records and fail-closed decisions. Current `main` also gates audience release claims against target-bound, dated evidence. This is substantial governance implementation—not proof that a tenant or provider is live.

The complete 60-row operational inventory is in [capability-inventory.md](capability-inventory.md).

## Required operational schema

Each capability must expose: ID/name/plane, roles, routes, native baseline, connected mode, repository maturity, runtime exposure (`live`, `connected`, `pilot`, `early_access`, `institution_controlled`, `planned_but_not_exposed`), entitlement, tenant/cohort configuration, authority/source/provenance, classification, web/PWA/native/offline/AI support, analytics, support/SLO, owner seats, rollback/offboarding, sign-offs, evidence references and expiry.

Runtime exposure is independent from repository maturity. `L4` source can remain unexposed; `live` requires current evidence and real human owners.

| Shared platform capability | State | Main gap |
| --- | --- | --- |
| Identity/tenant membership | Partial/connected foundation | Lifelong transitions and tenant evidence |
| Authorization/consent/purpose | Strong distributed foundation | One adopted request-context/policy contract |
| Activation and claims | Implemented foundation | Operational exposure state and route parity |
| Integration health | Partial | Live adapters, maps and operated health |
| Global search/command | Partial | Server-authorized index shared with AI |
| Notifications/inbox | Partial | Delivery ledger, retries and staffed ownership |
| Support/JIT access | Partial | Staffed SLO evidence and tenant routing |
| Audit/outbox | Implemented foundation | Production search/export and independent verification |
| Operations/trust | Partial | Real production sources and current evidence |
| Analytics | Partial | Production baselines and outcome validity |
| Data rights/retention | Partial | Live request/erasure evidence |
| Native secure storage | Absent | SQLCipher key/device lifecycle |
| CRDT replication | Absent | Service, storage, revocation and recovery |
| Marketplace/credentials | Partial/design | Real partners, issuers and disclosure delivery |

| Evidence class | Repository status | Required before `live` |
| --- | --- | --- |
| Product/native flow | Broad, variable | End-to-end UAT for exact version |
| Connected flow | Contracts/sandbox | Tenant mapping, credentials, health, reconciliation |
| Authorization/privacy | Strong source; local PG17 rerun absent | Current negative tests and independent review |
| Operations/support | Policies and partial console | Named staff, alerts, observed performance, exercise |
| Recovery | Workflows/docs | Exact-target rollback/restore evidence |
| Commercial/legal | Draft/illustrative | Pricing authority, contracts, counsel, accounting |
| Ownership | Seat placeholders | Named humans accepting duties |
| Measurement | Taxonomies/tests | Production baselines and valid outcomes |

Phase B extends the existing typed registry rather than creating a parallel truth source. The first executable slice is `app/src/lib/governance/capability-exposure.ts`: it joins capability maturity, release-profile scope, exact target binding, tenant/cohort authorization, connection health, native fallback, AI availability, kill-switch state and the eight operational evidence categories into the six canonical exposure states: `live`, `connected`, `pilot`, `early_access`, `institution_controlled`, and `planned_but_not_exposed`. It also indexes every registered route and fails closed when scope or evidence is missing. Navigation, marketing, AI and tenant-control callers must use this resolver instead of inferring availability from route presence or repository maturity.
