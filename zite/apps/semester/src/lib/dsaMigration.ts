// Migration dsa-001: disability services workflow on top of acc-001 (Disability Services Officer and Staff role apps).
// Officers are the accessibility office (acc_staff). Coordinators (Disability Services Staff) are granted by an administrator,
// never self; they handle intake meetings, document tracking and implementation checks, and never see the student's
// description, documents or any diagnosis: Semester stores document kind and status only, never contents.
// Intake: an officer assigns a coordinator (not the student) who schedules and records the meeting. Documents: a coordinator or
// officer records receipt; only an officer marks them verified or insufficient. Appeals: the student appeals a decided request
// once; an officer who did not make the original decision decides it, and a modified outcome replaces the arrangements.
// Implementation: the instructor acknowledges a letter for a section they teach (checked by the endpoint); a coordinator records
// whether the arrangement was delivered, and a "not delivered" check is flagged to officers. Append-only history.
export const DSA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dsa_coordinators (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS dsa_intake (request_id text PRIMARY KEY REFERENCES acc_requests(id), coordinator_id text NOT NULL, assigned_by text NOT NULL, meeting_at timestamptz,
     state text NOT NULL DEFAULT 'assigned' CHECK (state IN ('assigned','scheduled','held','no_show')))`,
  `CREATE TABLE IF NOT EXISTS dsa_docs (id bigserial PRIMARY KEY, request_id text NOT NULL REFERENCES acc_requests(id), kind text NOT NULL CHECK (kind IN ('provider_letter','prior_plan','self_report','other')),
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','received','verified','insufficient')), note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
     received_by text, reviewed_by text, CHECK (state NOT IN ('verified','insufficient') OR reviewed_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS dsa_appeals (request_id text PRIMARY KEY REFERENCES acc_requests(id), student_id text NOT NULL, reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 20 AND 2000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','upheld','modified','overturned')), decided_by text, note text NOT NULL DEFAULT '', original_decider text,
     CHECK (decided_by IS NULL OR (decided_by <> student_id AND decided_by IS DISTINCT FROM original_decider)))`,
  `CREATE TABLE IF NOT EXISTS dsa_acks (request_id text NOT NULL, section_id text NOT NULL, instructor_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (request_id, section_id))`,
  `CREATE TABLE IF NOT EXISTS dsa_checks (id bigserial PRIMARY KEY, request_id text NOT NULL, section_id text NOT NULL, checked_by text NOT NULL, delivered boolean NOT NULL,
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 500), flagged boolean NOT NULL DEFAULT false, resolved_by text, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS dsa_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dsa_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dsa_events_append_only') THEN
       CREATE TRIGGER dsa_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dsa_events FOR EACH STATEMENT EXECUTE FUNCTION dsa_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_is_coord(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dsa_coordinators WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION dsa_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO dsa_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION dsa_set_coord(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_on THEN INSERT INTO dsa_coordinators (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin;
     ELSE UPDATE dsa_coordinators SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     PERFORM dsa_log(p_tenant, 'coordinator', p_user, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_assign(p_actor text, p_tenant text, p_req text, p_coord text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests;
   BEGIN
     IF NOT acc_is_staff(p_tenant, p_actor) THEN RETURN 'Only the accessibility office assigns intake.'; END IF;
     SELECT * INTO r FROM acc_requests WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL THEN RETURN 'Request not found.'; END IF;
     IF p_actor = r.student_id THEN RETURN 'Someone else handles your own request.'; END IF;
     IF NOT dsa_is_coord(p_tenant, p_coord) THEN RETURN 'Choose a disability services coordinator.'; END IF;
     IF p_coord = r.student_id THEN RETURN 'A student cannot coordinate their own intake.'; END IF;
     INSERT INTO dsa_intake (request_id, coordinator_id, assigned_by) VALUES (p_req, p_coord, p_actor)
       ON CONFLICT (request_id) DO UPDATE SET coordinator_id = EXCLUDED.coordinator_id, assigned_by = EXCLUDED.assigned_by, state = 'assigned', meeting_at = NULL;
     PERFORM dsa_log(p_tenant, 'intake', p_req, 'assign', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_intake_step(p_actor text, p_tenant text, p_req text, p_step text, p_at timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i dsa_intake;
   BEGIN
     SELECT x.* INTO i FROM dsa_intake x JOIN acc_requests r ON r.id = x.request_id WHERE x.request_id = p_req AND r.tenant_id = p_tenant FOR UPDATE OF x;
     IF i.request_id IS NULL THEN RETURN 'Intake not found.'; END IF;
     IF i.coordinator_id <> p_actor THEN RETURN 'Only the assigned coordinator updates this intake.'; END IF;
     IF p_step = 'schedule' THEN
       IF p_at IS NULL OR p_at <= now() THEN RETURN 'Choose a time in the future.'; END IF;
       UPDATE dsa_intake SET state = 'scheduled', meeting_at = p_at WHERE request_id = p_req;
     ELSIF p_step IN ('held','no_show') THEN
       IF i.state <> 'scheduled' THEN RETURN 'Schedule the meeting first.'; END IF;
       UPDATE dsa_intake SET state = p_step WHERE request_id = p_req;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM dsa_log(p_tenant, 'intake', p_req, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_doc(p_actor text, p_tenant text, p_req text, p_doc bigint, p_kind text, p_state text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests; officer boolean := acc_is_staff(p_tenant, p_actor); coord boolean;
   BEGIN
     SELECT * INTO r FROM acc_requests WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL THEN RETURN 'Request not found.'; END IF;
     coord := EXISTS (SELECT 1 FROM dsa_intake WHERE request_id = p_req AND coordinator_id = p_actor) AND dsa_is_coord(p_tenant, p_actor);
     IF p_actor = r.student_id THEN RETURN 'Someone else tracks your own documents.'; END IF;
     IF NOT (officer OR coord) THEN RETURN 'Only the office or the assigned coordinator tracks documents.'; END IF;
     IF p_doc IS NULL THEN
       INSERT INTO dsa_docs (request_id, kind, note) VALUES (p_req, p_kind, coalesce(p_note, ''));
     ELSIF p_state = 'received' THEN
       UPDATE dsa_docs SET state = 'received', received_by = p_actor, note = coalesce(p_note, note) WHERE id = p_doc AND request_id = p_req AND state IN ('requested','insufficient');
       IF NOT FOUND THEN RETURN 'That document is not waiting to be received.'; END IF;
     ELSIF p_state IN ('verified','insufficient') THEN
       IF NOT officer THEN RETURN 'Only an accessibility officer reviews documents.'; END IF;
       UPDATE dsa_docs SET state = p_state, reviewed_by = p_actor, note = coalesce(p_note, note) WHERE id = p_doc AND request_id = p_req AND state = 'received';
       IF NOT FOUND THEN RETURN 'Review a document after it is received.'; END IF;
     ELSE RETURN 'Unknown status.'; END IF;
     PERFORM dsa_log(p_tenant, 'document', p_req, coalesce(p_state, 'request'), p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_appeal(p_student text, p_tenant text, p_req text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests;
   BEGIN
     SELECT * INTO r FROM acc_requests WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL OR r.student_id <> p_student THEN RETURN 'Appeal your own request.'; END IF;
     IF r.state NOT IN ('approved','declined') THEN RETURN 'Appeal after the office decides.'; END IF;
     IF EXISTS (SELECT 1 FROM dsa_appeals WHERE request_id = p_req) THEN RETURN 'This request was already appealed.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 20 THEN RETURN 'Explain why the decision should change.'; END IF;
     INSERT INTO dsa_appeals (request_id, student_id, reason, original_decider) VALUES (p_req, p_student, trim(p_reason), r.decided_by);
     PERFORM dsa_log(p_tenant, 'appeal', p_req, 'file', p_student);
     RETURN NULL;
   END $$`,
  `DROP FUNCTION IF EXISTS dsa_decide_appeal(text, text, text, text, text[], text)`,
  `CREATE OR REPLACE FUNCTION dsa_decide_appeal(p_actor text, p_tenant text, p_req text, p_outcome text, p_arrangements text[], p_note text, p_valid_until date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE ap dsa_appeals; r acc_requests;
   BEGIN
     IF NOT acc_is_staff(p_tenant, p_actor) THEN RETURN 'Only an accessibility officer decides appeals.'; END IF;
     SELECT * INTO r FROM acc_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     SELECT * INTO ap FROM dsa_appeals WHERE request_id = p_req FOR UPDATE;
     IF ap.request_id IS NULL THEN RETURN 'Appeal not found.'; END IF;
     IF ap.state <> 'open' THEN RETURN 'This appeal is decided.'; END IF;
     IF p_actor = ap.student_id THEN RETURN 'Someone else decides your own appeal.'; END IF;
     IF p_actor IS NOT DISTINCT FROM ap.original_decider THEN RETURN 'An officer who did not make the original decision decides the appeal.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Explain the appeal decision.'; END IF;
     IF p_outcome IN ('modified','overturned') THEN
       IF coalesce(array_length(p_arrangements, 1), 0) = 0 THEN RETURN 'List the arrangements that now apply.'; END IF;
       IF p_valid_until IS NULL OR p_valid_until <= current_date THEN RETURN 'Set a future end date for the accommodation.'; END IF;
       UPDATE acc_requests SET state = 'approved', arrangements = p_arrangements, valid_until = p_valid_until, decided_by = p_actor, decided_at = now(), decision_note = 'Appeal: ' || trim(p_note), version = version + 1 WHERE id = p_req;
     ELSIF p_outcome <> 'upheld' THEN RETURN 'Unknown outcome.'; END IF;
     UPDATE dsa_appeals SET state = p_outcome, decided_by = p_actor, note = trim(p_note) WHERE request_id = p_req;
     PERFORM dsa_log(p_tenant, 'appeal', p_req, p_outcome, p_actor);
     RETURN NULL;
   END $$`,
  // p_is_instructor is computed by the endpoint (the caller teaches p_section).
  `CREATE OR REPLACE FUNCTION dsa_ack(p_actor text, p_tenant text, p_req text, p_section text, p_is_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_instructor THEN RETURN 'Only an instructor of the section acknowledges the letter.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM acc_letters l JOIN acc_requests r ON r.id = l.request_id WHERE l.request_id = p_req AND l.section_id = p_section AND l.withdrawn_at IS NULL AND r.tenant_id = p_tenant AND r.state = 'approved')
       THEN RETURN 'There is no active letter for that section.'; END IF;
     INSERT INTO dsa_acks (request_id, section_id, instructor_id) VALUES (p_req, p_section, p_actor) ON CONFLICT DO NOTHING;
     PERFORM dsa_log(p_tenant, 'letter', p_req || ' ' || p_section, 'acknowledge', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_check(p_actor text, p_tenant text, p_req text, p_section text, p_delivered boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests;
   BEGIN
     IF NOT (dsa_is_coord(p_tenant, p_actor) OR acc_is_staff(p_tenant, p_actor)) THEN RETURN 'Only disability services records implementation checks.'; END IF;
     SELECT * INTO r FROM acc_requests WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL OR NOT EXISTS (SELECT 1 FROM acc_letters WHERE request_id = p_req AND section_id = p_section AND withdrawn_at IS NULL) THEN RETURN 'There is no active letter for that section.'; END IF;
     IF p_actor = r.student_id THEN RETURN 'Someone else checks your own accommodations.'; END IF;
     IF NOT p_delivered AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say what was not delivered.'; END IF;
     INSERT INTO dsa_checks (request_id, section_id, checked_by, delivered, note, flagged) VALUES (p_req, p_section, p_actor, p_delivered, coalesce(p_note, ''), NOT p_delivered);
     PERFORM dsa_log(p_tenant, 'check', p_req || ' ' || p_section, CASE WHEN p_delivered THEN 'delivered' ELSE 'not_delivered' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dsa_clear_flag(p_actor text, p_tenant text, p_check bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c dsa_checks;
   BEGIN
     IF NOT acc_is_staff(p_tenant, p_actor) THEN RETURN 'Only an accessibility officer clears a flag.'; END IF;
     SELECT x.* INTO c FROM dsa_checks x JOIN acc_requests r ON r.id = x.request_id WHERE x.id = p_check AND r.tenant_id = p_tenant FOR UPDATE OF x;
     IF c.id IS NULL OR NOT c.flagged OR c.resolved_by IS NOT NULL THEN RETURN 'No open flag.'; END IF;
     IF c.checked_by = p_actor THEN RETURN 'Another officer clears a flag you raised.'; END IF;
     UPDATE dsa_checks SET resolved_by = p_actor WHERE id = p_check;
     PERFORM dsa_log(p_tenant, 'check', p_check::text, 'cleared', p_actor);
     RETURN NULL;
   END $$`,
];
