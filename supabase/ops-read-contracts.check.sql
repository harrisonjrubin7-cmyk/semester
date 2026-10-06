-- The operations contract registry and ops_projection_dashboard (20261006140000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What it proves
--   * Only console:operate at platform scope reads the dashboard: a stranger
--     is refused, and so is an operator whose grant is school-scoped; anon
--     cannot execute it; no client role can read the registry table.
--   * The registry is complete: every public console_* read function is a
--     row, so the list cannot silently lag the functions.
--   * A row cannot claim a capability its function does not name. The
--     function is the authority; the registry restates it.
--   * Every row's function exists; a live read says it was computed now; a
--     null staleness budget reads "no budget set", never "fresh"; a projection
--     row that never ran has no as_of.
--   * Nothing a student owns appears in what it returns.
--
-- Controls (each probe is shown able to fail)
--   * A planted row naming a function that does not exist reads
--     function_exists = false.
--   * A planted row claiming a capability the function does not mention is
--     caught by the same predicate the real assertion uses.
--   * The operator really is live: the dashboard returns the registry.
--
-- What it does not do
--   * It does not check that a function's gate is correct, only that the
--     registry agrees with what the function names.
--   * It does not exercise a projection: none exists.
--
--   How to run it: supabase/check.sh ops-read-contracts

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare operator uuid := gen_random_uuid(); school_only uuid := gen_random_uuid();
        stranger uuid := gen_random_uuid(); student uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains, is_demo)
    values ('contracts-live', 'Contracts Live University', array['contracts-live.example'], false);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@contracts-live.example', now(), now(), now()),
    (school_only, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'schoolonly@contracts-live.example', now(), now(), now()),
    (stranger,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@contracts-live.example', now(), now(), now()),
    (student,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zq-contract-student@contracts-live.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator,    'platform_admin',         'platform', '',               'platform'),
    (school_only, 'implementation_manager', 'school',   'contracts-live', 'platform');
  insert into public.notes (user_id, id, data)
    values (student, 'n1', '{"title":"zq-contract-note"}');
  insert into ids values ('operator', operator), ('school_only', school_only),
                         ('stranger', stranger), ('student', student);
end $$;

-- Privileges: the registry is not a client table; the function is for signed-in callers only.
do $$
begin
  if has_table_privilege('authenticated', 'private.ops_contract_registry', 'select')
     or has_table_privilege('anon', 'private.ops_contract_registry', 'select') then
    raise exception 'FAILED: a client role can read the registry table';
  end if;
  if has_function_privilege('anon', 'public.ops_projection_dashboard()', 'execute') then
    raise exception 'FAILED: anon can execute the dashboard';
  end if;
  if not has_function_privilege('authenticated', 'public.ops_projection_dashboard()', 'execute') then
    raise exception 'FAILED: signed-in callers cannot reach the dashboard to be refused by it';
  end if;
  raise notice 'ok  the registry is not a client table and anon cannot call the dashboard';
end $$;

-- Refusals: platform scope is required, not just a grant.
do $$
declare who text; denied boolean;
begin
  foreach who in array array['stranger', 'school_only'] loop
    denied := false;
    perform pg_temp.become((select v from ids where k = who));
    begin
      perform * from public.ops_projection_dashboard();
    exception when insufficient_privilege then denied := true;
    end;
    perform pg_temp.nobody();
    if not denied then raise exception 'FAILED: % read the dashboard', who; end if;
  end loop;
  raise notice 'ok  a stranger and a school-scoped operator are refused';
end $$;

-- The registry is complete and every row names a real function.
do $$
declare missing text; ghosts text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into missing
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'console\_%'
     and p.proname <> 'console_act'   -- a write, covered by the approvals checks
     and not exists (select 1 from private.ops_contract_registry r where r.name = p.proname);
  if missing is not null then
    raise exception 'FAILED: console read function(s) not in the registry: %', missing;
  end if;
  select string_agg(r.name, ', ' order by r.name) into ghosts
    from private.ops_contract_registry r
   where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = r.name);
  if ghosts is not null then
    raise exception 'FAILED: registry row(s) naming no function: %', ghosts;
  end if;
  raise notice 'ok  every console read function is registered and every row names a function';
end $$;

-- A row cannot claim a capability its function does not name. Control first:
-- the predicate must catch a planted lie.
create or replace function pg_temp.claims_unnamed_capability()
returns text language sql as $$
  select string_agg(r.name || ' claims ' || c, ', ' order by r.name)
    from private.ops_contract_registry r
    cross join lateral unnest(r.gating_capabilities) c
    join pg_proc p on p.proname = r.name
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where position(c in p.prosrc) = 0
$$;

do $$
declare found text;
begin
  update private.ops_contract_registry set gating_capabilities = '{console:operate,zz:not_named}'
   where name = 'console_figures';
  found := pg_temp.claims_unnamed_capability();
  if found is null then
    raise exception 'FAILED: control — the predicate did not catch a capability the function does not name';
  end if;
  raise notice 'ok  the predicate catches a planted false capability (%)', found;
  update private.ops_contract_registry set gating_capabilities = '{console:operate}'
   where name = 'console_figures';

  found := pg_temp.claims_unnamed_capability();
  if found is not null then
    raise exception 'FAILED: registry claims a capability its function does not name: %', found;
  end if;
  raise notice 'ok  every listed capability is named by its function';
end $$;

-- What the operator sees.
do $$
declare want bigint; got bigint; not_found bigint; budgetless bigint; stale_as_of bigint;
        self_row bigint; leaked bigint;
begin
  select count(*) into want from private.ops_contract_registry;

  perform pg_temp.become((select v from ids where k = 'operator'));
  select count(*) into got from public.ops_projection_dashboard();
  select count(*) into not_found from public.ops_projection_dashboard() where not function_exists;
  select count(*) into budgetless from public.ops_projection_dashboard()
   where staleness_budget_seconds is null and budget_state = 'no budget set';
  select count(*) into self_row from public.ops_projection_dashboard() where name = 'ops_projection_dashboard';
  select count(*) into leaked from public.ops_projection_dashboard() t
   where to_jsonb(t)::text ilike '%zq-contract%';
  perform pg_temp.nobody();

  if want = 0 then raise exception 'FAILED: control — the registry is empty'; end if;
  if got <> want then raise exception 'FAILED: dashboard returned % rows for a registry of %', got, want; end if;
  if not_found <> 0 then raise exception 'FAILED: % row(s) name a function that does not exist', not_found; end if;
  if budgetless <> want then raise exception 'FAILED: a null budget did not read as "no budget set" (% of %)', budgetless, want; end if;
  if self_row <> 1 then raise exception 'FAILED: the dashboard is not in its own registry'; end if;
  if leaked <> 0 then raise exception 'FAILED: student data appeared in the dashboard'; end if;
  raise notice 'ok  a platform operator reads the whole registry (% rows), none unbudgeted row looks fresh, no student data', got;
end $$;

-- Controls on the probes, then the freshness words.
do $$
declare ghost boolean; live_word text; proj_word text; proj_as_of timestamptz; live_as_of timestamptz;
begin
  insert into private.ops_contract_registry (name, kind, registered_in) values
    ('zz_not_a_function', 'live_read', 'check'),
    ('zz_projection_never_ran', 'projection', 'check');
  insert into private.ops_contract_registry (name, kind, staleness_budget_seconds, registered_in) values
    ('zz_budgeted_live', 'live_read', 60, 'check');
  update private.ops_contract_registry set staleness_budget_seconds = 300 where name = 'zz_projection_never_ran';

  perform pg_temp.become((select v from ids where k = 'operator'));
  select function_exists into ghost from public.ops_projection_dashboard() where name = 'zz_not_a_function';
  select budget_state, as_of into live_word, live_as_of from public.ops_projection_dashboard() where name = 'zz_budgeted_live';
  select budget_state, as_of into proj_word, proj_as_of from public.ops_projection_dashboard() where name = 'zz_projection_never_ran';
  perform pg_temp.nobody();

  if ghost is distinct from false then
    raise exception 'FAILED: control — a row naming no function did not read function_exists = false';
  end if;
  if live_word <> 'live, computed when read' or live_as_of is null then
    raise exception 'FAILED: a budgeted live read read "%" with as_of %', live_word, live_as_of;
  end if;
  if proj_word <> 'unknown: no projection has run' or proj_as_of is not null then
    raise exception 'FAILED: a projection that never ran read "%" with as_of %', proj_word, proj_as_of;
  end if;
  raise notice 'ok  a missing function is flagged; a live read is live; a projection that never ran is unknown';
end $$;

rollback;
