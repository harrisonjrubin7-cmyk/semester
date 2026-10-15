# ops.jobs — Background processing

Source-declared design contract, not current implementation proof.

routes: /console/jobs
actors: reliability_engineer
permissions: job.replay
records: ops.jobs, ops.job_attempts, ctl.outbox, opsx.access_jobs
commands: api.replay_job
events: job.replayed
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
