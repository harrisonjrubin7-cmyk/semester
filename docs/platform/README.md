# Platform primitives

The reusable core every Semester domain is built on: **multi-tenancy, identity,
consent, policy, approval and audit; the gateway standards; the shared engines
(workflow, notifications, files, search, flags, entitlements, reporting,
integration); the event and outbox contract; tenant isolation across every
layer; observability; a reference implementation; a client SDK; and the tests
that hold the boundaries.**

Code: [`packages/platform`](../../packages/platform/package.json) (`@semester/platform`).
Status: **new and additive; adopted by one surface so far.** Since MIGRATION phase 1
the institution gateway builds its refusals, correlation ids and a request context
through it; no route uses commands, policy, idempotency or any engine yet. Nothing
else in the running app depends on it; [`MIGRATION.md`](MIGRATION.md) is the path from what runs today.
It is built from the audit's requirement that *the identity–policy–audit spine
comes first, because every later domain depends on it*, and it reuses, rather
than replaces, what main already had: the policy decision point, the event
envelope and outbox, and the workflow machines in
[`packages/institution`](../../packages/institution/src/index.ts)
([ADR 0007](../architecture/0007-policy-decision-point.md),
[0008](../architecture/0008-event-envelope-and-outbox.md),
[0009](../architecture/0009-workflow-state-machines.md),
[0010](../architecture/0010-correlation-ids-and-error-envelope.md)).

## What is new here, and what is not

| Already on main (reused, not copied) | Added by this package |
| --- | --- |
| `decide()` policy decision point, three actions | A declarative engine for every other action, deny-by-default; delegates the three unchanged |
| `SemesterEvent`, `makeEvent`, outbox, receipts | Events stamped from the request context; a tenant-bound outbox; tenant-partitioned queue consumption |
| `WorkflowDefinition`, `transition()` | Durable instances with optimistic concurrency, history and exception reasons; the approval machine |
| Error envelope in the institution gateway (ADR 0010) | The same envelope as a shared catalogue for every surface |
| SQL RLS and `private.has_capability()` | A TypeScript capability resolver to run beside it; a proposed schema contract with forced RLS |
| — | Request context, org tree, affiliations, relationships, consent records, hash-chained audit |
| — | Idempotency, signed cursors, API versioning, service tokens, the command pipeline |
| — | Notification, file, search, flag, entitlement, reporting and integration engines |
| — | Per-layer isolation adapters and a conformance suite; observability standards; SDK; reference slice |

Two overlaps are real and are called out rather than hidden: the app already
has a feature-flag chain (`app/src/lib/flags.ts`) and an entitlement chain
(`supabase/functions/_shared/entitlement.ts`). The platform's `flags` and
`entitlements` modules are the generic low-level pieces (targeting, deterministic
rollout, expiry; plan → key → limit, with the always-entitled list). They are not
yet wired into those chains; [`MIGRATION.md`](MIGRATION.md) phase 5 does that and
names the equivalence test that must pass first.

## Relationship to the constitution and the target-architecture pack

Two documents already on main frame this work, and this package is written to agree
with them rather than to add a third vocabulary.

- [`docs/PLATFORM-CONSTITUTION.md`](../PLATFORM-CONSTITUTION.md) names **eight
  primitives** (identity and tenancy; permission, consent and authority; canonical
  data and provenance; policy; action and workflow; the integration gateway; trust and
  evidence; experience and accessibility). This package is the executable core of
  the first six and the audit half of the seventh; the eighth is the screens' job.
  Where the constitution points at `packages/institution` (`identity.ts`,
  `policy.ts`) or `app/server/institution/gateway.ts`, those stay the homes of what
  is already there.
- [`docs/target-architecture/`](../target-architecture/README.md) (D-1144, **a
  proposal**) wants a shared kernel — policy, outbox, audit, flags, files, notify —
  inside a modular `core`, with *"modules get a `Tx` handle with `tenant_id` already
  set"*, one error envelope, idempotency with `422 idempotency_key_reused`, a URL
  major with additive change, cursor pagination with `limit ≤ 200`, and tenant and
  actor **derived, not submitted**. This package is a first concrete cut of that
  kernel and follows each of those rules. **Where it lives is the pack's call**:
  the pack's monorepo plan puts the kernel at `packages/kernel` and the in-process
  platform at `services/core/src/platform`. Moving this package there is a
  `git mv` plus an alias change; its architecture test travels with it and is what
  keeps the layering intact after the move. It is named `@semester/platform` here
  because that is the name the pack's ownership table already uses for this layer.

Two places this package is *more specific* than the pack, to be reconciled in review
rather than hidden: the pack's `ErrorEnvelope` sketch is camelCase and adds
`reasonCode`, `requestId` and `fields`, while the **live** wire format (ADR 0010,
`gateway.test.ts`) is snake_case — this package keeps the live one, and adding
`request_id`, `retry_after_seconds` and per-field `fields` is an additive change it
leaves to that review; and the pack's flag types (`release · ops/kill · entitlement ·
experiment`) differ from `engines/flags.ts`'s (`release · ops · experiment ·
tenant_gated`) — `entitlement` is `engines/entitlements.ts`'s job here, and
`tenant_gated` is the existing "sensitive features default off, per tenant" invariant.

## Package structure

```
packages/platform/src/
  kernel/          clock, ids, rng (injected, never ambient); canonical JSON, SHA-256, HMAC; backoff
  seam/            the ONE door to packages/institution
  observability/   redaction; structured logs; metric definitions; service descriptors (owner, tier, SLO, runbook)
  tenancy/         organization tree; RequestContext — the only way a tenant enters
  identity/        affiliations, relationships, consent, capabilities, approvals, audit chain
  policy/          the policy engine (declared actions, deny by default, delegates institution actions)
  events/          events from a context; tenant-bound outbox; tenant-verifying consumer
  gateway/         error catalogue, headers, idempotency, cursors, versions, service auth, the command pipeline
  engines/         workflow, notifications, files, search, flags, entitlements, reporting, integration
  isolation/       tenant-scoped repository, cache, queue, analytics, support reads, AI retrieval; the controls catalogue
  sdk/             the client every surface uses (idempotency, retry, correlation, pagination)
  testing/         in-memory harness; the isolation conformance suite (no test runner dependency)
  reference/       the tasks vertical slice — read it to see how a domain uses all of the above
  architecture.test.ts   layering, one door, no ambient authority, NodeNext, no reaching around
  schema.test.ts         the SQL contract mirrors the TypeScript
  docs.test.ts           these pages are held to the code
```

Imports point down this stack and never up (`architecture.test.ts` enforces it,
and fails on a cycle):

```
 testing / reference        ← compose everything, ship nothing
 sdk                        ← kernel + error/header modules only (browser-light)
 isolation                  ← per-layer adapters
 engines                    ← workflow, notifications, files, search, flags, entitlements, reporting, integration
 gateway                    ← idempotency, cursors, versions, service auth, command pipeline
 events                     ← context-stamped events, tenant-bound outbox/consumer
 policy                     ← the engine
 identity                   ← affiliation, relationship, consent, capability, approval, audit
 tenancy                    ← organization tree, RequestContext
 gateway/errors + headers   ← the error catalogue and header rules (shared by all)
 observability              ← redaction, logs, metrics, service descriptors
 kernel / seam              ← clock, canonical, backoff / the door to packages/institution
```

## Where to read next

| If you want… | Read |
| --- | --- |
| The contract of each primitive | [`PRIMITIVES.md`](PRIMITIVES.md) |
| The API gateway / BFF standards, error catalogue, command envelope | [`GATEWAY-STANDARDS.md`](GATEWAY-STANDARDS.md) |
| Tenant isolation by layer, and how to prove an adapter | [`ISOLATION.md`](ISOLATION.md) |
| The event schema, outbox and consumer rules | [`EVENTS-AND-OUTBOX.md`](EVENTS-AND-OUTBOX.md) |
| Logs, metrics, SLO tiers and operational metadata | [`OBSERVABILITY.md`](OBSERVABILITY.md) |
| Runbooks | [`OPERATIONS.md`](OPERATIONS.md) |
| How to get from today's code to this | [`MIGRATION.md`](MIGRATION.md) |
| The ten mission items against code and tests, plus assumptions and risks | [`TRACEABILITY.md`](TRACEABILITY.md) |
| Why each non-obvious choice was made | [`adr/`](adr/) |
| The proposed SQL contract (**not applied**) | [`schema/platform_primitives.sql`](schema/platform_primitives.sql) |

## How a domain uses it (the whole idea, in thirty lines)

```ts
// 1. Declare what actions exist and what opens them (deny by default).
const RULES: ActionRule[] = [
  { action: 'task.create', capability: null, ownerMay: true, classificationCeiling: 'student_private' },
];

// 2. Write a command: parse → resource → handle. The handler gets a Transaction,
//    which has a TenantScope and an emit(); it cannot name a tenant.
const createTask: CommandDefinition<In, Out> = {
  name: 'task.create',
  parse, resource,
  handle: async (tx, ctx, input) => {
    await repo.insert(tx.scope, { id: input.taskId, tenantId: tx.scope.tenantId, /* … */ });
    return { data, events: [{ type: 'action.created', subject, payload: { taskId: input.taskId } }], userMessage: 'Task added.' };
  },
};

// 3. The gateway builds the context from the verified session, then runs the pipeline.
const ctx = buildRequestContext({ headers }, verifiedIdentity, { clock, ids });
const result = await runCommand(deps, ctx, createTask, body);
// → policy, idempotency, one transaction (record + audit row + outbox event), CommandResult.
```

The full, tested version is [`reference/tasks.ts`](../../packages/platform/src/reference/tasks.ts).

## Running it

From `app/` (the repository root has no scripts; see `CLAUDE.md`):

```bash
npx vitest run ../packages/platform/src   # the platform's own suite
npx tsc -b && npm run check:university    # types, and the gateway's NodeNext compile
```

The package is part of the shared `npm test` project and of `check:university`.
