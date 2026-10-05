-- Advisor Meeting Mode: authorized, expiring shares to a signed-in advisor.
--
-- Phase G of the feature expansion (DECISION-LOG D-016, owner-approved
-- 27 Sep 2026; SECURITY-GAP S-8). A student shares one meeting — an agenda,
-- questions, and only the scenario, courses and actions they ticked — with an
-- advisor at their own school. Modelled on accommodation_shares
-- (20260926150000_expansion_roles_and_features.sql):
--
--   * the advisor must hold a live `academic_advisor` grant scoped to the
--     student's school, and is found by address only inside that set;
--   * every share has a required expiry, at most 120 days out;
--   * the student can revoke (never un-revoke) and delete;
--   * the advisor never reads the table: contents come through
--     read_advisor_share(), which checks the share is live and records the
--     read in advisor_share_events, which the student sees;
--   * the payload is a snapshot the student previewed, capped at 32 KB.
--
-- No anonymous or link-based access exists (D-016).
--
-- Additive: two new tables, three functions, and lti_account_untouched
-- redefined with the new table (app/src/lib/ltiaccount.test.ts reads this
-- file). NOT APPLIED to production; merging to main applies it through
-- Supabase Branching and needs owner approval.
--
-- To remove:
--   drop function if exists public.share_with_advisor(text, text, jsonb, timestamptz);
--   drop function if exists public.list_advisor_shares();
--   drop function if exists public.read_advisor_share(uuid);
--   drop table if exists public.advisor_share_events, public.advisor_shares;
--   -- then re-run 20260928300000_untouched_graduation_drafts.sql.

create table if not exists public.advisor_shares (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references auth.users on delete cascade,
  advisor_id  uuid        not null references auth.users on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  title       text        not null check (length(trim(title)) between 1 and 120),
  payload     jsonb       not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 32768),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  constraint advisor_share_two_people check (student_id <> advisor_id),
  constraint advisor_share_expiry check (expires_at > created_at and expires_at <= created_at + interval '120 days')
);
create index if not exists advisor_shares_by_student on public.advisor_shares (student_id);
create index if not exists advisor_shares_by_advisor on public.advisor_shares (advisor_id);
create index if not exists advisor_shares_by_tenant on public.advisor_shares (tenant_id);
alter table public.advisor_shares enable row level security;
revoke all on table public.advisor_shares from anon, authenticated;
grant select, delete on table public.advisor_shares to authenticated;
grant update (revoked_at) on table public.advisor_shares to authenticated;

drop policy if exists "a student sees their shares" on public.advisor_shares;
create policy "a student sees their shares" on public.advisor_shares
  for select using (student_id = (select auth.uid()));
drop policy if exists "a student revokes a share" on public.advisor_shares;
create policy "a student revokes a share" on public.advisor_shares
  for update using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and revoked_at is not null);
drop policy if exists "a student deletes a share" on public.advisor_shares;
create policy "a student deletes a share" on public.advisor_shares
  for delete using (student_id = (select auth.uid()));

create table if not exists public.advisor_share_events (
  id        uuid        primary key default gen_random_uuid(),
  share_id  uuid        not null references public.advisor_shares(id) on delete cascade,
  reader_id uuid        references auth.users on delete set null,
  read_at   timestamptz not null default now()
);
create index if not exists advisor_share_events_by_share on public.advisor_share_events (share_id);
create index if not exists advisor_share_events_by_reader on public.advisor_share_events (reader_id);
alter table public.advisor_share_events enable row level security;
revoke all on table public.advisor_share_events from anon, authenticated;
grant select on table public.advisor_share_events to authenticated;
drop policy if exists "a student sees who opened their shares" on public.advisor_share_events;
create policy "a student sees who opened their shares" on public.advisor_share_events
  for select using (exists (select 1 from public.advisor_shares s
                             where s.id = share_id and s.student_id = (select auth.uid())));

-- Share one meeting with an advisor at the caller's own school. The address
-- is matched only against people holding a live academic_advisor grant for
-- that school, and every miss reads the same, so it cannot be used to find
-- out whether an address has an account.
create or replace function public.share_with_advisor(
  advisor_email text, share_title text, share_payload jsonb, share_expires timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  school text;
  advisor uuid;
  made uuid;
begin
  if me is null then
    raise exception 'sign in to share' using errcode = '42501';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null then
    raise exception 'set your school on your profile to share with an advisor' using errcode = '42501';
  end if;
  select u.id into advisor
    from auth.users u
    join public.role_grants g on g.subject = u.id
   where lower(u.email) = lower(trim(advisor_email))
     and u.id <> me
     and g.role = 'academic_advisor'
     and g.scope_kind = 'school'
     and g.scope_id = school
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   limit 1;
  if advisor is null then
    raise exception 'no advisor at your school uses that address in Semester' using errcode = 'P0002';
  end if;
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
  values (me, advisor, school, share_title, share_payload, share_expires)
  returning id into made;
  return made;
end $$;
revoke all on function public.share_with_advisor(text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.share_with_advisor(text, text, jsonb, timestamptz) to authenticated;

-- What an advisor has been shared: titles and dates only, live shares only.
-- Reading a share's contents goes through read_advisor_share, which logs it.
create or replace function public.list_advisor_shares()
returns table (id uuid, title text, shared_as text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, coalesce(s.payload->>'sharedAs', ''), s.created_at, s.expires_at
    from public.advisor_shares s
   where s.advisor_id = (select auth.uid())
     and s.revoked_at is null
     and s.expires_at > now()
     -- The advisor's role, checked at every read and not only when the share
     -- was made: a grant the school revoked or let expire ends access now.
     and exists (select 1 from public.role_grants g
                  where g.subject = s.advisor_id
                    and g.role = 'academic_advisor'
                    and g.scope_kind = 'school'
                    and g.scope_id = s.tenant_id
                    and g.revoked_at is null
                    and (g.expires_at is null or g.expires_at > now()))
   order by s.created_at desc;
$$;
revoke all on function public.list_advisor_shares() from public, anon, authenticated;
grant execute on function public.list_advisor_shares() to authenticated;

create or replace function public.read_advisor_share(want_share uuid)
returns table (title text, payload jsonb, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.advisor_shares%rowtype;
begin
  select * into s from public.advisor_shares x
   where x.id = want_share
     and x.advisor_id = (select auth.uid())
     and x.revoked_at is null
     and x.expires_at > now()
     -- The advisor's role, checked at every read and not only when the share
     -- was made: a grant the school revoked or let expire ends access now.
     and exists (select 1 from public.role_grants g
                  where g.subject = x.advisor_id
                    and g.role = 'academic_advisor'
                    and g.scope_kind = 'school'
                    and g.scope_id = x.tenant_id
                    and g.revoked_at is null
                    and (g.expires_at is null or g.expires_at > now()));
  if not found then
    raise exception 'not shared with you' using errcode = '42501';
  end if;
  insert into public.advisor_share_events (share_id, reader_id)
  values (s.id, (select auth.uid()));
  return query select s.title, s.payload, s.created_at, s.expires_at;
end $$;
revoke all on function public.read_advisor_share(uuid) from public, anon, authenticated;
grant execute on function public.read_advisor_share(uuid) to authenticated;

-- An account holding advisor shares, at either end, is not empty: account
-- linking must not retire it. The complete latest definition, not a delta —
-- 20260928300000_untouched_graduation_drafts.sql with two rows added.
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
      ('public.graduation_scenarios', 'user_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id')
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
