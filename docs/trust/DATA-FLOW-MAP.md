# Semester data-flow map — controlled trust view

- **Status:** `PARTIAL`
- **Owner:** Privacy/Data owner with Security and Engineering
- **Evidence date:** 2026-10-03
- **Scope:** logical product flows; not a verified named-tenant or production packet capture

## Logical flow

```text
Student or staff device
  ├─ device-local workspace and caches
  ├─ authenticated request ───────> Supabase auth/database/storage/functions
  │                                  ├─ account/tenant/resource policy
  │                                  ├─ audit/security/support events
  │                                  └─ rights/export/deletion workflows
  ├─ approved institutional source -> institutional gateway -> scoped records
  └─ user/tenant-approved AI action -> metered policy gate -> approved provider

Authorized support operator -> time-limited capability -> minimum view -> audit
Trust-room reviewer -> approved grant/NDA reference -> selected evidence -> access log
Offboarding/rights -> verify -> export/revoke/delete/de-identify/retain -> record
```

No arrow implies that a flow is enabled, legally approved or active for a named institution. Manual/read-only is the proposed initial institutional boundary; official-system writes and live institution integrations require separate acceptance.

## Flow register

| Flow | Data/source | Destination/purpose | Code/config evidence | Operational evidence | State/gap |
| --- | --- | --- | --- | --- | --- |
| local planning | user-entered/imported academic content | device storage; user workflow | product storage/import code | no centralized observation | `VERIFIED — SOURCE`; device/browser behavior varies |
| account synchronization | account-owned data | Supabase; cross-device continuity | cloud/merge code and RLS tests | production operation not established here | `PARTIAL` |
| institution source | approved source/context | gateway and tenant-scoped store | adapters/contracts/policies | no live named provider/tenant | `CONDITIONAL` |
| AI assistance | user action and approved context | configured model provider | context, gateway, budget/kill-switch policies | provider/model/region and full evaluations open | `CONDITIONAL` |
| support | request and minimum diagnostics | authorized support workflow | capability/access/audit sources | staffing and live exercise open | `PARTIAL` |
| analytics/reporting | minimized events/thresholded aggregates | institution/company views | governance/aggregation tests | no customer-accepted production reporting | `CONDITIONAL` |
| rights/offboarding | verified subject/tenant scope | export, revocation, deletion/retention | export/deletion/offboarding sources | complete target exercise absent | `PARTIAL` |

## Required customer field map

For each field or object record source, subject, authority, classification, purpose, legal basis, account/tenant/resource key, transformations, recipients, providers/subprocessors, region, encryption, logging, retention/backups, export/deletion/hold behavior, owner, configuration, failure mode and evidence date. `[CUSTOMER-SPECIFIC MAP REQUIRED.]`

## Control evidence and missing tests

| Control | Evidence | Owner | Missing operational test |
| --- | --- | --- | --- |
| tenant/account authorization | RLS and policy suites | Engineering/Security | named-tenant target acceptance |
| egress/provider scope | CSP/functions/provider registers | Security/Privacy | target network/config verification |
| minimization and audit | source-specific tests/registers | Data/Product | representative payload review |
| lifecycle completion | export/deletion/retention sources | Privacy/Operations | full target export-delete-restore-offboard exercise |

## Claim ceiling and activation blockers

Permitted: “Semester maintains a repository-derived logical flow map and requires a customer-specific field map.” Prohibited: verified production flow, complete lineage, data residency, approved provider path, or institutional acceptance. Blocks: target mapping and packet/config validation, provider terms/regions, owners, age/jurisdiction and authority analysis, incident/lifecycle exercises, customer acceptance and reconciliation with the data inventory.
