-- supabase/registration-hold-resolution.check.sql — the office that placed a
-- registration hold resolves it, nobody else does, and readiness that was
-- worked out while it stood stops counting as current.
--
-- For 20261020120000_registration_hold_resolution.sql. One school, hr-u, with
-- a bursar's office and a financial-aid office, a registrar, two students, a
-- second bursar, and a bursar and a student at another school. What it proves:
--
--   * the owning office resolves its hold, gets a receipt that says it is not
--     enrollment, and the audit row and the outbox event commit with it;
--   * another office, the registrar, the student, and an office at another
--     school cannot; a hold no office owns cannot be resolved here at all;
--   * the same key replays the same receipt and writes nothing; the same key
--     for another hold is refused; a hold already released is `stale_hold`;
--   * the kill switch and the school's flag stop it;
--   * the event carries no student id and no free text, and a failure after
--     the release rolls the release, the audit row and the event back together;
--   * an evaluation that had read the hold reads `stale` afterwards — to the
--     service store and to the student — and can move only to reconciling, so
--     it can never be saved `ready` from before the change; after
--     reconciliation a fresh generation can be;
--   * `registration_enroll` still checks everything again: another office's
--     hold still blocks, and a missing prerequisite still refuses.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh registration-hold-resolution

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

-- Refused, and for the reason named — not for some other fault a broken
-- fixture could give.
create or replace function pg_temp.refused(what text, who uuid, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then
    raise exception 'FAILED: % — refused, but not because %: %', what, because, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- The same, for the service role's store: run as the session, no account.
create or replace function pg_temp.raises(what text, statement text, because text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm not like '%' || because || '%' then
      raise exception 'FAILED: % — refused, but not because %: %', what, because, sqlerrm;
    end if;
    raise notice 'ok  % is refused (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — was allowed', what;
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

-- A readiness command as the TypeScript aggregate would hand it to the store.
create or replace function pg_temp.step(
  eid text, subject text, version integer, state text, generation integer, projection integer,
  key text, correlation text, event_type text, updated text, tasks jsonb default '[]'::jsonb, term text default '2026FA')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'record', jsonb_build_object(
      'id', eid, 'tenantId', 'hr-u', 'subjectId', subject, 'termId', term,
      'requestedBy', subject, 'state', state, 'version', version,
      'generation', generation, 'projectionVersion', projection,
      'createdAt', '2026-10-01T00:00:00.000Z', 'updatedAt', updated,
      'reconciliationTasks', tasks, 'commandLedger', '[]'::jsonb),
    'receipt', jsonb_build_object(
      'id', key,
      'status', case when state in ('requested', 'evaluating', 'reconciling') then 'pending' else 'completed' end,
      'state', state, 'recordVersion', version, 'recordedAt', updated, 'correlationId', correlation),
    'event', jsonb_build_object(
      'eventType', event_type, 'aggregateId', eid, 'idempotencyKey', key, 'correlationId', correlation,
      'payload', jsonb_build_object('evaluationId', eid, 'termId', term, 'version', version)),
    'replayed', false);
$$;

do $$
declare
  bursar uuid; bursar2 uuid; aid uuid; registrar uuid; maya uuid; ben uuid;
  away_bursar uuid; away uuid;
  h_bursar uuid; h_aid uuid; h_ben uuid; h_sis uuid; h_away uuid;
  econ uuid; hist uuid;
  r jsonb; again jsonb;
  resolve constant text := $q$select public.registration_hold_resolve(%L::uuid, %L, %L)::text$q$;
  enroll constant text := $q$select public.registration_enroll(%L::uuid, %L, 'seat')::text$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('hr-u', 'Hold University', array['hr-u.example']),
    ('hr-other', 'Other University', array['hr-other.example']);
  insert into public.tenant_feature_policy (tenant_id, capability, state) values
    ('hr-u', 'writeback.registration_submit', 'production'),
    ('hr-other', 'writeback.registration_submit', 'sandbox');

  bursar      := pg_temp.newuser('bursar@hr-u.example', 'hr-u');
  bursar2     := pg_temp.newuser('bursar.two@hr-u.example', 'hr-u');
  aid         := pg_temp.newuser('aid@hr-u.example', 'hr-u');
  registrar   := pg_temp.newuser('registrar@hr-u.example', 'hr-u');
  maya        := pg_temp.newuser('maya@hr-u.example', 'hr-u');
  ben         := pg_temp.newuser('ben@hr-u.example', 'hr-u');
  away_bursar := pg_temp.newuser('bursar@hr-other.example', 'hr-other');
  away        := pg_temp.newuser('away@hr-other.example', 'hr-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (bursar,      'student_accounts_officer', 'office', 'hr-u/bursar',     'institution'),
    (bursar2,     'student_accounts_officer', 'office', 'hr-u/bursar',     'institution'),
    (aid,         'financial_aid_officer',    'office', 'hr-u/aid',        'institution'),
    (registrar,   'registrar',                'school', 'hr-u',            'institution'),
    (away_bursar, 'student_accounts_officer', 'office', 'hr-other/bursar', 'institution');

  -- The term, an open section and one that needs a course Maya has not passed.
  perform pg_temp.works('the registrar sets the term', registrar,
    format($q$select public.registrar_put_term('2026FA', %L, %L, %L, 18)$q$, now() - interval '1 day', now() + interval '10 days', now() + interval '20 days'));
  econ := pg_temp.ask(registrar, $q$select public.registrar_put_section('2026FA', 'ECON 1020', '01', 'Principles', 3, 10, 0, '[]'::jsonb, '{}', false)::text$q$)::uuid;
  hist := pg_temp.ask(registrar, $q$select public.registrar_put_section('2026FA', 'HIST 3000', '01', 'Seminar', 3, 10, 0, '[]'::jsonb, array['HIST 2000'], false)::text$q$)::uuid;

  -- The holds, as the SIS sync writes them.
  insert into public.registration_holds (tenant_id, student, office, owner_office, reason) values
    ('hr-u', maya, 'Bursar', 'hr-u/bursar', 'Unpaid balance of $1,200') returning id into h_bursar;
  insert into public.registration_holds (tenant_id, student, office, owner_office, reason, placed_at) values
    ('hr-u', maya, 'Financial Aid', 'hr-u/aid', 'Verification documents missing', now() + interval '1 second') returning id into h_aid;
  insert into public.registration_holds (tenant_id, student, office, owner_office) values
    ('hr-u', ben, 'Bursar', 'hr-u/bursar') returning id into h_ben;
  insert into public.registration_holds (tenant_id, student, office) values
    ('hr-u', ben, 'Dean of Students') returning id into h_sis;
  insert into public.registration_holds (tenant_id, student, office, owner_office) values
    ('hr-other', away, 'Bursar', 'hr-other/bursar') returning id into h_away;

  -- What the readiness store already holds: Maya ready for fall, an
  -- evaluation of hers in flight, one not yet started, and Ben's.
  insert into private.registration_readiness_evaluations
    (id, tenant_id, subject_id, term_id, requested_by, state, version, generation, projection_version, created_at, updated_at) values
    ('hr-maya-fa', 'hr-u', maya::text, '2026FA', maya::text, 'ready',      3, 1, 1,    '2026-10-01T00:00:00Z', '2026-10-01T00:03:00Z'),
    ('hr-maya-sp', 'hr-u', maya::text, '2027SP', maya::text, 'evaluating', 2, 1, null, '2026-10-01T00:00:00Z', '2026-10-01T00:02:00Z'),
    ('hr-maya-su', 'hr-u', maya::text, '2027SU', maya::text, 'requested',  1, 1, null, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ('hr-ben-fa',  'hr-u', ben::text,  '2026FA', ben::text,  'ready',      3, 1, 1,    '2026-10-01T00:00:00Z', '2026-10-01T00:03:00Z');

  -- ── Where it starts ─────────────────────────────────────────────────────
  perform pg_temp.said('the hold blocks Maya enrolling',
    (pg_temp.ask(maya, format(enroll, econ, 'hr-maya-enroll-1'))::jsonb)->>'reason', 'hold');
  perform pg_temp.said('her fall readiness reads ready before anything changes',
    public.registration_readiness_get('hr-u', 'hr-maya-fa')->>'state', 'ready');
  perform pg_temp.counted('Maya reads her own three evaluations', pg_temp.seen(maya, 'select * from public.my_registration_readiness()'), 3);
  perform pg_temp.counted('and none of them is stale yet',
    pg_temp.seen(maya, $q$select * from public.my_registration_readiness() where state = 'stale'$q$), 0);
  perform pg_temp.counted('Ben reads only his own', pg_temp.seen(ben, 'select * from public.my_registration_readiness()'), 1);

  -- ── Which office sees which holds ───────────────────────────────────────
  perform pg_temp.counted('the bursar lists the bursar''s two open holds',
    pg_temp.seen(bursar, $q$select * from public.registration_holds_for_office('hr-u/bursar')$q$), 2);
  perform pg_temp.refused('the bursar listing financial aid''s', bursar,
    $q$select * from public.registration_holds_for_office('hr-u/aid')$q$, 'only that office can list its holds');
  perform pg_temp.refused('the registrar listing the bursar''s', registrar,
    $q$select * from public.registration_holds_for_office('hr-u/bursar')$q$, 'only that office can list its holds');
  perform pg_temp.refused('the student listing the bursar''s', maya,
    $q$select * from public.registration_holds_for_office('hr-u/bursar')$q$, 'only that office can list its holds');
  perform pg_temp.refused('another school''s bursar naming this school''s office', away_bursar,
    $q$select * from public.registration_holds_for_office('hr-u/bursar')$q$, 'only that office can list its holds');
  perform pg_temp.refused('a student updating a hold directly', maya,
    format('update public.registration_holds set released_at = now() where id = %L', h_bursar), 'permission denied');

  -- ── Who may resolve ─────────────────────────────────────────────────────
  perform pg_temp.refused('financial aid resolving the bursar''s hold', aid,
    format(resolve, h_bursar, 'hr-aid-on-bursar', 'held'), 'only the office that placed this hold can resolve it');
  perform pg_temp.refused('the registrar resolving it', registrar,
    format(resolve, h_bursar, 'hr-registrar-on-bursar', 'held'), 'only the office that placed this hold can resolve it');
  perform pg_temp.refused('the student resolving their own hold', maya,
    format(resolve, h_bursar, 'hr-maya-on-bursar', 'held'), 'only the office that placed this hold can resolve it');
  perform pg_temp.refused('nobody signed in', null,
    format(resolve, h_bursar, 'hr-anon-on-bursar', 'held'), 'not signed in');
  perform pg_temp.said('another school''s bursar finds no such hold here',
    (pg_temp.ask(away_bursar, format(resolve, h_bursar, 'hr-away-on-bursar', 'held'))::jsonb)->>'reason', 'unknown_hold');
  perform pg_temp.refused('a hold no office owns, even by the bursar', bursar,
    format(resolve, h_sis, 'hr-bursar-on-sis', 'held'), 'only the office that placed this hold can resolve it');
  perform pg_temp.refused('resolving without saying it is still held', bursar,
    format(resolve, h_bursar, 'hr-bursar-noexpect', null), 'say the hold is still held');
  perform pg_temp.counted('none of that released anything',
    (select count(*) from public.registration_holds where released_at is not null), 0);
  perform pg_temp.counted('or wrote an event',
    (select count(*) from private.domain_outbox_events where aggregate_type = 'registration_hold'), 0);

  -- The other school's flag is off: its own office is told so, then it works.
  perform pg_temp.said('a school whose registration is off keeps its holds in its SIS',
    (pg_temp.ask(away_bursar, format(resolve, h_away, 'hr-away-own-1', 'held'))::jsonb)->>'reason', 'flag_off');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'hr-other' and capability = 'writeback.registration_submit';
  perform pg_temp.said('and once it is on, that office resolves its own',
    (pg_temp.ask(away_bursar, format(resolve, h_away, 'hr-away-own-1', 'held'))::jsonb)->>'outcome', 'hold_resolved');

  -- A kill switch stops it, and nothing is written.
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('hr-u', 'kill.writeback', true, 'hold resolution check', now());
  perform pg_temp.said('a kill switch stops the bursar',
    (pg_temp.ask(bursar, format(resolve, h_bursar, 'hr-bursar-killed', 'held'))::jsonb)->>'reason', 'kill_switch');
  delete from public.feature_kill_switch where tenant_id = 'hr-u' and switch_key = 'kill.writeback';

  -- A failure after the release takes the release, the audit row and the
  -- event with it: one transaction, not three.
  create function public.hr_check_refuse_outbox() returns trigger language plpgsql as $f$
  begin raise exception 'outbox refused for the check'; end $f$;
  create trigger hr_check_refuse_outbox before insert on private.domain_outbox_events
    for each row when (new.aggregate_type = 'registration_hold') execute function public.hr_check_refuse_outbox();
  perform pg_temp.refused('a resolve whose event cannot be written', bursar,
    format(resolve, h_bursar, 'hr-bursar-no-outbox', 'held'), 'outbox refused for the check');
  drop trigger hr_check_refuse_outbox on private.domain_outbox_events;
  drop function public.hr_check_refuse_outbox();
  perform pg_temp.counted('left the hold held',
    (select count(*) from public.registration_holds where id = h_bursar and released_at is null), 1);
  perform pg_temp.counted('and wrote no audit row',
    (select count(*) from public.registration_audit_event where action = 'hold_resolved' and tenant_id = 'hr-u'), 0);
  perform pg_temp.said('and left the readiness as it was',
    public.registration_readiness_get('hr-u', 'hr-maya-fa')->>'state', 'ready');

  -- ── The owning office resolves it ───────────────────────────────────────
  r := pg_temp.ask(bursar, format(resolve, h_bursar, 'hr-bursar-key-1', 'held'))::jsonb;
  perform pg_temp.said('the bursar resolves the bursar''s hold', r->>'outcome', 'hold_resolved');
  perform pg_temp.said('the receipt says it is not enrollment',
    (r->>'message' like '%This is not enrollment%')::text, 'true');
  perform pg_temp.said('it names the hold and the office', r->'hold'->>'office', 'hr-u/bursar');
  perform pg_temp.said('and marks the two evaluations that had read it', r->>'readiness_marked_stale', '2');
  perform pg_temp.counted('the hold is released',
    (select count(*) from public.registration_holds where id = h_bursar and released_at is not null), 1);
  perform pg_temp.counted('one audit row says so',
    (select count(*) from public.registration_audit_event
      where action = 'hold_resolved' and tenant_id = 'hr-u' and actor = bursar and student = maya), 1);
  perform pg_temp.counted('the event committed with it',
    (select count(*) from private.domain_outbox_events
      where event_type = 'registration.hold_resolved' and aggregate_id = h_bursar::text), 1);
  perform pg_temp.counted('the event names neither the student nor the reason',
    (select count(*) from private.domain_outbox_events
      where aggregate_id = h_bursar::text
        and (payload::text like '%' || maya::text || '%' or payload::text like '%balance%' or payload::text like '%Bursar%')), 0);
  perform pg_temp.said('its payload is the hold and its office, nothing else',
    (select string_agg(k, ',' order by k) from private.domain_outbox_events e, jsonb_object_keys(e.payload) k
      where e.aggregate_id = h_bursar::text), 'hold,office');

  -- ── Idempotent, and guarded by what the office saw ──────────────────────
  again := pg_temp.ask(bursar, format(resolve, h_bursar, 'hr-bursar-key-1', 'held'))::jsonb;
  perform pg_temp.said('the same key replays the receipt', again->>'replayed', 'true');
  perform pg_temp.said('with the same resolution time', again->>'resolved_at', r->>'resolved_at');
  perform pg_temp.counted('and writes no second event',
    (select count(*) from private.domain_outbox_events where aggregate_id = h_bursar::text), 1);
  perform pg_temp.counted('or second audit row',
    (select count(*) from public.registration_audit_event where action = 'hold_resolved' and tenant_id = 'hr-u'), 1);
  perform pg_temp.said('the same key for another hold is refused',
    (pg_temp.ask(bursar, format(resolve, h_ben, 'hr-bursar-key-1', 'held'))::jsonb)->>'reason', 'idempotency_conflict');
  perform pg_temp.counted('and Ben''s hold is still held',
    (select count(*) from public.registration_holds where id = h_ben and released_at is null), 1);
  perform pg_temp.said('a colleague who saw it held is told it already changed',
    (pg_temp.ask(bursar2, format(resolve, h_bursar, 'hr-bursar2-key-1', 'held'))::jsonb)->>'reason', 'stale_hold');
  perform pg_temp.counted('the bursar now lists one open hold',
    pg_temp.seen(bursar, $q$select * from public.registration_holds_for_office('hr-u/bursar')$q$), 1);

  -- ── Readiness that read the hold is stale ───────────────────────────────
  perform pg_temp.said('her fall readiness now reads stale',
    public.registration_readiness_get('hr-u', 'hr-maya-fa')->>'state', 'stale');
  perform pg_temp.said('so does the one that was in flight',
    public.registration_readiness_get('hr-u', 'hr-maya-sp')->>'state', 'stale');
  perform pg_temp.said('one not yet started reads fresh input anyway',
    public.registration_readiness_get('hr-u', 'hr-maya-su')->>'state', 'requested');
  perform pg_temp.said('Ben''s is untouched', public.registration_readiness_get('hr-u', 'hr-ben-fa')->>'state', 'ready');
  perform pg_temp.counted('Maya reads two of hers as stale',
    pg_temp.seen(maya, $q$select * from public.my_registration_readiness() where state = 'stale'$q$), 2);

  perform pg_temp.raises('the in-flight evaluation finishing as ready',
    format('select public.registration_readiness_save(%L, 2, %L, %L::jsonb)', 'hr-u', '["ready",1]',
      pg_temp.step('hr-maya-sp', maya::text, 3, 'ready', 1, 1, 'hr-sp-ready', 'hr-sp-ready-01', 'registration.readiness_evaluated', '2026-10-01T00:04:00.000Z', '[]'::jsonb, '2027SP')),
    'cannot move from stale to ready');
  perform pg_temp.raises('the ready one re-evaluating on its old generation',
    format('select public.registration_readiness_save(%L, 3, %L, %L::jsonb)', 'hr-u', '["evaluating",null]',
      pg_temp.step('hr-maya-fa', maya::text, 4, 'evaluating', 1, 1, 'hr-fa-eval', 'hr-fa-eval-001', 'registration.readiness_requested', '2026-10-01T00:04:00.000Z')),
    'cannot move from stale to evaluating');

  perform public.registration_readiness_save('hr-u', 3, '["reconciling",null]',
    pg_temp.step('hr-maya-fa', maya::text, 4, 'reconciling', 1, 1, 'hr-fa-reconcile', 'hr-fa-reconcile-1', 'registration.readiness_reconciliation_requested', '2026-10-01T00:05:00.000Z',
      jsonb_build_array(jsonb_build_object('id', 'hr-maya-fa:reconcile:1', 'generation', 1, 'state', 'open', 'openedAt', '2026-10-01T00:05:00.000Z'))));
  perform pg_temp.said('the stale evaluation is reconciled',
    public.registration_readiness_get('hr-u', 'hr-maya-fa')->>'state', 'reconciling');
  perform pg_temp.counted('which clears the stamp',
    (select count(*) from private.registration_readiness_evaluations where id = 'hr-maya-fa' and stale_since is null), 1);
  perform public.registration_readiness_save('hr-u', 4, '["evaluating",null]',
    pg_temp.step('hr-maya-fa', maya::text, 5, 'evaluating', 2, 1, 'hr-fa-fresh', 'hr-fa-fresh-0001', 'registration.readiness_requested', '2026-10-01T00:06:00.000Z',
      jsonb_build_array(jsonb_build_object('id', 'hr-maya-fa:reconcile:1', 'generation', 1, 'state', 'resolved', 'openedAt', '2026-10-01T00:05:00.000Z', 'resolvedAt', '2026-10-01T00:06:00.000Z'))));
  perform public.registration_readiness_save('hr-u', 5, '["ready",2]',
    pg_temp.step('hr-maya-fa', maya::text, 6, 'ready', 2, 2, 'hr-fa-ready', 'hr-fa-ready-0001', 'registration.readiness_evaluated', '2026-10-01T00:07:00.000Z'));
  perform pg_temp.said('a fresh generation, on new input, may be ready',
    public.registration_readiness_get('hr-u', 'hr-maya-fa')->>'state', 'ready');

  -- ── Enrolling checks everything again ───────────────────────────────────
  perform pg_temp.said('financial aid''s hold still blocks her',
    (pg_temp.ask(maya, format(enroll, econ, 'hr-maya-enroll-2'))::jsonb)->>'reason', 'hold');
  perform pg_temp.said('financial aid resolves its own',
    (pg_temp.ask(aid, format(resolve, h_aid, 'hr-aid-key-1', 'held'))::jsonb)->>'outcome', 'hold_resolved');
  perform pg_temp.said('with no hold left, she enrolls',
    (pg_temp.ask(maya, format(enroll, econ, 'hr-maya-enroll-3'))::jsonb)->>'outcome', 'enrolled');
  perform pg_temp.said('and a missing prerequisite still refuses',
    (pg_temp.ask(maya, format(enroll, hist, 'hr-maya-enroll-4'))::jsonb)->>'reason', 'prerequisite_missing');

  -- An office scope must belong to the hold's school.
  begin
    insert into public.registration_holds (tenant_id, student, office, owner_office) values ('hr-u', ben, 'Bursar', 'hr-other/bursar');
    raise exception 'FAILED: a hold owned by another school''s office was stored';
  exception when check_violation then
    raise notice 'ok  a hold cannot name another school''s office';
  end;
end $$;

rollback;
