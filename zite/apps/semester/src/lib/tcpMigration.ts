// Migration tcp-001: tenant control plane (role apps "University Admin": structure, policy, entitlements, configuration, rollout;
// "Platform Admin": tenant fleet, flags, quotas, maintenance, configuration, rollout). Builds on sreq-001 (inst_departments).
// Authority is resolved by the endpoints on the server and passed in as booleans: p_is_admin = institution Administrator
// (requireAction member.manage), p_is_platform = an active company platform_admin (co_roles). Neither is ever taken from the client.
// - Structure: colleges/schools/divisions per institution, nested without cycles; departments are assigned to one unit;
//   a unit with active children or departments cannot be archived.
// - Policy: versioned institution policies; approval by a different administrator, bound to the text seen (hash);
//   approving a version retires the previously approved one of the same key.
// - Configuration: an allow-list of institution settings with validation in SQL, an expected version and a reason; history
//   is append-only.
// - Entitlements and quotas: granted per institution by a platform admin (company side), with an optional seat limit and an
//   API-call quota. Revoking an entitlement turns its rollout off in the same statement.
// - Rollout: an institution administrator moves an entitled module off -> pilot (named roles) -> all. Going to all needs the
//   pilot to have run at least a day and a different administrator than the one who started it. No rollout change is
//   accepted while a maintenance window is active for that institution.
// - Flags (platform): a kill switch acts at once; turning a global default on needs a proposal by one platform admin and
//   approval by another; per-institution overrides carry a reason.
// - Maintenance: windows are scheduled at least an hour ahead, last at most 8 hours, and are shown in-app only. Nothing is sent.
// - Company staff get configuration authority only; no function here reads a student record.
export const TCP_MODULES = ['ai_assistant', 'proctoring', 'payments', 'marketplace', 'family_portal', 'employer_network', 'research_partners', 'developer_api'] as const;
export const TCP_SETTINGS = ['timezone', 'week_start', 'grade_scale', 'late_grace_days', 'default_locale'] as const;
const MODS = TCP_MODULES.map((m) => `'${m}'`).join(', ');
const KEYS = TCP_SETTINGS.map((m) => `'${m}'`).join(', ');

export const TCP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS tcp_units (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
     kind text NOT NULL CHECK (kind IN ('college', 'school', 'division')), parent_id bigint REFERENCES tcp_units(id), active boolean NOT NULL DEFAULT true, rev int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (parent_id IS NULL OR parent_id <> id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tcp_units_name ON tcp_units (tenant_id, lower(name)) WHERE active`,
  `CREATE TABLE IF NOT EXISTS tcp_unit_depts (dept_id bigint PRIMARY KEY REFERENCES inst_departments(id), unit_id bigint NOT NULL REFERENCES tcp_units(id), tenant_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tcp_policies (id bigserial PRIMARY KEY, tenant_id text NOT NULL, key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{2,40}$'), version int NOT NULL,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 4 AND 160), body text NOT NULL CHECK (length(trim(body)) BETWEEN 40 AND 40000), body_hash text NOT NULL,
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'approved', 'retired')), author_id text NOT NULL, approver_id text, approved_at timestamptz, rev int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, key, version), CHECK (approver_id IS NULL OR approver_id <> author_id), CHECK (state = 'draft' OR approver_id IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tcp_policies_one_live ON tcp_policies (tenant_id, key) WHERE state = 'approved'`,
  `CREATE TABLE IF NOT EXISTS tcp_settings (tenant_id text NOT NULL, key text NOT NULL CHECK (key IN (${KEYS})), value jsonb NOT NULL, version int NOT NULL DEFAULT 1,
     updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, key))`,
  `CREATE TABLE IF NOT EXISTS tcp_entitlements (tenant_id text NOT NULL, module text NOT NULL CHECK (module IN (${MODS})), granted boolean NOT NULL, seat_limit int CHECK (seat_limit IS NULL OR seat_limit > 0),
     api_calls_day int CHECK (api_calls_day IS NULL OR api_calls_day > 0), note text NOT NULL DEFAULT '', updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), rev int NOT NULL DEFAULT 1,
     PRIMARY KEY (tenant_id, module))`,
  `CREATE TABLE IF NOT EXISTS tcp_rollouts (tenant_id text NOT NULL, module text NOT NULL CHECK (module IN (${MODS})), stage text NOT NULL DEFAULT 'off' CHECK (stage IN ('off', 'pilot', 'all')),
     pilot_roles text[] NOT NULL DEFAULT '{}', pilot_by text, pilot_at timestamptz, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), rev int NOT NULL DEFAULT 1,
     PRIMARY KEY (tenant_id, module), CHECK (stage <> 'pilot' OR cardinality(pilot_roles) > 0))`,
  `CREATE TABLE IF NOT EXISTS tcp_flags (key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.]{2,60}$'), description text NOT NULL CHECK (length(trim(description)) >= 10), default_on boolean NOT NULL DEFAULT false,
     killed boolean NOT NULL DEFAULT false, proposed_on boolean, proposed_by text, rev int NOT NULL DEFAULT 1, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS tcp_flag_overrides (tenant_id text NOT NULL, key text NOT NULL REFERENCES tcp_flags(key), on_value boolean NOT NULL, reason text NOT NULL CHECK (length(trim(reason)) >= 10),
     set_by text NOT NULL, set_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, key))`,
  `CREATE TABLE IF NOT EXISTS tcp_maintenance (id bigserial PRIMARY KEY, tenant_id text, title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160), impact text NOT NULL CHECK (length(trim(impact)) >= 10),
     starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, cancelled_at timestamptz, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '8 hours'))`,
  `CREATE TABLE IF NOT EXISTS tcp_events (id bigserial PRIMARY KEY, tenant_id text, actor_id text NOT NULL, area text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '', detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION tcp_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tcp_events_append_only') THEN
       CREATE TRIGGER tcp_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON tcp_events FOR EACH STATEMENT EXECUTE FUNCTION tcp_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION tcp_in_maintenance(p_tenant text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM tcp_maintenance WHERE cancelled_at IS NULL AND (tenant_id IS NULL OR tenant_id = p_tenant) AND now() >= starts_at AND now() < ends_at) $$`,
  `CREATE OR REPLACE FUNCTION tcp_entitled(p_tenant text, p_module text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT granted FROM tcp_entitlements WHERE tenant_id = p_tenant AND module = p_module), false) $$`,
  // Is this module on for a person with these roles at this institution?
  `CREATE OR REPLACE FUNCTION tcp_module_on(p_tenant text, p_module text, p_roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT tcp_entitled(p_tenant, p_module) AND coalesce((SELECT stage = 'all' OR (stage = 'pilot' AND pilot_roles && p_roles) FROM tcp_rollouts WHERE tenant_id = p_tenant AND module = p_module), false) $$`,
  `CREATE OR REPLACE FUNCTION tcp_flag_on(p_tenant text, p_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT CASE WHEN f.killed THEN false ELSE coalesce((SELECT on_value FROM tcp_flag_overrides o WHERE o.tenant_id = p_tenant AND o.key = f.key), f.default_on) END
       FROM tcp_flags f WHERE f.key = p_key $$`,
  `CREATE OR REPLACE FUNCTION tcp_quota_ok(p_tenant text, p_module text, p_calls_today int) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT tcp_entitled(p_tenant, p_module) AND coalesce((SELECT api_calls_day IS NULL OR p_calls_today < api_calls_day FROM tcp_entitlements WHERE tenant_id = p_tenant AND module = p_module), false) $$`,

  `CREATE OR REPLACE FUNCTION tcp_unit(p_tenant text, p_actor text, p_is_admin boolean, p_step text, p_id bigint, p_expected int, p_name text, p_kind text, p_parent bigint, p_dept bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE u tcp_units; v_id bigint; cyc boolean;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator changes the structure.'; END IF;
     IF p_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tcp_units WHERE id = p_parent AND tenant_id = p_tenant AND active) THEN RETURN 'Choose an active parent unit.'; END IF;
     IF p_step = 'create' THEN
       IF length(trim(coalesce(p_name, ''))) < 2 THEN RETURN 'Give the unit a name.'; END IF;
       IF EXISTS (SELECT 1 FROM tcp_units WHERE tenant_id = p_tenant AND active AND lower(name) = lower(trim(p_name))) THEN RETURN 'A unit with that name already exists.'; END IF;
       INSERT INTO tcp_units (tenant_id, name, kind, parent_id) VALUES (p_tenant, trim(p_name), p_kind, p_parent) RETURNING id INTO v_id;
       INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'structure', 'create', 'unit:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     IF p_step = 'assign_dept' THEN
       IF NOT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant) THEN RETURN 'Department not found.'; END IF;
       IF p_id IS NULL OR NOT EXISTS (SELECT 1 FROM tcp_units WHERE id = p_id AND tenant_id = p_tenant AND active) THEN RETURN 'Choose an active unit.'; END IF;
       INSERT INTO tcp_unit_depts (dept_id, unit_id, tenant_id) VALUES (p_dept, p_id, p_tenant) ON CONFLICT (dept_id) DO UPDATE SET unit_id = EXCLUDED.unit_id;
       INSERT INTO tcp_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'structure', 'assign_dept', 'unit:' || p_id, 'dept:' || p_dept);
       RETURN 'ok:' || p_id;
     END IF;
     SELECT * INTO u FROM tcp_units WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR u.tenant_id <> p_tenant THEN RETURN 'Unit not found.'; END IF;
     IF u.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this unit. Reload and try again.'; END IF;
     IF p_step = 'rename' THEN
       IF length(trim(coalesce(p_name, ''))) < 2 THEN RETURN 'Give the unit a name.'; END IF;
       UPDATE tcp_units SET name = trim(p_name), rev = rev + 1 WHERE id = u.id;
     ELSIF p_step = 'move' THEN
       IF p_parent IS NOT NULL THEN
         WITH RECURSIVE up AS (SELECT id, parent_id FROM tcp_units WHERE id = p_parent UNION ALL SELECT t.id, t.parent_id FROM tcp_units t JOIN up ON t.id = up.parent_id)
         SELECT EXISTS (SELECT 1 FROM up WHERE id = u.id) INTO cyc;
         IF cyc THEN RETURN 'A unit cannot sit inside itself.'; END IF;
       END IF;
       UPDATE tcp_units SET parent_id = p_parent, rev = rev + 1 WHERE id = u.id;
     ELSIF p_step = 'archive' THEN
       IF EXISTS (SELECT 1 FROM tcp_units WHERE parent_id = u.id AND active) THEN RETURN 'Move or archive its units first.'; END IF;
       IF EXISTS (SELECT 1 FROM tcp_unit_depts d JOIN inst_departments x ON x.id = d.dept_id WHERE d.unit_id = u.id AND x.active) THEN RETURN 'Move its departments to another unit first.'; END IF;
       UPDATE tcp_units SET active = false, rev = rev + 1 WHERE id = u.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'structure', p_step, 'unit:' || u.id);
     RETURN 'ok:' || u.id;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_policy(p_tenant text, p_actor text, p_is_admin boolean, p_step text, p_id bigint, p_expected int, p_key text, p_title text, p_body text, p_seen text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p tcp_policies; v_id bigint; v_ver int;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator manages policies.'; END IF;
     IF p_step = 'draft' THEN
       IF coalesce(p_key, '') !~ '^[a-z][a-z0-9_]{2,40}$' THEN RETURN 'Use a short key in lower case, like academic_integrity.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 4 OR length(trim(coalesce(p_body, ''))) < 40 THEN RETURN 'Give a title and the full policy text (40+ characters).'; END IF;
       IF EXISTS (SELECT 1 FROM tcp_policies WHERE tenant_id = p_tenant AND key = p_key AND state = 'draft') THEN RETURN 'A draft of this policy already exists. Edit it instead.'; END IF;
       SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM tcp_policies WHERE tenant_id = p_tenant AND key = p_key;
       INSERT INTO tcp_policies (tenant_id, key, version, title, body, body_hash, author_id) VALUES (p_tenant, p_key, v_ver, trim(p_title), trim(p_body), md5(trim(p_title) || '|' || trim(p_body)), p_actor) RETURNING id INTO v_id;
       INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'policy', 'draft', p_key || ' v' || v_ver);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO p FROM tcp_policies WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR p.tenant_id <> p_tenant THEN RETURN 'Policy not found.'; END IF;
     IF p.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this policy. Reload and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF p.state <> 'draft' THEN RETURN 'Only a draft can be edited. Start a new version.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 4 OR length(trim(coalesce(p_body, ''))) < 40 THEN RETURN 'Give a title and the full policy text (40+ characters).'; END IF;
       UPDATE tcp_policies SET title = trim(p_title), body = trim(p_body), body_hash = md5(trim(p_title) || '|' || trim(p_body)), author_id = p_actor, rev = rev + 1 WHERE id = p.id;
     ELSIF p_step = 'approve' THEN
       IF p.state <> 'draft' THEN RETURN 'This version is not waiting for approval.'; END IF;
       IF p.author_id = p_actor THEN RETURN 'You wrote this version, so another administrator approves it.'; END IF;
       IF p_seen IS DISTINCT FROM p.body_hash THEN RETURN 'The text changed since you opened it. Reload and read it again.'; END IF;
       UPDATE tcp_policies SET state = 'retired', rev = rev + 1 WHERE tenant_id = p_tenant AND key = p.key AND state = 'approved';
       UPDATE tcp_policies SET state = 'approved', approver_id = p_actor, approved_at = now(), rev = rev + 1 WHERE id = p.id;
     ELSIF p_step = 'retire' THEN
       IF p.state <> 'approved' THEN RETURN 'Only the approved version can be retired.'; END IF;
       UPDATE tcp_policies SET state = 'retired', rev = rev + 1 WHERE id = p.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'policy', p_step, p.key || ' v' || p.version);
     RETURN 'ok:' || p.id;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_setting_problem(p_key text, p_value jsonb) RETURNS text LANGUAGE plpgsql STABLE AS $$
   BEGIN
     IF p_key = 'timezone' THEN
       IF jsonb_typeof(p_value) <> 'string' OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_value #>> '{}') THEN RETURN 'Choose a valid time zone, like America/Chicago.'; END IF;
     ELSIF p_key = 'week_start' THEN
       IF (p_value #>> '{}') NOT IN ('monday', 'sunday') OR jsonb_typeof(p_value) <> 'string' THEN RETURN 'The week starts on monday or sunday.'; END IF;
     ELSIF p_key = 'grade_scale' THEN
       IF (p_value #>> '{}') NOT IN ('letter', 'percent', 'pass_fail') OR jsonb_typeof(p_value) <> 'string' THEN RETURN 'Choose letter, percent or pass_fail.'; END IF;
     ELSIF p_key = 'late_grace_days' THEN
       IF jsonb_typeof(p_value) <> 'number' OR (p_value #>> '{}')::numeric NOT BETWEEN 0 AND 14 OR (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric) THEN RETURN 'Grace days are a whole number from 0 to 14.'; END IF;
     ELSIF p_key = 'default_locale' THEN
       IF jsonb_typeof(p_value) <> 'string' OR (p_value #>> '{}') !~ '^[a-z]{2}(-[A-Z]{2})?$' THEN RETURN 'Use a locale like en or en-US.'; END IF;
     ELSE RETURN 'That setting is not configurable.';
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tcp_set(p_tenant text, p_actor text, p_is_admin boolean, p_key text, p_value jsonb, p_expected int, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s tcp_settings; bad text;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator changes configuration.'; END IF;
     bad := tcp_setting_problem(p_key, p_value); IF bad IS NOT NULL THEN RETURN bad; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
     SELECT * INTO s FROM tcp_settings WHERE tenant_id = p_tenant AND key = p_key FOR UPDATE;
     IF FOUND THEN
       IF s.version IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this setting. Reload and try again.'; END IF;
       UPDATE tcp_settings SET value = p_value, version = version + 1, updated_by = p_actor, updated_at = now() WHERE tenant_id = p_tenant AND key = p_key;
     ELSE
       IF p_expected IS NOT NULL AND p_expected <> 0 THEN RETURN 'Someone changed this setting. Reload and try again.'; END IF;
       INSERT INTO tcp_settings (tenant_id, key, value, updated_by) VALUES (p_tenant, p_key, p_value, p_actor);
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'configuration', 'set', p_key, p_value::text || ' — ' || trim(p_reason));
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_entitle(p_actor text, p_is_platform boolean, p_tenant text, p_module text, p_granted boolean, p_seats int, p_calls int, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e tcp_entitlements;
   BEGIN
     IF NOT p_is_platform THEN RETURN 'Only a platform admin changes entitlements.'; END IF;
     IF p_module NOT IN (${MODS}) THEN RETURN 'Unknown module.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record why, such as the contract or order reference (10+ characters).'; END IF;
     IF (p_seats IS NOT NULL AND p_seats < 1) OR (p_calls IS NOT NULL AND p_calls < 1) THEN RETURN 'Limits must be positive, or left empty for none.'; END IF;
     SELECT * INTO e FROM tcp_entitlements WHERE tenant_id = p_tenant AND module = p_module FOR UPDATE;
     IF FOUND THEN
       IF e.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this entitlement. Reload and try again.'; END IF;
       UPDATE tcp_entitlements SET granted = p_granted, seat_limit = p_seats, api_calls_day = p_calls, note = trim(p_note), updated_by = p_actor, updated_at = now(), rev = rev + 1 WHERE tenant_id = p_tenant AND module = p_module;
     ELSE
       IF p_expected IS NOT NULL AND p_expected <> 0 THEN RETURN 'Someone changed this entitlement. Reload and try again.'; END IF;
       INSERT INTO tcp_entitlements (tenant_id, module, granted, seat_limit, api_calls_day, note, updated_by) VALUES (p_tenant, p_module, p_granted, p_seats, p_calls, trim(p_note), p_actor);
     END IF;
     IF NOT p_granted THEN
       UPDATE tcp_rollouts SET stage = 'off', pilot_roles = '{}', updated_by = p_actor, updated_at = now(), rev = rev + 1 WHERE tenant_id = p_tenant AND module = p_module AND stage <> 'off';
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'entitlement', CASE WHEN p_granted THEN 'grant' ELSE 'revoke' END, p_module, trim(p_note));
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_roll(p_tenant text, p_actor text, p_is_admin boolean, p_module text, p_stage text, p_roles text[], p_expected int, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tcp_rollouts;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator rolls out modules.'; END IF;
     IF p_stage NOT IN ('off', 'pilot', 'all') THEN RETURN 'Unknown stage.'; END IF;
     IF tcp_in_maintenance(p_tenant) THEN RETURN 'A maintenance window is in progress. Try again after it ends.'; END IF;
     IF p_stage <> 'off' AND NOT tcp_entitled(p_tenant, p_module) THEN RETURN 'Your institution is not entitled to this module.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
     SELECT * INTO r FROM tcp_rollouts WHERE tenant_id = p_tenant AND module = p_module FOR UPDATE;
     IF FOUND AND r.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this rollout. Reload and try again.'; END IF;
     IF NOT FOUND AND p_expected IS NOT NULL AND p_expected <> 0 THEN RETURN 'Someone changed this rollout. Reload and try again.'; END IF;
     IF p_stage = 'pilot' AND cardinality(coalesce(p_roles, '{}')) = 0 THEN RETURN 'Name the roles in the pilot.'; END IF;
     IF p_stage = 'all' THEN
       IF NOT FOUND OR r.stage <> 'pilot' THEN RETURN 'Run a pilot before turning it on for everyone.'; END IF;
       IF r.pilot_at > now() - interval '1 day' THEN RETURN 'Let the pilot run for at least a day first.'; END IF;
       IF r.pilot_by = p_actor THEN RETURN 'You started the pilot, so another administrator turns it on for everyone.'; END IF;
     END IF;
     IF NOT FOUND THEN
       INSERT INTO tcp_rollouts (tenant_id, module, stage, pilot_roles, pilot_by, pilot_at, updated_by) VALUES (p_tenant, p_module, p_stage, CASE WHEN p_stage = 'pilot' THEN p_roles ELSE '{}' END,
         CASE WHEN p_stage = 'pilot' THEN p_actor END, CASE WHEN p_stage = 'pilot' THEN now() END, p_actor);
     ELSE
       UPDATE tcp_rollouts SET stage = p_stage, pilot_roles = CASE WHEN p_stage = 'pilot' THEN p_roles WHEN p_stage = 'all' THEN pilot_roles ELSE '{}' END,
         pilot_by = CASE WHEN p_stage = 'pilot' AND r.stage <> 'pilot' THEN p_actor WHEN p_stage = 'off' THEN NULL ELSE pilot_by END,
         pilot_at = CASE WHEN p_stage = 'pilot' AND r.stage <> 'pilot' THEN now() WHEN p_stage = 'off' THEN NULL ELSE pilot_at END,
         updated_by = p_actor, updated_at = now(), rev = rev + 1 WHERE tenant_id = p_tenant AND module = p_module;
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'rollout', p_stage, p_module, trim(p_reason));
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_flag(p_actor text, p_is_platform boolean, p_step text, p_key text, p_expected int, p_on boolean, p_tenant text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f tcp_flags;
   BEGIN
     IF NOT p_is_platform THEN RETURN 'Only a platform admin changes flags.'; END IF;
     IF p_step = 'define' THEN
       IF coalesce(p_key, '') !~ '^[a-z][a-z0-9_.]{2,60}$' THEN RETURN 'Use a key like grading.new_editor.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Describe what the flag changes (10+ characters).'; END IF;
       IF EXISTS (SELECT 1 FROM tcp_flags WHERE key = p_key) THEN RETURN 'That flag already exists.'; END IF;
       INSERT INTO tcp_flags (key, description, updated_by) VALUES (p_key, trim(p_text), p_actor);
       INSERT INTO tcp_events (actor_id, area, action, target) VALUES (p_actor, 'flag', 'define', p_key);
       RETURN NULL;
     END IF;
     SELECT * INTO f FROM tcp_flags WHERE key = p_key FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Flag not found.'; END IF;
     IF f.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this flag. Reload and try again.'; END IF;
     IF p_step IN ('propose', 'override', 'kill', 'unkill') AND length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
     IF p_step = 'kill' THEN
       UPDATE tcp_flags SET killed = true, rev = rev + 1, updated_by = p_actor, updated_at = now() WHERE key = f.key;
     ELSIF p_step = 'unkill' THEN
       IF NOT f.killed THEN RETURN 'The flag is not killed.'; END IF;
       UPDATE tcp_flags SET killed = false, rev = rev + 1, updated_by = p_actor, updated_at = now() WHERE key = f.key;
     ELSIF p_step = 'propose' THEN
       IF p_on IS NULL OR p_on = f.default_on THEN RETURN 'That is already the default.'; END IF;
       IF p_on = false THEN UPDATE tcp_flags SET default_on = false, proposed_on = NULL, proposed_by = NULL, rev = rev + 1, updated_by = p_actor, updated_at = now() WHERE key = f.key;
       ELSE UPDATE tcp_flags SET proposed_on = true, proposed_by = p_actor, rev = rev + 1, updated_by = p_actor, updated_at = now() WHERE key = f.key; END IF;
     ELSIF p_step = 'approve' THEN
       IF f.proposed_on IS NULL THEN RETURN 'Nothing is waiting for approval.'; END IF;
       IF f.proposed_by = p_actor THEN RETURN 'You proposed this, so another platform admin approves it.'; END IF;
       UPDATE tcp_flags SET default_on = f.proposed_on, proposed_on = NULL, proposed_by = NULL, rev = rev + 1, updated_by = p_actor, updated_at = now() WHERE key = f.key;
     ELSIF p_step = 'override' THEN
       IF p_tenant IS NULL OR p_on IS NULL THEN RETURN 'Choose an institution and a value.'; END IF;
       INSERT INTO tcp_flag_overrides (tenant_id, key, on_value, reason, set_by) VALUES (p_tenant, f.key, p_on, trim(p_text), p_actor)
         ON CONFLICT (tenant_id, key) DO UPDATE SET on_value = EXCLUDED.on_value, reason = EXCLUDED.reason, set_by = EXCLUDED.set_by, set_at = now();
       UPDATE tcp_flags SET rev = rev + 1 WHERE key = f.key;
     ELSIF p_step = 'clear' THEN
       DELETE FROM tcp_flag_overrides WHERE tenant_id = p_tenant AND key = f.key;
       UPDATE tcp_flags SET rev = rev + 1 WHERE key = f.key;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO tcp_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'flag', p_step, f.key, coalesce(p_on::text, '') || ' ' || coalesce(trim(p_text), ''));
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION tcp_maint(p_actor text, p_is_platform boolean, p_step text, p_id bigint, p_tenant text, p_title text, p_impact text, p_starts timestamptz, p_ends timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m tcp_maintenance; v_id bigint;
   BEGIN
     IF NOT p_is_platform THEN RETURN 'Only a platform admin schedules maintenance.'; END IF;
     IF p_step = 'schedule' THEN
       IF p_starts IS NULL OR p_ends IS NULL OR p_starts < now() + interval '1 hour' THEN RETURN 'Schedule maintenance at least an hour ahead.'; END IF;
       IF p_ends <= p_starts OR p_ends > p_starts + interval '8 hours' THEN RETURN 'A window ends after it starts and lasts at most 8 hours.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_impact, ''))) < 10 THEN RETURN 'Give a title and what people will notice.'; END IF;
       INSERT INTO tcp_maintenance (tenant_id, title, impact, starts_at, ends_at, created_by) VALUES (p_tenant, trim(p_title), trim(p_impact), p_starts, p_ends, p_actor) RETURNING id INTO v_id;
       INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'maintenance', 'schedule', 'window:' || v_id);
       RETURN 'ok:' || v_id;
     ELSIF p_step = 'cancel' THEN
       SELECT * INTO m FROM tcp_maintenance WHERE id = p_id FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Window not found.'; END IF;
       IF m.cancelled_at IS NOT NULL OR m.ends_at <= now() THEN RETURN 'This window is already over.'; END IF;
       UPDATE tcp_maintenance SET cancelled_at = now() WHERE id = m.id;
       INSERT INTO tcp_events (tenant_id, actor_id, area, action, target) VALUES (m.tenant_id, p_actor, 'maintenance', 'cancel', 'window:' || m.id);
       RETURN 'ok:' || m.id;
     END IF;
     RETURN 'Unknown step.';
   END $$`,
];
