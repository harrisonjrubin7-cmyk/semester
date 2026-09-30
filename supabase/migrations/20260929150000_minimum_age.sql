-- Semester — minimum age 13, and minors (13–17) kept out of discovery,
-- matching, messaging and employer visibility until they turn 18 (D-139).
--
-- Safe to run again.
--
-- ## The decision
--
-- The owner set the minimum age at 13 (COPPA-1). Nobody younger may hold an
-- account; a student aged 13 to 17 may use everything that is theirs — plans,
-- courses, study, their own data — but not the features where one person
-- finds, matches with, messages or is seen by another, until they turn 18.
-- Reporting and sharing with a parent or guardian stay open to them.
--
-- ## What is kept, and what is not
--
-- A birth date is read once, at sign-up or when stated, and never stored.
-- `private.account_ages` keeps only what the rules need: for a minor, the
-- day they turn 18; for an adult, nothing but the fact that they said so;
-- for someone under 13, that they are. No client may read or write it.
-- The birth date is removed from the account's metadata as soon as it is
-- read.
--
-- An account that never stated an age (created before this, or by Google,
-- Microsoft, Apple, institution SSO or LTI) is not cleared: the owner chose to
-- ask, then gate. It keeps everything that is its own and is kept out of
-- everything a minor is kept out of until it answers. The app asks it once;
-- `public.state_my_age` takes the answer and never a second.
-- `student_context.is_minor`, which the owner can set, can only make the
-- rules stricter: it is read as minor, never as adult.

create table if not exists private.account_ages (
  user_id        uuid        primary key references auth.users on delete cascade,
  -- The day a minor turns 18; null for an adult or for someone under 13.
  minor_until    date,
  under_minimum  boolean     not null default false,
  source         text        not null check (source in ('sign_up', 'statement')),
  stated_at      timestamptz not null default now(),
  constraint account_ages_one_answer check (not (under_minimum and minor_until is not null))
);
alter table private.account_ages enable row level security;
revoke all on table private.account_ages from public, anon, authenticated;

-- Is this account a minor, or under the minimum age? True until the day
-- they turn 18, with nothing to run on that day.
create or replace function private.is_minor(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null and (
    exists (
      select 1 from private.account_ages a
       where a.user_id = who
         and (a.under_minimum or (a.minor_until is not null and a.minor_until > current_date))
    )
    or exists (
      select 1 from public.student_context s where s.user_id = who and s.is_minor
    )
  );
$$;
revoke all on function private.is_minor(uuid) from public;
-- No client role calls it: every caller is a security definer function or
-- trigger running as its owner. The grants check refuses a grant nothing needs.

-- Has this account said it is 13 or over and 18 or over today? An account
-- that never said — made through Google, Microsoft or Apple, or before the age
-- was asked — is not cleared: the owner chose to ask, then gate (D-139), so
-- it is kept out of everything a minor is kept out of until it answers.
create or replace function private.age_cleared(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null
     and exists (select 1 from private.account_ages a where a.user_id = who)
     and not private.is_minor(who);
$$;
revoke all on function private.age_cleared(uuid) from public;
-- The classmate and study-match read policies at the end of this file call it
-- as whoever reads, signed in or not, so both roles may execute it — as they
-- may `private.classmate`, which the same policy calls. It answers only yes or
-- no about one account, never the date.
grant execute on function private.age_cleared(uuid) to anon, authenticated;

-- A confirmed account: what `verified_student` meant before this. Reporting
-- and sharing with a guardian use it, because a minor must be able to do both.
create or replace function private.verified_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.verified_account() from public;
grant execute on function private.verified_account() to anon, authenticated;

-- A confirmed account that has said it is 18 or over. Every policy and
-- function that lets one person be found by, matched with, message or be seen
-- by another already asks this, so the rule is one line.
create or replace function private.verified_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.verified_account() and private.age_cleared((select auth.uid()));
$$;
revoke all on function private.verified_student() from public;
grant execute on function private.verified_student() to anon, authenticated;

-- ── Open to a minor: reporting, and sharing with a guardian ──────────────

drop policy if exists "anyone verified may report" on public.reports;
create policy "anyone verified may report" on public.reports
  for insert
  with check ((select auth.uid()) = reporter and private.verified_account());

drop policy if exists "you make your own grants" on public.family_grants;
create policy "you make your own grants" on public.family_grants
  for insert
  with check (
    (select auth.uid()) = student_id
    and student_id <> recipient_id
    and accepted_at is null
    and private.verified_account()
  );

-- `make_family_invite` as 20260928306000 wrote it, gate aside.
create or replace function public.make_family_invite(
  want_categories text[],
  want_access text,
  want_resources text[] default '{}',
  want_days integer default 90
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  made text;
  home text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  -- The same gate the insert policy on `family_grants` applies, applied here
  -- because this function is what will be writing those rows later. A
  -- confirmed account, not a verified *student*: a minor may share with a
  -- parent or guardian, and that is the point of this feature for them.
  if not private.verified_account() then
    raise exception 'semester: not a confirmed account' using errcode = 'insufficient_privilege';
  end if;
  if want_categories is null or cardinality(want_categories) = 0 then
    raise exception 'semester: choose at least one thing to share'
      using errcode = 'check_violation';
  end if;
  -- D4: every share ends, at most one term out.
  if want_days is null or want_days < 1 or want_days > 200 then
    raise exception 'semester: an expiry between 1 and 200 days'
      using errcode = 'check_violation';
  end if;
  -- D5 and rule 3: named items, at the one access level offered.
  if want_access is distinct from 'selected' then
    raise exception 'semester: only selected items can be shared'
      using errcode = 'check_violation';
  end if;
  if want_resources is null or cardinality(want_resources) = 0 then
    raise exception 'semester: choose the items to share'
      using errcode = 'check_violation';
  end if;

  -- The student's own school, read here rather than taken from the caller: an
  -- institution id that arrived from a browser is a request, never an
  -- authority. Falls back to the default the profile row carries.
  select coalesce(p.school_id, 'vanderbilt') into home
    from public.profiles p where p.user_id = me;

  made := private.gen_family_code();
  insert into public.family_invites
    (code, student_id, institution_id, categories, access, resource_ids, grant_expires_at)
  values (made, me, coalesce(home, 'vanderbilt'), want_categories, want_access,
          coalesce(want_resources, '{}'), now() + make_interval(days => want_days));
  return made;
end $$;

revoke all on function public.make_family_invite(text[], text, text[], integer) from public, anon;
grant execute on function public.make_family_invite(text[], text, text[], integer) to authenticated;


-- ── At sign-up ────────────────────────────────────────────────────────────
--
-- The sign-up form sends `birth_date` in the account's metadata. Under 13 is
-- refused here, so skipping the form does not skip the rule; the message is
-- for a log, and `app/src/lib/invite.ts` gives the person the sentence.

create or replace function private.record_stated_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  given text := new.raw_user_meta_data ->> 'birth_date';
  born  date;
begin
  if given is null then
    return new;
  end if;
  begin
    born := given::date;
  exception when others then
    raise exception 'semester: a birth date that is not a date' using errcode = 'check_violation';
  end;
  if born > current_date or born < current_date - interval '120 years' then
    raise exception 'semester: a birth date that is not a date' using errcode = 'check_violation';
  end if;
  if born > current_date - interval '13 years' then
    raise exception 'semester: under the minimum age' using errcode = 'check_violation';
  end if;
  insert into private.account_ages (user_id, minor_until, source)
  values (new.id,
          case when born > current_date - interval '18 years' then (born + interval '18 years')::date end,
          'sign_up')
  on conflict (user_id) do nothing;
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' where id = new.id;
  return new;
end $$;
revoke all on function private.record_stated_age() from public;

drop trigger if exists record_stated_age on auth.users;
create trigger record_stated_age
  after insert on auth.users
  for each row execute function private.record_stated_age();

-- ── Once, for an account that never said ─────────────────────────────────

-- What an account made before the age was asked may already have out in the
-- world, taken back the moment it says it is under 18: every roster entry,
-- the employer opt-in, study matching, and every request not yet answered.
-- The classmate profile is hidden by its read policy below rather than
-- deleted, so it comes back on the eighteenth birthday.
create or replace function private.withdraw_minor(who uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.peer_mentor_offers   set active = false where user_id = who and active;
  update public.alumni_mentor_offers set active = false where user_id = who and active;
  update public.talent_profiles      set opted_in = false where user_id = who and opted_in;
  delete from public.study_match_optins where user_id = who;
  update public.mentor_requests
     set status = case when requester = who then 'withdrawn' else 'declined' end, decided_at = now()
   where status = 'pending' and (requester = who or recipient = who);
  delete from public.connections
   where state = 'pending' and (requester = who or addressee = who);
end $$;
revoke all on function private.withdraw_minor(uuid) from public, anon, authenticated;

create or replace function public.state_my_age(want_birth_date date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from private.account_ages where user_id = me) then
    return 'already_stated';
  end if;
  if want_birth_date is null or want_birth_date > current_date
     or want_birth_date < current_date - interval '120 years' then
    raise exception 'semester: a birth date that is not a date' using errcode = 'check_violation';
  end if;
  if want_birth_date > current_date - interval '13 years' then
    insert into private.account_ages (user_id, under_minimum, source) values (me, true, 'statement');
    perform private.withdraw_minor(me);
    return 'under_minimum_age';
  end if;
  insert into private.account_ages (user_id, minor_until, source)
  values (me,
          case when want_birth_date > current_date - interval '18 years'
               then (want_birth_date + interval '18 years')::date end,
          'statement');
  -- An account made before the age was asked may already be listed. A minor
  -- comes off every roster other people browse the moment they say so.
  if want_birth_date > current_date - interval '18 years' then
    perform private.withdraw_minor(me);
  end if;
  return case when want_birth_date > current_date - interval '18 years' then 'minor' else 'adult' end;
end $$;
revoke all on function public.state_my_age(date) from public, anon;
grant execute on function public.state_my_age(date) to authenticated;

-- What the app shows: never the date, only the standing.
create or replace function public.my_age_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'unknown'
    when a.user_id is null then case when private.is_minor((select auth.uid())) then 'minor' else 'unknown' end
    when a.under_minimum then 'under_minimum'
    when a.minor_until is not null and a.minor_until > current_date then 'minor'
    when private.is_minor((select auth.uid())) then 'minor'
    else 'adult'
  end
  from (select 1) one
  left join private.account_ages a on a.user_id = (select auth.uid());
$$;
revoke all on function public.my_age_status() from public, anon;
grant execute on function public.my_age_status() to authenticated;

-- ── The ways in that do not ask `verified_student` ───────────────────────
--
-- Mentor requests, connection requests, study-match opt-ins, an employer
-- opt-in and the two mentor offers are written by functions and policies of
-- their own. A trigger on each table refuses the row however it arrives: a
-- request with a minor at either end, and an active offer from a minor, which
-- is what puts a name on a roster that other people browse.

create or replace function private.refuse_for_minors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Read as JSON: each table names its people differently, and PL/pgSQL
  -- resolves every `new.<column>` against the table that fired, branch or not.
  r jsonb := to_jsonb(new);
  refuse boolean;
begin
  refuse := case tg_table_name
    -- A request is refused when it is made and again when it is accepted, so
    -- one sent before anybody said their age cannot become a relationship.
    when 'mentor_requests'    then (tg_op = 'INSERT' or r ->> 'status' = 'accepted')
                                   and not (private.age_cleared((r ->> 'requester')::uuid) and private.age_cleared((r ->> 'recipient')::uuid))
    when 'connections'        then (tg_op = 'INSERT' or r ->> 'state' = 'accepted')
                                   and not (private.age_cleared((r ->> 'requester')::uuid) and private.age_cleared((r ->> 'addressee')::uuid))
    when 'study_match_optins' then not private.age_cleared((r ->> 'user_id')::uuid)
    when 'talent_profiles'    then coalesce((r ->> 'opted_in')::boolean, false) and not private.age_cleared((r ->> 'user_id')::uuid)
    when 'peer_mentor_offers'   then coalesce((r ->> 'active')::boolean, true) and not private.age_cleared((r ->> 'user_id')::uuid)
    when 'alumni_mentor_offers' then coalesce((r ->> 'active')::boolean, true) and not private.age_cleared((r ->> 'user_id')::uuid)
    else false
  end;
  if refuse then
    raise exception 'semester: not available under 18, or before an age is stated' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.refuse_for_minors() from public;

drop trigger if exists refuse_for_minors on public.mentor_requests;
create trigger refuse_for_minors before insert or update of status on public.mentor_requests
  for each row execute function private.refuse_for_minors();
drop trigger if exists refuse_for_minors on public.connections;
create trigger refuse_for_minors before insert or update of state on public.connections
  for each row execute function private.refuse_for_minors();
drop trigger if exists refuse_for_minors on public.study_match_optins;
create trigger refuse_for_minors before insert on public.study_match_optins
  for each row execute function private.refuse_for_minors();
drop trigger if exists refuse_for_minors on public.talent_profiles;
create trigger refuse_for_minors before insert or update of opted_in on public.talent_profiles
  for each row execute function private.refuse_for_minors();
drop trigger if exists refuse_for_minors on public.peer_mentor_offers;
create trigger refuse_for_minors before insert or update of active on public.peer_mentor_offers
  for each row execute function private.refuse_for_minors();
drop trigger if exists refuse_for_minors on public.alumni_mentor_offers;
create trigger refuse_for_minors before insert or update of active on public.alumni_mentor_offers
  for each row execute function private.refuse_for_minors();

-- ── What others can already see ───────────────────────────────────────────
--
-- The classmate profile and study-match opt-in of a minor, or of an account
-- that has not said its age, are hidden from everyone but its owner. The two policies are
-- `20260901000200_classmates.sql`'s and `20260926150000`'s, with that one
-- clause added.

drop policy if exists "profiles are visible to classmates" on public.profiles;
create policy "profiles are visible to classmates" on public.profiles
  for select
  using ((select auth.uid()) = user_id or (private.classmate(user_id) and private.age_cleared(user_id)));

drop policy if exists "opted-in classmates see each other" on public.study_match_optins;
create policy "opted-in classmates see each other" on public.study_match_optins
  for select using (
    user_id = (select auth.uid())
    or (expires_at > now() and private.opted_into_match(tenant_id, course_code, section) and private.age_cleared(user_id))
  );
