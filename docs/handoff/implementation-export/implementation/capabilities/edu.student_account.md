# edu.student_account — Student accounts

Source-declared design contract, not current implementation proof.

routes: /app/account
actors: student
permissions: self.read
records: instfin.student_accounts, instfin.charges, acad.holds
commands: 
events: 
screen_types: overview, detail

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
