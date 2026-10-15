# Idempotency keys are scoped, hashed and leased

**Status:** Accepted. In-memory store proven; **the durable store is
`platform.idempotency_key` in the proposed schema, not yet applied.**

## Decision

Every command requires an `Idempotency-Key`. The record is keyed
`(tenant, actor, command, key)`; the request is hashed over canonical JSON. Same key
and body replays the stored response; same key with a different body is
`idempotency_key_reused` (422); a running first attempt is `idempotency_in_progress`, bounded
by a 60 s lease so a dead worker does not wedge the key; deterministic refusals are
stored, failures whose outcome may differ (5xx, 429, unknown, a crash) release the
key; TTL 24 h, or 7 days for a command that asks (financial and academic). The SDK generates the key once per logical call, outside its retry
loop.

## Why

Networks retry, clients double-tap, queues redeliver; a command that registers a
student or posts a grade cannot run twice because a response was lost. Scoping by
tenant, actor and command means a key is never a way to read someone else's
response. Hashing the body means a client bug is told, rather than handed a stale
answer to a different question. The lease means a crash costs a minute, not a key.

## What it was chosen over

- **Key only (no body hash):** a reused key silently returns the wrong answer.
- **Global keys:** one tenant's string reads another's response.
- **No lease (lock until TTL):** a crashed worker blocks the action for a day.
- **Storing every outcome, including 5xx:** a transient failure becomes permanent.

## How it is held

`packages/platform/src/gateway/gateway.test.ts` — replay, key order, conflict, the
four scopes, in-progress and takeover, stored vs released, missing key, TTL.
`packages/platform/src/sdk/sdk.test.ts` — the same key and correlation id across
retries. Mutations (drop the tenant from the scope; drop the hash check) turn tests red.

## What this constrains

A command's response must be JSON-serialisable (it is stored). A non-idempotent side
effect inside a handler is a bug even with the key. `idempotency_in_progress` is 409
with `retryable: false` to keep ADR 0010's "only 429 and 503" rule; callers re-send
the same key after `Retry-After`.
