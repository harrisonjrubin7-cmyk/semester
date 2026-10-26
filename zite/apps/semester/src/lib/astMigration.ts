// Migration ast-001: assets and inventory (S-76 E14; mirrors lib/assetRules.ts).
// Enforced here: clerks and controllers are granted by an administrator, never themselves; asset tags are unique per
// institution; every custody change and inspection is kept in append-only history; disposal is approved by a controller
// other than the requester; stock rows carry CHECK (0 <= reserved <= on_hand) and are locked while reserving, issuing,
// returning or adjusting, so the last item is never issued twice and stock never goes negative; every quantity change is an
// append-only movement; a differing count becomes an adjustment approved by a controller other than the counter.
export const AST_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS ast_staff (tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('clerk','controller')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION ast_kind(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT kind FROM ast_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE TABLE IF NOT EXISTS ast_locations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80), UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS ast_assets (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, tag text NOT NULL CHECK (tag ~ '^[A-Z0-9-]{2,40}$'),
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160), category text NOT NULL DEFAULT '' CHECK (length(category) <= 60),
     location_id bigint REFERENCES ast_locations(id), custodian_id text, state text NOT NULL DEFAULT 'in_service' CHECK (state IN ('in_service','in_repair','retire_requested','disposed')),
     version int NOT NULL DEFAULT 1, disposal_reason text NOT NULL DEFAULT '', disposal_requested_by text, disposed_by text,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, tag), UNIQUE (tenant_id, request_key),
     CHECK (disposed_by IS NULL OR disposed_by <> disposal_requested_by), CHECK (state <> 'disposed' OR (disposed_by IS NOT NULL AND custodian_id IS NULL)),
     CHECK (state <> 'retire_requested' OR disposal_requested_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS ast_custody (id bigserial PRIMARY KEY, tenant_id text NOT NULL, asset_id bigint NOT NULL REFERENCES ast_assets(id), from_user text, to_user text,
     location_id bigint REFERENCES ast_locations(id), by_user text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS ast_inspections (id bigserial PRIMARY KEY, tenant_id text NOT NULL, asset_id bigint NOT NULL REFERENCES ast_assets(id),
     result text NOT NULL CHECK (result IN ('ok','needs_repair')), note text NOT NULL DEFAULT '', by_user text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS ast_items (id bigserial PRIMARY KEY, tenant_id text NOT NULL, sku text NOT NULL CHECK (sku ~ '^[A-Z0-9-]{2,40}$'),
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160), unit text NOT NULL DEFAULT 'each' CHECK (length(unit) BETWEEN 1 AND 20), UNIQUE (tenant_id, sku))`,
  `CREATE TABLE IF NOT EXISTS ast_stock (item_id bigint NOT NULL REFERENCES ast_items(id), location_id bigint NOT NULL REFERENCES ast_locations(id), tenant_id text NOT NULL,
     on_hand int NOT NULL DEFAULT 0, reserved int NOT NULL DEFAULT 0, PRIMARY KEY (item_id, location_id), CHECK (on_hand >= 0), CHECK (reserved >= 0 AND reserved <= on_hand))`,
  `CREATE TABLE IF NOT EXISTS ast_moves (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text, item_id bigint NOT NULL, location_id bigint NOT NULL,
     delta int NOT NULL CHECK (delta <> 0), kind text NOT NULL CHECK (kind IN ('receive','issue','return','adjust')), ref bigint, by_user text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ast_moves_key ON ast_moves (tenant_id, request_key) WHERE request_key IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS ast_reservations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, requester_id text NOT NULL,
     item_id bigint NOT NULL, location_id bigint NOT NULL, qty int NOT NULL CHECK (qty BETWEEN 1 AND 10000), returned_qty int NOT NULL DEFAULT 0,
     state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','issued','returned','cancelled')), purpose text NOT NULL DEFAULT '' CHECK (length(purpose) <= 300),
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, requester_id, request_key), CHECK (returned_qty BETWEEN 0 AND qty), FOREIGN KEY (item_id, location_id) REFERENCES ast_stock(item_id, location_id))`,
  `CREATE TABLE IF NOT EXISTS ast_adjustments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, item_id bigint NOT NULL, location_id bigint NOT NULL,
     on_hand_at_count int NOT NULL, counted int NOT NULL CHECK (counted >= 0), delta int NOT NULL CHECK (delta <> 0), note text NOT NULL DEFAULT '',
     counted_by text NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected','superseded')), decided_by text, decision_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (decided_by IS NULL OR decided_by <> counted_by), FOREIGN KEY (item_id, location_id) REFERENCES ast_stock(item_id, location_id))`,
  `CREATE OR REPLACE FUNCTION ast_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ DECLARE t text; BEGIN
     FOREACH t IN ARRAY ARRAY['ast_custody','ast_inspections','ast_moves'] LOOP
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_append_only') THEN
         EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ast_refuse_change()', t || '_append_only', t);
       END IF;
     END LOOP;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_set_staff(p_admin text, p_tenant text, p_user text, p_kind text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own inventory access.'; END IF;
     IF p_kind IS NULL THEN UPDATE ast_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_kind NOT IN ('clerk','controller') THEN RETURN 'Unknown inventory role.';
     ELSE INSERT INTO ast_staff (tenant_id, user_id, kind, granted_by) VALUES (p_tenant, p_user, p_kind, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, revoked_at = NULL, granted_by = p_admin, granted_at = now(); END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_location(p_tenant text, p_actor text, p_name text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS DISTINCT FROM 'controller' THEN RETURN 'Only an inventory controller adds locations.'; END IF;
     INSERT INTO ast_locations (tenant_id, name) VALUES (p_tenant, trim(p_name)) ON CONFLICT (tenant_id, name) DO NOTHING RETURNING id INTO v_id;
     RETURN CASE WHEN v_id IS NULL THEN 'That location already exists.' ELSE 'ok:' || v_id END;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_receive_asset(p_tenant text, p_actor text, p_key text, p_tag text, p_name text, p_category text, p_location bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a ast_assets; v_id bigint; tg text := regexp_replace(upper(coalesce(p_tag, '')), '[^A-Z0-9-]', '', 'g');
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only inventory staff receive assets.'; END IF;
     SELECT * INTO a FROM ast_assets WHERE tenant_id = p_tenant AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN a.tag = tg THEN 'replay:' || a.id ELSE 'That receipt was already recorded with different details.' END; END IF;
     IF tg !~ '^[A-Z0-9-]{2,40}$' THEN RETURN 'Enter a tag of 2 to 40 letters, digits or dashes.'; END IF;
     IF EXISTS (SELECT 1 FROM ast_assets WHERE tenant_id = p_tenant AND tag = tg) THEN RETURN 'That tag is already in use.'; END IF;
     IF p_location IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ast_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Location not found.'; END IF;
     INSERT INTO ast_assets (tenant_id, request_key, tag, name, category, location_id) VALUES (p_tenant, p_key, tg, trim(p_name), trim(coalesce(p_category, '')), p_location) RETURNING id INTO v_id;
     INSERT INTO ast_custody (tenant_id, asset_id, to_user, location_id, by_user, note) VALUES (p_tenant, v_id, NULL, p_location, p_actor, 'received');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_transfer(p_tenant text, p_actor text, p_asset bigint, p_expected int, p_to text, p_location bigint, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a ast_assets;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only inventory staff record custody changes.'; END IF;
     SELECT * INTO a FROM ast_assets WHERE id = p_asset AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Asset not found.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This asset changed since you opened it. Refresh and try again.'; END IF;
     IF a.state = 'disposed' THEN RETURN 'A disposed asset cannot change hands.'; END IF;
     IF p_location IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ast_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Location not found.'; END IF;
     IF a.custodian_id IS NOT DISTINCT FROM p_to AND a.location_id IS NOT DISTINCT FROM p_location THEN RETURN 'Nothing changes.'; END IF;
     UPDATE ast_assets SET custodian_id = p_to, location_id = p_location, version = version + 1, updated_at = now() WHERE id = p_asset;
     INSERT INTO ast_custody (tenant_id, asset_id, from_user, to_user, location_id, by_user, note) VALUES (p_tenant, p_asset, a.custodian_id, p_to, p_location, p_actor, left(trim(coalesce(p_note, '')), 300));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_inspect(p_tenant text, p_actor text, p_asset bigint, p_expected int, p_result text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a ast_assets;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only inventory staff record inspections.'; END IF;
     SELECT * INTO a FROM ast_assets WHERE id = p_asset AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Asset not found.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This asset changed since you opened it. Refresh and try again.'; END IF;
     IF a.state = 'disposed' THEN RETURN 'A disposed asset cannot be inspected.'; END IF;
     IF p_result = 'needs_repair' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say what needs repair.'; END IF;
     INSERT INTO ast_inspections (tenant_id, asset_id, result, note, by_user) VALUES (p_tenant, p_asset, p_result, trim(coalesce(p_note, '')), p_actor);
     UPDATE ast_assets SET version = version + 1, updated_at = now(), state = CASE WHEN p_result = 'needs_repair' AND state = 'in_service' THEN 'in_repair' ELSE state END WHERE id = p_asset;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_astep(p_tenant text, p_actor text, p_asset bigint, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a ast_assets; k text := ast_kind(p_tenant, p_actor); v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     IF k IS NULL THEN RETURN 'Only inventory staff change an asset.'; END IF;
     SELECT * INTO a FROM ast_assets WHERE id = p_asset AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Asset not found.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This asset changed since you opened it. Refresh and try again.'; END IF;
     v_to := CASE
       WHEN p_step = 'repair' AND a.state = 'in_service' THEN 'in_repair'
       WHEN p_step = 'restore' AND a.state = 'in_repair' THEN 'in_service'
       WHEN p_step = 'request_disposal' AND a.state IN ('in_service','in_repair') THEN 'retire_requested'
       WHEN p_step = 'approve_disposal' AND k = 'controller' AND a.state = 'retire_requested' AND a.disposal_requested_by <> p_actor THEN 'disposed'
       WHEN p_step = 'reject_disposal' AND k = 'controller' AND a.state = 'retire_requested' AND a.disposal_requested_by <> p_actor THEN 'in_service' END;
     IF v_to IS NULL THEN
       IF p_step IN ('approve_disposal','reject_disposal') AND a.disposal_requested_by = p_actor THEN RETURN 'Another controller decides a disposal you requested.'; END IF;
       IF p_step IN ('approve_disposal','reject_disposal') AND k <> 'controller' THEN RETURN 'Only an inventory controller decides disposals.'; END IF;
       RETURN 'That step is not open for this asset now.';
     END IF;
     IF p_step IN ('request_disposal','reject_disposal') AND length(n) < 10 THEN RETURN 'Give a reason (at least 10 characters).'; END IF;
     UPDATE ast_assets SET state = v_to, version = version + 1, updated_at = now(),
       disposal_reason = CASE WHEN p_step = 'request_disposal' THEN n ELSE disposal_reason END,
       disposal_requested_by = CASE WHEN p_step = 'request_disposal' THEN p_actor WHEN p_step = 'reject_disposal' THEN NULL ELSE disposal_requested_by END,
       disposed_by = CASE WHEN p_step = 'approve_disposal' THEN p_actor ELSE disposed_by END,
       custodian_id = CASE WHEN p_step = 'approve_disposal' THEN NULL ELSE custodian_id END WHERE id = p_asset;
     IF p_step = 'approve_disposal' AND a.custodian_id IS NOT NULL THEN
       INSERT INTO ast_custody (tenant_id, asset_id, from_user, to_user, location_id, by_user, note) VALUES (p_tenant, p_asset, a.custodian_id, NULL, a.location_id, p_actor, 'disposed');
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_item(p_tenant text, p_actor text, p_sku text, p_name text, p_unit text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; s text := regexp_replace(upper(coalesce(p_sku, '')), '[^A-Z0-9-]', '', 'g');
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS DISTINCT FROM 'controller' THEN RETURN 'Only an inventory controller adds stock items.'; END IF;
     IF s !~ '^[A-Z0-9-]{2,40}$' THEN RETURN 'Enter a SKU of 2 to 40 letters, digits or dashes.'; END IF;
     INSERT INTO ast_items (tenant_id, sku, name, unit) VALUES (p_tenant, s, trim(p_name), coalesce(nullif(trim(p_unit), ''), 'each')) ON CONFLICT (tenant_id, sku) DO NOTHING RETURNING id INTO v_id;
     RETURN CASE WHEN v_id IS NULL THEN 'That SKU already exists.' ELSE 'ok:' || v_id END;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_receive_stock(p_tenant text, p_actor text, p_key text, p_item bigint, p_location bigint, p_qty int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m ast_moves;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only inventory staff receive stock.'; END IF;
     SELECT * INTO m FROM ast_moves WHERE tenant_id = p_tenant AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN m.item_id = p_item AND m.location_id = p_location AND m.delta = p_qty THEN 'replay:' || m.id ELSE 'That receipt was already recorded with different details.' END; END IF;
     IF p_qty < 1 OR p_qty > 100000 THEN RETURN 'Receive between 1 and 100000.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM ast_items WHERE id = p_item AND tenant_id = p_tenant) OR NOT EXISTS (SELECT 1 FROM ast_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Item or location not found.'; END IF;
     INSERT INTO ast_stock (item_id, location_id, tenant_id, on_hand) VALUES (p_item, p_location, p_tenant, p_qty)
       ON CONFLICT (item_id, location_id) DO UPDATE SET on_hand = ast_stock.on_hand + EXCLUDED.on_hand;
     INSERT INTO ast_moves (tenant_id, request_key, item_id, location_id, delta, kind, by_user) VALUES (p_tenant, p_key, p_item, p_location, p_qty, 'receive', p_actor) RETURNING * INTO m;
     RETURN 'ok:' || m.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_reserve(p_tenant text, p_key text, p_actor text, p_item bigint, p_location bigint, p_qty int, p_purpose text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r ast_reservations; s ast_stock; v_id bigint;
   BEGIN
     SELECT * INTO r FROM ast_reservations WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN r.item_id = p_item AND r.location_id = p_location AND r.qty = p_qty THEN 'replay:' || r.id ELSE 'That request was already sent with different details.' END; END IF;
     SELECT * INTO s FROM ast_stock WHERE item_id = p_item AND location_id = p_location AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'That item is not stocked there.'; END IF;
     IF p_qty < 1 THEN RETURN 'Ask for at least one.'; END IF;
     IF p_qty > s.on_hand - s.reserved THEN RETURN 'Only ' || (s.on_hand - s.reserved) || ' available.'; END IF;
     UPDATE ast_stock SET reserved = reserved + p_qty WHERE item_id = p_item AND location_id = p_location;
     INSERT INTO ast_reservations (tenant_id, request_key, requester_id, item_id, location_id, qty, purpose) VALUES (p_tenant, p_key, p_actor, p_item, p_location, p_qty, left(trim(coalesce(p_purpose, '')), 300)) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_rstep(p_tenant text, p_actor text, p_res bigint, p_step text, p_expected int, p_qty int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r ast_reservations; staff boolean := ast_kind(p_tenant, p_actor) IS NOT NULL;
   BEGIN
     SELECT * INTO r FROM ast_reservations WHERE id = p_res AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR (r.requester_id <> p_actor AND NOT staff) THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This request changed since you opened it. Refresh and try again.'; END IF;
     PERFORM 1 FROM ast_stock WHERE item_id = r.item_id AND location_id = r.location_id FOR UPDATE;
     IF p_step = 'issue' THEN
       IF NOT staff THEN RETURN 'Inventory staff issue stock.'; END IF;
       IF r.state <> 'reserved' THEN RETURN 'Only a reserved request can be issued.'; END IF;
       UPDATE ast_stock SET on_hand = on_hand - r.qty, reserved = reserved - r.qty WHERE item_id = r.item_id AND location_id = r.location_id;
       INSERT INTO ast_moves (tenant_id, item_id, location_id, delta, kind, ref, by_user) VALUES (p_tenant, r.item_id, r.location_id, -r.qty, 'issue', r.id, p_actor);
       UPDATE ast_reservations SET state = 'issued', version = version + 1, updated_at = now() WHERE id = p_res;
     ELSIF p_step = 'cancel' THEN
       IF r.state <> 'reserved' THEN RETURN 'Only a reserved request can be cancelled.'; END IF;
       UPDATE ast_stock SET reserved = reserved - r.qty WHERE item_id = r.item_id AND location_id = r.location_id;
       UPDATE ast_reservations SET state = 'cancelled', version = version + 1, updated_at = now() WHERE id = p_res;
     ELSIF p_step = 'return' THEN
       IF NOT staff THEN RETURN 'Inventory staff record returns.'; END IF;
       IF r.state <> 'issued' THEN RETURN 'Only issued stock can be returned.'; END IF;
       IF p_qty IS NULL OR p_qty < 1 OR r.returned_qty + p_qty > r.qty THEN RETURN 'Only ' || (r.qty - r.returned_qty) || ' can still be returned.'; END IF;
       UPDATE ast_stock SET on_hand = on_hand + p_qty WHERE item_id = r.item_id AND location_id = r.location_id;
       INSERT INTO ast_moves (tenant_id, item_id, location_id, delta, kind, ref, by_user) VALUES (p_tenant, r.item_id, r.location_id, p_qty, 'return', r.id, p_actor);
       UPDATE ast_reservations SET returned_qty = returned_qty + p_qty, state = CASE WHEN returned_qty + p_qty = qty THEN 'returned' ELSE state END, version = version + 1, updated_at = now() WHERE id = p_res;
     ELSE RETURN 'Unknown step.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_count(p_tenant text, p_actor text, p_item bigint, p_location bigint, p_counted int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s ast_stock; v_id bigint;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only inventory staff record counts.'; END IF;
     SELECT * INTO s FROM ast_stock WHERE item_id = p_item AND location_id = p_location AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'That item is not stocked there.'; END IF;
     IF p_counted < 0 THEN RETURN 'A count cannot be negative.'; END IF;
     IF p_counted = s.on_hand THEN RETURN 'match'; END IF;
     UPDATE ast_adjustments SET state = 'superseded' WHERE item_id = p_item AND location_id = p_location AND state = 'pending';
     INSERT INTO ast_adjustments (tenant_id, item_id, location_id, on_hand_at_count, counted, delta, note, counted_by)
       VALUES (p_tenant, p_item, p_location, s.on_hand, p_counted, p_counted - s.on_hand, left(trim(coalesce(p_note, '')), 300), p_actor) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ast_adjust(p_tenant text, p_actor text, p_adj bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE j ast_adjustments; s ast_stock;
   BEGIN
     IF ast_kind(p_tenant, p_actor) IS DISTINCT FROM 'controller' THEN RETURN 'Only an inventory controller approves adjustments.'; END IF;
     SELECT * INTO j FROM ast_adjustments WHERE id = p_adj AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR j.state <> 'pending' THEN RETURN 'There is no pending adjustment with that number.'; END IF;
     IF j.counted_by = p_actor THEN RETURN 'Someone other than the person who counted must approve.'; END IF;
     SELECT * INTO s FROM ast_stock WHERE item_id = j.item_id AND location_id = j.location_id FOR UPDATE;
     IF p_approve THEN
       IF s.on_hand <> j.on_hand_at_count THEN RETURN 'Stock moved since this count; count again.'; END IF;
       IF s.on_hand + j.delta < s.reserved THEN RETURN 'This would leave less than is already reserved; release reservations first.'; END IF;
       UPDATE ast_stock SET on_hand = on_hand + j.delta WHERE item_id = j.item_id AND location_id = j.location_id;
       INSERT INTO ast_moves (tenant_id, item_id, location_id, delta, kind, ref, by_user) VALUES (p_tenant, j.item_id, j.location_id, j.delta, 'adjust', j.id, p_actor);
     ELSIF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Give a reason for rejecting.'; END IF;
     UPDATE ast_adjustments SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decision_note = trim(coalesce(p_note, '')) WHERE id = p_adj;
     RETURN NULL;
   END $$`,
];
