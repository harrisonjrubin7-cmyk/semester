# shared.ai.gateway — AI gateway

Source-declared design contract, not current implementation proof.

routes: /app/assistant
actors: student, instructor
permissions: ai.use
records: core.ai_policy, core.course_ai_rules, core.sources, audit.ai_usage
commands: api.ai_policy, api.ai_context, api.ai_log
events: ai.answered
screen_types: detail, settings

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
