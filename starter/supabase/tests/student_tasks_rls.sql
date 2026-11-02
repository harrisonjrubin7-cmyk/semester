\set ON_ERROR_STOP on
\pset pager off
begin;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok - %', label;
end $$;

\o /dev/null
-- Seed as the superuser that runs this file.
insert into public.tenants (id, slug, name) values
  ('00000000-0000-0000-0000-00000000000a', 'a', 'Tenant A'),
  ('00000000-0000-0000-0000-00000000000b', 'b', 'Tenant B');
insert into public.accounts (id, primary_email) values
  ('00000000-0000-0000-0000-000000000001', 'u1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'u2@test.local');
insert into public.memberships (tenant_id, account_id, role_key) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'student'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'student'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', 'student');
insert into public.student_tasks (id, tenant_id, owner_account_id, title) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'u1 A task'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'u2 A task'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', 'u1 B task');

\o
-- Session resolution: valid token resolves, expired token does not.
insert into public.sessions (token_hash, account_id, tenant_id, membership_id, expires_at)
select encode(digest('good-token', 'sha256'), 'hex'), '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-00000000000a', m.id, now() + interval '1 hour'
  from public.memberships m
 where m.account_id = '00000000-0000-0000-0000-000000000001'
   and m.tenant_id = '00000000-0000-0000-0000-00000000000a';
insert into public.sessions (token_hash, account_id, tenant_id, expires_at)
values (encode(digest('expired-token', 'sha256'), 'hex'), '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000a', now() - interval '1 minute');

select pg_temp.check(
  (select count(*) from public.resolve_session(encode(digest('good-token', 'sha256'), 'hex'))) = 1,
  'valid session token resolves');
select pg_temp.check(
  (select count(*) from public.resolve_session(encode(digest('expired-token', 'sha256'), 'hex'))) = 0,
  'expired session token does not resolve');
select pg_temp.check(
  (select count(*) from public.resolve_session(encode(digest('unknown', 'sha256'), 'hex'))) = 0,
  'unknown session token does not resolve');

\o /dev/null
-- Switch to the RLS subject role and bind context per check.
create function pg_temp.bind(acc uuid, ten uuid) returns void language plpgsql as $$
begin
  perform set_config('app.current_account_id', coalesce(acc::text, ''), false);
  perform set_config('app.current_tenant_id', coalesce(ten::text, ''), false);
end $$;

set role semester_app;
select pg_temp.bind('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');

select pg_temp.check((select count(*) from public.student_tasks) = 1,
  'u1 in tenant A sees only own tenant-A task');
select pg_temp.check((select title from public.student_tasks) = 'u1 A task',
  'u1 in tenant A sees the expected row');

select pg_temp.bind('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.student_tasks) = 1,
  'u2 in tenant A sees only own task, not u1');

select pg_temp.bind('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.student_tasks) = 1,
  'u1 in tenant B sees only tenant-B task, not tenant-A tasks');

select pg_temp.bind(null, null);
select pg_temp.check((select count(*) from public.student_tasks) = 0,
  'empty context sees no rows and raises no cast error');

select pg_temp.bind('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');

do $$
declare caught boolean := false; affected int;
begin
  begin
    insert into public.student_tasks (tenant_id, owner_account_id, title)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'forged');
  exception when insufficient_privilege then caught := true;
  end;
  perform pg_temp.check(caught, 'insert on behalf of another owner is rejected');

  caught := false;
  begin
    insert into public.student_tasks (tenant_id, owner_account_id, title)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', 'cross-tenant');
  exception when insufficient_privilege then caught := true;
  end;
  perform pg_temp.check(caught, 'insert into a foreign tenant is rejected');

  update public.student_tasks set title = 'hijack'
   where id = '00000000-0000-0000-0000-000000000102';
  get diagnostics affected = row_count;
  perform pg_temp.check(affected = 0, 'update of another owner row affects 0 rows');

  delete from public.student_tasks where id = '00000000-0000-0000-0000-000000000102';
  get diagnostics affected = row_count;
  perform pg_temp.check(affected = 0, 'delete of another owner row affects 0 rows');

  caught := false;
  begin
    update public.student_tasks set tenant_id = '00000000-0000-0000-0000-00000000000b'
     where id = '00000000-0000-0000-0000-000000000101';
  exception when insufficient_privilege then caught := true;
  end;
  perform pg_temp.check(caught, 'moving own task into a foreign tenant is rejected');
end $$;

\o
reset role;
select pg_temp.check((select title from public.student_tasks where id = '00000000-0000-0000-0000-000000000102') = 'u2 A task',
  'other owner row is unchanged after denied writes');
do $$ begin raise notice 'ALL STUDENT_TASKS RLS CHECKS PASSED'; end $$;
rollback;
