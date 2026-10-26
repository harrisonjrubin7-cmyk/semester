// Migration prk-001: transportation and parking (S-76 E17; mirrors lib/parkingRules.ts).
// Enforced here: parking staff and appeal adjudicators are granted by an administrator, never themselves, and are separate
// roles; an appeal is decided by an adjudicator who did not issue the citation; the zone row is locked while counting so
// issued permits never exceed capacity; one live permit per person per term; a plate belongs to one active vehicle;
// citations snapshot the plate and keep it through corrections (each correction is logged with a reason); one appeal, by
// the vehicle's owner, within 21 days; a reduction must lower the amount. Semester records amounts but takes no payment
// and stores no location data. History is append-only.
export const PRK_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS prk_staff (tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('staff','adjudicator')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION prk_kind(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT kind FROM prk_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE OR REPLACE FUNCTION prk_norm(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g') $$`,
  `CREATE TABLE IF NOT EXISTS prk_zones (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
     capacity int NOT NULL CHECK (capacity BETWEEN 0 AND 20000), active boolean NOT NULL DEFAULT true, UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS prk_vehicles (id bigserial PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, plate text NOT NULL CHECK (plate ~ '^[A-Z0-9]{2,10}$'),
     region text NOT NULL CHECK (length(trim(region)) BETWEEN 2 AND 40), description text NOT NULL DEFAULT '' CHECK (length(description) <= 120),
     active boolean NOT NULL DEFAULT true, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prk_vehicles_one_plate ON prk_vehicles (tenant_id, plate, region) WHERE active`,
  `CREATE TABLE IF NOT EXISTS prk_permits (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, holder_id text NOT NULL,
     zone_id bigint NOT NULL REFERENCES prk_zones(id), vehicle_id bigint NOT NULL REFERENCES prk_vehicles(id), term text NOT NULL CHECK (length(trim(term)) BETWEEN 2 AND 40),
     valid_from date NOT NULL, valid_to date NOT NULL, state text NOT NULL DEFAULT 'applied' CHECK (state IN ('applied','waitlisted','issued','declined','revoked','withdrawn')),
     version int NOT NULL DEFAULT 1, decided_by text, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, holder_id, request_key), CHECK (valid_to >= valid_from), CHECK (decided_by IS NULL OR decided_by <> holder_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prk_permits_one_live ON prk_permits (tenant_id, holder_id, term) WHERE state IN ('applied','waitlisted','issued')`,
  `CREATE TABLE IF NOT EXISTS prk_citations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, issued_by text NOT NULL,
     plate text NOT NULL CHECK (plate ~ '^[A-Z0-9]{2,10}$'), region text NOT NULL, vehicle_id bigint REFERENCES prk_vehicles(id), zone_id bigint REFERENCES prk_zones(id),
     reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500), amount_cents int NOT NULL CHECK (amount_cents BETWEEN 0 AND 100000), final_cents int,
     state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','appealed','upheld','dismissed','reduced','voided')), version int NOT NULL DEFAULT 1,
     appeal_text text NOT NULL DEFAULT '', appellant_id text, decision_note text NOT NULL DEFAULT '', decided_by text,
     issued_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, issued_by, request_key),
     CHECK (decided_by IS NULL OR decided_by <> issued_by),
     CHECK (state NOT IN ('upheld','dismissed','reduced') OR (decided_by IS NOT NULL AND appellant_id IS NOT NULL)),
     CHECK (state <> 'reduced' OR (final_cents IS NOT NULL AND final_cents < amount_cents)))`,
  `CREATE TABLE IF NOT EXISTS prk_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('zone','vehicle','permit','citation','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL DEFAULT '', actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION prk_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prk_events_append_only') THEN
       CREATE TRIGGER prk_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prk_events FOR EACH STATEMENT EXECUTE FUNCTION prk_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_set_staff(p_admin text, p_tenant text, p_user text, p_kind text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own parking access.'; END IF;
     IF p_kind IS NULL THEN UPDATE prk_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_kind NOT IN ('staff','adjudicator') THEN RETURN 'Unknown parking role.';
     ELSE INSERT INTO prk_staff (tenant_id, user_id, kind, granted_by) VALUES (p_tenant, p_user, p_kind, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, revoked_at = NULL, granted_by = p_admin, granted_at = now(); END IF;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'staff', 0, 'set_staff', coalesce(p_kind, 'revoked'), p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_issued(p_zone bigint) RETURNS int LANGUAGE sql STABLE AS $$
     SELECT count(*)::int FROM prk_permits WHERE zone_id = p_zone AND state = 'issued' AND valid_to >= current_date $$`,
  `CREATE OR REPLACE FUNCTION prk_zone(p_tenant text, p_actor text, p_id bigint, p_name text, p_capacity int, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF prk_kind(p_tenant, p_actor) IS DISTINCT FROM 'staff' THEN RETURN 'Only parking staff manage zones.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO prk_zones (tenant_id, name, capacity, active) VALUES (p_tenant, trim(p_name), p_capacity, p_active) ON CONFLICT (tenant_id, name) DO NOTHING RETURNING id INTO v_id;
       IF v_id IS NULL THEN RETURN 'A zone with that name already exists.'; END IF;
     ELSE
       PERFORM 1 FROM prk_zones WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Zone not found.'; END IF;
       IF p_capacity < prk_issued(p_id) THEN RETURN prk_issued(p_id) || ' permits are issued in this zone; capacity cannot go below that.'; END IF;
       UPDATE prk_zones SET name = trim(p_name), capacity = p_capacity, active = p_active WHERE id = p_id RETURNING id INTO v_id;
     END IF;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'zone', v_id, 'set_zone', CASE WHEN p_active THEN 'active' ELSE 'inactive' END, p_actor, 'capacity ' || p_capacity);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_vehicle(p_tenant text, p_actor text, p_id bigint, p_plate text, p_region text, p_desc text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v prk_vehicles; v_id bigint; pl text := prk_norm(p_plate);
   BEGIN
     IF pl !~ '^[A-Z0-9]{2,10}$' THEN RETURN 'Enter a plate of 2 to 10 letters and digits.'; END IF;
     IF p_active AND EXISTS (SELECT 1 FROM prk_vehicles WHERE tenant_id = p_tenant AND plate = pl AND region = trim(p_region) AND active AND id IS DISTINCT FROM p_id) THEN
       RETURN 'That plate is already registered. If it is yours, ask parking staff.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO prk_vehicles (tenant_id, owner_id, plate, region, description, active) VALUES (p_tenant, p_actor, pl, trim(p_region), trim(p_desc), p_active) RETURNING id INTO v_id;
     ELSE
       SELECT * INTO v FROM prk_vehicles WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_actor FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Vehicle not found.'; END IF;
       IF NOT p_active AND EXISTS (SELECT 1 FROM prk_permits WHERE vehicle_id = p_id AND state = 'issued' AND valid_to >= current_date) THEN RETURN 'This vehicle has an issued permit; withdraw the permit first.'; END IF;
       UPDATE prk_vehicles SET plate = pl, region = trim(p_region), description = trim(p_desc), active = p_active, version = version + 1 WHERE id = p_id RETURNING id INTO v_id;
     END IF;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'vehicle', v_id, CASE WHEN p_id IS NULL THEN 'register' ELSE 'edit' END, pl, p_actor,
       CASE WHEN p_id IS NOT NULL AND v.plate <> pl THEN 'plate ' || v.plate || ' -> ' || pl ELSE '' END);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_apply(p_tenant text, p_key text, p_actor text, p_zone bigint, p_vehicle bigint, p_term text, p_from date, p_to date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p prk_permits; v_id bigint;
   BEGIN
     SELECT * INTO p FROM prk_permits WHERE tenant_id = p_tenant AND holder_id = p_actor AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN p.zone_id = p_zone AND p.vehicle_id = p_vehicle AND p.term = trim(p_term) THEN 'replay:' || p.id ELSE 'That application was already sent with different details.' END; END IF;
     IF NOT EXISTS (SELECT 1 FROM prk_vehicles WHERE id = p_vehicle AND tenant_id = p_tenant AND owner_id = p_actor AND active) THEN RETURN 'Register the vehicle first.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM prk_zones WHERE id = p_zone AND tenant_id = p_tenant AND active) THEN RETURN 'That zone is not available.'; END IF;
     IF p_to < p_from OR p_to < current_date THEN RETURN 'The permit period must end after it starts and not in the past.'; END IF;
     IF EXISTS (SELECT 1 FROM prk_permits WHERE tenant_id = p_tenant AND holder_id = p_actor AND term = trim(p_term) AND state IN ('applied','waitlisted','issued')) THEN RETURN 'You already have a permit or application for that term.'; END IF;
     INSERT INTO prk_permits (tenant_id, request_key, holder_id, zone_id, vehicle_id, term, valid_from, valid_to) VALUES (p_tenant, p_key, p_actor, p_zone, p_vehicle, trim(p_term), p_from, p_to) RETURNING id INTO v_id;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'permit', v_id, 'apply', 'applied', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_pstep(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p prk_permits; z prk_zones; staff boolean := prk_kind(p_tenant, p_actor) = 'staff'; holder boolean; is_full boolean; v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO p FROM prk_permits WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Permit not found.'; END IF;
     holder := p.holder_id = p_actor;
     IF NOT holder AND NOT coalesce(staff, false) THEN RETURN 'Permit not found.'; END IF;
     IF p.version <> p_expected THEN RETURN 'This permit changed since you opened it. Refresh and try again.'; END IF;
     IF p_step <> 'withdraw' AND holder THEN RETURN 'Another member of parking staff decides your own permit.'; END IF;
     SELECT * INTO z FROM prk_zones WHERE id = p.zone_id FOR UPDATE;
     is_full := prk_issued(p.zone_id) >= z.capacity OR NOT z.active;
     v_to := CASE
       WHEN p_step = 'withdraw' AND holder AND p.state IN ('applied','waitlisted','issued') THEN 'withdrawn'
       WHEN p_step = 'allocate' AND staff AND p.state IN ('applied','waitlisted') AND NOT is_full THEN 'issued'
       WHEN p_step = 'waitlist' AND staff AND p.state = 'applied' AND is_full THEN 'waitlisted'
       WHEN p_step = 'decline' AND staff AND p.state IN ('applied','waitlisted') THEN 'declined'
       WHEN p_step = 'revoke' AND staff AND p.state = 'issued' THEN 'revoked' END;
     IF v_to IS NULL THEN
       IF p_step = 'allocate' AND is_full THEN RETURN 'This zone is full. Waitlist the application instead.'; END IF;
       IF p_step = 'waitlist' AND NOT is_full THEN RETURN 'This zone has space; allocate the permit instead.'; END IF;
       RETURN 'That step is not open for this permit now.';
     END IF;
     IF p_step IN ('decline','revoke') AND length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
     UPDATE prk_permits SET state = v_to, version = version + 1, updated_at = now(), note = CASE WHEN length(n) > 0 THEN n ELSE note END,
       decided_by = CASE WHEN p_step IN ('allocate','waitlist','decline','revoke') THEN p_actor ELSE decided_by END WHERE id = p_id;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'permit', p_id, p_step, v_to, p_actor, left(n, 300));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_cite(p_tenant text, p_key text, p_actor text, p_plate text, p_region text, p_zone bigint, p_reason text, p_amount int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c prk_citations; v_id bigint; pl text := prk_norm(p_plate);
   BEGIN
     IF prk_kind(p_tenant, p_actor) IS DISTINCT FROM 'staff' THEN RETURN 'Only parking staff issue citations.'; END IF;
     SELECT * INTO c FROM prk_citations WHERE tenant_id = p_tenant AND issued_by = p_actor AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN c.plate = pl AND c.reason = trim(p_reason) AND c.amount_cents = p_amount THEN 'replay:' || c.id ELSE 'That citation was already issued with different details.' END; END IF;
     IF pl !~ '^[A-Z0-9]{2,10}$' THEN RETURN 'Enter a plate of 2 to 10 letters and digits.'; END IF;
     INSERT INTO prk_citations (tenant_id, request_key, issued_by, plate, region, vehicle_id, zone_id, reason, amount_cents)
       VALUES (p_tenant, p_key, p_actor, pl, trim(p_region), (SELECT id FROM prk_vehicles WHERE tenant_id = p_tenant AND plate = pl AND region = trim(p_region) AND active), p_zone, trim(p_reason), p_amount)
       RETURNING id INTO v_id;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'citation', v_id, 'issue', 'issued', p_actor, pl);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prk_cstep(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_new_cents int, p_plate text, p_region text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c prk_citations; k text := prk_kind(p_tenant, p_actor); owner boolean; v_to text; n text := trim(coalesce(p_note, '')); pl text;
   BEGIN
     SELECT * INTO c FROM prk_citations WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Citation not found.'; END IF;
     owner := EXISTS (SELECT 1 FROM prk_vehicles WHERE id = c.vehicle_id AND owner_id = p_actor);
     IF NOT owner AND k IS NULL THEN RETURN 'Citation not found.'; END IF;
     IF c.version <> p_expected THEN RETURN 'This citation changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'appeal' THEN
       IF NOT owner THEN RETURN 'Only the registered owner of the vehicle can appeal.'; END IF;
       IF c.state <> 'issued' THEN RETURN CASE WHEN c.state = 'appealed' THEN 'This citation is already under appeal.' ELSE 'This citation can no longer be appealed.' END; END IF;
       IF now() - c.issued_at > interval '21 days' THEN RETURN 'Appeals must be made within 21 days.'; END IF;
       IF length(n) < 20 THEN RETURN 'Explain the appeal (at least 20 characters).'; END IF;
       UPDATE prk_citations SET state = 'appealed', appeal_text = n, appellant_id = p_actor, version = version + 1, updated_at = now() WHERE id = p_id; v_to := 'appealed';
     ELSIF p_step IN ('upheld','dismissed','reduced') THEN
       IF k IS DISTINCT FROM 'adjudicator' THEN RETURN 'Only an appeal adjudicator decides appeals.'; END IF;
       IF c.issued_by = p_actor THEN RETURN 'You issued this citation, so someone else must decide the appeal.'; END IF;
       IF c.state <> 'appealed' THEN RETURN 'There is no open appeal on this citation.'; END IF;
       IF length(n) < 10 THEN RETURN 'Give the reason for the decision (at least 10 characters).'; END IF;
       IF p_step = 'reduced' AND (p_new_cents IS NULL OR p_new_cents < 0 OR p_new_cents >= c.amount_cents) THEN RETURN 'A reduction must be lower than the original amount.'; END IF;
       UPDATE prk_citations SET state = p_step, decision_note = n, decided_by = p_actor, version = version + 1, updated_at = now(),
         final_cents = CASE p_step WHEN 'reduced' THEN p_new_cents WHEN 'dismissed' THEN 0 ELSE amount_cents END WHERE id = p_id; v_to := p_step;
     ELSIF p_step = 'void' THEN
       IF k IS DISTINCT FROM 'staff' THEN RETURN 'Only parking staff void citations.'; END IF;
       IF c.state <> 'issued' THEN RETURN 'Only an unappealed citation can be voided; an appeal must be decided.'; END IF;
       IF length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
       UPDATE prk_citations SET state = 'voided', decision_note = n, version = version + 1, updated_at = now() WHERE id = p_id; v_to := 'voided';
     ELSIF p_step = 'correct_plate' THEN
       IF k IS DISTINCT FROM 'staff' THEN RETURN 'Only parking staff correct a plate.'; END IF;
       IF c.state NOT IN ('issued','appealed') THEN RETURN 'A decided citation cannot be changed.'; END IF;
       pl := prk_norm(p_plate);
       IF pl !~ '^[A-Z0-9]{2,10}$' THEN RETURN 'Enter a plate of 2 to 10 letters and digits.'; END IF;
       IF length(n) < 5 THEN RETURN 'Give a reason for the correction.'; END IF;
       IF c.state = 'appealed' THEN RETURN 'The plate cannot be changed while an appeal is open.'; END IF;
       UPDATE prk_citations SET plate = pl, region = trim(coalesce(p_region, c.region)), version = version + 1, updated_at = now(),
         vehicle_id = (SELECT id FROM prk_vehicles WHERE tenant_id = p_tenant AND plate = pl AND region = trim(coalesce(p_region, c.region)) AND active) WHERE id = p_id;
       v_to := c.state; n := c.plate || ' -> ' || pl || ': ' || n;
     ELSE RETURN 'Unknown step.'; END IF;
     INSERT INTO prk_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'citation', p_id, p_step, v_to, p_actor, left(n, 500));
     RETURN NULL;
   END $$`,
];
