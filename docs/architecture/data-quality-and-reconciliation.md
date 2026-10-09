# Data quality and reconciliation

Status: Phase A operating contract; existing implementation is partial.

## Current foundation

Integration mappings, sync runs, discrepancy workflow, provenance/source labels, approved-source policy and reconciliation SQL exist. The production adapter registry is empty, so these are repository capabilities rather than proof of live provider quality.

## Required record contract

Every imported or derived record carries tenant, source type/system, connection, external ID, canonical entity type, source and ingestion timestamps, sync run, source version, classification, lifecycle, freshness, confidence where derived, and correlation/audit reference. External identity is keyed by tenant, connection, source system, external ID, and canonical entity type so multiple connections or reused provider IDs cannot collapse distinct records.

## Quality controls

- Versioned data contracts and backward-compatibility policy.
- Validation at ingest, canonicalization and presentation.
- Duplicate person/course/section detection without email-only identity linking.
- Tenant/provider quality score: freshness, completeness, validity, reconciliation and error rate.
- Assigned exception queue with SLA, reason, before/after values and audit.
- Source-of-truth conflict rules: SIS/LMS win their official domains; Semester preserves manual work without silently overwriting authority.
- Safe replay/backfill, idempotency, watermarking and reconciliation after rollback.
- User-facing “report incorrect information” and human-readable lineage.

## Gap matrix

| Area | State | Missing evidence |
| --- | --- | --- |
| Schema/mapping registry | Partial | Live provider contract and change history |
| Sync/reconciliation | Partial | Production run, replay and exception SLA |
| Provenance/freshness | Partial | Uniform presentation across all routes |
| Identity resolution | Partial | Operational duplicate-resolution workflow and institutional approval |
| Quality metrics | Partial | Live tenant baselines, dashboard and alert thresholds |
| Corrections | Partial | Universal authorized correction/appeal experience |

No imported capability may be called live until a named data owner accepts its quality thresholds and a failed/stale source produces an honest user fallback.
