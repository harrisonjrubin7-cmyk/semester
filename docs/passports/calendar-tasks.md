# Calendar and Tasks system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Unify personal plans with source-aware imported dates while preserving correction, offline and confirmation boundaries.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Personal calendar overlays
- tasks
- reminders
- local drafts and sync queue

External authority remains:

- LMS assignments
- institution deadlines
- connected calendar events

## Authority

- Students manage personal items.
- Connected sources own imported facts.
- External writes require preview and explicit confirmation.

## Records

- `calendar_item`
- `task`
- `reminder`
- `sync_intent`
- `conflict`

## Commands

- `create_task`
- `confirm_imported_date`
- `preview_calendar_write`
- `confirm_calendar_write`

## Events

- `task.changed`
- `date.confirmed`
- `calendar_write.requested`
- `calendar_write.reconciled`

## Integrations

- Google Calendar
- Microsoft Calendar
- LMS
- Academic

## Workflows

- Date extraction review
- Reminder delivery
- External write preview and confirmation
- Offline reconciliation

## Screens

- Today
- Calendar
- Task detail
- Week ahead
- Behind plan

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Original source and extracted value
- Student confirmation or correction
- External-write diff
- Delivery and reconciliation state

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Academic experience
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/calendar-tasks.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.calendar-tasks.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `academic`, `integrations`
- Capability rows: `CAP-001`, `CAP-002`, `CAP-003`, `CAP-005`, `CAP-007`, `CAP-008`, `CAP-018`, `CAP-021`

## External activation gates

- Provider-scoped authorization
- Write preview and idempotency
- Honest offline and delivery status
