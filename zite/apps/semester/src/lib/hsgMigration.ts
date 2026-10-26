// Migration hsg-001: residence life (mirrors lib/housingRules.ts).
// Enforced here: housing staff and resident assistants are granted by an administrator (never themselves); one live application
// per student per term; idempotent apply; a room never exceeds capacity (room row locked while counting); an offer pins the
// contract terms by hash and acceptance must present that hash; staff never act on their own application; staff steps carry a
// reason; expected-version on every step; append-only history. Maintenance: reporter or staff move a ticket; RAs only read.
export const HSG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS hsg_staff (tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('staff','ra')),
     building text, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id), CHECK (kind = 'staff' OR building IS NOT NULL))`,
  `CREATE OR REPLACE FUNCTION hsg_kind(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT kind FROM hsg_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE TABLE IF NOT EXISTS hsg_rooms (id bigserial PRIMARY KEY, tenant_id text NOT NULL, building text NOT NULL CHECK (length(trim(building)) BETWEEN 1 AND 80),
     room text NOT NULL CHECK (length(trim(room)) BETWEEN 1 AND 40), capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 8),
     active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, building, room))`,
  `CREATE TABLE IF NOT EXISTS hsg_apps (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, student_id text NOT NULL,
     term text NOT NULL CHECK (length(trim(term)) BETWEEN 2 AND 40), preferences text NOT NULL DEFAULT '' CHECK (length(preferences) <= 2000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','offered','accepted','moved_in','moved_out','declined','withdrawn','cancelled')),
     version int NOT NULL DEFAULT 1, room_id bigint REFERENCES hsg_rooms(id), contract_terms text, contract_hash text, offered_by text,
     accepted_at timestamptz, move_in_note text NOT NULL DEFAULT '', move_out_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, student_id, request_key),
     CHECK (state NOT IN ('offered','accepted','moved_in','moved_out') OR (room_id IS NOT NULL AND contract_hash IS NOT NULL)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hsg_apps_one_live ON hsg_apps (tenant_id, student_id, term) WHERE state IN ('submitted','offered','accepted','moved_in')`,
  `CREATE TABLE IF NOT EXISTS hsg_maint (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, room_id bigint NOT NULL REFERENCES hsg_rooms(id),
     reporter_id text NOT NULL, category text NOT NULL CHECK (category IN ('plumbing','electrical','heating_cooling','furniture','pests','lock_or_key','cleaning','other')),
     description text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000), urgent boolean NOT NULL DEFAULT false,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','in_progress','resolved','closed')), version int NOT NULL DEFAULT 1,
     resolution text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, reporter_id, request_key))`,
  `CREATE TABLE IF NOT EXISTS hsg_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('app','maint','room','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION hsg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hsg_events_append_only') THEN
       CREATE TRIGGER hsg_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON hsg_events FOR EACH STATEMENT EXECUTE FUNCTION hsg_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION hsg_set_staff(p_admin text, p_tenant text, p_user text, p_kind text, p_building text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own housing access.'; END IF;
     IF p_kind IS NULL THEN
       UPDATE hsg_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_kind NOT IN ('staff','ra') THEN RETURN 'Unknown housing role.';
     ELSIF p_kind = 'ra' AND length(trim(coalesce(p_building, ''))) = 0 THEN RETURN 'A resident assistant needs a building.';
     ELSE
       INSERT INTO hsg_staff (tenant_id, user_id, kind, building, granted_by) VALUES (p_tenant, p_user, p_kind, NULLIF(trim(coalesce(p_building, '')), ''), p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, building = EXCLUDED.building, revoked_at = NULL, granted_by = p_admin, granted_at = now();
     END IF;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'staff', 0, 'set_staff', coalesce(p_kind, 'revoked'), p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hsg_room(p_tenant text, p_actor text, p_building text, p_room text, p_capacity int, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r hsg_rooms; held int;
   BEGIN
     IF hsg_kind(p_tenant, p_actor) IS DISTINCT FROM 'staff' THEN RETURN 'Only housing staff manage rooms.'; END IF;
     SELECT * INTO r FROM hsg_rooms WHERE tenant_id = p_tenant AND building = trim(p_building) AND room = trim(p_room) FOR UPDATE;
     IF FOUND THEN
       SELECT count(*) INTO held FROM hsg_apps WHERE room_id = r.id AND state IN ('offered','accepted','moved_in');
       IF p_capacity < held THEN RETURN 'That room already holds ' || held || ' residents; capacity cannot go below that.'; END IF;
       UPDATE hsg_rooms SET capacity = p_capacity, active = p_active WHERE id = r.id;
     ELSE
       INSERT INTO hsg_rooms (tenant_id, building, room, capacity, active) VALUES (p_tenant, trim(p_building), trim(p_room), p_capacity, p_active) RETURNING * INTO r;
     END IF;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'room', r.id, 'room', CASE WHEN p_active THEN 'active' ELSE 'inactive' END, p_actor, 'capacity ' || p_capacity);
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION hsg_apply(p_tenant text, p_key text, p_student text, p_term text, p_prefs text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a hsg_apps; nid bigint;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('hsg:' || p_tenant || ':' || p_student));
     SELECT * INTO a FROM hsg_apps WHERE tenant_id = p_tenant AND student_id = p_student AND request_key = p_key;
     IF FOUND THEN
       IF a.term = trim(p_term) AND a.preferences = coalesce(p_prefs, '') THEN RETURN 'replay:' || a.id; END IF;
       RETURN 'This application was already sent with different details.';
     END IF;
     IF EXISTS (SELECT 1 FROM hsg_apps WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) AND state IN ('submitted','offered','accepted','moved_in'))
       THEN RETURN 'You already have a live housing application for this term.'; END IF;
     INSERT INTO hsg_apps (tenant_id, request_key, student_id, term, preferences) VALUES (p_tenant, p_key, p_student, trim(p_term), coalesce(p_prefs, '')) RETURNING id INTO nid;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'app', nid, 'apply', 'submitted', p_student);
     RETURN 'ok:' || nid;
   END $$`,
  // p_text: offer -> contract terms; cancel/move_in/move_out -> reason or condition note; accept -> the contract hash shown.
  `CREATE OR REPLACE FUNCTION hsg_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_text text, p_room bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a hsg_apps; r hsg_rooms; actor text; nxt text; held int; t text := trim(coalesce(p_text, ''));
   BEGIN
     SELECT * INTO a FROM hsg_apps WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     actor := CASE WHEN p_actor = a.student_id THEN 'student' WHEN hsg_kind(p_tenant, p_actor) = 'staff' THEN 'staff' ELSE NULL END;
     IF actor IS NULL THEN RETURN 'You cannot act on this application.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This application changed since you opened it. Reload.'; END IF;
     IF actor = 'student' AND p_step IN ('offer','cancel','move_in','move_out') THEN
       IF hsg_kind(p_tenant, p_actor) = 'staff' THEN RETURN 'Ask another housing staff member to act on your own application.'; END IF;
     END IF;
     nxt := CASE
       WHEN p_step = 'offer' AND actor = 'staff' AND a.state IN ('submitted','declined') THEN 'offered'
       WHEN p_step = 'accept' AND actor = 'student' AND a.state = 'offered' THEN 'accepted'
       WHEN p_step = 'decline' AND actor = 'student' AND a.state = 'offered' THEN 'declined'
       WHEN p_step = 'withdraw' AND actor = 'student' AND a.state IN ('submitted','offered','accepted') THEN 'withdrawn'
       WHEN p_step = 'cancel' AND actor = 'staff' AND a.state IN ('submitted','offered','accepted') THEN 'cancelled'
       WHEN p_step = 'move_in' AND actor = 'staff' AND a.state = 'accepted' THEN 'moved_in'
       WHEN p_step = 'move_out' AND actor = 'staff' AND a.state = 'moved_in' THEN 'moved_out'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step IN ('cancel','move_in','move_out') AND length(t) < 5 THEN RETURN 'Give a reason or condition note (5+ characters).'; END IF;
     IF p_step = 'offer' THEN
       IF length(t) < 40 THEN RETURN 'Write the contract terms the student will accept (40+ characters).'; END IF;
       SELECT * INTO r FROM hsg_rooms WHERE id = p_room AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND OR NOT r.active THEN RETURN 'That room is not available for assignment.'; END IF;
       SELECT count(*) INTO held FROM hsg_apps WHERE room_id = r.id AND state IN ('offered','accepted','moved_in') AND id <> a.id;
       IF held >= r.capacity THEN RETURN 'That room is full.'; END IF;
       UPDATE hsg_apps SET state = nxt, room_id = r.id, contract_terms = t, contract_hash = encode(sha256(convert_to(t, 'UTF8')), 'hex'), offered_by = p_actor,
         version = version + 1, updated_at = now() WHERE id = a.id;
     ELSIF p_step = 'accept' THEN
       IF t <> a.contract_hash THEN RETURN 'The contract changed since you opened it. Reload and read it again.'; END IF;
       UPDATE hsg_apps SET state = nxt, accepted_at = now(), version = version + 1, updated_at = now() WHERE id = a.id;
     ELSE
       UPDATE hsg_apps SET state = nxt, version = version + 1, updated_at = now(),
         move_in_note = CASE WHEN p_step = 'move_in' THEN t ELSE move_in_note END,
         move_out_note = CASE WHEN p_step = 'move_out' THEN t ELSE move_out_note END WHERE id = a.id;
     END IF;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id, note)
       VALUES (p_tenant, 'app', a.id, p_step, nxt, p_actor, CASE WHEN p_step = 'accept' THEN 'terms ' || left(t, 12) WHEN p_step = 'offer' THEN 'room ' || p_room ELSE t END);
     RETURN NULL;
   END $$`,
  // A student reports for the room they hold; staff may report for any room. Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION hsg_report(p_tenant text, p_key text, p_actor text, p_room bigint, p_category text, p_desc text, p_urgent boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m hsg_maint; nid bigint;
   BEGIN
     IF length(trim(coalesce(p_desc, ''))) < 10 THEN RETURN 'Describe the problem (10+ characters).'; END IF;
     IF NOT EXISTS (SELECT 1 FROM hsg_rooms WHERE id = p_room AND tenant_id = p_tenant) THEN RETURN 'Room not found.'; END IF;
     IF hsg_kind(p_tenant, p_actor) IS DISTINCT FROM 'staff' AND NOT EXISTS
       (SELECT 1 FROM hsg_apps WHERE tenant_id = p_tenant AND student_id = p_actor AND room_id = p_room AND state IN ('accepted','moved_in'))
       THEN RETURN 'You can report problems only for the room you live in.'; END IF;
     SELECT * INTO m FROM hsg_maint WHERE tenant_id = p_tenant AND reporter_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF m.room_id = p_room AND m.category = p_category AND m.description = trim(p_desc) THEN RETURN 'replay:' || m.id; END IF;
       RETURN 'This request was already sent with different details.';
     END IF;
     INSERT INTO hsg_maint (tenant_id, request_key, room_id, reporter_id, category, description, urgent)
       VALUES (p_tenant, p_key, p_room, p_actor, p_category, trim(p_desc), coalesce(p_urgent, false)) RETURNING id INTO nid;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'maint', nid, 'report', 'open', p_actor);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION hsg_maint_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m hsg_maint; actor text; nxt text; t text := trim(coalesce(p_text, ''));
   BEGIN
     SELECT * INTO m FROM hsg_maint WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     actor := CASE WHEN hsg_kind(p_tenant, p_actor) = 'staff' THEN 'staff' WHEN p_actor = m.reporter_id THEN 'reporter' ELSE NULL END;
     IF actor IS NULL THEN RETURN 'You cannot change this request.'; END IF;
     IF m.version <> p_expected THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     nxt := CASE
       WHEN p_step = 'start' AND actor = 'staff' AND m.state = 'open' THEN 'in_progress'
       WHEN p_step = 'resolve' AND actor = 'staff' AND m.state IN ('open','in_progress') THEN 'resolved'
       WHEN p_step = 'reopen' AND p_actor = m.reporter_id AND m.state = 'resolved' THEN 'open'
       WHEN p_step = 'close' AND m.state = 'resolved' THEN 'closed'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step IN ('resolve','reopen') AND length(t) < 5 THEN RETURN 'Say what was done or what is still wrong (5+ characters).'; END IF;
     UPDATE hsg_maint SET state = nxt, version = version + 1, updated_at = now(), resolution = CASE WHEN p_step = 'resolve' THEN t ELSE resolution END WHERE id = m.id;
     INSERT INTO hsg_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'maint', m.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
];
