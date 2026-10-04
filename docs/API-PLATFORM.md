# The domain API platform

How every Semester domain API is shaped, authorized, written, delivered and
watched — and the first one built to that shape, tasks and calendar
(`app/server/productivity/`).

This is an engineering specification. Where it names a regulation or a
contract term it names an *engineering control*, never a legal conclusion;
qualified counsel decides what satisfies FERPA, COPPA or a customer's terms
([`COUNSEL-BRIEF.md`](COUNSEL-BRIEF.md)).

## 0 · What is built and what is only specified

Every section below says which it is. The summary:

| Built, tested, and — where stated — mutation-checked | Specified only |
|---|---|
| Error envelope, correlation ids, strict validation, body limits, per-identity rate limits, ETags, cursor paging (§1, §7) | Webhook delivery and signing (§1.9) |
| Four policy actions and their rules; every route asks them (§3) | Domain services other than tasks/calendar (§2) |
| Command pipeline: idempotent, per-field last-writer-wins, atomic with audit and outbox (§4, §10); the Postgres `ProductivityRepository`, run against a real migrated database (§4.2, §10.7) | An authenticator, a route and a client (§10.6) |
| Outbox publish loop, dead-lettering, idempotent consumers (existing `events.ts`, exercised here) | Outbox backoff column, operator requeue (§4.4) |
| Migration, RLS, one atomic commit function, the read functions, ledger sweep — 66 SQL checks (§5) | File service and malware scanning (§6) |
| `/healthz`, `/readyz`, `/metrics`, policy-decision metrics (§9) | SLO dashboards, alerting rules, tracing (§9) |
| OpenAPI 3.1 document held equal to the code (§8) | Consumer-driven contract tests, breaking-change gate in CI (§8) |

**Nothing here is wired to a running client.** No route is mounted, no
authenticator is bound to Supabase, and the new tables hold nothing until one
is. The storage adapter exists and is tested against a real database, but
nothing constructs it. §10.6 lists exactly what stands between this and a first
request.

### How this relates to the target-architecture proposal (#1144)

`docs/target-architecture/` (merged while this was being written, status
**proposed**; D-1144) has its own API conventions: P-13 in
`03-TECHNOLOGY-DECISIONS.md` and §1–§3 of `07-ENGINEERING-STANDARDS.md`. Those are
proposals and each becomes an ADR when a phase needs it, so this document does not
treat them as binding — but it does not argue with them where it need not.

**Conformed to** (zero cost, so done): `X-Correlation-Id` / `X-Request-Id` on every
response including every failure, held by a route-table test; one error envelope
with a stable `code`, a safe `message`, `retryable` and a recovery action; cursor
pagination with `limit ≤ 200`; URL major with additive-only evolution and
deprecation windows of ≥ 12 months (≥ 90 days first-party); signed outbound
webhooks (HMAC-SHA-256 over timestamp + body, 5-minute tolerance, 72 hours of
retry); `causationId` on events; the error code `idempotency_key_reused`; a
policy action bound to every route, held by a route-table test; and the generic
test the proposal asks for — **every registered command** is called twice with
one id and asserted to have one effect, one audit row, one event and the same
answer, and called with a different body and asserted to conflict
(`service.test.ts`, a case per `COMMAND_TYPES` entry, failing if one is added
without a case).

**Differs, deliberately, and why** — for the P-13 review to decide, not settled here:

| Topic | The proposal | Here | Why |
|---|---|---|---|
| Command URL | `POST /v1/{module}/commands/{verb-noun}`, one command per request | `POST /v1/productivity/commands`, a **batch** of up to 50 | An offline device replays a queue. One request per command is hundreds of round trips on a weak connection and no way to say "stop at the first failure". A single-command endpoint is the same pipeline with one element, so the two are compatible; the batch is the collection form. |
| Idempotency key | `Idempotency-Key` header, `(tenant, key)`, 24 h (7 d financial) | `commandId` **in the body**, per command, `(tenant, owner, commandId)`, **35 days** | A queued command can be 30 days old when it arrives (`command_expired` beyond that), so a 24-hour ledger would let an old replay apply twice. Single-`POST` APIs elsewhere use the header with the same ledger. |
| Result vocabulary | `accepted`, `completed`, `pending_approval`, `rejected`, `failed` | `applied`, `superseded`, `duplicate`, `rejected`, `failed`, `not_attempted` | `applied`≈`completed`, `rejected` and `failed` match. `superseded`, `duplicate` and `not_attempted` exist only because of replay and tell a client what to do with its queue. `pending_approval` is for consequential domains (finance, grades) and belongs there. |
| Error casing | An illustrative camelCase sketch (`correlationId`, `userAction`, `fields`) | The **live** ADR 0010 shape (`correlation_id`, `user_action`), plus `request_id`, `details`, `retry_after_seconds`, `outcome_known` | The sketch cites ADR 0010 as live but is not the shape ADR 0010 ships. The gateway's tests and the browser client read the live one. One of the two should be corrected before the first external client. |
| Schemas | Zod (or TypeSpec) as the single source; clients generated; OpenAPI merged first | Hand-written validators; the OpenAPI document **held equal by test** | No new dependency was introduced for one service. Nothing here prevents generating from the spec later; the drift tests are what would catch a generator disagreeing with the handler. |
| Result carries `auditEventId` | Yes | Not yet | The audit row's id is assigned by the database; returning it needs the Postgres adapter. |

### What it relates to, so there is one of each

| Already in the repository | Relationship |
|---|---|
| `packages/institution/src/policy.ts` — the policy decision point (ADR 0007) | **Reused.** Four actions added (`task.read`, `task.write`, `calendar.event.read`, `calendar.event.write`); the evaluator is unchanged. |
| `packages/institution/src/events.ts` — envelope, outbox, `processOnce` (ADR 0008) | **Reused.** Eight event types added. |
| ADR 0010 — correlation ids, one error envelope | **Extended**, additively: `request_id`, `details`, `outcome_known`. |
| `server/institution/rate-limit.ts` | **Reused** (`RateLimiter`, `MemoryRateLimiter`). |
| `public.audit_event` and `private.record_audit` | **Reused as the audit sink.** |
| `private.domain_outbox_events` / `domain_event_receipts` | **Reused.** |
| `public.tasks`, `public.appointments` (per-record JSON the browser syncs) | **Not touched, not replaced.** The new tables are a different, governed model; until a client moves, they are empty. A backfill from the old tables is a decision for the owner (§11). |
| `public.productivity_workspace` (opt-in JSON blob with CAS) | **Not touched.** |

---

## 1 · API conventions

These apply to every domain service. The tasks/calendar API is the reference
implementation; `docs/api/productivity.v1.openapi.json` is its machine-readable
form, and `openapi.test.ts` holds it equal to the code.

### 1.1 Shape: commands and queries, kept apart

| | Command | Query |
|---|---|---|
| Verb | `POST` | `GET` |
| Idempotent | **Always**, by `commandId` | Naturally |
| Effect | Changes state, writes audit and an outbox event in one transaction | None, except an audit row when somebody else's data is read |
| Result | Per-command outcome (`applied` \| `superseded` \| `duplicate` \| `rejected` \| `failed` \| `not_attempted`) | The resource, or a page |
| Retried by | The client, with the same `commandId` | Anyone |
| Cache | Never | `private, no-cache` + ETag for one record; `private, no-store` for lists |

Commands are named for intent (`task.complete`), not for a column
(`PATCH status=done`). The server derives what changed; the client says what it
meant, which is what lets two devices' intents merge field by field (§10.3).

Paths are `/v1/<domain>/<noun>`; a write endpoint is `POST …/commands`, taking
a batch of up to 50. A batch is **not** one transaction — an offline queue holds
unrelated intents and one refused command must not strand the forty behind it.
Each command commits alone, and the request as a whole is safe to resend after
any failure.

### 1.2 Versioning

- **Major in the path** (`/v1`). A response carries `Semester-API-Version: 1`.
- **Within a major, additive only**: new optional request fields, new response
  fields, new endpoints, new error codes, new enum values *in responses*. A
  client must ignore what it does not know. Removing, renaming, tightening a
  validator or changing a meaning is a new major.
- **Strict requests, lenient responses.** A request with an unknown key is
  refused (`validation_failed`); a response with an unknown key is ignored. The
  first catches a client sending `ownerId` or `tenantId` that the server would
  never honour; the second is what makes additive change safe.
- **Deprecation** is announced with `Deprecation: true` and `Sunset: <date>`
  headers, a changelog entry, and a notice in the console. A superseded major
  stays supported **at least 12 months**, and **at least 90 days** where every
  caller is a first-party client (the windows in the target-architecture
  proposal, `07-ENGINEERING-STANDARDS.md` §1). A deprecated endpoint's traffic is
  measured by client, and the sunset does not happen while a named institution
  still calls it without a written agreement.
- **Event types** are versioned independently (`EVENT_TYPES[…].version`); a
  consumer refuses a version it does not know (`validateEvent`).

### 1.3 Authentication and tenancy

A bearer session, validated by the server on every request — not decoded. The
**tenant, the roles, the memberships and the actor type come from the server's
own records** (`server/institution/auth.ts`, `membership.ts`), never from token
claims, headers or the body. The request has no `tenantId` field to send.
`owner` is the verified actor for a person's writes and cannot be named at all;
for a read it is an `owner_id` parameter that the decision point must justify
(a live share, a purpose).

### 1.4 Errors

One envelope, from ADR 0010, extended:

```json
{ "error": {
    "code": "grant_missing",
    "message": "This person has not shared this with you.",
    "correlation_id": "req-0123456789abcdef",
    "request_id": "4b0c…",
    "retryable": false,
    "outcome_known": false,
    "user_action": { "label": "Ask them to share it", "kind": "contact_support" },
    "details": [{ "path": "limit", "issue": "must be a whole number from 1 to 200" }]
  },
  "message": "This person has not shared this with you." }
```

| Rule | Why |
|---|---|
| `code` is stable and a client may switch on it; `message` is for a person and may change | A client that parses a sentence breaks on a copy edit. |
| `retryable` is **true only for 429 and 503** | A 5xx with an unknown outcome is *not* retryable as a flag — `outcome_known: false` says "reconcile", and for a command the same `commandId` is safe to resend. |
| `outcome_known` appears only when it is `false` | Its absence means "we know what happened". |
| `details` is field-level and bounded to 20 | Validation help without an oracle. |
| Never a stack, a query, a table name, another person's data, or whether a record the caller may not see exists | A foreign record is `404`, not `403`. |
| A refusal by the decision point carries its `reasonCode` as `code` and its `userMessage` as `message` | One vocabulary, from audit row to screen. |

Error codes are documented in the OpenAPI document's `x-error-codes` and the
test refuses a code that is emitted and not documented, or the reverse.

### 1.5 Pagination

Keyset cursors, never offsets. `?limit=` (1–200, default 50) and `?cursor=`;
the response is `{ "data": […], "page": { "next_cursor", "has_more" } }`.

- A cursor is **a position, never a permission.** It is opaque to the client and
  not trusted by the server; whatever it says, the query is scoped by the
  verified tenant and owner, so a forged cursor can only start the caller's own
  list in an odd place. `http.test.ts` forges one to prove it.
- A list ordered by a mutable key (due date) can shift between pages. That is
  what a keyset cursor costs; a client that needs *completeness* uses the
  change feed (`/changes`), whose position is a gapless per-owner sequence.

### 1.6 Idempotency

- Every command carries `commandId`, a UUID the **device** mints when the
  intent is made, and the entity ids are client-chosen too, so a *create* can be
  replayed.
- The server stores `(tenant, owner, commandId) → request hash + outcome` in the
  same transaction as the effect. A repeat with the same body answers
  `duplicate` with the first outcome; the same id with a different body is
  `idempotency_key_reused` (a bug or an attack, never a retry).
- Refusals are **not** stored: a denied command is re-decided against today's
  policy on every attempt, so a grant renewed this morning works this afternoon.
- The ledger outlives the longest queue: a command older than **30 days** is
  refused (`command_expired`), and the ledger keeps rows **35 days**, so nothing
  that could still arrive has lost its record.
- Domain APIs that take a single `POST` instead of a batch use the
  `Idempotency-Key` header with the same semantics and the same ledger.

### 1.7 Correlation

`X-Correlation-Id` is the client's if it is 8–100 characters of
`A-Z a-z 0-9 . _ : -`, otherwise minted; `X-Request-Id` is always minted. The
correlation id is written to **every** audit row and outbox event the request
causes, to the telemetry event, and to the log line. (100, not the 128 the
policy pattern allows: `audit_event.correlation_id` refuses more, and an id the
audit row cannot hold would fail the commit it is meant to trace.) The answer to
"which audit event proves this action?" is one query on that id.

### 1.8 Time, text and numbers

Instants: ISO-8601 with an offset, normalised to UTC milliseconds; a time with
no offset is refused. A calendar event also carries an IANA zone name — a place's
clock, not an instant. Text is trimmed, bounded, and refused if it contains
control characters other than newline and tab. Identifiers are UUIDs chosen by
the client for entities and by the server for everything else.

### 1.9 Webhooks *(specified)*

Outbound, per tenant, from the outbox.

| Property | Rule |
|---|---|
| Registration | A tenant admin holding `webhook:manage` (a policy action, audited); HTTPS only; event types chosen from the catalog; a secret generated server-side, shown **once**, stored encrypted. |
| Payload | **Thin.** `{ id, type, version, occurred_at, tenant_id, subject: {type,id}, correlation_id, data: { ids, version, changed_fields } }`. No student content: the receiver fetches under its own authorization. |
| Signature | `Semester-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, t + "." + rawBody)>`; one `v1=` per active secret so a rotation has an overlap. A receiver rejects `|now − t| > 300 s` and compares in constant time. |
| Delivery | At-least-once; no global order (the `seq` in `data` orders one subject). Receiver dedupes on `Semester-Event-Id`. 10 s timeout; any 2xx is success; 410 disables the endpoint. |
| Retry | 10 s, 1 m, 5 m, 30 m, 2 h, 6 h, 12 h, 24 h, ±20 % jitter. 72 h of consecutive failure disables the endpoint and notifies the tenant admin. |
| Dead letters | Kept 30 days; an admin may redeliver one (`POST /v1/webhooks/deliveries/{id}/redeliver`, audited). |
| SSRF | Port 443 only; resolve the name **once** and connect to that address; refuse loopback, RFC 1918, link-local (including `169.254.169.254`), unique-local and their IPv6 forms; **do not follow redirects**; deliver through an egress proxy with its own deny list. Re-check at delivery, not only at registration — DNS changes. |
| Inbound (Stripe, LTI, SIS) | Verify the provider's signature over the **raw** body with its timestamp tolerance; dedupe on the provider's event id; return 2xx immediately and process from a queue. The commercial tables already order invoice events (`billing_invoice_event_precedence`). |

---

## 2 · Service implementation plans

Thirteen domains. One was built (productivity); for the rest, this says what to
build first, from what the repository already has, and the gate it must pass.
Every service follows the same skeleton — **contract → policy actions → repository
contract → service → HTTP → migration + RLS + SQL check → OpenAPI → events** — and
none ships before its refusal tests are written the way `service.test.ts` writes
them (take an allowed request, change one thing, watch it refused).

| # | Service | Owns (from the product audit) | Already in the repo | First commands / queries | Source of truth & offline class | Gate to leave "specified" |
|---|---|---|---|---|---|---|
| 1 | **Identity & tenancy** | person, profile, institution, role, membership, consent, device | `identity.ts`, `provisioning.ts`, `scim.ts`, `membership.ts`, `auth.ts`, `institution_membership`, `role_grants` | `membership.resolve`, `session.revoke`, `device.register`, `consent.grant/revoke` | Institution claims + SSO/SCIM; profile edits student-owned. **Online-only** for roles and consent. | Authenticator returns a `Principal` for every service; revoke is effective within one request. |
| 2 | **Policy** | actions, rules, obligations, decision log | `policy.ts`, ADR 0007, `tenantcontract.ts` | `decide` (library, then a sidecar), `policy.explain` | Code in the repo; tenant contracts only narrow (`contracts/`). | Every route of every service names its actions (the §3 test, generalised); contract narrowing wired into `decide`. |
| 3 | **Academic** | term, course, section, enrollment, degree requirement, record, hold | `registration.ts`, `academic_record_ledger`, `registration_transaction`, `ledger_chains` | `registration.submit` (prepare→confirm→commit), `record.read`, `hold.read` | Institution SIS. Official records **never offline**; local plans are drafts. | Registration commit reconciles against the SIS; ambiguous result is `pending_reconciliation`, never "done". |
| 4 | **Learning** | module, assignment, submission, assessment, grade, feedback | `gradebook`, `lti*`, `course_studio`, `qti.ts`, grade-passback policy action | `submission.save_draft/finalize`, `grade.post`, `grade.passback.submit` | Instructor/LMS for grades; student for drafts. Autosave **local-first**; grades online-only. | Grade change audited with before/after *field names*; passback idempotent and reconciled. |
| 5 | **Productivity** | task, event, note, document, reminder, goal | **built here** (tasks, events) | §10 | Student-owned; **local-first**, field-aware LWW | Done for tasks/calendar; notes/documents need CRDT (§4.7) before activation. |
| 6 | **Finance** | account, charge, invoice, payment plan, aid, refund | `money.ts`, `student_accounts`, `student_payment_plans`, `commercial_core`, `billing_tax_integrity` | `charge.read`, `plan.enroll`, `payment.intent`, `refund.request` | Institution billing + processor. **Online-only**; a queued payment is never "paid". | PCI scope minimised (tokenised, no card data); ledger reconciled nightly; refunds two-person. |
| 7 | **Family** | guardian relationship, permission, sharing scope, consent, age policy | `family.ts`, `family_invites`, `family_shared_items`, `k12_guardians`, `SUPPORTER-FAMILY-PRIVACY-MODEL.md` | `relationship.invite/verify`, `share.grant/revoke`, `activity.read` | Verified relationship + consent records. **Online-only.** | Every guardian read is a `share` grant check + audit (the `task.read` rule is the template); revocation immediate. |
| 8 | **Career** | skill, portfolio artifact, opportunity, application, mentor, credential | `career.ts`, `opportunity_links`, `CAREER-EVIDENCE.md`, `CREDENTIAL-WALLET.md` | `portfolio.add`, `application.submit`, `credential.verify` | Student-owned artifacts; verified claims carry provenance. Drafts local-first. | Credential verification states are a state machine (`workflow.ts`); employer moderation. |
| 9 | **Campus** | event, location, service, meal, housing assignment, club, ticket | `housing.ts`, `clubs.ts`, `athletics.ts`, `dining`, `CAMPUS-*.md` | `event.rsvp`, `order.place`, `club.join` | Institution feeds; short-lived metadata offline with an expiry. | Content-freshness SLO per feed; moderation queue for community content. |
| 10 | **Marketplace** | provider, listing, offer, order, commission, dispute, payout | Verified *opportunity listings* only (`opportunities`, `listings.check.sql`). **No order, dispute or payout model exists.** | `listing.submit/publish`, then `order.*` | Provider + processor. Online-only. | Do not market anything beyond listings until orders, disputes and payouts exist, are reconciled and counsel has reviewed terms. |
| 11 | **Support & trust** | ticket, report, moderation case, incident, status event | `support_tickets`, `support_access`, `support_shares`, `help_requests`, `moderation_*`, `support.case.read_context` | `ticket.open/reply`, `case.read_context`, `report.submit` | Staff-authored; access by **student-created grant** only. | Impersonation never exists; every context read is grant + ticket + purpose + mask + audit (already the `support.case.read_context` rule). |
| 12 | **Integrations** | connector, mapping, sync cursor, job, reconciliation report | `server/integration/{worker,tick,registry}.ts`, `integration_control_plane`, `integration_quality`, `INTEGRATION-*.md` | `connector.sync`, `job.retry`, `reconciliation.report` | Source system wins authoritative fields. | Each connector has health, provenance, retry, dead-letter and a reconciliation report (§4.6). |
| 13 | **AI** | session, tool call, source, policy, prompt template, evaluation, decision | `intelligence*.ts`, `intelligence_policy`, `ai.retrieve_source` rule, `AI-RECOMMENDATION-EVALUATION-HARNESS.md`, ADR 0004 | `ai.request`, `ai.retrieve_source`, `ai.tool.confirm`, `ai.feedback` | Scoped, consented retrieval set; AI drafts carry model, sources, policy decision and acceptance. | Every tool call is a command through §1.6 and §3; a consequential one needs human confirmation (`require_confirmation`). |

### 2.1 Cross-cutting rules for all thirteen

1. **One action vocabulary.** A new endpoint adds a line to `POLICY_ACTIONS`, a
   rule, a refusal test and an event type in the same change.
2. **Owner is the actor unless the decision point says otherwise.** The only
   way to act on another person's data is a rule in `policy.ts` that names the
   grant, the scope and the purpose.
3. **Classification is declared by the producer and floored by the catalog.**
   `student_private` for a task; `education_record` for anything that is a grade
   or an official record. The `decide` ceiling refuses an action whose resource
   is more sensitive than the action may touch.
4. **Events carry ids, versions and field names — never content.** A consumer
   that needs content fetches it under its own authorization.
5. **Official and consequential writes are online-only transactions** with
   prepare → confirm → commit (`frontend-backend-contracts.md`), and an ambiguous
   outcome is `pending_reconciliation`.

---

## 3 · Authorization: every endpoint, every job

### 3.1 The pipeline

```
request ─▶ route ─▶ authenticate ─▶ rate limit ─▶ parse & validate ─▶ service ─▶ response
 (404/405)  (401; tenant, roles,     (429; per      (400/413/415;      │
             memberships from         identity,      strict, bounded)   ├─ resolve facts (PIP): grants, record state
             server records)          weighted)                         ├─ ask the PDP: decide(request) → allow+obligations | deny+reason
                                                                        ├─ honour obligations, or refuse (fail closed)
                                                                        ├─ one transaction: record + ledger + audit + outbox
                                                                        └─ respond (obligations applied: mask / limit / expire)
```

The order is the order of cost. A request that is not from a known person never
reaches a parser; a request that is over budget never reaches the policy.

### 3.2 Rules the middleware enforces

| Rule | Where | Test |
|---|---|---|
| Every route **declares** the policy actions it asks (`ROUTES[].policy`) | `http.ts` | `http.test.ts`: every route has a case; each declared action is one the service **actually asked** when the route was called; a route nobody tests fails. |
| The decision is made **inside the transaction**, against the record as it stands there | `service.ts` | Concurrency tests; no check-then-write gap. |
| A decision's **obligations are honoured or the request is refused** (`obligation_unsupported`) — `audit`, `expire_at`, `limit_fields`, `mask_fields` are honoured; anything else fails closed | `service.ts` | Mutation: `shared view not field-limited` is caught. |
| A read of **somebody else's** data writes its audit row **before** returning anything; if the write fails, nothing is returned | `service.ts` | `service.test.ts`. |
| Tenant and owner are **arguments to every repository method**; there is no unscoped query | `repository.ts` | `repository-contract.ts`: same ids in two scopes never meet. |
| A refusal is audited (reason code, no content) | `service.ts` | `service.test.ts`. |
| The decision point sees a **verified** tenant (`membership` \| `sso_issuer` \| `lti_deployment` \| `service_binding`); an unverified one is refused | `policy.ts` `decide` | `policy.test.ts`. |

Controls required of every action, and where each is enforced for tasks and
calendar:

| Control | Enforced by | Refusal code(s) |
|---|---|---|
| **Tenant** | Verified by the authenticator; PDP `tenant_unverified`; every repository call scoped; RLS | `tenant_unverified`, `tenant_unknown`, `membership_missing` |
| **Role / capability** | `has('productivity:use')`, `calendar:import` from the server's role grants (expired grants removed before any rule) | `capability_missing` |
| **Purpose** | Required for any non-owner read and for every import; recorded | `purpose_missing` |
| **Scope** | A share grant names its scope (`tasks:read` ≠ `calendar:read`), its grantee, its grantor, its expiry | `grant_missing`, `grant_not_live` |
| **Data classification** | Resource declared `student_private`; the action's ceiling refuses `education_record`; shared views are field-limited | `classification_exceeds_action` |
| **Ownership** | The owner of a person's write is the verified actor, structurally; the rule also refuses it | `not_owner` |
| **Source authority** | A source's fields are the source's; delete of a sourced record is refused | `source_authoritative` |

### 3.3 Background jobs

A job is not a way around authorization. It is an **actor** (`integration` or
`system`) with an identity, bound to a tenant, that asks the same decision point
for each unit of work.

| Job | Actor | Bound by | Asks | Notes |
|---|---|---|---|---|
| Calendar import | `integration` | `service_binding` + `calendar:import` | `calendar.event.write` per event, with `purpose = feed id`, `ownerId` supplied **by the job**, never a client | **Built and tested**; can write only `imported` events, only to calendars, never tasks, never a person's own entries. |
| Outbox publisher | `system` | Its own service principal | Moves events; reads no payload content | Tenant is carried on the event; consumers enforce `expectedTenant`. |
| Ledger sweep | `system` | `service_role` | — (operational data, not evidence) | `private.productivity_sweep_commands()`; checked. |
| Retention / erasure sweeps | `system` | Existing, hold-gated | Legal-hold check (`hold_gated_sweeps`) | Not touched. |
| Reconciliation | `system` | Read-only role | Reads counters and sequence numbers, not records | §4.6. |
| Reminder delivery | `system` | `service_binding` per tenant | `notify` obligation; respects consent and quiet hours | Specified. |
| Webhook delivery | `system` | Per-endpoint | Reads the outbox row only | Specified (§1.9). |

Rules for every job: **no ambient admin** (a job's database role can run only the
functions it needs, and none is `anon`/`authenticated`); the **owner it acts for
is an argument** the job supplies, and the service refuses to run a job with none
(`ownerFor`); **a job's work is audited as the job**, with the correlation id of
whatever triggered it (or a fresh one); and there is a **kill switch** per job
(feature flag, read each run) that an operator can flip without a deploy.

---

## 4 · Transactions, events and recovery

### 4.1 What is in one transaction

For one command, atomically or not at all:

1. the **command ledger** row (the idempotency record);
2. the **entity** row(s), at the next gapless sequence number;
3. the **audit** row (`public.audit_event`: verb, object kind, outcome, pseudonymous actor and owner, field *names*);
4. the **outbox** event (`private.domain_outbox_events`).

Not in it: delivering the event, notifying anyone, calling an external system.
Those happen after commit, from the outbox, and may be repeated.

`memory.ts` does this by staging and committing together, and a fault injected at
any step rolls back all four (`service.test.ts`: *rolls the whole command back
when the event cannot be written*). In Postgres it is one function,
`private.productivity_commit` (§5.3).

### 4.2 Serialization without long transactions

PostgREST cannot hold a transaction across "read, decide, write". So the service
reads and decides, then hands the commit everything — each entity with the `seq`
it was **read at**. The commit locks the owner's sequence row, and if any entity
has moved (`seq` differs) it raises `40001`; the service re-reads and re-decides.
The command ledger's primary key makes a concurrent duplicate collide (`23505`),
and the retry finds it in the ledger and answers `duplicate`. This is optimistic
concurrency with the ledger as the arbiter; `repository-contract.ts` states the
properties any adapter must have.

`postgres.ts` is that adapter. A transaction reads (each read its own call),
stages every write in memory, and sends the lot to `productivity_commit`; on
`40001` or `23505` it throws the staged writes away and **re-runs the work from the
reads**, so a decision is never made on one state and applied to another. Two things
make it correct rather than merely plausible:

- **The sequence number is predicted and held to.** The service is handed a `seq`
  when it saves an entity, before the commit allocates it. The adapter predicts it
  (the owner's counter as read, plus one per entity saved) and the commit refuses
  with `40001` if the counter is not where the prediction put it, under the lock it
  already takes. A number returned from `save` is therefore never one that two
  writers both believed was theirs. A test asserts that the `seq` each caller was
  *told* equals the `seq` the row was *given*, which the table's own gaplessness
  would not show.
- **Reads are finished JSON.** Every read is a function returning the entity in the
  service's own shape, so the adapter does no row mapping, and `schema.test.ts` holds
  the keys equal to the TypeScript entity.

Within one process, transactions for one scope also run one at a time, so a single
person's offline queue does not fight itself; across processes the database is the
arbiter.

### 4.3 The outbox, and what "published" means

`drainOutbox` (existing) offers each pending row to `publish`; a throw records
the attempt and message (≤ 500 characters, never the payload); after
`maxAttempts` (default 5) the row is **dead-lettered** — kept, visible,
not offered again. Delivery is **at-least-once**; every consumer therefore uses
`processOnce(ledger, consumer, event, handler, expectedTenant)`, which refuses an
invalid event, refuses another tenant's, skips what it has processed, and records
the outcome. Tested here: *a consumer that sees one twice acts once*, *retries
then dead-letters*.

### 4.4 Retries, backoff and dead letters — the gap

`drainOutbox` retries on **every pass** until `maxAttempts`; there is no
`next_attempt_at`, so a failing downstream is hit again on the next tick rather
than after a growing delay. Before a publisher runs against a real bus:

- add `next_attempt_at timestamptz` to `domain_outbox_events`, set to
  `now() + backoff(attempts)` on failure (1 s, 5 s, 30 s, 2 m, 10 m, ±20 % jitter),
  and have `pending` select `next_attempt_at <= now()`;
- claim with `FOR UPDATE SKIP LOCKED` so two publishers never take one row;
- publish **per aggregate in `seq` order**: a row whose predecessor for the same
  aggregate is unpublished waits;
- an operator action `requeue(eventId)` that clears `dead_lettered_at`, resets
  attempts, and writes its own audit row; for an `education_record` event it
  needs a second approver (`console_approvals_and_break_glass` has the machinery).

Dead letters are not an error budget item; they are **a queue a person must
empty**, and a non-empty one is an alert (§9).

### 4.5 Retries on the client

| Result | Client does |
|---|---|
| `applied`, `superseded`, `duplicate` | Remove from the queue. For `superseded`, refetch the entity. |
| `rejected` | Remove; show `message` and `userAction`. Do not retry the same command. |
| `failed`, `not_attempted`, HTTP 429/503, a dropped connection | **Resend the same `commandId`s, in order**, with backoff (1 s, 2 s, 4 s … 60 s, jitter), honouring `Retry-After`. |
| HTTP 500 on a write (`outcome_known: false`) | Same: resend. It is applied once or answered from the ledger. |

### 4.6 Reconciliation

Three different things, three different tools.

| Reconciling | Method |
|---|---|
| **A consumer with its source** (search index, calendar export, analytics) | The change feed's `seq` is **gapless per owner**: the consumer keeps a watermark, a jump means a missed change, replay from `/changes`. A comparison of two integers, not two datasets. |
| **The outbox with the data** | Structural: the event is written in the commit, so no committed change lacks one. A weekly check counts `max(seq)` per owner against events published for the owner, and any difference is a defect in the commit function. |
| **An external system** (SIS, LMS, processor) | The integration service's reconciliation report (`INTEGRATION-QUALITY-AND-RECONCILIATION.md`): source wins authoritative fields; a discrepancy raises `reconciliation.discrepancy_detected`; an ambiguous write is `pending_reconciliation` until a receipt arrives. |

### 4.7 What a CRDT is for

Not for this. Tasks and events are **field-aware last-writer-wins** (§10.3)
because their fields are independent and the right answer to "two devices set the
title" is "the later intent", reported. A CRDT is for **collaborative documents**
(notes, shared worksheets), where merging character-level edits is the point;
each update is permission-checked, revocation applies to queued updates, and
snapshots compact under a tenant-scoped lock (`offline-sync-contract.md`). Do not
reach for one to make a task list "more correct".

---

## 5 · Migrations and row-level security

### 5.1 Layers, and which one is the boundary for what

| Layer | Enforces | Cannot enforce |
|---|---|---|
| Edge / gateway | Authentication, rate limits, body size, media type | Anything about the data |
| **Service** | Tenant, role, purpose, scope, classification, share grants, source authority — by asking the PDP | Anything a direct database connection could do |
| **Database** | Row-level security for owner reads; `check` constraints; primary keys that lead with `tenant_id`; no client write grant; one commit function | Purpose and consent (they are facts the database does not hold) |
| Audit | Evidence | Prevention |

RLS is the wall **behind** the service, not a substitute for it (ADR 0002 is the
boundary for reads by the owner; the PDP is the boundary for everything that is
not the owner's own). A policy that lets a second person read a row would let a
direct PostgREST call skip the audit; this schema has none, deliberately.

### 5.2 Patterns

**A · Owner-private, service-written** *(tasks, events)*

```sql
create table public.x (tenant_id text not null references public.schools(id),
                       owner_id uuid not null references auth.users(id) on delete cascade,
                       id uuid not null, …, seq bigint not null,
                       primary key (tenant_id, owner_id, id));
alter table public.x enable row level security;
revoke all on public.x from public, anon, authenticated;
grant select on public.x to authenticated;              -- no write grant
create policy "x owner read" on public.x for select to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null
         and exists (select 1 from public.institution_membership m
                     where m.auth_user_id = (select auth.uid())
                       and m.tenant_id = x.tenant_id and m.status = 'active'));
```

**B · Tenant staff, scoped** — `private.has_capability('<cap>', 'school', tenant_id)` in the
policy, never a bare role name; staff never read student-private rows through RLS.

**C · Service-only** — RLS on, no policy, `revoke all … from public, anon, authenticated`,
grants to `service_role` only (outbox, ledger, counters).

### 5.3 The commit function

`private.productivity_commit(tenant, owner, command, entities, audit, events)`,
wrapped by `public.productivity_commit` and granted to `service_role` alone.
`security definer`, `set search_path = ''`, every object schema-qualified. It
locks the owner's sequence row, inserts the ledger row, checks each entity's
`expectedSeq` (`40001` if stale), upserts it at the next sequence number, writes
the audit and outbox rows. An **audit-only** commit (a refused write, a read of a
shared list) takes no sequence position and needs no existing owner, so probing a
nonexistent owner is audited and cannot fail on a foreign key.

### 5.4 Migration rules

1. **Idempotent.** `create … if not exists`, `drop policy if exists` then create,
   `create or replace function`. `check.sh` with `SEMESTER_CHECK_REAPPLY=1`
   applies every migration twice and refuses a differing schema or rows.
2. **Expand, then contract.** Add nullable/new → backfill → switch readers →
   enforce → drop in a later migration, never the same deploy.
3. **Every foreign key has a covering index** (checked schema-wide by
   `indexes.check.sql`); primary keys lead with `tenant_id`.
4. **Every function** in `public` that a client could reach is either named in
   `grants.check.sql` or revoked from `anon`/`authenticated`; every `security
   definer` sets an empty `search_path`.
5. **Every table with RLS** has a `.check.sql` that attempts each refusal *as the
   role that should be refused*, beside the same statement succeeding.
6. **A new user-owned table is registered** with the account-link guard
   (`lti_account_untouched`), the export and the erasure paths **before any
   client writes to it** — see §11.
7. **Pair every migration with a drift test** where TypeScript and SQL name the
   same things (`schema.test.ts` holds the commit function's JSON keys, the
   limits and the value sets equal to the service's).

### 5.5 Verified

`supabase/productivity-commands.check.sql` — 66 checks, run on PostgreSQL 16
(the project runs 17; `SEMESTER_CHECK_PG_ANY=1` says so and the pass is not a
statement about production): who can call the commit; a first commit writes
record, ledger, audit and outbox together; a duplicate is `23505`; a stale writer
is `40001`; the sequence is gapless and a failed commit spends none; a failed
last step undoes the first; the table constraints; RLS for owner, other person,
other tenant, ended membership, tombstones; no client write; the sweep; a stale
sequence prediction is refused; the read functions are scoped, hide tombstones, carry
them in the feed, and are the service role's alone. The
**whole** suite (every other check, and the apply-twice idempotency pass across
352 tables) also passes. Nine SQL mutants were applied (a tenth, "a failed commit spends a
sequence number", cannot be written: a rolled-back transaction undoes it by
construction); eight were caught the first time and the ninth exposed a missing
fixture (an event tombstone) that now exists and catches it. Five more were applied to
the read-side migration's checks: four were caught, and the fifth (the outbox stats
counting every producer) exposed a check that compared the function to a query that
already filtered, with no other producer's row to prove it; it now has one.

---

## 6 · Files: upload, download, scanning, retention *(specified)*

No file service exists. This is the contract it must meet; the community media
rules (`COMMUNITY-MEDIA-SAFETY.md`) are the nearest existing practice and should
be reconciled with it, not duplicated.

**Upload**

1. `POST /v1/files` — policy `file.upload` with the declared classification,
   purpose, size and media type, checked against a **per-tenant allowlist** and
   quota. Returns a file id and a **single-use signed upload URL** valid 5
   minutes, pinned to the declared `Content-Type` and a `content-length-range`,
   for a path the client does not choose: `quarantine/<tenant>/<uuid>`.
   File names are metadata; they are never part of a path.
2. The quarantine bucket is private, has no public listing, and **nothing is ever
   served from it**.
3. Completion enqueues a **scan job** (an `integration`-class actor): sniff the
   real type from magic bytes and refuse a mismatch; antivirus scan; for PDFs and
   Office files refuse or strip active content (JavaScript, launch actions,
   macros); refuse archives that expand beyond a ratio or depth; re-encode images
   and strip metadata.
4. State: `pending → clean | infected | failed`. **Only `clean` is promoted** to
   `files/<tenant>/<owner>/<uuid>` and made downloadable. A scan service outage
   leaves files `pending`; it never defaults to `clean`. Files are **rescanned**
   when signatures update.

**Download**

1. `GET /v1/files/{id}/download` — policy `file.download`, with classification and
   purpose; an `education_record` download is audited and may carry a
   `watermark` obligation.
2. The response is a **60-second signed URL** with
   `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`; any inline
   preview is from a **separate, cookieless origin** with a sandbox CSP.
3. A foreign file is `404`. No directory listing exists.

**Retention and deletion**

Each file carries a retention class from the event catalog (`operational`,
`student_record`, `audit`, `commercial`). Deletion is **crypto-shredding**: a
per-object key, destroyed; the metadata row stays as a tombstone. A legal hold
(`legal_holds`) blocks deletion of the objects it covers, checked by the same
hold-gated sweep machinery.

**Audit** every upload, scan verdict, promotion, download of a non-public file,
deletion, and hold; with the correlation id; with names and sizes, never contents.

**Not chosen yet:** the scanning engine and the object store. They are decisions
for the owner with a security review; the requirements above are what the choice
is judged against.

---

## 7 · Abuse, rate limits, validation, secure errors

### 7.1 Budgets

Starting values, **not yet measured against real traffic**; they come from
`tenant_plan` entitlements once that is wired.

| Class | Key | Budget | Status |
|---|---|---|---|
| Reads | tenant + person | 300 / min | **Built** |
| Commands | tenant + person | 120 tokens / min; a batch costs `⌈n/10⌉` | **Built** |
| Sign-in / token | IP, and account | 10 / min / IP; backoff after 5 failures / 15 min per account (a delay, not a lock — a lock is a denial of service on a student) | Specified |
| Tenant ceiling | tenant | 20× the person budget, by plan | Specified |
| Uploads | tenant + person | 20 / hour; per-tenant daily bytes | Specified |
| AI | tenant + person | By entitlement, metered (ADR 0004) | Existing |
| Inbound webhooks | provider + IP | 600 / min | Specified |
| Concurrency | owner | One writer at a time (the owner lock) | **Built** |

A limiter that **fails** denies (`PostgresRateLimiter` already does); the 429
carries `Retry-After` and `retryable: true`.

### 7.2 Abuse signals

Counted, not just limited: policy denials per actor (`semester_policy_decisions_total`),
`idempotency_key_reused`, `validation_failed` rate, 404 rate per caller (enumeration),
`command_expired` bursts. Twenty denials from one actor in five minutes opens a
`security.alert_opened` event and throttles that actor harder; a person is never
locked out of their own data by an attacker's failures.

**A known amplification, stated.** A refused read of somebody else's data is
audited on *that person's* trail, so they can see who tried. It also means any
member of a tenant can cause audit rows to be written against any other owner id
— bounded today only by the read budget (300 per minute), which is up to 18,000
rows an hour from one account. Before the API is mounted, give reads of another
person's data their own, much smaller budget (a share is a rare, deliberate
act), and make the denial throttle above real. Both are specified, not built.

### 7.3 Validation

- **Allow-list, strictly**: unknown keys are refused; types, lengths, ranges,
  enums and formats are checked before anything else runs.
- **Mass assignment is impossible** — owner, tenant, version, source and
  sequence are not fields of any command, and a test sends each.
- **Bounds everywhere**: 256 KB body, 50 commands, 200 per page, 366-day windows,
  20 reported issues, 100-char correlation ids.
- Text refuses control characters; instants refuse a missing offset; zones are
  checked against the IANA database.

### 7.4 Secure errors

No stack, query, table name or dependency message ever leaves the process; the
request id lets an operator find it in the logs — the service and the HTTP layer each take an `onError` hook that receives the real error with the request and correlation ids, so the reason is recorded where an operator looks and never sent to the caller. A store failure on a read is a
retryable `503`; on a write it is `outcome_known: false` and the instruction to
resend. A foreign record is `404`. `http.test.ts` plants `password=hunter2` in
a dependency error and asserts it appears nowhere in the response.

### 7.5 OWASP API Security Top 10 (2023) — where each is handled

| Risk | Handled by |
|---|---|
| API1 Broken object-level authorization | Scoped repository (no unscoped query); owner = verified actor; `404` for foreign ids; PDP share rules; RLS. Tests: *tenants and owners do not see each other*. |
| API2 Broken authentication | Server-validated sessions; no claims trusted; sign-in budgets (specified). |
| API3 Broken object-property-level authorization | `limit_fields` / `mask_fields` obligations on shared views; internal fields (`clocks`, `tenantId`) never serialised; strict requests (no mass assignment). |
| API4 Unrestricted resource consumption | Body, batch, page and window bounds; weighted rate limits; owner serialization. |
| API5 Broken function-level authorization | Every route declares and asks its actions; capability checks in rules; jobs are bound actors. |
| API6 Unrestricted access to sensitive business flows | Idempotent commands; abuse signals; online-only + confirmation for consequential flows. |
| API7 Server-side request forgery | Webhook and import destinations (§1.9); no endpoint fetches a client-supplied URL. |
| API8 Security misconfiguration | `nosniff`, `no-store`, no CORS by default; ops endpoints internal and token-gated; `/metrics` is off without a token. |
| API9 Improper inventory management | OpenAPI held equal to the router; deprecation register; versioned events. |
| API10 Unsafe consumption of APIs | Inbound webhooks verified and deduped; connector data is `imported`, source-authoritative, validated like any input. |

---

## 8 · Contract testing and documentation

| Layer | What | Status |
|---|---|---|
| **Provider contract** | `openapi.test.ts` holds `docs/api/productivity.v1.openapi.json` equal to the code: routes and methods, command types, limits, field sets, `additionalProperties:false`, and **every emitted error code with its status** (and no documented code that cannot occur). | **Built** |
| **Repository contract** | `repository-contract.ts` — the same tests any storage adapter runs. | **Built**: memory, and Postgres through `supabase/adapter.sh` |
| **TS ↔ SQL** | `schema.test.ts` — JSON keys, limits and value sets. | **Built** |
| **Event contract** | `validateEvent` + `events.test.ts` (catalog equals the outbox constraint). | Existing |
| **Policy contract** | `policy.test.ts` — refusal suite. | Extended here |
| **Request fuzzing** | Schemathesis (or equivalent) against staging from the OpenAPI: status codes, schema conformance, no 5xx on any input. | Specified |
| **Breaking-change gate** | `oasdiff` (or equivalent) in CI against the last released document; a breaking change without a new major fails the build. | Specified |
| **Consumer-driven** | Each client records the requests and responses it depends on (Pact-style); the provider verifies them in CI before release. | Specified |
| **Webhook vectors** | Published test vectors for the signature scheme, and a replay and tolerance test. | Specified |

**Documentation** is generated from the OpenAPI document (a rendered reference),
with hand-written guides for the three things a document cannot say: the offline
queue algorithm (§4.5, §10.4), the conflict rules (§10.3), and the error recovery
table. Every release has a changelog entry; every deprecation is dated.

How these were checked: **thirty-one mutants** were applied to the TypeScript and
**nine** to the SQL, each reverting one guard, and the suites were run. Of the
first thirty-one, thirty were caught the first time; the survivor (`not_owner` in
the policy rule) was unreachable through the service by construction, so it is
now asked of the decision point directly. Of the SQL, one gap was found
(an unexercised event tombstone) and closed. Five further mutants of the
route-to-policy and OpenAPI tests were all caught. For the Postgres adapter, eleven
more — six in the adapter (no retry, a stale expected `seq`, one prediction for every
entity, no per-scope queue, tombstones outside a transaction, a stale counter) and five
in the read-side SQL (the prediction check, the tombstone flag, a missing owner or tenant
filter, a missing ledger owner filter) — were run against a real database and all caught.

---

## 9 · Observability and operations

Per `MONITORING.md`, the owner is one person with no rota, so the design is **one
alert allowed to wake somebody, and a weekly ten minutes** for everything else.

### 9.1 Endpoints *(built, `ops.ts`)*

| Path | Question | Public? |
|---|---|---|
| `/healthz` | Can the process answer? **Checks nothing else** — so an orchestrator does not restart a healthy process because a dependency is down. | Internal |
| `/readyz` | Are the dependencies usable? Each check has a 2 s timeout; the response names which failed and **never why**. | Internal |
| `/metrics` | Prometheus text. **Does not exist unless a token is configured**; then bearer, constant-time compared. | Internal + token |

`instrument(metrics, outboxStats)` wires the service hooks, the HTTP telemetry and
the outbox gauges in one call; a test scrapes the result and asserts that no
person id and no typed text appears anywhere in it.

### 9.2 Signals

| Metric | Labels (low cardinality, nothing personal) |
|---|---|
| `semester_http_requests_total` | route **template**, status |
| `semester_http_request_duration_seconds` | route template |
| `semester_commands_total` | command type, status |
| `semester_policy_decisions_total` | action, allow/deny |
| `semester_outbox_pending`, `…_oldest_pending_age_seconds`, `…_dead_lettered` | — |

Never a tenant id, person id or raw path as a label: it is a cardinality bomb and
a privacy leak. Logs are structured JSON from an **allow-list of fields** (request
id, correlation id, route, status, duration, actor *type*, tenant id) — never a
body, a query string or a token. **Audit is not logging**: audit is the
evidence, immutable, retained by class; logs are operational and short-lived.

### 9.3 Targets *(starting points, not yet measured)*

| SLI | Target |
|---|---|
| Commands: non-5xx ratio | 99.9 % / 30 d |
| Commands: p95 / p99 latency | < 400 ms / < 1 s |
| Reads: p95 | < 300 ms |
| Outbox: oldest pending | < 60 s p99 |
| Dead letters | 0 |
| Policy decision p99 | < 5 ms (it is a pure function) |

### 9.4 What may wake the owner

One alert: **`/readyz` failing for five minutes** for the command service.
Everything else — error-budget burn, outbox lag over five minutes, a non-empty
dead-letter queue, a rise in denials — goes to the weekly review. **One
exception**: a dead letter on an `education_record` event pages, because the
consequence of a silent one is a grade nobody was told about.

### 9.5 Operator surface *(specified)*

`GET /ops/outbox` (stats and the dead-letter list, ids and types only),
`POST /ops/outbox/{id}/requeue` (audited; two approvers for `education_record`),
per-job and per-tenant kill switches (feature flags read each run), and a
**tenant-scoped trace**: given a correlation id, one query returns the request's
audit rows, events and deliveries. Tracing proper — W3C `traceparent` propagated
and the correlation id attached to every span — is specified, not built.

---

## 10 · The example: tenant-scoped tasks and calendar

### 10.1 Files

| File | Is |
|---|---|
| `app/server/productivity/contract.ts` | Entity and command types, strict validators, hybrid logical clock, cursors, limits |
| `…/repository.ts` | The storage contract; every method takes a `Scope` |
| `…/memory.ts` | The reference repository: per-scope serialization, staged commit, gapless `seq` |
| `…/service.ts` | Commands, queries, policy, idempotency, merge, audit, outbox |
| `…/http.ts` | `Request → Response`: routing, envelope, limits, ETags |
| `…/ops.ts` | `/healthz`, `/readyz`, `/metrics`, `instrument` |
| `…/postgres.ts` | The Postgres repository: optimistic transactions, predicted `seq`, retry on `40001`/`23505` |
| `…/psql-rpc.ts` | Test support: an `RpcClient` that calls the real SQL functions through `psql`, one connection per call |
| `…/repository-contract.ts` | Tests every adapter must pass |
| `…/*.test.ts` | 206 tests in `npm test` (contract, service, http, repository, schema, openapi, adapter protocol) |
| `…/postgres.integration.test.ts` | 20 tests against a real migrated database; skipped unless run through `supabase/adapter.sh` |
| `packages/institution/src/policy.ts` (+ test) | Four actions, two rule builders, a refusal suite |
| `packages/institution/src/events.ts` | Eight event types |
| `supabase/migrations/20261004123000_productivity_commands.sql` | Tables, RLS, commit function, sweep |
| `supabase/migrations/20261004180000_productivity_reads.sql` | The read functions, and the commit with its prediction held |
| `supabase/productivity-commands.check.sql` | 66 SQL checks |
| `supabase/adapter.sh`, `supabase/adapter/run.sh` | Run the adapter against the database `check.sh` builds |
| `docs/api/productivity.v1.openapi.json` | The contract |

### 10.2 One command, end to end

```jsonc
POST /v1/productivity/commands
X-Correlation-Id: trace-0123456789
{ "commands": [{
    "type": "task.update", "id": "<task uuid>",
    "commandId": "<uuid minted offline>", "deviceId": "phone-1",
    "clock": "1790000000000.0003.phone-1",       // wall ms . counter . device
    "createdAt": "2026-10-05T14:58:00Z",
    "changes": { "title": "Read chapter 5", "priority": "high" } }] }
```

1. authenticate → rate limit (1 token) → body ≤ 256 KB, `application/json`, ≤ 50 commands.
2. Validate: strict keys; `clock` ends in this `deviceId`; `createdAt` ≤ 30 days old.
3. Clamp the clock to ≤ server time + 5 min (`clockClamped` if it was).
4. **Transaction** (owner serialized): ledger lookup → duplicate / key-reuse, else
   load entity → **ask the PDP** (`task.write`, `command: update`,
   `touchesAuthoritative`) → honour obligations → merge per field → one commit
   (ledger + entity at next `seq` + audit + event).
5. Result per command; `X-Correlation-Id` is on the audit row and the event.

```json
{ "results": [{ "commandId": "…", "status": "applied",
    "entity": { "type": "task", "id": "…", "version": 3 }, "seq": 17,
    "appliedFields": ["priority"], "supersededFields": ["title"], "clockClamped": false }] }
```

Here `title` lost to a later edit from another device and is **reported**, not
dropped.

### 10.3 Conflict rules

| Situation | Outcome | Why |
|---|---|---|
| Two devices edit **different** fields | Both land | Fields have independent clocks. |
| Same field, replays arrive in either order | The **later intent** wins, the same either way; the loser is in `supersededFields` | Tested in both orders. |
| An edit that changes nothing but is stamped later | Clock kept, `superseded: no_change` | So a later, *older* edit still loses. |
| A device clock years ahead | Clamped to now + 5 min; an honest edit just past that wins | A wrong clock outranks honest ones by minutes, not years. |
| Delete vs a later edit | **Delete wins** (`gone`) | Bringing back what somebody removed is the surprise. |
| Complete on the device at 14:00, replayed at 17:00 | `completedAt` = 14:00 (the intent's time, capped at now) | The record says when it was done. |
| A person edits an imported event's time | `source_authoritative` | The institution's calendar is the authority on when the class is. Notes stay theirs. |
| A person deletes an imported event | `source_authoritative` | Hiding one is a separate feature, not a delete. |
| Same `commandId`, different body | `idempotency_key_reused` | A bug or an attack, never a retry. |

### 10.4 The offline queue, client side

1. Mint `commandId`, entity ids and the clock **on the device**, at the time of
   the intent. The clock is a hybrid logical clock: `max(wall, last seen) `, with a
   counter for ties, ending in the device id.
2. Persist the command in the local (encrypted) queue as `queued`. **`queued` is
   never shown as synced.**
3. Send up to 50 in order. Apply §4.5 to each result.
4. Pull `/changes?after=<cursor>`; a `seq` jump means a change was missed — pull
   again from the last contiguous `seq`. Tombstones delete locally.
5. On sign-out, membership removal or remote revoke, wipe the queue and the local
   copy with the key (`offline-sync-contract.md`).

### 10.5 What the tests prove, and how they were checked

*Every refusal is built by taking an allowed request and changing exactly one
thing, so the control is inside the test.* Categories: ordinary create/change
(events validate against the catalog); idempotency (duplicate, key reuse,
concurrent, store failure before commit, **lost acknowledgement after commit**,
stop at first failure, rollback on event failure, gapless `seq`, expiry);
merge (different fields, same field in both orders, reported losers, kept clocks,
clock skew, completion time, reopen ordering, event span); deletion; what the body
may not decide; tenant/owner isolation (same ids in two scopes, foreign record is
`404`, no capability, no membership, unverified tenant, refusal audited with no
content); shared reads (seven refusals, field-limited view, audited **before**
return, refused attempts audited on the owner's trail, a share never changes
anything, a service cannot read); source authority and imports (unbound job,
no capability, no purpose, wrong actor, hijack, annotate-but-not-move); agenda
and feed; outbox delivery, duplicate consumers, retry and dead-letter; HTTP
envelope, ids, 401/404/405/413/415/429/503/500, paging, forged cursors, ETags,
purpose header; every route asks its policy action; ops endpoints; the OpenAPI
and SQL drift guards.

### 10.6 What is **not** done — what stands between this and a first request

1. **~~A Postgres `ProductivityRepository`~~ — written (§10.7).** What is left of it
   is a first run through a real PostgREST, which can confirm what no `psql`-backed
   test can: that a raised SQLSTATE arrives in `error.code`, and that nothing in the
   adapter depends on PostgREST's type rendering or row limits (it is written not
   to). Construct it with `createClient(url, serviceKey)` from a server-only
   environment, and set a timeout on that client — the adapter has none of its own.
2. **An authenticator** that turns a Supabase session into a `Principal`
   (`membership.ts` has the resolution; `consentGrantsFor` needs the share-grant
   reader).
3. **A route** (`api/productivity/[...path].ts`, mirroring `api/institution`) and
   the `Retry-After`/CORS decisions for the browser client.
4. ~~Registration of the new tables~~ — done: `lti_account_untouched` lists them
   (`20261004181000`); export and erasure read the foreign keys to `auth.users`,
   so they already carried the tables, and `productivity-commands.check.sql`
   proves both.
5. **Scheduling** `private.productivity_sweep_commands()` in `scheduler.sql`.
6. **A client** (the offline queue of §10.4) and a decision about the old tables.
7. **A production-major run** of `check.sh` (these ran on Postgres 16).
8. **Wiring `Metrics` to a real exporter and an alert on `/readyz`.**

---

### 10.7 The Postgres adapter, and how it was run

`postgres.ts` against the functions in the two productivity migrations. It is held
by three layers:

- **Always, in `npm test`:** a scripted client pins the protocol — every call carries
  the scope's tenant and owner; the predicted `seq`s; the `seq` a record was *read at*
  as what the commit expects; a conflict re-runs the work from the reads, waiting
  longer each time; `40001` and `23505` are retried and nothing else is; a database
  error's text is never repeated; one scope runs one transaction at a time.
- **On demand, against a real database:** `supabase/adapter.sh` builds the same
  throwaway Postgres as `check.sh` (it uses that script's `SEMESTER_CHECK_THEN`
  hook) and runs `postgres.integration.test.ts` through a `psql`-backed client. It
  runs the whole repository contract; the **same script of fourteen commands through
  the same service against memory and against Postgres**, requiring identical results,
  records, feeds, lists and cursors; the audit, outbox and ledger rows the database
  ends up holding; and **processes that share nothing** racing each other — a
  duplicate command, a burst of twelve from three processes (gapless, and the `seq`
  each was told is the `seq` stored), an interleaved commit that forces the retry, a
  delete that wins a race, and a commit whose acknowledgement is lost.
- **Drift:** `schema.test.ts` holds the read functions' keys equal to the entity, the
  adapter's function and parameter names equal to the SQL's, and the commit it reads
  to be the latest definition.

**What this does not prove.** `psql` is a faithful stand-in for the SQL and for the
SQLSTATE; it is not PostgREST. The adapter uses only `rpc`, passes only JSON, reads only
JSON and reads errors only by SQLSTATE, so the differences should not be in play — but
"should" is the word, and the first run against a project is the check. These ran on
PostgreSQL 16; the project runs 17.

**Costs, stated.** A command is three round trips in the common case (the counter and
the ledger row in one call, the entity, the commit), more under contention. A read of
somebody's shared list is two: the audit commit, then the list. Contention on one owner
is serialized by the counter, so a burst from many processes for *one person* retries;
that is an owner's own offline queue, and the in-process queue absorbs the usual case.
There is a limit, and it was found by a test, not by thought: twelve writers for *one*
person from three processes, retrying without backoff, exhaust the default six attempts
and some come back `failed`. That is the safe outcome (the client resends and the ledger
answers), and it is not what happens with the real jittered backoff, under which the same
burst passed ten runs of ten. Twelve concurrent writers for one student is far past a real
queue; it is stated so nobody sizes a batch job on the assumption that contention is free.
None of this has been measured against real latency.

---

## 11 · Decisions and risks for the owner

| # | Decision / risk | Recommendation |
|---|---|---|
| 1 | **Two models of a task now exist** (`public.tasks` JSON sync; `productivity_task`). Until a client moves, no data is in the new one. | Move one client journey at a time (the repository's own migration rule), backfill with a one-off import that writes through the **command API** (so audit and events exist), and retire the old table only when its usage is zero. |
| 2 | **Account-link and erasure guards do not know the new tables.** `lti_account_untouched` lists user-owned tables by name; an account holding only these rows could be classified empty. | Done in `20261004181000`: both tables are on that list. Export and erasure needed no change — they walk the foreign keys — and a check shows an account's rows exported and erased. |
| 3 | **Outbox retries without backoff** (§4.4). | Add `next_attempt_at` and `SKIP LOCKED` before any publisher touches a real bus. |
| 4 | **Marketplace has no order/dispute/payout model.** | Do not describe it as a marketplace beyond verified listings. |
| 5 | **Scanning engine and object store are unchosen.** | A security decision, with the §6 requirements as the criteria. |
| 6 | **Targets and budgets are guesses.** | Measure for a pilot term, then set them. |
| 7 | **Counsel.** Nothing here asserts FERPA/COPPA compliance; the controls (consent-scoped reads, audit, retention classes, deletion) are inputs to counsel's review. | Route §3 and §6 through `COUNSEL-BRIEF.md`. |
