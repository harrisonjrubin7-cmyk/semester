-- Semester — the office that placed a registration hold resolves it, and
-- what was worked out while the hold stood stops counting as current.
--
-- Slice 2 of the registration path: a blocker, the owning office resolving
-- it, readiness going stale and being worked out again, and a receipt that
-- says it is not enrollment. Until this file a hold could only be released by
-- the SIS sync writing `released_at` as the service role; no person could act
-- on one in Semester, and nothing that had read the hold learned that it had
-- gone.
--
-- What is decided here, and where:
--
--   * **Which office owns a hold.** `registration_holds.owner_office` is an
--     office scope id, `<school>/<office>`, the same shape every office grant
--     in `role_grants` uses (20260926150000). The SIS sync that writes holds
--     sets it; nothing here does. A hold without one cannot be resolved here
--     at all — it stays the SIS's — so the column fails closed.
--   * **Who.** `registration_hold:resolve`, held over exactly that office
--     scope. `private.has_capability` matches scope exactly, so a grant over
--     another office, over the whole school, or at another school does not
--     reach it. The capability goes to the seven roles that already publish
--     holds as institution actions (`institution_action:publish`); an office
--     that can tell a student about a hold can clear its own. The registrar
--     holds it only when granted over its own office scope, not through
--     `registration:administer` — a registrar override still cannot waive a
--     hold (20260929300000 §6).
--   * **Idempotency and the expected state.** The registration ledger's own
--     machinery: `private.registration_key`, `private.registration_replay`
--     and `private.registration_commit`, under the action `hold_resolve`. The
--     same caller, key and hold replay the stored receipt; the same key for
--     another hold is `idempotency_conflict`. `want_expect` is what the office
--     saw, and it must be 'held': a hold already released by the SIS or by a
--     colleague is `stale_hold` and nothing is written. Refusals are not
--     stored, as everywhere in the ledger.
--   * **Whether at all.** The same kill switches the ledger obeys, and
--     `writeback.registration_submit` at `production` for the school. A
--     school that does not run registration through Semester keeps its holds
--     in its SIS. The flag's role and cohort narrowing is not applied: it
--     narrows which students may register, and an office is not one.
--   * **In one transaction.** The release, a `registration_audit_event` row
--     (`hold_resolved`), the readiness invalidation below and one outbox
--     event (`registration.hold_resolved`) commit together or not at all.
--     The event payload is the hold's id and its office scope: no student id
--     and no free text. The audit row names the student, as every row of that
--     table does, and is read only by `registration:administer`.
--   * **Readiness goes stale.** `private.registration_readiness_evaluations`
--     gains `stale_since`. Resolving a hold stamps every evaluation of that
--     student at that school that had already read its inputs — evaluating,
--     ready, blocked, needs_review, unknown — in every term, because a hold is
--     not per term. A stamped evaluation reads as `stale` through
--     `registration_readiness_get` and is held to the `stale` edges by
--     `registration_readiness_save`: the only move out is to `reconciling`,
--     which clears the stamp, and the next `evaluating` is a new generation
--     that reads fresh input. So an evaluation that began before the hold
--     changed can never be saved as `ready`. `subject_id` is the student's
--     account id as text, which is how a school-scoped evaluation names its
--     student.
--   * **What a student and an office read.** `my_registration_readiness()`
--     gives a student the state of their own evaluations, so a screen can say
--     "something changed" when the server says so rather than guessing.
--     `registration_holds_for_office(office)` gives an office its own open
--     holds: id, student account and when placed. Neither returns a reason.
--
-- What is not here: sending the release on to the school's SIS (the same
-- missing adapter the rest of the ledger waits on, so a later sync may place
-- the hold again until it exists), and an evaluator that re-runs readiness —
-- nothing calls the readiness store yet (20261009160000).
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── 1. The capability ─────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('registration_hold:resolve', 'Resolve a registration hold that one office placed, at that office''s scope. Never another office''s hold, and never the hold''s reason.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar',                     'registration_hold:resolve'),
  ('financial_aid_officer',         'registration_hold:resolve'),
  ('student_accounts_officer',      'registration_hold:resolve'),
  ('international_student_advisor', 'registration_hold:resolve'),
  ('veterans_certifying_official',  'registration_hold:resolve'),
  ('athletics_compliance_officer',  'registration_hold:resolve'),
  ('residence_life_staff',          'registration_hold:resolve')
on conflict do nothing;

-- ── 2. Which office owns a hold ───────────────────────────────────────────

alter table public.registration_holds
  add column if not exists owner_office text;

alter table public.registration_holds
  drop constraint if exists registration_holds_owner_office_shape;
alter table public.registration_holds
  add constraint registration_holds_owner_office_shape check (
    owner_office is null
    or (left(owner_office, length(tenant_id) + 1) = tenant_id || '/'
        and length(owner_office) > length(tenant_id) + 1
        and length(owner_office) <= 200));

create index if not exists registration_holds_by_office
  on public.registration_holds (tenant_id, owner_office);

comment on column public.registration_holds.owner_office is
  'The office scope (<school>/<office>) that placed the hold and may resolve it through registration_hold_resolve. Set by the SIS sync; null means only the SIS can release it.';

-- ── 3. The ledger learns two more words ───────────────────────────────────

alter table public.registration_requests drop constraint if exists registration_requests_action_check;
alter table public.registration_requests add constraint registration_requests_action_check
  check (action in ('enroll', 'drop', 'withdraw', 'override', 'decide', 'swap', 'hold_resolve'));

alter table public.registration_audit_event drop constraint if exists registration_audit_event_action_check;
alter table public.registration_audit_event add constraint registration_audit_event_action_check
  check (action in (
    'term_set', 'section_set', 'enrolled', 'waitlisted', 'pending_approval', 'dropped',
    'left_waitlist', 'withdrawn', 'denied', 'approved', 'override_granted',
    'promoted', 'promotion_skipped', 'hold_resolved'));

-- ── 4. Readiness that was worked out before the change ────────────────────

alter table private.registration_readiness_evaluations
  add column if not exists stale_since timestamptz;

comment on column private.registration_readiness_evaluations.stale_since is
  'When an input this evaluation had already read changed (a hold was resolved). While set, the evaluation reads and moves as stale until it is reconciled.';

-- The state an evaluation answers to: its stored state, or `stale` once an
-- input it read has changed. One definition for the read and the save.
create or replace function private.registration_readiness_effective_state(want_state text, want_stale_since timestamptz)
returns text language sql immutable set search_path = '' as $$
  select case
    when want_stale_since is not null
     and want_state in ('evaluating', 'ready', 'blocked', 'needs_review', 'unknown') then 'stale'
    else want_state
  end;
$$;

create or replace function private.registration_readiness_record_json(want_tenant text, want_evaluation text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'tenantId', e.tenant_id,
    'subjectId', e.subject_id,
    'termId', e.term_id,
    'requestedBy', e.requested_by,
    'state', private.registration_readiness_effective_state(e.state, e.stale_since),
    'version', e.version,
    'generation', e.generation,
    'projectionVersion', e.projection_version,
    'createdAt', to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(e.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reconciliationTasks', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', t.task_id, 'generation', t.generation, 'state', t.state,
        'openedAt', to_char(t.opened_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'resolvedAt', case when t.resolved_at is null then null else
          to_char(t.resolved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
      )) order by t.generation, t.task_id)
      from private.registration_readiness_tasks t
      where t.tenant_id = e.tenant_id and t.evaluation_id = e.id
    ), '[]'::jsonb),
    'commandLedger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'idempotencyKey', r.idempotency_key,
        'fingerprint', r.fingerprint,
        'receipt', jsonb_build_object(
          'id', r.idempotency_key, 'status', r.status, 'state', r.state,
          'recordVersion', r.record_version,
          'recordedAt', to_char(r.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'correlationId', r.correlation_id
        ),
        'event', jsonb_build_object(
          'eventType', r.event_type, 'aggregateId', r.evaluation_id,
          'idempotencyKey', r.idempotency_key, 'correlationId', r.correlation_id,
          'payload', r.event_payload
        )
      ) order by r.record_version)
      from private.registration_readiness_receipts r
      where r.tenant_id = e.tenant_id and r.evaluation_id = e.id
    ), '[]'::jsonb)
  ))
  from private.registration_readiness_evaluations e
  where e.tenant_id = want_tenant and e.id = want_evaluation;
$$;

-- The save from 20261010140000, unchanged but for two lines: the edge it
-- checks starts from the effective state, and moving to `reconciling` clears
-- the stamp. Everything else — locks, receipts, CAS, audit, outbox — is as it
-- was.
create or replace function public.registration_readiness_save(
  want_tenant text,
  want_expected_version integer,
  want_fingerprint text,
  want_result jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  rec jsonb := want_result->'record';
  receipt jsonb := want_result->'receipt';
  event jsonb := want_result->'event';
  current private.registration_readiness_evaluations;
  earlier private.registration_readiness_receipts;
  task jsonb;
  evaluation_id text := rec->>'id';
  next_state text := rec->>'state';
  next_version integer := (rec->>'version')::integer;
  next_generation integer := (rec->>'generation')::integer;
  next_projection integer := (rec->>'projectionVersion')::integer;
  key text := receipt->>'id';
  expected_payload jsonb;
  audit_saved boolean;
  from_state text;
begin
  if want_tenant is null or rec->>'tenantId' is distinct from want_tenant then
    raise exception 'The readiness tenant does not match the record.' using errcode = 'SC403';
  end if;
  if key is null or length(key) not between 1 and 300 or want_fingerprint is null then
    raise exception 'The readiness idempotency envelope is malformed.' using errcode = '22023';
  end if;
  if want_expected_version is null or want_expected_version < 0 then
    raise exception 'The expected readiness version is malformed.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'registration-readiness-key:' || want_tenant || ':' || key, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'registration-readiness-evaluation:' || evaluation_id, 0
  ));

  select * into earlier from private.registration_readiness_receipts r
   where r.tenant_id = want_tenant and r.idempotency_key = key;
  if found then
    if earlier.evaluation_id is distinct from evaluation_id or earlier.fingerprint is distinct from want_fingerprint then
      raise exception 'The readiness idempotency key was reused for another command.' using errcode = 'SC409';
    end if;
    return jsonb_build_object(
      'record', private.registration_readiness_record_json(want_tenant, evaluation_id),
      'receipt', jsonb_build_object(
        'id', earlier.idempotency_key, 'status', earlier.status, 'state', earlier.state,
        'recordVersion', earlier.record_version,
        'recordedAt', to_char(earlier.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'correlationId', earlier.correlation_id
      ),
      'event', jsonb_build_object(
        'eventType', earlier.event_type, 'aggregateId', earlier.evaluation_id,
        'idempotencyKey', earlier.idempotency_key, 'correlationId', earlier.correlation_id,
        'payload', earlier.event_payload
      ),
      'replayed', true
    );
  end if;

  select * into current from private.registration_readiness_evaluations e
   where e.id = evaluation_id for update;

  if not found then
    if want_expected_version <> 0 or next_version <> 1 or next_state <> 'requested'
       or next_generation <> 1 or next_projection is not null then
      raise exception 'A readiness evaluation must begin at requested version 1.' using errcode = 'SC409';
    end if;
    insert into private.registration_readiness_evaluations (
      id, tenant_id, subject_id, term_id, requested_by, state, version, generation,
      projection_version, created_at, updated_at
    ) values (
      evaluation_id, want_tenant, rec->>'subjectId', rec->>'termId', rec->>'requestedBy',
      next_state, next_version, next_generation, next_projection,
      (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz
    );
  else
    if current.tenant_id is distinct from want_tenant then
      raise exception 'No readiness evaluation exists in this tenant.' using errcode = 'SC404';
    end if;
    if current.version <> want_expected_version or next_version <> current.version + 1 then
      raise exception 'The readiness evaluation moved.' using errcode = 'SC409';
    end if;
    if rec->>'subjectId' is distinct from current.subject_id
       or rec->>'termId' is distinct from current.term_id
       or rec->>'requestedBy' is distinct from current.requested_by
       or (rec->>'createdAt')::timestamptz is distinct from current.created_at then
      raise exception 'A readiness evaluation keeps the identity it was created with.' using errcode = 'SC409';
    end if;
    -- An input this evaluation read has changed: it moves as `stale`, whatever
    -- the caller last saw. A stale evaluation goes to reconciling, never to ready.
    from_state := private.registration_readiness_effective_state(current.state, current.stale_since);
    if not private.registration_readiness_edge_ok(from_state, next_state) then
      raise exception 'The readiness evaluation cannot move from % to %.', from_state, next_state using errcode = 'SC409';
    end if;
    if current.state = 'reconciling' and next_state = 'evaluating' then
      if next_generation <> current.generation + 1 then
        raise exception 'A reconciled evaluation starts a new generation.' using errcode = 'SC409';
      end if;
    elsif next_generation <> current.generation then
      raise exception 'Readiness generation changed outside reconciliation.' using errcode = 'SC409';
    end if;
    if current.state = 'evaluating'
       and next_state = 'unknown'
       and event->'payload'->>'reason' = 'evaluator_timeout' then
      if next_projection is distinct from current.projection_version then
        raise exception 'A timed-out readiness evaluation cannot invent a projection.' using errcode = 'SC409';
      end if;
    elsif next_state in ('ready', 'blocked', 'needs_review', 'unknown', 'stale')
       and (next_projection is null or (current.projection_version is not null and next_projection <= current.projection_version)) then
      raise exception 'An evaluated readiness outcome needs a newer projection.' using errcode = 'SC409';
    end if;
    if next_state not in ('ready', 'blocked', 'needs_review', 'unknown', 'stale')
       and next_projection is distinct from current.projection_version then
      raise exception 'Projection version changes only with an evaluated outcome.' using errcode = 'SC409';
    end if;

    update private.registration_readiness_evaluations set
      state = next_state, version = next_version, generation = next_generation,
      projection_version = next_projection, updated_at = (rec->>'updatedAt')::timestamptz,
      stale_since = case when next_state = 'reconciling' then null else stale_since end
    where id = evaluation_id and tenant_id = want_tenant;
  end if;

  for task in select value from jsonb_array_elements(coalesce(rec->'reconciliationTasks', '[]'::jsonb)) loop
    insert into private.registration_readiness_tasks (
      tenant_id, evaluation_id, task_id, generation, state, opened_at, resolved_at
    ) values (
      want_tenant, evaluation_id, task->>'id', (task->>'generation')::integer,
      task->>'state', (task->>'openedAt')::timestamptz, (task->>'resolvedAt')::timestamptz
    ) on conflict (tenant_id, task_id) do update set
      state = excluded.state,
      resolved_at = excluded.resolved_at
    where private.registration_readiness_tasks.evaluation_id = excluded.evaluation_id
      and private.registration_readiness_tasks.generation = excluded.generation
      and private.registration_readiness_tasks.opened_at = excluded.opened_at
      and private.registration_readiness_tasks.state = 'open'
      and excluded.state = 'resolved';
  end loop;

  expected_payload := jsonb_build_object(
    'evaluationId', evaluation_id, 'termId', rec->>'termId', 'version', next_version
  );
  if current.state = 'evaluating'
     and next_state = 'unknown'
     and event->'payload'->>'reason' = 'evaluator_timeout' then
    expected_payload := expected_payload || jsonb_build_object('reason', 'evaluator_timeout');
  end if;
  if key is null
     or receipt->>'id' is distinct from event->>'idempotencyKey'
     or (receipt->>'recordVersion')::integer is distinct from next_version
     or receipt->>'state' is distinct from next_state
     or receipt->>'correlationId' is distinct from event->>'correlationId'
     or event->>'aggregateId' is distinct from evaluation_id
     or event->>'idempotencyKey' is distinct from key
     or event->'payload' is distinct from expected_payload then
    raise exception 'The readiness receipt or event does not describe the saved record.' using errcode = '22023';
  end if;
  if receipt->>'status' is distinct from (
       case when next_state in ('requested', 'evaluating', 'reconciling') then 'pending' else 'completed' end
     ) or (
       next_state = 'evaluating'
       and event->>'eventType' not in ('registration.readiness_requested', 'registration.readiness_evaluated')
     ) or (
       next_state <> 'evaluating'
       and event->>'eventType' is distinct from (
         case
           when next_state = 'requested' then 'registration.readiness_requested'
           when next_state = 'reconciling' then 'registration.readiness_reconciliation_requested'
           else 'registration.readiness_evaluated'
         end
       )
     ) then
    raise exception 'The readiness receipt status or event type does not match the state.' using errcode = '22023';
  end if;

  insert into private.registration_readiness_receipts (
    tenant_id, evaluation_id, idempotency_key, fingerprint, status, state,
    record_version, recorded_at, correlation_id, event_type, event_payload
  ) values (
    want_tenant, evaluation_id, key, want_fingerprint, receipt->>'status', next_state,
    next_version, (receipt->>'recordedAt')::timestamptz, receipt->>'correlationId',
    event->>'eventType', event->'payload'
  );

  audit_saved := private.gateway_write_audit_v2(
    want_tenant, rec->>'requestedBy', 'registration_readiness', event->>'eventType',
    null, receipt->>'correlationId'
  );
  if not audit_saved then raise exception 'The readiness audit row was refused.'; end if;

  perform private.emit_domain_event(
    'registration_readiness_evaluation', evaluation_id, event->>'eventType', 1,
    want_tenant, 'registration-readiness', receipt->>'correlationId', key,
    event->'payload', 'education_record',
    case when event->>'eventType' = 'registration.readiness_evaluated' then 'student_record' else 'audit' end
  );

  return jsonb_build_object(
    'record', private.registration_readiness_record_json(want_tenant, evaluation_id),
    'receipt', receipt,
    'event', event,
    'replayed', false
  );
end $$;

revoke all on function private.registration_readiness_effective_state(text, timestamptz) from public, anon, authenticated;
revoke all on function private.registration_readiness_record_json(text, text) from public, anon, authenticated;
revoke all on function public.registration_readiness_save(text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.registration_readiness_save(text, integer, text, jsonb) to service_role;

-- ── 5. The office resolves its hold ───────────────────────────────────────

/*
 * Resolve one hold. `want_expect` is the state the office saw: 'held'. The
 * hold is looked up at the caller's school only, so another school's hold is
 * "no such hold" and says nothing more; a hold here that another office owns,
 * or that no office owns, is refused before anything is read back or written.
 */
create or replace function public.registration_hold_resolve(want_hold uuid, want_key text, want_expect text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('hold_resolve', want_hold, want_expect)::text);
  prior  jsonb;
  h      public.registration_holds;
  stale  integer;
  answer jsonb;
begin
  if want_expect is distinct from 'held' then
    raise exception 'semester: say the hold is still held, as you saw it' using errcode = 'check_violation';
  end if;

  select * into h from public.registration_holds x where x.id = want_hold and x.tenant_id = school;
  if h.id is null then
    return private.registration_refusal('unknown_hold', 'No such hold at your school. Nothing was changed.');
  end if;
  if h.owner_office is null
     or not private.has_capability('registration_hold:resolve', 'office', h.owner_office) then
    raise exception 'semester: only the office that placed this hold can resolve it' using errcode = 'insufficient_privilege';
  end if;

  prior := private.registration_replay(me, k, 'hold_resolve', print);
  if prior is not null then return prior; end if;

  if public.kill_switch_engaged('kill.writeback', school)
     or public.kill_switch_engaged('kill.integration_sync', school) then
    return private.registration_refusal('kill_switch', 'Registration changes are stopped by a kill switch right now. Nothing was changed.');
  end if;
  if public.feature_state('writeback.registration_submit', school) <> 'production' then
    return private.registration_refusal('flag_off', 'Registration through Semester is not turned on for this school, so its holds stay in the school''s own system. Nothing was changed.');
  end if;

  -- Two people in the office at once: the second waits here, then reads it released.
  select * into h from public.registration_holds x where x.id = want_hold for update;
  if h.released_at is not null then
    return private.registration_refusal('stale_hold',
      'This hold was already released since you looked at it. Nothing was changed.');
  end if;

  update public.registration_holds set released_at = now() where id = h.id;
  perform private.registration_audit(school, me, h.student, null, null, 'hold_resolved', 'ok',
    jsonb_build_object('hold', h.id, 'office', h.owner_office));

  -- Whatever was worked out while the hold stood is no longer current.
  update private.registration_readiness_evaluations e
     set stale_since = now()
   where e.tenant_id = school
     and e.subject_id = h.student::text
     and e.stale_since is null
     and e.state in ('evaluating', 'ready', 'blocked', 'needs_review', 'unknown');
  get diagnostics stale = row_count;

  perform private.emit_domain_event(
    'registration_hold', h.id::text, 'registration.hold_resolved', 1,
    school, 'registration', k, k,
    jsonb_build_object('hold', h.id, 'office', h.owner_office),
    'education_record', 'audit'
  );

  answer := jsonb_build_object(
    'ok', true, 'outcome', 'hold_resolved', 'reason', 'ok',
    'message', 'The hold is resolved. This is not enrollment: the student still has to enroll, and every other check runs again when they do.',
    'replayed', false, 'promoted', 0,
    'hold', jsonb_build_object('id', h.id, 'office', h.owner_office),
    'resolved_at', now(),
    'readiness_marked_stale', stale);
  return private.registration_commit(school, me, k, 'hold_resolve', print, answer);
end $$;

-- An office's own open holds: which, whose account, and since when. Never why.
create or replace function public.registration_holds_for_office(want_office text)
returns table (hold_id uuid, student uuid, placed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.registration_school();
begin
  if want_office is null
     or left(want_office, length(school) + 1) <> school || '/'
     or not private.has_capability('registration_hold:resolve', 'office', want_office) then
    raise exception 'semester: only that office can list its holds' using errcode = 'insufficient_privilege';
  end if;
  return query
    select h.id, h.student, h.placed_at
      from public.registration_holds h
     where h.tenant_id = school and h.owner_office = want_office and h.released_at is null
     order by h.placed_at, h.id;
end $$;

-- The caller's own readiness evaluations at their school, as the store would
-- answer for them now: `stale` once something they depended on changed.
create or replace function public.my_registration_readiness()
returns table (term text, state text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.term_id, private.registration_readiness_effective_state(e.state, e.stale_since), e.updated_at
    from private.registration_readiness_evaluations e
   where e.subject_id = (select auth.uid())::text
     and e.tenant_id = (select private.school_of())
   order by e.updated_at desc, e.term_id;
$$;

revoke all on function public.registration_hold_resolve(uuid, text, text) from public, anon, authenticated;
revoke all on function public.registration_holds_for_office(text) from public, anon, authenticated;
revoke all on function public.my_registration_readiness() from public, anon, authenticated;
grant execute on function public.registration_hold_resolve(uuid, text, text) to authenticated;
grant execute on function public.registration_holds_for_office(text) to authenticated;
grant execute on function public.my_registration_readiness() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.my_registration_readiness();
--   drop function if exists public.registration_holds_for_office(text);
--   drop function if exists public.registration_hold_resolve(uuid, text, text);
--   -- Re-run the create-or-replace statements for
--   -- private.registration_readiness_record_json from 20261009160000 and
--   -- public.registration_readiness_save from 20261010140000, then:
--   drop function if exists private.registration_readiness_effective_state(text, timestamptz);
--   alter table private.registration_readiness_evaluations drop column if exists stale_since;
--   -- Only once no request or audit row uses the new words:
--   alter table public.registration_audit_event drop constraint registration_audit_event_action_check;
--   alter table public.registration_audit_event add constraint registration_audit_event_action_check
--     check (action in ('term_set', 'section_set', 'enrolled', 'waitlisted', 'pending_approval', 'dropped',
--       'left_waitlist', 'withdrawn', 'denied', 'approved', 'override_granted', 'promoted', 'promotion_skipped'));
--   alter table public.registration_requests drop constraint registration_requests_action_check;
--   alter table public.registration_requests add constraint registration_requests_action_check
--     check (action in ('enroll', 'drop', 'withdraw', 'override', 'decide', 'swap'));
--   drop index if exists public.registration_holds_by_office;
--   alter table public.registration_holds drop constraint if exists registration_holds_owner_office_shape;
--   alter table public.registration_holds drop column if exists owner_office;
--   delete from public.role_capabilities where capability = 'registration_hold:resolve';
--   delete from public.app_capabilities where capability = 'registration_hold:resolve';
--   commit;
