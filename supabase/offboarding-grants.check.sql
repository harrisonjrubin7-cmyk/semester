-- A person deprovisioned by their school stops holding that school's
-- authority. LOCAL/DISPOSABLE DATABASES ONLY; the transaction is rolled back.
--
-- `has_capability` reads `role_grants`. SCIM deprovisioning sets
-- `institution_membership.status = 'deprovisioned'` and empties its `roles`,
-- and before 20260930210000_deprovision_revokes_grants.sql nothing connected
-- the two: a staff member removed by the school's identity provider kept every
-- school-scoped capability until a grant happened to expire.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.can(who uuid, cap text, tenant text)
returns text language plpgsql as $$
declare r boolean;
begin
  perform pg_temp.become(who);
  select private.has_capability(cap, 'school', tenant) into r;
  reset role;
  return r::text;
end $$;

do $$
declare
  staff uuid; other uuid;
  m_north uuid := gen_random_uuid();
  m_cedar uuid := gen_random_uuid();
  m_other uuid := gen_random_uuid();
  revoked_at_north timestamptz;
  audit_rows bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-offboard', 'North Offboard University', array['north-offboard.example']),
    ('cedar-offboard', 'Cedar Offboard College', array['cedar-offboard.example']);

  staff := pg_temp.newuser('staff@north-offboard.example', 'north-offboard');
  other := pg_temp.newuser('other@north-offboard.example', 'north-offboard');

  -- The same person holds school authority at two schools, and another person
  -- holds it at the first. Deprovisioning must end exactly one of the three.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff, 'university_admin', 'school', 'north-offboard', 'institution'),
    (staff, 'university_admin', 'school', 'cedar-offboard', 'institution'),
    (other, 'university_admin', 'school', 'north-offboard', 'institution');

  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles)
  values (m_north, 'north-offboard', staff, 'active', array['admin']),
         (m_cedar, 'cedar-offboard', staff, 'active', array['admin']),
         (m_other, 'north-offboard', other, 'active', array['admin']);

  perform pg_temp.answered('THE CONTROL: staff may configure north while active', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'true');
  perform pg_temp.answered('THE CONTROL: and cedar', pg_temp.can(staff, 'tenant:configure', 'cedar-offboard'), 'true');

  -- A suspension is not a termination: nothing is revoked, so a person put on
  -- leave and brought back keeps their grants.
  update public.institution_membership set status = 'suspended' where id = m_north;
  perform pg_temp.answered('suspended: the grant is untouched', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'true');
  update public.institution_membership set status = 'active' where id = m_north;

  -- Deprovisioned by north's identity provider.
  update public.institution_membership
     set status = 'deprovisioned', roles = '{}', deprovisioned_at = now()
   where id = m_north;

  perform pg_temp.answered('deprovisioned at north: north authority ends', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'false');
  perform pg_temp.answered('cross-tenant: the same person keeps cedar', pg_temp.can(staff, 'tenant:configure', 'cedar-offboard'), 'true');
  perform pg_temp.answered('cross-person: the other north administrator is untouched', pg_temp.can(other, 'tenant:configure', 'north-offboard'), 'true');

  select revoked_at into revoked_at_north from public.role_grants
   where subject = staff and scope_id = 'north-offboard';
  perform pg_temp.answered('the grant is revoked, not deleted', (revoked_at_north is not null)::text, 'true');

  select count(*) into audit_rows from public.role_grant_audit_event
   where tenant_id = 'north-offboard' and action = 'update' and revoked_at is not null;
  perform pg_temp.answered('the revocation left audit evidence', (audit_rows > 0)::text, 'true');

  -- Reactivation is a new decision. It restores the membership, not the authority.
  update public.institution_membership
     set status = 'active', deprovisioned_at = null where id = m_north;
  perform pg_temp.answered('reactivated: authority is not silently restored', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'false');

  -- Backfill: a membership deprovisioned before the trigger existed, whose
  -- person still holds a live grant, is repaired by re-applying the migration;
  -- a second application changes nothing.
  update public.role_grants set revoked_at = null where subject = staff and scope_id = 'north-offboard';
  alter table public.institution_membership disable trigger revoke_grants_on_deprovision;
  update public.institution_membership set status = 'deprovisioned', roles = '{}', deprovisioned_at = now() where id = m_north;
  alter table public.institution_membership enable trigger revoke_grants_on_deprovision;
  perform pg_temp.answered('before the backfill: a stale live grant exists', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'true');
  raise notice 'offboarding-grants: applying the migration again';
end $$;

\ir migrations/20260930210000_deprovision_revokes_grants.sql

do $$
declare
  staff uuid := (select id from auth.users where email = 'staff@north-offboard.example');
  live_before bigint;
begin
  perform pg_temp.answered('after the backfill: north authority is gone', pg_temp.can(staff, 'tenant:configure', 'north-offboard'), 'false');
  perform pg_temp.answered('after the backfill: cedar is untouched', pg_temp.can(staff, 'tenant:configure', 'cedar-offboard'), 'true');
  select count(*) into live_before from public.role_grants g
    join public.institution_membership m on m.auth_user_id = g.subject and m.tenant_id = g.scope_id
   where m.status = 'deprovisioned' and g.scope_kind = 'school' and g.revoked_at is null;
  perform pg_temp.answered('no deprovisioned member holds a live school grant', live_before::text, '0');
  raise notice 'offboarding-grants: all checks passed';
end $$;

rollback;
