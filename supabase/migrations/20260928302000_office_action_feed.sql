-- Semester — the campus office action feed (Phase J, DECISION-LOG D-048).
--
-- `20260926150000_expansion_roles_and_features.sql` made
-- `public.institution_actions`: an office publishes a deadline, hold or
-- reminder to one cohort or one named student, and the student's Action
-- Center shows it. This finishes it against the feature command:
--
--   * **Source, date, office and official link are required.** A new row has
--     an office from a fixed list, an https link, a source note, and an
--     `updated_at`. The database refuses one without them, not a screen.
--   * **Scope by tenant, cohort, program or student-selected eligibility.**
--     Program and eligibility are the student's own choice, kept in
--     `institution_action_audiences`, which no office can read. An office
--     learns nothing about who matched.
--   * **Publishers are restricted to their scope and their office.** A
--     registrar cannot publish as Financial Aid: the role has to be one of the
--     office's own, over the scope named.
--   * **Draft → review → published.** Writes go through four functions, and a
--     second person with the same office and scope approves. Nobody publishes
--     their own draft.
--   * **Aggregate completion only, n >= 10.** A student may mark an action
--     done, which is a row only they can see. An office gets a count, and
--     only when it is ten or more. It never gets a name, a plan, or a row.
--
-- Existing rows are kept as they were: marked `published` (or `withdrawn`),
-- with no office. The app shows only rows with an office, so they stay out of
-- the feed until an office republishes them properly.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Offices, and the roles that publish for each ───────────────────────

insert into public.app_roles (role, global) values
  ('career_center_staff',       false),
  ('disability_services_staff', false),
  ('study_abroad_advisor',      false),
  ('first_year_staff',          false)
on conflict (role) do nothing;

-- New roles only. No existing role gains a capability here.
insert into public.role_capabilities (role, capability) values
  ('career_center_staff',       'institution_action:publish'),
  ('disability_services_staff', 'institution_action:publish'),
  ('study_abroad_advisor',      'institution_action:publish'),
  ('first_year_staff',          'institution_action:publish')
on conflict (role, capability) do nothing;

create table if not exists public.institution_action_offices (
  office         text   primary key check (office ~ '^[a-z_]{2,40}$'),
  label          text   not null check (length(trim(label)) between 1 and 80),
  -- Roles that may publish any action type for this office.
  publish_roles  text[] not null default '{}',
  -- Roles that may publish only `resource` and `event` actions for it.
  resource_roles text[] not null default '{}'
);
alter table public.institution_action_offices enable row level security;
revoke all on table public.institution_action_offices from anon, authenticated;
grant select on table public.institution_action_offices to authenticated;
drop policy if exists "anyone signed in reads the office list" on public.institution_action_offices;
create policy "anyone signed in reads the office list" on public.institution_action_offices
  for select using (true);

insert into public.institution_action_offices (office, label, publish_roles, resource_roles) values
  ('registrar',            'Registrar',                          array['registrar'],                     '{}'),
  ('financial_aid',        'Financial Aid',                      array['financial_aid_officer'],         '{}'),
  ('student_accounts',     'Student Accounts',                   array['student_accounts_officer'],      '{}'),
  ('international',        'International Student Services',     array['international_student_advisor'], '{}'),
  ('veterans',             'Veterans Services',                  array['veterans_certifying_official'],  '{}'),
  ('residence_life',       'Residence Life',                     array['residence_life_staff'],          array['resident_assistant']),
  ('career_center',        'Career Center',                      array['career_center_staff'],           '{}'),
  ('disability_services',  'Disability Services',                array['disability_services_staff'],     '{}'),
  ('athletics_compliance', 'Athletics Compliance',               array['athletics_compliance_officer'],  '{}'),
  ('study_abroad',         'Study Abroad',                       array['study_abroad_advisor'],          '{}'),
  ('first_year',           'First-Year Experience',              array['first_year_staff'],              '{}'),
  ('counseling',           'Counseling Center',                  '{}',                                   array['counseling_liaison']),
  ('learning_center',      'Learning Center',                    '{}',                                   array['learning_center_staff'])
on conflict (office) do update
  set label = excluded.label, publish_roles = excluded.publish_roles, resource_roles = excluded.resource_roles;

-- ── 2. The action row, finished ───────────────────────────────────────────

alter table public.institution_actions
  add column if not exists office             text references public.institution_action_offices(office),
  add column if not exists source_note        text check (source_note is null or length(trim(source_note)) between 1 and 300),
  add column if not exists audience_kind      text,
  add column if not exists target_program     text check (target_program is null or length(target_program) <= 200),
  add column if not exists target_eligibility text,
  add column if not exists status             text not null default 'published',
  add column if not exists updated_at         timestamptz not null default now(),
  add column if not exists published_at       timestamptz,
  add column if not exists reviewed_by        uuid references auth.users on delete set null,
  add column if not exists review_note        text check (review_note is null or length(review_note) <= 1000);

-- Existing rows were live the moment they were inserted.
update public.institution_actions set status = 'withdrawn' where withdrawn_at is not null and status = 'published';
update public.institution_actions set published_at = created_at where published_at is null and status = 'published';
update public.institution_actions
   set audience_kind = case when target_student is not null then 'student' else 'cohort' end
 where audience_kind is null;
alter table public.institution_actions alter column status set default 'draft';
alter table public.institution_actions alter column audience_kind set not null;

alter table public.institution_actions drop constraint if exists institution_action_status_known;
alter table public.institution_actions add constraint institution_action_status_known
  check (status in ('draft', 'in_review', 'published', 'withdrawn'));

-- The eligibility a student can say applies to them. Deliberately nothing
-- about health or disability: Disability Services publishes to the whole
-- school, and a student never has to tell Semester they are registered.
alter table public.institution_actions drop constraint if exists institution_action_eligibility_known;
alter table public.institution_actions add constraint institution_action_eligibility_known
  check (target_eligibility is null or target_eligibility in (
    'aid_applicant', 'international', 'veteran_benefits', 'varsity_athlete',
    'campus_housing', 'study_abroad', 'first_year', 'transfer', 'graduating'));

-- One audience, and exactly the column it needs.
alter table public.institution_actions drop constraint if exists institution_action_one_target;
alter table public.institution_actions drop constraint if exists institution_action_audience;
alter table public.institution_actions add constraint institution_action_audience check (
  case audience_kind
    when 'student'     then num_nonnulls(target_student, target_cohort, target_program, target_eligibility) = 1 and target_student is not null
    when 'cohort'      then num_nonnulls(target_student, target_cohort, target_program, target_eligibility) = 1 and target_cohort is not null
    when 'program'     then num_nonnulls(target_student, target_cohort, target_program, target_eligibility) = 1 and target_program is not null
    when 'eligibility' then num_nonnulls(target_student, target_cohort, target_program, target_eligibility) = 1 and target_eligibility is not null
    when 'tenant'      then num_nonnulls(target_student, target_cohort, target_program, target_eligibility) = 0
    else false
  end);
alter table public.institution_actions drop constraint if exists institution_action_program_in_tenant;
alter table public.institution_actions add constraint institution_action_program_in_tenant
  check (target_program is null or private.scope_in_tenant(target_program, tenant_id));

-- A row with an office is a row from this workflow, and has everything the
-- student is shown. Rows from before have no office and are left alone.
alter table public.institution_actions drop constraint if exists institution_action_complete;
alter table public.institution_actions add constraint institution_action_complete check (
  office is null or (
    official_url is not null and official_url ~ '^https://[^[:space:]]+$'
    and source_note is not null
    and length(trim(why_it_matters)) > 0
  ));

create index if not exists institution_actions_by_status on public.institution_actions (tenant_id, status, updated_at desc);
-- One per new foreign key (`indexes.check.sql`): the office list is small but
-- a delete from it scans this table, and a reviewer's account deletion clears
-- reviewed_by.
create index if not exists institution_actions_by_office on public.institution_actions (office);
create index if not exists institution_actions_by_reviewer on public.institution_actions (reviewed_by);

-- ── 3. What the student says applies to them ──────────────────────────────

create table if not exists public.institution_action_audiences (
  user_id    uuid        not null references auth.users on delete cascade,
  kind       text        not null check (kind in ('program', 'eligibility')),
  value      text        not null check (length(trim(value)) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, value),
  constraint institution_action_audience_known check (kind <> 'eligibility' or value in (
    'aid_applicant', 'international', 'veteran_benefits', 'varsity_athlete',
    'campus_housing', 'study_abroad', 'first_year', 'transfer', 'graduating'))
);
alter table public.institution_action_audiences enable row level security;
revoke all on table public.institution_action_audiences from anon, authenticated;
grant select, insert, delete on table public.institution_action_audiences to authenticated;
-- The student only. There is no staff policy on this table, by design.
drop policy if exists "a student keeps their own audiences" on public.institution_action_audiences;
create policy "a student keeps their own audiences" on public.institution_action_audiences
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 4. Whether an action reaches the caller ───────────────────────────────

create or replace function private.action_reaches_me(
  want_kind text, want_tenant text, want_student uuid, want_cohort text,
  want_program text, want_eligibility text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case want_kind
    when 'student' then want_student = (select auth.uid())
    when 'cohort'  then want_cohort is not null and private.in_cohort(want_cohort)
    else exists (
      select 1 from public.profiles p
       where p.user_id = (select auth.uid()) and p.school_id = want_tenant
         and (
           want_kind = 'tenant'
           or (want_kind = 'program' and exists (
                 select 1 from public.institution_action_audiences a
                  where a.user_id = p.user_id and a.kind = 'program' and a.value = want_program))
           or (want_kind = 'eligibility' and exists (
                 select 1 from public.institution_action_audiences a
                  where a.user_id = p.user_id and a.kind = 'eligibility' and a.value = want_eligibility))
         ))
  end;
$$;
revoke all on function private.action_reaches_me(text, text, uuid, text, text, text) from public;
grant execute on function private.action_reaches_me(text, text, uuid, text, text, text) to authenticated;

-- Whether the caller may publish this type of action for this office over
-- this scope. The role must be one of the office's own and carry the
-- capability over exactly this scope.
create or replace function private.may_publish(
  want_office text, want_scope_kind text, want_scope_id text, want_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.institution_action_offices o on o.office = want_office
     where g.subject = (select auth.uid())
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (
         (rc.capability = 'institution_action:publish' and g.role = any(o.publish_roles))
         or (rc.capability = 'resource:publish' and want_type in ('resource', 'event')
             and g.role = any(o.resource_roles))
       )
  );
$$;
revoke all on function private.may_publish(text, text, text, text) from public;
grant execute on function private.may_publish(text, text, text, text) to authenticated;

-- ── 5. Who reads an action ────────────────────────────────────────────────

drop policy if exists "a student reads actions meant for them" on public.institution_actions;
create policy "a student reads actions meant for them" on public.institution_actions
  for select using (
    (status = 'published' and withdrawn_at is null
     and private.action_reaches_me(audience_kind, tenant_id, target_student, target_cohort,
                                   target_program, target_eligibility))
    or private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
    or private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id)
  );

-- Every write goes through the functions below.
drop policy if exists "an office publishes within its scope" on public.institution_actions;
drop policy if exists "an office withdraws within its scope" on public.institution_actions;
revoke insert, update on table public.institution_actions from authenticated;
-- A table-level revoke leaves a column grant standing, so the one from
-- 20260926150000 goes by name.
revoke update (withdrawn_at) on table public.institution_actions from authenticated;

-- ── 6. Completion: the student's own mark ─────────────────────────────────

create table if not exists public.institution_action_progress (
  action_id uuid        not null references public.institution_actions on delete cascade,
  user_id   uuid        not null references auth.users on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (action_id, user_id)
);
create index if not exists institution_action_progress_by_user on public.institution_action_progress (user_id);
alter table public.institution_action_progress enable row level security;
revoke all on table public.institution_action_progress from anon, authenticated;
grant select, insert, delete on table public.institution_action_progress to authenticated;
drop policy if exists "a student marks their own" on public.institution_action_progress;
create policy "a student marks their own" on public.institution_action_progress
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.institution_actions a
       where a.id = action_id and a.status = 'published' and a.withdrawn_at is null
         and private.action_reaches_me(a.audience_kind, a.tenant_id, a.target_student, a.target_cohort,
                                       a.target_program, a.target_eligibility))
  );

-- ── 7. The student's feed ─────────────────────────────────────────────────

-- Only complete rows (with an office) that reach the caller, whatever else
-- their grants let them read.
create or replace function public.my_office_actions()
returns table (
  id uuid, office text, office_label text, action_type text, audience_kind text,
  target_program text, target_eligibility text,
  title text, why_it_matters text, due_at timestamptz, official_url text, source_note text,
  updated_at timestamptz, published_at timestamptz, done_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.office, o.label, a.action_type, a.audience_kind,
         a.target_program, a.target_eligibility,
         a.title, a.why_it_matters, a.due_at, a.official_url, a.source_note,
         a.updated_at, a.published_at, p.done_at
    from public.institution_actions a
    join public.institution_action_offices o on o.office = a.office
    left join public.institution_action_progress p
      on p.action_id = a.id and p.user_id = (select auth.uid())
   where a.status = 'published' and a.withdrawn_at is null
     and private.action_reaches_me(a.audience_kind, a.tenant_id, a.target_student, a.target_cohort,
                                   a.target_program, a.target_eligibility)
   order by coalesce(a.due_at, 'infinity'::timestamptz), a.updated_at desc
   limit 100;
$$;
revoke all on function public.my_office_actions() from public, anon;
grant execute on function public.my_office_actions() to authenticated;

-- The programs offices at the student's school publish to, so the student
-- can choose theirs from a list rather than guess a slug.
create or replace function public.office_action_programs()
returns table (program text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct a.target_program
    from public.institution_actions a
    join public.profiles p on p.user_id = (select auth.uid()) and p.school_id = a.tenant_id
   where a.audience_kind = 'program' and a.status = 'published' and a.withdrawn_at is null
   order by 1
   limit 200;
$$;
revoke all on function public.office_action_programs() from public, anon;
grant execute on function public.office_action_programs() to authenticated;

-- ── 8. The publish workflow ───────────────────────────────────────────────

-- Where the caller may publish, and as which office.
create or replace function public.my_action_publish_scopes()
returns table (office text, label text, scope_kind text, scope_id text, resource_only boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.office, o.label, g.scope_kind, g.scope_id,
         bool_and(not (g.role = any(o.publish_roles) and rc.capability = 'institution_action:publish'))
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
    join public.institution_action_offices o
      on (rc.capability = 'institution_action:publish' and g.role = any(o.publish_roles))
      or (rc.capability = 'resource:publish' and g.role = any(o.resource_roles))
   where g.subject = (select auth.uid())
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
     and g.scope_kind in ('school', 'office', 'residence', 'department')
   group by o.office, o.label, g.scope_kind, g.scope_id
   order by o.label;
$$;
revoke all on function public.my_action_publish_scopes() from public, anon;
grant execute on function public.my_action_publish_scopes() to authenticated;

-- Words the product never uses about a student (DECISION-LOG D-002).
create or replace function private.calm_wording(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t !~* '\m(at[[:space:]]+risk|failing|behind)\M';
$$;
revoke all on function private.calm_wording(text) from public;
grant execute on function private.calm_wording(text) to authenticated;

create or replace function public.draft_office_action(
  want_office text, want_scope_kind text, want_scope_id text, want_type text,
  want_audience text, want_target text,
  want_title text, want_why text, want_due timestamptz, want_url text, want_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant text := split_part(want_scope_id, '/', 1);
  made   uuid;
begin
  if not private.may_publish(want_office, want_scope_kind, want_scope_id, want_type) then
    raise exception 'You cannot publish for that office in that scope.' using errcode = '42501';
  end if;
  if want_audience not in ('tenant', 'cohort', 'program', 'eligibility') then
    raise exception 'Choose who this is for: the whole school, a cohort, a program or an eligibility.';
  end if;
  if want_audience <> 'tenant' and (want_target is null or length(trim(want_target)) = 0) then
    raise exception 'Name the % this is for.', want_audience;
  end if;
  if want_url is null or want_url !~ '^https://[^[:space:]]+$' then
    raise exception 'An official https link is required.';
  end if;
  if coalesce(length(trim(want_source)), 0) = 0 then
    raise exception 'Say where this comes from.';
  end if;
  if coalesce(length(trim(want_why)), 0) = 0 then
    raise exception 'Say why it matters.';
  end if;
  if not private.calm_wording(want_title) or not private.calm_wording(want_why) then
    raise exception 'Rephrase without "at risk", "failing" or "behind".';
  end if;

  insert into public.institution_actions (
    tenant_id, publisher_id, publisher_scope_kind, publisher_scope_id, office, action_type,
    audience_kind, target_cohort, target_program, target_eligibility,
    title, why_it_matters, due_at, official_url, source_note, status, updated_at)
  values (
    tenant, (select auth.uid()), want_scope_kind, want_scope_id, want_office, want_type,
    want_audience,
    case when want_audience = 'cohort' then trim(want_target) end,
    case when want_audience = 'program' then trim(want_target) end,
    case when want_audience = 'eligibility' then trim(want_target) end,
    trim(want_title), trim(want_why), want_due, trim(want_url), trim(want_source), 'draft', now())
  returning id into made;
  return made;
end;
$$;
revoke all on function public.draft_office_action(text, text, text, text, text, text, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.draft_office_action(text, text, text, text, text, text, text, text, timestamptz, text, text) to authenticated;

-- Moves one action along draft → in_review → published, or out to withdrawn.
-- `approve` must come from someone other than the author.
create or replace function public.move_office_action(want_id uuid, want_step text, want_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  act public.institution_actions%rowtype;
  goes text;
begin
  select * into act from public.institution_actions where id = want_id for update;
  -- The same message whether the row is missing or out of the caller's scope.
  if not found or act.office is null
     or not private.may_publish(act.office, act.publisher_scope_kind, act.publisher_scope_id, act.action_type) then
    raise exception 'No such action in your scope.' using errcode = '42501';
  end if;

  goes := case
    when want_step = 'submit'   and act.status = 'draft'     then 'in_review'
    when want_step = 'approve'  and act.status = 'in_review' then 'published'
    when want_step = 'return'   and act.status = 'in_review' then 'draft'
    when want_step = 'withdraw' and act.status <> 'withdrawn' then 'withdrawn'
  end;
  if goes is null then
    raise exception 'Cannot % an action that is %.', want_step, replace(act.status, '_', ' ');
  end if;
  if want_step = 'approve' and act.publisher_id = (select auth.uid()) then
    raise exception 'Someone else in your office has to approve this.' using errcode = '42501';
  end if;
  if want_step = 'return' and coalesce(length(trim(want_note)), 0) = 0 then
    raise exception 'Say what needs changing.';
  end if;

  update public.institution_actions set
    status       = goes,
    updated_at   = now(),
    published_at = case when goes = 'published' then now() else published_at end,
    withdrawn_at = case when goes = 'withdrawn' then now() else withdrawn_at end,
    reviewed_by  = case when want_step in ('approve', 'return') then (select auth.uid()) else reviewed_by end,
    review_note  = case when want_step = 'return' then left(trim(want_note), 1000)
                        when want_step = 'approve' then null else review_note end
  where id = want_id;
  return goes;
end;
$$;
revoke all on function public.move_office_action(uuid, text, text) from public, anon;
grant execute on function public.move_office_action(uuid, text, text) to authenticated;

-- ── 9. What an office sees about completion ───────────────────────────────

-- The office's own actions, with a completion count that is null below ten.
-- No name, no row, no plan: a number, or nothing.
create or replace function public.office_desk_actions()
returns table (
  id uuid, office text, scope_kind text, scope_id text, action_type text,
  audience_kind text, target text, title text, why_it_matters text,
  due_at timestamptz, official_url text, source_note text, status text,
  mine boolean, review_note text, updated_at timestamptz, completed integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.office, a.publisher_scope_kind, a.publisher_scope_id, a.action_type,
         a.audience_kind, coalesce(a.target_cohort, a.target_program, a.target_eligibility),
         a.title, a.why_it_matters, a.due_at, a.official_url, a.source_note, a.status,
         a.publisher_id = (select auth.uid()), a.review_note, a.updated_at,
         (select case when count(*) >= 10 then count(*)::integer end
            from public.institution_action_progress p where p.action_id = a.id)
    from public.institution_actions a
   where a.office is not null
     and private.may_publish(a.office, a.publisher_scope_kind, a.publisher_scope_id, a.action_type)
   order by a.updated_at desc
   limit 200;
$$;
revoke all on function public.office_desk_actions() from public, anon;
grant execute on function public.office_desk_actions() to authenticated;
