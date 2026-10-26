// Migration fac-001: facilities work management (S-76 E13; mirrors lib/facilitiesRules.ts).
// Enforced here: roles are granted by an administrator, never themselves, and contractor grants must carry an end date
// after which fac_kind returns nothing; idempotent report submission; a duplicate points at the open report it repeats;
// work orders are authorized before assignment; contractors are never assigned to restricted locations; only the current
// assignee (with live access) starts and completes work, completion needs at least 20 characters of evidence (table
// CHECK), and a coordinator other than the assignee closes or reopens; a plan generates each due order once (unique
// plan + due date); expected-version on every step; history is append-only.
export const FAC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fac_staff (tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('coordinator','technician','contractor')),
     expires_at timestamptz, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id), CHECK (kind <> 'contractor' OR expires_at IS NOT NULL))`,
  `CREATE OR REPLACE FUNCTION fac_kind(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT kind FROM fac_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) $$`,
  `CREATE TABLE IF NOT EXISTS fac_locations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, building text NOT NULL CHECK (length(trim(building)) BETWEEN 1 AND 80),
     area text NOT NULL DEFAULT '' CHECK (length(area) <= 80), restricted boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, UNIQUE (tenant_id, building, area))`,
  `CREATE TABLE IF NOT EXISTS fac_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, location_id bigint NOT NULL REFERENCES fac_locations(id),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 140), every_days int NOT NULL CHECK (every_days BETWEEN 1 AND 3650), next_due date NOT NULL,
     active boolean NOT NULL DEFAULT true, created_by text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fac_orders (id bigserial PRIMARY KEY, tenant_id text NOT NULL, location_id bigint NOT NULL REFERENCES fac_locations(id),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 140), detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 4000),
     priority text NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1','p2','p3','p4')), state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','authorized','assigned','in_progress','completed','closed','cancelled')),
     version int NOT NULL DEFAULT 1, created_by text NOT NULL, authorized_by text, assignee_id text, evidence text NOT NULL DEFAULT '', closed_by text, note text NOT NULL DEFAULT '',
     plan_id bigint REFERENCES fac_plans(id), due_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (state NOT IN ('assigned','in_progress','completed','closed') OR (authorized_by IS NOT NULL AND assignee_id IS NOT NULL)),
     CHECK (state NOT IN ('completed','closed') OR length(evidence) >= 20),
     CHECK (closed_by IS NULL OR closed_by <> assignee_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fac_orders_plan_due ON fac_orders (plan_id, due_date) WHERE plan_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS fac_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, requester_id text NOT NULL,
     location_id bigint NOT NULL REFERENCES fac_locations(id), category text NOT NULL CHECK (category IN ('plumbing','electrical','heating_cooling','lighting','doors_locks','cleaning','grounds','safety_hazard','other')),
     description text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000), state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','triaged','duplicate','declined','converted')),
     version int NOT NULL DEFAULT 1, duplicate_of bigint REFERENCES fac_requests(id), order_id bigint REFERENCES fac_orders(id), created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, requester_id, request_key), CHECK (state <> 'duplicate' OR duplicate_of IS NOT NULL), CHECK (state <> 'converted' OR order_id IS NOT NULL), CHECK (duplicate_of IS DISTINCT FROM id))`,
  `CREATE TABLE IF NOT EXISTS fac_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('request','order','plan','location','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL DEFAULT '', actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION fac_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fac_events_append_only') THEN
       CREATE TRIGGER fac_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON fac_events FOR EACH STATEMENT EXECUTE FUNCTION fac_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_set_staff(p_admin text, p_tenant text, p_user text, p_kind text, p_expires timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own facilities access.'; END IF;
     IF p_kind IS NULL THEN UPDATE fac_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_kind NOT IN ('coordinator','technician','contractor') THEN RETURN 'Unknown facilities role.';
     ELSIF p_kind = 'contractor' AND (p_expires IS NULL OR p_expires <= now()) THEN RETURN 'Contractor access needs an end date in the future.';
     ELSE INSERT INTO fac_staff (tenant_id, user_id, kind, expires_at, granted_by) VALUES (p_tenant, p_user, p_kind, CASE WHEN p_kind = 'contractor' THEN p_expires END, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, expires_at = EXCLUDED.expires_at, revoked_at = NULL, granted_by = p_admin, granted_at = now(); END IF;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'staff', 0, 'set_staff', coalesce(p_kind, 'revoked'), p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_location(p_tenant text, p_actor text, p_building text, p_area text, p_restricted boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF fac_kind(p_tenant, p_actor) IS DISTINCT FROM 'coordinator' THEN RETURN 'Only facilities coordinators add locations.'; END IF;
     INSERT INTO fac_locations (tenant_id, building, area, restricted) VALUES (p_tenant, trim(p_building), trim(coalesce(p_area, '')), p_restricted)
       ON CONFLICT (tenant_id, building, area) DO UPDATE SET restricted = EXCLUDED.restricted RETURNING id INTO v_id;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'location', v_id, 'set_location', CASE WHEN p_restricted THEN 'restricted' ELSE 'open' END, p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_report(p_tenant text, p_key text, p_actor text, p_location bigint, p_category text, p_desc text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r fac_requests; v_id bigint;
   BEGIN
     SELECT * INTO r FROM fac_requests WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN r.location_id = p_location AND r.category = p_category AND r.description = trim(p_desc) THEN 'replay:' || r.id ELSE 'That report was already sent with different details.' END; END IF;
     IF NOT EXISTS (SELECT 1 FROM fac_locations WHERE id = p_location AND tenant_id = p_tenant AND active) THEN RETURN 'Choose a location from the list.'; END IF;
     INSERT INTO fac_requests (tenant_id, request_key, requester_id, location_id, category, description) VALUES (p_tenant, p_key, p_actor, p_location, p_category, trim(p_desc)) RETURNING id INTO v_id;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'request', v_id, 'report', 'open', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_triage(p_tenant text, p_actor text, p_req bigint, p_expected int, p_step text, p_dup bigint, p_title text, p_priority text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r fac_requests; d fac_requests; o bigint;
   BEGIN
     IF fac_kind(p_tenant, p_actor) IS DISTINCT FROM 'coordinator' THEN RETURN 'Only facilities coordinators triage reports.'; END IF;
     SELECT * INTO r FROM fac_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Report not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This report changed since you opened it. Refresh and try again.'; END IF;
     IF r.state NOT IN ('open','triaged') THEN RETURN 'This report has already been handled.'; END IF;
     IF p_step = 'duplicate' THEN
       SELECT * INTO d FROM fac_requests WHERE id = p_dup AND tenant_id = p_tenant;
       IF NOT FOUND OR d.id = r.id OR d.state IN ('declined','duplicate') THEN RETURN 'Point to an earlier report that is still being handled.'; END IF;
       UPDATE fac_requests SET state = 'duplicate', duplicate_of = d.id, order_id = d.order_id, version = version + 1 WHERE id = p_req;
     ELSIF p_step = 'decline' THEN
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Give a reason.'; END IF;
       UPDATE fac_requests SET state = 'declined', version = version + 1 WHERE id = p_req;
     ELSIF p_step = 'triage' THEN
       UPDATE fac_requests SET state = 'triaged', version = version + 1 WHERE id = p_req;
     ELSIF p_step = 'convert' THEN
       INSERT INTO fac_orders (tenant_id, location_id, title, detail, priority, created_by) VALUES (p_tenant, r.location_id, trim(coalesce(nullif(p_title, ''), initcap(replace(r.category, '_', ' ')))), r.description, coalesce(p_priority, 'p3'), p_actor) RETURNING id INTO o;
       UPDATE fac_requests SET state = 'converted', order_id = o, version = version + 1 WHERE id = p_req;
       INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'order', o, 'create', 'new', p_actor, 'from report ' || p_req);
     ELSE RETURN 'Unknown step.'; END IF;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'request', p_req, p_step, p_step, p_actor, left(trim(coalesce(p_note, '')), 300));
     RETURN CASE WHEN o IS NULL THEN NULL ELSE 'order:' || o END;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_create_order(p_tenant text, p_actor text, p_location bigint, p_title text, p_detail text, p_priority text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF fac_kind(p_tenant, p_actor) IS DISTINCT FROM 'coordinator' THEN RETURN 'Only facilities coordinators create work orders.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM fac_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Location not found.'; END IF;
     INSERT INTO fac_orders (tenant_id, location_id, title, detail, priority, created_by) VALUES (p_tenant, p_location, trim(p_title), trim(coalesce(p_detail, '')), p_priority, p_actor) RETURNING id INTO v_id;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'order', v_id, 'create', 'new', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_ostep(p_tenant text, p_actor text, p_id bigint, p_step text, p_expected int, p_note text, p_assignee text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o fac_orders; k text := fac_kind(p_tenant, p_actor); ak text; aexp timestamptz; restr boolean; v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO o FROM fac_orders WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR k IS NULL OR (k <> 'coordinator' AND o.assignee_id IS DISTINCT FROM p_actor) THEN RETURN 'Work order not found.'; END IF;
     IF o.version <> p_expected THEN RETURN 'This work order changed since you opened it. Refresh and try again.'; END IF;
     v_to := CASE
       WHEN p_step = 'authorize' AND k = 'coordinator' AND o.state = 'new' THEN 'authorized'
       WHEN p_step = 'assign' AND k = 'coordinator' AND o.state IN ('authorized','assigned') THEN 'assigned'
       WHEN p_step = 'start' AND o.assignee_id = p_actor AND o.state = 'assigned' THEN 'in_progress'
       WHEN p_step = 'complete' AND o.assignee_id = p_actor AND o.state = 'in_progress' THEN 'completed'
       WHEN p_step = 'close' AND k = 'coordinator' AND o.assignee_id <> p_actor AND o.state = 'completed' THEN 'closed'
       WHEN p_step = 'reopen' AND k = 'coordinator' AND o.assignee_id <> p_actor AND o.state = 'completed' THEN 'assigned'
       WHEN p_step = 'cancel' AND k = 'coordinator' AND o.state IN ('new','authorized','assigned') THEN 'cancelled' END;
     IF v_to IS NULL THEN
       IF p_step = 'assign' AND o.state = 'new' THEN RETURN 'Authorize the work before assigning it.'; END IF;
       IF p_step IN ('close','reopen') AND o.assignee_id = p_actor THEN RETURN 'Another coordinator inspects work you did.'; END IF;
       RETURN 'That step is not open for this work order now.';
     END IF;
     IF p_step = 'assign' THEN
       SELECT kind, expires_at INTO ak, aexp FROM fac_staff WHERE tenant_id = p_tenant AND user_id = p_assignee AND revoked_at IS NULL;
       IF ak IS NULL OR ak NOT IN ('technician','contractor') THEN RETURN 'Assign work to a technician or contractor.'; END IF;
       IF ak = 'contractor' AND aexp <= now() THEN RETURN 'That contractor''s access has ended.'; END IF;
       SELECT restricted INTO restr FROM fac_locations WHERE id = o.location_id;
       IF ak = 'contractor' AND restr THEN RETURN 'Contractors are not assigned to restricted locations.'; END IF;
     END IF;
     IF p_step = 'complete' AND length(n) < 20 THEN RETURN 'Describe the completed work and how it was checked (at least 20 characters).'; END IF;
     IF p_step IN ('reopen','cancel') AND length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
     UPDATE fac_orders SET state = v_to, version = version + 1, updated_at = now(),
       authorized_by = CASE WHEN p_step = 'authorize' THEN p_actor ELSE authorized_by END,
       assignee_id = CASE WHEN p_step = 'assign' THEN p_assignee ELSE assignee_id END,
       evidence = CASE WHEN p_step = 'complete' THEN n WHEN p_step = 'reopen' THEN '' ELSE evidence END,
       closed_by = CASE WHEN p_step = 'close' THEN p_actor ELSE closed_by END,
       note = CASE WHEN p_step IN ('reopen','cancel') THEN n ELSE note END WHERE id = p_id;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'order', p_id, p_step, v_to, p_actor, left(n, 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_plan(p_tenant text, p_actor text, p_location bigint, p_title text, p_every int, p_first date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF fac_kind(p_tenant, p_actor) IS DISTINCT FROM 'coordinator' THEN RETURN 'Only facilities coordinators plan maintenance.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM fac_locations WHERE id = p_location AND tenant_id = p_tenant) THEN RETURN 'Location not found.'; END IF;
     INSERT INTO fac_plans (tenant_id, location_id, title, every_days, next_due, created_by) VALUES (p_tenant, p_location, trim(p_title), p_every, p_first, p_actor) RETURNING id INTO v_id;
     INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'plan', v_id, 'create', 'active', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fac_generate(p_tenant text, p_actor text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p fac_plans; made int := 0; o bigint;
   BEGIN
     IF fac_kind(p_tenant, p_actor) IS DISTINCT FROM 'coordinator' THEN RETURN 'Only facilities coordinators generate planned work.'; END IF;
     FOR p IN SELECT * FROM fac_plans WHERE tenant_id = p_tenant AND active AND next_due <= current_date FOR UPDATE LOOP
       INSERT INTO fac_orders (tenant_id, location_id, title, detail, priority, created_by, plan_id, due_date)
         VALUES (p_tenant, p.location_id, p.title, 'Scheduled maintenance', 'p3', p_actor, p.id, p.next_due) ON CONFLICT (plan_id, due_date) WHERE plan_id IS NOT NULL DO NOTHING RETURNING id INTO o;
       IF o IS NOT NULL THEN made := made + 1; INSERT INTO fac_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'order', o, 'generate', 'new', p_actor, 'plan ' || p.id); END IF;
       UPDATE fac_plans SET next_due = next_due + every_days WHERE id = p.id;
       o := NULL;
     END LOOP;
     RETURN 'made:' || made;
   END $$`,
];
