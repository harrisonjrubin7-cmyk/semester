# Runbook: dead-lettered evaluation or quarantined source record

Trigger: a `readiness_evaluation` reaches `dead_lettered`, or a `source_ingest_and_reconcile` item stays `quarantined` or `reconciling` past its class limit.

1. **Read the failure** in the job record and the audit event. Do not replay blindly.
2. **Check the last completed result.** It stays visible labelled stale; confirm no empty ready state is shown (`workflows.yaml` safe_failure).
3. **Fix the cause** (bad input, adapter mapping, timeout). If the fix is in the adapter, add a test first.
4. **Replay** the dead-lettered item once. The idempotency key prevents duplicate application; confirm the result carries the original key.
5. **Late results:** if a superseded run finishes later, confirm it is recorded to audit and not applied.
6. **Close** the reconciliation item with the resolution and the source watermark it was resolved against.

Evidence: job id, idempotency key, audit event ids before and after replay.
