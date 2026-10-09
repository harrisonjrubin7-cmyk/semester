# Authorization and Access system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Make every read, command and approval depend on explicit tenant, relationship, role, purpose and policy context.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Policy decisions
- capability grants
- approval duties
- permission receipts

External authority remains:

- Institution HR and role feeds
- institution policy owners

## Authority

- Policy owners publish versioned rules.
- Administrators grant only delegable capabilities within their scope.
- Subjects and auditors may inspect relevant decision receipts.

## Records

- `role_grant`
- `capability_grant`
- `policy_version`
- `policy_decision`
- `approval_duty`

## Commands

- `evaluate_policy`
- `grant_capability`
- `revoke_capability`
- `request_access`

## Events

- `access.allowed`
- `access.denied`
- `grant.issued`
- `grant.revoked`

## Integrations

- Identity
- institution role feed
- policy engine

## Workflows

- Role grant
- Access request
- Emergency elevation
- Periodic access review

## Screens

- Access request
- Role and scope administration
- Decision trail
- Access review

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Actor, subject, tenant, purpose and resource
- Policy version and reasons
- Grant provenance and expiry
- Approval separation

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Security and institutional administration
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Cross-tenant denial
  - Policy evaluation failure
  - Expired grant still in use
- Runbook: `docs/runbooks/authorization.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.authorization.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`
- Capability rows: `CAP-014`

## External activation gates

- Institution role mapping approval
- RLS and policy negative-test evidence
- Named approvers
