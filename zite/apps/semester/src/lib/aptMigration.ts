// Migration apt-001: office hours and appointments booked atomically (S-55 §6 "office hours"; D14/D15; MOD-042).
// apt_slots/apt_bookings hold host-created slots with capacity. apt_claims makes booking the older single-person Zite
// "Appointments" slots atomic (first insert wins) until those rows are moved here (C22).
// Enforced here: slot in tenant, not cancelled, not started, capacity under row lock, host cannot book own slot,
// one live booking per student per slot, no overlapping bookings for a student (per-student lock), no overlapping slots
// for a host (per-host lock), cancel only before start, attendance only by the host after start, append-only events.
export const APT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS apt_slots (id bigserial PRIMARY KEY, tenant_id text NOT NULL, host_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('Office hours','Advising','Tutoring')), section_id text, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
     capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 50), location text NOT NULL CHECK (length(trim(location)) BETWEEN 2 AND 200),
     cancelled_at timestamptz, cancel_reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '4 hours'), CHECK ((kind = 'Office hours') = (section_id IS NOT NULL)))`,
  `CREATE INDEX IF NOT EXISTS apt_slots_tenant_start ON apt_slots (tenant_id, starts_at)`,
  `CREATE TABLE IF NOT EXISTS apt_bookings (id bigserial PRIMARY KEY, tenant_id text NOT NULL, slot_id bigint NOT NULL REFERENCES apt_slots(id), student_id text NOT NULL,
     state text NOT NULL DEFAULT 'booked' CHECK (state IN ('booked','cancelled','attended','no_show')), topic text NOT NULL DEFAULT '',
     follow_up text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS apt_bookings_live ON apt_bookings (slot_id, student_id) WHERE state <> 'cancelled'`,
  `CREATE TABLE IF NOT EXISTS apt_claims (appointment_id text PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS apt_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, slot_id bigint, booking_id bigint, step text NOT NULL,
     actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION apt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apt_events_append_only') THEN
       CREATE TRIGGER apt_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON apt_events FOR EACH STATEMENT EXECUTE FUNCTION apt_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION apt_create(p_tenant text, p_host text, p_kind text, p_section text, p_starts timestamptz[], p_ends timestamptz[], p_cap int, p_loc text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i int; nid bigint;
   BEGIN
     IF array_length(p_starts, 1) IS NULL OR array_length(p_starts, 1) <> array_length(p_ends, 1) THEN RETURN 'No times given.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('apt:host:' || p_tenant || ':' || p_host));
     FOR i IN 1 .. array_length(p_starts, 1) LOOP
       IF p_starts[i] <= now() THEN RETURN 'Office hours must start in the future.'; END IF;
       IF EXISTS (SELECT 1 FROM apt_slots WHERE tenant_id = p_tenant AND host_id = p_host AND cancelled_at IS NULL AND starts_at < p_ends[i] AND p_starts[i] < ends_at)
         THEN RETURN 'You already have a slot at ' || to_char(p_starts[i] AT TIME ZONE 'UTC', 'Dy DD Mon HH24:MI') || ' UTC.'; END IF;
       INSERT INTO apt_slots (tenant_id, host_id, kind, section_id, starts_at, ends_at, capacity, location) VALUES (p_tenant, p_host, p_kind, p_section, p_starts[i], p_ends[i], p_cap, trim(p_loc)) RETURNING id INTO nid;
       INSERT INTO apt_events (tenant_id, slot_id, step, actor_id) VALUES (p_tenant, nid, 'slot_created', p_host);
     END LOOP;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION apt_book(p_tenant text, p_slot bigint, p_student text, p_topic text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s apt_slots; n int; nid bigint;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('apt:student:' || p_tenant || ':' || p_student));
     SELECT * INTO s FROM apt_slots WHERE id = p_slot AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'That slot is not offered at your institution.'; END IF;
     IF s.cancelled_at IS NOT NULL THEN RETURN 'That slot was cancelled.'; END IF;
     IF s.starts_at <= now() THEN RETURN 'That slot has already started.'; END IF;
     IF s.host_id = p_student THEN RETURN 'You cannot book your own slot.'; END IF;
     IF EXISTS (SELECT 1 FROM apt_bookings WHERE slot_id = p_slot AND student_id = p_student AND state <> 'cancelled') THEN RETURN 'You already booked this slot.'; END IF;
     SELECT count(*) INTO n FROM apt_bookings WHERE slot_id = p_slot AND state <> 'cancelled';
     IF n >= s.capacity THEN RETURN 'That slot is full. Pick another.'; END IF;
     IF EXISTS (SELECT 1 FROM apt_bookings b JOIN apt_slots o ON o.id = b.slot_id WHERE b.tenant_id = p_tenant AND b.student_id = p_student AND b.state = 'booked'
       AND o.cancelled_at IS NULL AND o.starts_at < s.ends_at AND s.starts_at < o.ends_at) THEN RETURN 'You already have an appointment at that time.'; END IF;
     INSERT INTO apt_bookings (tenant_id, slot_id, student_id, topic) VALUES (p_tenant, p_slot, p_student, left(coalesce(p_topic,''), 500)) RETURNING id INTO nid;
     INSERT INTO apt_events (tenant_id, slot_id, booking_id, step, actor_id) VALUES (p_tenant, p_slot, nid, 'booked', p_student);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION apt_cancel(p_tenant text, p_booking bigint, p_student text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b apt_bookings; s apt_slots;
   BEGIN
     SELECT * INTO b FROM apt_bookings WHERE id = p_booking AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR b.student_id <> p_student THEN RETURN 'That booking is not yours.'; END IF;
     IF b.state <> 'booked' THEN RETURN 'That booking is no longer active.'; END IF;
     SELECT * INTO s FROM apt_slots WHERE id = b.slot_id;
     IF s.starts_at <= now() THEN RETURN 'It has already started. Ask your host instead.'; END IF;
     UPDATE apt_bookings SET state = 'cancelled', updated_at = now() WHERE id = b.id;
     INSERT INTO apt_events (tenant_id, slot_id, booking_id, step, actor_id) VALUES (p_tenant, b.slot_id, b.id, 'cancelled_by_student', p_student);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION apt_cancel_slot(p_tenant text, p_slot bigint, p_host text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s apt_slots;
   BEGIN
     SELECT * INTO s FROM apt_slots WHERE id = p_slot AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR s.host_id <> p_host THEN RETURN 'Only the host can cancel this slot.'; END IF;
     IF s.cancelled_at IS NOT NULL THEN RETURN 'Already cancelled.'; END IF;
     IF s.ends_at <= now() THEN RETURN 'That slot is already over.'; END IF;
     IF length(trim(coalesce(p_reason,''))) < 3 THEN RETURN 'Say why, so students know what to do.'; END IF;
     UPDATE apt_slots SET cancelled_at = now(), cancel_reason = left(trim(p_reason), 500) WHERE id = s.id;
     UPDATE apt_bookings SET state = 'cancelled', updated_at = now() WHERE slot_id = s.id AND state = 'booked';
     INSERT INTO apt_events (tenant_id, slot_id, step, actor_id, note) VALUES (p_tenant, s.id, 'slot_cancelled', p_host, left(trim(p_reason), 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION apt_mark(p_tenant text, p_booking bigint, p_host text, p_state text, p_follow text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b apt_bookings; s apt_slots;
   BEGIN
     IF p_state NOT IN ('attended','no_show') THEN RETURN 'Record attended or no-show.'; END IF;
     SELECT * INTO b FROM apt_bookings WHERE id = p_booking AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Booking not found.'; END IF;
     SELECT * INTO s FROM apt_slots WHERE id = b.slot_id;
     IF s.host_id <> p_host THEN RETURN 'Only the host can record attendance.'; END IF;
     IF b.state = 'cancelled' THEN RETURN 'That booking was cancelled.'; END IF;
     IF s.starts_at > now() THEN RETURN 'You can record attendance once it has started.'; END IF;
     UPDATE apt_bookings SET state = p_state, follow_up = left(coalesce(p_follow, ''), 2000), updated_at = now() WHERE id = b.id;
     INSERT INTO apt_events (tenant_id, slot_id, booking_id, step, actor_id, note) VALUES (p_tenant, s.id, b.id, p_state, p_host, CASE WHEN coalesce(p_follow,'') <> '' THEN 'follow-up written' ELSE '' END);
     RETURN NULL;
   END $$`,
];
