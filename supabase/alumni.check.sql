-- Alumni profiles and consents (ADV-001): who records a graduate, who gives a
-- consent, and when the school may ask them about giving.
--
-- LOCAL/DISPOSABLE DATABASES ONLY. Inserts synthetic users and schools, then
-- rolls everything back. Run through `supabase/check.sh alumni`.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  update public.profiles set school_id = school where user_id = who;
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs `statement` as `who`; true when it was refused.
create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;
create or replace function pg_temp.reachable(who uuid, school text)
returns boolean language sql as $$ select private.fundraising_reachable(who, school) $$;

do $$
declare
  staff       uuid;
  other_staff uuid;
  alum        uuid;
  other_alum  uuid;
  teen_grad   uuid;
  student     uuid;
  consent     uuid;
  n           bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('elm-alumni-check', 'Elm Check University', array['elm-check.example']),
    ('ash-alumni-check', 'Ash Check University', array['ash-check.example']);

  staff       := pg_temp.newuser('advancement@elm-check.example', 'elm-alumni-check');
  other_staff := pg_temp.newuser('advancement@ash-check.example', 'ash-alumni-check');
  alum        := pg_temp.newuser('grad@home-check.example', null);
  other_alum  := pg_temp.newuser('grad2@home-check.example', null);
  teen_grad   := pg_temp.newuser('younggrad@home-check.example', null);
  student     := pg_temp.newuser('student@elm-check.example', 'elm-alumni-check');
  update private.account_ages set minor_until = current_date + 200 where user_id = teen_grad;

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff, 'university_staff', 'school', 'elm-alumni-check', 'institution'),
    (other_staff, 'university_staff', 'school', 'ash-alumni-check', 'institution');

  -- ── Who records a graduate ─────────────────────────────────────────────

  perform pg_temp.answered('a person cannot record themselves as an alum',
    pg_temp.refused(alum, format(
      'insert into public.alumni_profiles (user_id, school_id, graduation_term) values (%L, %L, %L)',
      alum, 'elm-alumni-check', '2026-spring')), true);
  perform pg_temp.answered('another school''s staff cannot record this school''s alum',
    pg_temp.refused(other_staff, format(
      'insert into public.alumni_profiles (user_id, school_id, graduation_term) values (%L, %L, %L)',
      alum, 'elm-alumni-check', '2026-spring')), true);
  perform pg_temp.answered('a malformed graduation term is refused',
    pg_temp.refused(staff, format(
      'insert into public.alumni_profiles (user_id, school_id, graduation_term) values (%L, %L, %L)',
      alum, 'elm-alumni-check', 'last spring')), true);

  perform pg_temp.become(staff);
  insert into public.alumni_profiles (user_id, school_id, graduation_term, credential)
  values (alum, 'elm-alumni-check', '2026-spring', 'BA History'),
         (other_alum, 'elm-alumni-check', '2025-fall', 'BS Biology'),
         (teen_grad, 'elm-alumni-check', '2026-spring', 'Certificate');
  reset role;
  select count(*) into n from public.alumni_profiles where recorded_by = staff;
  perform pg_temp.counted('the school''s staff recorded three graduates, stamped as the recorder', n, 3);

  perform pg_temp.become(alum);
  select count(*) into n from public.alumni_profiles;
  reset role;
  perform pg_temp.counted('an alum reads only their own profile', n, 1);

  perform pg_temp.become(other_staff);
  select count(*) into n from public.alumni_profiles;
  reset role;
  perform pg_temp.counted('another school''s staff read none', n, 0);

  perform pg_temp.become(student);
  select count(*) into n from public.alumni_profiles;
  reset role;
  perform pg_temp.counted('a current student reads none', n, 0);

  -- ── Nothing is given for the alum ──────────────────────────────────────

  perform pg_temp.answered('nothing is consented before the alum says so', pg_temp.reachable(alum, 'elm-alumni-check'), false);
  perform pg_temp.answered('staff cannot give a consent on the alum''s behalf',
    pg_temp.refused(staff, format(
      'insert into public.alumni_consents (user_id, school_id, kind, wording_version) values (%L, %L, %L, %L)',
      alum, 'elm-alumni-check', 'fundraising_contact', 'adv-v1')), true);
  perform pg_temp.answered('a consent to a school the person did not graduate from is refused',
    pg_temp.refused(alum, format(
      'insert into public.alumni_consents (user_id, school_id, kind, wording_version) values (%L, %L, %L, %L)',
      alum, 'ash-alumni-check', 'fundraising_contact', 'adv-v1')), true);
  perform pg_temp.answered('a minor cannot consent to fundraising contact',
    pg_temp.refused(teen_grad, format(
      'insert into public.alumni_consents (user_id, school_id, kind, wording_version) values (%L, %L, %L, %L)',
      teen_grad, 'elm-alumni-check', 'fundraising_contact', 'adv-v1')), true);
  perform pg_temp.answered('— though they may take alumni news',
    pg_temp.refused(teen_grad, format(
      'insert into public.alumni_consents (user_id, school_id, kind, wording_version) values (%L, %L, %L, %L)',
      teen_grad, 'elm-alumni-check', 'alumni_communications', 'adv-v1')), false);

  -- ── The alum says yes, then no ─────────────────────────────────────────

  perform pg_temp.become(alum);
  insert into public.alumni_consents (user_id, school_id, kind, wording_version)
  values (alum, 'elm-alumni-check', 'fundraising_contact', 'adv-v1') returning id into consent;
  insert into public.alumni_consents (user_id, school_id, kind, wording_version)
  values (alum, 'elm-alumni-check', 'directory_listing', 'adv-v1');
  reset role;
  perform pg_temp.answered('with a live consent, the school may ask about giving', pg_temp.reachable(alum, 'elm-alumni-check'), true);
  perform pg_temp.answered('another school may not', pg_temp.reachable(alum, 'ash-alumni-check'), false);
  perform pg_temp.answered('a directory listing alone is not fundraising consent', pg_temp.reachable(other_alum, 'elm-alumni-check'), false);

  perform pg_temp.answered('a second live fundraising consent is refused',
    pg_temp.refused(alum, format(
      'insert into public.alumni_consents (user_id, school_id, kind, wording_version) values (%L, %L, %L, %L)',
      alum, 'elm-alumni-check', 'fundraising_contact', 'adv-v2')), true);

  perform pg_temp.become(staff);
  select count(*) into n from public.alumni_consents;
  reset role;
  perform pg_temp.counted('the school''s staff read the consents given to it', n, 3);
  perform pg_temp.become(other_alum);
  select count(*) into n from public.alumni_consents;
  reset role;
  perform pg_temp.counted('another alum reads none of them', n, 0);

  perform pg_temp.answered('staff cannot withdraw a consent for the alum, nor keep one alive',
    pg_temp.refused(staff, format('update public.alumni_consents set withdrawn_at = now() where id = %L', consent)), false);
  select count(*) into n from public.alumni_consents where id = consent and withdrawn_at is null;
  perform pg_temp.counted('— the staff update matched nothing', n, 1);

  perform pg_temp.answered('a consent cannot be edited into a different one',
    pg_temp.refused(alum, format('update public.alumni_consents set kind = %L where id = %L', 'alumni_communications', consent)), true);

  perform pg_temp.become(alum);
  update public.alumni_consents set withdrawn_at = now() where id = consent;
  reset role;
  perform pg_temp.answered('withdrawn, the school may no longer ask, at once', pg_temp.reachable(alum, 'elm-alumni-check'), false);
  perform pg_temp.answered('a withdrawn consent cannot be revived',
    pg_temp.refused(alum, format('update public.alumni_consents set withdrawn_at = null where id = %L', consent)), true);

  perform pg_temp.become(alum);
  insert into public.alumni_consents (user_id, school_id, kind, wording_version)
  values (alum, 'elm-alumni-check', 'fundraising_contact', 'adv-v2');
  reset role;
  perform pg_temp.answered('a new consent, freshly given, counts again', pg_temp.reachable(alum, 'elm-alumni-check'), true);

  -- If the alum later says they are a minor, the school may not ask.
  update private.account_ages set minor_until = current_date + 10 where user_id = alum;
  perform pg_temp.answered('a consent does not reach a minor', pg_temp.reachable(alum, 'elm-alumni-check'), false);
  update private.account_ages set minor_until = null where user_id = alum;

  -- ── History ────────────────────────────────────────────────────────────

  select count(*) into n from public.alumni_consent_history where user_id = alum;
  perform pg_temp.counted('every give and withdraw was written down', n, 4);
  perform pg_temp.become(alum);
  select count(*) into n from public.alumni_consent_history;
  reset role;
  perform pg_temp.counted('the alum reads their own history', n, 4);
  perform pg_temp.become(other_staff);
  select count(*) into n from public.alumni_consent_history;
  reset role;
  perform pg_temp.counted('another school''s staff read none', n, 0);
  perform pg_temp.answered('a client cannot write history',
    pg_temp.refused(alum, format(
      'insert into public.alumni_consent_history (consent_id, user_id, school_id, kind, action, wording_version) values (%L, %L, %L, %L, %L, %L)',
      consent, alum, 'elm-alumni-check', 'fundraising_contact', 'given', 'adv-v1')), true);
  begin
    update public.alumni_consent_history set action = 'given' where user_id = alum;
    raise exception 'FAILED: consent history was rewritten, even by the owner';
  exception when insufficient_privilege then
    raise notice 'ok  consent history cannot be rewritten, even by the owner';
  end;
  begin
    delete from public.alumni_consent_history where user_id = alum;
    raise exception 'FAILED: consent history was deleted, even by the owner';
  exception when insufficient_privilege then
    raise notice 'ok  consent history cannot be deleted, even by the owner';
  end;

  perform pg_temp.answered('a profile cannot be moved to another person',
    pg_temp.refused(staff, format('update public.alumni_profiles set user_id = %L where user_id = %L', other_alum, alum)), true);

  delete from auth.users where id = alum;
  select count(*) into n from public.alumni_consents where user_id = alum;
  perform pg_temp.counted('deleting the alum''s account removes their consents', n, 0);
  select count(*) into n from public.alumni_consent_history where user_id = alum;
  perform pg_temp.counted('— and the history of them', n, 0);
end $$;

rollback;
