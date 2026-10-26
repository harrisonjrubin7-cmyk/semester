// Migration sab-001: study abroad (mirrors lib/abroadRules.ts).
// Enforced here: advisors are granted by an administrator (never themselves); programs close at their deadline; one live
// application per student per term; idempotent apply; approval locks the program row and never exceeds capacity; the learning
// agreement is approved only by presenting the hash of the exact lines proposed, and any later proposal reopens it; departure
// needs every readiness item; reconciliation covers every agreed line and grants no more than agreed; advisors never act on
// their own application; reasons required; expected-version on every step; append-only history. No transcript posting.
export const SAB_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS sab_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION sab_is_advisor(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM sab_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE TABLE IF NOT EXISTS sab_programs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
     host text NOT NULL CHECK (length(trim(host)) BETWEEN 2 AND 160), country text NOT NULL CHECK (length(trim(country)) BETWEEN 2 AND 80),
     term text NOT NULL CHECK (length(trim(term)) BETWEEN 2 AND 40), capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 500), deadline date NOT NULL,
     description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000), active boolean NOT NULL DEFAULT true,
     created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, name, term))`,
  `CREATE TABLE IF NOT EXISTS sab_apps (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, student_id text NOT NULL,
     program_id bigint NOT NULL REFERENCES sab_programs(id), term text NOT NULL, statement text NOT NULL CHECK (length(statement) BETWEEN 50 AND 4000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','approved','agreed','ready','abroad','returned','reconciled','declined','withdrawn','cancelled')),
     version int NOT NULL DEFAULT 1, lines jsonb NOT NULL DEFAULT '[]'::jsonb, agreement_hash text, agreement_note text NOT NULL DEFAULT '',
     agreed_by text, checklist jsonb NOT NULL DEFAULT '{}'::jsonb, results jsonb, reason text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, student_id, request_key))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sab_apps_one_live ON sab_apps (tenant_id, student_id, term) WHERE state IN ('submitted','approved','agreed','ready','abroad','returned')`,
  `CREATE TABLE IF NOT EXISTS sab_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, subject_id bigint NOT NULL, step text NOT NULL,
     to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION sab_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sab_events_append_only') THEN
       CREATE TRIGGER sab_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sab_events FOR EACH STATEMENT EXECUTE FUNCTION sab_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION sab_set_advisor(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own study-abroad access.'; END IF;
     IF p_on THEN
       INSERT INTO sab_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE sab_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO sab_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'staff', 0, 'set_advisor', CASE WHEN p_on THEN 'granted' ELSE 'revoked' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sab_program(p_tenant text, p_actor text, p_id bigint, p_name text, p_host text, p_country text, p_term text, p_capacity int, p_deadline date, p_desc text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE held int; pid bigint := p_id;
   BEGIN
     IF NOT sab_is_advisor(p_tenant, p_actor) THEN RETURN 'Only study-abroad advisors manage programs.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO sab_programs (tenant_id, name, host, country, term, capacity, deadline, description, active, created_by)
         VALUES (p_tenant, trim(p_name), trim(p_host), trim(p_country), trim(p_term), p_capacity, p_deadline, coalesce(p_desc, ''), p_active, p_actor) RETURNING id INTO pid;
     ELSE
       PERFORM 1 FROM sab_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
       SELECT count(*) INTO held FROM sab_apps WHERE program_id = p_id AND state IN ('approved','agreed','ready','abroad','returned','reconciled');
       IF p_capacity < held THEN RETURN held || ' students already hold places; capacity cannot go below that.'; END IF;
       IF EXISTS (SELECT 1 FROM sab_apps WHERE program_id = p_id) AND (SELECT term FROM sab_programs WHERE id = p_id) <> trim(p_term)
         THEN RETURN 'The term cannot change once students have applied.'; END IF;
       UPDATE sab_programs SET name = trim(p_name), host = trim(p_host), country = trim(p_country), term = trim(p_term), capacity = p_capacity,
         deadline = p_deadline, description = coalesce(p_desc, ''), active = p_active WHERE id = p_id;
     END IF;
     INSERT INTO sab_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'program', pid, 'program', CASE WHEN p_active THEN 'open' ELSE 'closed' END, p_actor, 'capacity ' || p_capacity);
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION sab_apply(p_tenant text, p_key text, p_student text, p_program bigint, p_statement text, p_today date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sab_apps; p sab_programs; nid bigint;
   BEGIN
     SELECT * INTO p FROM sab_programs WHERE id = p_program AND tenant_id = p_tenant;
     IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('sab:' || p_tenant || ':' || p_student));
     SELECT * INTO a FROM sab_apps WHERE tenant_id = p_tenant AND student_id = p_student AND request_key = p_key;
     IF FOUND THEN
       IF a.program_id = p_program AND a.statement = trim(p_statement) THEN RETURN 'replay:' || a.id; END IF;
       RETURN 'This application was already sent with different details.';
     END IF;
     IF NOT p.active OR p_today > p.deadline THEN RETURN 'Applications for this program are closed.'; END IF;
     IF length(trim(coalesce(p_statement, ''))) < 50 THEN RETURN 'Write a statement of purpose (50+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM sab_apps WHERE tenant_id = p_tenant AND student_id = p_student AND term = p.term AND state IN ('submitted','approved','agreed','ready','abroad','returned'))
       THEN RETURN 'You already have a live study-abroad application for ' || p.term || '.'; END IF;
     INSERT INTO sab_apps (tenant_id, request_key, student_id, program_id, term, statement) VALUES (p_tenant, p_key, p_student, p_program, p.term, trim(p_statement)) RETURNING id INTO nid;
     INSERT INTO sab_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'app', nid, 'apply', 'submitted', p_student);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION sab_hash(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(sha256(convert_to(p::text, 'UTF8')), 'hex') $$`,
  // p_text: reason (decline/return_agreement/cancel) or the agreement hash shown (approve_agreement). p_data: lines (propose) or results (reconcile).
  `CREATE OR REPLACE FUNCTION sab_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_text text, p_data jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sab_apps; p sab_programs; actor text; nxt text; held int; t text := trim(coalesce(p_text, '')); l jsonb; r jsonb; i int; n int; k text;
   BEGIN
     SELECT * INTO a FROM sab_apps WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     actor := CASE WHEN p_actor = a.student_id THEN 'student' WHEN sab_is_advisor(p_tenant, p_actor) THEN 'advisor' ELSE NULL END;
     IF actor IS NULL THEN RETURN 'You cannot act on this application.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This application changed since you opened it. Reload.'; END IF;
     IF actor = 'student' AND p_step IN ('approve','decline','approve_agreement','return_agreement','confirm_ready','depart','reconcile','cancel') AND sab_is_advisor(p_tenant, p_actor)
       THEN RETURN 'Ask another advisor to act on your own application.'; END IF;
     nxt := CASE
       WHEN p_step = 'approve' AND actor = 'advisor' AND a.state = 'submitted' THEN 'approved'
       WHEN p_step = 'decline' AND actor = 'advisor' AND a.state = 'submitted' THEN 'declined'
       WHEN p_step = 'propose' AND actor = 'student' AND a.state IN ('approved','agreed') THEN 'approved'
       WHEN p_step = 'approve_agreement' AND actor = 'advisor' AND a.state = 'approved' THEN 'agreed'
       WHEN p_step = 'return_agreement' AND actor = 'advisor' AND a.state = 'approved' THEN 'approved'
       WHEN p_step = 'confirm_ready' AND actor = 'advisor' AND a.state = 'agreed' THEN 'ready'
       WHEN p_step = 'depart' AND actor = 'advisor' AND a.state = 'ready' THEN 'abroad'
       WHEN p_step = 'come_back' AND a.state = 'abroad' THEN 'returned'
       WHEN p_step = 'reconcile' AND actor = 'advisor' AND a.state = 'returned' THEN 'reconciled'
       WHEN p_step = 'withdraw' AND actor = 'student' AND a.state IN ('submitted','approved','agreed','ready') THEN 'withdrawn'
       WHEN p_step = 'cancel' AND actor = 'advisor' AND a.state IN ('submitted','approved','agreed','ready') THEN 'cancelled'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step IN ('decline','return_agreement','cancel') AND length(t) < 10 THEN RETURN 'Give a reason (10+ characters).'; END IF;

     IF p_step = 'approve' THEN
       SELECT * INTO p FROM sab_programs WHERE id = a.program_id FOR UPDATE;
       IF NOT p.active THEN RETURN 'This program is closed.'; END IF;
       SELECT count(*) INTO held FROM sab_apps WHERE program_id = p.id AND state IN ('approved','agreed','ready','abroad','returned','reconciled');
       IF held >= p.capacity THEN RETURN 'This program is full.'; END IF;
     ELSIF p_step = 'propose' THEN
       IF jsonb_typeof(p_data) <> 'array' OR jsonb_array_length(p_data) NOT BETWEEN 1 AND 12 THEN RETURN 'List between 1 and 12 courses.'; END IF;
       FOR l IN SELECT * FROM jsonb_array_elements(p_data) LOOP
         IF length(trim(coalesce(l->>'hostCourse', ''))) < 2 OR length(trim(coalesce(l->>'homeCode', ''))) < 2 THEN RETURN 'Each line needs the host course and the home course it counts as.'; END IF;
         IF NOT (coalesce((l->>'credits')::numeric, 0) > 0 AND (l->>'credits')::numeric <= 12) THEN RETURN 'Each line needs between 0 and 12 credits.'; END IF;
       END LOOP;
       IF (SELECT count(DISTINCT upper(trim(x->>'hostCourse'))) FROM jsonb_array_elements(p_data) x) <> jsonb_array_length(p_data) THEN RETURN 'A host course appears twice.'; END IF;
     ELSIF p_step = 'approve_agreement' THEN
       IF jsonb_array_length(a.lines) = 0 THEN RETURN 'The student has not proposed a learning agreement yet.'; END IF;
       IF t <> sab_hash(a.lines) THEN RETURN 'The agreement changed since you opened it. Reload and review it again.'; END IF;
     ELSIF p_step = 'confirm_ready' THEN
       FOREACH k IN ARRAY ARRAY['passport_valid','visa_or_not_needed','health_insurance','emergency_contact','predeparture_session','host_registration'] LOOP
         IF coalesce((a.checklist->>k)::boolean, false) IS NOT TRUE THEN RETURN 'Travel readiness is incomplete: ' || replace(k, '_', ' ') || '.'; END IF;
       END LOOP;
     ELSIF p_step = 'reconcile' THEN
       n := jsonb_array_length(a.lines);
       IF jsonb_typeof(p_data) <> 'array' OR jsonb_array_length(p_data) <> n THEN RETURN 'Record a result for every course in the agreement.'; END IF;
       FOR i IN 0 .. n - 1 LOOP
         l := a.lines->i; r := p_data->i;
         IF coalesce((r->>'credits')::numeric, -1) < 0 OR (r->>'credits')::numeric > (l->>'credits')::numeric THEN RETURN 'Line ' || (i + 1) || ': credit granted must be between 0 and the agreed ' || (l->>'credits') || '.'; END IF;
         IF length(trim(coalesce(r->>'grade', ''))) < 1 THEN RETURN 'Line ' || (i + 1) || ': record the host grade (or "W").'; END IF;
       END LOOP;
     END IF;

     UPDATE sab_apps SET state = nxt, version = version + 1, updated_at = now(),
       lines = CASE WHEN p_step = 'propose' THEN p_data ELSE lines END,
       agreement_hash = CASE WHEN p_step = 'propose' THEN NULL WHEN p_step = 'approve_agreement' THEN t ELSE agreement_hash END,
       agreed_by = CASE WHEN p_step = 'propose' THEN NULL WHEN p_step = 'approve_agreement' THEN p_actor ELSE agreed_by END,
       agreement_note = CASE WHEN p_step = 'return_agreement' THEN t WHEN p_step = 'propose' THEN '' ELSE agreement_note END,
       results = CASE WHEN p_step = 'reconcile' THEN p_data ELSE results END,
       reason = CASE WHEN p_step IN ('decline','cancel') THEN t ELSE reason END
       WHERE id = a.id;
     INSERT INTO sab_events (tenant_id, subject, subject_id, step, to_state, actor_id, note)
       VALUES (p_tenant, 'app', a.id, p_step, nxt, p_actor, CASE WHEN p_step = 'approve_agreement' THEN 'agreement ' || left(t, 12) WHEN p_step IN ('propose','reconcile') THEN jsonb_array_length(p_data) || ' lines' ELSE t END);
     RETURN NULL;
   END $$`,
  // The student keeps their own readiness checklist; it can change until departure. Advisors confirm it.
  `CREATE OR REPLACE FUNCTION sab_check(p_tenant text, p_id bigint, p_actor text, p_item text, p_done boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sab_apps;
   BEGIN
     SELECT * INTO a FROM sab_apps WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR a.student_id <> p_actor THEN RETURN 'Only the student keeps this checklist.'; END IF;
     IF a.state NOT IN ('approved','agreed') THEN RETURN 'The checklist is open between approval and confirmed readiness.'; END IF;
     IF p_item NOT IN ('passport_valid','visa_or_not_needed','health_insurance','emergency_contact','predeparture_session','host_registration') THEN RETURN 'Unknown item.'; END IF;
     UPDATE sab_apps SET checklist = checklist || jsonb_build_object(p_item, p_done), updated_at = now() WHERE id = a.id;
     INSERT INTO sab_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'app', a.id, 'checklist', a.state, p_actor, p_item || '=' || p_done);
     RETURN NULL;
   END $$`,
];
