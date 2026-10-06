# Stream 08 · Projection foundation against the repository — diff before anything is built

**As of** 2026-10-06 · **Base** origin/main `7b524eb` · **Asks of this page** `docs/master/SEMESTER_EXECUTION_ROADMAP.md` rows 6–7, `docs/handoff/execute/08-ops-command-center.md`, and the PDFs' Phase 6 ("reconcile existing outbox and event infrastructure before adding new structures").

> **Claim ceiling.** This page changes no migration, code, CI or setting. Everything under "What exists" was read from the tree or, where marked, from a read-only query of the production project (`lzrqvlug…`). The proposal is a proposal: no decision is made here, so no `D-` file is written (a decision takes its pull request's number, and this is not one).

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

1. `private.read_model_registry` (name, version, owning capability, source tables or event types, staleness budget in seconds, status), written only by migration. One row per `ops_*` contract that is built, so the registry is the list of what exists, not of what is hoped for.
2. `ops_projection_dashboard`, a capability-checked definer function (`console:operate`) that reads the registry and returns, per read model, its version, last-computed time and whether it is inside its budget. It is the first contract because it can be tested without any new producer.
3. A check, `supabase/ops-read-contracts.check.sql`: every registry row names a function that exists; a caller without the capability is refused; no student marker appears in any return (reusing the pattern in `console-no-student-rows.check.sql`); a stale fixture reads as stale.
4. Nothing from option A until a named contract needs it.

Tested the way the last slice was: a migration written and run on a throwaway PostgreSQL 17 through `supabase/check.sh`, shown red against a deliberate break, then opened as a draft pull request. **Production is not touched by any step**; applying a migration to the project is a separate, explicit confirmation.

## 5. Decisions needed from the owner

1. A, B or C (§3).
2. Whether the registry may be written only by migration (proposed) or by an approved console action.
3. The staleness budget per contract; the PDFs do not state one and none is invented here.
4. Whether `docs/handoff/execute/08` task 3 (error tracking, uptime, SSO failures, SIS lag, alert routes) is in this slice. It needs vendors and on-call people the repository cannot supply.

## 6. Not done

No migration, function or test was written for this proposal. The ADR's "no producer writes yet" sentence is stale (three producers do); it is left for whoever owns that ADR. The 17 contracts, a worker, and any producer are untouched.
