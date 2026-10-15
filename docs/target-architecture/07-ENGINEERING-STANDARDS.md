# 07 · Engineering standards

> Part of the [CTO architecture pack](README.md). Status: **proposed**.
> Each standard says **how it is held** — by a test that fails the build, or by
> review — the way `docs/DO-NOT-BUILD.md` does. A standard held only by review
> is one somebody talks themselves out of on a Friday.

## 1. API contracts

- Contract-first: the OpenAPI 3.1 fragment (and Zod schemas it is generated
  from) is merged *before* the handler. Clients are generated; hand-written
  fetch calls to our own API are a lint error. *Held by:* lint + generated-client
  freshness check.
- URL shape: `/v1/{module}/commands/{verb-noun}` (POST), `/v1/{module}/queries/{noun}` (GET).
  Resources never encode the tenant — it comes from the verified session.
- Versioning: URL major (`v1`) + additive-only evolution inside a major;
  breaking change ⇒ new major, old one supported ≥ 12 months (≥ 90 days for
  first-party clients). *Held by:* `oasdiff` breaking-change check (required).
- Pagination: cursor-based, stable ordering, `limit ≤ 200`. Filtering and
  sorting only on indexed fields declared in the contract.
- Errors: one **ErrorEnvelope** (ADR 0010, live in the gateway):

```ts
interface ErrorEnvelope {
  error: { code: string;            // stable, documented, machine-readable
           reasonCode?: string;     // PDP reason
           message: string;         // = userMessage, safe to show
           userAction?: UserAction; // what the person can do next (never a dead end)
           retryable: boolean; retryAfterSeconds?: number;
           correlationId: string; requestId: string;
           fields?: Array<{ path: string; message: string }> } }
```
  *Held by:* a test that fuzzes every route with bad input and asserts the
  envelope and the absence of stack traces/SQL.
- Idempotency, correlation, rate limits: §2–§3.
- Webhooks (outbound): signed (HMAC-SHA-256 over timestamp + body, 5-minute
  tolerance), retried with exponential backoff for 72 h, replayable from the
  console, versioned event types. Inbound webhooks are verified, stored raw,
  processed idempotently (the Stripe webhook already does this).
- Standards-owned surfaces (SCIM 2.0, LTI 1.3/AGS/Deep Linking, SAML/OIDC,
  QTI, ICS) follow their specifications; we do not invent variants.

### Command and result shapes (reconciling the audit with what exists)

The audit proposes `CommandEnvelope`/`CommandResult`. The repository already
has `AuthorizationRequest`, `SemesterEvent`, `ErrorEnvelope`, the gateway's
`ActionInput`/`Receipt`/`Refusal`. **Do not add a parallel vocabulary.**
Adopt the audit's names as *thin aliases over the existing types*:

```ts
// packages/contracts/src/command.ts
export interface CommandEnvelope<T> {
  commandId: string;              // client-generated UUID, also the dedupe key per (tenant, commandId)
  idempotencyKey: string;         // = Idempotency-Key header
  correlationId: string;          // CORRELATION_ID_PATTERN (exists)
  purpose?: string;               // feeds AuthorizationRequest.context.purpose
  submittedAt: string;
  payload: T;                     // validated by the command's Zod schema
  // tenant and actor are NOT fields: they are derived from the session server-side
}
export type CommandStatus = 'accepted'|'completed'|'pending_approval'|'rejected'|'failed';
export interface CommandResult<T> {
  commandId: string; status: CommandStatus; data?: T;
  userMessage: string; nextAction?: UserAction;
  auditEventId: string; correlationId: string;
}
```
Note the one deliberate departure from the audit's sketch: **`tenantId` and
`actor` are not client-supplied fields.** They are derived from the verified
session (invariant 1, [01](01-TARGET-ARCHITECTURE.md) §3).

## 2. Idempotency

- Every command carries an `Idempotency-Key`. The server stores
  `(tenant_id, key) → (request_hash, response, status, expires_at)` in the same
  transaction as the effect. Same key + same hash → replay the stored response;
  same key + different hash → `422 idempotency_key_reused`. Retention 24 h
  minimum, 7 d for financial/academic commands.
- Consumers use the receipt ledger (`processOnce`) keyed by `eventId`.
- Outbound calls to providers carry a derived idempotency key
  (`hash(tenant, commandId, adapterId)`), so a retry after a timeout cannot
  double-charge or double-post a grade.
- *Held by:* a generic test run against **every** registered command: call it
  twice with the same key and assert one effect, one audit row, identical
  responses; call with a different body and assert the conflict.

## 3. Correlation IDs and tracing

- Client mints `X-Correlation-Id` per user action (accepted if it matches
  `CORRELATION_ID_PATTERN`); server mints `X-Request-Id` per request, never
  trusting a client value. Both go on every response, every log line, every
  span, every audit row, every outbox event (`correlationId`; `causationId` =
  the event or command that caused this one), every outbound provider call, and
  are shown on system-failure screens ("support reference").
- *Held by:* gateway tests exist; extend to a route-table test that fails if a
  registered route's response lacks either header, and to a worker test that
  fails if a consumer drops `correlationId`.

## 4. Events

- Catalogue: one `EVENT_TYPES` registry (50 types today). A type is added in
  the same change as its first consumer; each has `version`,
  `classification`, `retention`. Naming `domain.verb_past` (the existing
  `EVENT_TYPE_PATTERN` is `^[a-z_]+\.[a-z_]+$`).
- Schema evolution: additive within a version; breaking ⇒ new version with
  both emitted for ≥ 1 retention-appropriate window; consumers declare the
  versions they accept. *Held by:* `packages/event-schema` compatibility test.
- Payload hygiene: no free text from students in event payloads unless the
  event's classification allows it; PII fields enumerated in the schema and
  masked by obligation when events leave the core (to the warehouse, to
  webhooks).
- Audit events are a **different stream** from domain events and are
  hash-chained. Domain events may be dropped/replayed; audit events may not.

## 4a. Authorization

- Every command and query is bound to a `POLICY_ACTION` (today 3 → target:
  all). Adding a handler without an action fails the route-table test.
- Every action has: a rule, a classification ceiling, an audit event, a test
  that **shows the rule refusing**, and a conformance case against RLS.
- Client role checks (`lib/role.ts`) are UX only; the code says so and a test
  greps for authorization decisions made from client state in new code paths.

## 5. Feature flags and kill switches

- One registry; each flag has: owner, purpose, **expiry date**, default,
  allowed rings, blast radius, kill-switch behaviour, and the capability-register
  row it gates. Flags without an expiry fail CI; expired flags fail CI (the
  existing flag registry tests are the starting point).
- Types: *release* (short-lived), *ops/kill* (permanent, tested monthly),
  *entitlement* (commercial), *experiment* (needs a measurement plan and
  privacy review — no dark patterns, per the audit's user-agency law).
- A flag **never** substitutes for authorization or tenant evidence: the
  activation control plane already denies high-risk capabilities without tenant
  approval, flag or not.
- Server-evaluated; clients receive resolved decisions, never rules.

## 6. Code ownership and review

- `CODEOWNERS` per path ([02](02-MONOREPO-STRUCTURE.md) §5); two approvals for
  `kernel`, `identity`, `finance`, `migrations`, `infrastructure`; author never
  approves own change; second-person publish for configuration (D-1011).
- PR template extends the existing one: capability-register row, threat-model
  delta, accessibility evidence, migration plan, rollback plan, flag + expiry,
  data classification of new fields.
- Size budget: PRs > 800 changed lines (excluding generated/lock/snapshots)
  need a justification; files > 1,500 lines are not allowed to grow
  (`complexity-budgets.json` already budgets this; ratchet it down as screens
  are decomposed).
- **Main-first discipline** (repository rule, CLAUDE.md): before starting, fetch
  main and grep for the *thing*; if it landed, stop. Rebase before pushing.
  New decisions are `docs/decisions/D-<PR>.md`.

## 7. Dependency policy

- Every new dependency needs: licence check (allow-list: MIT/Apache-2.0/BSD/ISC/
  MPL-2.0; copyleft needs counsel), maintainer health, install-script review,
  size impact, and a named owner. Runtime dependencies in `app/` are only nine
  today — treat that as a feature.
- Pin exact versions in lockfile; Dependabot weekly grouped PRs; security
  updates immediately; `npm audit --audit-level=high` and SBOM
  (`npm sbom`) already gate CI.
- No dependency may phone home with user data; ad/tracking SDKs are banned
  (DO-NOT-BUILD rule 10, test exists).
- Vendor SDKs (auth, payments, AI, observability) sit behind a port in
  `platform/`, never imported from a module directly. *Held by:* boundary rule.
- Supply chain: provenance attestations on artifacts, pinned GitHub Actions by
  SHA, `permissions:` minimal per workflow, no `pull_request_target` with
  checkout of untrusted code.

## 8. Testing standard (every capability: the audit's 16 conditions)

| Layer | Required | Tooling (existing → target) |
| --- | --- | --- |
| Unit / property | pure domain logic; time-zone matrix; shuffled order | vitest; fast-check for merge/sync/policy |
| Authorization | **second-account** negative tests per table and per action; PDP↔RLS conformance | `supabase/*.check.sql`; new conformance runner |
| Contract | OpenAPI, event schemas, connector fixtures | `oasdiff`; recorded-fixture adapters |
| Integration | module + real Postgres | Testcontainers / local Supabase |
| E2E | critical journeys on preview env | Playwright (`smoke:*`) |
| Accessibility | axe in CI + manual screen-reader script per release; keyboard-only run | `smoke:a11y`; **new** assistive-tech checklist artifact |
| Offline/sync | partition, reorder, duplicate, clock-skew, revoke-while-offline | **new** deterministic simulator in `offline-sync` |
| Resilience | provider-degraded run; DB failover; worker kill | **new** chaos subset |
| Security | DAST, SAST, secrets, dependency, prompt-injection, tenant-isolation fuzz | HawkScan, gitleaks, `injection.live.test.ts`; **new** isolation fuzz |
| Performance | budgets; load at 1×/2× target; p95 per journey | `perf-budgets.json`, `load.sh`; **new** k6 profiles |
| AI quality | eval sets versioned with prompts; regression gate | `eval:model-quality` |

**Repository proof standard** (CLAUDE.md, restated because it applies to every
new guard): revert the fix under the new test and watch it go red, then restore;
include a control; look at the screenshot for anything visual.

## 9. The "native when degraded" invariant

For every domain, CI runs the journey suite with **every adapter replaced by a
failing stub** and requires the native workflow to pass. This is the audit's
"native first, connected when available" turned into a build failure. Rows that
cannot pass (e.g. official transcript from SIS) must be declared
`authority: external` in the capability register and show the *degraded-mode*
UX, which is itself asserted.

## 10. Documentation and decision standard

- Facts, decisions, hypotheses and legal-review items are labelled differently
  (the audit's decision discipline). Legal conclusions are never written as
  facts; they are routed to `LEGAL-REVIEW-QUEUE.md`.
- Docs that mirror registries are generated (`npm run registers`) and held by
  tests; hand-copied tables drift.
- ADRs: one decision per file, status, alternatives, revisit trigger, linked
  tests. Numbering follows the pull request.
