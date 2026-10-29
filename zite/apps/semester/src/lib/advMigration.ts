// Admissions visits: institutions publish visit slots (tours, information sessions, interviews);
// prospective students book seats through the Applicants portal. Admissions staff (adv_staff,
// granted by administrators) create and close slots. Capacity counts guests across live bookings;
// one live booking per person per slot (partial unique index behind the function's friendly check).
export const ADV_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS adv_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS adv_slots (id bigserial PRIMARY KEY, tenant_id text NOT NULL, starts_at timestamptz NOT NULL,
     kind text NOT NULL CHECK (kind IN ('tour','info_session','interview')), capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 500),
     location text NOT NULL DEFAULT '' CHECK (length(location) <= 120), note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')), created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS adv_bookings (id bigserial PRIMARY KEY, slot_id bigint NOT NULL REFERENCES adv_slots(id), user_id text NOT NULL,
     guests int NOT NULL DEFAULT 1 CHECK (guests BETWEEN 1 AND 6), state text NOT NULL DEFAULT 'booked' CHECK (state IN ('booked','cancelled')),
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS adv_bookings_live_uq ON adv_bookings (slot_id, user_id) WHERE state = 'booked'`,
  `CREATE OR REPLACE FUNCTION adv_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM adv_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION adv_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own admissions access.'; END IF;
     IF p_on THEN INSERT INTO adv_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE adv_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION adv_create_slot(p_actor text, p_tenant text, p_starts timestamptz, p_kind text, p_capacity int, p_location text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT adv_is_staff(p_tenant, p_actor) THEN RETURN 'Only admissions staff publish visit slots.'; END IF;
     IF p_starts <= now() THEN RETURN 'Visit slots are published in the future.'; END IF;
     INSERT INTO adv_slots (tenant_id, starts_at, kind, capacity, location, note, created_by)
       VALUES (p_tenant, p_starts, p_kind, p_capacity, left(coalesce(p_location, ''), 120), left(coalesce(p_note, ''), 300), p_actor) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION adv_close_slot(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT adv_is_staff(p_tenant, p_actor) THEN RETURN 'Only admissions staff manage visit slots.'; END IF;
     SELECT state INTO st FROM adv_slots WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Slot not found.'; END IF;
     IF st <> 'open' THEN RETURN 'That slot is already closed.'; END IF;
     UPDATE adv_slots SET state = 'closed' WHERE id = p_id;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION adv_book(p_actor text, p_slot bigint, p_guests int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s adv_slots; taken int;
   BEGIN
     SELECT * INTO s FROM adv_slots WHERE id = p_slot FOR UPDATE;
     IF NOT FOUND THEN RETURN 'That visit slot no longer exists.'; END IF;
     IF s.state <> 'open' THEN RETURN 'That visit is closed to bookings.'; END IF;
     IF s.starts_at <= now() THEN RETURN 'That visit has already taken place.'; END IF;
     IF EXISTS (SELECT 1 FROM adv_bookings WHERE slot_id = p_slot AND user_id = p_actor AND state = 'booked') THEN RETURN 'You already have a booking for this visit. Cancel it first to change it.'; END IF;
     SELECT coalesce(sum(guests), 0) INTO taken FROM adv_bookings WHERE slot_id = p_slot AND state = 'booked';
     IF taken + p_guests > s.capacity THEN RETURN 'That visit is full.'; END IF;
     INSERT INTO adv_bookings (slot_id, user_id, guests) VALUES (p_slot, p_actor, p_guests);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION adv_cancel(p_actor text, p_booking bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b adv_bookings;
   BEGIN
     SELECT * INTO b FROM adv_bookings WHERE id = p_booking FOR UPDATE;
     IF NOT FOUND OR b.user_id <> p_actor THEN RETURN 'That booking is not yours.'; END IF;
     IF b.state <> 'booked' THEN RETURN 'That booking is already cancelled.'; END IF;
     UPDATE adv_bookings SET state = 'cancelled' WHERE id = p_booking;
     RETURN NULL;
   END $$`,
];
