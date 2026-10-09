# Company OS system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Run Semester company work on shared governed primitives while keeping company, institution and student data boundaries distinct.

## System relationship

- `native`
- `connected`
- `orchestrated`
- `linked`

## System of record

Semester owns:

- Internal pipeline and customer-success projections
- implementation projects
- decision records
- internal metrics definitions

External authority remains:

- Accounting, banking, payroll, legal, CRM and contract systems initially

## Authority

- Company staff act within named seats and least privilege.
- Finance, legal and security approvals remain separated.
- Institution and student records are unavailable without a scoped operational purpose.

## Records

- `account`
- `opportunity`
- `implementation_project`
- `vendor`
- `contract_reference`
- `company_metric`

## Commands

- `update_pipeline`
- `create_implementation_project`
- `request_contract_approval`
- `review_vendor`

## Events

- `opportunity.changed`
- `implementation.started`
- `contract.approval_requested`
- `vendor.reviewed`

## Integrations

- CRM
- accounting
- contract management
- support
- analytics

## Workflows

- Sales handoff
- Customer implementation
- Contract approval
- Vendor review
- Investor reporting

## Screens

- Company command center
- Pipeline
- Customer success
- Contracts
- Vendor management

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Seat and purpose
- Source-system references
- Approval chain
- Metric definition/version

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Company operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/company-os.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.company-os.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `operations`
- Capability rows: None directly; this is a shared or future system boundary.

## External activation gates

- Named company seats
- Approved source systems and contracts
- Separate tenant/data boundary verification
