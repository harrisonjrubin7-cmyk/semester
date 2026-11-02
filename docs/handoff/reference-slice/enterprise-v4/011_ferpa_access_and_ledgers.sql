-- 011_ferpa_access_and_ledgers.sql: from "Higher-ed ERP database schema: relational ERD and RBAC matrices" (6 Oct). After 010. NOT executed or parsed.
-- 1. Housing: ONE allocation table for holds, offers and assignments, so a single constraint prevents every collision.
-- 2. Dining: quantity entitlements (swipes) and money wallets as separate append-only ledgers.
-- 3. FERPA-oriented authorization: role + scope + relationship + purpose + record classification + consent, default deny,
--    every sensitive decision logged, every disclosure recorded.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------ 1. housing allocations (replaces the assignment-only exclusion in 010)
ALTER TABLE sx.housing_assignments DROP CONSTRAINT IF EXISTS no_double_booked_bed;
CREATE TABLE sx.housing_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, bed_id uuid NOT NULL, student_record_id uuid NOT NULL, cycle_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('hold', 'offer', 'assignment')),
  status text NOT NULL CHECK (status IN ('active', 'released', 'expired', 'converted', 'closed')),
  period daterange NOT NULL, expires_at timestamptz, version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, bed_id) REFERENCES sx.housing_beds(tenant_id, id),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id),
  CHECK (kind = 'assignment' OR expires_at IS NOT NULL),
  CONSTRAINT one_active_allocation_per_bed EXCLUDE USING gist (bed_id WITH =, period WITH &&) WHERE (status = 'active'),
  CONSTRAINT one_active_allocation_per_student EXCLUDE USING gist (student_record_id WITH =, period WITH &&) WHERE (status = 'active')
);
ALTER TABLE sx.housing_assignments ADD COLUMN allocation_id uuid REFERENCES sx.housing_allocations(id);

-- ------------------------------------------------ 2. dining ledgers
CREATE TABLE sx.dining_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES sx.tenants(id), plan_code text NOT NULL, term_code text NOT NULL,
  published_at timestamptz, rules jsonb NOT NULL, UNIQUE (tenant_id, plan_code, term_code), UNIQUE (tenant_id, id)
);
CREATE FUNCTION sx_private.published_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Published versions are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER plan_versions_immutable BEFORE UPDATE OR DELETE ON sx.dining_plan_versions FOR EACH ROW EXECUTE FUNCTION sx_private.published_immutable();
CREATE TABLE sx.dining_entitlement_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, plan_version_id uuid NOT NULL,
  entitlement_type text NOT NULL CHECK (entitlement_type IN ('meal_swipe', 'guest_swipe')), period daterange NOT NULL, granted integer NOT NULL CHECK (granted >= 0),
  UNIQUE (tenant_id, id), FOREIGN KEY (tenant_id, plan_version_id) REFERENCES sx.dining_plan_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);
CREATE TABLE sx.dining_entitlement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, period_id uuid NOT NULL, delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('use', 'adjustment', 'reversal', 'expiry')), reverses uuid, external_id text, occurred_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, period_id) REFERENCES sx.dining_entitlement_periods(tenant_id, id), UNIQUE (tenant_id, external_id),
  CHECK ((reason = 'reversal') = (reverses IS NOT NULL))
);
-- Money: one wallet per currency-bearing type (Meal Money, Commodore Cash); balance is the sum of append-only entries.
CREATE TABLE sx.campus_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, wallet_code text NOT NULL, currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  UNIQUE (tenant_id, student_record_id, wallet_code), UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, student_record_id) REFERENCES sx.student_records(tenant_id, id)
);
CREATE TABLE sx.campus_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, wallet_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  reason text NOT NULL CHECK (reason IN ('deposit', 'purchase', 'refund', 'adjustment', 'reversal', 'expiry')), reverses uuid,
  requested_by uuid REFERENCES auth.users(id), approved_by uuid REFERENCES auth.users(id), external_id text, occurred_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id, wallet_id) REFERENCES sx.campus_wallets(tenant_id, id), UNIQUE (tenant_id, external_id),
  CHECK ((reason = 'reversal') = (reverses IS NOT NULL)),
  CHECK (reason <> 'adjustment' OR (approved_by IS NOT NULL AND approved_by <> requested_by))   -- separation of duties
);
CREATE TRIGGER entitlement_entries_append_only BEFORE UPDATE OR DELETE ON sx.dining_entitlement_entries FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();
CREATE TRIGGER wallet_entries_append_only BEFORE UPDATE OR DELETE ON sx.campus_wallet_entries FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();

-- ------------------------------------------------ 3. FERPA-oriented authorization
CREATE TABLE sx_private.record_classifications (
  code text PRIMARY KEY CHECK (code IN ('directory', 'education_record', 'financial', 'accommodation_evidence', 'counseling', 'conduct', 'admissions_review', 'personal')),
  description text NOT NULL, export_requires_separate_permission boolean NOT NULL DEFAULT true
);
INSERT INTO sx_private.record_classifications VALUES
 ('directory', 'Institution-designated directory information, subject to opt-out', false), ('education_record', 'Records directly related to a student, maintained by the institution', true),
 ('financial', 'Charges, aid, wallets', true), ('accommodation_evidence', 'Disability documentation; placement instructions only outside the office', true),
 ('counseling', 'Treatment records', true), ('conduct', 'Conduct cases', true), ('admissions_review', 'Reviewer notes and scores', true), ('personal', 'A person’s own notes and tasks; never visible through institutional licensing', true);
-- Purposes come from real workflows, never a typed justification.
CREATE TABLE sx_private.purpose_policies (
  code text PRIMARY KEY, description text NOT NULL, allowed_classifications text[] NOT NULL, workflow_source text NOT NULL
);
INSERT INTO sx_private.purpose_policies VALUES
 ('teach_assigned_course', 'Teach a course you are assigned to', ARRAY['directory', 'education_record'], 'course_staff_relationships'),
 ('advise_assigned_student', 'Advise an assigned advisee', ARRAY['directory', 'education_record'], 'advisor_assignments'),
 ('work_assigned_case', 'Resolve an assigned case', ARRAY['directory', 'education_record', 'financial', 'accommodation_evidence', 'conduct', 'counseling'], 'case_assignments'),
 ('allocate_housing', 'Run a housing cycle in scope', ARRAY['directory', 'education_record'], 'team_memberships'),
 ('support_session', 'Time-limited support the student approved', ARRAY['directory', 'education_record'], 'privileged_access_grants');
CREATE TABLE sx_private.course_staff_relationships (tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id), section_id uuid NOT NULL, role text NOT NULL CHECK (role IN ('instructor', 'co_instructor', 'ta', 'grader', 'designer')), starts_at timestamptz NOT NULL, ends_at timestamptz, PRIMARY KEY (tenant_id, user_id, section_id, role));
CREATE TABLE sx_private.advisor_assignments (tenant_id uuid NOT NULL, advisor_id uuid NOT NULL REFERENCES auth.users(id), student_record_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz, PRIMARY KEY (tenant_id, advisor_id, student_record_id));
CREATE TABLE sx_private.case_assignments (tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id), case_type text NOT NULL, case_id uuid NOT NULL, subject_student_record_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz, PRIMARY KEY (tenant_id, user_id, case_type, case_id));
CREATE TABLE sx_private.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, delegate_user_id uuid NOT NULL REFERENCES auth.users(id),
  items text[] NOT NULL CHECK (cardinality(items) > 0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, revoked_at timestamptz, CHECK (ends_at > starts_at)
);
-- FERPA consent: which records, for what purpose, to whom; signed, dated, authenticated.
CREATE TABLE sx_private.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, records_described text NOT NULL, purpose text NOT NULL,
  recipients text NOT NULL, signed_at timestamptz NOT NULL, signature_method text NOT NULL CHECK (signature_method IN ('authenticated_esign', 'wet_signature_scan')),
  authenticated_user_id uuid REFERENCES auth.users(id), revoked_at timestamptz,
  CHECK (signature_method <> 'authenticated_esign' OR authenticated_user_id IS NOT NULL)
);
CREATE TABLE sx_private.privileged_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, grantee_id uuid NOT NULL REFERENCES auth.users(id), student_record_id uuid, purpose_code text NOT NULL REFERENCES sx_private.purpose_policies(code),
  approved_by uuid NOT NULL REFERENCES auth.users(id), starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL, revoked_at timestamptz, emergency boolean NOT NULL DEFAULT false, legal_basis text,
  CHECK (approved_by <> grantee_id), CHECK (ends_at <= starts_at + interval '4 hours'), CHECK (NOT emergency OR legal_basis IS NOT NULL)
);
CREATE TABLE sx_private.authorization_decisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL, resource text NOT NULL,
  classification text NOT NULL, purpose_code text, outcome text NOT NULL CHECK (outcome IN ('allow', 'deny')), failed_condition text, policy_version text NOT NULL, request_id uuid, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sx_private.disclosure_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_record_id uuid NOT NULL, recipient text NOT NULL,
  legal_basis text NOT NULL CHECK (legal_basis IN ('consent', 'school_official', 'health_safety_emergency', 'subpoena', 'directory', 'other_exception')),
  legitimate_interest text, records_disclosed text NOT NULL, consent_id uuid REFERENCES sx_private.consents(id), disclosed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (legal_basis <> 'consent' OR consent_id IS NOT NULL)
);

-- The single decision function. Default deny; logs every evaluation; reads CURRENT grants (never stale JWT role claims).
CREATE FUNCTION sx_private.authorize(p_tenant uuid, p_action text, p_classification text, p_purpose text, p_student uuid, p_section uuid DEFAULT NULL, p_case uuid DEFAULT NULL, p_export boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); failed text; pp record; ok boolean := false;
BEGIN
  IF u IS NULL THEN failed := 'unauthenticated';
  ELSIF NOT sx_private.member(p_tenant) THEN failed := 'tenant';
  ELSE
    SELECT * INTO pp FROM sx_private.purpose_policies WHERE code = p_purpose;
    IF NOT FOUND THEN failed := 'purpose_unknown';
    ELSIF NOT p_classification = ANY (pp.allowed_classifications) THEN failed := 'classification';
    ELSIF p_export AND (SELECT export_requires_separate_permission FROM sx_private.record_classifications WHERE code = p_classification) THEN failed := 'export_needs_separate_permission';
    ELSE
      ok := CASE p_purpose
        WHEN 'teach_assigned_course' THEN EXISTS (SELECT 1 FROM sx_private.course_staff_relationships c WHERE c.tenant_id = p_tenant AND c.user_id = u AND c.section_id = p_section AND now() >= c.starts_at AND (c.ends_at IS NULL OR c.ends_at > now()))
        WHEN 'advise_assigned_student' THEN EXISTS (SELECT 1 FROM sx_private.advisor_assignments a WHERE a.tenant_id = p_tenant AND a.advisor_id = u AND a.student_record_id = p_student AND now() >= a.starts_at AND (a.ends_at IS NULL OR a.ends_at > now()))
        WHEN 'work_assigned_case' THEN EXISTS (SELECT 1 FROM sx_private.case_assignments k WHERE k.tenant_id = p_tenant AND k.user_id = u AND k.case_id = p_case AND k.subject_student_record_id = p_student AND (k.ends_at IS NULL OR k.ends_at > now()))
        WHEN 'support_session' THEN EXISTS (SELECT 1 FROM sx_private.privileged_access_grants g WHERE g.tenant_id = p_tenant AND g.grantee_id = u AND g.student_record_id = p_student AND g.purpose_code = p_purpose AND now() BETWEEN g.starts_at AND g.ends_at AND g.revoked_at IS NULL)
        ELSE false END;
      IF NOT ok THEN failed := 'relationship'; END IF;
    END IF;
  END IF;
  INSERT INTO sx_private.authorization_decisions(tenant_id, actor_id, action, resource, classification, purpose_code, outcome, failed_condition, policy_version)
  VALUES (p_tenant, coalesce(u, '00000000-0000-0000-0000-000000000000'), p_action, coalesce(p_student::text, '') || coalesce(':' || p_section, '') || coalesce(':' || p_case, ''), p_classification, p_purpose, CASE WHEN failed IS NULL THEN 'allow' ELSE 'deny' END, failed, 'ferpa-policy-1');
  RETURN failed IS NULL;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['housing_allocations', 'dining_plan_versions', 'dining_entitlement_periods', 'dining_entitlement_entries', 'campus_wallets', 'campus_wallet_entries'] LOOP
    EXECUTE format('ALTER TABLE sx.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON sx.%I FROM PUBLIC, anon', t); EXECUTE format('GRANT SELECT ON sx.%I TO authenticated', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['record_classifications', 'purpose_policies', 'course_staff_relationships', 'advisor_assignments', 'case_assignments', 'delegations', 'consents', 'privileged_access_grants', 'authorization_decisions', 'disclosure_records'] LOOP
    EXECUTE format('ALTER TABLE sx_private.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON sx_private.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
CREATE POLICY own_wallet ON sx.campus_wallets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = campus_wallets.tenant_id AND s.id = campus_wallets.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY own_wallet_entries ON sx.campus_wallet_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.campus_wallets w JOIN sx.student_records s ON s.tenant_id = w.tenant_id AND s.id = w.student_record_id WHERE w.tenant_id = campus_wallet_entries.tenant_id AND w.id = campus_wallet_entries.wallet_id AND s.user_id = auth.uid()));
CREATE POLICY own_entitlements ON sx.dining_entitlement_periods FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = dining_entitlement_periods.tenant_id AND s.id = dining_entitlement_periods.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY own_allocations ON sx.housing_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sx.student_records s WHERE s.tenant_id = housing_allocations.tenant_id AND s.id = housing_allocations.student_record_id AND s.user_id = auth.uid()));
CREATE POLICY published_plans ON sx.dining_plan_versions FOR SELECT TO authenticated USING (published_at IS NOT NULL AND sx_private.member(tenant_id));
GRANT EXECUTE ON FUNCTION sx_private.authorize(uuid, text, text, text, uuid, uuid, uuid, boolean) TO authenticated;
COMMIT;
