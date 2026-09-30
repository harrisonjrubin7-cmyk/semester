# Production advisor reconciliation, 30 September 2026 (D-1026)

Project `lzrqvlugnawcgywkhqlz`. Read-only: nothing here was applied to
production. Evidence of the before reading:
[`evidence/advisors/2026-09-30-before.json`](evidence/advisors/2026-09-30-before.json).

## Before and after

| Lint | Production, before | Local, before | Local, after the migration |
|---|---:|---:|---:|
| `rls_enabled_no_policy` | 49 | 49 | 49 (intended) |
| of which a client can touch | 0 | 0 | 0 |
| `authenticated_security_definer_function_executable` | 180 | 180 | 180 (register) |
| of which `anon` or PUBLIC can execute | 0 | 0 | 0 |
| `unindexed_foreign_keys` | 4 | 4 | **0** |
| `no_primary_key` | 2 | 2 | **0** |

"Local" is a throwaway Postgres built from every migration on `main`, read with
`supabase/advisor-probe.sql`; its before column reproduces production's exactly,
which is what makes the after column mean something. **Production after: not
yet observed.** Apply `20260930232000_advisor_reconciliation.sql`, re-run
`advisor-probe.sql` and the advisor, and record it here.

## Classification

| Finding | Class | Action |
|---|---|---|
| 49 tables, RLS on, no policy | Intentional private/service-only denial. No `anon`/`authenticated` privilege of any kind. | None. Four (`private.account_ages`, `public.registration_completions`, `public.registration_holds`, `public.registration_requests`) added to the register. |
| 180 definer functions | Signed-in callable by design; each has a register row; none open to `anon`/PUBLIC; `search_path` pinned. | None. `kill_switch_engaged` stays (DR-01). |
| anon table privileges on 26 tables | Hygiene, not exposure (RLS gates every row). | Recorded as DR-04. |
| 4 unindexed tenant FKs | Real: a school delete scans each table per school row. | Indexes. Two more found by the stricter `indexes.check.sql` on `main` after the advisor was read (`private.ledger_chain`, `private.ledger_chain_manifest`, added by #1012); indexed here too. |
| 2 tables without a key | Real, low risk. | Surrogate identity key; sequence revoked from client roles. |

No permissive policy was added. No function grant changed.

## Guards

- `supabase/advisor-reconciliation.check.sql` (17 checks): no policy-less table
  has a client privilege (with a probe proving the check can see a violation);
  the indexes and keys exist; writers still work; the audit-verification table
  is still append-only; the migration is idempotent over populated tables; no
  private sequence is client-open. Five mutations shown red, then restored.
- `supabase/indexes.check.sql`: now covers `private`, requires a primary key on
  every table.
- `definerregister.test.ts`: 180 functions, 49 tables, the four new rows.

## Not fixed, and why

`multiple_permissive_policies` (61), `unused_index` (521, tables are new and
idle) and `auth_db_connections_absolute` (a dashboard setting, not a migration).
