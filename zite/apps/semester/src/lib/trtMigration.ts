// Migration trt-001: transcript intake for transfer credit (role app "Transfer Student": transcript intake).
// Requires trf-001 (trf_requests) and fil-001/fil-002 (private file store with screening).
// A student attaches a transcript file from their own private store to their own open transfer request (at most 3). Only a
// file that passed screening can be attached. A registrar (capability checked by the endpoint), never the student, reviews
// it: accepted as official, accepted as unofficial (useful for evaluation, not for posting credit), or rejected with a
// reason. Only the student and registrars can read it; every read and every refusal is written to fil_access_log. Files are
// never public and never sent anywhere. Review history is append-only.
export const TRT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS trt_transcripts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id text NOT NULL REFERENCES trf_requests(id),
     file_id uuid NOT NULL REFERENCES fil_files(id), student_id text NOT NULL,
     state text NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'accepted_official', 'accepted_unofficial', 'rejected')),
     reviewed_by text, review_note text NOT NULL DEFAULT '', reviewed_at timestamptz, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (request_id, file_id), CHECK (reviewed_by IS NULL OR reviewed_by <> student_id),
     CHECK ((state = 'received') = (reviewed_by IS NULL)), CHECK (state <> 'rejected' OR length(trim(review_note)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS trt_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, transcript_id bigint NOT NULL REFERENCES trt_transcripts(id),
     actor_id text NOT NULL, step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION trt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS trt_events_append_only ON trt_events`,
  `CREATE TRIGGER trt_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON trt_events FOR EACH STATEMENT EXECUTE FUNCTION trt_refuse_change()`,
  `CREATE OR REPLACE FUNCTION trt_add(p_tenant text, p_student text, p_request text, p_file uuid) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE q trf_requests%ROWTYPE; v_id bigint; BEGIN
     SELECT * INTO q FROM trf_requests WHERE id = p_request AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR q.student_id <> p_student THEN RETURN 'Attach transcripts to your own transfer request.'; END IF;
     IF q.state IN ('final', 'withdrawn') THEN RETURN 'This request is closed.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM fil_files WHERE id = p_file AND tenant_id = p_tenant AND owner_id = p_student AND deleted_at IS NULL) THEN RETURN 'Upload the transcript to your files first.'; END IF;
     IF (SELECT scan_status FROM fil_files WHERE id = p_file) <> 'clean' THEN RETURN 'This file has not passed screening.'; END IF;
     IF (SELECT count(*) FROM trt_transcripts WHERE request_id = p_request) >= 3 THEN RETURN 'Attach up to 3 transcripts.'; END IF;
     IF EXISTS (SELECT 1 FROM trt_transcripts WHERE request_id = p_request AND file_id = p_file) THEN RETURN 'That file is already attached.'; END IF;
     INSERT INTO trt_transcripts (tenant_id, request_id, file_id, student_id) VALUES (p_tenant, p_request, p_file, p_student) RETURNING id INTO v_id;
     INSERT INTO trt_events (tenant_id, transcript_id, actor_id, step) VALUES (p_tenant, v_id, p_student, 'attach');
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_student, 'attach', 'transcript:' || p_request);
     RETURN 'ok:' || v_id;
   END $$`,
  /** p_registrar: the endpoint verified the registration decision capability for this actor. */
  `CREATE OR REPLACE FUNCTION trt_review(p_tenant text, p_actor text, p_registrar boolean, p_id bigint, p_version int, p_decision text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t trt_transcripts%ROWTYPE; BEGIN
     SELECT * INTO t FROM trt_transcripts WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Transcript not found.'; END IF;
     IF p_version IS DISTINCT FROM t.version THEN RETURN 'This transcript changed since you opened it. Reload and try again.'; END IF;
     IF p_actor = t.student_id THEN RETURN 'You cannot review your own transcript.'; END IF;
     IF NOT p_registrar THEN RETURN 'Only a registrar reviews transcripts.'; END IF;
     IF t.state <> 'received' THEN RETURN 'This transcript was already reviewed.'; END IF;
     IF p_decision NOT IN ('accepted_official', 'accepted_unofficial', 'rejected') THEN RETURN 'Choose a decision.'; END IF;
     IF p_decision = 'rejected' AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why it cannot be used (10+ characters).'; END IF;
     UPDATE trt_transcripts SET state = p_decision, reviewed_by = p_actor, review_note = trim(coalesce(p_note, '')), reviewed_at = now(), version = version + 1 WHERE id = t.id;
     INSERT INTO trt_events (tenant_id, transcript_id, actor_id, step, note) VALUES (p_tenant, t.id, p_actor, p_decision, coalesce(p_note, ''));
     RETURN 'ok:' || t.id;
   END $$`,
  /** Bytes for the student who attached it or a registrar; every read and refusal is logged. */
  `CREATE OR REPLACE FUNCTION trt_read(p_tenant text, p_actor text, p_registrar boolean, p_id bigint) RETURNS TABLE (name text, mime text, bytes bytea) LANGUAGE plpgsql AS $$
   DECLARE t trt_transcripts%ROWTYPE; BEGIN
     SELECT * INTO t FROM trt_transcripts WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND THEN RETURN; END IF;
     IF NOT (p_actor = t.student_id OR p_registrar) OR NOT EXISTS (SELECT 1 FROM fil_files WHERE id = t.file_id AND deleted_at IS NULL AND scan_status = 'clean') THEN
       INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, t.file_id, p_actor, 'denied', 'transcript:' || t.request_id);
       RETURN;
     END IF;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, t.file_id, p_actor, 'download', 'transcript:' || t.request_id);
     RETURN QUERY SELECT f.name, f.mime, b.bytes FROM fil_files f JOIN fil_blobs b ON b.file_id = f.id WHERE f.id = t.file_id;
   END $$`,
];
