# inst.governance — Academic governance

Source-declared design contract, not current implementation proof.

routes: /institution/proposals
actors: department_chair
permissions: proposal.review, proposal.approve
records: gov.proposals, gov.votes
commands: api.submit_proposal, api.record_vote
events: proposal.approved
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
