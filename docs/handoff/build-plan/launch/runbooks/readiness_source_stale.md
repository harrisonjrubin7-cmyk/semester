# Runbook: readiness_source_stale

**Capability:** registration_readiness_v1 · **Owner:** pilot operations lead · **Institution contact:** named integration owner (Vanderbilt IT)

## Trigger
Any of: a readiness case has `source_freshness_state = 'stale'`; an `integration_sync_runs` row fails; source age exceeds the term policy threshold (default 6 h).

## Severity
SEV-3 by default. Escalate to **SEV-2** if more than 10% of active readiness cases are affected, or a registration window opens within 48 hours.

## First 15 minutes
1. Acknowledge the alert in the operations inbox.
2. Identify the affected tenant and source system.
3. Pause definitive outcomes for that source. The database already refuses `ready` when the source isn't current; confirm no case is stuck showing an old `ready`.
4. Confirm students and registrar see the stale-source copy: "We can't confirm this right now. Your institution's system hasn't updated since …".
5. Start a reconciliation job (idempotency key = `{tenant}:{source}:{window}`).
6. Notify the named institutional integration owner.

## Diagnose
- Latest `integration_sync_runs` row: status, error, duration.
- Credentials and rate limits (provider dashboard; never paste secrets into the ticket).
- `live_outbox` and `dead_letters` for the source.
- Compare the source watermark to the last successful `freshness_snapshots` row.

## Safe actions
- Retry the sync with the same idempotency key.
- Mark affected cases stale.
- Route time-sensitive cases (window within 48 h) to registrar review.

## Never
- Mark a case `ready` without an authoritative refresh.
- Edit external source data by hand.
- Tell students they're registered or cleared.

## Verify before closing
- Sync run succeeds; freshness snapshot is current.
- Impacted cases re-evaluated (new `evaluation_version`).
- A sample of results matches the source system.
- Audit and incident records complete.
