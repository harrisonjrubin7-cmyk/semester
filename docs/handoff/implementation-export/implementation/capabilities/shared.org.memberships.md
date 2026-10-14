# shared.org.memberships — Memberships

Source-declared design contract, not current implementation proof.

routes: /institution/members, /invite/*
actors: institution_admin
permissions: membership.invite, membership.revoke
records: core.profiles, iam.invitations, iam.memberships
commands: api.issue_invitation, api.accept_invitation, api.revoke_invitation
events: invitation.issued, invitation.accepted, invitation.revoked
screen_types: list, detail, edit, history

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
