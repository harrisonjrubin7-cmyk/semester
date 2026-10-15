# company.expenses — Expenses

Source-declared design contract, not current implementation proof.

routes: /company/expenses
actors: employee, finance_approver
permissions: expense.submit, expense.approve
records: cofin.expense_claims, comms.files
commands: api.submit_claim, api.approve_claim
events: claim.approved
screen_types: list, detail, edit, review

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
