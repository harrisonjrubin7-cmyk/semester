-- Identity → academic context → enrollment operations → official grade decisions. Proposed; not run. Builds on 100/110.
-- A login is not the academic-record identity; historical students may exist with no account.
create table registrar.persons (id uuid primary key default gen_random_uuid(), identity_status text not null check (identity_status in ('verified','unverified','merged','retired')), merged_into uuid references registrar.persons(id));
create table registrar.person_identifiers (
  institution_id uuid not null, person_id uuid not null references registrar.persons(id), source_system text not null, external_key text not null,
  valid_from date, valid_until date, primary key (institution_id, source_system, external_key));
create table registrar.account_person_links (account_id uuid not null, person_id uuid not null references registrar.persons(id), verification_method text not null, valid_from timestamptz not null default now(), valid_until timestamptz, primary key (account_id, person_id));
create table registrar.institution_memberships (institution_id uuid not null, id uuid not null default gen_random_uuid(), person_id uuid not null references registrar.persons(id), affiliation text not null, status text not null, valid_from date, valid_until date, primary key (institution_id, id));
create table registrar.student_academic_contexts (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), person_id uuid not null references registrar.persons(id),
  career text not null, entry_term_id uuid, status text not null, primary key (institution_id, id), unique (institution_id, person_id, career));
create table registrar.student_program_assignments (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, program_version_id uuid not null, catalog_version_id uuid not null,
  effective_from date not null, effective_until date, approval_ref text not null,
  primary key (institution_id, id), foreign key (institution_id, academic_context_id) references registrar.student_academic_contexts (institution_id, id));

create table registrar.policy_versions (institution_id uuid not null, id uuid not null default gen_random_uuid(), policy_key text not null, version text not null, effective_from date not null, approval_ref text not null, body jsonb not null, primary key (institution_id, id), unique (institution_id, policy_key, version));

create table registrar.eligibility_evaluations (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, requested_sections uuid[] not null,
  outcome text not null check (outcome in ('allowed','blocked','review_required','unknown','stale')), policy_version_id uuid not null, source_versions jsonb not null, findings jsonb not null default '[]', evaluated_at timestamptz not null default now(),
  primary key (institution_id, id), foreign key (institution_id, academic_context_id) references registrar.student_academic_contexts (institution_id, id));

create table registrar.registration_operations (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, term_id uuid not null,
  operation_type text not null check (operation_type in ('add','drop','swap','withdraw','waitlist_accept','admin_change')),
  idempotency_key text not null, request_digest text not null,
  status text not null check (status in ('accepted','blocked','review_required','pending_external','confirmed','reconcile_required','failed')),
  expected_schedule_version int not null, policy_version_id uuid not null, eligibility_evaluation_id uuid, receipt_id uuid,
  actor uuid not null, reason text, created_at timestamptz not null default now(),
  primary key (institution_id, id), unique (institution_id, actor, idempotency_key),
  constraint key_length check (length(idempotency_key) between 16 and 200),
  foreign key (institution_id, academic_context_id) references registrar.student_academic_contexts (institution_id, id),
  constraint admin_change_needs_reason check (operation_type <> 'admin_change' or reason is not null));

create table registrar.enrollment_events (
  institution_id uuid not null, id bigserial, enrollment_id uuid not null, operation_id uuid not null,
  event_type text not null, prior_state text, new_state text not null, effective_at timestamptz not null, recorded_at timestamptz not null default now(), actor uuid not null, reason text,
  primary key (institution_id, id),
  foreign key (institution_id, enrollment_id) references registrar.enrollments (institution_id, id),
  foreign key (institution_id, operation_id) references registrar.registration_operations (institution_id, id));

create table registrar.registration_overrides (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, restriction_type text not null, scope jsonb not null,
  requested_by uuid not null, approver uuid, valid_until timestamptz not null, uses_allowed int not null default 1, uses int not null default 0, decision text check (decision in ('approved','denied')),
  primary key (institution_id, id),
  constraint requester_not_approver check (approver is null or approver <> requested_by),
  constraint within_use_limit check (uses <= uses_allowed));

-- Grades: scale versions → submissions (working) → official decisions (append-only chain) → calculation runs → transcript snapshots
create table registrar.grade_scale_versions (institution_id uuid not null, id uuid not null default gen_random_uuid(), codes jsonb not null, effective_from date not null, approval_ref text not null, primary key (institution_id, id));
create table registrar.grade_submissions (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), course_attempt_id uuid not null, submitted_code text not null,
  teaching_assignment_id uuid not null, version int not null default 1, status text not null check (status in ('draft','submitted','accepted','returned')),
  primary key (institution_id, id), unique (institution_id, course_attempt_id, version),
  foreign key (institution_id, course_attempt_id) references registrar.course_attempts (institution_id, id));
create table registrar.official_grade_decisions (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), course_attempt_id uuid not null, grade_code text not null, grade_scale_version_id uuid not null,
  decision_type text not null check (decision_type in ('original','correction','incomplete_resolution','repeat_annotation')),
  sequence_number int not null default 1 check (sequence_number > 0),
  supersedes_decision_id uuid, effective_at timestamptz not null, recorded_at timestamptz not null default now(),
  authority_reference text not null, approval_reference text not null, reason_reference text, submission_id uuid, record_version int not null default 1,
  primary key (institution_id, id), unique (institution_id, course_attempt_id, id), unique (institution_id, course_attempt_id, sequence_number),
  foreign key (institution_id, course_attempt_id) references registrar.course_attempts (institution_id, id),
  -- predecessor must belong to the SAME attempt (adopted from the registrar reference package)
  foreign key (institution_id, course_attempt_id, supersedes_decision_id) references registrar.official_grade_decisions (institution_id, course_attempt_id, id),
  constraint sequence_matches_chain check ((sequence_number = 1) = (supersedes_decision_id is null)),
  foreign key (institution_id, grade_scale_version_id) references registrar.grade_scale_versions (institution_id, id),
  constraint correction_supersedes check ((decision_type = 'original') = (supersedes_decision_id is null)),
  constraint correction_has_reason check (decision_type = 'original' or reason_reference is not null));
-- at most one original per attempt, and a decision can be superseded once
create unique index one_original_per_attempt on registrar.official_grade_decisions (institution_id, course_attempt_id) where decision_type = 'original';
create unique index superseded_once on registrar.official_grade_decisions (institution_id, supersedes_decision_id) where supersedes_decision_id is not null;
-- a repeated submission can't create a second original: idempotent on submission_id
create unique index decision_per_submission on registrar.official_grade_decisions (institution_id, submission_id) where submission_id is not null;
create trigger official_grade_decisions_append_only before update or delete on registrar.official_grade_decisions for each row execute function registrar.no_update();

create table registrar.academic_calculation_runs (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, policy_version_id uuid not null,
  input_decision_versions jsonb not null, result jsonb not null, calculated_at timestamptz not null default now(), primary key (institution_id, id));
create table registrar.transcript_snapshots (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), academic_context_id uuid not null, included_record_versions jsonb not null,
  issued_at timestamptz not null default now(), presentation_version text not null, schema_version text not null, superseded_by uuid,
  primary key (institution_id, id));
create trigger transcript_snapshots_append_only before delete on registrar.transcript_snapshots for each row execute function registrar.no_update();

-- source bindings record where every migrated row came from
create table registrar.source_bindings (institution_id uuid not null, object_type text not null, canonical_id uuid not null, source_system text not null, source_key text not null, batch_id uuid not null, manifest_hash text not null, primary key (institution_id, object_type, source_system, source_key));

do $$ declare t text; begin foreach t in array array['persons','person_identifiers','account_person_links','institution_memberships','student_academic_contexts','student_program_assignments','policy_versions','eligibility_evaluations','registration_operations','enrollment_events','registration_overrides','grade_scale_versions','grade_submissions','official_grade_decisions','academic_calculation_runs','transcript_snapshots','source_bindings'] loop
  execute format('alter table registrar.%I enable row level security', t); execute format('alter table registrar.%I force row level security', t); end loop; end $$;
