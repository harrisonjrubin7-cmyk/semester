-- A released grade reaches the student's Action Center (B08 events, B14 Action
-- Center: "faculty releases feedback -> the student's Action Center updates").
--
-- `gradebook_release` already writes `gradebook.grades_released` v1 in its own
-- transaction (20261012010000). Nothing consumed it. This adds the consumer,
-- modelled on the tenant-entitlement projector (20261008200000/210000): a
-- claim filtered to one registered event type and version, a strict apply, and
-- the effect, receipt and watermark in one transaction. It reuses the outbox
-- (`private.domain_outbox_events`), the per-consumer receipts
-- (`private.domain_event_receipts`), the read-model registry, the watermark,
-- `fail_domain_event`'s retry rule and `replay_domain_event`'s approval,
-- MFA and audit path. It adds no event type and no capability.
--
-- ## Why there is a delivery row per consumer
--
-- The outbox's lease and outcome columns (`claim_id`, `claimed_at`,
-- `published_at`, `publish_attempts`, `next_attempt_at`, `dead_lettered_at`)
-- are on the event row, so they belong to the whole event, while receipts are
-- per consumer. A consumer that settles through `complete_domain_event` sets
-- `published_at`, and every claim on main (`claim_domain_events`,
-- `claim_tenant_entitlement_events`) skips a published event: the first
-- subscriber to finish would hide the event from every other one. Nothing on
-- main subscribes to `gradebook.grades_released` today, but the passback queue,
-- a notification and a projection are all named as its consumers in
-- D-1475 §13, so this consumer does not take the event-global route.
--
-- Instead `private.domain_event_deliveries` holds the same five lease and
-- retry facts, keyed by (consumer, event). This consumer reads and writes only
-- that row and its own receipt, and never touches the event row's lease or
-- outcome columns, so another subscriber, or the generic claim, sees the event
-- exactly as before. The retry rule is `fail_domain_event`'s, copied, not
-- re-tuned: eight attempts, 2^n seconds capped at fifteen minutes plus a
-- deterministic jitter under a second, SQLSTATE 22023/23514 not retried.
--
-- ## What the effect is
--
-- The event names an item and counts, never a student. The rows it released
-- are the item's `released` versions whose `operation` is the release's own
-- key, which `gradebook_release` writes on each, and which is the event's
-- idempotency key. So each released student gets one `student_actions` row,
-- naming the item and the exact grade version, unique per (student, grade
-- entry). A draft or moderated version a release held is not `released` and
-- carries its own key; a version released by an earlier release carries that
-- release's key; another course's item is another aggregate.
--
-- ## A grade that changes after release
--
-- The gradebook has no un-release. Versions are append-only
-- (draft -> moderated -> released, 20260929310000); a change after release
-- appends a `draft` version (action `changed` or `regraded`) that the student
-- cannot read until it is released, and until then they keep reading the last
-- released one. So an action stays true while a revision is in draft: what it
-- points at is still the grade the student is shown. When the revision is
-- released, that release's event makes a new action for the new version, and
-- the old action stops appearing: the feed and the settle command show only an
-- action whose grade entry is still the student's latest released version of
-- that item. Nothing is rewritten to get there, so there is no stored action
-- that can disagree with the gradebook.
--
-- Nothing here schedules anything. `run_student_action_relay` is service-role
-- only and runs when called; no cron entry, Edge Function or secret is added.

-- ── The read model, registered like the entitlement projector ──────────────

insert into private.read_model_registry
  (name, version, capability, scope_kind, freshness_slo_seconds,
   source_tables, redaction_profile, status)
values
  ('student_actions', 1, 'grades:receive', 'school', 300,
   array['public.grade_entries', 'public.gradebook_items'], 'own-rows-grade-release-v1', 'active')
on conflict (name, version) do update
  set capability = excluded.capability,
      scope_kind = excluded.scope_kind,
      freshness_slo_seconds = excluded.freshness_slo_seconds,
      source_tables = excluded.source_tables,
      redaction_profile = excluded.redaction_profile,
      status = excluded.status;

-- ── Per-consumer delivery state ────────────────────────────────────────────

create table if not exists private.domain_event_deliveries (
  consumer text not null check (consumer ~ '^[a-z][a-z0-9_.:-]{2,99}$'),
  event_id uuid not null references private.domain_outbox_events(id) on delete cascade,
  claim_id uuid,
  claimed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  dead_lettered_at timestamptz,
  primary key (consumer, event_id),
  constraint domain_event_delivery_claim_pair check ((claim_id is null) = (claimed_at is null)),
  constraint domain_event_delivery_parked_unclaimed check (dead_lettered_at is null or claim_id is null)
);

-- The event key on its own: deleting an event scans this table once per row
-- without it (indexes.check.sql).
create index if not exists domain_event_deliveries_by_event
  on private.domain_event_deliveries (event_id);

alter table private.domain_event_deliveries enable row level security;
revoke all on table private.domain_event_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table private.domain_event_deliveries to service_role;

comment on table private.domain_event_deliveries is
  'Lease, attempts, backoff and dead letter for one (consumer, event), so one subscriber settling or parking an event never hides it from another. Terminal outcomes stay in domain_event_receipts.';

-- ── The student's actions ──────────────────────────────────────────────────

create table if not exists public.student_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('grade_released')),
  item_id uuid not null references public.gradebook_items(id) on delete cascade,
  grade_entry_id uuid not null references public.grade_entries(id) on delete cascade,
  source_event_id uuid not null,
  state text not null default 'open' check (state in ('open', 'done', 'dismissed')),
  version integer not null default 1 check (version >= 1),
  settled_key text check (settled_key is null or settled_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_actions_one_per_grade_entry unique (student_id, grade_entry_id)
);

create index if not exists student_actions_by_tenant on public.student_actions (tenant_id);
create index if not exists student_actions_by_item on public.student_actions (item_id);
create index if not exists student_actions_by_grade_entry on public.student_actions (grade_entry_id);

alter table public.student_actions enable row level security;
revoke all on table public.student_actions from public, anon, authenticated;
grant select on table public.student_actions to authenticated;
grant select, insert, update, delete on table public.student_actions to service_role;

-- The student only. No staff policy: an instructor learns nothing about who
-- opened or dismissed their feedback.
drop policy if exists "a student reads their own actions" on public.student_actions;
create policy "a student reads their own actions" on public.student_actions
  for select to authenticated
  using (student_id = (select auth.uid()));

comment on table public.student_actions is
  'One Action Center item per (student, released grade entry), written only by the grade-release consumer; the student reads their own and settles it through settle_student_action.';

-- ── Claim: this consumer, this event type and version, nothing else ────────

create or replace function private.claim_grade_release_events(
  want_limit integer default 25
)
returns table (event_id uuid, claim_id uuid)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  consumer_name constant text := 'student-actions.grade-release.v1';
  batch uuid := gen_random_uuid();
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A relay batch limit is between 1 and 25.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.read_model_registry r
     where r.name = 'student_actions' and r.version = 1
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'grades:receive'
  ) then
    raise exception 'The student action relay is not registered active.' using errcode = '55000';
  end if;

  -- A delivery row for every matching event this consumer has not settled and
  -- has not seen. The event row's own lease and outcome are not read: another
  -- subscriber having published or parked it says nothing about this one.
  -- Four batches' worth: a concurrent claimer computes the same oldest events,
  -- waits on this one's uncommitted rows, and then finds the seeded rows this
  -- one did not claim, rather than nothing (measured with two sessions: 25 and
  -- 0 per round at one batch).
  insert into private.domain_event_deliveries (consumer, event_id)
  select consumer_name, e.id
    from private.domain_outbox_events e
   where e.event_type = 'gradebook.grades_released'
     and e.event_version = 1
     and not exists (
       select 1 from private.domain_event_deliveries d
        where d.consumer = consumer_name and d.event_id = e.id)
     and not exists (
       select 1 from private.domain_event_receipts r
        where r.consumer = consumer_name and r.event_id = e.id
          and r.outcome in ('processed', 'skipped'))
   order by e.occurred_at, e.id
   limit want_limit * 4
  on conflict (consumer, event_id) do nothing;

  return query
  with candidates as (
    select d.event_id
      from private.domain_event_deliveries d
      join private.domain_outbox_events e on e.id = d.event_id
     where d.consumer = consumer_name
       and e.event_type = 'gradebook.grades_released'
       and e.event_version = 1
       and d.dead_lettered_at is null
       and coalesce(d.next_attempt_at, e.occurred_at) <= now()
       and (d.claim_id is null or d.claimed_at < now() - interval '5 minutes')
       and not exists (
         select 1 from private.domain_event_receipts r
          where r.consumer = consumer_name and r.event_id = d.event_id
            and r.outcome in ('processed', 'skipped'))
     order by coalesce(d.next_attempt_at, e.occurred_at), e.occurred_at, e.id
     for update of d skip locked
     limit want_limit
  ), claimed as (
    update private.domain_event_deliveries d
       set claim_id = batch,
           claimed_at = now()
      from candidates c
     where d.consumer = consumer_name and d.event_id = c.event_id
     returning d.event_id, d.claim_id
  )
  select c.event_id, c.claim_id from claimed c;
end
$$;

-- ── A failure, per consumer, by fail_domain_event's rule ──────────────────

create or replace function private.fail_event_delivery(
  want_consumer text,
  want_event uuid,
  want_claim uuid,
  want_error text,
  want_retryable boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  tries integer;
  terminal boolean;
  retry_at timestamptz;
  clean_error text := left(nullif(trim(want_error), ''), 500);
begin
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;
  if clean_error is null then
    raise exception 'A failure needs a sanitized error.' using errcode = '22023';
  end if;

  select d.attempts + 1 into tries
    from private.domain_event_deliveries d
   where d.consumer = want_consumer and d.event_id = want_event
     and d.claim_id = want_claim and d.dead_lettered_at is null
   for update;
  if not found then
    raise exception 'The delivery is not held by this claim.' using errcode = '40001';
  end if;

  terminal := not coalesce(want_retryable, true) or tries >= 8;
  if not terminal then
    retry_at := now()
      + least(interval '15 minutes', power(2::numeric, tries)::double precision * interval '1 second')
      + (('x' || substr(md5(want_event::text || ':' || tries::text), 1, 8))::bit(32)::bigint % 1000)
        * interval '1 millisecond';
  end if;

  update private.domain_event_deliveries
     set attempts = tries,
         last_error = clean_error,
         dead_lettered_at = case when terminal then now() else null end,
         next_attempt_at = case when terminal then null else retry_at end,
         claim_id = null,
         claimed_at = null
   where consumer = want_consumer and event_id = want_event;

  if terminal then
    insert into private.domain_event_receipts (consumer, event_id, outcome, last_error, processed_at)
    values (want_consumer, want_event, 'failed', clean_error, now())
    on conflict (consumer, event_id) do update
      set outcome = 'failed', last_error = excluded.last_error, processed_at = excluded.processed_at;
  end if;

  return jsonb_build_object(
    'event', want_event,
    'attempts', tries,
    'state', case when terminal then 'dead_letter' else 'retry' end,
    'nextAttemptAt', retry_at
  );
end
$$;

-- ── Apply one claimed release: actions, watermark, receipt, together ──────

create or replace function private.apply_grade_release_event(
  want_event uuid,
  want_claim uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'student-actions.grade-release.v1';
  projection_name constant text := 'student_actions';
  projection_version constant integer := 1;
  event_row private.domain_outbox_events%rowtype;
  item public.gradebook_items%rowtype;
  said_released integer;
  matched integer;
  made integer := 0;
  outcome text;
begin
  -- A repeated delivery after an atomic success is a no-op. A failed receipt
  -- is deliberately not terminal: an approved replay must apply it.
  if exists (
    select 1 from private.domain_event_receipts r
     where r.consumer = consumer_name and r.event_id = want_event
       and r.outcome in ('processed', 'skipped')
  ) then
    return jsonb_build_object('event', want_event, 'applied', false, 'outcome', 'already_settled');
  end if;

  -- Only the current holder of this consumer's lease. A worker whose lease
  -- expired and was re-claimed holds a token that no longer matches.
  perform 1 from private.domain_event_deliveries d
   where d.consumer = consumer_name and d.event_id = want_event
     and d.claim_id = want_claim and d.dead_lettered_at is null
   for update;
  if not found then
    raise exception 'The grade release event is not held by this claim.' using errcode = '40001';
  end if;

  if not exists (
    select 1 from private.read_model_registry r
     where r.name = projection_name and r.version = projection_version
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'grades:receive'
  ) then
    raise exception 'The student action relay is not registered active.' using errcode = '55000';
  end if;

  select e.* into event_row from private.domain_outbox_events e where e.id = want_event;

  if event_row.aggregate_type is distinct from 'gradebook_item'
     or event_row.event_type is distinct from 'gradebook.grades_released'
     or event_row.event_version is distinct from 1
     or event_row.producer is distinct from 'gradebook'
     or event_row.tenant_id is null
     or event_row.idempotency_key is null
     or event_row.data_classification is distinct from 'education_record'
     or event_row.retention_class is distinct from 'student_record'
     or event_row.aggregate_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or event_row.payload ->> 'item' is distinct from event_row.aggregate_id
     or jsonb_typeof(event_row.payload -> 'released') is distinct from 'number'
     or jsonb_typeof(event_row.payload -> 'held') is distinct from 'number'
     or exists (
       select 1 from jsonb_object_keys(event_row.payload) as key(name)
        where key.name not in ('item', 'course_code', 'term', 'released', 'held')
     ) then
    raise exception 'The event does not match gradebook.grades_released version 1.' using errcode = '22023';
  end if;
  said_released := (event_row.payload ->> 'released')::integer;
  if said_released < 1 then
    raise exception 'A grades_released event releases at least one grade.' using errcode = '22023';
  end if;

  select i.* into item
    from public.gradebook_items i
   where i.id = event_row.aggregate_id::uuid and i.tenant_id = event_row.tenant_id;

  if not found then
    -- The item was deleted with its course or school; there is nobody left
    -- to tell. Settled as skipped, never retried.
    outcome := 'skipped';
  else
    if item.course_code is distinct from event_row.payload ->> 'course_code'
       or item.term is distinct from event_row.payload ->> 'term' then
      raise exception 'The event names a course or term its item does not have.' using errcode = '22023';
    end if;

    -- The versions this release wrote: released, on this item, at this
    -- school, under this release's own key.
    select count(*) into matched
      from public.grade_entries g
     where g.item_id = item.id and g.tenant_id = event_row.tenant_id
       and g.status = 'released' and g.action = 'released'
       and g.operation = event_row.idempotency_key;
    -- Fewer is possible (a student account deleted since, which cascades);
    -- more is not, and would mean the key or the event is wrong.
    if matched > said_released then
      raise exception 'The release wrote more grades than its event says.' using errcode = '23514';
    end if;

    insert into public.student_actions
      (tenant_id, student_id, kind, item_id, grade_entry_id, source_event_id)
    select g.tenant_id, g.student_id, 'grade_released', g.item_id, g.id, event_row.id
      from public.grade_entries g
     where g.item_id = item.id and g.tenant_id = event_row.tenant_id
       and g.status = 'released' and g.action = 'released'
       and g.operation = event_row.idempotency_key
     order by g.student_id
    on conflict (student_id, grade_entry_id) do nothing;
    get diagnostics made = row_count;
    outcome := case when matched = 0 then 'skipped' else 'processed' end;
  end if;

  insert into private.projection_watermark as current
    (projection, version, last_event_id, last_occurred_at, last_processed_at,
     source_updated_at, status, last_error, lag_seconds)
  values
    (projection_name, projection_version, event_row.id, event_row.occurred_at, now(),
     event_row.occurred_at, 'idle', null,
     greatest(0, floor(extract(epoch from now() - event_row.occurred_at)))::integer)
  on conflict (projection, version) do update
    set last_event_id = excluded.last_event_id,
        last_occurred_at = excluded.last_occurred_at,
        last_processed_at = excluded.last_processed_at,
        source_updated_at = excluded.source_updated_at,
        status = 'idle',
        last_error = null,
        lag_seconds = excluded.lag_seconds
    where current.last_occurred_at is null
       or (excluded.last_occurred_at, excluded.last_event_id)
        > (current.last_occurred_at, current.last_event_id);

  -- The receipt and the release of this consumer's lease, in the same
  -- transaction as the actions. The event row is not touched.
  insert into private.domain_event_receipts (consumer, event_id, outcome, last_error, processed_at)
  values (consumer_name, event_row.id, outcome, null, now())
  on conflict (consumer, event_id) do update
    set outcome = excluded.outcome, last_error = null, processed_at = excluded.processed_at;

  update private.domain_event_deliveries
     set claim_id = null, claimed_at = null, next_attempt_at = null, last_error = null
   where consumer = consumer_name and event_id = event_row.id;

  return jsonb_build_object(
    'event', event_row.id,
    'applied', made > 0,
    'outcome', outcome,
    'actions', made
  );
end
$$;

-- ── The tick ───────────────────────────────────────────────────────────────

create or replace function public.run_student_action_relay(
  want_limit integer default 25
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'student-actions.grade-release.v1';
  claimed_row record;
  applied jsonb;
  failed jsonb;
  failure_state text;
  claimed_count integer := 0;
  processed_count integer := 0;
  skipped_count integer := 0;
  retrying_count integer := 0;
  dead_lettered_count integer := 0;
  actions_count integer := 0;
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A relay batch limit is between 1 and 25.' using errcode = '22023';
  end if;

  for claimed_row in
    select * from private.claim_grade_release_events(want_limit)
  loop
    claimed_count := claimed_count + 1;
    -- One subtransaction per event: a failure rolls back that event's
    -- actions, watermark and receipt and nothing else.
    begin
      applied := private.apply_grade_release_event(claimed_row.event_id, claimed_row.claim_id);
      if applied ->> 'outcome' = 'processed' then
        processed_count := processed_count + 1;
        actions_count := actions_count + coalesce((applied ->> 'actions')::integer, 0);
      elsif applied ->> 'outcome' in ('skipped', 'already_settled') then
        skipped_count := skipped_count + 1;
      else
        raise exception 'The relay returned an unsupported outcome.' using errcode = '22023';
      end if;
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate;
      failed := private.fail_event_delivery(
        consumer_name,
        claimed_row.event_id,
        claimed_row.claim_id,
        case when failure_state in ('22023', '23514')
          then 'invalid gradebook.grades_released version 1 event'
          else 'student action relay transaction failed'
        end,
        failure_state not in ('22023', '23514')
      );
      if failed ->> 'state' = 'dead_letter' then
        dead_lettered_count := dead_lettered_count + 1;
      else
        retrying_count := retrying_count + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'claimed', claimed_count,
    'processed', processed_count,
    'skipped', skipped_count,
    'retrying', retrying_count,
    'deadLettered', dead_lettered_count,
    'actions', actions_count
  );
end
$$;

revoke all on function private.claim_grade_release_events(integer) from public, anon, authenticated;
revoke all on function private.fail_event_delivery(text, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function private.apply_grade_release_event(uuid, uuid) from public, anon, authenticated;
revoke all on function public.run_student_action_relay(integer) from public, anon, authenticated;
grant execute on function private.claim_grade_release_events(integer) to service_role;
grant execute on function private.fail_event_delivery(text, uuid, uuid, text, boolean) to service_role;
grant execute on function private.apply_grade_release_event(uuid, uuid) to service_role;
grant execute on function public.run_student_action_relay(integer) to service_role;

comment on function private.claim_grade_release_events(integer) is
  'Service-only claim of gradebook.grades_released v1 for the student action relay, on its own per-consumer lease (five minutes, skip locked, at most 25); never reads or writes the event row''s lease or outcome.';
comment on function private.fail_event_delivery(text, uuid, uuid, text, boolean) is
  'Service-only per-consumer failure: fail_domain_event''s retry and dead-letter rule on domain_event_deliveries.';
comment on function private.apply_grade_release_event(uuid, uuid) is
  'Atomically turns one claimed grades_released v1 event into one student action per grade version it released, with the watermark and receipt.';
comment on function public.run_student_action_relay(integer) is
  'Runs one bounded service-only batch of the student action relay; it does not schedule or activate anything.';

-- ── What the student reads ─────────────────────────────────────────────────

-- Open and dismissed actions (dismissed, so the student can bring one back)
-- whose grade version is still the student's latest released one for that
-- item, and whose item they can still read. Done ones leave the feed. Invoker: the rows,
-- the grade versions and the items are all read under the student's own
-- policies, so an action never shows a grade the gradebook would not.
create or replace function public.my_student_actions()
returns table (
  id uuid, kind text, item_id uuid, grade_entry_id uuid, course_code text, term text,
  item_title text, state text, version integer, released_at timestamptz, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.kind, a.item_id, a.grade_entry_id, i.course_code, i.term,
         i.title, a.state, a.version, g.created_at, a.updated_at
    from public.student_actions a
    join public.grade_entries g on g.id = a.grade_entry_id and g.status = 'released'
    join public.gradebook_items i on i.id = a.item_id
   where a.student_id = (select auth.uid())
     and a.state in ('open', 'dismissed')
     and not exists (
       select 1 from public.grade_entries newer
        where newer.item_id = a.item_id and newer.student_id = a.student_id
          and newer.status = 'released' and newer.version > g.version)
   order by g.created_at desc, a.id
   limit 100;
$$;

revoke all on function public.my_student_actions() from public, anon;
grant execute on function public.my_student_actions() to authenticated;

-- Done, dismissed, or open again (the Undo). The caller names the version
-- they read; a different one is refused as stale. The same key again with
-- the same state answers the current row and changes nothing.
create or replace function public.settle_student_action(
  want_action uuid,
  want_state text,
  want_version integer,
  want_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.student_actions%rowtype;
  shown integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if want_state is null or want_state not in ('open', 'done', 'dismissed') then
    raise exception 'An action is open, done or dismissed.' using errcode = '22023';
  end if;
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'A settle needs a key of 8 to 200 letters, digits or :._-' using errcode = '22023';
  end if;

  select * into a from public.student_actions x
   where x.id = want_action and x.student_id = me
   for update;
  -- Another student's action is answered exactly like one that does not exist.
  if not found then
    raise exception 'No such action.' using errcode = '42501';
  end if;

  if a.settled_key = want_key then
    if a.state = want_state then
      return jsonb_build_object('id', a.id, 'state', a.state, 'version', a.version, 'replayed', true);
    end if;
    raise exception 'That key was used for another change.' using errcode = '22023';
  end if;

  if want_version is null or a.version <> want_version then
    raise exception 'This action changed since you read it.' using errcode = '40001';
  end if;
  if not ((a.state = 'open' and want_state in ('done', 'dismissed'))
          or (a.state in ('done', 'dismissed') and want_state = 'open')) then
    raise exception 'An action moves from open to done or dismissed, and back.' using errcode = '22023';
  end if;

  -- Only an action the feed would show: its grade version is still the
  -- latest released one for that item.
  select g.version into shown
    from public.grade_entries g
   where g.id = a.grade_entry_id and g.status = 'released';
  if shown is null or exists (
    select 1 from public.grade_entries newer
     where newer.item_id = a.item_id and newer.student_id = me
       and newer.status = 'released' and newer.version > shown
  ) then
    raise exception 'This feedback has been replaced by a newer release.' using errcode = '23514';
  end if;

  update public.student_actions
     set state = want_state, version = a.version + 1, settled_key = want_key, updated_at = now()
   where id = a.id;

  return jsonb_build_object('id', a.id, 'state', want_state, 'version', a.version + 1, 'replayed', false);
end
$$;

revoke all on function public.settle_student_action(uuid, text, integer, text) from public, anon;
grant execute on function public.settle_student_action(uuid, text, integer, text) to authenticated;

comment on function public.my_student_actions() is
  'The caller''s open and dismissed Action Center items from released grades, only while each names their latest released version of the item.';
comment on function public.settle_student_action(uuid, text, integer, text) is
  'The student marks their own action done or dismissed, or reopens it, against the version they read; idempotent on its key.';

-- ── Replay of a per-consumer dead letter, through the existing approval ────
--
-- `replay_domain_event` and its approval trigger (20261008190500) accepted
-- only an event the outbox itself parked. A delivery this relay parks leaves
-- the event row alone, so both now accept either: the event parked, or this
-- consumer's delivery of it parked. Everything else is unchanged and still
-- required: console:operate, fresh MFA, a two-person `projection-replay`
-- approval that binds this event and this consumer, the requester or an
-- approver executing it, the audit row written first and uncaught, and a
-- second execution answering `already_executed`.

create or replace function private.check_projection_replay_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if new.duty_id <> 'projection-replay' then
    return new;
  end if;
  if new.target is null or new.target !~ '^domain-event:[0-9a-f-]{36}$'
     or coalesce(new.detail ->> 'event_id', '') !~ '^[0-9a-f-]{36}$'
     or new.target is distinct from 'domain-event:' || (new.detail ->> 'event_id')
     or coalesce(new.detail ->> 'consumer', '') !~ '^[a-z][a-z0-9_.:-]{2,99}$'
     or coalesce(length(trim(new.detail ->> 'projector_version')), 0) = 0
     or coalesce(length(trim(new.detail ->> 'rollback_plan')), 0) = 0 then
    raise exception 'A projection replay must bind one event, consumer, projector version and rollback plan.'
      using errcode = '22023';
  end if;
  event_id := (new.detail ->> 'event_id')::uuid;
  if not exists (
    select 1 from private.domain_outbox_events e
     where e.id = event_id
       and e.tenant_id is not distinct from new.tenant_id
       and (e.dead_lettered_at is not null
            or exists (
              select 1 from private.domain_event_deliveries d
               where d.event_id = e.id and d.consumer = new.detail ->> 'consumer'
                 and d.dead_lettered_at is not null))
  ) then
    raise exception 'The projection replay target is not a dead letter in this tenant.'
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function private.check_projection_replay_request() from public, anon, authenticated;

create or replace function public.replay_domain_event(
  want_event uuid,
  want_consumer text,
  want_approval uuid,
  want_correlation text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.approval_request%rowtype;
  event_row private.domain_outbox_events%rowtype;
  delivery private.domain_event_deliveries%rowtype;
  per_consumer boolean := false;
  seq bigint;
begin
  if me is null or not private.has_capability('console:operate') then
    raise exception 'console:operate is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  if want_consumer is null or want_consumer !~ '^[a-z][a-z0-9_.:-]{2,99}$' then
    raise exception 'A consumer is a stable lower-case identifier.' using errcode = '22023';
  end if;

  select * into req from public.approval_request r where r.id = want_approval for update;
  if not found or req.duty_id <> 'projection-replay' then
    raise exception 'An approved projection-replay request is required.' using errcode = '42501';
  end if;
  if req.target is distinct from 'domain-event:' || want_event::text
     or req.detail ->> 'event_id' is distinct from want_event::text
     or req.detail ->> 'consumer' is distinct from want_consumer then
    raise exception 'The approval does not bind this event and consumer.' using errcode = '42501';
  end if;
  if req.status = 'executed' then
    return jsonb_build_object('event', want_event, 'consumer', want_consumer, 'replayed', false,
                              'approval', req.id, 'status', 'already_executed');
  end if;
  if req.status <> 'approved' or req.expires_at <= now() then
    raise exception 'The projection replay request is not approved and current.' using errcode = '42501';
  end if;
  if req.requester <> me and not exists (
    select 1 from public.approval_decision d
     where d.request_id = req.id and d.approver = me and d.decision = 'approve'
  ) then
    raise exception 'Only the requester or an approver may execute this replay.' using errcode = '42501';
  end if;

  select * into event_row from private.domain_outbox_events e where e.id = want_event for update;
  if not found then
    raise exception 'The approved event is not dead-lettered.' using errcode = '23514';
  end if;
  if event_row.dead_lettered_at is null then
    select * into delivery from private.domain_event_deliveries d
     where d.consumer = want_consumer and d.event_id = want_event
     for update;
    if not found or delivery.dead_lettered_at is null then
      raise exception 'The approved event is not dead-lettered.' using errcode = '23514';
    end if;
    per_consumer := true;
  end if;

  seq := private.console_audit_write(
    me,
    'authenticated',
    event_row.tenant_id,
    'projection.replayed',
    want_event::text,
    jsonb_build_object('approval', req.id, 'consumer', want_consumer,
                       'attempts', case when per_consumer then delivery.attempts else event_row.publish_attempts end,
                       'scope', case when per_consumer then 'consumer' else 'event' end,
                       'ticket', req.ticket),
    coalesce(want_correlation, req.correlation_id)
  );

  if per_consumer then
    update private.domain_event_deliveries
       set attempts = 0,
           last_error = null,
           dead_lettered_at = null,
           claim_id = null,
           claimed_at = null,
           next_attempt_at = now()
     where consumer = want_consumer and event_id = want_event;
  else
    update private.domain_outbox_events
       set published_at = null,
           publish_attempts = 0,
           last_error = null,
           dead_lettered_at = null,
           claim_id = null,
           claimed_at = null,
           next_attempt_at = now()
     where id = want_event;
  end if;

  update public.approval_request
     set status = 'executed', executed_at = now()
   where id = req.id;

  return jsonb_build_object('event', want_event, 'consumer', want_consumer, 'replayed', true,
                            'approval', req.id, 'status', 'pending', 'auditSeq', seq);
end
$$;

revoke all on function public.replay_domain_event(uuid, text, uuid, text) from public, anon;
grant execute on function public.replay_domain_event(uuid, text, uuid, text) to authenticated;

comment on function public.replay_domain_event(uuid, text, uuid, text) is
  'P1-03 approval-bound, capability-checked and fail-closed-audited replay of one dead-lettered event, or of one consumer''s dead-lettered delivery of it.';

-- ── The operations dashboard learns this source ────────────────────────────
--
-- `ops_projection_dashboard` (20261012000000) declares which events feed each
-- active read model, and `ops-projection-dashboard.check.sql` fails while an
-- active model has no entry. `student_actions` is the third. Its backlog, dead
-- letters and last error are this consumer's own (its receipts and delivery
-- rows), because the event row's outcome columns are not its to read. The two
-- existing entries are read exactly as before. The rest of the function is
-- unchanged.

create or replace function public.ops_projection_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  generated_at timestamptz := statement_timestamp();
  projection_rows jsonb;
  warning_rows jsonb;
  model_count integer;
  mapped_count integer;
  worst_rank integer;
  overall_freshness text;
begin
  if auth.uid() is null or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'console:operate at platform scope is required.';
  end if;

  with sources(projection, version, consumer, event_type, event_version, per_consumer) as (
    values
      ('ops_tenant_entitlements', 1, 'ops.tenant-entitlements.v1', 'entitlement.changed', 1, false),
      ('ops_tenant_rollout',      1, 'ops.tenant-rollout.v1',      'tenant_rollout.changed', 1, false),
      ('student_actions',         1, 'student-actions.grade-release.v1', 'gradebook.grades_released', 1, true)
  ),
  models as (
    select r.name, r.version, r.freshness_slo_seconds
      from private.read_model_registry r
     where r.status = 'active'
     order by r.name, r.version
     limit 100
  ),
  measured as (
    select m.name, m.version, m.freshness_slo_seconds,
           s.consumer, s.event_type,
           (s.projection is not null) as mapped,
           w.status as worker_status,
           w.last_occurred_at, w.last_processed_at,
           case
             when w.projection is null or w.last_occurred_at is null then 'unknown'
             when w.status = 'failed' then 'failed'
             when w.status = 'rebuilding' then 'stale'
             when w.last_occurred_at
                  < generated_at - make_interval(secs => m.freshness_slo_seconds) then 'stale'
             else 'fresh'
           end as freshness,
           pending.behind, pending.oldest_at,
           dead.dead_letters,
           failure.last_error,
           rebuild.status as rebuild_status, rebuild.mode as rebuild_mode,
           rebuild.finished_at as rebuild_finished_at, rebuild.parity_ok
      from models m
      left join sources s on s.projection = m.name and s.version = m.version
      left join private.projection_watermark w on w.projection = m.name and w.version = m.version
      left join lateral (
        select count(*) as behind, min(e.occurred_at) as oldest_at
          from private.domain_outbox_events e
         where s.projection is not null
           and e.event_type = s.event_type and e.event_version = s.event_version
           and (case when s.per_consumer
                  then not exists (
                    select 1 from private.domain_event_deliveries d
                     where d.consumer = s.consumer and d.event_id = e.id
                       and d.dead_lettered_at is not null)
                  else e.published_at is null and e.dead_lettered_at is null end)
           and not exists (
             select 1 from private.domain_event_receipts r
              where r.consumer = s.consumer and r.event_id = e.id
                and r.outcome in ('processed', 'skipped'))
      ) pending on true
      left join lateral (
        select case when s.per_consumer
                 then (select count(*) from private.domain_event_deliveries d
                        join private.domain_outbox_events e on e.id = d.event_id
                       where d.consumer = s.consumer
                         and e.event_type = s.event_type and e.event_version = s.event_version
                         and d.dead_lettered_at is not null)
                 else (select count(*) from private.domain_outbox_events e
                        where e.event_type = s.event_type and e.event_version = s.event_version
                          and e.dead_lettered_at is not null)
               end as dead_letters
         where s.projection is not null
      ) dead on true
      left join lateral (
        select left(f.last_error, 200) as last_error
          from (
            select e.last_error, coalesce(e.dead_lettered_at, e.next_attempt_at, e.occurred_at) as at, e.id
              from private.domain_outbox_events e
             where s.projection is not null and not s.per_consumer
               and e.event_type = s.event_type and e.event_version = s.event_version
               and e.last_error is not null
            union all
            select d.last_error, coalesce(d.dead_lettered_at, d.next_attempt_at, e.occurred_at), e.id
              from private.domain_event_deliveries d
              join private.domain_outbox_events e on e.id = d.event_id
             where s.projection is not null and s.per_consumer and d.consumer = s.consumer
               and e.event_type = s.event_type and e.event_version = s.event_version
               and d.last_error is not null
          ) f
         order by f.at desc, f.id
         limit 1
      ) failure on true
      left join lateral (
        select rr.status, rr.mode, rr.finished_at, rr.parity_ok
          from private.projection_rebuild_run rr
         where rr.projection = m.name
         order by rr.started_at desc, rr.id
         limit 1
      ) rebuild on true
  ),
  shaped as (
    select x.name, x.version, x.mapped,
           case x.freshness when 'failed' then 3 when 'unknown' then 2 when 'stale' then 1 else 0 end as rank,
           jsonb_build_object(
             'projection', x.name,
             'version', x.version,
             'freshness', x.freshness,
             'freshnessSloSeconds', x.freshness_slo_seconds,
             'workerStatus', coalesce(x.worker_status, 'unknown'),
             'lastEventAt', x.last_occurred_at,
             'lastProcessedAt', x.last_processed_at,
             'lagSeconds', case when x.last_occurred_at is null then null
               else greatest(0, floor(extract(epoch from generated_at - x.last_occurred_at)))::integer end,
             'eventsBehind', case when x.mapped then x.behind else null end,
             'oldestPendingSeconds', case when x.mapped and x.oldest_at is not null
               then greatest(0, floor(extract(epoch from generated_at - x.oldest_at)))::integer else null end,
             'deadLetters', case when x.mapped then x.dead_letters else null end,
             'lastError', case when x.mapped then x.last_error else null end,
             'lastRebuild', case when x.rebuild_status is null then null else jsonb_build_object(
               'status', x.rebuild_status, 'mode', x.rebuild_mode,
               'finishedAt', x.rebuild_finished_at, 'parityOk', x.parity_ok) end,
             'eventSourceMapped', x.mapped
           ) as item,
           array_remove(array[
             case when x.freshness = 'unknown' then x.name || ' has never run; do not treat it as healthy.' end,
             case when x.freshness = 'failed' then x.name || ' is failed; read lastError and let retries drain.' end,
             case when x.freshness = 'stale' and x.worker_status = 'rebuilding'
               then x.name || ' is rebuilding; its snapshot may change after parity is verified.' end,
             case when x.freshness = 'stale' and coalesce(x.worker_status, '') <> 'rebuilding'
               then x.name || ' is past its freshness SLO; check eventsBehind to tell idle from stuck.' end,
             case when x.mapped and x.dead_letters > 0
               then x.name || ' has dead-lettered events awaiting a decision.' end,
             case when not x.mapped
               then x.name || ' has no event source mapped, so eventsBehind, deadLetters and lastError are not reported.' end,
             case when x.parity_ok is false
               then x.name || ' last rebuild did not match the live projection.' end
           ], null) as warns
      from measured x
  )
  select coalesce(jsonb_agg(s.item order by s.name, s.version), '[]'::jsonb),
         count(*)::integer,
         count(*) filter (where s.mapped)::integer,
         coalesce(max(s.rank), 2),
         (select coalesce(jsonb_agg(w.warning order by w.warning), '[]'::jsonb)
            from shaped s2 cross join lateral unnest(s2.warns) as w(warning))
    into projection_rows, model_count, mapped_count, worst_rank, warning_rows
    from shaped s;

  overall_freshness := case
    when model_count = 0 then 'unknown'
    when worst_rank = 3 then 'failed'
    when worst_rank = 2 then 'unknown'
    when worst_rank = 1 then 'stale'
    else 'fresh'
  end;

  return jsonb_build_object(
    'data', jsonb_build_object('projections', projection_rows),
    'meta', jsonb_build_object(
      'generatedAt', generated_at,
      'computedAt', generated_at,
      'freshness', overall_freshness,
      'coverage', jsonb_build_object(
        'activeModels', model_count,
        'eventSourcesMapped', mapped_count
      ),
      'authority', 'derived',
      'modelVersion', 1,
      'correlationId', 'ops-projection-dashboard:'
        || floor(extract(epoch from generated_at) * 1000)::bigint::text
    ),
    'permissions', jsonb_build_object(
      'canView', true,
      'canExport', false,
      'allowedActions', '[]'::jsonb
    ),
    'warnings', warning_rows
  );
end
$$;

revoke all on function public.ops_projection_dashboard() from public, anon;
grant execute on function public.ops_projection_dashboard() to authenticated;

comment on function public.ops_projection_dashboard() is
  'Per registered read model: computed freshness, lag, events behind, dead letters, last sanitized error and last rebuild with parity. console:operate at platform scope. Reads operability metadata only, never an event payload, and writes nothing.';
