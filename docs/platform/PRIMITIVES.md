# Primitive contracts

One section per primitive: what it is, the rules it will not bend, the file, and
the test that holds each rule. Rules are the point; the types are in the code.

## 1. Multi-tenancy and the organization model

`packages/platform/src/tenancy/` · tests `tenancy/tenancy.test.ts`

```
CustomerAccount          the contract and the invoice; may own several tenants
 └─ Tenant               the isolation boundary: every row, key and message carries its id
     └─ OrgNode tree     campus → college → department → program → term → section → cohort | group
```

- A **tenant** has a `status` (`provisioning · active · suspended · closing ·
  closed`), an `environment`, and a fixed **data zone**. Only `active` tenants
  receive requests.
- Whether four campuses are four tenants or one tenant with four campus nodes is
  an institution's decision, recorded once. It is the question that decides
  whether they may ever see each other.
- A **node** names its parent by `(tenantId, id)`; a parent in another tenant
  cannot be referenced (`OrgDirectory.add` refuses; the SQL contract's composite
  foreign key does the same).
- **`RequestContext` is the only way a tenant enters the platform**
  (`tenancy/context.ts`). It is built from a `TrustedIdentity` (what the server
  verified: membership, SSO issuer, LTI deployment, or a service binding) and an
  `UntrustedRequest` (what the client said). The tenant comes only from the first.
  A client hint that disagrees is `tenant_mismatch`, loudly — quiet overriding
  would hide both bugs and attacks. A malformed idempotency key is refused, never
  ignored. The context is frozen.
- Nothing below a `RequestContext` accepts a tenant id string from a caller's
  arguments; repositories, caches, queues and indexes take a `TenantScope`.

## 2. Identity, affiliations, roles, relationships, consent, capabilities

`identity/` · `identity/identity.test.ts`

| Primitive | What it is | Rules held |
| --- | --- | --- |
| **Affiliation** | A dated, sourced statement that a person stands in a relation to a tenant (applicant, student, faculty, staff, TA, alumnus, guardian contact, partner, lifelong learner) | Live only while `active`/`on_leave` and inside its dates; never returned across tenants; a self-declaration cannot assert faculty or staff; sources have a precedence order |
| **Relationship** | Person-to-person tie that can *carry* access (guardian, payer, advisor, instructor, mentor, emergency contact) | Each kind has a minimum verification (guardian needs a document); ended, future, self and cross-tenant ties are not live; a relationship **never grants access by existing** — it enables a consent prompt or an institution-given scope |
| **Consent** | A stored, scoped, revocable, time-limited permission with a **purpose**, named **resources**, **evidence** and a policy version | Covers exactly the purpose, scope and resource it names; empty resource list grants nothing; withdrawal wins immediately; support consent is ticket-bound; maps to the decision point's grant shape |
| **Capability** | `domain.verb`, registered; a **role** is a bundle; a **role grant** gives a role at a **scope** (tenant or node) and may expire | A grant at a node covers beneath it and not beside it; an unknown capability is never held; expired grants contribute nothing; mirrors `private.has_capability()` for side-by-side comparison |
| **Policy evaluation** | `PolicyEngine.evaluate(ctx, action, resource)` | See §3 |
| **Approval** | A consequential action that waits for other people (a state machine on the institution `WorkflowDefinition`) | Requester cannot decide their own; N approvals = N distinct people; a rejection needs a reason and is final; lapsed means lapsed; an approval authorises **exactly one change** (hashed) **once** |
| **Audit** | Append-only, hash-chained per tenant, redacted | Edit, delete, reorder, foreign row all detected; one chain per tenant; detail redacted on the way in; carries the correlation and request ids |

## 3. Policy evaluation

`policy/engine.ts` · `policy/policy.test.ts`

Two kinds of action reach the engine. The three that
`packages/institution`'s decision point already has rules for
(`support.case.read_context`, `ai.retrieve_source`, `grade.passback.submit`)
are sent to `decide()` unchanged; the engine refuses to redeclare them. Every
other action must be **declared** as an `ActionRule`:

```ts
interface ActionRule {
  action: string;
  capability: string | null;          // null = no capability opens it: owner or consent only
  classificationCeiling: ResourceClassification;
  ownerMay?: boolean;                 // the data's owner may do it to their own
  consent?: { purpose; scope };       // a live consent opens it to the grantee
  requiresFreshMfa?: boolean;
  requiresApproval?: boolean;         // reported; the command pipeline enforces it
  purposes?: string[];                // default: service_delivery only
  obligations?: PolicyObligation[];
}
```

Order of checks: resource's tenant ≠ context's tenant → deny; institution action →
delegate; undeclared → deny (`action_not_declared`); purpose; classification
ceiling; fresh MFA; then **owner → capability → consent**, cheapest and most
specific first. A denial that a consent could have cured says `consent_required`
so a surface can offer the owner a prompt. An allowance always carries an `audit`
obligation.

## 4. Workflow engine

`engines/workflow.ts` · `engines/engines.test.ts`

Durable instances of any `WorkflowDefinition` (grade passback, support access,
data deletion, organization recognition, assessment submission, approval).
Keyed `(tenantId, id)`; **optimistic concurrency** — `advance` carries the
version read, and a stale one is `conflict` even when nobody else is writing;
history is append-only; an *exceptional* move needs a reason; an illegal move is
`precondition_failed` with the machine's own sentence; another tenant gets
`not_found`, which is no oracle for ids. The engine runs **no side effects** —
the advancing command emits the event in the same unit of work.

## 5. Notification engine

`engines/notifications.ts`

Surfaces do not send; they ask `planNotification` and get deliveries **and the
reasons for any withheld**. Safety and account-security cannot be switched off
and ignore quiet hours; transactional respects quiet hours unless urgent;
academic follows preferences; **marketing needs a live consent and an opted-in
channel, never reaches a guardian about a student, and is never sent in quiet
hours**. A non-subject recipient needs a live consent for the category's purpose.
Quiet hours *defer* (`deliverAfter`), never drop; the silent in-app item is not
delayed. Channels are limited to the tenant's. One `dedupeKey` is delivered once.
Content is a template id and minimised data, never rendered free text here.

## 6. File service

`engines/files.ts`

Keys are `t/<tenant>/<classification>/<yyyy-mm>/<fileId>`; every operation parses
the key and checks the prefix **before the store is touched**, so another tenant's
key is refused by construction (traversal and malformed keys too). Allowed types
and per-classification size caps; signed-URL lifetimes shortest for education
records (120 s). Lifecycle `pending_upload → quarantined → available | rejected
→ deleted`; only `available` is served; a **legal hold** blocks deletion in every
state. Filenames are display-only and sanitised, never part of a key.

## 7. Search

`engines/search.ts`

A `SearchScope` can only be built from a `RequestContext` and the caller's ACL
tokens; `query()` **requires** one, and the tenant and ACL predicates are applied
inside the index after the caller has finished with the query — there is no
unscoped `query()` to reach for. Education records are excluded unless the scope
asks. Results are title, excerpt and reference; the record is fetched through its
own authorised route, so a stale index cannot disclose a revoked record.
Ranking stays [ADR 0006](../architecture/0006-search-is-one-ranker.md)'s; this is
the isolation contract any ranker sits behind.

## 8. Feature flags

`engines/flags.ts`

Pure, deterministic evaluation with a reason (`kill_switch · rule:<id> · default ·
expired_default`). Every flag has an **owner and an expiry**; an expired flag
falls back to its default and shows up in `staleFlags`. `tenant_gated` flags
default **off** and every rule that turns one on must name tenants (the "sensitive
institutional features default OFF, per tenant, never by build flag" invariant).
Percentage rollout is a stable hash of `(flag, person)` — same person, same
answer, on every node, monotone as the percentage grows. A flag controls what is
*offered*; policy decides what is *allowed*. **Overlaps `app/src/lib/flags.ts`** —
see MIGRATION phase 5.

## 9. Billing entitlement

`engines/entitlements.ts`

Plan → entitlement key → `{enabled, limit?}`; subscription state (`trialing ·
active · past_due(grace) · canceled(until)`); contract overrides with a reason;
idempotent metering. **`ALWAYS_ENTITLED` is checked before the plan**: records
access, data export, account deletion, accessibility settings, safety alerts,
support contact and billing management survive any subscription state,
including none. `requireEntitlement` throws a 402 with a way forward. Processor
state changes only from a signature-verified webhook (ARCHITECTURE.md invariant
8); this module takes the resulting state as input. **Overlaps
`supabase/functions/_shared/entitlement.ts`** — see MIGRATION phase 5.

## 10. Reporting

`engines/reporting.ts`

Aggregates that cannot be turned back into individuals: foreign-tenant rows are
dropped *before grouping* and counted (expect 0); distinct **people**, not rows;
**small-cell suppression** below `minCell` (≥ 10, the #762 floor); **complementary
suppression** so one hidden cell cannot be recovered by subtraction; at most two
dimensions. Row-level export is a different action with its own capability.

## 11. Integration primitives

`engines/integration.ts`

**Connection** (credential *reference*, mapping version, cursor, health;
a value that looks like a secret is refused at the door), **inbox** (new /
duplicate / conflict, keyed `(tenant, connection, externalId)` — the same id with
a different payload is a conflict to reconcile, never a silent overwrite),
**source metadata** (the audit's `SourceMetadata`) with **source precedence**
(institution > connected > imported > native > AI, except that a student-owned
field takes the student's newer native value; equal and disagreeing is
`conflicted`, never a coin toss), **health + backoff** (degrade after 3, disable
after 8, full-jitter exponential backoff with a ceiling). `nativeAvailable()`
takes no connection as an argument, on purpose: *the native capability is not a
function of any connection's health.*

## 12. Events and the outbox

See [`EVENTS-AND-OUTBOX.md`](EVENTS-AND-OUTBOX.md).

## 13. Reference implementation and SDK

`reference/tasks.ts` (the slice) and `sdk/client.ts` (the client). The SDK sends a
correlation id and version; sends an `Idempotency-Key` on every mutating call,
**generated once per logical call and reused on every retry**; **never sends a
tenant**; retries only when the envelope says `retryable` (honouring
`Retry-After`, capped backoff with jitter); surfaces a 502 unknown outcome
instead of retrying; and iterates cursor pages without exposing the cursor.
