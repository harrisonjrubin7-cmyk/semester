# ADR-0021 · No tenant-bearing index, bucket, queue, cache, warehouse or vector store ships without a tenant key and a conformance test against the real service

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Platform and data-architecture owner (founder until another is named) |
| Deciders / reviewers | Founder; security owner; privacy owner; counsel for regional placement, minors' media and restricted material (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 2 gate "multi-school activation"; Phase 1 for storage and cache items |
| Related | [`tenant-boundary-map.md`](../../architecture/tenancy/tenant-boundary-map.md) rows 6-14; [`docs/platform/ISOLATION.md`](../../platform/ISOLATION.md); [`docs/architecture/data-architecture/08-search-and-retrieval.md`](../../architecture/data-architecture/08-search-and-retrieval.md); `docs/architecture/data-architecture/06-analytics-architecture.md`; ADR 0006, 0008; ADR-0014, ADR-0017; legal rows Q-21, Q-04, P-18, Q-02 |
| Supersedes / superseded by | — |

> **Counsel required.** Data-region promises and cross-border transfer (Q-10, P-18), storage of restricted material and mandatory reporting (Q-21), device storage disclosures (Q-02), minors' media (Q-04).

## Context
- Tenant key: `tenant_id text references public.schools(id)` or `school_id` (151 FKs to `public.schools`), `scope_id` under `scope_kind='school'` (`tenant-boundary-map.md` §1).
- Storage: two private buckets, `community-media` (policies call `private.media_upload_allowed` / `private.media_read_allowed`; reviewer read at platform scope, `20260928032000_community.sql`) and `trust-packet` (signed URLs from `supabase/functions/trust-room`). CI excludes the Storage API (`.github/workflows/ci.yml:589`, `-x ... storage-api`); `supabase/trust-room.check.sql` uses a stand-in `storage.buckets` (findings-database #11).
- Search: one client-side ranker (`app/src/lib/find.ts`, ADR 0006); no server index; people, organisations, listings, messages, community are not searchable (`08-search-and-retrieval.md` §8.1). Becomes a boundary the day an index exists.
- Cache: browser service worker caches `SHELL`, `MEDIA`, `SHARE_CACHE` (`app/public/sw.js`); only `app/src/lib/shared.ts:53` clears one; whether sign-out clears the others was not established (findings-database #17). No server cache found; `/api/institution/*` is `no-store` (`app/vercel.json`).
- Queue: `private.domain_outbox_events` (one producer), `push_queue`, `support_notification_outbox`, media-deletion queue trigger (`tenant-boundary-map.md` row 9).
- Analytics: `public.activity` (per-user daily rows) and hand-pasted operator SQL `supabase/analytics.sql`; console figures with provenance (`20260929100000_console_control_plane.sql`).
- Vector: none; `grep -rniE 'pgvector|vector\(|embedding' supabase/migrations` returned nothing (row 14). AI retrieval is exact-id lookup of tenant-approved sources (`app/server/institution/intelligence-repository.ts:160`).
- Platform isolation matrix (cache, queue, object store, search, warehouse, support, AI retrieval) is proven only against reference in-memory adapters; `grep -rn 'app.tenant_id' supabase/migrations` = 0 (`docs/platform/ISOLATION.md`; findings-database #7).
- Gateway queries rely on `.eq('tenant_id', identity.institutionId)` by convention under the service role (`app/server/institution/intelligence-repository.ts`, findings-database #3).

## Problem
What must every tenant-bearing store other than the primary database provide (key shape, enforcement point, deletion behaviour, test) before it may hold a school's data, and how is it proven against the real service?

## Decision drivers
1. A cross-tenant leak in any store is the same incident as an RLS leak (`ISOLATION.md`).
2. The key is derived from membership, never a client claim.
3. Tests run against the real service, not a stub (storage-api gap).
4. Deletion, hold and export (ADR-0017) reach every store.
5. Stores that do not exist yet are denied by default.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Rely on RLS and app `.eq` filters only | No new work | Does not protect non-database stores; filter by convention | Not chosen |
| B. Separate infrastructure per tenant | Strongest isolation | Cost and operations beyond a one-person company | Option for a regulated customer |
| C. Shared stores with mandatory tenant-prefixed keys (path prefix, index filter, queue partition key, cache key namespace), enforced in one adapter per store and a conformance suite run against the real service | Fits current stack | Adapter work; real-service CI job | **Recommended** |
| D. Do not add search/vector/warehouse until needed | Zero surface | Blocks product plans | Default until a store passes C |

## Decision
**Recommended, unratified.** (1) A tenant-bearing store passes five checks before it holds data: tenant key built from verified membership by one adapter; deny-by-default for unknown tenant; deletion and hold behaviour per ADR-0017; export inclusion; and a negative test (tenant A cannot read B) run against the real service. (2) Object storage: path `tenant_id/...`; policies assert tenant, not only uploader; reviewer read is school-scoped (ADR-0020); a CI job exercises real Storage with two users. (3) Search: no server index until it filters by tenant and by per-person visibility at query time and indexes by data class; embeddings or a vector store are treated as copies of the source row and inherit its class, hold and erase. (4) Cache: server caches key by tenant; client caches are cleared on sign-out and account switch (test). (5) Queue/outbox: every row carries `tenant_id`; consumers re-derive the tenant, never trust the payload. (6) Analytics: no per-person data leaves the tenant; operator queries are logged or replaced (ADR-0020). (7) Service-role gateway code carries a tenant predicate on every `.from(<tenant table>)`, proved by a structural test. Regional placement of any store is a counsel decision before promises. Not ratified.

## Consequences
Positive: one checklist per store; real-service tests. Negative: a Storage-API CI job adds minutes and flake risk; search/vector work is gated. Harder: adding a convenient shared cache.

## Impact
- **Data / tenancy:** prefix keys everywhere; `app.tenant_id()` stays design-only unless adopted by a separate ADR.
- **Security:** closes service-role-by-convention gap for gateway code.
- **Privacy:** derived copies (embeddings, caches) enter retention and erase scope; minors and restricted material (Q-04, Q-21).
- **Accessibility:** no direct effect; signed-URL media still needs alt/transcript outside this ADR.
- **Operations (SLO, alert, runbook, support):** index/queue backlog metrics per tenant (ADR-0025).
- **Cost / commercial:** per-tenant storage accounting supports the storage meter (ADR-0016).

## Implementation
1. Structural test listing every `.from('<tenant table>')` in `app/server/**` and `supabase/functions/**` and requiring a tenant predicate. 2. Add a storage-api job to `ci.yml` uploading and reading as two users. 3. Clear `MEDIA`/`SHELL` caches on sign-out (`app/public/sw.js`, `app/src/lib/shared.ts`). 4. Write the per-store checklist as `docs/platform/STORE-ADMISSION.md`. 5. Move reviewer media read to school scope.

## Tests and verification
- `app/src/lib/tenantfilter.test.ts` (proposed): delete the `.eq('tenant_id', ...)` in one gateway query; test must fail (prove red).
- Storage conformance: user of school B requests an object in school A's prefix: refused by the real Storage API; fails against stub-only coverage. Control: own object readable.
- Sign-out cache test: after sign-out, `caches.keys()` holds no `MEDIA` entries.
- Admission test: a new `vector` extension in a migration fails until classified.

## Fitness functions
- `tenant-boundaries` (#5): includes per-store negative cases; `scripts/architecture/tenant-boundaries.sh`.
- `rls-coverage` (#3): storage policies enumerated.
- `audit-outbox` (#8): outbox rows carry tenant.
- `integration-contracts` (#10).
- Proposed `scripts/architecture/store-admission.mjs`: fails when a migration adds a store extension without an admission record.

## Rollback / reversal
Reversible per store by removing it. After tenant data enters a new index, removal requires purge proof (ADR-0017).

## Open questions
Real Storage policy behaviour (stub vs real JWT claims); whether `MEDIA` cache holds tenant data; regional placement; whether any search index is planned for pilots.

## Addenda
None.
