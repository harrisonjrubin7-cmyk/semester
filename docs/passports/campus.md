# Campus Services system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Discover and prepare bounded campus-service actions without absorbing each service system of record.

## System relationship

- `native`
- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Service directory
- personal plans and preferences
- request projections
- safe handoffs

External authority remains:

- Housing, dining, facilities, athletics, maps and service providers

## Authority

- Students manage personal plans.
- Service staff decide official eligibility and fulfillment.
- Actions use the owning service workflow.

## Records

- `service`
- `place`
- `event_reference`
- `service_request`
- `preference`

## Commands

- `find_service`
- `prepare_request`
- `submit_handoff`
- `cancel_local_plan`

## Events

- `service.viewed`
- `request.prepared`
- `handoff.completed`

## Integrations

- Campus card
- housing
- maps
- facilities
- athletics

## Workflows

- Service discovery
- Request preparation
- Official handoff
- Issue escalation

## Screens

- Campus services
- Meal plan
- Housing
- Maps
- Athletics

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Service source and status
- Scope of disclosed data
- Action preview
- Handoff result

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Campus experience and partner operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/campus.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.campus.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `integrations`
- Capability rows: `CAP-042`, `CAP-043`, `CAP-047`, `CAP-048`, `CAP-049`

## External activation gates

- Service-owner agreement
- Approved adapter or trusted link
- No sample-data live claim
