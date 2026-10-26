// Migration dng-001: dining (mirrors lib/diningRules.ts).
// Enforced here: dining staff granted by an administrator (never self); allergens from a fixed list; staff never set their own
// meal plan; an order locks the student's entitlement and the item rows, refuses closed hours, unavailable or short items, a
// missing or insufficient entitlement, and declared allergens without acknowledgement; it deducts exactly one swipe or the
// order total in dining dollars and decrements stock; cancel (student, before preparation) and reject (staff) restore both
// exactly; fulfillment steps are staff-only and versioned; a location's day closes once, only when no order is still open,
// with the system totals computed here and a note required for any variance; a closed day's orders cannot change. No money
// moves: meal-plan billing belongs to Student Accounts. Append-only history.
export const DNG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dng_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION dng_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dng_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION dng_allergens_ok(a text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
     SELECT coalesce(a, '{}') <@ ARRAY['milk','eggs','fish','shellfish','tree_nuts','peanuts','wheat','soy','sesame','gluten','mustard','celery','sulphites','lupin']::text[] $$`,
  `CREATE TABLE IF NOT EXISTS dng_locations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
     hours jsonb NOT NULL DEFAULT '{}'::jsonb, active boolean NOT NULL DEFAULT true, version int NOT NULL DEFAULT 1, UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS dng_items (id bigserial PRIMARY KEY, tenant_id text NOT NULL, location_id bigint NOT NULL REFERENCES dng_locations(id),
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120), price_cents int NOT NULL CHECK (price_cents BETWEEN 0 AND 10000),
     allergens text[] NOT NULL DEFAULT '{}' CHECK (dng_allergens_ok(allergens)), dietary text[] NOT NULL DEFAULT '{}', ingredients text NOT NULL DEFAULT '' CHECK (length(ingredients) <= 2000),
     stock int CHECK (stock IS NULL OR stock >= 0), available boolean NOT NULL DEFAULT true, version int NOT NULL DEFAULT 1, UNIQUE (location_id, name))`,
  `CREATE TABLE IF NOT EXISTS dng_entitlements (tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, plan_name text NOT NULL CHECK (length(trim(plan_name)) BETWEEN 2 AND 80),
     swipes int NOT NULL CHECK (swipes >= 0), dollars_cents int NOT NULL CHECK (dollars_cents >= 0), granted_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, student_id, term), CHECK (granted_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS dng_allergy (tenant_id text NOT NULL, student_id text NOT NULL, allergens text[] NOT NULL DEFAULT '{}' CHECK (dng_allergens_ok(allergens)),
     updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS dng_orders (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, student_id text NOT NULL, location_id bigint NOT NULL REFERENCES dng_locations(id),
     term text NOT NULL, tender text NOT NULL CHECK (tender IN ('swipe','dollars')), total_cents int NOT NULL CHECK (total_cents >= 0), lines jsonb NOT NULL, allergen_ack boolean NOT NULL DEFAULT false,
     state text NOT NULL DEFAULT 'placed' CHECK (state IN ('placed','preparing','ready','picked_up','cancelled','rejected')), version int NOT NULL DEFAULT 1, note text NOT NULL DEFAULT '',
     service_date date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, student_id, request_key))`,
  `CREATE TABLE IF NOT EXISTS dng_closes (location_id bigint NOT NULL REFERENCES dng_locations(id), service_date date NOT NULL, tenant_id text NOT NULL,
     expected_swipes int NOT NULL, expected_cents int NOT NULL, counted_swipes int NOT NULL, counted_cents int NOT NULL, note text NOT NULL DEFAULT '', closed_by text NOT NULL,
     closed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (location_id, service_date),
     CHECK ((expected_swipes = counted_swipes AND expected_cents = counted_cents) OR length(note) >= 10))`,
  `CREATE TABLE IF NOT EXISTS dng_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, subject_id text NOT NULL, step text NOT NULL,
     actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dng_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dng_events_append_only') THEN
       CREATE TRIGGER dng_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dng_events FOR EACH STATEMENT EXECUTE FUNCTION dng_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dng_closes_append_only') THEN
       CREATE TRIGGER dng_closes_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dng_closes FOR EACH STATEMENT EXECUTE FUNCTION dng_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own dining access.'; END IF;
     IF p_on THEN INSERT INTO dng_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE dng_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'staff', p_user, CASE WHEN p_on THEN 'granted' ELSE 'revoked' END, p_admin);
     RETURN NULL;
   END $$`,
  // hours: {"0": ["HH:MM","HH:MM"] | null, ... "6": ...}
  `CREATE OR REPLACE FUNCTION dng_location(p_tenant text, p_actor text, p_id bigint, p_name text, p_hours jsonb, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k text; h jsonb; lid bigint := p_id;
   BEGIN
     IF NOT dng_is_staff(p_tenant, p_actor) THEN RETURN 'Only dining staff manage locations.'; END IF;
     IF jsonb_typeof(p_hours) <> 'object' THEN RETURN 'Give opening hours by weekday.'; END IF;
     FOR k, h IN SELECT * FROM jsonb_each(p_hours) LOOP
       IF k NOT IN ('0','1','2','3','4','5','6') THEN RETURN 'Unknown weekday in hours.'; END IF;
       IF jsonb_typeof(h) = 'null' THEN CONTINUE; END IF;
       IF jsonb_typeof(h) <> 'array' OR jsonb_array_length(h) <> 2 OR (h->>0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (h->>1) !~ '^([01][0-9]|2[0-4]):[0-5][0-9]$' OR (h->>0) >= (h->>1)
         THEN RETURN 'Hours must be HH:MM to a later HH:MM.'; END IF;
     END LOOP;
     IF p_id IS NULL THEN INSERT INTO dng_locations (tenant_id, name, hours, active) VALUES (p_tenant, trim(p_name), p_hours, p_active) RETURNING id INTO lid;
     ELSE UPDATE dng_locations SET name = trim(p_name), hours = p_hours, active = p_active, version = version + 1 WHERE id = p_id AND tenant_id = p_tenant;
       IF NOT FOUND THEN RETURN 'Location not found.'; END IF; END IF;
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'location', lid::text, 'saved', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_item(p_tenant text, p_actor text, p_id bigint, p_location bigint, p_name text, p_price int, p_allergens text[], p_dietary text[], p_ingredients text, p_stock int, p_available boolean, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE it dng_items; iid bigint := p_id;
   BEGIN
     IF NOT dng_is_staff(p_tenant, p_actor) THEN RETURN 'Only dining staff manage menus.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM dng_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Location not found.'; END IF;
     IF NOT dng_allergens_ok(p_allergens) THEN RETURN 'Unknown allergen.'; END IF;
     IF p_stock IS NOT NULL AND p_stock < 0 THEN RETURN 'Stock cannot be negative.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO dng_items (tenant_id, location_id, name, price_cents, allergens, dietary, ingredients, stock, available)
         VALUES (p_tenant, p_location, trim(p_name), p_price, coalesce(p_allergens, '{}'), coalesce(p_dietary, '{}'), coalesce(p_ingredients, ''), p_stock, p_available) RETURNING id INTO iid;
     ELSE
       SELECT * INTO it FROM dng_items WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Item not found.'; END IF;
       IF it.version <> p_expected THEN RETURN 'This item changed since you opened it. Reload.'; END IF;
       UPDATE dng_items SET name = trim(p_name), price_cents = p_price, allergens = coalesce(p_allergens, '{}'), dietary = coalesce(p_dietary, '{}'), ingredients = coalesce(p_ingredients, ''),
         stock = p_stock, available = p_available, version = version + 1 WHERE id = p_id;
     END IF;
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'item', iid::text, 'saved', p_actor, coalesce(array_to_string(p_allergens, ','), ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_entitle(p_tenant text, p_actor text, p_student text, p_term text, p_plan text, p_swipes int, p_cents int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT dng_is_staff(p_tenant, p_actor) THEN RETURN 'Only dining staff set meal plans.'; END IF;
     IF p_actor = p_student THEN RETURN 'Ask another staff member to set your own meal plan.'; END IF;
     IF p_swipes < 0 OR p_cents < 0 THEN RETURN 'Balances cannot be negative.'; END IF;
     INSERT INTO dng_entitlements (tenant_id, student_id, term, plan_name, swipes, dollars_cents, granted_by) VALUES (p_tenant, p_student, trim(p_term), trim(p_plan), p_swipes, p_cents, p_actor)
       ON CONFLICT (tenant_id, student_id, term) DO UPDATE SET plan_name = EXCLUDED.plan_name, swipes = EXCLUDED.swipes, dollars_cents = EXCLUDED.dollars_cents, granted_by = p_actor, updated_at = now();
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'entitlement', p_student, 'set', p_actor, trim(p_term) || ': ' || p_swipes || ' swipes, ' || p_cents || 'c');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_declare(p_tenant text, p_student text, p_allergens text[]) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT dng_allergens_ok(p_allergens) THEN RETURN 'Unknown allergen.'; END IF;
     INSERT INTO dng_allergy (tenant_id, student_id, allergens) VALUES (p_tenant, p_student, coalesce(p_allergens, '{}'))
       ON CONFLICT (tenant_id, student_id) DO UPDATE SET allergens = EXCLUDED.allergens, updated_at = now();
     RETURN NULL;
   END $$`,
  // p_items: [{"item": id, "qty": n}]. p_weekday/p_hhmm/p_date: the location's local time, computed by the server. Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION dng_order(p_tenant text, p_key text, p_student text, p_location bigint, p_term text, p_tender text, p_items jsonb, p_ack boolean,
     p_weekday int, p_hhmm text, p_date date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o dng_orders; loc dng_locations; e dng_entitlements; h jsonb; li jsonb; it dng_items; q int; total int := 0; lines jsonb := '[]'::jsonb; mine text[]; hit text[] := '{}'; nid bigint;
   BEGIN
     SELECT * INTO o FROM dng_orders WHERE tenant_id = p_tenant AND student_id = p_student AND request_key = p_key;
     IF FOUND THEN RETURN 'replay:' || o.id; END IF;
     IF p_tender NOT IN ('swipe','dollars') THEN RETURN 'Pay with a swipe or dining dollars.'; END IF;
     SELECT * INTO loc FROM dng_locations WHERE id = p_location AND tenant_id = p_tenant;
     IF NOT FOUND OR NOT loc.active THEN RETURN 'This location is closed now.'; END IF;
     h := loc.hours->(p_weekday::text);
     IF h IS NULL OR jsonb_typeof(h) <> 'array' OR NOT ((h->>0) <= p_hhmm AND p_hhmm < (h->>1)) THEN RETURN 'This location is closed now.'; END IF;
     IF EXISTS (SELECT 1 FROM dng_closes WHERE location_id = p_location AND service_date = p_date) THEN RETURN 'This location has closed for the day.'; END IF;
     IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN RETURN 'Choose 1 to 10 of each item.'; END IF;
     SELECT * INTO e FROM dng_entitlements WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) FOR UPDATE;
     IF NOT FOUND THEN RETURN 'You have no meal plan for this term.'; END IF;
     SELECT coalesce(allergens, '{}') INTO mine FROM dng_allergy WHERE tenant_id = p_tenant AND student_id = p_student;
     -- Lock item rows in id order so concurrent orders cannot deadlock or oversell.
     PERFORM 1 FROM dng_items WHERE id IN (SELECT (x->>'item')::bigint FROM jsonb_array_elements(p_items) x) ORDER BY id FOR UPDATE;
     FOR li IN SELECT * FROM jsonb_array_elements(p_items) LOOP
       q := coalesce((li->>'qty')::int, 0);
       IF q < 1 OR q > 10 THEN RETURN 'Choose 1 to 10 of each item.'; END IF;
       SELECT * INTO it FROM dng_items WHERE id = (li->>'item')::bigint AND location_id = p_location;
       IF NOT FOUND OR NOT it.available THEN RETURN 'An item is no longer available.'; END IF;
       IF it.stock IS NOT NULL AND it.stock < q THEN RETURN 'Not enough left of ' || it.name || '.'; END IF;
       IF (SELECT count(*) FROM jsonb_array_elements(p_items) y WHERE (y->>'item')::bigint = it.id) > 1 THEN RETURN 'List each item once.'; END IF;
       total := total + it.price_cents * q;
       hit := hit || ARRAY(SELECT unnest(it.allergens) INTERSECT SELECT unnest(coalesce(mine, '{}')));
       lines := lines || jsonb_build_object('item', it.id, 'name', it.name, 'qty', q, 'price', it.price_cents, 'allergens', to_jsonb(it.allergens));
     END LOOP;
     IF array_length(hit, 1) > 0 AND NOT coalesce(p_ack, false) THEN RETURN 'Contains ' || array_to_string(ARRAY(SELECT DISTINCT unnest(hit)), ', ') || ', which you listed as an allergen. Confirm to order anyway.'; END IF;
     IF p_tender = 'swipe' AND e.swipes < 1 THEN RETURN 'You have no swipes left.'; END IF;
     IF p_tender = 'dollars' AND e.dollars_cents < total THEN RETURN 'Not enough dining dollars.'; END IF;
     FOR li IN SELECT * FROM jsonb_array_elements(p_items) LOOP
       UPDATE dng_items SET stock = stock - (li->>'qty')::int WHERE id = (li->>'item')::bigint AND stock IS NOT NULL;
     END LOOP;
     UPDATE dng_entitlements SET swipes = swipes - CASE WHEN p_tender = 'swipe' THEN 1 ELSE 0 END, dollars_cents = dollars_cents - CASE WHEN p_tender = 'dollars' THEN total ELSE 0 END, updated_at = now()
       WHERE tenant_id = p_tenant AND student_id = p_student AND term = e.term;
     INSERT INTO dng_orders (tenant_id, request_key, student_id, location_id, term, tender, total_cents, lines, allergen_ack, service_date)
       VALUES (p_tenant, p_key, p_student, p_location, e.term, p_tender, total, lines, coalesce(p_ack, false) AND array_length(hit, 1) > 0, p_date) RETURNING id INTO nid;
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'order', nid::text, 'placed', p_student, p_tender || ' ' || total);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o dng_orders; staff boolean := dng_is_staff(p_tenant, p_actor); nxt text; li jsonb;
   BEGIN
     SELECT * INTO o FROM dng_orders WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Order not found.'; END IF;
     IF o.version <> p_expected THEN RETURN 'This order changed since you opened it. Reload.'; END IF;
     IF EXISTS (SELECT 1 FROM dng_closes WHERE location_id = o.location_id AND service_date = o.service_date) THEN RETURN 'That day is closed; its orders cannot change.'; END IF;
     nxt := CASE
       WHEN p_step = 'cancel' AND p_actor = o.student_id AND o.state = 'placed' THEN 'cancelled'
       WHEN p_step = 'prepare' AND staff AND o.state = 'placed' THEN 'preparing'
       WHEN p_step = 'ready' AND staff AND o.state = 'preparing' THEN 'ready'
       WHEN p_step = 'pick_up' AND staff AND o.state = 'ready' THEN 'picked_up'
       WHEN p_step = 'reject' AND staff AND o.state IN ('placed','preparing') THEN 'rejected'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step = 'reject' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Tell the student why (5+ characters).'; END IF;
     IF nxt IN ('cancelled','rejected') THEN
       FOR li IN SELECT * FROM jsonb_array_elements(o.lines) LOOP
         UPDATE dng_items SET stock = stock + (li->>'qty')::int WHERE id = (li->>'item')::bigint AND stock IS NOT NULL;
       END LOOP;
       UPDATE dng_entitlements SET swipes = swipes + CASE WHEN o.tender = 'swipe' THEN 1 ELSE 0 END, dollars_cents = dollars_cents + CASE WHEN o.tender = 'dollars' THEN o.total_cents ELSE 0 END,
         updated_at = now() WHERE tenant_id = p_tenant AND student_id = o.student_id AND term = o.term;
     END IF;
     UPDATE dng_orders SET state = nxt, version = version + 1, updated_at = now(), note = CASE WHEN p_step = 'reject' THEN trim(p_note) ELSE note END WHERE id = o.id;
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'order', o.id::text, p_step, p_actor, coalesce(trim(p_note), ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dng_close(p_tenant text, p_actor text, p_location bigint, p_date date, p_swipes int, p_cents int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE es int; ec int; t text := trim(coalesce(p_note, ''));
   BEGIN
     IF NOT dng_is_staff(p_tenant, p_actor) THEN RETURN 'Only dining staff close a day.'; END IF;
     PERFORM 1 FROM dng_locations WHERE id = p_location AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Location not found.'; END IF;
     IF EXISTS (SELECT 1 FROM dng_closes WHERE location_id = p_location AND service_date = p_date) THEN RETURN 'That day is already closed.'; END IF;
     IF EXISTS (SELECT 1 FROM dng_orders WHERE location_id = p_location AND service_date = p_date AND state IN ('placed','preparing','ready'))
       THEN RETURN 'Finish or reject every open order before closing the day.'; END IF;
     SELECT coalesce(sum(CASE WHEN tender = 'swipe' THEN 1 ELSE 0 END), 0), coalesce(sum(CASE WHEN tender = 'dollars' THEN total_cents ELSE 0 END), 0) INTO es, ec
       FROM dng_orders WHERE location_id = p_location AND service_date = p_date AND state = 'picked_up';
     IF (es <> p_swipes OR ec <> p_cents) AND length(t) < 10 THEN RETURN 'The counts differ from the system (' || es || ' swipes, ' || ec || 'c); explain the difference (10+ characters).'; END IF;
     INSERT INTO dng_closes (location_id, service_date, tenant_id, expected_swipes, expected_cents, counted_swipes, counted_cents, note, closed_by)
       VALUES (p_location, p_date, p_tenant, es, ec, p_swipes, p_cents, t, p_actor);
     INSERT INTO dng_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'close', p_location || ':' || p_date, 'closed', p_actor, t);
     RETURN NULL;
   END $$`,
];
