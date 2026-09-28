-- Semester — an athlete's share with athletic academic support.
--
-- Slice 4 of the owner-approved consent design, docs/CONSENT-SHARING-DESIGN.md
-- (D-037, §4 and §8). Decisions it carries:
--
--   * D1: the recipient holds `athletic_academic_support`, a role added here.
--     Not `learning_center_staff`: at most schools athletic academic support is
--     a separate office, and a share should name the one the student meant.
--   * D2: `athletics_compliance_officer` is never a recipient, even if the same
--     person also holds the support role. Compliance decides eligibility; a
--     support tool it could read would become an evidence file.
--   * D3: an ended share reads the same whether it was revoked, ran out, or the
--     recipient lost the role — "not shared with you", nothing more.
--   * D4: every share ends, at most 200 days out, as `accommodation_shares`.
--
-- Modelled on `advisor_shares` (feature/advisor-meeting-mode, D-016, not yet
-- merged) so the two do not diverge: the same columns, the same
-- found-by-address-only-among-role-holders lookup, the same snapshot payload,
-- the same logged reader. Three differences, each required by the design:
--
--   1. **The role is re-checked at every read and every listing**, not only
--      when the share is made (§4: "if they lose the role, the share stops
--      working without anybody revoking it"). `advisor_shares` checks once.
--   2. **Compliance is excluded** at share time and at read time (D2).
--   3. **The payload can carry only the six athlete items** the design offers
--      (§4), enforced by a column check, so grades, NIL, the hours log and
--      health never fit in the shape whatever a client sends.
--
-- Numbered 20260928308000 (first 20260928001500) so it runs after the two
-- renumbered family migrations it follows, and after every migration on main
-- and the open branches when it was written.
--
-- The UI is slice 5. NOT APPLIED to production; applying it needs owner
-- approval, and it goes after 20260928307000_family_shared_items.sql.

-- ── The role ──────────────────────────────────────────────────────────────
--
-- No capabilities. The role's only effect is that this migration's functions
-- will find a person who holds it, for a share a student made to them.

insert into public.app_roles (role, global) values
  ('athletic_academic_support', false)
on conflict (role) do nothing;

-- ── Who holds what, now ───────────────────────────────────────────────────
--
-- One predicate, used at share, list and read, so the three cannot disagree
-- about who counts. A grant is live when not revoked and not expired; it
-- counts for a school when scoped to the school itself or to anything inside
-- it (`<school>/…`, the convention the expansion migration set).

create or replace function private.holds_role_at(who uuid, want_role text, school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_grants g
     where g.subject = who
       and g.role = want_role
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (g.scope_id = school or g.scope_id like school || '/%')
  );
$$;

revoke all on function private.holds_role_at(uuid, text, text) from public, anon, authenticated;

-- D1 and D2 together: may this person receive, or keep reading, a share at
-- this school?
create or replace function private.may_receive_support_share(who uuid, school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.holds_role_at(who, 'athletic_academic_support', school)
     and not private.holds_role_at(who, 'athletics_compliance_officer', school);
$$;

revoke all on function private.may_receive_support_share(uuid, text) from public, anon, authenticated;

-- ── The shares ────────────────────────────────────────────────────────────

create table if not exists public.support_shares (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references auth.users on delete cascade,
  staff_id    uuid        not null references auth.users on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  -- The snapshot the student previewed. Keys are the six items of design §4
  -- and `sharedAs` (how the student is named to the recipient); nothing else
  -- fits. `lib/sharing.ts` ATHLETE_SHAREABLE is the same list.
  payload     jsonb       not null check (
                            jsonb_typeof(payload) = 'object'
                            and octet_length(payload::text) <= 32768
                            -- Removing the allowed keys leaves nothing. No
                            -- function and no subquery: a check that called one
                            -- would run it as whoever updates the row, and a
                            -- student revoking holds no grant on `private`.
                            and (payload - array['travel', 'missed', 'absence', 'pack', 'courses',
                                                 'deadlines', 'sharedAs']::text[]) = '{}'::jsonb),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  constraint support_share_two_people check (student_id <> staff_id),
  constraint support_share_expiry check (expires_at > created_at and expires_at <= created_at + interval '200 days')
);
create index if not exists support_shares_by_student on public.support_shares (student_id);
create index if not exists support_shares_by_staff on public.support_shares (staff_id);
create index if not exists support_shares_by_tenant on public.support_shares (tenant_id);
alter table public.support_shares enable row level security;
revoke all on table public.support_shares from anon, authenticated;
grant select, delete on table public.support_shares to authenticated;
grant update (revoked_at) on table public.support_shares to authenticated;

comment on table public.support_shares is
  'What an athlete shared with one named athletic academic support staff member. Read by staff only through read_support_share().';

-- The student's side. The staff member has no policy on this table: they
-- list and read through the functions below, which re-check the role.
drop policy if exists "a student sees their support shares" on public.support_shares;
create policy "a student sees their support shares" on public.support_shares
  for select using (student_id = (select auth.uid()));
-- Revoke, and only revoke: the column grant stops anything else changing,
-- and `revoked_at is not null` stops a revoked share being re-opened.
drop policy if exists "a student revokes a support share" on public.support_shares;
create policy "a student revokes a support share" on public.support_shares
  for update using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and revoked_at is not null);
drop policy if exists "a student deletes a support share" on public.support_shares;
create policy "a student deletes a support share" on public.support_shares
  for delete using (student_id = (select auth.uid()));

-- ── The read log ──────────────────────────────────────────────────────────

create table if not exists public.support_share_events (
  id        uuid        primary key default gen_random_uuid(),
  share_id  uuid        not null references public.support_shares on delete cascade,
  reader_id uuid        references auth.users on delete set null,
  read_at   timestamptz not null default now()
);
create index if not exists support_share_events_by_share on public.support_share_events (share_id);
create index if not exists support_share_events_by_reader on public.support_share_events (reader_id);
alter table public.support_share_events enable row level security;
revoke all on table public.support_share_events from anon, authenticated;
grant select on table public.support_share_events to authenticated;
drop policy if exists "a student sees who opened their support shares" on public.support_share_events;
create policy "a student sees who opened their support shares" on public.support_share_events
  for select using (exists (select 1 from public.support_shares s
                             where s.id = share_id and s.student_id = (select auth.uid())));

-- ── Sharing ───────────────────────────────────────────────────────────────
--
-- With one staff member at the caller's own school, found by address only
-- among the people who may receive (D1, D2). Every miss reads the same — no
-- account, no role, the compliance office — so this cannot be used to learn
-- whether an address has an account or which office somebody works in.

create or replace function public.share_with_support(
  staff_email text, share_payload jsonb, share_expires timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
  staff  uuid;
  made   uuid;
begin
  if me is null then
    raise exception 'sign in to share' using errcode = '42501';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null then
    raise exception 'set your school on your profile to share with academic support' using errcode = '42501';
  end if;
  select u.id into staff
    from auth.users u
   where lower(u.email) = lower(btrim(staff_email))
     and u.id <> me
     and private.may_receive_support_share(u.id, school)
   limit 1;
  if staff is null then
    raise exception 'no athletic academic support staff at your school uses that address in Semester'
      using errcode = 'P0002';
  end if;
  insert into public.support_shares (student_id, staff_id, tenant_id, payload, expires_at)
  values (me, staff, school, share_payload, share_expires)
  returning id into made;
  return made;
end $$;

revoke all on function public.share_with_support(text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.share_with_support(text, jsonb, timestamptz) to authenticated;

-- ── The staff side ────────────────────────────────────────────────────────
--
-- Listing is names and dates only, and is not logged: it is the list of what
-- could be opened, not an opening. Both functions re-check the role now.

create or replace function public.list_support_shares()
returns table (id uuid, shared_as text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, coalesce(s.payload->>'sharedAs', ''), s.created_at, s.expires_at
    from public.support_shares s
   where s.staff_id = (select auth.uid())
     and s.revoked_at is null
     and s.expires_at > now()
     and private.may_receive_support_share(s.staff_id, s.tenant_id)
   order by s.created_at desc;
$$;

revoke all on function public.list_support_shares() from public, anon, authenticated;
grant execute on function public.list_support_shares() to authenticated;

create or replace function public.read_support_share(want_share uuid)
returns table (payload jsonb, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.support_shares%rowtype;
begin
  select * into s from public.support_shares x
   where x.id = want_share
     and x.staff_id = (select auth.uid())
     and x.revoked_at is null
     and x.expires_at > now();
  -- D3: revoked, expired, lost the role, never yours — one answer.
  if not found or not private.may_receive_support_share(s.staff_id, s.tenant_id) then
    raise exception 'not shared with you' using errcode = '42501';
  end if;
  insert into public.support_share_events (share_id, reader_id)
  values (s.id, (select auth.uid()));
  return query select s.payload, s.created_at, s.expires_at;
end $$;

revoke all on function public.read_support_share(uuid) from public, anon, authenticated;
grant execute on function public.read_support_share(uuid) to authenticated;

-- ── A share, at either end, is a used account ────────────────────────────
--
-- The complete latest definition: 20260928307000's rows plus both ends of
-- `support_shares`. `graduation_scenarios` (#780) and `advisor_shares`
-- (#802) are not on this branch's base; whichever lands second carries every

-- ── Forgetting support shares at either end ─────────────────────────────
-- "Delete my account" signs out; it does not delete the auth user, so no
-- cascade runs. A student's own shares go by the table's delete policy, but a
-- staff member has no delete policy on shares addressed to them, and those
-- would survive to be read again after signing back in. This removes every
-- share naming the caller at either end, as forget_my_advisor_shares does.
create or replace function public.forget_my_support_shares()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := (select auth.uid());
  removed bigint;
begin
  if who is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  delete from public.support_shares where student_id = who or staff_id = who;
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.forget_my_support_shares() from public, anon, authenticated;
grant execute on function public.forget_my_support_shares() to authenticated;

-- row, as the notes in 20260928306000 and 20260928307000 say.

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
      ('public.alumni_mentor_offers', 'user_id'),
      ('public.community_posts',      'author_id'),
      ('public.community_sessions',   'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',      'user_id'),
      ('public.community_members',    'user_id'),
      ('public.community_aliases',    'user_id'),
      ('public.community_volunteers', 'user_id'),
      ('public.community_media',      'uploader_id'),
      ('public.graduation_scenarios', 'user_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id'),
      ('public.support_shares',       'student_id'),
      ('public.support_shares',       'staff_id')
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.read_support_share(uuid);
--   drop function if exists public.list_support_shares();
--   drop function if exists public.share_with_support(text, jsonb, timestamptz);
--   drop table if exists public.support_share_events, public.support_shares;
--   drop function if exists private.may_receive_support_share(uuid, text);
--   drop function if exists private.holds_role_at(uuid, text, text);
--   delete from public.app_roles where role = 'athletic_academic_support';
--   commit;
--
-- and re-run the lti_account_untouched definition from 20260928307000.
