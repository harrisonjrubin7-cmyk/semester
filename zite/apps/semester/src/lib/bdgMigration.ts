// E11 Budget and Planning: the planning layer above procurement's operational budgets (prc_budgets).
// A planner drafts a fiscal-year plan of quarterly amounts per budget code; a different approver
// approves it. Approving a new version supersedes the year's previous approved plan, so exactly one
// approved plan per year is ever in force. Plans move no money: the variance view compares the
// approved plan with procurement commitments (prc_used), which stay procurement's own record.
export const BDG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS bdg_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('planner','approver')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS bdg_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, fiscal_year int NOT NULL CHECK (fiscal_year BETWEEN 2020 AND 2100),
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120), state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','proposed','approved','superseded')),
     version int NOT NULL, created_by text NOT NULL, approved_by text, approved_at timestamptz, decision_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, fiscal_year, version))`,
  `CREATE TABLE IF NOT EXISTS bdg_lines (plan_id bigint NOT NULL REFERENCES bdg_plans(id), code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
     label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 120), q1 bigint NOT NULL DEFAULT 0 CHECK (q1 >= 0), q2 bigint NOT NULL DEFAULT 0 CHECK (q2 >= 0),
     q3 bigint NOT NULL DEFAULT 0 CHECK (q3 >= 0), q4 bigint NOT NULL DEFAULT 0 CHECK (q4 >= 0), note text NOT NULL DEFAULT '', PRIMARY KEY (plan_id, code))`,
  `CREATE TABLE IF NOT EXISTS bdg_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, plan_id bigint NOT NULL, actor_id text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION bdg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'bdg_events_append_only') THEN
       CREATE TRIGGER bdg_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON bdg_events FOR EACH STATEMENT EXECUTE FUNCTION bdg_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM bdg_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION bdg_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own budget-planning access.'; END IF;
     IF p_role NOT IN ('planner','approver') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO bdg_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE bdg_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_create(p_actor text, p_tenant text, p_year int, p_name text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; v_ver int;
   BEGIN
     IF NOT bdg_has(p_tenant, p_actor, 'planner') THEN RETURN 'Only a budget planner can start a plan.'; END IF;
     IF EXISTS (SELECT 1 FROM bdg_plans WHERE tenant_id = p_tenant AND fiscal_year = p_year AND state IN ('draft','proposed')) THEN RETURN 'A plan for that year is already open. Finish or decide it first.'; END IF;
     SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM bdg_plans WHERE tenant_id = p_tenant AND fiscal_year = p_year;
     INSERT INTO bdg_plans (tenant_id, fiscal_year, name, version, created_by) VALUES (p_tenant, p_year, trim(p_name), v_ver, p_actor) RETURNING id INTO v_id;
     INSERT INTO bdg_events (tenant_id, plan_id, actor_id, step, note) VALUES (p_tenant, v_id, p_actor, 'create', trim(p_name));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_set_line(p_actor text, p_tenant text, p_plan bigint, p_code text, p_label text, p_q1 bigint, p_q2 bigint, p_q3 bigint, p_q4 bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT bdg_has(p_tenant, p_actor, 'planner') THEN RETURN 'Only a budget planner can edit plan lines.'; END IF;
     SELECT state INTO st FROM bdg_plans WHERE id = p_plan AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Plan not found.'; END IF;
     IF st <> 'draft' THEN RETURN 'Only a draft plan can be edited.'; END IF;
     INSERT INTO bdg_lines (plan_id, code, label, q1, q2, q3, q4) VALUES (p_plan, upper(trim(p_code)), trim(p_label), p_q1, p_q2, p_q3, p_q4)
       ON CONFLICT (plan_id, code) DO UPDATE SET label = EXCLUDED.label, q1 = EXCLUDED.q1, q2 = EXCLUDED.q2, q3 = EXCLUDED.q3, q4 = EXCLUDED.q4;
     UPDATE bdg_plans SET updated_at = now() WHERE id = p_plan;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_remove_line(p_actor text, p_tenant text, p_plan bigint, p_code text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT bdg_has(p_tenant, p_actor, 'planner') THEN RETURN 'Only a budget planner can edit plan lines.'; END IF;
     SELECT state INTO st FROM bdg_plans WHERE id = p_plan AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Plan not found.'; END IF;
     IF st <> 'draft' THEN RETURN 'Only a draft plan can be edited.'; END IF;
     DELETE FROM bdg_lines WHERE plan_id = p_plan AND code = upper(trim(p_code));
     IF NOT FOUND THEN RETURN 'That line is not in the plan.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_propose(p_actor text, p_tenant text, p_plan bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT bdg_has(p_tenant, p_actor, 'planner') THEN RETURN 'Only a budget planner can propose a plan.'; END IF;
     SELECT state INTO st FROM bdg_plans WHERE id = p_plan AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Plan not found.'; END IF;
     IF st <> 'draft' THEN RETURN 'Only a draft plan can be proposed.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM bdg_lines WHERE plan_id = p_plan) THEN RETURN 'Add at least one budget line first.'; END IF;
     UPDATE bdg_plans SET state = 'proposed', updated_at = now() WHERE id = p_plan;
     INSERT INTO bdg_events (tenant_id, plan_id, actor_id, step) VALUES (p_tenant, p_plan, p_actor, 'propose');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION bdg_decide(p_actor text, p_tenant text, p_plan bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pl bdg_plans;
   BEGIN
     IF NOT bdg_has(p_tenant, p_actor, 'approver') THEN RETURN 'Only a budget approver can decide a plan.'; END IF;
     SELECT * INTO pl FROM bdg_plans WHERE id = p_plan AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Plan not found.'; END IF;
     IF pl.state <> 'proposed' THEN RETURN 'Only a proposed plan can be decided.'; END IF;
     IF pl.created_by = p_actor THEN RETURN 'The planner who wrote this plan cannot approve it. Ask another approver.'; END IF;
     IF p_approve THEN
       WITH old AS (UPDATE bdg_plans SET state = 'superseded', updated_at = now() WHERE tenant_id = p_tenant AND fiscal_year = pl.fiscal_year AND state = 'approved' AND id <> p_plan RETURNING id)
       INSERT INTO bdg_events (tenant_id, plan_id, actor_id, step, note) SELECT p_tenant, id, p_actor, 'supersede', 'Superseded by version ' || pl.version FROM old;
       UPDATE bdg_plans SET state = 'approved', approved_by = p_actor, approved_at = now(), decision_note = left(coalesce(p_note, ''), 500), updated_at = now() WHERE id = p_plan;
       INSERT INTO bdg_events (tenant_id, plan_id, actor_id, step, note) VALUES (p_tenant, p_plan, p_actor, 'approve', left(coalesce(p_note, ''), 500));
     ELSE
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the plan goes back, in a few words.'; END IF;
       UPDATE bdg_plans SET state = 'draft', decision_note = left(p_note, 500), updated_at = now() WHERE id = p_plan;
       INSERT INTO bdg_events (tenant_id, plan_id, actor_id, step, note) VALUES (p_tenant, p_plan, p_actor, 'send_back', left(p_note, 500));
     END IF;
     RETURN NULL;
   END $$`,
];
