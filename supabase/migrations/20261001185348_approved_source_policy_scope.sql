set lock_timeout = '5s';
set statement_timeout = '30s';
-- Bind approved source use to institution-owned course policy scope.
-- Additive and NOT APPLIED to production by this change. Existing source IDs
-- are opaque (for example "econ"), and neither they nor a student's selected
-- term can safely be guessed into a published policy key. No automatic backfill.
-- Existing source:approve RLS and audit_approved_source cover these columns.

alter table public.approved_source
  add column if not exists policy_scope text,
  add column if not exists policy_course_code text,
  add column if not exists policy_term text;

alter table public.approved_source drop constraint if exists approved_source_policy_scope_valid;
alter table public.approved_source add constraint approved_source_policy_scope_valid check (
  -- Legacy rows remain readable; the gateway refuses to generate until bound.
  (policy_scope is null and policy_course_code is null and policy_term is null)
  or
  (policy_scope is not null and policy_scope = 'institution' and origin <> 'course'
    and policy_course_code is null and policy_term is null)
  or
  (policy_scope is not null and policy_scope = 'course'
    and policy_course_code is not null and policy_course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'
    and policy_term is not null and policy_term ~ '^[0-9]{4}(FA|SP|SU)$')
);

comment on column public.approved_source.policy_scope is
  'Explicit source-approver classification: course policy binding or non-course institution guidance. NULL is unverified and cannot generate.';
comment on column public.approved_source.policy_course_code is
  'Canonical institution-approved course_ai_rules.course_code. Independent of the legacy opaque course_id.';
comment on column public.approved_source.policy_term is
  'Institution-approved policy term for this source. Never inferred from client state or self-reported enrollment.';
