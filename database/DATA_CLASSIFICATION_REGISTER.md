# Table classification register

Machine-readable source: [`schema/table-classification.json`](schema/table-classification.json). Measured 2026-10-04 from production's catalog (`public` and `private`), read-only.

**354 objects, each in exactly one class.** The migrations' net table set (comments stripped, applied in filename order) equals production's: 354 of 354, nothing in either direction.

| Class | Objects | How it was assigned |
|---|---|---|
| tenant-scoped | 155 | has school_id, tenant_id or institution_id and at least one policy. Takes precedence over person-private, so profiles and organizations land here |
| service-only | 77 | no SELECT or write grant for anon or authenticated; reached only through definer functions or the service role |
| relationship-scoped | 55 | policies call a capability/membership/relationship helper (private.*) |
| person-private | 46 | owner column present and policies key on auth.uid() |
| parent-scoped | 8 | read policy is an EXISTS on a parent table, so it inherits the parent's RLS |
| global-public | 7 | anon can SELECT and a read policy admits rows without identity (catalog data) |
| global-reference | 4 | authenticated can SELECT, read policy is true, no tenant or owner column (role/capability reference data) |
| view | 2 | security_invoker view |

## What is guarded
`app/src/lib/tableclassification.test.ts` fails if a migration creates a table or view that is not in the register, or the register names one the migrations no longer create. Shown to fail for four deliberate faults (table removed from the register, a ghost table added, a new unclassified migration, the comment-stripping removed) and restored. It runs in `npm test`.

## What is not claimed
- **The classes are derived by rule from catalog evidence, not reviewed table by table.** 19 of 354 did not fit a rule and were resolved by reading their policies; none of the other 335 has been read by a person. Treat a class as a starting hypothesis for the tenant-isolation negative suite, not as a finding.
- Precedence matters: a table with a tenant column and any policy is `tenant-scoped` even when it is really person-private (`profiles`, `organizations`). Where that matters the negative suite must test the stricter reading.
- `service-only` means no browser grant, not "safe": 77 objects, reached through definer functions whose bodies are mostly still unreviewed (see `FUNCTION_AUTHORIZATION_MATRIX.md`).
- The guard compares names, not behaviour. It cannot tell that a policy does what its class says; `supabase/*.check.sql` does that against a real database.
- Retention, export, deletion and legal-hold behaviour per table (the program's data-ownership matrix) are not recorded here.

Production gained 4 objects between my first reading today (350) and this one (354): the register is a snapshot, and the guard is what keeps it current.
