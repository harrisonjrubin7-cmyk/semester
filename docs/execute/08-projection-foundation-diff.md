# Stream 08 · Projection foundation against the repository — diff before anything is built

**As of** 2026-10-06 · **Base** origin/main `7b524eb` · **Asks of this page** `docs/master/SEMESTER_EXECUTION_ROADMAP.md` rows 6–7, `docs/handoff/execute/08-ops-command-center.md`, and the PDFs' Phase 6 ("reconcile existing outbox and event infrastructure before adding new structures").

> **Claim ceiling.** This page changes no migration, code, CI or setting. Everything under "What exists" was read from the tree on 6 Oct or, where marked, from a read-only query of the production project (`lzrqvlug…`); main has since moved (see §7). The proposal in §4 is a proposal, and §7 records what became of it.

## 1. What exists

| Piece | Where | State |
| --- | --- | --- |
| Transactional outbox table | `private.domain_outbox_events` (`20260928320000_audit_correlation_and_outbox.sql`): event type and version, tenant, correlation and causation ids, idempotency key (unique per aggregate), data classification, retention class, `published_at`, `publish_attempts`, `dead_lettered_at`, a partial index on pending rows | Built; service-role only |
| Consumer receipts | `private.domain_event_receipts`, primary key (consumer, event id), outcomes processed / skipped / failed | Built; service-role only |
| Event contract in code | `packages/institution/src/events.ts` (envelope, catalog, `drainOutbox`, `processOnce`, `MemoryOutbox`); `docs/architecture/0008-event-envelope-and-outbox.md` | Built; the publisher loop runs against an in-memory store in tests |
| Producers | One producer, `private.productivity_commit(...)`, writes events; it is redefined with `create or replace` by three migrations (`20261004123000_productivity_commands.sql`, `20261004180000_productivity_reads.sql`, `20261004191000_productivity_task_carries_the_apps_task.sql` ), so only the last definition is live (productivity commands only) | Built |
| Integration dead-letter and replay | `integration_dead_letter_events`, `integration_request_replay` (`20260927170000_integration_control_plane.sql`; `20260927200000_integration_hardening.sql` adds retention and health over the dead-letter table but does not define the replay RPC) | Built, for integrations only |
| Live contents (read-only query, 6 Oct) | `domain_outbox_events` 0 rows, 0 pending, 0 parked; `domain_event_receipts` 0 rows | **The outbox was empty in production on 6 Oct** (a zero-row count shows current contents only; rows could have been removed earlier, since `service_role` can delete and rows cascade with a school, so "never carried an event" is not established) |
| Live console reads | `console_command_center`, `console_figures`, `console_customers`, `console_audit_read`, … compute from tables when called | Built; no freshness or lag figure beyond what each returns |

## 2. What is not there (searched; "not found" is a grep, not a proof)

- A projection worker or any consumer of the outbox in SQL, the gateway or an Edge Function. `ADR 0008` says as much: "no producer writes to the outbox yet" (one productivity producer does, revised by three migrations).
- A Postgres-backed `OutboxStore` for `drainOutbox`; the loop is exercised only against `MemoryOutbox` and the productivity repository in tests.
- Projection watermarks, a read-model registry or versioning, a rebuild path, a replay path for the domain outbox (the column exists; nothing offers a parked row again).
- Any of the 17 `ops_*` read contracts by name. Equivalents are partial (see `SEMESTER_GAP_AND_STATUS_REGISTER.md`).
- **Producers for the events an ops read model would project.** No approval request or decision, support ticket, incident, release or tenant-rollout change writes an outbox row. An operations inbox projected from the outbox would be empty.

## 3. The choice this raises (not made here)

The PDFs ask for projected read models. The repository's console already answers the same questions by reading tables live inside `SECURITY DEFINER` functions that check a capability, with a test (`console-no-student-rows.check.sql`) that no student marker comes back. Projection earns its cost only for what is too slow or too wide to compute on read, or what must show an honest "as of" figure.

| Option | What it is | Cost | Risk |
| --- | --- | --- | --- |
| A. Projected from the outbox | Producers write events for approvals, support and tenant changes; a worker projects them into read-model tables with a watermark | Producers in several existing functions, a worker, a registry, rebuild and replay, tests for each | Touches live approval and support functions; a missed producer makes a read model silently wrong |
| B. Live reads with freshness | Keep definer functions; add a registry row per contract with its source tables and an `as_of` / staleness figure returned by each | One registry table, a column on each return | Does not deliver CQRS; read cost stays on the primary |
| C. Both, in order | B first (cheap, honest), A only for a contract that measurably needs it | B's cost, then A per contract | Slower to the PDFs' picture |

**Recommendation:** C, with the first slice below. It is a recommendation, not a decision; the founder can overrule it, and `D-1287`'s rule that doing less is the reversible answer applies.

## 4. Proposed first slice (if C is chosen)

1. `private.ops_contract_registry` (name, version, owning capability, source tables or event types, staleness budget in seconds, status), written only by migration. One row per `ops_*` contract that is built, so the registry is the list of what exists, not of what is hoped for.
2. `ops_projection_dashboard`, a capability-checked definer function (`console:operate`) that reads the registry and returns, per read model, its version, last-computed time and whether it is inside its budget. It is the first contract because it can be tested without any new producer.
3. A check, `supabase/ops-read-contracts.check.sql`: every registry row names a function that exists; a caller without the capability is refused; no student marker appears in any return (reusing the pattern in `console-no-student-rows.check.sql`); a stale fixture reads as stale.
4. Nothing from option A until a named contract needs it.

Tested the way the last slice was: a migration written and run on a throwaway PostgreSQL 17 through `supabase/check.sh`, shown red against a deliberate break, then opened as a draft pull request. **Production is not touched by any step**; applying a migration to the project is a separate, explicit confirmation.

## 5. Decisions needed from the owner

1. A, B or C (§3).
2. Whether the registry may be written only by migration (proposed) or by an approved console action.
3. The staleness budget per contract; the PDFs do not state one and none is invented here.
4. Whether `docs/handoff/execute/08` task 3 (error tracking, uptime, SSO failures, SIS lag, alert routes) is in this slice. It needs vendors and on-call people the repository cannot supply.

## 6. Not done by this page

This page wrote no migration, function or test; §7 records the slice that followed. The ADR's "no producer writes yet" sentence is stale (one productivity producer does); it is left for whoever owns that ADR. The 17 contracts, a worker, and any producer are untouched.

## 7. Outcome: the registry slice was built, then withdrawn

The owner chose option C and a first slice was built and tested on a throwaway PostgreSQL 17: a service-only registry of the operations read contracts and a `console:operate`-gated `ops_projection_dashboard()` over it. **It was never merged, and it was never applied to any connected, persistent or production database;** the only database it ran against was a throwaway PostgreSQL 17 instance used for testing. This pull request is documentation only.

Why it was withdrawn:

- **The projection side landed first.** While the slice was open, main gained `20261006130000_projection_foundation.sql` (a different `private.read_model_registry`, keyed by name and version with a required freshness SLO, plus watermark, invalidation and rebuild tables), then a projector worker, outbox operations and a scoped freshness read (`20261008210000`, `20261008190500`, `20261008233000`). Main's design (`docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md`, `PROJECTION_AND_CACHE_POLICY.md`) defines `ops_projection_dashboard` as a per-projection operability view: status, version, lag and watermark, plus outbox counts and dead letters (`CQRS_READ_MODEL_ARCHITECTURE.md`) and the last error, events behind, last rebuild and parity (`PROJECTION_AND_CACHE_POLICY.md`). The withdrawn slice used the same name for a different contract.
- **Three review findings were correct** (Codex, on the pull request): the migration version sorted before versions already applied in production, so a production push would have been refused; the registry row for `console_integration_health` omitted `integration:view`, which the function requires, and the completeness check was one-way so it could not notice; and returning `now()` as `as_of` for every live read claimed a freshness nothing measured.

What a later attempt should keep from it: a live read is not a projection and should not be forced into the projection registry; a null staleness budget must read as "no budget set", never as fresh; a registry that restates a function's gate needs a check in both directions (nothing extra, nothing missing); and a new migration must sort after the newest one on main.

The real `ops_projection_dashboard` belongs on main's watermark tables and must carry that full operability contract (watermark and lag, outbox counts, dead letters, last error, events behind, last rebuild, parity), not a subset. It needs its own migration and the owner's explicit confirmation before it is merged, since merging applies it to the connected production project (see `D-1324`).

## 8. Not done by this page

This page wrote no migration, function or test. The ADR's "no producer writes yet" sentence (0008) is stale and is left for whoever owns that ADR.
