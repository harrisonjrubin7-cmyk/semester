# RB-06 · Billing webhook or checkout failing

Class C1 · role billing · alerts `billing:webhook-lag` · components `fn:billing-webhook`, `fn:billing-checkout`, `fn:billing-cancel`, `fn:billing-portal`, `stripe`.

## Symptom

A paid Stripe event is unprocessed, signature failures spike, or checkout, cancel or portal answer 503.

## Impact

Entitlement stays as last verified. Payments already made are unaffected. The provider retries webhooks, so events arrive late and possibly twice: every handler must be idempotent.

## Diagnose

1. Check the Stripe dashboard's webhook delivery log: are deliveries failing, and with what status?
2. Check `fn:billing-webhook` logs. A signature failure means a wrong or rotated `STRIPE_WEBHOOK_SECRET`; a 5xx means the database RPCs.
3. Check whether live billing is enabled at all: new checkout is code-held off unless `BILLING_LIVE_ENABLED=true` and keys are set. A 503 from checkout with no keys is correct behaviour, not a fault.
4. Read `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` for what was actually verified.

## Mitigate

1. Fix the cause, then let Stripe redeliver; do not replay by hand unless you have confirmed the event was never applied.
2. If the secret rotated, update it in the secret store and redeploy `billing-webhook` only.
3. Never retry an ambiguous money movement blind: reconcile against the provider first.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`. A suspected double charge or wrong entitlement is customer-visible: use the audience templates in `docs/operating-model/INCIDENT-COMMUNICATIONS.md`.

## Verify

- A test event from the provider is applied once, and a replay of it changes nothing.
- The oldest unprocessed paid event is under 15 minutes.
- Reconciliation of the affected window against the provider shows no gaps.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
