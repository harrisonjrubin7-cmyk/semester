# RB-14 · Connector or integration stale or failing

Class C2 · role integrations · alerts `connector:stale` · components `fn:integration-tick`, `fn:lti`, `fn:canvas`, `institution-gateway`, `queue:integration_dead_letter_events`.

## Symptom

A connection is staler than its freshness commitment, launches from an LMS fail, or integration dead letters appear.

## Impact

That school's launches, imports and sync fail; the app and the student's own data are unaffected. **No adapter is registered in production today** (the registries are empty by design), so a real school has never been affected; this runbook is written ahead of the first one.

## Diagnose

1. Is the connection stale, failing, or unregistered? `unregistered` is the current honest state of every connection.
2. Read the sync run and error tables for the connection (`integration_sync_runs`, `integration_sync_errors`, `integration_dead_letter_events`).
3. Follow [INTEGRATION-OPERATOR-RUNBOOK.md](../../INTEGRATION-OPERATOR-RUNBOOK.md) and, for LTI, [LTI-1.3-LAUNCH-RUNBOOK.md](../../LTI-1.3-LAUNCH-RUNBOOK.md).

## Mitigate

1. Engage `kill.integration_sync` to stop a misbehaving connector without touching the rest.
2. Mark the data stale with a freshness label, never invent an age.
3. Do not replay dead letters blindly and never retry an ambiguous write to an official system.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- A test sync from a stub connector completes and the freshness label is correct.
- Dead letters are triaged by a person.
- The school's contact has been told, using the approved template.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
