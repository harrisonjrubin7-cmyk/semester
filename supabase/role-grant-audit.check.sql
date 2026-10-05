-- Role changes must be append-only, metadata-minimized and tenant-isolated.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', who::text, 'role', 'authenticated'
  )::text, true);
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
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  north_admin uuid;
  north_student uuid;
  cedar_admin uuid;
  cedar_student uuid;
  north_grant uuid;
  audit_id uuid;
  n bigint;
  hashed text;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-audit', 'North Audit University', array['north-audit.example']),
    ('cedar-audit', 'Cedar Audit College', array['cedar-audit.example']);

  north_admin := pg_temp.newuser('admin@north-audit.example', 'north-audit');
  north_student := pg_temp.newuser('student@north-audit.example', 'north-audit');
  cedar_admin := pg_temp.newuser('admin@cedar-audit.example', 'cedar-audit');
  cedar_student := pg_temp.newuser('student@cedar-audit.example', 'cedar-audit');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (north_admin, 'university_admin', 'school', 'north-audit', 'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (cedar_admin, 'university_admin', 'school', 'cedar-audit', 'institution');
  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, expires_at)
  values
    (north_student, 'student', 'school', 'north-audit', 'institution', now() + interval '180 days')
  returning id into north_grant;
  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, expires_at)
  values
    (cedar_student, 'student', 'school', 'cedar-audit', 'institution', now() + interval '180 days');

  update public.role_grants set revoked_at = now() where id = north_grant;

  perform pg_temp.become(north_admin);
  select count(*) into n from public.role_grant_audit_event;
  reset role;
  perform pg_temp.counted('a tenant auditor sees only their tenant role events', n, 3);

  perform pg_temp.become(cedar_admin);
  select count(*) into n from public.role_grant_audit_event where tenant_id = 'north-audit';
  reset role;
  perform pg_temp.counted('another tenant cannot read Northstar role events', n, 0);

  perform pg_temp.become(north_student);
  select count(*) into n from public.role_grant_audit_event;
  reset role;
  perform pg_temp.counted('a student cannot read role audit events', n, 0);

  select id, subject_sha256 into audit_id, hashed
    from public.role_grant_audit_event where grant_id = north_grant and action = 'insert';
  if length(hashed) <> 64 or hashed = north_student::text then
    raise exception 'FAILED: the audit event retained a raw or invalid subject identifier';
  end if;
  raise notice 'ok  account identifiers are pseudonymized in role audit events';

  select count(*) into n from public.role_grant_audit_event
   where grant_id = north_grant and action = 'update' and revoked_at is not null
     and actor_kind = 'service';
  perform pg_temp.counted('a revocation records its final state and service origin', n, 1);

  begin
    update public.role_grant_audit_event set role = 'faculty' where id = audit_id;
    raise exception 'FAILED: a role audit event was changed';
  exception when others then
    if sqlerrm = 'FAILED: a role audit event was changed' then raise; end if;
  end;
  raise notice 'ok  role audit events are immutable even to the table owner';

  begin
    delete from public.role_grant_audit_event where id = audit_id;
    raise exception 'FAILED: a role audit event was deleted';
  exception when others then
    if sqlerrm = 'FAILED: a role audit event was deleted' then raise; end if;
  end;
  raise notice 'ok  role audit events cannot be deleted';
end $$;

rollback;

