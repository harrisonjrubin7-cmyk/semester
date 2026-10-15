# Semester security and technology asset inventory — controlled draft

- **Status:** `INCOMPLETE`
- **Owner:** Harrison Rubin, Security/IT asset primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** systems, applications, repositories, environments, databases, identities, providers, endpoints, domains, data stores and critical operational documents

## Inventory rule

An asset is anything whose loss, compromise, unavailability, unauthorized change or unclear ownership could affect Semester or its users. Repository presence proves neither deployment nor ownership; an external account or provider name proves neither activation nor approved data processing.

## Asset register

| Asset ID | Type/name | Owner/backup | Environment/location/provider/region | Purpose/data/class | Access/auth/MFA | Dependencies | Criticality | Lifecycle/status | Evidence/gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[ASSET-000]` | `[SYSTEM / REPO / DB / PROVIDER / IDENTITY / ENDPOINT / DOMAIN / DOCUMENT]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[PLANNED / ACTIVE / SUSPENDED / RETIRED]` | `[TBD]` |

## Reconciled inventory layers

| Layer | Code/config evidence | Operational evidence | Status | Missing test/proof |
| --- | --- | --- | --- | --- |
| product/features/routes | [`FEATURE-INVENTORY.md`](../../FEATURE-INVENTORY.md), source registries/tests | source is dated and not a live deployment inventory | **PARTIAL / STALE** | current generated capability/release reconciliation |
| schema/data stores | data inventory, migrations and retention sources | target database/provider settings incomplete | `PARTIAL` | target environment and non-database stores |
| cloud/providers/subprocessors | architecture and provider registers | account ownership, regions, contracts and activation incomplete | `PARTIAL` | external account/vendor evidence |
| code/repositories/CI | Git/workflow/package sources | account admins, branch protections and recovery incomplete | `PARTIAL` | access/configuration export |
| identities/secrets/keys | IAM and secrets documentation | complete inventory/rotation/MFA proof absent | `INCOMPLETE` | privileged/machine identity review |
| domains/digital assets | legal register template and repository configuration | registrant, renewal and recovery evidence absent | `INCOMPLETE` | external asset records |
| endpoints/physical assets | none comprehensive | no company device inventory or disposal records | `MISSING` | device/physical inventory and controls |

## Required lifecycle

Discover and assign; classify criticality/data; approve configuration/access; inventory dependencies and recovery; monitor changes/vulnerabilities; review ownership/access/contract; retire by revoking access, exporting/transferring data, deleting or retaining per policy, disposing media, updating dependencies and retaining evidence.

## Claim ceiling and blockers

Permitted: “Semester maintains several repository-derived component, data, feature and provider inventories.” Prohibited: complete asset inventory, managed fleet, verified ownership, current CMDB, universal monitoring, or complete disposal. Blocks: automated discovery reconciliation, every environment/provider/account/identity/domain/device, named owners/backups, criticality/data mapping, access/MFA/config evidence, contract/region, continuity/exit, periodic review and retirement records.
