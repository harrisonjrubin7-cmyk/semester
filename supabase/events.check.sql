-- supabase/events.check.sql — who proposes an event, who publishes it, what an
-- RSVP is, and that the waitlist is the server's order.
--
-- For 20261001090000_events.sql. One school, ev-u: two events managers, five
-- members and a manager of another school. What it proves:
--
--   * nothing is written unless the school runs `events` in Core;
--   * any member proposes an event for a community or a course, only the events
--     office an office event; a manager decides it, never their own proposal;
--     members read only published events, the proposer and managers read all;
--   * an event that names a space needs scheduling in Core and books it on
--     publication, refusing a room that is taken, and cancelling frees it;
--   * a member RSVPs going or cancels, in versions; past the capacity is the
--     waitlist, in the order received, and a freed place promotes the earliest in
--     the same transaction; members see counts, never who;
--   * a published event is cancelled with a reason, not deleted; a past or
--     cancelled event takes no RSVP;
--   * deleting a member takes their RSVPs and events; staff names are cleared.
--
--   How to run it: supabase/check.sh events

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

create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
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

-- A ledger entry, written directly (the ledger's own path has its own suite).
create or replace function pg_temp.entry(school text, who text, kind text, subject text, val text, ago integer default 30)
returns void language plpgsql as $$
declare ch uuid := gen_random_uuid();
begin
  set local session_replication_role = replica;
  insert into public.academic_record_entries
    (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, change_id, override)
  values (school, who, kind, subject, 'set', val, current_date - ago, 'seed for the check', 'registrar', ch, false);
  set local session_replication_role = origin;
end $$;

do $$
declare
  mgr uuid; mgr2 uuid; ana uuid; ben uuid; cara uuid; dan uuid; eve uuid; outsider uuid;
  e1 jsonb; e2 jsonb; e3 jsonb; e4 jsonb; eh jsonb; r jsonb; r2 jsonb; sp uuid; n bigint;
  t0 constant text := $t$date_trunc('hour', now()) + interval '3 days'$t$;
  prop_sql constant text := $q$select public.event_propose(%L, %L, %L, 'About it', 'Quad', %L, %s, %s, %s, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('ev-u', 'Events University', array['ev-u.example']), ('ev-other', 'Other University', array['ev-other.example']);
  mgr  := pg_temp.newuser('mgr@ev-u.example', 'ev-u');
  mgr2 := pg_temp.newuser('mgr2@ev-u.example', 'ev-u');
  ana  := pg_temp.newuser('ana@ev-u.example', 'ev-u');
  ben  := pg_temp.newuser('ben@ev-u.example', 'ev-u');
  cara := pg_temp.newuser('cara@ev-u.example', 'ev-u');
  dan  := pg_temp.newuser('dan@ev-u.example', 'ev-u');
  eve  := pg_temp.newuser('eve@ev-u.example', 'ev-u');
  outsider := pg_temp.newuser('outsider@ev-other.example', 'ev-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr, 'events_manager', 'school', 'ev-u', 'institution'), (mgr2, 'events_manager', 'school', 'ev-u', 'institution'),
    (outsider, 'events_manager', 'school', 'ev-other', 'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('proposing while the school is in Connect', ana,
    format(prop_sql, 'community', 'Econ club', 'Talk', '', t0 || ' + interval ''1 hour''', t0 || ' + interval ''2 hours''', '10', 'prop-connect-key'), 'does not run events in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('ev-u', 'events', 'core', false, 'check');

  -- ── Proposing ──────────────────────────────────────────────────
  perform pg_temp.refused_for('proposing the past', ana, format(prop_sql, 'community', 'Econ club', 'Talk', '', 'now() - interval ''2 days''', 'now() - interval ''2 days'' + interval ''1 hour''', '10', 'prop-past-key001'), 'in the future');
  perform pg_temp.refused_for('a member proposing an office event', ana, format(prop_sql, 'office', 'Registrar', 'Open house', '', t0 || ' + interval ''1 hour''', t0 || ' + interval ''2 hours''', '10', 'prop-office-key01'), 'events office');
  perform pg_temp.refused_for('an event of over fourteen days', ana, format(prop_sql, 'community', 'Econ club', 'Long', '', t0, t0 || ' + interval ''15 days''', '10', 'prop-long-key001'), 'campus_event_window');
  perform pg_temp.refused_for('a capacity of zero', ana, format(prop_sql, 'community', 'Econ club', 'Zero', '', t0 || ' + interval ''1 hour''', t0 || ' + interval ''2 hours''', '0', 'prop-zero-key001'), 'check');
  perform pg_temp.refused_for('an event that names a space while scheduling is not in Core', ana, format(prop_sql, 'community', 'Econ club', 'In a hall', 'HALL-101', t0 || ' + interval ''1 hour''', t0 || ' + interval ''2 hours''', '10', 'prop-space-key01'), 'does not run scheduling in Core');
  e1 := pg_temp.ask(ana, format(prop_sql, 'community', 'Econ club', 'Economics talk', '', t0 || ' + interval ''5 hours''', t0 || ' + interval ''6 hours''', '2', 'prop-ana-key0001'))::jsonb;
  r2 := pg_temp.ask(ana, format(prop_sql, 'community', 'Econ club', 'Economics talk', '', t0 || ' + interval ''5 hours''', t0 || ' + interval ''6 hours''', '2', 'prop-ana-key0001'))::jsonb;
  perform pg_temp.said('the same key answers the same event', r2->>'id', e1->>'id');
  perform pg_temp.counted('and proposed one', (select count(*) from public.campus_events), 1);
  perform pg_temp.counted('Ana reads her proposal', pg_temp.seen(ana, 'select 1 from public.campus_events'), 1);
  perform pg_temp.counted('Ben does not read an unpublished event', pg_temp.seen(ben, 'select 1 from public.campus_events'), 0);
  perform pg_temp.counted('the manager does', pg_temp.seen(mgr, 'select 1 from public.campus_events'), 1);
  perform pg_temp.counted('a manager of another school does not', pg_temp.seen(outsider, 'select 1 from public.campus_events'), 0);
  perform pg_temp.refused_for('an RSVP to an unpublished event', ben, format($q$select public.event_rsvp(%L, true, 'rsvp-early-key01')$q$, e1->>'id'), 'no such event');

  -- ── Deciding ───────────────────────────────────────────────────
  perform pg_temp.refused_for('a member deciding', ben, format($q$select public.event_decide(%L, true, '', 'dec-ben-key0001')$q$, e1->>'id'), 'that needs events:manage');
  e2 := pg_temp.ask(mgr, format(prop_sql, 'course', 'ECON 1020', 'Study session', '', t0 || ' + interval ''7 hours''', t0 || ' + interval ''8 hours''', '5', 'prop-mgr-key0001'))::jsonb;
  perform pg_temp.refused_for('a manager deciding their own proposal', mgr, format($q$select public.event_decide(%L, true, '', 'dec-self-key001')$q$, e2->>'id'), 'someone other than who proposed');
  r := pg_temp.ask(mgr, format($q$select public.event_decide(%L, true, 'Welcome.', 'dec-mgr-key0001')$q$, e1->>'id'))::jsonb;
  r2 := pg_temp.ask(mgr, format($q$select public.event_decide(%L, true, 'Welcome.', 'dec-mgr-key0001')$q$, e1->>'id'))::jsonb;
  perform pg_temp.said('publishing, and the same key answers the same', r2::text, r::text);
  perform pg_temp.refused_for('deciding it again', mgr2, format($q$select public.event_decide(%L, false, '', 'dec-mgr-key0002')$q$, e1->>'id'), 'already decided');
  perform pg_temp.works('declining the other', mgr2, format($q$select public.event_decide(%L, false, 'Not this term.', 'dec-mgr2-key001')$q$, e2->>'id'));
  perform pg_temp.counted('Ben now reads the published event', pg_temp.seen(ben, 'select 1 from public.campus_events'), 1);
  perform pg_temp.counted('and not the declined one', pg_temp.seen(ben, 'select 1 from public.campus_events where host_kind = ''course'''), 0);
  perform pg_temp.counted('Mgr, who proposed the declined one, still reads it', pg_temp.seen(mgr, 'select 1 from public.campus_events where host_kind = ''course'''), 1);
  perform pg_temp.refused_for('a client writing an event directly', ana, format($q$insert into public.campus_events (tenant_id, host_kind, host_ref, title, starts_at, ends_at, proposer, operation) values ('ev-u', 'community', 'x', 'x', now() + interval '1 day', now() + interval '2 days', %L, 'x')$q$, ana), 'permission denied');
  begin
    update public.campus_events set title = 'Rewritten';
    raise exception 'FAILED: an event was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  an event is never rewritten (%)', sqlerrm;
  end;

  -- ── RSVPs and the waitlist ─────────────────────────────────────
  r := pg_temp.ask(ana, format($q$select public.event_rsvp(%L, true, 'rsvp-ana-key001')$q$, e1->>'id'))::jsonb;
  r2 := pg_temp.ask(ana, format($q$select public.event_rsvp(%L, true, 'rsvp-ana-key001')$q$, e1->>'id'))::jsonb;
  perform pg_temp.said('going, and the same key answers the same', (r->>'status') || (r2->>'status'), 'goinggoing');
  perform pg_temp.refused_for('going twice', ana, format($q$select public.event_rsvp(%L, true, 'rsvp-ana-key002')$q$, e1->>'id'), 'already answered going');
  perform pg_temp.said('Ben takes the second place', pg_temp.ask(ben, format($q$select (public.event_rsvp(%L, true, 'rsvp-ben-key001'))->>'status'$q$, e1->>'id')), 'going');
  perform pg_temp.said('Cara is waitlisted past the capacity of two', pg_temp.ask(cara, format($q$select (public.event_rsvp(%L, true, 'rsvp-cara-key01'))->>'status'$q$, e1->>'id')), 'waitlisted');
  perform pg_temp.said('Dan is waitlisted after her', pg_temp.ask(dan, format($q$select (public.event_rsvp(%L, true, 'rsvp-dan-key001'))->>'status'$q$, e1->>'id')), 'waitlisted');
  perform pg_temp.said('members see counts, never who', pg_temp.ask(eve, format($q$select (public.event_headcount(%L))::text$q$, e1->>'id')), '{"going": 2, "waitlisted": 2}');
  perform pg_temp.counted('Eve reads no RSVP rows', pg_temp.seen(eve, 'select 1 from public.event_rsvps'), 0);
  perform pg_temp.counted('Ben, who did not propose it, reads only his own', pg_temp.seen(ben, 'select 1 from public.event_rsvps'), 1);
  perform pg_temp.counted('the proposer reads the list', pg_temp.seen(ana, 'select 1 from public.event_rsvps'), 4);
  perform pg_temp.counted('the manager reads the list', pg_temp.seen(mgr, 'select 1 from public.event_rsvps'), 4);
  perform pg_temp.counted('Cara reads only her own', pg_temp.seen(cara, 'select 1 from public.event_rsvps'), 1);

  perform pg_temp.said('Ana cancels', pg_temp.ask(ana, format($q$select (public.event_rsvp(%L, false, 'rsvp-ana-key003'))->>'status'$q$, e1->>'id')), 'cancelled');
  perform pg_temp.said('the earliest waiting member, Cara, is promoted in the same transaction',
    (select status from private.events_latest((e1->>'id')::uuid) where member = cara), 'going');
  perform pg_temp.said('and Dan still waits', (select status from private.events_latest((e1->>'id')::uuid) where member = dan), 'waitlisted');
  perform pg_temp.works('Ben cancelling', ben, format($q$select public.event_rsvp(%L, false, 'rsvp-ben-key002')$q$, e1->>'id'));
  perform pg_temp.said('Dan is promoted next', (select status from private.events_latest((e1->>'id')::uuid) where member = dan), 'going');
  perform pg_temp.refused_for('cancelling an RSVP that is not there', eve, format($q$select public.event_rsvp(%L, false, 'rsvp-eve-key001')$q$, e1->>'id'), 'no RSVP to cancel');
  perform pg_temp.said('Ana going again finds it full again, so she waits (a new version)', pg_temp.ask(ana, format($q$select (public.event_rsvp(%L, true, 'rsvp-ana-key004'))->>'status'$q$, e1->>'id')), 'waitlisted');
  perform pg_temp.counted('Ana now has three versions, none rewritten', (select count(*) from public.event_rsvps where member = ana), 3);
  perform pg_temp.said('and the full event waitlists Ben when he returns', pg_temp.ask(ben, format($q$select (public.event_rsvp(%L, true, 'rsvp-ben-key003'))->>'status'$q$, e1->>'id')), 'waitlisted');
  begin
    update public.event_rsvps set status = 'going';
    raise exception 'FAILED: an RSVP was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  an RSVP is never rewritten (%)', sqlerrm;
  end;

  -- ── Spaces ─────────────────────────────────────────────────────
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('ev-u', 'scheduling', 'core', false, 'check');
  insert into public.campus_spaces (tenant_id, code, name, capacity) values ('ev-u', 'HALL-101', 'Hall 101', 100) returning id into sp;
  perform pg_temp.refused_for('an event naming a space that does not exist', ana, format(prop_sql, 'community', 'Econ club', 'In a hall', 'NOPE-9', t0 || ' + interval ''20 hours''', t0 || ' + interval ''21 hours''', '10', 'prop-nospace-ky1'), 'cannot be booked');
  e3 := pg_temp.ask(ana, format(prop_sql, 'community', 'Econ club', 'Hall talk', 'hall-101', t0 || ' + interval ''20 hours''', t0 || ' + interval ''21 hours''', '10', 'prop-hall-key0001'))::jsonb;
  insert into public.space_bookings (tenant_id, space_id, requester, purpose, title, starts_at, ends_at, status, operation)
  select 'ev-u', sp, ben, 'meeting', 'Already there', date_trunc('hour', now()) + interval '3 days 20 hours 30 minutes', date_trunc('hour', now()) + interval '3 days 22 hours', 'confirmed', 'x';
  perform pg_temp.refused_for('publishing an event into a room that is taken', mgr, format($q$select public.event_decide(%L, true, '', 'dec-hall-key001')$q$, e3->>'id'), 'already booked');
  perform pg_temp.counted('and nothing was published', (select count(*) from public.event_decisions where event_id = (e3->>'id')::uuid), 0);
  update public.space_bookings set status = 'cancelled' where title = 'Already there';
  perform pg_temp.works('publishing once the room is free', mgr, format($q$select public.event_decide(%L, true, '', 'dec-hall-key002')$q$, e3->>'id'));
  perform pg_temp.said('it wrote a confirmed event booking', (select b.status || ':' || b.purpose from public.space_bookings b join public.event_decisions d on d.booking_id = b.id where d.event_id = (e3->>'id')::uuid), 'confirmed:event');

  -- ── Direct publication ─────────────────────────────────────────
  perform pg_temp.refused_for('a member publishing directly', ana, format($q$select public.event_publish_direct('Registrar', 'Open house', '', 'Quad', '', %s, %s, 50, 'direct-ana-key01')$q$, t0 || ' + interval ''30 hours''', t0 || ' + interval ''31 hours'''), 'that needs events:manage');
  eh := pg_temp.ask(mgr, format($q$select public.event_publish_direct('Registrar', 'Open house', 'Come see us', 'Quad', 'HALL-101', %s, %s, 50, 'direct-mgr-key01')$q$, t0 || ' + interval ''30 hours''', t0 || ' + interval ''31 hours'''))::jsonb;
  perform pg_temp.said('a manager publishes an office event at once', eh->>'status', 'published');
  perform pg_temp.said('and Ben reads it', pg_temp.seen(ben, 'select 1 from public.campus_events where host_kind = ''office''')::text, '1');
  perform pg_temp.refused_for('a second office event in the same hall and hour', mgr2, format($q$select public.event_publish_direct('Dean', 'Reception', '', 'Quad', 'HALL-101', %s, %s, 50, 'direct-mgr-key02')$q$, t0 || ' + interval ''30 hours 15 minutes''', t0 || ' + interval ''31 hours'''), 'already booked');

  -- ── Cancelling ─────────────────────────────────────────────────
  perform pg_temp.refused_for('a member cancelling someone else''s event', ben, format($q$select public.event_cancel(%L, 'Because I would like to', 'cancel-ben-key01')$q$, e3->>'id'), 'only who proposed');
  perform pg_temp.refused_for('a cancellation with no real reason', ana, format($q$select public.event_cancel(%L, 'no', 'cancel-ana-key01')$q$, e3->>'id'), 'check');
  perform pg_temp.works('the proposer cancelling', ana, format($q$select public.event_cancel(%L, 'The speaker is unwell.', 'cancel-ana-key02')$q$, e3->>'id'));
  perform pg_temp.refused_for('cancelling twice', mgr, format($q$select public.event_cancel(%L, 'Already cancelled above.', 'cancel-mgr-key01')$q$, e3->>'id'), 'only a published event');
  perform pg_temp.said('the event''s booking was cancelled with it', (select b.status from public.space_bookings b join public.event_decisions d on d.booking_id = b.id where d.event_id = (e3->>'id')::uuid), 'cancelled');
  perform pg_temp.counted('Ben no longer reads the cancelled event', pg_temp.seen(ben, 'select 1 from public.campus_events where title = ''Hall talk'''), 0);
  perform pg_temp.counted('its proposer still does', pg_temp.seen(ana, 'select 1 from public.campus_events where title = ''Hall talk'''), 1);
  perform pg_temp.refused_for('an RSVP to a cancelled event', ben, format($q$select public.event_rsvp(%L, true, 'rsvp-ben-key004')$q$, e3->>'id'), 'no such event');
  perform pg_temp.works('a manager cancelling the office event', mgr2, format($q$select public.event_cancel(%L, 'The hall is needed for an exam.', 'cancel-mgr2-key1')$q$, eh->>'id'));

  -- A past event cannot be joined.
  insert into public.campus_events (tenant_id, host_kind, host_ref, title, starts_at, ends_at, proposer, operation)
  values ('ev-u', 'community', 'Econ club', 'Last week', now() - interval '8 days', now() - interval '7 days', ana, 'x') returning id into sp;
  insert into public.event_decisions (event_id, tenant_id, decision) values (sp, 'ev-u', 'published');
  perform pg_temp.refused_for('an RSVP to an event that is over', ben, format($q$select public.event_rsvp(%L, true, 'rsvp-ben-key005')$q$, sp), 'is over');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'ev-u' and module = 'events';
  perform pg_temp.refused_for('an RSVP while the module is frozen', eve, format($q$select public.event_rsvp(%L, true, 'rsvp-frozen-key1')$q$, e1->>'id'), 'does not run events in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'ev-u' and module = 'events';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('ev-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('proposing under the kill switch', eve, format(prop_sql, 'community', 'Club', 'Killed', '', t0 || ' + interval ''40 hours''', t0 || ' + interval ''41 hours''', '10', 'prop-killed-key1'), 'does not run events in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'ev-u';

  -- ── Deleting accounts ──────────────────────────────────────────
  perform pg_temp.said('an account that RSVPed is not untouched', public.lti_account_untouched(dan)::text, 'false');
  perform pg_temp.said('one that proposed is not', public.lti_account_untouched(ana)::text, 'false');
  perform pg_temp.said('one that did neither is', public.lti_account_untouched(eve)::text, 'true');
  delete from auth.users where id = dan;
  perform pg_temp.counted('deleting Dan took his RSVPs', (select count(*) from public.event_rsvps where member = dan), 0);
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting the proposer took her events', (select count(*) from public.campus_events where proposer = ana), 0);
  delete from auth.users where id = mgr2;
  perform pg_temp.counted('deleting a manager keeps their decisions and cancellations', (select count(*) from public.event_decisions where decided_by is null) + (select count(*) from public.event_cancellations where cancelled_by is null), 1 + 1);
  raise notice 'events checks passed';
end $$;

rollback;
