# database/

Catalog-derived isolation evidence for production (`lzrqvlugnawcgywkhqlz`), read **2026-10-04, read-only**.
Nothing here was applied to any database. `schema/inventory.sql` regenerates every figure.

| Requested artifact | Status |
|---|---|
| `TENANT_ISOLATION_MATRIX.md` | Written: aggregate posture + gaps. Per-object matrix is **not** written (see its "What this is not"). |
| `GRANT_ALLOWLIST.md` | Written for `anon` (measured, 32 tables). `authenticated` allowlist (270 select / 129 write) **not** written. |
| `FUNCTION_AUTHORIZATION_MATRIX.md` | Written: counts, review queue, one verified exception. Per-function matrix **not** written. |
| `DATA_CLASSIFICATION_REGISTER.md` | Written (354 objects, one class each, guarded by a test). Classes are rule-derived, not reviewed per table. |
| `RLS_POLICY_MAP.md`, `SCHEMA_OWNERSHIP_MATRIX.md` | **Not written.** Existing: `docs/DEFINER-RLS-REGISTER.md`, `docs/TENANT-CONTRACT.md`. |
| PostgreSQL 17 policy evidence | CI runs `supabase/policy-evidence.sh` against a clean throwaway PostgreSQL 17 cluster, reapplies every migration, runs every `supabase/*.check.sql` suite, and retains `pg17-policy-evidence-<sha>` as a machine-readable exact-commit artifact. A local host without PostgreSQL 17 still cannot make this claim. |
| Unresolved policy register | `UNRESOLVED_POLICY_REGISTER.json` is the checked-in machine-readable queue. A green harness run does not close these object-review, owner-bypass, cross-tenant, grant, or managed-schema gaps. |

Related, already on main and not duplicated: `docs/DEFINER-RLS-REGISTER.md`, `docs/architecture/multi-tenant-isolation.md`,
`docs/target-architecture/`, `docs/ADVISOR-RECONCILIATION-2026-09-30.md`.
