# Registration-readiness evaluation workflow

> **Type:** reference · **Audience:** implementers · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-09 · **Held by:** `packages/institution/src/readiness-workflow.test.ts`

Status: repository contract plus a service-only Postgres persistence adapter. No HTTP route or worker uses the adapter, and no live SIS connection or official registration write is activated by this module.

`packages/institution/src/readiness-workflow.ts` defines the aggregate rules that the durable readiness repository preserves. `app/server/institution/readiness-repository.ts` is the server-side port and `supabase/migrations/20261009160000_registration_readiness_store.sql` is its transactional store. They sit between the source-aware projection and future HTTP or worker adoption so callers and SQL cannot each invent different retry behavior.

## State path

The normal path is `requested → evaluating → ready | blocked`. Evaluation may instead produce `needs_review`, `unknown`, or `stale`. Those ambiguous states must enter `reconciling` before another evaluation begins. Leaving `reconciling` starts a new generation and resolves the open reconciliation task; it never silently overwrites the earlier ambiguity.

Known `ready` or `blocked` records may be refreshed through `evaluating` when a newer projection is available. Every evaluated outcome requires a projection version newer than the aggregate's current projection version.

## Concurrency and retry contract

Every transition carries:

- the aggregate version the caller read;
- an idempotency key;
- a correlation id;
- an observation time;
- a projection version when the transition records an evaluated outcome.

A stale aggregate version is refused. Replaying the same idempotency key and command returns the original receipt and event descriptor without changing the aggregate. Reusing that key for another target or projection is refused. A production repository must lock or compare-and-swap the aggregate and persist the updated record, receipt, reconciliation task, audit row, and outbox row atomically.

## Receipts and events

`requested`, `evaluating`, and `reconciling` issue pending receipts. Evaluated outcomes issue completed receipts. Receipts bind the idempotency key, resulting state, aggregate version, time, and correlation id.

The aggregate returns minimal outbox descriptors for:

- `registration.readiness_requested`;
- `registration.readiness_evaluated`;
- `registration.readiness_reconciliation_requested`.

Payloads contain only evaluation id, term id, and aggregate version. They do not carry holds, prerequisite details, student-entered plan content, or source payloads. The event catalog classifies all three as education records; the request and reconciliation events use audit retention, while evaluated projections use student-record retention.

## Persistence adapter behavior

The store now:

1. tenant-bind every evaluation, task, receipt, and query;
2. make `(evaluation_id, aggregate_version)` and tenant-scoped idempotency uniqueness enforceable in Postgres;
3. save the aggregate, receipt, audit evidence, and outbox row in one transaction;
4. encrypt or minimize stored source facts rather than copying institutional payloads into command or event ledgers;
5. keeps reconciliation work service-only; a later query surface must authorize an assigned advisor or registrar relationship before exposing it;
6. documents forward rollback order and has database-negative tests for cross-tenant reads and writes.

The adapter is repository implementation evidence only. It has not been configured in a deployed runtime, called by an HTTP route or worker, exercised against a live institution, or used for an official registration write. Those remain separate gates.
