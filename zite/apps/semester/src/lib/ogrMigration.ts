// Course grade → certified official grade (replacement spec §3.7, §4.4, §7 Workflow C, §16 first executable increment).
// Three records stay distinct: the working course gradebook (submissions), the course grade proposal (ogr_proposals,
// released to the student as "course grade, not yet official"), and the official academic grade (ogr_entries, append-only
// revisions). Capability flags (p_is_instructor, p_is_registrar, p_is_admin) are computed by the server from course roles
// and authz, never taken from the client.
//
// Authority (spec §2 operating modes): each tenant's records domain has a mode, default 'design'. In design/shadow the
// entries are kept as non-official ('design'/'shadow') and nothing is projected into the institution's records, except
// for sample institutions. Turning on 'pilot'/'authoritative' needs two different administrators and an evidence reference;
// it is never done by code.
export const OGR_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP', 'W', 'I'];
const G = OGR_GRADES.map((g) => `'${g}'`).join(',');

export const OGR_MIGRATION: string[] = [
  // ---- authority mode per tenant and domain, append-only history ----
  `CREATE TABLE IF NOT EXISTS aum_modes (id bigserial PRIMARY KEY, tenant_id text NOT NULL, domain text NOT NULL CHECK (domain IN ('records','registration','learning','finance')),
     mode text NOT NULL CHECK (mode IN ('design','staging','shadow','pilot','authoritative','retired')), requested_by text NOT NULL, approved_by text,
     evidence_ref text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now(),
     CHECK (mode IN ('design','staging','shadow') OR (approved_by IS NOT NULL AND approved_by <> requested_by AND length(evidence_ref) >= 5)))`,
  `CREATE INDEX IF NOT EXISTS aum_modes_tenant ON aum_modes (tenant_id, domain, at DESC, id DESC)`,
  `CREATE OR REPLACE FUNCTION aum_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Authority history is kept as recorded.'; END $$`,
  `DROP TRIGGER IF EXISTS aum_modes_append_only ON aum_modes`,
  `CREATE TRIGGER aum_modes_append_only BEFORE UPDATE OR DELETE ON aum_modes FOR EACH ROW EXECUTE FUNCTION aum_refuse_change()`,
  `CREATE OR REPLACE FUNCTION aum_mode(p_tenant text, p_domain text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT mode FROM aum_modes WHERE tenant_id = p_tenant AND domain = p_domain ORDER BY at DESC, id DESC LIMIT 1), 'design') $$`,
  `CREATE OR REPLACE FUNCTION aum_set(p_actor text, p_tenant text, p_domain text, p_mode text, p_is_admin boolean, p_approver text, p_approver_is_admin boolean, p_evidence text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT coalesce(p_is_admin, false) THEN RETURN 'Only an institution administrator can change authority.'; END IF;
     IF p_mode NOT IN ('design','staging','shadow','pilot','authoritative','retired') THEN RETURN 'Unknown mode.'; END IF;
     IF p_mode IN ('pilot','authoritative','retired') THEN
       IF p_approver IS NULL OR p_approver = p_actor OR NOT coalesce(p_approver_is_admin, false) THEN RETURN 'A second administrator must approve this change.'; END IF;
       IF length(coalesce(p_evidence,'')) < 5 THEN RETURN 'Link the activation evidence (test run, sign-off) for this change.'; END IF;
     END IF;
     INSERT INTO aum_modes (tenant_id, domain, mode, requested_by, approved_by, evidence_ref, reason)
       VALUES (p_tenant, p_domain, p_mode, p_actor, CASE WHEN p_mode IN ('pilot','authoritative','retired') THEN p_approver END, coalesce(p_evidence,''), coalesce(p_reason,''));
     RETURN NULL;
   END $$`,

  // ---- course grade proposals (one per enrollment) ----
  `CREATE TABLE IF NOT EXISTS ogr_proposals (id bigserial PRIMARY KEY, tenant_id text NOT NULL, enrollment_id text NOT NULL, section_id text NOT NULL, student_id text NOT NULL,
     grade text NOT NULL CHECK (grade IN (${G})), basis jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(basis::text) <= 20000),
     version int NOT NULL DEFAULT 1, state text NOT NULL DEFAULT 'Draft' CHECK (state IN ('Draft','Certified','Posted')),
     released boolean NOT NULL DEFAULT false, released_at timestamptz, proposed_by text NOT NULL,
     certified_by text, certified_version int, certified_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, enrollment_id),
     CHECK (state = 'Draft' OR (certified_by IS NOT NULL AND certified_version = version)))`,
  `CREATE TABLE IF NOT EXISTS ogr_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, enrollment_id text NOT NULL, actor text NOT NULL, what text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS ogr_events_enr ON ogr_events (tenant_id, enrollment_id, at)`,
  `DROP TRIGGER IF EXISTS ogr_events_append_only ON ogr_events`,
  `CREATE TRIGGER ogr_events_append_only BEFORE UPDATE OR DELETE ON ogr_events FOR EACH ROW EXECUTE FUNCTION aum_refuse_change()`,

  `CREATE OR REPLACE FUNCTION ogr_propose(p_actor text, p_tenant text, p_enrollment text, p_section text, p_student text, p_is_instructor boolean, p_grade text, p_basis jsonb, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d ogr_proposals%ROWTYPE;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only an instructor of this section proposes the course grade.'; END IF;
     IF p_grade NOT IN (${G}) THEN RETURN 'Unknown grade.'; END IF;
     SELECT * INTO d FROM ogr_proposals WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment FOR UPDATE;
     IF NOT FOUND THEN
       INSERT INTO ogr_proposals (tenant_id, enrollment_id, section_id, student_id, grade, basis, proposed_by) VALUES (p_tenant, p_enrollment, p_section, p_student, p_grade, coalesce(p_basis,'{}'::jsonb), p_actor);
       INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'proposed ' || p_grade);
       RETURN 'ok:1';
     END IF;
     IF d.section_id <> p_section OR d.student_id <> p_student THEN RETURN 'This enrollment belongs to a different section or student.'; END IF;
     IF d.state = 'Posted' THEN RETURN 'The official grade is already posted. Changes now go through a registrar correction.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This grade changed in another window. Reload and try again.'; END IF;
     UPDATE ogr_proposals SET grade = p_grade, basis = coalesce(p_basis,'{}'::jsonb), version = version + 1, state = 'Draft', certified_by = NULL, certified_version = NULL, certified_at = NULL, proposed_by = p_actor, updated_at = now() WHERE id = d.id;
     INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'changed ' || d.grade || ' → ' || p_grade || CASE WHEN d.state = 'Certified' THEN ' (certification withdrawn)' ELSE '' END);
     RETURN 'ok:' || (d.version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION ogr_release(p_actor text, p_tenant text, p_enrollment text, p_is_instructor boolean, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d ogr_proposals%ROWTYPE;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only an instructor of this section releases the course grade.'; END IF;
     SELECT * INTO d FROM ogr_proposals WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Propose a course grade first.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This grade changed in another window. Reload and try again.'; END IF;
     IF d.released THEN RETURN NULL; END IF;
     UPDATE ogr_proposals SET released = true, released_at = now(), updated_at = now() WHERE id = d.id;
     INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'released course grade ' || d.grade || ' to the student');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ogr_certify(p_actor text, p_tenant text, p_enrollment text, p_is_instructor_of_record boolean, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d ogr_proposals%ROWTYPE;
   BEGIN
     IF NOT coalesce(p_is_instructor_of_record, false) THEN RETURN 'Only the instructor of record certifies a final grade.'; END IF;
     SELECT * INTO d FROM ogr_proposals WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Propose a course grade first.'; END IF;
     IF d.state = 'Posted' THEN RETURN 'Already posted.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This grade changed since you looked at it. Review it again before certifying.'; END IF;
     UPDATE ogr_proposals SET state = 'Certified', certified_by = p_actor, certified_version = d.version, certified_at = now(), updated_at = now() WHERE id = d.id;
     INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'certified ' || d.grade || ' (version ' || d.version || ')');
     RETURN NULL;
   END $$`,

  // ---- official academic grade: append-only revisions ----
  `CREATE TABLE IF NOT EXISTS ogr_entries (id bigserial PRIMARY KEY, tenant_id text NOT NULL, enrollment_id text NOT NULL, section_id text NOT NULL, student_id text NOT NULL,
     revision int NOT NULL CHECK (revision >= 1), grade text NOT NULL CHECK (grade IN (${G})), previous_grade text, kind text NOT NULL CHECK (kind IN ('Original','Correction')),
     reason text NOT NULL DEFAULT '', proposal_version int, certified_by text, posted_by text NOT NULL, authority text NOT NULL CHECK (authority IN ('design','staging','shadow','pilot','authoritative')),
     idem_key text NOT NULL, payload_hash text NOT NULL, at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, enrollment_id, revision), UNIQUE (tenant_id, idem_key),
     CHECK (kind = 'Original' OR length(reason) >= 10), CHECK (certified_by IS NULL OR certified_by <> posted_by))`,
  `DROP TRIGGER IF EXISTS ogr_entries_append_only ON ogr_entries`,
  `CREATE TRIGGER ogr_entries_append_only BEFORE UPDATE OR DELETE ON ogr_entries FOR EACH ROW EXECUTE FUNCTION aum_refuse_change()`,
  `CREATE TABLE IF NOT EXISTS ogr_projections (entry_id bigint PRIMARY KEY REFERENCES ogr_entries(id), tenant_id text NOT NULL, target text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,

  `CREATE OR REPLACE FUNCTION ogr_post(p_actor text, p_tenant text, p_enrollment text, p_is_registrar boolean, p_idem text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d ogr_proposals%ROWTYPE; h text; prior ogr_entries%ROWTYPE; nid bigint; m text;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only registrar staff post official grades.'; END IF;
     IF length(coalesce(p_idem,'')) < 8 THEN RETURN 'Missing request key.'; END IF;
     SELECT * INTO d FROM ogr_proposals WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment FOR UPDATE;
     IF NOT FOUND THEN RETURN 'No certified grade to post.'; END IF;
     h := md5('post|' || p_enrollment || '|' || d.grade || '|' || d.version);
     SELECT * INTO prior FROM ogr_entries WHERE tenant_id = p_tenant AND idem_key = p_idem;
     IF FOUND THEN
       IF prior.payload_hash = h THEN RETURN 'ok:' || prior.id || ':' || prior.revision || ':replay'; END IF;
       RETURN 'This request key was already used for a different grade.';
     END IF;
     IF d.state = 'Posted' THEN RETURN 'Already posted. Use a correction to change an official grade.'; END IF;
     IF d.state <> 'Certified' OR d.certified_version <> d.version THEN RETURN 'The instructor of record has not certified this version.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This grade changed since you looked at it. Review it again before posting.'; END IF;
     IF d.certified_by = p_actor THEN RETURN 'The person who certified a grade cannot also post it.'; END IF;
     m := aum_mode(p_tenant, 'records'); IF m = 'retired' THEN RETURN 'Records are retired for this institution.'; END IF;
     INSERT INTO ogr_entries (tenant_id, enrollment_id, section_id, student_id, revision, grade, kind, proposal_version, certified_by, posted_by, authority, idem_key, payload_hash)
       VALUES (p_tenant, p_enrollment, d.section_id, d.student_id, 1, d.grade, 'Original', d.version, d.certified_by, p_actor, m, p_idem, h) RETURNING id INTO nid;
     UPDATE ogr_proposals SET state = 'Posted', updated_at = now() WHERE id = d.id;
     INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'posted ' || d.grade || ' as revision 1 (' || m || ')');
     RETURN 'ok:' || nid || ':1';
   END $$`,
  `CREATE OR REPLACE FUNCTION ogr_correct(p_actor text, p_tenant text, p_enrollment text, p_is_registrar boolean, p_grade text, p_reason text, p_idem text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cur ogr_entries%ROWTYPE; h text; prior ogr_entries%ROWTYPE; nid bigint; m text;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only registrar staff correct official grades.'; END IF;
     IF p_grade NOT IN (${G}) THEN RETURN 'Unknown grade.'; END IF;
     IF length(trim(coalesce(p_reason,''))) < 10 THEN RETURN 'Give the reason for the correction (at least 10 characters).'; END IF;
     IF length(coalesce(p_idem,'')) < 8 THEN RETURN 'Missing request key.'; END IF;
     h := md5('correct|' || p_enrollment || '|' || p_grade || '|' || trim(p_reason));
     SELECT * INTO prior FROM ogr_entries WHERE tenant_id = p_tenant AND idem_key = p_idem;
     IF FOUND THEN IF prior.payload_hash = h THEN RETURN 'ok:' || prior.id || ':' || prior.revision || ':replay'; END IF; RETURN 'This request key was already used for a different change.'; END IF;
     PERFORM 1 FROM ogr_proposals WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment FOR UPDATE;
     SELECT * INTO cur FROM ogr_entries WHERE tenant_id = p_tenant AND enrollment_id = p_enrollment ORDER BY revision DESC LIMIT 1;
     IF NOT FOUND THEN RETURN 'There is no official grade to correct yet.'; END IF;
     IF cur.grade = p_grade THEN RETURN 'That is already the official grade.'; END IF;
     m := aum_mode(p_tenant, 'records'); IF m = 'retired' THEN RETURN 'Records are retired for this institution.'; END IF;
     INSERT INTO ogr_entries (tenant_id, enrollment_id, section_id, student_id, revision, grade, previous_grade, kind, reason, posted_by, authority, idem_key, payload_hash)
       VALUES (p_tenant, p_enrollment, cur.section_id, cur.student_id, cur.revision + 1, p_grade, cur.grade, 'Correction', trim(p_reason), p_actor, m, p_idem, h) RETURNING id INTO nid;
     INSERT INTO ogr_events (tenant_id, enrollment_id, actor, what) VALUES (p_tenant, p_enrollment, p_actor, 'corrected ' || cur.grade || ' → ' || p_grade || ' (revision ' || (cur.revision + 1) || ')');
     RETURN 'ok:' || nid || ':' || (cur.revision + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION ogr_mark_projected(p_entry bigint, p_tenant text, p_target text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO ogr_projections (entry_id, tenant_id, target) VALUES (p_entry, p_tenant, p_target) ON CONFLICT (entry_id) DO NOTHING $$`,
];
