-- Legal holds (RM-02, RM-05): who may place one and over what, that it is
-- released only by someone else with a reason, that it is never deleted or
-- edited, that a held account cannot be deleted, and that each retention sweep
-- stops for a live hold and runs again when it is released. Every refusal is
-- attempted as the account that should be refused, and every "stops for a
-- hold" is paired with the same sweep removing the unheld twin, because a
-- sweep that deletes nothing passes a check that only looks for survivors.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh legal-holds

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

-- An account that was never finished and is old enough for the sweep.
create or replace function pg_temp.abandoned(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address,
          now() - interval '40 days', now() - interval '40 days');
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

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

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
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

-- Rows an UPDATE changed as someone. Row-level security hides rows from an
-- UPDATE rather than raising, so a refusal there reads as zero, not an error.
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
  if got is not null then raise exception 'FAILED: % — refused: %', what, got; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

do $$
declare
  a uuid; b uuid; far_admin uuid; student uuid; far_student uuid; platform uuid;
  hold_id uuid; tenant_hold uuid; platform_hold uuid;
  said jsonb;
  h text := repeat('a', 64);
  v1 uuid; v2 uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('lh-u',     'Hold University', array['lh-u.example']),
    ('lh-other', 'Other University', array['lh-other.example']);

  a          := pg_temp.newuser('a@lh-u.example', 'lh-u');
  b          := pg_temp.newuser('b@lh-u.example', 'lh-u');
  far_admin  := pg_temp.newuser('admin@lh-other.example', 'lh-other');
  student    := pg_temp.newuser('student@lh-u.example', 'lh-u');
  far_student := pg_temp.newuser('student@lh-other.example', 'lh-other');
  platform   := pg_temp.newuser('root@lh-u.example', 'lh-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (a,         'university_admin', 'school',   'lh-u',     'institution'),
    (b,         'university_admin', 'school',   'lh-u',     'institution'),
    (far_admin, 'university_admin', 'school',   'lh-other', 'institution'),
    (student,   'student',          'school',   'lh-u',     'institution'),
    (platform,  'platform_admin',   'platform', '',         'platform');

  -- ── placing ────────────────────────────────────────────────────────────
  hold_id := pg_temp.value_as(a, format(
    $q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
       values ('account', %L, 'lh-u', 'Preserve pending the registrar''s inquiry.', 'MATTER-101') returning id$q$, student))::uuid;
  perform pg_temp.must('a school administrator places a hold over an account in their school', hold_id is not null);

  perform pg_temp.must('the hold records who placed it, whatever the client sent',
    (select placed_by = a from public.legal_holds where id = hold_id));

  perform pg_temp.says('an administrator cannot place a hold over another school''s account',
    pg_temp.error_as(a, format($q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('account', %L, 'lh-u', 'Wrong school.', 'M-2')$q$, far_student)), 'row-level security');
  perform pg_temp.says('an administrator at another school cannot place a hold over this school''s account',
    pg_temp.error_as(far_admin, format($q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('account', %L, 'lh-u', 'Not theirs.', 'M-3')$q$, student)), 'row-level security');
  perform pg_temp.says('a student cannot place a hold',
    pg_temp.error_as(student, format($q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('account', %L, 'lh-u', 'On myself.', 'M-4')$q$, student)), 'row-level security');
  perform pg_temp.says('a school administrator cannot place a platform hold',
    pg_temp.error_as(a, $q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('platform', '', null, 'Everything.', 'M-5')$q$), 'row-level security');
  perform pg_temp.says('a hold needs a reason',
    pg_temp.error_as(a, format($q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('account', %L, 'lh-u', '   ', 'M-6')$q$, student)), 'check constraint');
  perform pg_temp.says('a hold needs a matter reference',
    pg_temp.error_as(a, format($q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('account', %L, 'lh-u', 'A reason.', '')$q$, student)), 'check constraint');

  -- ── reading ────────────────────────────────────────────────────────────
  perform pg_temp.must('a second administrator at the school sees the hold',
    pg_temp.seen(b, 'select 1 from public.legal_holds') = 1);
  perform pg_temp.must('the held student cannot see that a hold exists',
    pg_temp.seen(student, 'select 1 from public.legal_holds') = 0);
  perform pg_temp.must('an administrator at another school does not see it',
    pg_temp.seen(far_admin, 'select 1 from public.legal_holds') = 0);

  -- ── the record is never deleted or edited ──────────────────────────────
  perform pg_temp.says('a hold cannot be deleted by the administrator who placed it',
    pg_temp.error_as(a, format('delete from public.legal_holds where id = %L', hold_id)), 'permission denied');
  perform pg_temp.says('a hold cannot be edited: the reason is not a column anyone may update',
    pg_temp.error_as(a, format($q$update public.legal_holds set reason = 'Changed my mind' where id = %L$q$, hold_id)), 'permission denied');
  begin
    delete from public.legal_holds where id = hold_id;
    raise exception 'FAILED: the table owner deleted a hold';
  exception when sqlstate '42501' then
    raise notice 'ok  the owner cannot delete a hold either';
  end;

  -- ── a held account cannot be deleted ───────────────────────────────────
  begin
    delete from auth.users where id = student;
    raise exception 'FAILED: a held account was deleted';
  exception when sqlstate '55006' then
    raise notice 'ok  an account under a live hold cannot be deleted from auth.users (which is where erasure goes)';
  end;

  -- ── releasing: a different person, with a reason ───────────────────────
  perform pg_temp.says('the person who placed a hold cannot release it',
    pg_temp.error_as(a, format($q$update public.legal_holds set release_reason = 'Done.' where id = %L$q$, hold_id)), 'check constraint');
  perform pg_temp.must('an administrator at another school cannot release it: the row is not theirs to change',
    pg_temp.touched(far_admin, format($q$update public.legal_holds set release_reason = 'Done.' where id = %L$q$, hold_id)) = 0);
  perform pg_temp.must('and it is still live after those refusals',
    (select released_at is null from public.legal_holds where id = hold_id));

  perform pg_temp.says('a release needs a reason',
    pg_temp.error_as(b, format($q$update public.legal_holds set release_reason = '' where id = %L$q$, hold_id)), 'check constraint');
  perform pg_temp.runs_clean('a second administrator releases it with a reason',
    pg_temp.error_as(b, format($q$update public.legal_holds set release_reason = 'Inquiry closed 30 September.' where id = %L$q$, hold_id)));
  perform pg_temp.must('the release records who and when, not what the client sent',
    (select released_by = b and released_at is not null and release_reason is not null from public.legal_holds where id = hold_id));
  perform pg_temp.must('a hold cannot be released twice: a released hold is no longer a row anyone may update',
    pg_temp.touched(b, format($q$update public.legal_holds set release_reason = 'Again.' where id = %L$q$, hold_id)) = 0);

  -- The held account can be deleted once the hold is released.
  delete from auth.users where id = far_student;
  perform pg_temp.must('an account with no live hold is deleted as before',
    not exists (select 1 from auth.users where id = far_student));

  -- ── the abandoned-sign-up sweep ────────────────────────────────────────
  v1 := pg_temp.abandoned('held.abandoned@lh-u.example', 'lh-u');
  v2 := pg_temp.abandoned('free.abandoned@lh-u.example', 'lh-u');
  hold_id := pg_temp.value_as(a, format(
    $q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
       values ('account', %L, 'lh-u', 'Preserve.', 'MATTER-102') returning id$q$, v1))::uuid;

  said := private.sweep_abandoned_signups();
  perform pg_temp.must('the sweep removes the unheld abandoned account', not exists (select 1 from auth.users where id = v2));
  perform pg_temp.must('and keeps the held one', exists (select 1 from auth.users where id = v1));
  perform pg_temp.must('and does not count the held one as refused', (said ->> 'refused')::int = 0);

  perform pg_temp.runs_clean('the hold is released', pg_temp.error_as(b, format(
    $q$update public.legal_holds set release_reason = 'Closed.' where id = %L$q$, hold_id)));
  said := private.sweep_abandoned_signups();
  perform pg_temp.must('once released, the next sweep removes it', not exists (select 1 from auth.users where id = v1));

  -- ── a tenant hold covers the accounts in that school ───────────────────
  v1 := pg_temp.abandoned('tenant.held@lh-u.example', 'lh-u');
  tenant_hold := pg_temp.value_as(a, $q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
       values ('tenant', 'lh-u', 'lh-u', 'The whole school is under preservation.', 'MATTER-200') returning id$q$)::uuid;
  perform private.sweep_abandoned_signups();
  perform pg_temp.must('a school hold keeps that school''s abandoned accounts', exists (select 1 from auth.users where id = v1));

  -- ── the audit sweep ────────────────────────────────────────────────────
  insert into public.role_grant_audit_event
    (tenant_id, grant_id, action, role, scope_kind, scope_id, provenance, subject_sha256, actor_kind, occurred_at) values
    ('lh-u',     gen_random_uuid(), 'insert', 'student', 'school', 'lh-u',     'manual', h, 'service', now() - interval '3 years 1 day'),
    ('lh-other', gen_random_uuid(), 'insert', 'student', 'school', 'lh-other', 'manual', h, 'service', now() - interval '3 years 1 day');
  insert into public.provisioning_audit_event
    (tenant_id, request_id, resource_type, action, outcome, occurred_at) values
    ('lh-u',     'held-req',  'User', 'create', 'accepted', now() - interval '3 years 1 day'),
    ('lh-other', 'free-req',  'User', 'create', 'accepted', now() - interval '3 years 1 day');
  insert into public.moderation_audit_event
    (report_id, from_status, to_status, reporter_sha256, actor_kind, occurred_at) values
    (gen_random_uuid(), 'open', 'closed', h, 'service', now() - interval '3 years 1 day');
  insert into public.audit_event (tenant_id, action, object_kind, outcome, actor_kind, occurred_at) values
    ('lh-u',     'share.create', 'plan', 'allowed', 'service', now() - interval '3 years 1 day'),
    ('lh-other', 'share.create', 'plan', 'allowed', 'service', now() - interval '3 years 1 day'),
    (null,       'auth.sign_in', 'session', 'allowed', 'service', now() - interval '3 years 1 day');

  said := private.sweep_audit_retention();
  perform pg_temp.must('a school hold keeps that school''s old common audit event, and the other school''s and the platform-level one go',
    (select count(*) from public.audit_event where tenant_id = 'lh-u' and occurred_at < now() - interval '3 years') = 1
    and (select count(*) from public.audit_event where tenant_id = 'lh-other' and occurred_at < now() - interval '3 years') = 0
    and (select count(*) from public.audit_event where tenant_id is null and occurred_at < now() - interval '3 years') = 0);
  perform pg_temp.must('a school hold keeps that school''s old role-grant event and removes the other school''s',
    (select count(*) from public.role_grant_audit_event where tenant_id = 'lh-u' and occurred_at < now() - interval '3 years') = 1
    and (select count(*) from public.role_grant_audit_event where tenant_id = 'lh-other' and occurred_at < now() - interval '3 years') = 0);
  perform pg_temp.must('and the same for provisioning events',
    exists (select 1 from public.provisioning_audit_event where request_id = 'held-req')
    and not exists (select 1 from public.provisioning_audit_event where request_id = 'free-req'));
  perform pg_temp.must('a school hold does not stop the moderation sweep, which has no school',
    (said ->> 'moderation_audit_event')::int = 1);

  -- A platform hold pauses all three, and only an operator places one.
  perform pg_temp.says('not even a platform administrator places a platform hold through the API',
    pg_temp.error_as(platform, $q$insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref)
      values ('platform', '', null, 'Preserve everything.', 'MATTER-300')$q$), 'row-level security');
  -- The operator, as service_role, names both people. A service_role request
  -- carries no user, so the claims the impersonations above left are cleared.
  perform set_config('request.jwt.claims', '', true);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('platform', '', null, 'Preserve everything.', 'MATTER-300', platform) returning id into platform_hold;
  perform pg_temp.must('an operator places a platform hold', platform_hold is not null);
  insert into public.moderation_audit_event
    (report_id, from_status, to_status, reporter_sha256, actor_kind, occurred_at) values
    (gen_random_uuid(), 'open', 'closed', h, 'service', now() - interval '3 years 1 day');
  insert into public.invites (email, invited_at) values ('platform.held@lh-u.example', now() - interval '91 days');
  insert into public.audit_event (tenant_id, action, object_kind, outcome, actor_kind, occurred_at) values
    ('lh-other', 'share.create', 'plan', 'allowed', 'service', now() - interval '3 years 2 days');
  said := private.sweep_audit_retention();
  perform pg_temp.must('and the platform hold keeps a common audit event no school hold covers',
    exists (select 1 from public.audit_event where tenant_id = 'lh-other' and occurred_at < now() - interval '3 years'));
  perform pg_temp.must('a platform hold pauses the audit sweep entirely',
    said = jsonb_build_object('role_grant_audit_event', 0, 'moderation_audit_event', 0, 'provisioning_audit_event', 0, 'audit_event', 0));
  perform private.sweep_stale_invites();
  perform pg_temp.must('and the invite sweep', exists (select 1 from public.invites where email = 'platform.held@lh-u.example'));

  perform pg_temp.must('a school administrator cannot release a platform hold',
    pg_temp.touched(b, format($q$update public.legal_holds set release_reason = 'No.' where id = %L$q$, platform_hold)) = 0);
  perform pg_temp.must('and the platform hold is still live', (select released_at is null from public.legal_holds where id = platform_hold));

  -- The operator cannot release their own platform hold either.
  perform set_config('request.jwt.claims', '', true);
  begin
    update public.legal_holds set released_by = platform, release_reason = 'Mine.' where id = platform_hold;
    raise exception 'FAILED: the person who placed a platform hold released it';
  exception when check_violation then
    raise notice 'ok  the person who placed a platform hold cannot release it, operator or not';
  end;
  update public.legal_holds set released_by = a, release_reason = 'Matter closed.' where id = platform_hold;
  said := private.sweep_audit_retention();
  perform pg_temp.must('once the platform hold is released the audit sweep runs again',
    (said ->> 'moderation_audit_event')::int >= 1);
  perform private.sweep_stale_invites();
  perform pg_temp.must('and so does the invite sweep', not exists (select 1 from public.invites where email = 'platform.held@lh-u.example'));

  -- ── student erasure: refused before it touches anything, then resumes ───
  -- erase_account clears the account's own rows itself and only then does the
  -- edge function delete the auth user, so a hold has to be read at the top of
  -- erase_account, not left to the auth.users trigger that fires last.
  declare
    erasee uuid := pg_temp.newuser('erasee@lh-u.example', 'lh-u');
    erase_hold uuid;
    survived boolean;
  begin
    perform set_config('request.jwt.claims', '', true);
    insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
      values ('account', erasee::text, 'lh-u', 'Preserve pending inquiry.', 'MATTER-400', platform) returning id into erase_hold;
    begin
      perform public.erase_account(erasee);
      raise exception 'FAILED: erase_account ran for an account under a legal hold';
    exception when sqlstate '55006' then
      raise notice 'ok  erase_account refuses an account under a legal hold';
    end;
    select exists (select 1 from public.profiles where user_id = erasee) into survived;
    perform pg_temp.must('and it refused before touching anything: the account''s profile is still there', survived);
    update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Inquiry closed.' where id = erase_hold;
    -- The account's own hold is released, but the school hold from the sweep
    -- checks above still covers everyone in that school, so erasure still waits.
    begin
      perform public.erase_account(erasee);
      raise exception 'FAILED: erase_account ran for an account in a school under a legal hold';
    exception when sqlstate '55006' then
      raise notice 'ok  a school-wide hold blocks erasure of the accounts in that school too';
    end;
    update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'School released.' where id = tenant_hold;
    perform public.erase_account(erasee);
    perform pg_temp.must('once released, erase_account runs and the profile is erased',
      not exists (select 1 from public.profiles where user_id = erasee));
  end;

  -- The original body is reachable only through the wrapper: not even the
  -- service role may call it and walk around the hold.
  begin
    set local role service_role;
    perform private.erase_account_unheld(gen_random_uuid());
    reset role;
    raise exception 'FAILED: the service role called the unwrapped erase directly';
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  the unwrapped erase is not callable, even by the service role';
  end;

  perform pg_temp.says('a signed-in account cannot call erase_account, held or not',
    pg_temp.error_as(a, format('select public.erase_account(%L)', student)), 'permission denied');

  -- ── nobody reaches the helpers from the API ────────────────────────────
  perform pg_temp.says('a signed-in account cannot ask whether an account is held',
    pg_temp.error_as(a, format('select private.account_is_held(%L)', student)), 'permission denied');
end $$;

rollback;
