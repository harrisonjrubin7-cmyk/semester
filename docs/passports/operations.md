# Operations system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Route incidents, exceptions, approvals and reconciliation through bounded queues with ownership and receipts.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Queue items
- ownership and SLA
- incident state
- decision trail
- release evidence index

External authority remains:

- Paging, ticketing and provider status systems where configured

## Authority

- Operators act only on assigned, purpose-limited work.
- Approvers remain distinct where policy requires.
- Sensitive content is minimized or redacted by default.

## Records

- `queue_item`
- `incident`
- `escalation`
- `decision`
- `release_evidence`

## Commands

- `claim_queue_item`
- `escalate_item`
- `record_decision`
- `resolve_incident`
- `request_release_approval`

## Events

- `queue_item.created`
- `queue_item.escalated`
- `incident.declared`
- `decision.recorded`
- `incident.resolved`

## Integrations

- Outbox
- notification engine
- paging
- ticketing
- all domain workflows

## Workflows

- Exception handling
- Incident command
- Approval
- Reconciliation
- Release decision

## Screens

- Operations inbox
- Incident command
- Approval queue
- Dead letters
- Release control

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Source workflow and reason
- Owner and SLA history
- Decision authority
- Receipt and resolution evidence

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Operations and SRE
- Service level: Queue-specific SLOs and incident severities are required before activation.
- Alerts:
  - Unowned P0/P1 item
  - SLA breach
  - Dead-letter growth
  - Incident communication gap
- Runbook: `docs/runbooks/operations.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.operations.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`
- Capability rows: `CAP-002`, `CAP-014`

## External activation gates

- Staffed rota and escalation tree
- Exercised incident and rollback runbooks
- Content-minimization review
