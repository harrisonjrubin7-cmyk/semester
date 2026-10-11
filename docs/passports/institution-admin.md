# Institution Administration system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Manage tenant policy, configuration, integrations and release evidence without granting ambient access to student content.

## System relationship

- `native`
- `connected`
- `orchestrated`

## System of record

Semester owns:

- Tenant configuration
- policy assignments
- activation evidence
- integration health projection

External authority remains:

- Institution governance, contracts and accountable approvers

## Authority

- Institution administrators configure within delegated scope.
- Independent approvers authorize high-risk activation.
- Operators see metadata, not student content, unless purpose and policy allow.

## Records

- `tenant_config`
- `policy_assignment`
- `activation_record`
- `release_approval`

## Commands

- `update_tenant_config`
- `request_activation`
- `approve_activation`
- `suspend_capability`

## Events

- `tenant_config.changed`
- `activation.requested`
- `activation.decided`
- `capability.suspended`

## Integrations

- Authorization
- Integrations
- Operations
- release evidence

## Workflows

- Configuration change
- Capability activation
- Access review
- Tenant offboarding

## Screens

- Institution console
- Configuration Studio
- Approvals
- Integration health
- Release evidence

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Before/after configuration
- Approvers and separation of duties
- Evidence versions
- Activation and suspension receipt

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Institution platform and implementation
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/institution-admin.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.institution-admin.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `integrations`, `operations`
- Capability rows: `CAP-012`, `CAP-013`

## External activation gates

- Executed tenant agreement
- Named accountable owners
- Tenant UAT and signed activation
