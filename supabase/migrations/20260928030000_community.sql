-- Semester — Community: communities, posts, reports, cases, appeals, sessions.
--
-- The database half of `app/src/community/`. The TypeScript there states the
-- rules; this file makes the ones that matter for privacy and safety true for
-- every client, including one that is not ours:
--
--   * A peer never reads another member's account id. `community_posts`
--     carries `author_ref` — a hash of the account under a per-community salt
--     the API cannot read — and the `author_id` column is not granted to
--     `authenticated` at all. Refs from two communities cannot be joined.
--   * A reporter's identity is not readable by anybody through the API,
--     reviewers included: `community_reports.reporter_id` is not granted.
--     Reports are counted by the triage function, which runs as the owner.
--   * Triage runs inside `report_community_post` and can only hold, reduce or
--     queue. Removal, restriction and appeal outcomes need a live
--     `community:review` capability; a P0 account restriction needs
--     `community:review_senior`; an appeal is refused to anybody who decided
--     the case.
--   * Every case transition writes `community_case_events`, which has no
--     UPDATE or DELETE grant and whose actor is a hash, never an id.
--   * Nothing here reads a location, a schedule, a grade or a count of
--     reactions. There is no reactions table.
--
-- Not here, deliberately: scoped aliases, volunteer queues, institution
-- escalation and the private safety state. Their rules exist in
-- `app/src/community/` behind high-risk flags that are off; their tables wait
-- for the programmes behind them (docs/FEATURE-FLAG-REGISTRY.md).
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities and roles ─────────────────────────────────────────────
--
-- Trust & Safety reviewers are Semester staff at platform scope. They are not
-- the existing `moderator` role, and `platform_admin` gets neither: platform
-- administration grants no content or identity access
-- (docs/COMMUNITY-PRIVACY-MODEL.md). `community:manage` is per school.

insert into public.app_capabilities (capability, about) values
  ('community:review',        'Decide Community moderation cases (P1–P3) and appeals. Never reads a reporter.'),
  ('community:review_senior', 'Everything community:review does, plus P0 account restrictions.'),
  ('community:manage',        'Create institution and organization communities, and approved study venues, for one university.'),
  ('community:escalation_agreements', 'Record, activate and retire a university''s escalation agreement — one person drafts, another activates. Never reads a case.')
on conflict (capability) do nothing;

insert into public.app_roles (role, global) values
  ('trust_safety_reviewer', true),
  ('trust_safety_senior',   true),
  ('community_manager',     false)
on conflict (role) do nothing;

insert into public.role_capabilities (role, capability) values
  ('trust_safety_reviewer', 'community:review'),
  ('trust_safety_senior',   'community:review'),
  ('trust_safety_senior',   'community:review_senior'),
  ('trust_safety_senior',   'community:escalation_agreements'),
  ('community_manager',     'community:manage')
on conflict do nothing;

-- ── 2. Communities ────────────────────────────────────────────────────────

create table if not exists public.communities (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  kind                  text        not null check (kind in (
                          'course', 'study_group', 'student_organization', 'career_alumni',
                          'peer_mentorship', 'support', 'research', 'campus_bulletin',
                          'event', 'housing_transport')),
  name                  text        not null check (length(trim(name)) between 2 and 80),
  purpose               text        not null default '' check (length(purpose) <= 280),
  verification          text        not null default 'student_created' check (verification in (
                          'institution_verified', 'organization_verified', 'faculty_approved', 'student_created')),
  integrity_policy      text        not null default '' check (length(integrity_policy) <= 500),
  pseudonymity_approved boolean     not null default false
                          check (not pseudonymity_approved or kind in ('support', 'study_group')),
  -- Salts author refs so refs from two communities cannot be joined. Never granted.
  ref_salt              text        not null default replace(gen_random_uuid()::text, '-', ''),
  created_at            timestamptz not null default now()
);
create index if not exists communities_by_tenant on public.communities (tenant_id, kind);
alter table public.communities enable row level security;
revoke all on table public.communities from anon, authenticated;
grant select (id, tenant_id, kind, name, purpose, verification, integrity_policy,
              pseudonymity_approved, created_at)
  on table public.communities to authenticated;

drop policy if exists "communities at your school" on public.communities;
create policy "communities at your school" on public.communities
  for select to authenticated
  using (tenant_id = (select private.school_of()) or private.has_capability('community:review'));

create table if not exists public.community_members (
  community_id uuid        not null references public.communities(id) on delete cascade,
  user_id      uuid        not null references auth.users on delete cascade,
  role         text        not null default 'member' check (role in ('member', 'host', 'moderator', 'owner')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_by_user on public.community_members (user_id);

create or replace function private.community_role(want_community uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.community_members m
   where m.community_id = want_community and m.user_id = (select auth.uid());
$$;
revoke all on function private.community_role(uuid) from public;
grant execute on function private.community_role(uuid) to anon, authenticated;

alter table public.community_members enable row level security;
revoke all on table public.community_members from anon, authenticated;
grant select (community_id, role, joined_at), delete on table public.community_members to authenticated;

-- Your own memberships only. Who else is in a community is never listed —
-- support-community membership in particular is invisible to everybody.
drop policy if exists "your own memberships" on public.community_members;
create policy "your own memberships" on public.community_members
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "leave a community" on public.community_members;
create policy "leave a community" on public.community_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── 3. Posts ──────────────────────────────────────────────────────────────

-- Either side's block, which the caller's own RLS on `blocks` would half hide.
create or replace function private.blocked_either_way(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.blocks b
                  where (b.user_id = (select auth.uid()) and b.blocked = other)
                     or (b.blocked = (select auth.uid()) and b.user_id = other));
$$;
revoke all on function private.blocked_either_way(uuid) from public;
grant execute on function private.blocked_either_way(uuid) to authenticated;

create table if not exists public.community_posts (
  id           uuid        primary key default gen_random_uuid(),
  community_id uuid        not null references public.communities(id) on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  author_id    uuid        not null references auth.users on delete cascade,
  author_ref   text        not null,
  author_name  text        not null check (length(trim(author_name)) between 1 and 40),
  body         text        not null check (length(trim(body)) between 1 and 4000),
  label        text        not null default 'student_created' check (label in (
                 'institution_verified', 'organization_verified', 'faculty_approved',
                 'student_created', 'ai_assisted_source_linked', 'illustrative_example')),
  status       text        not null default 'published' check (status in (
                 'pending', 'published', 'reduced', 'held', 'removed', 'withdrawn')),
  -- Posted under a community alias. Shown, so a reader knows it is a pseudonym.
  as_alias     boolean     not null default false,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);
create index if not exists community_posts_by_community on public.community_posts (community_id, created_at desc);
create index if not exists community_posts_by_author on public.community_posts (author_id, created_at desc);
create index if not exists community_posts_by_tenant on public.community_posts (tenant_id);
alter table public.community_posts enable row level security;
revoke all on table public.community_posts from anon, authenticated;
grant select (id, community_id, author_ref, author_name, body, label, status, as_alias, created_at, edited_at)
  on table public.community_posts to authenticated;

drop policy if exists "members read visible posts" on public.community_posts;
create policy "members read visible posts" on public.community_posts
  for select to authenticated
  using (
    (status in ('published', 'reduced')
      and private.community_role(community_id) is not null
      and not private.blocked_either_way(author_id))
    or (author_id = (select auth.uid()) and status <> 'withdrawn')
    or private.has_capability('community:review')
  );

-- Restrictions a reviewer applies. community_id null = all of Community.
create table if not exists public.community_restrictions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  community_id uuid        references public.communities(id) on delete cascade,
  case_id      uuid        not null,
  until        timestamptz not null,
  lifted_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists community_restrictions_by_user on public.community_restrictions (user_id, until);
create index if not exists community_restrictions_by_community on public.community_restrictions (community_id);
alter table public.community_restrictions enable row level security;
revoke all on table public.community_restrictions from anon, authenticated;
grant select (id, community_id, until, lifted_at, created_at) on table public.community_restrictions to authenticated;
drop policy if exists "your restrictions, or a reviewer" on public.community_restrictions;
create policy "your restrictions, or a reviewer" on public.community_restrictions
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_capability('community:review'));

create or replace function private.community_restricted(who uuid, want_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_restrictions r
     where r.user_id = who and r.lifted_at is null and r.until > now()
       and (r.community_id is null or r.community_id = want_community)
  );
$$;
revoke all on function private.community_restricted(uuid, uuid) from public, anon, authenticated;

-- ── 4. Joining, posting, editing, withdrawing ─────────────────────────────

create or replace function public.join_community(want_community uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.communities;
begin
  select * into c from public.communities where id = want_community;
  if c.id is null or c.tenant_id is distinct from private.school_of() or not private.verified_student() then
    raise exception 'not a community you can join' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id, role)
  values (c.id, (select auth.uid()), 'member')
  on conflict do nothing;
end $$;
revoke all on function public.join_community(uuid) from public, anon, authenticated;
grant execute on function public.join_community(uuid) to authenticated;

-- A verified student may start a study group; everything else is created by
-- somebody holding community:manage at that school.
create or replace function public.create_community(
  want_kind text, want_name text, want_purpose text, want_integrity_policy text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.school_of();
  managed boolean;
  cid uuid;
begin
  if school is null or not private.verified_student() then
    raise exception 'a verified student at a school may create a community' using errcode = '42501';
  end if;
  managed := private.has_capability('community:manage', 'school', school);
  if want_kind <> 'study_group' and not managed then
    raise exception 'only study groups may be student-created' using errcode = '42501';
  end if;
  insert into public.communities (tenant_id, kind, name, purpose, verification, integrity_policy)
  values (school, want_kind, want_name, coalesce(want_purpose, ''),
          case when managed then 'institution_verified' else 'student_created' end,
          coalesce(want_integrity_policy, ''))
  returning id into cid;
  insert into public.community_members (community_id, user_id, role) values (cid, (select auth.uid()), 'owner');
  return cid;
end $$;
revoke all on function public.create_community(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_community(text, text, text, text) to authenticated;

-- The server's own last line against contact details: an email address or a
-- North American phone number. The richer detector runs on the device first
-- (app/src/community/pii.ts); this one exists for clients that skip it.
create or replace function private.has_contact_details(body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select body ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
      or body ~ '(^|[^0-9-])(\+?1[ .-]?)?\(?[0-9]{3}\)?[ .-]?[0-9]{3}[ .-]?[0-9]{4}([^0-9-]|$)';
$$;
revoke all on function private.has_contact_details(text) from public, anon, authenticated;

create or replace function public.create_community_post(
  want_community uuid, want_body text, want_confirmed_own boolean default false, want_as_alias boolean default false,
  want_media uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.communities;
  my_role text;
  handle text;
  recent integer;
  per_hour integer;
  open_posting boolean;
  premoderated boolean;
  alias text;
  pid uuid;
  -- A record rather than the row type: community_media is created in section 16.
  m record;
begin
  select * into c from public.communities where id = want_community;
  my_role := private.community_role(want_community);
  if c.id is null or my_role is null then
    raise exception 'join the community to post' using errcode = '42501';
  end if;
  if private.community_restricted(me, want_community) then
    raise exception 'you cannot post here right now' using errcode = '42501';
  end if;

  open_posting := c.kind in ('course', 'study_group', 'support');
  premoderated := c.kind in ('campus_bulletin', 'housing_transport');
  if not open_posting and my_role = 'member' then
    raise exception 'only hosts post in this community' using errcode = '42501';
  end if;

  per_hour := case c.kind
    when 'support' then 3 when 'housing_transport' then 2
    when 'course' then 10 when 'study_group' then 10 when 'student_organization' then 10
    else 5 end;
  if coalesce(want_as_alias, false) then
    if not c.pseudonymity_approved or not private.community_program_on(c.tenant_id, 'scoped_pseudonymity') then
      raise exception 'pseudonyms are not available in this community' using errcode = '42501';
    end if;
    select a.name into alias from public.community_aliases a where a.community_id = c.id and a.user_id = me;
    if alias is null then raise exception 'choose a name for this community first' using errcode = '22023'; end if;
    per_hour := least(per_hour, 3);
  end if;
  select count(*) into recent from public.community_posts
   where author_id = me and community_id = want_community and created_at > now() - interval '1 hour';
  if recent >= per_hour then
    raise exception 'posting limit reached for this community' using errcode = '54000';
  end if;

  -- An image is held until the scanner clears it (section 16), so the post is
  -- pending — visible to its author only — until then.
  if want_media is not null then
    if coalesce(want_as_alias, false) then
      raise exception 'images cannot be posted under an alias: a photo can say who took it' using errcode = '22023';
    end if;
    select * into m from public.community_media where id = want_media for update;
    if m.id is null or m.uploader_id <> me or m.community_id <> c.id or m.status <> 'awaiting_upload' then
      raise exception 'that image is not waiting to be posted here' using errcode = '22023';
    end if;
    if not private.media_uploaded(m.object_path) then
      raise exception 'the image has not finished uploading' using errcode = '22023';
    end if;
  end if;

  if private.has_contact_details(want_body) and not coalesce(want_confirmed_own, false) then
    raise exception 'this post looks like it includes contact details — remove them, or confirm they are yours'
      using errcode = '22023';
  end if;

  select p.handle into handle from public.profiles p where p.user_id = me;
  insert into public.community_posts (community_id, tenant_id, author_id, author_ref, author_name, body, status, as_alias)
  values (c.id, c.tenant_id, me,
          case when alias is null then substr(private.role_audit_sha256(c.ref_salt || me::text), 1, 12)
               else substr(private.role_audit_sha256(c.ref_salt || 'alias:' || lower(alias) || ':' || me::text), 1, 12) end,
          coalesce(alias, handle, 'Member'), want_body,
          case when want_media is not null or (premoderated and my_role = 'member') then 'pending' else 'published' end,
          alias is not null)
  returning id into pid;
  if want_media is not null then
    update public.community_media set post_id = pid, status = 'pending' where id = want_media;
  end if;
  perform private.community_run_detectors(pid);
  return pid;
end $$;
revoke all on function public.create_community_post(uuid, text, boolean, boolean, uuid) from public, anon, authenticated;
grant execute on function public.create_community_post(uuid, text, boolean, boolean, uuid) to authenticated;

create or replace function public.edit_community_post(want_post uuid, want_body text, want_confirmed_own boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_contact_details(want_body) and not coalesce(want_confirmed_own, false) then
    raise exception 'this post looks like it includes contact details — remove them, or confirm they are yours'
      using errcode = '22023';
  end if;
  update public.community_posts
     set body = want_body, edited_at = now()
   where id = want_post and author_id = (select auth.uid()) and status in ('published', 'pending', 'reduced');
  if not found then raise exception 'not a post you can edit' using errcode = '42501'; end if;
  -- An edit is a new text, so it is read again: editing is not a way round a rule.
  perform private.community_run_detectors(want_post);
end $$;
revoke all on function public.edit_community_post(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.edit_community_post(uuid, text, boolean) to authenticated;

-- A post with no open case is deleted outright. One under review is withdrawn
-- instead — hidden from everybody, including its author — so the evidence a
-- reviewer needs survives the author's second thoughts.
create or replace function public.delete_community_post(want_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.community_posts;
begin
  select * into p from public.community_posts where id = want_post and author_id = (select auth.uid());
  if p.id is null then raise exception 'not a post you can delete' using errcode = '42501'; end if;
  if exists (select 1 from public.community_cases k where k.post_id = p.id and k.status <> 'closed') then
    update public.community_posts set status = 'withdrawn' where id = p.id;
  else
    delete from public.community_posts where id = p.id;
  end if;
end $$;

-- The caller's own ref in each community they belong to, so a client can
-- mark its own posts without ever holding an account id. About the caller only.
create or replace function public.my_community_refs()
returns table (community_id uuid, author_ref text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, substr(private.role_audit_sha256(c.ref_salt || (select auth.uid())::text), 1, 12)
    from public.communities c
    join public.community_members m on m.community_id = c.id and m.user_id = (select auth.uid())
  union
  -- Alias refs too, including retired ones, so a rotated alias's posts stay editable.
  select p.community_id, p.author_ref from public.community_posts p where p.author_id = (select auth.uid());
$$;
revoke all on function public.my_community_refs() from public, anon, authenticated;
grant execute on function public.my_community_refs() to authenticated;

-- ── 5. Mutes and blocks by post ───────────────────────────────────────────
-- A member never learns another member's account id, so blocking goes through
-- the post: the server resolves the author and writes the existing `blocks`
-- row. Mutes are per community and only ever hide.

create table if not exists public.community_mutes (
  user_id      uuid        not null references auth.users on delete cascade,
  community_id uuid        not null references public.communities(id) on delete cascade,
  author_ref   text        not null check (length(author_ref) between 4 and 64),
  created_at   timestamptz not null default now(),
  primary key (user_id, community_id, author_ref)
);
create index if not exists community_mutes_by_community on public.community_mutes (community_id);
alter table public.community_mutes enable row level security;
revoke all on table public.community_mutes from anon, authenticated;
grant select, insert, delete on table public.community_mutes to authenticated;
drop policy if exists "mutes are yours alone" on public.community_mutes;
create policy "mutes are yours alone" on public.community_mutes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.block_community_author(want_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  select p.author_id into author from public.community_posts p
   where p.id = want_post and private.community_role(p.community_id) is not null;
  if author is null then raise exception 'not a post you can see' using errcode = '42501'; end if;
  if author = (select auth.uid()) then raise exception 'you cannot block yourself' using errcode = '22023'; end if;
  -- Blocking an alias mutes the alias here: an account block would hide the
  -- person's named posts as well, and which ones vanished would unmask them.
  if (select p.as_alias from public.community_posts p where p.id = want_post) then
    insert into public.community_mutes (user_id, community_id, author_ref)
    select (select auth.uid()), p.community_id, p.author_ref from public.community_posts p where p.id = want_post
    on conflict do nothing;
    return;
  end if;
  insert into public.blocks (user_id, blocked) values ((select auth.uid()), author) on conflict do nothing;
end $$;
revoke all on function public.block_community_author(uuid) from public, anon, authenticated;
grant execute on function public.block_community_author(uuid) to authenticated;

-- ── 6. Reports, cases and triage ──────────────────────────────────────────

create table if not exists public.community_cases (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  post_id      uuid        not null references public.community_posts(id) on delete cascade,
  category     text        not null,
  severity     text        not null check (severity in ('P0', 'P1', 'P2', 'P3')),
  protection   text        not null default 'queue' check (protection in (
                 'queue', 'monitor', 'reduce_distribution', 'temporary_hold')),
  route        text        not null default 'standard' check (route in (
                 'professional_urgent', 'professional', 'standard', 'integrity_review')),
  status       text        not null default 'open' check (status in ('open', 'decided', 'appealed', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  retain_until timestamptz not null default now() + interval '1 year'
);
create unique index if not exists community_cases_one_open_per_post
  on public.community_cases (post_id) where status <> 'closed';
create index if not exists community_cases_by_post on public.community_cases (post_id);
create index if not exists community_cases_queue on public.community_cases (status, severity, created_at);
create index if not exists community_cases_by_tenant on public.community_cases (tenant_id);
alter table public.community_cases enable row level security;
revoke all on table public.community_cases from anon, authenticated;
grant select on table public.community_cases to authenticated;
drop policy if exists "reviewers read cases" on public.community_cases;
create policy "reviewers read cases" on public.community_cases
  for select to authenticated using (private.has_capability('community:review'));

-- Grant on delete_community_post waited for community_cases to exist.
revoke all on function public.delete_community_post(uuid) from public, anon, authenticated;
grant execute on function public.delete_community_post(uuid) to authenticated;

create table if not exists public.community_reports (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.community_posts(id) on delete cascade,
  case_id     uuid        references public.community_cases(id) on delete set null,
  reporter_id uuid        not null references auth.users on delete cascade,
  category    text        not null check (category in (
                'harassment_or_bullying', 'threat_or_safety_concern', 'hate_or_discrimination',
                'private_information_or_doxxing', 'impersonation', 'nonconsensual_media',
                'spam_scam_or_phishing', 'academic_integrity', 'other')),
  imminent    boolean     not null default false,
  details     text        not null default '' check (length(details) <= 1000),
  -- Set when the brigading detector matched this report: it is kept, shown
  -- to reviewers, and counted toward nothing.
  set_aside   boolean     not null default false,
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);
create index if not exists community_reports_by_case on public.community_reports (case_id);
create index if not exists community_reports_by_reporter on public.community_reports (reporter_id);
alter table public.community_reports enable row level security;
revoke all on table public.community_reports from anon, authenticated;
-- No reporter_id, to anybody. Reviewers read category, details and time.
-- set_aside is not granted: a reporter can read their own report, and a
-- brigade that could see it had been detected would learn how to avoid it.
-- Reviewers see the brigading signal in community_signals instead.
grant select (id, post_id, case_id, category, imminent, details, created_at)
  on table public.community_reports to authenticated;
drop policy if exists "your reports, or a reviewer" on public.community_reports;
create policy "your reports, or a reviewer" on public.community_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or private.has_capability('community:review'));

-- Append-only case history. Actors are hashes; there is no update or delete grant.
create table if not exists public.community_case_events (
  id            bigint      generated always as identity primary key,
  case_id       uuid        not null references public.community_cases(id) on delete cascade,
  actor_kind    text        not null check (actor_kind in ('triage', 'student', 'volunteer', 'reviewer', 'senior_reviewer')),
  actor_sha256  text        check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  event         text        not null,
  reason_code   text        not null default '',
  from_status   text        not null,
  to_status     text        not null,
  occurred_at   timestamptz not null default now()
);
create index if not exists community_case_events_by_case on public.community_case_events (case_id, occurred_at);
alter table public.community_case_events enable row level security;
revoke all on table public.community_case_events from anon, authenticated;
grant select on table public.community_case_events to authenticated;
drop policy if exists "reviewers read case history" on public.community_case_events;
create policy "reviewers read case history" on public.community_case_events
  for select to authenticated using (private.has_capability('community:review'));

create or replace function private.community_case_event(
  want_case uuid, want_kind text, want_event text, want_reason text, want_from text, want_to text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.community_case_events (case_id, actor_kind, actor_sha256, event, reason_code, from_status, to_status)
  values (want_case, want_kind,
          case when want_kind = 'triage' then null else private.role_audit_sha256((select auth.uid())::text) end,
          want_event, coalesce(want_reason, ''), want_from, want_to);
$$;
revoke all on function private.community_case_event(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Mirrors provisionalSeverity() in app/src/community/moderation.ts.
create or replace function private.community_severity(want_category text, want_imminent boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when want_imminent then 'P0'
    when want_category in ('private_information_or_doxxing', 'nonconsensual_media') then 'P0'
    when want_category in ('threat_or_safety_concern', 'hate_or_discrimination') then 'P1'
    when want_category = 'other' then 'P3'
    else 'P2' end;
$$;
revoke all on function private.community_severity(text, boolean) from public, anon, authenticated;

-- ── 6a. Detectors ─────────────────────────────────────────────────────────
--
-- Automated signals, which only ever triage. Each rule is a row so a senior
-- reviewer can switch one off or change its confidence without a deploy, and
-- so the rules are reviewable as data. They are readable by reviewers only:
-- publishing the exact patterns would be publishing the way round them.
--
-- `app/src/community/detectors.ts` holds the same rules for the on-device
-- prompts, and `detectors.test.ts` fails if the two lists differ. Patterns
-- use `\y` for a word boundary here and `\b` there; that is the only
-- difference the test allows.
--
-- What a hit does:
--   * it is recorded in community_signals with its rule, confidence, version,
--     route and — once a person decides — the human outcome;
--   * it opens or joins the post's case at the rule's severity;
--   * a doxxing rule at confidence 0.9 or more holds the post; nothing else
--     a detector finds removes, hides or restricts anything;
--   * two different detectors on one post put the case under monitoring.
--
-- Crisis language routes to a professional and is never a hold: silencing
-- somebody who may be in trouble is the wrong first move.

create table if not exists public.community_detector_rules (
  id          text         primary key check (id ~ '^[a-z_]+\.[a-z0-9-]+$'),
  detector    text         not null check (detector in (
                'pii_doxxing', 'threat_crisis_language', 'hate_slur_risk', 'scam_phishing_link',
                'media_safety', 'bot_rate_brigading', 'academic_integrity', 'impersonation')),
  category    text         not null,
  severity    text         not null check (severity in ('P0', 'P1', 'P2', 'P3')),
  confidence  numeric(3,2) not null check (confidence > 0 and confidence <= 1),
  pattern     text         not null check (length(pattern) between 3 and 1000),
  enabled     boolean      not null default true,
  version     text         not null default 'community-detectors-2026.09.1',
  updated_at  timestamptz  not null default now(),
  updated_by_sha256 text   check (updated_by_sha256 is null or updated_by_sha256 ~ '^[0-9a-f]{64}$')
);
alter table public.community_detector_rules enable row level security;
revoke all on table public.community_detector_rules from anon, authenticated;
grant select on table public.community_detector_rules to authenticated;
-- Tuning, not rewriting: a senior reviewer may switch a rule or move its
-- confidence. A new pattern is a migration, reviewed like code.
grant update (enabled, confidence) on table public.community_detector_rules to authenticated;
drop policy if exists "reviewers read detector rules" on public.community_detector_rules;
create policy "reviewers read detector rules" on public.community_detector_rules
  for select to authenticated using (private.has_capability('community:review'));
drop policy if exists "senior reviewers tune detector rules" on public.community_detector_rules;
create policy "senior reviewers tune detector rules" on public.community_detector_rules
  for update to authenticated
  using (private.has_capability('community:review_senior'))
  with check (private.has_capability('community:review_senior'));

create or replace function private.stamp_detector_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by_sha256 := case when (select auth.uid()) is null then null
                                else private.role_audit_sha256((select auth.uid())::text) end;
  return new;
end $$;
revoke all on function private.stamp_detector_rule() from public, anon, authenticated;
drop trigger if exists stamp_detector_rule on public.community_detector_rules;
create trigger stamp_detector_rule before update on public.community_detector_rules
  for each row execute function private.stamp_detector_rule();

-- The rules. `\y` is a word boundary. Every pattern is matched
-- case-insensitively. Keep in step with DETECTOR_RULES in detectors.ts.
insert into public.community_detector_rules (id, detector, category, severity, confidence, pattern) values
  ('pii.third-party-contact', 'pii_doxxing', 'private_information_or_doxxing', 'P0', 0.95,
   '\y(her|his|their) (home address|address|phone number|number|dorm room|room number|room) is\y'),
  ('pii.lives-at', 'pii_doxxing', 'private_information_or_doxxing', 'P0', 0.95,
   '\y(she|he) lives (at|in|on) [a-z0-9 ]{0,30}(hall|house|apartments?|street|avenue|road|dorm|room)\y'),
  ('pii.third-party-schedule', 'pii_doxxing', 'private_information_or_doxxing', 'P0', 0.90,
   '\y(her|his) (class )?schedule is\y'),
  ('threat.harm', 'threat_crisis_language', 'threat_or_safety_concern', 'P1', 0.80,
   '\y(i|we)( will|[''’]ll| am going to|[''’]m going to|[''’]m gonna| are going to| gonna) (kill|shoot|stab|hurt|beat up) (you|him|her|them|us|someone|somebody|everyone|everybody|people)\y'),
  ('threat.weapon-campus', 'threat_crisis_language', 'threat_or_safety_concern', 'P0', 0.90,
   '\y(bring|bringing|brought) (a )?(gun|knife|weapon|bomb)s? (to|into) (class|school|campus|the library|the lecture|the dorm)\y'),
  ('threat.wish-death', 'threat_crisis_language', 'threat_or_safety_concern', 'P1', 0.80,
   '\yyou (should|deserve to) die\y'),
  ('crisis.self-harm', 'threat_crisis_language', 'other', 'P1', 0.70,
   '\y(kill myself|end my life|want to die|suicidal|suicide|hurt myself)\y'),
  ('hate.dehumanizing', 'hate_slur_risk', 'hate_or_discrimination', 'P1', 0.80,
   '\y(they|those people|you people) are (subhuman|vermin|animals|parasites|cockroaches)\y'),
  ('hate.go-back', 'hate_slur_risk', 'hate_or_discrimination', 'P1', 0.80,
   '\ygo back to (your|their) (own )?country\y'),
  ('scam.shortened-link', 'scam_phishing_link', 'spam_scam_or_phishing', 'P3', 0.50,
   '\y(bit\.ly|tinyurl\.com|goo\.gl|is\.gd|cutt\.ly|rb\.gy)/'),
  ('scam.payment', 'scam_phishing_link', 'spam_scam_or_phishing', 'P2', 0.60,
   '\y(gift cards?|wire (the )?money|pay upfront|payment upfront|double your (crypto|bitcoin|money))\y'),
  ('scam.credentials', 'scam_phishing_link', 'spam_scam_or_phishing', 'P2', 0.70,
   '\y(verify|confirm|update) your (account|password|login|student portal|student id)\y'),
  ('integrity.answers', 'academic_integrity', 'academic_integrity', 'P2', 0.60,
   '\y(answer key|answers (to|for) (the )?(quiz|exam|midterm|final|test|homework|hw|problem set|pset)|(quiz|exam|midterm|test) answers)\y'),
  ('integrity.do-it-for-me', 'academic_integrity', 'academic_integrity', 'P2', 0.70,
   '\y((take|do|write) my (exam|quiz|test|essay|homework|assignment) for (me|money)|pay (someone|you) to (take|do|write))\y'),
  ('impersonation.official', 'impersonation', 'impersonation', 'P2', 0.60,
   '\y(this is|message from|on behalf of) the (registrar|financial aid office|dean|office of the provost|campus police|it help desk)\y')
on conflict (id) do nothing;

create table if not exists public.community_signals (
  id            bigint       generated always as identity primary key,
  case_id       uuid         not null references public.community_cases(id) on delete cascade,
  post_id       uuid         not null references public.community_posts(id) on delete cascade,
  detector      text         not null,
  rule_id       text         not null,
  confidence    numeric(3,2) not null,
  version       text         not null,
  route         text         not null,
  human_outcome text,
  created_at    timestamptz  not null default now()
);
create index if not exists community_signals_by_case on public.community_signals (case_id);
create index if not exists community_signals_by_post on public.community_signals (post_id, created_at);
alter table public.community_signals enable row level security;
revoke all on table public.community_signals from anon, authenticated;
grant select on table public.community_signals to authenticated;
drop policy if exists "reviewers read signals" on public.community_signals;
create policy "reviewers read signals" on public.community_signals
  for select to authenticated using (private.has_capability('community:review'));

create or replace function private.community_route(want_severity text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case want_severity when 'P0' then 'professional_urgent' when 'P1' then 'professional' else 'standard' end;
$$;
revoke all on function private.community_route(text) from public, anon, authenticated;

/*
 * Run every enabled rule over one post, record what matched, and triage.
 * Called by create_community_post and edit_community_post, as the owner, so a
 * client cannot skip it. Also counts a burst of posting from one account —
 * eight or more in ten minutes, anywhere in Community — as a bot/rate signal.
 */
create or replace function private.community_run_detectors(want_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.community_posts;
  k public.community_cases;
  hits jsonb;
  top jsonb;
  hold boolean;
  kinds integer;
  rank_of text[] := array['P0', 'P1', 'P2', 'P3'];
begin
  select * into p from public.community_posts where id = want_post;
  if p.id is null then return; end if;

  select coalesce(jsonb_agg(h), '[]'::jsonb) into hits from (
    select r.id as rule_id, r.detector, r.category, r.severity, r.confidence, r.version
      from public.community_detector_rules r
     where r.enabled
       and p.body ~* r.pattern
       -- Impersonation is only a question for a post nobody verified.
       and (r.detector <> 'impersonation' or p.label = 'student_created')
    union all
    select 'bot_rate.burst', 'bot_rate_brigading', 'spam_scam_or_phishing', 'P2', 0.70, 'community-detectors-2026.09.1'
     where (select count(*) from public.community_posts q
             where q.author_id = p.author_id and q.created_at > now() - interval '10 minutes') >= 8
  ) h;
  if jsonb_array_length(hits) = 0 then return; end if;

  select h into top from jsonb_array_elements(hits) h
   order by array_position(rank_of, h->>'severity'), (h->>'confidence')::numeric desc limit 1;
  hold := exists (select 1 from jsonb_array_elements(hits) h
                   where h->>'detector' = 'pii_doxxing' and (h->>'confidence')::numeric >= 0.9);
  select count(distinct h->>'detector') into kinds from jsonb_array_elements(hits) h;

  select * into k from public.community_cases where post_id = p.id and status <> 'closed';
  if k.id is null then
    insert into public.community_cases (tenant_id, post_id, category, severity, route)
    values (p.tenant_id, p.id, top->>'category', top->>'severity', private.community_route(top->>'severity'))
    returning * into k;
    perform private.community_case_event(k.id, 'triage', 'case_opened', 'detector:' || (top->>'rule_id'), 'open', 'open');
  elsif array_position(rank_of, top->>'severity') < array_position(rank_of, k.severity) then
    update public.community_cases
       set severity = top->>'severity', category = top->>'category',
           route = private.community_route(top->>'severity'), updated_at = now()
     where id = k.id returning * into k;
  end if;

  insert into public.community_signals (case_id, post_id, detector, rule_id, confidence, version, route)
  select k.id, p.id, h->>'detector', h->>'rule_id', (h->>'confidence')::numeric, h->>'version', k.route
    from jsonb_array_elements(hits) h;

  if hold then
    update public.community_cases set protection = 'temporary_hold', updated_at = now() where id = k.id;
    update public.community_posts set status = 'held' where id = p.id and status in ('published', 'reduced', 'pending');
    perform private.community_case_event(k.id, 'triage', 'protection:temporary_hold', 'detector:high_confidence_pii', k.status, k.status);
  elsif kinds >= 2 and k.protection = 'queue' then
    update public.community_cases set protection = 'monitor', updated_at = now() where id = k.id;
  end if;
end $$;
revoke all on function private.community_run_detectors(uuid) from public, anon, authenticated;

/*
 * Report a post and triage it. Triage is the only automation here and it can
 * only protect, never decide:
 *
 *   one report                                   → a case in the queue
 *   two distinct signals (reporters or detectors)
 *     in thirty minutes                          → monitored
 *   one high-risk report (doxxing, threat, NCII,
 *     hate, or anything marked imminent)          → temporary hold, professional route
 *   three distinct reporters in sixty minutes     → reduced distribution pending review
 *
 * Brigading. A report is set aside — kept, shown to reviewers, counted toward
 * no threshold — when either:
 *   * in a community more than a week old, its reporter joined in the last day
 *     and at least two other such new members reported the same post in the
 *     last thirty minutes (in a new community everybody is new); or
 *   * a reviewer has already closed two or more of this reporter's reports on
 *     this author with no action in the last thirty days — a pattern of
 *     unfounded reports, not somebody reporting repeated abuse, which counts
 *     normally however often it happens.
 * A set-aside report never reduces a post and sends the case to integrity
 * review unless something already made it P0/P1. It can still hold a post for
 * a high-risk category: a hold is a reversible protection for the person the
 * post is about, not a penalty for its author, and missing a real doxxing
 * report costs more than a hold a reviewer lifts. Brigading is never a reason
 * to punish the target.
 *
 * Mirrors TRIAGE_THRESHOLDS in moderation.ts. A second report from the same
 * account is refused by the unique constraint, so it cannot count twice.
 */
create or replace function public.report_community_post(
  want_post uuid, want_category text, want_imminent boolean default false, want_details text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p public.community_posts;
  k public.community_cases;
  sev text := private.community_severity(want_category, coalesce(want_imminent, false));
  high_risk boolean := coalesce(want_imminent, false) or want_category in (
    'private_information_or_doxxing', 'threat_or_safety_concern', 'nonconsensual_media', 'hate_or_discrimination');
  fresh boolean;
  fresh_cluster boolean := false;
  repeat_target boolean := false;
  reporters integer;
  signals integer;
  rank_of text[] := array['P0', 'P1', 'P2', 'P3'];
begin
  select * into p from public.community_posts where id = want_post;
  if p.id is null or private.community_role(p.community_id) is null or p.status not in ('published', 'reduced') then
    raise exception 'not a post you can report' using errcode = '42501';
  end if;
  if p.author_id = me then raise exception 'you cannot report your own post' using errcode = '22023'; end if;

  select * into k from public.community_cases where post_id = p.id and status <> 'closed';
  if k.id is null then
    insert into public.community_cases (tenant_id, post_id, category, severity, route)
    values (p.tenant_id, p.id, want_category, sev, private.community_route(sev))
    returning * into k;
    perform private.community_case_event(k.id, 'triage', 'case_opened', 'triage:' || sev, 'open', 'open');
  end if;

  insert into public.community_reports (post_id, case_id, reporter_id, category, imminent, details)
  values (p.id, k.id, me, want_category, coalesce(want_imminent, false), coalesce(want_details, ''));

  -- ── Brigading ──
  select m.joined_at > now() - interval '24 hours'
         and (select c.created_at from public.communities c where c.id = p.community_id) < now() - interval '7 days'
    into fresh
    from public.community_members m where m.community_id = p.community_id and m.user_id = me;
  if coalesce(fresh, false) then
    select count(distinct r.reporter_id) >= 3 into fresh_cluster
      from public.community_reports r
      join public.community_members m on m.community_id = p.community_id and m.user_id = r.reporter_id
     where r.post_id = p.id and r.created_at > now() - interval '30 minutes'
       and m.joined_at > now() - interval '24 hours';
  end if;
  select count(*) >= 2 into repeat_target
    from public.community_reports r
    join public.community_posts q on q.id = r.post_id
    join public.community_cases c on c.id = r.case_id
   where r.reporter_id = me and q.author_id = p.author_id and r.post_id <> p.id
     and r.created_at > now() - interval '30 days'
     and c.status = 'closed'
     and exists (select 1 from public.community_decisions d
                  where d.case_id = c.id and d.stage = 'decision' and d.action in ('allow', 'close_no_action'));

  if fresh_cluster or repeat_target then
    -- Set aside this report and, for a fresh cluster, every fresh-joiner report on the post in the window.
    update public.community_reports r set set_aside = true
     where r.post_id = p.id
       and (r.reporter_id = me
            or (fresh_cluster and r.created_at > now() - interval '30 minutes'
                and exists (select 1 from public.community_members m
                             where m.community_id = p.community_id and m.user_id = r.reporter_id
                               and m.joined_at > now() - interval '24 hours')));
    insert into public.community_signals (case_id, post_id, detector, rule_id, confidence, version, route)
    values (k.id, p.id, 'bot_rate_brigading',
            case when fresh_cluster then 'brigade.fresh-joiners' else 'brigade.unfounded-repeat' end,
            0.80, 'community-detectors-2026.09.1', 'integrity_review');
    if k.severity not in ('P0', 'P1') then
      update public.community_cases set route = 'integrity_review', updated_at = now() where id = k.id;
    end if;
    perform private.community_case_event(k.id, 'triage', 'reports_set_aside',
      case when fresh_cluster then 'brigade.fresh-joiners' else 'brigade.unfounded-repeat' end, k.status, k.status);
    if high_risk then
      update public.community_cases set protection = 'temporary_hold', updated_at = now() where id = k.id;
      update public.community_posts set status = 'held' where id = p.id and status in ('published', 'reduced');
      perform private.community_case_event(k.id, 'triage', 'protection:temporary_hold', 'high_risk_report_set_aside', k.status, k.status);
    end if;
    return;
  end if;

  -- ── A counted report ──
  if array_position(rank_of, sev) < array_position(rank_of, k.severity) then
    update public.community_cases set severity = sev, category = want_category, updated_at = now()
     where id = k.id returning * into k;
  end if;
  if k.route <> 'integrity_review' or k.severity in ('P0', 'P1') then
    update public.community_cases set route = private.community_route(severity), updated_at = now()
     where id = k.id returning * into k;
  end if;

  if high_risk then
    update public.community_cases set protection = 'temporary_hold', updated_at = now() where id = k.id;
    update public.community_posts set status = 'held' where id = p.id and status in ('published', 'reduced');
    perform private.community_case_event(k.id, 'triage', 'protection:temporary_hold', 'high_risk_report', k.status, k.status);
    return;
  end if;

  select count(distinct r.reporter_id) into reporters from public.community_reports r
   where r.post_id = p.id and not r.set_aside and r.created_at > now() - interval '60 minutes';
  select count(distinct s.detector) into signals from public.community_signals s
   where s.post_id = p.id and s.detector <> 'bot_rate_brigading' and s.created_at > now() - interval '30 minutes';
  if reporters >= 3 and k.protection in ('queue', 'monitor') then
    update public.community_cases set protection = 'reduce_distribution', updated_at = now() where id = k.id;
    update public.community_posts set status = 'reduced' where id = p.id and status = 'published';
    perform private.community_case_event(k.id, 'triage', 'protection:reduce_distribution', 'three_reporters_60m', k.status, k.status);
  elsif (select count(distinct r.reporter_id) from public.community_reports r
          where r.post_id = p.id and not r.set_aside and r.created_at > now() - interval '30 minutes') + signals >= 2
        and k.protection = 'queue' then
    update public.community_cases set protection = 'monitor', updated_at = now() where id = k.id;
  end if;
end $$;
revoke all on function public.report_community_post(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.report_community_post(uuid, text, boolean, text) to authenticated;

-- ── 7. Decisions and appeals ──────────────────────────────────────────────

create table if not exists public.community_decisions (
  id          uuid        primary key default gen_random_uuid(),
  case_id     uuid        not null references public.community_cases(id) on delete cascade,
  actor_id    uuid        not null references auth.users on delete cascade,
  stage       text        not null default 'decision' check (stage in ('decision', 'appeal')),
  action      text        not null check (action in (
                'allow', 'label', 'reduce_distribution', 'remove', 'lock_thread', 'limit_replies',
                'rate_limit', 'community_restriction', 'account_restriction', 'preserve_evidence',
                'close_no_action')),
  reason_code text        not null check (length(trim(reason_code)) between 2 and 80),
  decided_at  timestamptz not null default now()
);
create index if not exists community_decisions_by_case on public.community_decisions (case_id, decided_at);
create index if not exists community_decisions_by_actor on public.community_decisions (actor_id);
alter table public.community_decisions enable row level security;
revoke all on table public.community_decisions from anon, authenticated;
grant select (id, case_id, stage, action, reason_code, decided_at) on table public.community_decisions to authenticated;
drop policy if exists "reviewers read decisions" on public.community_decisions;
create policy "reviewers read decisions" on public.community_decisions
  for select to authenticated using (private.has_capability('community:review'));

create or replace function private.apply_community_action(k public.community_cases, want_action text, author uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c uuid;
begin
  select p.community_id into c from public.community_posts p where p.id = k.post_id;
  if want_action in ('allow', 'close_no_action', 'label', 'preserve_evidence') then
    update public.community_posts set status = 'published' where id = k.post_id and status in ('held', 'reduced');
  elsif want_action = 'reduce_distribution' then
    update public.community_posts set status = 'reduced' where id = k.post_id and status in ('published', 'held');
  elsif want_action = 'remove' then
    update public.community_posts set status = 'removed' where id = k.post_id and status <> 'withdrawn';
  elsif want_action in ('community_restriction', 'rate_limit', 'lock_thread', 'limit_replies') then
    update public.community_posts set status = 'removed' where id = k.post_id and status in ('held', 'reduced');
    insert into public.community_restrictions (user_id, community_id, case_id, until)
    values (author, c, k.id, now() + case when want_action = 'rate_limit' then interval '1 day' else interval '14 days' end);
  elsif want_action = 'account_restriction' then
    update public.community_posts set status = 'removed' where id = k.post_id and status <> 'withdrawn';
    insert into public.community_restrictions (user_id, community_id, case_id, until)
    values (author, null, k.id, now() + interval '30 days');
  end if;
end $$;
revoke all on function private.apply_community_action(public.community_cases, text, uuid) from public, anon, authenticated;

create or replace function public.decide_community_case(want_case uuid, want_action text, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  author uuid;
  senior boolean := private.has_capability('community:review_senior');
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers decide cases' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = want_case for update;
  if k.id is null or k.status <> 'open' then raise exception 'this case is not open for a decision' using errcode = '22023'; end if;
  if want_action = 'account_restriction' and k.severity = 'P0' and not senior then
    raise exception 'a P0 account restriction needs a senior reviewer' using errcode = '42501';
  end if;
  select p.author_id into author from public.community_posts p where p.id = k.post_id;
  -- A known-abuse match is never put back up, whatever else the case says.
  if want_action not in ('remove', 'account_restriction', 'community_restriction', 'rate_limit')
     and exists (select 1 from public.community_media m where m.post_id = k.post_id and m.known_abuse_match) then
    raise exception 'a known-abuse match can only be removed; follow the legal reporting runbook' using errcode = '42501';
  end if;
  insert into public.community_decisions (case_id, actor_id, stage, action, reason_code)
  values (k.id, (select auth.uid()), 'decision', want_action, want_reason);
  perform private.apply_community_action(k, want_action, author);
  -- A removed image is remembered by its hashes, so it cannot simply be posted
  -- again at this school (section 16). Nothing is remembered for a known-abuse
  -- match: that is the legal runbook's, not a blocklist's.
  -- A decision that puts the post back up clears an image held for review.
  if want_action in ('allow', 'close_no_action', 'label', 'preserve_evidence', 'reduce_distribution') then
    update public.community_media set status = 'clear', reason_code = ''
     where post_id = k.post_id and status = 'held' and not known_abuse_match;
  end if;
  if want_action = 'remove' then
    update public.community_media set status = 'removed' where post_id = k.post_id and status in ('clear', 'held', 'pending');
    insert into public.community_media_blocklist (tenant_id, phash, sha256, category, source_media_id, added_by_sha256)
    select m.tenant_id, m.phash, m.sha256, k.category, m.id, private.role_audit_sha256((select auth.uid())::text)
      from public.community_media m
     where m.post_id = k.post_id and m.sha256 is not null and m.phash is not null and not m.known_abuse_match;
  end if;
  -- A violation a professional found counts against the author's private
  -- safety state, where the school has switched that on (section 15).
  perform private.record_safety_outcome(k, want_action, want_reason, author);
  -- Every automated signal on the case learns what a person decided, which is
  -- how a rule that keeps being overruled shows up in the numbers.
  update public.community_signals set human_outcome = want_action
   where case_id = k.id and human_outcome is null;
  -- How long the evidence is kept follows from the outcome: ninety days when
  -- nothing was wrong, a year when something was enforced.
  update public.community_cases
     set status = case when want_action in ('allow', 'close_no_action') then 'closed' else 'decided' end,
         retain_until = now() + case when want_action in ('allow', 'close_no_action')
                                     then interval '90 days' else interval '1 year' end,
         updated_at = now()
   where id = k.id;
  perform private.community_case_event(k.id, case when senior then 'senior_reviewer' else 'reviewer' end,
    'decided:' || want_action, want_reason, 'open',
    case when want_action in ('allow', 'close_no_action') then 'closed' else 'decided' end);
end $$;
revoke all on function public.decide_community_case(uuid, text, text) from public, anon, authenticated;
grant execute on function public.decide_community_case(uuid, text, text) to authenticated;

create or replace function public.appeal_community_decision(want_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
begin
  select c.* into k from public.community_cases c
    join public.community_posts p on p.id = c.post_id
   where c.post_id = want_post and p.author_id = (select auth.uid()) and c.status = 'decided';
  if k.id is null then raise exception 'there is no decision to appeal' using errcode = '22023'; end if;
  update public.community_cases set status = 'appealed', updated_at = now() where id = k.id;
  perform private.community_case_event(k.id, 'student', 'appeal_filed', 'appeal', 'decided', 'appealed');
end $$;
revoke all on function public.appeal_community_decision(uuid) from public, anon, authenticated;
grant execute on function public.appeal_community_decision(uuid) to authenticated;

-- An appeal is decided by a reviewer who took no part in the decision.
-- Upholding changes nothing; any other outcome lifts what the case imposed.
create or replace function public.decide_community_appeal(want_case uuid, want_uphold boolean, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  me uuid := (select auth.uid());
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers decide appeals' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = want_case for update;
  if k.id is null or k.status <> 'appealed' then raise exception 'no appeal is open' using errcode = '22023'; end if;
  if exists (select 1 from public.community_decisions d where d.case_id = k.id and d.actor_id = me) then
    raise exception 'a reviewer who decided the case may not decide its appeal' using errcode = '42501';
  end if;
  if not want_uphold
     and exists (select 1 from public.community_media m where m.post_id = k.post_id and m.known_abuse_match) then
    raise exception 'an appeal against a known-abuse removal can only be upheld' using errcode = '42501';
  end if;
  insert into public.community_decisions (case_id, actor_id, stage, action, reason_code)
  values (k.id, me, 'appeal', case when want_uphold then 'close_no_action' else 'allow' end, want_reason);
  if not want_uphold then
    update public.community_restrictions set lifted_at = now() where case_id = k.id and lifted_at is null;
    update public.community_posts set status = 'published' where id = k.post_id and status in ('removed', 'reduced', 'held');
    update public.community_safety_entries set reversed_at = now() where case_id = k.id and reversed_at is null;
    update public.community_media set status = 'clear', reason_code = ''
     where post_id = k.post_id and status in ('removed', 'held') and not known_abuse_match;
    delete from public.community_media_blocklist b
     using public.community_media m where m.post_id = k.post_id and b.source_media_id = m.id;
  end if;
  update public.community_signals
     set human_outcome = coalesce(human_outcome, 'none') || case when want_uphold then ' / upheld on appeal' else ' / reversed on appeal' end
   where case_id = k.id;
  update public.community_cases
     set status = 'closed', retain_until = now() + interval '1 year', updated_at = now()
   where id = k.id;
  perform private.community_case_event(k.id, 'reviewer',
    case when want_uphold then 'appeal_upheld' else 'appeal_granted' end, want_reason, 'appealed', 'closed');
end $$;
revoke all on function public.decide_community_appeal(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.decide_community_appeal(uuid, boolean, text) to authenticated;

-- What the author of a post is told: the action and reason, and whether they
-- can appeal. Never a severity, a report count or a reporter.
create or replace function public.my_community_notices()
returns table (post_id uuid, action text, reason_code text, decided_at timestamptz, appealable boolean, appeal_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.post_id, d.action, d.reason_code, d.decided_at,
         c.status = 'decided',
         case when c.status = 'appealed' then 'pending'
              when a.action = 'allow' then 'granted'
              when a.action is not null then 'upheld'
              else 'none' end
    from public.community_cases c
    join public.community_posts p on p.id = c.post_id
    join lateral (select * from public.community_decisions x where x.case_id = c.id and x.stage = 'decision'
                   order by x.decided_at desc limit 1) d on true
    left join lateral (select * from public.community_decisions y where y.case_id = c.id and y.stage = 'appeal'
                   order by y.decided_at desc limit 1) a on true
   where p.author_id = (select auth.uid())
     and d.action not in ('allow', 'close_no_action', 'preserve_evidence');
$$;
revoke all on function public.my_community_notices() from public, anon, authenticated;
grant execute on function public.my_community_notices() to authenticated;

-- What the caller holds, so the console can say "you are not a reviewer"
-- rather than show an empty queue. About the caller only.
create or replace function public.community_reviewer_standing()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.has_capability('community:review_senior') then 'senior'
              when private.has_capability('community:review') then 'reviewer'
              else 'none' end;
$$;
revoke all on function public.community_reviewer_standing() from public, anon, authenticated;
grant execute on function public.community_reviewer_standing() to authenticated;

-- ── 8. Study sessions at approved venues ──────────────────────────────────

create table if not exists public.community_venues (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  name       text        not null check (length(trim(name)) between 2 and 80),
  kind       text        not null check (kind in ('library', 'academic_building', 'student_center', 'virtual')),
  created_at timestamptz not null default now()
);
create index if not exists community_venues_by_tenant on public.community_venues (tenant_id);
alter table public.community_venues enable row level security;
revoke all on table public.community_venues from anon, authenticated;
grant select, insert, delete on table public.community_venues to authenticated;
drop policy if exists "venues at your school" on public.community_venues;
create policy "venues at your school" on public.community_venues
  for select to authenticated using (tenant_id = (select private.school_of()));
drop policy if exists "managers add venues" on public.community_venues;
create policy "managers add venues" on public.community_venues
  for insert to authenticated with check (private.has_capability('community:manage', 'school', tenant_id));
drop policy if exists "managers remove venues" on public.community_venues;
create policy "managers remove venues" on public.community_venues
  for delete to authenticated using (private.has_capability('community:manage', 'school', tenant_id));

create table if not exists public.community_sessions (
  id           uuid        primary key default gen_random_uuid(),
  community_id uuid        not null references public.communities(id) on delete cascade,
  host_id      uuid        not null references auth.users on delete cascade,
  venue_id     uuid        not null references public.community_venues(id) on delete cascade,
  title        text        not null check (length(trim(title)) between 2 and 80),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  capacity     smallint    not null check (capacity between 2 and 12),
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists community_sessions_by_community on public.community_sessions (community_id, starts_at);
create index if not exists community_sessions_by_host on public.community_sessions (host_id);
create index if not exists community_sessions_by_venue on public.community_sessions (venue_id);
alter table public.community_sessions enable row level security;
revoke all on table public.community_sessions from anon, authenticated;
grant select (id, community_id, venue_id, title, starts_at, ends_at, capacity, created_at)
  on table public.community_sessions to authenticated;
drop policy if exists "members see their community's sessions" on public.community_sessions;
create policy "members see their community's sessions" on public.community_sessions
  for select to authenticated using (private.community_role(community_id) is not null);

create table if not exists public.community_session_participants (
  session_id uuid        not null references public.community_sessions(id) on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists community_session_participants_by_user on public.community_session_participants (user_id);
alter table public.community_session_participants enable row level security;
revoke all on table public.community_session_participants from anon, authenticated;
grant select (session_id, joined_at), delete on table public.community_session_participants to authenticated;
drop policy if exists "your own session places" on public.community_session_participants;
create policy "your own session places" on public.community_session_participants
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "leave a session" on public.community_session_participants;
create policy "leave a session" on public.community_session_participants
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.create_study_session(
  want_community uuid, want_venue uuid, want_title text, want_starts timestamptz, want_ends timestamptz, want_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.communities;
  sid uuid;
begin
  select * into c from public.communities where id = want_community;
  if c.id is null or private.community_role(c.id) is null then
    raise exception 'join the community to host' using errcode = '42501';
  end if;
  if c.kind not in ('course', 'study_group') then
    raise exception 'study sessions belong to course and study-group communities' using errcode = '22023';
  end if;
  -- No free-text places and no home addresses: an approved venue at this school.
  if not exists (select 1 from public.community_venues v where v.id = want_venue and v.tenant_id = c.tenant_id) then
    raise exception 'choose a venue from the approved campus list' using errcode = '22023';
  end if;
  if private.community_restricted((select auth.uid()), c.id) then
    raise exception 'you cannot host here right now' using errcode = '42501';
  end if;
  insert into public.community_sessions (community_id, host_id, venue_id, title, starts_at, ends_at, capacity)
  values (c.id, (select auth.uid()), want_venue, want_title, want_starts, want_ends, want_capacity)
  returning id into sid;
  insert into public.community_session_participants (session_id, user_id) values (sid, (select auth.uid()));
  return sid;
end $$;
revoke all on function public.create_study_session(uuid, uuid, text, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.create_study_session(uuid, uuid, text, timestamptz, timestamptz, integer)
  to authenticated;

create or replace function public.join_study_session(want_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.community_sessions;
  me uuid := (select auth.uid());
  taken integer;
begin
  select * into s from public.community_sessions where id = want_session for update;
  if s.id is null or private.community_role(s.community_id) is null then
    raise exception 'not a session you can join' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_session_participants where session_id = s.id and user_id = me) then
    return;
  end if;
  select count(*) into taken from public.community_session_participants where session_id = s.id;
  if taken >= s.capacity then raise exception 'this session is full' using errcode = '22023'; end if;
  -- Deliberately vague: saying who blocked whom would disclose it.
  if exists (select 1 from public.community_session_participants sp
              where sp.session_id = s.id and private.blocked_either_way(sp.user_id)) then
    raise exception 'you can’t join this session' using errcode = '42501';
  end if;
  insert into public.community_session_participants (session_id, user_id) values (s.id, me);
end $$;
revoke all on function public.join_study_session(uuid) from public, anon, authenticated;
grant execute on function public.join_study_session(uuid) to authenticated;

-- Places taken, never who took them.
create or replace function public.community_session_counts(want_community uuid)
returns table (session_id uuid, taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, (select count(*)::integer from public.community_session_participants p where p.session_id = s.id)
    from public.community_sessions s
   where s.community_id = want_community and private.community_role(want_community) is not null;
$$;
revoke all on function public.community_session_counts(uuid) from public, anon, authenticated;
grant execute on function public.community_session_counts(uuid) to authenticated;

-- ── 9. Deleting an account ────────────────────────────────────────────────
-- What "delete my account" does to Community, in one call because a member
-- cannot filter on author_id or host_id. Everything of the caller's goes,
-- except a post that is the subject of a moderation case: that is withdrawn
-- (hidden from everyone) and its author shown as "Deleted account", and it
-- stays as evidence with its case — deleting an account is not a way to make
-- a report disappear, the same answer `reports` already gives.
create or replace function public.forget_my_community()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  update public.community_posts p
     set status = 'withdrawn', author_name = 'Deleted account'
   where p.author_id = me and exists (select 1 from public.community_cases k where k.post_id = p.id);
  delete from public.community_posts p
   where p.author_id = me and not exists (select 1 from public.community_cases k where k.post_id = p.id);
  -- Their images go now, not at the next sweep — except one on a post a case
  -- is keeping, and a known-abuse match. (The files follow through the
  -- deletion queue.)
  delete from public.community_media m
   where m.uploader_id = me and not m.known_abuse_match
     and (m.post_id is null or not exists (select 1 from public.community_cases k where k.post_id = m.post_id));
  delete from public.community_sessions where host_id = me;
  delete from public.community_session_participants where user_id = me;
  delete from public.community_mutes where user_id = me;
  delete from public.community_aliases where user_id = me;
  -- A volunteer's votes stay with the cases they decided; the record of the
  -- volunteer, and any task still waiting, goes.
  delete from public.community_volunteer_tasks where volunteer_id = me and answered_at is null;
  delete from public.community_volunteers where user_id = me;
  delete from public.community_members where user_id = me;
end $$;
revoke all on function public.forget_my_community() from public, anon, authenticated;
grant execute on function public.forget_my_community() to authenticated;

-- ── 9a. Retention sweep ───────────────────────────────────────────────────
--
-- What Trust & Safety keeps, and for how long, stated as the literals below
-- so RETENTION.md and `retention.test.ts` can hold the document to them:
--
--   * a case closed with nothing wrong      → 90 days after the decision
--   * a case with anything enforced         → 1 year after the decision
--   * a case decided on appeal              → 1 year after the appeal
--   * a case still open or under appeal     → never swept, whatever its date
--   * a report no case holds any more       → 90 days after it was made
--   * a lapsed or lifted restriction        → 90 days after it ended
--   * a study session                       → 30 days after it ended
--   * an unanswered volunteer task          → 1 day after it was handed out
--   * an answered volunteer task, and the
--     volunteer programme's events          → 1 year
--   * this sweep's own run log              → 1 year
--
-- Deleting a case takes its decisions, its history and its signals with it.
-- A withdrawn or removed post whose case has gone is deleted too, since the
-- only reason it was kept was the case. Every run writes a row, so a stalled
-- job is visible rather than assumed. Scheduled daily in supabase/scheduler.sql
-- as `community-retention`; callable by the service role only.

create table if not exists public.community_retention_runs (
  id                   bigint      generated always as identity primary key,
  ran_at               timestamptz not null default now(),
  cases_removed        integer     not null,
  posts_removed        integer     not null,
  reports_removed      integer     not null,
  restrictions_removed integer     not null,
  sessions_removed     integer     not null,
  volunteer_tasks_removed integer   not null default 0
);
create index if not exists community_retention_runs_by_time on public.community_retention_runs (ran_at desc);
alter table public.community_retention_runs enable row level security;
revoke all on table public.community_retention_runs from anon, authenticated;
grant select on table public.community_retention_runs to authenticated;
drop policy if exists "reviewers read retention runs" on public.community_retention_runs;
create policy "reviewers read retention runs" on public.community_retention_runs
  for select to authenticated using (private.has_capability('community:review'));

create or replace function private.sweep_community_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_cases integer;
  n_posts integer;
  n_reports integer;
  n_restrictions integer;
  n_sessions integer;
  n_volunteer integer;
begin
  delete from public.community_cases k
   where k.retain_until < now() and k.status not in ('open', 'appealed')
     -- Evidence of a known-abuse match is kept until the legal runbook says otherwise.
     and not exists (select 1 from public.community_media m where m.post_id = k.post_id and m.known_abuse_match);
  get diagnostics n_cases = row_count;

  delete from public.community_posts p
   where p.status in ('withdrawn', 'removed')
     and not exists (select 1 from public.community_cases k where k.post_id = p.id);
  get diagnostics n_posts = row_count;

  delete from public.community_reports r
   where r.case_id is null and r.created_at < now() - interval '90 days';
  get diagnostics n_reports = row_count;

  delete from public.community_restrictions x
   where coalesce(least(x.lifted_at, x.until), x.until) < now() - interval '90 days';
  get diagnostics n_restrictions = row_count;

  delete from public.community_sessions s where s.ends_at < now() - interval '30 days';
  get diagnostics n_sessions = row_count;

  -- Volunteer work: a task never answered lapses after a day; an answered
  -- one, and the programme's own events, after a year.
  delete from public.community_volunteer_tasks t
   where (t.answered_at is null and t.assigned_at < now() - interval '1 day')
      or t.answered_at < now() - interval '1 year';
  get diagnostics n_volunteer = row_count;
  delete from public.community_volunteer_events e where e.occurred_at < now() - interval '1 year';
  -- An image reserved and never posted lapses after a day; an image whose post
  -- is gone goes with it — except a known-abuse match, which the legal runbook
  -- decides about.
  delete from public.community_media where status = 'awaiting_upload' and created_at < now() - interval '1 day';
  delete from public.community_media
   where post_id is null and status <> 'awaiting_upload' and not known_abuse_match;
  -- The safety state forgets after a year, so it recovers.
  delete from public.community_safety_entries e where e.created_at < now() - interval '1 year';
  -- A delivered escalation's copy of the payload has done its job.
  delete from public.community_escalation_deliveries d where d.delivered_at < now() - interval '90 days';

  delete from public.community_retention_runs where ran_at < now() - interval '1 year';

  insert into public.community_retention_runs
    (cases_removed, posts_removed, reports_removed, restrictions_removed, sessions_removed, volunteer_tasks_removed)
  values (n_cases, n_posts, n_reports, n_restrictions, n_sessions, n_volunteer);

  return jsonb_build_object('cases', n_cases, 'posts', n_posts, 'reports', n_reports,
                            'restrictions', n_restrictions, 'sessions', n_sessions,
                            'volunteer_tasks', n_volunteer);
end $$;
revoke all on function private.sweep_community_retention() from public, anon, authenticated;
grant execute on function private.sweep_community_retention() to service_role;

-- ── 10. The LTI emptiness check counts Community ──────────────────────────
-- An LTI launch attaches only to an account nobody has used. A post, a
-- membership, a hosted session, a session place or a mute is use, so the
-- check from 20260927230000_help_requests.sql is restated with them added;
-- this migration runs after it so neither loses the other's tables.
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
      ('public.state',                          'user_id'),
      ('public.courses',                        'user_id'),
      ('public.notes',                          'user_id'),
      ('public.tasks',                          'user_id'),
      ('public.appointments',                   'user_id'),
      ('public.sittings',                       'user_id'),
      ('public.calendar_feeds',                 'user_id'),
      ('public.messages',                       'user_id'),
      ('public.message_reactions',              'user_id'),
      ('public.group_members',                  'user_id'),
      ('public.enrollments',                    'user_id'),
      ('public.blocks',                         'user_id'),
      ('public.referrals',                      'user_id'),
      ('public.referral_codes',                 'user_id'),
      ('public.forms',                          'owner'),
      ('public.family_grants',                  'student_id'),
      ('public.feedback',                       'author'),
      ('public.organization_members',           'user_id'),
      ('public.support_access_grant',           'student_id'),
      ('public.support_access_grant',           'supporter_id'),
      ('public.help_requests',                  'student_id'),
      ('public.mentor_requests',                'requester'),
      ('public.mentor_requests',                'recipient'),
      ('public.peer_mentor_offers',             'user_id'),
      ('public.alumni_mentor_offers',           'user_id'),
      ('public.community_posts',                'author_id'),
      ('public.community_sessions',             'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',                'user_id'),
      ('public.community_members',              'user_id'),
      ('public.community_aliases',              'user_id'),
      ('public.community_volunteers',           'user_id'),
      ('public.community_media',                'uploader_id')
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

-- ── 11. Programs that stay off until somebody decides otherwise ───────────
--
-- Scoped pseudonyms and volunteer moderation are built here and switched off.
-- The app's build flags cannot be the switch: a flag is a browser setting and
-- a client that ignores it would reach these functions anyway. So each
-- program has a row per university, off unless present and enabled, and only
-- the service role can write one — turning either on is a reviewed deployment
-- step (docs/FEATURE-FLAG-REGISTRY.md), never a button in the app.

create table if not exists public.community_programs (
  tenant_id   text        not null references public.schools(id) on delete cascade,
  program     text        not null check (program in ('scoped_pseudonymity', 'volunteer_moderation',
                                                           'institution_escalation', 'account_safety_state',
                                                           'image_posts')),
  enabled     boolean     not null default false,
  approved_ref text       not null default '' check (length(approved_ref) <= 200),
  changed_at  timestamptz not null default now(),
  primary key (tenant_id, program)
);
alter table public.community_programs enable row level security;
revoke all on table public.community_programs from anon, authenticated;
grant select on table public.community_programs to authenticated;
drop policy if exists "your school's programs" on public.community_programs;
create policy "your school's programs" on public.community_programs
  for select to authenticated
  using (tenant_id = (select private.school_of()) or private.has_capability('community:review'));

create or replace function private.community_program_on(want_tenant text, want_program text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- The integration control plane's `kill.sharing` (flags.ts, feature_kill_switch)
  -- stops pseudonymity and volunteer moderation, globally or for one school. It
  -- is read here so an engaged switch holds in the database, not only in the app.
  select coalesce((select p.enabled from public.community_programs p
                    where p.tenant_id = want_tenant and p.program = want_program), false)
     and not (want_program in ('scoped_pseudonymity', 'volunteer_moderation')
              and public.kill_switch_engaged('kill.sharing', want_tenant));
$$;
revoke all on function private.community_program_on(text, text) from public, anon, authenticated;

-- ── 12. Scoped pseudonyms ─────────────────────────────────────────────────
--
-- An alias belongs to one community, approved for pseudonyms, at a school
-- whose program is on. It is unique there, ignoring case, and may not be any
-- member's handle at that school, so it cannot be used to pass as somebody.
-- There is no search and no list: a peer meets an alias only on a post.
--
-- A post under an alias carries its own author_ref, salted with the alias, so
-- it cannot be joined to the same person's named posts — and a new alias is a
-- new ref. Blocking an alias mutes that alias in that community rather than
-- blocking the account: an account block would make the person's named posts
-- disappear too, and which ones disappeared would say who the alias is.
-- Reports, decisions and restrictions still reach the account, because the
-- server holds author_id for every post.
--
-- Rotation is once a day at most, and refused while any case on the person's
-- posts in that community is open: an investigation keeps the name it began
-- with. Aliases post at no more than three an hour.

create table if not exists public.community_aliases (
  community_id uuid        not null references public.communities(id) on delete cascade,
  user_id      uuid        not null references auth.users on delete cascade,
  name         text        not null check (name ~ '^[A-Za-z][A-Za-z0-9]{3,23}$'),
  created_at   timestamptz not null default now(),
  rotated_at   timestamptz,
  primary key (community_id, user_id)
);
create unique index if not exists community_aliases_unique_name
  on public.community_aliases (community_id, lower(name));
create index if not exists community_aliases_by_user on public.community_aliases (user_id);
alter table public.community_aliases enable row level security;
revoke all on table public.community_aliases from anon, authenticated;
grant select (community_id, name, created_at, rotated_at), delete on table public.community_aliases to authenticated;
drop policy if exists "your own aliases" on public.community_aliases;
create policy "your own aliases" on public.community_aliases
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "drop your own alias" on public.community_aliases;
create policy "drop your own alias" on public.community_aliases
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.approve_community_pseudonymity(want_community uuid, want_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.communities;
begin
  select * into c from public.communities where id = want_community;
  if c.id is null or not private.has_capability('community:manage', 'school', c.tenant_id) then
    raise exception 'a community manager at this school approves pseudonyms' using errcode = '42501';
  end if;
  if want_on and not private.community_program_on(c.tenant_id, 'scoped_pseudonymity') then
    raise exception 'pseudonyms are switched off at this school' using errcode = '42501';
  end if;
  if want_on and c.kind not in ('support', 'study_group') then
    raise exception 'pseudonyms are only for support and study-group communities' using errcode = '22023';
  end if;
  update public.communities set pseudonymity_approved = coalesce(want_on, false) where id = c.id;
end $$;
revoke all on function public.approve_community_pseudonymity(uuid, boolean) from public, anon, authenticated;
grant execute on function public.approve_community_pseudonymity(uuid, boolean) to authenticated;

create or replace function public.claim_community_alias(want_community uuid, want_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.communities;
  mine public.community_aliases;
begin
  select * into c from public.communities where id = want_community;
  if c.id is null or private.community_role(c.id) is null then
    raise exception 'join the community first' using errcode = '42501';
  end if;
  if not c.pseudonymity_approved or not private.community_program_on(c.tenant_id, 'scoped_pseudonymity') then
    raise exception 'pseudonyms are not available in this community' using errcode = '42501';
  end if;
  if want_name is null or want_name !~ '^[A-Za-z][A-Za-z0-9]{3,23}$' then
    raise exception 'use 4–24 letters and numbers, starting with a letter' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.school_id = c.tenant_id and lower(p.handle) = lower(want_name)) then
    raise exception 'that name is taken' using errcode = '22023';
  end if;
  if exists (select 1 from public.community_aliases a
              where a.community_id = c.id and lower(a.name) = lower(want_name) and a.user_id <> me) then
    raise exception 'that name is taken' using errcode = '22023';
  end if;

  select * into mine from public.community_aliases where community_id = c.id and user_id = me;
  if mine.user_id is null then
    insert into public.community_aliases (community_id, user_id, name) values (c.id, me, want_name);
    return;
  end if;
  if lower(mine.name) = lower(want_name) then return; end if;
  if coalesce(mine.rotated_at, mine.created_at) > now() - interval '1 day' then
    raise exception 'you can change this name once a day' using errcode = '54000';
  end if;
  -- Deliberately vague: saying a case is open would disclose it.
  if exists (select 1 from public.community_cases k join public.community_posts p on p.id = k.post_id
              where p.community_id = c.id and p.author_id = me and k.status <> 'closed') then
    raise exception 'this name cannot be changed right now' using errcode = '42501';
  end if;
  update public.community_aliases set name = want_name, rotated_at = now()
   where community_id = c.id and user_id = me;
end $$;
revoke all on function public.claim_community_alias(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_community_alias(uuid, text) to authenticated;

-- ── 12a. Who is behind an alias: just-in-time, for one case ──────────────
--
-- The alias disclosure promises students that Semester still knows who they
-- are and that trained Trust & Safety staff can check during a safety
-- investigation. This is the check, and it is the rules in identity.ts
-- (viewIdentity, JitGrant) enforced where a client cannot skip them:
--
--   * only for a post made under an alias, on a case that is open or
--     appealed — a named post already shows who wrote it;
--   * one reviewer asks, for themselves, with a written reason; a different
--     reviewer approves or refuses with their own — compared by hash;
--   * an approved grant is good for JIT_HOURS (identity.ts) for that reviewer
--     on that case, and nothing else;
--   * every look is a case event, as are the request and the decision.
--
-- What it shows: the account's handle at its school, an opaque vault reference
-- that is stable per account and means nothing outside Semester, and the
-- account's other cases (category, severity, status, whether under an alias).
-- Never an email, a legal name or an account id.

create table if not exists public.community_identity_grants (
  id                  uuid        primary key default gen_random_uuid(),
  case_id             uuid        not null references public.community_cases(id) on delete cascade,
  status              text        not null default 'requested' check (status in ('requested', 'approved', 'refused')),
  grantee_sha256      text        not null check (grantee_sha256 ~ '^[0-9a-f]{64}$'),
  requested_reason    text        not null check (length(trim(requested_reason)) between 10 and 500),
  requested_at        timestamptz not null default now(),
  decided_by_sha256   text        check (decided_by_sha256 is null or decided_by_sha256 ~ '^[0-9a-f]{64}$'),
  decided_reason      text        check (decided_reason is null or length(trim(decided_reason)) between 10 and 500),
  decided_at          timestamptz,
  expires_at          timestamptz
);
create unique index if not exists community_identity_grants_one_live
  on public.community_identity_grants (case_id, grantee_sha256) where status = 'requested';
create index if not exists community_identity_grants_by_case on public.community_identity_grants (case_id);
alter table public.community_identity_grants enable row level security;
revoke all on table public.community_identity_grants from anon, authenticated;
grant select on table public.community_identity_grants to authenticated;
drop policy if exists "reviewers see identity grants" on public.community_identity_grants;
create policy "reviewers see identity grants" on public.community_identity_grants
  for select to authenticated using (private.has_capability('community:review'));

create or replace function public.request_alias_identity(want_case uuid, want_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  alias_post boolean;
  gid uuid;
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers ask who is behind an alias' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = want_case;
  if k.id is null or k.status not in ('open', 'appealed') then
    raise exception 'only an open or appealed case' using errcode = '22023';
  end if;
  select p.as_alias into alias_post from public.community_posts p where p.id = k.post_id;
  if not coalesce(alias_post, false) then
    raise exception 'this post was not made under an alias' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write down why the investigation needs it' using errcode = '22023';
  end if;
  if exists (select 1 from public.community_identity_grants g
              where g.case_id = k.id and g.grantee_sha256 = me_hash
                and (g.status = 'requested' or (g.status = 'approved' and g.expires_at > now()))) then
    raise exception 'you already have a request or a grant for this case' using errcode = '22023';
  end if;
  insert into public.community_identity_grants (case_id, grantee_sha256, requested_reason)
  values (k.id, me_hash, left(trim(want_reason), 500))
  returning id into gid;
  perform private.community_case_event(k.id,
    case when private.has_capability('community:review_senior') then 'senior_reviewer' else 'reviewer' end,
    'identity_requested', 'identity', k.status, k.status);
  return gid;
end $$;
revoke all on function public.request_alias_identity(uuid, text) from public, anon, authenticated;
grant execute on function public.request_alias_identity(uuid, text) to authenticated;

create or replace function public.decide_alias_identity(want_grant uuid, want_approve boolean, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.community_identity_grants;
  k public.community_cases;
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers decide these' using errcode = '42501';
  end if;
  select * into g from public.community_identity_grants where id = want_grant for update;
  if g.id is null or g.status <> 'requested' then
    raise exception 'no request is waiting' using errcode = '22023';
  end if;
  if g.grantee_sha256 = me_hash then
    raise exception 'a second, different reviewer must decide' using errcode = '42501';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write the reason out' using errcode = '22023';
  end if;
  select * into k from public.community_cases where id = g.case_id;
  if coalesce(want_approve, false) and k.status not in ('open', 'appealed') then
    raise exception 'the case is no longer open' using errcode = '22023';
  end if;
  update public.community_identity_grants
     set status = case when coalesce(want_approve, false) then 'approved' else 'refused' end,
         decided_by_sha256 = me_hash, decided_reason = left(trim(want_reason), 500), decided_at = now(),
         expires_at = case when coalesce(want_approve, false) then now() + interval '4 hours' end
   where id = g.id;
  perform private.community_case_event(k.id,
    case when private.has_capability('community:review_senior') then 'senior_reviewer' else 'reviewer' end,
    case when coalesce(want_approve, false) then 'identity_approved' else 'identity_refused' end,
    'identity', k.status, k.status);
end $$;
revoke all on function public.decide_alias_identity(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.decide_alias_identity(uuid, boolean, text) to authenticated;

/* The look itself: only the grantee, only while the grant holds, every time logged. */
create or replace function public.reveal_alias_identity(want_grant uuid)
returns table (handle text, vault_ref text, other_cases jsonb, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.community_identity_grants;
  k public.community_cases;
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  author uuid;
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers' using errcode = '42501';
  end if;
  select * into g from public.community_identity_grants where id = want_grant;
  if g.id is null or g.status <> 'approved' or g.grantee_sha256 <> me_hash or g.expires_at <= now() then
    raise exception 'no grant of yours holds for this case' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = g.case_id;
  select p.author_id into author from public.community_posts p where p.id = k.post_id;
  perform private.community_case_event(k.id,
    case when private.has_capability('community:review_senior') then 'senior_reviewer' else 'reviewer' end,
    'identity_revealed', 'identity', k.status, k.status);
  return query
  select coalesce((select pr.handle from public.profiles pr where pr.user_id = author), 'Deleted account'),
         case when author is null then '' else private.role_audit_sha256('vault:' || author::text) end,
         coalesce((select jsonb_agg(jsonb_build_object('case_id', c.id, 'category', c.category, 'severity', c.severity,
                                                       'status', c.status, 'as_alias', p.as_alias) order by c.created_at desc)
                     from public.community_cases c join public.community_posts p on p.id = c.post_id
                    where p.author_id = author and c.id <> k.id), '[]'::jsonb),
         g.expires_at;
end $$;
revoke all on function public.reveal_alias_identity(uuid) from public, anon, authenticated;
grant execute on function public.reveal_alias_identity(uuid) to authenticated;

-- ── 13. Volunteer moderation ──────────────────────────────────────────────
--
-- The programme in docs/VOLUNTEER-MODERATOR-PROGRAM.md, as tables. Off at every
-- school until community_programs says otherwise, and every function checks.
--
-- Joining: a verified student, account at least 30 days old, no active
-- restriction. Before any task: training (recorded by a senior reviewer), and
-- a confidentiality agreement and the recusal rules (signed by the volunteer).
--
-- Calibration: 20 onboarding items with known answers; 17 right (85%) makes
-- a volunteer active. After that, control items with known answers are mixed
-- into the queue and look exactly like real cases — every task is an opaque
-- id. Quality is the last 20 controls at 5 points each: 85 or more stays
-- active, 75–80 is probation (controls only), under 75 pauses. A paused or
-- revoked volunteer gets nothing until a senior reviewer recalibrates them.
--
-- Queue: open P3 cases, and P2 spam or "other", on the standard route, at the
-- volunteer's own school. Never P0/P1, never another category, never an
-- appeal, and never anything from a support community. Recusal is automatic:
-- a post they wrote or reported, a community they host or moderate, an author
-- either of them has blocked. What they see
-- is the category, the severity, the community type and the text — no name,
-- no author, no reporter, no other votes.
--
-- Deciding: allow, label or close by one volunteer; removal only when a second
-- volunteer independently agrees; any disagreement goes to a professional.
-- Caps: 20 an hour and 100 a day, controls included.

create table if not exists public.community_volunteers (
  user_id                 uuid        primary key references auth.users on delete cascade,
  tenant_id               text        not null references public.schools(id) on delete cascade,
  status                  text        not null default 'onboarding'
                            check (status in ('onboarding', 'active', 'probation', 'paused', 'revoked')),
  applied_at              timestamptz not null default now(),
  training_completed_at   timestamptz,
  confidentiality_signed_at timestamptz,
  recusal_acknowledged_at timestamptz,
  revoked_at              timestamptz,
  revoked_reason          text        not null default '' check (length(revoked_reason) <= 500),
  -- When the current calibration began: at application, and again whenever a
  -- senior reviewer sends the volunteer back. Onboarding answers and control
  -- quality count only from here, so a recalibration is a fresh start rather
  -- than a status that the old answers immediately undo.
  calibration_started_at  timestamptz not null default now()
);
create index if not exists community_volunteers_by_tenant on public.community_volunteers (tenant_id, status);
alter table public.community_volunteers enable row level security;
revoke all on table public.community_volunteers from anon, authenticated;
grant select on table public.community_volunteers to authenticated;
drop policy if exists "your own volunteer record, or a reviewer" on public.community_volunteers;
create policy "your own volunteer record, or a reviewer" on public.community_volunteers
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_capability('community:review'));

create table if not exists public.community_calibration_items (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  kind            text        not null check (kind in ('onboarding', 'control')),
  category        text        not null check (category in ('spam_scam_or_phishing', 'other')),
  severity        text        not null check (severity in ('P2', 'P3')),
  community_kind  text        not null default 'course',
  body            text        not null check (length(trim(body)) between 1 and 4000),
  expected_action text        not null check (expected_action in ('allow', 'remove')),
  created_at      timestamptz not null default now(),
  retired_at      timestamptz
);
create index if not exists community_calibration_items_by_tenant on public.community_calibration_items (tenant_id, kind);
alter table public.community_calibration_items enable row level security;
revoke all on table public.community_calibration_items from anon, authenticated;
grant select, insert on table public.community_calibration_items to authenticated;
grant update (retired_at) on table public.community_calibration_items to authenticated;
-- Volunteers never read these directly; they meet them only as tasks.
drop policy if exists "reviewers read calibration items" on public.community_calibration_items;
create policy "reviewers read calibration items" on public.community_calibration_items
  for select to authenticated using (private.has_capability('community:review'));
drop policy if exists "senior reviewers write calibration items" on public.community_calibration_items;
create policy "senior reviewers write calibration items" on public.community_calibration_items
  for insert to authenticated with check (private.has_capability('community:review_senior'));
drop policy if exists "senior reviewers retire calibration items" on public.community_calibration_items;
create policy "senior reviewers retire calibration items" on public.community_calibration_items
  for update to authenticated
  using (private.has_capability('community:review_senior'))
  with check (private.has_capability('community:review_senior'));

-- One row per task handed out. The id is all a volunteer ever holds.
create table if not exists public.community_volunteer_tasks (
  id           uuid        primary key default gen_random_uuid(),
  volunteer_id uuid        not null references auth.users on delete cascade,
  case_id      uuid        references public.community_cases(id) on delete cascade,
  item_id      uuid        references public.community_calibration_items(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  answered_at  timestamptz,
  answer       text,
  correct      boolean,
  check (num_nonnulls(case_id, item_id) = 1)
);
create index if not exists community_volunteer_tasks_by_volunteer on public.community_volunteer_tasks (volunteer_id, answered_at);
create index if not exists community_volunteer_tasks_by_case on public.community_volunteer_tasks (case_id);
create index if not exists community_volunteer_tasks_by_item on public.community_volunteer_tasks (item_id);
alter table public.community_volunteer_tasks enable row level security;
revoke all on table public.community_volunteer_tasks from anon, authenticated;
grant select on table public.community_volunteer_tasks to authenticated;
drop policy if exists "reviewers audit volunteer tasks" on public.community_volunteer_tasks;
create policy "reviewers audit volunteer tasks" on public.community_volunteer_tasks
  for select to authenticated using (private.has_capability('community:review'));

create table if not exists public.community_volunteer_votes (
  case_id      uuid        not null references public.community_cases(id) on delete cascade,
  volunteer_id uuid        not null references auth.users on delete cascade,
  action       text        not null check (action in ('allow', 'label', 'remove', 'close_no_action')),
  reason_code  text        not null check (length(trim(reason_code)) between 2 and 80),
  voted_at     timestamptz not null default now(),
  primary key (case_id, volunteer_id)
);
create index if not exists community_volunteer_votes_by_volunteer on public.community_volunteer_votes (volunteer_id);
alter table public.community_volunteer_votes enable row level security;
revoke all on table public.community_volunteer_votes from anon, authenticated;
grant select (case_id, action, reason_code, voted_at) on table public.community_volunteer_votes to authenticated;
drop policy if exists "reviewers audit volunteer votes" on public.community_volunteer_votes;
create policy "reviewers audit volunteer votes" on public.community_volunteer_votes
  for select to authenticated using (private.has_capability('community:review'));

create table if not exists public.community_volunteer_events (
  id                bigint      generated always as identity primary key,
  volunteer_sha256  text        not null check (volunteer_sha256 ~ '^[0-9a-f]{64}$'),
  actor_sha256      text        check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  event             text        not null,
  from_status       text,
  to_status         text,
  reason            text        not null default '',
  occurred_at       timestamptz not null default now()
);
create index if not exists community_volunteer_events_by_time on public.community_volunteer_events (occurred_at desc);
alter table public.community_volunteer_events enable row level security;
revoke all on table public.community_volunteer_events from anon, authenticated;
grant select on table public.community_volunteer_events to authenticated;
drop policy if exists "reviewers read volunteer events" on public.community_volunteer_events;
create policy "reviewers read volunteer events" on public.community_volunteer_events
  for select to authenticated using (private.has_capability('community:review'));

create or replace function private.volunteer_event(who uuid, want_event text, want_from text, want_to text, want_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.community_volunteer_events (volunteer_sha256, actor_sha256, event, from_status, to_status, reason)
  values (private.role_audit_sha256(who::text),
          case when (select auth.uid()) is null or (select auth.uid()) = who then null
               else private.role_audit_sha256((select auth.uid())::text) end,
          want_event, want_from, want_to, coalesce(want_reason, ''));
$$;
revoke all on function private.volunteer_event(uuid, text, text, text, text) from public, anon, authenticated;

/*
 * Status from answers. Mirrors VOLUNTEER_RULES in app/src/community/volunteer.ts:
 * calibration 20 at 85%, quality window 20 at 5 points each, active at 85,
 * paused below 75. Revoked and paused are sticky; only recalibration moves them.
 */
create or replace function private.volunteer_recompute(who uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.community_volunteers;
  answered integer;
  right_answers integer;
  quality integer;
  next_status text;
begin
  select * into v from public.community_volunteers where user_id = who for update;
  if v.user_id is null or v.status in ('revoked', 'paused') then return v.status; end if;

  if v.status = 'onboarding' then
    select count(*), count(*) filter (where t.correct) into answered, right_answers
      from (select t.correct from public.community_volunteer_tasks t
              join public.community_calibration_items i on i.id = t.item_id
             where t.volunteer_id = who and t.answered_at is not null and i.kind = 'onboarding'
               and t.answered_at >= v.calibration_started_at
             order by t.answered_at desc limit 20) t;
    next_status := case when answered >= 20 and right_answers >= 17 then 'active' else 'onboarding' end;
  else
    select count(*), count(*) filter (where t.correct) into answered, right_answers
      from (select t.correct from public.community_volunteer_tasks t
              join public.community_calibration_items i on i.id = t.item_id
             where t.volunteer_id = who and t.answered_at is not null and i.kind = 'control'
               and t.answered_at >= v.calibration_started_at
             order by t.answered_at desc limit 20) t;
    if answered < 20 then
      next_status := 'active';
    else
      quality := right_answers * 5;
      next_status := case when quality >= 85 then 'active' when quality >= 75 then 'probation' else 'paused' end;
    end if;
  end if;

  if next_status is distinct from v.status then
    update public.community_volunteers set status = next_status where user_id = who;
    perform private.volunteer_event(who, 'status', v.status, next_status, 'calibration');
  end if;
  return next_status;
end $$;
revoke all on function private.volunteer_recompute(uuid) from public, anon, authenticated;

create or replace function public.apply_to_volunteer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  school text := private.school_of();
begin
  if school is null or not private.community_program_on(school, 'volunteer_moderation') then
    raise exception 'volunteer moderation is switched off at this school' using errcode = '42501';
  end if;
  if not private.verified_student() then
    raise exception 'volunteers must be verified students' using errcode = '42501';
  end if;
  if (select u.created_at from auth.users u where u.id = me) > now() - interval '30 days' then
    raise exception 'volunteers need an account at least 30 days old' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_restrictions r
              where r.user_id = me and r.lifted_at is null and r.until > now()) then
    raise exception 'volunteers cannot have an active restriction' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_volunteers v where v.user_id = me) then
    raise exception 'you have already applied' using errcode = '22023';
  end if;
  insert into public.community_volunteers (user_id, tenant_id) values (me, school);
  perform private.volunteer_event(me, 'applied', null, 'onboarding', '');
end $$;
revoke all on function public.apply_to_volunteer() from public, anon, authenticated;
grant execute on function public.apply_to_volunteer() to authenticated;

create or replace function public.volunteer_attest(want_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if want_kind = 'confidentiality' then
    update public.community_volunteers set confidentiality_signed_at = now()
     where user_id = me and status <> 'revoked';
  elsif want_kind = 'recusal' then
    update public.community_volunteers set recusal_acknowledged_at = now()
     where user_id = me and status <> 'revoked';
  else
    raise exception 'unknown attestation' using errcode = '22023';
  end if;
  if not found then raise exception 'you are not a volunteer' using errcode = '42501'; end if;
  perform private.volunteer_event(me, 'attested:' || want_kind, null, null, '');
end $$;
revoke all on function public.volunteer_attest(text) from public, anon, authenticated;
grant execute on function public.volunteer_attest(text) to authenticated;

/*
 * A senior reviewer's levers: record training, revoke with a reason, or send
 * a paused volunteer back to calibration. Each writes an event.
 */
create or replace function public.manage_volunteer(want_volunteer uuid, want_action text, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.community_volunteers;
begin
  if not private.has_capability('community:review_senior') then
    raise exception 'a senior reviewer manages volunteers' using errcode = '42501';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 5 then
    raise exception 'give a reason' using errcode = '22023';
  end if;
  select * into v from public.community_volunteers where user_id = want_volunteer for update;
  if v.user_id is null then raise exception 'no such volunteer' using errcode = '22023'; end if;
  if want_action = 'record_training' then
    update public.community_volunteers set training_completed_at = now() where user_id = v.user_id;
    perform private.volunteer_event(v.user_id, 'training_recorded', v.status, v.status, want_reason);
  elsif want_action = 'revoke' then
    update public.community_volunteers set status = 'revoked', revoked_at = now(), revoked_reason = want_reason
     where user_id = v.user_id;
    delete from public.community_volunteer_tasks where volunteer_id = v.user_id and answered_at is null;
    perform private.volunteer_event(v.user_id, 'revoked', v.status, 'revoked', want_reason);
  elsif want_action = 'recalibrate' then
    if v.status = 'revoked' then raise exception 'a revoked volunteer cannot be recalibrated' using errcode = '22023'; end if;
    update public.community_volunteers set status = 'onboarding', calibration_started_at = now() where user_id = v.user_id;
    -- Whatever was handed out while active — real cases included — is taken back.
    delete from public.community_volunteer_tasks where volunteer_id = v.user_id and answered_at is null;
    perform private.volunteer_event(v.user_id, 'recalibrate', v.status, 'onboarding', want_reason);
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
end $$;
revoke all on function public.manage_volunteer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.manage_volunteer(uuid, text, text) to authenticated;

/* Everything that must hold before a volunteer is handed anything. */
create or replace function private.volunteer_ready(who uuid)
returns public.community_volunteers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.community_volunteers;
  last_hour integer;
  last_day integer;
begin
  select * into v from public.community_volunteers where user_id = who;
  if v.user_id is null then raise exception 'you are not a volunteer' using errcode = '42501'; end if;
  if not private.community_program_on(v.tenant_id, 'volunteer_moderation') then
    raise exception 'volunteer moderation is switched off at this school' using errcode = '42501';
  end if;
  if v.status in ('revoked', 'paused') then
    raise exception 'your volunteer access is paused' using errcode = '42501';
  end if;
  if v.training_completed_at is null or v.confidentiality_signed_at is null or v.recusal_acknowledged_at is null then
    raise exception 'finish training and sign the agreements first' using errcode = '42501';
  end if;
  select count(*) filter (where t.answered_at > now() - interval '1 hour'),
         count(*) filter (where t.answered_at > now() - interval '1 day')
    into last_hour, last_day
    from public.community_volunteer_tasks t where t.volunteer_id = who;
  if last_hour >= 20 or last_day >= 100 then
    raise exception 'you have reached the review limit for now' using errcode = '54000';
  end if;
  return v;
end $$;
revoke all on function private.volunteer_ready(uuid) from public, anon, authenticated;

/* Whether a volunteer must stay away from a case. */
create or replace function private.volunteer_recused(who uuid, want_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_cases k join public.community_posts p on p.id = k.post_id
     where k.id = want_case
       and (p.author_id = who
            -- Support communities are professional-only: even without a name,
            -- what somebody writes there can say who they are.
            or exists (select 1 from public.communities c where c.id = p.community_id and c.kind = 'support')
            or exists (select 1 from public.community_reports r where r.post_id = p.id and r.reporter_id = who)
            or exists (select 1 from public.community_members m
                        where m.community_id = p.community_id and m.user_id = who and m.role <> 'member')
            or exists (select 1 from public.blocks b
                        where (b.user_id = who and b.blocked = p.author_id) or (b.user_id = p.author_id and b.blocked = who)))
  );
$$;
revoke all on function private.volunteer_recused(uuid, uuid) from public, anon, authenticated;

/* Whether a case is one a volunteer may see at all. */
create or replace function private.volunteer_eligible_case(k public.community_cases)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select k.status = 'open' and k.route = 'standard'
     and (k.severity = 'P3' or (k.severity = 'P2' and k.category in ('spam_scam_or_phishing', 'other')));
$$;
revoke all on function private.volunteer_eligible_case(public.community_cases) from public, anon, authenticated;

/*
 * Up to five tasks. Onboarding volunteers get onboarding items; probation gets
 * controls only; active gets real cases with a control mixed in. Every task
 * looks the same: an opaque id, a category, a severity, a community type, the
 * text. Unanswered tasks from an earlier call are handed back first.
 */
create or replace function public.volunteer_next_tasks()
returns table (task_id uuid, category text, severity text, community_kind text, body text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v public.community_volunteers;
begin
  v := private.volunteer_ready(me);
  v.status := private.volunteer_recompute(me);
  -- Returning nothing rather than raising, so the pause just recorded stands.
  if v.status = 'paused' then return; end if;

  if (select count(*) from public.community_volunteer_tasks t
       where t.volunteer_id = me and t.answered_at is null and t.assigned_at > now() - interval '1 hour') = 0 then
    if v.status = 'onboarding' then
      insert into public.community_volunteer_tasks (volunteer_id, item_id)
      select me, i.id from public.community_calibration_items i
       where i.tenant_id = v.tenant_id and i.kind = 'onboarding' and i.retired_at is null
         and not exists (select 1 from public.community_volunteer_tasks t
                          where t.volunteer_id = me and t.item_id = i.id and t.assigned_at >= v.calibration_started_at)
       -- Items never seen before first; a recalibrating volunteer may see old ones again.
       order by exists (select 1 from public.community_volunteer_tasks t where t.volunteer_id = me and t.item_id = i.id), random()
       limit 5;
    else
      insert into public.community_volunteer_tasks (volunteer_id, item_id)
      select me, i.id from public.community_calibration_items i
       where i.tenant_id = v.tenant_id and i.kind = 'control' and i.retired_at is null
       order by (select count(*) from public.community_volunteer_tasks t where t.volunteer_id = me and t.item_id = i.id), random()
       limit case when v.status = 'probation' then 5 else 1 end;
      if v.status = 'active' then
        insert into public.community_volunteer_tasks (volunteer_id, case_id)
        select me, k.id from public.community_cases k
         where k.tenant_id = v.tenant_id and private.volunteer_eligible_case(k)
           and not private.volunteer_recused(me, k.id)
           and not exists (select 1 from public.community_volunteer_tasks t where t.volunteer_id = me and t.case_id = k.id)
         order by k.created_at limit 4;
      end if;
    end if;
  end if;

  return query
    select t.id,
           coalesce(i.category, k.category),
           coalesce(i.severity, k.severity),
           coalesce(i.community_kind, c.kind),
           coalesce(i.body, p.body)
      from public.community_volunteer_tasks t
      left join public.community_calibration_items i on i.id = t.item_id
      left join public.community_cases k on k.id = t.case_id
      left join public.community_posts p on p.id = k.post_id
      left join public.communities c on c.id = p.community_id
     where t.volunteer_id = me and t.answered_at is null and t.assigned_at > now() - interval '1 hour'
     order by md5(t.id::text);
end $$;
revoke all on function public.volunteer_next_tasks() from public, anon, authenticated;
grant execute on function public.volunteer_next_tasks() to authenticated;

create or replace function public.volunteer_decide(want_task uuid, want_action text, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.community_volunteer_tasks;
  i public.community_calibration_items;
  k public.community_cases;
  author uuid;
  agree boolean;
  differ boolean;
begin
  perform private.volunteer_ready(me);
  if want_action not in ('allow', 'label', 'remove', 'close_no_action') then
    raise exception 'volunteers may allow, label, remove or close' using errcode = '42501';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 2 then
    raise exception 'a reason code is required' using errcode = '22023';
  end if;
  select * into t from public.community_volunteer_tasks
   where id = want_task and volunteer_id = me and answered_at is null and assigned_at > now() - interval '1 hour'
   for update;
  if t.id is null then raise exception 'that task is not yours to answer' using errcode = '42501'; end if;

  -- A calibration or control item: right or wrong, and nothing else happens.
  if t.item_id is not null then
    select * into i from public.community_calibration_items where id = t.item_id;
    update public.community_volunteer_tasks
       set answered_at = now(), answer = want_action,
           correct = ((want_action = 'remove') = (i.expected_action = 'remove'))
     where id = t.id;
    perform private.volunteer_recompute(me);
    return;
  end if;

  -- A real case. Everything is checked again: it may have moved since.
  select * into k from public.community_cases where id = t.case_id for update;
  if k.id is null or not private.volunteer_eligible_case(k) or private.volunteer_recused(me, k.id)
     or (select status from public.community_volunteers where user_id = me) <> 'active' then
    update public.community_volunteer_tasks set answered_at = now(), answer = 'withdrawn' where id = t.id;
    raise exception 'this case is no longer yours to decide' using errcode = '42501';
  end if;
  update public.community_volunteer_tasks set answered_at = now(), answer = want_action where id = t.id;
  insert into public.community_volunteer_votes (case_id, volunteer_id, action, reason_code)
  values (k.id, me, want_action, want_reason);
  perform private.community_case_event(k.id, 'volunteer', 'volunteer_vote:' || want_action, want_reason, k.status, k.status);

  select exists (select 1 from public.community_volunteer_votes x
                  where x.case_id = k.id and x.volunteer_id <> me and x.action = 'remove') into agree;
  select exists (select 1 from public.community_volunteer_votes x
                  where x.case_id = k.id and x.volunteer_id <> me
                    and (x.action = 'remove') <> (want_action = 'remove')) into differ;

  if differ then
    -- Volunteers who disagree do not settle it between them: a professional does.
    update public.community_cases set route = 'professional', updated_at = now() where id = k.id;
    perform private.community_case_event(k.id, 'volunteer', 'volunteer_disagreement', want_reason, k.status, k.status);
    return;
  end if;
  if want_action = 'remove' and not agree then
    return;  -- waiting for a second, independent volunteer
  end if;

  select p.author_id into author from public.community_posts p where p.id = k.post_id;
  insert into public.community_decisions (case_id, actor_id, stage, action, reason_code)
  values (k.id, me, 'decision', want_action, want_reason);
  perform private.apply_community_action(k, want_action, author);
  update public.community_signals set human_outcome = want_action || ' (volunteers)'
   where case_id = k.id and human_outcome is null;
  update public.community_cases
     set status = case when want_action in ('allow', 'close_no_action') then 'closed' else 'decided' end,
         retain_until = now() + case when want_action in ('allow', 'close_no_action')
                                     then interval '90 days' else interval '1 year' end,
         updated_at = now()
   where id = k.id;
  perform private.community_case_event(k.id, 'volunteer', 'decided:' || want_action, want_reason, 'open',
    case when want_action in ('allow', 'close_no_action') then 'closed' else 'decided' end);
end $$;
revoke all on function public.volunteer_decide(uuid, text, text) from public, anon, authenticated;
grant execute on function public.volunteer_decide(uuid, text, text) to authenticated;

/* A volunteer's own standing: status, calibration progress, quality, caps. */
create or replace function public.my_volunteer_standing()
returns table (status text, onboarding_answered integer, quality integer, reviews_last_hour integer, reviews_today integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.status,
         (select count(*)::integer from public.community_volunteer_tasks t
            join public.community_calibration_items i on i.id = t.item_id
           where t.volunteer_id = v.user_id and t.answered_at is not null and i.kind = 'onboarding'
             and t.answered_at >= v.calibration_started_at),
         (select case when count(*) < 20 then null else (count(*) filter (where x.correct) * 5)::integer end
            from (select t.correct from public.community_volunteer_tasks t
                    join public.community_calibration_items i on i.id = t.item_id
                   where t.volunteer_id = v.user_id and t.answered_at is not null and i.kind = 'control'
                     and t.answered_at >= v.calibration_started_at
                   order by t.answered_at desc limit 20) x),
         (select count(*)::integer from public.community_volunteer_tasks t
           where t.volunteer_id = v.user_id and t.answered_at > now() - interval '1 hour'),
         (select count(*)::integer from public.community_volunteer_tasks t
           where t.volunteer_id = v.user_id and t.answered_at > now() - interval '1 day')
    from public.community_volunteers v where v.user_id = (select auth.uid());
$$;
revoke all on function public.my_volunteer_standing() from public, anon, authenticated;
grant execute on function public.my_volunteer_standing() to authenticated;

/*
 * The roster, for the senior reviewers who manage the programme. A volunteer
 * is staff-adjacent: who they are is known to the people who train and
 * revoke them, as it is to the volunteer themselves. Progress counts only the
 * current calibration, as volunteer_recompute does.
 */
create or replace function public.volunteer_roster()
returns table (
  user_id uuid, handle text, tenant_id text, status text, applied_at timestamptz,
  training_completed_at timestamptz, confidentiality_signed_at timestamptz, recusal_acknowledged_at timestamptz,
  calibration_started_at timestamptz, revoked_at timestamptz, revoked_reason text,
  onboarding_answered integer, onboarding_right integer, quality integer, reviews_today integer,
  last_answered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability('community:review_senior') then
    raise exception 'a senior reviewer manages volunteers' using errcode = '42501';
  end if;
  return query
  select v.user_id,
         coalesce((select pr.handle from public.profiles pr where pr.user_id = v.user_id), 'Deleted account'),
         v.tenant_id, v.status, v.applied_at, v.training_completed_at, v.confidentiality_signed_at,
         v.recusal_acknowledged_at, v.calibration_started_at, v.revoked_at, v.revoked_reason,
         (select count(*)::integer from public.community_volunteer_tasks t
            join public.community_calibration_items i on i.id = t.item_id
           where t.volunteer_id = v.user_id and i.kind = 'onboarding' and t.answered_at >= v.calibration_started_at),
         (select count(*)::integer from public.community_volunteer_tasks t
            join public.community_calibration_items i on i.id = t.item_id
           where t.volunteer_id = v.user_id and i.kind = 'onboarding' and t.answered_at >= v.calibration_started_at and t.correct),
         (select case when count(*) < 20 then null else (count(*) filter (where x.correct) * 5)::integer end
            from (select t.correct from public.community_volunteer_tasks t
                    join public.community_calibration_items i on i.id = t.item_id
                   where t.volunteer_id = v.user_id and i.kind = 'control' and t.answered_at >= v.calibration_started_at
                   order by t.answered_at desc limit 20) x),
         (select count(*)::integer from public.community_volunteer_tasks t
           where t.volunteer_id = v.user_id and t.answered_at > now() - interval '1 day'),
         (select max(t.answered_at) from public.community_volunteer_tasks t where t.volunteer_id = v.user_id)
    from public.community_volunteers v
   order by v.tenant_id, v.status, v.applied_at;
end $$;
revoke all on function public.volunteer_roster() from public, anon, authenticated;
grant execute on function public.volunteer_roster() to authenticated;

-- ── 14. Institution escalation ────────────────────────────────────────────
--
-- The most consequential thing Community can do, so the hardest to do. It is
-- off unless all of these hold, and every function asks again each time:
--
--   * the school's community_programs row for institution_escalation is on;
--   * the school has an escalation policy that is enabled, names a signed
--     agreement and a delivery channel, and lists the categories it covers —
--     a row the service role, or two agreement staff through section 14a, writes;
--   * the case is P0 or P1, in a covered category, with no escalation already
--     requested or approved;
--   * one professional asks, with a written reason, and a *different* one
--     approves, with a reason of their own — compared by hash, so no account
--     id is stored to compare.
--
-- What leaves is built here, not supplied: case id, school, category,
-- severity, a summary of at most 500 characters, when, and the agreement.
-- Identity is included only when the agreement requires it, and then only as
-- an opaque reference the service role can resolve against the case — never
-- a name, an email or an account id. Approval queues one delivery for the
-- service role's adapter to send. There is no dashboard, no standing feed and
-- no way for a university account to read any of this.

create table if not exists public.community_escalation_policies (
  tenant_id         text        primary key references public.schools(id) on delete cascade,
  enabled           boolean     not null default false,
  agreement_ref     text        not null default '' check (length(agreement_ref) <= 200),
  categories        text[]      not null default '{}',
  identity_required boolean     not null default false,
  channel           text        not null default '' check (length(channel) <= 200),
  updated_at        timestamptz not null default now(),
  -- Written through the admin screen (section 14a): who the school's side is,
  -- as an office rather than a person; when the agreement ends; and the two
  -- different people who drafted and activated it, by hash.
  contact             text      not null default '' check (length(contact) <= 200),
  expires_on          date,
  drafted_by_sha256   text      check (drafted_by_sha256 is null or drafted_by_sha256 ~ '^[0-9a-f]{64}$'),
  drafted_at          timestamptz,
  activated_by_sha256 text      check (activated_by_sha256 is null or activated_by_sha256 ~ '^[0-9a-f]{64}$'),
  activated_at        timestamptz
);
alter table public.community_escalation_policies enable row level security;
revoke all on table public.community_escalation_policies from anon, authenticated;
grant select on table public.community_escalation_policies to authenticated;
drop policy if exists "reviewers read escalation policies" on public.community_escalation_policies;
create policy "reviewers read escalation policies" on public.community_escalation_policies
  for select to authenticated
  using (private.has_capability('community:review') or private.has_capability('community:escalation_agreements'));

create table if not exists public.community_escalations (
  id                  uuid        primary key default gen_random_uuid(),
  case_id             uuid        not null references public.community_cases(id) on delete cascade,
  tenant_id           text        not null references public.schools(id) on delete cascade,
  status              text        not null default 'requested' check (status in ('requested', 'approved', 'refused')),
  requested_by_sha256 text        not null check (requested_by_sha256 ~ '^[0-9a-f]{64}$'),
  requested_reason    text        not null check (length(trim(requested_reason)) between 10 and 500),
  requested_at        timestamptz not null default now(),
  decided_by_sha256   text        check (decided_by_sha256 is null or decided_by_sha256 ~ '^[0-9a-f]{64}$'),
  decided_reason      text        check (decided_reason is null or length(trim(decided_reason)) between 10 and 500),
  decided_at          timestamptz,
  payload             jsonb
);
create unique index if not exists community_escalations_one_live_per_case
  on public.community_escalations (case_id) where status in ('requested', 'approved');
create index if not exists community_escalations_by_case on public.community_escalations (case_id);
create index if not exists community_escalations_by_tenant on public.community_escalations (tenant_id, status);
alter table public.community_escalations enable row level security;
revoke all on table public.community_escalations from anon, authenticated;
grant select on table public.community_escalations to authenticated;
drop policy if exists "reviewers read escalations" on public.community_escalations;
create policy "reviewers read escalations" on public.community_escalations
  for select to authenticated using (private.has_capability('community:review'));

create table if not exists public.community_escalation_deliveries (
  id            uuid        primary key default gen_random_uuid(),
  escalation_id uuid        not null references public.community_escalations(id) on delete cascade,
  channel       text        not null,
  payload       jsonb       not null,
  queued_at     timestamptz not null default now(),
  attempts      integer     not null default 0,
  delivered_at  timestamptz,
  -- The adapter (supabase/functions/_shared/escalation.ts) claims a row for a
  -- few minutes so two overlapping runs cannot both send it, and backs off
  -- after a failure. last_error is one of the adapter's fixed codes — a status,
  -- never anything the receiver said.
  next_attempt_at timestamptz not null default now(),
  claimed_until   timestamptz,
  last_error      text        check (last_error is null or last_error ~ '^[a-z0-9_]{1,40}$')
);
create index if not exists community_escalation_deliveries_by_escalation on public.community_escalation_deliveries (escalation_id);
create index if not exists community_escalation_deliveries_pending on public.community_escalation_deliveries (delivered_at, queued_at);
alter table public.community_escalation_deliveries enable row level security;
revoke all on table public.community_escalation_deliveries from anon, authenticated;
grant select (id, escalation_id, queued_at, attempts, delivered_at, next_attempt_at, last_error)
  on table public.community_escalation_deliveries to authenticated;
drop policy if exists "reviewers see delivery state" on public.community_escalation_deliveries;
create policy "reviewers see delivery state" on public.community_escalation_deliveries
  for select to authenticated using (private.has_capability('community:review'));

/* Everything that must hold for this case to be escalated at all. */
create or replace function private.escalation_allowed(k public.community_cases)
returns public.community_escalation_policies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pol public.community_escalation_policies;
begin
  if not private.community_program_on(k.tenant_id, 'institution_escalation') then
    raise exception 'institution escalation is switched off at this school' using errcode = '42501';
  end if;
  select * into pol from public.community_escalation_policies where tenant_id = k.tenant_id;
  if pol.tenant_id is null or not pol.enabled or pol.agreement_ref = '' or pol.channel = ''
     or pol.expires_on < current_date then
    raise exception 'this school has no escalation agreement in force' using errcode = '42501';
  end if;
  if k.severity not in ('P0', 'P1') then
    raise exception 'only P0 and P1 cases can be escalated' using errcode = '22023';
  end if;
  if not (k.category = any (pol.categories)) then
    raise exception 'the agreement does not cover this category' using errcode = '22023';
  end if;
  return pol;
end $$;
revoke all on function private.escalation_allowed(public.community_cases) from public, anon, authenticated;

create or replace function public.request_community_escalation(want_case uuid, want_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  eid uuid;
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers escalate' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = want_case;
  if k.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  perform private.escalation_allowed(k);
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write the reason out' using errcode = '22023';
  end if;
  if exists (select 1 from public.community_escalations e
              where e.case_id = k.id and e.status in ('requested', 'approved')) then
    raise exception 'this case has already been escalated once' using errcode = '22023';
  end if;
  insert into public.community_escalations (case_id, tenant_id, requested_by_sha256, requested_reason)
  values (k.id, k.tenant_id, private.role_audit_sha256((select auth.uid())::text), left(trim(want_reason), 500))
  returning id into eid;
  perform private.community_case_event(k.id,
    case when private.has_capability('community:review_senior') then 'senior_reviewer' else 'reviewer' end,
    'escalation_requested', 'escalation', k.status, k.status);
  return eid;
end $$;
revoke all on function public.request_community_escalation(uuid, text) from public, anon, authenticated;
grant execute on function public.request_community_escalation(uuid, text) to authenticated;

create or replace function public.decide_community_escalation(want_escalation uuid, want_approve boolean, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.community_escalations;
  k public.community_cases;
  pol public.community_escalation_policies;
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  author uuid;
  body jsonb;
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers approve escalations' using errcode = '42501';
  end if;
  select * into e from public.community_escalations where id = want_escalation for update;
  if e.id is null or e.status <> 'requested' then
    raise exception 'no escalation is waiting for a decision' using errcode = '22023';
  end if;
  if e.requested_by_sha256 = me_hash then
    raise exception 'a second, different reviewer must approve' using errcode = '42501';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write the reason out' using errcode = '22023';
  end if;
  select * into k from public.community_cases where id = e.case_id;

  if not coalesce(want_approve, false) then
    update public.community_escalations
       set status = 'refused', decided_by_sha256 = me_hash, decided_reason = left(trim(want_reason), 500), decided_at = now()
     where id = e.id;
    perform private.community_case_event(k.id, 'reviewer', 'escalation_refused', 'escalation', k.status, k.status);
    return;
  end if;

  -- Asked again: the switch, the agreement or the case may have changed.
  pol := private.escalation_allowed(k);

  -- The payload is an allowlist, assembled here.
  body := jsonb_build_object(
    'case_id', k.id,
    'tenant_id', k.tenant_id,
    'category', k.category,
    'severity', k.severity,
    'summary', left(e.requested_reason, 500),
    'occurred_at', now(),
    'agreement_ref', pol.agreement_ref);
  if pol.identity_required then
    select p.author_id into author from public.community_posts p where p.id = k.post_id;
    body := body || jsonb_build_object('subject_ref',
      private.role_audit_sha256('escalation:' || e.id::text || ':' || coalesce(author::text, '')));
  end if;

  update public.community_escalations
     set status = 'approved', decided_by_sha256 = me_hash, decided_reason = left(trim(want_reason), 500),
         decided_at = now(), payload = body
   where id = e.id;
  insert into public.community_escalation_deliveries (escalation_id, channel, payload)
  values (e.id, pol.channel, body);
  perform private.community_case_event(k.id, 'reviewer', 'escalation_approved', 'escalation', k.status, k.status);
end $$;
revoke all on function public.decide_community_escalation(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.decide_community_escalation(uuid, boolean, text) to authenticated;

/*
 * For the delivery adapter only: claim what is due, oldest first.
 *
 * A row is due when it is unsent, has attempts left, its backoff has passed and
 * nobody holds a live claim on it. It is held — not taken, and not charged an
 * attempt — while the school's switch is off, its agreement is disabled, or the
 * agreement now names a different channel than the one approved: a change of
 * agreement after approval is a reason for a person to look, not for the
 * adapter to guess. skip locked, so a second run in flight takes other rows.
 */
create or replace function public.take_escalation_deliveries()
returns setof public.community_escalation_deliveries
language sql
security definer
set search_path = ''
as $$
  update public.community_escalation_deliveries d
     set attempts = d.attempts + 1, claimed_until = now() + interval '5 minutes'
   where d.id in (
     select x.id
       from public.community_escalation_deliveries x
       join public.community_escalations e on e.id = x.escalation_id
       join public.community_escalation_policies pol on pol.tenant_id = e.tenant_id
      where x.delivered_at is null and x.attempts < 5
        and x.next_attempt_at <= now()
        and (x.claimed_until is null or x.claimed_until < now())
        and e.status = 'approved'
        and pol.enabled and pol.channel = x.channel
        and (pol.expires_on is null or pol.expires_on >= current_date)
        and private.community_program_on(e.tenant_id, 'institution_escalation')
      order by x.queued_at
      limit 20
      for update of x skip locked)
  returning d.*;
$$;
revoke all on function public.take_escalation_deliveries() from public, anon, authenticated;
grant execute on function public.take_escalation_deliveries() to service_role;

create or replace function public.mark_escalation_delivered(want_delivery uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.community_escalation_deliveries
     set delivered_at = now(), claimed_until = null, last_error = null
   where id = want_delivery and delivered_at is null;
$$;
revoke all on function public.mark_escalation_delivered(uuid) from public, anon, authenticated;
grant execute on function public.mark_escalation_delivered(uuid) to service_role;

/*
 * A failed send: release the claim and back off — 4, 16, 64, then 256
 * minutes. A final failure (a payload the adapter refused, a channel nobody
 * configured) spends the remaining attempts, so the console shows it failed
 * rather than retrying something that cannot succeed.
 */
create or replace function public.mark_escalation_failed(want_delivery uuid, want_error text, want_final boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.community_escalation_deliveries
     set claimed_until = null,
         last_error = case when want_error ~ '^[a-z0-9_]{1,40}$' then want_error else 'unknown' end,
         attempts = case when want_final then 5 else attempts end,
         next_attempt_at = now() + interval '1 minute' * power(4, greatest(attempts, 1))
   where id = want_delivery and delivered_at is null;
$$;
revoke all on function public.mark_escalation_failed(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.mark_escalation_failed(uuid, text, boolean) to service_role;

-- ── 14a. Escalation agreements, recorded by people ────────────────────────
--
-- The agreement row was service-role only. It is now also written here, by a
-- holder of community:escalation_agreements (senior Trust & Safety staff at
-- platform scope — never anybody at the school the agreement is with), under
-- the same two-person rule as an escalation:
--
--   * one person records or edits a draft; any edit, to anything, leaves the
--     agreement inactive, so what was activated is always what a second
--     person read;
--   * a different person activates it, with a reason, before it has ended;
--   * anybody holding the capability can retire it, alone — off is always safe;
--   * every change is an event, attributed by hash.
--
-- The channel must be a name the delivery adapter knows how to resolve
-- (webhook:<name>); the address behind it stays in the function's secrets.
-- The school's own community_programs switch is still a service-role step:
-- an active agreement with the switch off sends nothing.

create table if not exists public.community_escalation_agreement_events (
  id           bigint      generated always as identity primary key,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  event        text        not null check (event in ('drafted', 'activated', 'retired')),
  actor_sha256 text        not null check (actor_sha256 ~ '^[0-9a-f]{64}$'),
  reason       text        not null default '' check (length(reason) <= 500),
  agreement_ref text       not null default '',
  occurred_at  timestamptz not null default now()
);
create index if not exists community_escalation_agreement_events_by_tenant
  on public.community_escalation_agreement_events (tenant_id, occurred_at desc);
alter table public.community_escalation_agreement_events enable row level security;
revoke all on table public.community_escalation_agreement_events from anon, authenticated;
grant select on table public.community_escalation_agreement_events to authenticated;
drop policy if exists "agreement staff read agreement history" on public.community_escalation_agreement_events;
create policy "agreement staff read agreement history" on public.community_escalation_agreement_events
  for select to authenticated using (private.has_capability('community:escalation_agreements'));

create or replace function public.can_manage_escalation_agreements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.has_capability('community:escalation_agreements'); $$;
revoke all on function public.can_manage_escalation_agreements() from public, anon, authenticated;
grant execute on function public.can_manage_escalation_agreements() to authenticated;

create or replace function public.save_escalation_agreement(
  want_tenant text, want_agreement_ref text, want_categories text[], want_identity_required boolean,
  want_channel text, want_contact text, want_expires_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  bad text;
begin
  if not private.has_capability('community:escalation_agreements') then
    raise exception 'only Trust & Safety agreement staff record agreements' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = want_tenant) then
    raise exception 'no such school' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_agreement_ref)), 0) < 3 or length(want_agreement_ref) > 200 then
    raise exception 'name the signed agreement (3–200 characters)' using errcode = '22023';
  end if;
  if coalesce(want_channel, '') !~ '^webhook:[a-z0-9_]{1,40}$' then
    raise exception 'the channel must be webhook:<name>, lowercase letters, digits and underscores' using errcode = '22023';
  end if;
  if coalesce(cardinality(want_categories), 0) = 0 then
    raise exception 'an agreement covers at least one category' using errcode = '22023';
  end if;
  select c into bad from unnest(want_categories) c
   where c not in ('harassment_or_bullying', 'threat_or_safety_concern', 'hate_or_discrimination',
                   'private_information_or_doxxing', 'impersonation', 'nonconsensual_media',
                   'spam_scam_or_phishing', 'academic_integrity', 'other')
   limit 1;
  if bad is not null then raise exception 'unknown category %', bad using errcode = '22023'; end if;
  if want_expires_on is null or want_expires_on <= current_date or want_expires_on > current_date + 1096 then
    raise exception 'an agreement ends between tomorrow and three years from now' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_contact)), 0) < 3 or length(want_contact) > 200 then
    raise exception 'name the office at the school that receives escalations' using errcode = '22023';
  end if;

  insert into public.community_escalation_policies
    (tenant_id, enabled, agreement_ref, categories, identity_required, channel, contact, expires_on,
     drafted_by_sha256, drafted_at, activated_by_sha256, activated_at, updated_at)
  values (want_tenant, false, trim(want_agreement_ref), (select array_agg(distinct c order by c) from unnest(want_categories) c),
          coalesce(want_identity_required, false), want_channel, trim(want_contact), want_expires_on,
          me_hash, now(), null, null, now())
  on conflict (tenant_id) do update
     set enabled = false, agreement_ref = excluded.agreement_ref, categories = excluded.categories,
         identity_required = excluded.identity_required, channel = excluded.channel, contact = excluded.contact,
         expires_on = excluded.expires_on, drafted_by_sha256 = excluded.drafted_by_sha256, drafted_at = now(),
         activated_by_sha256 = null, activated_at = null, updated_at = now();
  insert into public.community_escalation_agreement_events (tenant_id, event, actor_sha256, agreement_ref)
  values (want_tenant, 'drafted', me_hash, trim(want_agreement_ref));
end $$;
revoke all on function public.save_escalation_agreement(text, text, text[], boolean, text, text, date) from public, anon, authenticated;
grant execute on function public.save_escalation_agreement(text, text, text[], boolean, text, text, date) to authenticated;

create or replace function public.activate_escalation_agreement(want_tenant text, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  pol public.community_escalation_policies;
begin
  if not private.has_capability('community:escalation_agreements') then
    raise exception 'only Trust & Safety agreement staff activate agreements' using errcode = '42501';
  end if;
  select * into pol from public.community_escalation_policies where tenant_id = want_tenant for update;
  if pol.tenant_id is null or pol.enabled then
    raise exception 'there is no draft agreement to activate' using errcode = '22023';
  end if;
  if pol.drafted_by_sha256 is null or pol.drafted_by_sha256 = me_hash then
    raise exception 'a second, different person must activate it' using errcode = '42501';
  end if;
  if pol.expires_on is null or pol.expires_on <= current_date then
    raise exception 'this agreement has ended; record a new one' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write down what you checked' using errcode = '22023';
  end if;
  update public.community_escalation_policies
     set enabled = true, activated_by_sha256 = me_hash, activated_at = now(), updated_at = now()
   where tenant_id = want_tenant;
  insert into public.community_escalation_agreement_events (tenant_id, event, actor_sha256, reason, agreement_ref)
  values (want_tenant, 'activated', me_hash, left(trim(want_reason), 500), pol.agreement_ref);
end $$;
revoke all on function public.activate_escalation_agreement(text, text) from public, anon, authenticated;
grant execute on function public.activate_escalation_agreement(text, text) to authenticated;

create or replace function public.retire_escalation_agreement(want_tenant text, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_hash text := private.role_audit_sha256((select auth.uid())::text);
  pol public.community_escalation_policies;
begin
  if not private.has_capability('community:escalation_agreements') then
    raise exception 'only Trust & Safety agreement staff retire agreements' using errcode = '42501';
  end if;
  select * into pol from public.community_escalation_policies where tenant_id = want_tenant for update;
  if pol.tenant_id is null or not pol.enabled then
    raise exception 'there is no active agreement to retire' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write down why' using errcode = '22023';
  end if;
  update public.community_escalation_policies set enabled = false, updated_at = now() where tenant_id = want_tenant;
  insert into public.community_escalation_agreement_events (tenant_id, event, actor_sha256, reason, agreement_ref)
  values (want_tenant, 'retired', me_hash, left(trim(want_reason), 500), pol.agreement_ref);
end $$;
revoke all on function public.retire_escalation_agreement(text, text) from public, anon, authenticated;
grant execute on function public.retire_escalation_agreement(text, text) to authenticated;

-- ── 15. The private account safety state ──────────────────────────────────
--
-- Not karma. A running 0–100 for Trust & Safety, off unless the school's
-- community_programs row for account_safety_state is on, and:
--
--   * written only by a professional's decision that found a violation — never
--     by triage, a detector, a report count or a volunteer — at the case's
--     severity: P0 −40, P1 −20, P2 −8, P3 nothing (SEVERITY_DELTA in
--     safety-state.ts, held to these numbers by programs.test.ts);
--   * reversed when an appeal is granted, the entry kept and marked;
--   * forgotten after a year by the retention sweep, so it recovers;
--   * granted to nobody through the API. A reviewer reads the number for a
--     case's author through a function that needs a written reason and writes
--     a case event; the student gets a sentence, never the number; everybody
--     else gets nothing.
--
-- Nothing reads it for ranking, search, academics, aid, admissions, housing,
-- work or advising — there is no other function that touches the table.

create table if not exists public.community_safety_entries (
  id           bigint      generated always as identity primary key,
  user_id      uuid        not null references auth.users on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  case_id      uuid        not null,
  severity     text        not null check (severity in ('P0', 'P1', 'P2')),
  delta        integer     not null check (delta < 0),
  reason_code  text        not null,
  actor_sha256 text        not null check (actor_sha256 ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  reversed_at  timestamptz
);
create index if not exists community_safety_entries_by_user on public.community_safety_entries (user_id, created_at);
create index if not exists community_safety_entries_by_case on public.community_safety_entries (case_id);
create index if not exists community_safety_entries_by_tenant on public.community_safety_entries (tenant_id);
alter table public.community_safety_entries enable row level security;
revoke all on table public.community_safety_entries from anon, authenticated;

/* Called from the professional decision path only. */
create or replace function private.record_safety_outcome(k public.community_cases, want_action text, want_reason text, author uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if author is null or not private.community_program_on(k.tenant_id, 'account_safety_state') then return; end if;
  if want_action in ('allow', 'close_no_action', 'preserve_evidence') then return; end if;
  if k.severity = 'P3' then return; end if;
  insert into public.community_safety_entries (user_id, tenant_id, case_id, severity, delta, reason_code, actor_sha256)
  values (author, k.tenant_id, k.id, k.severity,
          case k.severity when 'P0' then -40 when 'P1' then -20 else -8 end,
          want_reason, private.role_audit_sha256((select auth.uid())::text));
end $$;
revoke all on function private.record_safety_outcome(public.community_cases, text, text, uuid) from public, anon, authenticated;

create or replace function private.safety_value(who uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, least(100, 100 + coalesce(sum(e.delta), 0)))::integer
    from public.community_safety_entries e
   where e.user_id = who and e.reversed_at is null and e.created_at > now() - interval '1 year';
$$;
revoke all on function private.safety_value(uuid) from public, anon, authenticated;

/* A reviewer's read of a case author's state: a reason, and a case event, every time. */
create or replace function public.case_author_safety(want_case uuid, want_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  author uuid;
begin
  if not private.has_capability('community:review') then
    raise exception 'only Trust & Safety reviewers read safety state' using errcode = '42501';
  end if;
  select * into k from public.community_cases where id = want_case;
  if k.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  if not private.community_program_on(k.tenant_id, 'account_safety_state') then
    raise exception 'safety state is switched off at this school' using errcode = '42501';
  end if;
  if coalesce(length(trim(want_reason)), 0) < 10 then
    raise exception 'write down why you need it' using errcode = '22023';
  end if;
  select p.author_id into author from public.community_posts p where p.id = k.post_id;
  perform private.community_case_event(k.id,
    case when private.has_capability('community:review_senior') then 'senior_reviewer' else 'reviewer' end,
    'safety_state_read', left(trim(want_reason), 80), k.status, k.status);
  return private.safety_value(author);
end $$;
revoke all on function public.case_author_safety(uuid, text) from public, anon, authenticated;
grant execute on function public.case_author_safety(uuid, text) to authenticated;

/* What a student is told about their own standing: words, never the number. */
create or replace function public.my_community_standing()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.community_safety_entries e
                  where e.user_id = (select auth.uid()) and e.reversed_at is null
                    and e.created_at > now() - interval '1 year')
      then 'A past decision still affects your Community account. You can see each decision about your posts, and appeal eligible ones.'
    else 'Your Community account is in good standing.'
  end;
$$;
revoke all on function public.my_community_standing() from public, anon, authenticated;
grant execute on function public.my_community_standing() to authenticated;

-- ── 16. Images, held until scanned ────────────────────────────────────────
--
-- Community image posts, off twice: the VITE_COMMUNITY_IMAGES build flag and
-- the school's community_programs row for image_posts. When both are on:
--
--   1. begin_community_image reserves a media row (awaiting_upload) and names
--      the only storage path the author may upload to: media/<random id>. No
--      account id is in the path.
--   2. The author uploads the image there — stripped of EXIF/GPS on their own
--      device first (app/src/community/metadata.ts) — and posts with it. The
--      post is pending, visible only to its author.
--   3. The scanner (supabase/functions/_shared/mediascan.ts, service role, not
--      yet deployed) reads the bytes and reports facts to record_media_scan:
--      the real type, whether metadata survived, size, dimensions, SHA-256, a
--      perceptual hash, a known-abuse hash check and, if a school has one, a
--      classifier's label.
--   4. This file decides. Nothing clears without a known-abuse check; a match
--      is held, never shown to anybody — reviewers included — and opens a P0
--      case. A mismatched type, leftover metadata or an oversize image is
--      rejected. An image close to one a reviewer removed (Hamming distance
--      of 8 or less on the perceptual hash, or the same SHA-256) is held for
--      review. Otherwise it clears and the post publishes.
--
-- Not in support communities, and never under an alias: a photograph can say
-- who took it far more reliably than a name can hide it.

create table if not exists public.community_media (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.schools(id) on delete cascade,
  community_id       uuid        not null references public.communities(id) on delete cascade,
  -- Both set null rather than cascade, so a known-abuse match outlives the
  -- account and the post it came with; everything else is swept once its post
  -- is gone (sweep_community_retention).
  uploader_id        uuid        references auth.users on delete set null,
  post_id            uuid        references public.community_posts(id) on delete set null,
  object_path        text        generated always as ('media/' || id::text) stored,
  declared_kind      text        not null check (declared_kind in ('jpeg', 'png', 'webp')),
  -- What the picture shows, for anybody using a screen reader. Required.
  alt_text           text        not null check (length(trim(alt_text)) between 1 and 300),
  status             text        not null default 'awaiting_upload'
                       check (status in ('awaiting_upload', 'pending', 'clear', 'held', 'rejected', 'removed')),
  reason_code        text        not null default '',
  detected_kind      text,
  bytes              integer,
  width              integer,
  height             integer,
  sha256             text        check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  phash              bigint,
  known_abuse_match  boolean     not null default false,
  scan_version       text,
  scanned_at         timestamptz,
  claimed_until      timestamptz,
  attempts           integer     not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists community_media_by_post on public.community_media (post_id);
create index if not exists community_media_by_uploader on public.community_media (uploader_id, created_at);
create index if not exists community_media_by_community on public.community_media (community_id);
create index if not exists community_media_by_tenant on public.community_media (tenant_id, status);
alter table public.community_media enable row level security;
revoke all on table public.community_media from anon, authenticated;
-- Never the uploader, the hashes or the scan's working columns.
grant select (id, post_id, community_id, object_path, declared_kind, alt_text, status, reason_code, width, height,
              known_abuse_match, created_at)
  on table public.community_media to authenticated;
drop policy if exists "who may see an image's row" on public.community_media;
create policy "who may see an image's row" on public.community_media
  for select to authenticated
  using (
    uploader_id = (select auth.uid())
    or private.has_capability('community:review')
    or (status = 'clear' and exists (select 1 from public.community_posts p where p.id = post_id))
  );

-- Images a reviewer removed, so the same picture cannot simply be posted again.
create table if not exists public.community_media_blocklist (
  id               bigint      generated always as identity primary key,
  tenant_id        text        not null references public.schools(id) on delete cascade,
  phash            bigint      not null,
  sha256           text        not null check (sha256 ~ '^[0-9a-f]{64}$'),
  category         text        not null,
  source_media_id  uuid        references public.community_media(id) on delete set null,
  added_by_sha256  text        not null check (added_by_sha256 ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz not null default now()
);
create index if not exists community_media_blocklist_by_tenant on public.community_media_blocklist (tenant_id);
create index if not exists community_media_blocklist_by_source on public.community_media_blocklist (source_media_id);
alter table public.community_media_blocklist enable row level security;
revoke all on table public.community_media_blocklist from anon, authenticated;
grant select (id, tenant_id, category, source_media_id, created_at) on table public.community_media_blocklist to authenticated;
drop policy if exists "reviewers see the blocklist" on public.community_media_blocklist;
create policy "reviewers see the blocklist" on public.community_media_blocklist
  for select to authenticated using (private.has_capability('community:review'));

-- Storage objects to delete through the Storage API (deleting the row alone
-- would orphan the file). Known-abuse matches are never queued: what happens
-- to them is the legal runbook's decision, not a sweep's.
create table if not exists public.community_media_deletions (
  object_path text        primary key,
  queued_at   timestamptz not null default now(),
  reason      text        not null
);
alter table public.community_media_deletions enable row level security;
revoke all on table public.community_media_deletions from anon, authenticated;

create or replace function private.queue_media_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if (not old.known_abuse_match and old.status <> 'awaiting_upload')
       or (old.status = 'awaiting_upload' and private.media_uploaded(old.object_path)) then
      insert into public.community_media_deletions (object_path, reason)
      values (old.object_path, 'row removed') on conflict do nothing;
    end if;
    return old;
  end if;
  if new.status = 'rejected' and old.status is distinct from 'rejected' and not new.known_abuse_match then
    insert into public.community_media_deletions (object_path, reason)
    values (new.object_path, 'rejected: ' || new.reason_code) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.queue_media_deletion() from public, anon, authenticated;
drop trigger if exists community_media_queue_deletion on public.community_media;
create trigger community_media_queue_deletion
  after update of status or delete on public.community_media
  for each row execute function private.queue_media_deletion();

/* Whether the file for a media row is in the bucket. False where Storage is absent. */
create or replace function private.media_uploaded(want_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('storage.objects') is null then return false; end if;
  return exists (select 1 from storage.objects o where o.bucket_id = 'community-media' and o.name = want_path);
end $$;
revoke all on function private.media_uploaded(text) from public, anon, authenticated;

/* The storage rules, as functions the policies call. */
create or replace function private.media_upload_allowed(want_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.community_media m
                  where m.object_path = want_path and m.uploader_id = (select auth.uid())
                    and m.status = 'awaiting_upload');
$$;
revoke all on function private.media_upload_allowed(text) from public, anon;
grant execute on function private.media_upload_allowed(text) to authenticated;

create or replace function private.media_read_allowed(want_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_media m
      left join public.community_posts p on p.id = m.post_id
     where m.object_path = want_path
       and not m.known_abuse_match
       and (
         m.uploader_id = (select auth.uid())
         or private.has_capability('community:review')
         or (m.status = 'clear' and p.status in ('published', 'reduced')
             and private.community_role(p.community_id) is not null
             and not private.blocked_either_way(p.author_id))
       ));
$$;
revoke all on function private.media_read_allowed(text) from public, anon;
grant execute on function private.media_read_allowed(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('community-media', 'community-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    drop policy if exists "community media: upload the image you reserved" on storage.objects;
    create policy "community media: upload the image you reserved" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'community-media' and private.media_upload_allowed(name));
    drop policy if exists "community media: read what you may see" on storage.objects;
    create policy "community media: read what you may see" on storage.objects
      for select to authenticated
      using (bucket_id = 'community-media' and private.media_read_allowed(name));
    -- No update or delete policy: an image cannot be swapped after it is scanned.
  end if;
end $$;

create or replace function public.begin_community_image(want_community uuid, want_kind text, want_alt text)
returns table (media_id uuid, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.communities;
  mid uuid;
begin
  select * into c from public.communities where id = want_community;
  if c.id is null or private.community_role(c.id) is null then
    raise exception 'join the community to post' using errcode = '42501';
  end if;
  if not private.community_program_on(c.tenant_id, 'image_posts') then
    raise exception 'images are switched off at this school' using errcode = '42501';
  end if;
  if c.kind = 'support' then
    raise exception 'images are not posted in support communities' using errcode = '22023';
  end if;
  if private.community_restricted(me, c.id) then
    raise exception 'you cannot post here right now' using errcode = '42501';
  end if;
  if want_kind not in ('jpeg', 'png', 'webp') then
    raise exception 'JPEG, PNG or WebP only' using errcode = '22023';
  end if;
  if coalesce(length(trim(want_alt)), 0) not between 1 and 300 then
    raise exception 'describe the image in a sentence, for people using a screen reader' using errcode = '22023';
  end if;
  if (select count(*) from public.community_media m
       where m.uploader_id = me and m.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'image limit reached for now' using errcode = '54000';
  end if;
  insert into public.community_media (tenant_id, community_id, uploader_id, declared_kind, alt_text)
  values (c.tenant_id, c.id, me, want_kind, trim(want_alt))
  returning id into mid;
  return query select mid, 'media/' || mid::text;
end $$;
revoke all on function public.begin_community_image(uuid, text, text) from public, anon, authenticated;
grant execute on function public.begin_community_image(uuid, text, text) to authenticated;

/* A case, a signal and a hold for an image, the way the text detectors make them. */
create or replace function private.media_case(
  m public.community_media, want_category text, want_severity text, want_rule text, want_confidence numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  rank_of text[] := array['P0', 'P1', 'P2', 'P3'];
begin
  select * into k from public.community_cases where post_id = m.post_id and status <> 'closed';
  if k.id is null then
    insert into public.community_cases (tenant_id, post_id, category, severity, route)
    values (m.tenant_id, m.post_id, want_category, want_severity, private.community_route(want_severity))
    returning * into k;
    perform private.community_case_event(k.id, 'triage', 'case_opened', 'detector:' || want_rule, 'open', 'open');
  elsif array_position(rank_of, want_severity) < array_position(rank_of, k.severity) then
    update public.community_cases
       set severity = want_severity, category = want_category, route = private.community_route(want_severity),
           updated_at = now()
     where id = k.id returning * into k;
  end if;
  insert into public.community_signals (case_id, post_id, detector, rule_id, confidence, version, route)
  values (k.id, m.post_id, 'media_safety', want_rule, want_confidence, coalesce(m.scan_version, 'media-scan'), k.route);
  update public.community_cases set protection = 'temporary_hold', updated_at = now() where id = k.id;
  update public.community_posts set status = 'held' where id = m.post_id and status in ('pending', 'published', 'reduced');
  perform private.community_case_event(k.id, 'triage', 'protection:temporary_hold', 'detector:' || want_rule, k.status, k.status);
end $$;
revoke all on function private.media_case(public.community_media, text, text, text, numeric) from public, anon, authenticated;

/* For the scanner only: claim what is waiting, at schools that still allow images. */
create or replace function public.take_media_scans()
returns table (media_id uuid, object_path text, declared_kind text, tenant_id text)
language sql
security definer
set search_path = ''
as $$
  update public.community_media m
     set attempts = m.attempts + 1, claimed_until = now() + interval '5 minutes'
   where m.id in (
     select x.id from public.community_media x
      where x.status = 'pending' and x.attempts < 5
        and (x.claimed_until is null or x.claimed_until < now())
        and private.community_program_on(x.tenant_id, 'image_posts')
      order by x.created_at
      limit 10
      for update of x skip locked)
  returning m.id, m.object_path, m.declared_kind, m.tenant_id;
$$;
revoke all on function public.take_media_scans() from public, anon, authenticated;
grant execute on function public.take_media_scans() to service_role;

/*
 * The scanner's facts, and the decision. The verdict is:
 *   { detected_kind, bytes, width, height, sha256, phash (16 hex digits),
 *     metadata_found, known_abuse: 'clear' | 'match', classifier: null |
 *     { label, confidence }, scan_version }
 * Returns what became of the image: clear, held or rejected.
 */
create or replace function public.record_media_scan(want_media uuid, want_verdict jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.community_media;
  v_kind text := want_verdict->>'detected_kind';
  v_bytes integer := (want_verdict->>'bytes')::integer;
  v_width integer := (want_verdict->>'width')::integer;
  v_height integer := (want_verdict->>'height')::integer;
  v_sha text := want_verdict->>'sha256';
  v_phash bigint;
  known text := want_verdict->>'known_abuse';
  label text := want_verdict->'classifier'->>'label';
  label_conf numeric := coalesce((want_verdict->'classifier'->>'confidence')::numeric, 0);
  near record;
  why text;
begin
  select * into m from public.community_media where id = want_media for update;
  if m.id is null or m.status <> 'pending' then
    raise exception 'that image is not waiting for a scan' using errcode = '22023';
  end if;
  -- Nothing clears without a known-abuse check, and nothing else is accepted.
  if known is null or known not in ('clear', 'match') then
    raise exception 'a known-abuse hash check is required before any image is decided' using errcode = '22023';
  end if;
  if coalesce(want_verdict->>'phash', '') !~ '^[0-9a-f]{16}$' or coalesce(v_sha, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'the scan must report both hashes' using errcode = '22023';
  end if;
  v_phash := ('x' || (want_verdict->>'phash'))::bit(64)::bigint;

  update public.community_media
     set detected_kind = v_kind, bytes = v_bytes, width = v_width, height = v_height,
         sha256 = v_sha, phash = v_phash, scan_version = left(coalesce(want_verdict->>'scan_version', ''), 60),
         scanned_at = now(), claimed_until = null
   where id = m.id
  returning * into m;

  if known = 'match' then
    update public.community_media set status = 'held', known_abuse_match = true, reason_code = 'known_abuse_hash'
     where id = m.id returning * into m;
    perform private.media_case(m, 'nonconsensual_media', 'P0', 'media.known-abuse-hash', 1.00);
    return 'held';
  end if;

  why := case
    when v_kind is null or v_kind not in ('jpeg', 'png', 'webp') or v_kind <> m.declared_kind then 'type_mismatch'
    when coalesce((want_verdict->>'metadata_found')::boolean, true) then 'metadata_left'
    when v_bytes is null or v_bytes > 10485760 then 'too_large'
    when v_width is null or v_height is null or v_width < 1 or v_height < 1 or v_width > 8000 or v_height > 8000 then 'bad_dimensions'
  end;
  if why is not null then
    update public.community_media set status = 'rejected', reason_code = why where id = m.id;
    update public.community_posts set status = 'withdrawn' where id = m.post_id and status = 'pending';
    return 'rejected';
  end if;

  select b.category, b.id,
         least(case when b.sha256 = v_sha then 0 else 64 end, bit_count((b.phash # v_phash)::bit(64))) as distance
    into near
    from public.community_media_blocklist b
   where b.tenant_id = m.tenant_id
     and (b.sha256 = v_sha or bit_count((b.phash # v_phash)::bit(64)) <= 8)
   order by 3 limit 1;
  if near.id is not null then
    update public.community_media set status = 'held', reason_code = 'matches_removed_image' where id = m.id
    returning * into m;
    perform private.media_case(m, near.category, private.community_severity(near.category, false),
                               'media.reupload-of-removed', round(1 - near.distance / 64.0, 2));
    return 'held';
  end if;

  if label in ('sexual_explicit', 'graphic_violence', 'self_harm') and label_conf >= 0.80 then
    update public.community_media set status = 'held', reason_code = 'classifier:' || label where id = m.id
    returning * into m;
    perform private.media_case(m,
      case when label = 'self_harm' then 'threat_or_safety_concern' else 'other' end,
      case when label = 'self_harm' then 'P1' else 'P2' end,
      'media.classifier.' || label, round(least(label_conf, 0.99), 2));
    return 'held';
  end if;

  update public.community_media set status = 'clear', reason_code = '' where id = m.id;
  update public.community_posts set status = 'published' where id = m.post_id and status = 'pending';
  return 'clear';
end $$;
revoke all on function public.record_media_scan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_media_scan(uuid, jsonb) to service_role;

/* For the scanner's clean-up: files to delete through the Storage API. */
create or replace function public.take_media_deletions()
returns setof text
language sql
security definer
set search_path = ''
as $$ select d.object_path from public.community_media_deletions d order by d.queued_at limit 100; $$;
revoke all on function public.take_media_deletions() from public, anon, authenticated;
grant execute on function public.take_media_deletions() to service_role;

create or replace function public.mark_media_deleted(want_paths text[])
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.community_media_deletions where object_path = any (want_paths); $$;
revoke all on function public.mark_media_deleted(text[]) from public, anon, authenticated;
grant execute on function public.mark_media_deleted(text[]) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Every object here is new. To remove:
--
--   drop function if exists public.my_community_standing(), public.case_author_safety(uuid, text),
--     private.safety_value(uuid), private.record_safety_outcome(public.community_cases, text, text, uuid),
--     public.mark_escalation_failed(uuid, text, boolean),
--     public.mark_escalation_delivered(uuid), public.take_escalation_deliveries(),
--     public.decide_community_escalation(uuid, boolean, text), public.request_community_escalation(uuid, text),
--     private.escalation_allowed(public.community_cases);
--   drop function if exists public.mark_media_deleted(text[]), public.take_media_deletions(),
--     public.record_media_scan(uuid, jsonb), public.take_media_scans(),
--     private.media_case(public.community_media, text, text, text, numeric),
--     public.begin_community_image(uuid, text, text), private.media_read_allowed(text),
--     private.media_upload_allowed(text), private.media_uploaded(text), private.queue_media_deletion();
--   drop policy if exists "community media: upload the image you reserved" on storage.objects;
--   drop policy if exists "community media: read what you may see" on storage.objects;
--   -- and empty and delete the community-media bucket through the Storage API.
--   drop table if exists public.community_media_deletions, public.community_media_blocklist, public.community_media;
--   drop function if exists public.reveal_alias_identity(uuid), public.decide_alias_identity(uuid, boolean, text),
--     public.request_alias_identity(uuid, text);
--   drop table if exists public.community_identity_grants;
--   drop function if exists public.retire_escalation_agreement(text, text),
--     public.activate_escalation_agreement(text, text),
--     public.save_escalation_agreement(text, text, text[], boolean, text, text, date),
--     public.can_manage_escalation_agreements();
--   drop table if exists public.community_escalation_agreement_events;
--   drop table if exists public.community_safety_entries, public.community_escalation_deliveries,
--     public.community_escalations, public.community_escalation_policies;
--   drop function if exists public.my_volunteer_standing(), public.volunteer_decide(uuid, text, text),
--     public.volunteer_next_tasks(), private.volunteer_eligible_case(public.community_cases),
--     private.volunteer_recused(uuid, uuid), private.volunteer_ready(uuid),
--     public.manage_volunteer(uuid, text, text), public.volunteer_attest(text), public.apply_to_volunteer(),
--     public.volunteer_roster(),
--     private.volunteer_recompute(uuid), private.volunteer_event(uuid, text, text, text, text),
--     public.claim_community_alias(uuid, text), public.approve_community_pseudonymity(uuid, boolean),
--     private.community_program_on(text, text);
--   drop table if exists public.community_volunteer_events, public.community_volunteer_votes,
--     public.community_volunteer_tasks, public.community_calibration_items, public.community_volunteers,
--     public.community_aliases, public.community_programs;
--   drop function if exists private.sweep_community_retention(), private.community_run_detectors(uuid),
--     private.community_route(text), private.stamp_detector_rule();
--   drop table if exists public.community_retention_runs, public.community_signals,
--     public.community_detector_rules;
--   drop function if exists public.community_session_counts(uuid), public.join_study_session(uuid),
--     public.create_study_session(uuid, uuid, text, timestamptz, timestamptz, integer),
--     public.my_community_notices(), public.community_reviewer_standing(), public.my_community_refs(),
--     public.forget_my_community(), public.decide_community_appeal(uuid, boolean, text),
--     public.appeal_community_decision(uuid), public.decide_community_case(uuid, text, text),
--     private.apply_community_action(public.community_cases, text, uuid),
--     public.report_community_post(uuid, text, boolean, text), private.community_severity(text, boolean),
--     private.community_case_event(uuid, text, text, text, text, text),
--     public.block_community_author(uuid), public.delete_community_post(uuid),
--     public.edit_community_post(uuid, text, boolean), public.create_community_post(uuid, text, boolean, boolean, uuid),
--     private.has_contact_details(text), public.create_community(text, text, text, text),
--     private.blocked_either_way(uuid),
--     public.join_community(uuid), private.community_restricted(uuid, uuid), private.community_role(uuid);
--   -- and restore lti_account_untouched from 20260928021700_mentor_rosters.sql, first.
--   drop table if exists public.community_session_participants, public.community_sessions,
--     public.community_venues, public.community_decisions, public.community_case_events,
--     public.community_reports, public.community_cases, public.community_mutes,
--     public.community_restrictions, public.community_posts, public.community_members, public.communities;
--   delete from public.role_capabilities where capability like 'community:%';
--   delete from public.app_roles where role in ('trust_safety_reviewer', 'trust_safety_senior', 'community_manager');
--   delete from public.app_capabilities where capability like 'community:%';
-- ═══════════════════════════════════════════════════════════════════════════
