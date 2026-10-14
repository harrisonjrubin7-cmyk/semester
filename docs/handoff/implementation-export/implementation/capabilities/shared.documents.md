# shared.documents — Documents

Source-declared design contract, not current implementation proof.

routes: /company/documents, /institution/documents
actors: document_owner, reviewer
permissions: document.submit, document.execute, document.archive
records: docs.documents, docs.document_versions, docs.version_states, docs.review_tasks, docs.transition_events, docs.contract_documents, docs.signature_requests, docs.acknowledgments
commands: api.transition_document, acknowledge
events: document.transitioned
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
