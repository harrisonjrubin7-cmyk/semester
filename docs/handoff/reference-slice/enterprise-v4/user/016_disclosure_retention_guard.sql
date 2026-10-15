-- 016_disclosure_retention_guard.sql: from the "Interactive higher-ed ERD schema" PDF (6 Oct). After 015. NOT executed or parsed.
-- Blocks deleting a FERPA disclosure record unless an authorized records officer has a current review saying the student's
-- education records are no longer retained and no hold applies, and no inspection request is open. Fails closed.
-- §99.32: the disclosure record is kept as long as the education records are. No assumed "delete after N years" rule.
BEGIN;
SET LOCAL search_path = semester, public;
CREATE TABLE semester.disclosure_retention_reviews (
  tenant_id uuid NOT NULL,
  subject_person_id uuid NOT NULL,
  education_records_retained boolean NOT NULL DEFAULT true,
  institutional_hold boolean NOT NULL DEFAULT true,          -- conservative default: held until a records officer says otherwise
  policy_version_id uuid NOT NULL,
  retirement_evidence_reference text,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL,
  review_valid_until timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, subject_person_id),
  FOREIGN KEY (tenant_id, subject_person_id) REFERENCES semester.people (tenant_id, id),
  FOREIGN KEY (tenant_id, policy_version_id) REFERENCES semester.policy_versions (tenant_id, id),
  FOREIGN KEY (tenant_id, reviewed_by) REFERENCES semester.people (tenant_id, id),
  CHECK (review_valid_until > reviewed_at),
  CHECK (education_records_retained OR retirement_evidence_reference IS NOT NULL)
);
ALTER TABLE semester.disclosure_retention_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester.disclosure_retention_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON semester.disclosure_retention_reviews FROM PUBLIC;

-- Requires semester.student_data_requests(tenant_id, subject_person_id, request_type, status) from the earlier reference DDL.
CREATE FUNCTION semester.guard_disclosure_retention() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE rv semester.disclosure_retention_reviews%ROWTYPE;
BEGIN
  SELECT * INTO rv FROM semester.disclosure_retention_reviews WHERE tenant_id = OLD.tenant_id AND subject_person_id = OLD.subject_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Disclosure deletion blocked: no retention review' USING ERRCODE = '55000'; END IF;
  IF rv.review_valid_until <= statement_timestamp() THEN RAISE EXCEPTION 'Disclosure deletion blocked: retention review expired' USING ERRCODE = '55000'; END IF;
  IF rv.education_records_retained OR rv.institutional_hold THEN RAISE EXCEPTION 'Disclosure deletion blocked: records retained or hold active' USING ERRCODE = '55000'; END IF;
  IF EXISTS (SELECT 1 FROM semester.student_data_requests r WHERE r.tenant_id = OLD.tenant_id AND r.subject_person_id = OLD.subject_person_id AND r.request_type = 'inspect' AND r.status NOT IN ('fulfilled', 'closed')) THEN
    RAISE EXCEPTION 'Disclosure deletion blocked: inspection request outstanding' USING ERRCODE = '55000'; END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION semester.guard_disclosure_retention() FROM PUBLIC;
CREATE TRIGGER guard_disclosure_retention BEFORE DELETE ON semester.ferpa_disclosure_records FOR EACH ROW EXECUTE FUNCTION semester.guard_disclosure_retention();
-- TRUNCATE bypasses row triggers and RLS: revoke it from everyone but the migration owner.
REVOKE TRUNCATE ON semester.ferpa_disclosure_records, semester.audit_events FROM PUBLIC, authenticated, anon;
COMMIT;
-- Operating boundaries (not enforced here):
--   * The disposition workflow runs as a dedicated role that sees ALL requests and holds; RLS-filtered visibility could hide one.
--   * Disposition is audited before deletion. A new inspection request is a preservation event immediately.
--   * Hold placement and disposition share locks. Documents, exports, backups and external systems are tested separately.
--   * Superusers and BYPASSRLS roles bypass row security: test with the real runtime roles.
