// Submission receipts (replacement spec §4.2, §7 Workflow B). A successful upload is not a submitted assignment: the
// submission is the receipt row. sbm_submit reads the attached files from the database itself (never from the client),
// records each file's name, size and SHA-256 in a manifest, locks the attachments, and stamps the time against the due
// date — all in one transaction. The same request key replays the same receipt; a reused key with a different manifest
// is refused. Receipts are append-only. p_is_owner is computed by the server (the student owns this draft).
export const SBM_MIGRATION: string[] = [
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
  `CREATE OR REPLACE FUNCTION sbm_submit(p_actor text, p_tenant text, p_submission text, p_task text, p_section text, p_is_owner boolean, p_due timestamptz, p_idem text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f jsonb; h text; prior sbm_receipts%ROWTYPE; code text; late_s int;
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
     late_s := CASE WHEN p_due IS NOT NULL AND now() > p_due THEN greatest(1, ceil(extract(epoch FROM now() - p_due))::int) ELSE 0 END;
     code := upper(substr(encode(sha256(convert_to(p_tenant || p_submission || h || clock_timestamp()::text, 'UTF8')), 'hex'), 1, 10));
     UPDATE fil_attachments SET locked = true WHERE tenant_id = p_tenant AND kind = 'submission' AND ref_id = p_submission AND NOT locked;
     INSERT INTO sbm_receipts (tenant_id, submission_id, task_id, section_id, student_id, files, manifest_sha256, due_at, late, late_seconds, receipt_code, idem_key)
       VALUES (p_tenant, p_submission, p_task, p_section, p_actor, f, h, p_due, late_s > 0, late_s, code, p_idem);
     RETURN 'ok:' || code;
   END $$`,
];
