# API gateway / BFF standards

Applies to every surface that accepts a request: the institution gateway
(`app/api/institution`, `app/server/institution`), edge functions, and any BFF a
client surface gets. The code is `packages/platform/src/gateway/` and
`tenancy/context.ts`; the client half is `sdk/client.ts`.

## The request, in order

```
 1 transport      TLS, body size cap, rate limit (per tenant+person — see MIGRATION: rate-limit.ts)
 2 authenticate   verify the session (or a service token) → TrustedIdentity
 3 context        buildRequestContext(untrusted, trusted): tenant from the verified identity only
 4 version        negotiateMajor(path, registry): the /vN in the path
 5 command/query  runCommand(...) for writes · policy-checked repository reads for queries
 6 respond        body + x-request-id + x-correlation-id (+ deprecation/sunset on a deprecated major)
 7 on any throw   errorResponse(e, correlationId): one envelope, nothing leaked
```

## Request context

- **Tenant** is derived from a verified membership, SSO issuer binding, LTI
  deployment or service binding. **There is no tenant header.** If a client sends
  `X-Tenant-Id` and it disagrees with the session, the request is refused
  (`tenant_mismatch`) rather than quietly overridden.
- `X-Request-Id` is minted per request and is **never** anything a client sent.
- `X-Correlation-Id` is the client's if it matches `^[A-Za-z0-9._:-]{8,128}$`,
  minted otherwise (a header lands in logs and audit rows; ADR 0010). It goes to
  every audit row, event and log line the request causes.
- `Idempotency-Key` — see below. A malformed one is `invalid_request`.
- The context is **frozen** and carries: tenant, environment, how the tenant was
  verified, actor (person, account, type, session, MFA level), memberships, role
  grants, resolved capabilities, purpose (default `service_delivery`),
  correlation and request ids, idempotency key, receipt time.

## Errors

One envelope (ADR 0010), for every surface:

```json
{ "error": { "code": "forbidden", "message": "…", "correlation_id": "…",
             "retryable": false, "user_action": { "label": "…", "kind": "…" } },
  "message": "…" }
```

`code` is a name a client may switch on. `message` is a sentence **for the
person**. **`retryable` is true only for 429 and 503**; a 502 means the outcome
is unknown and the client must reconcile — a client that reads only flags must
hear that too. Anything an adapter threw that was not meant for a person
(connection strings, stack traces, another tenant's row) is flattened to
`internal`. The top-level `message` is kept for clients written before the
envelope.

| Code | HTTP | Retry | Meaning |
| --- | --- | --- | --- |
| `invalid_request` | 400 | no | Malformed request (bad header, bad `limit`) |
| `validation_failed` | 400 | no | The input is not acceptable; the message says how to fix it |
| `version_unsupported` | 400 | no | Unknown or retired API version; names the version to move to |
| `invalid_cursor` | 400 | no | Forged, expired, other-tenant or other-query cursor; start from page one |
| `unauthenticated` | 401 | no | No or invalid credential (also every service-token failure, deliberately uninformative) |
| `entitlement_required` | 402 | no | The plan does not include it; carries a "See plans" action. Never used for records, export, deletion, accessibility or safety |
| `forbidden` | 403 | no | Policy said no; the sentence does not reveal whether the thing exists |
| `tenant_unresolved` | 403 | no | No verified tenant could be attached |
| `tenant_mismatch` | 403 | no | The request names a different tenant than the session, or a value carried another tenant's id |
| `tenant_suspended` | 403 | no | The tenant is not `active` |
| `consent_required` | 403 | no | A consent from the data's owner would open this; the surface can offer the prompt |
| `not_found` | 404 | no | Not found **or not yours** — the two are indistinguishable by design |
| `conflict` | 409 | no | Stale version / already exists |
| `idempotency_in_progress` | 409 | no | The first attempt is still running; `Retry-After` says when to ask again with the same key |
| `precondition_failed` | 412 | no | The state does not allow it (an illegal workflow move, a file not ready, a legal hold) |
| `idempotency_key_reused` | 422 | no | The key was used for a different request: a client bug (the IETF idempotency-key draft's 422) |
| `rate_limited` | 429 | **yes** | Slow down; `Retry-After` |
| `internal` | 500 | no | Our fault; the message is generic |
| `outcome_unknown` | 502 | no | An upstream call may or may not have happened — **reconcile, do not retry** |
| `unavailable` | 503 | **yes** | Try again later |

`idempotency_in_progress` is 409 with `retryable: false` to honour the ADR's rule
that only 429 and 503 are blind-retryable; the SDK does not auto-retry it, and a
caller that wants to wait re-sends the same key after `Retry-After`.

## Idempotency

`gateway/idempotency.ts`. Every **command** requires an `Idempotency-Key` (16–128
safe characters), generated by the client **once per logical action** and reused
on every retry. The record is keyed `(tenant, actor, command, key)`.

- Same key, same body → the stored response, byte for byte (`replayed: true`).
- Same key, **different** body → `idempotency_key_reused` (422). The body is hashed over
  canonical JSON, so reordering fields is not a different request.
- Another tenant, person or command with the same string → a **separate** record:
  a key is never a way to read someone's response.
- First attempt still running → `idempotency_in_progress`. A **lease** (60 s)
  means a worker that died holding the key does not wedge it.
- Deterministic refusals (validation, forbidden, not found) are stored and
  replayed; failures whose outcome may differ next time (5xx, 429, unknown) release
  the key so a retry can run. A handler failure rolls back the record, audit row
  and event together *and* releases the key.
- TTL 24 h by default; a command may keep its keys 7 days (`idempotencyTtlMs`,
  `IDEMPOTENCY_TTL_EXTENDED_MS`) — financial and academic commands do.
- The client may send a **command id** (a UUID) with a queued command; it is echoed in
  `CommandResult.commandId` so an offline client can match answer to command. It is a
  label, never a key: anything not a UUID is ignored and one is minted.

## Pagination

`gateway/pagination.ts`. Keyset, never offset (offset skips and repeats under
writes, and gets slower with depth). `limit` default 50, max 200. The cursor is
opaque and **HMAC-signed over tenant, a hash of the query, the last
`(sort, id)` and an expiry (15 min)**, with a `kid` so keys rotate. A cursor lifted
from another tenant, replayed on a different filter, edited, expired, or signed by
a retired key is `invalid_cursor`. Response: `{ items, nextCursor|null }`.

## Versioning

`gateway/versioning.ts`. **A major in the path (`/v1/…`), additive change inside it,
and a published lifecycle for retiring one.** This is the rule
[`docs/target-architecture/07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md)
§1 proposes (URL major + additive-only evolution; a breaking change is a new major;
the old one supported ≥ 12 months, ≥ 90 days for first-party clients), made
executable so the platform and the pack do not grow two conventions. Lifecycle:
`current → supported → deprecated → sunset`. `Deprecation` and `Sunset` headers
appear on every response for a deprecated major; a major past its `sunsetAt` is
refused with `version_unsupported`, naming the major to move to. **At least 365 days**
between announcing deprecation and sunset (**90** for a `firstPartyOnly` major),
checked by `registryProblems` and held by a test: an institution's integration is
not broken by a date chosen on a Friday. There is no version header and no
per-tenant pin; both were considered and dropped as a second way to say the same
thing.

## Service-to-service authentication

`gateway/service-auth.ts`. Short-lived HMAC-SHA-256 tokens
(`header.claims.signature`). The algorithm is **ours, never the token's** (no
`alg: none`, no confusion); `kid` selects a key so keys rotate without an outage;
`aud` names the one service it is for; **`ten` binds it to one tenant**; lifetime
is capped at 5 minutes at signing *and* at verifying; `jti` feeds an optional
replay guard. A token with no `ten` reaches tenant data **only** with the
`platform:cross_tenant` scope on the `platform-ops` audience — the narrow door for
support and operations tooling, which also needs a justified, time-limited grant
at the policy layer (a service is an actor and is policy-checked and audited like
a person). Every failure is the same uninformative `unauthenticated`.

## The command contract

`gateway/command.ts`. The audit's `CommandEnvelope`/`CommandResult` made
executable, in a fixed order that no domain can vary:

1. **parse** — bad input refused before anything is read (`validation_failed`)
2. **authorize** — the policy engine; a denial is **audited**, then `forbidden`
   (or `consent_required`)
3. **approval gate** — an action marked `requiresApproval` stops with
   `status: "pending_approval"` and a `nextAction` approval id, writes nothing;
   re-run with `approvalId` once approved: it authorises **that change, once**
   (consumed inside the unit of work, so a failed command does not spend it)
4. **idempotency**
5. **unit of work** — handler + audit row + outbox events commit **together or
   not at all**
6. **result** — `{ commandId, status, data?, userMessage, nextAction?,
   auditEventId, correlationId }`

`status` is one of `accepted · completed · pending_approval · rejected · failed`.
`auditEventId` is the row that proves it — the question the specification asks
operations to be able to answer.

The handler receives a **`Transaction`** — a `TenantScope` and `emit()` — not a
database, so even a handler that wants another tenant's rows has no handle to
reach them.

## Client SDK rules

`sdk/client.ts`: correlation id and version on every call; `Idempotency-Key` on
every mutating call, **generated once outside the retry loop**; never a tenant;
retry only on `retryable` (429/503), honouring `Retry-After`, capped backoff with
full jitter; never retry a 502; a network failure is retried only when safe (a
read, or a write that carries a key); a non-envelope error is `malformed_response`,
not a guess. A queued offline command supplies its own key and correlation id so
it replays across sessions.
