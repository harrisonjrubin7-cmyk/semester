# RB-07 · Queue backlog or dead letters

Class C1 to C2 · role per queue · alerts `queue:push-backlog`, `queue:dead-letter` · components `queue:*`, `fn:push`, `fn:support-reply-notify`, `web-push`, `resend`.

## Symptom

The oldest unsent reminder is older than 30 minutes, a row has been dead-lettered, or an integration dead-letter event appears.

## Impact

Reminders arrive late, support email nudges are delayed. Rows wait in their table: a backlog means late, not lost.

## Diagnose

1. Which queue? `push_queue`, `support_notification_outbox` (attempts, `dead_lettered_at`), `integration_dead_letter_events` or `community_escalation_deliveries`.
2. Is its job running? `supabase/health.sql` block 6, and `supabase/scheduler.sql` for the schedule (push every 15 minutes, support-reply-notify every minute).
3. Is the provider failing (Web Push, Resend)? A provider outage grows the queue; a function error does too.
4. Note that `escalation-delivery` and `media-scan` are parked until their functions exist: their tables will hold rows by design.

## Mitigate

1. Fix the cause, let the job drain. Drain oldest first; do not send a burst that trips the provider's rate limit.
2. A dead-lettered row after eight attempts is held for a person: read it, decide, and re-queue deliberately. Never replay integration dead letters blindly.
3. If a flood of reminders is itself the problem, pause the job rather than delete rows.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- The oldest unsent row is under the threshold.
- Each reminder in the window was sent once (experiment CX-08 is the planned proof).
- No new dead letters in an hour.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
