// Migration sreq-001: Semester Institution — departments, rooms and new-section requests (S-55 §10; D07; Department Chair
// "teaching assignments"/"demand", Department Admin "department requests"/"rooms"). The canonical section stays a Zite
// Sections record; these tables hold the request, its decisions and an append-only history.
// The database enforces: one state machine (mirrors lib/sectionRequestRules.nextState), the chair is not the requester,
// the registrar is neither the requester nor the chair who approved, expected-version checks, idempotent submit, and
// room/instructor clashes re-checked under a per-term lock at authorization.
export const SREQ_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS inst_departments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
     chair_id text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inst_departments_name ON inst_departments (tenant_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS inst_rooms (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
     capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 2000), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inst_rooms_name ON inst_rooms (tenant_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS sec_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, fingerprint text NOT NULL,
     requester_id text NOT NULL, department_id bigint NOT NULL REFERENCES inst_departments(id), course_id text NOT NULL, course_code text NOT NULL,
     term_id text NOT NULL, term_code text NOT NULL, section_code text NOT NULL, capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 500),
     meeting_times text NOT NULL, meet_days text[] NOT NULL, start_min int NOT NULL, end_min int NOT NULL CHECK (end_min > start_min),
     room_id bigint NOT NULL REFERENCES inst_rooms(id), instructor_id text NOT NULL, reason text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','chair_approved','authorized','creating','created','reconciled','rejected','withdrawn')),
     version int NOT NULL DEFAULT 1, chair_decider text, registrar_decider text, section_id text, last_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, requester_id, request_key))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sec_requests_live ON sec_requests (tenant_id, course_id, term_id, section_code) WHERE state NOT IN ('rejected','withdrawn')`,
  `CREATE TABLE IF NOT EXISTS sec_request_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id bigint NOT NULL REFERENCES sec_requests(id),
     step text NOT NULL, from_state text, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION sreq_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sec_request_events_append_only') THEN
       CREATE TRIGGER sec_request_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sec_request_events FOR EACH STATEMENT EXECUTE FUNCTION sreq_refuse_change();
     END IF;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal message.
  `CREATE OR REPLACE FUNCTION sreq_submit(p_tenant text, p_actor text, p_key text, p_fp text, p_dept bigint, p_course text, p_course_code text, p_term text, p_term_code text,
       p_code text, p_cap int, p_times text, p_days text[], p_start int, p_end int, p_room bigint, p_instructor text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r sec_requests; nid bigint;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('sreq:key:' || p_tenant || ':' || p_actor || ':' || p_key));
     SELECT * INTO r FROM sec_requests WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF r.fingerprint = p_fp THEN RETURN 'replay:' || r.id; END IF;
       RETURN 'This request was already sent with different details. Start a new request instead.';
     END IF;
     IF NOT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant AND active) THEN RETURN 'Choose an active department.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM inst_rooms WHERE id = p_room AND tenant_id = p_tenant AND active AND capacity >= p_cap) THEN RETURN 'Choose an active room large enough for the section.'; END IF;
     IF EXISTS (SELECT 1 FROM sec_requests WHERE tenant_id = p_tenant AND course_id = p_course AND term_id = p_term AND section_code = p_code AND state NOT IN ('rejected','withdrawn'))
       THEN RETURN 'A request for this course, term and section code is already open.'; END IF;
     INSERT INTO sec_requests (tenant_id, request_key, fingerprint, requester_id, department_id, course_id, course_code, term_id, term_code, section_code, capacity,
       meeting_times, meet_days, start_min, end_min, room_id, instructor_id, reason)
       VALUES (p_tenant, p_key, p_fp, p_actor, p_dept, p_course, p_course_code, p_term, p_term_code, p_code, p_cap, p_times, p_days, p_start, p_end, p_room, p_instructor, left(coalesce(p_reason,''), 1000))
       RETURNING id INTO nid;
     INSERT INTO sec_request_events (tenant_id, request_id, step, from_state, to_state, actor_id, note) VALUES (p_tenant, nid, 'submit', NULL, 'submitted', p_actor, '');
     RETURN 'ok:' || nid;
   END $$`,
  // One step of the workflow. Returns NULL when done, or a refusal message. p_extra carries outside clashes found by the app.
  `CREATE OR REPLACE FUNCTION sreq_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_approve boolean, p_expected int, p_note text, p_section text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r sec_requests; nxt text; chair text; n int;
   BEGIN
     SELECT * INTO r FROM sec_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'Someone else changed this request. Reload and try again.'; END IF;
     nxt := CASE
       WHEN p_step = 'withdraw' AND r.state = 'submitted' THEN 'withdrawn'
       WHEN p_step = 'chair' AND r.state = 'submitted' THEN CASE WHEN p_approve THEN 'chair_approved' ELSE 'rejected' END
       WHEN p_step = 'registrar' AND r.state = 'chair_approved' THEN CASE WHEN p_approve THEN 'authorized' ELSE 'rejected' END
       WHEN p_step = 'begin_create' AND r.state = 'authorized' THEN 'creating'
       WHEN p_step = 'created' AND r.state = 'creating' THEN 'created'
       WHEN p_step = 'create_failed' AND r.state = 'creating' THEN 'authorized'
       WHEN p_step = 'reconciled' AND r.state = 'created' THEN 'reconciled'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'This request is ' || replace(r.state, '_', ' ') || '; that step is not possible now.'; END IF;
     IF p_step = 'withdraw' AND p_actor <> r.requester_id THEN RETURN 'Only the person who asked can withdraw it.'; END IF;
     IF p_step = 'chair' THEN
       SELECT chair_id INTO chair FROM inst_departments WHERE id = r.department_id;
       IF chair IS DISTINCT FROM p_actor THEN RETURN 'Only the department chair can review this request.'; END IF;
       IF p_actor = r.requester_id THEN RETURN 'You asked for this section, so another person must review it.'; END IF;
     END IF;
     IF p_step = 'registrar' THEN
       IF p_actor = r.requester_id OR p_actor = r.chair_decider THEN RETURN 'The registrar decision must come from someone other than the requester and the chair.'; END IF;
       IF p_approve THEN
         PERFORM pg_advisory_xact_lock(hashtext('sreq:term:' || p_tenant || ':' || r.term_id));
         SELECT count(*) INTO n FROM sec_requests o WHERE o.tenant_id = p_tenant AND o.term_id = r.term_id AND o.id <> r.id
           AND o.state IN ('authorized','creating','created','reconciled') AND o.meet_days && r.meet_days AND o.start_min < r.end_min AND r.start_min < o.end_min
           AND (o.room_id = r.room_id OR o.instructor_id = r.instructor_id);
         IF n > 0 THEN RETURN 'Another authorized section already uses this room or instructor at that time.'; END IF;
         IF NOT EXISTS (SELECT 1 FROM inst_rooms WHERE id = r.room_id AND active AND capacity >= r.capacity) THEN RETURN 'The room is no longer available for this size.'; END IF;
       END IF;
     END IF;
     IF p_step = 'created' AND coalesce(p_section, '') = '' THEN RETURN 'A created section needs its id.'; END IF;
     UPDATE sec_requests SET state = nxt, version = version + 1, updated_at = now(), last_note = left(coalesce(p_note,''), 1000),
       chair_decider = CASE WHEN p_step = 'chair' THEN p_actor ELSE chair_decider END,
       registrar_decider = CASE WHEN p_step = 'registrar' THEN p_actor ELSE registrar_decider END,
       section_id = CASE WHEN p_step = 'created' THEN p_section ELSE section_id END
       WHERE id = r.id;
     INSERT INTO sec_request_events (tenant_id, request_id, step, from_state, to_state, actor_id, note) VALUES (p_tenant, r.id, p_step, r.state, nxt, p_actor, left(coalesce(p_note,''), 1000));
     RETURN NULL;
   END $$`,
];
