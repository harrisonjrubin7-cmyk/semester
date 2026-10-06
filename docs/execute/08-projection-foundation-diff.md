# Stream 08 · Projection foundation against the repository — diff before anything is built

**As of** 2026-10-06 · **Base** origin/main `7b524eb` · **Asks of this page** `docs/master/SEMESTER_EXECUTION_ROADMAP.md` rows 6–7, `docs/handoff/execute/08-ops-command-center.md`, and the PDFs' Phase 6 ("reconcile existing outbox and event infrastructure before adding new structures").

> **Claim ceiling.** This page itself changes no migration, code, CI or setting; the first slice it proposes (§4) was then built in the same pull request, in separate files (§7). Everything under "What exists" was read from the tree or, where marked, from a read-only query of the production project (`lzrqvlug…`). The proposal is a proposal: no decision is made here, so no `D-` file is written (a decision takes its pull request's number, and this is not one).

## 1. What exists

| Piece | Where | State |
| --- | --- | --- |
| Transactional outbox table | `private.domain_outbox_events` (`20260928320000_audit_correlation_and_outbox.sql`): event type and version, tenant, correlation and causation ids, idempotency key (unique per aggregate), data classification, retention class, `published_at`, `publish_attempts`, `dead_lettered_at`, a partial index on pending rows | Built; service-role only |
| Consumer receipts | `private.domain_event_receipts`, primary key (consumer, event id), outcomes processed / skipped / failed | Built; service-role only |
| Event contract in code | `packages/institution/src/events.ts` (envelope, catalog, `drainOutbox`, `processOnce`, `MemoryOutbox`); `docs/architecture/0008-event-envelope-and-outbox.md` | Built; the publisher loop runs against an in-memory store in tests |
| Producers | Three migrations write events: `20261004123000_productivity_commands.sql`, `20261004180000_productivity_reads.sql`, `20261004191000_productivity_task_carries_the_apps_task.sql` (productivity commands only) | Built |
| Integration dead-letter and replay | `integration_dead_letter_events`, `integration_request_replay` (`20260927200000_integration_hardening.sql`) | Built, for integrations only |
| Live contents (read-only query, 6 Oct) | `domain_outbox_events` 0 rows, 0 pending, 0 parked; `domain_event_receipts` 0 rows | **The outbox has never carried an event in production** |
| Live console reads | `console_command_center`, `console_figures`, `console_customers`, `console_audit_read`, … compute from tables when called | Built; no freshness or lag figure beyond what each returns |

## 2. What is not there (searched; "not found" is a grep, not a proof)

- A projection worker or any consumer of the outbox in SQL, the gateway or an Edge Function. `ADR 0008` says as much: "no producer writes to the outbox yet" (three now do).
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

This page wrote no migration, function or test; §7 records the slice that followed. The ADR's "no producer writes yet" sentence is stale (three producers do); it is left for whoever owns that ADR. The 17 contracts, a worker, and any producer are untouched.

## 7. The first slice, built (option C chosen by the owner)

The owner chose option C. Built in the same pull request, not applied to any database:

- `supabase/migrations/20261006140000_ops_contract_registry.sql`: `private.ops_contract_registry` (service-only, written by migration) with 13 rows, and `public.ops_projection_dashboard()` (`console:operate` at platform scope). Every staleness budget is null and reads "no budget set".
- `supabase/ops-read-contracts.check.sql`: 7 checks, shown to fail against three deliberate breaks.
- Registered in `grants.check.sql`, `app/src/lib/definerregister.ts`, `database/schema/table-classification.json` and `RETENTION.md`.

**Merging the pull request applies the migration to the connected production project** (as `D-1324`'s update records for the payments migration), so it needs the owner's explicit confirmation. Questions 2 and 3 in §5 were answered by default (registry written by migration only; no budget invented); question 4 is not in this slice.


## 8. Collision with the projection foundation, and what changed

While this pull request was open, `20261006130000_projection_foundation.sql` (docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md, backlog P1-01) landed and created its own `private.read_model_registry`, keyed by (name, version) with a required capability and a required freshness SLO. That is a registry of *projections*. This slice registers *live reads* whose budget is deliberately null, so it cannot share that table without loosening its constraints, and `create table if not exists` would have skipped silently and then failed on the first insert.

So this slice's table is `private.ops_contract_registry`, and its migration is `20261006140000_ops_contract_registry.sql`. The projection registry stays the one place a projection is declared; when a contract moves from live read to projection, its row moves there. Nothing here reads or writes the projection tables.
