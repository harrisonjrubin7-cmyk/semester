# Consent and Delegation system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Let a person grant, inspect and revoke specific uses or disclosures with immediate, verifiable enforcement.

## System relationship

- `native`
- `orchestrated`

## System of record

Semester owns:

- Consent and delegation scopes
- history
- revocation workflow
- access receipts

External authority remains:

- Institution consent policy
- downstream processors enforcing delegated access

## Authority

- The data subject grants and revokes where law and policy allow.
- Privacy staff resolve exceptional or legally constrained requests.
- Delegates can use only named data, purpose and duration.

## Records

- `consent`
- `delegation`
- `disclosure_receipt`
- `revocation_task`

## Commands

- `grant_consent`
- `issue_delegation`
- `revoke_consent`
- `export_consent_history`

## Events

- `consent.granted`
- `delegation.used`
- `consent.revoked`
- `revocation.enforced`

## Integrations

- Authorization
- Family
- AI gateway
- connected providers

## Workflows

- Consent grant
- Delegation acceptance
- Revocation and downstream enforcement
- Disclosure review

## Screens

- Privacy center
- Sharing and delegation
- Access history
- Revocation receipt

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Exact scope, purpose and expiry
- Policy and disclosure basis
- Every delegated read
- Downstream revocation result

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Privacy
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Revocation enforcement delay
  - Disclosure outside scope
  - Expired delegation use
- Runbook: `docs/runbooks/consent.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.consent.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`
- Capability rows: `CAP-015`

## External activation gates

- Counsel-approved consent basis
- Processor enforcement contract
- Revocation race and duplicate-event testing
