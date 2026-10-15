# 03 · Technology decisions

> Part of the [CTO architecture pack](README.md). Status: **proposed**.
>
> `docs/architecture/README.md` says "an empty ADR for a technology nobody has
> chosen yet is a decision pretending to have been made." So these are
> **proposals (P-nn)**, each with criteria, alternatives, risks and a
> *revisit trigger*. A proposal becomes an ADR (`docs/architecture/00NN-…`,
> one per pull request, numbered when merged, cited as `D-<PR>` per
> `docs/decisions/README.md`) only when a phase needs it and the architecture
> review ([08](08-ORGANIZATION-AND-MILESTONES.md) §5) accepts it.

## 1. Decision criteria (weighted; the same for every proposal)

| # | Criterion | Weight | What "good" means here |
| --- | --- | --- | --- |
| 1 | Student-data safety & tenant isolation | 5 | fails closed; testable with a second account |
| 2 | Operability by a small team | 5 | one on-call can run it; managed where the control is not the product |
| 3 | Reversibility | 4 | can be unwound inside one phase; no one-way doors without a drill |
| 4 | Reuse of what exists | 4 | 620 k lines and 171 migrations are an asset; a rewrite is a cost |
| 5 | Offline / low-connectivity fit | 3 | works on a bad phone on bad wifi |
| 6 | Procurement fit | 3 | passes a HECVAT/VPAT review; data residency; DPA-able subprocessors |
| 7 | Cost at 100 k → 1 M active students | 3 | no per-seat vendor cliff on the core path |
| 8 | Ecosystem & hiring | 2 | a competent engineer can be hired for it |

Scoring is in the proposals only where a real alternative scored close; a
table of numbers for a foregone conclusion is theatre.

## 2. Proposals

### P-01 · Workspace and build system: pnpm workspaces + Turborepo

- **Chosen:** pnpm workspaces, Turborepo task graph, remote cache.
- **Alternatives:** npm workspaces (zero new tool; weaker isolation, slower
  installs); Nx (richer graph and generators, heavier, opinionated); Bazel
  (hermetic, enormous cost for this team).
- **Why:** the repo is TypeScript end to end, has no workspace today, and needs
  affected-only CI and an import graph more than it needs generators.
- **Risks:** lockfile migration (`app/package-lock.json` → pnpm) can change
  resolved versions silently. **Mitigation:** the commit that migrates the
  lockfile changes nothing else, and `npm audit`/SBOM diff is attached.
- **Revisit when:** build graph > 60 packages or CI > 20 min p50 after caching.

### P-02 · Core runtime: TypeScript on Node 22 LTS, modular monolith, one container image

- **Chosen:** Node 22 LTS, Fastify (or Hono) HTTP, one `services/core` image,
  modules per [02](02-MONOREPO-STRUCTURE.md). Deployed to managed containers
  (Cloud Run / ECS Fargate class — **region and cloud chosen by P-12**).
- **Alternatives:**
  1. *Keep Vercel functions + Supabase edge only.* Cheapest, zero ops; but a
     30 s function cap (`vercel.json maxDuration`), per-invocation cold state,
     no long-lived connector workers, no connection-pool control, and a PDP in
     Deno/Node split-brain.
  2. *Next.js/BFF.* Couples server to one client framework; the product has
     seven clients.
  3. *Go or Kotlin services.* Better raw efficiency; loses the shared
     `contracts`/`kernel` packages that already exist in TS and the ability for
     the team to move between client and server.
  4. *Microservices per domain now.* Rejected: constitution §45 / ADR 0003, one
     engineer, and the audit itself asks for "operable".
- **Why:** reuse (`packages/institution` is already the kernel), one on-call
  surface, and seams that make extraction a deploy change.
- **Risks:** a modular monolith decays into a big ball of mud. **Mitigation:**
  the boundary checks are required CI ([02](02-MONOREPO-STRUCTURE.md) §3), and
  *extraction triggers* are written down (below), not argued case by case.
- **Extraction triggers (any one, sustained 2 weeks):** a module's p95 latency
  or error budget burn is caused by a *neighbour's* load; a module needs a
  different runtime, scaling shape or compliance boundary (e.g. payments in
  PCI scope); a team owning it cannot release independently more than twice a
  month because of core release cadence; a module needs a different data store.

### P-03 · System of record: PostgreSQL 17, pooled-with-RLS by default, silo by ring

- **Chosen:** keep Postgres 17 (the check harness already refuses a different
  major than production). Default tenancy = pooled schema, `tenant_id`
  everywhere, `ENABLE`+`FORCE` RLS, per-transaction `app.tenant_id`. **Ring-4
  tenants may be siloed** (own database, identical migrations) when their
  contract requires it.
- **Alternatives:** schema-per-tenant (migration fan-out and catalog bloat grow
  with tenant count); database-per-tenant for all (isolation maximal, cost and
  ops linear in tenants); NewSQL (CockroachDB/Spanner — over-built, loses
  extensions).
- **Why:** 171 migrations and 106 second-account suites are the most valuable
  correctness asset in the repository. Silo is a routing decision, not a
  schema fork.
- **Hosting:** Supabase-managed Postgres remains acceptable through ring 2
  (see P-12). The *abstraction* is "Postgres + RLS + PgBouncer"; Supabase Auth,
  Storage and Realtime are used only behind ports so leaving is possible.
- **Risks:** noisy-neighbour in the pooled cluster; RLS performance on
  `tenant_id` predicates; table owners bypass RLS without `FORCE`.
  **Mitigation:** composite indexes lead with `tenant_id`; per-tenant
  statement-timeout and connection caps; `FORCE ROW LEVEL SECURITY` migration
  in wave C0 ([09](09-CONVERSION-PLAN.md)); `pg_stat_statements` per-tenant
  attribution.
- **Revisit when:** one tenant > 25 % of pooled load, or a contract demands
  physical isolation.

### P-04 · Events: Postgres transactional outbox first, managed stream when triggered

- **Chosen:** keep ADR 0008 as is: `SemesterEvent` envelope, outbox written in
  the command's transaction, a relay using `SELECT … FOR UPDATE SKIP LOCKED`
  (later logical decoding), at-least-once delivery, consumer idempotency via
  the receipt ledger. Job queue: `graphile-worker` or `pg-boss` (Postgres-backed).
- **Alternatives:** Kafka/Redpanda (replay, partitioned throughput; heavy ops);
  SNS/SQS or Pub/Sub (managed, simple fan-out; weaker ordering/replay); NATS
  JetStream (light, strong; another system); Temporal (durable workflows).
- **Why:** transactional integrity matters more than throughput; one datastore
  keeps backup/restore and DR simple.
- **Trigger to move the bus (not the outbox):** sustained > 2 k events/s,
  consumer lag SLO breached by relay capacity, or a need for > 7 d replay.
- **Temporal:** adopt only for a *named* long-running, human-in-the-loop flow
  that outgrows `WorkflowDefinition` (candidate: institutional cutover/parallel
  run). Until then ADR 0009's state machines are sufficient.
- **Risk:** outbox table growth/bloat. **Mitigation:** partition by day, drop
  after retention class allows; relay lag is a paged SLI.

### P-05 · Identity: Supabase Auth behind an `IdentityProvider` port; buy enterprise SSO/SCIM, don't hand-roll more

- **Chosen:** keep Supabase Auth for students (passkeys/MFA enabled; session
  device registry in `identity`). Put it behind a port in `identity` so it can
  be replaced. For *enterprise* SAML/OIDC/SCIM at scale, evaluate **WorkOS** vs
  continuing the in-repo SCIM (`app/server/institution/scim*.ts`, off by
  default) vs Keycloak (self-hosted).
- **Criteria that decide it:** number of distinct IdPs per tenant (today one
  authorized provider per tenant), SCIM group mapping depth, audit-log export,
  price per connection, DPA/subprocessor fit, ability to run in the silo ring.
- **Why not decide now:** zero institutional IdP is live; the in-repo SCIM is
  untested against a real directory. Buy-vs-build is decided at the first real
  SSO onboarding, with that tenant's requirements as the test.
- **Risk:** identity vendor lock-in is the highest-switching-cost choice in the
  stack. **Mitigation:** the port, plus `external_identity` table keyed by
  `(issuer, subject)` owned by Semester.

### P-06 · Authorization: in-process PDP + relationship tuples; evaluate Cedar/OpenFGA only on trigger

- **Chosen:** the existing `decide()` pure function (ADR 0007) as the PDP,
  extended to every command; relationships as tuples in Postgres; RLS retained
  as defence in depth.
- **Alternatives:** OPA/Rego (flexible; separate process, data-sync problem);
  Cedar (typed, analysable policies, embeddable); OpenFGA/SpiceDB (ReBAC at
  scale, extra datastore); RBAC only (cannot express guardian/consent/purpose).
- **Why:** `decide()` is already pure, tested and obligation-aware; a second
  engine before it covers more than 3 actions is premature.
- **Trigger to adopt Cedar/ReBAC store:** > ~150 policy actions, or relationship
  checks (guardian↔student↔course) exceed a 10 ms p95 budget, or a customer
  requires policy *analysis* evidence. The PDP interface is the seam.
- **Risk:** hand-rolled policy drifts from RLS. **Mitigation:** a conformance
  suite runs every `POLICY_ACTION` against both PDP and RLS with the same
  fixtures and fails on disagreement.

### P-07 · Clients: keep React/Vite web; mobile via Capacitor shell first, domain logic extracted so a native swap is not a rewrite

- **Chosen:** web stays React 19 + Vite. iOS/Android via **Capacitor** shells
  with native plugins for SQLCipher (`@capacitor-community/sqlite` with
  encryption), push, biometrics and background sync.
- **Alternatives:** React Native/Expo (better native feel; does **not** reuse
  the 100+ DOM screens, only the domain packages); native Swift/Kotlin
  (best quality and a11y control, three codebases); Flutter (rewrite).
- **Criteria that favour Capacitor:** reuse of existing screens and the
  design system; one accessibility surface; fastest path to encrypted local
  storage. **Criteria against:** WebView performance on low-end Android,
  large-screen editors (Sheet/Write/Calendar) at 4–5 k lines each.
- **Go/no-go gate before committing (end of M2):** a 30-day spike must hit
  Today cold start < 3 s and 60 fps scroll on a reference low-end Android, pass
  TalkBack/VoiceOver audits on Today/Calendar/Tasks, and complete the
  encrypted-store round trip. A fail triggers the React Native path for
  *shells and navigation only*, reusing `packages/domain-*` and
  `offline-sync`.
- **Risk:** App Store review of a WebView app; background sync limits on iOS.
  **Mitigation:** native plugins carry real functionality (SQLCipher,
  biometrics, push); sync designed for foreground-plus-opportunistic.

### P-08 · Offline: encrypted local store behind a port; CRDT only for authored artifacts

- **Chosen:** `packages/offline-sync` defines `LocalStore`, `CommandQueue`,
  `ConflictPolicy`. Implementations: IndexedDB (web, today's `semester-store`),
  SQLCipher (native). **Yjs** for text artifacts (Write documents, notes);
  cell-level last-writer-wins registers with visible conflict history for
  sheets (not full CRDT); **server-authoritative commands** with idempotency
  keys and explicit *pending / confirmed / failed* states for anything
  institutional.
- **Alternatives:** Automerge (richer history, larger payloads); PowerSync /
  ElectricSQL / Replicache (turnkey sync; couples the data model to a vendor);
  hand-rolled everywhere (what exists: per-field merge in `lib/merge.ts`).
- **Why:** the repo's own `crdt-replication.md` limits CRDT to authored
  content; this honours it. Existing `lib/cloud.ts` per-field sync keeps
  working as the compatibility layer during conversion.
- **Risks:** key management on lost/revoked devices; compaction of CRDT logs;
  unbounded local growth. **Mitigation:** per-tenant/person/device key wrapped
  by platform keystore; remote revoke wipes DB+WAL+SHM; snapshot/compaction
  job; storage budget UI.

### P-09 · AI: provider-agnostic gateway as its own service; thin in-house router, not a general proxy product

- **Chosen:** `services/ai-gateway` with a provider interface (Anthropic and
  OpenAI adapters exist: `claude` edge function, `providers/openai.ts`),
  per-tenant model allow-list/zone/cost caps, retrieval broker, redaction,
  output guard, tool broker, event log.
- **Alternatives:** LiteLLM / OpenRouter-style proxy (fast, but sits outside
  the PDP and tenant context — would still need a policy wrapper); direct SDK
  calls from each module (what scatters policy); cloud-vendor model platforms
  (Bedrock/Vertex/Azure OpenAI) as *providers behind the router* for
  residency.
- **Why separate:** different scaling (streaming, long requests), different
  secrets, different blast radius, different compliance story.
- **Risks:** provider outage; prompt injection via retrieved content; cost
  runaway. **Mitigation:** multi-provider failover to a non-AI path; injection
  suite as release gate; hard per-tenant/per-user budgets enforced *before*
  the call; kill switch (`feature_kill_switch` exists).

### P-10 · Observability: OpenTelemetry everywhere, vendor-neutral sink

- **Chosen:** OTel SDKs (traces, metrics, logs) → OTLP collector → one vendor
  (Grafana Cloud, Honeycomb or Datadog — chosen on price and DPA at M1);
  Sentry-class client error tracking with PII scrubbing; audit ledger kept
  **outside** observability.
- **Alternatives:** single-vendor agent (lock-in), self-hosted stack (ops cost).
- **Risk:** telemetry becomes a PII leak. **Mitigation:** structured logger
  with classification-aware redaction; a test that logs a fixture
  `education_record` and asserts the sink never sees it.

### P-11 · Infrastructure as code: Terraform/OpenTofu, policy-as-code gate

- **Chosen:** Terraform (or OpenTofu), modules in `infrastructure/terraform`,
  Conftest/OPA on the plan in CI, drift detection nightly.
- **Alternatives:** Pulumi (TS-native; smaller policy ecosystem), CDK
  (cloud-locked), click-ops (current for Supabase/Vercel/GitHub settings —
  the gap `ROLLBACK.md`/`SECRETS.md` already name).
- **Risk:** state-file compromise. **Mitigation:** remote state, KMS-encrypted,
  per-environment roles, no human apply to production.

### P-12 · Cloud and region posture — **decision deferred to a person**

This one needs a business and legal input the repository cannot supply:
**data-residency commitments and the first customer's cloud/procurement
constraints.** Options are (a) stay on Supabase + Vercel + one container host
through ring 2, (b) AWS-primary, (c) GCP-primary, (d) Azure-primary (many
universities are Microsoft shops — see Microsoft Learn/Graph already in the
CSP). Recommendation: **(a) until the first design-partner contract names a
cloud**, because switching later is cheaper than guessing now *provided* P-03,
P-05 and P-08 ports are honoured. Counsel and the first customer decide data
zones and subprocessor lists; engineering does not.

### P-13 · API style: REST + OpenAPI 3.1, command/query, contract-first

- **Chosen:** each module publishes an OpenAPI fragment; types and clients are
  generated; Zod (or TypeSpec) is the single source for request/response
  schemas; `POST /v1/{module}/commands/{name}` with `Idempotency-Key`,
  `GET /v1/{module}/queries/{name}`; signed webhooks outbound; SCIM and LTI
  endpoints follow their standards, not ours.
- **Alternatives:** GraphQL (per-field authorization and cost control are hard
  to make auditable; caching and offline replay are harder); tRPC (TS-only
  coupling, no public contract for institutions); gRPC (not browser-first).
- **Risk:** drift between spec and implementation. **Mitigation:** generate
  server validators from the spec; contract tests run in CI; breaking-change
  detector (`oasdiff`) is a required check.

### P-14 · Feature flags and rings: extend the existing control plane; expose via OpenFeature

- **Chosen:** the activation control plane (28 flags, `tenant_feature_policy`,
  `tenant_rollout`, `feature_kill_switch`) *is* the system. Add an
  OpenFeature-compatible evaluation interface so clients and services call one
  API; no third-party flag vendor.
- **Alternatives:** LaunchDarkly/Unleash/flagd (good UX, another data
  processor, and *flag-plus-entitlement is not sufficient* in this product
  by the repository's own rule).
- **Risk:** build-time (`VITE_*`) and runtime flags diverge. **Mitigation:**
  one registry generates both; a test fails when a build flag has no runtime
  record (the registry tests already enforce a similar parity for docs).

## 3. Cross-cutting risk register for these choices

| Risk | L | I | Owner | Control |
| --- | --- | --- | --- | --- |
| Rebuild stalls product delivery | H | H | CTO | strangler waves each shippable ([09](09-CONVERSION-PLAN.md)); no big-bang |
| Single human holds every key | H | H | CEO/CTO | second operator + break-glass before ring 1 ([08](08-ORGANIZATION-AND-MILESTONES.md)) |
| Vendor lock-in (Auth, Postgres host) | M | H | Platform | ports + exit drills (restore on non-Supabase Postgres once per half-year) |
| Policy and RLS disagree | M | H | Security | conformance suite (P-06) |
| WebView ceiling on Sheet/Write | M | M | Mobile | go/no-go gate (P-07) |
| AI cost/safety incident | M | H | AI platform | budgets before call, injection gate, kill switch |
| Compliance claim outruns evidence | M | H | Counsel | claims only from `PUBLIC-CLAIMS-APPROVAL-REGISTER`; human counsel approves |

## 4. Order in which proposals become ADRs

P-01 (wave C0) → P-03 `FORCE RLS` + tenant context (C0) → P-06 (C1) → P-04
(C1) → P-02 (C2) → P-13 (C2) → P-10 (C2) → P-14 (C2) → P-08 (C3) → P-09 (C3)
→ P-07 gate (M2) → P-05 at first SSO onboarding → P-12 at first contract.
Each lands as one pull request that also opens its own `D-<PR>.md`.
