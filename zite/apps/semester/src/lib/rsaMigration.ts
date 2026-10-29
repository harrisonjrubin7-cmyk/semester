// E23 Research Administration: the institution's research request intake and project registry.
// Anyone at the institution can submit a request; research administrators (rsa_staff, granted by
// administrators) review, approve — assigning the project code that registers it — or decline with
// a reason, and close finished projects. Partner organizations submit collaboration requests
// through their agreement's submit_research_requests scope (pta_live), the last dangling partner
// scope from the 27 Oct partner note.
export const RSA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rsa_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS rsa_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, org_id bigint REFERENCES pta_orgs(id),
     requester_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160),
     summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 20 AND 4000),
     kind text NOT NULL CHECK (kind IN ('internal','external','collaboration')),
     amount_cents bigint NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','under_review','approved','declined','closed')),
     project_code text CHECK (project_code IS NULL OR project_code ~ '^[A-Z0-9-]{3,20}$'),
     decision_note text NOT NULL DEFAULT '', decided_by text, decided_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rsa_requests_code_uq ON rsa_requests (tenant_id, project_code) WHERE project_code IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS rsa_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id bigint NOT NULL, actor_id text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rsa_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rsa_events_append_only') THEN
       CREATE TRIGGER rsa_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rsa_events FOR EACH STATEMENT EXECUTE FUNCTION rsa_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_is_admin(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rsa_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION rsa_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own research administration access.'; END IF;
     IF p_on THEN INSERT INTO rsa_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE rsa_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_submit(p_actor text, p_tenant text, p_title text, p_summary text, p_kind text, p_amount bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     INSERT INTO rsa_requests (tenant_id, requester_id, title, summary, kind, amount_cents)
       VALUES (p_tenant, p_actor, trim(p_title), trim(p_summary), p_kind, coalesce(p_amount, 0)) RETURNING id INTO v_id;
     INSERT INTO rsa_events (tenant_id, request_id, actor_id, step) VALUES (p_tenant, v_id, p_actor, 'submit');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_submit_partner(p_actor text, p_tenant text, p_org bigint, p_title text, p_summary text, p_amount bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF pta_role(p_org, p_actor) IS NULL THEN RETURN 'You are not a member of that organization.'; END IF;
     IF NOT pta_live(p_tenant, p_org, 'submit_research_requests') THEN RETURN 'That agreement does not include research requests right now.'; END IF;
     INSERT INTO rsa_requests (tenant_id, org_id, requester_id, title, summary, kind, amount_cents)
       VALUES (p_tenant, p_org, p_actor, trim(p_title), trim(p_summary), 'collaboration', coalesce(p_amount, 0)) RETURNING id INTO v_id;
     INSERT INTO rsa_events (tenant_id, request_id, actor_id, step) VALUES (p_tenant, v_id, p_actor, 'submit.partner');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_review(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT rsa_is_admin(p_tenant, p_actor) THEN RETURN 'Only a research administrator can review requests.'; END IF;
     SELECT state INTO st FROM rsa_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF st <> 'submitted' THEN RETURN 'Only a submitted request can move to review.'; END IF;
     UPDATE rsa_requests SET state = 'under_review', updated_at = now() WHERE id = p_id;
     INSERT INTO rsa_events (tenant_id, request_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'review');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_decide(p_actor text, p_tenant text, p_id bigint, p_approve boolean, p_note text, p_code text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT rsa_is_admin(p_tenant, p_actor) THEN RETURN 'Only a research administrator can decide requests.'; END IF;
     SELECT state INTO st FROM rsa_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF st NOT IN ('submitted','under_review') THEN RETURN 'That request has already been decided.'; END IF;
     IF p_approve THEN
       IF p_code IS NULL OR upper(trim(p_code)) !~ '^[A-Z0-9-]{3,20}$' THEN RETURN 'Approving registers the project — give it a project code (letters, numbers, dashes).'; END IF;
       IF EXISTS (SELECT 1 FROM rsa_requests WHERE tenant_id = p_tenant AND project_code = upper(trim(p_code))) THEN RETURN 'That project code is already in use here.'; END IF;
       UPDATE rsa_requests SET state = 'approved', project_code = upper(trim(p_code)), decision_note = left(coalesce(p_note, ''), 500), decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_id;
       INSERT INTO rsa_events (tenant_id, request_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'approve', upper(trim(p_code)));
     ELSE
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the request is declined, in a few words.'; END IF;
       UPDATE rsa_requests SET state = 'declined', decision_note = left(p_note, 500), decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_id;
       INSERT INTO rsa_events (tenant_id, request_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'decline', left(p_note, 500));
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsa_close(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT rsa_is_admin(p_tenant, p_actor) THEN RETURN 'Only a research administrator can close projects.'; END IF;
     SELECT state INTO st FROM rsa_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF st <> 'approved' THEN RETURN 'Only an approved project can be closed.'; END IF;
     UPDATE rsa_requests SET state = 'closed', updated_at = now() WHERE id = p_id;
     INSERT INTO rsa_events (tenant_id, request_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'close');
     RETURN NULL;
   END $$`,
];
