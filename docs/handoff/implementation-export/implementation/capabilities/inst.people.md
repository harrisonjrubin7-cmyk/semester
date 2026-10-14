# inst.people — People administration

Source-declared design contract, not current implementation proof.

routes: /institution/directory
actors: institution_admin
permissions: membership.invite
records: core.profiles, iam.memberships, iam.invitations
commands: api.issue_invitation
events: invitation.issued
screen_types: list, detail, edit

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
