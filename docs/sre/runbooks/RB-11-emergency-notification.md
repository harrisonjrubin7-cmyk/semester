# RB-11 · Campus emergency notification path

Class C0 target · role platform · alert `queue:emergency-lag` · components `fn:push`, `queue:push_queue`, `web-push`.

## Symptom

An emergency notification is needed and must reach students within a minute, or a live one is not reaching them.

## Impact

This is the one path where degrading gracefully is not enough. **No dedicated emergency path exists today:** `fn:push` sends general reminders every 15 minutes, which is not an emergency channel. Until one is built and drilled (experiment CX-12), the institution's own alert system is the channel of record, and Semester must not be presented as one.

## Diagnose

1. Confirm with the institution which system is sending the alert; Semester is not it today.
2. If Semester is asked to relay, check `fn:push` and the queue as in RB-07, and note the 15-minute schedule is the floor on latency.
3. Read [CRISIS-RESPONSE-RUNBOOK.md](../../CRISIS-RESPONSE-RUNBOOK.md) for the safety and routing rules; they take precedence over this page.

## Mitigate

1. Point students to the institution's official channel on the status page and in the app.
2. Do not promise delivery times. Do not send anything that has not been approved by the institution's incident owner.
3. Record that the path did not exist as a finding; it is the highest-priority gap in the scorecard.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`. The institution's incident commander owns the message; Semester owns only whether its own relay worked.

## Verify

- The institution confirms receipt through its own channel.
- If a relay was used, delivery counts are recorded with timestamps.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
