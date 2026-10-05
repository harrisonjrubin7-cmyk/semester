-- Semester — an invite-only private beta: programs, cohorts, invitations,
-- memberships, feedback, known issues and a way out.
--
-- Launch-readiness Phase 1. `docs/PRIVATE-BETA-PROGRAM.md` is the prose half;
-- `supabase/beta.check.sql` proves every rule below with two accounts.
--
-- ## What this builds on rather than copies
--
--   * Sign-up stays gated by `20260921002428_invites.sql`. An invitation here
--     also puts the address on `public.invites`, so the one gate that covers
--     every sign-up route is the one that admits a beta tester. Nothing here
--     is a second gate.
--   * Who may run a beta is a capability on the existing matrix
--     (`20260922012000_capabilities.sql`), not a new role system.
--   * Whether writeback is possible is read from the kill switches in
--     `20260927170000_integration_control_plane.sql`, not restated.
--
-- ## The rule that makes it a *controlled* beta
--
-- The launch command forbids irreversible official transactions during a beta.
-- So a program cannot be made `active` unless `kill.writeback` is engaged for
-- its scope — the school's own switch or the global one, read through
-- `public.kill_switch_engaged`. And because a switch can be released after
-- activation, `my_beta()` reports a program as live only while both hold: an
-- `active` status with the switch released reads as paused to every member.
-- A beta that says it is running while a grade could be written back is the
-- exact state this refuses to represent.
--
-- ## Privacy shape
--
-- Every table has RLS on and no policy, and the API roles hold no grant: the
-- only way in is the functions below, each `security definer`, each checking
-- its own caller. Staff read feedback **without** the sender's identity —
-- `beta_feedback_queue` returns the words, the kind, the screen and the cohort
-- kind, and never an account id or address. Answers go out as known issues,
-- which every member of the program can read.
--
-- ## Deleting an account
--
-- `forget_my_beta()` removes the caller's memberships (feedback and exit
-- records cascade) and any invitation to their confirmed address. It is in
-- `OWNED_TABLES` in `app/src/lib/cloud.ts` as the `via` for these tables.
-- The address stays on `public.invites`; that list predates this file and
-- `RETENTION.md` already answers for it.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('beta:manage', 'Run an invite-only beta: programs, cohorts, invitations, known issues and activation.'),
  ('beta:triage', 'Read and triage beta feedback, which carries no sender identity, and publish known issues.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('platform_admin', 'beta:manage'),
  ('platform_admin', 'beta:triage'),
  ('support_agent',  'beta:triage')
on conflict (role, capability) do nothing;

-- ── 2. Tables ─────────────────────────────────────────────────────────────

create table if not exists public.beta_programs (
  id               text        primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  name             text        not null check (length(trim(name)) between 1 and 120),
  school_id        text        references public.schools(id) on delete restrict,
  status           text        not null default 'draft'
                               check (status in ('draft', 'active', 'paused', 'closed')),
  -- Where a member reaches a person. In-app feedback is always on; this is the
  -- human route beside it, and a beta without one does not start.
  support_contact  text        not null check (length(trim(support_contact)) between 3 and 200),
  starts_on        date,
  ends_on          date,
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users(id) on delete set null,
  constraint beta_program_dates check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index if not exists beta_programs_by_school on public.beta_programs (school_id);
create index if not exists beta_programs_by_creator on public.beta_programs (created_by);

-- The six cohorts the launch command names, each capped at the top of its
-- stated range. A cap is a ceiling, not a target.
create table if not exists public.beta_cohorts (
  id          uuid    primary key default gen_random_uuid(),
  program_id  text    not null references public.beta_programs(id) on delete cascade,
  kind        text    not null check (kind in (
                'students', 'transfer_students', 'faculty_tas',
                'advisors_staff', 'accessibility_testers', 'tenant_admins')),
  capacity    integer not null,
  constraint beta_cohort_capacity check (capacity between 1 and case kind
    when 'students'              then 50
    when 'transfer_students'     then 25
    when 'faculty_tas'           then 15
    when 'advisors_staff'        then 10
    when 'accessibility_testers' then 10
    when 'tenant_admins'         then 5
  end),
  unique (program_id, kind)
);

create table if not exists public.beta_invitations (
  id           uuid        primary key default gen_random_uuid(),
  cohort_id    uuid        not null references public.beta_cohorts(id) on delete cascade,
  email        text        not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_at   timestamptz not null default now(),
  invited_by   uuid        references auth.users(id) on delete set null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  unique (cohort_id, email)
);
create index if not exists beta_invitations_by_email on public.beta_invitations (email);
create index if not exists beta_invitations_by_inviter on public.beta_invitations (invited_by);

create table if not exists public.beta_memberships (
  id             uuid        primary key default gen_random_uuid(),
  cohort_id      uuid        not null references public.beta_cohorts(id) on delete cascade,
  invitation_id  uuid        references public.beta_invitations(id) on delete set null,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  unique (cohort_id, user_id)
);
create index if not exists beta_memberships_by_user on public.beta_memberships (user_id);
create index if not exists beta_memberships_by_invitation on public.beta_memberships (invitation_id);
-- One live membership per account, held by the database rather than by the
-- check in join_beta: two joins for invitations in different cohorts lock
-- different rows, and each could see no membership before either inserted.
create unique index if not exists beta_memberships_one_live
  on public.beta_memberships (user_id) where left_at is null;

-- What the program turns on for its members. A record for the members'
-- "what's in this beta" list; flag state itself stays in
-- `tenant_feature_policy`. The check is the command's rule in the one place a
-- beta could otherwise declare it: no writeback flag and no kill switch.
create table if not exists public.beta_feature_flags (
  program_id  text not null references public.beta_programs(id) on delete cascade,
  flag_key    text not null check (flag_key ~ '^[a-z_]+\.[a-z0-9_.]+$' and flag_key !~ '^(writeback|kill)\.'),
  about       text not null default '' check (length(about) <= 300),
  primary key (program_id, flag_key)
);

create table if not exists public.beta_known_issues (
  id          uuid        primary key default gen_random_uuid(),
  program_id  text        not null references public.beta_programs(id) on delete cascade,
  title       text        not null check (length(trim(title)) between 1 and 200),
  detail      text        not null default '' check (length(detail) <= 4000),
  workaround  text        not null default '' check (length(workaround) <= 2000),
  status      text        not null default 'open' check (status in ('open', 'fixed', 'wont_fix')),
  published   boolean     not null default false,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists beta_known_issues_by_program on public.beta_known_issues (program_id);
create index if not exists beta_known_issues_by_creator on public.beta_known_issues (created_by);

create table if not exists public.beta_feedback (
  id             uuid        primary key default gen_random_uuid(),
  membership_id  uuid        not null references public.beta_memberships on delete cascade,
  kind           text        not null check (kind in ('bug', 'confusing', 'accessibility', 'idea', 'other')),
  body           text        not null check (length(trim(body)) between 1 and 4000),
  -- The screen, as a route shape. Never a query string or an id.
  route          text        check (route is null or route ~ '^#/[a-z0-9/_-]{0,80}$'),
  status         text        not null default 'new' check (status in ('new', 'triaged', 'closed')),
  created_at     timestamptz not null default now()
);
create index if not exists beta_feedback_by_membership on public.beta_feedback (membership_id);

create table if not exists public.beta_exit_requests (
  id              uuid        primary key default gen_random_uuid(),
  membership_id   uuid        not null unique references public.beta_memberships on delete cascade,
  requested_at    timestamptz not null default now(),
  reason          text        not null default '' check (length(reason) <= 1000),
  keeps_account   boolean     not null
);

-- RLS on and no policy; no grant to either API role. Written out per table,
-- because `tablerls.test.ts` holds every created table to its own statement.
alter table public.beta_programs enable row level security;
revoke all on public.beta_programs from anon, authenticated;
alter table public.beta_cohorts enable row level security;
revoke all on public.beta_cohorts from anon, authenticated;
alter table public.beta_invitations enable row level security;
revoke all on public.beta_invitations from anon, authenticated;
alter table public.beta_memberships enable row level security;
revoke all on public.beta_memberships from anon, authenticated;
alter table public.beta_feature_flags enable row level security;
revoke all on public.beta_feature_flags from anon, authenticated;
alter table public.beta_known_issues enable row level security;
revoke all on public.beta_known_issues from anon, authenticated;
alter table public.beta_feedback enable row level security;
revoke all on public.beta_feedback from anon, authenticated;
alter table public.beta_exit_requests enable row level security;
revoke all on public.beta_exit_requests from anon, authenticated;

-- ── 3. Helpers ────────────────────────────────────────────────────────────

create or replace function private.beta_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('beta:manage', 'platform', '');
$$;
revoke all on function private.beta_manager() from public;

create or replace function private.beta_triager()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('beta:triage', 'platform', '');
$$;
revoke all on function private.beta_triager() from public;

-- Whether writeback is stopped for a program's scope. `kill_switch_engaged`
-- answers true for the global row or the school's own.
create or replace function private.beta_writeback_stopped(want_school text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.kill_switch_engaged('kill.writeback', want_school);
$$;
revoke all on function private.beta_writeback_stopped(text) from public;

-- The caller's confirmed address, or null. An unconfirmed address matches no
-- invitation: an invitation is to a mailbox, and only a confirmed one proves it.
create or replace function private.beta_confirmed_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
   where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function private.beta_confirmed_email() from public;

-- The caller's one live membership, if any.
create or replace function private.beta_my_membership()
returns public.beta_memberships language sql stable security definer set search_path = '' as $$
  select m.* from public.beta_memberships m
   where m.user_id = (select auth.uid()) and m.left_at is null
   order by m.joined_at desc limit 1;
$$;
revoke all on function private.beta_my_membership() from public;

-- ── 4. Staff: running a program ───────────────────────────────────────────

create or replace function public.beta_create_program(
  want_id text, want_name text, want_school text, want_support_contact text
) returns text language plpgsql security definer set search_path = '' as $$
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.beta_programs (id, name, school_id, support_contact, created_by)
  values (want_id, want_name, want_school, want_support_contact, (select auth.uid()));
  return want_id;
end $$;

create or replace function public.beta_add_cohort(want_program text, want_kind text, want_capacity integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.beta_cohorts (program_id, kind, capacity)
  values (want_program, want_kind, want_capacity)
  returning id into made;
  return made;
end $$;

/*
 * An invitation holds a seat. Seats taken = live members + invitations still
 * open, so a cohort of twenty cannot be sent forty invitations and let the
 * first twenty in. The cohort row is locked so two invitations sent at once
 * cannot both see the last seat free.
 */
create or replace function public.beta_invite(want_cohort uuid, want_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c public.beta_cohorts;
  p public.beta_programs;
  address text := lower(trim(want_email));
  taken integer;
  made uuid;
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  select * into c from public.beta_cohorts where id = want_cohort for update;
  if not found then raise exception 'no such cohort'; end if;
  select * into p from public.beta_programs where id = c.program_id;
  if p.status = 'closed' then raise exception 'the program is closed'; end if;

  select (select count(*) from public.beta_memberships m where m.cohort_id = c.id and m.left_at is null)
       + (select count(*) from public.beta_invitations i
           where i.cohort_id = c.id and i.accepted_at is null and i.revoked_at is null)
    into taken;
  if taken >= c.capacity then
    raise exception 'the % cohort is full (% of %)', c.kind, taken, c.capacity;
  end if;

  insert into public.beta_invitations (cohort_id, email, invited_by)
  values (c.id, address, (select auth.uid()))
  returning id into made;
  -- The sign-up gate. Harmless when invite-only is off; the admission when it is on.
  insert into public.invites (email, note) values (address, 'beta:' || p.id)
  on conflict (email) do nothing;
  return made;
end $$;

create or replace function public.beta_revoke_invitation(want_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  update public.beta_invitations set revoked_at = now()
   where id = want_invitation and accepted_at is null and revoked_at is null;
  if not found then raise exception 'no open invitation with that id'; end if;
end $$;

create or replace function public.beta_set_status(want_program text, want_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.beta_programs;
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  select * into p from public.beta_programs where id = want_program for update;
  if not found then raise exception 'no such program'; end if;
  if p.status = 'closed' then raise exception 'a closed program stays closed'; end if;
  if want_status = 'active' and not private.beta_writeback_stopped(p.school_id) then
    raise exception 'kill.writeback must be engaged for this program''s scope before it can be active'
      using errcode = 'check_violation';
  end if;
  update public.beta_programs set status = want_status where id = want_program;
  return want_status;
end $$;

create or replace function public.beta_declare_flag(want_program text, want_flag text, want_about text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.beta_manager() then
    raise exception 'beta:manage is required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.beta_feature_flags (program_id, flag_key, about)
  values (want_program, want_flag, coalesce(want_about, ''))
  on conflict (program_id, flag_key) do update set about = excluded.about;
end $$;

-- One function for a new issue and a change to one: a null id makes one.
create or replace function public.beta_post_issue(
  want_id uuid, want_program text, want_title text, want_detail text,
  want_workaround text, want_status text, want_published boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if not private.beta_triager() then
    raise exception 'beta:triage is required' using errcode = 'insufficient_privilege';
  end if;
  if want_id is null then
    insert into public.beta_known_issues
      (program_id, title, detail, workaround, status, published, created_by)
    values (want_program, want_title, coalesce(want_detail, ''), coalesce(want_workaround, ''),
            coalesce(want_status, 'open'), coalesce(want_published, false), (select auth.uid()))
    returning id into made;
    return made;
  end if;
  update public.beta_known_issues
     set title = want_title, detail = coalesce(want_detail, ''),
         workaround = coalesce(want_workaround, ''), status = coalesce(want_status, status),
         published = coalesce(want_published, published), updated_at = now()
   where id = want_id and program_id = want_program
  returning id into made;
  if made is null then raise exception 'no such issue in that program'; end if;
  return made;
end $$;

-- Feedback for triage. No account id, no address, no join a caller could
-- follow back to one: the sender is a cohort kind and nothing else.
create or replace function public.beta_feedback_queue(want_program text)
returns table (id uuid, cohort_kind text, kind text, body text, route text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.beta_triager() then
    raise exception 'beta:triage is required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select f.id, c.kind, f.kind, f.body, f.route, f.status, f.created_at
      from public.beta_feedback f
      join public.beta_memberships m on m.id = f.membership_id
      join public.beta_cohorts c on c.id = m.cohort_id
     where c.program_id = want_program
     order by (f.kind = 'accessibility') desc, f.created_at;
end $$;

create or replace function public.beta_triage_feedback(want_feedback uuid, want_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.beta_triager() then
    raise exception 'beta:triage is required' using errcode = 'insufficient_privilege';
  end if;
  update public.beta_feedback set status = want_status where id = want_feedback;
  if not found then raise exception 'no such feedback'; end if;
end $$;

-- ── 5. Members ────────────────────────────────────────────────────────────

-- An open invitation to the caller's confirmed address, if there is one.
create or replace function public.beta_invitation_for_me()
returns table (invitation_id uuid, program_name text, cohort_kind text, support_contact text)
language sql stable security definer set search_path = '' as $$
  select i.id, p.name, c.kind, p.support_contact
    from public.beta_invitations i
    join public.beta_cohorts c on c.id = i.cohort_id
    join public.beta_programs p on p.id = c.program_id
   where i.email = private.beta_confirmed_email()
     and i.accepted_at is null and i.revoked_at is null
     and p.status <> 'closed'
     and not exists (select 1 from public.beta_memberships m
                      where m.cohort_id = c.id and m.user_id = (select auth.uid()))
   order by i.invited_at
   limit 1;
$$;

/*
 * Joining is the member's own act. Being invited is not being enrolled: the
 * panel asks, and this runs only when they say yes. One live membership at a
 * time, and leaving a program is final for it — a person who left and is
 * invited back is asked to talk to the program rather than silently rejoined.
 */
create or replace function public.join_beta(want_invitation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  i public.beta_invitations;
  c public.beta_cohorts;
  members integer;
  made uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  -- Joins by one account run one at a time, so the second sees the first's
  -- membership and gets the sentence below instead of the unique index's error.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('beta_join:' || (select auth.uid())::text, 0));
  select * into i from public.beta_invitations where id = want_invitation for update;
  if not found or i.email is distinct from private.beta_confirmed_email() then
    raise exception 'that invitation is not to this account''s confirmed address'
      using errcode = 'insufficient_privilege';
  end if;
  if i.revoked_at is not null or i.accepted_at is not null then
    raise exception 'that invitation is no longer open';
  end if;
  select * into c from public.beta_cohorts where id = i.cohort_id for update;
  if (select status from public.beta_programs where id = c.program_id) = 'closed' then
    raise exception 'the program is closed';
  end if;
  if (private.beta_my_membership()).id is not null then
    raise exception 'this account is already in a beta';
  end if;
  if exists (select 1 from public.beta_memberships m where m.cohort_id = c.id and m.user_id = (select auth.uid())) then
    raise exception 'this account left this cohort; ask the program to talk to you';
  end if;
  -- The invitation already held a seat, so this cannot overfill the cohort;
  -- counted anyway, because a seat held by a row is a claim, not a proof.
  select count(*) into members from public.beta_memberships m where m.cohort_id = c.id and m.left_at is null;
  if members >= c.capacity then raise exception 'the cohort is full'; end if;

  update public.beta_invitations set accepted_at = now() where id = i.id;
  insert into public.beta_memberships (cohort_id, invitation_id, user_id)
  values (c.id, i.id, (select auth.uid()))
  returning id into made;
  return made;
end $$;

-- The caller's beta. `live` is false while the program is not active *or*
-- writeback has been released for its scope; the panel says "paused" then.
create or replace function public.my_beta()
returns table (program_id text, program_name text, cohort_kind text, status text, live boolean,
               support_contact text, joined_at timestamptz, flags jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, c.kind, p.status,
         p.status = 'active' and private.beta_writeback_stopped(p.school_id),
         p.support_contact, m.joined_at,
         coalesce((select jsonb_agg(jsonb_build_object('key', f.flag_key, 'about', f.about) order by f.flag_key)
                     from public.beta_feature_flags f where f.program_id = p.id), '[]'::jsonb)
    from public.beta_memberships m
    join public.beta_cohorts c on c.id = m.cohort_id
    join public.beta_programs p on p.id = c.program_id
   where m.id = (private.beta_my_membership()).id;
$$;

-- Published issues of the caller's own program. Nothing unpublished, and
-- nothing from a program they are not in.
create or replace function public.beta_known_issues_for_me()
returns table (id uuid, title text, detail text, workaround text, status text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.id, k.title, k.detail, k.workaround, k.status, k.updated_at
    from public.beta_known_issues k
    join public.beta_cohorts c on c.program_id = k.program_id
   where c.id = (private.beta_my_membership()).cohort_id
     and k.published
   order by (k.status = 'open') desc, k.updated_at desc;
$$;

create or replace function public.beta_send_feedback(want_kind text, want_body text, want_route text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  mine public.beta_memberships := private.beta_my_membership();
  made uuid;
begin
  if mine.id is null then
    raise exception 'beta feedback needs a live beta membership' using errcode = 'insufficient_privilege';
  end if;
  insert into public.beta_feedback (membership_id, kind, body, route)
  values (mine.id, want_kind, want_body, nullif(want_route, ''))
  returning id into made;
  return made;
end $$;

/*
 * Leaving is immediate. It is not a request somebody approves: the membership
 * ends in this statement, and the exit record exists so the program learns
 * why, if the member said. Whether the account is kept is the member's answer
 * to a question, recorded — deleting it is the existing account deletion, on
 * the Privacy screen, which this does not duplicate.
 */
create or replace function public.leave_beta(want_reason text, want_keeps_account boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare mine public.beta_memberships := private.beta_my_membership();
begin
  if mine.id is null then raise exception 'this account is not in a beta'; end if;
  update public.beta_memberships set left_at = now() where id = mine.id;
  insert into public.beta_exit_requests (membership_id, reason, keeps_account)
  values (mine.id, coalesce(want_reason, ''), coalesce(want_keeps_account, true));
end $$;

create or replace function public.forget_my_beta()
returns void language plpgsql security definer set search_path = '' as $$
declare address text := private.beta_confirmed_email();
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  delete from public.beta_memberships where user_id = (select auth.uid());
  if address is not null then
    delete from public.beta_invitations where email = address;
  end if;
end $$;

-- ── 6. Who may call what ──────────────────────────────────────────────────
--
-- From PUBLIC first, as `20260921002428_invites.sql` explains: a revoke from
-- the two role names alone leaves the grant they inherit.

do $$
declare f text;
begin
  foreach f in array array[
    'beta_create_program(text, text, text, text)',
    'beta_add_cohort(text, text, integer)',
    'beta_invite(uuid, text)',
    'beta_revoke_invitation(uuid)',
    'beta_set_status(text, text)',
    'beta_declare_flag(text, text, text)',
    'beta_post_issue(uuid, text, text, text, text, text, boolean)',
    'beta_feedback_queue(text)',
    'beta_triage_feedback(uuid, text)',
    'beta_invitation_for_me()',
    'join_beta(uuid)',
    'my_beta()',
    'beta_known_issues_for_me()',
    'beta_send_feedback(text, text, text)',
    'leave_beta(text, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Written out rather than looped, because account deletion depends on it:
-- `OWNED_TABLES` names this as the way these rows go, and `privacy.test.ts`
-- reads this line to prove a signed-in account can call it.
revoke all on function public.forget_my_beta() from public, anon;
grant execute on function public.forget_my_beta() to authenticated;

-- The private helpers are not granted to anybody. Each is called only from
-- inside the definer functions above, which run as their owner.
