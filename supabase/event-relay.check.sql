-- supabase/event-relay.check.sql — a grade release reaches the student's
-- Action Center through the outbox, once.
--
-- For 20261022090000_grade_release_student_actions.sql. One school, two
-- courses: ECON 1020 (moderation required) and HIST 2100, both 2026FA. Two
-- instructors on ECON (one enters, the other moderates), one on HIST; Ana,
-- Ben and Dan in ECON, Cal in HIST; an operator for replays. What it proves:
--
--   * a release makes exactly one action per student it released, naming the
--     item and the grade version, and none for a draft it held, a version
--     moderated after it, another course, or an earlier or later release;
--   * a second tick, and a third, make nothing;
--   * the relay claims only gradebook.grades_released v1, and never a
--     projection.changed event beside it;
--   * fan-out: another subscriber publishing the event through the generic
--     claim does not hide it from this one, and this one settling it does not
--     publish or park the event row, so both receipts exist;
--   * a held lease is not claimed again; once it expires it is re-claimed, the
--     stale token cannot settle the new owner's claim, and there is one effect;
--   * a crash between the actions and the receipt leaves no action, no
--     receipt and no watermark, and the retry makes them once;
--   * a failing apply retries with a future due time, and attempt eight
--     dead-letters this consumer's delivery with one failed receipt, leaving
--     the event row untouched; a malformed event dead-letters at once;
--   * a dead-lettered delivery is replayed once, through the existing
--     approval, MFA and audit path, and the next tick applies it once;
--   * students read only their own actions, cannot write the table, cannot
--     settle another's, and a stale version is refused; the same key is a
--     replay, not a second change;
--   * a grade changed after release keeps its action while the change is a
--     draft, and when the change is released the old action leaves the feed,
--     cannot be settled, and the new one takes its place.
--
-- The control throughout: each "none" is measured beside a "one" made by the
-- same call for the right student, so a zero is the rule's doing and not an
-- empty fixture.
--
--   How to run it: supabase/check.sh event-relay

begin;

create or replace function pg_temp.become(who uuid, mfa boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when mfa then
      json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
        'amr', json_build_array(json_build_object('method', 'totp',
          'timestamp', floor(extract(epoch from now()))::bigint)))::text
    else json_build_object('sub', who::text, 'role', 'authenticated')::text end,
    true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- The error a statement raises as `who`, or null when it ran.
create or replace function pg_temp.err(who uuid, statement text, mfa boolean default false)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who, mfa);
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not ilike '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.ask(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  perform pg_temp.nobody();
  return v;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  perform pg_temp.nobody();
  return n;
end $$;

-- One relay tick, as the service role the worker runs as.
create or replace function pg_temp.tick()
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  execute 'set local role service_role';
  result := public.run_student_action_relay(25);
  execute 'reset role';
  return result;
end $$;

create temp table ids (key text primary key, value text not null);
-- The planted crash trigger reads it as the worker's role.
grant select on ids to service_role;
create or replace function pg_temp.remember(key text, value text)
returns void language sql as $$
  insert into ids values (key, value) on conflict (key) do update set value = excluded.value
$$;
create or replace function pg_temp.id(want_key text)
returns uuid language sql stable as $$ select value::uuid from ids where ids.key = want_key $$;

-- The grades_released event a release wrote, by the release's key.
create or replace function pg_temp.event_of(release_key text)
returns uuid language sql stable as $$
  select e.id from private.domain_outbox_events e
   where e.event_type = 'gradebook.grades_released' and e.idempotency_key = release_key
$$;

create or replace function pg_temp.actions_of(student uuid, item uuid)
returns bigint language sql stable as $$
  select count(*) from public.student_actions a where a.student_id = student and a.item_id = item
$$;

-- A planted failure: the receipt write for one event raises, after the
-- actions were inserted in the same transaction. Retryable (P0001).
create or replace function pg_temp.crash_on_receipt()
returns trigger language plpgsql as $$
begin
  if new.consumer = 'student-actions.grade-release.v1'
     and new.outcome in ('processed', 'skipped')
     and new.event_id = (select value::uuid from ids where key = 'crash') then
    raise exception 'planted crash before commit';
  end if;
  return new;
end $$;

insert into public.schools (id, name, email_domains) values
  ('er-u', 'Event Relay University', array['er-u.example']);

do $$
declare
  prof uuid := pg_temp.newuser('prof@er-u.example', 'er-u');
  coprof uuid := pg_temp.newuser('coprof@er-u.example', 'er-u');
  hist uuid := pg_temp.newuser('hist@er-u.example', 'er-u');
  ana uuid := pg_temp.newuser('ana@er-u.example', 'er-u');
  ben uuid := pg_temp.newuser('ben@er-u.example', 'er-u');
  dan uuid := pg_temp.newuser('dan@er-u.example', 'er-u');
  cal uuid := pg_temp.newuser('cal@er-u.example', 'er-u');
  operator uuid := pg_temp.newuser('operator@er-u.example', 'er-u');
begin
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,   'faculty',               'course', 'er-u/ECON 1020/2026FA', 'institution'),
    (coprof, 'faculty',               'course', 'er-u/ECON 1020/2026FA', 'institution'),
    (hist,   'faculty',               'course', 'er-u/HIST 2100/2026FA', 'institution'),
    (ana,    'undergraduate_student', 'course', 'er-u/ECON 1020/2026FA', 'institution'),
    (ben,    'undergraduate_student', 'course', 'er-u/ECON 1020/2026FA', 'institution'),
    (dan,    'undergraduate_student', 'course', 'er-u/ECON 1020/2026FA', 'institution'),
    (cal,    'undergraduate_student', 'course', 'er-u/HIST 2100/2026FA', 'institution'),
    (operator, 'platform_admin',      'platform', '',                    'platform');
  insert into public.council_seat_holder (seat, subject) values ('engineering', operator);
  perform pg_temp.remember('prof', prof::text);
  perform pg_temp.remember('coprof', coprof::text);
  perform pg_temp.remember('hist', hist::text);
  perform pg_temp.remember('ana', ana::text);
  perform pg_temp.remember('ben', ben::text);
  perform pg_temp.remember('dan', dan::text);
  perform pg_temp.remember('cal', cal::text);
  perform pg_temp.remember('operator', operator::text);
end $$;

-- ── Who may call what ──────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.run_student_action_relay(integer)', 'execute')
     or has_function_privilege('anon', 'public.run_student_action_relay(integer)', 'execute')
     or has_function_privilege('authenticated', 'private.claim_grade_release_events(integer)', 'execute')
     or has_function_privilege('authenticated', 'private.apply_grade_release_event(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.fail_event_delivery(text,uuid,uuid,text,boolean)', 'execute')
     or has_table_privilege('authenticated', 'private.domain_event_deliveries', 'select')
     or has_table_privilege('authenticated', 'public.student_actions', 'insert')
     or has_table_privilege('authenticated', 'public.student_actions', 'update')
     or has_table_privilege('authenticated', 'public.student_actions', 'delete')
     or has_function_privilege('anon', 'public.my_student_actions()', 'execute')
     or has_function_privilege('anon', 'public.settle_student_action(uuid,text,integer,text)', 'execute') then
    raise exception 'FAILED: a client role can reach the relay, its delivery state or write an action';
  end if;
  if not has_function_privilege('authenticated', 'public.my_student_actions()', 'execute')
     or not has_function_privilege('authenticated', 'public.settle_student_action(uuid,text,integer,text)', 'execute')
     or not has_function_privilege('service_role', 'public.run_student_action_relay(integer)', 'execute') then
    raise exception 'FAILED: the control — the student''s two calls or the worker''s tick are not granted';
  end if;
  raise notice 'ok  the tick and delivery state are service-only; the student reads and settles through two calls';
end $$;

-- ── Grades: two courses, a held draft, two ECON releases, one HIST ────────
do $$
declare
  prof uuid := pg_temp.id('prof'); coprof uuid := pg_temp.id('coprof'); hist uuid := pg_temp.id('hist');
  ana uuid := pg_temp.id('ana'); ben uuid := pg_temp.id('ben'); dan uuid := pg_temp.id('dan'); cal uuid := pg_temp.id('cal');
  ps1 uuid; mid uuid; ps2 uuid; ps3 uuid; essay uuid;
begin
  perform pg_temp.become(prof);
  perform public.gradebook_set_scheme('ECON 1020', '2026FA',
    '[{"key":"problem-sets","name":"Problem sets","weight":40},{"key":"exams","name":"Exams","weight":60}]'::jsonb,
    '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb, true, 'er-scheme-econ');
  ps1 := public.gradebook_add_item('ECON 1020', '2026FA', 'problem-sets', 'Problem set 1', 10, null, 'er-item-ps1');
  mid := public.gradebook_add_item('ECON 1020', '2026FA', 'exams', 'Midterm', 100, null, 'er-item-mid');
  ps2 := public.gradebook_add_item('ECON 1020', '2026FA', 'problem-sets', 'Problem set 2', 10, null, 'er-item-ps2');
  ps3 := public.gradebook_add_item('ECON 1020', '2026FA', 'problem-sets', 'Problem set 3', 10, null, 'er-item-ps3');
  perform public.gradebook_enter(ps1, ana, 9, null, 'Good', '', 'er-enter-ana-ps1');
  perform public.gradebook_enter(ps1, ben, 7, null, '', '', 'er-enter-ben-ps1');
  perform public.gradebook_enter(ps1, dan, 5, null, '', '', 'er-enter-dan-ps1');
  perform public.gradebook_enter(mid, ana, 80, null, '', '', 'er-enter-ana-mid');
  perform public.gradebook_enter(ps2, ana, 8, null, '', '', 'er-enter-ana-ps2');
  perform public.gradebook_enter(ps3, ana, 6, null, '', '', 'er-enter-ana-ps3');
  perform pg_temp.nobody();

  perform pg_temp.become(coprof);
  perform public.gradebook_moderate(ps1, ana, 'er-mod-ana-ps1');
  perform public.gradebook_moderate(mid, ana, 'er-mod-ana-mid');
  perform public.gradebook_moderate(ps2, ana, 'er-mod-ana-ps2');
  perform public.gradebook_moderate(ps3, ana, 'er-mod-ana-ps3');
  perform pg_temp.nobody();

  -- Release 1: Ana's moderated grade goes; Ben's and Dan's drafts are held.
  perform pg_temp.become(prof);
  perform pg_temp.said('release 1 releases Ana and holds two drafts',
    public.gradebook_release(ps1, 'er-release-ps1-a')::text, '{"held": 2, "released": 1}');
  perform pg_temp.nobody();

  -- Ben is moderated after release 1 and released by release 2. Dan stays a
  -- draft: held twice, never released.
  perform pg_temp.become(coprof);
  perform public.gradebook_moderate(ps1, ben, 'er-mod-ben-ps1');
  perform pg_temp.nobody();
  perform pg_temp.become(prof);
  perform pg_temp.said('release 2 releases Ben and holds Dan',
    public.gradebook_release(ps1, 'er-release-ps1-b')::text, '{"held": 1, "released": 1}');
  perform pg_temp.nobody();

  perform pg_temp.become(hist);
  perform public.gradebook_set_scheme('HIST 2100', '2026FA',
    '[{"key":"essays","name":"Essays","weight":100}]'::jsonb,
    '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb, false, 'er-scheme-hist');
  essay := public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Essay 1', 100, null, 'er-item-essay');
  perform public.gradebook_enter(essay, cal, 88, null, '', '', 'er-enter-cal-essay');
  perform public.gradebook_release(essay, 'er-release-essay');
  perform pg_temp.nobody();

  perform pg_temp.remember('ps1', ps1::text);
  perform pg_temp.remember('mid', mid::text);
  perform pg_temp.remember('ps2', ps2::text);
  perform pg_temp.remember('ps3', ps3::text);
  perform pg_temp.remember('essay', essay::text);
end $$;

-- An event of another type, due beside them. The relay must never take it.
do $$
declare made uuid;
begin
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id,
     producer, correlation_id, idempotency_key, payload, data_classification, retention_class)
  values
    ('projection_probe', 'er-unrelated', 'projection.changed', 1, 'production', 'er-u',
     'event-relay-check', 'er-unrelated-correlation', 'er-unrelated',
     jsonb_build_object('id', 'er-unrelated'), 'internal', 'operational')
  returning id into made;
  perform pg_temp.remember('unrelated', made::text);
end $$;

-- ── Fan-out: another subscriber goes first, through the generic claim ─────
do $$
declare
  claimed private.domain_outbox_events%rowtype;
  n integer := 0;
begin
  execute 'set local role service_role';
  for claimed in select * from private.claim_domain_events('zz.other.subscriber', 100) loop
    perform private.complete_domain_event('zz.other.subscriber', claimed.id, claimed.claim_id, 'processed');
    n := n + 1;
  end loop;
  execute 'reset role';
  perform pg_temp.counted('the other subscriber claimed and published every due event, ours included', n, 4);
  perform pg_temp.counted('the three grade releases now read published on the event row',
    (select count(*) from private.domain_outbox_events e
      where e.event_type = 'gradebook.grades_released' and e.published_at is not null), 3);
end $$;

-- ── The first tick ────────────────────────────────────────────────────────
do $$
declare
  r jsonb := pg_temp.tick();
  ana uuid := pg_temp.id('ana'); ben uuid := pg_temp.id('ben'); dan uuid := pg_temp.id('dan'); cal uuid := pg_temp.id('cal');
  ps1 uuid := pg_temp.id('ps1'); essay uuid := pg_temp.id('essay');
  e1 uuid := pg_temp.event_of('er-release-ps1-a'); e2 uuid := pg_temp.event_of('er-release-ps1-b');
begin
  perform pg_temp.said('the first tick claims the three releases, publishes nothing else and makes three actions',
    r::text, '{"actions": 3, "claimed": 3, "skipped": 0, "retrying": 0, "processed": 3, "deadLettered": 0}');
  perform pg_temp.counted('Ana has one action for problem set 1', pg_temp.actions_of(ana, ps1), 1);
  perform pg_temp.counted('Ben has one, from release 2', pg_temp.actions_of(ben, ps1), 1);
  perform pg_temp.counted('Dan, held as a draft by both releases, has none', pg_temp.actions_of(dan, ps1), 0);
  perform pg_temp.counted('Cal has one, for his own course''s essay', pg_temp.actions_of(cal, essay), 1);
  perform pg_temp.counted('and none for ECON', pg_temp.actions_of(cal, ps1), 0);
  perform pg_temp.counted('release 1''s event made exactly Ana''s action — not Ben''s, released later',
    (select count(*) from public.student_actions a where a.source_event_id = e1 and a.student_id = ana), 1);
  perform pg_temp.counted('and nothing else',
    (select count(*) from public.student_actions a where a.source_event_id = e1), 1);
  perform pg_temp.counted('release 2''s event made exactly Ben''s',
    (select count(*) from public.student_actions a where a.source_event_id = e2 and a.student_id = ben), 1);
  perform pg_temp.counted('each action names the released grade version, on its own item and student',
    (select count(*) from public.student_actions a
       join public.grade_entries g on g.id = a.grade_entry_id
      where g.status = 'released' and g.item_id = a.item_id and g.student_id = a.student_id), 3);
  perform pg_temp.counted('the unrelated event was never given a delivery by this consumer',
    (select count(*) from private.domain_event_deliveries d where d.event_id = pg_temp.id('unrelated')), 0);
  perform pg_temp.counted('fan-out: release 1 has both subscribers'' processed receipts',
    (select count(*) from private.domain_event_receipts r
      where r.event_id = e1 and r.outcome = 'processed'
        and r.consumer in ('zz.other.subscriber', 'student-actions.grade-release.v1')), 2);
  perform pg_temp.counted('the watermark names the newest release applied',
    (select count(*) from private.projection_watermark w
      where w.projection = 'student_actions' and w.version = 1 and w.status = 'idle'
        and w.last_event_id is not null), 1);
end $$;

do $$
declare
  r jsonb;
begin
  r := pg_temp.tick();
  perform pg_temp.said('a second tick claims nothing', r ->> 'claimed', '0');
  r := pg_temp.tick();
  perform pg_temp.said('nor a third', r ->> 'claimed', '0');
  perform pg_temp.counted('and the actions are still three', (select count(*) from public.student_actions), 3);
end $$;

-- This consumer settling does not publish the event for anybody else: a
-- release this relay finished first is still offered by the generic claim.
do $$
declare
  ana uuid := pg_temp.id('ana');
  mid uuid := pg_temp.id('mid');
  ev uuid;
  r jsonb;
  offered integer;
begin
  perform pg_temp.become(pg_temp.id('prof'));
  perform public.gradebook_release(mid, 'er-release-mid');
  perform pg_temp.nobody();
  ev := pg_temp.event_of('er-release-mid');
  perform pg_temp.remember('e-mid', ev::text);

  -- Two claimers. The first holds the lease; the second, while it is held, is
  -- given nothing.
  execute 'set local role service_role';
  select to_jsonb(x) into strict r from private.claim_grade_release_events(25) x;
  select count(*) into offered from private.claim_grade_release_events(25);
  execute 'reset role';
  perform pg_temp.remember('first-claim', r ->> 'claim_id');
  perform pg_temp.counted('a second claimer is given nothing while the first lease is held', offered, 0);
  perform pg_temp.said('the first claimer holds the midterm release', r ->> 'event_id', ev::text);
  perform pg_temp.said('a tick while the lease is held claims nothing', pg_temp.tick() ->> 'claimed', '0');
  perform pg_temp.counted('and makes no action', pg_temp.actions_of(ana, mid), 0);
  perform pg_temp.counted('the claim did not touch the event row''s lease',
    (select count(*) from private.domain_outbox_events e where e.id = ev and e.claim_id is null and e.published_at is null), 1);
end $$;

-- The first worker died. Its lease expires; a second worker claims; the dead
-- worker's token cannot settle; the second's does, once.
do $$
declare
  ana uuid := pg_temp.id('ana');
  mid uuid := pg_temp.id('mid');
  ev uuid := pg_temp.id('e-mid');
  stale uuid := pg_temp.id('first-claim');
  fresh uuid;
  message text;
  r jsonb;
  offered integer;
begin
  update private.domain_event_deliveries d
     set claimed_at = now() - interval '6 minutes'
   where d.consumer = 'student-actions.grade-release.v1' and d.event_id = ev;
  execute 'set local role service_role';
  select c.claim_id into fresh from private.claim_grade_release_events(25) c where c.event_id = ev;
  begin
    perform private.apply_grade_release_event(ev, stale);
    message := null;
  exception when sqlstate '40001' then
    message := sqlerrm;
  end;
  execute 'reset role';
  if fresh is null or fresh = stale then
    raise exception 'FAILED: the expired lease was not re-claimed under a new token';
  end if;
  if message is null then
    raise exception 'FAILED: the dead worker''s stale token settled the new owner''s claim';
  end if;
  raise notice 'ok  an expired lease is re-claimed and the stale token is refused (%)', message;
  perform pg_temp.counted('the refused settle made no action', pg_temp.actions_of(ana, mid), 0);

  execute 'set local role service_role';
  r := private.apply_grade_release_event(ev, fresh);
  execute 'reset role';
  perform pg_temp.said('the new owner applies it', r ->> 'outcome', 'processed');
  perform pg_temp.counted('one action for the re-claimed release', pg_temp.actions_of(ana, mid), 1);
  perform pg_temp.said('and a tick after it claims nothing', pg_temp.tick() ->> 'claimed', '0');
  perform pg_temp.counted('still one', pg_temp.actions_of(ana, mid), 1);

  -- The generic claim still offers the event this relay finished.
  execute 'set local role service_role';
  select count(*)::integer into offered from private.claim_domain_events('zz.other.subscriber', 100) x where x.id = ev;
  execute 'reset role';
  perform pg_temp.counted('this relay settling it left it claimable by the other subscriber', offered, 1);
end $$;

-- ── A crash before commit ─────────────────────────────────────────────────
do $$
declare
  ana uuid := pg_temp.id('ana');
  ps2 uuid := pg_temp.id('ps2');
  ev uuid;
  r jsonb;
  mark uuid;
begin
  perform pg_temp.become(pg_temp.id('prof'));
  perform public.gradebook_release(ps2, 'er-release-ps2');
  perform pg_temp.nobody();
  ev := pg_temp.event_of('er-release-ps2');
  perform pg_temp.remember('crash', ev::text);
  select w.last_event_id into mark from private.projection_watermark w where w.projection = 'student_actions';

  create trigger er_crash before insert on private.domain_event_receipts
    for each row execute function pg_temp.crash_on_receipt();
  r := pg_temp.tick();
  drop trigger er_crash on private.domain_event_receipts;

  perform pg_temp.said('the crashed apply is counted as a retry', r ->> 'retrying', '1');
  perform pg_temp.counted('no action survived the crash', pg_temp.actions_of(ana, ps2), 0);
  perform pg_temp.counted('no receipt either',
    (select count(*) from private.domain_event_receipts x where x.event_id = ev and x.consumer = 'student-actions.grade-release.v1'), 0);
  perform pg_temp.said('the watermark did not move',
    (select w.last_event_id::text from private.projection_watermark w where w.projection = 'student_actions'), mark::text);
  perform pg_temp.counted('the delivery holds one attempt, a sanitized error and a future due time',
    (select count(*) from private.domain_event_deliveries d
      where d.event_id = ev and d.attempts = 1 and d.next_attempt_at > now() and d.claim_id is null
        and d.last_error = 'student action relay transaction failed'), 1);

  update private.domain_event_deliveries d set next_attempt_at = now() - interval '1 second'
   where d.event_id = ev and d.consumer = 'student-actions.grade-release.v1';
  r := pg_temp.tick();
  perform pg_temp.said('the retry processes it', r ->> 'processed', '1');
  perform pg_temp.counted('one action after the retry', pg_temp.actions_of(ana, ps2), 1);
end $$;

-- ── Retries, then a dead letter; a malformed event at once ────────────────
do $$
declare
  ana uuid := pg_temp.id('ana');
  ps3 uuid := pg_temp.id('ps3');
  ev uuid;
  r jsonb;
  forged uuid;
begin
  perform pg_temp.become(pg_temp.id('prof'));
  perform public.gradebook_release(ps3, 'er-release-ps3');
  perform pg_temp.nobody();
  ev := pg_temp.event_of('er-release-ps3');
  perform pg_temp.remember('crash', ev::text);
  perform pg_temp.remember('e-ps3', ev::text);

  create trigger er_crash before insert on private.domain_event_receipts
    for each row execute function pg_temp.crash_on_receipt();
  r := pg_temp.tick();
  perform pg_temp.said('a failing apply retries first', r ->> 'retrying', '1');
  update private.domain_event_deliveries d set attempts = 7, next_attempt_at = now() - interval '1 second'
   where d.event_id = ev and d.consumer = 'student-actions.grade-release.v1';
  r := pg_temp.tick();
  drop trigger er_crash on private.domain_event_receipts;
  perform pg_temp.said('attempt eight dead-letters it', r ->> 'deadLettered', '1');
  perform pg_temp.counted('this consumer''s delivery is parked with eight attempts and one failed receipt',
    (select count(*) from private.domain_event_deliveries d
       join private.domain_event_receipts x on x.event_id = d.event_id and x.consumer = d.consumer
      where d.event_id = ev and d.consumer = 'student-actions.grade-release.v1'
        and d.attempts = 8 and d.dead_lettered_at is not null and x.outcome = 'failed'), 1);
  perform pg_temp.counted('the event row is untouched: not parked, not published, no attempts',
    (select count(*) from private.domain_outbox_events e
      where e.id = ev and e.dead_lettered_at is null and e.published_at is null and e.publish_attempts = 0), 1);
  perform pg_temp.counted('no action', pg_temp.actions_of(ana, ps3), 0);
  perform pg_temp.said('a parked delivery is not claimed again', pg_temp.tick() ->> 'claimed', '0');

  -- A grades_released event with a key the contract does not have.
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id,
     producer, correlation_id, idempotency_key, payload, data_classification, retention_class)
  values
    ('gradebook_item', ps3::text, 'gradebook.grades_released', 1, 'production', 'er-u',
     'gradebook', 'er-forged-correlation', 'er-forged-release',
     jsonb_build_object('item', ps3, 'course_code', 'ECON 1020', 'term', '2026FA',
                        'released', 1, 'held', 0, 'student', ana),
     'education_record', 'student_record')
  returning id into forged;
  r := pg_temp.tick();
  perform pg_temp.said('a malformed event dead-letters on its first attempt', r ->> 'deadLettered', '1');
  perform pg_temp.counted('with the generic contract error and no action',
    (select count(*) from private.domain_event_deliveries d
      where d.event_id = forged and d.attempts = 1 and d.dead_lettered_at is not null
        and d.last_error = 'invalid gradebook.grades_released version 1 event'), 1);
  perform pg_temp.counted('it wrote no action',
    (select count(*) from public.student_actions a where a.source_event_id = forged), 0);
  perform pg_temp.remember('forged', forged::text);
end $$;

-- ── Replay of the dead letter, once, audited ──────────────────────────────
do $$
declare
  operator uuid := pg_temp.id('operator');
  ana uuid := pg_temp.id('ana');
  ps3 uuid := pg_temp.id('ps3');
  ev uuid := pg_temp.id('e-ps3');
  approval uuid := gen_random_uuid();
  result jsonb;
  message text;
begin
  -- An approval for a delivery that is not parked is refused when filed.
  begin
    insert into public.approval_request
      (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, decided_at)
    values
      (gen_random_uuid(), 'projection-replay', operator, 'er-u', 'domain-event:' || pg_temp.id('e-mid'),
       jsonb_build_object('event_id', pg_temp.id('e-mid'), 'consumer', 'student-actions.grade-release.v1',
                          'projector_version', 'student-actions@1', 'rollback_plan', 'None needed.'),
       'Not parked.', 'ER-REPLAY-0', 'approved', now());
    raise exception 'FAILED: a replay approval for a live delivery was accepted';
  exception when sqlstate '23514' then
    raise notice 'ok  a replay approval for a delivery that is not parked is refused';
  end;

  insert into public.approval_request
    (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, decided_at)
  values
    (approval, 'projection-replay', operator, 'er-u', 'domain-event:' || ev,
     jsonb_build_object('event_id', ev, 'consumer', 'student-actions.grade-release.v1',
                        'projector_version', 'student-actions@1',
                        'rollback_plan', 'Dismiss the replayed actions and park the delivery again.'),
     'Planted failure removed.', 'ER-REPLAY-1', 'approved', now());

  message := pg_temp.err(operator, format('select public.replay_domain_event(%L, %L, %L)',
    ev, 'student-actions.grade-release.v1', approval), false);
  if message is null or (message not ilike '%Fresh MFA%' and message not ilike '%console:operate%') then
    raise exception 'FAILED: replay without fresh MFA was not refused (%)', message;
  end if;
  raise notice 'ok  replay without fresh MFA is refused (%)', message;
  message := pg_temp.err(pg_temp.id('ana'), format('select public.replay_domain_event(%L, %L, %L)',
    ev, 'student-actions.grade-release.v1', approval), true);
  if message not ilike '%console:operate%' then
    raise exception 'FAILED: a student replayed a dead letter (%)', message;
  end if;
  raise notice 'ok  a student cannot replay (%)', message;

  perform pg_temp.become(operator, true);
  result := public.replay_domain_event(ev, 'student-actions.grade-release.v1', approval, 'er-replay-check-1');
  perform pg_temp.nobody();
  perform pg_temp.said('the approved replay runs', result ->> 'replayed', 'true');
  perform pg_temp.counted('it is audited once, naming the consumer scope',
    (select count(*) from private.console_audit_event a
      where a.action = 'projection.replayed' and a.target = ev::text
        and a.correlation_id = 'er-replay-check-1'), 1);
  perform pg_temp.counted('the delivery is reset and due, and the event row still untouched',
    (select count(*) from private.domain_event_deliveries d
       join private.domain_outbox_events e on e.id = d.event_id
      where d.event_id = ev and d.consumer = 'student-actions.grade-release.v1'
        and d.dead_lettered_at is null and d.attempts = 0 and d.next_attempt_at <= now()
        and e.dead_lettered_at is null and e.published_at is null), 1);

  perform pg_temp.become(operator, true);
  result := public.replay_domain_event(ev, 'student-actions.grade-release.v1', approval);
  perform pg_temp.nobody();
  perform pg_temp.said('a second execution is a no-op', result ->> 'status', 'already_executed');
  perform pg_temp.counted('and writes no second audit row',
    (select count(*) from private.console_audit_event a where a.action = 'projection.replayed' and a.target = ev::text), 1);

  perform pg_temp.said('the next tick applies the replayed release', pg_temp.tick() ->> 'processed', '1');
  perform pg_temp.counted('one action from the replay', pg_temp.actions_of(ana, ps3), 1);
  perform pg_temp.said('and the tick after it claims nothing', pg_temp.tick() ->> 'claimed', '0');
  perform pg_temp.counted('still one', pg_temp.actions_of(ana, ps3), 1);
  perform pg_temp.said('the failed receipt became processed, one row',
    (select string_agg(x.outcome, ',') from private.domain_event_receipts x
      where x.event_id = ev and x.consumer = 'student-actions.grade-release.v1'), 'processed');
end $$;

-- ── The dashboard reads this consumer's own backlog ───────────────────────
do $$
declare d jsonb; m jsonb;
begin
  perform pg_temp.become(pg_temp.id('operator'), true);
  d := public.ops_projection_dashboard();
  perform pg_temp.nobody();
  select p into m from jsonb_array_elements(d -> 'data' -> 'projections') p where p ->> 'projection' = 'student_actions';
  perform pg_temp.said('student_actions is mapped on the dashboard', m ->> 'eventSourceMapped', 'true');
  perform pg_temp.said('its dead letters are this consumer''s parked deliveries (the forged one)', m ->> 'deadLetters', '1');
  perform pg_temp.said('and nothing is behind', m ->> 'eventsBehind', '0');
end $$;

-- ── What students read, and what they may change ──────────────────────────
do $$
declare
  ana uuid := pg_temp.id('ana'); ben uuid := pg_temp.id('ben'); dan uuid := pg_temp.id('dan'); cal uuid := pg_temp.id('cal');
  ps1 uuid := pg_temp.id('ps1');
  mine uuid;
  bens uuid;
  r jsonb;
begin
  perform pg_temp.counted('Ana reads her four actions', pg_temp.seen(ana, 'select * from public.my_student_actions()'), 4);
  perform pg_temp.counted('and the table shows her the same four', pg_temp.seen(ana, 'select * from public.student_actions'), 4);
  perform pg_temp.counted('Ben reads his one', pg_temp.seen(ben, 'select * from public.my_student_actions()'), 1);
  perform pg_temp.counted('Cal reads his one', pg_temp.seen(cal, 'select * from public.student_actions'), 1);
  perform pg_temp.counted('Dan reads none', pg_temp.seen(dan, 'select * from public.student_actions'), 0);
  perform pg_temp.counted('an instructor reads none of them', pg_temp.seen(pg_temp.id('prof'), 'select * from public.student_actions'), 0);
  perform pg_temp.said('the feed names the item and course',
    pg_temp.ask(ana, format($q$select item_title || ' · ' || course_code from public.my_student_actions() where item_id = %L$q$, ps1)),
    'Problem set 1 · ECON 1020');

  select a.id into mine from public.student_actions a where a.student_id = ana and a.item_id = ps1;
  select a.id into bens from public.student_actions a where a.student_id = ben and a.item_id = ps1;
  perform pg_temp.remember('ana-ps1-action', mine::text);

  perform pg_temp.refused('Ana updating her action directly', ana, format(
    $q$update public.student_actions set state = 'done' where id = %L$q$, mine), 'permission denied');
  perform pg_temp.refused('Ana inserting an action', ana, format(
    $q$insert into public.student_actions (tenant_id, student_id, kind, item_id, grade_entry_id, source_event_id)
       select tenant_id, student_id, kind, item_id, grade_entry_id, gen_random_uuid() from public.student_actions where id = %L$q$, mine),
    'permission denied');
  perform pg_temp.refused('Ana settling Ben''s action', ana, format(
    $q$select public.settle_student_action(%L, 'done', 1, 'er-ana-settles-ben')$q$, bens), 'No such action');

  r := pg_temp.ask(ana, format($q$select public.settle_student_action(%L, 'done', 1, 'er-ana-done-1')::text$q$, mine))::jsonb;
  perform pg_temp.said('Ana marks hers done against version 1', r ->> 'version', '2');
  r := pg_temp.ask(ana, format($q$select public.settle_student_action(%L, 'done', 1, 'er-ana-done-1')::text$q$, mine))::jsonb;
  perform pg_temp.said('the same key again is a replay, not a change', r ->> 'replayed', 'true');
  perform pg_temp.said('at version 2 still', r ->> 'version', '2');
  perform pg_temp.refused('a reopen against stale version 1', ana, format(
    $q$select public.settle_student_action(%L, 'open', 1, 'er-ana-open-stale')$q$, mine), 'changed since you read it');
  perform pg_temp.refused('the same key for another state', ana, format(
    $q$select public.settle_student_action(%L, 'dismissed', 2, 'er-ana-done-1')$q$, mine), 'used for another change');
  perform pg_temp.counted('done leaves the feed', pg_temp.seen(ana, format(
    'select * from public.my_student_actions() where id = %L', mine)), 0);
  r := pg_temp.ask(ana, format($q$select public.settle_student_action(%L, 'open', 2, 'er-ana-undo-1')::text$q$, mine))::jsonb;
  perform pg_temp.said('Undo reopens it at version 3', r ->> 'version', '3');
  perform pg_temp.counted('and it is back in the feed', pg_temp.seen(ana, format(
    'select * from public.my_student_actions() where id = %L', mine)), 1);
  r := pg_temp.ask(ana, format($q$select public.settle_student_action(%L, 'dismissed', 3, 'er-ana-dismiss-1')::text$q$, mine))::jsonb;
  perform pg_temp.said('Ana dismisses it at version 3', r ->> 'version', '4');
  perform pg_temp.said('a dismissed action stays in the feed, marked, so it can be brought back',
    pg_temp.ask(ana, format('select state from public.my_student_actions() where id = %L', mine)), 'dismissed');
  r := pg_temp.ask(ana, format($q$select public.settle_student_action(%L, 'open', 4, 'er-ana-undo-2')::text$q$, mine))::jsonb;
  perform pg_temp.said('and brought back at version 5', r ->> 'version', '5');
  perform pg_temp.counted('Ben''s action was never touched',
    (select count(*) from public.student_actions a where a.id = bens and a.version = 1 and a.state = 'open'), 1);
end $$;

-- ── A grade changed after release ─────────────────────────────────────────
do $$
declare
  ana uuid := pg_temp.id('ana');
  ps1 uuid := pg_temp.id('ps1');
  old_action uuid := pg_temp.id('ana-ps1-action');
  r jsonb;
begin
  perform pg_temp.become(pg_temp.id('prof'));
  perform public.gradebook_enter(ps1, ana, 10, null, 'Regraded', 'Question 3 was marked wrongly', 'er-change-ana-ps1');
  perform pg_temp.nobody();
  perform pg_temp.counted('while the change is a draft, the old action stays: it is the grade Ana is shown',
    pg_temp.seen(ana, format('select * from public.my_student_actions() where item_id = %L', ps1)), 1);
  perform pg_temp.said('a tick makes nothing for a draft', pg_temp.tick() ->> 'claimed', '0');

  perform pg_temp.become(pg_temp.id('coprof'));
  perform public.gradebook_moderate(ps1, ana, 'er-mod-change-ana-ps1');
  perform pg_temp.nobody();
  perform pg_temp.become(pg_temp.id('prof'));
  perform public.gradebook_release(ps1, 'er-release-ps1-c');
  perform pg_temp.nobody();
  r := pg_temp.tick();
  perform pg_temp.said('the re-release makes one new action', r ->> 'actions', '1');
  perform pg_temp.counted('Ana holds two action rows for problem set 1', pg_temp.actions_of(ana, ps1), 2);
  perform pg_temp.counted('but her feed shows one for it', pg_temp.seen(ana, format(
    'select * from public.my_student_actions() where item_id = %L', ps1)), 1);
  perform pg_temp.counted('and it is the new one, on the latest released version',
    pg_temp.seen(ana, format('select * from public.my_student_actions() where item_id = %L and id <> %L', ps1, old_action)), 1);
  perform pg_temp.refused('settling the replaced action', ana, format(
    $q$select public.settle_student_action(%L, 'done', 5, 'er-ana-done-old')$q$, old_action), 'replaced by a newer release');
end $$;

rollback;
