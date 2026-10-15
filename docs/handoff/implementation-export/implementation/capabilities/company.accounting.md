# company.accounting — Accounting

Source-declared design contract, not current implementation proof.

routes: /company/ledger, /company/close
actors: accountant
permissions: journal.post, close.run
records: fin.ledger_accounts, fin.ledger_journals, fin.ledger_lines
commands: api.post_journal
events: journal.posted
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
