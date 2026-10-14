# edu.credentials — Credentials

Source-declared design contract, not current implementation proof.

routes: /app/credentials, /verify/:id
actors: student, verifier
permissions: credential.share
records: cred.credentials, cred.verification_records
commands: api.share_credential
events: credential.verified
screen_types: list, detail

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
