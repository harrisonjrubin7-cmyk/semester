-- Mentor rosters, with consent on both sides.
--
-- Two things existed. `peer_mentor_assignments` lets a student create an
-- assignment to a mentor holding `mentee:read` in their cohort — the student's
-- insert is the whole consent; the mentor never accepts. `alumni_mentor_offers`
-- lets verified alumni publish topics and a capacity, readable by their school,
-- with no way to ask. And there was no roster of peer mentors at all, so a
-- student could not find one.
--
-- What Launchpad promises a student is stricter: a match is proposed to both,
-- and contact happens only once both accept. This adds exactly that, and
-- nothing else:
--
--   1. `peer_mentor_offers` — a mentor opts in to be found, per cohort, with a
--      display name they choose, topics and a capacity. Only somebody holding
--      `mentee:read` over that cohort may publish one; only students in that
--      cohort (and the mentor) read it.
--   2. `alumni_mentor_offers.display_name` — the alumni offer had no name to
--      show, so the only handle was an account id. Additive, defaulting empty.
--   3. `mentor_requests` — pending → accepted | declined | withdrawn. Only the
--      recipient accepts or declines; only the requester withdraws. A request
--      carries the requester's chosen display name, the ticked topics and a
--      short note — never an email, never a phone number. Capacity is checked
--      when a request is accepted, not when it is sent.
--
-- Every write goes through a function below. No API role holds insert, update
-- or delete on `mentor_requests`, which is how "only the recipient accepts"
-- stays true when somebody reads the table from a console.
--
-- `peer_mentor_assignments` is **not changed**. Its student-only insert path
-- still exists; retiring it is a product decision recorded in the PR.

-- ── 1. Peer mentors, opted in ─────────────────────────────────────────────
create table if not exists public.peer_mentor_offers (
  user_id      uuid        not null references auth.users on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  cohort_scope text        not null check (length(trim(cohort_scope)) between 3 and 200),
  display_name text        not null check (length(trim(display_name)) between 2 and 40),
  topics       text[]      not null default '{}' check (cardinality(topics) <= 12),
  capacity     integer     not null default 3 check (capacity between 0 and 10),
  active       boolean     not null default true,
  updated_at   timestamptz not null default now(),
  primary key (user_id, cohort_scope),
  constraint peer_offer_cohort_in_tenant check (private.scope_in_tenant(cohort_scope, tenant_id))
);
create index if not exists peer_offers_by_cohort on public.peer_mentor_offers (cohort_scope, active);
create index if not exists peer_offers_by_tenant on public.peer_mentor_offers (tenant_id);

alter table public.peer_mentor_offers enable row level security;
revoke all on table public.peer_mentor_offers from anon, authenticated;
grant select, insert, update, delete on table public.peer_mentor_offers to authenticated;

drop policy if exists "a cohort sees its active peer mentors" on public.peer_mentor_offers;
create policy "a cohort sees its active peer mentors" on public.peer_mentor_offers
  for select using (
    user_id = (select auth.uid())
    or (active and tenant_id = (select private.school_of()) and private.in_cohort(cohort_scope))
  );

drop policy if exists "a peer mentor offers in their own cohort" on public.peer_mentor_offers;
create policy "a peer mentor offers in their own cohort" on public.peer_mentor_offers
  for insert with check (
    user_id = (select auth.uid())
    and tenant_id = (select private.school_of())
    and private.has_capability('mentee:read', 'cohort', cohort_scope)
  );

drop policy if exists "a peer mentor edits their offer" on public.peer_mentor_offers;
create policy "a peer mentor edits their offer" on public.peer_mentor_offers
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.has_capability('mentee:read', 'cohort', cohort_scope));

drop policy if exists "a peer mentor withdraws their offer" on public.peer_mentor_offers;
create policy "a peer mentor withdraws their offer" on public.peer_mentor_offers
  for delete using (user_id = (select auth.uid()));

-- ── 2. A name for alumni offers ───────────────────────────────────────────
alter table public.alumni_mentor_offers
  add column if not exists display_name text not null default ''
  check (length(display_name) <= 40);

-- ── 3. Requests, both sides ───────────────────────────────────────────────
create table if not exists public.mentor_requests (
  id             uuid        primary key default gen_random_uuid(),
  kind           text        not null check (kind in ('peer', 'alumni')),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  -- The cohort, for a peer request; empty for alumni.
  cohort_scope   text        not null default '',
  requester      uuid        not null references auth.users on delete cascade,
  recipient      uuid        not null references auth.users on delete cascade,
  requester_name text        not null check (length(trim(requester_name)) between 2 and 40),
  topics         text[]      not null default '{}' check (cardinality(topics) <= 12),
  note           text        not null default '' check (length(note) <= 500),
  status         text        not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  constraint mentor_request_two_people check (requester <> recipient),
  constraint mentor_request_decided check ((status = 'pending') = (decided_at is null))
);
-- One open request per pair and kind; a declined or withdrawn one can be sent again.
create unique index if not exists mentor_requests_one_open
  on public.mentor_requests (requester, recipient, kind) where status = 'pending';
create index if not exists mentor_requests_by_recipient on public.mentor_requests (recipient, status);
create index if not exists mentor_requests_by_requester on public.mentor_requests (requester);
create index if not exists mentor_requests_by_tenant on public.mentor_requests (tenant_id);

alter table public.mentor_requests enable row level security;
revoke all on table public.mentor_requests from anon, authenticated;
grant select on table public.mentor_requests to authenticated;

drop policy if exists "both ends see a request" on public.mentor_requests;
create policy "both ends see a request" on public.mentor_requests
  for select using (requester = (select auth.uid()) or recipient = (select auth.uid()));

-- Send. The recipient must have an active offer the caller can see — the same
-- visibility the roster uses — so a request cannot be aimed at anybody else.
create or replace function public.request_mentor(
  want_kind text, want_recipient uuid, want_cohort text, want_name text, want_topics text[], want_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  school text := private.school_of();
  made   uuid;
begin
  if me is null then raise exception 'Sign in to ask for a mentor.'; end if;
  if want_kind = 'peer' then
    if not exists (
      select 1 from public.peer_mentor_offers o
       where o.user_id = want_recipient and o.cohort_scope = want_cohort and o.active
         and o.tenant_id = school and private.in_cohort(want_cohort)
    ) then
      raise exception 'That mentor is not offering in your cohort.';
    end if;
  elsif want_kind = 'alumni' then
    if not exists (
      select 1 from public.alumni_mentor_offers o
       where o.user_id = want_recipient and o.active and o.tenant_id = school
    ) then
      raise exception 'That alum is not offering to mentor at your school.';
    end if;
    want_cohort := '';
  else
    raise exception 'A mentor request is peer or alumni.';
  end if;
  insert into public.mentor_requests (kind, tenant_id, cohort_scope, requester, recipient, requester_name, topics, note)
  values (want_kind, school, coalesce(want_cohort, ''), me, want_recipient, trim(want_name),
          coalesce(want_topics, '{}'), coalesce(want_note, ''))
  returning id into made;
  return made;
end $$;

-- Answer. The recipient accepts or declines a pending request; the requester
-- withdraws one. Accepting is refused when the recipient is already at capacity.
create or replace function public.answer_mentor_request(want uuid, want_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := auth.uid();
  r   public.mentor_requests;
  cap integer;
  taken integer;
begin
  select * into r from public.mentor_requests where id = want for update;
  if r.id is null or r.status <> 'pending' then raise exception 'That request is not open.'; end if;
  if want_status in ('accepted', 'declined') then
    if r.recipient <> me then raise exception 'Only the person asked can answer.'; end if;
  elsif want_status = 'withdrawn' then
    if r.requester <> me then raise exception 'Only the person who asked can withdraw.'; end if;
  else
    raise exception 'Not an answer: %', want_status;
  end if;
  if want_status = 'accepted' then
    -- Lock the offer before counting: two acceptances against the last slot
    -- each lock a different request, so without this both read the same count
    -- and both pass. The second now waits, then counts the first's accept.
    -- A peer offer is per cohort, so its capacity counts that cohort only.
    if r.kind = 'peer' then
      select capacity into cap from public.peer_mentor_offers
       where user_id = me and cohort_scope = r.cohort_scope for update;
      select count(*) into taken from public.mentor_requests
       where recipient = me and kind = 'peer' and cohort_scope = r.cohort_scope and status = 'accepted';
    else
      select capacity into cap from public.alumni_mentor_offers where user_id = me for update;
      select count(*) into taken from public.mentor_requests
       where recipient = me and kind = r.kind and status = 'accepted';
    end if;
    if cap is null or taken >= cap then raise exception 'You are at your mentoring capacity.'; end if;
  end if;
  update public.mentor_requests set status = want_status, decided_at = now() where id = want;
end $$;

-- Forget. Both ends may remove every request they are party to.
create or replace function public.forget_my_mentor_requests()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.mentor_requests
     where requester = (select auth.uid()) or recipient = (select auth.uid())
    returning 1
  ) select count(*)::integer from gone;
$$;

revoke all on function public.request_mentor(text, uuid, text, text, text[], text) from public, anon;
revoke all on function public.answer_mentor_request(uuid, text) from public, anon;
revoke all on function public.forget_my_mentor_requests() from public, anon;
grant execute on function public.request_mentor(text, uuid, text, text, text[], text) to authenticated;
grant execute on function public.answer_mentor_request(uuid, text) to authenticated;
grant execute on function public.forget_my_mentor_requests() to authenticated;

comment on table public.peer_mentor_offers is
  'Peer mentors who opted in to be found, per cohort, with a chosen display name. Readable by students in that cohort.';
comment on table public.mentor_requests is
  'Two-sided mentor requests. Written only through request_mentor / answer_mentor_request / forget_my_mentor_requests; read by the two people in each.';


-- ── 4. A mentor request makes an account not fresh ────────────────────────
-- `lti_account_untouched` decides whether a Brightspace launch may adopt an
-- account as a fresh one. An account that has asked for a mentor, or been
-- asked, or offered to mentor, is not fresh, so the list gains `mentor_requests`
-- at both ends and both offer tables.
-- Otherwise the definition from 20260927230000_help_requests.sql, unchanged —
-- `ltiaccount.test.ts` reads whichever migration defines it last.
create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.help_requests',        'student_id'),
      ('public.mentor_requests',      'requester'),
      ('public.mentor_requests',      'recipient'),
      ('public.peer_mentor_offers',   'user_id'),
      ('public.alumni_mentor_offers', 'user_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;


-- Rolling back:
--   drop function if exists public.forget_my_mentor_requests();
--   drop function if exists public.answer_mentor_request(uuid, text);
--   drop function if exists public.request_mentor(text, uuid, text, text, text[], text);
--   drop table if exists public.mentor_requests, public.peer_mentor_offers;
--   alter table public.alumni_mentor_offers drop column if exists display_name;
