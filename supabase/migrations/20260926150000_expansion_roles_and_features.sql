-- Semester — expansion roles, capabilities and feature tables.
--
-- Adds the stakeholders and features in the Master Implementation Brief v2
-- (sections 27–31) on top of the model that already exists. Nothing here is a
-- second permission system:
--
--   * roles go into `public.app_roles`, capabilities into
--     `public.app_capabilities`, and the matrix into `public.role_capabilities`
--   * policies ask `private.has_capability(...)`, never a role name
--   * a person holds a role over a scope through `public.role_grants`
--   * a parent or guardian is still `public.family_grants`, and time-boxed
--     staff help is still `public.support_access_grant`
--
-- Student *segments* (international, veteran, first-generation, adult learner,
-- caregiver, athlete, working) are deliberately NOT roles. A role is authority
-- another person can see and act on; a segment is a private fact about the
-- student that only turns modules on. They live in `public.student_context`,
-- which no staff capability can read.
--
-- Every aggregate an institution can read is counted by the database and
-- suppressed below ten students by a check constraint, not by a screen.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 0. Two new scope kinds ────────────────────────────────────────────────
--
-- `cohort`  — an orientation group, first-year seminar, or pilot cohort.
--             scope_id = '<school>/<cohort-slug>'
-- `partner` — a sending institution (community college, dual-enrollment high
--             school) publishing into a receiving school.
--             scope_id = '<receiving-school>/<partner-slug>'
--
-- Every other scope_id added by this file follows the same convention: it
-- starts with the tenant id, so `private.scope_in_tenant` can tie a grant to
-- one university.

alter table public.role_grants
  drop constraint if exists role_grants_scope_kind_check;
alter table public.role_grants
  add constraint role_grants_scope_kind_check check (scope_kind in (
    'platform', 'school', 'organization', 'course', 'department',
    'office', 'residence', 'business', 'employer', 'cohort', 'partner'
  ));

-- ── 1. Roles ──────────────────────────────────────────────────────────────

insert into public.app_roles (role, global) values
  -- Students whose status an institution asserts
  ('admitted_student',              false),
  ('dual_enrollment_student',       false),
  -- Campus offices
  ('registrar',                     false),
  ('financial_aid_officer',         false),
  ('student_accounts_officer',      false),
  ('disability_services_officer',   false),
  ('international_student_advisor', false),
  ('veterans_certifying_official',  false),
  ('residence_life_staff',          false),
  ('resident_assistant',            false),
  ('learning_center_staff',         false),
  ('peer_mentor',                   false),
  ('orientation_leader',            false),
  ('counseling_liaison',            false),
  ('career_coach',                  false),
  ('department_chair',              false),
  ('dean',                          false),
  ('institutional_researcher',      false),
  ('athletics_compliance_officer',  false),
  -- Outside the university
  ('transfer_partner_admin',        false),
  ('high_school_counselor',         false),
  ('scholarship_provider',          false),
  ('marketplace_partner',           false),
  ('research_partner',              false),
  -- Semester staff
  ('support_agent',                 true),
  ('implementation_manager',        false),
  ('data_steward',                  true)
on conflict (role) do nothing;

-- ── 2. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('institution_action:publish', 'Publish an official action (hold, deadline, compliance reminder) to named students or a cohort in one office scope.'),
  ('resource:publish',           'Publish a support-resource action only (no deadlines, no holds). For counseling and wellbeing offices.'),
  ('registration_window:publish','Publish registration windows and time tickets for one university.'),
  ('catalog:sync',               'Write section capacity and seat counts for one university.'),
  ('articulation:propose',       'Propose transfer-credit equivalencies from one partner institution.'),
  ('articulation:approve',       'Approve, retire or reject transfer-credit equivalencies for one university.'),
  ('demand:read',                'Read anonymized course-demand snapshots (n >= 10) for one university or department.'),
  ('outcomes:read',              'Read anonymized cohort outcome aggregates (n >= 10) for one university.'),
  ('accommodation:verify',       'Issue and revoke verified accommodation passports for one university. Never reads diagnoses.'),
  ('skill:verify',               'Verify a skill a student asked to have verified, within one course or office.'),
  ('mentee:read',                'See onboarding-checklist progress of students who accepted this mentor, within one cohort.'),
  ('talent:search',              'Search opted-in, unexpired student talent profiles on behalf of one employer.'),
  ('opportunity:publish',        'Draft and submit jobs, internships, scholarships or deals for review.'),
  ('opportunity:moderate',       'Publish or remove submitted opportunities.'),
  ('review:moderate',            'Publish or remove course reviews, and see who wrote one.'),
  ('tutoring:manage',            'Manage tutoring availability and sessions for one learning-center office.'),
  ('data_request:handle',        'Work export, deletion, correction and restriction requests.'),
  ('support:ticket',             'Handle support tickets. Grants no student data without a support_access_grant.'),
  ('tenant:implement',           'Configure a university tenant in sandbox during implementation.')
on conflict (capability) do nothing;

-- ── 3. The matrix (sets, not tiers) ───────────────────────────────────────

insert into public.role_capabilities (role, capability) values
  ('registrar',                     'institution_action:publish'),
  ('registrar',                     'registration_window:publish'),
  ('registrar',                     'catalog:sync'),
  ('registrar',                     'articulation:approve'),
  ('registrar',                     'demand:read'),

  ('financial_aid_officer',         'institution_action:publish'),
  ('student_accounts_officer',      'institution_action:publish'),
  ('international_student_advisor', 'institution_action:publish'),
  ('veterans_certifying_official',  'institution_action:publish'),
  ('athletics_compliance_officer',  'institution_action:publish'),
  ('residence_life_staff',          'institution_action:publish'),
  ('resident_assistant',            'resource:publish'),
  ('counseling_liaison',            'resource:publish'),
  ('learning_center_staff',         'resource:publish'),
  ('learning_center_staff',         'tutoring:manage'),

  ('disability_services_officer',   'accommodation:verify'),

  ('faculty',                       'skill:verify'),
  ('career_coach',                  'skill:verify'),
  ('career_coach',                  'opportunity:publish'),

  ('peer_mentor',                   'mentee:read'),
  ('orientation_leader',            'mentee:read'),

  ('department_chair',              'demand:read'),
  ('dean',                          'demand:read'),
  ('dean',                          'outcomes:read'),
  ('institutional_researcher',      'demand:read'),
  ('institutional_researcher',      'outcomes:read'),
  ('research_partner',              'outcomes:read'),

  ('transfer_partner_admin',        'articulation:propose'),

  ('employer',                      'talent:search'),
  ('employer',                      'opportunity:publish'),
  ('scholarship_provider',          'opportunity:publish'),
  ('marketplace_partner',           'opportunity:publish'),

  ('moderator',                     'review:moderate'),
  ('moderator',                     'opportunity:moderate'),

  ('support_agent',                 'support:ticket'),
  ('data_steward',                  'data_request:handle'),
  ('implementation_manager',        'tenant:implement')
on conflict (role, capability) do nothing;

-- ── 4. Helpers ────────────────────────────────────────────────────────────

-- Whether a scope id belongs to a tenant: the tenant itself or '<tenant>/…'.
create or replace function private.scope_in_tenant(want_scope text, want_tenant text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select want_tenant is not null
     and (want_scope = want_tenant or left(want_scope, length(want_tenant) + 1) = want_tenant || '/');
$$;
revoke all on function private.scope_in_tenant(text, text) from public;
grant execute on function private.scope_in_tenant(text, text) to anon, authenticated;

-- A live grant carrying the capability over ANY scope. Only for reads whose
-- rows are already filtered by the subject's own opt-in (talent profiles).
create or replace function private.has_capability_anywhere(want_capability text)
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
     where g.subject = (select auth.uid())
       and rc.capability = want_capability
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;
revoke all on function private.has_capability_anywhere(text) from public;
grant execute on function private.has_capability_anywhere(text) to anon, authenticated;

-- Whether the caller holds any live role in a cohort (how a student is in one).
create or replace function private.in_cohort(want_cohort text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_grants g
     where g.subject = (select auth.uid())
       and g.scope_kind = 'cohort'
       and g.scope_id = want_cohort
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;
revoke all on function private.in_cohort(text) from public;
grant execute on function private.in_cohort(text) to anon, authenticated;

-- ── 5. Student context (private segments) ─────────────────────────────────

create table if not exists public.student_context (
  user_id              uuid        primary key references auth.users on delete cascade,
  tenant_id            text        references public.schools(id) on delete set null,
  -- What the student says about themself. Drives module visibility only.
  self_segments        text[]      not null default '{}',
  -- What the institution asserted. Written only by the service role.
  verified_segments    text[]      not null default '{}',
  is_minor             boolean     not null default false,
  guardian_consent_at  timestamptz,
  updated_at           timestamptz not null default now(),
  constraint student_context_segments_valid check (
    self_segments <@ array['international', 'veteran', 'military_connected', 'first_generation',
      'adult_learner', 'part_time', 'caregiver', 'working', 'athlete', 'transfer',
      'graduate', 'dual_enrollment', 'online']::text[]
    and verified_segments <@ array['international', 'veteran', 'military_connected', 'first_generation',
      'adult_learner', 'part_time', 'caregiver', 'working', 'athlete', 'transfer',
      'graduate', 'dual_enrollment', 'online']::text[]
  ),
  constraint student_context_minor_consent check (
    guardian_consent_at is null or is_minor
  )
);
create index if not exists student_context_by_tenant on public.student_context (tenant_id);

alter table public.student_context enable row level security;
revoke all on table public.student_context from anon, authenticated;
grant select, delete on table public.student_context to authenticated;
grant insert (user_id, tenant_id, self_segments, is_minor, updated_at)
  on table public.student_context to authenticated;
grant update (tenant_id, self_segments, is_minor, updated_at)
  on table public.student_context to authenticated;

drop policy if exists "a student owns their context" on public.student_context;
create policy "a student owns their context" on public.student_context
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 6. Registration day mode ──────────────────────────────────────────────

create table if not exists public.term_plan_courses (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users on delete cascade,
  tenant_id             text        not null references public.schools(id) on delete cascade,
  term_code             text        not null check (length(trim(term_code)) between 1 and 40),
  course_code           text        not null check (length(trim(course_code)) between 1 and 40),
  section               text        not null default '' check (length(section) <= 20),
  status                text        not null default 'planned'
                        check (status in ('planned', 'backup', 'registered', 'waitlisted', 'dropped')),
  -- 1 = first backup to try if the primary is full.
  backup_rank           integer     check (backup_rank is null or backup_rank between 1 and 20),
  backup_for            uuid        references public.term_plan_courses(id) on delete set null,
  source_label          text        not null default 'student_entered'
                        check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  -- Explicit opt-in to anonymized demand counting. Default off.
  contributes_to_demand boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint term_plan_backup_shape check ((status = 'backup') = (backup_rank is not null))
);
create index if not exists term_plan_courses_by_user on public.term_plan_courses (user_id, term_code);
create index if not exists term_plan_courses_by_tenant on public.term_plan_courses (tenant_id, term_code, course_code);
create index if not exists term_plan_courses_by_backup_for on public.term_plan_courses (backup_for);

alter table public.term_plan_courses enable row level security;
revoke all on table public.term_plan_courses from anon, authenticated;
grant select, insert, update, delete on table public.term_plan_courses to authenticated;
drop policy if exists "a student owns their term plan" on public.term_plan_courses;
create policy "a student owns their term plan" on public.term_plan_courses
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.registration_windows (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  term_code    text        not null check (length(trim(term_code)) between 1 and 40),
  audience     text        not null check (length(trim(audience)) between 1 and 120),
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  official_url text        check (official_url is null or length(official_url) <= 2000),
  published_by uuid        references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  constraint registration_window_order check (closes_at > opens_at)
);
create index if not exists registration_windows_by_tenant on public.registration_windows (tenant_id, term_code);
create index if not exists registration_windows_by_publisher on public.registration_windows (published_by);

alter table public.registration_windows enable row level security;
revoke all on table public.registration_windows from anon, authenticated;
grant select, insert, update, delete on table public.registration_windows to authenticated;
drop policy if exists "students at the school read windows" on public.registration_windows;
create policy "students at the school read windows" on public.registration_windows
  for select using (tenant_id = (select private.school_of())
                    or private.has_capability('registration_window:publish', 'school', tenant_id));
drop policy if exists "the registrar publishes windows" on public.registration_windows;
create policy "the registrar publishes windows" on public.registration_windows
  for insert with check (private.has_capability('registration_window:publish', 'school', tenant_id)
                         and published_by = (select auth.uid()));
drop policy if exists "the registrar edits windows" on public.registration_windows;
create policy "the registrar edits windows" on public.registration_windows
  for update using (private.has_capability('registration_window:publish', 'school', tenant_id))
  with check (private.has_capability('registration_window:publish', 'school', tenant_id));
drop policy if exists "the registrar removes windows" on public.registration_windows;
create policy "the registrar removes windows" on public.registration_windows
  for delete using (private.has_capability('registration_window:publish', 'school', tenant_id));

-- The student's own time ticket, as they typed it or as imported.
create table if not exists public.registration_time_tickets (
  user_id      uuid        not null references auth.users on delete cascade,
  term_code    text        not null check (length(trim(term_code)) between 1 and 40),
  opens_at     timestamptz not null,
  source_label text        not null default 'student_entered'
               check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  updated_at   timestamptz not null default now(),
  primary key (user_id, term_code)
);
alter table public.registration_time_tickets enable row level security;
revoke all on table public.registration_time_tickets from anon, authenticated;
grant select, insert, update, delete on table public.registration_time_tickets to authenticated;
drop policy if exists "a student owns their time ticket" on public.registration_time_tickets;
create policy "a student owns their time ticket" on public.registration_time_tickets
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.catalog_sections (
  tenant_id      text        not null references public.schools(id) on delete cascade,
  term_code      text        not null check (length(trim(term_code)) between 1 and 40),
  course_code    text        not null check (length(trim(course_code)) between 1 and 40),
  section        text        not null check (length(trim(section)) between 1 and 20),
  capacity       integer     check (capacity is null or capacity >= 0),
  seats_open     integer     check (seats_open is null or seats_open >= 0),
  waitlist_count integer     check (waitlist_count is null or waitlist_count >= 0),
  source_system  text        not null default 'manual' check (length(trim(source_system)) between 1 and 60),
  synced_at      timestamptz not null default now(),
  primary key (tenant_id, term_code, course_code, section)
);
alter table public.catalog_sections enable row level security;
revoke all on table public.catalog_sections from anon, authenticated;
grant select, insert, update, delete on table public.catalog_sections to authenticated;
drop policy if exists "the school reads its sections" on public.catalog_sections;
create policy "the school reads its sections" on public.catalog_sections
  for select using (tenant_id = (select private.school_of())
                    or private.has_capability('catalog:sync', 'school', tenant_id));
drop policy if exists "the registrar syncs sections" on public.catalog_sections;
create policy "the registrar syncs sections" on public.catalog_sections
  for all using (private.has_capability('catalog:sync', 'school', tenant_id))
  with check (private.has_capability('catalog:sync', 'school', tenant_id));

create table if not exists public.seat_watches (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  term_code    text        not null check (length(trim(term_code)) between 1 and 40),
  course_code  text        not null check (length(trim(course_code)) between 1 and 40),
  section      text        not null default '' check (length(section) <= 20),
  channels     text[]      not null default array['in_app']
               check (channels <@ array['in_app', 'push', 'email', 'sms']::text[] and cardinality(channels) > 0),
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz,
  unique (user_id, term_code, course_code, section)
);
create index if not exists seat_watches_by_tenant on public.seat_watches (tenant_id, term_code, course_code);
alter table public.seat_watches enable row level security;
revoke all on table public.seat_watches from anon, authenticated;
grant select, insert, update, delete on table public.seat_watches to authenticated;
drop policy if exists "a student owns their seat watches" on public.seat_watches;
create policy "a student owns their seat watches" on public.seat_watches
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 7. Graduation simulator and money ─────────────────────────────────────

create table if not exists public.graduation_scenarios (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users on delete cascade,
  name                 text        not null check (length(trim(name)) between 1 and 120),
  inputs               jsonb       not null default '{}'::jsonb,
  projected_grad_term  text        check (projected_grad_term is null or length(projected_grad_term) <= 40),
  projected_cost_cents bigint      check (projected_cost_cents is null or projected_cost_cents >= 0),
  -- A simulation is never verified.
  source_label         text        not null default 'estimated' check (source_label in ('estimated', 'needs_review')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists graduation_scenarios_by_user on public.graduation_scenarios (user_id);
alter table public.graduation_scenarios enable row level security;
revoke all on table public.graduation_scenarios from anon, authenticated;
grant select, insert, update, delete on table public.graduation_scenarios to authenticated;
drop policy if exists "a student owns their scenarios" on public.graduation_scenarios;
create policy "a student owns their scenarios" on public.graduation_scenarios
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.cost_plans (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users on delete cascade,
  term_code           text        not null check (length(trim(term_code)) between 1 and 40),
  line_items          jsonb       not null default '[]'::jsonb,
  aid_cents           bigint      not null default 0 check (aid_cents >= 0),
  work_hours_per_week integer     check (work_hours_per_week is null or work_hours_per_week between 0 and 80),
  source_label        text        not null default 'student_entered'
                      check (source_label in ('institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review')),
  updated_at          timestamptz not null default now(),
  unique (user_id, term_code)
);
alter table public.cost_plans enable row level security;
revoke all on table public.cost_plans from anon, authenticated;
grant select, insert, update, delete on table public.cost_plans to authenticated;
drop policy if exists "a student owns their cost plans" on public.cost_plans;
create policy "a student owns their cost plans" on public.cost_plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 8. Transfer credit ────────────────────────────────────────────────────

create table if not exists public.articulation_rules (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  -- '<tenant>/<partner-slug>', the same string a partner grant is scoped to.
  partner_scope  text        not null check (length(trim(partner_scope)) between 3 and 200),
  from_course    text        not null check (length(trim(from_course)) between 1 and 60),
  to_course      text        not null check (length(trim(to_course)) between 1 and 60),
  credits        numeric(4,1) check (credits is null or credits between 0 and 30),
  status         text        not null default 'draft'
                 check (status in ('draft', 'proposed', 'approved', 'rejected', 'retired')),
  effective_term text        check (effective_term is null or length(effective_term) <= 40),
  proposed_by    uuid        references auth.users on delete set null,
  approved_by    uuid        references auth.users on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint articulation_partner_in_tenant check (private.scope_in_tenant(partner_scope, tenant_id) and partner_scope <> tenant_id),
  constraint articulation_approval_shape check ((status = 'approved') = (approved_by is not null and approved_at is not null))
);
create index if not exists articulation_rules_by_tenant on public.articulation_rules (tenant_id, partner_scope, from_course);
create index if not exists articulation_rules_by_proposer on public.articulation_rules (proposed_by);
create index if not exists articulation_rules_by_approver on public.articulation_rules (approved_by);

alter table public.articulation_rules enable row level security;
revoke all on table public.articulation_rules from anon, authenticated;
grant select, insert, update on table public.articulation_rules to authenticated;
drop policy if exists "approved rules are readable at the school" on public.articulation_rules;
create policy "approved rules are readable at the school" on public.articulation_rules
  for select using (
    (status = 'approved' and tenant_id = (select private.school_of()))
    or private.has_capability('articulation:propose', 'partner', partner_scope)
    or private.has_capability('articulation:approve', 'school', tenant_id)
  );
drop policy if exists "a partner proposes rules" on public.articulation_rules;
create policy "a partner proposes rules" on public.articulation_rules
  for insert with check (
    private.has_capability('articulation:propose', 'partner', partner_scope)
    and status in ('draft', 'proposed') and proposed_by = (select auth.uid())
  );
drop policy if exists "a partner edits its unapproved rules" on public.articulation_rules;
create policy "a partner edits its unapproved rules" on public.articulation_rules
  for update using (
    private.has_capability('articulation:propose', 'partner', partner_scope)
    and status in ('draft', 'proposed')
  ) with check (
    private.has_capability('articulation:propose', 'partner', partner_scope)
    and status in ('draft', 'proposed')
  );
drop policy if exists "the registrar decides rules" on public.articulation_rules;
create policy "the registrar decides rules" on public.articulation_rules
  for update using (private.has_capability('articulation:approve', 'school', tenant_id))
  with check (private.has_capability('articulation:approve', 'school', tenant_id)
              and (status <> 'approved' or approved_by = (select auth.uid())));

create table if not exists public.transfer_evaluations (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users on delete cascade,
  tenant_id        text        not null references public.schools(id) on delete cascade,
  from_institution text        not null check (length(trim(from_institution)) between 1 and 200),
  from_course      text        not null check (length(trim(from_course)) between 1 and 60),
  rule_id          uuid        references public.articulation_rules(id) on delete set null,
  -- A student may only ever write estimated or submitted. The institution's
  -- decision arrives through the service role.
  status           text        not null default 'estimated'
                   check (status in ('estimated', 'submitted', 'institution_verified', 'denied')),
  note             text        not null default '' check (length(note) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists transfer_evaluations_by_user on public.transfer_evaluations (user_id);
create index if not exists transfer_evaluations_by_tenant on public.transfer_evaluations (tenant_id);
create index if not exists transfer_evaluations_by_rule on public.transfer_evaluations (rule_id);
alter table public.transfer_evaluations enable row level security;
revoke all on table public.transfer_evaluations from anon, authenticated;
grant select, insert, update, delete on table public.transfer_evaluations to authenticated;
drop policy if exists "a student reads their evaluations" on public.transfer_evaluations;
create policy "a student reads their evaluations" on public.transfer_evaluations
  for select using (user_id = (select auth.uid()));
drop policy if exists "a student drafts evaluations" on public.transfer_evaluations;
create policy "a student drafts evaluations" on public.transfer_evaluations
  for insert with check (user_id = (select auth.uid()) and status in ('estimated', 'submitted'));
drop policy if exists "a student edits unverified evaluations" on public.transfer_evaluations;
create policy "a student edits unverified evaluations" on public.transfer_evaluations
  for update using (user_id = (select auth.uid()) and status in ('estimated', 'submitted'))
  with check (user_id = (select auth.uid()) and status in ('estimated', 'submitted'));
drop policy if exists "a student deletes their evaluations" on public.transfer_evaluations;
create policy "a student deletes their evaluations" on public.transfer_evaluations
  for delete using (user_id = (select auth.uid()));

-- ── 9. Accommodations passport ────────────────────────────────────────────
--
-- A functional summary ("extended time 1.5x; captioned media"), never a
-- diagnosis. Issued by disability services. The student decides which
-- instructor sees it, for which course, until when. Instructors never select
-- the passport table; they read through `read_shared_accommodation`, which
-- writes an access event the student can see.

create table if not exists public.accommodation_passports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  summary     text        not null check (length(trim(summary)) between 1 and 1000),
  verified_by uuid        references auth.users on delete set null,
  verified_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  constraint accommodation_expiry check (expires_at > verified_at and expires_at <= verified_at + interval '400 days')
);
create index if not exists accommodation_passports_by_user on public.accommodation_passports (user_id);
create index if not exists accommodation_passports_by_tenant on public.accommodation_passports (tenant_id);
create index if not exists accommodation_passports_by_verifier on public.accommodation_passports (verified_by);
alter table public.accommodation_passports enable row level security;
revoke all on table public.accommodation_passports from anon, authenticated;
grant select, insert, update on table public.accommodation_passports to authenticated;
drop policy if exists "a student reads their passport" on public.accommodation_passports;
create policy "a student reads their passport" on public.accommodation_passports
  for select using (user_id = (select auth.uid())
                    or private.has_capability('accommodation:verify', 'school', tenant_id));
drop policy if exists "disability services issues passports" on public.accommodation_passports;
create policy "disability services issues passports" on public.accommodation_passports
  for insert with check (private.has_capability('accommodation:verify', 'school', tenant_id)
                         and verified_by = (select auth.uid())
                         and user_id <> (select auth.uid()));
drop policy if exists "disability services amends passports" on public.accommodation_passports;
create policy "disability services amends passports" on public.accommodation_passports
  for update using (private.has_capability('accommodation:verify', 'school', tenant_id))
  with check (private.has_capability('accommodation:verify', 'school', tenant_id));

create table if not exists public.accommodation_shares (
  id          uuid        primary key default gen_random_uuid(),
  passport_id uuid        not null references public.accommodation_passports(id) on delete cascade,
  student_id  uuid        not null references auth.users on delete cascade,
  faculty_id  uuid        not null references auth.users on delete cascade,
  course_code text        not null check (length(trim(course_code)) between 1 and 60),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint accommodation_share_two_people check (student_id <> faculty_id),
  constraint accommodation_share_term_bound check (expires_at > created_at and expires_at <= created_at + interval '200 days')
);
create index if not exists accommodation_shares_by_passport on public.accommodation_shares (passport_id);
create index if not exists accommodation_shares_by_student on public.accommodation_shares (student_id);
create index if not exists accommodation_shares_by_faculty on public.accommodation_shares (faculty_id);
alter table public.accommodation_shares enable row level security;
revoke all on table public.accommodation_shares from anon, authenticated;
grant select, insert, delete on table public.accommodation_shares to authenticated;
grant update (revoked_at) on table public.accommodation_shares to authenticated;
drop policy if exists "both ends see a share" on public.accommodation_shares;
create policy "both ends see a share" on public.accommodation_shares
  for select using (student_id = (select auth.uid()) or faculty_id = (select auth.uid()));
drop policy if exists "a student shares their own passport" on public.accommodation_shares;
create policy "a student shares their own passport" on public.accommodation_shares
  for insert with check (
    student_id = (select auth.uid())
    and exists (select 1 from public.accommodation_passports p
                 where p.id = passport_id and p.user_id = (select auth.uid()) and p.revoked_at is null)
  );
drop policy if exists "a student revokes a share" on public.accommodation_shares;
create policy "a student revokes a share" on public.accommodation_shares
  for update using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
drop policy if exists "a student deletes a share" on public.accommodation_shares;
create policy "a student deletes a share" on public.accommodation_shares
  for delete using (student_id = (select auth.uid()));

create table if not exists public.accommodation_access_events (
  id        uuid        primary key default gen_random_uuid(),
  share_id  uuid        not null references public.accommodation_shares(id) on delete cascade,
  reader_id uuid        references auth.users on delete set null,
  read_at   timestamptz not null default now()
);
create index if not exists accommodation_access_by_share on public.accommodation_access_events (share_id);
create index if not exists accommodation_access_by_reader on public.accommodation_access_events (reader_id);
alter table public.accommodation_access_events enable row level security;
revoke all on table public.accommodation_access_events from anon, authenticated;
grant select on table public.accommodation_access_events to authenticated;
drop policy if exists "a student sees who read their accommodations" on public.accommodation_access_events;
create policy "a student sees who read their accommodations" on public.accommodation_access_events
  for select using (exists (select 1 from public.accommodation_shares s
                             where s.id = share_id and s.student_id = (select auth.uid())));

create or replace function public.read_shared_accommodation(want_share uuid)
returns table (summary text, course_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.accommodation_shares%rowtype;
begin
  select * into s from public.accommodation_shares x
   where x.id = want_share
     and x.faculty_id = (select auth.uid())
     and x.revoked_at is null
     and x.expires_at > now();
  if not found then
    raise exception 'not shared with you' using errcode = '42501';
  end if;

  insert into public.accommodation_access_events (share_id, reader_id)
  values (s.id, (select auth.uid()));

  return query
    select p.summary, s.course_code, least(p.expires_at, s.expires_at)
      from public.accommodation_passports p
     where p.id = s.passport_id and p.revoked_at is null and p.expires_at > now();
end $$;
revoke all on function public.read_shared_accommodation(uuid) from public, anon, authenticated;
grant execute on function public.read_shared_accommodation(uuid) to authenticated;

-- ── 10. Course reviews (authorship split out) ─────────────────────────────

create table if not exists public.course_reviews (
  id                      uuid        primary key default gen_random_uuid(),
  tenant_id               text        not null references public.schools(id) on delete cascade,
  course_code             text        not null check (length(trim(course_code)) between 1 and 60),
  term_code               text        not null check (length(trim(term_code)) between 1 and 40),
  workload_hours_per_week integer     not null check (workload_hours_per_week between 0 and 60),
  difficulty              smallint    not null check (difficulty between 1 and 5),
  usefulness              smallint    not null check (usefulness between 1 and 5),
  body                    text        not null default '' check (length(body) <= 2000),
  status                  text        not null default 'pending' check (status in ('pending', 'published', 'removed')),
  created_at              timestamptz not null default now()
);
create index if not exists course_reviews_by_course on public.course_reviews (tenant_id, course_code, status);
alter table public.course_reviews enable row level security;
revoke all on table public.course_reviews from anon, authenticated;
grant select on table public.course_reviews to authenticated;
grant update (status) on table public.course_reviews to authenticated;

create table if not exists public.course_review_authors (
  review_id uuid primary key references public.course_reviews(id) on delete cascade,
  author_id uuid not null references auth.users on delete cascade
);
create index if not exists course_review_authors_by_author on public.course_review_authors (author_id);
alter table public.course_review_authors enable row level security;
revoke all on table public.course_review_authors from anon, authenticated;
grant select, delete on table public.course_review_authors to authenticated;

drop policy if exists "an author or moderator sees authorship" on public.course_review_authors;
create policy "an author or moderator sees authorship" on public.course_review_authors
  for select using (author_id = (select auth.uid()) or private.has_capability('review:moderate'));
drop policy if exists "an author withdraws authorship" on public.course_review_authors;
create policy "an author withdraws authorship" on public.course_review_authors
  for delete using (author_id = (select auth.uid()));

drop policy if exists "published reviews at the school, or your own" on public.course_reviews;
create policy "published reviews at the school, or your own" on public.course_reviews
  for select using (
    (status = 'published' and tenant_id = (select private.school_of()))
    or private.has_capability('review:moderate')
    or exists (select 1 from public.course_review_authors a
                where a.review_id = course_reviews.id and a.author_id = (select auth.uid()))
  );
drop policy if exists "a moderator moves a review along" on public.course_reviews;
create policy "a moderator moves a review along" on public.course_reviews
  for update using (private.has_capability('review:moderate'))
  with check (private.has_capability('review:moderate'));

create or replace function public.submit_course_review(
  want_course text, want_term text, want_workload integer,
  want_difficulty integer, want_usefulness integer, want_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.school_of();
  rid uuid;
begin
  if school is null or not private.verified_student() then
    raise exception 'a verified student at a school may review' using errcode = '42501';
  end if;
  insert into public.course_reviews
    (tenant_id, course_code, term_code, workload_hours_per_week, difficulty, usefulness, body)
  values (school, want_course, want_term, want_workload, want_difficulty, want_usefulness, coalesce(want_body, ''))
  returning id into rid;
  insert into public.course_review_authors (review_id, author_id) values (rid, (select auth.uid()));
  return rid;
end $$;
revoke all on function public.submit_course_review(text, text, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.submit_course_review(text, text, integer, integer, integer, text)
  to authenticated;

-- ── 11. Study-group matching ──────────────────────────────────────────────

create table if not exists public.study_match_optins (
  user_id      uuid        not null references auth.users on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  course_code  text        not null check (length(trim(course_code)) between 1 and 60),
  section      text        not null default '' check (length(section) <= 20),
  availability text        not null default '' check (length(availability) <= 200),
  expires_at   timestamptz not null default now() + interval '120 days',
  created_at   timestamptz not null default now(),
  primary key (user_id, tenant_id, course_code, section)
);
create index if not exists study_match_by_section on public.study_match_optins (tenant_id, course_code, section);

create or replace function private.opted_into_match(want_tenant text, want_course text, want_section text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_match_optins o
     where o.user_id = (select auth.uid())
       and o.tenant_id = want_tenant and o.course_code = want_course and o.section = want_section
       and o.expires_at > now()
  );
$$;
revoke all on function private.opted_into_match(text, text, text) from public;
grant execute on function private.opted_into_match(text, text, text) to anon, authenticated;

alter table public.study_match_optins enable row level security;
revoke all on table public.study_match_optins from anon, authenticated;
grant select, insert, update, delete on table public.study_match_optins to authenticated;
drop policy if exists "opted-in classmates see each other" on public.study_match_optins;
create policy "opted-in classmates see each other" on public.study_match_optins
  for select using (
    user_id = (select auth.uid())
    or (expires_at > now() and private.opted_into_match(tenant_id, course_code, section))
  );
drop policy if exists "a student manages their opt-in" on public.study_match_optins;
create policy "a student manages their opt-in" on public.study_match_optins
  for insert with check (user_id = (select auth.uid()) and tenant_id = (select private.school_of()));
drop policy if exists "a student edits their opt-in" on public.study_match_optins;
create policy "a student edits their opt-in" on public.study_match_optins
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "a student withdraws their opt-in" on public.study_match_optins;
create policy "a student withdraws their opt-in" on public.study_match_optins
  for delete using (user_id = (select auth.uid()));

-- ── 12. AI memory, weekly check-ins, contact channels ─────────────────────
-- Student-only. No staff capability reaches any of these.

create table if not exists public.ai_memories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  kind       text        not null check (kind in ('goal', 'preference', 'decision', 'focus_area', 'context')),
  content    text        not null check (length(trim(content)) between 1 and 1000),
  source     text        not null default 'student' check (source in ('student', 'ai_suggested_confirmed')),
  pinned     boolean     not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists ai_memories_by_user on public.ai_memories (user_id);
alter table public.ai_memories enable row level security;
revoke all on table public.ai_memories from anon, authenticated;
grant select, insert, update, delete on table public.ai_memories to authenticated;
drop policy if exists "a student owns their AI memory" on public.ai_memories;
create policy "a student owns their AI memory" on public.ai_memories
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.weekly_checkins (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  week_start   date        not null,
  top_actions  jsonb       not null default '[]'::jsonb,
  risk         text        not null default '' check (length(risk) <= 500),
  opportunity  text        not null default '' check (length(opportunity) <= 500),
  completed_at timestamptz,
  unique (user_id, week_start)
);
alter table public.weekly_checkins enable row level security;
revoke all on table public.weekly_checkins from anon, authenticated;
grant select, insert, update, delete on table public.weekly_checkins to authenticated;
drop policy if exists "a student owns their check-ins" on public.weekly_checkins;
create policy "a student owns their check-ins" on public.weekly_checkins
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.contact_channels (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  kind        text        not null check (kind in ('sms', 'email')),
  address     text        not null check (length(trim(address)) between 3 and 320),
  -- Set by the server after a code round-trip, never by the client.
  verified_at timestamptz,
  opted_in    boolean     not null default false,
  quiet_hours jsonb       not null default '{"start":"22:00","end":"08:00"}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, address)
);
alter table public.contact_channels enable row level security;
revoke all on table public.contact_channels from anon, authenticated;
grant select, delete on table public.contact_channels to authenticated;
grant insert (user_id, kind, address, opted_in, quiet_hours) on table public.contact_channels to authenticated;
grant update (opted_in, quiet_hours) on table public.contact_channels to authenticated;
drop policy if exists "a student owns their channels" on public.contact_channels;
create policy "a student owns their channels" on public.contact_channels
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 13. Skills record and talent pool ─────────────────────────────────────

create table if not exists public.skill_records (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  skill          text        not null check (length(trim(skill)) between 1 and 120),
  evidence_kind  text        not null check (evidence_kind in ('course', 'project', 'job', 'club', 'certification', 'other')),
  evidence_ref   text        not null default '' check (length(evidence_ref) <= 500),
  status         text        not null default 'self_reported'
                 check (status in ('self_reported', 'verification_requested', 'verified', 'declined')),
  -- Where the student asked for verification: a course or an office.
  verifier_scope_kind text   check (verifier_scope_kind is null or verifier_scope_kind in ('course', 'office')),
  verifier_scope_id   text   check (verifier_scope_id is null or length(verifier_scope_id) <= 200),
  verified_by    uuid        references auth.users on delete set null,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint skill_verification_target check (
    status = 'self_reported' or (verifier_scope_kind is not null and verifier_scope_id is not null)
  ),
  constraint skill_verified_shape check ((status = 'verified') = (verified_by is not null and verified_at is not null))
);
create index if not exists skill_records_by_user on public.skill_records (user_id);
create index if not exists skill_records_by_verifier on public.skill_records (verified_by);
create index if not exists skill_records_pending on public.skill_records (verifier_scope_kind, verifier_scope_id, status);
alter table public.skill_records enable row level security;
revoke all on table public.skill_records from anon, authenticated;
grant select, insert, update, delete on table public.skill_records to authenticated;
drop policy if exists "a student reads skills; a verifier reads requests" on public.skill_records;
create policy "a student reads skills; a verifier reads requests" on public.skill_records
  for select using (
    user_id = (select auth.uid())
    or (status in ('verification_requested', 'verified', 'declined')
        and private.has_capability('skill:verify', verifier_scope_kind, verifier_scope_id))
  );
drop policy if exists "a student records skills" on public.skill_records;
create policy "a student records skills" on public.skill_records
  for insert with check (user_id = (select auth.uid()) and status in ('self_reported', 'verification_requested'));
drop policy if exists "a student edits unverified skills" on public.skill_records;
create policy "a student edits unverified skills" on public.skill_records
  for update using (user_id = (select auth.uid()) and status in ('self_reported', 'verification_requested', 'declined'))
  with check (user_id = (select auth.uid()) and status in ('self_reported', 'verification_requested'));
drop policy if exists "a verifier decides" on public.skill_records;
create policy "a verifier decides" on public.skill_records
  for update using (
    status = 'verification_requested' and user_id <> (select auth.uid())
    and private.has_capability('skill:verify', verifier_scope_kind, verifier_scope_id)
  ) with check (
    status in ('verified', 'declined')
    and private.has_capability('skill:verify', verifier_scope_kind, verifier_scope_id)
    and (status = 'declined' or verified_by = (select auth.uid()))
  );
drop policy if exists "a student deletes skills" on public.skill_records;
create policy "a student deletes skills" on public.skill_records
  for delete using (user_id = (select auth.uid()));

create table if not exists public.talent_profiles (
  user_id           uuid        primary key references auth.users on delete cascade,
  opted_in          boolean     not null default false,
  headline          text        not null default '' check (length(headline) <= 200),
  visible_skill_ids uuid[]      not null default '{}',
  open_to           text[]      not null default '{}'
                    check (open_to <@ array['internship', 'full_time', 'part_time', 'research', 'co_op', 'fellowship']::text[]),
  graduation_term   text        check (graduation_term is null or length(graduation_term) <= 40),
  -- Consent to be found lapses; it is renewed, not remembered.
  expires_at        timestamptz not null default now() + interval '180 days',
  updated_at        timestamptz not null default now(),
  constraint talent_profile_expiry check (expires_at <= updated_at + interval '366 days')
);
alter table public.talent_profiles enable row level security;
revoke all on table public.talent_profiles from anon, authenticated;
grant select, insert, update, delete on table public.talent_profiles to authenticated;
drop policy if exists "a student owns their talent profile" on public.talent_profiles;
create policy "a student owns their talent profile" on public.talent_profiles
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "employers see opted-in profiles" on public.talent_profiles;
create policy "employers see opted-in profiles" on public.talent_profiles
  for select using (opted_in and expires_at > now() and private.has_capability_anywhere('talent:search'));

create table if not exists public.talent_profile_views (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        not null references public.talent_profiles(user_id) on delete cascade,
  viewer_id  uuid        references auth.users on delete set null,
  employer_scope text    not null check (length(trim(employer_scope)) between 1 and 200),
  viewed_at  timestamptz not null default now()
);
create index if not exists talent_views_by_profile on public.talent_profile_views (profile_id);
create index if not exists talent_views_by_viewer on public.talent_profile_views (viewer_id);
alter table public.talent_profile_views enable row level security;
revoke all on table public.talent_profile_views from anon, authenticated;
grant select, insert on table public.talent_profile_views to authenticated;
drop policy if exists "a student sees who viewed them" on public.talent_profile_views;
create policy "a student sees who viewed them" on public.talent_profile_views
  for select using (profile_id = (select auth.uid()) or viewer_id = (select auth.uid()));
drop policy if exists "an employer records a view" on public.talent_profile_views;
create policy "an employer records a view" on public.talent_profile_views
  for insert with check (viewer_id = (select auth.uid())
                         and private.has_capability('talent:search', 'employer', employer_scope));

-- ── 14. Opportunities (jobs, internships, scholarships, deals) ────────────

create table if not exists public.opportunities (
  id                   uuid        primary key default gen_random_uuid(),
  kind                 text        not null check (kind in ('job', 'internship', 'scholarship', 'deal', 'program', 'housing')),
  publisher_id         uuid        references auth.users on delete set null,
  publisher_scope_kind text        not null check (publisher_scope_kind in ('employer', 'business', 'office', 'partner')),
  publisher_scope_id   text        not null check (length(trim(publisher_scope_id)) between 1 and 200),
  -- Null = visible at every school.
  tenant_id            text        references public.schools(id) on delete cascade,
  title                text        not null check (length(trim(title)) between 1 and 200),
  body                 text        not null default '' check (length(body) <= 5000),
  url                  text        check (url is null or length(url) <= 2000),
  deadline             timestamptz,
  eligibility          jsonb       not null default '{}'::jsonb,
  status               text        not null default 'draft'
                       check (status in ('draft', 'pending_review', 'published', 'removed')),
  created_at           timestamptz not null default now()
);
create index if not exists opportunities_by_tenant on public.opportunities (tenant_id, status, kind);
create index if not exists opportunities_by_publisher on public.opportunities (publisher_id);
alter table public.opportunities enable row level security;
revoke all on table public.opportunities from anon, authenticated;
grant select, insert, update on table public.opportunities to authenticated;
drop policy if exists "published opportunities are readable" on public.opportunities;
create policy "published opportunities are readable" on public.opportunities
  for select using (
    (status = 'published' and (tenant_id is null or tenant_id = (select private.school_of())))
    or private.has_capability('opportunity:publish', publisher_scope_kind, publisher_scope_id)
    or private.has_capability('opportunity:moderate')
  );
drop policy if exists "a publisher drafts" on public.opportunities;
create policy "a publisher drafts" on public.opportunities
  for insert with check (
    private.has_capability('opportunity:publish', publisher_scope_kind, publisher_scope_id)
    and publisher_id = (select auth.uid()) and status in ('draft', 'pending_review')
  );
drop policy if exists "a publisher edits before review" on public.opportunities;
create policy "a publisher edits before review" on public.opportunities
  for update using (
    private.has_capability('opportunity:publish', publisher_scope_kind, publisher_scope_id)
    and status in ('draft', 'pending_review')
  ) with check (
    private.has_capability('opportunity:publish', publisher_scope_kind, publisher_scope_id)
    and status in ('draft', 'pending_review')
  );
drop policy if exists "a moderator publishes or removes" on public.opportunities;
create policy "a moderator publishes or removes" on public.opportunities
  for update using (private.has_capability('opportunity:moderate'))
  with check (private.has_capability('opportunity:moderate'));

-- ── 15. Peer mentors, orientation, onboarding progress ────────────────────

create table if not exists public.peer_mentor_assignments (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  cohort_scope text        not null check (length(trim(cohort_scope)) between 3 and 200),
  mentor_id    uuid        not null references auth.users on delete cascade,
  student_id   uuid        not null references auth.users on delete cascade,
  -- The student accepts; that is the consent.
  accepted_at  timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  constraint mentor_two_people check (mentor_id <> student_id),
  constraint mentor_cohort_in_tenant check (private.scope_in_tenant(cohort_scope, tenant_id)),
  constraint mentor_bounded check (expires_at > accepted_at and expires_at <= accepted_at + interval '200 days'),
  unique (mentor_id, student_id, cohort_scope)
);
create index if not exists mentor_assignments_by_student on public.peer_mentor_assignments (student_id);
create index if not exists mentor_assignments_by_tenant on public.peer_mentor_assignments (tenant_id);

create or replace function private.mentors(want_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.peer_mentor_assignments a
     where a.mentor_id = (select auth.uid())
       and a.student_id = want_student
       and a.revoked_at is null
       and a.expires_at > now()
       and exists (
         select 1 from public.role_grants g join public.role_capabilities rc on rc.role = g.role
          where g.subject = a.mentor_id and rc.capability = 'mentee:read'
            and g.scope_kind = 'cohort' and g.scope_id = a.cohort_scope
            and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
       )
  );
$$;
revoke all on function private.mentors(uuid) from public;
grant execute on function private.mentors(uuid) to anon, authenticated;

alter table public.peer_mentor_assignments enable row level security;
revoke all on table public.peer_mentor_assignments from anon, authenticated;
grant select, insert, delete on table public.peer_mentor_assignments to authenticated;
grant update (revoked_at) on table public.peer_mentor_assignments to authenticated;
drop policy if exists "both ends see an assignment" on public.peer_mentor_assignments;
create policy "both ends see an assignment" on public.peer_mentor_assignments
  for select using (student_id = (select auth.uid()) or mentor_id = (select auth.uid()));
drop policy if exists "a student accepts a mentor in their cohort" on public.peer_mentor_assignments;
create policy "a student accepts a mentor in their cohort" on public.peer_mentor_assignments
  for insert with check (
    student_id = (select auth.uid())
    and tenant_id = (select private.school_of())
    and private.in_cohort(cohort_scope)
    and private.subject_has_capability(mentor_id, 'mentee:read', 'cohort', cohort_scope)
  );
drop policy if exists "either end ends it" on public.peer_mentor_assignments;
create policy "either end ends it" on public.peer_mentor_assignments
  for update using (student_id = (select auth.uid()) or mentor_id = (select auth.uid()))
  -- Ending only: neither end can clear revoked_at and reopen a closed assignment.
  with check ((student_id = (select auth.uid()) or mentor_id = (select auth.uid()))
              and revoked_at is not null);
drop policy if exists "a student removes an assignment" on public.peer_mentor_assignments;
create policy "a student removes an assignment" on public.peer_mentor_assignments
  for delete using (student_id = (select auth.uid()));

create table if not exists public.onboarding_progress (
  user_id      uuid        not null references auth.users on delete cascade,
  step_key     text        not null check (step_key ~ '^[a-z0-9_]{2,60}$'),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, step_key)
);
alter table public.onboarding_progress enable row level security;
revoke all on table public.onboarding_progress from anon, authenticated;
grant select, insert, update, delete on table public.onboarding_progress to authenticated;
drop policy if exists "a student owns their onboarding" on public.onboarding_progress;
create policy "a student owns their onboarding" on public.onboarding_progress
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "an accepted mentor sees checklist progress" on public.onboarding_progress;
create policy "an accepted mentor sees checklist progress" on public.onboarding_progress
  for select using (private.mentors(user_id));

-- ── 16. Institution actions (the office → Action Center feed) ─────────────

create table if not exists public.institution_actions (
  id                   uuid        primary key default gen_random_uuid(),
  tenant_id            text        not null references public.schools(id) on delete cascade,
  publisher_id         uuid        references auth.users on delete set null,
  publisher_scope_kind text        not null check (publisher_scope_kind in ('school', 'office', 'residence', 'department')),
  publisher_scope_id   text        not null check (length(trim(publisher_scope_id)) between 1 and 200),
  action_type          text        not null check (action_type in (
                         'deadline', 'hold', 'compliance', 'certification', 'registration',
                         'aid', 'billing', 'housing', 'eligibility', 'resource', 'event')),
  target_student       uuid        references auth.users on delete cascade,
  target_cohort        text        check (target_cohort is null or length(target_cohort) <= 200),
  title                text        not null check (length(trim(title)) between 1 and 200),
  why_it_matters       text        not null default '' check (length(why_it_matters) <= 1000),
  due_at               timestamptz,
  official_url         text        check (official_url is null or length(official_url) <= 2000),
  created_at           timestamptz not null default now(),
  withdrawn_at         timestamptz,
  constraint institution_action_one_target check ((target_student is null) <> (target_cohort is null)),
  constraint institution_action_scope_in_tenant check (private.scope_in_tenant(publisher_scope_id, tenant_id)),
  constraint institution_action_cohort_in_tenant check (target_cohort is null or private.scope_in_tenant(target_cohort, tenant_id))
);
create index if not exists institution_actions_by_tenant on public.institution_actions (tenant_id, created_at desc);
create index if not exists institution_actions_by_student on public.institution_actions (target_student);
create index if not exists institution_actions_by_publisher on public.institution_actions (publisher_id);
alter table public.institution_actions enable row level security;
revoke all on table public.institution_actions from anon, authenticated;
grant select, insert on table public.institution_actions to authenticated;
grant update (withdrawn_at) on table public.institution_actions to authenticated;
drop policy if exists "a student reads actions meant for them" on public.institution_actions;
create policy "a student reads actions meant for them" on public.institution_actions
  for select using (
    (withdrawn_at is null and (target_student = (select auth.uid())
                               or (target_cohort is not null and private.in_cohort(target_cohort))))
    or private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
    or private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id)
  );
drop policy if exists "an office publishes within its scope" on public.institution_actions;
create policy "an office publishes within its scope" on public.institution_actions
  for insert with check (
    publisher_id = (select auth.uid())
    and (
      private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
      or (action_type in ('resource', 'event')
          and private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id))
    )
  );
drop policy if exists "an office withdraws within its scope" on public.institution_actions;
create policy "an office withdraws within its scope" on public.institution_actions
  for update using (
    private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
    or private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id)
  ) with check (
    private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
    or private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id)
  );

-- ── 17. Aggregates: demand and outcomes (n >= 10, enforced here) ──────────

create table if not exists public.course_demand_snapshots (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  term_code        text        not null check (length(trim(term_code)) between 1 and 40),
  course_code      text        not null check (length(trim(course_code)) between 1 and 40),
  planned_students integer     not null check (planned_students >= 10),
  -- Null when fewer than ten students hold it as a backup.
  backup_students  integer     check (backup_students is null or backup_students >= 10),
  generated_at     timestamptz not null default now(),
  unique (tenant_id, term_code, course_code)
);
alter table public.course_demand_snapshots enable row level security;
revoke all on table public.course_demand_snapshots from anon, authenticated;
grant select on table public.course_demand_snapshots to authenticated;
drop policy if exists "demand readers at the school" on public.course_demand_snapshots;
create policy "demand readers at the school" on public.course_demand_snapshots
  for select using (
    private.has_capability('demand:read', 'school', tenant_id)
    or private.has_capability('demand:read', 'department', tenant_id || '/' || split_part(course_code, ' ', 1))
  );

-- Run by a scheduled job with the service role. Counts only opted-in rows.
create or replace function private.refresh_course_demand(want_tenant text, want_term text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.course_demand_snapshots where tenant_id = want_tenant and term_code = want_term;
  insert into public.course_demand_snapshots (tenant_id, term_code, course_code, planned_students, backup_students)
  select want_tenant, want_term, c.course_code,
         count(distinct c.user_id) filter (where c.status in ('planned', 'registered', 'waitlisted')),
         nullif(case when count(distinct c.user_id) filter (where c.status = 'backup') >= 10
                     then count(distinct c.user_id) filter (where c.status = 'backup') else 0 end, 0)
    from public.term_plan_courses c
   where c.tenant_id = want_tenant and c.term_code = want_term and c.contributes_to_demand
   group by c.course_code
  having count(distinct c.user_id) filter (where c.status in ('planned', 'registered', 'waitlisted')) >= 10;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.refresh_course_demand(text, text) from public, anon, authenticated;

create table if not exists public.outcome_aggregates (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  cohort_scope text        not null check (length(trim(cohort_scope)) between 1 and 200),
  metric       text        not null check (metric in (
                 'activation_rate', 'plan_created_rate', 'backup_saved_rate', 'conflict_resolved_rate',
                 'advisor_agenda_rate', 'on_time_registration_rate', 'clarity_score',
                 'term_to_term_retention', 'credit_pace', 'seat_watch_fulfilled_rate')),
  period       text        not null check (length(trim(period)) between 1 and 40),
  value        numeric     not null,
  n            integer     not null check (n >= 10),
  method       text        not null default '' check (length(method) <= 500),
  generated_at timestamptz not null default now(),
  constraint outcome_cohort_in_tenant check (private.scope_in_tenant(cohort_scope, tenant_id))
);
create index if not exists outcome_aggregates_by_tenant on public.outcome_aggregates (tenant_id, metric, period);
alter table public.outcome_aggregates enable row level security;
revoke all on table public.outcome_aggregates from anon, authenticated;
grant select on table public.outcome_aggregates to authenticated;
drop policy if exists "outcome readers at the school" on public.outcome_aggregates;
create policy "outcome readers at the school" on public.outcome_aggregates
  for select using (private.has_capability('outcomes:read', 'school', tenant_id));

-- ── 18. Data requests (export / delete / correct / restrict) ──────────────

create table if not exists public.data_requests (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users on delete set null,
  kind         text        not null check (kind in ('export', 'delete', 'correct', 'restrict')),
  details      text        not null default '' check (length(details) <= 2000),
  status       text        not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  handled_by   uuid        references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists data_requests_by_user on public.data_requests (user_id);
create index if not exists data_requests_by_handler on public.data_requests (handled_by);
alter table public.data_requests enable row level security;
revoke all on table public.data_requests from anon, authenticated;
grant select, insert on table public.data_requests to authenticated;
grant update (status, handled_by, completed_at) on table public.data_requests to authenticated;
drop policy if exists "a student files and follows requests" on public.data_requests;
create policy "a student files and follows requests" on public.data_requests
  for select using (user_id = (select auth.uid()) or private.has_capability('data_request:handle'));
drop policy if exists "a student files a request" on public.data_requests;
create policy "a student files a request" on public.data_requests
  for insert with check (user_id = (select auth.uid()) and status = 'received' and handled_by is null);
drop policy if exists "a data steward works a request" on public.data_requests;
create policy "a data steward works a request" on public.data_requests
  for update using (private.has_capability('data_request:handle'))
  with check (private.has_capability('data_request:handle') and handled_by = (select auth.uid()));

-- ── 19. Alumni mentoring offers ───────────────────────────────────────────

create table if not exists public.alumni_mentor_offers (
  user_id    uuid        primary key references auth.users on delete cascade,
  tenant_id  text        not null references public.schools(id) on delete cascade,
  topics     text[]      not null default '{}',
  capacity   integer     not null default 2 check (capacity between 0 and 20),
  active     boolean     not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists alumni_offers_by_tenant on public.alumni_mentor_offers (tenant_id, active);
alter table public.alumni_mentor_offers enable row level security;
revoke all on table public.alumni_mentor_offers from anon, authenticated;
grant select, insert, update, delete on table public.alumni_mentor_offers to authenticated;
drop policy if exists "the school sees active alumni offers" on public.alumni_mentor_offers;
create policy "the school sees active alumni offers" on public.alumni_mentor_offers
  for select using (user_id = (select auth.uid()) or (active and tenant_id = (select private.school_of())));
drop policy if exists "verified alumni offer to mentor" on public.alumni_mentor_offers;
create policy "verified alumni offer to mentor" on public.alumni_mentor_offers
  for insert with check (user_id = (select auth.uid()) and private.holds_role('alumni', 'school', tenant_id));
drop policy if exists "alumni edit their offer" on public.alumni_mentor_offers;
create policy "alumni edit their offer" on public.alumni_mentor_offers
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.holds_role('alumni', 'school', tenant_id));
drop policy if exists "alumni withdraw their offer" on public.alumni_mentor_offers;
create policy "alumni withdraw their offer" on public.alumni_mentor_offers
  for delete using (user_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Every table here is new and every row in app_roles / app_capabilities /
-- role_capabilities is additive. To remove:
--
--   drop function if exists public.read_shared_accommodation(uuid);
--   drop function if exists public.submit_course_review(text, text, integer, integer, integer, text);
--   drop function if exists private.refresh_course_demand(text, text);
--   drop function if exists private.mentors(uuid);
--   drop function if exists private.opted_into_match(text, text, text);
--   drop table if exists public.alumni_mentor_offers, public.data_requests, public.outcome_aggregates,
--     public.course_demand_snapshots, public.institution_actions, public.onboarding_progress,
--     public.peer_mentor_assignments, public.opportunities, public.talent_profile_views,
--     public.talent_profiles, public.skill_records, public.contact_channels, public.weekly_checkins,
--     public.ai_memories, public.study_match_optins, public.course_review_authors, public.course_reviews,
--     public.accommodation_access_events, public.accommodation_shares, public.accommodation_passports,
--     public.transfer_evaluations, public.articulation_rules, public.cost_plans,
--     public.graduation_scenarios, public.seat_watches, public.catalog_sections,
--     public.registration_time_tickets, public.registration_windows, public.term_plan_courses,
--     public.student_context;
--   drop function if exists private.in_cohort(text), private.has_capability_anywhere(text),
--     private.scope_in_tenant(text, text);
--   delete from public.role_capabilities where role in (<roles added above>);
--   delete from public.app_roles where role in (<roles added above>) ;
--   -- and restore role_grants_scope_kind_check without 'cohort', 'partner'
--   -- (only after confirming no grant uses them).
-- ═══════════════════════════════════════════════════════════════════════════
