# Authorization decision — 2026-10-14

**Decided:** reads through scoped RLS policies; writes only through security-definer command functions owned by one dedicated role. Applies to campus services, registrar, live integration and every new domain.

| | Rule |
|---|---|
| Reads | Every exposed table has RLS **enabled and forced** and explicit `select` policies scoped to the signed-in user, their grants and their institution (the kit's model). |
| Writes | No client `insert / update / delete` policies anywhere. Every write is a `security definer` function with `set search_path`, that validates actor, institution, grant, capability and state itself, and writes audit + outbox in the same transaction (the existing design). |
| Owner | All definer functions owned by `semester_writer` — `NOLOGIN`, `BYPASSRLS`. Nobody can sign in as it; it exists only so functions can write past forced RLS. |
| Execute | Revoked from `public`, `anon`, `authenticated`; granted to `service_role` only, which is held by edge functions and never shipped to a browser. |
| Browser role | `authenticated` must not bypass RLS and has no direct write privilege — the migration fails if either is true. |

## Why this and not either pure option

- **Pure kit model** (policies for every write, no bypass): every multi-row rule — last-bed race, group all-or-none, idempotent receipts, audit-first rollback — would have to be expressed as row policies, which can't see other rows' locks or roll back a whole group. The registrar and campus commands already need transactions that span tables.
- **Pure current model** (bypass, few read policies): one missed check inside a function is a breach, and nothing in the database backs it up. Read policies close the larger surface (every list, search and dashboard) independently of the write code.

## What it changes in files already written

- `campus_review_fixes.sql` creates `semester_writer`, moves every `cs_*` definer function to it and adds read policies.
- Registration hardening patch: its FORCE-RLS precondition ("owner must bypass RLS") now passes because the owner is `semester_writer`. Add the same `alter function … owner to semester_writer` loop for `registration_*` / `academic_record_*` functions before applying it.
- Live integration migration: `live_record_command` moves to the same owner.
- Roommate kit's "server roles must not BYPASSRLS": satisfied for every **login** role; the only bypassing role can't log in.

## Tests required before enabling any capability

1. Signed in as a student: can read own claims/contracts only; cannot read another student's or another institution's.
2. Signed in as staff with a `student_affairs` grant: reads that institution's claims only.
3. `authenticated` cannot insert/update/delete any `cs_*` / `registration_*` / `live_*` table directly.
4. `authenticated` cannot execute any definer function directly.
5. `pg_roles` shows `semester_writer` as `rolcanlogin = false`.
