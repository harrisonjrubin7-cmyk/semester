// Submission receipts (replacement spec §4.2, §7 Workflow B). A successful upload is not a submitted assignment: the
// submission is the receipt row. sbm_submit reads the attached files from the database itself (never from the client),
// records each file's name, size and SHA-256 in a manifest, locks the attachments, and stamps the time against the due
// date — all in one transaction. The same request key replays the same receipt; a reused key with a different manifest
// is refused. Receipts are append-only. p_is_owner is computed by the server (the student owns this draft).
import { ASG_MIGRATION } from './asgMigration';
import { GRP_MIGRATION } from './grpMigration';

export const SBM_MIGRATION: string[] = [
  // Assignment versions first: a receipt records the version it was submitted against (28 Oct).
  ...ASG_MIGRATION,
  // Course groups: a group assignment's receipt names the group (28 Oct).
  ...GRP_MIGRATION,
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
  // Attempts (28 Oct): the published assignment version says how many; each receipt is numbered.
  `ALTER TABLE sbm_receipts ADD COLUMN IF NOT EXISTS attempt int NOT NULL DEFAULT 1 CHECK (attempt >= 1)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sbm_one_receipt_per_attempt ON sbm_receipts (tenant_id, task_id, student_id, attempt)`,
  // Group receipts (28 Oct): one receipt per group attempt, with the members frozen at the moment of submission. A later
  // change of group membership never changes who a submitted piece of work belongs to.
  `CREATE TABLE IF NOT EXISTS sbm_group_receipts (receipt_id bigint PRIMARY KEY REFERENCES sbm_receipts(id), tenant_id text NOT NULL, asg_id bigint NOT NULL,
     set_id bigint NOT NULL, group_id bigint NOT NULL, members text[] NOT NULL CHECK (cardinality(members) >= 1), submitted_by text NOT NULL,
     CHECK (submitted_by = ANY(members)))`,
  `CREATE INDEX IF NOT EXISTS sbm_group_receipts_group ON sbm_group_receipts (tenant_id, asg_id, group_id)`,
  `DROP TRIGGER IF EXISTS sbm_group_receipts_append_only ON sbm_group_receipts`,
  `CREATE TRIGGER sbm_group_receipts_append_only BEFORE UPDATE OR DELETE ON sbm_group_receipts FOR EACH ROW EXECUTE FUNCTION sbm_refuse_change()`,
  // Attempts used and allowed for one student on one task (allowed comes from the current published version; default 1).
  `CREATE OR REPLACE FUNCTION sbm_attempts(p_tenant text, p_task text, p_student text, OUT used int, OUT allowed int) LANGUAGE plpgsql STABLE AS $$
   DECLARE v_asg bigint; v_gs bigint; v_grp bigint;
   BEGIN
     SELECT greatest(1, least(10, coalesce((v.content->>'attemptsAllowed')::int, 1))), a.id, nullif(v.content->>'groupSetId', '')::bigint INTO allowed, v_asg, v_gs
       FROM asg_task_links l JOIN asg_assignments a ON a.id = l.assignment_id JOIN asg_versions v ON v.assignment_id = a.id AND v.version = a.current_version
       WHERE l.task_id = p_task;
     allowed := coalesce(allowed, 1);
     IF v_gs IS NOT NULL THEN SELECT group_id INTO v_grp FROM grp_members WHERE set_id = v_gs AND student_id = p_student; END IF;
     IF v_grp IS NOT NULL THEN
       -- Group work: attempts belong to the group, whoever submitted them.
       SELECT count(*)::int INTO used FROM sbm_group_receipts WHERE tenant_id = p_tenant AND asg_id = v_asg AND group_id = v_grp;
     ELSE
       SELECT count(*)::int INTO used FROM sbm_receipts WHERE tenant_id = p_tenant AND task_id = p_task AND student_id = p_student;
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION sbm_submit(p_actor text, p_tenant text, p_submission text, p_task text, p_section text, p_is_owner boolean, p_due timestamptz, p_idem text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f jsonb; h text; prior sbm_receipts%ROWTYPE; code text; late_s int; v_due timestamptz; v_src text; bad text; v_asg bigint; v_ver int; v_sha text; v_used int; v_allowed int; v_gs bigint; v_grp bigint; v_rid bigint;
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
     SELECT l.assignment_id, a.current_version, v.content_sha256, nullif(v.content->>'groupSetId', '')::bigint INTO v_asg, v_ver, v_sha, v_gs
       FROM asg_task_links l JOIN asg_assignments a ON a.id = l.assignment_id JOIN asg_versions v ON v.assignment_id = a.id AND v.version = a.current_version
       WHERE l.task_id = p_task;
     IF v_gs IS NOT NULL THEN
       SELECT group_id INTO v_grp FROM grp_members WHERE set_id = v_gs AND student_id = p_actor;
       IF v_grp IS NULL THEN RETURN 'This is group work. Join a group in its group set before submitting.'; END IF;
       -- Serialise the whole group's attempts on this assignment.
       PERFORM pg_advisory_xact_lock(hashtext(p_tenant || '|asg:' || v_asg || '|grp:' || v_grp));
     END IF;
     -- Serialise this student's attempts on this task, then check the allowance.
     PERFORM pg_advisory_xact_lock(hashtext(p_tenant || '|' || p_task || '|' || p_actor));
     SELECT a.used, a.allowed INTO v_used, v_allowed FROM sbm_attempts(p_tenant, p_task, p_actor) a;
     IF v_used >= v_allowed THEN RETURN 'You have used all ' || v_allowed || ' attempt' || CASE WHEN v_allowed = 1 THEN '' ELSE 's' END || ' for this assignment.'; END IF;
     SELECT x.name INTO bad FROM fil_attachments a JOIN fil_files x ON x.id = a.file_id WHERE a.tenant_id = p_tenant AND a.kind = 'submission' AND a.ref_id = p_submission AND x.scan_status <> 'clean' LIMIT 1;
     IF bad IS NOT NULL THEN RETURN 'The file "' || bad || '" has not passed the safety check, so the work cannot be submitted. Remove it or upload a clean copy.'; END IF;
     SELECT new_due, 'extension:' || kind INTO v_due, v_src FROM dln_extensions WHERE tenant_id = p_tenant AND task_id = p_task AND student_id = p_actor AND revoked_at IS NULL;
     -- Group work keeps the assignment's due date: one member's individual extension does not move the group's (owner decision pending).
     IF v_grp IS NOT NULL THEN v_due := NULL; END IF;
     IF v_due IS NULL THEN v_due := p_due; v_src := 'assignment'; END IF;
     late_s := CASE WHEN v_due IS NOT NULL AND now() > v_due THEN greatest(1, ceil(extract(epoch FROM now() - v_due))::int) ELSE 0 END;
     code := upper(substr(encode(sha256(convert_to(p_tenant || p_submission || h || clock_timestamp()::text, 'UTF8')), 'hex'), 1, 10));
     UPDATE fil_attachments SET locked = true WHERE tenant_id = p_tenant AND kind = 'submission' AND ref_id = p_submission AND NOT locked;
     INSERT INTO sbm_receipts (tenant_id, submission_id, task_id, section_id, student_id, files, manifest_sha256, due_at, late, late_seconds, receipt_code, idem_key, due_source, asg_id, asg_version, asg_sha256, attempt)
       VALUES (p_tenant, p_submission, p_task, p_section, p_actor, f, h, v_due, late_s > 0, late_s, code, p_idem, v_src, v_asg, v_ver, v_sha, v_used + 1)
       RETURNING id INTO v_rid;
     IF v_grp IS NOT NULL THEN
       INSERT INTO sbm_group_receipts (receipt_id, tenant_id, asg_id, set_id, group_id, members, submitted_by)
         SELECT v_rid, p_tenant, v_asg, v_gs, v_grp, array_agg(student_id ORDER BY student_id), p_actor FROM grp_members WHERE group_id = v_grp;
     END IF;
     RETURN 'ok:' || code;
   END $$`,
];
