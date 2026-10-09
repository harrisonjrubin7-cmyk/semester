# Registration system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Evaluate readiness and coordinate bounded enrollment requests without claiming success before the authoritative SIS reconciles.

## System relationship

- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Readiness projection
- proposed schedule
- request workflow
- receipts and reconciliation tasks

External authority remains:

- SIS enrollment, holds, prerequisites, time tickets and seat state

## Authority

- Students prepare and confirm requests.
- Advisors review permitted exceptions.
- Registrars approve overrides and reconcile outcomes.
- The SIS decides official enrollment.

## Records

- `readiness_evaluation`
- `registration_request`
- `readiness_fact`
- `override`
- `registration_receipt`

## Commands

- `evaluate_readiness`
- `submit_registration_request`
- `approve_override`
- `cancel_request`
- `reconcile_enrollment`

## Events

- `readiness.evaluated`
- `registration.submitted`
- `override.decided`
- `registration.reconciled`

## Integrations

- SIS registration adapter
- Degree
- Academic
- Advising

## Workflows

- Registration readiness
- Enrollment request
- Override
- Cancellation
- Reconciliation

## Screens

- Student readiness checklist
- Schedule builder
- Advisor review
- Registrar queue
- Receipt

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Input facts and freshness
- Policy decision
- Approval separation
- Idempotency key
- SIS result and reconciliation

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Registrar platform and integration operations
- Service level: Define readiness and registration-window SLOs with the pilot institution.
- Alerts:
  - Stale readiness fact
  - SIS request uncertainty
  - Reconciliation backlog
- Runbook: `docs/runbooks/registration.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.registration.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `academic`, `degree`, `integrations`, `operations`
- Capability rows: `CAP-050`

## External activation gates

- Approved SIS read adapter before pilot claims
- Separate write authorization
- Tenant UAT and rollback rehearsal
