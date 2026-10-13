-- registrar_ref: isolated registrar schema (reviewed reference, additive).
-- Owner-only RLS with no policies: default deny. No grants, handlers or execution function.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA IF NOT EXISTS registrar_ref;
REVOKE ALL ON SCHEMA registrar_ref FROM PUBLIC;
CREATE TABLE IF NOT EXISTS registrar_ref.institutions(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS registrar_ref.students(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,
 id uuid NOT NULL, external_key text NOT NULL,
 PRIMARY KEY(institution_id,id), UNIQUE(institution_id,external_key));
CREATE TABLE IF NOT EXISTS registrar_ref.terms(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,
 id uuid NOT NULL, code text NOT NULL,
 PRIMARY KEY(institution_id,id), UNIQUE(institution_id,code));
CREATE TABLE IF NOT EXISTS registrar_ref.courses(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,
 id uuid NOT NULL, code text NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(institution_id,id), UNIQUE(institution_id,code,version));
CREATE TABLE IF NOT EXISTS registrar_ref.sections(
 institution_id uuid NOT NULL,id uuid NOT NULL,course_id uuid NOT NULL,term_id uuid NOT NULL,
 external_key text NOT NULL,capacity integer NOT NULL CHECK(capacity>=0),
 PRIMARY KEY(institution_id,id),UNIQUE(institution_id,external_key),
 FOREIGN KEY(institution_id,course_id) REFERENCES registrar_ref.courses,
 FOREIGN KEY(institution_id,term_id) REFERENCES registrar_ref.terms);
CREATE TABLE IF NOT EXISTS registrar_ref.operations(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,id uuid NOT NULL,
 actor_id uuid NOT NULL,idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 200),
 request_digest text NOT NULL,state text NOT NULL CHECK(state IN ('accepted','blocked','pending','confirmed','reconcile_required','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(institution_id,id),UNIQUE(institution_id,actor_id,idempotency_key));
CREATE TABLE IF NOT EXISTS registrar_ref.enrollments(
 institution_id uuid NOT NULL,id uuid NOT NULL,student_id uuid NOT NULL,section_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('enrolled','dropped','withdrawn','completed','cancelled')),
 credits numeric(8,3) NOT NULL CHECK(credits>=0),grade_mode text NOT NULL,
 record_version bigint NOT NULL DEFAULT 1 CHECK(record_version>0),
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,student_id) REFERENCES registrar_ref.students,
 FOREIGN KEY(institution_id,section_id) REFERENCES registrar_ref.sections);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_enrollment ON registrar_ref.enrollments(institution_id,student_id,section_id) WHERE status='enrolled';
CREATE TABLE IF NOT EXISTS registrar_ref.grade_decisions(
 institution_id uuid NOT NULL,id uuid NOT NULL,enrollment_id uuid NOT NULL,
 sequence_number integer NOT NULL CHECK(sequence_number>0),grade_code text NOT NULL,
 policy_reference text NOT NULL,authority_reference text NOT NULL,
 supersedes_id uuid,effective_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(institution_id,id),UNIQUE(institution_id,enrollment_id,sequence_number),
 UNIQUE(institution_id,enrollment_id,id),
 FOREIGN KEY(institution_id,enrollment_id) REFERENCES registrar_ref.enrollments,
 FOREIGN KEY(institution_id,enrollment_id,supersedes_id) REFERENCES registrar_ref.grade_decisions(institution_id,enrollment_id,id),
 CHECK((sequence_number=1 AND supersedes_id IS NULL) OR (sequence_number>1 AND supersedes_id IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS one_grade_successor ON registrar_ref.grade_decisions(institution_id,supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS registrar_ref.outbox(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,id uuid NOT NULL,
 operation_id uuid NOT NULL,event_type text NOT NULL,payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,operation_id) REFERENCES registrar_ref.operations);
CREATE TABLE IF NOT EXISTS registrar_ref.source_map(
 institution_id uuid NOT NULL REFERENCES registrar_ref.institutions,source_system text NOT NULL,
 object_type text NOT NULL,source_key text NOT NULL,canonical_id uuid NOT NULL,
 source_version text,batch_reference text NOT NULL,
 PRIMARY KEY(institution_id,source_system,object_type,source_key));
alter table registrar_ref.institutions enable row level security;
alter table registrar_ref.institutions force row level security;
revoke all on registrar_ref.institutions from public;
alter table registrar_ref.students enable row level security;
alter table registrar_ref.students force row level security;
revoke all on registrar_ref.students from public;
alter table registrar_ref.terms enable row level security;
alter table registrar_ref.terms force row level security;
revoke all on registrar_ref.terms from public;
alter table registrar_ref.courses enable row level security;
alter table registrar_ref.courses force row level security;
revoke all on registrar_ref.courses from public;
alter table registrar_ref.sections enable row level security;
alter table registrar_ref.sections force row level security;
revoke all on registrar_ref.sections from public;
alter table registrar_ref.operations enable row level security;
alter table registrar_ref.operations force row level security;
revoke all on registrar_ref.operations from public;
alter table registrar_ref.enrollments enable row level security;
alter table registrar_ref.enrollments force row level security;
revoke all on registrar_ref.enrollments from public;
alter table registrar_ref.grade_decisions enable row level security;
alter table registrar_ref.grade_decisions force row level security;
revoke all on registrar_ref.grade_decisions from public;
alter table registrar_ref.outbox enable row level security;
alter table registrar_ref.outbox force row level security;
revoke all on registrar_ref.outbox from public;
alter table registrar_ref.source_map enable row level security;
alter table registrar_ref.source_map force row level security;
revoke all on registrar_ref.source_map from public;
-- Intentionally no permissive policies, roles, enrollment executor or API implementation.
