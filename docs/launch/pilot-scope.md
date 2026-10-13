# Registration readiness pilot: scope

Status: scope proposed, **not signed off**. Sign-off is a go/no-go gate
(`docs/launch/go-no-go.yaml`, gate `institution.pilot_scope_signed_off`).

## In scope

- Capability `registration_readiness_v1` (`docs/contracts/capabilities.yaml`) behind feature flag `registration_readiness_v1`, default off.
- Students: read their own readiness context, with source labels and freshness (`student.readiness`).
- Registrar staff: a scoped readiness queue and case detail, a decision trail, referrals, and override requests (`registrar.readiness.queue`, `registrar.readiness.case`).
- Source ingestion from the institution adapters with watermarks, idempotency, quarantine and reconciliation.
- Advisors see only their caseload (`advisor_caseload_scope`).

## Out of scope

- Stating that a student is enrolled, registered or cleared. Readiness is not enrollment.
- Editing or replacing a SIS value in Semester.
- Any AI-assisted feature (`docs/architecture/ai-boundary.md`).
- Payments, gradebook, degree audit, native mobile apps.
- Showing unrelated student records to any role.

## Named before launch (not yet known)

| Item | Value | Owner role |
| --- | --- | --- |
| Pilot institution | TBD | institution sponsor |
| Institution owner of source data | TBD | integration_lead |
| Escalation contacts | TBD | support_owner |
| Security owner | TBD | security_owner |
| Registrar product owner | TBD | registrar_product_owner |
