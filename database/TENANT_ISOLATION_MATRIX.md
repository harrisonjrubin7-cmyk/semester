# Tenant isolation: measured posture

Source: catalog read of production, 2026-10-04, via `schema/inventory.sql` (queries 1, 6).

| Schema | Tables | RLS on | RLS forced | RLS on, **no policy** | Has `school_id`/`tenant_id`/`institution_id` | `anon` holds any DML | `authenticated` SELECT | `authenticated` write |
|---|---|---|---|---|---|---|---|---|
| public | 319 | 319 | **0** | 33 | 170 | **32** | 270 | 129 |
| private | 29 | 29 | **0** | 28 | 17 | 0 | 0 | 0 |
| public views | 2 | n/a | n/a | n/a | 1 | 1 | 2 | 0 |

Both views are `security_invoker=true`, so they evaluate the caller's RLS. Storage: 2 buckets (`community-media`, `trust-packet`), both private, 2 policies on `storage.*`.

## What the numbers support
- **Every table has RLS on.** Fact.
- **The 61 policy-less tables are deny-by-default** for browser roles (`private`: no grants at all; public: see the register). Consistent with `docs/DEFINER-RLS-REGISTER.md`; the count moved from 49 to 33 public + 28 private because this reading counts `private` too.
- **No table forces RLS.** Table owners bypass RLS. This is only a risk if an owner-role connection serves user traffic or a definer function owned by the table owner reads without its own gate. Decision for the owner: force RLS on tenant-bearing tables where the owner is not needed, after the check suites run. Not applied.

## What this is not
- **Not proof of tenant isolation.** 149 public tables have no tenant column; for most that is correct (owner-scoped by `user_id`, or global catalog) but each needs a classification. 16 authenticated-writable tables have neither a tenant nor an owner-like column (inventory query 6); not yet individually read.
- **No per-object matrix, no negative tests written or run.** The program's Phase 1 gate ("no cross-tenant test failures, no unclassified table") is **not met**: classification is not done, and I ran no cross-tenant test.
- Timing/count/error side channels were not examined.

## Next, in order
1. Classify all 348 tables (owner-scoped / tenant / global / service-only) into a checked-in register that a test compares to the catalog.
2. Read the 16 tables in query 6.
3. Decide on `FORCE ROW LEVEL SECURITY`.
4. Run the existing suites on PostgreSQL 17 (CI does).
