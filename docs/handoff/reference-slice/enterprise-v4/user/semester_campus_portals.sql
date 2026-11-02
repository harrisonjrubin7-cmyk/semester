-- Semester campus-portal reference DDL. NOT executed or production certified.
-- PostgreSQL 15+; fresh schema only. Default-deny RLS requires policy implementation.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA semester;
SET LOCAL search_path = semester, public;
CREATE TABLE institutions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, default_timezone text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());


-- Domain: foundation
CREATE TABLE campuses (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    timezone text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: foundation
CREATE TABLE people (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    preferred_name text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: foundation
CREATE TABLE programs (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code)
);


-- Domain: foundation
CREATE TABLE academic_terms (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code),
    CHECK (ends_on >= starts_on)
);


-- Domain: foundation
CREATE TABLE identity_links (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, issuer, subject)
);


-- Domain: foundation
CREATE TABLE memberships (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    membership_type text NOT NULL,
    status text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);


-- Domain: foundation
CREATE TABLE policy_versions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    policy_type text NOT NULL,
    version_number integer NOT NULL,
    definition jsonb NOT NULL,
    effective_from timestamptz NOT NULL,
    effective_until timestamptz,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, policy_type, version_number)
);


-- Domain: foundation
CREATE TABLE documents (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    owner_person_id uuid,
    storage_key text NOT NULL,
    classification text NOT NULL,
    scan_status text NOT NULL,
    checksum text,
    retention_policy_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: foundation
CREATE TABLE document_versions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    storage_key text NOT NULL,
    checksum text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, document_id, version_number)
);


-- Domain: foundation
CREATE TABLE integration_connections (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    authority_mode text NOT NULL,
    credential_reference text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (authority_mode IN ('native','connected_read','connected_transaction','import','handoff'))
);


-- Domain: foundation
CREATE TABLE external_record_links (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    connection_id uuid NOT NULL,
    entity_type text NOT NULL,
    local_id uuid NOT NULL,
    external_id text NOT NULL,
    external_version text,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, connection_id, entity_type, external_id),
    UNIQUE (tenant_id, connection_id, entity_type, local_id)
);


-- Domain: foundation
CREATE TABLE integration_jobs (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    connection_id uuid NOT NULL,
    job_type text NOT NULL,
    state text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    correlation_key text NOT NULL,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, connection_id, correlation_key),
    CHECK (attempts >= 0)
);


-- Domain: foundation
CREATE TABLE webhook_receipts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    connection_id uuid NOT NULL,
    provider_event_id text NOT NULL,
    payload_reference text,
    state text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, connection_id, provider_event_id)
);


-- Domain: foundation
CREATE TABLE outbox_events (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb NOT NULL,
    published_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: foundation
CREATE TABLE workflow_instances (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    workflow_type text NOT NULL,
    definition_version_id uuid NOT NULL,
    state text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: foundation
CREATE TABLE workflow_tasks (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    workflow_id uuid NOT NULL,
    task_code text NOT NULL,
    status text NOT NULL,
    due_at timestamptz,
    assigned_person_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, workflow_id, task_code)
);


-- Domain: foundation
CREATE TABLE task_dependencies (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL,
    prerequisite_task_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, task_id, prerequisite_task_id),
    CHECK (task_id <> prerequisite_task_id)
);


-- Domain: foundation
CREATE TABLE task_evidence (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL,
    document_id uuid,
    verified_by uuid,
    verified_at timestamptz,
    verification_status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: finance
CREATE TABLE billing_accounts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    account_type text NOT NULL,
    authority_connection_id uuid,
    external_account_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: finance
CREATE TABLE billing_charges (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    billing_account_id uuid NOT NULL,
    category text NOT NULL,
    amount_minor bigint NOT NULL,
    currency text NOT NULL,
    due_at timestamptz,
    status text NOT NULL,
    external_charge_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (amount_minor >= 0),
    CHECK (currency ~ '^[A-Z]{3}$')
);


-- Domain: finance
CREATE TABLE payment_orders (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    currency text NOT NULL,
    merchant_reference text NOT NULL,
    idempotency_key text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, idempotency_key),
    CHECK (amount_minor > 0),
    CHECK (currency ~ '^[A-Z]{3}$')
);


-- Domain: finance
CREATE TABLE payment_order_allocations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_order_id uuid NOT NULL,
    charge_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (amount_minor > 0)
);


-- Domain: finance
CREATE TABLE payment_attempts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_order_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    provider_payment_id text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, connection_id, provider_payment_id)
);


-- Domain: finance
CREATE TABLE payment_refunds (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_attempt_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    provider_refund_id text,
    status text NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (amount_minor > 0)
);


-- Domain: finance
CREATE TABLE payment_reconciliations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_attempt_id uuid NOT NULL,
    provider_status text NOT NULL,
    erp_posting_reference text,
    status text NOT NULL,
    reconciled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: admissions
CREATE TABLE admission_cycles (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    program_id uuid NOT NULL,
    entry_term_id uuid NOT NULL,
    policy_version_id uuid NOT NULL,
    opens_at timestamptz NOT NULL,
    deadline_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (deadline_at > opens_at)
);


-- Domain: admissions
CREATE TABLE applications (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    applicant_person_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz,
    withdrawn_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: admissions
CREATE TABLE application_requirements (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    requirement_code text NOT NULL,
    status text NOT NULL,
    due_at timestamptz,
    waiver_reason text,
    verified_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, application_id, requirement_code)
);


-- Domain: admissions
CREATE TABLE application_question_versions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL,
    question_code text NOT NULL,
    version_number integer NOT NULL,
    definition jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, cycle_id, question_code, version_number)
);


-- Domain: admissions
CREATE TABLE application_answers (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    question_version_id uuid NOT NULL,
    answer_value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, application_id, question_version_id)
);


-- Domain: admissions
CREATE TABLE application_submission_snapshots (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    snapshot_number integer NOT NULL,
    document_id uuid NOT NULL,
    submitted_at timestamptz NOT NULL,
    checksum text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, application_id, snapshot_number)
);


-- Domain: admissions
CREATE TABLE application_documents (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    requirement_id uuid NOT NULL,
    document_id uuid NOT NULL,
    review_status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: admissions
CREATE TABLE recommendation_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    recommender_contact_reference text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    status text NOT NULL,
    document_id uuid,
    waiver_evidence_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, token_hash)
);


-- Domain: admissions
CREATE TABLE application_reviews (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    reviewer_person_id uuid NOT NULL,
    rubric_version_id uuid NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: admissions
CREATE TABLE review_scores (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL,
    criterion_code text NOT NULL,
    score numeric,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, review_id, criterion_code)
);


-- Domain: admissions
CREATE TABLE admission_decisions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    decision_type text NOT NULL,
    status text NOT NULL,
    approved_by uuid,
    approved_at timestamptz,
    released_by uuid,
    released_at timestamptz,
    supersedes_decision_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (released_at IS NULL OR approved_at IS NOT NULL)
);


-- Domain: admissions
CREATE TABLE admission_offers (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    decision_id uuid NOT NULL,
    response_deadline timestamptz NOT NULL,
    status text NOT NULL,
    responded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, decision_id)
);


-- Domain: admissions
CREATE TABLE offer_conditions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    offer_id uuid NOT NULL,
    condition_code text NOT NULL,
    status text NOT NULL,
    due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, offer_id, condition_code)
);


-- Domain: admissions
CREATE TABLE student_records (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    sis_student_id text,
    status text NOT NULL,
    activated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, person_id),
    UNIQUE (tenant_id, sis_student_id)
);


-- Domain: admissions
CREATE TABLE student_program_enrollments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_record_id uuid NOT NULL,
    program_id uuid NOT NULL,
    entry_term_id uuid NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: admissions
CREATE TABLE onboarding_instances (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    offer_id uuid NOT NULL,
    person_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, offer_id),
    UNIQUE (tenant_id, workflow_id)
);


-- Domain: registrar
CREATE TABLE courses (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subject_code text NOT NULL,
    catalog_number text NOT NULL,
    title text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, subject_code, catalog_number)
);


-- Domain: registrar
CREATE TABLE course_versions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL,
    effective_term_id uuid NOT NULL,
    description text,
    credit_min numeric NOT NULL,
    credit_max numeric NOT NULL,
    grading_options jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (credit_min >= 0 AND credit_max >= credit_min)
);


-- Domain: registrar
CREATE TABLE sections (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    course_version_id uuid NOT NULL,
    term_id uuid NOT NULL,
    section_code text NOT NULL,
    capacity integer NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, term_id, section_code),
    CHECK (capacity >= 0)
);


-- Domain: registrar
CREATE TABLE section_meetings (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    weekday smallint NOT NULL,
    starts_at_local time NOT NULL,
    ends_at_local time NOT NULL,
    timezone text NOT NULL,
    location_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (weekday BETWEEN 0 AND 6),
    CHECK (ends_on >= starts_on)
);


-- Domain: registrar
CREATE TABLE section_instructors (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, section_id, person_id, role_code)
);


-- Domain: registrar
CREATE TABLE academic_rule_sets (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    rule_type text NOT NULL,
    definition jsonb NOT NULL,
    version_number integer NOT NULL,
    effective_from date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE section_rule_assignments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL,
    rule_set_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, section_id, rule_set_id)
);


-- Domain: registrar
CREATE TABLE section_link_rules (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL,
    required_group_code text NOT NULL,
    definition jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE registration_appointments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    term_id uuid NOT NULL,
    opens_at timestamptz NOT NULL,
    closes_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (closes_at > opens_at)
);


-- Domain: registrar
CREATE TABLE student_holds (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    hold_code text NOT NULL,
    issuer_team_reference text NOT NULL,
    blocks_registration boolean NOT NULL,
    released_at timestamptz,
    released_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE registration_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    term_id uuid NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    idempotency_key text NOT NULL,
    external_transaction_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, idempotency_key)
);


-- Domain: registrar
CREATE TABLE registration_request_items (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL,
    section_id uuid NOT NULL,
    item_operation text NOT NULL,
    credits numeric,
    grading_option text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE enrollments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    section_id uuid NOT NULL,
    status text NOT NULL,
    credits numeric NOT NULL,
    confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, person_id, section_id),
    CHECK (credits >= 0)
);


-- Domain: registrar
CREATE TABLE enrollment_events (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    request_id uuid,
    event_type text NOT NULL,
    occurred_at timestamptz NOT NULL,
    external_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE waitlist_entries (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    section_id uuid NOT NULL,
    priority integer NOT NULL,
    entered_at timestamptz NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, person_id, section_id)
);


-- Domain: registrar
CREATE TABLE override_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    section_id uuid NOT NULL,
    rule_code text NOT NULL,
    status text NOT NULL,
    approved_by uuid,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: registrar
CREATE TABLE exam_events (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    location_reference text,
    source_version text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (ends_at > starts_at)
);


-- Domain: registrar
CREATE TABLE academic_document_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    request_type text NOT NULL,
    recipient_reference text,
    status text NOT NULL,
    document_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_cycles (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    term_id uuid NOT NULL,
    policy_version_id uuid NOT NULL,
    name text NOT NULL,
    opens_at timestamptz NOT NULL,
    closes_at timestamptz NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (closes_at > opens_at)
);


-- Domain: housing
CREATE TABLE housing_buildings (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    campus_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_rooms (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    building_id uuid NOT NULL,
    room_number text NOT NULL,
    room_type text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, building_id, room_number)
);


-- Domain: housing
CREATE TABLE housing_beds (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL,
    bed_label text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, room_id, bed_label)
);


-- Domain: housing
CREATE TABLE housing_applications (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, person_id, cycle_id)
);


-- Domain: housing
CREATE TABLE housing_preferences (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    preference_code text NOT NULL,
    rank smallint,
    value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_eligibility_results (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL,
    policy_version_id uuid NOT NULL,
    result text NOT NULL,
    reason_codes text[] NOT NULL,
    evaluated_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_placement_instructions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    instruction_code text NOT NULL,
    approved_requirement text NOT NULL,
    authorization_reference text NOT NULL,
    effective_from timestamptz NOT NULL,
    effective_until timestamptz,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE roommate_groups (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL,
    owner_person_id uuid NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE roommate_group_members (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    person_id uuid NOT NULL,
    invitation_status text NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, group_id, person_id)
);


-- Domain: housing
CREATE TABLE housing_selection_windows (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL,
    person_id uuid,
    group_id uuid,
    opens_at timestamptz NOT NULL,
    closes_at timestamptz NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (num_nonnulls(person_id, group_id) = 1),
    CHECK (closes_at > opens_at)
);


-- Domain: housing
CREATE TABLE housing_allocations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL,
    bed_id uuid NOT NULL,
    person_id uuid NOT NULL,
    occupancy_range tstzrange NOT NULL,
    state text NOT NULL,
    expires_at timestamptz,
    request_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, request_key),
    CHECK (state IN ('reserved','offered','contracted','occupied','completed','cancelled','expired')),
    CHECK (NOT isempty(occupancy_range) AND NOT lower_inf(occupancy_range) AND NOT upper_inf(occupancy_range) AND lower_inc(occupancy_range) AND NOT upper_inc(occupancy_range)),
    CHECK (state <> 'reserved' OR expires_at IS NOT NULL)
);


-- Domain: housing
CREATE TABLE housing_assignments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    allocation_id uuid NOT NULL,
    application_id uuid,
    assigned_by uuid NOT NULL,
    confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, allocation_id)
);


-- Domain: housing
CREATE TABLE housing_contracts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    template_version_id uuid NOT NULL,
    document_id uuid NOT NULL,
    signature_reference text,
    status text NOT NULL,
    signed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_inspections (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    inspector_id uuid NOT NULL,
    inspection_type text NOT NULL,
    status text NOT NULL,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_inspection_items (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    inspection_id uuid NOT NULL,
    item_code text NOT NULL,
    condition_code text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_inspection_evidence (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    inspection_item_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_work_orders (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL,
    reported_by uuid NOT NULL,
    assigned_team_reference text,
    category text NOT NULL,
    priority text NOT NULL,
    status text NOT NULL,
    entry_permission text NOT NULL,
    reported_at timestamptz NOT NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_extension_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    decided_by uuid,
    requested_until timestamptz NOT NULL,
    approved_until timestamptz,
    status text NOT NULL,
    reason_code text NOT NULL,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_deadline_evaluations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    policy_version_id uuid NOT NULL,
    extension_request_id uuid,
    official_deadline timestamptz,
    input_references jsonb NOT NULL,
    reason_codes text[] NOT NULL,
    evaluation_status text NOT NULL,
    evaluated_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_checkout_events (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    scheduled_at timestamptz,
    completed_at timestamptz,
    keys_returned_at timestamptz,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_assessments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    inspection_item_id uuid,
    billing_charge_id uuid,
    reason_code text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: housing
CREATE TABLE housing_assessment_appeals (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    decided_by uuid,
    reason text NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz NOT NULL,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_plan_versions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    term_id uuid NOT NULL,
    rules_version_id uuid NOT NULL,
    plan_code text NOT NULL,
    version_number integer NOT NULL,
    name text NOT NULL,
    price_minor bigint NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, plan_code, version_number),
    CHECK (price_minor >= 0),
    CHECK (currency ~ '^[A-Z]{3}$')
);


-- Domain: dining
CREATE TABLE dining_eligibility_rules (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    plan_version_id uuid NOT NULL,
    definition jsonb NOT NULL,
    effective_from date NOT NULL,
    effective_until date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_plan_enrollments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    plan_version_id uuid NOT NULL,
    source_connection_id uuid,
    external_id text,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (ends_on >= starts_on)
);


-- Domain: dining
CREATE TABLE dining_plan_change_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    requested_plan_version_id uuid NOT NULL,
    decided_by uuid,
    requested_effective_on date NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz NOT NULL,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_entitlement_types (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    unit text NOT NULL,
    usage_rules jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code)
);


-- Domain: dining
CREATE TABLE dining_plan_benefits (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    plan_version_id uuid NOT NULL,
    entitlement_type_id uuid NOT NULL,
    grant_quantity integer NOT NULL,
    reset_rule jsonb NOT NULL,
    rollover_rule jsonb NOT NULL,
    expiration_rule jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (grant_quantity >= 0)
);


-- Domain: dining
CREATE TABLE dining_entitlement_periods (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    plan_enrollment_id uuid NOT NULL,
    entitlement_type_id uuid NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (ends_at > starts_at),
    UNIQUE (tenant_id, plan_enrollment_id, entitlement_type_id, starts_at)
);


-- Domain: dining
CREATE TABLE campus_wallet_types (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    usage_rules jsonb NOT NULL,
    refund_rules jsonb NOT NULL,
    expiration_rules jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code)
);


-- Domain: dining
CREATE TABLE campus_wallets (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    wallet_type_id uuid NOT NULL,
    authority_connection_id uuid,
    currency text NOT NULL,
    external_account_id text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (currency ~ '^[A-Z]{3}$')
);


-- Domain: dining
CREATE TABLE dining_locations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    campus_id uuid NOT NULL,
    name text NOT NULL,
    place_reference text,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_location_acceptance (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL,
    wallet_type_id uuid,
    entitlement_type_id uuid,
    policy_version_id uuid NOT NULL,
    effective_from date NOT NULL,
    effective_until date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (num_nonnulls(wallet_type_id, entitlement_type_id) = 1)
);


-- Domain: dining
CREATE TABLE dining_hours (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL,
    service_date date NOT NULL,
    opens_at timestamptz,
    closes_at timestamptz,
    closure_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE menus (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL,
    service_date date NOT NULL,
    service_period text NOT NULL,
    version_number integer NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, location_id, service_date, service_period, version_number)
);


-- Domain: dining
CREATE TABLE menu_items (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    ingredient_source text,
    last_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE menu_item_attributes (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    menu_item_id uuid NOT NULL,
    attribute_code text NOT NULL,
    verification_status text NOT NULL,
    source_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE menu_entries (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    menu_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    station_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_transactions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    location_id uuid,
    source_connection_id uuid,
    external_transaction_id text,
    occurred_at timestamptz NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, source_connection_id, external_transaction_id)
);


-- Domain: dining
CREATE TABLE dining_transaction_lines (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL,
    wallet_id uuid,
    entitlement_period_id uuid,
    amount_minor bigint,
    quantity integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND amount_minor > 0 AND amount_minor IS NOT NULL AND quantity IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND quantity > 0 AND quantity IS NOT NULL AND amount_minor IS NULL))
);


-- Domain: dining
CREATE TABLE dining_disputes (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL,
    person_id uuid NOT NULL,
    reason_code text NOT NULL,
    status text NOT NULL,
    submitted_at timestamptz NOT NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: dining
CREATE TABLE dining_adjustment_requests (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wallet_id uuid,
    entitlement_period_id uuid,
    dispute_id uuid,
    requested_by uuid NOT NULL,
    approved_by uuid,
    delta_minor bigint,
    delta_quantity integer,
    reason_code text NOT NULL,
    status text NOT NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND delta_minor IS NOT NULL AND delta_minor <> 0 AND delta_quantity IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND delta_quantity IS NOT NULL AND delta_quantity <> 0 AND delta_minor IS NULL)),
    CHECK (approved_by IS NULL OR approved_by <> requested_by)
);


-- Domain: dining
CREATE TABLE dining_entitlement_entries (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    period_id uuid NOT NULL,
    transaction_line_id uuid,
    adjustment_request_id uuid,
    reverses_entry_id uuid,
    delta_quantity integer NOT NULL,
    entry_type text NOT NULL,
    idempotency_key text NOT NULL,
    posted_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, idempotency_key),
    CHECK (delta_quantity <> 0)
);


-- Domain: dining
CREATE TABLE campus_wallet_entries (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL,
    transaction_line_id uuid,
    adjustment_request_id uuid,
    payment_order_id uuid,
    reverses_entry_id uuid,
    delta_minor bigint NOT NULL,
    entry_type text NOT NULL,
    idempotency_key text NOT NULL,
    posted_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, idempotency_key),
    CHECK (delta_minor <> 0)
);


-- Domain: dining
CREATE TABLE dining_balance_snapshots (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wallet_id uuid,
    entitlement_period_id uuid,
    source_connection_id uuid NOT NULL,
    money_balance_minor bigint,
    quantity_balance integer,
    source_version text,
    as_of timestamptz NOT NULL,
    received_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND money_balance_minor IS NOT NULL AND quantity_balance IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND quantity_balance IS NOT NULL AND money_balance_minor IS NULL))
);


-- Domain: governance
CREATE TABLE roles (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code)
);


-- Domain: governance
CREATE TABLE permissions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, code)
);


-- Domain: governance
CREATE TABLE role_permissions (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, role_id, permission_id)
);


-- Domain: governance
CREATE TABLE role_assignments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_type text NOT NULL,
    scope_reference text NOT NULL,
    starts_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE advisor_assignments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    advisor_person_id uuid NOT NULL,
    student_person_id uuid NOT NULL,
    program_id uuid,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE case_assignments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    case_type text NOT NULL,
    case_reference uuid NOT NULL,
    purpose_code text NOT NULL,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE consents (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subject_person_id uuid NOT NULL,
    purpose text NOT NULL,
    record_scope jsonb NOT NULL,
    recipient_scope jsonb NOT NULL,
    signature_evidence_document_id uuid NOT NULL,
    signed_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE delegations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subject_person_id uuid NOT NULL,
    delegate_person_id uuid NOT NULL,
    consent_id uuid,
    permission_scope jsonb NOT NULL,
    starts_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE pii_values (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    field_type text NOT NULL,
    ciphertext bytea NOT NULL,
    key_reference text NOT NULL,
    classification text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: governance
CREATE TABLE subject_tokens (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid NOT NULL,
    recipient_scope text NOT NULL,
    purpose_scope text NOT NULL,
    token_value text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, token_value)
);


-- Domain: governance
CREATE TABLE privileged_access_grants (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL,
    approved_by uuid NOT NULL,
    scope jsonb NOT NULL,
    reason_code text NOT NULL,
    starts_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (expires_at > starts_at),
    CHECK (actor_id <> approved_by)
);


-- Domain: governance
CREATE TABLE audit_events (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    occurred_at timestamptz NOT NULL,
    actor_kind text NOT NULL,
    actor_person_id uuid,
    actor_service_reference text,
    subject_token_id uuid,
    action text NOT NULL,
    resource_domain text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    outcome text NOT NULL,
    reason_code text NOT NULL,
    purpose_code text,
    policy_version_id uuid,
    request_id text NOT NULL,
    returned_record_count integer,
    field_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (outcome IN ('allow','deny','error')),
    CHECK (returned_record_count IS NULL OR returned_record_count >= 0),
    CHECK ((actor_kind = 'person' AND actor_person_id IS NOT NULL AND actor_service_reference IS NULL) OR (actor_kind = 'service' AND actor_person_id IS NULL AND actor_service_reference IS NOT NULL) OR (actor_kind = 'anonymous' AND actor_person_id IS NULL AND actor_service_reference IS NULL))
);


-- Domain: governance
CREATE TABLE ferpa_disclosure_records (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subject_person_id uuid NOT NULL,
    audit_event_id uuid,
    recipient_reference text NOT NULL,
    recipient_description text NOT NULL,
    records_description text NOT NULL,
    legal_basis_code text NOT NULL,
    legitimate_interest text,
    consent_id uuid,
    disclosed_at timestamptz,
    request_received_at timestamptz,
    record_type text NOT NULL,
    additional_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
    emergency_basis_reference text,
    recorded_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    CHECK (record_type IN ('request','disclosure')),
    CHECK ((record_type='request' AND request_received_at IS NOT NULL) OR (record_type='disclosure' AND disclosed_at IS NOT NULL))
);


-- Domain: governance
CREATE TABLE export_jobs (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    requested_by uuid NOT NULL,
    scope jsonb NOT NULL,
    recipient_reference text NOT NULL,
    legal_basis_code text NOT NULL,
    status text NOT NULL,
    artifact_manifest jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: lti
CREATE TABLE lti_registrations (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    issuer text NOT NULL,
    client_id text NOT NULL,
    authorization_endpoint text NOT NULL,
    token_endpoint text NOT NULL,
    platform_jwks_uri text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, issuer, client_id)
);


-- Domain: lti
CREATE TABLE lti_deployments (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL,
    deployment_id text NOT NULL,
    allowed_services text[] NOT NULL DEFAULT ARRAY[]::text[],
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, registration_id, deployment_id)
);


-- Domain: lti
CREATE TABLE lti_login_attempts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL,
    state_hash text NOT NULL,
    nonce_hash text NOT NULL,
    expected_target_uri text NOT NULL,
    browser_binding_reference text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, state_hash)
);


-- Domain: lti
CREATE TABLE lti_subject_links (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL,
    issuer_subject text NOT NULL,
    person_id uuid NOT NULL,
    link_method text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, registration_id, issuer_subject)
);


-- Domain: lti
CREATE TABLE lti_context_links (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deployment_id uuid NOT NULL,
    external_context_id text NOT NULL,
    local_section_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, deployment_id, external_context_id)
);


-- Domain: lti
CREATE TABLE lti_resource_links (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deployment_id uuid NOT NULL,
    context_link_id uuid,
    external_resource_link_id text NOT NULL,
    local_resource_reference text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, deployment_id, external_resource_link_id)
);


-- Domain: lti
CREATE TABLE lti_launch_receipts (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deployment_id uuid NOT NULL,
    subject_token_id uuid,
    context_link_id uuid,
    resource_link_id uuid,
    message_type text NOT NULL,
    validation_result text NOT NULL,
    mapped_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
    custom_key_names text[] NOT NULL DEFAULT ARRAY[]::text[],
    audit_event_id uuid,
    launched_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: lti
CREATE TABLE lti_service_grants (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deployment_id uuid NOT NULL,
    service_type text NOT NULL,
    allowed_scopes text[] NOT NULL,
    endpoint_policy jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id)
);


-- Domain: lti
CREATE TABLE lti_custom_claim_policies (
    tenant_id uuid NOT NULL REFERENCES institutions(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    deployment_id uuid NOT NULL,
    claim_key text NOT NULL,
    value_schema jsonb NOT NULL,
    mapping_action text NOT NULL,
    pii_classification text NOT NULL,
    policy_version_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, deployment_id, claim_key)
);

ALTER TABLE identity_links ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON identity_links (tenant_id, person_id);

ALTER TABLE memberships ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON memberships (tenant_id, person_id);

ALTER TABLE documents ADD FOREIGN KEY (tenant_id, owner_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON documents (tenant_id, owner_person_id);

ALTER TABLE documents ADD FOREIGN KEY (tenant_id, retention_policy_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON documents (tenant_id, retention_policy_id);

ALTER TABLE document_versions ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON document_versions (tenant_id, document_id);

ALTER TABLE external_record_links ADD FOREIGN KEY (tenant_id, connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON external_record_links (tenant_id, connection_id);

ALTER TABLE integration_jobs ADD FOREIGN KEY (tenant_id, connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON integration_jobs (tenant_id, connection_id);

ALTER TABLE webhook_receipts ADD FOREIGN KEY (tenant_id, connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON webhook_receipts (tenant_id, connection_id);

ALTER TABLE workflow_instances ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON workflow_instances (tenant_id, person_id);

ALTER TABLE workflow_instances ADD FOREIGN KEY (tenant_id, definition_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON workflow_instances (tenant_id, definition_version_id);

ALTER TABLE workflow_tasks ADD FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflow_instances (tenant_id, id);

CREATE INDEX ON workflow_tasks (tenant_id, workflow_id);

ALTER TABLE workflow_tasks ADD FOREIGN KEY (tenant_id, assigned_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON workflow_tasks (tenant_id, assigned_person_id);

ALTER TABLE task_dependencies ADD FOREIGN KEY (tenant_id, task_id) REFERENCES workflow_tasks (tenant_id, id);

CREATE INDEX ON task_dependencies (tenant_id, task_id);

ALTER TABLE task_dependencies ADD FOREIGN KEY (tenant_id, prerequisite_task_id) REFERENCES workflow_tasks (tenant_id, id);

CREATE INDEX ON task_dependencies (tenant_id, prerequisite_task_id);

ALTER TABLE task_evidence ADD FOREIGN KEY (tenant_id, task_id) REFERENCES workflow_tasks (tenant_id, id);

CREATE INDEX ON task_evidence (tenant_id, task_id);

ALTER TABLE task_evidence ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON task_evidence (tenant_id, document_id);

ALTER TABLE task_evidence ADD FOREIGN KEY (tenant_id, verified_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON task_evidence (tenant_id, verified_by);

ALTER TABLE billing_accounts ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON billing_accounts (tenant_id, person_id);

ALTER TABLE billing_accounts ADD FOREIGN KEY (tenant_id, authority_connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON billing_accounts (tenant_id, authority_connection_id);

ALTER TABLE billing_charges ADD FOREIGN KEY (tenant_id, billing_account_id) REFERENCES billing_accounts (tenant_id, id);

CREATE INDEX ON billing_charges (tenant_id, billing_account_id);

ALTER TABLE payment_orders ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON payment_orders (tenant_id, person_id);

ALTER TABLE payment_order_allocations ADD FOREIGN KEY (tenant_id, payment_order_id) REFERENCES payment_orders (tenant_id, id);

CREATE INDEX ON payment_order_allocations (tenant_id, payment_order_id);

ALTER TABLE payment_order_allocations ADD FOREIGN KEY (tenant_id, charge_id) REFERENCES billing_charges (tenant_id, id);

CREATE INDEX ON payment_order_allocations (tenant_id, charge_id);

ALTER TABLE payment_attempts ADD FOREIGN KEY (tenant_id, payment_order_id) REFERENCES payment_orders (tenant_id, id);

CREATE INDEX ON payment_attempts (tenant_id, payment_order_id);

ALTER TABLE payment_attempts ADD FOREIGN KEY (tenant_id, connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON payment_attempts (tenant_id, connection_id);

ALTER TABLE payment_refunds ADD FOREIGN KEY (tenant_id, payment_attempt_id) REFERENCES payment_attempts (tenant_id, id);

CREATE INDEX ON payment_refunds (tenant_id, payment_attempt_id);

ALTER TABLE payment_refunds ADD FOREIGN KEY (tenant_id, requested_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON payment_refunds (tenant_id, requested_by);

ALTER TABLE payment_refunds ADD FOREIGN KEY (tenant_id, approved_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON payment_refunds (tenant_id, approved_by);

ALTER TABLE payment_reconciliations ADD FOREIGN KEY (tenant_id, payment_attempt_id) REFERENCES payment_attempts (tenant_id, id);

CREATE INDEX ON payment_reconciliations (tenant_id, payment_attempt_id);

ALTER TABLE admission_cycles ADD FOREIGN KEY (tenant_id, program_id) REFERENCES programs (tenant_id, id);

CREATE INDEX ON admission_cycles (tenant_id, program_id);

ALTER TABLE admission_cycles ADD FOREIGN KEY (tenant_id, entry_term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON admission_cycles (tenant_id, entry_term_id);

ALTER TABLE admission_cycles ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON admission_cycles (tenant_id, policy_version_id);

ALTER TABLE applications ADD FOREIGN KEY (tenant_id, applicant_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON applications (tenant_id, applicant_person_id);

ALTER TABLE applications ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES admission_cycles (tenant_id, id);

CREATE INDEX ON applications (tenant_id, cycle_id);

ALTER TABLE application_requirements ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON application_requirements (tenant_id, application_id);

ALTER TABLE application_requirements ADD FOREIGN KEY (tenant_id, verified_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON application_requirements (tenant_id, verified_by);

ALTER TABLE application_question_versions ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES admission_cycles (tenant_id, id);

CREATE INDEX ON application_question_versions (tenant_id, cycle_id);

ALTER TABLE application_answers ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON application_answers (tenant_id, application_id);

ALTER TABLE application_answers ADD FOREIGN KEY (tenant_id, question_version_id) REFERENCES application_question_versions (tenant_id, id);

CREATE INDEX ON application_answers (tenant_id, question_version_id);

ALTER TABLE application_submission_snapshots ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON application_submission_snapshots (tenant_id, application_id);

ALTER TABLE application_submission_snapshots ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON application_submission_snapshots (tenant_id, document_id);

ALTER TABLE application_documents ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON application_documents (tenant_id, application_id);

ALTER TABLE application_documents ADD FOREIGN KEY (tenant_id, requirement_id) REFERENCES application_requirements (tenant_id, id);

CREATE INDEX ON application_documents (tenant_id, requirement_id);

ALTER TABLE application_documents ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON application_documents (tenant_id, document_id);

ALTER TABLE recommendation_requests ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON recommendation_requests (tenant_id, application_id);

ALTER TABLE recommendation_requests ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON recommendation_requests (tenant_id, document_id);

ALTER TABLE recommendation_requests ADD FOREIGN KEY (tenant_id, waiver_evidence_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON recommendation_requests (tenant_id, waiver_evidence_id);

ALTER TABLE application_reviews ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON application_reviews (tenant_id, application_id);

ALTER TABLE application_reviews ADD FOREIGN KEY (tenant_id, reviewer_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON application_reviews (tenant_id, reviewer_person_id);

ALTER TABLE application_reviews ADD FOREIGN KEY (tenant_id, rubric_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON application_reviews (tenant_id, rubric_version_id);

ALTER TABLE review_scores ADD FOREIGN KEY (tenant_id, review_id) REFERENCES application_reviews (tenant_id, id);

CREATE INDEX ON review_scores (tenant_id, review_id);

ALTER TABLE admission_decisions ADD FOREIGN KEY (tenant_id, application_id) REFERENCES applications (tenant_id, id);

CREATE INDEX ON admission_decisions (tenant_id, application_id);

ALTER TABLE admission_decisions ADD FOREIGN KEY (tenant_id, approved_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON admission_decisions (tenant_id, approved_by);

ALTER TABLE admission_decisions ADD FOREIGN KEY (tenant_id, released_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON admission_decisions (tenant_id, released_by);

ALTER TABLE admission_decisions ADD FOREIGN KEY (tenant_id, supersedes_decision_id) REFERENCES admission_decisions (tenant_id, id);

CREATE INDEX ON admission_decisions (tenant_id, supersedes_decision_id);

ALTER TABLE admission_offers ADD FOREIGN KEY (tenant_id, decision_id) REFERENCES admission_decisions (tenant_id, id);

CREATE INDEX ON admission_offers (tenant_id, decision_id);

ALTER TABLE offer_conditions ADD FOREIGN KEY (tenant_id, offer_id) REFERENCES admission_offers (tenant_id, id);

CREATE INDEX ON offer_conditions (tenant_id, offer_id);

ALTER TABLE student_records ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON student_records (tenant_id, person_id);

ALTER TABLE student_program_enrollments ADD FOREIGN KEY (tenant_id, student_record_id) REFERENCES student_records (tenant_id, id);

CREATE INDEX ON student_program_enrollments (tenant_id, student_record_id);

ALTER TABLE student_program_enrollments ADD FOREIGN KEY (tenant_id, program_id) REFERENCES programs (tenant_id, id);

CREATE INDEX ON student_program_enrollments (tenant_id, program_id);

ALTER TABLE student_program_enrollments ADD FOREIGN KEY (tenant_id, entry_term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON student_program_enrollments (tenant_id, entry_term_id);

ALTER TABLE onboarding_instances ADD FOREIGN KEY (tenant_id, offer_id) REFERENCES admission_offers (tenant_id, id);

CREATE INDEX ON onboarding_instances (tenant_id, offer_id);

ALTER TABLE onboarding_instances ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON onboarding_instances (tenant_id, person_id);

ALTER TABLE onboarding_instances ADD FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflow_instances (tenant_id, id);

CREATE INDEX ON onboarding_instances (tenant_id, workflow_id);

ALTER TABLE course_versions ADD FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, id);

CREATE INDEX ON course_versions (tenant_id, course_id);

ALTER TABLE course_versions ADD FOREIGN KEY (tenant_id, effective_term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON course_versions (tenant_id, effective_term_id);

ALTER TABLE sections ADD FOREIGN KEY (tenant_id, course_version_id) REFERENCES course_versions (tenant_id, id);

CREATE INDEX ON sections (tenant_id, course_version_id);

ALTER TABLE sections ADD FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON sections (tenant_id, term_id);

ALTER TABLE section_meetings ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON section_meetings (tenant_id, section_id);

ALTER TABLE section_instructors ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON section_instructors (tenant_id, section_id);

ALTER TABLE section_instructors ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON section_instructors (tenant_id, person_id);

ALTER TABLE section_rule_assignments ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON section_rule_assignments (tenant_id, section_id);

ALTER TABLE section_rule_assignments ADD FOREIGN KEY (tenant_id, rule_set_id) REFERENCES academic_rule_sets (tenant_id, id);

CREATE INDEX ON section_rule_assignments (tenant_id, rule_set_id);

ALTER TABLE section_link_rules ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON section_link_rules (tenant_id, section_id);

ALTER TABLE registration_appointments ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON registration_appointments (tenant_id, person_id);

ALTER TABLE registration_appointments ADD FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON registration_appointments (tenant_id, term_id);

ALTER TABLE student_holds ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON student_holds (tenant_id, person_id);

ALTER TABLE student_holds ADD FOREIGN KEY (tenant_id, released_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON student_holds (tenant_id, released_by);

ALTER TABLE registration_requests ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON registration_requests (tenant_id, person_id);

ALTER TABLE registration_requests ADD FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON registration_requests (tenant_id, term_id);

ALTER TABLE registration_request_items ADD FOREIGN KEY (tenant_id, request_id) REFERENCES registration_requests (tenant_id, id);

CREATE INDEX ON registration_request_items (tenant_id, request_id);

ALTER TABLE registration_request_items ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON registration_request_items (tenant_id, section_id);

ALTER TABLE enrollments ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON enrollments (tenant_id, person_id);

ALTER TABLE enrollments ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON enrollments (tenant_id, section_id);

ALTER TABLE enrollment_events ADD FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments (tenant_id, id);

CREATE INDEX ON enrollment_events (tenant_id, enrollment_id);

ALTER TABLE enrollment_events ADD FOREIGN KEY (tenant_id, request_id) REFERENCES registration_requests (tenant_id, id);

CREATE INDEX ON enrollment_events (tenant_id, request_id);

ALTER TABLE waitlist_entries ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON waitlist_entries (tenant_id, person_id);

ALTER TABLE waitlist_entries ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON waitlist_entries (tenant_id, section_id);

ALTER TABLE override_requests ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON override_requests (tenant_id, person_id);

ALTER TABLE override_requests ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON override_requests (tenant_id, section_id);

ALTER TABLE override_requests ADD FOREIGN KEY (tenant_id, approved_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON override_requests (tenant_id, approved_by);

ALTER TABLE exam_events ADD FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON exam_events (tenant_id, section_id);

ALTER TABLE academic_document_requests ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON academic_document_requests (tenant_id, person_id);

ALTER TABLE academic_document_requests ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON academic_document_requests (tenant_id, document_id);

ALTER TABLE housing_cycles ADD FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON housing_cycles (tenant_id, term_id);

ALTER TABLE housing_cycles ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON housing_cycles (tenant_id, policy_version_id);

ALTER TABLE housing_buildings ADD FOREIGN KEY (tenant_id, campus_id) REFERENCES campuses (tenant_id, id);

CREATE INDEX ON housing_buildings (tenant_id, campus_id);

ALTER TABLE housing_rooms ADD FOREIGN KEY (tenant_id, building_id) REFERENCES housing_buildings (tenant_id, id);

CREATE INDEX ON housing_rooms (tenant_id, building_id);

ALTER TABLE housing_beds ADD FOREIGN KEY (tenant_id, room_id) REFERENCES housing_rooms (tenant_id, id);

CREATE INDEX ON housing_beds (tenant_id, room_id);

ALTER TABLE housing_applications ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_applications (tenant_id, person_id);

ALTER TABLE housing_applications ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES housing_cycles (tenant_id, id);

CREATE INDEX ON housing_applications (tenant_id, cycle_id);

ALTER TABLE housing_preferences ADD FOREIGN KEY (tenant_id, application_id) REFERENCES housing_applications (tenant_id, id);

CREATE INDEX ON housing_preferences (tenant_id, application_id);

ALTER TABLE housing_eligibility_results ADD FOREIGN KEY (tenant_id, application_id) REFERENCES housing_applications (tenant_id, id);

CREATE INDEX ON housing_eligibility_results (tenant_id, application_id);

ALTER TABLE housing_eligibility_results ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON housing_eligibility_results (tenant_id, policy_version_id);

ALTER TABLE housing_placement_instructions ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_placement_instructions (tenant_id, person_id);

ALTER TABLE housing_placement_instructions ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES housing_cycles (tenant_id, id);

CREATE INDEX ON housing_placement_instructions (tenant_id, cycle_id);

ALTER TABLE roommate_groups ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES housing_cycles (tenant_id, id);

CREATE INDEX ON roommate_groups (tenant_id, cycle_id);

ALTER TABLE roommate_groups ADD FOREIGN KEY (tenant_id, owner_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON roommate_groups (tenant_id, owner_person_id);

ALTER TABLE roommate_group_members ADD FOREIGN KEY (tenant_id, group_id) REFERENCES roommate_groups (tenant_id, id);

CREATE INDEX ON roommate_group_members (tenant_id, group_id);

ALTER TABLE roommate_group_members ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON roommate_group_members (tenant_id, person_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES housing_cycles (tenant_id, id);

CREATE INDEX ON housing_selection_windows (tenant_id, cycle_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_selection_windows (tenant_id, person_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY (tenant_id, group_id) REFERENCES roommate_groups (tenant_id, id);

CREATE INDEX ON housing_selection_windows (tenant_id, group_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY (tenant_id, cycle_id) REFERENCES housing_cycles (tenant_id, id);

CREATE INDEX ON housing_allocations (tenant_id, cycle_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY (tenant_id, bed_id) REFERENCES housing_beds (tenant_id, id);

CREATE INDEX ON housing_allocations (tenant_id, bed_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_allocations (tenant_id, person_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY (tenant_id, allocation_id) REFERENCES housing_allocations (tenant_id, id);

CREATE INDEX ON housing_assignments (tenant_id, allocation_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY (tenant_id, application_id) REFERENCES housing_applications (tenant_id, id);

CREATE INDEX ON housing_assignments (tenant_id, application_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY (tenant_id, assigned_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_assignments (tenant_id, assigned_by);

ALTER TABLE housing_contracts ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_contracts (tenant_id, assignment_id);

ALTER TABLE housing_contracts ADD FOREIGN KEY (tenant_id, template_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON housing_contracts (tenant_id, template_version_id);

ALTER TABLE housing_contracts ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON housing_contracts (tenant_id, document_id);

ALTER TABLE housing_inspections ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_inspections (tenant_id, assignment_id);

ALTER TABLE housing_inspections ADD FOREIGN KEY (tenant_id, inspector_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_inspections (tenant_id, inspector_id);

ALTER TABLE housing_inspection_items ADD FOREIGN KEY (tenant_id, inspection_id) REFERENCES housing_inspections (tenant_id, id);

CREATE INDEX ON housing_inspection_items (tenant_id, inspection_id);

ALTER TABLE housing_inspection_evidence ADD FOREIGN KEY (tenant_id, inspection_item_id) REFERENCES housing_inspection_items (tenant_id, id);

CREATE INDEX ON housing_inspection_evidence (tenant_id, inspection_item_id);

ALTER TABLE housing_inspection_evidence ADD FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON housing_inspection_evidence (tenant_id, document_id);

ALTER TABLE housing_work_orders ADD FOREIGN KEY (tenant_id, room_id) REFERENCES housing_rooms (tenant_id, id);

CREATE INDEX ON housing_work_orders (tenant_id, room_id);

ALTER TABLE housing_work_orders ADD FOREIGN KEY (tenant_id, reported_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_work_orders (tenant_id, reported_by);

ALTER TABLE housing_extension_requests ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_extension_requests (tenant_id, assignment_id);

ALTER TABLE housing_extension_requests ADD FOREIGN KEY (tenant_id, decided_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_extension_requests (tenant_id, decided_by);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_deadline_evaluations (tenant_id, assignment_id);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON housing_deadline_evaluations (tenant_id, policy_version_id);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY (tenant_id, extension_request_id) REFERENCES housing_extension_requests (tenant_id, id);

CREATE INDEX ON housing_deadline_evaluations (tenant_id, extension_request_id);

ALTER TABLE housing_checkout_events ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_checkout_events (tenant_id, assignment_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY (tenant_id, assignment_id) REFERENCES housing_assignments (tenant_id, id);

CREATE INDEX ON housing_assessments (tenant_id, assignment_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY (tenant_id, inspection_item_id) REFERENCES housing_inspection_items (tenant_id, id);

CREATE INDEX ON housing_assessments (tenant_id, inspection_item_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY (tenant_id, billing_charge_id) REFERENCES billing_charges (tenant_id, id);

CREATE INDEX ON housing_assessments (tenant_id, billing_charge_id);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY (tenant_id, assessment_id) REFERENCES housing_assessments (tenant_id, id);

CREATE INDEX ON housing_assessment_appeals (tenant_id, assessment_id);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY (tenant_id, submitted_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_assessment_appeals (tenant_id, submitted_by);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY (tenant_id, decided_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON housing_assessment_appeals (tenant_id, decided_by);

ALTER TABLE dining_plan_versions ADD FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms (tenant_id, id);

CREATE INDEX ON dining_plan_versions (tenant_id, term_id);

ALTER TABLE dining_plan_versions ADD FOREIGN KEY (tenant_id, rules_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON dining_plan_versions (tenant_id, rules_version_id);

ALTER TABLE dining_eligibility_rules ADD FOREIGN KEY (tenant_id, plan_version_id) REFERENCES dining_plan_versions (tenant_id, id);

CREATE INDEX ON dining_eligibility_rules (tenant_id, plan_version_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_plan_enrollments (tenant_id, person_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY (tenant_id, plan_version_id) REFERENCES dining_plan_versions (tenant_id, id);

CREATE INDEX ON dining_plan_enrollments (tenant_id, plan_version_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY (tenant_id, source_connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON dining_plan_enrollments (tenant_id, source_connection_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY (tenant_id, enrollment_id) REFERENCES dining_plan_enrollments (tenant_id, id);

CREATE INDEX ON dining_plan_change_requests (tenant_id, enrollment_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY (tenant_id, requested_plan_version_id) REFERENCES dining_plan_versions (tenant_id, id);

CREATE INDEX ON dining_plan_change_requests (tenant_id, requested_plan_version_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY (tenant_id, decided_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_plan_change_requests (tenant_id, decided_by);

ALTER TABLE dining_plan_benefits ADD FOREIGN KEY (tenant_id, plan_version_id) REFERENCES dining_plan_versions (tenant_id, id);

CREATE INDEX ON dining_plan_benefits (tenant_id, plan_version_id);

ALTER TABLE dining_plan_benefits ADD FOREIGN KEY (tenant_id, entitlement_type_id) REFERENCES dining_entitlement_types (tenant_id, id);

CREATE INDEX ON dining_plan_benefits (tenant_id, entitlement_type_id);

ALTER TABLE dining_entitlement_periods ADD FOREIGN KEY (tenant_id, plan_enrollment_id) REFERENCES dining_plan_enrollments (tenant_id, id);

CREATE INDEX ON dining_entitlement_periods (tenant_id, plan_enrollment_id);

ALTER TABLE dining_entitlement_periods ADD FOREIGN KEY (tenant_id, entitlement_type_id) REFERENCES dining_entitlement_types (tenant_id, id);

CREATE INDEX ON dining_entitlement_periods (tenant_id, entitlement_type_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON campus_wallets (tenant_id, person_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY (tenant_id, wallet_type_id) REFERENCES campus_wallet_types (tenant_id, id);

CREATE INDEX ON campus_wallets (tenant_id, wallet_type_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY (tenant_id, authority_connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON campus_wallets (tenant_id, authority_connection_id);

ALTER TABLE dining_locations ADD FOREIGN KEY (tenant_id, campus_id) REFERENCES campuses (tenant_id, id);

CREATE INDEX ON dining_locations (tenant_id, campus_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY (tenant_id, location_id) REFERENCES dining_locations (tenant_id, id);

CREATE INDEX ON dining_location_acceptance (tenant_id, location_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY (tenant_id, wallet_type_id) REFERENCES campus_wallet_types (tenant_id, id);

CREATE INDEX ON dining_location_acceptance (tenant_id, wallet_type_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY (tenant_id, entitlement_type_id) REFERENCES dining_entitlement_types (tenant_id, id);

CREATE INDEX ON dining_location_acceptance (tenant_id, entitlement_type_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON dining_location_acceptance (tenant_id, policy_version_id);

ALTER TABLE dining_hours ADD FOREIGN KEY (tenant_id, location_id) REFERENCES dining_locations (tenant_id, id);

CREATE INDEX ON dining_hours (tenant_id, location_id);

ALTER TABLE menus ADD FOREIGN KEY (tenant_id, location_id) REFERENCES dining_locations (tenant_id, id);

CREATE INDEX ON menus (tenant_id, location_id);

ALTER TABLE menu_item_attributes ADD FOREIGN KEY (tenant_id, menu_item_id) REFERENCES menu_items (tenant_id, id);

CREATE INDEX ON menu_item_attributes (tenant_id, menu_item_id);

ALTER TABLE menu_entries ADD FOREIGN KEY (tenant_id, menu_id) REFERENCES menus (tenant_id, id);

CREATE INDEX ON menu_entries (tenant_id, menu_id);

ALTER TABLE menu_entries ADD FOREIGN KEY (tenant_id, menu_item_id) REFERENCES menu_items (tenant_id, id);

CREATE INDEX ON menu_entries (tenant_id, menu_item_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_transactions (tenant_id, person_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY (tenant_id, location_id) REFERENCES dining_locations (tenant_id, id);

CREATE INDEX ON dining_transactions (tenant_id, location_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY (tenant_id, source_connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON dining_transactions (tenant_id, source_connection_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY (tenant_id, transaction_id) REFERENCES dining_transactions (tenant_id, id);

CREATE INDEX ON dining_transaction_lines (tenant_id, transaction_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY (tenant_id, wallet_id) REFERENCES campus_wallets (tenant_id, id);

CREATE INDEX ON dining_transaction_lines (tenant_id, wallet_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY (tenant_id, entitlement_period_id) REFERENCES dining_entitlement_periods (tenant_id, id);

CREATE INDEX ON dining_transaction_lines (tenant_id, entitlement_period_id);

ALTER TABLE dining_disputes ADD FOREIGN KEY (tenant_id, transaction_id) REFERENCES dining_transactions (tenant_id, id);

CREATE INDEX ON dining_disputes (tenant_id, transaction_id);

ALTER TABLE dining_disputes ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_disputes (tenant_id, person_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY (tenant_id, wallet_id) REFERENCES campus_wallets (tenant_id, id);

CREATE INDEX ON dining_adjustment_requests (tenant_id, wallet_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY (tenant_id, entitlement_period_id) REFERENCES dining_entitlement_periods (tenant_id, id);

CREATE INDEX ON dining_adjustment_requests (tenant_id, entitlement_period_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY (tenant_id, dispute_id) REFERENCES dining_disputes (tenant_id, id);

CREATE INDEX ON dining_adjustment_requests (tenant_id, dispute_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY (tenant_id, requested_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_adjustment_requests (tenant_id, requested_by);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY (tenant_id, approved_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON dining_adjustment_requests (tenant_id, approved_by);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY (tenant_id, period_id) REFERENCES dining_entitlement_periods (tenant_id, id);

CREATE INDEX ON dining_entitlement_entries (tenant_id, period_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY (tenant_id, transaction_line_id) REFERENCES dining_transaction_lines (tenant_id, id);

CREATE INDEX ON dining_entitlement_entries (tenant_id, transaction_line_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY (tenant_id, adjustment_request_id) REFERENCES dining_adjustment_requests (tenant_id, id);

CREATE INDEX ON dining_entitlement_entries (tenant_id, adjustment_request_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY (tenant_id, reverses_entry_id) REFERENCES dining_entitlement_entries (tenant_id, id);

CREATE INDEX ON dining_entitlement_entries (tenant_id, reverses_entry_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY (tenant_id, wallet_id) REFERENCES campus_wallets (tenant_id, id);

CREATE INDEX ON campus_wallet_entries (tenant_id, wallet_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY (tenant_id, transaction_line_id) REFERENCES dining_transaction_lines (tenant_id, id);

CREATE INDEX ON campus_wallet_entries (tenant_id, transaction_line_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY (tenant_id, adjustment_request_id) REFERENCES dining_adjustment_requests (tenant_id, id);

CREATE INDEX ON campus_wallet_entries (tenant_id, adjustment_request_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY (tenant_id, payment_order_id) REFERENCES payment_orders (tenant_id, id);

CREATE INDEX ON campus_wallet_entries (tenant_id, payment_order_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY (tenant_id, reverses_entry_id) REFERENCES campus_wallet_entries (tenant_id, id);

CREATE INDEX ON campus_wallet_entries (tenant_id, reverses_entry_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY (tenant_id, wallet_id) REFERENCES campus_wallets (tenant_id, id);

CREATE INDEX ON dining_balance_snapshots (tenant_id, wallet_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY (tenant_id, entitlement_period_id) REFERENCES dining_entitlement_periods (tenant_id, id);

CREATE INDEX ON dining_balance_snapshots (tenant_id, entitlement_period_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY (tenant_id, source_connection_id) REFERENCES integration_connections (tenant_id, id);

CREATE INDEX ON dining_balance_snapshots (tenant_id, source_connection_id);

ALTER TABLE role_permissions ADD FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id);

CREATE INDEX ON role_permissions (tenant_id, role_id);

ALTER TABLE role_permissions ADD FOREIGN KEY (tenant_id, permission_id) REFERENCES permissions (tenant_id, id);

CREATE INDEX ON role_permissions (tenant_id, permission_id);

ALTER TABLE role_assignments ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON role_assignments (tenant_id, person_id);

ALTER TABLE role_assignments ADD FOREIGN KEY (tenant_id, role_id) REFERENCES roles (tenant_id, id);

CREATE INDEX ON role_assignments (tenant_id, role_id);

ALTER TABLE advisor_assignments ADD FOREIGN KEY (tenant_id, advisor_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON advisor_assignments (tenant_id, advisor_person_id);

ALTER TABLE advisor_assignments ADD FOREIGN KEY (tenant_id, student_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON advisor_assignments (tenant_id, student_person_id);

ALTER TABLE advisor_assignments ADD FOREIGN KEY (tenant_id, program_id) REFERENCES programs (tenant_id, id);

CREATE INDEX ON advisor_assignments (tenant_id, program_id);

ALTER TABLE case_assignments ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON case_assignments (tenant_id, person_id);

ALTER TABLE consents ADD FOREIGN KEY (tenant_id, subject_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON consents (tenant_id, subject_person_id);

ALTER TABLE consents ADD FOREIGN KEY (tenant_id, signature_evidence_document_id) REFERENCES documents (tenant_id, id);

CREATE INDEX ON consents (tenant_id, signature_evidence_document_id);

ALTER TABLE delegations ADD FOREIGN KEY (tenant_id, subject_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON delegations (tenant_id, subject_person_id);

ALTER TABLE delegations ADD FOREIGN KEY (tenant_id, delegate_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON delegations (tenant_id, delegate_person_id);

ALTER TABLE delegations ADD FOREIGN KEY (tenant_id, consent_id) REFERENCES consents (tenant_id, id);

CREATE INDEX ON delegations (tenant_id, consent_id);

ALTER TABLE pii_values ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON pii_values (tenant_id, person_id);

ALTER TABLE subject_tokens ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON subject_tokens (tenant_id, person_id);

ALTER TABLE privileged_access_grants ADD FOREIGN KEY (tenant_id, actor_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON privileged_access_grants (tenant_id, actor_id);

ALTER TABLE privileged_access_grants ADD FOREIGN KEY (tenant_id, approved_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON privileged_access_grants (tenant_id, approved_by);

ALTER TABLE audit_events ADD FOREIGN KEY (tenant_id, actor_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON audit_events (tenant_id, actor_person_id);

ALTER TABLE audit_events ADD FOREIGN KEY (tenant_id, subject_token_id) REFERENCES subject_tokens (tenant_id, id);

CREATE INDEX ON audit_events (tenant_id, subject_token_id);

ALTER TABLE audit_events ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON audit_events (tenant_id, policy_version_id);

ALTER TABLE ferpa_disclosure_records ADD FOREIGN KEY (tenant_id, subject_person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON ferpa_disclosure_records (tenant_id, subject_person_id);

ALTER TABLE ferpa_disclosure_records ADD FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id);

CREATE INDEX ON ferpa_disclosure_records (tenant_id, audit_event_id);

ALTER TABLE ferpa_disclosure_records ADD FOREIGN KEY (tenant_id, consent_id) REFERENCES consents (tenant_id, id);

CREATE INDEX ON ferpa_disclosure_records (tenant_id, consent_id);

ALTER TABLE ferpa_disclosure_records ADD FOREIGN KEY (tenant_id, recorded_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON ferpa_disclosure_records (tenant_id, recorded_by);

ALTER TABLE export_jobs ADD FOREIGN KEY (tenant_id, requested_by) REFERENCES people (tenant_id, id);

CREATE INDEX ON export_jobs (tenant_id, requested_by);

ALTER TABLE lti_deployments ADD FOREIGN KEY (tenant_id, registration_id) REFERENCES lti_registrations (tenant_id, id);

CREATE INDEX ON lti_deployments (tenant_id, registration_id);

ALTER TABLE lti_login_attempts ADD FOREIGN KEY (tenant_id, registration_id) REFERENCES lti_registrations (tenant_id, id);

CREATE INDEX ON lti_login_attempts (tenant_id, registration_id);

ALTER TABLE lti_subject_links ADD FOREIGN KEY (tenant_id, registration_id) REFERENCES lti_registrations (tenant_id, id);

CREATE INDEX ON lti_subject_links (tenant_id, registration_id);

ALTER TABLE lti_subject_links ADD FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id);

CREATE INDEX ON lti_subject_links (tenant_id, person_id);

ALTER TABLE lti_context_links ADD FOREIGN KEY (tenant_id, deployment_id) REFERENCES lti_deployments (tenant_id, id);

CREATE INDEX ON lti_context_links (tenant_id, deployment_id);

ALTER TABLE lti_context_links ADD FOREIGN KEY (tenant_id, local_section_id) REFERENCES sections (tenant_id, id);

CREATE INDEX ON lti_context_links (tenant_id, local_section_id);

ALTER TABLE lti_resource_links ADD FOREIGN KEY (tenant_id, deployment_id) REFERENCES lti_deployments (tenant_id, id);

CREATE INDEX ON lti_resource_links (tenant_id, deployment_id);

ALTER TABLE lti_resource_links ADD FOREIGN KEY (tenant_id, context_link_id) REFERENCES lti_context_links (tenant_id, id);

CREATE INDEX ON lti_resource_links (tenant_id, context_link_id);

ALTER TABLE lti_launch_receipts ADD FOREIGN KEY (tenant_id, deployment_id) REFERENCES lti_deployments (tenant_id, id);

CREATE INDEX ON lti_launch_receipts (tenant_id, deployment_id);

ALTER TABLE lti_launch_receipts ADD FOREIGN KEY (tenant_id, subject_token_id) REFERENCES subject_tokens (tenant_id, id);

CREATE INDEX ON lti_launch_receipts (tenant_id, subject_token_id);

ALTER TABLE lti_launch_receipts ADD FOREIGN KEY (tenant_id, context_link_id) REFERENCES lti_context_links (tenant_id, id);

CREATE INDEX ON lti_launch_receipts (tenant_id, context_link_id);

ALTER TABLE lti_launch_receipts ADD FOREIGN KEY (tenant_id, resource_link_id) REFERENCES lti_resource_links (tenant_id, id);

CREATE INDEX ON lti_launch_receipts (tenant_id, resource_link_id);

ALTER TABLE lti_launch_receipts ADD FOREIGN KEY (tenant_id, audit_event_id) REFERENCES audit_events (tenant_id, id);

CREATE INDEX ON lti_launch_receipts (tenant_id, audit_event_id);

ALTER TABLE lti_service_grants ADD FOREIGN KEY (tenant_id, deployment_id) REFERENCES lti_deployments (tenant_id, id);

CREATE INDEX ON lti_service_grants (tenant_id, deployment_id);

ALTER TABLE lti_custom_claim_policies ADD FOREIGN KEY (tenant_id, deployment_id) REFERENCES lti_deployments (tenant_id, id);

CREATE INDEX ON lti_custom_claim_policies (tenant_id, deployment_id);

ALTER TABLE lti_custom_claim_policies ADD FOREIGN KEY (tenant_id, policy_version_id) REFERENCES policy_versions (tenant_id, id);

CREATE INDEX ON lti_custom_claim_policies (tenant_id, policy_version_id);


ALTER TABLE housing_allocations ADD CONSTRAINT housing_bed_overlap
EXCLUDE USING gist (tenant_id WITH =, bed_id WITH =, occupancy_range WITH &&)
WHERE (state IN ('reserved','offered','contracted','occupied'));
ALTER TABLE housing_allocations ADD CONSTRAINT housing_person_overlap
EXCLUDE USING gist (tenant_id WITH =, person_id WITH =, occupancy_range WITH &&)
WHERE (state IN ('reserved','offered','contracted','occupied'));
CREATE INDEX ON housing_allocations (expires_at) WHERE state='reserved';
CREATE INDEX ON integration_jobs (next_attempt_at) WHERE state IN ('pending','retry');
CREATE INDEX ON outbox_events (created_at) WHERE published_at IS NULL;
CREATE INDEX ON audit_events (tenant_id, occurred_at DESC);
CREATE INDEX ON audit_events (tenant_id, request_id);
CREATE INDEX ON audit_events (tenant_id, resource_domain, resource_type, resource_id, occurred_at DESC);
CREATE INDEX ON ferpa_disclosure_records (tenant_id, subject_person_id, created_at DESC);

CREATE FUNCTION maintain_record_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$;
CREATE FUNCTION reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Append-only record: %; use an authorized correction record', TG_TABLE_NAME;
END;
$$;


CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campuses FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON academic_terms FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON identity_links FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_links FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON policy_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON external_record_links FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE external_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_record_links FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON integration_jobs FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON webhook_receipts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_receipts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON outbox_events FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON workflow_instances FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON workflow_tasks FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON task_dependencies FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON task_evidence FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE task_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidence FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON billing_accounts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_accounts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON billing_charges FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_order_allocations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_order_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_order_allocations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_refunds FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_reconciliations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON admission_cycles FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE admission_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_cycles FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON application_requirements FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE application_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_requirements FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON application_question_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE application_question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_question_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON application_answers FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_answers FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON application_submission_snapshots FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE application_submission_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_submission_snapshots FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON application_documents FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON recommendation_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE recommendation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON application_reviews FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE application_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_reviews FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON review_scores FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_scores FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON admission_decisions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE admission_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_decisions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON admission_offers FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE admission_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_offers FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON offer_conditions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE offer_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_conditions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON student_records FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE student_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_records FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON student_program_enrollments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE student_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_program_enrollments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON onboarding_instances FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE onboarding_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_instances FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON course_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE course_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON section_meetings FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE section_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_meetings FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON section_instructors FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE section_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_instructors FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON academic_rule_sets FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE academic_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_rule_sets FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON section_rule_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE section_rule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_rule_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON section_link_rules FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE section_link_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_link_rules FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON registration_appointments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE registration_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_appointments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON student_holds FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE student_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_holds FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON registration_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON registration_request_items FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE registration_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_request_items FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON enrollment_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE enrollment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON waitlist_entries FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON override_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE override_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON exam_events FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE exam_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON academic_document_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE academic_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_document_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_cycles FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_cycles FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_buildings FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_buildings FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_rooms FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_rooms FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_beds FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_beds FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_applications FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_applications FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_preferences FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_preferences FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_eligibility_results FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_eligibility_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_eligibility_results FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_placement_instructions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_placement_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_placement_instructions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON roommate_groups FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE roommate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_groups FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON roommate_group_members FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE roommate_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_group_members FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_selection_windows FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_selection_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_selection_windows FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_allocations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_allocations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_contracts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_contracts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspections FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspections FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspection_items FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspection_items FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspection_evidence FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspection_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspection_evidence FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_work_orders FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_work_orders FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_extension_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_extension_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON housing_deadline_evaluations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE housing_deadline_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_deadline_evaluations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_checkout_events FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_checkout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_checkout_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assessments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assessments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assessment_appeals FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assessment_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assessment_appeals FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_eligibility_rules FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_eligibility_rules FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_enrollments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_enrollments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_change_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_change_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_entitlement_types FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_entitlement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_types FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_benefits FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_benefits FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_entitlement_periods FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_entitlement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_periods FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campus_wallet_types FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campus_wallet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallet_types FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campus_wallets FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campus_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallets FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_locations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_locations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_location_acceptance FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_location_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_location_acceptance FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_hours FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_hours FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_item_attributes FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_attributes FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_entries FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_transactions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_transactions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_transaction_lines FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_transaction_lines FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_disputes FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_disputes FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_adjustment_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_adjustment_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON dining_entitlement_entries FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE dining_entitlement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON campus_wallet_entries FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE campus_wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallet_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_balance_snapshots FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_balance_snapshots FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON role_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON advisor_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE advisor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON case_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON consents FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON delegations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON pii_values FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE pii_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_values FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON subject_tokens FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE subject_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_tokens FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON privileged_access_grants FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE privileged_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE privileged_access_grants FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON ferpa_disclosure_records FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE ferpa_disclosure_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferpa_disclosure_records FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON export_jobs FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_registrations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_registrations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_deployments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_deployments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_login_attempts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_login_attempts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_subject_links FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_subject_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_subject_links FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_context_links FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_context_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_context_links FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_resource_links FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_resource_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_resource_links FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_launch_receipts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_launch_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_launch_receipts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_service_grants FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_service_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_service_grants FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON lti_custom_claim_policies FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE lti_custom_claim_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lti_custom_claim_policies FORCE ROW LEVEL SECURITY;

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA semester FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA semester FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA semester FROM PUBLIC;
COMMIT;