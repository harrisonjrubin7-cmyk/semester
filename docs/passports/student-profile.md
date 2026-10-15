# Student Profile system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Hold student-controlled preferences and product context without replacing the institution student record.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Display preferences
- accessibility preferences
- student-authored profile fields
- product status overlays

External authority remains:

- Official demographic, enrollment and student-status records

## Authority

- Students edit personal preferences and optional profile fields.
- Institution-fed fields remain read-only and source-labelled.
- Support may correct only through an audited process.

## Records

- `profile`
- `preference`
- `accessibility_setting`
- `student_status_overlay`

## Commands

- `update_profile`
- `set_preference`
- `request_correction`
- `export_profile`

## Events

- `profile.updated`
- `preference.changed`
- `correction.requested`

## Integrations

- Identity
- Consent
- institution student feed

## Workflows

- Profile update
- Source correction request
- Export and deletion

## Screens

- Profile
- Settings
- Accessibility
- Data export

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Changed fields and actor
- Source authority per field
- Correction disposition
- Export/delete receipt

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Student experience and privacy
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/student-profile.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.student-profile.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `consent`
- Capability rows: `CAP-011`, `CAP-016`, `CAP-017`

## External activation gates

- Approved field map and minimization
- Retention and correction process
