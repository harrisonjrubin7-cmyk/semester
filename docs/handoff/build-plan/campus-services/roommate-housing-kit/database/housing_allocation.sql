-- Proposed standalone housing allocation schema. NOT EXECUTED.
-- Identity bridge tables must map to existing Semester canonical identity.
-- Reconcile naming/existing migrations before adoption. Do not deploy as-is.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA housing;

CREATE TABLE housing.institution_ref (
 id uuid PRIMARY KEY,
 canonical_institution_reference text NOT NULL UNIQUE
);
CREATE TABLE housing.student_ref (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 student_id uuid NOT NULL,
 canonical_subject_reference text NOT NULL,
 PRIMARY KEY (institution_id,student_id),
 UNIQUE (institution_id,canonical_subject_reference)
);
CREATE TABLE housing.period (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 id uuid NOT NULL,
 start_date date NOT NULL,
 end_date date NOT NULL,
 timezone text NOT NULL,
 PRIMARY KEY(institution_id,id),
 CHECK(start_date<end_date)
);
CREATE TABLE housing.policy_version (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 rules jsonb NOT NULL,
 approval_reference text,
 PRIMARY KEY(institution_id,id)
);
CREATE TABLE housing.bed (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 id uuid NOT NULL,
 canonical_unit_reference text NOT NULL,
 bed_label text NOT NULL,
 features jsonb NOT NULL DEFAULT '{}',
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(institution_id,id),
 UNIQUE(institution_id,canonical_unit_reference,bed_label)
);
CREATE TABLE housing.application (
 institution_id uuid NOT NULL,
 id uuid NOT NULL,
 student_id uuid NOT NULL,
 period_id uuid NOT NULL,
 policy_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('draft','submitted','eligible','ineligible','withdrawn')),
 eligibility_reference text,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(institution_id,id),
 UNIQUE(institution_id,student_id,period_id),
 FOREIGN KEY(institution_id,student_id) REFERENCES housing.student_ref(institution_id,student_id),
 FOREIGN KEY(institution_id,period_id) REFERENCES housing.period(institution_id,id),
 FOREIGN KEY(institution_id,policy_id) REFERENCES housing.policy_version(institution_id,id)
);
CREATE TABLE housing.roommate_group (
 institution_id uuid NOT NULL,
 id uuid NOT NULL,
 period_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 state text NOT NULL CHECK(state IN ('forming','accepted','locked','dissolved')),
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,period_id) REFERENCES housing.period(institution_id,id)
);
CREATE TABLE housing.group_member (
 institution_id uuid NOT NULL,
 group_id uuid NOT NULL,
 student_id uuid NOT NULL,
 accepted_group_version bigint,
 accepted_at timestamptz,
 withdrawn_at timestamptz,
 PRIMARY KEY(institution_id,group_id,student_id),
 FOREIGN KEY(institution_id,group_id) REFERENCES housing.roommate_group(institution_id,id),
 FOREIGN KEY(institution_id,student_id) REFERENCES housing.student_ref(institution_id,student_id),
 CHECK((accepted_group_version IS NULL)=(accepted_at IS NULL))
);
CREATE TABLE housing.selection_window (
 institution_id uuid NOT NULL,
 id uuid NOT NULL,
 application_id uuid NOT NULL,
 opens_at timestamptz NOT NULL,
 closes_at timestamptz NOT NULL,
 policy_id uuid NOT NULL,
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,application_id) REFERENCES housing.application(institution_id,id),
 FOREIGN KEY(institution_id,policy_id) REFERENCES housing.policy_version(institution_id,id),
 CHECK(opens_at<closes_at)
);
CREATE TABLE housing.contract_version (
 institution_id uuid NOT NULL,
 id uuid NOT NULL,
 application_id uuid NOT NULL,
 document_digest text NOT NULL,
 terms_reference text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 accepted_at timestamptz,
 accepted_by_reference text,
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,application_id) REFERENCES housing.application(institution_id,id),
 CHECK((accepted_at IS NULL)=(accepted_by_reference IS NULL))
);
-- One temporal claim table for reservations AND assignments AND bed closures.
-- Do not separate reservations and assignments into independent exclusion domains.
CREATE TABLE housing.bed_claim (
 institution_id uuid NOT NULL,
 id uuid NOT NULL,
 bed_id uuid NOT NULL,
 student_id uuid,
 period_id uuid NOT NULL,
 application_id uuid,
 group_id uuid,
 contract_id uuid,
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 occupancy daterange GENERATED ALWAYS AS (daterange(starts_on,ends_on,'[)')) STORED,
 state text NOT NULL CHECK(state IN ('reserved','confirmed','occupied','blocked','expired','cancelled','checked_out')),
 reservation_expires_at timestamptz,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(institution_id,id),
 FOREIGN KEY(institution_id,bed_id) REFERENCES housing.bed(institution_id,id),
 FOREIGN KEY(institution_id,student_id) REFERENCES housing.student_ref(institution_id,student_id),
 FOREIGN KEY(institution_id,period_id) REFERENCES housing.period(institution_id,id),
 FOREIGN KEY(institution_id,application_id) REFERENCES housing.application(institution_id,id),
 FOREIGN KEY(institution_id,group_id) REFERENCES housing.roommate_group(institution_id,id),
 FOREIGN KEY(institution_id,contract_id) REFERENCES housing.contract_version(institution_id,id),
 CHECK(starts_on<ends_on),
 CHECK(state='blocked' OR student_id IS NOT NULL),
 CHECK(state<>'blocked' OR student_id IS NULL),
 CHECK(state<>'reserved' OR reservation_expires_at IS NOT NULL),
 EXCLUDE USING gist (institution_id WITH =,bed_id WITH =,occupancy WITH &&)
 WHERE(state IN ('reserved','confirmed','occupied','blocked')),
 EXCLUDE USING gist (institution_id WITH =,student_id WITH =,occupancy WITH &&)
 WHERE(state IN ('reserved','confirmed','occupied') AND student_id IS NOT NULL)
);
CREATE TABLE housing.command_receipt (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 id uuid NOT NULL,
 actor_reference text NOT NULL,
 operation text NOT NULL,
 idempotency_key text NOT NULL,
 payload_digest text NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','succeeded','failed','unknown')),
 result_reference text,
 correlation_id uuid NOT NULL,
 PRIMARY KEY(institution_id,id),
 UNIQUE(institution_id,actor_reference,operation,idempotency_key)
);
CREATE TABLE housing.source_mapping (
 institution_id uuid NOT NULL REFERENCES housing.institution_ref(id),
 source_system text NOT NULL,
 source_entity text NOT NULL,
 source_id text NOT NULL,
 canonical_entity text NOT NULL,
 canonical_id uuid NOT NULL,
 mapping_version integer NOT NULL CHECK(mapping_version>0),
 source_version text,
 watermark text,
 authority text NOT NULL CHECK(authority IN ('legacy','semester','held')),
 PRIMARY KEY(institution_id,source_system,source_entity,source_id)
);
-- Enable default-deny. Reviewed existing capability-based policies must be added.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='housing' LOOP
  EXECUTE format('ALTER TABLE housing.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('ALTER TABLE housing.%I FORCE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $$;
REVOKE ALL ON SCHEMA housing FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA housing FROM PUBLIC;
-- Remaining server invariants: period containment; application/student consistency;
-- current group acceptance/version/eligibility; contract matching/acceptance; current
-- window/policy; append-only audit + transactional outbox using EXISTING services.
-- Clock expiry is NOT a dynamic exclusion predicate. Expire stale reservations in
-- a worker AND inside allocation/confirmation transaction; recheck state/deadline.
-- Never expose this schema via browser DML. Server roles must not BYPASSRLS;
-- superuser/service-role paths need explicit independently tested policy checks.
