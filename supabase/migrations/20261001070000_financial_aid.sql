-- Semester — financial-aid records for a school that runs the `financial_aid`
-- module in Core (D-151): aid offers a second person approves, the student's
-- answer to each part, disbursement records, and satisfactory-academic-progress
-- tracking by rule with a determination a person makes.
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `financial_aid`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **Every determination stays with a person.** An officer holding `aid:propose`
--     writes a version of a student's offer for an aid year (grants, scholarships,
--     loans, work-study, each a named amount in cents); a *different* holder of
--     `aid:approve` approves it. Until then the student reads nothing of it, and a
--     new version supersedes the old one, which stays. No model, formula or score
--     writes an offer, approves one or decides a student's standing.
--   * **The student answers each part.** Only the student the record is linked to
--     accepts or declines a component of an approved, current offer, once.
--   * **Money is recorded, not moved.** A disbursement is a record that an amount of
--     an accepted component went out for a term, by reference. It cannot exceed
--     what the component holds, cannot be against a superseded or unapproved
--     version, a declined or unanswered component, or a student whose standing for
--     that aid year is suspended. Posting it to the student-accounts ledger is the
--     bursar's own entry; nothing here is a payment processor.
--   * **Progress is a rule applied to the record, then a person decides.** A policy
--     (minimum GPA, minimum completion rate) is versioned and never edited.
--     `aid_sap_evaluate` reads the academic-record ledger — the latest graded
--     attempt of each course, its credits, transfer credit — and saves the figures
--     and what each says against the policy, with a fingerprint of what it read.
--     `aid_sap_determine` (`aid:determine`, never the person who ran the evaluation)
--     records satisfactory, warning, suspended or reinstated with a reason. A
--     satisfactory determination cannot follow an evaluation that failed; a
--     reinstatement after suspension is an appeal outcome and needs its reason.
--   * **Never rewritten.** Every row here is append-only; only `ON DELETE SET NULL`
--     of a staff account's reference may touch one.
--
-- Not here, on purpose: packaging by formula, an ISIR import, federal reporting and
-- any prediction of whether a student will keep their aid.

-- ── Roles and capabilities ──────────────────────────────────────────────

insert into public.app_roles (role, global) values ('financial_aid_director', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('aid:propose',   'Write a version of a student''s aid offer, for one school. Never approves it.'),
  ('aid:approve',   'Approve a proposed aid offer version, never one they proposed, for one school.'),
  ('aid:disburse',  'Record a disbursement of an accepted aid component, for one school.'),
  ('aid:evaluate',  'Run a satisfactory-academic-progress evaluation of a student against the school''s policy.'),
  ('aid:determine', 'Set the progress policy and record a student''s determination, never on their own evaluation, for one school.'),
  ('aid:read',      'Read every offer, response, disbursement, evaluation and determination, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('financial_aid_officer',    'aid:propose'),
  ('financial_aid_director',   'aid:approve'),
  ('financial_aid_officer',    'aid:disburse'),
  ('financial_aid_officer',    'aid:evaluate'),
  ('financial_aid_director',   'aid:determine'),
  ('financial_aid_officer',    'aid:read'),
  ('financial_aid_director',   'aid:read')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.aid_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('propose', 'approve', 'respond', 'disburse', 'policy', 'evaluate', 'determine')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.aid_offers (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  student_ref text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  aid_year    text        not null check (aid_year ~ '^[0-9]{4}-[0-9]{2}$'),
  created_by  uuid        references auth.users on delete set null,
  created_at  timestamptz not null default clock_timestamp(),
  unique (tenant_id, student_ref, aid_year)
);

create table if not exists public.aid_offer_versions (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  offer_id    uuid        not null references public.aid_offers on delete cascade,
  version     integer     not null check (version >= 1),
  components  jsonb       not null,
  note        text        not null default '' check (length(note) <= 1000),
  proposed_by uuid        references auth.users on delete set null,
  proposed_at timestamptz not null default clock_timestamp(),
  operation   text        not null,
  unique (offer_id, version)
);

create table if not exists public.aid_offer_approvals (
  offer_version_id uuid        primary key references public.aid_offer_versions on delete cascade,
  tenant_id       text        not null references public.schools(id) on delete cascade,
  approved_by     uuid        references auth.users on delete set null,
  approved_at     timestamptz not null default clock_timestamp()
);

create table if not exists public.aid_offer_responses (
  offer_version_id uuid        not null references public.aid_offer_versions on delete cascade,
  component_key    text        not null check (component_key ~ '^[a-z0-9_]{1,40}$'),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  response         text        not null check (response in ('accept', 'decline')),
  responder        uuid        references auth.users on delete set null,
  at               timestamptz not null default clock_timestamp(),
  primary key (offer_version_id, component_key)
);

create table if not exists public.aid_disbursements (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  offer_version_id uuid        not null references public.aid_offer_versions on delete cascade,
  component_key    text        not null check (component_key ~ '^[a-z0-9_]{1,40}$'),
  term             text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  amount_cents     bigint      not null check (amount_cents > 0),
  reference        text        not null check (length(btrim(reference)) between 3 and 120),
  disbursed_by     uuid        references auth.users on delete set null,
  disbursed_at     timestamptz not null default clock_timestamp(),
  operation        text        not null
);

create table if not exists public.aid_sap_policies (
  id                 uuid          primary key default gen_random_uuid(),
  tenant_id          text          not null references public.schools(id) on delete cascade,
  version            integer       not null check (version >= 1),
  min_gpa            numeric(3, 2) not null check (min_gpa between 0 and 4),
  min_completion_pct numeric(5, 2) not null check (min_completion_pct between 0 and 100),
  note               text          not null default '' check (length(note) <= 1000),
  set_by             uuid          references auth.users on delete set null,
  set_at             timestamptz   not null default clock_timestamp(),
  operation          text          not null,
  unique (tenant_id, version)
);

create table if not exists public.aid_sap_evaluations (
  id                 uuid          primary key default gen_random_uuid(),
  tenant_id          text          not null references public.schools(id) on delete cascade,
  student_ref        text          not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  policy_id          uuid          not null references public.aid_sap_policies,
  as_of              date          not null,
  gpa                numeric(4, 3),
  attempted          numeric(7, 2) not null,
  earned             numeric(7, 2) not null,
  completion_pct     numeric(5, 2),
  meets_gpa          boolean       not null,
  meets_completion   boolean       not null,
  fingerprint        text          not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  evaluated_by       uuid          references auth.users on delete set null,
  evaluated_at       timestamptz   not null default clock_timestamp(),
  operation          text          not null
);

create table if not exists public.aid_sap_determinations (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  evaluation_id uuid        not null references public.aid_sap_evaluations,
  student_ref   text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  aid_year      text        not null check (aid_year ~ '^[0-9]{4}-[0-9]{2}$'),
  determination text        not null check (determination in ('satisfactory', 'warning', 'suspended', 'reinstated')),
  reason        text        not null check (length(btrim(reason)) between 10 and 2000),
  decided_by    uuid        references auth.users on delete set null,
  decided_at    timestamptz not null default clock_timestamp(),
  operation     text        not null
);

create index if not exists aid_operations_by_actor on public.aid_operations (actor);
create index if not exists aid_offers_by_student on public.aid_offers (tenant_id, student_ref);
create index if not exists aid_offers_by_creator on public.aid_offers (created_by);
create index if not exists aid_offer_versions_by_offer on public.aid_offer_versions (offer_id, version desc);
create index if not exists aid_offer_versions_by_tenant on public.aid_offer_versions (tenant_id);
create index if not exists aid_offer_versions_by_proposer on public.aid_offer_versions (proposed_by);
create index if not exists aid_offer_approvals_by_tenant on public.aid_offer_approvals (tenant_id);
create index if not exists aid_offer_approvals_by_approver on public.aid_offer_approvals (approved_by);
create index if not exists aid_offer_responses_by_tenant on public.aid_offer_responses (tenant_id);
create index if not exists aid_offer_responses_by_responder on public.aid_offer_responses (responder);
create index if not exists aid_disbursements_by_version on public.aid_disbursements (offer_version_id, component_key);
create index if not exists aid_disbursements_by_tenant on public.aid_disbursements (tenant_id);
create index if not exists aid_disbursements_by_disburser on public.aid_disbursements (disbursed_by);
create index if not exists aid_sap_policies_by_setter on public.aid_sap_policies (set_by);
create index if not exists aid_sap_evaluations_by_student on public.aid_sap_evaluations (tenant_id, student_ref, evaluated_at desc);
create index if not exists aid_sap_evaluations_by_policy on public.aid_sap_evaluations (policy_id);
create index if not exists aid_sap_evaluations_by_evaluator on public.aid_sap_evaluations (evaluated_by);
create index if not exists aid_sap_determinations_by_student on public.aid_sap_determinations (tenant_id, student_ref, aid_year, decided_at desc);
create index if not exists aid_sap_determinations_by_evaluation on public.aid_sap_determinations (evaluation_id);
create index if not exists aid_sap_determinations_by_decider on public.aid_sap_determinations (decided_by);

comment on table public.aid_operations is 'Idempotency keys the aid writers spent, with what each asked and answered. Append-only.';
comment on table public.aid_offers is 'A student''s offer for one aid year; its content is in the versions.';
comment on table public.aid_offer_versions is 'One version of an offer: named components in cents. Never edited; a change is a new version.';
comment on table public.aid_offer_approvals is 'That a second person approved a version. Until then the student reads nothing of it.';
comment on table public.aid_offer_responses is 'The student''s answer to one component of an approved version. Once.';
comment on table public.aid_disbursements is 'A record that an amount of an accepted component went out for a term, by reference. Nothing here moves money.';
comment on table public.aid_sap_policies is 'A school''s progress policy, versioned and never edited.';
comment on table public.aid_sap_evaluations is 'The figures the rule computed from the academic record and what each says against the policy.';
comment on table public.aid_sap_determinations is 'What a person decided about a student''s standing for an aid year, with the reason.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- Every row here is append-only; only `ON DELETE SET NULL` of the staff or
-- student account that named it may touch one.
create or replace function private.guard_aid_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  person_col text := case tg_table_name
    when 'aid_offers' then 'created_by'
    when 'aid_offer_versions' then 'proposed_by'
    when 'aid_offer_approvals' then 'approved_by'
    when 'aid_offer_responses' then 'responder'
    when 'aid_disbursements' then 'disbursed_by'
    when 'aid_sap_policies' then 'set_by'
    when 'aid_sap_evaluations' then 'evaluated_by'
    when 'aid_sap_determinations' then 'decided_by'
    else null end;
  was uuid;
  became uuid;
begin
  if person_col is not null then
    was := (to_jsonb(old) ->> person_col)::uuid;
    became := (to_jsonb(new) ->> person_col)::uuid;
    if (to_jsonb(new) - person_col) is not distinct from (to_jsonb(old) - person_col) and (became is null or became is not distinct from was) then
      return new;
    end if;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_aid_record() from public, anon, authenticated;

drop trigger if exists aid_offers_never_rewritten on public.aid_offers;
create trigger aid_offers_never_rewritten before update on public.aid_offers for each row execute function private.guard_aid_record();
drop trigger if exists aid_offer_versions_never_rewritten on public.aid_offer_versions;
create trigger aid_offer_versions_never_rewritten before update on public.aid_offer_versions for each row execute function private.guard_aid_record();
drop trigger if exists aid_offer_approvals_never_rewritten on public.aid_offer_approvals;
create trigger aid_offer_approvals_never_rewritten before update on public.aid_offer_approvals for each row execute function private.guard_aid_record();
drop trigger if exists aid_offer_responses_never_rewritten on public.aid_offer_responses;
create trigger aid_offer_responses_never_rewritten before update on public.aid_offer_responses for each row execute function private.guard_aid_record();
drop trigger if exists aid_disbursements_never_rewritten on public.aid_disbursements;
create trigger aid_disbursements_never_rewritten before update on public.aid_disbursements for each row execute function private.guard_aid_record();
drop trigger if exists aid_sap_policies_never_rewritten on public.aid_sap_policies;
create trigger aid_sap_policies_never_rewritten before update on public.aid_sap_policies for each row execute function private.guard_aid_record();
drop trigger if exists aid_sap_evaluations_never_rewritten on public.aid_sap_evaluations;
create trigger aid_sap_evaluations_never_rewritten before update on public.aid_sap_evaluations for each row execute function private.guard_aid_record();
drop trigger if exists aid_sap_determinations_never_rewritten on public.aid_sap_determinations;
create trigger aid_sap_determinations_never_rewritten before update on public.aid_sap_determinations for each row execute function private.guard_aid_record();

-- An approval is never by the person who proposed the version, whatever wrote it.
create or replace function private.guard_aid_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.aid_offer_versions v where v.id = new.offer_version_id and v.proposed_by is not null and v.proposed_by = new.approved_by) then
    raise exception 'semester: an offer is approved by someone other than who proposed it' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_aid_approval() from public, anon, authenticated;
drop trigger if exists aid_offer_approvals_not_by_proposer on public.aid_offer_approvals;
create trigger aid_offer_approvals_not_by_proposer before insert on public.aid_offer_approvals for each row execute function private.guard_aid_approval();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.aid_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('aid:read', 'school', want_tenant);
$$;
revoke all on function private.aid_staff(text) from public, anon, authenticated;
grant execute on function private.aid_staff(text) to authenticated;

create or replace function private.aid_is_subject(want_tenant text, want_student text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.academic_record_subjects s
                  where s.tenant_id = want_tenant and s.student_ref = want_student and s.user_id = (select auth.uid()));
$$;
revoke all on function private.aid_is_subject(text, text) from public, anon, authenticated;
grant execute on function private.aid_is_subject(text, text) to authenticated;

-- Whether a version is approved (the student reads only approved versions).
create or replace function private.aid_approved(want_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.aid_offer_approvals a where a.offer_version_id = want_version);
$$;
revoke all on function private.aid_approved(uuid) from public, anon, authenticated;
grant execute on function private.aid_approved(uuid) to authenticated;

-- Whether any version of an offer is approved.
create or replace function private.aid_offer_approved(want_offer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.aid_offer_versions v join public.aid_offer_approvals a on a.offer_version_id = v.id where v.offer_id = want_offer);
$$;
revoke all on function private.aid_offer_approved(uuid) from public, anon, authenticated;
grant execute on function private.aid_offer_approved(uuid) to authenticated;

alter table public.aid_operations enable row level security;
alter table public.aid_offers enable row level security;
alter table public.aid_offer_versions enable row level security;
alter table public.aid_offer_approvals enable row level security;
alter table public.aid_offer_responses enable row level security;
alter table public.aid_disbursements enable row level security;
alter table public.aid_sap_policies enable row level security;
alter table public.aid_sap_evaluations enable row level security;
alter table public.aid_sap_determinations enable row level security;

revoke all on table public.aid_operations from public, anon, authenticated;
revoke all on table public.aid_offers from public, anon, authenticated;
revoke all on table public.aid_offer_versions from public, anon, authenticated;
revoke all on table public.aid_offer_approvals from public, anon, authenticated;
revoke all on table public.aid_offer_responses from public, anon, authenticated;
revoke all on table public.aid_disbursements from public, anon, authenticated;
revoke all on table public.aid_sap_policies from public, anon, authenticated;
revoke all on table public.aid_sap_evaluations from public, anon, authenticated;
revoke all on table public.aid_sap_determinations from public, anon, authenticated;
grant select on table public.aid_operations to authenticated;
grant select on table public.aid_offers to authenticated;
grant select on table public.aid_offer_versions to authenticated;
grant select on table public.aid_offer_approvals to authenticated;
grant select on table public.aid_offer_responses to authenticated;
grant select on table public.aid_disbursements to authenticated;
grant select on table public.aid_sap_policies to authenticated;
grant select on table public.aid_sap_evaluations to authenticated;
grant select on table public.aid_sap_determinations to authenticated;

drop policy if exists "callers read their own aid operations" on public.aid_operations;
create policy "callers read their own aid operations" on public.aid_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "staff, and the student once an offer is approved" on public.aid_offers;
create policy "staff, and the student once an offer is approved" on public.aid_offers
  for select to authenticated using (private.aid_staff(tenant_id) or (private.aid_is_subject(tenant_id, student_ref) and private.aid_offer_approved(id)));

drop policy if exists "staff, and the student for approved versions" on public.aid_offer_versions;
create policy "staff, and the student for approved versions" on public.aid_offer_versions
  for select to authenticated using (
    private.aid_staff(tenant_id)
    or (private.aid_approved(id) and exists (select 1 from public.aid_offers o where o.id = offer_id and private.aid_is_subject(o.tenant_id, o.student_ref))));

drop policy if exists "whoever reads the version reads its approval" on public.aid_offer_approvals;
create policy "whoever reads the version reads its approval" on public.aid_offer_approvals
  for select to authenticated using (exists (select 1 from public.aid_offer_versions v where v.id = offer_version_id));

drop policy if exists "whoever reads the version reads its answers" on public.aid_offer_responses;
create policy "whoever reads the version reads its answers" on public.aid_offer_responses
  for select to authenticated using (exists (select 1 from public.aid_offer_versions v where v.id = offer_version_id));

drop policy if exists "whoever reads the version reads its disbursements" on public.aid_disbursements;
create policy "whoever reads the version reads its disbursements" on public.aid_disbursements
  for select to authenticated using (exists (select 1 from public.aid_offer_versions v where v.id = offer_version_id));

drop policy if exists "staff read the progress policy" on public.aid_sap_policies;
create policy "staff read the progress policy" on public.aid_sap_policies
  for select to authenticated using (private.aid_staff(tenant_id));

drop policy if exists "staff and the student read an evaluation" on public.aid_sap_evaluations;
create policy "staff and the student read an evaluation" on public.aid_sap_evaluations
  for select to authenticated using (private.aid_staff(tenant_id) or private.aid_is_subject(tenant_id, student_ref));

drop policy if exists "staff and the student read a determination" on public.aid_sap_determinations;
create policy "staff and the student read a determination" on public.aid_sap_determinations
  for select to authenticated using (private.aid_staff(tenant_id) or private.aid_is_subject(tenant_id, student_ref));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.aid_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.aid_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('aid-op:' || school || ':' || want_key));
  select * into op from public.aid_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.aid_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.aid_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.aid_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.aid_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.aid_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'financial_aid') then
    raise exception 'semester: this school does not run financial aid in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.aid_core_required(text) from public, anon, authenticated;

create or replace function private.aid_require(school text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'school', school) then
    raise exception 'semester: that needs % at this school', want_cap using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.aid_require(text, text) from public, anon, authenticated;

-- The student's latest standing for an aid year, or null if none has been decided.
create or replace function private.aid_standing(want_tenant text, want_student text, want_year text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.determination from public.aid_sap_determinations d
   where d.tenant_id = want_tenant and d.student_ref = want_student and d.aid_year = want_year
   order by d.decided_at desc, d.id desc limit 1;
$$;
revoke all on function private.aid_standing(text, text, text) from public, anon, authenticated;

-- The SAP figures for a student from the academic-record ledger as of today.
-- Attempted: every graded course's credits (a failure or withdrawal counts) and
-- transfer credit. Earned: credits passed, and transfer credit. GPA: letter
-- grades weighted by credits. A course with no credit entry counts for nothing,
-- and `unknown` says how many.
create or replace function private.aid_sap_figures(want_tenant text, want_student text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with in_effect as (
    select distinct on (e.kind, e.subject_key) e.kind, e.subject_key, e.action, e.value
      from public.academic_record_entries e
     where e.tenant_id = want_tenant and e.student_ref = want_student
       and e.kind in ('grade', 'credit', 'transfer_credit') and e.effective_on <= current_date
     order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc),
  graded as (
    select g.subject_key, upper(btrim(g.value)) as grade,
           case when btrim(c.value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(c.value)::numeric end as credits
      from in_effect g left join in_effect c on c.kind = 'credit' and c.action = 'set' and c.subject_key = g.subject_key
     where g.kind = 'grade' and g.action = 'set'),
  transfer as (
    select coalesce(sum(case when btrim(value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(value)::numeric end), 0) as credits
      from in_effect where kind = 'transfer_credit' and action = 'set')
  select jsonb_build_object(
    'attempted', coalesce((select sum(credits) from graded where credits is not null), 0) + (select credits from transfer),
    'earned', coalesce((select sum(credits) from graded where credits is not null
                         and (coalesce(private.degree_points(grade), -1) >= 0.7 or grade = 'P')), 0) + (select credits from transfer),
    'gpa_points', coalesce((select sum(private.degree_points(grade) * credits) from graded where credits is not null and private.degree_points(grade) is not null), 0),
    'gpa_credits', coalesce((select sum(credits) from graded where credits is not null and private.degree_points(grade) is not null), 0),
    'unknown', (select count(*) from graded where credits is null));
$$;
revoke all on function private.aid_sap_figures(text, text) from public, anon, authenticated;

-- ── Offers ──────────────────────────────────────────────────────────────

-- components: [{key, kind: grant|scholarship|loan|work_study, name, amount_cents}].
create or replace function public.aid_offer_propose(want_student text, want_year text, want_components jsonb, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('student', want_student, 'year', want_year, 'components', want_components, 'note', coalesce(want_note, ''));
  prior  jsonb;
  offer  uuid;
  v      integer;
  made   uuid;
  c      jsonb;
  keys   text[] := '{}';
  result jsonb;
begin
  perform private.aid_require(school, 'aid:propose');
  prior := private.aid_replay(school, want_key, 'propose', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  if want_student is null or want_student !~ '^[A-Za-z0-9._-]{1,64}$' or want_year is null or want_year !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'semester: a student reference and an aid year like 2026-27' using errcode = 'check_violation';
  end if;
  if want_components is null or jsonb_typeof(want_components) <> 'array' or jsonb_array_length(want_components) = 0 then
    raise exception 'semester: an offer has at least one component' using errcode = 'check_violation';
  end if;
  for c in select * from jsonb_array_elements(want_components) loop
    if coalesce(c->>'key', '') !~ '^[a-z0-9_]{1,40}$' or coalesce(c->>'kind', '') not in ('grant', 'scholarship', 'loan', 'work_study')
       or length(btrim(coalesce(c->>'name', ''))) = 0 or coalesce(c->>'amount_cents', '') !~ '^[0-9]{1,9}$' or (c->>'amount_cents')::bigint <= 0 then
      raise exception 'semester: each component has a key, a kind, a name and an amount in cents' using errcode = 'check_violation';
    end if;
    if (c->>'key') = any(keys) then raise exception 'semester: each component has its own key' using errcode = 'check_violation'; end if;
    keys := keys || (c->>'key');
  end loop;
  if not exists (select 1 from public.academic_record_entries e where e.tenant_id = school and e.student_ref = want_student) then
    raise exception 'semester: that student has nothing on the record' using errcode = 'no_data_found';
  end if;

  insert into public.aid_offers (tenant_id, student_ref, aid_year, created_by) values (school, want_student, want_year, me)
  on conflict (tenant_id, student_ref, aid_year) do nothing;
  select o.id into offer from public.aid_offers o where o.tenant_id = school and o.student_ref = want_student and o.aid_year = want_year for update;
  select coalesce(max(x.version), 0) + 1 into v from public.aid_offer_versions x where x.offer_id = offer;
  insert into public.aid_offer_versions (tenant_id, offer_id, version, components, note, proposed_by, operation)
  values (school, offer, v, want_components, btrim(coalesce(want_note, '')), me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'offer', offer, 'version', v);
  perform private.aid_spend(school, want_key, 'propose', req, result);
  return result;
end $$;

create or replace function public.aid_offer_approve(want_version uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('version', want_version);
  prior  jsonb;
  v      public.aid_offer_versions;
  newest integer;
  result jsonb;
begin
  perform private.aid_require(school, 'aid:approve');
  prior := private.aid_replay(school, want_key, 'approve', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  select * into v from public.aid_offer_versions x where x.id = want_version and x.tenant_id = school;
  if v.id is null then raise exception 'semester: no such offer version' using errcode = 'no_data_found'; end if;
  if v.proposed_by is not distinct from me then
    raise exception 'semester: an offer is approved by someone other than who proposed it' using errcode = 'insufficient_privilege';
  end if;
  select max(x.version) into newest from public.aid_offer_versions x where x.offer_id = v.offer_id;
  if v.version <> newest then raise exception 'semester: that version has been superseded by a newer one' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.aid_offer_approvals a where a.offer_version_id = want_version) then
    raise exception 'semester: that version is already approved' using errcode = 'check_violation';
  end if;
  insert into public.aid_offer_approvals (offer_version_id, tenant_id, approved_by) values (want_version, school, me);
  result := jsonb_build_object('id', want_version, 'approved', true);
  perform private.aid_spend(school, want_key, 'approve', req, result);
  return result;
end $$;

create or replace function public.aid_offer_respond(want_version uuid, want_component text, want_response text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  v      public.aid_offer_versions;
  o      public.aid_offers;
  req    jsonb := jsonb_build_object('version', want_version, 'component', want_component, 'response', want_response);
  prior  jsonb;
  newest integer;
  result jsonb;
begin
  select * into v from public.aid_offer_versions x where x.id = want_version;
  if v.id is null then raise exception 'semester: no such offer' using errcode = 'no_data_found'; end if;
  select * into o from public.aid_offers x where x.id = v.offer_id;
  if not private.aid_is_subject(o.tenant_id, o.student_ref) or not private.aid_approved(want_version) then
    raise exception 'semester: no such offer' using errcode = 'no_data_found';
  end if;
  prior := private.aid_replay(o.tenant_id, want_key, 'respond', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(o.tenant_id);
  if want_response not in ('accept', 'decline') then raise exception 'semester: accept or decline' using errcode = 'check_violation'; end if;
  select max(x.version) into newest from public.aid_offer_versions x join public.aid_offer_approvals a on a.offer_version_id = x.id where x.offer_id = v.offer_id;
  if v.version <> newest then raise exception 'semester: that offer has been replaced by a newer one' using errcode = 'check_violation'; end if;
  if not exists (select 1 from jsonb_array_elements(v.components) c where c->>'key' = want_component) then
    raise exception 'semester: that is not a part of this offer' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.aid_offer_responses r where r.offer_version_id = want_version and r.component_key = want_component) then
    raise exception 'semester: you have already answered that part' using errcode = 'check_violation';
  end if;
  insert into public.aid_offer_responses (offer_version_id, component_key, tenant_id, response, responder) values (want_version, want_component, o.tenant_id, want_response, me);
  result := jsonb_build_object('component', want_component, 'response', want_response);
  perform private.aid_spend(o.tenant_id, want_key, 'respond', req, result);
  return result;
end $$;

create or replace function public.aid_disburse(want_version uuid, want_component text, want_term text, want_amount_cents bigint, want_reference text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('version', want_version, 'component', want_component, 'term', want_term, 'amount', want_amount_cents, 'reference', coalesce(want_reference, ''));
  prior   jsonb;
  v       public.aid_offer_versions;
  o       public.aid_offers;
  newest  integer;
  held    bigint;
  already bigint;
  made    uuid;
  result  jsonb;
begin
  perform private.aid_require(school, 'aid:disburse');
  prior := private.aid_replay(school, want_key, 'disburse', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  select * into v from public.aid_offer_versions x where x.id = want_version and x.tenant_id = school;
  if v.id is null then raise exception 'semester: no such offer version' using errcode = 'no_data_found'; end if;
  select * into o from public.aid_offers x where x.id = v.offer_id for update;
  if not private.aid_approved(want_version) then raise exception 'semester: that version is not approved' using errcode = 'check_violation'; end if;
  select max(x.version) into newest from public.aid_offer_versions x join public.aid_offer_approvals a on a.offer_version_id = x.id where x.offer_id = v.offer_id;
  if v.version <> newest then raise exception 'semester: that offer has been replaced by a newer approved version' using errcode = 'check_violation'; end if;
  select (c->>'amount_cents')::bigint into held from jsonb_array_elements(v.components) c where c->>'key' = want_component;
  if held is null then raise exception 'semester: that is not a part of this offer' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.aid_offer_responses r where r.offer_version_id = want_version and r.component_key = want_component and r.response = 'accept') then
    raise exception 'semester: that part has not been accepted by the student' using errcode = 'check_violation';
  end if;
  if private.aid_standing(school, o.student_ref, o.aid_year) = 'suspended' then
    raise exception 'semester: this student''s standing for % is suspended; aid is not disbursed', o.aid_year using errcode = 'check_violation';
  end if;
  if want_amount_cents is null or want_amount_cents <= 0 then raise exception 'semester: an amount in cents above zero' using errcode = 'check_violation'; end if;
  select coalesce(sum(d.amount_cents), 0) into already from public.aid_disbursements d where d.offer_version_id = want_version and d.component_key = want_component;
  if already + want_amount_cents > held then
    raise exception 'semester: that is more than this part holds (% of % cents already disbursed)', already, held using errcode = 'check_violation';
  end if;
  insert into public.aid_disbursements (tenant_id, offer_version_id, component_key, term, amount_cents, reference, disbursed_by, operation)
  values (school, want_version, want_component, want_term, want_amount_cents, btrim(coalesce(want_reference, '')), me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'remaining_cents', held - already - want_amount_cents);
  perform private.aid_spend(school, want_key, 'disburse', req, result);
  return result;
end $$;

-- ── Satisfactory academic progress ──────────────────────────────────────

create or replace function public.aid_sap_policy_set(want_min_gpa numeric, want_min_completion numeric, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('min_gpa', want_min_gpa, 'min_completion', want_min_completion, 'note', coalesce(want_note, ''));
  prior  jsonb;
  v      integer;
  made   uuid;
  result jsonb;
begin
  perform private.aid_require(school, 'aid:determine');
  prior := private.aid_replay(school, want_key, 'policy', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  perform pg_advisory_xact_lock(hashtext('aid-policy:' || school));
  select coalesce(max(p.version), 0) + 1 into v from public.aid_sap_policies p where p.tenant_id = school;
  insert into public.aid_sap_policies (tenant_id, version, min_gpa, min_completion_pct, note, set_by, operation)
  values (school, v, want_min_gpa, want_min_completion, btrim(coalesce(want_note, '')), me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'version', v);
  perform private.aid_spend(school, want_key, 'policy', req, result);
  return result;
end $$;

create or replace function public.aid_sap_evaluate(want_student text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('student', want_student);
  prior   jsonb;
  pol     public.aid_sap_policies;
  f       jsonb;
  gpa     numeric;
  pct     numeric;
  fp      text;
  made    uuid;
  result  jsonb;
begin
  perform private.aid_require(school, 'aid:evaluate');
  prior := private.aid_replay(school, want_key, 'evaluate', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  select * into pol from public.aid_sap_policies p where p.tenant_id = school order by p.version desc limit 1;
  if pol.id is null then raise exception 'semester: this school has not set a progress policy' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.academic_record_entries e where e.tenant_id = school and e.student_ref = want_student) then
    raise exception 'semester: that student has nothing on the record' using errcode = 'no_data_found';
  end if;
  f := private.aid_sap_figures(school, want_student);
  gpa := case when (f->>'gpa_credits')::numeric > 0 then round((f->>'gpa_points')::numeric / (f->>'gpa_credits')::numeric, 3) end;
  pct := case when (f->>'attempted')::numeric > 0 then round((f->>'earned')::numeric / (f->>'attempted')::numeric * 100, 2) end;
  select encode(sha256(convert_to(coalesce(string_agg(e.id::text || e.recorded_at::text, ',' order by e.id), ''), 'UTF8')), 'hex')
    into fp from public.academic_record_entries e
   where e.tenant_id = school and e.student_ref = want_student and e.kind in ('grade', 'credit', 'transfer_credit');
  insert into public.aid_sap_evaluations (tenant_id, student_ref, policy_id, as_of, gpa, attempted, earned, completion_pct, meets_gpa, meets_completion, fingerprint, evaluated_by, operation)
  values (school, want_student, pol.id, current_date, gpa, (f->>'attempted')::numeric, (f->>'earned')::numeric, pct,
          coalesce(gpa >= pol.min_gpa, false), coalesce(pct >= pol.min_completion_pct, false), fp, me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made, 'gpa', trim_scale(gpa), 'attempted', trim_scale((f->>'attempted')::numeric), 'earned', trim_scale((f->>'earned')::numeric),
    'completion_pct', trim_scale(pct), 'meets_gpa', coalesce(gpa >= pol.min_gpa, false), 'meets_completion', coalesce(pct >= pol.min_completion_pct, false),
    'credits_without_an_entry', (f->>'unknown')::int);
  perform private.aid_spend(school, want_key, 'evaluate', req, result);
  return result;
end $$;

create or replace function public.aid_sap_determine(want_evaluation uuid, want_year text, want_determination text, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('evaluation', want_evaluation, 'year', want_year, 'determination', want_determination, 'reason', coalesce(want_reason, ''));
  prior  jsonb;
  ev     public.aid_sap_evaluations;
  standing text;
  made   uuid;
  result jsonb;
begin
  perform private.aid_require(school, 'aid:determine');
  prior := private.aid_replay(school, want_key, 'determine', req);
  if prior is not null then return prior; end if;
  perform private.aid_core_required(school);
  select * into ev from public.aid_sap_evaluations x where x.id = want_evaluation and x.tenant_id = school;
  if ev.id is null then raise exception 'semester: no such evaluation' using errcode = 'no_data_found'; end if;
  if ev.evaluated_by is not distinct from me then
    raise exception 'semester: a determination is made by someone other than who ran the evaluation' using errcode = 'insufficient_privilege';
  end if;
  if want_determination not in ('satisfactory', 'warning', 'suspended', 'reinstated') then
    raise exception 'semester: satisfactory, warning, suspended or reinstated' using errcode = 'check_violation';
  end if;
  if want_year is null or want_year !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'semester: an aid year like 2026-27' using errcode = 'check_violation'; end if;
  if want_determination = 'satisfactory' and not (ev.meets_gpa and ev.meets_completion) then
    raise exception 'semester: that evaluation does not meet the policy, so it cannot be satisfactory; a warning, suspension or reinstatement is a person''s call' using errcode = 'check_violation';
  end if;
  standing := private.aid_standing(school, ev.student_ref, want_year);
  if want_determination = 'reinstated' and (standing is distinct from 'suspended' or length(btrim(coalesce(want_reason, ''))) < 20) then
    raise exception 'semester: a reinstatement follows a suspension and says why in at least twenty characters' using errcode = 'check_violation';
  end if;
  insert into public.aid_sap_determinations (tenant_id, evaluation_id, student_ref, aid_year, determination, reason, decided_by, operation)
  values (school, want_evaluation, ev.student_ref, want_year, want_determination, btrim(coalesce(want_reason, '')), me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'determination', want_determination);
  perform private.aid_spend(school, want_key, 'determine', req, result);
  return result;
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.aid_offer_propose(text, text, jsonb, text, text) from public, anon;
revoke all on function public.aid_offer_approve(uuid, text) from public, anon;
revoke all on function public.aid_offer_respond(uuid, text, text, text) from public, anon;
revoke all on function public.aid_disburse(uuid, text, text, bigint, text, text) from public, anon;
revoke all on function public.aid_sap_policy_set(numeric, numeric, text, text) from public, anon;
revoke all on function public.aid_sap_evaluate(text, text) from public, anon;
revoke all on function public.aid_sap_determine(uuid, text, text, text, text) from public, anon;
grant execute on function public.aid_offer_propose(text, text, jsonb, text, text) to authenticated;
grant execute on function public.aid_offer_approve(uuid, text) to authenticated;
grant execute on function public.aid_offer_respond(uuid, text, text, text) to authenticated;
grant execute on function public.aid_disburse(uuid, text, text, bigint, text, text) to authenticated;
grant execute on function public.aid_sap_policy_set(numeric, numeric, text, text) to authenticated;
grant execute on function public.aid_sap_evaluate(text, text) to authenticated;
grant execute on function public.aid_sap_determine(uuid, text, text, text, text) to authenticated;

-- No student-owned user column lives in these tables (a student is a
-- `student_ref` linked through the ledger; `responder` is the account that
-- answered, cleared on deletion), so `lti_account_untouched` needs no new row.
