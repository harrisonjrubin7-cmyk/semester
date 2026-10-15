-- The production-advisor reconciliation of 30 September 2026 (D-1026): that a
-- table with row-level security on and no policy is unreachable by any client
-- role — the fact that lets the advisor's 49 notices stand as intended — that
-- the four tenant foreign keys the advisor named are covered, that the two
-- tables it named have a primary key, and that adding those keys neither
-- disturbs the append-only audit-verification table nor leaves its new
-- sequence open to a client.
--
-- The first check is the durable one. Nothing here adds a policy, and none
-- should: the notice is the correct state for a table only a definer function
-- or the service key reaches. What would make it a real exposure is a client
-- privilege on such a table, and that is asked over the whole schema so the
-- next policy-less table cannot arrive carrying one.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh advisor-reconciliation

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

-- Rows a statement touched as someone; zero is a refusal by row-level security.
create or replace function pg_temp.touched(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute q;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

-- The error a statement raises as someone, or null when it runs.
create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

create or replace function pg_temp.runs_clean(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;


-- Whether a client role holds any privilege on a relation, table or column.
create or replace function pg_temp.client_holds(rel oid)
returns boolean language sql stable as $$
  select has_table_privilege('anon', rel, 'select,insert,update,delete,truncate,references,trigger')
      or has_table_privilege('authenticated', rel, 'select,insert,update,delete,truncate,references,trigger')
      or has_any_column_privilege('anon', rel, 'select,insert,update,references')
      or has_any_column_privilege('authenticated', rel, 'select,insert,update,references');
$$;

-- ── 1. A table with RLS on and no policy is reachable by no client role ───

do $$
declare
  open_tables text;
  policyless int;
begin
  select count(*), string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname)
           filter (where pg_temp.client_holds(c.oid))
    into policyless, open_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and n.nspname in ('public', 'private')
     and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if open_tables is not null then
    raise exception
      'FAILED: row-level security on, no policy, and a client role holds a privilege: %. The advisor''s notice is only benign while none does — revoke it, or write the policy that says who may.',
      open_tables;
  end if;
  if policyless < 40 then
    raise exception 'FAILED: only % policy-less tables found — the instrument has lost sight of the schema', policyless;
  end if;
  raise notice 'ok  all % tables with row-level security and no policy are closed to anon and authenticated', policyless;
end $$;

-- The instrument, shown to see: a policy-less table a client can read is reported.
do $$
declare
  reported boolean;
begin
  create table public.zz_open_probe (id int);
  alter table public.zz_open_probe enable row level security;
  grant select on public.zz_open_probe to authenticated;
  reported := pg_temp.client_holds('public.zz_open_probe'::regclass);
  drop table public.zz_open_probe;
  if not reported then
    raise exception 'FAILED: the probe did not see a client privilege on a policy-less table';
  end if;
  raise notice 'ok  the check sees a client privilege on a policy-less table';
end $$;

-- ── 2. The six tenant foreign keys are covered ───────────────────────────

do $$
declare
  t text;
  covered boolean;
begin
  foreach t in array array['domain_outbox_events', 'gateway_intelligence_action', 'gateway_intelligence_audit', 'gateway_review', 'ledger_chain', 'ledger_chain_manifest'] loop
    select exists (
      select 1 from pg_index x
       where x.indrelid = ('private.' || t)::regclass
         and x.indpred is null
         and (x.indkey::int2[])[0:0] = (select array_agg(a.attnum) from pg_attribute a
                                         where a.attrelid = x.indrelid and a.attname = 'tenant_id')
    ) into covered;
    if not covered then
      raise exception 'FAILED: private.% has no index led by tenant_id', t;
    end if;
  end loop;
  raise notice 'ok  the six private tenant foreign keys each have a covering index';
end $$;

-- ── 3. The two tables have a primary key, and their writers still work ────

do $$
begin
  perform pg_temp.counted('site_lead_hits has a primary key on id',
    (select count(*) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'private.site_lead_hits'::regclass and i.indisprimary and a.attname = 'id'), 1);
  perform pg_temp.counted('ledger_chain_verification has a primary key on id (added by #1012 after the advisor was read)',
    (select count(*) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'private.ledger_chain_verification'::regclass and i.indisprimary and a.attname = 'id'), 1);
  perform pg_temp.counted('console_audit_verification has a primary key on id',
    (select count(*) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'private.console_audit_verification'::regclass and i.indisprimary and a.attname = 'id'), 1);

  -- The writers name their columns, so the new one is filled by the database.
  insert into private.site_lead_hits (ip_hash) values (repeat('a', 64)), (repeat('a', 64));
  perform pg_temp.counted('two hits from one address at one instant are two rows with two ids',
    (select count(distinct id) from private.site_lead_hits), 2);
  insert into private.console_audit_verification (ok, rows_checked, first_bad_seq, note) values (true, 10, null, 'a'), (true, 10, null, 'a');
  perform pg_temp.counted('two checks in one transaction share a time and have two ids',
    (select count(distinct id) from private.console_audit_verification), 2);
end $$;

-- ── 4. The audit-verification table is still append-only ──────────────────

create or replace function pg_temp.attempt(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

do $$
begin
  if pg_temp.attempt('update private.console_audit_verification set note = ''edited''') is null then
    raise exception 'FAILED: a verification row was edited';
  end if;
  if pg_temp.attempt('delete from private.console_audit_verification') is null then
    raise exception 'FAILED: a verification row was deleted';
  end if;
  raise notice 'ok  a verification cannot be edited or deleted, with the new key in place';
end $$;

-- ── 5. The keys go onto populated tables without disturbing them ──────────
-- Production has two verification rows. Put both tables back as they were
-- there — rows, no id, no key — and run the migration file over them.

alter table private.console_audit_verification drop constraint console_audit_verification_pkey;
alter table private.console_audit_verification drop column id;
alter table private.site_lead_hits drop constraint site_lead_hits_pkey;
alter table private.site_lead_hits drop column id;

\ir migrations/20260930232000_advisor_reconciliation.sql

do $$
begin
  perform pg_temp.counted('the verifications survive, all of them', (select count(*) from private.console_audit_verification), 2);
  perform pg_temp.counted('each has its own id', (select count(distinct id) from private.console_audit_verification), 2);
  perform pg_temp.counted('the lead hits survive, all of them', (select count(*) from private.site_lead_hits), 2);
  perform pg_temp.counted('each has its own id', (select count(distinct id) from private.site_lead_hits), 2);
  perform pg_temp.counted('and the verification table still has one primary key',
    (select count(*) from pg_index where indrelid = 'private.console_audit_verification'::regclass and indisprimary), 1);
  if pg_temp.attempt('update private.console_audit_verification set note = ''edited''') is null then
    raise exception 'FAILED: the verification table lost its append-only trigger';
  end if;
  raise notice 'ok  the append-only trigger still holds after the keys were added to a populated table';
end $$;

-- Twice is the same as once.
\ir migrations/20260930232000_advisor_reconciliation.sql

select pg_temp.counted('run again, still one key on each',
  (select count(*) from pg_index where indrelid in ('private.console_audit_verification'::regclass, 'private.site_lead_hits'::regclass) and indisprimary), 2);

-- ── 6. Neither table nor its sequence is open to a client ─────────────────

do $$
declare
  s record;
  n int := 0;
begin
  for s in
    select c.oid, c.relname
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where c.relkind = 'S' and ns.nspname = 'private'
  loop
    n := n + 1;
    if has_sequence_privilege('anon', s.oid, 'usage,select,update')
       or has_sequence_privilege('authenticated', s.oid, 'usage,select,update') then
      raise exception 'FAILED: a client role can reach the sequence private.%', s.relname;
    end if;
  end loop;
  if n < 2 then raise exception 'FAILED: expected the two identity sequences, found %', n; end if;
  raise notice 'ok  none of the % sequences in private is open to anon or authenticated', n;
  if pg_temp.client_holds('private.site_lead_hits'::regclass) or pg_temp.client_holds('private.console_audit_verification'::regclass) then
    raise exception 'FAILED: a client role holds a privilege on one of the two tables';
  end if;
  raise notice 'ok  and neither table gained a client privilege';
end $$;

rollback;
