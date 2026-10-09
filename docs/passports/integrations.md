# Integrations system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Connect external authorities through tenant-scoped, versioned mappings with freshness, retries and reconciliation.

## System relationship

- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Connector configuration references
- mapping versions
- sync state
- reconciliation tasks

External authority remains:

- SIS, LMS, identity, calendar, file, finance and campus providers

## Authority

- Tenant administrators approve scopes.
- Integration operators manage health without unrestricted record access.
- Source systems retain declared authority.

## Records

- `connection`
- `credential_reference`
- `mapping_version`
- `sync_cursor`
- `reconciliation_task`

## Commands

- `connect_provider`
- `rotate_credential`
- `run_sync`
- `retry_delivery`
- `reconcile_source`

## Events

- `connection.changed`
- `sync.started`
- `sync.failed`
- `source.stale`
- `reconciliation.completed`

## Integrations

- All approved external providers through connector passports

## Workflows

- Connector setup
- Credential rotation
- Pull/push sync
- Failure recovery
- Reconciliation

## Screens

- Connected accounts
- Integration center
- Mapping review
- Operations queue

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Tenant and scopes
- Credential reference only
- Mapping and adapter versions
- Counts, failures and reconciliation

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Integration operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Credential failure
  - Freshness threshold breach
  - Dead-letter growth
  - Reconciliation mismatch
- Runbook: `docs/runbooks/integrations.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.integrations.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `operations`
- Capability rows: `CAP-013`

## External activation gates

- Provider agreement and credentials
- Sandbox contract tests
- Payload redaction and incident runbook
