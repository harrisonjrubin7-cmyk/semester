// Submission receipts (replacement spec §4.2, §7 Workflow B). A successful upload is not a submitted assignment: the
// submission is the receipt row. sbm_submit reads the attached files from the database itself (never from the client),
// records each file's name, size and SHA-256 in a manifest, locks the attachments, and stamps the time against the due
// date — all in one transaction. The same request key replays the same receipt; a reused key with a different manifest
// is refused. Receipts are append-only. p_is_owner is computed by the server (the student owns this draft).
import { ASG_MIGRATION } from './asgMigration';

export const SBM_MIGRATION: string[] = [
  // Assignment versions first: a receipt records the version it was submitted against (28 Oct).
  ...ASG_MIGRATION,
  `CREATE TABLE IF NOT EXISTS sbm_receipts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, submission_id text NOT NULL, task_id text NOT NULL,
     section_id text NOT NULL, student_id text NOT NULL, files jsonb NOT NULL CHECK (jsonb_typeof(files) = 'array'), manifest_sha256 text NOT NULL,
     due_at timestamptz, submitted_at timestamptz NOT NULL DEFAULT now(), late boolean NOT NULL, late_seconds int NOT NULL DEFAULT 0 CHECK (late_seconds >= 0),
     receipt_code text NOT NULL, idem_key text NOT NULL,
     UNIQUE (tenant_id, submission_id), UNIQUE (tenant_id, idem_key), UNIQUE (receipt_code),
     CHECK (late = (late_seconds > 0)))`,
  `CREATE INDEX IF NOT EXISTS sbm_receipts_task ON sbm_receipts (tenant_id, task_id)`,
  `CREATE OR REPLACE FUNCTION sbm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Submission receipts are kept as issued.'; END $$`,
  `DROP TRIGGER IF EXISTS sbm_receipts_append_only ON sbm_receipts`,
  `CREATE TRIGGER sbm_receipts_append_only BEFORE UPDATE OR DELETE ON sbm_receipts FOR EACH ROW EXECUTE FUNCTION sbm_refuse_change()`,
  // Deadline extensions (spec §4.2 "extensions", §4.3 accommodation-specific conditions). The instructor of record grants a
  // student-specific due date for one assignment; an accommodation extension must point at an active accommodation letter
  // for that student and section (p_acc_ok, checked by the server). The latest unrevoked grant is the student's due date;
  // sbm_submit reads it itself. Grants and revocations are kept in an append-only log.
  `CREATE TABLE IF NOT EXISTS dln_extensions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, task_id text NOT NULL, section_id text NOT NULL, student_id text NOT NULL,
     new_due timestamptz NOT NULL, original_due timestamptz, kind text NOT NULL CHECK (kind IN ('instructor','accommodation')), acc_request_id text,
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 500), granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, revoked_by text,
     CHECK (kind <> 'accommodation' OR acc_request_id IS NOT NULL), CHECK (granted_by <> student_id), CHECK (original_due IS NULL OR new_due > original_due))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dln_extensions_active ON dln_extensions (tenant_id, task_id, student_id) WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS dln_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, extension_id bigint NOT NULL, actor text NOT NULL, what text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `DROP TRIGGER IF EXISTS dln_events_append_only ON dln_events`,
  `CREATE TRIGGER dln_events_append_only BEFORE UPDATE OR DELETE ON dln_events FOR EACH ROW EXECUTE FUNCTION sbm_refuse_change()`,
  `CREATE OR REPLACE FUNCTION dln_grant(p_actor text, p_tenant text, p_task text, p_section text, p_student text, p_is_instructor boolean, p_enrolled boolean,
     p_new_due timestamptz, p_original_due timestamptz, p_kind text, p_acc_request text, p_acc_ok boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cur dln_extensions%ROWTYPE; nid bigint;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only the instructor of record grants extensions.'; END IF;
     IF NOT coalesce(p_enrolled, false) THEN RETURN 'That student is not enrolled in this section.'; END IF;
     IF p_actor = p_student THEN RETURN 'You cannot grant yourself an extension.'; END IF;
     IF p_kind NOT IN ('instructor','accommodation') THEN RETURN 'Unknown kind of extension.'; END IF;
     IF p_kind = 'accommodation' AND (p_acc_request IS NULL OR NOT coalesce(p_acc_ok, false)) THEN RETURN 'An accommodation extension needs an active accommodation letter for this student and section.'; END IF;
     IF p_original_due IS NOT NULL AND p_new_due <= p_original_due THEN RETURN 'The new due date must be after the assignment due date.'; END IF;
     IF EXISTS (SELECT 1 FROM sbm_receipts WHERE tenant_id = p_tenant AND task_id = p_task AND student_id = p_student) THEN RETURN 'This work is already submitted; its receipt keeps the deadline it was submitted against.'; END IF;
     SELECT * INTO cur FROM dln_extensions WHERE tenant_id = p_tenant AND task_id = p_task AND student_id = p_student AND revoked_at IS NULL FOR UPDATE;
     IF FOUND THEN
       UPDATE dln_extensions SET revoked_at = now(), revoked_by = p_actor WHERE id = cur.id;
       INSERT INTO dln_events (tenant_id, extension_id, actor, what) VALUES (p_tenant, cur.id, p_actor, 'replaced');
     END IF;
     INSERT INTO dln_extensions (tenant_id, task_id, section_id, student_id, new_due, original_due, kind, acc_request_id, note, granted_by)
       VALUES (p_tenant, p_task, p_section, p_student, p_new_due, p_original_due, p_kind, CASE WHEN p_kind = 'accommodation' THEN p_acc_request END, left(coalesce(p_note,''), 500), p_actor) RETURNING id INTO nid;
     INSERT INTO dln_events (tenant_id, extension_id, actor, what) VALUES (p_tenant, nid, p_actor, 'granted ' || p_kind || ' to ' || to_char(p_new_due AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC');
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION dln_revoke(p_actor text, p_tenant text, p_id bigint, p_is_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cur dln_extensions%ROWTYPE;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only the instructor of record changes extensions.'; END IF;
     SELECT * INTO cur FROM dln_extensions WHERE id = p_id AND tenant_id = p_tenant AND revoked_at IS NULL FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Extension not found.'; END IF;
     IF EXISTS (SELECT 1 FROM sbm_receipts WHERE tenant_id = p_tenant AND task_id = cur.task_id AND student_id = cur.student_id) THEN RETURN 'This work is already submitted against this deadline.'; END IF;
     UPDATE dln_extensions SET revoked_at = now(), revoked_by = p_actor WHERE id = cur.id;
     INSERT INTO dln_events (tenant_id, extension_id, actor, what) VALUES (p_tenant, cur.id, p_actor, 'revoked');
     RETURN NULL;
   END $$`,
  `ALTER TABLE sbm_receipts ADD COLUMN IF NOT EXISTS asg_id bigint`,
  `ALTER TABLE sbm_receipts ADD COLUMN IF NOT EXISTS asg_version int`,
  `ALTER TABLE sbm_receipts ADD COLUMN IF NOT EXISTS asg_sha256 text`,
  `ALTER TABLE sbm_receipts ADD COLUMN IF NOT EXISTS due_source text NOT NULL DEFAULT 'assignment'`,
  `CREATE OR REPLACE FUNCTION sbm_submit(p_actor text, p_tenant text, p_submission text, p_task text, p_section text, p_is_owner boolean, p_due timestamptz, p_idem text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f jsonb; h text; prior sbm_receipts%ROWTYPE; code text; late_s int; v_due timestamptz; v_src text; bad text; v_asg bigint; v_ver int; v_sha text;
   BEGIN
     IF NOT coalesce(p_is_owner, false) THEN RETURN 'You can only submit your own draft.'; END IF;
     IF length(coalesce(p_idem,'')) < 8 THEN RETURN 'Missing request key.'; END IF;
     PERFORM 1 FROM fil_attachments WHERE tenant_id = p_tenant AND kind = 'submission' AND ref_id = p_submission FOR UPDATE;
     SELECT coalesce(jsonb_agg(jsonb_build_object('fileId', x.id, 'name', x.name, 'size', x.size_bytes, 'sha256', x.sha256) ORDER BY x.sha256, x.id), '[]'::jsonb) INTO f
       FROM fil_attachments a JOIN fil_files x ON x.id = a.file_id
       WHERE a.tenant_id = p_tenant AND a.kind = 'submission' AND a.ref_id = p_submission AND x.deleted_at IS NULL;
     h := encode(sha256(convert_to(p_submission || '|' || f::text, 'UTF8')), 'hex');
     SELECT * INTO prior FROM sbm_receipts WHERE tenant_id = p_tenant AND idem_key = p_idem;
     IF FOUND THEN
       IF prior.submission_id = p_submission AND prior.manifest_sha256 = h THEN RETURN 'ok:' || prior.receipt_code || ':replay'; END IF;
       RETURN 'This request key was already used for different work.';
     END IF;
     IF EXISTS (SELECT 1 FROM sbm_receipts WHERE tenant_id = p_tenant AND submission_id = p_submission) THEN RETURN 'This work was already submitted.'; END IF;
     IF jsonb_array_length(f) = 0 THEN RETURN 'Attach your work before submitting.'; END IF;
     SELECT x.name INTO bad FROM fil_attachments a JOIN fil_files x ON x.id = a.file_id WHERE a.tenant_id = p_tenant AND a.kind = 'submission' AND a.ref_id = p_submission AND x.scan_status <> 'clean' LIMIT 1;
     IF bad IS NOT NULL THEN RETURN 'The file "' || bad || '" has not passed the safety check, so the work cannot be submitted. Remove it or upload a clean copy.'; END IF;
     SELECT new_due, 'extension:' || kind INTO v_due, v_src FROM dln_extensions WHERE tenant_id = p_tenant AND task_id = p_task AND student_id = p_actor AND revoked_at IS NULL;
     IF v_due IS NULL THEN v_due := p_due; v_src := 'assignment'; END IF;
     late_s := CASE WHEN v_due IS NOT NULL AND now() > v_due THEN greatest(1, ceil(extract(epoch FROM now() - v_due))::int) ELSE 0 END;
     code := upper(substr(encode(sha256(convert_to(p_tenant || p_submission || h || clock_timestamp()::text, 'UTF8')), 'hex'), 1, 10));
     UPDATE fil_attachments SET locked = true WHERE tenant_id = p_tenant AND kind = 'submission' AND ref_id = p_submission AND NOT locked;
     SELECT l.assignment_id, a.current_version, v.content_sha256 INTO v_asg, v_ver, v_sha
       FROM asg_task_links l JOIN asg_assignments a ON a.id = l.assignment_id JOIN asg_versions v ON v.assignment_id = a.id AND v.version = a.current_version
       WHERE l.task_id = p_task;
     INSERT INTO sbm_receipts (tenant_id, submission_id, task_id, section_id, student_id, files, manifest_sha256, due_at, late, late_seconds, receipt_code, idem_key, due_source, asg_id, asg_version, asg_sha256)
       VALUES (p_tenant, p_submission, p_task, p_section, p_actor, f, h, v_due, late_s > 0, late_s, code, p_idem, v_src, v_asg, v_ver, v_sha);
     RETURN 'ok:' || code;
   END $$`,
];
