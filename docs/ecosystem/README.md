# Semester ecosystem — inventory, coverage and blockers

Status as of 2026-10-13. This is an inventory, not a completion claim.

## What was inventoried

`COVERAGE-MATRIX.csv` has 410 rows generated from the planning files supplied
for this session (continuation spec pack: demo storyboards and deck slide specs included; company OS feature map, functions, workflow swimlanes,
catalog continuation register, component patterns, console workspaces,
16-week plan, risk register, pilot activation gates, monthly package schema
checks, investor/board permission matrix). Every row is marked **Proposed**,
**Specified**, or **Unverified**. None is marked implemented or deployed,
because no implementation or deployment evidence for them was found.

- Console workspaces (18): each workspace id appears in
  `app/src/lib/console/workspaces.ts` on `origin/main`, but only a grep was run.
  That is not a definition check, and nothing was rendered or tested.
- Company OS features, functions, and catalog items: mapping proposals only.
  The source files say so.

## Verified in this session

- **University records RLS reference** (`reference/university-records-rls/`).
  Applied to a throwaway PostgreSQL 16 with pgTAP and a minimal `auth` shim
  (`shim.sql`). The migration applied cleanly and 73 of 73 assertions passed.
  This does not run against Supabase, and it does not test the custom access
  token hook.

  Run locally: `psql -d <db> -f shim.sql`, then `migration.sql`, then `tests.sql`.

## Not done, and why

1. **The RLS reference is not in `supabase/migrations/`.** `origin/main`
   already has a live role model: `public.role_grants` with 20+ roles, and
   `private.holds_role()` referenced from 15 migration lines. The reference
   adds a second model: `private.role_grants` with seven roles, its own session
   context, and a custom JWT claim. Both cannot be the source of truth for role
   grants. **Decision needed** (see D-<PR>).
2. **No deployment.** The Supabase project is live and has production data.
   Applying migrations there, or to any staging target, needs explicit approval
   and a named target. No staging target was identified.
3. **The full ecosystem is not built.** The matrix covers 410 items.
   Most have no code, and several depend on decisions listed below. Building
   them in one session is not possible, so delivery needs phases.

## Decisions needed

- Which role model is canonical: the live `public.role_grants` / `holds_role`,
  or the seven-role reference model? Migrating one to the other is a data
  migration, not an additive change.
- Confirm the deployment target and approval path for any Supabase change.
- Confirm the seat owners named in the planning files. Several are placeholders
  ("Founder → seat"), and the files say owners are not assigned.

## Next executable tasks (after the decisions above)

1. Map the 18 console workspaces to real screens and server actions, one
   vertical slice at a time, starting with the one that has the fewest gates.
2. Add negative permission tests for the chosen role model.
3. Write the pilot gate evidence (`PROP-PILOT-*`) as real artifacts, not as
   checkboxes.

## Continuation specification (reference)

`reference/continuation-spec/` holds the continuation spec, shared contracts,
and monthly disclosure schema from the continuation pack. Its own first-slice
definition matches this README: extend the existing Console, reuse the
grant-aware entry, and build a backend-tested vertical slice before any
navigation demo. It also says the shared contracts must be reconciled with
existing tables and must not create duplicates. That makes D-1582 a
prerequisite for the work item and document contracts, not only for records.
Its demo storyboards and deck outlines are scripts and drafts only. Nothing is
rendered, approved, or distributed.

## Product domain registry (reference)

`reference/product-domains/` holds the 27-domain registry, its JSON contracts,
the architecture register, and a local HTML explorer. The three data files agree
on all 27 domain IDs and fields. The matrix now includes them as `DOM-*` rows.
Two things must not be relied on:

- The explorer's role lens is labelled "not authorization", and its grade
  workflow is a hard-coded local simulation. It is not RLS, auth, or a gradebook.
- The contracts list 10 unresolved source gaps (for example, 93 capabilities and
  the 24 stages not supplied). They are not filled in, and the domains that
  depend on them remain unverified.
