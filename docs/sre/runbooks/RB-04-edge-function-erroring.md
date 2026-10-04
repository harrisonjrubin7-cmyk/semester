# RB-04 · An edge function is erroring

Class C0 to C3, by function · role per catalog row · alerts `edge:error-shape`, `burn:privacy_request_intake` · components `supabase-edge-runtime` and every `fn:*`.

## Symptom

One function returns errors, or the logs show the same error repeating.

## Impact

Depends on the function: see its row in the [catalog](../generated/SERVICE-CATALOG.md) for what a student sees and what still works. Every function fails closed with a reference the student can quote.

## Diagnose

1. Dashboard → Logs → Edge Functions, errors only, last seven days. You are looking for a shape: the same error repeating is a bug, a scatter of different ones is usually the internet.
2. Find the function in `supabase/functions/` and read what it depends on (a secret, a provider, a queue).
3. Check `supabase/functions.snapshot` and the last `Deploy Edge Functions` run: did a change to `_shared` redeploy every importer, and did one of them fail?
4. Check the secret it needs is present (inventory in [SECRETS.md](../../../SECRETS.md)).

## Mitigate

1. Redeploy the previous good version: Actions → *Deploy Edge Functions* → *Run workflow*, naming the function and an earlier commit (ROLLBACK.md, *Rolling a function back*).
2. If the function sheds under a kill switch listed in the catalog, engage it rather than leaving it erroring.
3. For `fn:delete-account`, a failure is never dropped: the request stays open and is retried, and a restore afterwards must not resurrect an erased account (experiment CX-14).

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- The function answers a request with its normal success shape.
- The error shape is gone from the log for an hour.
- `supabase/functions.snapshot` and the deployed version agree.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
