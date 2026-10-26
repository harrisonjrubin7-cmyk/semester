// Migration its-001: IT Service Management (S-76 E15; mirrors lib/itsmRules.ts).
// Enforced here: IT agents and security staff are granted by an administrator, never themselves; service owners are set by
// an administrator. Tickets: idempotent open (same key + different content is refused), expected-version on every step,
// only the requester confirms, an agent close records that the requester did not confirm, incidents close only with a
// problem review, security incidents are handled only by security staff. Changes: raised by an agent, approved only by the
// service owner who did not raise it, approval pinned to the plan hash and withdrawn when the plan is edited, a normal
// change cannot be implemented unapproved, an emergency change needs a retrospective review. Closing a ticket never
// touches a linked change. History is append-only.
export const ITS_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS its_staff (tenant_id text NOT NULL, user_id text NOT NULL, agent boolean NOT NULL DEFAULT false, security boolean NOT NULL DEFAULT false,
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id), CHECK (agent OR security))`,
  `CREATE TABLE IF NOT EXISTS its_services (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
     description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000), owner_id text NOT NULL, active boolean NOT NULL DEFAULT true,
     set_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS its_changes (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, raiser_id text NOT NULL,
     service_id bigint NOT NULL REFERENCES its_services(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140),
     plan text NOT NULL CHECK (length(plan) BETWEEN 20 AND 6000), rollback_plan text NOT NULL CHECK (length(rollback_plan) BETWEEN 10 AND 3000),
     risk text NOT NULL CHECK (risk IN ('low','medium','high')), emergency boolean NOT NULL DEFAULT false, plan_hash text NOT NULL,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','approved','rejected','implemented','verified','rolled_back','reviewed')),
     version int NOT NULL DEFAULT 1, approved_hash text, approved_by text, outcome_note text NOT NULL DEFAULT '', review_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, raiser_id, request_key),
     CHECK (approved_by IS NULL OR approved_by <> raiser_id),
     CHECK (state <> 'approved' OR coalesce(approved_hash = plan_hash, false)),
     CHECK (emergency OR state NOT IN ('implemented','verified','rolled_back') OR coalesce(approved_hash = plan_hash, false)),
     CHECK (state <> 'reviewed' OR (emergency AND approved_hash IS NULL AND length(review_note) >= 20)))`,
  `CREATE TABLE IF NOT EXISTS its_tickets (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, requester_id text NOT NULL,
     service_id bigint REFERENCES its_services(id), kind text NOT NULL CHECK (kind IN ('request','incident','security_incident')),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140), description text NOT NULL CHECK (length(description) BETWEEN 10 AND 4000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','assigned','fulfilled','closed','cancelled')), version int NOT NULL DEFAULT 1,
     assignee_id text, resolution text NOT NULL DEFAULT '', review text NOT NULL DEFAULT '', confirmed boolean NOT NULL DEFAULT false,
     change_id bigint REFERENCES its_changes(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, requester_id, request_key),
     CHECK (state NOT IN ('assigned','fulfilled') OR assignee_id IS NOT NULL),
     CHECK (state <> 'closed' OR length(resolution) >= 10),
     CHECK (state <> 'closed' OR kind = 'request' OR length(review) >= 20))`,
  `CREATE TABLE IF NOT EXISTS its_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('ticket','change','service','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION its_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'its_events_append_only') THEN
       CREATE TRIGGER its_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON its_events FOR EACH STATEMENT EXECUTE FUNCTION its_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_hash(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(sha256(convert_to(p, 'UTF8')), 'hex') $$`,
  `CREATE OR REPLACE FUNCTION its_is(p_tenant text, p_user text, p_what text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT CASE p_what WHEN 'agent' THEN agent WHEN 'security' THEN security END FROM its_staff
       WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL), false) $$`,
  `CREATE OR REPLACE FUNCTION its_set_staff(p_admin text, p_tenant text, p_user text, p_agent boolean, p_security boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own IT access.'; END IF;
     IF NOT (p_agent OR p_security) THEN
       UPDATE its_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSE
       INSERT INTO its_staff (tenant_id, user_id, agent, security, granted_by) VALUES (p_tenant, p_user, p_agent, p_security, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET agent = EXCLUDED.agent, security = EXCLUDED.security, revoked_at = NULL, granted_by = p_admin, granted_at = now();
     END IF;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id, note)
       VALUES (p_tenant, 'staff', 0, 'set_staff', CASE WHEN p_agent OR p_security THEN concat_ws('+', CASE WHEN p_agent THEN 'agent' END, CASE WHEN p_security THEN 'security' END) ELSE 'revoked' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_service(p_tenant text, p_actor text, p_is_admin boolean, p_id bigint, p_name text, p_desc text, p_owner text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only administrators manage the service catalog and its owners.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO its_services (tenant_id, name, description, owner_id, active, set_by) VALUES (p_tenant, trim(p_name), trim(p_desc), p_owner, p_active, p_actor)
         ON CONFLICT (tenant_id, name) DO NOTHING RETURNING id INTO v_id;
       IF v_id IS NULL THEN RETURN 'A service with that name already exists.'; END IF;
     ELSE
       UPDATE its_services SET name = trim(p_name), description = trim(p_desc), owner_id = p_owner, active = p_active, set_by = p_actor
         WHERE id = p_id AND tenant_id = p_tenant RETURNING id INTO v_id;
       IF v_id IS NULL THEN RETURN 'Service not found.'; END IF;
     END IF;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'service', v_id, 'set_service', CASE WHEN p_active THEN 'active' ELSE 'inactive' END, p_actor, 'owner ' || p_owner);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_open(p_tenant text, p_key text, p_actor text, p_service bigint, p_kind text, p_title text, p_desc text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t its_tickets; v_id bigint;
   BEGIN
     SELECT * INTO t FROM its_tickets WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF t.kind = p_kind AND t.title = trim(p_title) AND t.description = trim(p_desc) AND t.service_id IS NOT DISTINCT FROM p_service THEN RETURN 'replay:' || t.id; END IF;
       RETURN 'That request was already sent with different details. Refresh and try again.';
     END IF;
     IF p_service IS NOT NULL AND NOT EXISTS (SELECT 1 FROM its_services WHERE id = p_service AND tenant_id = p_tenant AND active) THEN RETURN 'That service is not available.'; END IF;
     INSERT INTO its_tickets (tenant_id, request_key, requester_id, service_id, kind, title, description) VALUES (p_tenant, p_key, p_actor, p_service, p_kind, trim(p_title), trim(p_desc)) RETURNING id INTO v_id;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'ticket', v_id, 'open', 'open', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_tstep(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_assignee text, p_change bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t its_tickets; handler boolean; requester boolean; eligible boolean; v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO t FROM its_tickets WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Ticket not found.'; END IF;
     requester := t.requester_id = p_actor;
     handler := CASE WHEN t.kind = 'security_incident' THEN its_is(p_tenant, p_actor, 'security') ELSE its_is(p_tenant, p_actor, 'agent') OR its_is(p_tenant, p_actor, 'security') END;
     IF NOT requester AND NOT handler THEN RETURN 'Ticket not found.'; END IF;
     IF t.version <> p_expected THEN RETURN 'This ticket changed since you opened it. Refresh and try again.'; END IF;
     IF p_step IN ('assign','fulfill','close','link','review') AND (NOT handler OR requester) THEN RETURN 'Someone else in IT must handle your own ticket.'; END IF;
     IF p_step IN ('confirm','reopen','cancel') AND NOT requester THEN RETURN 'Only the person who opened the ticket can do that.'; END IF;
     v_to := CASE
       WHEN p_step = 'assign' AND t.state IN ('open','assigned') THEN 'assigned'
       WHEN p_step = 'fulfill' AND t.state = 'assigned' THEN 'fulfilled'
       WHEN p_step = 'confirm' AND t.state = 'fulfilled' THEN 'closed'
       WHEN p_step = 'reopen' AND t.state = 'fulfilled' THEN 'assigned'
       WHEN p_step = 'close' AND t.state = 'fulfilled' THEN 'closed'
       WHEN p_step = 'cancel' AND t.state IN ('open','assigned') THEN 'cancelled'
       WHEN p_step = 'review' AND t.kind <> 'request' AND t.state = 'fulfilled' THEN 'fulfilled'
       WHEN p_step = 'link' AND t.state NOT IN ('closed','cancelled') THEN t.state END;
     IF v_to IS NULL THEN RETURN 'That step is not open for this ticket now.'; END IF;
     IF p_step = 'assign' THEN
       eligible := (t.kind = 'security_incident' AND its_is(p_tenant, coalesce(p_assignee, p_actor), 'security'))
         OR (t.kind <> 'security_incident' AND (its_is(p_tenant, coalesce(p_assignee, p_actor), 'agent') OR its_is(p_tenant, coalesce(p_assignee, p_actor), 'security')));
       IF NOT eligible AND t.kind = 'security_incident' THEN RETURN 'Security incidents can only go to security staff.'; END IF;
       IF NOT eligible THEN RETURN 'That person is not an IT agent.'; END IF;
       IF coalesce(p_assignee, p_actor) = t.requester_id THEN RETURN 'A ticket cannot be assigned to the person who opened it.'; END IF;
     END IF;
     IF p_step = 'fulfill' AND length(n) < 10 THEN RETURN 'Say what was done (at least 10 characters).'; END IF;
     IF p_step IN ('close','review') AND t.kind <> 'request' AND length(n) < 20 THEN RETURN 'Closing an incident needs a problem review: the cause and what prevents it again (at least 20 characters).'; END IF;
     IF p_step = 'close' AND t.kind = 'request' AND length(n) < 5 THEN RETURN 'Give a reason for closing without the requester''s confirmation.'; END IF;
     IF p_step = 'confirm' AND t.kind <> 'request' AND length(t.review) < 20 THEN RETURN 'IT records a problem review before an incident closes. You can still reopen it.'; END IF;
     IF p_step = 'reopen' AND length(n) < 5 THEN RETURN 'Say what is still wrong.'; END IF;
     IF p_step = 'link' AND NOT EXISTS (SELECT 1 FROM its_changes WHERE id = p_change AND tenant_id = p_tenant) THEN RETURN 'Change not found.'; END IF;
     UPDATE its_tickets SET state = v_to, version = version + 1, updated_at = now(),
       assignee_id = CASE WHEN p_step = 'assign' THEN coalesce(p_assignee, p_actor) ELSE assignee_id END,
       resolution = CASE WHEN p_step = 'fulfill' THEN n ELSE resolution END,
       review = CASE WHEN p_step IN ('close','review') AND t.kind <> 'request' THEN n ELSE review END,
       confirmed = CASE WHEN p_step = 'confirm' THEN true WHEN p_step = 'close' THEN false ELSE confirmed END,
       change_id = CASE WHEN p_step = 'link' THEN p_change ELSE change_id END
       WHERE id = p_id;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'ticket', p_id, p_step, v_to, p_actor, left(n, 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_change_open(p_tenant text, p_key text, p_actor text, p_service bigint, p_title text, p_plan text, p_rollback text, p_risk text, p_emergency boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c its_changes; v_id bigint; h text := its_hash(trim(p_plan) || E'\\n--rollback--\\n' || trim(p_rollback));
   BEGIN
     IF NOT its_is(p_tenant, p_actor, 'agent') THEN RETURN 'Only IT agents raise changes.'; END IF;
     SELECT * INTO c FROM its_changes WHERE tenant_id = p_tenant AND raiser_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF c.plan_hash = h AND c.title = trim(p_title) AND c.service_id = p_service THEN RETURN 'replay:' || c.id; END IF;
       RETURN 'That change was already raised with different details. Refresh and try again.';
     END IF;
     IF NOT EXISTS (SELECT 1 FROM its_services WHERE id = p_service AND tenant_id = p_tenant AND active) THEN RETURN 'That service is not available.'; END IF;
     INSERT INTO its_changes (tenant_id, request_key, raiser_id, service_id, title, plan, rollback_plan, risk, emergency, plan_hash)
       VALUES (p_tenant, p_key, p_actor, p_service, trim(p_title), trim(p_plan), trim(p_rollback), p_risk, p_emergency, h) RETURNING id INTO v_id;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'change', v_id, 'raise', 'submitted', p_actor, CASE WHEN p_emergency THEN 'emergency' ELSE p_risk END);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION its_cstep(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_plan text, p_rollback text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c its_changes; owner boolean; raiser boolean; v_to text; n text := trim(coalesce(p_note, '')); h text;
   BEGIN
     SELECT * INTO c FROM its_changes WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Change not found.'; END IF;
     owner := EXISTS (SELECT 1 FROM its_services WHERE id = c.service_id AND owner_id = p_actor);
     raiser := c.raiser_id = p_actor;
     IF NOT owner AND NOT raiser AND NOT its_is(p_tenant, p_actor, 'agent') THEN RETURN 'Change not found.'; END IF;
     IF c.version <> p_expected THEN RETURN 'This change was updated since you opened it. Refresh and try again.'; END IF;
     v_to := CASE
       WHEN p_step = 'edit' AND raiser AND c.state IN ('submitted','approved','rejected') THEN 'submitted'
       WHEN p_step = 'approve' AND owner AND NOT raiser AND c.state = 'submitted' THEN 'approved'
       WHEN p_step = 'reject' AND owner AND NOT raiser AND c.state IN ('submitted','approved') THEN 'rejected'
       WHEN p_step = 'implement' AND raiser AND (c.state = 'approved' OR (c.emergency AND c.state = 'submitted')) THEN 'implemented'
       WHEN p_step = 'verify' AND (raiser OR owner) AND c.state = 'implemented' THEN 'verified'
       WHEN p_step = 'roll_back' AND (raiser OR owner) AND c.state = 'implemented' THEN 'rolled_back'
       WHEN p_step = 'review' AND owner AND NOT raiser AND c.emergency AND c.approved_hash IS NULL AND c.state IN ('verified','rolled_back') THEN 'reviewed' END;
     IF v_to IS NULL THEN
       IF p_step IN ('approve','reject','review') AND raiser THEN RETURN 'The service owner reviews a change; you cannot approve or review your own.'; END IF;
       IF p_step = 'implement' AND NOT c.emergency THEN RETURN 'A change is made only after the service owner approves this exact plan.'; END IF;
       RETURN 'That step is not open for this change now.';
     END IF;
     IF p_step = 'reject' AND length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
     IF p_step IN ('verify','roll_back') AND length(n) < 10 THEN RETURN 'Record what was checked (at least 10 characters).'; END IF;
     IF p_step = 'review' AND length(n) < 20 THEN RETURN 'A retrospective review needs at least 20 characters.'; END IF;
     IF p_step = 'edit' THEN
       IF length(trim(coalesce(p_plan, ''))) < 20 OR length(trim(coalesce(p_rollback, ''))) < 10 THEN RETURN 'A plan needs at least 20 characters and a rollback plan at least 10.'; END IF;
       h := its_hash(trim(p_plan) || E'\\n--rollback--\\n' || trim(p_rollback));
       UPDATE its_changes SET plan = trim(p_plan), rollback_plan = trim(p_rollback), plan_hash = h, approved_hash = NULL, approved_by = NULL,
         state = 'submitted', version = version + 1, updated_at = now() WHERE id = p_id;
     ELSE
       UPDATE its_changes SET state = v_to, version = version + 1, updated_at = now(),
         approved_hash = CASE WHEN p_step = 'approve' THEN plan_hash WHEN p_step = 'reject' THEN NULL ELSE approved_hash END,
         approved_by = CASE WHEN p_step = 'approve' THEN p_actor WHEN p_step = 'reject' THEN NULL ELSE approved_by END,
         outcome_note = CASE WHEN p_step IN ('verify','roll_back') THEN n ELSE outcome_note END,
         review_note = CASE WHEN p_step = 'review' THEN n ELSE review_note END
         WHERE id = p_id;
     END IF;
     INSERT INTO its_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'change', p_id, p_step, v_to, p_actor, left(n, 500));
     RETURN NULL;
   END $$`,
];
