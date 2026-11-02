> **Superseded by `../baseline/`** (see `../VERSIONS.md`). Kept for history.

# Control plane v2: the saga coordinator and aligned contracts

Source: `uploads/NIST Zero Trust saga state machine_ step-by-step c.pdf` (October 2026).

This version **replaces the saga state names used in `../` (v1)**: VALIDATING, EVALUATING, PREPARING, INSTALLING and EXPIRED replace the v1 names. Use v2 when building. Keep v1 only for its Rego policy and its component JSON Schema. In v1's `access.openapi.yaml`, the PA and evidence operations still apply; the SagaStatus enum there is out of date.

Nothing here has been compiled, validated or run. The persistence adapter and service adapters must be built and tested against the real repository.

Interactive simulator: `ui_kits/governance-backbone/index.html#runner`.

> TypeScript sources carry a `.txt` suffix so the design-system compiler doesn’t bundle them; strip it when copying into the repo.

## Files
- `access-saga.ts.txt`: the State type, the `Store` and `Services` adapter interfaces, the transition graph, `operationKey`, jittered backoff, and `AccessSagaRunner.tick()`.
- `access-request.schema.json`: the public request body. Callers send only what they intend to do. They never send identity claims, capabilities, trust scores or permission decisions.
- `request-envelope.example.json`: the record the server creates for each request. No field supplied by the client establishes authority.
- `access.openapi.yaml`: the request/response API, aligned to the v2 state names. The access request is created with a 202, which means the request was saved, **not** that access was granted.
- `access.asyncapi.yaml`: three event streams (lifecycle, signals and evidence), plus descriptive `x-semester-execution` handler notes.

## Durable storage tables
`access_sagas`, `access_saga_transitions`, `access_operation_receipts`, `access_signal_receipts`, `access_outbox`, `access_grants`, `access_reconciliation_runs`, `access_evidence_observations`.

Storage must provide:
- exclusive, time-limited worker leases with fencing tokens
- revision-checked state changes (compare-and-swap)
- one transaction that writes the saga update, the audit entry and the outbox entry
- saved idempotency results for requests
- unique IDs for consumed events
- operation keys that stay the same across retries
- a scheduled sweep that reconciles grants not yet in a final state

## The code is safe only if the adapters do this
- `prepare` checks the referenced decision's expiry, scope, policy revision and request digest.
- `install` checks current validity again and can't bring back a revoked generation.
- `inspect` returns `absent` only when absence is authoritative, never just because a read failed.
- `revoke` confirms enforcement across every required PEP.
- `save` rejects expired or stale fencing tokens.
- Operation receipts recover a remote operation that succeeded when the worker crashed before saving the saga state.
- `wake` authenticates the sender, removes duplicate signals, and increments the generation when validation resumes. A completion signal only wakes the saga. The orchestrator rebuilds trusted context and evaluates the policy again; it never trusts the event's claim.
- Prepared grants that were never attached to a saga are recovered explicitly.

## Production release gate

**Persistence**
- [ ] Durable lease with fencing
- [ ] Revision-checked state changes
- [ ] Saga, audit and outbox written in one transaction
- [ ] Saved idempotency receipts
- [ ] Recovery of prepared grants never attached to a saga

**Policy and enforcement**
- [ ] Trusted context assembled on the server
- [ ] Decisions tied to the exact subject, resource, action and input
- [ ] Current policy and membership checked again
- [ ] Every obligation enforced
- [ ] Revoked generations can't be reinstalled

**Failure recovery**
- [ ] Timeout after the remote install succeeded
- [ ] Worker crash before state is saved
- [ ] Duplicate signal or event
- [ ] Out-of-order signal or event
- [ ] Revocation while an install is in progress
- [ ] Unreachable PEP
- [ ] Decision expires during provisioning
- [ ] Evidence delivery outage

**Contracts**
- [ ] TypeScript compiles and automated tests pass
- [ ] JSON Schema validates
- [ ] OpenAPI validates and its references resolve
- [ ] AsyncAPI validates and its references resolve
- [ ] Tests for the mapping from code events to published events
- [ ] Authenticated broker transport and channel access control
