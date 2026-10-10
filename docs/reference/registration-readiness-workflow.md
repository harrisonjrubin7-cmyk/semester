# Registration-readiness evaluation workflow

> **Type:** reference · **Audience:** implementers · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-09 · **Held by:** `packages/institution/src/readiness-workflow.test.ts`

Status: repository contract, service-only Postgres persistence adapter, server orchestration service, authenticated HTTP command boundary, and bounded evaluator caller. The production runtime does not supply an evaluator, so both commands fail closed with `503 unavailable`; no live SIS connection or official registration write is activated by these modules.

`packages/institution/src/readiness-workflow.ts` defines the aggregate rules that the durable readiness repository preserves. `app/server/institution/readiness-service.ts` loads the tenant-bound aggregate and applies those rules, `app/server/institution/readiness-repository.ts` is the service-only persistence adapter, and `supabase/migrations/20261009160000_registration_readiness_store.sql` is its transactional store. They sit between the source-aware projection and future HTTP or worker adoption so callers and SQL cannot each invent different retry behavior.

## Server orchestration boundary

The service accepts tenant, subject, requester, correlation, and idempotency values explicitly. A future route must derive them from verified server context; the service does not accept a browser session or authorize a person. A future evaluator worker may use the same boundary with its own verified service identity.

For transitions, the service loads by tenant plus evaluation id before it applies the pure state machine. A missing record and a record owned by another tenant therefore have the same result. Invalid or stale transitions fail before `save`; accepted transitions are still protected by the database compare-and-swap in case two callers raced after the load.

This layer intentionally does not expose the workflow record as the student-facing checklist. The workflow aggregate records evaluation state and delivery receipts; `packages/institution/src/readiness.ts` defines the source-aware projection governed by `registration.readiness.view`. An HTTP read route needs that projection store and policy decision, not an accidental serialization of the orchestration aggregate.

## HTTP command boundary

The root institution gateway now recognizes two authenticated commands:

- `POST /v1/registration-readiness/evaluations` with exactly `{ "termId": "…" }` starts a durable evaluation and returns its pending receipt with `202`.
- `POST /v1/registration-readiness/evaluations/:id/evaluate` with an empty JSON object invokes the bounded evaluator caller and returns the durable outcome receipt with `200` when completed.

Both require a platform-format `Idempotency-Key`, refresh current membership immediately before execution, and derive tenant, subject, and requester from the verified server context. This first slice is intentionally student-self only; it does not infer advisor assignment from a role. An evaluation owned by somebody else is indistinguishable from a missing id. Responses contain receipts, never the orchestration aggregate, source payload, holds, or prerequisite detail.

The gateway path is present in the production runtime, but composition requires an explicitly injected `RegistrationReadinessEvaluator`. The deployed serverless entry point injects none, so requests fail closed. Adding a provider, tenant activation, or live configuration remains a separate approval gate.

## Evaluator caller

The evaluator receives only the tenant, subject, term, minimum acceptable projection version, and a bounded abort signal. It returns an outcome plus projection version and source observation/freshness times. Expired or future-dated evidence is committed as the completed `stale` outcome rather than being allowed to claim `ready`. A replayed evaluator idempotency key returns the durable completed receipt without calling the source again. The readiness repository remains the concurrency boundary; no Course Engine lease or integration-worker lease is reused.

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

The adapter and command path are source-level implementation evidence only. The runtime has no approved evaluator dependency, so the deployed path remains unavailable. It has not been exercised against a live institution or used for an official registration write. Those remain separate gates.
