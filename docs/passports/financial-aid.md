# Financial Aid system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Present a source-aware student view and queue without calculating or deciding official aid.

## System relationship

- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Student-facing projection
- document checklist
- question and review workflow

External authority remains:

- Financial-aid system of record
- authorized aid officers
- federal and institutional rules

## Authority

- Students view and supply requested material.
- Aid officers decide awards and verification.
- Semester never estimates an award as official.

## Records

- `aid_projection`
- `requirement_reference`
- `document_request`
- `review_task`

## Commands

- `refresh_aid_status`
- `submit_document_reference`
- `request_review`

## Events

- `aid_status.refreshed`
- `document.submitted`
- `review.requested`

## Integrations

- Financial-aid system
- Documents
- Finance

## Workflows

- Requirement checklist
- Document handoff
- Officer review
- Status reconciliation

## Screens

- Aid overview
- Requirement detail
- Document handoff
- Officer queue

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Source/version and retrieval time
- Document scope
- Officer decision reference
- Student-facing status changes

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Financial-aid operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/financial-aid.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.financial-aid.enabled`

## Dependencies and capability coverage

- System dependencies: `finance`, `documents`, `integrations`
- Capability rows: None directly; this is a shared or future system boundary.

## External activation gates

- Aid-office approval
- Regulatory and counsel review
- No award prediction or autonomous decision
