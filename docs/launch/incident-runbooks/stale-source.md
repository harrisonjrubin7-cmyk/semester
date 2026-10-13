# Runbook: stale or failed institutional source (RSK-001)

Trigger: a source's `freshness` is `stale`, `failed` or `unknown` (see `docs/architecture/source-freshness-policy.md`), or readiness results are being produced from data older than the class limit.

1. **Stop definitive results.** Confirm `block_definitive_result` is in effect for the affected source (`readiness_evaluation` action rules). If not, disable the flag for the tenant.
2. **Mark stale.** Confirm the affected screens show the stale copy with `observed_at`.
3. **Trigger reconciliation.** Open a reconciliation item for the source and run the adapter's `reconcile` method. Record the run in the audit log (`reconciliation.opened`).
4. **Notify the institution owner** named in `pilot-scope.md`, with the source, the last watermark and the time since last update.
5. **Resume** only when the source is `current` again and a fresh evaluation has completed. Do not replay old results as current.

Evidence to keep: alert timestamp, watermark before and after, audit event ids, the institution notice.
