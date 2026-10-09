# Family and Supporters system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Provide time-bounded, category-specific delegated access chosen by the student.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Invitation
- delegated categories and expiry
- access history
- revocation receipt

External authority remains:

- Institution payer or supporter relationship where required
- student consent

## Authority

- Students grant and revoke access.
- Supporters use only accepted scopes.
- Institution staff resolve verified relationship exceptions.

## Records

- `supporter`
- `family_invitation`
- `family_grant`
- `family_access_event`

## Commands

- `invite_supporter`
- `accept_invitation`
- `grant_family_access`
- `revoke_family_access`

## Events

- `supporter.invited`
- `family_access.granted`
- `family_access.used`
- `family_access.revoked`

## Integrations

- Consent
- Identity
- Finance

## Workflows

- Invitation and verification
- Grant acceptance
- Scoped access
- Immediate revocation

## Screens

- Family sharing
- Supporter view
- Access history
- Revocation receipt

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Verified recipient
- Exact categories and expiry
- Every disclosure
- Revocation enforcement

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Privacy and institutional services
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Revoked access attempt
  - Expired grant use
  - Disclosure outside category
- Runbook: `docs/runbooks/family.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.family.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `consent`
- Capability rows: `CAP-041`

## External activation gates

- Institution and counsel approval
- Relationship verification
- Revocation and disclosure negative tests
