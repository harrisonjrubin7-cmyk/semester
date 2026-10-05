# Semester data export standard — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Privacy/Data owner with Product and Operations
- **Evidence date:** 2026-10-03

## Standard

An export must be authenticated, authorized, scoped to the requester/customer, understandable, accessible, secure, documented, and consistent with current data ownership, retention, legal holds, shared records, device-only data, and institutional instructions. Export does not imply disclosure of another person's records, secrets, security-sensitive data, privileged material, or information outside Semester's possession/control.

## Export record

Record requester and authority, tenant/account/scope, data map/version, systems/providers, excluded/withheld categories and reason, format/schema, provenance/freshness, generation/delivery timestamps, integrity, encryption, expiry, receipt, audit event, incident/exception, and deletion of temporary artifacts.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| individual server export | catalog-derived mapping, export code and tests | target execution/delivery record absent | Product/Privacy | representative target export and restore |
| portable formats | CSV/Markdown/calendar/JSON sources | accessibility/usability and current schema acceptance open | Product/Data | independent format review |
| device-held content | local persistence/export designs | not included in one complete server package | Product/User | end-to-end combined export |
| tenant/source export | offboarding designs | no complete customer export acceptance | Data/Operations | target tenant/source exercise |
| secure delivery | proposed request/audit controls | channel, expiry, receipt and incident exercise absent | Security/Privacy | target delivery test |

The evidence source [Data retention, export and deletion](../DATA-RETENTION-EXPORT-DELETION.md) documents current implementation and explicit gaps.

## Claim ceiling and activation blockers

Permitted: “Semester has tested individual server-side export paths and designed portable formats.” Prohibited: complete account/tenant export, all device/provider data, universal portability compliance, or successful delivery in production. Blocks: exact data map, scope/authority, target execution, accessible format review, secure delivery, legal-hold/exception logic, customer acceptance, temporary-file retention, owner/backups, and failure/incident handling.
