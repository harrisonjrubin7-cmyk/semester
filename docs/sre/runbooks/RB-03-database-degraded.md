# RB-03 · Database degraded, writes failing, or a policy gap

Class C0 · role data · alerts `burn:plan_save`, `burn:advisor_agenda_save`, `burn:assignment_draft_save`, `security:rls-gap`, `capacity:db-connections` · component `supabase-db`.

## Symptom

Saves fail or time out, sync stalls, the REST API errors, connections are exhausted, or a health query shows a table without row-level security.

## Impact

Shared features and sync stop. The device holds the student's own work and queues its writes. A missing policy is a data exposure risk and is handled as P0.

## Diagnose

1. Run `supabase/health.sql` block 2 (is anything being written) and blocks 4 and 5 (policies). Blocks 4 and 5 must return no rows.
2. Check the project's own dashboard for CPU, connections and disk. Compare connections with the verified ceiling in `capacity.ts` once it is filled in; until then it is unknown, say so.
3. Check for a recent migration (`supabase/ledger.snapshot`, the `main` branch record). A migration that holds a long lock looks like an outage.
4. Find the slow or blocked statement in the query log before restarting anything.

## Mitigate

1. If the cause is load, shed optional work first: engage `kill.integration_sync` and `kill.ai_generation` so background and model traffic stops competing with saves.
2. If writes must stop while it is fixed, set `SEMESTER_READ_ONLY=on` for the gateway and `VITE_READ_ONLY=true` for clients. The app keeps edits on the device and syncs them afterwards.
3. If a policy is missing, close the gate first (see SECURITY.md, *Close the gate*), then fix by a forward migration. Schema rolls forward only.
4. Do not restore over production to fix a performance fault; restore is RB-12 and goes to a new project.

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- Block 2 shows fresh writes in every table you expect.
- Blocks 4 and 5 return no rows and `ensure_rls_present` is 1.
- A test account saves a plan and reads it back on a second device.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
