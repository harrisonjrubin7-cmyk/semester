# Identity system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Resolve a person, account, institution and active context without merging people by convenience identifiers.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Semester account
- session and device state
- active tenant and role context
- identity-resolution receipts

External authority remains:

- Institution identity provider
- institutional person and affiliation feeds

## Authority

- A person may view and recover their account.
- Institution identity administrators may provision or suspend scoped affiliations.
- No role may merge people without reviewed evidence and an audit receipt.

## Records

- `person`
- `person_alias`
- `account`
- `session`
- `affiliation`
- `active_context`

## Commands

- `resolve_identity`
- `switch_context`
- `link_identity`
- `revoke_session`

## Events

- `identity.resolved`
- `context.changed`
- `affiliation.changed`
- `session.revoked`

## Integrations

- OIDC
- SAML
- SCIM
- institution directory

## Workflows

- Account recovery
- Identity link review
- Institution context change
- Deprovisioning

## Screens

- Sign in
- Account and sessions
- Workspace switcher
- Recovery

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Resolution inputs and decision
- Provider and policy version
- Context changes
- Session and affiliation revocations

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Identity and security
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Sign-in failure spike
  - Ambiguous identity resolution
  - Deprovisioning failure
- Runbook: `docs/runbooks/identity.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.identity.enabled`

## Dependencies and capability coverage

- System dependencies: None.
- Capability rows: `CAP-010`

## External activation gates

- Owned-domain identity configuration
- Tenant mapping approval
- Live SSO and deprovision acceptance
