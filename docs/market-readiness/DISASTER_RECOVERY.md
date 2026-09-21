# Disaster Recovery

**Status: `NOT_STARTED`**

## The honest position

Supabase takes platform backups on the project's plan. **We have never restored
one.** Until a restore has been performed and timed, this repository has no
RPO or RTO — it has an assumption.

Do not publish an RPO or RTO figure derived from a vendor's marketing page. A
recovery objective is a measurement of a procedure that has been run.

## What has to happen before any number is stated

1. Confirm the backup frequency and retention the project's plan actually gives
2. Restore into a scratch project
3. Time it end to end
4. Verify the restore: run `supabase/check.sh`'s suites against the restored
   database, not just check that it starts
5. Record the measured figures here

## Scope beyond the database

A full recovery is not only Postgres:

| Component | Recovery path | State |
| --- | --- | --- |
| Database | Supabase backup restore | Untested |
| SPA | Rebuild from git and redeploy to Pages | Reproducible, effectively instant |
| Gateway journal | SQLite file, AES-256-GCM, single host | **No backup strategy at all** |
| Secrets | Re-provisioned from the secret store | Documented in `SECRETS.md` |

**The gateway journal is the sharpest risk.** It is a single-host SQLite file
recording actions that may or may not have reached a university. Losing it
loses the evidence of what was attempted, which is precisely the thing it
exists to preserve — and unlike the database, nothing backs it up.

## Next

Back up the journal before anything else here. It is the only component whose
loss is unrecoverable rather than merely slow.
