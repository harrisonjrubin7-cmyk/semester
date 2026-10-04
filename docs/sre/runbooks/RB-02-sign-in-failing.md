# RB-02 · Sign-in failing

Class C0 · role platform · alerts `burn:sign_in`, `security:auth-failure-rise` · components `supabase-auth`, `web-app`.

## Symptom

Students cannot sign in, sign-in loops, or the auth logs show failures rising on one provider.

## Impact

New sign-ins fail. Sessions already open continue, and everything on the device works. A fault that weakens rather than blocks authentication is P0, not this runbook.

## Diagnose

1. Dashboard → Logs → Auth, last hour. Look for one provider or one error repeating; a rise on one provider is usually a misconfigured redirect URL, and looks exactly like a student saying sign-in is broken.
2. Check the Supabase project status. If the platform reports an incident, this is a dependency failure: mitigate by communication, not by change.
3. Check whether a deploy or a configuration change preceded it (`supabase/config.toml`, the redirect URL list, the allowed origin).
4. Confirm the invite gate (`invite_only`) is as intended: `supabase/health.sql` block 3.

## Mitigate

1. Revert the configuration change that preceded the failure; never loosen a check to let people in.
2. If a provider is misconfigured, fix the redirect URL and retest with a test account on a clean browser.
3. If the platform is down, post to the status page and tell students their saved work on the device is safe.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`. A flow that accepts a request without a valid session is P0: stop it first and understand it after.

## Verify

- A test account signs in with each enabled provider.
- The auth log failure rate returns to its baseline for an hour.
- `burn:sign_in` is quiet on both windows once it is wired.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
