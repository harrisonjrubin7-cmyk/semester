# ops.ai — AI operations

Source-declared design contract, not current implementation proof.

routes: /console/ai
actors: ai_operator
permissions: ai.configure
records: core.ai_policy, audit.ai_usage, ai.model_configs, ai.evaluations
commands: publish_prompt, run_evaluation
events: evaluation.completed
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
