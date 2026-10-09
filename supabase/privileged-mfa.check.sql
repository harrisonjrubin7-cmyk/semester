-- Platform administrators and support agents do not carry capabilities until
-- the current JWT proves MFA.  Ordinary grants remain usable at aal1, even
-- when the same person also holds a privileged role.

begin;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.become(
  who uuid,
  assurance text,
  verified_at timestamptz default null
)
returns void language plpgsql as $$
declare methods jsonb;
begin
  methods := case
    when verified_at is null then
      jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())))
    else
      jsonb_build_array(
        jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())),
        jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from verified_at))
      )
  end;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', who::text,
      'role', 'authenticated',
      'aal', assurance,
      'amr', methods
    )::text,
    true
  );
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.answered(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % -- expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  admin uuid := pg_temp.newuser('admin@privileged-mfa.test');
  supporter uuid := pg_temp.newuser('support@privileged-mfa.test');
  moderator uuid := pg_temp.newuser('moderator@privileged-mfa.test');
  got boolean;
begin
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values
    (admin, 'platform_admin', 'platform', '', 'platform'),
    (supporter, 'support_agent', 'platform', '', 'platform'),
    (moderator, 'moderator', 'platform', '', 'platform');

  perform pg_temp.become(admin, 'aal1');
  select private.has_capability('platform:configure') into got;
  perform pg_temp.answered('an aal1 platform_admin grant is dormant', got, false);

  perform pg_temp.become(admin, 'aal2', now() - interval '1 hour');
  select private.has_capability('platform:configure') into got;
  perform pg_temp.answered('an aal2 JWT with stale MFA is still accepted by the role boundary', got, true);

  perform pg_temp.become(admin, 'aal2', now());
  select private.has_capability('platform:configure') into got;
  perform pg_temp.answered('an aal2 platform_admin carries its capability', got, true);

  perform pg_temp.become(supporter, 'aal1');
  select private.support_agent() into got;
  perform pg_temp.answered('an aal1 support_agent cannot enter the support boundary', got, false);

  perform pg_temp.become(supporter, 'aal2', now());
  select private.support_agent() into got;
  perform pg_temp.answered('an aal2 support_agent enters the support boundary', got, true);

  perform pg_temp.become(moderator, 'aal1');
  select private.has_capability('report:read') into got;
  perform pg_temp.answered('ordinary roles do not acquire an MFA requirement', got, true);

  set local role postgres;
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (admin, 'moderator', 'platform', '', 'platform');
  perform pg_temp.become(admin, 'aal1');
  select private.has_capability('report:read') into got;
  perform pg_temp.answered('an ordinary grant remains usable beside a dormant privileged grant', got, true);
end $$;

rollback;
