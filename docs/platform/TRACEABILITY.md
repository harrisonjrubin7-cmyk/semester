# Traceability: the mission against code, tests and evidence

What was asked, where it is, what holds it, and what is **not** done. "Held by"
names a test file; a claim with no test says so.

## The ten items

| # | Mission item | Code | Held by | Status |
| --- | --- | --- | --- | --- |
| 1 | Multi-tenancy and organization model | `tenancy/organization.ts`, `tenancy/context.ts` | `tenancy/tenancy.test.ts` | Built, in memory; SQL contract proposed |
| 2 | Identity, affiliations, roles, relationships, consent, capabilities, policy, approval, audit | `identity/*`, `policy/engine.ts` | `identity/identity.test.ts`, `policy/policy.test.ts`, `gateway/command.test.ts` | Built, in memory |
| 3 | Gateway/BFF standards: auth, context, idempotency, correlation, errors, pagination, versioning | `gateway/*`, `sdk/client.ts`, `app/src/lib/university.ts` | `gateway/gateway.test.ts`, `sdk/sdk.test.ts`, `app/src/lib/university.test.ts` | Gateway context/error slice and browser university client adopted; commands, policy and engines are **not mounted on a production route** |
| 4 | Workflow, notification, file, search, flags, entitlement, reporting, integration | `engines/*` | `engines/engines.test.ts` | Built, pure/in-memory; flags/entitlement **overlap** existing chains (MIGRATION phase 5) |
| 5 | Event schema and outbox | reuses `packages/institution/src/events.ts`; adds `events/emit.ts` | `reference/reference.test.ts`, `isolation/isolation.test.ts` | Atomic write proven in memory; **no production producer** |
| 6 | Isolation across DB, storage, queues, cache, search, analytics, support tools, AI retrieval | `isolation/layers.ts`, `testing/conformance.ts`, `schema/platform_primitives.sql` | `isolation/isolation.test.ts`, `schema.test.ts` | Reference adapters pass; suite proven red on 7 leaky adapters; **no real adapter, SQL never run** |
| 7 | Observability standards and operational metadata | `observability/*` | `observability/observability.test.ts` | Standards and descriptors; **no SLO measured** |
| 8 | Reference implementations and shared SDKs | `reference/tasks.ts`, `sdk/client.ts`, `testing/memory.ts`, `app/src/lib/university.ts` | `reference/reference.test.ts`, `sdk/sdk.test.ts`, `app/src/lib/university.test.ts` | Built; SDK adopted by the browser university client |
| 9 | ADRs and architecture tests | `adr/*`, `architecture.test.ts` | `architecture.test.ts`, `docs.test.ts` | Built |
| 10 | Migration path | `MIGRATION.md` | `docs.test.ts` (paths exist) | Phase 1 partially adopted; phase 2 onward not started |

## Requirements the audit makes of this layer

| Audit requirement | Where |
| --- | --- |
| "Every action is policy-evaluated, tenant-scoped, role-scoped, logged, explainable, reviewable and revocable" | `runCommand`: policy → audit (including denials) → revocable consent/approval; reason codes and sentences on every denial |
| "A privileged admin path or AI action that bypasses policy and audit" is prohibited | No unscoped `SearchIndex.query`; AI retrieval needs per-source consent; support reads are audited whether allowed or not; `platform:cross_tenant` is a narrow, audience-bound scope |
| "Tenant resolved from trusted identity/session, never only user-submitted headers" | `buildRequestContext`; the SDK has no tenant parameter (architecture test greps for it) |
| API: tenant-prefixed authorization, signed URL expiry, content classification (object storage) | `engines/files.ts` |
| Idempotency keys, correlation IDs, explicit command status, retries, dead-letter handling | `gateway/idempotency.ts`, `gateway/command.ts`, `events/emit.ts`, `isolation/layers.ts` (`drainPartition`) |
| Native when necessary, connected when available | `engines/integration.ts` (`nativeAvailable()` takes no connection); `ALWAYS_ENTITLED` |
| Source metadata on every external value | `SourceMetadata`, `resolveValue` |
| Guardian: no default access; consent and policy | `identity/relationship.ts` (never grants by existing), `identity/consent.ts`, `planNotification` |
| No dark patterns / unexplained profiling | marketing needs consent + opt-in channel, never to guardians, never in quiet hours; metrics refuse person/tenant labels |

## Shared-preamble outputs

### Assumptions

- The institution package's decision point, event catalogue and workflow machines
  are the authoritative ones and are reused as-is. Only `seam/` imports them.
- Shared-schema multi-tenancy with forced RLS is the default; stronger segmentation
  is possible and not built.
- Ids are opaque strings from a closed alphabet (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`).
- HMAC-SHA-256 with a key ring is acceptable for service tokens and cursors in this
  phase; asymmetric signing is not needed until a token crosses an organisation
  boundary.
- Web Crypto (`crypto.subtle`) is available everywhere the package runs (browsers,
  Node ≥ 20, the gateway).
- A new directory is placed in the layer stack deliberately (architecture test).

### Risks and unresolved questions

- **Most primitives are not adopted.** The institution gateway's error envelope,
  correlation ids and request context run through it, and the browser university
  client now uses the SDK (phase 1, equivalence-tested);
  commands, policy, idempotency and every engine are still proven in memory only,
  so they prove nothing about production.
- **The SQL contract has never executed.** It was parsed (libpg_query) and mirrored
  against the TypeScript; PostgreSQL 17 was not available. Treat every constraint
  as a hypothesis until `supabase/check.sh` runs it.
- **No real adapter exists** for any isolation layer; reference adapters model the
  contract. Isolation is *designed and tested at the contract level*, not evidenced.
- **Flag and entitlement overlap** with `app/src/lib/flags.ts` and
  `supabase/functions/_shared/entitlement.ts`: two evaluators until phase 5.
- **FORCE RLS** decision and the existing no-FORCE state.
- **Redaction is by key**; an unlisted free-text key passes through.
- Notification quiet-hours logic uses `Intl` time-zone data; edge cases (DST
  transitions, zones with half-hour offsets) are covered only for whole-hour
  windows.
- **Open questions for the institution and counsel** (not decided here): when a
  guardian's standing ends and who may consent for whom; retention periods per
  event class; whether a campus is a tenant; which obligations a cross-tenant
  support grant creates; the contractual SLOs.

### Files changed or proposed

New: `packages/platform/**` (code and tests), `docs/platform/**`,
`docs/platform/schema/platform_primitives.sql` (**proposed, not applied**), one
`docs/decisions/D-<PR>.md`. Modified: `app/vite.config.ts` (test include and
alias), `app/tsconfig.app.json` (alias and include), `app/tsconfig.university.json`
(include). No migration, no function, no screen, no register.

### Tests added

`packages/platform/src/**/*.test.ts` — every rule above has a test, and each guard
was checked by **mutation**: remove the check, watch a test fail, restore it (the
list is in the pull request). Controls accompany every scanner and the isolation
suite is proven red against leaky adapters.

### Accessibility implications

No UI is added. The platform constrains what surfaces can say: every refusal
carries a plain-language `message` and an optional `user_action`
(`open_screen`, `retry_later`, `contact_support`, `external_link`), so a screen
never has to invent an error sentence, and an offline/denied/pending state has a
code to render (`pending_approval`, `consent_required`, `entitlement_required`,
`outcome_uncertain`). Notification *timing* respects quiet hours and never sends
marketing then. Whether those states are rendered accessibly is each screen's work
and is not claimed here.

### Security and privacy implications

Positive: tenant derived not submitted; deny by default; audited denials;
hash-chained audit; per-tenant pseudonymisation; ids-not-content in events;
redaction by key; small-cell and complementary suppression; per-source AI
consent; support reads bound to a ticket and audited; billing never gates records.
Risks: see above. New secrets (cursor and service-token key rings, per-tenant
pseudonymisation secrets) must live in the secret store (`SECRETS.md`) and rotate
per `OPERATIONS.md` §4. Nothing here is a legal or compliance conclusion.

### Operational and runbook implications

New runbooks (written, **not rehearsed**): `OPERATIONS.md`. New alarms to create:
`semester_tenant_isolation_violation_total > 0` (page), outbox dead letters, stale
flags. New on-call surface: the `platform` seat, which is **unstaffed**.

### Traceability matrix updates

The existing matrices (`SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`,
`docs/CAPABILITY-PARITY-MATRIX.md`, the registers rendered by `npm run registers`)
were **not edited**: they are generated or contended, and this change adds no
product capability. This page is the traceability for the platform layer; a row per
adopting domain belongs in those matrices when MIGRATION phase 4 moves it.
