> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester legal hold procedure — draft

- **Legal owner/backup:** `[TBD]`
- **Technical records owner/backup:** `[TBD]`
- **Approved hold register:** `[TBD]`
- **Jurisdictions/entities covered:** `[TBD]`

## Plain-language summary

A legal hold suspends ordinary deletion for information that qualified counsel identifies as potentially relevant to a matter. It does not preserve access, expand data use, or authorize collection. Semester has scoped database hold controls, but no adopted end-to-end hold program and no mechanism shown to suspend provider backup expiry.

## Hold lifecycle

1. **Trigger and authority:** counsel records the matter, reasonable anticipation/other basis, issuing entity, custodians, systems, date ranges, data categories and exclusions.
2. **Scope:** map the hold to accounts, tenants, integrations, tables, device-only data, exports, logs, communications, repositories, third parties and backups. Minimize unrelated data.
3. **Issue:** authorized operators apply only verified technical controls; notify custodians/owners with preservation instructions and prohibited actions; record acknowledgements.
4. **Verify:** a second reviewer confirms each scoped store is protected or records an explicit gap and compensating action. Test must not expose matter details or personal data.
5. **Monitor:** review `[CADENCE]` for new systems/custodians, departures, migrations, deletion requests, retention changes, provider changes and scope amendments.
6. **Release:** counsel alone authorizes written release. Remove controls with dual review, preserve the immutable hold record, and resume ordinary retention/deletion rather than deleting outside the approved schedule.

| Hold record field | Value |
| --- | --- |
| matter/basis/counsel authority | `[TBD]` |
| scope, custodians, ages/roles and jurisdictions | `[TBD]` |
| systems, records and providers | `[TBD]` |
| applied controls, operator and verifier | `[TBD]` |
| gaps/compensating actions | `[TBD]` |
| issue/review/release dates | `[TBD]` |

## Product-behavior and evidence mapping

| Area | Current evidence | Limitation/blocker |
| --- | --- | --- |
| database holds | [`RETENTION.md`](../../RETENTION.md) and legal-hold/integration checks | scoped tables and connections only; not an enterprise records program |
| account/integration deletion | database checks refuse some held deletions | complete coverage across all data stores must be verified |
| backups | retention documentation describes rolling expiry | no verified control suspends provider backup expiry for a hold |
| device/local and exported files | documented as user-controlled | Semester may lack possession or technical control |

## Activation and release blockers

Counsel-approved triggers and scope; named primary/backup owners; authoritative system inventory; coverage test; secure register; custodian notice and acknowledgement; subprocessor process; device/export limits; backup disposition; conflict/privilege controls; audit and access controls; periodic certification; and exercised release. Never promise deletion while a valid hold applies; provide the legally approved explanation and preserve data no longer than the hold and governing schedule require.
