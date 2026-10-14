# company.contracts — Contract lifecycle

Source-declared design contract, not current implementation proof.

routes: /company/contracts
actors: legal_operator
permissions: contract.edit, contracts:sign
records: biz.contracts, docs.document_versions, docs.signature_requests, docs.signature_evidence
commands: record_signature
events: contract.signed
screen_types: list, detail, edit, review, history

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
