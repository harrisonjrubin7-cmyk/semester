-- Advisor Meeting Mode shares (Phase G, D-016): who can share with whom,
-- who can read, and that expiry and revocation stop reading. Every refusal
-- is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh advisor

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

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  -- A statement that ran but touched no row was refused by RLS.
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
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

create or replace function pg_temp.share_error(who uuid, email text, expires interval, body jsonb)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  perform public.share_with_advisor(email, 'Spring planning', body, now() + expires);
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

do $$
declare
  student uuid; classmate uuid; advisor uuid; other_advisor uuid; faculty uuid;
  lapsed uuid; self_advisor uuid; share uuid; old uuid; miss text;
  body jsonb := '{"sharedAs":"Sam","agenda":["Spring courses"]}'::jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('adv-u', 'Advisor University', array['adv-u.example']),
    ('adv-other', 'Other University', array['adv-other.example']);

  student       := pg_temp.newuser('student@adv-u.example', 'adv-u');
  classmate     := pg_temp.newuser('classmate@adv-u.example', 'adv-u');
  advisor       := pg_temp.newuser('advisor@adv-u.example', 'adv-u');
  other_advisor := pg_temp.newuser('advisor@adv-other.example', 'adv-other');
  faculty       := pg_temp.newuser('prof@adv-u.example', 'adv-u');
  lapsed        := pg_temp.newuser('lapsed@adv-u.example', 'adv-u');
  self_advisor  := pg_temp.newuser('both@adv-u.example', 'adv-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (advisor,       'academic_advisor', 'school', 'adv-u',     'institution'),
    (other_advisor, 'academic_advisor', 'school', 'adv-other', 'institution'),
    (faculty,       'faculty',          'school', 'adv-u',     'institution'),
    (self_advisor,  'academic_advisor', 'school', 'adv-u',     'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (lapsed,        'academic_advisor', 'school', 'adv-u',     'institution', now());

  -- ── who a student may share with ────────────────────────────────────────
  perform pg_temp.counted('a student shares with an advisor at their school (address in any case)',
    (pg_temp.share_error(student, 'Advisor@ADV-U.example', interval '30 days', body) is null)::int, 1);
  miss := pg_temp.share_error(student, 'nobody@adv-u.example', interval '30 days', body);
  perform pg_temp.counted('an unknown address is refused', (miss is not null)::int, 1);
  perform pg_temp.counted('a classmate reads the same as an unknown address',
    (pg_temp.share_error(student, 'classmate@adv-u.example', interval '30 days', body) = miss)::int, 1);
  perform pg_temp.counted('faculty who are not advisors read the same',
    (pg_temp.share_error(student, 'prof@adv-u.example', interval '30 days', body) = miss)::int, 1);
  perform pg_temp.counted('an advisor at another school reads the same',
    (pg_temp.share_error(student, 'advisor@adv-other.example', interval '30 days', body) = miss)::int, 1);
  perform pg_temp.counted('an advisor whose grant was revoked reads the same',
    (pg_temp.share_error(student, 'lapsed@adv-u.example', interval '30 days', body) = miss)::int, 1);
  perform pg_temp.counted('an advisor cannot share with themselves',
    (pg_temp.share_error(self_advisor, 'both@adv-u.example', interval '30 days', body) is not null)::int, 1);
  perform pg_temp.counted('an expiry past 120 days is refused',
    (pg_temp.share_error(student, 'advisor@adv-u.example', interval '121 days', body) is not null)::int, 1);
  perform pg_temp.counted('an expiry in the past is refused',
    (pg_temp.share_error(student, 'advisor@adv-u.example', interval '-1 day', body) is not null)::int, 1);
  perform pg_temp.counted('a payload over 32 KB is refused',
    (pg_temp.share_error(student, 'advisor@adv-u.example', interval '30 days',
      jsonb_build_object('agenda', repeat('x', 33000))) is not null)::int, 1);
  perform pg_temp.counted('a payload that is not an object is refused',
    (pg_temp.share_error(student, 'advisor@adv-u.example', interval '30 days', '[1,2]'::jsonb) is not null)::int, 1);
  perform pg_temp.expect_refused('a student inserts a share directly', student,
    format($q$insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
             values (%L, %L, 'adv-u', 'x', '{}', now() + interval '1 day')$q$, student, advisor));

  select id into share from public.advisor_shares where student_id = student;
  perform pg_temp.counted('exactly one share was made', (select count(*) from public.advisor_shares), 1);

  -- ── who can read it ──────────────────────────────────────────────────────
  perform pg_temp.counted('the student sees their share', pg_temp.seen(student, 'select * from public.advisor_shares'), 1);
  perform pg_temp.counted('the advisor cannot read the table directly', pg_temp.seen(advisor, 'select * from public.advisor_shares'), 0);
  perform pg_temp.counted('a classmate cannot read the table', pg_temp.seen(classmate, 'select * from public.advisor_shares'), 0);
  perform pg_temp.counted('the advisor lists it', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 1);
  perform pg_temp.counted('another advisor lists nothing', pg_temp.seen(other_advisor, 'select * from public.list_advisor_shares()'), 0);
  perform pg_temp.counted('listing logs no read', (select count(*) from public.advisor_share_events), 0);
  perform pg_temp.counted('the advisor reads exactly what was shared',
    pg_temp.seen(advisor, format($q$select * from public.read_advisor_share(%L) where payload->>'sharedAs' = 'Sam'$q$, share)), 1);
  perform pg_temp.counted('the read is logged',
    (select count(*) from public.advisor_share_events where share_id = share and reader_id = advisor), 1);
  perform pg_temp.counted('the student sees the read', pg_temp.seen(student, 'select * from public.advisor_share_events'), 1);
  perform pg_temp.counted('the advisor cannot read the log', pg_temp.seen(advisor, 'select * from public.advisor_share_events'), 0);
  perform pg_temp.expect_refused('another advisor reads it', other_advisor, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.expect_refused('a classmate reads it', classmate, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.expect_refused('the student reads it as if an advisor', student, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.counted('refused reads are not logged', (select count(*) from public.advisor_share_events), 1);

  -- ── who can change it ────────────────────────────────────────────────────
  perform pg_temp.expect_refused('the advisor revokes it', advisor,
    format($q$update public.advisor_shares set revoked_at = now() where id = %L$q$, share));
  perform pg_temp.expect_refused('a classmate revokes it', classmate,
    format($q$update public.advisor_shares set revoked_at = now() where id = %L$q$, share));
  perform pg_temp.expect_refused('the student edits the payload', student,
    format($q$update public.advisor_shares set payload = '{"x":1}' where id = %L$q$, share));
  perform pg_temp.expect_refused('the student extends the expiry', student,
    format($q$update public.advisor_shares set expires_at = now() + interval '119 days' where id = %L$q$, share));
  perform pg_temp.expect_refused('the advisor deletes it', advisor, format('delete from public.advisor_shares where id = %L', share));

  -- ── the advisor's own role, at every read ────────────────────────────────
  -- The share is live here. The school revoking the advisor's grant, or the
  -- grant expiring, ends their access at once, not when the share expires.
  update public.role_grants set revoked_at = now() where subject = advisor and role = 'academic_advisor';
  perform pg_temp.expect_refused('an advisor whose role was revoked cannot open a live share', advisor, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.counted('nor list it', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 0);
  update public.role_grants set revoked_at = null, expires_at = now() - interval '1 second' where subject = advisor and role = 'academic_advisor';
  perform pg_temp.expect_refused('nor one whose role expired', advisor, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.counted('and it is not listed then either', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 0);
  update public.role_grants set expires_at = null where subject = advisor and role = 'academic_advisor';
  perform pg_temp.counted('with the role restored, it lists again (the control)', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 1);

  -- ── revocation ────────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('the student revokes it', student,
    format($q$update public.advisor_shares set revoked_at = now() where id = %L$q$, share));
  perform pg_temp.expect_refused('the advisor reads after revocation', advisor, format('select * from public.read_advisor_share(%L)', share));
  perform pg_temp.counted('a revoked share is not listed', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 0);
  perform pg_temp.expect_refused('the student un-revokes it', student,
    format($q$update public.advisor_shares set revoked_at = null where id = %L$q$, share));

  -- ── expiry ────────────────────────────────────────────────────────────────
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, created_at, expires_at)
  values (student, advisor, 'adv-u', 'Old meeting', body, now() - interval '10 days', now() - interval '1 minute')
  returning id into old;
  perform pg_temp.expect_refused('the advisor reads an expired share', advisor, format('select * from public.read_advisor_share(%L)', old));
  perform pg_temp.counted('an expired share is not listed', pg_temp.seen(advisor, 'select * from public.list_advisor_shares()'), 0);

  -- ── linking and deletion ─────────────────────────────────────────────────
  perform pg_temp.counted('a student holding a share is not an untouched account', (not public.lti_account_untouched(student))::int, 1);
  perform pg_temp.counted('nor is the advisor it was shared with', (not public.lti_account_untouched(advisor))::int, 1);
  perform pg_temp.counted('an account with nothing is untouched', public.lti_account_untouched(classmate)::int, 1);
  perform pg_temp.expect_allowed('the student deletes their shares', student,
    format('delete from public.advisor_shares where student_id = %L', student));
  perform pg_temp.counted('deleting a share removes its log', (select count(*) from public.advisor_share_events), 0);
  perform pg_temp.counted('the student emptied the table', (select count(*) from public.advisor_shares where student_id = student), 0);
  -- An advisor deleting their account takes the shares they received with it
  -- (review fix 20260928310000): the advisor has no delete policy, and the
  -- auth user is not deleted, so only the RPC reaches those rows.
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
  values (student, advisor, 'adv-u', 'Fall planning', body, now() + interval '5 days');
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
  values (classmate, other_advisor, 'adv-u', 'Someone else''s', body, now() + interval '5 days');
  perform pg_temp.counted('an advisor forgets the shares they received',
    pg_temp.seen(advisor, 'select public.forget_my_advisor_shares()'), 1);
  perform pg_temp.counted('so none addressed to them is left',
    (select count(*) from public.advisor_shares where advisor_id = advisor), 0);
  perform pg_temp.counted('and a share between two other people is untouched (the control)',
    (select count(*) from public.advisor_shares where advisor_id = other_advisor), 1);
end $$;

-- Anonymous callers reach none of it.
set local role anon;
do $$
begin
  perform public.list_advisor_shares();
  raise exception 'FAILED: anon listed advisor shares';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot list advisor shares';
end $$;
reset role;

rollback;
