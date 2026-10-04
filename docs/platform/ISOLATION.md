# Tenant isolation, layer by layer

Row-level security protects the database. It does not protect the cache, the
queue, the object store, the search index, the warehouse, the support tools or
the AI retrieval path — and a cross-tenant leak in any of those is the same
incident. This page is the control matrix, what is proven in code, and what is
**not** proven.

> **Honest scope.** The controls below are proven against the *reference*
> (in-memory) adapters and by the conformance suite going red against
> deliberately leaky adapters. **No real Postgres, Redis, object store, search
> engine or warehouse adapter exists yet**, and the SQL contract has not run
> against PostgreSQL. Until an adapter passes the conformance suite against the
> real service, isolation for that layer is a *design*, not an *evidence*.

## The matrix

Catalogued in code as `ISOLATION_CONTROLS` (`isolation/layers.ts`); this table is
held to it by `docs.test.ts`.

| Layer | Control | Enforced in | Fails as |
| --- | --- | --- | --- |
| **api** | Tenant derived from verified identity; a client hint that disagrees is refused; the context is frozen | `tenancy/context.ts` | `tenant_mismatch` / `tenant_unresolved` |
| **database** | Repository methods take a `TenantScope`; foreign rows are invisible, foreign writes refused, a patch cannot move a row; RLS keyed on `app.tenant_id()`, **forced** | `isolation/layers.ts` (`TenantRepository`), `schema/platform_primitives.sql` | `not_found` / `tenant_mismatch` |
| **object_storage** | Key is `t/<tenant>/…`; every operation parses the key and checks the prefix **before the store is touched**; traversal refused; listings rooted at the caller's prefix | `engines/files.ts` | `not_found` |
| **queue** | Partitioned by tenant; producing into the wrong partition is refused; the consumer verifies the event's tenant; mismatches are dead-lettered and **never handled** | `events/emit.ts`, `isolation/layers.ts` | `wrong_tenant` (dead-lettered) |
| **cache** | Keys are `c:<tenant>:<namespace>:<key>`; the separator is refused inside a segment; **no shared unkeyed response cache**; per-tenant flush | `isolation/layers.ts` | miss |
| **search** | A scope is required to query and can only be built from a context; tenant and ACL predicates applied *inside* the index; education records excluded by default | `engines/search.ts` | no hits |
| **analytics** | Events stamped from the context; person id **pseudonymised per tenant** (the same person is a different subject in each, so there is no cross-tenant join key); free text and personal keys redacted; reads scoped | `isolation/layers.ts` | no rows |
| **support_tools** | A read needs a live, **ticket-bound**, scope-limited `support_access` consent in the same tenant; **every read, allowed or refused, is audited**; "platform admin" alone grants nothing | `isolation/layers.ts` (`supportRead`) | `forbidden` |
| **ai_retrieval** | Retrieval runs through a search scope **plus an allowlist of sources with a live `ai_context` consent**; returns provenance; withdrawn consent removes a source on the next retrieval, not the next re-index; records need consent too | `isolation/layers.ts` (`retrieveForAi`) | no passages |

## The conformance suite

`testing/conformance.ts` exports `isolationCases(subject)`: plain async functions
that **throw when a boundary leaks**, so they run under any runner and against any
adapter. Every case is *write as tenant A, try as tenant B* with the **same person
id in both tenants** — the realistic bug is not a stranger, it is an id that exists
twice — paired with a positive control (A *can* see its own), because a suite that
only checks for emptiness is satisfied by an adapter that stores nothing.

`isolation/isolation.test.ts` runs them against the memory adapters (all pass),
then against **seven deliberately leaky adapters** — a repository that ignores the
scope on reads, one that trusts the row's tenant over the scope, a cache keyed
without the tenant, an object store with no prefix check, a search index with no
tenant predicate, a queue that serves every partition, analytics that stores the
raw person id — and asserts the suite goes red **for the layer it breaks**.
*A guard that has never failed is not known to be a guard.*

### Accepting a real adapter

1. Implement the port (`TenantRepository`, `TenantCache`, `ObjectStore`,
   `TenantQueue`, `SearchIndex`, `TenantAnalytics`) against the real service in a
   disposable environment (a CI container, a throwaway bucket, a scratch index).
2. Build an `IsolationSubject` with two contexts for **one person id in two
   tenants** and your adapter in the right slot.
3. Run `isolationCases(subject)`; every case must resolve. Add the run to that
   adapter's integration job. A layer is "proven" in release evidence only when
   this has run against the real service.
4. For the database, additionally run the `.check.sql` suite that walks a second
   tenant (`supabase/check.sh`, CLAUDE.md) on a clean PostgreSQL 17.

## Decisions this page needs somebody to take

- **FORCE ROW LEVEL SECURITY.** No `FORCE` declaration exists in the current
  migrations ([`multi-tenant-isolation.md`](../architecture/multi-tenant-isolation.md)).
  The contract forces it on every new table; whether to force it on the existing
  ones, and which service paths need a documented, audited bypass, is a
  least-privilege review that has not happened.
- **Tenant segmentation depth.** Schema-per-tenant or database-per-tenant for a
  tenant that contractually requires it. The contract is shared-schema with forced
  RLS; nothing here forecloses stronger segmentation, and nothing builds it.
- **Cache of authorised responses.** Forbidden by default. If a surface needs one,
  it must be keyed `tenant + person + purpose + policy version` and gets its own
  conformance case first.

## Residual risk

- A new layer (a CDN, a notification provider that stores message bodies, a
  vector store) is **not covered until it has a row in the matrix and a case in the
  suite**. `architecture.test.ts` checks the catalogue covers every layer the code
  names; it cannot know about a layer nobody added.
- Pseudonymisation is per-tenant HMAC; whoever holds a tenant's secret can
  re-derive that tenant's subjects. Secrets are per tenant and never shared across.
- Support access is only as strong as the ticket system's honesty about `ticketId`.
- Timing and error-shape side channels are reduced (not-found for wrong-tenant
  ids; uninformative service-token failures) and not eliminated.
