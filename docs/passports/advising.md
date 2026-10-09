# Advising system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Coordinate student-controlled agendas, appointments, referrals and support workflows without hidden risk scoring.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Meeting agenda
- student-visible plan
- referral workflow
- permitted caseload projection

External authority remains:

- Institution advising record where required
- assigned-advisor relationships
- support-service disposition

## Authority

- Students control agenda inputs and visibility.
- Assigned advisors act within relationship scope.
- Support offices own their case outcomes.

## Records

- `advisor_assignment`
- `meeting_agenda`
- `success_plan`
- `referral`

## Commands

- `prepare_agenda`
- `request_appointment`
- `create_referral`
- `close_referral`

## Events

- `agenda.shared`
- `appointment.requested`
- `referral.created`
- `referral.closed`

## Integrations

- Calendar
- Academic
- Campus services
- institution advising system

## Workflows

- Meeting preparation
- Appointment
- Referral
- Case escalation

## Screens

- Student agenda
- Advisor workspace
- Referral status
- Support handoff

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Relationship and purpose
- Student-visible reason
- Shared fields
- Referral decisions and receipts

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Student success
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/advising.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.advising.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `academic`, `calendar-tasks`
- Capability rows: `CAP-006`, `CAP-019`

## External activation gates

- Approved advising relationship feed
- No surveillance or hidden risk score
- Human support ownership
