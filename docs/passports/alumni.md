# Alumni system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Preserve portable, student-controlled records and engagement preferences after institutional affiliation changes.

## System relationship

- `native`
- `connected`
- `linked`

## System of record

Semester owns:

- Portable profile
- exported artifacts
- engagement preferences
- alumni context

External authority remains:

- Advancement CRM
- credential issuers
- institution alumni status

## Authority

- Alumni control their portable content and preferences.
- Institutions attest alumni status and official credentials.
- Advancement communications require lawful preference handling.

## Records

- `alumni_profile`
- `portable_artifact`
- `engagement_preference`
- `credential_reference`

## Commands

- `transition_to_alumni`
- `export_portfolio`
- `set_engagement_preference`
- `disconnect_institution`

## Events

- `alumni_context.created`
- `portfolio.exported`
- `preference.changed`
- `institution.disconnected`

## Integrations

- Career
- Documents
- advancement CRM
- credential wallet

## Workflows

- Affiliation transition
- Portable export
- Credential refresh
- Communication preference

## Screens

- Alumni home
- Portable profile
- Credentials
- Data connections

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Transition basis
- Portable-data selection
- Credential source
- Preference and disconnect history

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Lifecycle and career platform
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/alumni.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.alumni.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `student-profile`, `career`, `documents`
- Capability rows: `CAP-053`

## External activation gates

- Alumni-status feed
- Advancement consent and preference contract
- Offboarding and retention approval
