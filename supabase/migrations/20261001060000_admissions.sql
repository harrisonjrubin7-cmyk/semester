-- Semester — admissions for a school that runs the `admissions` module in Core
-- (D-151): an applicant's own application, a document checklist, reviews, a
-- decision a person makes and a release date, the applicant's response and the
-- deposit that holds a place.
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- ## What the database decides
--
--   * **Only in Core.** Every function refuses unless the school's `admissions`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **An applicant is an account before it is a student.** Any signed-in
--     account may start one application in an open cycle; it reads and writes
--     only its own. The staff side is two new roles, `admissions_officer`
--     (configures a cycle, reviews, marks documents, records a deposit) and
--     `admissions_director` (decides, releases), over the school.
--   * **A cycle's questions and checklist are fixed when it opens.** A school
--     configures a cycle as a draft; opening it freezes both, so every applicant
--     answered the same questions.
--   * **A submitted application is frozen.** Answers change only while it is a
--     draft; submitting needs every required question answered; withdrawing is
--     the only thing a submitted application can still do.
--   * **A person decides every admission.** A decision (`admit`, `deny`,
--     `waitlist`) is recorded by someone holding `admissions:decide`, only on a
--     submitted application, only after at least one review by *someone else*,
--     only when every required document is received or waived, never on their
--     own application. No score, ranking or model writes one. It is never
--     rewritten; a change is a new decision recorded as a correction with its
--     reason (the earlier one stays).
--   * **A decision is private until it is released.** `admissions_release`
--     publishes a cycle's decisions together; before that the applicant reads
--     nothing about theirs and reviewers' notes are never the applicant's.
--   * **A response and a deposit are the applicant's and the office's.** Only an
--     applicant with a released `admit` accepts or declines it; an officer
--     records that a deposit was received, by reference (no card or bank detail
--     lives here; money moves through the student-accounts ledger).
--   * **History.** Every step writes an append-only event: who, what, when.
--
-- Not here, on purpose: scoring or ranking applicants, any model-written
-- decision or summary of an applicant, and a document upload (a checklist item
-- is promised by the applicant and received by an officer; files follow the
-- assignments storage pattern when a school wants them).

-- ── Roles and capabilities ──────────────────────────────────────────────

insert into public.app_roles (role, global) values
  ('admissions_officer',  false),
  ('admissions_director', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('admissions:configure', 'Write and open an admission cycle: its questions and document checklist, for one school.'),
  ('admissions:review',    'Read applications, record a review, mark documents received and record a deposit, for one school.'),
  ('admissions:decide',    'Record an admission decision and release a cycle''s decisions, for one school. Never on their own application.'),
  ('admissions:read',      'Read every application, review, decision and the yield counts, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('admissions_officer',  'admissions:configure'),
  ('admissions_director', 'admissions:configure'),
  ('admissions_officer',  'admissions:review'),
  ('admissions_director', 'admissions:review'),
  ('admissions_director', 'admissions:decide'),
  ('admissions_officer',  'admissions:read'),
  ('admissions_director', 'admissions:read')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.admissions_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('cycle', 'open', 'close', 'start', 'save', 'submit', 'withdraw', 'document', 'review', 'decide', 'release', 'respond', 'deposit')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.admission_cycles (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  name       text        not null check (length(btrim(name)) between 1 and 200),
  term       text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  questions  jsonb       not null,
  checklist  jsonb       not null,
  created_by uuid        references auth.users on delete set null,
  opened_at  timestamptz,
  closed_at  timestamptz,
  operation  text        not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint admission_cycle_window check (closes_at > opens_at)
);

create table if not exists public.applications (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  cycle_id     uuid        not null references public.admission_cycles on delete cascade,
  applicant    uuid        not null references auth.users on delete cascade,
  answers      jsonb       not null default '{}'::jsonb,
  status       text        not null default 'draft' check (status in ('draft', 'submitted', 'withdrawn')),
  created_at   timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  unique (cycle_id, applicant),
  constraint application_submitted check ((status = 'draft') = (submitted_at is null and withdrawn_at is null) or status <> 'draft')
);

create table if not exists public.application_events (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  application_id uuid        not null references public.applications on delete cascade,
  kind           text        not null check (kind in ('started', 'submitted', 'withdrawn', 'document_sent', 'document_received', 'document_waived', 'reviewed', 'decided', 'released', 'accepted', 'declined', 'deposit_received')),
  detail         text        not null default '' check (length(detail) <= 500),
  actor          uuid        references auth.users on delete set null,
  at             timestamptz not null default clock_timestamp()
);

create table if not exists public.application_documents (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  application_id uuid        not null references public.applications on delete cascade,
  doc_key        text        not null check (doc_key ~ '^[a-z0-9_]{1,40}$'),
  version        integer     not null check (version >= 1),
  state          text        not null check (state in ('sent', 'received', 'waived')),
  note           text        not null default '' check (length(note) <= 500),
  actor          uuid        references auth.users on delete set null,
  at             timestamptz not null default clock_timestamp(),
  unique (application_id, doc_key, version)
);

create table if not exists public.application_reviews (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  application_id uuid        not null references public.applications on delete cascade,
  reviewer       uuid        references auth.users on delete set null,
  recommendation text        not null check (recommendation in ('admit', 'deny', 'waitlist', 'discuss')),
  notes          text        not null check (length(btrim(notes)) between 1 and 4000),
  at             timestamptz not null default clock_timestamp(),
  operation      text        not null
);

create table if not exists public.application_decisions (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  application_id uuid        not null references public.applications on delete cascade,
  version        integer     not null check (version >= 1),
  decision       text        not null check (decision in ('admit', 'deny', 'waitlist')),
  conditions     text        not null default '' check (length(conditions) <= 1000),
  reason         text        not null check (length(btrim(reason)) between 10 and 2000),
  decided_by     uuid        references auth.users on delete set null,
  decided_at     timestamptz not null default clock_timestamp(),
  operation      text        not null,
  unique (application_id, version)
);

create table if not exists public.application_decision_releases (
  application_id uuid        primary key references public.applications on delete cascade,
  tenant_id      text        not null references public.schools(id) on delete cascade,
  decision_id    uuid        not null references public.application_decisions,
  released_by    uuid        references auth.users on delete set null,
  released_at    timestamptz not null default clock_timestamp()
);

create table if not exists public.application_responses (
  application_id uuid        primary key references public.applications on delete cascade,
  tenant_id      text        not null references public.schools(id) on delete cascade,
  response       text        not null check (response in ('accept', 'decline')),
  at             timestamptz not null default clock_timestamp()
);

create table if not exists public.application_deposits (
  application_id uuid        primary key references public.applications on delete cascade,
  tenant_id      text        not null references public.schools(id) on delete cascade,
  reference      text        not null check (length(btrim(reference)) between 3 and 120),
  received_by    uuid        references auth.users on delete set null,
  received_at    timestamptz not null default clock_timestamp()
);

create index if not exists admissions_operations_by_actor on public.admissions_operations (actor);
create index if not exists admission_cycles_by_tenant on public.admission_cycles (tenant_id);
create index if not exists admission_cycles_by_creator on public.admission_cycles (created_by);
create index if not exists applications_by_tenant on public.applications (tenant_id, cycle_id);
create index if not exists applications_by_applicant on public.applications (applicant);
create index if not exists application_events_by_application on public.application_events (application_id, at);
create index if not exists application_events_by_tenant on public.application_events (tenant_id);
create index if not exists application_events_by_actor on public.application_events (actor);
create index if not exists application_documents_by_application on public.application_documents (application_id, doc_key, version desc);
create index if not exists application_documents_by_tenant on public.application_documents (tenant_id);
create index if not exists application_documents_by_actor on public.application_documents (actor);
create index if not exists application_reviews_by_application on public.application_reviews (application_id);
create index if not exists application_reviews_by_tenant on public.application_reviews (tenant_id);
create index if not exists application_reviews_by_reviewer on public.application_reviews (reviewer);
create index if not exists application_decisions_by_tenant on public.application_decisions (tenant_id);
create index if not exists application_decisions_by_decider on public.application_decisions (decided_by);
create index if not exists application_decision_releases_by_tenant on public.application_decision_releases (tenant_id);
create index if not exists application_decision_releases_by_decision on public.application_decision_releases (decision_id);
create index if not exists application_decision_releases_by_releaser on public.application_decision_releases (released_by);
create index if not exists application_responses_by_tenant on public.application_responses (tenant_id);
create index if not exists application_deposits_by_tenant on public.application_deposits (tenant_id);
create index if not exists application_deposits_by_receiver on public.application_deposits (received_by);

comment on table public.admissions_operations is 'Idempotency keys the admissions writers spent, with what each asked and answered. Append-only.';
comment on table public.admission_cycles is 'An admission cycle: its questions and document checklist, fixed when it opens.';
comment on table public.applications is 'One applicant''s application to one cycle. Answers change only while a draft. Goes with the applicant''s account.';
comment on table public.application_events is 'Every step of an application: who, what and when. Append-only.';
comment on table public.application_documents is 'A checklist item''s states, newest version last: sent by the applicant, received or waived by an officer. Append-only.';
comment on table public.application_reviews is 'A reviewer''s recommendation and notes. Staff-only; never the applicant''s. Append-only.';
comment on table public.application_decisions is 'A decision a person made, with the reason. Never rewritten; a change is a new version.';
comment on table public.application_decision_releases is 'When a decision was released to the applicant. Until then the applicant reads nothing about it.';
comment on table public.application_responses is 'The applicant''s answer to a released admit. Once.';
comment on table public.application_deposits is 'That a deposit was received, by reference. No payment detail lives here.';

-- ── Guards ──────────────────────────────────────────────────────────────

create or replace function private.guard_admission_cycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'created_by' - 'opened_at' - 'closed_at') is distinct from (to_jsonb(old) - 'created_by' - 'opened_at' - 'closed_at')
     or (new.created_by is distinct from old.created_by and new.created_by is not null)
     or (old.opened_at is not null and new.opened_at is distinct from old.opened_at)
     or (old.closed_at is not null and new.closed_at is distinct from old.closed_at)
     or (new.closed_at is not null and new.opened_at is null) then
    raise exception 'semester: a cycle''s questions and checklist are fixed; only opening and closing change it' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_admission_cycle() from public, anon, authenticated;

create or replace function private.guard_application()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'answers' - 'status' - 'submitted_at' - 'withdrawn_at') is distinct from (to_jsonb(old) - 'answers' - 'status' - 'submitted_at' - 'withdrawn_at') then
    raise exception 'semester: an application''s identity is never rewritten' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'withdrawn' then
    raise exception 'semester: a withdrawn application is never changed' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'submitted' and (new.answers is distinct from old.answers or new.status not in ('submitted', 'withdrawn')) then
    raise exception 'semester: a submitted application is frozen; it can only be withdrawn' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_application() from public, anon, authenticated;

-- Everything else here is never rewritten; only `ON DELETE SET NULL` of the
-- staff or applicant-side account column may touch a row.
create or replace function private.guard_admissions_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  staff_col text := case tg_table_name
    when 'application_events' then 'actor'
    when 'application_documents' then 'actor'
    when 'application_reviews' then 'reviewer'
    when 'application_decisions' then 'decided_by'
    when 'application_decision_releases' then 'released_by'
    when 'application_deposits' then 'received_by'
    else null end;
  was uuid;
  became uuid;
begin
  if staff_col is not null then
    was := (to_jsonb(old) ->> staff_col)::uuid;
    became := (to_jsonb(new) ->> staff_col)::uuid;
    if (to_jsonb(new) - staff_col) is not distinct from (to_jsonb(old) - staff_col) and (became is null or became is not distinct from was) then
      return new;
    end if;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_admissions_record() from public, anon, authenticated;

drop trigger if exists admission_cycles_frozen on public.admission_cycles;
create trigger admission_cycles_frozen before update on public.admission_cycles
for each row execute function private.guard_admission_cycle();
drop trigger if exists applications_frozen on public.applications;
create trigger applications_frozen before update on public.applications
for each row execute function private.guard_application();
drop trigger if exists application_events_never_rewritten on public.application_events;
create trigger application_events_never_rewritten before update on public.application_events
for each row execute function private.guard_admissions_record();
drop trigger if exists application_documents_never_rewritten on public.application_documents;
create trigger application_documents_never_rewritten before update on public.application_documents
for each row execute function private.guard_admissions_record();
drop trigger if exists application_reviews_never_rewritten on public.application_reviews;
create trigger application_reviews_never_rewritten before update on public.application_reviews
for each row execute function private.guard_admissions_record();
drop trigger if exists application_decisions_never_rewritten on public.application_decisions;
create trigger application_decisions_never_rewritten before update on public.application_decisions
for each row execute function private.guard_admissions_record();
drop trigger if exists application_decision_releases_never_rewritten on public.application_decision_releases;
create trigger application_decision_releases_never_rewritten before update on public.application_decision_releases
for each row execute function private.guard_admissions_record();
drop trigger if exists application_responses_never_rewritten on public.application_responses;
create trigger application_responses_never_rewritten before update on public.application_responses
for each row execute function private.guard_admissions_record();
drop trigger if exists application_deposits_never_rewritten on public.application_deposits;
create trigger application_deposits_never_rewritten before update on public.application_deposits
for each row execute function private.guard_admissions_record();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.admissions_cap(want_tenant text, want_cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability(want_cap, 'school', want_tenant);
$$;
revoke all on function private.admissions_cap(text, text) from public, anon, authenticated;

-- Staff who read applications: anyone holding review or read at the school.
create or replace function private.admissions_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.admissions_cap(want_tenant, 'admissions:read') or private.admissions_cap(want_tenant, 'admissions:review');
$$;
revoke all on function private.admissions_staff(text) from public, anon, authenticated;
grant execute on function private.admissions_staff(text) to authenticated;

-- Whether the caller owns an application.
create or replace function private.admissions_owns(want_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.applications a where a.id = want_application and a.applicant = (select auth.uid()));
$$;
revoke all on function private.admissions_owns(uuid) from public, anon, authenticated;
grant execute on function private.admissions_owns(uuid) to authenticated;

-- Whether a decision has been released to its applicant.
create or replace function private.admissions_released(want_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.application_decision_releases r where r.application_id = want_application);
$$;
revoke all on function private.admissions_released(uuid) from public, anon, authenticated;
grant execute on function private.admissions_released(uuid) to authenticated;

alter table public.admissions_operations enable row level security;
alter table public.admission_cycles enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_reviews enable row level security;
alter table public.application_decisions enable row level security;
alter table public.application_decision_releases enable row level security;
alter table public.application_responses enable row level security;
alter table public.application_deposits enable row level security;

revoke all on table public.admissions_operations from public, anon, authenticated;
revoke all on table public.admission_cycles from public, anon, authenticated;
revoke all on table public.applications from public, anon, authenticated;
revoke all on table public.application_events from public, anon, authenticated;
revoke all on table public.application_documents from public, anon, authenticated;
revoke all on table public.application_reviews from public, anon, authenticated;
revoke all on table public.application_decisions from public, anon, authenticated;
revoke all on table public.application_decision_releases from public, anon, authenticated;
revoke all on table public.application_responses from public, anon, authenticated;
revoke all on table public.application_deposits from public, anon, authenticated;
grant select on table public.admissions_operations to authenticated;
grant select on table public.admission_cycles to authenticated;
grant select on table public.applications to authenticated;
grant select on table public.application_events to authenticated;
grant select on table public.application_documents to authenticated;
grant select on table public.application_reviews to authenticated;
grant select on table public.application_decisions to authenticated;
grant select on table public.application_decision_releases to authenticated;
grant select on table public.application_responses to authenticated;
grant select on table public.application_deposits to authenticated;

drop policy if exists "callers read their own admissions operations" on public.admissions_operations;
create policy "callers read their own admissions operations" on public.admissions_operations
  for select to authenticated using (actor = (select auth.uid()));

-- A cycle is read by staff and by anyone holding an application to it. An open
-- cycle is found by its id, which an applicant is given by the school.
drop policy if exists "staff and applicants read a cycle" on public.admission_cycles;
create policy "staff and applicants read a cycle" on public.admission_cycles
  for select to authenticated using (
    private.admissions_staff(tenant_id)
    or exists (select 1 from public.applications a where a.cycle_id = admission_cycles.id and a.applicant = (select auth.uid())));

drop policy if exists "staff and the applicant read an application" on public.applications;
create policy "staff and the applicant read an application" on public.applications
  for select to authenticated using (applicant = (select auth.uid()) or private.admissions_staff(tenant_id));

drop policy if exists "staff and the applicant read its events" on public.application_events;
create policy "staff and the applicant read its events" on public.application_events
  for select to authenticated using (private.admissions_staff(tenant_id) or (private.admissions_owns(application_id) and kind not in ('reviewed', 'decided') ));

drop policy if exists "staff and the applicant read its documents" on public.application_documents;
create policy "staff and the applicant read its documents" on public.application_documents
  for select to authenticated using (private.admissions_staff(tenant_id) or private.admissions_owns(application_id));

drop policy if exists "only staff read reviews" on public.application_reviews;
create policy "only staff read reviews" on public.application_reviews
  for select to authenticated using (private.admissions_staff(tenant_id));

drop policy if exists "staff read decisions, applicants once released" on public.application_decisions;
create policy "staff read decisions, applicants once released" on public.application_decisions
  for select to authenticated using (
    private.admissions_staff(tenant_id) or (private.admissions_owns(application_id) and private.admissions_released(application_id)));

drop policy if exists "staff and the applicant read a release" on public.application_decision_releases;
create policy "staff and the applicant read a release" on public.application_decision_releases
  for select to authenticated using (private.admissions_staff(tenant_id) or private.admissions_owns(application_id));

drop policy if exists "staff and the applicant read a response" on public.application_responses;
create policy "staff and the applicant read a response" on public.application_responses
  for select to authenticated using (private.admissions_staff(tenant_id) or private.admissions_owns(application_id));

drop policy if exists "staff and the applicant read a deposit" on public.application_deposits;
create policy "staff and the applicant read a deposit" on public.application_deposits
  for select to authenticated using (private.admissions_staff(tenant_id) or private.admissions_owns(application_id));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.admissions_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.admissions_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('admissions-op:' || school || ':' || want_key));
  select * into op from public.admissions_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.admissions_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.admissions_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.admissions_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.admissions_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.admissions_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'admissions') then
    raise exception 'semester: this school does not run admissions in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.admissions_core_required(text) from public, anon, authenticated;

create or replace function private.admissions_require(school text, want_cap text)
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
revoke all on function private.admissions_require(text, text) from public, anon, authenticated;

create or replace function private.admissions_event(want_application uuid, want_tenant text, want_kind text, want_detail text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.application_events (tenant_id, application_id, kind, detail, actor)
  values (want_tenant, want_application, want_kind, coalesce(want_detail, ''), (select auth.uid()));
$$;
revoke all on function private.admissions_event(uuid, text, text, text) from public, anon, authenticated;

-- An application by its id, locked, for the writers that change it.
create or replace function private.admissions_application(want_application uuid)
returns public.applications
language sql
volatile
security definer
set search_path = ''
as $$
  select a from public.applications a where a.id = want_application for update;
$$;
revoke all on function private.admissions_application(uuid) from public, anon, authenticated;

-- Whether every required checklist item of a cycle is received or waived.
create or replace function private.admissions_documents_complete(want_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
      from public.applications a
      join public.admission_cycles c on c.id = a.cycle_id
      cross join lateral jsonb_array_elements(c.checklist) item
     where a.id = want_application
       and coalesce((item->>'required')::boolean, true)
       and coalesce((select d.state from public.application_documents d
                      where d.application_id = a.id and d.doc_key = item->>'key' order by d.version desc limit 1), 'none') not in ('received', 'waived'));
$$;
revoke all on function private.admissions_documents_complete(uuid) from public, anon, authenticated;

-- ── The school's writers ────────────────────────────────────────────────

-- questions: [{key, label, kind: 'text'|'choice', required, options?}];
-- checklist: [{key, label, required}].
create or replace function public.admissions_cycle_save(
  want_name text, want_term text, want_opens timestamptz, want_closes timestamptz,
  want_questions jsonb, want_checklist jsonb, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('name', want_name, 'term', want_term, 'opens', want_opens, 'closes', want_closes,
                    'questions', want_questions, 'checklist', want_checklist);
  prior  jsonb;
  q      jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:configure');
  prior := private.admissions_replay(school, want_key, 'cycle', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  if jsonb_typeof(want_questions) <> 'array' or jsonb_typeof(want_checklist) <> 'array' then
    raise exception 'semester: questions and the checklist are lists' using errcode = 'check_violation';
  end if;
  for q in select * from jsonb_array_elements(want_questions) loop
    if coalesce(q->>'key', '') !~ '^[a-z0-9_]{1,40}$' or length(btrim(coalesce(q->>'label', ''))) = 0 or coalesce(q->>'kind', '') not in ('text', 'choice') then
      raise exception 'semester: each question has a key, a label and a kind of text or choice' using errcode = 'check_violation';
    end if;
  end loop;
  for q in select * from jsonb_array_elements(want_checklist) loop
    if coalesce(q->>'key', '') !~ '^[a-z0-9_]{1,40}$' or length(btrim(coalesce(q->>'label', ''))) = 0 then
      raise exception 'semester: each checklist item has a key and a label' using errcode = 'check_violation';
    end if;
  end loop;
  insert into public.admission_cycles (tenant_id, name, term, opens_at, closes_at, questions, checklist, created_by, operation)
  values (school, btrim(want_name), want_term, want_opens, want_closes, want_questions, want_checklist, me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made);
  perform private.admissions_spend(school, want_key, 'cycle', req, result);
  return result;
end $$;

create or replace function public.admissions_cycle_open(want_cycle uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('cycle', want_cycle);
  prior  jsonb;
  c      public.admission_cycles;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:configure');
  prior := private.admissions_replay(school, want_key, 'open', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  select * into c from public.admission_cycles x where x.id = want_cycle and x.tenant_id = school for update;
  if c.id is null then raise exception 'semester: no such cycle' using errcode = 'no_data_found'; end if;
  if c.opened_at is not null then raise exception 'semester: that cycle is already open' using errcode = 'check_violation'; end if;
  update public.admission_cycles set opened_at = clock_timestamp() where id = want_cycle;
  result := jsonb_build_object('id', want_cycle, 'open', true);
  perform private.admissions_spend(school, want_key, 'open', req, result);
  return result;
end $$;

create or replace function public.admissions_cycle_close(want_cycle uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('cycle', want_cycle);
  prior  jsonb;
  c      public.admission_cycles;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:configure');
  prior := private.admissions_replay(school, want_key, 'close', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  select * into c from public.admission_cycles x where x.id = want_cycle and x.tenant_id = school for update;
  if c.id is null then raise exception 'semester: no such cycle' using errcode = 'no_data_found'; end if;
  if c.opened_at is null then raise exception 'semester: that cycle has not opened' using errcode = 'check_violation'; end if;
  if c.closed_at is not null then raise exception 'semester: that cycle is already closed' using errcode = 'check_violation'; end if;
  update public.admission_cycles set closed_at = clock_timestamp() where id = want_cycle;
  result := jsonb_build_object('id', want_cycle, 'closed', true);
  perform private.admissions_spend(school, want_key, 'close', req, result);
  return result;
end $$;

-- ── The applicant's writers ─────────────────────────────────────────────

create or replace function public.application_start(want_cycle uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  c      public.admission_cycles;
  req    jsonb := jsonb_build_object('cycle', want_cycle);
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  if me is null then raise exception 'semester: sign in to apply' using errcode = 'insufficient_privilege'; end if;
  select * into c from public.admission_cycles x where x.id = want_cycle;
  if c.id is null then raise exception 'semester: no such cycle' using errcode = 'no_data_found'; end if;
  prior := private.admissions_replay(c.tenant_id, want_key, 'start', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(c.tenant_id);
  if c.opened_at is null or c.closed_at is not null or clock_timestamp() < c.opens_at or clock_timestamp() > c.closes_at then
    raise exception 'semester: that cycle is not open for applications' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.applications a where a.cycle_id = want_cycle and a.applicant = me) then
    raise exception 'semester: you have already started an application to this cycle' using errcode = 'unique_violation';
  end if;
  insert into public.applications (tenant_id, cycle_id, applicant) values (c.tenant_id, want_cycle, me) returning id into made;
  perform private.admissions_event(made, c.tenant_id, 'started', '');
  result := jsonb_build_object('id', made);
  perform private.admissions_spend(c.tenant_id, want_key, 'start', req, result);
  return result;
end $$;

create or replace function public.application_save(want_application uuid, want_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a  public.applications;
  q  jsonb;
  c  public.admission_cycles;
begin
  a := private.admissions_application(want_application);
  if a.id is null or a.applicant is distinct from me then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  perform private.admissions_core_required(a.tenant_id);
  if a.status <> 'draft' then raise exception 'semester: a submitted application is frozen' using errcode = 'check_violation'; end if;
  if jsonb_typeof(want_answers) <> 'object' or length(want_answers::text) > 60000 then
    raise exception 'semester: answers are an object, under 60,000 characters' using errcode = 'check_violation';
  end if;
  select * into c from public.admission_cycles x where x.id = a.cycle_id;
  if c.closed_at is not null then raise exception 'semester: that cycle has closed' using errcode = 'check_violation'; end if;
  -- Only the cycle's own questions are kept.
  update public.applications set answers = (
    select coalesce(jsonb_object_agg(k.key, want_answers -> k.key), '{}'::jsonb)
      from (select q2->>'key' as key from jsonb_array_elements(c.questions) q2) k
     where want_answers ? k.key)
   where id = want_application;
end $$;

create or replace function public.application_submit(want_application uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  a      public.applications;
  c      public.admission_cycles;
  q      jsonb;
  req    jsonb := jsonb_build_object('application', want_application);
  prior  jsonb;
  result jsonb;
begin
  a := private.admissions_application(want_application);
  if a.id is null or a.applicant is distinct from me then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  prior := private.admissions_replay(a.tenant_id, want_key, 'submit', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(a.tenant_id);
  if a.status <> 'draft' then raise exception 'semester: that application is already submitted' using errcode = 'check_violation'; end if;
  select * into c from public.admission_cycles x where x.id = a.cycle_id;
  if c.closed_at is not null or clock_timestamp() > c.closes_at then
    raise exception 'semester: that cycle has closed' using errcode = 'check_violation';
  end if;
  for q in select * from jsonb_array_elements(c.questions) loop
    if coalesce((q->>'required')::boolean, false) and length(btrim(coalesce(a.answers ->> (q->>'key'), ''))) = 0 then
      raise exception 'semester: answer "%" before submitting', q->>'label' using errcode = 'check_violation';
    end if;
  end loop;
  update public.applications set status = 'submitted', submitted_at = clock_timestamp() where id = want_application;
  perform private.admissions_event(want_application, a.tenant_id, 'submitted', '');
  result := jsonb_build_object('id', want_application, 'status', 'submitted');
  perform private.admissions_spend(a.tenant_id, want_key, 'submit', req, result);
  return result;
end $$;

create or replace function public.application_withdraw(want_application uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  a      public.applications;
  req    jsonb := jsonb_build_object('application', want_application);
  prior  jsonb;
  result jsonb;
begin
  a := private.admissions_application(want_application);
  if a.id is null or a.applicant is distinct from me then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  prior := private.admissions_replay(a.tenant_id, want_key, 'withdraw', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(a.tenant_id);
  if a.status = 'withdrawn' then raise exception 'semester: that application is already withdrawn' using errcode = 'check_violation'; end if;
  update public.applications set status = 'withdrawn', withdrawn_at = clock_timestamp() where id = want_application;
  perform private.admissions_event(want_application, a.tenant_id, 'withdrawn', '');
  result := jsonb_build_object('id', want_application, 'status', 'withdrawn');
  perform private.admissions_spend(a.tenant_id, want_key, 'withdraw', req, result);
  return result;
end $$;

-- The applicant says a document was sent ('sent'); an officer says it was
-- received or waived. Each is a new version; none overwrites another.
create or replace function public.application_document_mark(want_application uuid, want_doc text, want_state text, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  a      public.applications;
  c      public.admission_cycles;
  req    jsonb := jsonb_build_object('application', want_application, 'doc', want_doc, 'state', want_state, 'note', coalesce(want_note, ''));
  prior  jsonb;
  v      integer;
  result jsonb;
begin
  select * into a from public.applications x where x.id = want_application;
  if a.id is null then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  if want_state = 'sent' then
    if a.applicant is distinct from me then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  elsif want_state in ('received', 'waived') then
    perform private.admissions_require(a.tenant_id, 'admissions:review');
    if not exists (select 1 from public.profiles p where p.user_id = me and p.school_id = a.tenant_id) then
      raise exception 'semester: that needs admissions:review at this school' using errcode = 'insufficient_privilege';
    end if;
  else
    raise exception 'semester: a document is sent, received or waived' using errcode = 'check_violation';
  end if;
  prior := private.admissions_replay(a.tenant_id, want_key, 'document', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(a.tenant_id);
  if a.status = 'withdrawn' then raise exception 'semester: that application is withdrawn' using errcode = 'check_violation'; end if;
  if want_state = 'waived' and length(btrim(coalesce(want_note, ''))) < 5 then
    raise exception 'semester: a waived document needs a reason' using errcode = 'check_violation';
  end if;
  select * into c from public.admission_cycles x where x.id = a.cycle_id;
  if not exists (select 1 from jsonb_array_elements(c.checklist) i where i->>'key' = want_doc) then
    raise exception 'semester: that is not on this cycle''s checklist' using errcode = 'check_violation';
  end if;
  select coalesce(max(d.version), 0) + 1 into v from public.application_documents d where d.application_id = want_application and d.doc_key = want_doc;
  insert into public.application_documents (tenant_id, application_id, doc_key, version, state, note, actor)
  values (a.tenant_id, want_application, want_doc, v, want_state, btrim(coalesce(want_note, '')), me);
  perform private.admissions_event(want_application, a.tenant_id,
    case want_state when 'sent' then 'document_sent' when 'received' then 'document_received' else 'document_waived' end, want_doc);
  result := jsonb_build_object('doc', want_doc, 'state', want_state, 'version', v);
  perform private.admissions_spend(a.tenant_id, want_key, 'document', req, result);
  return result;
end $$;

-- ── Review, decision and release ────────────────────────────────────────

create or replace function public.application_review(want_application uuid, want_recommendation text, want_notes text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  a      public.applications;
  req    jsonb := jsonb_build_object('application', want_application, 'recommendation', want_recommendation, 'notes', coalesce(want_notes, ''));
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:review');
  prior := private.admissions_replay(school, want_key, 'review', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  select * into a from public.applications x where x.id = want_application and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  if a.status <> 'submitted' then raise exception 'semester: only a submitted application is reviewed' using errcode = 'check_violation'; end if;
  if a.applicant = me then raise exception 'semester: nobody reviews their own application' using errcode = 'insufficient_privilege'; end if;
  insert into public.application_reviews (tenant_id, application_id, reviewer, recommendation, notes, operation)
  values (school, want_application, me, want_recommendation, btrim(coalesce(want_notes, '')), want_key) returning id into made;
  perform private.admissions_event(want_application, school, 'reviewed', '');
  result := jsonb_build_object('id', made);
  perform private.admissions_spend(school, want_key, 'review', req, result);
  return result;
end $$;

create or replace function public.application_decide(want_application uuid, want_decision text, want_reason text, want_conditions text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  a      public.applications;
  req    jsonb := jsonb_build_object('application', want_application, 'decision', want_decision, 'reason', coalesce(want_reason, ''), 'conditions', coalesce(want_conditions, ''));
  prior  jsonb;
  v      integer;
  made   uuid;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:decide');
  prior := private.admissions_replay(school, want_key, 'decide', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  select * into a from public.applications x where x.id = want_application and x.tenant_id = school for update;
  if a.id is null then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  if a.applicant = me then raise exception 'semester: nobody decides their own application' using errcode = 'insufficient_privilege'; end if;
  if a.status <> 'submitted' then raise exception 'semester: only a submitted application is decided' using errcode = 'check_violation'; end if;
  if want_decision not in ('admit', 'deny', 'waitlist') then raise exception 'semester: a decision is admit, deny or waitlist' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.application_reviews r where r.application_id = want_application and r.reviewer is distinct from me) then
    raise exception 'semester: a decision follows a review by someone other than the person who decides' using errcode = 'check_violation';
  end if;
  if not private.admissions_documents_complete(want_application) then
    raise exception 'semester: every required document must be received or waived first' using errcode = 'check_violation';
  end if;
  if private.admissions_released(want_application) then
    raise exception 'semester: that decision has been released to the applicant and is not changed here' using errcode = 'check_violation';
  end if;
  select coalesce(max(d.version), 0) + 1 into v from public.application_decisions d where d.application_id = want_application;
  insert into public.application_decisions (tenant_id, application_id, version, decision, conditions, reason, decided_by, operation)
  values (school, want_application, v, want_decision, btrim(coalesce(want_conditions, '')), btrim(coalesce(want_reason, '')), me, want_key)
  returning id into made;
  perform private.admissions_event(want_application, school, 'decided', 'v' || v);
  result := jsonb_build_object('id', made, 'version', v);
  perform private.admissions_spend(school, want_key, 'decide', req, result);
  return result;
end $$;

-- Releases the latest decision of every application in a cycle that has one
-- and has not been released. Returns how many.
create or replace function public.admissions_release(want_cycle uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('cycle', want_cycle);
  prior  jsonb;
  d      public.application_decisions;
  n      integer := 0;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:decide');
  prior := private.admissions_replay(school, want_key, 'release', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  if not exists (select 1 from public.admission_cycles c where c.id = want_cycle and c.tenant_id = school) then
    raise exception 'semester: no such cycle' using errcode = 'no_data_found';
  end if;
  for d in
    select x.* from public.application_decisions x join public.applications a on a.id = x.application_id
     where a.cycle_id = want_cycle and a.tenant_id = school and a.status = 'submitted'
       and x.version = (select max(y.version) from public.application_decisions y where y.application_id = x.application_id)
       and not exists (select 1 from public.application_decision_releases r where r.application_id = x.application_id)
     order by x.application_id
  loop
    insert into public.application_decision_releases (application_id, tenant_id, decision_id, released_by) values (d.application_id, school, d.id, me);
    perform private.admissions_event(d.application_id, school, 'released', '');
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'semester: no decisions are waiting to be released' using errcode = 'no_data_found'; end if;
  result := jsonb_build_object('released', n);
  perform private.admissions_spend(school, want_key, 'release', req, result);
  return result;
end $$;

create or replace function public.application_respond(want_application uuid, want_response text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  a      public.applications;
  req    jsonb := jsonb_build_object('application', want_application, 'response', want_response);
  prior  jsonb;
  rel    public.application_decision_releases;
  d      public.application_decisions;
  result jsonb;
begin
  a := private.admissions_application(want_application);
  if a.id is null or a.applicant is distinct from me then raise exception 'semester: no such application' using errcode = 'no_data_found'; end if;
  prior := private.admissions_replay(a.tenant_id, want_key, 'respond', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(a.tenant_id);
  if want_response not in ('accept', 'decline') then raise exception 'semester: accept or decline' using errcode = 'check_violation'; end if;
  select * into rel from public.application_decision_releases r where r.application_id = want_application;
  if rel.application_id is null then raise exception 'semester: there is no released decision to answer' using errcode = 'check_violation'; end if;
  select * into d from public.application_decisions x where x.id = rel.decision_id;
  if d.decision <> 'admit' then raise exception 'semester: only an offer of admission is answered' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.application_responses r where r.application_id = want_application) then
    raise exception 'semester: you have already answered' using errcode = 'check_violation';
  end if;
  insert into public.application_responses (application_id, tenant_id, response) values (want_application, a.tenant_id, want_response);
  perform private.admissions_event(want_application, a.tenant_id, case want_response when 'accept' then 'accepted' else 'declined' end, '');
  result := jsonb_build_object('response', want_response);
  perform private.admissions_spend(a.tenant_id, want_key, 'respond', req, result);
  return result;
end $$;

create or replace function public.admissions_deposit_record(want_application uuid, want_reference text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('application', want_application, 'reference', coalesce(want_reference, ''));
  prior  jsonb;
  result jsonb;
begin
  perform private.admissions_require(school, 'admissions:review');
  prior := private.admissions_replay(school, want_key, 'deposit', req);
  if prior is not null then return prior; end if;
  perform private.admissions_core_required(school);
  if not exists (select 1 from public.application_responses r join public.applications a on a.id = r.application_id
                  where r.application_id = want_application and a.tenant_id = school and r.response = 'accept') then
    raise exception 'semester: a deposit follows an accepted offer' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.application_deposits d where d.application_id = want_application) then
    raise exception 'semester: a deposit is already recorded' using errcode = 'check_violation';
  end if;
  insert into public.application_deposits (application_id, tenant_id, reference, received_by) values (want_application, school, btrim(want_reference), me);
  perform private.admissions_event(want_application, school, 'deposit_received', '');
  result := jsonb_build_object('recorded', true);
  perform private.admissions_spend(school, want_key, 'deposit', req, result);
  return result;
end $$;

-- Counts only: decisions, answers and deposits per cycle. No applicant is named.
create or replace function public.admissions_yield(want_cycle uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
begin
  perform private.admissions_require(school, 'admissions:read');
  perform private.admissions_core_required(school);
  if not exists (select 1 from public.admission_cycles c where c.id = want_cycle and c.tenant_id = school) then
    raise exception 'semester: no such cycle' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object(
    'started',   (select count(*) from public.applications a where a.cycle_id = want_cycle),
    'submitted', (select count(*) from public.applications a where a.cycle_id = want_cycle and a.status = 'submitted'),
    'withdrawn', (select count(*) from public.applications a where a.cycle_id = want_cycle and a.status = 'withdrawn'),
    'admitted',  (select count(*) from public.application_decision_releases r join public.application_decisions d on d.id = r.decision_id
                   join public.applications a on a.id = r.application_id where a.cycle_id = want_cycle and d.decision = 'admit'),
    'accepted',  (select count(*) from public.application_responses r join public.applications a on a.id = r.application_id where a.cycle_id = want_cycle and r.response = 'accept'),
    'deposited', (select count(*) from public.application_deposits d join public.applications a on a.id = d.application_id where a.cycle_id = want_cycle));
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.admissions_cycle_save(text, text, timestamptz, timestamptz, jsonb, jsonb, text) from public, anon;
revoke all on function public.admissions_cycle_open(uuid, text) from public, anon;
revoke all on function public.admissions_cycle_close(uuid, text) from public, anon;
revoke all on function public.application_start(uuid, text) from public, anon;
revoke all on function public.application_save(uuid, jsonb) from public, anon;
revoke all on function public.application_submit(uuid, text) from public, anon;
revoke all on function public.application_withdraw(uuid, text) from public, anon;
revoke all on function public.application_document_mark(uuid, text, text, text, text) from public, anon;
revoke all on function public.application_review(uuid, text, text, text) from public, anon;
revoke all on function public.application_decide(uuid, text, text, text, text) from public, anon;
revoke all on function public.admissions_release(uuid, text) from public, anon;
revoke all on function public.application_respond(uuid, text, text) from public, anon;
revoke all on function public.admissions_deposit_record(uuid, text, text) from public, anon;
revoke all on function public.admissions_yield(uuid) from public, anon;
grant execute on function public.admissions_cycle_save(text, text, timestamptz, timestamptz, jsonb, jsonb, text) to authenticated;
grant execute on function public.admissions_cycle_open(uuid, text) to authenticated;
grant execute on function public.admissions_cycle_close(uuid, text) to authenticated;
grant execute on function public.application_start(uuid, text) to authenticated;
grant execute on function public.application_save(uuid, jsonb) to authenticated;
grant execute on function public.application_submit(uuid, text) to authenticated;
grant execute on function public.application_withdraw(uuid, text) to authenticated;
grant execute on function public.application_document_mark(uuid, text, text, text, text) to authenticated;
grant execute on function public.application_review(uuid, text, text, text) to authenticated;
grant execute on function public.application_decide(uuid, text, text, text, text) to authenticated;
grant execute on function public.admissions_release(uuid, text) to authenticated;
grant execute on function public.application_respond(uuid, text, text) to authenticated;
grant execute on function public.admissions_deposit_record(uuid, text, text) to authenticated;
grant execute on function public.admissions_yield(uuid) to authenticated;

-- ── An account that started an application is not untouched ─────────────
--
-- The previous definition is `20261001030000_assessments.sql`, with one more
-- place to look; the application's events, documents and answers go with it.

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
      ('public.support_shares',       'staff_id'),
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      ('public.submissions',          'student_id'),
      ('public.submission_receipts',  'student_id'),
      ('public.assignment_overrides', 'student_id'),
      ('public.attendance_marks',     'student_id'),
      -- 20261001030000: a student's test attempts and any extra time granted.
      ('public.assessment_attempts',  'student_id'),
      ('public.assessment_time_extensions', 'student_id'),
      -- 20261001060000: an application is the applicant's own.
      ('public.applications',         'applicant')
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
