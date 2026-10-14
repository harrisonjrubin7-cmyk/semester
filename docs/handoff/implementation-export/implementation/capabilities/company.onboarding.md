# company.onboarding — Customer onboarding

Source-declared design contract, not current implementation proof.

routes: /company/onboarding
actors: implementation_specialist
permissions: project.edit
records: impl.projects, impl.milestones, biz.pilots
commands: open_project
events: project.opened
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
