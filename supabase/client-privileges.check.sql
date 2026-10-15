-- The browser's roles hold no table privilege that row-level security does not govern.
--
-- `grants.check.sql` asks which functions a client may call. `rls-coverage.check.sql` asks whether
-- every table has row-level security and whether a `private` table is reachable. Neither asks the
-- question in between: of the privileges a client role holds on a `public` table, are any outside
-- what a policy can govern? TRUNCATE, TRIGGER and REFERENCES (and MAINTAIN, from Postgres 17) are
-- not evaluated against a policy, and Supabase's default privileges grant all of them on every new
-- table. `20261005000000_client_roles_lose_table_ddl_privileges.sql` removes them, and the default
-- that would hand them to the next table. This is the guard that keeps them removed.
--
-- Asked as a sweep over the whole schema and not a list of named tables, for the reason
-- `grants.check.sql` gives: the fault is an omission, and a list only catches the ones somebody
-- thought of. The default-privilege check is the part a list could never do: it creates a table and
-- reads what it was given.
--
-- Since D-1306 it also holds the other half: `anon` holds a row privilege only on the public catalog,
-- the open forms and the school list; a migration that adds a table revokes the default.
--
-- ## Controls
--
-- A sweep that finds nothing is also what a broken sweep finds. So the suite plants a table with
-- TRUNCATE granted to `anon` and requires the probe to name it, and it requires that the privileges
-- row-level security *does* govern are still held where they are meant to be, so that "nothing is
-- left" cannot mean "everything was revoked".
--
--   How to run it: supabase/check.sh client-privileges

begin;

-- The privileges this suite forbids. MAINTAIN is Postgres 17's; an older server has no such privilege.
create function pg_temp.forbidden() returns text[]
language sql stable as $$
  select array['TRUNCATE', 'TRIGGER', 'REFERENCES']
      || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else array[]::text[] end
$$;

-- Every (table, role, privilege) a client role holds among the forbidden ones.
create function pg_temp.offenders() returns table (relname text, role_name text, privilege text)
language sql stable as $$
  select c.relname::text, r.role_name, p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join (values ('anon'), ('authenticated')) as r(role_name)
    cross join unnest(pg_temp.forbidden()) as p(privilege)
   where c.relkind in ('r', 'p')
     and has_table_privilege(r.role_name, c.oid, p.privilege)
$$;


-- What a signed-out visitor is meant to hold on `public`, and nothing else: the pricing catalog, the
-- open forms, the school list, and the right to answer an open form. Every other table's policies key
-- on `auth.uid()`, so `anon` has no use for a grant on it (D-1306).
create function pg_temp.anon_allowed() returns table (relname text, privilege text)
language sql stable as $$
  select * from (values
    ('commercial_plans', 'SELECT'), ('commercial_prices', 'SELECT'), ('commercial_products', 'SELECT'),
    ('entitlement_definitions', 'SELECT'), ('plan_entitlements', 'SELECT'),
    ('form_publications', 'SELECT'), ('published_forms', 'SELECT'), ('schools', 'SELECT'),
    ('form_responses', 'INSERT')
  ) as v(relname, privilege)
$$;

-- Every row privilege `anon` holds on a table or view in `public` that is not on that list.
create function pg_temp.anon_extra() returns table (relname text, privilege text)
language sql stable as $$
  select c.relname::text, p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(privilege)
   where c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege('anon', c.oid, p.privilege)
     and not exists (select 1 from pg_temp.anon_allowed() a where a.relname = c.relname::text and a.privilege = p.privilege)
$$;

do $$
declare
  found text;
  n int;
begin
  -- 1. No public table gives a client role any of them.
  select string_agg(format('%s: %s holds %s', relname, role_name, privilege), '; ' order by relname, role_name, privilege)
    into found from pg_temp.offenders();
  if found is not null then
    raise exception 'FAILED: a client role holds a privilege row-level security does not govern: %', found;
  end if;
  raise notice 'ok  no public table gives anon or authenticated %', array_to_string(pg_temp.forbidden(), ', ');

  -- 2. A new table is born without them: the default privileges no longer grant them.
  create table public.zz_client_privileges_probe (id int);
  select count(*) into n from pg_temp.offenders() where relname = 'zz_client_privileges_probe';
  if n <> 0 then
    raise exception 'FAILED: a new table in public was created already granting a client role % privilege(s) outside row-level security', n;
  end if;
  raise notice 'ok  a table created now is born without them, so the next migration cannot ship them by default';

  -- 3. The control: the sweep sees a table that does hold one.
  grant truncate on public.zz_client_privileges_probe to anon;
  select count(*) into n from pg_temp.offenders()
   where relname = 'zz_client_privileges_probe' and role_name = 'anon' and privilege = 'TRUNCATE';
  if n <> 1 then
    raise exception 'FAILED: the sweep did not see a planted TRUNCATE grant to anon; it would pass any schema';
  end if;
  revoke truncate on public.zz_client_privileges_probe from anon;
  raise notice 'ok  the control: a planted TRUNCATE grant to anon is named by the sweep';

  -- 4. The default privileges themselves, read from the catalog: no entry for a client role among them.
  select string_agg(format('%s holds %s by default', pg_get_userbyid(a.grantee), a.privilege_type), '; ')
    into found
    from pg_default_acl d
    join pg_namespace ns on ns.oid = d.defaclnamespace and ns.nspname = 'public'
    cross join lateral aclexplode(d.defaclacl) a
   where d.defaclobjtype = 'r'
     and d.defaclrole = (select oid from pg_roles where rolname = current_user)
     and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
     and a.privilege_type = any (pg_temp.forbidden());
  if found is not null then
    raise exception 'FAILED: default privileges for new tables still grant: %', found;
  end if;
  raise notice 'ok  the default privileges for new public tables grant a client role none of them';

  -- 5. What row-level security governs is untouched: the grants the policies rely on are still there.
  if not has_table_privilege('anon', 'public.commercial_plans', 'SELECT') then
    raise exception 'FAILED: anon lost SELECT on commercial_plans, a public catalog; the revoke reached past its privileges';
  end if;
  if not (has_table_privilege('authenticated', 'public.notes', 'SELECT')
          and has_table_privilege('authenticated', 'public.notes', 'INSERT')
          and has_table_privilege('authenticated', 'public.notes', 'UPDATE')
          and has_table_privilege('authenticated', 'public.notes', 'DELETE')) then
    raise exception 'FAILED: authenticated lost a row privilege on notes; the revoke reached past its privileges';
  end if;
  raise notice 'ok  SELECT, INSERT, UPDATE and DELETE are still held where policies rely on them';

  -- 6. anon holds a row privilege only where a signed-out visitor needs it (D-1306).
  select string_agg(format('%s: anon holds %s', relname, privilege), '; ' order by relname, privilege)
    into found from pg_temp.anon_extra() where relname <> 'zz_client_privileges_probe';  -- the probe is this suite's own
  if found is not null then
    raise exception 'FAILED: anon holds a table privilege a signed-out visitor has no use for; row-level security is then the only thing between them and the table: %', found;
  end if;
  select count(*) into n from pg_temp.anon_allowed() a
   where not has_table_privilege('anon', format('public.%I', a.relname), a.privilege);
  if n <> 0 then
    raise exception 'FAILED: anon lost % of the % privileges the public catalog and open forms need', n, (select count(*) from pg_temp.anon_allowed());
  end if;
  raise notice 'ok  anon holds exactly the % privileges a signed-out visitor needs, on nothing else', (select count(*) from pg_temp.anon_allowed());

  -- 7. The control: the sweep sees a grant to anon when one is planted. (A table born now does hold
  -- Supabase's default row privileges for anon, as `grants.check.sql` requires the harness to model;
  -- the migration that creates a table must revoke them, and this suite is what makes it.)
  grant select on public.zz_client_privileges_probe to anon;
  select count(*) into n from pg_temp.anon_extra() where relname = 'zz_client_privileges_probe' and privilege = 'SELECT';
  if n <> 1 then
    raise exception 'FAILED: the sweep did not see a planted SELECT grant to anon; it would pass any schema';
  end if;
  revoke select on public.zz_client_privileges_probe from anon;
  raise notice 'ok  a planted SELECT grant to anon is named by the sweep (control)';
end $$;

rollback;
