-- Semester — onboarding the server remembers, and a one-use hand-off.
--
-- Safe to run again; each statement changes nothing once it has run.
--
-- ## Why
--
-- `public.onboarding_progress` (20260926150000) is a checklist a student ticks on
-- one device: a step key and a time, owned by the account. It cannot say *which*
-- version of the tour a step belonged to, it lets the client write its own
-- completion, and it forgets why anyone was there. The three PDFs behind this
-- (UX teardown, journey flowchart, company-site and onboarding system) ask for the
-- server to hold the durable truth and the device to hold a replaceable view:
--
--   * a journey is versioned, and progress is kept against the version it was
--     made under, so changing the tour never silently re-opens or loses anyone's;
--   * the client may read its own progress but cannot write it. A step is
--     completed by a function that checks who is asking, that the step exists in
--     the journey as published, and that it has not been done already;
--   * how someone arrived (`entry_context`) is kept as a short allowlist of facts,
--     never as a claim: nothing in it grants a role, a tenant or a capability.
--     The allowlist is the one `app/src/lib/entrycontext.ts` applies in the
--     browser, repeated here because the browser is not trusted;
--   * a hand-off from a public link into the app is a short-lived, single-use,
--     server-recorded transaction that names a screen from a fixed list and
--     carries nothing that authorises anything.
--
-- `onboarding_progress` is left exactly as it is. Nothing here reads or writes it;
-- the student's own checklist and the server's journeys do different jobs and the
-- app may move from one to the other when a journey is published.
--
-- ## What is *not* here
--
--   * No journey is seeded. What the tour says is a product decision made by
--     publishing a row as the service role, not by a migration.
--   * No client can read an institution's aggregate adoption. That needs a cohort
--     floor and a consent decision (docs/marketing/MARKETING_ANALYTICS_EVENT_TAXONOMY.md §6)
--     and is a later change.
--   * `tenant_id` on an assignment is only ever set by the service role, after it
--     has checked a membership. A signed-in account cannot choose its own.
--
-- Rollback: forward-only, as ROLLBACK.md says. To retire, set a journey's status to
-- 'retired'; to withdraw the hand-off, revoke execute on its two functions.

-- ── 1. What a link may say (the same allowlist as lib/entrycontext.ts) ──────────

create schema if not exists private;

create or replace function private.entry_context(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) as e
   where jsonb_typeof(e.value) = 'string'
     and (
          (e.key = 'source' and (e.value #>> '{}') in (
             'organic_search', 'paid_campaign', 'social', 'youtube', 'email',
             'referral', 'institution_invite', 'partner', 'direct'))
       or (e.key in ('campaignId', 'contentId', 'referralCode')
             and (e.value #>> '{}') ~ '^[A-Za-z0-9_-]{1,64}$')
       or (e.key = 'roleHint' and (e.value #>> '{}') in (
             'student', 'applicant', 'faculty', 'advisor', 'institution_admin',
             'institution_buyer', 'guardian', 'partner', 'developer'))
       or (e.key = 'continueTo' and (e.value #>> '{}') in (
             'home', 'courses', 'study', 'calendar', 'support', 'mine', 'me',
             'settings', 'ask', 'account'))
     );
$$;

-- ── 2. Journeys: what the tour is, by version ───────────────────────────────────

create table if not exists public.onboarding_journeys (
  id           uuid        primary key default gen_random_uuid(),
  key          text        not null check (key ~ '^[a-z0-9_]{2,60}$'),
  version      integer     not null check (version >= 1),
  audience     text        not null check (audience in (
                 'student', 'applicant', 'faculty', 'advisor', 'institution_admin',
                 'institution_buyer', 'developer')),
  status       text        not null default 'draft' check (status in ('draft', 'published', 'retired')),
  -- { "steps": [ { "key": "goal", "version": 1, "required": true, "activation": false }, … ] }
  definition   jsonb       not null check (
                 jsonb_typeof(definition) = 'object'
             and jsonb_typeof(definition -> 'steps') = 'array'
             and jsonb_array_length(definition -> 'steps') between 1 and 40),
  published_at timestamptz,
  retired_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (key, version),
  constraint onboarding_journey_published_has_time check ((status = 'published') <= (published_at is not null))
);
alter table public.onboarding_journeys enable row level security;
revoke all on table public.onboarding_journeys from anon, authenticated;
grant select on table public.onboarding_journeys to authenticated;
drop policy if exists "a signed-in account reads published journeys" on public.onboarding_journeys;
create policy "a signed-in account reads published journeys" on public.onboarding_journeys
  for select to authenticated using (status = 'published');

-- ── 3. Assignments: which journey, at which version, for whom ──────────────────

create table if not exists public.onboarding_assignments (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  tenant_id     text        references public.schools(id) on delete set null,
  journey_id    uuid        not null references public.onboarding_journeys(id) on delete restrict,
  entry_context jsonb       not null default '{}'::jsonb check (
                  jsonb_typeof(entry_context) = 'object' and pg_column_size(entry_context) <= 1024),
  status        text        not null default 'in_progress' check (status in ('in_progress', 'completed', 'paused')),
  assigned_at   timestamptz not null default now(),
  activated_at  timestamptz,
  completed_at  timestamptz,
  constraint onboarding_assignment_completed_has_time check ((status = 'completed') = (completed_at is not null))
);
create unique index if not exists onboarding_assignments_one_per_journey
  on public.onboarding_assignments (user_id, (coalesce(tenant_id, '')), journey_id);
create index if not exists onboarding_assignments_by_user on public.onboarding_assignments (user_id, assigned_at desc);
alter table public.onboarding_assignments enable row level security;
revoke all on table public.onboarding_assignments from anon, authenticated;
grant select on table public.onboarding_assignments to authenticated;
drop policy if exists "an account reads its own assignments" on public.onboarding_assignments;
create policy "an account reads its own assignments" on public.onboarding_assignments
  for select to authenticated using (user_id = (select auth.uid()));

-- ── 4. Step progress, against the step's own version ───────────────────────────

create table if not exists public.onboarding_step_progress (
  id            uuid        primary key default gen_random_uuid(),
  assignment_id uuid        not null references public.onboarding_assignments(id) on delete cascade,
  step_key      text        not null check (step_key ~ '^[a-z0-9_]{2,60}$'),
  step_version  integer     not null check (step_version >= 1),
  status        text        not null check (status in ('completed', 'skipped')),
  completed_at  timestamptz,
  skipped_at    timestamptz,
  skip_reason   text        check (skip_reason in ('not_now', 'not_relevant', 'will_do_later')),
  channel       text        not null default 'web' check (channel in ('web', 'pwa', 'ios', 'android')),
  unique (assignment_id, step_key, step_version),
  constraint onboarding_step_shape check (
    (status = 'completed' and completed_at is not null and skipped_at is null and skip_reason is null)
 or (status = 'skipped'   and skipped_at   is not null and completed_at is null))
);
alter table public.onboarding_step_progress enable row level security;
revoke all on table public.onboarding_step_progress from anon, authenticated;
grant select on table public.onboarding_step_progress to authenticated;
drop policy if exists "an account reads progress on its own assignments" on public.onboarding_step_progress;
create policy "an account reads progress on its own assignments" on public.onboarding_step_progress
  for select to authenticated using (
    exists (select 1 from public.onboarding_assignments a
             where a.id = assignment_id and a.user_id = (select auth.uid())));

-- ── 5. Events: an append-only record of what changed ───────────────────────────
--
-- No free text and no identifiers beyond the account: the key is from a fixed
-- list and the metadata is small. What the PDFs call a funnel is read from here
-- by the operator, with a cohort floor, not by the browser.

create table if not exists public.onboarding_events (
  id            uuid        primary key default gen_random_uuid(),
  assignment_id uuid        references public.onboarding_assignments(id) on delete cascade,
  account_id    uuid        not null references auth.users on delete cascade,
  event_key     text        not null check (event_key in (
                  'journey_assigned', 'step_completed', 'step_skipped',
                  'activation_achieved', 'journey_completed', 'handoff_consumed')),
  occurred_at   timestamptz not null default now(),
  channel       text        not null default 'web' check (channel in ('web', 'pwa', 'ios', 'android')),
  metadata      jsonb       not null default '{}'::jsonb check (
                  jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 512)
);
create index if not exists onboarding_events_by_account on public.onboarding_events (account_id, occurred_at desc);
alter table public.onboarding_events enable row level security;
revoke all on table public.onboarding_events from anon, authenticated;
grant select on table public.onboarding_events to authenticated;
drop policy if exists "an account reads its own onboarding events" on public.onboarding_events;
create policy "an account reads its own onboarding events" on public.onboarding_events
  for select to authenticated using (account_id = (select auth.uid()));

-- ── 6. Starting: the only way an assignment comes to exist ─────────────────────
--
-- Takes the journey's key and what the link said. Never a tenant, a role or a
-- version: the version is the newest published one, and the tenant is not the
-- client's to name. An account that already has an assignment for this journey
-- key gets that one back, at the version it began under.

create or replace function public.start_onboarding(
  p_journey text,
  p_entry   jsonb default '{}'::jsonb,
  p_channel text  default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  j       public.onboarding_journeys%rowtype;
  found_id uuid;
  new_id  uuid;
begin
  if me is null then
    raise exception 'start_onboarding needs a signed-in account' using errcode = '28000';
  end if;
  if p_channel not in ('web', 'pwa', 'ios', 'android') then
    raise exception 'unknown channel' using errcode = '22023';
  end if;

  -- Already started under some version of this journey: that one, unchanged.
  select a.id into found_id
    from public.onboarding_assignments a
    join public.onboarding_journeys jj on jj.id = a.journey_id
   where a.user_id = me and jj.key = p_journey
   order by a.assigned_at desc
   limit 1;
  if found_id is not null then
    return found_id;
  end if;

  select * into j
    from public.onboarding_journeys
   where key = p_journey and status = 'published'
   order by version desc
   limit 1;
  if not found then
    raise exception 'no published journey % ', p_journey using errcode = 'P0002';
  end if;

  insert into public.onboarding_assignments (user_id, journey_id, entry_context)
  values (me, j.id, private.entry_context(p_entry))
  on conflict do nothing
  returning id into new_id;

  if new_id is null then
    -- A second device raced this one to the same row.
    select a.id into new_id
      from public.onboarding_assignments a
     where a.user_id = me and a.journey_id = j.id and a.tenant_id is null;
    return new_id;
  end if;

  insert into public.onboarding_events (assignment_id, account_id, event_key, channel)
  values (new_id, me, 'journey_assigned', p_channel);
  return new_id;
end $$;

-- ── 7. Completing or skipping a step ───────────────────────────────────────────
--
-- Checks, in order: the account is signed in; the assignment is theirs; the step
-- exists in *the version of the journey the assignment was made under*; a step may
-- be skipped only if the definition does not mark it required. Doing a step twice
-- is not an error and writes nothing the second time (so a retry from a flaky
-- connection is safe). Answers the assignment's status.

create or replace function public.complete_onboarding_step(
  p_assignment   uuid,
  p_step         text,
  p_step_version integer,
  p_channel      text default 'web'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  a        public.onboarding_assignments%rowtype;
  steps    jsonb;
  step     jsonb;
  inserted uuid;
  open_required integer;
begin
  if me is null then
    raise exception 'complete_onboarding_step needs a signed-in account' using errcode = '28000';
  end if;
  if p_channel not in ('web', 'pwa', 'ios', 'android') then
    raise exception 'unknown channel' using errcode = '22023';
  end if;

  select * into a from public.onboarding_assignments where id = p_assignment and user_id = me for update;
  if not found then
    raise exception 'no such assignment' using errcode = 'P0002';
  end if;

  select j.definition -> 'steps' into steps from public.onboarding_journeys j where j.id = a.journey_id;
  select s into step
    from jsonb_array_elements(steps) s
   where s ->> 'key' = p_step and (s ->> 'version')::integer = p_step_version;
  if step is null then
    raise exception 'no such step in this journey' using errcode = 'P0002';
  end if;

  insert into public.onboarding_step_progress
         (assignment_id, step_key, step_version, status, completed_at, channel)
  values (a.id, p_step, p_step_version, 'completed', now(), p_channel)
  on conflict (assignment_id, step_key, step_version) do nothing
  returning id into inserted;

  if inserted is not null then
    insert into public.onboarding_events (assignment_id, account_id, event_key, channel, metadata)
    values (a.id, me, 'step_completed', p_channel, jsonb_build_object('step', p_step, 'v', p_step_version));

    if coalesce((step ->> 'activation')::boolean, false) and a.activated_at is null then
      update public.onboarding_assignments set activated_at = now() where id = a.id;
      insert into public.onboarding_events (assignment_id, account_id, event_key, channel)
      values (a.id, me, 'activation_achieved', p_channel);
    end if;
  end if;

  -- Done when every required step has been completed (a skipped one does not count).
  select count(*) into open_required
    from jsonb_array_elements(steps) s
   where coalesce((s ->> 'required')::boolean, false)
     and not exists (
       select 1 from public.onboarding_step_progress p
        where p.assignment_id = a.id and p.step_key = s ->> 'key'
          and p.step_version = (s ->> 'version')::integer and p.status = 'completed');
  if open_required = 0 and a.status <> 'completed' then
    update public.onboarding_assignments set status = 'completed', completed_at = now() where id = a.id;
    insert into public.onboarding_events (assignment_id, account_id, event_key, channel)
    values (a.id, me, 'journey_completed', p_channel);
    return 'completed';
  end if;
  return (select status from public.onboarding_assignments where id = a.id);
end $$;

create or replace function public.skip_onboarding_step(
  p_assignment   uuid,
  p_step         text,
  p_step_version integer,
  p_reason       text,
  p_channel      text default 'web'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  a        public.onboarding_assignments%rowtype;
  step     jsonb;
  inserted uuid;
begin
  if me is null then
    raise exception 'skip_onboarding_step needs a signed-in account' using errcode = '28000';
  end if;
  if p_channel not in ('web', 'pwa', 'ios', 'android') then
    raise exception 'unknown channel' using errcode = '22023';
  end if;
  if p_reason not in ('not_now', 'not_relevant', 'will_do_later') then
    raise exception 'unknown reason' using errcode = '22023';
  end if;

  select * into a from public.onboarding_assignments where id = p_assignment and user_id = me for update;
  if not found then
    raise exception 'no such assignment' using errcode = 'P0002';
  end if;

  select s into step
    from public.onboarding_journeys j, jsonb_array_elements(j.definition -> 'steps') s
   where j.id = a.journey_id and s ->> 'key' = p_step and (s ->> 'version')::integer = p_step_version;
  if step is null then
    raise exception 'no such step in this journey' using errcode = 'P0002';
  end if;
  if coalesce((step ->> 'required')::boolean, false) then
    raise exception 'a required step cannot be skipped' using errcode = '42501';
  end if;

  insert into public.onboarding_step_progress
         (assignment_id, step_key, step_version, status, skipped_at, skip_reason, channel)
  values (a.id, p_step, p_step_version, 'skipped', now(), p_reason, p_channel)
  on conflict (assignment_id, step_key, step_version) do nothing
  returning id into inserted;

  if inserted is not null then
    insert into public.onboarding_events (assignment_id, account_id, event_key, channel, metadata)
    values (a.id, me, 'step_skipped', p_channel, jsonb_build_object('step', p_step, 'v', p_step_version, 'why', p_reason));
  end if;
  return (select status from public.onboarding_assignments where id = a.id);
end $$;

-- ── 8. The hand-off: a public link becomes a screen, once ─────────────────────
--
-- The server (the service role, from an Edge Function that has resolved a link)
-- records a transaction and gives the visitor an unguessable nonce. Only a hash
-- of the nonce is stored. A signed-in account presents the id and the nonce, and
-- gets back the screen and the sanitised context — once, within fifteen minutes.
--
-- It is a *routing request, not proof of authority*: the screen is from a fixed
-- list, and the app still decides what that account may open. Wrong id, wrong
-- nonce, already used and expired all answer the same null, so the answer does
-- not tell a guesser which part was wrong; a wrong nonce does not use it up.

create table if not exists public.handoff_transactions (
  id            uuid        primary key default gen_random_uuid(),
  nonce_hash    text        not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  route         text        not null check (route in (
                  'home', 'courses', 'study', 'calendar', 'support', 'mine', 'me',
                  'settings', 'ask', 'account')),
  entry_context jsonb       not null default '{}'::jsonb check (
                  jsonb_typeof(entry_context) = 'object' and pg_column_size(entry_context) <= 1024),
  status        text        not null default 'created' check (status in ('created', 'consumed', 'expired', 'revoked')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  consumed_by   uuid        references auth.users on delete set null,
  constraint handoff_is_short_lived check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  constraint handoff_consumed_has_time check ((status = 'consumed') = (consumed_at is not null))
);
create index if not exists handoff_transactions_by_expiry on public.handoff_transactions (expires_at);
alter table public.handoff_transactions enable row level security;
-- No client reads or writes this table at all: no grant and no policy.
revoke all on table public.handoff_transactions from anon, authenticated;

create or replace function public.create_handoff(
  p_route       text,
  p_nonce_hash  text,
  p_entry       jsonb   default '{}'::jsonb,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.handoff_transactions (nonce_hash, route, entry_context, expires_at)
  values (p_nonce_hash, p_route, private.entry_context(p_entry),
          now() + make_interval(secs => greatest(1, least(coalesce(p_ttl_seconds, 300), 900))))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.consume_handoff(p_id uuid, p_nonce text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  got record;
begin
  if me is null then
    raise exception 'consume_handoff needs a signed-in account' using errcode = '28000';
  end if;
  if p_nonce is null or length(p_nonce) not between 16 and 200 then
    return null;
  end if;

  update public.handoff_transactions h
     set status = 'consumed', consumed_at = now(), consumed_by = me
   where h.id = p_id
     and h.status = 'created'
     and h.expires_at > now()
     and h.nonce_hash = encode(sha256(convert_to(p_nonce, 'utf8')), 'hex')
  returning h.route, h.entry_context into got;

  if not found then
    return null;
  end if;

  insert into public.onboarding_events (account_id, event_key, metadata)
  values (me, 'handoff_consumed', jsonb_build_object('route', got.route));
  return jsonb_build_object('route', got.route, 'entry', got.entry_context);
end $$;

-- Sweeps what is spent or stale. Run by the operator's schedule, as the service role.
create or replace function public.sweep_handoffs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.handoff_transactions set status = 'expired'
   where status = 'created' and expires_at <= now();
  delete from public.handoff_transactions
   where status in ('consumed', 'expired', 'revoked') and created_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 9. Who may call what ───────────────────────────────────────────────────────
--
-- Revoked from PUBLIC *and* from the two client roles by name. Supabase's default
-- privileges grant EXECUTE on every new function in `public` to `anon`,
-- `authenticated` and `service_role` directly, so revoking from PUBLIC alone leaves
-- all three holding it (the check caught exactly that: a signed-out visitor reached
-- `consume_handoff`). `access.check.sql` records the opposite trap, a revoke by role
-- name that leaves the grant held through PUBLIC; both are closed here.

revoke all on function public.start_onboarding(text, jsonb, text) from public, anon;
revoke all on function public.complete_onboarding_step(uuid, text, integer, text) from public, anon;
revoke all on function public.skip_onboarding_step(uuid, text, integer, text, text) from public, anon;
revoke all on function public.consume_handoff(uuid, text) from public, anon;
revoke all on function public.create_handoff(text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.sweep_handoffs() from public, anon, authenticated;
revoke all on function private.entry_context(jsonb) from public, anon, authenticated;

grant execute on function public.start_onboarding(text, jsonb, text) to authenticated;
grant execute on function public.complete_onboarding_step(uuid, text, integer, text) to authenticated;
grant execute on function public.skip_onboarding_step(uuid, text, integer, text, text) to authenticated;
grant execute on function public.consume_handoff(uuid, text) to authenticated;
grant execute on function public.create_handoff(text, text, jsonb, integer) to service_role;
grant execute on function public.sweep_handoffs() to service_role;

-- ── 10. Indexes the foreign keys need ──────────────────────────────────────────
--
-- `indexes.check.sql` asks for one per foreign-key column, because a delete on the
-- parent otherwise scans the child. `onboarding_assignments.user_id` is the first
-- column of two indexes above already.

create index if not exists onboarding_assignments_by_journey on public.onboarding_assignments (journey_id);
create index if not exists onboarding_assignments_by_tenant on public.onboarding_assignments (tenant_id) where tenant_id is not null;
create index if not exists onboarding_events_by_assignment on public.onboarding_events (assignment_id) where assignment_id is not null;
create index if not exists handoff_transactions_by_consumer on public.handoff_transactions (consumed_by) where consumed_by is not null;
