-- 010_campus_portals.sql: admissions → student, registration requests, housing, dining (from the campus portal architecture spec, 6 Oct).
-- After 009. Trusted owner, staging first. NOT executed or parsed.
-- Conventions: tenant_id on every row; (tenant_id, id) unique; cross-table FKs include tenant_id; money in integer minor units + currency;
-- official dates as date with the campus time zone; external records carry source, external_id and last sync. Institutional systems stay
-- authoritative unless the university delegates the domain (sx.domain_authority).
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;   -- needed for the bed double-booking exclusion (uuid with =)

-- ------------------------------------------------ authority per institution and domain
CREATE TABLE sx.domain_authority (
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  domain text NOT NULL CHECK (domain IN ('admissions', 'registration', 'student_accounts', 'housing', 'dining', 'learning', 'onboarding')),
  mode text NOT NULL CHECK (mode IN ('native', 'connected_read', 'connected_transaction', 'import', 'handoff')),
  authoritative_system text NOT NULL,             -- e.g. 'Slate', 'Banner', 'StarRez', 'CBORD', 'Semester'
  business_owner text NOT NULL,                   -- the institutional office accountable for the domain
  freshness_target interval,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  PRIMARY KEY (tenant_id, domain),
  CHECK (mode <> 'native' OR approved_at IS NOT NULL)        -- Semester owns a domain only with written delegation
);
CREATE FUNCTION sx_private.require_mode(p_tenant uuid, p_domain text, p_modes text[]) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sx.domain_authority WHERE tenant_id = p_tenant AND domain = p_domain AND mode = ANY (p_modes)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DOMAIN_MODE_NOT_ALLOWED'; END IF;
END $$;

-- ------------------------------------------------ admissions
CREATE TABLE sx.admission_cycles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES sx.tenants(id), code text NOT NULL, entry_term_id uuid, opens_at timestamptz NOT NULL, deadline_at timestamptz NOT NULL, policy_version text NOT NULL, UNIQUE (tenant_id, code), UNIQUE (tenant_id, id), CHECK (deadline_at > opens_at));
CREATE TABLE sx.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES sx.tenants(id), cycle_id uuid NOT NULL,
  applicant_id uuid NOT NULL REFERENCES auth.users(id),     -- an applicant is not yet a member; access is by applicant_id only
  program_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'incomplete', 'under_review', 'reviewed', 'withdrawn')),
  submitted_at timestamptz, withdrawn_at timestamptz, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, cycle_id, applicant_id, program_code),
  FOREIGN KEY (tenant_id, cycle_id) REFERENCES sx.admission_cycles(tenant_id, id)
);
CREATE TABLE sx.application_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, application_id uuid NOT NULL, requirement_code text NOT NULL,
  applicant_state text NOT NULL DEFAULT 'not_started' CHECK (applicant_state IN ('not_started', 'in_progress', 'submitted')),
  institution_state text NOT NULL DEFAULT 'pending' CHECK (institution_state IN ('pending', 'received', 'verified', 'rejected', 'waived')),
  waiver_reason text, verified_by uuid REFERENCES auth.users(id), verified_at timestamptz,
  UNIQUE (tenant_id, application_id, requirement_code), FOREIGN KEY (tenant_id, application_id) REFERENCES sx.applications(tenant_id, id),
  CHECK (institution_state <> 'waived' OR waiver_reason IS NOT NULL)
);
-- Recommender links: scoped, expiring, single-purpose. Only a hash is stored. The applicant never sees the letter.
CREATE TABLE sx_private.recommendation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, application_id uuid NOT NULL, recommender_email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE, expires_at timestamptz NOT NULL, applicant_waived_access boolean NOT NULL, received_at timestamptz,
  document_id uuid,
  FOREIGN KEY (tenant_id, application_id) REFERENCES sx.applications(tenant_id, id)
);
CREATE TABLE sx_private.application_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, application_id uuid NOT NULL, reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  rubric_version text NOT NULL, conflict_declared boolean NOT NULL DEFAULT false, notes text, submitted_at timestamptz,
  FOREIGN KEY (tenant_id, application_id) REFERENCES sx.applications(tenant_id, id), UNIQUE (application_id, reviewer_id)
);
-- Decisions are never edited after release; a correction supersedes with a new row.
CREATE TABLE sx.admission_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, application_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('admit', 'deny', 'waitlist', 'defer')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'released', 'superseded')),
  approved_by uuid REFERENCES auth.users(id), approved_at timestamptz, release_at timestamptz, released_at timestamptz,
  supersedes uuid REFERENCES sx.admission_decisions(id), correction_reason text,
  UNIQUE (tenant_id, id), FOREIGN KEY (tenant_id, application_id) REFERENCES sx.applications(tenant_id, id),
  CHECK (status NOT IN ('approved', 'released') OR approved_by IS NOT NULL),
  CHECK (supersedes IS NULL OR correction_reason IS NOT NULL)
);
CREATE UNIQUE INDEX one_live_decision ON sx.admission_decisions(application_id) WHERE status IN ('proposed', 'approved', 'released');
CREATE FUNCTION sx_private.decisions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'released' AND (NEW.decision_type <> OLD.decision_type OR NEW.status NOT IN ('released', 'superseded')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Released decisions are corrected by superseding, not editing'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER decisions_immutable BEFORE UPDATE ON sx.admission_decisions FOR EACH ROW EXECUTE FUNCTION sx_private.decisions_immutable();
CREATE TABLE sx.admission_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, decision_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'expired', 'deferral_requested', 'deferral_approved', 'deferral_denied')),
  response_deadline timestamptz NOT NULL, responded_at timestamptz, version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, id), FOREIGN KEY (tenant_id, decision_id) REFERENCES sx.admission_decisions(tenant_id, id)
);

-- ------------------------------------------------ applicant → student
CREATE TABLE sx.student_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES sx.tenants(id), user_id uuid NOT NULL REFERENCES auth.users(id),
  offer_id uuid, sis_student_id text,
  activation text NOT NULL DEFAULT 'not_requested' CHECK (activation IN ('not_requested', 'requested', 'provisioned', 'active', 'failed', 'awaiting_resolution')),
  correlation_key uuid NOT NULL DEFAULT gen_random_uuid(),   -- stable across provisioning retries
  activated_at timestamptz, version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, user_id), UNIQUE (tenant_id, sis_student_id), UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, offer_id) REFERENCES sx.admission_offers(tenant_id, id)
);
-- Request activation: offer accepted + required onboarding verified/waived. Idempotent; finds the existing record first; emits outbox.
CREATE FUNCTION sx_private.request_student_activation(p_tenant uuid, p_offer uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o record; app record; sr uuid;
BEGIN
  SELECT ao.*, ad.application_id INTO o FROM sx.admission_offers ao JOIN sx.admission_decisions ad ON ad.tenant_id = ao.tenant_id AND ad.id = ao.decision_id
   WHERE ao.tenant_id = p_tenant AND ao.id = p_offer FOR UPDATE OF ao;
  IF NOT FOUND OR o.status <> 'accepted' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFER_NOT_ACCEPTED'; END IF;
  SELECT * INTO app FROM sx.applications WHERE tenant_id = p_tenant AND id = o.application_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('activate:' || p_tenant || ':' || app.applicant_id, 0));
  SELECT id INTO sr FROM sx.student_records WHERE tenant_id = p_tenant AND user_id = app.applicant_id;
  IF sr IS NULL THEN
    INSERT INTO sx.student_records(tenant_id, user_id, offer_id, activation) VALUES (p_tenant, app.applicant_id, p_offer, 'requested') RETURNING id INTO sr;
  ELSE UPDATE sx.student_records SET activation = 'requested', version = version + 1 WHERE id = sr AND activation IN ('not_requested', 'failed'); END IF;
  INSERT INTO sx_private.outbox(tenant_id, event_type, payload) VALUES (p_tenant, 'student.provisioning_requested', jsonb_build_object('student_record', sr));
  RETURN sr;   -- the worker calls the SIS with correlation_key, records sis_student_id, then grants ONLY the approved roles
END $$;

-- ------------------------------------------------ registration requests (seats belong to the SIS)
CREATE TABLE sx.registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, term_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'submitted', 'confirmed', 'partially_confirmed', 'rejected', 'unknown')),
  idempotency_key uuid NOT NULL, external_transaction_id text, submitted_at timestamptz, resolved_at timestamptz,
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, student_record_id, idempotency_key),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);
CREATE TABLE sx.registration_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, request_id uuid NOT NULL, section_ref text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('add', 'drop', 'swap', 'waitlist', 'withdraw')), swap_from_ref text,
  outcome text CHECK (outcome IN ('confirmed', 'waitlisted', 'rejected', 'unknown')), sis_message_code text, waitlist_position integer,
  FOREIGN KEY (tenant_id, request_id) REFERENCES sx.registration_requests(tenant_id, id),
  CHECK ((operation = 'swap') = (swap_from_ref IS NOT NULL))
);
-- An 'unknown' request blocks a new submission for the same student and term until it is reconciled.
CREATE UNIQUE INDEX no_retry_while_unknown ON sx.registration_requests(tenant_id, student_record_id, term_code) WHERE status IN ('submitted', 'unknown');
CREATE TABLE sx.override_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, section_ref text NOT NULL,
  rule_code text NOT NULL CHECK (rule_code IN ('prerequisite', 'capacity', 'time_conflict', 'credit_load', 'restriction')),
  reason text NOT NULL, status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'denied', 'withdrawn')),
  decided_by uuid REFERENCES auth.users(id), decided_at timestamptz,
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);

-- ------------------------------------------------ housing
CREATE TABLE sx.housing_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES sx.tenants(id), building text NOT NULL, room text NOT NULL, bed text NOT NULL,
  features text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'held', 'assigned', 'offline')),
  UNIQUE (tenant_id, building, room, bed), UNIQUE (tenant_id, id)
);
CREATE TABLE sx.housing_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, cycle_code text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}',
  approved_features text[] NOT NULL DEFAULT '{}',   -- from Disability Services: features only, never the reason or diagnosis
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'eligible', 'ineligible', 'offered', 'waitlisted')),
  UNIQUE (tenant_id, id), UNIQUE (tenant_id, student_record_id, cycle_code),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);
CREATE TABLE sx.housing_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, application_id uuid NOT NULL, bed_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'contracted', 'occupied', 'checkout', 'closed', 'declined', 'expired')),
  starts_on date NOT NULL, ends_on date NOT NULL, move_out_rule text NOT NULL, move_out_deadline timestamptz,
  contract_reference text,   -- handoff to the housing system's signing; Semester records only the reference and status
  FOREIGN KEY (tenant_id, application_id) REFERENCES sx.housing_applications(tenant_id, id),
  FOREIGN KEY (tenant_id, bed_id) REFERENCES sx.housing_beds(tenant_id, id),
  CHECK (ends_on > starts_on)
);
-- One live assignment per bed per period: the database, not the browser, prevents double-booking.
ALTER TABLE sx.housing_assignments ADD CONSTRAINT no_double_booked_bed EXCLUDE USING gist (bed_id WITH =, daterange(starts_on, ends_on) WITH &&) WHERE (status IN ('offered', 'accepted', 'contracted', 'occupied'));
CREATE TABLE sx.housing_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, bed_id uuid NOT NULL, reported_by uuid NOT NULL REFERENCES auth.users(id),
  description text NOT NULL, urgency text NOT NULL CHECK (urgency IN ('normal', 'urgent', 'emergency')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'scheduled', 'resolved', 'cancelled')), respond_by timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, bed_id) REFERENCES sx.housing_beds(tenant_id, id)
);

-- ------------------------------------------------ dining: separate wallets with their own rules
CREATE TABLE sx.dining_wallet_types (
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id), code text NOT NULL, label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('swipe', 'minor_currency')), currency text CHECK (currency ~ '^[A-Z]{3}$'),
  rollover text NOT NULL, expires text NOT NULL, refundable boolean NOT NULL, effective_from date NOT NULL,
  PRIMARY KEY (tenant_id, code, effective_from), CHECK ((unit = 'minor_currency') = (currency IS NOT NULL))
);
CREATE TABLE sx.dining_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, wallet_code text NOT NULL,
  balance bigint NOT NULL, source_system text NOT NULL, external_id text, synced_at timestamptz NOT NULL,
  UNIQUE (tenant_id, student_record_id, wallet_code), UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);
CREATE TABLE sx.dining_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, wallet_id uuid NOT NULL, amount bigint NOT NULL,   -- negative = spend
  location text, occurred_at timestamptz NOT NULL, external_id text NOT NULL,
  UNIQUE (tenant_id, external_id), FOREIGN KEY (tenant_id, wallet_id) REFERENCES sx.dining_wallets(tenant_id, id)
);

-- ------------------------------------------------ RLS: applicants and students see their own; staff via commands and reviewed views
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['domain_authority', 'admission_cycles', 'applications', 'application_requirements', 'admission_decisions', 'admission_offers', 'student_records', 'registration_requests', 'registration_request_items', 'override_requests', 'housing_beds', 'housing_applications', 'housing_assignments', 'housing_work_orders', 'dining_wallet_types', 'dining_wallets', 'dining_transactions'] LOOP
    EXECUTE format('ALTER TABLE sx.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON sx.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT ON sx.%I TO authenticated', t);
  END LOOP;
END $$;
ALTER TABLE sx_private.recommendation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.application_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.recommendation_requests, sx_private.application_reviews FROM PUBLIC, anon, authenticated;
CREATE POLICY own_application ON sx.applications FOR SELECT TO authenticated USING (applicant_id = auth.uid());
CREATE POLICY own_requirements ON sx.application_requirements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.applications a WHERE a.tenant_id = application_requirements.tenant_id AND a.id = application_requirements.application_id AND a.applicant_id = auth.uid()));
CREATE POLICY own_released_decision ON sx.admission_decisions FOR SELECT TO authenticated USING (status = 'released' AND EXISTS (SELECT 1 FROM sx.applications a WHERE a.tenant_id = admission_decisions.tenant_id AND a.id = admission_decisions.application_id AND a.applicant_id = auth.uid()));
CREATE POLICY own_student_record ON sx.student_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY own_registration ON sx.registration_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = registration_requests.tenant_id AND s.id = registration_requests.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY own_housing ON sx.housing_applications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = housing_applications.tenant_id AND s.id = housing_applications.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY own_wallets ON sx.dining_wallets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = dining_wallets.tenant_id AND s.id = dining_wallets.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY members_read ON sx.domain_authority FOR SELECT TO authenticated USING (sx_private.member(tenant_id));
CREATE POLICY members_read ON sx.dining_wallet_types FOR SELECT TO authenticated USING (sx_private.member(tenant_id));
-- Tables without a policy above (items, overrides, beds, assignments, work orders, transactions, cycles, offers) are default-deny
-- for clients until their reviewed policies are added; staff reach them through commands.
REVOKE ALL ON FUNCTION sx_private.require_mode(uuid, text, text[]), sx_private.request_student_activation(uuid, uuid) FROM PUBLIC, anon, authenticated;
COMMIT;
