# Platform runbooks

> **Status: written, not rehearsed.** Nothing here has been run in an incident or
> a drill. Each runbook names its trigger, the first check, the action, and who
> decides. Rehearsal is the evidence; until it exists, treat these as a draft to
> be walked in a game day (see `RESTORE.md` and `ROLLBACK.md` for the repository's
> existing restore and rollback procedures, which these build on, not replace).

Roles: **platform on-call** is the owner of the `platform` seat. A cross-tenant
suspicion also pages **security** and starts the incident process in
[`docs/INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md) and
[`SECURITY.md`](../../SECURITY.md); do not wait for certainty.

## 1. A tenant-isolation violation fires (`semester_tenant_isolation_violation_total` > 0)

*Trigger:* the metric moves, a `wrong_tenant` dead letter appears, a user reports
seeing another school's data, or a conformance run goes red.

1. **Treat as an incident now.** Do not investigate in the open channel first.
2. Identify the layer from the metric label; pull the correlation id from the
   refusal's log line.
3. If data was *returned* (not just refused): note tenant pair, time window,
   correlation ids. **Do not delete evidence.** Contain: flip the relevant kill
   switch (§6), or suspend the route.
4. Flush the layer for the affected tenants (`flushTenant` for cache; re-index
   for search; replay for queue after the routing fix).
5. Notification to affected institutions, and any legal conclusion, is for
   **qualified counsel** — do not characterise breach status yourself.
6. Fix the cause **and add the failing case to the conformance suite** before
   closing.

## 2. Outbox backlog or dead letters (`semester_outbox_pending`, `…_dead_lettered_total`)

1. Backlog and growing: is the publisher running? Is the bus up? Backlog alone is
   a freshness SLO breach, not data loss — rows are committed with their records.
2. Dead letters: read `last_error` on the parked row (bounded, no payload). One
   poison event → fix the consumer, then re-queue that row. Many → the bus or a
   consumer is down; fix, then re-queue in order.
3. **Never edit an event's payload.** If it is wrong, emit a correction event.
4. A consumer re-processing is safe by construction (receipt ledger); a consumer
   *not* idempotent is a bug — file it against that consumer.

## 3. An idempotency key is stuck (`idempotency_in_progress` persists)

The lease (60 s) lapses on its own and the next attempt takes over. Persisting
beyond the lease means a client re-sending faster than the lease or a store fault.
Do **not** delete the row by hand while a worker may still be running: check the
command's audit rows for the key's correlation id first. If the command did
complete, the stored response will replay; if not, the lease takeover runs it.

## 4. Rotating the cursor or service-token keys

Both rings carry a `kid`. **Add** the new key and make it current; keep the old
until the longest token lifetime has passed (cursor: 15 min; service token: 5
min), then remove it. A removed key makes outstanding cursors `invalid_cursor`
(clients restart from page one) and outstanding tokens `unauthenticated` (callers
re-mint). If a key may be **compromised**: remove it immediately and accept the
errors. Keys live in the secret store (`SECRETS.md`), never in the repository.

## 5. Audit chain verification fails

`verifyAuditChain` reports the sequence where it breaks. Do **not** repair rows.
Preserve the table, take a snapshot, page security: a broken chain is either
tampering or a bug in the writer. Compare the break against deploys and
migrations; the append-only trigger (once the contract is applied) makes in-place
tampering a database-owner act. Counsel decides what is communicated.

## 6. Kill a feature

Set the flag's `kill: true` (it overrides every rule). The change is the audited
act; it takes effect on the next evaluation. A killed flag evaluates to `false`
with reason `kill_switch` — support can see it. A feature that needs a kill switch
and has none does not ship.

## 7. A connector is degraded or disabled

`degraded` (3 consecutive failures): the native capability is **unaffected** by
design — the surface shows the data's freshness and source, not an error. Check the
provider, the credential reference, the mapping version. `disabled` (8): a human
re-enables after fixing; `recordSuccess` heals. Never edit the cursor by hand;
re-sync from the provider's snapshot.

## 8. Stale flags

`staleFlags(defs, now)` lists expired flags; each is deleted or re-dated by its
owner. An expired flag already evaluates to its default, so staleness is a
cleanliness problem, not an outage.

## 9. A tenant is suspended or closing

`tenant_suspended` is returned to every request. Offboarding is the
data-deletion workflow and `RETENTION.md`; a **legal hold** blocks file deletion
and must be cleared by the holder, not by operations.

## What is not here

On-call rota and escalation tree (no seat is staffed — see
`OWNER-AND-ACCOUNTABILITY-MATRIX.md`); status-page procedure; per-tenant
communications templates; capacity runbooks. Those need a real service in
production to write honestly.
