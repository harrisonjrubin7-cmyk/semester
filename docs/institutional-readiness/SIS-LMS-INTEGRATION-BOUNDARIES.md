# SIS and LMS Integration Boundaries

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BOUNDARY — MOCK/PROTOCOL EVIDENCE PRESENT; NO LIVE SIS/LMS CONNECTION** |
| Owner | Harrison Rubin — company-side integration owner; customer registrar, LMS administrator, data steward and support backups unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../INTEGRATION-DATA-PIPELINE-AUDIT.md`](../INTEGRATION-DATA-PIPELINE-AUDIT.md), [`../INTEGRATION-PERMISSION-MATRIX.md`](../INTEGRATION-PERMISSION-MATRIX.md), and [`../LMS-INTEROPERABILITY-MATRIX.md`](../LMS-INTEROPERABILITY-MATRIX.md) |

## Authority model

The institution's designated SIS/registrar remains authoritative for identity-linked academic records, enrollment, program/term/catalog, registration windows and holds. The designated LMS remains authoritative for course context, official assignments/submissions and official grades unless a later executed agreement and accepted migration explicitly changes that boundary. Semester may display or transform approved information; it does not silently become a system of record.

## Direction and write boundary

| Flow | Default | Conditions for any exception |
| --- | --- | --- |
| manual/synthetic setup → Semester | allowed only under approved operator/data procedure | minimum data, reconciliation, access, deletion, support and acceptance |
| SIS → Semester | manual or read-only first | target adapter, field/scope approval, security/privacy, freshness, reconciliation and UAT |
| Semester → SIS | prohibited | separately designed write contract, record authority, preview/approval, idempotency, reconciliation, rollback and customer acceptance |
| LMS LTI launch → Semester | sandbox after bound registration and accepted claims/context | tenant isolation, role/context, failure, monitoring and support tests |
| LMS/API → Semester | unavailable until a real adapter is approved | exact endpoints/scopes, rate limits, mapping, drift, reconciliation and provider sandbox evidence |
| Semester → LMS grade via AGS | off for the initial wedge by default | bound tenant, authorized scope/connection, human-confirmed workflow, audit, reconciliation, exceptions, kill switch and customer acceptance |
| OneRoster/NRPS | unavailable | implementation and target-specific approval required |

## Data boundaries

- Collect only the fields required for the approved workflow; use opaque identifiers where possible.
- Do not ingest grades, submissions, accommodations, discipline, financial amounts, health/safety, free text or demographic traits merely because a provider exposes them.
- Every displayed institutional fact must identify source and freshness; stale, estimated or unavailable data must not appear as current official truth.
- Mapping changes require version, simulation, independent approval and rollback. Schema drift holds affected data rather than guessing.
- Duplicates and mismatches go to a sanitized exception workflow; resolution is human-reviewable and reversible.
- A drop, deprovision or term transition changes access according to the approved policy and never silently deletes student-created work.
- Credentials remain secret-manager references; connection metadata and records stay tenant-scoped with least-privilege access and audit.

## Degraded and failure behavior

On timeout, throttling, schema drift, stale data, bad signature, authorization failure or partial batch: stop unsafe writes; preserve the last accepted state where authorized; label source/freshness; quarantine invalid records; alert the named owner; expose the approved official-system/support route; retry only idempotently within the provider limit; and reconcile before returning to normal. Kill, pause, revoke, disconnect, rollback and deletion paths must be exercised before activation.

## Target acceptance record

Record the named systems/environments/versions; authoritative owners; data purpose/fields/classification; legal/contract authority; endpoints/scopes/credentials; mapping and direction; cadence/freshness; rate limits; reconciliation and error thresholds; support/incident routing; retention/deletion/export; security/privacy/accessibility reviews; sandbox results; residual risks; customer acceptance; production change authority; activation time; and review/expiry.

## Evidence state

**Repository evidence.** Mock SIS/campus adapters, an empty production adapter registry, integration contracts, permissions, pipeline controls, freshness/reconciliation mechanisms, LTI implementation and write gates are documented/tested at differing levels.

**Operational evidence.** No real SIS adapter, institutional LMS/API sync, live credentials, observed production exchange, measured provider limits, operated reconciliation, customer acceptance or system-of-record migration is evidenced.

**Missing test/proof.** Validate one named provider sandbox end to end with approved synthetic data: auth, tenant/role isolation, minimum fields, mapping/drift, rate limits/retry, freshness, duplicates, partial failure, reconciliation, kill/rollback, monitoring, support and deletion; obtain each accountable owner’s acceptance.

## Claim ceiling

Semester may describe its repository-tested boundaries and proposed read-only-first integration approach. The SIS/LMS remain authoritative unless and until a specifically accepted migration changes that fact.

## Prohibited claims

Do not claim a live SIS/LMS connection, official-record authority, production synchronization, real-time freshness, universal vendor compatibility, automatic/safe grade passback, OneRoster/NRPS support, completed migration, customer acceptance or institutional activation.
