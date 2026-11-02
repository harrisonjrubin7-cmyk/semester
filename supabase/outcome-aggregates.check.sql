-- Outcome aggregates: small-cell floor and school-scoped read authorization.
--
-- `outcome_aggregates` is the server-held evidence behind institutional
-- outcome reporting. This suite proves the two repository controls that keep
-- it aggregate-only and tenant-scoped:
--
--   * the database refuses a cell with fewer than ten people;
--   * a live school-scoped `outcomes:read` grant sees only that school;
--   * a same-school account without the capability, a revoked reader, an
--     account at another school and an anonymous request see no protected row;
--   * authenticated clients cannot write the service-produced table.
--
-- The positive same-school read is the control: a policy that hid every row
-- would not satisfy this suite.
--
-- How to run it: supabase/check.sh outcome-aggregates

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at
  ) values (
    who, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', address, now(), now(), now()
  );
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

create or replace function pg_temp.invalid(what text, statement text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAILED: % — the row was accepted', what;
exception
  when check_violation then
    raise notice 'ok  % (rejected)', what;
end $$;

create or replace function pg_temp.refused(what text, statement text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAILED: % — the statement was allowed', what;
exception
  when insufficient_privilege then
    raise notice 'ok  % (refused)', what;
end $$;

create or replace function pg_temp.seen(who uuid, query text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || query || ') rows' into n;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  raise;
end $$;

do $$
declare
  reader_a uuid;
  reader_b uuid;
  no_capability uuid;
  revoked_reader uuid;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('oa-a', 'Outcome A', array['oa-a.example']),
    ('oa-b', 'Outcome B', array['oa-b.example']);

  reader_a      := pg_temp.newuser('reader@oa-a.example');
  reader_b      := pg_temp.newuser('reader@oa-b.example');
  no_capability := pg_temp.newuser('student@oa-a.example');
  revoked_reader := pg_temp.newuser('revoked@oa-a.example');

  insert into public.role_grants (
    subject, role, scope_kind, scope_id, provenance, revoked_at
  ) values
    (reader_a, 'institutional_researcher', 'school', 'oa-a', 'institution', null),
    (reader_b, 'institutional_researcher', 'school', 'oa-b', 'institution', null),
    (no_capability, 'registrar', 'school', 'oa-a', 'institution', null),
    (revoked_reader, 'institutional_researcher', 'school', 'oa-a', 'institution', now());

  insert into public.outcome_aggregates (
    tenant_id, cohort_scope, metric, period, value, n, method
  ) values
    ('oa-a', 'oa-a/first-year', 'activation_rate', '2026-fall', 0.8, 10, 'synthetic check'),
    ('oa-b', 'oa-b/first-year', 'activation_rate', '2026-fall', 0.7, 12, 'synthetic check');

  perform pg_temp.invalid(
    'a cohort smaller than ten',
    $q$insert into public.outcome_aggregates
          (tenant_id, cohort_scope, metric, period, value, n, method)
        values
          ('oa-a', 'oa-a/small', 'clarity_score', '2026-fall', 4.5, 9, 'synthetic check')$q$
  );

  perform pg_temp.counted(
    'an authorized reader sees the aggregate at their school — THE CONTROL',
    pg_temp.seen(reader_a, $q$select 1 from public.outcome_aggregates$q$),
    1
  );
  perform pg_temp.counted(
    'an authorized reader cannot see another school aggregate',
    pg_temp.seen(reader_a, $q$select 1 from public.outcome_aggregates where tenant_id = 'oa-b'$q$),
    0
  );
  perform pg_temp.counted(
    'a same-school account without outcomes:read sees no aggregate',
    pg_temp.seen(no_capability, $q$select 1 from public.outcome_aggregates$q$),
    0
  );
  perform pg_temp.counted(
    'a revoked outcomes reader sees no aggregate',
    pg_temp.seen(revoked_reader, $q$select 1 from public.outcome_aggregates$q$),
    0
  );
  perform pg_temp.counted(
    'the other school reader sees only their own aggregate',
    pg_temp.seen(reader_b, $q$select 1 from public.outcome_aggregates$q$),
    1
  );

  perform pg_temp.become_anon();
  perform pg_temp.refused(
    'an anonymous request reading outcome aggregates',
    'select * from public.outcome_aggregates'
  );
  execute 'reset role';

  perform pg_temp.become(reader_a);
  perform pg_temp.refused(
    'an authenticated reader inserting a service-produced aggregate',
    $q$insert into public.outcome_aggregates
          (tenant_id, cohort_scope, metric, period, value, n, method)
        values
          ('oa-a', 'oa-a/second-year', 'clarity_score', '2026-fall', 4.5, 10, 'client write')$q$
  );
  execute 'reset role';

  select count(*) into n from public.outcome_aggregates;
  perform pg_temp.counted('the rejected writes changed nothing', n, 2);
end $$;

rollback;
