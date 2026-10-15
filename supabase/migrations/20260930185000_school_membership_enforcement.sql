-- Course rooms limited to one university, one school at a time (full-beta G-03).
--
-- ── The problem ────────────────────────────────────────────────────────────
--
-- A room key is "<school>/<COURSE>" (`roomKey()` in lib/classmates.ts). Any
-- confirmed, age-cleared account can enrol in any room, because the Vanderbilt
-- domain test was taken out of `verified_student()` on purpose
-- (`20260901000300_classmates_schools.sql`) and nothing has read
-- `profiles.school_id` since. So a student at one university can sit in
-- another's course room. With one campus that was a choice; with several it is
-- a privacy failure.
--
-- ── Why this is staged, and not a global flip ─────────────────────────────
--
-- Most accounts have claimed nothing, so a policy requiring a claim would empty
-- every room the moment it landed. This migration therefore adds the machinery
-- and changes NO behaviour anywhere:
--
--   * `schools.enforce_membership`, default **false** for every school that
--     exists. While it is false, rooms of that school behave exactly as before.
--   * membership can be *proved* two ways: the address the server confirmed is
--     one the school publishes (`claim_school`, unchanged in effect), or a
--     person at that school approves a request (`school_membership_requests`).
--   * `school_enforcement_readiness()` says how many people a switch-on would
--     lock out; `set_school_enforcement()` refuses to switch on until that
--     number has been acknowledged, and only the platform operator can call it.
--
-- Once a school is enforced, a room whose key names it is open only to accounts
-- whose `profiles.school_id` is that school — to read, to post, to join, to be
-- seen as a classmate, and in the live channel. Nobody is deleted: a person who
-- was locked out gets back in by claiming or being approved, and a school that
-- was switched on too early is switched off again.
--
-- Additive except three helpers (`in_class`, `classmate`, the enrolment insert
-- and update policies), each of which gains one clause that is true for every
-- school that is not enforced.

-- ── 1. The switch ──────────────────────────────────────────────────────────

alter table public.schools
  add column if not exists enforce_membership boolean not null default false;
alter table public.schools
  add column if not exists enforcement_changed_at timestamptz;

-- The only writer is `set_school_enforcement`. A school administrator with
-- direct write access to `schools` (the `schools_write` policy is app-admin
-- only, but that list is broader than this switch) must not flip it silently.
revoke update (enforce_membership, enforcement_changed_at) on public.schools from anon, authenticated;

-- A column privilege is not enough: it does not undo a table-level grant, and a
-- platform administrator can write `schools` under the policy. So the change
-- itself is refused unless it comes through `set_school_enforcement`, which is
-- the one place that checks the readiness count.
create or replace function private.refuse_direct_enforcement_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.enforce_membership is distinct from old.enforce_membership
     and coalesce(current_setting('semester.school_enforcement', true), '') <> 'via-function' then
    raise exception 'school enforcement is switched with set_school_enforcement, which checks who would be locked out'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

revoke all on function private.refuse_direct_enforcement_change() from public, anon, authenticated;

drop trigger if exists refuse_direct_enforcement_change on public.schools;
create trigger refuse_direct_enforcement_change
  before update on public.schools
  for each row execute function private.refuse_direct_enforcement_change();

-- ── 2. What a room key names ──────────────────────────────────────────────

-- Whether `who` may be in the room with this key. True for a key that names no
-- known school, and for a school that is not enforced — which is every school
-- until somebody switches one on.
create or replace function private.room_open_for(who uuid, want_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
        from public.schools s
       where position('/' in want_code) > 0
         and s.id = split_part(want_code, '/', 1)
         and s.enforce_membership
    )
    or exists (
      select 1
        from public.profiles p
       where p.user_id = who
         and p.school_id is not null
         and p.school_id = split_part(want_code, '/', 1)
    );
$$;

revoke all on function private.room_open_for(uuid, text) from public;
grant execute on function private.room_open_for(uuid, text) to anon, authenticated;

create or replace function private.room_open(want_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.room_open_for((select auth.uid()), want_code);
$$;

revoke all on function private.room_open(text) from public;
grant execute on function private.room_open(text) to anon, authenticated;

-- ── 3. The three helpers every room policy already asks ───────────────────

create or replace function private.in_class(want_term text, want_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = (select auth.uid()) and e.term = want_term and e.code = want_code
  ) and private.room_open(want_code);
$$;

create or replace function private.classmate(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments mine
    join public.enrollments theirs
      on theirs.term = mine.term and theirs.code = mine.code
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
      and private.room_open_for((select auth.uid()), mine.code)
      and private.room_open_for(other, mine.code)
  );
$$;

-- Joining or moving to a room of an enforced school needs membership of it.
drop policy if exists "join your own classes" on public.enrollments;
create policy "join your own classes" on public.enrollments
  for insert
  with check ((select auth.uid()) = user_id and private.verified_student() and private.room_open(code));

drop policy if exists "change your own enrollment" on public.enrollments;
create policy "change your own enrollment" on public.enrollments
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.verified_student() and private.room_open(code));

-- Words from somebody who is not a member of an enforced school stay out of its
-- room for the people who are. Restrictive, so it narrows every permissive
-- policy already on these tables and cannot widen any of them.
drop policy if exists "enforced rooms show members only" on public.messages;
create policy "enforced rooms show members only" on public.messages
  as restrictive
  for select
  using (private.room_open_for(user_id, code));

drop policy if exists "enforced rooms show members only" on public.message_reactions;
create policy "enforced rooms show members only" on public.message_reactions
  as restrictive
  for select
  using (private.room_open_for(user_id, code));

-- ── 4. Requests, for an address the school does not publish ───────────────

create table if not exists public.school_membership_requests (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  school_id  text        not null references public.schools on delete cascade,
  status     text        not null default 'pending'
             check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  note       text        not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid        references auth.users on delete set null,
  check ((status = 'pending') = (decided_at is null))
);

create unique index if not exists school_membership_one_pending
  on public.school_membership_requests (user_id, school_id) where status = 'pending';
create index if not exists school_membership_by_user on public.school_membership_requests (user_id);
create index if not exists school_membership_by_school on public.school_membership_requests (school_id, status);
create index if not exists school_membership_by_decider on public.school_membership_requests (decided_by);

alter table public.school_membership_requests enable row level security;
revoke all on table public.school_membership_requests from anon, authenticated;
grant select on table public.school_membership_requests to authenticated;

drop policy if exists "read your own membership requests" on public.school_membership_requests;
create policy "read your own membership requests" on public.school_membership_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "school administrators read their requests" on public.school_membership_requests;
create policy "school administrators read their requests" on public.school_membership_requests
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', school_id));

-- ── 5. Claiming, unchanged in effect, now on the record ───────────────────

create or replace function public.claim_school(want text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  addr   text;
  domain text;
begin
  select u.email into addr
    from auth.users u
   where u.id = (select auth.uid())
     and u.email_confirmed_at is not null;

  if addr is null then
    raise exception 'confirm your address before claiming a school'
      using errcode = 'insufficient_privilege';
  end if;

  domain := lower(substring(addr from '[^@]+$'));

  if not exists (
    select 1
      from public.schools s
     where s.id = want
       and exists (
         select 1 from unnest(s.email_domains) d where lower(d) = domain
       )
  ) then
    raise exception 'that address is not one % publishes', want
      using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
     set school_id = want, updated_at = now()
   where user_id = (select auth.uid());

  perform private.record_audit(want, 'school.membership_claimed', 'school', want, 'allowed', null,
                               jsonb_build_object('method', 'domain'));

  return want;
end;
$$;

revoke all on function public.claim_school(text) from public, anon;
grant execute on function public.claim_school(text) to authenticated;

-- ── 6. The one-tap request ────────────────────────────────────────────────

create or replace function public.request_school_membership(want text, why text default '')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  addr    text;
  current text;
  made    uuid;
begin
  if me is null or not private.verified_account() then
    raise exception 'confirm your address first' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.schools s where s.id = want) then
    raise exception 'no such university' using errcode = 'no_data_found';
  end if;

  select p.school_id into current from public.profiles p where p.user_id = me;
  if current = want then
    raise exception 'you are already at this university';
  elsif current is not null then
    raise exception 'leave your current university first';
  end if;

  select u.email into addr from auth.users u where u.id = me;
  if exists (
    select 1 from public.schools s
     where s.id = want
       and exists (select 1 from unnest(s.email_domains) d where lower(d) = lower(substring(addr from '[^@]+$')))
  ) then
    raise exception 'your address is one this university publishes: claim it directly';
  end if;

  if (select count(*) from public.school_membership_requests r
       where r.user_id = me and r.status = 'pending') >= 3 then
    raise exception 'you already have three requests waiting';
  end if;

  insert into public.school_membership_requests (user_id, school_id, note)
  values (me, want, left(coalesce(why, ''), 300))
  returning id into made;

  perform private.record_audit(want, 'school.membership_requested', 'school_membership_request', made::text, 'allowed');
  return made;
end;
$$;

revoke all on function public.request_school_membership(text, text) from public, anon;
grant execute on function public.request_school_membership(text, text) to authenticated;

create or replace function public.withdraw_school_request(req uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hit public.school_membership_requests;
begin
  update public.school_membership_requests
     set status = 'withdrawn', decided_at = now()
   where id = req and user_id = (select auth.uid()) and status = 'pending'
  returning * into hit;
  if hit.id is null then
    raise exception 'no such waiting request' using errcode = 'no_data_found';
  end if;
  perform private.record_audit(hit.school_id, 'school.membership_withdrawn', 'school_membership_request', req::text, 'allowed');
end;
$$;

revoke all on function public.withdraw_school_request(uuid) from public, anon;
grant execute on function public.withdraw_school_request(uuid) to authenticated;

-- ── 7. A person at the school decides ─────────────────────────────────────

create or replace function public.decide_school_request(req uuid, approve boolean, why text default '')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hit  public.school_membership_requests;
  have text;
begin
  select * into hit from public.school_membership_requests r where r.id = req for update;
  -- The same words for "no such request" and "not yours to decide", so this
  -- cannot be used to learn which ids exist at another school.
  if hit.id is null
     or not private.has_capability('tenant:configure', 'school', hit.school_id)
     or hit.user_id = (select auth.uid())
     or hit.status <> 'pending' then
    raise exception 'no such request you may decide' using errcode = 'insufficient_privilege';
  end if;

  if approve then
    select p.school_id into have from public.profiles p where p.user_id = hit.user_id;
    if have is not null then
      raise exception 'this person is already at a university' using errcode = 'check_violation';
    end if;
    update public.profiles set school_id = hit.school_id, updated_at = now() where user_id = hit.user_id;
    if not found then
      raise exception 'this person has no profile yet' using errcode = 'check_violation';
    end if;
  end if;

  update public.school_membership_requests
     set status = case when approve then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = (select auth.uid()),
         note = left(coalesce(nullif(why, ''), note), 300)
   where id = req;

  perform private.record_audit(hit.school_id,
    case when approve then 'school.membership_approved' else 'school.membership_rejected' end,
    'school_membership_request', req::text, 'allowed');
end;
$$;

revoke all on function public.decide_school_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_school_request(uuid, boolean, text) to authenticated;

-- What an administrator needs to decide, and no more: the display handle the
-- person chose, the sentence they wrote, and when. Not the address, not the
-- account id. Administrators cannot read the profile of somebody who shares no
-- class with them, so the table's own policy would show them an anonymous row.
create or replace function public.school_requests_for_admin(want text)
returns table (id uuid, handle text, note text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability('tenant:configure', 'school', want) then
    raise exception 'not yours to see' using errcode = 'insufficient_privilege';
  end if;
  return query
    select r.id, p.handle, r.note, r.created_at
      from public.school_membership_requests r
      join public.profiles p on p.user_id = r.user_id
     where r.school_id = want and r.status = 'pending'
     order by r.created_at;
end;
$$;

revoke all on function public.school_requests_for_admin(text) from public, anon;
grant execute on function public.school_requests_for_admin(text) to authenticated;

-- ── 8. Recovery: leaving, and being removed ───────────────────────────────

create or replace function public.leave_school()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  was text;
begin
  select p.school_id into was from public.profiles p where p.user_id = (select auth.uid());
  if was is null then
    raise exception 'you are not at a university' using errcode = 'no_data_found';
  end if;
  update public.profiles set school_id = null, updated_at = now() where user_id = (select auth.uid());
  perform private.record_audit(was, 'school.membership_left', 'school', was, 'allowed');
end;
$$;

revoke all on function public.leave_school() from public, anon;
grant execute on function public.leave_school() to authenticated;

-- A misclaim the person did not fix themselves — a shared address, a wrong
-- campus. A holder of `tenant:configure` at the school the person is *in*.
create or replace function public.revoke_school_membership(target uuid, why text default '')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  was text;
begin
  select p.school_id into was from public.profiles p where p.user_id = target;
  if was is null or not private.has_capability('tenant:configure', 'school', was) then
    raise exception 'no such member you may remove' using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set school_id = null, updated_at = now() where user_id = target;
  perform private.record_audit(was, 'school.membership_revoked', 'school', was, 'allowed', null,
                               jsonb_build_object('reason_given', length(coalesce(why, '')) > 0));
end;
$$;

revoke all on function public.revoke_school_membership(uuid, text) from public, anon;
grant execute on function public.revoke_school_membership(uuid, text) to authenticated;

-- ── 9. Readiness, and the switch ──────────────────────────────────────────

-- Counts only, never who. `locked_out` is the number of accounts enrolled in a
-- room of this school who are not members of it: exactly who a switch-on
-- would lock out.
create or replace function public.school_enforcement_readiness(want text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_app_admin() or private.has_capability('tenant:configure', 'school', want)) then
    raise exception 'not yours to see' using errcode = 'insufficient_privilege';
  end if;
  return (
    select jsonb_build_object(
      'school', s.id,
      'enforced', s.enforce_membership,
      'domains', coalesce(array_length(s.email_domains, 1), 0),
      'members', (select count(*) from public.profiles p where p.school_id = s.id),
      'enrolled', (select count(distinct e.user_id) from public.enrollments e
                    where split_part(e.code, '/', 1) = s.id and position('/' in e.code) > 0),
      'locked_out', (select count(distinct e.user_id) from public.enrollments e
                      where split_part(e.code, '/', 1) = s.id and position('/' in e.code) > 0
                        and not exists (select 1 from public.profiles p
                                         where p.user_id = e.user_id and p.school_id = s.id)),
      'pending_requests', (select count(*) from public.school_membership_requests r
                            where r.school_id = s.id and r.status = 'pending')
    )
    from public.schools s where s.id = want
  );
end;
$$;

revoke all on function public.school_enforcement_readiness(text) from public, anon;
grant execute on function public.school_enforcement_readiness(text) to authenticated;

-- The platform operator only. Switching ON refuses while anyone would be locked
-- out unless the caller states that exact number, so the decision is made with
-- the count in front of it; and refuses for a school that publishes no address,
-- where nobody could claim their way back in.
create or replace function public.set_school_enforcement(want text, on_ boolean, acknowledge_locked_out integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ready jsonb;
begin
  if not private.is_app_admin() then
    raise exception 'only the platform operator switches this' using errcode = 'insufficient_privilege';
  end if;
  ready := public.school_enforcement_readiness(want);
  if ready is null then
    raise exception 'no such university' using errcode = 'no_data_found';
  end if;
  if on_ then
    if (ready->>'domains')::int = 0 then
      raise exception 'this university publishes no address, so nobody could claim their way in';
    end if;
    if (ready->>'locked_out')::int > 0
       and acknowledge_locked_out is distinct from (ready->>'locked_out')::int then
      raise exception '% people in this university''s rooms have not proved membership; pass that number to switch on',
        ready->>'locked_out';
    end if;
  end if;
  perform set_config('semester.school_enforcement', 'via-function', true);
  update public.schools
     set enforce_membership = on_, enforcement_changed_at = now()
   where id = want;
  perform set_config('semester.school_enforcement', '', true);
  perform private.record_audit(want, case when on_ then 'school.enforcement_on' else 'school.enforcement_off' end,
                               'school', want, 'allowed', null,
                               jsonb_build_object('locked_out', (ready->>'locked_out')::int));
  return public.school_enforcement_readiness(want);
end;
$$;

revoke all on function public.set_school_enforcement(text, boolean, integer) from public, anon;
grant execute on function public.set_school_enforcement(text, boolean, integer) to authenticated;

comment on column public.schools.enforce_membership is
  'When true, rooms whose key names this school are open only to accounts whose profile school_id is this school. Default false; changed only by set_school_enforcement.';
