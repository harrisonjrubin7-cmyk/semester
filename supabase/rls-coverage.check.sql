-- Row-level security holds across the whole schema, not only where a suite
-- happened to look.
--
-- Every other policy suite here is about its own tables: `records.check.sql`
-- walks two accounts through `notes`, `governance.check.sql` through the
-- registries. None asks the questions that are true or false of the schema
-- as a whole — is there a table with RLS off, a `security definer` function
-- with a mutable search_path, a write policy that admits anyone — and so a
-- migration that adds a new table without `enable row level security` passes
-- every one of them, because no suite knows that table exists.
--
-- Asked as sweeps rather than cases, for the reason `grants.check.sql` and
-- `indexes.check.sql` give: the fault is an omission, and a list of named
-- cases only catches the omissions somebody thought of.
--
-- ## Where it came from
--
-- An outside tenant-isolation suite was brought to this repository on 27
-- September to be executed as written. It could not be: it assumes a schema
-- this project does not have (`institutions`, `institution_memberships`,
-- `user_notes`, `course_sections`, `submissions`, `grade_entries`), and run
-- against the migrated database it created nine parallel tables and then
-- stopped on `column grant_row.institution_id does not exist`, because this
-- project's `role_grants` is scoped by `scope_kind`/`scope_id`, not by an
-- institution column. Its helper also set `request.jwt.claim.sub`, which
-- `auth.uid()` here does not read, so every "sees only own row" assertion
-- would have run as nobody.
--
-- What it had right were the invariants, and measured against the migrated
-- schema every one that applies here already held: 155 of 155 tables in
-- `public` with RLS on, 218 of 218 definer functions with a pinned
-- search_path, no write policy of `true`, no `private` table reachable by a
-- client role. Nothing guarded any of it. This file is the guard.
--
-- ## Two of its rules that are deliberately not here
--
--   * FORCE ROW LEVEL SECURITY on every table. Force only binds the table's
--     owner. The 218 definer functions run as that owner and several read
--     tables their caller cannot — `private.has_capability()` reads
--     `role_grants` — so on a project where the owner does not bypass RLS,
--     forcing it would make those helpers see nothing and every policy that
--     calls them refuse everybody; where it does bypass, force changes
--     nothing. Neither is a test worth asserting blind.
--   * No EXECUTE on `private` helpers for `anon`. The `private` schema is
--     not exposed through the API (config.toml names no extra schemas), so
--     the grant is how a policy reaches the helper, not how a visitor does —
--     and `form_responses` admits visitors with no account through
--     `private.form_open()`, which a revoke would break.
--
-- Each sweep below is run twice: once with a probe object planted that
-- breaks the rule, which it must name, and once without. A sweep that has
-- never failed is not known to be a guard.
--
--   How to run it: supabase/check.sh rls-coverage

begin;

-- ── The sweeps, as functions, so each can be run against a planted probe ──

/** Tables in `public` with row-level security off. */
create or replace function pg_temp.tables_without_rls()
returns text language sql stable as $$
  select string_agg(c.relname, ', ' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and not c.relrowsecurity
     -- Not a table an extension brought with it; see grants.check.sql.
     and not exists (select 1 from pg_depend d
                      where d.objid = c.oid and d.classid = 'pg_class'::regclass
                        and d.deptype = 'e');
$$;

/**
 * `security definer` functions in `public` or `private` that do not pin a
 * search_path. A definer function runs with its owner's rights and resolves
 * unqualified names through the caller's path, so without the pin a caller
 * who can create an object earlier on that path chooses what it runs.
 */
create or replace function pg_temp.definers_without_search_path()
returns text language sql stable as $$
  select string_agg(n.nspname || '.' || p.proname
                    || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                    ', ' order by 1)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s
                      where s like 'search_path=%')
     and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.classid = 'pg_proc'::regclass
                        and d.deptype = 'e');
$$;

/**
 * Policies in `public` that let a client role write any row at all: an
 * INSERT, UPDATE, DELETE or ALL policy whose USING or WITH CHECK is the
 * literal `true`, for `anon`, `authenticated` or `public`. A permissive
 * policy is OR-ed with the others, so one of these switches off every
 * narrower rule on its table for that command.
 */
create or replace function pg_temp.open_write_policies()
returns text language sql stable as $$
  select string_agg(tablename || ': ' || policyname, ', ' order by 1)
    from pg_policies
   where schemaname = 'public'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and permissive = 'PERMISSIVE'
     and roles && array['anon', 'authenticated', 'public']::name[]
     and (qual = 'true' or with_check = 'true');
$$;

/**
 * Tables in `public` a client role may read in full: a SELECT policy of
 * `true`. Some are meant to be — a vocabulary, a directory — so this is an
 * allowlist, and a new one is a failure until it is written down here.
 */
create or replace function pg_temp.open_read_tables()
returns text language sql stable as $$
  select string_agg(distinct tablename, ', ' order by tablename)
    from pg_policies
   where schemaname = 'public'
     and cmd in ('SELECT', 'ALL')
     and permissive = 'PERMISSIVE'
     and roles && array['anon', 'authenticated', 'public']::name[]
     and qual = 'true'
     and tablename not in (
       'app_capabilities',  -- the capability vocabulary; no rows about anyone
       'app_roles',         -- the role vocabulary; likewise
       'institution_action_offices', -- which offices exist and which roles
                            -- publish for each (20260928302000); configuration
                            -- naming no person, signed in only (anon has no grant)
       'role_capabilities', -- which role carries which capability; the matrix
                            -- itself, not who holds what (that is role_grants)
       'schools',           -- the school directory, readable signed out so the
                            -- claim screen can list them
       'entitlement_definitions', -- the entitlement vocabulary; no rows about anyone
       'plan_entitlements'  -- which public plan carries which entitlement: the
                            -- pricing page's comparison table
     );
$$;

/** Tables in `private` that `anon` or `authenticated` may touch directly. */
create or replace function pg_temp.reachable_private_tables()
returns text language sql stable as $$
  select string_agg(c.relname, ', ' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm')
     and (   has_table_privilege('anon', c.oid, 'select, insert, update, delete')
          or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete'));
$$;

-- ── First, that the sweeps are looking at a schema at all ──────────────────
--
-- The control for every "nothing found" below. A catalogue query with a
-- wrong schema name matches no rows and reports a clean schema.

do $$
declare
  tables int;
  definers int;
  policies int;
begin
  select count(*) into tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p');
  select count(*) into definers
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef;
  select count(*) into policies from pg_policies where schemaname = 'public';
  if tables < 100 or definers < 100 or policies < 100 then
    raise exception 'FAILED: the sweeps see % tables, % definer functions and % policies; '
                    'the migrations did not run or the catalogue query is wrong',
                    tables, definers, policies;
  end if;
  raise notice 'ok  the sweeps see % tables, % definer functions and % policies', tables, definers, policies;
end $$;

-- ── Every table in public has row-level security on ───────────────────────

-- Two ways a table ends up without it, and this asks about both. The first is
-- that `ensure_rls` (`…0100_schema.sql`) stops being there: it is the event
-- trigger that turns RLS on for every table created in `public`, it was made
-- by hand on production before any migration made it, and a rebuild without
-- it is quietly less safe than the database it replaces. So it is asked for by
-- behaviour — a new table comes out with RLS on — and not only by name.
--
-- The second is a migration that turns it off again, which the trigger cannot
-- see. The first draft of this sweep planted its probe with a bare `create
-- table` and the sweep did not name it — because the trigger had already
-- enabled RLS on the probe. The probe now disables it explicitly, which is
-- the case the trigger leaves open.

do $$
begin
  if not exists (select 1 from pg_event_trigger
                  where evtname = 'ensure_rls' and evtenabled <> 'D') then
    raise exception 'FAILED: the ensure_rls event trigger is missing or disabled';
  end if;
  create table public.rls_coverage_fresh (id int);
  if not (select relrowsecurity from pg_class
           where oid = 'public.rls_coverage_fresh'::regclass) then
    raise exception 'FAILED: a table created in public came out with RLS off; ensure_rls is not doing its job';
  end if;
  drop table public.rls_coverage_fresh;
  raise notice 'ok  ensure_rls is in place, and a new table in public comes out with RLS on';
end $$;

do $$
declare got text;
begin
  create table public.rls_coverage_probe (id int);
  alter table public.rls_coverage_probe disable row level security;
  got := pg_temp.tables_without_rls();
  if got is null or got not like '%rls_coverage_probe%' then
    raise exception 'FAILED: a table with RLS off was planted and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the RLS sweep names a planted table with RLS off';
  drop table public.rls_coverage_probe;

  got := pg_temp.tables_without_rls();
  if got is not null then
    raise exception 'FAILED: tables in public with row-level security off: % — '
                    'enable it, and write the policies, in the migration that made them', got;
  end if;
  raise notice 'ok  every table in public has row-level security on';
end $$;

-- ── Every definer function pins its search_path ───────────────────────────

do $$
declare got text;
begin
  create function private.rls_coverage_probe() returns int
    language sql security definer as 'select 1';
  got := pg_temp.definers_without_search_path();
  if got is null or got not like '%rls_coverage_probe%' then
    raise exception 'FAILED: an unpinned definer was planted and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the search_path sweep names a planted unpinned definer';
  drop function private.rls_coverage_probe();

  got := pg_temp.definers_without_search_path();
  if got is not null then
    raise exception 'FAILED: security definer functions with no pinned search_path: % — '
                    'add `set search_path = ''''` (or the schemas it needs)', got;
  end if;
  raise notice 'ok  every security definer function in public and private pins its search_path';
end $$;

-- ── No policy lets a client write any row ─────────────────────────────────

do $$
declare got text;
begin
  create policy "rls coverage probe" on public.notes
    for update to authenticated using (true) with check (true);
  got := pg_temp.open_write_policies();
  if got is null or got not like '%rls coverage probe%' then
    raise exception 'FAILED: a write policy of true was planted and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the open-write sweep names a planted write policy of true';
  drop policy "rls coverage probe" on public.notes;

  got := pg_temp.open_write_policies();
  if got is not null then
    raise exception 'FAILED: write policies that admit any row to a client role: %', got;
  end if;
  raise notice 'ok  no insert, update or delete policy in public admits any row to a client role';
end $$;

-- ── Only the named tables are readable in full ────────────────────────────

do $$
declare got text;
begin
  create policy "rls coverage probe" on public.notes
    for select to authenticated using (true);
  got := pg_temp.open_read_tables();
  if got is null or got not like '%notes%' then
    raise exception 'FAILED: a read policy of true was planted on notes and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the open-read sweep names a planted read policy of true';
  drop policy "rls coverage probe" on public.notes;

  got := pg_temp.open_read_tables();
  if got is not null then
    raise exception 'FAILED: tables any client may read in full, not on the allowlist: % — '
                    'narrow the policy, or add the table to open_read_tables() with the reason', got;
  end if;
  raise notice 'ok  only the seven vocabulary, catalog and directory tables are readable in full';
end $$;

-- ── Nothing in private is a client's to touch ─────────────────────────────

do $$
declare got text;
begin
  create table private.rls_coverage_probe (id int);
  grant select on private.rls_coverage_probe to authenticated;
  got := pg_temp.reachable_private_tables();
  if got is null or got not like '%rls_coverage_probe%' then
    raise exception 'FAILED: a granted private table was planted and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the private-table sweep names a planted table granted to a client';
  drop table private.rls_coverage_probe;

  got := pg_temp.reachable_private_tables();
  if got is not null then
    raise exception 'FAILED: private tables a client role can read or write: %', got;
  end if;
  raise notice 'ok  no table in private can be read or written by anon or authenticated';
end $$;

-- ── Switching identity inside one connection leaks nothing ────────────────
--
-- The pooler hands one connection to many requests in turn, and each sets
-- its own claims. A policy that cached who the caller was — or a helper that
-- read a setting the next request does not overwrite — would show the second
-- caller the first one's rows. Alice, Bob, Alice again, then signed out.

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  if who is null then
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims',
                       json_build_object('sub', who::text, 'role', 'authenticated')::text,
                       true);
    execute 'set local role authenticated';
  end if;
end $$;

do $$
declare
  alice uuid := 'eeeeeeee-0000-0000-0000-00000000c0a1';
  bob   uuid := 'eeeeeeee-0000-0000-0000-00000000c0b1';
  seen  text;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-coverage.alice.test@example.invalid', now(), now(), now()),
    (bob,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-coverage.bob.test@example.invalid',   now(), now(), now());

  perform pg_temp.become(alice);
  insert into public.notes (user_id, id, data) values (alice, 'coverage', '{"who":"alice"}');
  perform pg_temp.become(bob);
  insert into public.notes (user_id, id, data) values (bob, 'coverage', '{"who":"bob"}');
  reset role;

  -- The control: both rows are there, so a count of one below is the policy
  -- and not an insert that quietly did nothing.
  if (select count(*) from public.notes where id = 'coverage') <> 2 then
    raise exception 'FAILED: expected both notes to exist before the identity switch';
  end if;

  perform pg_temp.become(alice);
  select string_agg(data ->> 'who', ',') into seen from public.notes where id = 'coverage';
  if seen is distinct from 'alice' then
    raise exception 'FAILED: as Alice, saw %', seen;
  end if;

  perform pg_temp.become(bob);
  select string_agg(data ->> 'who', ',') into seen from public.notes where id = 'coverage';
  if seen is distinct from 'bob' then
    raise exception 'FAILED: after switching to Bob on the same connection, saw %', seen;
  end if;

  perform pg_temp.become(alice);
  select string_agg(data ->> 'who', ',') into seen from public.notes where id = 'coverage';
  if seen is distinct from 'alice' then
    raise exception 'FAILED: after switching back to Alice, saw %', seen;
  end if;

  perform pg_temp.become(null);
  select string_agg(data ->> 'who', ',') into seen from public.notes where id = 'coverage';
  if seen is not null then
    raise exception 'FAILED: signed out on the same connection, still saw %', seen;
  end if;
  reset role;
  raise notice 'ok  one connection switched Alice → Bob → Alice → signed out shows each only their own note';
end $$;

rollback;
