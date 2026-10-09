# Grades system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Support drafts, review and controlled release while the institution retains official grade and transcript authority.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Draft grade work
- release workflow
- student-view projection
- reconciliation receipt

External authority remains:

- Instructor final judgment
- LMS gradebook where authoritative
- SIS transcript system

## Authority

- Faculty draft and review grades.
- Required approvers release a batch.
- Students view only authorized released or clearly pending results.

## Records

- `grade_draft`
- `rubric_result`
- `grade_batch`
- `release_receipt`

## Commands

- `save_grade_draft`
- `submit_grade_batch`
- `approve_release`
- `publish_grade`
- `reconcile_grade`

## Events

- `grade.drafted`
- `grade.submitted`
- `grade.released`
- `grade.reconciled`

## Integrations

- LMS gradebook
- SIS grade transfer
- Academic

## Workflows

- Grade drafting
- Second approval
- Release
- SIS sync and reconciliation

## Screens

- Faculty gradebook
- Release preview
- Approval queue
- Student grade view

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Rubric and source inputs
- Human review
- Release authority
- Sync and reconciliation result

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Academic operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Unauthorized release attempt
  - Grade sync failure
  - Reconciliation mismatch
- Runbook: `docs/runbooks/grades.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.grades.enabled`

## Dependencies and capability coverage

- System dependencies: `academic`, `authorization`, `integrations`
- Capability rows: `CAP-009`

## External activation gates

- Faculty and registrar approval of the workflow
- Grade privacy and accommodation tests
- Target LMS/SIS acceptance
