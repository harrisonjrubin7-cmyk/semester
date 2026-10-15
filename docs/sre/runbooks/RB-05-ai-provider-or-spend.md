# RB-05 · AI provider failing, or spend running away

Class C2 · role ai · alerts `burn:ask_semester`, `ai:spend-half-cap`, `ai:kill-switch-engaged` · components `fn:claude`, `anthropic`, `openai`, `institution-gateway`.

## Symptom

The assistant errors or refuses, or provider usage reaches half the spend cap, or the shared key is returning errors.

## Impact

AI features refuse with a plain sentence. Every deterministic feature (schedule, credit, degree, entitlement rules) never calls a model and is unaffected.

## Diagnose

1. Is it the provider or us? Check the provider's status and dashboard, then `fn:claude` logs. A 4xx from the provider on the shared key is usually the key or the account limit.
2. Run `supabase/health.sql` block 1: calls and tokens this month, and how many accounts are at `MONTHLY_CALL_LIMIT` (default 60). An account at the cap is a pricing conversation, not an incident.
3. Order of the three caps (see `aiCapOrder` in `capacity.ts`): per-account cap times accounts times cost per call must sit under the provider cap, or the cap that fires first is the wrong one.

## Mitigate

1. To stop spend now, engage `kill.ai_generation` (the `claude` function answers 503 with the stated sentence; an unreadable switch table counts as engaged). This is the control; the alert only tells you.
2. Lower `MONTHLY_CALL_LIMIT` if one cohort is the whole bill.
3. If the shared key is compromised, this is RB-13 first and this runbook second.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- A test account's request returns the kill-switch sentence while engaged, and a normal answer after release.
- `npm run drill:killswitch` passes against staging if the switch path was touched.
- Provider usage is flat after the change.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine. Evidence of the last drill: `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`.
