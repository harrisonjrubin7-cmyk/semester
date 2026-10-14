# shared.authz.approvals — Workflows

Source-declared design contract, not current implementation proof.

routes: /app/approvals, /ops/approvals
actors: approver
permissions: action.request, action.approve
records: ctl.action_requests, ctl.action_approvals
commands: api.request_action, api.decide_action, api.execute_action
events: action.requested, action.approved, action.executed
screen_types: list, detail, review, history

## Acceptance
- authorized complete job loop
- tenant/object negative access
- expiry/revocation enforcement
- source authority and freshness
- approval target/payload/version binding
- idempotent durable command
- outbox replay/reconciliation
- seven data-region states
- manual accessibility review
- exact-target deployment and applicable authority acceptance

Reconcile existing code and authority before adding or applying schemas. Production activation disabled.
