// Migration wl-001: waitlists, and registrar-decided drop and swap on the registrar ledger (migrations/001 reg_* tables).
// Invariants enforced here, not in TypeScript: one active waitlist entry per student and section; a swap is all or nothing
// (the old seat is kept unless the new seat is granted); capacity is checked under row locks taken in section-id order;
// a freed seat goes to the earliest waiting student in the same transaction; every decision writes command, receipt,
// audit and outbox rows. Seats are the current-state table; history lives in reg_audit and reg_changes.
export const WL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS reg_waitlist (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, student_id text NOT NULL,
     joined_at timestamptz NOT NULL DEFAULT clock_timestamp(), state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','promoted','left','removed')),
     ended_at timestamptz, CHECK ((state = 'waiting') = (ended_at IS NULL)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reg_waitlist_active ON reg_waitlist (tenant_id, section_id, student_id) WHERE state = 'waiting'`,
  `CREATE TABLE IF NOT EXISTS reg_changes (id bigserial PRIMARY KEY, tenant_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('drop','swap')),
     student_id text NOT NULL, from_section text NOT NULL, to_section text, state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','committed','rejected','withdrawn')),
     reason text NOT NULL DEFAULT '', result_code text, message text, decided_by text, decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK ((kind = 'swap') = (to_section IS NOT NULL)), CHECK (to_section IS NULL OR to_section <> from_section),
     CHECK (decided_by IS NULL OR decided_by <> student_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reg_changes_open ON reg_changes (tenant_id, student_id, from_section) WHERE state = 'requested'`,
  `CREATE OR REPLACE FUNCTION reg_wl_join(p_tenant text, p_section text, p_student text, p_capacity int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     INSERT INTO reg_section_locks (tenant_id, section_id, capacity) VALUES (p_tenant, p_section, p_capacity) ON CONFLICT (tenant_id, section_id) DO UPDATE SET capacity = EXCLUDED.capacity;
     PERFORM 1 FROM reg_section_locks WHERE tenant_id = p_tenant AND section_id = p_section FOR UPDATE;
     IF EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section AND student_id = p_student) THEN RETURN 'You already hold a seat in this section.'; END IF;
     IF EXISTS (SELECT 1 FROM reg_waitlist WHERE tenant_id = p_tenant AND section_id = p_section AND student_id = p_student AND state = 'waiting') THEN RETURN 'You are already on this waitlist.'; END IF;
     IF p_capacity IS NULL OR (SELECT count(*) FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section) < p_capacity THEN RETURN 'This section still has seats. Submit a registration request instead.'; END IF;
     INSERT INTO reg_waitlist (tenant_id, section_id, student_id) VALUES (p_tenant, p_section, p_student);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION reg_wl_leave(p_tenant text, p_section text, p_student text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE reg_waitlist SET state = 'left', ended_at = now() WHERE tenant_id = p_tenant AND section_id = p_section AND student_id = p_student AND state = 'waiting';
     IF NOT FOUND THEN RETURN 'You are not on this waitlist.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION reg_change_request(p_tenant text, p_student text, p_kind text, p_from text, p_to text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_from AND student_id = p_student) THEN RETURN 'That seat is not in the registrar ledger. Ask the registrar.'; END IF;
     IF p_kind = 'swap' AND EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_to AND student_id = p_student) THEN RETURN 'You already hold a seat in the section you are swapping into.'; END IF;
     IF EXISTS (SELECT 1 FROM reg_changes WHERE tenant_id = p_tenant AND student_id = p_student AND from_section = p_from AND state = 'requested') THEN RETURN 'A change for this seat is already waiting for the registrar.'; END IF;
     INSERT INTO reg_changes (tenant_id, kind, student_id, from_section, to_section, reason) VALUES (p_tenant, p_kind, p_student, p_from, CASE WHEN p_kind = 'swap' THEN p_to END, trim(coalesce(p_reason, '')));
     RETURN NULL;
   END $$`,
  // Gives freed seats in one section to waiting students, earliest first. Caller holds the section lock.
  `CREATE OR REPLACE FUNCTION reg_wl_promote(p_tenant text, p_section text, p_capacity int, p_actor text, p_cause text) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE w reg_waitlist%ROWTYPE; out jsonb := '[]'::jsonb; k text;
   BEGIN
     LOOP
       EXIT WHEN p_capacity IS NOT NULL AND (SELECT count(*) FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section) >= p_capacity;
       SELECT * INTO w FROM reg_waitlist WHERE tenant_id = p_tenant AND section_id = p_section AND state = 'waiting' ORDER BY joined_at, id LIMIT 1 FOR UPDATE;
       EXIT WHEN NOT FOUND;
       k := 'promote:' || w.id;
       INSERT INTO reg_commands (tenant_id, command_key, payload_hash, kind, actor_id) VALUES (p_tenant, k, md5(k), 'registrar.promote', p_actor);
       INSERT INTO reg_seats (tenant_id, section_id, student_id, request_id, command_key) VALUES (p_tenant, p_section, w.student_id, k, k);
       INSERT INTO reg_receipts (tenant_id, command_key, state, result_code, message) VALUES (p_tenant, k, 'Committed', 'WAITLIST_PROMOTED', 'A seat opened and was given to the next student on the waitlist.');
       INSERT INTO reg_audit (tenant_id, command_key, actor_id, action, detail) VALUES (p_tenant, k, p_actor, 'Waitlist promotion', p_cause);
       INSERT INTO reg_outbox (tenant_id, command_key, topic, payload) VALUES (p_tenant, k, 'reg.seat', jsonb_build_object('student', w.student_id, 'section', p_section, 'state', 'Enrolled'));
       UPDATE reg_waitlist SET state = 'promoted', ended_at = now() WHERE id = w.id;
       out := out || jsonb_build_object('student', w.student_id, 'section', p_section);
     END LOOP;
     RETURN out;
   END $$`,
  `CREATE OR REPLACE FUNCTION reg_change_decide(p_tenant text, p_id bigint, p_actor text, p_approve boolean, p_note text, p_cap_from int, p_cap_to int) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE c reg_changes%ROWTYPE; k text; v_state text; v_code text; v_msg text; promoted jsonb := '[]'::jsonb; s text;
   BEGIN
     SELECT * INTO c FROM reg_changes WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Change request not found.'); END IF;
     IF c.state <> 'requested' THEN RETURN jsonb_build_object('error', 'Already decided.'); END IF;
     IF c.student_id = p_actor THEN RETURN jsonb_build_object('error', 'You cannot decide your own change.'); END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN jsonb_build_object('error', 'Say why it is declined.'); END IF;
     k := 'change:' || c.id;
     INSERT INTO reg_commands (tenant_id, command_key, payload_hash, kind, actor_id) VALUES (p_tenant, k, md5(k || p_approve::text), 'registrar.' || c.kind, p_actor);
     -- Lock every section touched, in a fixed order, before reading counts.
     FOR s IN SELECT x FROM unnest(ARRAY[c.from_section, c.to_section]) AS x WHERE x IS NOT NULL ORDER BY x LOOP
       INSERT INTO reg_section_locks (tenant_id, section_id, capacity) VALUES (p_tenant, s, CASE WHEN s = c.from_section THEN p_cap_from ELSE p_cap_to END)
         ON CONFLICT (tenant_id, section_id) DO UPDATE SET capacity = EXCLUDED.capacity;
       PERFORM 1 FROM reg_section_locks WHERE tenant_id = p_tenant AND section_id = s FOR UPDATE;
     END LOOP;
     IF NOT p_approve THEN v_state := 'rejected'; v_code := 'REJECTED_BY_REGISTRAR'; v_msg := trim(p_note);
     ELSIF NOT EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = c.from_section AND student_id = c.student_id) THEN
       v_state := 'rejected'; v_code := 'NO_SEAT'; v_msg := 'The student no longer holds that seat.';
     ELSIF c.kind = 'swap' AND EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = c.to_section AND student_id = c.student_id) THEN
       v_state := 'rejected'; v_code := 'ALREADY_ENROLLED'; v_msg := 'The student already holds a seat in the new section.';
     ELSIF c.kind = 'swap' AND p_cap_to IS NOT NULL AND (SELECT count(*) FROM reg_seats WHERE tenant_id = p_tenant AND section_id = c.to_section) >= p_cap_to THEN
       v_state := 'rejected'; v_code := 'SECTION_FULL'; v_msg := 'The new section is full. The original seat was kept.';
     ELSE
       DELETE FROM reg_seats WHERE tenant_id = p_tenant AND section_id = c.from_section AND student_id = c.student_id;
       IF c.kind = 'swap' THEN
         INSERT INTO reg_seats (tenant_id, section_id, student_id, request_id, command_key) VALUES (p_tenant, c.to_section, c.student_id, k, k);
         UPDATE reg_waitlist SET state = 'removed', ended_at = now() WHERE tenant_id = p_tenant AND section_id = c.to_section AND student_id = c.student_id AND state = 'waiting';
       END IF;
       v_state := 'committed'; v_code := 'OK'; v_msg := CASE WHEN c.kind = 'swap' THEN 'Swap confirmed by the Registrar.' ELSE 'Drop confirmed by the Registrar.' END;
       promoted := reg_wl_promote(p_tenant, c.from_section, p_cap_from, p_actor, k);
     END IF;
     UPDATE reg_changes SET state = v_state, result_code = v_code, message = v_msg, decided_by = p_actor, decided_at = now() WHERE id = c.id;
     INSERT INTO reg_receipts (tenant_id, command_key, state, result_code, message) VALUES (p_tenant, k, initcap(v_state), v_code, v_msg);
     INSERT INTO reg_audit (tenant_id, command_key, actor_id, action, detail) VALUES (p_tenant, k, p_actor, initcap(c.kind) || ' ' || v_state, v_code || coalesce(' · ' || nullif(trim(p_note), ''), ''));
     IF v_state = 'committed' THEN
       INSERT INTO reg_outbox (tenant_id, command_key, topic, payload) VALUES (p_tenant, k, 'reg.seat', jsonb_build_object('student', c.student_id, 'drop', c.from_section, 'add', c.to_section));
     END IF;
     RETURN jsonb_build_object('state', v_state, 'resultCode', v_code, 'message', v_msg, 'promoted', promoted, 'student', c.student_id, 'from', c.from_section, 'to', c.to_section);
   END $$`,
  // Registrar audit and receipts are append-only (statement triggers). Created once, never dropped by later bootstraps.
  `CREATE OR REPLACE FUNCTION reg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'reg_audit_append_only') THEN
       CREATE TRIGGER reg_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON reg_audit FOR EACH STATEMENT EXECUTE FUNCTION reg_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'reg_receipts_append_only') THEN
       CREATE TRIGGER reg_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON reg_receipts FOR EACH STATEMENT EXECUTE FUNCTION reg_refuse_change();
     END IF;
   END $$`,
];
