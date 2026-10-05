-- Mentor rosters, and consent on both sides (20260928021700).
--
-- Launchpad promises a student that a mentor match is proposed to both people
-- and that contact happens only once both accept. This walks that promise with
-- six accounts:
--
--   * A peer mentor (holding mentee:read over the cohort) may publish an offer;
--     a student may not publish one.
--   * A student in the cohort sees the offer; a student at the same school in
--     no cohort, and a student at another school, do not.
--   * A student may ask; the request is pending; only the mentor may accept it
--     — the student cannot accept their own request, and nobody can write the
--     table directly. THE CONTROL: the mentor's accept succeeds and the status
--     reads accepted, because a flow that refused everything would pass every
--     refusal here.
--   * Capacity is enforced at acceptance, per cohort for a peer offer.
--   * A request cannot be aimed at somebody with no visible offer.
--   * Alumni: an offer carries a display name; a student at the school can ask.
--   * Either end can forget every request they are in.
--
--   How to run it: supabase/check.sh mentor-rosters

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

do $$
declare
  mentor uuid; student uuid; second uuid; third uuid; fourth uuid; outsider uuid; far uuid; alum uuid;
  req uuid; req2 uuid; n bigint; st text;
begin
  insert into public.schools (id, name, email_domains) values
    ('mr-u', 'Mentor University', array['mr-u.example']),
    ('mr-other', 'Other University', array['mr-other.example']);

  mentor   := pg_temp.newuser('mentor@mr-u.example', 'mr-u');
  student  := pg_temp.newuser('student@mr-u.example', 'mr-u');
  second   := pg_temp.newuser('second@mr-u.example', 'mr-u');
  outsider := pg_temp.newuser('outsider@mr-u.example', 'mr-u');
  far      := pg_temp.newuser('far@mr-other.example', 'mr-other');
  alum     := pg_temp.newuser('alum@mr-u.example', 'mr-u');
  third    := pg_temp.newuser('third@mr-u.example', 'mr-u');
  fourth   := pg_temp.newuser('fourth@mr-u.example', 'mr-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mentor,  'peer_mentor', 'cohort', 'mr-u/first-year', 'institution'),
    (student, 'student',     'cohort', 'mr-u/first-year', 'institution'),
    (second,  'student',     'cohort', 'mr-u/first-year', 'institution'),
    (alum,    'alumni',      'school', 'mr-u',            'institution'),
    (mentor,  'peer_mentor', 'cohort', 'mr-u/second-year', 'institution'),
    (third,   'student',     'cohort', 'mr-u/second-year', 'institution'),
    (mentor,  'peer_mentor', 'cohort', 'mr-u/third-year',  'institution'),
    (fourth,  'student',     'cohort', 'mr-u/third-year',  'institution');

  -- ── Publishing an offer ─────────────────────────────────────────────────
  perform pg_temp.expect_allowed('a peer mentor publishing an offer in their cohort', mentor,
    $q$insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name, topics, capacity)
       select (select auth.uid()), 'mr-u', 'mr-u/first-year', 'Sam (junior)', array['Study habits'], 1$q$);
  perform pg_temp.expect_refused('a student publishing a peer-mentor offer', student,
    $q$insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name)
       select (select auth.uid()), 'mr-u', 'mr-u/first-year', 'Not a mentor'$q$);

  -- ── Who sees it ─────────────────────────────────────────────────────────
  perform pg_temp.counted('a student in the cohort sees the offer',
    pg_temp.seen(student, 'select 1 from public.peer_mentor_offers'), 1);
  perform pg_temp.counted('a student at the school in no cohort does not',
    pg_temp.seen(outsider, 'select 1 from public.peer_mentor_offers'), 0);
  perform pg_temp.counted('a student at another school does not',
    pg_temp.seen(far, 'select 1 from public.peer_mentor_offers'), 0);

  -- ── Asking, and who may answer ──────────────────────────────────────────
  perform pg_temp.become(student);
  req := public.request_mentor('peer', mentor, 'mr-u/first-year', 'Alex', array['Study habits'], 'Hi!');
  execute 'reset role';
  select status into st from public.mentor_requests where id = req;
  if st <> 'pending' then raise exception 'FAILED: a new request is %', st; end if;
  raise notice 'ok  a new request is pending';

  perform pg_temp.expect_refused('a student accepting their own request', student,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req));
  -- Declining skips the capacity lookup, so this is the case that proves the
  -- recipient rule on its own: accepting above is also refused by capacity
  -- (the student has no offer), and a suite with only that case passed with
  -- the recipient check deleted.
  perform pg_temp.expect_refused('a student declining their own request', student,
    format($q$select public.answer_mentor_request(%L, 'declined')$q$, req));
  perform pg_temp.expect_refused('a third person declining somebody else''s request', second,
    format($q$select public.answer_mentor_request(%L, 'declined')$q$, req));
  perform pg_temp.expect_refused('anybody writing mentor_requests directly', student,
    format($q$update public.mentor_requests set status = 'accepted' where id = %L$q$, req));
  perform pg_temp.expect_refused('asking somebody with no visible offer', outsider,
    format($q$select public.request_mentor('peer', %L, 'mr-u/first-year', 'Out', '{}', '')$q$, mentor));
  perform pg_temp.counted('a third person cannot see the request',
    pg_temp.seen(second, 'select 1 from public.mentor_requests'), 0);

  -- THE CONTROL: the mentor can accept.
  perform pg_temp.become(mentor);
  perform public.answer_mentor_request(req, 'accepted');
  execute 'reset role';
  select status into st from public.mentor_requests where id = req;
  if st <> 'accepted' then raise exception 'FAILED: THE CONTROL — the mentor could not accept (%)', st; end if;
  raise notice 'ok  the mentor accepts — THE CONTROL';

  -- ── Capacity (the offer said 1) ─────────────────────────────────────────
  perform pg_temp.become(second);
  req2 := public.request_mentor('peer', mentor, 'mr-u/first-year', 'Jo', '{}', '');
  execute 'reset role';
  perform pg_temp.expect_refused('accepting beyond capacity', mentor,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req2));
  perform pg_temp.expect_allowed('the second student withdrawing their request', second,
    format($q$select public.answer_mentor_request(%L, 'withdrawn')$q$, req2));

  -- A peer offer's capacity is per cohort. The mentor is full in first-year,
  -- and a second-year offer of one must still take its first mentee — a count
  -- across every cohort refused this.
  perform pg_temp.expect_allowed('the mentor publishing a second offer, in another cohort', mentor,
    $q$insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name, topics, capacity)
       select (select auth.uid()), 'mr-u', 'mr-u/second-year', 'Sam (junior)', array['Study habits'], 1$q$);
  perform pg_temp.become(third);
  req2 := public.request_mentor('peer', mentor, 'mr-u/second-year', 'Kai', '{}', '');
  execute 'reset role';
  perform pg_temp.expect_allowed('accepting in a cohort with room, while full in another', mentor,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req2));

  -- Capacity counts live assignments, however they began (20260928110700).
  -- A mentor with room for one and an assignment from the retired
  -- direct-insert path has no room left.
  perform pg_temp.expect_allowed('the mentor offering one place in a third cohort', mentor,
    $q$insert into public.peer_mentor_offers (user_id, tenant_id, cohort_scope, display_name, topics, capacity)
       select (select auth.uid()), 'mr-u', 'mr-u/third-year', 'Sam (junior)', array['Study habits'], 1$q$);
  insert into public.peer_mentor_assignments (tenant_id, cohort_scope, mentor_id, student_id, expires_at)
  values ('mr-u', 'mr-u/third-year', mentor, second, now() + interval '90 days');
  perform pg_temp.become(fourth);
  req2 := public.request_mentor('peer', mentor, 'mr-u/third-year', 'Rio', '{}', '');
  execute 'reset role';
  perform pg_temp.expect_refused('accepting past capacity when the place is held by an older assignment', mentor,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req2));
  update public.peer_mentor_assignments set revoked_at = now()
   where mentor_id = mentor and student_id = second and cohort_scope = 'mr-u/third-year';

  -- A request waits; the student can leave the cohort meanwhile. Accepting it
  -- then must not hand the mentor a student who is no longer theirs.
  update public.role_grants set revoked_at = now()
   where subject = fourth and scope_id = 'mr-u/third-year';
  perform pg_temp.expect_refused('accepting a request from a student who has since left the cohort', mentor,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req2));
  perform pg_temp.counted('and no assignment was made',
    (select count(*) from public.peer_mentor_assignments where student_id = fourth), 0);
  update public.role_grants set revoked_at = null
   where subject = fourth and scope_id = 'mr-u/third-year';
  perform pg_temp.expect_allowed('the same request once the student is back in the cohort — the control', mentor,
    format($q$select public.answer_mentor_request(%L, 'accepted')$q$, req2));
  perform pg_temp.counted('which makes the assignment',
    (select count(*) from public.peer_mentor_assignments where student_id = fourth and revoked_at is null), 1);

  -- ── Alumni ──────────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('an alum publishing an offer with a display name', alum,
    $q$insert into public.alumni_mentor_offers (user_id, tenant_id, topics, display_name)
       select (select auth.uid()), 'mr-u', array['Careers'], 'Dana (class of 2019)'$q$);
  perform pg_temp.become(outsider);
  perform public.request_mentor('alumni', alum, null, 'Out', array['Careers'], '');
  execute 'reset role';
  perform pg_temp.counted('the alum sees the request', pg_temp.seen(alum, 'select 1 from public.mentor_requests'), 1);
  perform pg_temp.expect_refused('a student at another school asking the alum', far,
    format($q$select public.request_mentor('alumni', %L, null, 'Far', '{}', '')$q$, alum));

  -- ── Forgetting ──────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  select public.forget_my_mentor_requests() into n;
  execute 'reset role';
  perform pg_temp.counted('a student forgets every request they are in', n, 1);
  perform pg_temp.counted('and the mentor no longer sees it', pg_temp.seen(mentor, 'select 1 from public.mentor_requests where requester = ''' || student || ''''), 0);
end $$;

rollback;
