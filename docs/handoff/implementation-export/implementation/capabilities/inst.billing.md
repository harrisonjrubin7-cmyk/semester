# inst.billing — Institution billing

Source-declared design contract, not current implementation proof.

routes: /institution/billing
actors: student_account_specialist
permissions: charge.adjust, refund.approve
records: instfin.student_accounts, instfin.charges, fin.refund_requests, fin.refund_approvals
commands: api.approve_refund
events: refund.approved
screen_types: list, detail, review

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
