# RB-10 · A scheduled job is not running

Class C1 to C3, by job · role per job · alerts `job:absent`, `job:integrity-failed` · components every `job:*`.

## Symptom

`supabase/health.sql` block 6 reports a job missing or stale, or an integrity job reports a break.

## Impact

Depends on the job: retention and integrity jobs (C1) mean a retention promise is being missed or a broken audit chain would go unnoticed; reminder and integration jobs mean late work.

## Diagnose

1. List the jobs with `select jobname, schedule, active from cron.job` and compare with `supabase/scheduler.sql`. A `cron.schedule` of the same name replaces, so re-running the file is safe.
2. Check the run history for the job (`cron.job_run_details`) for the last status and message.
3. Parked jobs (`escalation-delivery`, `media-scan`) are `active = false` by design until their functions are deployed; they are not faults.
4. Check the Vault token the job reads at run time: a rotated token that was not updated makes every function-calling job fail.

## Mitigate

1. Re-apply the job from `supabase/scheduler.sql`. Fix the token in Vault if that was the cause.
2. Run the job's function or RPC by hand once to confirm it works before trusting the schedule.
3. An integrity failure (`console_audit_verify()` or the ledger chain check) is P1 at least: preserve the evidence and do not repair the chain by hand.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- The job's next scheduled run succeeds and shows in the run history.
- Block 6 shows every expected job scheduled.
- For retention jobs, a hold-aware sweep ran and left held rows alone.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
