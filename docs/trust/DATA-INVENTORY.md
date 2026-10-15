# Semester data inventory — trust control index

- **Status:** `PARTIAL`
- **Owner:** Harrison Rubin, Data/Privacy primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Review trigger:** schema, provider, feature, integration, retention or customer-scope change

## Purpose and evidence ceiling

This document indexes where Semester data is described and who must reconcile it. The generated structural source (`docs/DATA-INVENTORY-AND-LINEAGE.md`, rendered from the migrations; the count is read there, not copied here) reports the `public` tables and whether row-level security is enabled on each. That can establish schema structure at the generated revision; it cannot establish production contents, lawful basis, institutional approval, field-level classification, complete non-database stores, or operation of every lifecycle control.

## Authoritative inventories

| Layer | Source/configuration evidence | Operational evidence | Status and limitation |
| --- | --- | --- | --- |
| database schema/lineage | [`docs/DATA-INVENTORY-AND-LINEAGE.md`](../DATA-INVENTORY-AND-LINEAGE.md), generated from applied migrations | no dated production-schema reconciliation filed here | `VERIFIED — REPOSITORY`; environment remains unverified |
| table retention/purpose | [`RETENTION.md`](../../RETENTION.md), retention tripwire tests | no complete target-environment sweep/restore evidence | `PARTIAL` |
| account export/erasure coverage | catalog-driven data map, export/deletion code and database checks | no representative target-environment rights-request record | `PARTIAL` |
| device/local data | product storage and privacy documentation | user-controlled exports/deletions not centrally observable | `PARTIAL` |
| institutional/gateway data | migrations, gateway code, source/provenance records | no named-tenant production flow or acceptance | `CONDITIONAL` |
| AI prompts/outputs/usage | context/provider policy sources and retention docs | provider/configuration/region and live operation not approved | `CONDITIONAL` |
| third parties | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) and architecture | provider terms, regions and active production paths need reconciliation | `PARTIAL` |
| logs, backups and evidence | retention, monitoring, restore and evidence documents | production backup settings/restore and log-retention operation incomplete | `PARTIAL` |
| repositories/business records | Git and company/legal registers | private corporate, contracting, finance and workforce records are not inventoried here | `MISSING` |

## Required per-data-set record

`[DATA SET / FIELD OR OBJECT]`, source, subject, owner/steward, purpose, authority/legal basis, classification, tenant/account key, systems/regions, recipients/providers, access roles, encryption, retention, backup tail, export/deletion/hold treatment, lineage, accuracy/source status, age/minor implications, customer configuration, evidence date and unresolved risk.

## Control test and missing proof

| Control | Code/config evidence | Operational proof required | Owner | Missing test/evidence |
| --- | --- | --- | --- | --- |
| every schema table inventoried | generated catalog inventory | target production schema diff | Data/Engineering | scheduled dated reconciliation |
| every table has lifecycle answer | retention tests and schedule | sweep results, exceptions and restore replay | Privacy/Operations | target lifecycle exercise |
| every outbound destination inventoried | CSP/functions/provider registers | target network/provider configuration | Security/Privacy | environment egress reconciliation |
| field/classification accuracy | selected classifications and maps | steward review against representative records | Data owners | field-level inventory coverage |

## Claim ceiling and activation blockers

Permitted: “Semester maintains repository-derived schema and retention inventories with automated coverage checks.” Prohibited: complete production inventory, universal classification, complete deletion, verified data residency, or legal compliance. Activation blocks on a target-environment reconciliation, field-level/customer map, owners, provider/region terms, lifecycle exercises, age/jurisdiction review, and accepted residual gaps.
