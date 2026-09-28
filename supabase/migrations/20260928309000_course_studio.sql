-- Semester — Faculty Course Studio: what an instructor publishes for a course.
--
-- Slice 1 of docs/FACULTY-COURSE-STUDIO-DESIGN.md (D-100, F1–F7 decided by the
-- owner; D-101 for this slice). An instructor who holds `faculty` on a course
-- publishes three things for it, per term:
--
--   * course AI rules — for each of the toolkit's ten named uses, allowed,
--     allowed with disclosure, required or not allowed, in their own words;
--   * course guidance — one plain note;
--   * study packs — a named, ordered list of references (links and citations,
--     never files), each marked authoritative, supplemental or do-not-use.
--
-- What it decides, and where:
--
--   * **F1 — who publishes.** Only a caller holding `course:publish` at course
--     scope, `scope_id = '<school>/<CODE>'`, which `faculty` gets here. Role
--     grants are written by the institution through the service key; nothing
--     here grants one, and an LMS launch grants none.
--   * **F2 — the key.** `<school>/<CODE>` plus a term. The school is the
--     caller's own (`profiles.school_id`), never a parameter: a school that
--     arrives from a browser is a request, not an authority. The code is
--     normalised the way `enrollments.code` is.
--   * **F4 — who reads.** Any signed-in member of the school, the boundary
--     `approved_source` already has. Course policy is not private.
--   * **F5.** Nothing here reads, counts or records any student.
--
-- **Versioned, append-only.** Publishing adds a version; nothing is updated or
-- deleted through the API, by anybody. Each version records who published it
-- and when, so the tables are their own audit trail — what a student was shown
-- on a date always has an answer. (The shared `tenant_policy_audit_event`
-- stays untouched: its entity list is redefined by several open branches, and
-- a table whose rows are never changed has nothing for it to record.)
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The capability ────────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('course:publish', 'Publish AI rules, guidance and study packs for one course. Reads nothing about students.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty', 'course:publish')
on conflict do nothing;

-- ── The course key ────────────────────────────────────────────────────────

-- "econ  1020" → "ECON 1020", or '' when it cannot be a course code.
create or replace function private.course_code(given text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when c ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$' then c else '' end
    from (select upper(regexp_replace(btrim(coalesce(given, '')), '\s+', ' ', 'g')) as c) x;
$$;

revoke all on function private.course_code(text) from public, anon, authenticated;

-- The caller's school, and whether they may publish for this course in it.
-- Returns the school, or raises: one place decides, so the three publishers
-- cannot disagree about who may.
create or replace function private.course_publisher(want_code text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  if want_code = '' then
    raise exception 'semester: that is not a course code' using errcode = 'check_violation';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null or not private.has_capability('course:publish', 'course', school || '/' || want_code) then
    raise exception 'semester: you do not teach that course here' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

revoke all on function private.course_publisher(text) from public, anon, authenticated;

-- ── Course AI rules ───────────────────────────────────────────────────────
--
-- The uses are `USES` in app/src/lib/toolkit/policy.ts and the states are
-- `UseState` without `unavailable`, which is what "nobody said" means and so
-- is never written. `blanket` covers the uses the rules do not name; whatever
-- it says, the engine never reads it as permitting `final-answers` (F3): only
-- a named row does, which the studio asks the instructor to confirm.

create table if not exists public.course_ai_rules (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  course_code  text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term         text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  version      integer     not null check (version >= 1),
  blanket      text        check (blanket in ('allowed', 'limited', 'prohibited', 'required')),
  uses         jsonb       not null default '{}'::jsonb check (
                             jsonb_typeof(uses) = 'object'
                             and (uses - array['brainstorming', 'outline-feedback', 'practice', 'grammar',
                                               'explanation', 'revision', 'diagrams', 'data-cleaning',
                                               'code-help', 'final-answers']::text[]) = '{}'::jsonb
                             and not jsonb_path_exists(uses,
                               '$.* ? (@ != "allowed" && @ != "limited" && @ != "prohibited" && @ != "required")')),
  words        text        not null default '' check (length(words) <= 4000),
  link         text        not null default '' check (link = '' or (link ~ '^https?://[^\s]+$' and length(link) <= 500)),
  effective    date,
  published_by uuid        references auth.users on delete set null,
  published_at timestamptz not null default now(),
  unique (tenant_id, course_code, term, version)
);

-- ── Course guidance ───────────────────────────────────────────────────────
-- An empty body is a published withdrawal: the latest version says nothing.

create table if not exists public.course_guidance (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  course_code  text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term         text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  version      integer     not null check (version >= 1),
  body         text        not null check (length(body) <= 4000),
  published_by uuid        references auth.users on delete set null,
  published_at timestamptz not null default now(),
  unique (tenant_id, course_code, term, version)
);

-- ── Study packs ───────────────────────────────────────────────────────────
-- `pack_id` is the pack; each row is one version of it. A retired version
-- takes the pack off students' lists without erasing that it existed.

create table if not exists public.study_packs (
  id           uuid        primary key default gen_random_uuid(),
  pack_id      uuid        not null,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  course_code  text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term         text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  version      integer     not null check (version >= 1),
  title        text        not null check (length(btrim(title)) between 1 and 120),
  note         text        not null default '' check (length(note) <= 2000),
  -- [{title, citation, link, authority}], checked item by item by the
  -- publisher; the column holds the backstop.
  items        jsonb       not null default '[]'::jsonb check (
                             jsonb_typeof(items) = 'array'
                             and jsonb_array_length(items) <= 50
                             and not jsonb_path_exists(items,
                               '$[*] ? (@.authority != "authoritative" && @.authority != "supplemental" && @.authority != "prohibited")')),
  retired      boolean     not null default false,
  published_by uuid        references auth.users on delete set null,
  published_at timestamptz not null default now(),
  unique (pack_id, version)
);

create index if not exists course_ai_rules_by_course on public.course_ai_rules (tenant_id, course_code, term, version desc);
create index if not exists course_guidance_by_course on public.course_guidance (tenant_id, course_code, term, version desc);
create index if not exists study_packs_by_course on public.study_packs (tenant_id, course_code, term);
-- `published_by` is a foreign key a deleted account's cascade follows.
create index if not exists course_ai_rules_by_publisher on public.course_ai_rules (published_by);
create index if not exists course_guidance_by_publisher on public.course_guidance (published_by);
create index if not exists study_packs_by_publisher on public.study_packs (published_by);

comment on table public.course_ai_rules is
  'Course AI rules an instructor published, per course and term, one row per version. Append-only.';
comment on table public.course_guidance is
  'Course guidance an instructor published, per course and term, one row per version. Append-only.';
comment on table public.study_packs is
  'Study packs an instructor published: references, not files. One row per version of a pack. Append-only.';

-- ── Who reads, and that nobody writes directly ────────────────────────────

alter table public.course_ai_rules enable row level security;
alter table public.course_guidance enable row level security;
alter table public.study_packs enable row level security;

revoke all on table public.course_ai_rules from anon, authenticated;
revoke all on table public.course_guidance from anon, authenticated;
revoke all on table public.study_packs from anon, authenticated;
grant select on table public.course_ai_rules to authenticated;
grant select on table public.course_guidance to authenticated;
grant select on table public.study_packs to authenticated;

drop policy if exists "school members read course rules" on public.course_ai_rules;
create policy "school members read course rules" on public.course_ai_rules
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));
drop policy if exists "school members read course guidance" on public.course_guidance;
create policy "school members read course guidance" on public.course_guidance
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));
drop policy if exists "school members read study packs" on public.study_packs;
create policy "school members read study packs" on public.study_packs
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));

-- ── Publishing ────────────────────────────────────────────────────────────
-- Each takes a lock on its course, term and kind, so two publishes at once
-- cannot both become the same version.

create or replace function public.publish_course_rules(
  want_course text, want_term text, want_blanket text, want_uses jsonb,
  want_words text, want_link text, want_effective date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  code   text := private.course_code(want_course);
  school text := private.course_publisher(code);
  ver    integer;
begin
  perform pg_advisory_xact_lock(hashtext('course_ai_rules:' || school || '/' || code || '/' || coalesce(want_term, '')));
  select coalesce(max(r.version), 0) + 1 into ver
    from public.course_ai_rules r
   where r.tenant_id = school and r.course_code = code and r.term = want_term;
  insert into public.course_ai_rules
    (tenant_id, course_code, term, version, blanket, uses, words, link, effective, published_by)
  values (school, code, want_term, ver, want_blanket, coalesce(want_uses, '{}'::jsonb),
          coalesce(want_words, ''), btrim(coalesce(want_link, '')), want_effective, (select auth.uid()));
  return ver;
end $$;

create or replace function public.publish_course_guidance(want_course text, want_term text, want_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  code   text := private.course_code(want_course);
  school text := private.course_publisher(code);
  ver    integer;
begin
  perform pg_advisory_xact_lock(hashtext('course_guidance:' || school || '/' || code || '/' || coalesce(want_term, '')));
  select coalesce(max(g.version), 0) + 1 into ver
    from public.course_guidance g
   where g.tenant_id = school and g.course_code = code and g.term = want_term;
  insert into public.course_guidance (tenant_id, course_code, term, version, body, published_by)
  values (school, code, want_term, ver, btrim(coalesce(want_body, '')), (select auth.uid()));
  return ver;
end $$;

-- A new pack when `want_pack` is null; otherwise a new version of that pack,
-- which must already be this course's and term's — a pack cannot be moved
-- into another course by publishing a version of it there.
create or replace function public.publish_study_pack(
  want_course text, want_term text, want_pack uuid, want_title text,
  want_note text, want_items jsonb, want_retired boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  code   text := private.course_code(want_course);
  school text := private.course_publisher(code);
  pack   uuid := coalesce(want_pack, gen_random_uuid());
  ver    integer;
  it     jsonb;
begin
  if want_items is null or jsonb_typeof(want_items) <> 'array' then
    raise exception 'semester: the references are missing' using errcode = 'check_violation';
  end if;
  for it in select * from jsonb_array_elements(want_items) loop
    if jsonb_typeof(it) <> 'object'
       or (it - array['title', 'citation', 'link', 'authority']::text[]) <> '{}'::jsonb
       or jsonb_typeof(it->'title') is distinct from 'string'
       or length(btrim(it->>'title')) not between 1 and 200
       or length(coalesce(it->>'citation', '')) > 200
       or not (coalesce(it->>'link', '') = '' or ((it->>'link') ~ '^https?://[^\s]+$' and length(it->>'link') <= 500))
       or coalesce(it->>'authority', '') not in ('authoritative', 'supplemental', 'prohibited') then
      raise exception 'semester: a reference needs a title, an http link or none, and an authority'
        using errcode = 'check_violation';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('study_packs:' || pack::text));
  if want_pack is not null and not exists (
    select 1 from public.study_packs p
     where p.pack_id = want_pack and p.tenant_id = school and p.course_code = code and p.term = want_term) then
    raise exception 'semester: no such pack for this course and term' using errcode = 'check_violation';
  end if;
  select coalesce(max(p.version), 0) + 1 into ver from public.study_packs p where p.pack_id = pack;
  insert into public.study_packs
    (pack_id, tenant_id, course_code, term, version, title, note, items, retired, published_by)
  values (pack, school, code, want_term, ver, btrim(coalesce(want_title, '')), coalesce(want_note, ''),
          want_items, coalesce(want_retired, false), (select auth.uid()));
  return pack;
end $$;

-- The courses the caller may publish for, at their own school — what decides
-- whether Course Studio is offered at all. Names only.
create or replace function public.my_course_studio_courses()
returns table (course_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct substr(g.scope_id, length(p.school_id) + 2)
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role and rc.capability = 'course:publish'
    join public.profiles p on p.user_id = g.subject
   where g.subject = (select auth.uid())
     and g.scope_kind = 'course'
     and g.scope_id like p.school_id || '/%'
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by 1;
$$;

revoke all on function public.publish_course_rules(text, text, text, jsonb, text, text, date) from public, anon, authenticated;
revoke all on function public.publish_course_guidance(text, text, text) from public, anon, authenticated;
revoke all on function public.publish_study_pack(text, text, uuid, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.my_course_studio_courses() from public, anon, authenticated;
grant execute on function public.publish_course_rules(text, text, text, jsonb, text, text, date) to authenticated;
grant execute on function public.publish_course_guidance(text, text, text) to authenticated;
grant execute on function public.publish_study_pack(text, text, uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.my_course_studio_courses() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.my_course_studio_courses();
--   drop function if exists public.publish_study_pack(text, text, uuid, text, text, jsonb, boolean);
--   drop function if exists public.publish_course_guidance(text, text, text);
--   drop function if exists public.publish_course_rules(text, text, text, jsonb, text, text, date);
--   drop table if exists public.study_packs, public.course_guidance, public.course_ai_rules;
--   drop function if exists private.course_publisher(text);
--   drop function if exists private.course_code(text);
--   delete from public.role_capabilities where capability = 'course:publish';
--   delete from public.app_capabilities where capability = 'course:publish';
--   commit;
