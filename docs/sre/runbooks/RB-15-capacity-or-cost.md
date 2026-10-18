# RB-15 · Capacity peak or cost spike

Class C0 to C1 · role platform · alerts `capacity:db-connections`, `cost:anomaly` · components `supabase-db`, `supabase-edge-runtime`. Planning model: `app/src/lib/sre/capacity.ts`.

## Symptom

A known peak is approaching (registration, a deadline, grade release, a billing run, an exam-eve AI surge) or a cost driver is above 150% of its trailing mean.

## Impact

Slower saves and reads at the peak, then failures. Cost spikes that nobody sees until the invoice.

## Diagnose

1. Which scenario is it? See the [capacity plan](../04-CAPACITY-PLANNING.md) for the demand each one puts on requests, connections, AI calls and notifications at your cohort size.
2. Are the ceilings known? Today every limit in `capacity.ts` is unverified, so the model cannot certify headroom: say so and treat the peak as unproven.
3. For cost, find the driver in `cost.ts` and its guardrail; an alert-only driver has nothing that stops it.

## Mitigate

1. Before a known peak: freeze changes (see the [change gates](../05-DELIVERY-AND-CHANGE-MANAGEMENT.md)), confirm a person is available, and engage `ops.war_room` heightened monitoring if it exists.
2. During: shed optional work first (`kill.integration_sync`, `kill.ai_generation`), keep saves and sign-in, then reads.
3. For cost: engage the guardrail, not just the alert. Lower `MONTHLY_CALL_LIMIT` or engage the AI kill switch for an AI driver.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- Connections and saturation return under the target utilisation of 60%.
- The spend ratio returns under 1.5× its trailing mean.
- The peak is recorded with its real numbers, so the next plan uses them in place of the assumptions.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
