// Migration mig-001: Implementation Delivery / domain migration (APP-024; book gap register P0: domain inventory, cutover,
// rollback window). This is the CONTROL PLANE for a migration: it gates and records each stage. It does not move data.
// Gate (drill-down spec): "failed reconciliation blocks authority promotion; implementation completion is not assumed from
// a successful import". Institution approval comes from the institution's own administrator (Semester app console) and is
// bound to the evidence they saw. One mig_cmd()/mig_institution_approve() call = one transaction. Requires co_has().
export const MIG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS mig_projects (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, tenant_name text NOT NULL DEFAULT '',
     domain text NOT NULL CHECK (domain IN ('registrar', 'student_accounts', 'courses', 'identity', 'campus_services', 'other')), title text NOT NULL,
     stage text NOT NULL DEFAULT 'inventory' CHECK (stage IN ('inventory', 'mapping', 'validation', 'dual_run', 'awaiting_approval', 'rollback_window', 'completed', 'rolled_back')),
     lead_id text NOT NULL, mapping_note text, rollback_plan text, rollback_hours int NOT NULL DEFAULT 72 CHECK (rollback_hours BETWEEN 24 AND 720),
     cutover_at timestamptz, window_ends_at timestamptz, ended_reason text, version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS mig_inventory (id bigserial PRIMARY KEY, project_id text NOT NULL REFERENCES mig_projects(id), item text NOT NULL, source_system text NOT NULL,
     record_count int NOT NULL CHECK (record_count >= 0), owner text NOT NULL, added_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS mig_runs (id bigserial PRIMARY KEY, project_id text NOT NULL REFERENCES mig_projects(id),
     kind text NOT NULL CHECK (kind IN ('validation', 'dual_run', 'post_cutover')), source_count int NOT NULL CHECK (source_count >= 0), target_count int NOT NULL CHECK (target_count >= 0),
     mismatches int NOT NULL CHECK (mismatches >= 0), passed boolean GENERATED ALWAYS AS (mismatches = 0 AND source_count = target_count AND source_count > 0) STORED,
     note text NOT NULL DEFAULT '', recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS mig_approvals (id bigserial PRIMARY KEY, project_id text NOT NULL REFERENCES mig_projects(id), tenant_id text NOT NULL, approver_id text NOT NULL,
     evidence_hash text NOT NULL, note text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS mig_commands (actor_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS mig_receipts (actor_id text NOT NULL, command_key text NOT NULL, project_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (actor_id, command_key), FOREIGN KEY (actor_id, command_key) REFERENCES mig_commands (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS mig_timeline (id bigserial PRIMARY KEY, project_id text NOT NULL REFERENCES mig_projects(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION mig_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS mig_runs_append_only ON mig_runs`,
  `CREATE TRIGGER mig_runs_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mig_runs FOR EACH STATEMENT EXECUTE FUNCTION mig_refuse_change()`,
  `DROP TRIGGER IF EXISTS mig_approvals_append_only ON mig_approvals`,
  `CREATE TRIGGER mig_approvals_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mig_approvals FOR EACH STATEMENT EXECUTE FUNCTION mig_refuse_change()`,
  `DROP TRIGGER IF EXISTS mig_timeline_append_only ON mig_timeline`,
  `CREATE TRIGGER mig_timeline_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mig_timeline FOR EACH STATEMENT EXECUTE FUNCTION mig_refuse_change()`,
  `DROP TRIGGER IF EXISTS mig_receipts_append_only ON mig_receipts`,
  `CREATE TRIGGER mig_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mig_receipts FOR EACH STATEMENT EXECUTE FUNCTION mig_refuse_change()`,
  // What the institution approves: the latest dual-run evidence, the rollback plan and window. Changes after approval void it.
  `CREATE OR REPLACE FUNCTION mig_evidence_hash(p_project text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT md5(concat_ws('|', p.id, p.domain, coalesce(p.rollback_plan, ''), p.rollback_hours,
       coalesce((SELECT string_agg(r.id::text || ':' || r.passed, ',' ORDER BY r.id) FROM mig_runs r WHERE r.project_id = p.id AND r.kind = 'dual_run'), '')))
     FROM mig_projects p WHERE p.id = p_project $$`,
  `CREATE OR REPLACE FUNCTION mig_latest_passed(p_project text, p_kind text, p_after timestamptz) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT r.passed FROM mig_runs r WHERE r.project_id = p_project AND r.kind = p_kind AND r.at > coalesce(p_after, '-infinity') ORDER BY r.id DESC LIMIT 1), false) $$`,
  `CREATE OR REPLACE FUNCTION mig_cmd(p_actor text, p_key text, p_hash text, p_action text, p_id text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c mig_commands%ROWTYPE; m mig_projects%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_id; v_detail text := ''; v_n int; v_runs int;
BEGIN
  SELECT * INTO c FROM mig_commands WHERE actor_id = p_actor AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'id', project_id, 'resultCode', result_code, 'message', message) FROM mig_receipts WHERE actor_id = p_actor AND command_key = p_key);
  END IF;
  INSERT INTO mig_commands (actor_id, command_key, payload_hash, action) VALUES (p_actor, p_key, p_hash, p_action);

  IF NOT co_has(p_actor, 'impl_lead') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Migration steps need the implementation lead role.';
  ELSIF p_action = 'create' THEN
    IF coalesce(p->>'tenantId', '') = '' OR length(trim(coalesce(p->>'title', ''))) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Choose the institution and give the migration a title.';
    ELSIF coalesce(p->>'domain', '') NOT IN ('registrar', 'student_accounts', 'courses', 'identity', 'campus_services', 'other') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose a domain.';
    ELSE v_id := 'mig_' || substr(md5(p_actor || '|' || p_key), 1, 12);
      INSERT INTO mig_projects (id, tenant_id, tenant_name, domain, title, lead_id) VALUES (v_id, p->>'tenantId', coalesce(p->>'tenantName', ''), p->>'domain', trim(p->>'title'), p_actor);
      v_msg := 'Migration created at the inventory stage.'; v_detail := p->>'domain'; END IF;
  ELSE
    SELECT * INTO m FROM mig_projects WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN v_code := 'NOT_FOUND'; v_msg := 'Migration not found.';
    ELSIF (p->>'version')::int IS DISTINCT FROM m.version THEN v_code := 'STALE'; v_msg := 'This migration changed since you opened it. Reload and try again.';
    ELSIF m.stage IN ('completed', 'rolled_back') THEN v_code := 'CLOSED'; v_msg := 'This migration is finished.';
    ELSIF p_action = 'inventory' THEN
      IF m.stage NOT IN ('inventory', 'mapping') THEN v_code := 'BAD_STATE'; v_msg := 'Inventory is edited before validation starts.';
      ELSIF length(trim(coalesce(p->>'item', ''))) < 3 OR coalesce(p->>'sourceSystem', '') = '' OR coalesce(p->>'owner', '') = '' OR coalesce((p->>'recordCount')::int, -1) < 0 THEN
        v_code := 'BAD_INPUT'; v_msg := 'An inventory item needs a name, source system, record count and owner.';
      ELSE INSERT INTO mig_inventory (project_id, item, source_system, record_count, owner, added_by) VALUES (m.id, trim(p->>'item'), p->>'sourceSystem', (p->>'recordCount')::int, p->>'owner', p_actor);
        v_msg := 'Inventory item added.'; v_detail := trim(p->>'item'); END IF;
    ELSIF p_action = 'plan' THEN
      IF m.stage NOT IN ('inventory', 'mapping', 'validation', 'dual_run') THEN v_code := 'BAD_STATE'; v_msg := 'The plan is fixed once it is awaiting approval.';
      ELSE UPDATE mig_projects SET mapping_note = coalesce(nullif(p->>'mappingNote', ''), mapping_note), rollback_plan = coalesce(nullif(p->>'rollbackPlan', ''), rollback_plan),
          rollback_hours = coalesce((p->>'rollbackHours')::int, rollback_hours) WHERE id = m.id;
        v_msg := 'Plan saved.'; END IF;
    ELSIF p_action = 'record_run' THEN
      IF coalesce(p->>'kind', '') NOT IN ('validation', 'dual_run', 'post_cutover') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose a run type.';
      ELSIF (p->>'kind' = 'validation' AND m.stage <> 'validation') OR (p->>'kind' = 'dual_run' AND m.stage <> 'dual_run') OR (p->>'kind' = 'post_cutover' AND m.stage <> 'rollback_window') THEN
        v_code := 'BAD_STATE'; v_msg := 'That run type does not belong to the current stage.';
      ELSE INSERT INTO mig_runs (project_id, kind, source_count, target_count, mismatches, note, recorded_by)
          VALUES (m.id, p->>'kind', (p->>'sourceCount')::int, (p->>'targetCount')::int, (p->>'mismatches')::int, coalesce(p->>'note', ''), p_actor);
        v_msg := 'Run recorded.'; v_detail := (p->>'kind') || ' ' || (p->>'sourceCount') || '→' || (p->>'targetCount') || ', ' || (p->>'mismatches') || ' mismatches'; END IF;
    ELSIF p_action = 'advance' THEN
      IF m.stage = 'inventory' THEN
        SELECT count(*) INTO v_n FROM mig_inventory WHERE project_id = m.id;
        IF v_n = 0 THEN v_code := 'BLOCKED'; v_msg := 'Add at least one inventory item first.'; ELSE UPDATE mig_projects SET stage = 'mapping' WHERE id = m.id; v_msg := 'Moved to mapping.'; END IF;
      ELSIF m.stage = 'mapping' THEN
        IF length(coalesce(m.mapping_note, '')) < 20 THEN v_code := 'BLOCKED'; v_msg := 'Record the field mapping and who approved it (20+ characters).';
        ELSE UPDATE mig_projects SET stage = 'validation' WHERE id = m.id; v_msg := 'Moved to validation.'; END IF;
      ELSIF m.stage = 'validation' THEN
        IF NOT mig_latest_passed(m.id, 'validation', NULL) THEN v_code := 'BLOCKED'; v_msg := 'The latest validation run must pass (equal counts, zero mismatches).';
        ELSE UPDATE mig_projects SET stage = 'dual_run' WHERE id = m.id; v_msg := 'Moved to dual run.'; END IF;
      ELSIF m.stage = 'dual_run' THEN
        SELECT count(*) INTO v_runs FROM (SELECT passed FROM mig_runs WHERE project_id = m.id AND kind = 'dual_run' ORDER BY id DESC LIMIT 2) x WHERE passed;
        IF v_runs < 2 THEN v_code := 'BLOCKED'; v_msg := 'Failed reconciliation blocks promotion: the last two dual runs must both pass.';
        ELSIF length(coalesce(m.rollback_plan, '')) < 30 THEN v_code := 'BLOCKED'; v_msg := 'Write the rollback plan (30+ characters) before asking for approval.';
        ELSE UPDATE mig_projects SET stage = 'awaiting_approval' WHERE id = m.id; v_msg := 'Waiting for the institution''s cutover approval.'; END IF;
      ELSE v_code := 'BAD_STATE'; v_msg := 'Use cutover, rollback or complete for this stage.'; END IF;
      IF v_code = 'OK' THEN v_detail := 'from ' || m.stage; END IF;
    ELSIF p_action = 'cutover' THEN
      IF m.stage <> 'awaiting_approval' THEN v_code := 'BAD_STATE'; v_msg := 'Cutover needs the institution''s approval first.';
      ELSIF NOT EXISTS (SELECT 1 FROM mig_approvals a WHERE a.project_id = m.id AND a.evidence_hash = mig_evidence_hash(m.id)) THEN
        v_code := 'NEEDS_INSTITUTION_APPROVAL'; v_msg := 'No institution approval matches the current evidence.';
      ELSE UPDATE mig_projects SET stage = 'rollback_window', cutover_at = now(), window_ends_at = now() + make_interval(hours => m.rollback_hours) WHERE id = m.id;
        v_msg := 'Cutover recorded. The rollback window is open for ' || m.rollback_hours || ' hours.'; END IF;
    ELSIF p_action = 'rollback' THEN
      IF m.stage <> 'rollback_window' THEN v_code := 'BAD_STATE'; v_msg := 'Rollback is only available during the rollback window.';
      ELSIF length(trim(coalesce(p->>'reason', ''))) < 10 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why you are rolling back (10+ characters).';
      ELSE UPDATE mig_projects SET stage = 'rolled_back', ended_reason = p->>'reason' WHERE id = m.id; v_msg := 'Rolled back. The legacy system stays authoritative.'; v_detail := p->>'reason'; END IF;
    ELSIF p_action = 'complete' THEN
      IF m.stage <> 'rollback_window' THEN v_code := 'BAD_STATE'; v_msg := 'Complete after cutover.';
      ELSIF now() < m.window_ends_at THEN v_code := 'BLOCKED'; v_msg := 'The rollback window is still open until ' || to_char(m.window_ends_at, 'YYYY-MM-DD HH24:MI') || ' UTC.';
      ELSIF NOT mig_latest_passed(m.id, 'post_cutover', m.cutover_at) THEN v_code := 'BLOCKED'; v_msg := 'A passing post-cutover reconciliation is required. A successful import is not completion.';
      ELSE UPDATE mig_projects SET stage = 'completed', ended_reason = 'completed' WHERE id = m.id; v_msg := 'Migration completed.'; END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown action.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_action <> 'create' THEN UPDATE mig_projects SET version = version + 1, updated_at = now() WHERE id = v_id; END IF;
    INSERT INTO mig_timeline (project_id, actor_id, action, detail) VALUES (v_id, p_actor, p_action, v_detail);
  END IF;
  INSERT INTO mig_receipts (actor_id, command_key, project_id, result_code, message) VALUES (p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
  // Institution-side approval. The caller (Semester app) passes the approver's own institution, resolved on the server.
  `CREATE OR REPLACE FUNCTION mig_institution_approve(p_actor text, p_tenant text, p_project text, p_seen_hash text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE m mig_projects%ROWTYPE;
BEGIN
  SELECT * INTO m FROM mig_projects WHERE id = p_project FOR UPDATE;
  IF NOT FOUND OR m.tenant_id <> p_tenant THEN RETURN 'Migration not found for your institution.'; END IF;
  IF m.stage <> 'awaiting_approval' THEN RETURN 'This migration is not waiting for approval.'; END IF;
  IF m.lead_id = p_actor THEN RETURN 'The implementation lead cannot approve their own cutover.'; END IF;
  IF p_seen_hash IS DISTINCT FROM mig_evidence_hash(m.id) THEN RETURN 'The evidence changed since you opened it. Reload and review again.'; END IF;
  IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record what you checked (10+ characters).'; END IF;
  INSERT INTO mig_approvals (project_id, tenant_id, approver_id, evidence_hash, note) VALUES (m.id, p_tenant, p_actor, p_seen_hash, p_note);
  INSERT INTO mig_timeline (project_id, actor_id, action, detail) VALUES (m.id, p_actor, 'institution_approved', p_note);
  UPDATE mig_projects SET version = version + 1, updated_at = now() WHERE id = m.id;
  RETURN NULL;
END $$`,
];
