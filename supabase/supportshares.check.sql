-- supabase/supportshares.check.sql — an athlete's share with academic support.
--
-- For 20260928308000_support_shares.sql, slice 4 of the owner-approved consent
-- design (D-037). The design's list of what every slice must prove (§8), and
-- where each is below:
--
--   * a non-recipient reads nothing                      — "who can read it"
--   * an expired, revoked or unaccepted share reads nothing — "ending"
--   * a staff recipient without the role reads nothing  — "the role, now"
--   * every read is logged                               — "the log"
--   * the student can list and revoke                    — "the student's side"
--
-- and the decisions this slice carries: only `athletic_academic_support` can
-- receive (D1), compliance never can, even alongside the support role (D2),
-- every ended share answers the same (D3), and 200 days at most (D4).
--
-- The control: the share that works, and the read that works, come first;
-- each refusal changes one thing about the same people.
--
--   How to run it: supabase/check.sh supportshares

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
  perform public.share_with_support(email, body, now() + expires);
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

-- The error a read raises, or null for a read that returned.
create or replace function pg_temp.read_error(who uuid, share uuid)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  perform * from public.read_support_share(share);
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

do $$
declare
  athlete uuid; teammate uuid; support uuid; other_support uuid; learning uuid;
  compliance uuid; dual uuid; lapsed uuid; share uuid; miss text; ended text; gone bigint;
  body jsonb := '{"sharedAs":"Sam","travel":[{"from":"2026-10-09","to":"2026-10-11","misses":["ECON 1020"]}],"courses":["ECON 1020"]}'::jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('ath-u', 'Athlete University', array['ath-u.example']),
    ('ath-other', 'Other University', array['ath-other.example']);

  athlete       := pg_temp.newuser('athlete@ath-u.example', 'ath-u');
  teammate      := pg_temp.newuser('teammate@ath-u.example', 'ath-u');
  support       := pg_temp.newuser('support@ath-u.example', 'ath-u');
  other_support := pg_temp.newuser('support@ath-other.example', 'ath-other');
  learning      := pg_temp.newuser('learning@ath-u.example', 'ath-u');
  compliance    := pg_temp.newuser('compliance@ath-u.example', 'ath-u');
  dual          := pg_temp.newuser('both@ath-u.example', 'ath-u');
  lapsed        := pg_temp.newuser('lapsed@ath-u.example', 'ath-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (support,       'athletic_academic_support',    'office', 'ath-u/athletics', 'institution'),
    (other_support, 'athletic_academic_support',    'school', 'ath-other',       'institution'),
    (learning,      'learning_center_staff',        'school', 'ath-u',           'institution'),
    (compliance,    'athletics_compliance_officer', 'office', 'ath-u/athletics', 'institution'),
    (dual,          'athletic_academic_support',    'school', 'ath-u',           'institution'),
    (dual,          'athletics_compliance_officer', 'school', 'ath-u',           'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (lapsed,        'athletic_academic_support',    'school', 'ath-u',           'institution', now());

  -- ── Who an athlete may share with (D1, D2) ─────────────────────────────
  perform pg_temp.counted('an athlete shares with support staff at their school, inside an office scope',
    (pg_temp.share_error(athlete, 'Support@ATH-U.example', interval '60 days', body) is null)::int, 1);
  miss := pg_temp.share_error(athlete, 'nobody@ath-u.example', interval '60 days', body);
  perform pg_temp.counted('an unknown address is refused', (miss is not null)::int, 1);
  perform pg_temp.counted('a teammate reads the same as an unknown address',
    (pg_temp.share_error(athlete, 'teammate@ath-u.example', interval '60 days', body) = miss)::int, 1);
  perform pg_temp.counted('learning-center staff read the same (D1: a different office)',
    (pg_temp.share_error(athlete, 'learning@ath-u.example', interval '60 days', body) = miss)::int, 1);
  perform pg_temp.counted('the compliance office reads the same (D2)',
    (pg_temp.share_error(athlete, 'compliance@ath-u.example', interval '60 days', body) = miss)::int, 1);
  perform pg_temp.counted('and so does somebody holding support and compliance both (D2)',
    (pg_temp.share_error(athlete, 'both@ath-u.example', interval '60 days', body) = miss)::int, 1);
  perform pg_temp.counted('support staff at another school read the same',
    (pg_temp.share_error(athlete, 'support@ath-other.example', interval '60 days', body) = miss)::int, 1);
  perform pg_temp.counted('staff whose grant was revoked read the same',
    (pg_temp.share_error(athlete, 'lapsed@ath-u.example', interval '60 days', body) = miss)::int, 1);

  -- ── What a share may carry, and for how long (§4, D4) ───────────────────
  perform pg_temp.counted('a grade does not fit in the payload',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '60 days',
      body || '{"grades":{"ECON 1020":"B+"}}'::jsonb) is not null)::int, 1);
  perform pg_temp.counted('nor the hours log',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '60 days',
      body || '{"hours":[20]}'::jsonb) is not null)::int, 1);
  perform pg_temp.counted('a payload that is not an object is refused',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '60 days', '[1]'::jsonb) is not null)::int, 1);
  perform pg_temp.counted('a payload over 32 KB is refused',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '60 days',
      jsonb_build_object('courses', repeat('x', 33000))) is not null)::int, 1);
  perform pg_temp.counted('an end past 200 days is refused',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '201 days', body) is not null)::int, 1);
  perform pg_temp.counted('an end in the past is refused',
    (pg_temp.share_error(athlete, 'support@ath-u.example', interval '-1 day', body) is not null)::int, 1);
  perform pg_temp.expect_refused('an athlete writing a share row directly', athlete,
    format($q$insert into public.support_shares (student_id, staff_id, tenant_id, payload, expires_at)
             values (%L, %L, 'ath-u', '{}', now() + interval '1 day')$q$, athlete, support));
  perform pg_temp.counted('and every refusal wrote nothing: one share exists',
    (select count(*) from public.support_shares), 1);
  select id into share from public.support_shares where student_id = athlete;

  -- ── Who can read it ─────────────────────────────────────────────────────
  perform pg_temp.counted('the athlete sees their share',
    pg_temp.seen(athlete, 'select * from public.support_shares'), 1);
  perform pg_temp.counted('the staff member cannot select the table',
    pg_temp.seen(support, 'select * from public.support_shares'), 0);
  perform pg_temp.counted('the staff member lists it, by name only',
    pg_temp.seen(support, $q$select * from public.list_support_shares() where shared_as = 'Sam'$q$), 1);
  perform pg_temp.counted('and reads it',
    (pg_temp.read_error(support, share) is null)::int, 1);
  ended := pg_temp.read_error(teammate, share);
  perform pg_temp.counted('a teammate cannot', (ended is not null)::int, 1);
  perform pg_temp.counted('nor the compliance office',
    (pg_temp.read_error(compliance, share) = ended)::int, 1);
  perform pg_temp.counted('and nobody else lists it',
    pg_temp.seen(compliance, 'select * from public.list_support_shares()'), 0);

  -- ── The log ─────────────────────────────────────────────────────────────
  perform pg_temp.counted('the one read that worked is logged, and only it',
    (select count(*) from public.support_share_events), 1);
  perform pg_temp.counted('listing is not a read',
    (select count(*) from public.support_share_events where reader_id = support), 1);
  perform pg_temp.counted('the athlete sees who opened it',
    pg_temp.seen(athlete, format('select * from public.support_share_events where reader_id = %L', support)), 1);
  perform pg_temp.counted('the staff member cannot see the log',
    pg_temp.seen(support, 'select * from public.support_share_events'), 0);
  perform pg_temp.expect_refused('the staff member writing a log row', support,
    format($q$insert into public.support_share_events (share_id, reader_id) values (%L, %L)$q$, share, support));

  -- ── The role, now (§4) ──────────────────────────────────────────────────
  -- Losing the role stops the share without anybody revoking it.
  update public.role_grants set revoked_at = now() where subject = support;
  perform pg_temp.counted('staff who lost the role list nothing',
    pg_temp.seen(support, 'select * from public.list_support_shares()'), 0);
  perform pg_temp.counted('and read the same refusal as a stranger (D3)',
    (pg_temp.read_error(support, share) = ended)::int, 1);
  update public.role_grants set revoked_at = null where subject = support;
  perform pg_temp.counted('the control: the role restored, the same share reads again',
    (pg_temp.read_error(support, share) is null)::int, 1);

  -- Taking on compliance stops it too (D2), with the support role still held.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (support, 'athletics_compliance_officer', 'school', 'ath-u', 'institution');
  perform pg_temp.counted('staff who join compliance cannot read, though they keep the support role',
    (pg_temp.read_error(support, share) = ended)::int, 1);
  delete from public.role_grants where subject = support and role = 'athletics_compliance_officer';

  -- An expired grant is as good as a revoked one.
  update public.role_grants set expires_at = now() - interval '1 second' where subject = support;
  perform pg_temp.counted('an expired role grant reads nothing',
    (pg_temp.read_error(support, share) = ended)::int, 1);
  update public.role_grants set expires_at = null where subject = support;

  -- ── Ending (D3) ─────────────────────────────────────────────────────────
  update public.support_shares set expires_at = now() + interval '1 minute', created_at = now() - interval '1 day' where id = share;
  update public.support_shares set expires_at = now() - interval '1 second' where id = share;
  perform pg_temp.counted('an expired share reads the same refusal',
    (pg_temp.read_error(support, share) = ended)::int, 1);
  update public.support_shares set expires_at = now() + interval '30 days' where id = share;
  perform pg_temp.counted('the control: in date again, it reads',
    (pg_temp.read_error(support, share) is null)::int, 1);

  -- ── The student's side ──────────────────────────────────────────────────
  perform pg_temp.become(athlete);
  update public.support_shares set revoked_at = now() where id = share;
  execute 'reset role';
  perform pg_temp.counted('a revoked share reads the same refusal',
    (pg_temp.read_error(support, share) = ended)::int, 1);
  perform pg_temp.expect_refused('re-opening a revoked share', athlete,
    format('update public.support_shares set revoked_at = null where id = %L', share));
  perform pg_temp.expect_refused('widening a share after the fact', athlete,
    format($q$update public.support_shares set payload = '{"courses":[]}' where id = %L$q$, share));
  perform pg_temp.expect_refused('the staff member deleting it', support,
    format('delete from public.support_shares where id = %L', share));

  -- ── A share is a used account, at both ends ─────────────────────────────
  perform pg_temp.counted('a teammate with nothing is untouched',
    public.lti_account_untouched(teammate)::int, 1);
  perform pg_temp.counted('the athlete is not',
    public.lti_account_untouched(athlete)::int, 0);
  perform pg_temp.counted('nor the staff member at the other end',
    public.lti_account_untouched(support)::int, 0);

  perform pg_temp.become(athlete);
  delete from public.support_shares where id = share;
  execute 'reset role';
  perform pg_temp.counted('the athlete deletes it, and its log goes with it',
    (select count(*) from public.support_share_events), 0);

  -- ── Delete my account, at the staff end ─────────────────────────────────
  -- A staff member has no delete policy on the shares they received, and
  -- deleting an account deletes no auth user, so only the RPC reaches them.
  insert into public.support_shares (student_id, staff_id, tenant_id, payload, expires_at)
  values (athlete, support, 'ath-u', '{"courses":[]}', now() + interval '5 days');
  insert into public.support_shares (student_id, staff_id, tenant_id, payload, expires_at)
  values (teammate, other_support, 'ath-u', '{"courses":[]}', now() + interval '5 days');
  perform pg_temp.become(support);
  gone := public.forget_my_support_shares();
  execute 'reset role';
  perform pg_temp.counted('a staff member forgets the shares they received', gone, 1);
  perform pg_temp.counted('so none addressed to them is left',
    (select count(*) from public.support_shares where staff_id = support), 0);
  perform pg_temp.counted('and a share between two other people is untouched (the control)',
    (select count(*) from public.support_shares where staff_id = other_support), 1);
  perform pg_temp.become(teammate);
  gone := public.forget_my_support_shares();
  execute 'reset role';
  perform pg_temp.counted('a student forgets the shares they made, the same way', gone, 1);
end $$;

set local role anon;
do $$
begin
  perform public.list_support_shares();
  raise exception 'FAILED: a signed-out visitor listed support shares';
exception when insufficient_privilege then
  raise notice 'ok  a signed-out visitor cannot list support shares';
end $$;
do $$
begin
  perform public.share_with_support('support@ath-u.example', '{}'::jsonb, now() + interval '1 day');
  raise exception 'FAILED: a signed-out visitor made a support share';
exception when insufficient_privilege then
  raise notice 'ok  or make one';
end $$;
reset role;

rollback;
