# Community and Communication system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Support groups, events and communication with membership, moderation, safety and delivery truth.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Group workspace
- event planning
- moderation workflow
- message delivery projection

External authority remains:

- Institution membership sources
- approved mail, meeting and messaging providers

## Authority

- Members communicate within verified groups.
- Moderators act under published rules.
- Students control optional participation and reporting.

## Records

- `community`
- `membership`
- `event`
- `conversation`
- `moderation_case`

## Commands

- `join_community`
- `create_event`
- `send_message`
- `report_content`
- `moderate_content`

## Events

- `membership.changed`
- `event.published`
- `message.delivered`
- `content.reported`
- `moderation.decided`

## Integrations

- Institution group feed
- mail
- video
- messaging

## Workflows

- Membership verification
- Event publication
- Message delivery
- Report and moderation
- Appeal

## Screens

- Clubs and activities
- Group work
- Email
- Chat
- Video call

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Membership proof
- Delivery status
- Moderation reasons
- Appeal and safety actions

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Community trust and safety
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Safety escalation
  - Provider delivery failure
  - Moderation SLA breach
- Runbook: `docs/runbooks/community.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.community.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `consent`, `integrations`
- Capability rows: `CAP-026`, `CAP-051`, `CAP-057`, `CAP-058`, `CAP-059`, `CAP-060`

## External activation gates

- Verified membership source
- Moderation and safety staffing
- Approved communication provider
