# Finance and Billing system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Explain charges, plans and requests while regulated payment rails and the institutional ledger remain authoritative.

## System relationship

- `connected`
- `orchestrated`
- `embedded`
- `linked`

## System of record

Semester owns:

- Billing display projection
- planning assumptions
- request workflow
- receipts

External authority remains:

- Institution ledger
- payment processor
- bursar decisions

## Authority

- Students and authorized payers view permitted balances.
- Finance staff approve adjustments and payment plans.
- Processors execute regulated settlement.

## Records

- `ledger_projection`
- `charge_reference`
- `payment_plan_request`
- `transaction_receipt`

## Commands

- `refresh_balance`
- `request_payment_plan`
- `preview_payment`
- `submit_payment_handoff`
- `reconcile_ledger`

## Events

- `balance.refreshed`
- `payment_plan.requested`
- `payment.handed_off`
- `ledger.reconciled`

## Integrations

- Bursar system
- payment processor
- Family

## Workflows

- Balance review
- Payment-plan request
- Payment handoff
- Refund or adjustment approval
- Reconciliation

## Screens

- Money
- Charge detail
- Payment-plan request
- Payer view
- Receipt

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Ledger source/version
- Payer authority
- Previewed amount
- Processor reference
- Reconciliation result

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Finance operations
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Ledger mismatch
  - Duplicate or uncertain transaction
  - Stale balance at action time
- Runbook: `docs/runbooks/finance.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.finance.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `family`, `integrations`
- Capability rows: `CAP-046`

## External activation gates

- Finance-owner approval
- PCI-scoped processor design
- Concurrency, idempotency and reconciliation testing
