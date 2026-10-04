# Tenant-isolation verification suite

> Part of [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md). Closes finding F-01 and
> F-12 in [`FINDINGS-REGISTER.md`](FINDINGS-REGISTER.md) when TI-01 to TI-12
> are all present and green in CI.

## The architecture being verified

1. **Identity of the tenant is a membership, never a claim the client sends.**
   Consumer rooms: `profiles.school_id`, written only by `claim_school()` after
   the email domain is confirmed. Institutional: `institution_membership` plus
   exactly one `institution_identity_provider`. Authorisation:
   `role_grants (subject, role, scope_kind, scope_id)` read by
   `private.has_capability`, which is **exact-scope** — a platform grant does
   not imply school access.
2. **Row-level security is default-deny.** Every `public` table has RLS on
   (`supabase/rls-coverage.check.sql`); tables with no policy hold no client
   privilege. `SECURITY DEFINER` functions pin `search_path` and name
   `auth.uid()` or a `private.` gate.
3. **The service role is for workers that filter by tenant themselves.** Each
   Edge Function and gateway query that uses the service key must scope by an
   identity it derived, never one the request supplied.

**Known gap (F-01):** enforcement of (1) for course rooms is a per-school switch,
`schools.enforce_membership`, default **false**. Until it is on, a confirmed
address of any domain can enter any school's room.

## What already runs

`supabase/check.sh` builds a throwaway Postgres, applies every migration twice,
and runs 106 suites. About half name a second school or tenant. The structural
sweeps are `supabase/rls-coverage.check.sql`, `supabase/definer-sweep.check.sql` and
`supabase/grants.check.sql`. CI runs them in the `build` job; locally,
`SEMESTER_CHECK_PG_ANY=1 supabase/check.sh` runs them on another Postgres major
(a pass there is not a statement about production, which runs 17).

## The cases

**Status:** *Exists* means a suite already asserts it; *Add* means it does not
and this is the specification; *Partial* names what is missing. Each case is
written so that it can fail: the suite must contain a **control** (a probe that
should be refused, planted and shown refused) and the guard must be seen red
against the bug before it is trusted — `CLAUDE.md`, "Proving a change".

| ID | Case | Method | Status |
|---|---|---|---|
| TI-01 | Tenant A member cannot read, update or delete a tenant B row in **every** table that carries `tenant_id`/`school_id` | Generate the table list from `information_schema`; for each, as a tenant-A user, `select`/`update`/`delete` a planted tenant-B row; expect zero rows and no change. Fail if a tenant-scoped table is not covered | Add (today per-feature, ~50 suites) |
| TI-02 | Tenant context cannot be set by the client | For every RPC taking a tenant/school argument, call it as tenant A naming tenant B with a real id; expect refusal or empty | Partial — `definer-sweep` uses neutral arguments and says it cannot catch this |
| TI-03 | `enforce_membership` cannot be turned off by a school admin or a client | As `authenticated` and as a school admin, `update schools set enforce_membership=false`; expect privilege error | Exists (revoked, `supabase/school-membership.check.sql`); keep |
| TI-04 | Every tenant-scoped table is covered by TI-01; a new one fails CI until it is | Compare the TI-01 list to the tables that carry a tenant column; fail on an uncovered one | Add (about 18 tables unnamed today) |
| TI-05 | Platform grant does not imply tenant access | As a holder of a platform-scope role with no school grant, call each `has_capability`-gated RPC for a school; expect refusal | Partial |
| TI-06 | Support access is tenant-scoped and expires | Grant support access to tenant A with a 1-minute expiry; read tenant B (expect refusal); wait past expiry, read tenant A (expect refusal) | Add (F-11) |
| TI-07 | Open-read policies are an allowlist, not only a literal `true` | Extend the sweep: any `select` policy for `anon` whose expression references no `auth.uid()`/`private.` gate must be on the reviewed list (today `using (active)` passes) | Add |
| TI-08 | `private` and `storage` have a policy sweep | `private`: every table has RLS on or no client privilege. `storage.objects`: no policy grants `anon`; every bucket not on the public allowlist is private | Add (note `check.sh` runs on a **stub** storage schema: run this against a Supabase branch as well) |
| TI-09 | Tenant offboarding leaves no readable rows | Offboard tenant A; as a former member and as tenant B, read A's rows; expect none | Exists (`supabase/school-offboarding.check.sql`) |
| TI-10 | Service-role code paths scope by derived tenant | For each Edge Function and gateway repository call that holds the service key, a unit test with two tenants' rows proves the response contains only the caller's; list is generated from `grep SUPABASE_SERVICE_ROLE_KEY` so a new function must be added | Add (13 functions today) |
| TI-11 | Storage objects: another tenant cannot read, overwrite or delete | Upload as tenant A, then `select`/`update`/`delete` as tenant B on the real storage service | Partial (`supabase/community.check.sql`, stub storage) |
| TI-12 | Search, export and AI retrieval never cross tenants | Seed two tenants with a unique token each; search, export and retrieval as A must never return B's token | Add (no registry for jobs, exports, search) |

## Where it runs

- **Every pull request:** TI-01 to TI-10 in `supabase/check.sh` (a new suite
  named tenant-isolation, ending in an `ok` notice — the `check.sh` guard
  from C-03 refuses a suite that does not).
- **Against a Supabase branch before each release:** TI-08 and TI-11, because the
  stub storage schema is not Storage. How to run suites against a branch is
  the subject of open PR #1028 (branch claude/t2-branch-checks); check `main` for it
  before writing a second copy.
- **Quarterly, by a person:** try to break it (see the tabletop in
  [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) §10); a case the person finds that
  no automated case would have caught becomes a new TI-nn.

## Release gate

No institution is enabled until: `enforce_membership` is on for it, TI-01 to
TI-10 are green on the release commit, TI-08/TI-11 are green against a branch,
and the result is filed under `docs/evidence/security/`. This is the "no-go"
condition the audit names ("Tenant isolation … not independently tested") made
into a check.
