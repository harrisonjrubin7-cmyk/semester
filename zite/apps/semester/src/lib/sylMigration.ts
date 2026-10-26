// Migration syl-001: the student syllabus hub (S-72 §E). Private syllabi a student adds for their own courses, with
// append-only versions, plus the student's own review decisions on extracted dates and grading weights (for private syllabi and
// for official instructor-published ones, referenced as section:<id>). Enforced here: only the owner adds versions or reviews;
// versions are append-only and numbered in order; a source reference is required; decisions are one per item per version.
export const SYL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS syl_docs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, course text NOT NULL CHECK (length(trim(course)) BETWEEN 2 AND 120),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160), source_ref text NOT NULL CHECK (length(trim(source_ref)) BETWEEN 3 AND 300),
     created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS syl_versions (doc_id bigint NOT NULL REFERENCES syl_docs(id), version int NOT NULL, body text NOT NULL CHECK (length(body) BETWEEN 20 AND 60000),
     effective_date date, change_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (doc_id, version))`,
  `CREATE TABLE IF NOT EXISTS syl_reviews (tenant_id text NOT NULL, student_id text NOT NULL, ref text NOT NULL, version int NOT NULL, item_key text NOT NULL,
     decision text NOT NULL CHECK (decision IN ('accepted','rejected')), decided_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id, ref, version, item_key))`,
  `CREATE OR REPLACE FUNCTION syl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'syl_versions_append_only') THEN
       CREATE TRIGGER syl_versions_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON syl_versions FOR EACH STATEMENT EXECUTE FUNCTION syl_refuse_change();
     END IF;
   END $$`,
  // New doc when p_doc is NULL. Returns 'ok:<doc>:<version>' or a refusal.
  `CREATE OR REPLACE FUNCTION syl_save(p_tenant text, p_student text, p_doc bigint, p_course text, p_title text, p_source text, p_body text, p_effective date, p_note text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d syl_docs; v int; nid bigint := p_doc;
   BEGIN
     IF length(trim(coalesce(p_body, ''))) < 20 THEN RETURN 'Paste the syllabus text (20+ characters).'; END IF;
     IF length(trim(coalesce(p_source, ''))) < 3 THEN RETURN 'Say where this text came from (file name, page or link).'; END IF;
     IF p_doc IS NULL THEN
       IF (SELECT count(*) FROM syl_docs WHERE tenant_id = p_tenant AND student_id = p_student AND deleted_at IS NULL) >= 40 THEN RETURN 'You have 40 syllabi; remove one first.'; END IF;
       INSERT INTO syl_docs (tenant_id, student_id, course, title, source_ref) VALUES (p_tenant, p_student, trim(p_course), trim(p_title), trim(p_source)) RETURNING id INTO nid;
       v := 1;
     ELSE
       SELECT * INTO d FROM syl_docs WHERE id = p_doc FOR UPDATE;
       IF NOT FOUND OR d.tenant_id <> p_tenant OR d.student_id <> p_student OR d.deleted_at IS NOT NULL THEN RETURN 'Syllabus not found.'; END IF;
       SELECT coalesce(max(version), 0) INTO v FROM syl_versions WHERE doc_id = p_doc;
       IF v <> p_expected THEN RETURN 'A newer version was saved in another window. Reload first.'; END IF;
       v := v + 1;
       UPDATE syl_docs SET course = trim(p_course), title = trim(p_title), source_ref = trim(p_source) WHERE id = p_doc;
     END IF;
     INSERT INTO syl_versions (doc_id, version, body, effective_date, change_note) VALUES (nid, v, trim(p_body), p_effective, trim(coalesce(p_note, '')));
     RETURN 'ok:' || nid || ':' || v;
   END $$`,
  `CREATE OR REPLACE FUNCTION syl_review(p_tenant text, p_student text, p_ref text, p_version int, p_key text, p_decision text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d syl_docs;
   BEGIN
     IF p_decision NOT IN ('accepted','rejected') THEN RETURN 'Accept or reject.'; END IF;
     IF p_ref LIKE 'doc:%' THEN
       SELECT * INTO d FROM syl_docs WHERE id = substr(p_ref, 5)::bigint;
       IF NOT FOUND OR d.tenant_id <> p_tenant OR d.student_id <> p_student THEN RETURN 'Syllabus not found.'; END IF;
       IF NOT EXISTS (SELECT 1 FROM syl_versions WHERE doc_id = d.id AND version = p_version) THEN RETURN 'That version does not exist.'; END IF;
     ELSIF p_ref NOT LIKE 'section:%' THEN RETURN 'Unknown syllabus.'; END IF;
     INSERT INTO syl_reviews (tenant_id, student_id, ref, version, item_key, decision) VALUES (p_tenant, p_student, p_ref, p_version, p_key, p_decision)
       ON CONFLICT (tenant_id, student_id, ref, version, item_key) DO UPDATE SET decision = EXCLUDED.decision, decided_at = now();
     RETURN NULL;
   END $$`,
];
