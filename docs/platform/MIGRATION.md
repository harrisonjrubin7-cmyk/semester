# Migration path from the existing platform implementation

**Principle: strangler, not rewrite; additive, not replacing.** The running app
is device-first with Supabase RLS as the authorization boundary
([ADR 0001](../architecture/0001-local-first-with-supabase.md),
[0002](../architecture/0002-rls-is-the-authorization-boundary.md)). Nothing in
this plan removes RLS or the offline-first working copy. The platform package is
adopted **route by route and table by table**, each step with an exit gate and a
rollback, and **never with dual-write of authorization decisions** (two systems
deciding the same request is how a permissive one wins silently).

This follows the strategy already written in
[`multi-tenant-isolation.md`](../architecture/multi-tenant-isolation.md) → *Migration
strategy*, and makes its six steps concrete.

> **Relationship to the conversion plan.**
> [`docs/target-architecture/09-CONVERSION-PLAN.md`](../target-architecture/09-CONVERSION-PLAN.md)
> (D-1144, a proposal) converts the whole system by strangler waves: characterise,
> extract the pure domain, put a contract in front, shadow then switch, retire. This
> plan is the **spine's** part of it — the kernel, tenancy, policy, events, audit and
> contracts — and uses the same five moves per primitive. Its phases are about
> adopting *these primitives*; the pack's waves are about moving *capabilities* onto
> them. Where they touch (the institution gateway's modules, the journal becoming
> `platform/audit`, the edge functions' destinations) the pack's table of destinations
> wins and this plan supplies the gate each move must pass.

> **Status:** the package and its tests exist (phase 0 code is done). **No phase
> after 0 has started.** Dates and owners are not set: no seat is staffed
> ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)).

## What exists today, and what happens to it

| Today | Where | Disposition |
| --- | --- | --- |
| Policy decision point (3 actions) | `packages/institution/src/policy.ts` | **Reuse.** The platform engine delegates those actions unchanged. |
| Event envelope, catalogue, outbox, receipts | `packages/institution/src/events.ts`, `supabase/migrations/20260928320000_audit_correlation_and_outbox.sql` | **Reuse.** Platform adds context-stamping and tenant binding. |
| Workflow machines | `packages/institution/src/workflow.ts` | **Reuse.** Platform adds durable instances. |
| Error envelope + correlation id | `app/server/institution/gateway.ts` (ADR 0010) | **Converge.** Same shape; move to `gateway/errors.ts`, byte-equivalence test first. |
| Tenant resolution (SSO membership) | `app/server/institution/membership.ts`, `scim.ts` | **Wrap.** Produces the `TrustedIdentity` the context builder takes. |
| Rate limiting | `app/server/institution/rate-limit.ts` | **Keep**, key on `(tenant, person)` as today; surfaces `rate_limited` through the shared catalogue. |
| Gateway action journal + audit | `app/server/institution/journal.ts`, `postgres-journal.ts`, `private.gateway_audit` | **Coexist, then converge.** Journal stays the two-phase action record; its audit writes move to `platform.audit_event` once that exists. |
| Integration retry / dead-letter | `app/server/integration/worker.ts` | **Reuse patterns**; its inbox and backoff become `engines/integration.ts`. |
| Capabilities | `private.has_capability()`, `role_capabilities`, `role_grants` (`supabase/migrations/20260922012000_capabilities.sql`, `supabase/capabilities.check.sql`) | **Keep as the data-layer authority.** `resolveCapabilities` runs *beside* it (phase 2). |
| Campus scoping | `schools`, `profiles.school_id` ([ADR 0005](../architecture/0005-multi-campus-scoping.md)) | **Map** to `platform.tenant` / `org_node` (phase 3). |
| Feature flags | `app/src/lib/flags.ts`, `experience-flags.ts`, `aiflags.ts`, `docs/FEATURE-FLAG-REGISTRY.md` | **Overlap — converge** (phase 5). |
| Entitlement chain | `supabase/functions/_shared/entitlement.ts` | **Overlap — converge** (phase 5). |
| Cohort floor n ≥ 10 | `app/src/lib/cohortfloor.test.ts`, `supabase/feature_cohorts.check.sql` | **Reuse the rule**; `engines/reporting.ts` is its generic form. |
| Browser gateway client | `app/src/lib/university.ts` | **Adopt the SDK** (phase 1). |
| Client sync | `app/src/lib/cloud.ts` | **Untouched.** Offline-first stays. |
| SQL check harness | `supabase/check.sh` (+ 100+ `*.check.sql`) | **The acceptance gate** for every table in phase 3. |

## Phases

Each phase ends only when its **exit gate** passes. A phase may be shipped alone.

### Phase 0 — Prove the primitives (done in code)

- Land `packages/platform`; wire into `tsc -b`, `npm test`, `check:university`.
- Architecture tests hold the boundaries; the isolation suite is shown red against
  leaky adapters; mutation checks on the guards.
- **Still owed in phase 0:** generate the *active-schema and RLS inventory* from a
  clean PostgreSQL 17 apply (not declaration grep), classify every table
  (global-public, platform-control, tenant-owned, person-owned, projection,
  immutable audit/outbox, integration staging), and take the **FORCE RLS decision**
  ([`ISOLATION.md`](ISOLATION.md)). Nothing in phase 3 starts before this.
- *Exit gate:* inventory committed; FORCE decision written as `D-<PR>.md`.
- *Rollback:* none needed — nothing depends on the package.

### Phase 1 — Context, errors and the SDK at the edge

- `membership.ts` output becomes a `TrustedIdentity`; the gateway calls
  `buildRequestContext`. Client tenant hints, if any, are now refused when they
  disagree.
- Replace the gateway's error builder with `errorResponse`. **Equivalence first:**
  a test feeds every existing refusal through both and asserts identical JSON,
  status and `retryable`.
- Edge functions adopt the envelope and correlation id when next touched (ADR 0010
  already says so); the `claude` and `billing-*` functions are the first.
- `lib/university.ts` moves onto the SDK (`createClient`): one correlation id and
  idempotency key per call, retry only on `retryable`.
- *Exit gate:* `gateway.test.ts`, `university.test.ts` green unchanged; the
  equivalence test green; no new route reads a tenant from a body.
- *Rollback:* revert the adapter; the old builder is still in git.

**Status (client adoption slice landed after D-1228).** Done: the gateway's error builder and
correlation id now come from `@semester/platform`, held by
`app/server/institution/envelope.test.ts` (the old builder is kept there verbatim as the
golden; every status default and every specific code in the source is compared
byte for byte, with a control that the comparison can fail), and every gateway request
carries a `RequestContext` (`app/server/institution/context.ts`, set on
`AdapterContext.request`). Findings the equivalence work surfaced, all fixed on the
platform side rather than the gateway's: the catalogue had named the 502 code
`outcome_unknown` where the live wire says `outcome_uncertain`, lacked `refused`,
`method_not_supported`, `expired`, `too_large` and `unsupported_media_type`, and could
not carry the gateway's domain codes (`review_expired`, `record_changed`, kebab-case
`policy-disabled`…), so `PlatformError.specific` was added. **Behaviour that did change:**
a client that sends `X-Tenant-Id` disagreeing with its session is now refused
(`tenant_mismatch`), and an identity whose tenant or user id falls outside the platform's
id alphabet is refused rather than passed through; every id in the repository's fixtures
fits. The shared platform now also has an additive, tested active-context primitive
(`packages/platform/src/tenancy/active-context.ts`): a requested membership/workspace
is resolved only from a server-verified directory, its tenant/person/grants cannot be
client supplied, its expiry is capped by both membership and session, and changing
membership or workspace requires explicit confirmation. The gateway now has an additive
`contextForSelection` adapter that rechecks the activated person and institution against
the authenticated identity, carries the selected membership into `RequestContext`, and
caps its role grants at the active-context expiry. Production authentication now carries
the authoritative membership row id and the signed session expiry after remote token
validation; it still does not assemble the complete context directory or authorize a
workspace selection. No route or UI calls the adapter, so this remains an integration
seam—not evidence of live context switching.
The browser's `lib/university.ts` now uses the shared SDK. Its transport
preserves the existing secure-origin, no-redirect, no-cookie and timeout rules;
mutating calls receive one idempotency key per logical call; only safe reads or
keyed writes retry. The gateway context now validates and carries that key to
adapters. The local SQLite action journal implements the shared persistent
idempotency-store contract, but the production PostgreSQL journal does not and
the legacy institution commit route is not wrapped with the store. That route
therefore still opts out of network retry, preserving its
unknown-outcome-to-reconciliation rule. The two older refusal shapes are translated at this
migration boundary with a focused equivalence test. **Not done:** the edge
functions have not adopted the envelope, and `environment`,
tenant status and `verifiedBy` in the context are approximations the file says so about.

### Phase 2 — Capability resolution, side by side

- Export a recorded sample of `(person, grants, node)` and compare
  `resolveCapabilities` with `private.has_capability()` over it, in CI and as a
  scheduled job against staging. **Report only; no caller switches.**
- *Exit gate:* **zero** discrepancies over the sample *and* a property test that
  generates grants across the org tree. Every discrepancy is a bug in one of the
  two, found before it is a bug in production.
- *Rollback:* remove the job.

### Phase 3 — The schema spine, table by table

Order is by dependency, each as its own migration **with its own `.check.sql` that
walks a second tenant** (CLAUDE.md; ADR 0002):

1. `app` context helpers (`set_request_context`, `tenant_id`, `person_id`) — and a
   check that a missing context *raises*.
2. `platform.tenant`, `org_node` (backfill from `schools`; dual-read comparison —
   **no dual-write**).
3. `platform.idempotency_key`.
4. `platform.audit_event` **alongside** `private.gateway_audit`; an equivalence
   report; the gateway writes both for one release, then the old one is frozen.
5. `affiliation`, `relationship`, `consent` (map the existing family and support
   consent tables; see `docs/CONSENT-SHARING-DESIGN.md`).
6. `approval_request`, `file_object`, `connection`, `inbox_message`.
- A retention sweep for the outbox and receipts **precedes** the first production
  producer (`RETENTION.md`).
- *Exit gate per table:* `supabase/check.sh` green on clean PostgreSQL 17,
  including the fingerprint (a migration applied twice must equal once); RLS
  enabled **and forced**; grants reviewed; `OWNED_TABLES` updated if a client
  writes it (ARCHITECTURE.md invariant 3).
- *Rollback:* each migration is additive; the reverse is a documented `drop`, and
  nothing reads the new tables until phase 4.

### Phase 4 — Commands, domain by domain

Strangler: a route moves to `runCommand` only when its domain's rules are
declared and its tests pass **through the pipeline**.

1. **Productivity** (tasks, calendar). Main gained a tenant-scoped tasks/calendar
   command service (`app/server/productivity/`, conventions in `docs/API-PLATFORM.md`)
   while this package was in review, built on the same institution primitives and
   adding policy actions `task.read`/`task.write`/`calendar.event.*`. It is the first
   real domain and supersedes `reference/tasks.ts` as the adoption target: this step
   compares its idempotency, audit and outbox handling with `runCommand` and converges
   them (the reference slice's list action was renamed `task.list` to stay clear of the
   institution's `task.read`). Lowest blast radius.
2. **Support access and shares** — the consent and audit semantics are already
   written; this moves them onto the shared records.
3. **Institution gateway writes** (registration, money, advising…). These keep
   the **prepare → review → commit** two-phase pattern (ARCHITECTURE.md invariant
   5): prepare and commit become two commands; the journal remains the record of the
   reviewed action; the unknown-outcome → `outcome_uncertain` → reconcile path is
   unchanged. `runCommand` is not a way to skip the review.
4. **Grades and records** last, behind `requiresApproval` where the institution's
   policy says so.
- *Exit gate per route:* old and new produce the same observable result on the
  route's existing tests; the audit row and event exist for every success; a
  forced failure rolls back all three.
- *Rollback:* feature-flag the route to its old handler (kill switch, OPERATIONS §6).

### Phase 5 — Converge the overlaps

- **Flags.** `app/src/lib/flags.ts` keeps its ordered chain (kill switch →
  environment → tenant entitlement → … → activation contract: that is the University
  OS activation logic and is *not* replaced). The generic targeting step — rules,
  deterministic percentage, expiry — becomes `evaluateFlag`. *Gate:* for the full
  recorded matrix of `(flag, tenant, role, cohort)`, results are identical before and
  after; `flagProblems` passes for every registered flag; `FEATURE-FLAG-REGISTRY.md`
  stays held by its test.
- **Entitlements.** `ALWAYS_ENTITLED` is added to `_shared/entitlement.ts`'s chain
  *first* (it is the safety property: billing never gates records). The plan→key
  resolution then moves to `checkEntitlement`. *Gate:* `entitlement.test.ts` green
  unchanged plus a case per always-entitled key under every subscription state.
- **Notifications, files, search, reporting.** `support-reply-notify` and friends
  call `planNotification`; media/file paths use `planUpload`/`downloadPlan` and
  the `t/<tenant>/…` key; the single ranker of ADR 0006 sits behind `SearchScope`;
  cohort views call `runReport`.
- *Rollback:* each is a flag.

### Phase 6 — Prove isolation on the real services

For each layer, build the real adapter and run `isolationCases` against the real
service in CI. File the run as dated evidence only then; **no isolation claim is
made public for a layer until this has run** (`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`).
Add the cross-tenant, same-person-id cases to each domain's own suite.

- *Exit gate:* every layer in `ISOLATION_LAYERS` has a dated run of `isolationCases`
  against its real adapter, filed as evidence, and the leaky-adapter checks still go
  red against it.
- *Rollback:* a layer that fails the suite stays on its previous path; nothing is
  switched on for a tenant until its layer is proven.

### Phase 7 — Retire the legacy paths

Remove a duplicate helper only after **callers, queued jobs, exports, search, AI
and support workflows** are proven on the canonical decision. Delete the old
audit write last. Each removal is its own pull request with a `D-<PR>.md`.

## Sequencing risks

| Risk | Mitigation |
| --- | --- |
| Two authorizers disagree and the permissive one wins | No dual-write of decisions; phase 2 compares, never switches |
| `FORCE RLS` breaks a service path nobody remembers | Phase 0 inventory; try on a restored schema first; documented audited bypass list |
| Audit written in two places drifts | Equivalence report in phase 3 step 4; old one frozen, then deleted last |
| Flags/entitlements converge wrongly | Recorded-matrix equality gates; chain stays, only the generic step moves |
| The package is adopted by `supabase/functions` and breaks the Deno/ESM boundary | Architecture test forbids it (CLAUDE.md, TS1287); functions get the *contracts* via generated JSON, not imports |
| A "migration" that quietly becomes a rewrite | Every phase is shippable alone and has a rollback; no phase deletes before its replacement is proven |
| Team capacity | There is none staffed; the order above is the order of value *and* risk, so stopping after any phase leaves a coherent system |

## What this plan does not do

It does not choose a message broker, a search engine, an object store vendor or a
warehouse; those are separate decisions that become `D-<PR>.md` records when a phase
needs one. It does not decide which institutions are tenants versus campuses. It
does not make any legal, privacy or compliance conclusion — those need qualified
counsel and the institution's own sign-off.
