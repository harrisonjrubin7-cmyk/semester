// Migration dgv-001: data governance catalog (Data Steward role app). Metadata only — no student records are stored or read here.
// Stewards are granted by an administrator, never self. Definitions are proposed by one steward and approved by another, with an
// expected version. Datasets carry a classification and a system of record; lowering a classification needs a second steward.
// Lineage edges may not form a cycle. Quality rules record results; a failed result opens an issue that a steward resolves.
// Retention is a policy record with a legal minimum; nothing is deleted here. Source conflicts are resolved by a steward who did
// not raise them, naming the authoritative source. Append-only history.
export const DGV_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dgv_stewards (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS dgv_terms (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120), definition text NOT NULL CHECK (length(trim(definition)) >= 10),
     state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','retired')), proposed_by text NOT NULL, approved_by text, version int NOT NULL DEFAULT 1,
     UNIQUE (tenant_id, name), CHECK (approved_by IS NULL OR approved_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS dgv_assets (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120), system text NOT NULL,
     classification text NOT NULL CHECK (classification IN ('public','internal','confidential','restricted')), system_of_record text NOT NULL, owner_id text NOT NULL,
     pending_class text CHECK (pending_class IN ('public','internal','confidential','restricted')), pending_by text, version int NOT NULL DEFAULT 1, UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS dgv_lineage (from_id bigint NOT NULL REFERENCES dgv_assets(id), to_id bigint NOT NULL REFERENCES dgv_assets(id), transform text NOT NULL CHECK (length(trim(transform)) >= 3),
     added_by text NOT NULL, PRIMARY KEY (from_id, to_id), CHECK (from_id <> to_id))`,
  `CREATE TABLE IF NOT EXISTS dgv_rules (id bigserial PRIMARY KEY, asset_id bigint NOT NULL REFERENCES dgv_assets(id), description text NOT NULL CHECK (length(trim(description)) >= 5),
     threshold numeric NOT NULL CHECK (threshold BETWEEN 0 AND 100), created_by text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dgv_results (id bigserial PRIMARY KEY, rule_id bigint NOT NULL REFERENCES dgv_rules(id), measured numeric NOT NULL CHECK (measured BETWEEN 0 AND 100), passed boolean NOT NULL,
     recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS dgv_issues (id bigserial PRIMARY KEY, result_id bigint NOT NULL UNIQUE REFERENCES dgv_results(id), state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')),
     resolution text NOT NULL DEFAULT '', resolved_by text, CHECK (state <> 'resolved' OR (resolved_by IS NOT NULL AND length(trim(resolution)) >= 5)))`,
  `CREATE TABLE IF NOT EXISTS dgv_retention (asset_id bigint PRIMARY KEY REFERENCES dgv_assets(id), days int NOT NULL CHECK (days > 0), legal_min_days int NOT NULL DEFAULT 0 CHECK (legal_min_days >= 0),
     basis text NOT NULL CHECK (length(trim(basis)) >= 5), set_by text NOT NULL, CHECK (days >= legal_min_days))`,
  `CREATE TABLE IF NOT EXISTS dgv_conflicts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (length(trim(subject)) >= 3), source_a text NOT NULL, source_b text NOT NULL,
     detail text NOT NULL CHECK (length(trim(detail)) >= 10), raised_by text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')),
     authoritative text, rationale text NOT NULL DEFAULT '', resolved_by text, CHECK (resolved_by IS NULL OR resolved_by <> raised_by),
     CHECK (state <> 'resolved' OR (authoritative IN (source_a, source_b) AND length(trim(rationale)) >= 10)))`,
  `CREATE TABLE IF NOT EXISTS dgv_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dgv_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dgv_events_append_only') THEN
       CREATE TRIGGER dgv_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dgv_events FOR EACH STATEMENT EXECUTE FUNCTION dgv_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dgv_results_append_only') THEN
       CREATE TRIGGER dgv_results_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dgv_results FOR EACH STATEMENT EXECUTE FUNCTION dgv_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_is(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dgv_stewards WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION dgv_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO dgv_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION dgv_set_steward(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_on THEN INSERT INTO dgv_stewards (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE dgv_stewards SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     PERFORM dgv_log(p_tenant, 'steward', p_user, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin);
     RETURN NULL;
   END $$`,
  // Terms: propose (new or a revision of an approved one, which returns it to proposed), approve by another steward, retire.
  `CREATE OR REPLACE FUNCTION dgv_term(p_actor text, p_tenant text, p_name text, p_definition text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards propose definitions.'; END IF;
     INSERT INTO dgv_terms (tenant_id, name, definition, proposed_by) VALUES (p_tenant, trim(p_name), trim(p_definition), p_actor)
       ON CONFLICT (tenant_id, name) DO UPDATE SET definition = EXCLUDED.definition, proposed_by = p_actor, approved_by = NULL, state = 'proposed', version = dgv_terms.version + 1
       RETURNING id INTO v_id;
     PERFORM dgv_log(p_tenant, 'term', v_id::text, 'propose', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_term_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t dgv_terms;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards decide definitions.'; END IF;
     SELECT * INTO t FROM dgv_terms WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF t.id IS NULL THEN RETURN 'Definition not found.'; END IF;
     IF t.version <> p_version THEN RETURN 'This definition changed since you opened it. Reload and review again.'; END IF;
     IF p_step = 'approve' THEN
       IF t.state <> 'proposed' THEN RETURN 'Only proposed definitions are approved.'; END IF;
       IF t.proposed_by = p_actor THEN RETURN 'Another steward approves your proposal.'; END IF;
       UPDATE dgv_terms SET state = 'approved', approved_by = p_actor, version = version + 1 WHERE id = p_id;
     ELSIF p_step = 'retire' THEN
       IF t.state = 'retired' THEN RETURN 'Already retired.'; END IF;
       UPDATE dgv_terms SET state = 'retired', version = version + 1 WHERE id = p_id;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM dgv_log(p_tenant, 'term', p_id::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_class_rank(c text) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT array_position(ARRAY['public','internal','confidential','restricted'], c) $$`,
  `CREATE OR REPLACE FUNCTION dgv_asset(p_actor text, p_tenant text, p_name text, p_system text, p_class text, p_sor text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards register datasets.'; END IF;
     IF length(trim(coalesce(p_sor, ''))) < 2 THEN RETURN 'Name the system of record.'; END IF;
     INSERT INTO dgv_assets (tenant_id, name, system, classification, system_of_record, owner_id) VALUES (p_tenant, trim(p_name), trim(p_system), p_class, trim(p_sor), p_actor) RETURNING id INTO v_id;
     PERFORM dgv_log(p_tenant, 'asset', v_id::text, 'register ' || p_class, p_actor);
     RETURN 'ok:' || v_id;
   EXCEPTION WHEN unique_violation THEN RETURN 'A dataset with that name is already registered.';
   END $$`,
  // Raising a classification applies at once; lowering it is proposed and needs a second steward.
  `CREATE OR REPLACE FUNCTION dgv_classify(p_actor text, p_tenant text, p_id bigint, p_class text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x dgv_assets;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards classify datasets.'; END IF;
     SELECT * INTO x FROM dgv_assets WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF x.id IS NULL THEN RETURN 'Dataset not found.'; END IF;
     IF x.version <> p_version THEN RETURN 'This dataset changed since you opened it. Reload and try again.'; END IF;
     IF dgv_class_rank(p_class) IS NULL THEN RETURN 'Unknown classification.'; END IF;
     IF x.pending_class IS NOT NULL AND p_class = x.pending_class THEN
       IF x.pending_by = p_actor THEN RETURN 'Another steward confirms a lower classification.'; END IF;
       UPDATE dgv_assets SET classification = p_class, pending_class = NULL, pending_by = NULL, version = version + 1 WHERE id = p_id;
       PERFORM dgv_log(p_tenant, 'asset', p_id::text, 'lowered to ' || p_class, p_actor);
     ELSIF dgv_class_rank(p_class) >= dgv_class_rank(x.classification) THEN
       UPDATE dgv_assets SET classification = p_class, pending_class = NULL, pending_by = NULL, version = version + 1 WHERE id = p_id;
       PERFORM dgv_log(p_tenant, 'asset', p_id::text, 'raised to ' || p_class, p_actor);
     ELSE
       UPDATE dgv_assets SET pending_class = p_class, pending_by = p_actor, version = version + 1 WHERE id = p_id;
       PERFORM dgv_log(p_tenant, 'asset', p_id::text, 'proposed lower ' || p_class, p_actor);
       RETURN 'pending';
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_link(p_actor text, p_tenant text, p_from bigint, p_to bigint, p_transform text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards record lineage.'; END IF;
     IF p_from = p_to THEN RETURN 'A dataset cannot feed itself.'; END IF;
     IF (SELECT count(*) FROM dgv_assets WHERE id IN (p_from, p_to) AND tenant_id = p_tenant) <> 2 THEN RETURN 'Dataset not found.'; END IF;
     IF EXISTS (WITH RECURSIVE down(id) AS (SELECT p_to UNION SELECT l.to_id FROM dgv_lineage l JOIN down d ON l.from_id = d.id) SELECT 1 FROM down WHERE id = p_from)
       THEN RETURN 'That link would make the lineage circular.'; END IF;
     INSERT INTO dgv_lineage (from_id, to_id, transform, added_by) VALUES (p_from, p_to, trim(p_transform), p_actor) ON CONFLICT (from_id, to_id) DO UPDATE SET transform = EXCLUDED.transform;
     PERFORM dgv_log(p_tenant, 'lineage', p_from || '>' || p_to, 'link', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_rule(p_actor text, p_tenant text, p_asset bigint, p_desc text, p_threshold numeric) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards define quality rules.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM dgv_assets WHERE id = p_asset AND tenant_id = p_tenant) THEN RETURN 'Dataset not found.'; END IF;
     INSERT INTO dgv_rules (asset_id, description, threshold, created_by) VALUES (p_asset, trim(p_desc), p_threshold, p_actor) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_measure(p_actor text, p_tenant text, p_rule bigint, p_measured numeric) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r dgv_rules; v_id bigint; v_pass boolean;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards record quality results.'; END IF;
     SELECT q.* INTO r FROM dgv_rules q JOIN dgv_assets a ON a.id = q.asset_id WHERE q.id = p_rule AND a.tenant_id = p_tenant;
     IF r.id IS NULL THEN RETURN 'Rule not found.'; END IF;
     v_pass := p_measured >= r.threshold;
     INSERT INTO dgv_results (rule_id, measured, passed, recorded_by) VALUES (p_rule, p_measured, v_pass, p_actor) RETURNING id INTO v_id;
     IF NOT v_pass THEN INSERT INTO dgv_issues (result_id) VALUES (v_id); END IF;
     RETURN CASE WHEN v_pass THEN 'ok:pass' ELSE 'ok:fail' END;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_resolve_issue(p_actor text, p_tenant text, p_issue bigint, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i dgv_issues;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards resolve quality issues.'; END IF;
     SELECT s.* INTO i FROM dgv_issues s JOIN dgv_results r ON r.id = s.result_id JOIN dgv_rules q ON q.id = r.rule_id JOIN dgv_assets a ON a.id = q.asset_id WHERE s.id = p_issue AND a.tenant_id = p_tenant FOR UPDATE OF s;
     IF i.id IS NULL THEN RETURN 'Issue not found.'; END IF;
     IF i.state <> 'open' THEN RETURN 'Already resolved.'; END IF;
     IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Record what fixed it.'; END IF;
     UPDATE dgv_issues SET state = 'resolved', resolution = trim(p_text), resolved_by = p_actor WHERE id = p_issue;
     PERFORM dgv_log(p_tenant, 'issue', p_issue::text, 'resolve', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_retain(p_actor text, p_tenant text, p_asset bigint, p_days int, p_min int, p_basis text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards set retention.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM dgv_assets WHERE id = p_asset AND tenant_id = p_tenant) THEN RETURN 'Dataset not found.'; END IF;
     IF p_days < p_min THEN RETURN 'Retention cannot be shorter than the legal minimum.'; END IF;
     IF length(trim(coalesce(p_basis, ''))) < 5 THEN RETURN 'Record the legal or policy basis.'; END IF;
     INSERT INTO dgv_retention (asset_id, days, legal_min_days, basis, set_by) VALUES (p_asset, p_days, p_min, trim(p_basis), p_actor)
       ON CONFLICT (asset_id) DO UPDATE SET days = EXCLUDED.days, legal_min_days = EXCLUDED.legal_min_days, basis = EXCLUDED.basis, set_by = EXCLUDED.set_by;
     PERFORM dgv_log(p_tenant, 'retention', p_asset::text, p_days || ' days', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_conflict(p_actor text, p_tenant text, p_subject text, p_a text, p_b text, p_detail text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards log source conflicts.'; END IF;
     IF trim(p_a) = trim(p_b) THEN RETURN 'Name two different sources.'; END IF;
     INSERT INTO dgv_conflicts (tenant_id, subject, source_a, source_b, detail, raised_by) VALUES (p_tenant, trim(p_subject), trim(p_a), trim(p_b), trim(p_detail), p_actor) RETURNING id INTO v_id;
     PERFORM dgv_log(p_tenant, 'conflict', v_id::text, 'raise', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION dgv_settle(p_actor text, p_tenant text, p_id bigint, p_source text, p_rationale text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c dgv_conflicts;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only data stewards settle conflicts.'; END IF;
     SELECT * INTO c FROM dgv_conflicts WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF c.id IS NULL THEN RETURN 'Conflict not found.'; END IF;
     IF c.state <> 'open' THEN RETURN 'Already settled.'; END IF;
     IF c.raised_by = p_actor THEN RETURN 'Another steward settles a conflict you raised.'; END IF;
     IF p_source NOT IN (c.source_a, c.source_b) THEN RETURN 'Choose one of the two sources.'; END IF;
     IF length(trim(coalesce(p_rationale, ''))) < 10 THEN RETURN 'Explain why this source is authoritative.'; END IF;
     UPDATE dgv_conflicts SET state = 'resolved', authoritative = p_source, rationale = trim(p_rationale), resolved_by = p_actor WHERE id = p_id;
     PERFORM dgv_log(p_tenant, 'conflict', p_id::text, 'settle', p_actor);
     RETURN NULL;
   END $$`,
];
