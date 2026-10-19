# RB-08 · Bad deploy, or a deploy that will not go

Class C2 · role platform · alerts `deploy:ci-red-on-main`, `deploy:functions-failed`, `deploy:stale-release` · components `pipeline:ci`, `pipeline:pages`, `pipeline:functions`.

## Symptom

A release made something worse, or CI is red on main and holds the Pages and function deploys.

## Impact

Production keeps running what it has. A bad release is worse than a held one.

## Diagnose

1. Which layer? Web bundle, edge function, schema or configuration. Rollback speed and method differ by layer.
2. Red CI: read the first failing step, not the last. A failure in the policy checks aborts the transaction and skips what follows, so the count of checks run matters as much as the failure.
3. Check [REGRESSION-CHECKLIST.md](../../../REGRESSION-CHECKLIST.md) for the baseline figures to compare with.

## Mitigate

1. Web: redeploy the previous commit through *Deploy to Pages*. Functions: redeploy through *Deploy Edge Functions* naming the function. Configuration: restore the previous value; configuration is versioned.
2. Schema: **do not roll back.** The schema rolls forward only; fix by a new migration (RB-09 and ROLLBACK.md).
3. A merge that went red: revert it on main, do not leave main red while investigating.
4. Never skip, disable or quarantine a test to get green.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- The previous behaviour is back for a test account.
- CI is green on the latest main commit, including `test:shuffle`.
- `supabase/functions.snapshot` matches what is deployed.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
