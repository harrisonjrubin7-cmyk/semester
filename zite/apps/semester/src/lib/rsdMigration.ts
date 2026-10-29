// Migration rsd-001: research datasets, cohorts and reproducible snapshots (role app "Institutional Researcher": datasets,
// cohorts, reproducible analysis). Builds on dgv-001 (dgv_is: data stewards) and lib/analytics.ts (METRICS, suppress, MIN_CELL).
// - Institutional researchers are appointed by an administrator, never themselves; revocation applies on the next call.
// - A researcher drafts a cohort (criteria: roles, optional term of enrollment) or a dataset (a bundle of approved metric ids and
//   cohorts). A data steward who is not the author approves the exact definition (hash). Approved definitions are never edited:
//   a new version is a new draft, and approving it retires the old one.
// - A snapshot runs only an approved dataset version. The endpoint computes it from aggregate SQL and passes it through the
//   disclosure control (no count under MIN_CELL leaves the server); this function refuses an output holding any visible number
//   under the minimum, pins the definition hash and code version, and keeps it append-only. Re-running the same definition says
//   whether the output matches the earlier run (reproducible) or the data moved.
// - Nothing here stores or reads a person-level row.
export const RSD_METRIC_IDS = ['members_by_role', 'enrollments_by_status', 'registration_requests', 'rejection_reasons', 'holds_by_office', 'payment_plans'] as const;
export const RSD_ROLES = ['Student', 'Faculty', 'Staff', 'Advisor', 'Administrator', 'Tutor', 'Registrar'] as const;
export const RSD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rsd_analysts (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS rsd_defs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('cohort', 'dataset')), lineage text NOT NULL,
     version int NOT NULL DEFAULT 1, title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140), purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 20 AND 2000),
     spec jsonb NOT NULL, spec_hash text NOT NULL, state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in_review', 'approved', 'retired')),
     author_id text NOT NULL, approver_id text, review_note text NOT NULL DEFAULT '', rev int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, lineage, version), CHECK (approver_id IS NULL OR approver_id <> author_id), CHECK (state NOT IN ('approved', 'retired') OR approver_id IS NOT NULL OR state = 'retired'))`,
  `CREATE TABLE IF NOT EXISTS rsd_snapshots (id bigserial PRIMARY KEY, tenant_id text NOT NULL, def_id bigint NOT NULL REFERENCES rsd_defs(id), spec_hash text NOT NULL,
     code_version text NOT NULL, min_cell int NOT NULL, output jsonb NOT NULL, output_hash text NOT NULL, matches_previous boolean, run_by text NOT NULL, run_at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS rsd_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, def_id bigint, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rsd_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rsd_events_append_only') THEN
       CREATE TRIGGER rsd_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rsd_events FOR EACH STATEMENT EXECUTE FUNCTION rsd_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rsd_snapshots_append_only') THEN
       CREATE TRIGGER rsd_snapshots_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rsd_snapshots FOR EACH STATEMENT EXECUTE FUNCTION rsd_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsd_is_analyst(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rsd_analysts WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION rsd_set_analyst(p_admin text, p_is_admin boolean, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only administrators appoint institutional researchers.'; END IF;
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_on THEN INSERT INTO rsd_analysts (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE rsd_analysts SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO rsd_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'analyst_added' ELSE 'analyst_removed' END, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rsd_spec_hash(p_title text, p_purpose text, p_spec jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(concat_ws('|', p_title, p_purpose, p_spec::text)) $$`,
  // Spec rules: why a spec is refused, or NULL. Datasets may only name approved cohorts of the same institution.
  `CREATE OR REPLACE FUNCTION rsd_spec_problem(p_tenant text, p_kind text, p_spec jsonb) RETURNS text LANGUAGE plpgsql STABLE AS $$
   DECLARE x text; n int;
   BEGIN
     IF p_kind = 'cohort' THEN
       IF jsonb_typeof(p_spec->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(p_spec->'roles') = 0 THEN RETURN 'A cohort names at least one role.'; END IF;
       FOR x IN SELECT jsonb_array_elements_text(p_spec->'roles') LOOP
         IF x NOT IN ('Student', 'Faculty', 'Staff', 'Advisor', 'Administrator', 'Tutor', 'Registrar') THEN RETURN 'Unknown role in the cohort.'; END IF;
       END LOOP;
       IF p_spec ? 'term' AND length(trim(coalesce(p_spec->>'term', ''))) NOT BETWEEN 2 AND 40 THEN RETURN 'A term filter needs a term name.'; END IF;
       IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_spec) k WHERE k NOT IN ('roles', 'term')) THEN RETURN 'Cohorts filter by roles and term only.'; END IF;
       RETURN NULL;
     ELSIF p_kind = 'dataset' THEN
       IF jsonb_typeof(p_spec->'metrics') IS DISTINCT FROM 'array' THEN RETURN 'A dataset names metrics.'; END IF;
       FOR x IN SELECT jsonb_array_elements_text(p_spec->'metrics') LOOP
         IF x NOT IN ('members_by_role', 'enrollments_by_status', 'registration_requests', 'rejection_reasons', 'holds_by_office', 'payment_plans') THEN RETURN 'Only defined metrics can be used.'; END IF;
       END LOOP;
       IF jsonb_typeof(coalesce(p_spec->'cohorts', '[]'::jsonb)) <> 'array' THEN RETURN 'Cohorts must be a list.'; END IF;
       SELECT count(*) INTO n FROM jsonb_array_elements_text(coalesce(p_spec->'cohorts', '[]'::jsonb)) c
         WHERE NOT EXISTS (SELECT 1 FROM rsd_defs d WHERE d.id::text = c AND d.tenant_id = p_tenant AND d.kind = 'cohort' AND d.state = 'approved');
       IF n > 0 THEN RETURN 'A dataset can only use approved cohorts.'; END IF;
       IF jsonb_array_length(p_spec->'metrics') + jsonb_array_length(coalesce(p_spec->'cohorts', '[]'::jsonb)) = 0 THEN RETURN 'A dataset needs at least one metric or cohort.'; END IF;
       IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_spec) k WHERE k NOT IN ('metrics', 'cohorts')) THEN RETURN 'Datasets name metrics and cohorts only.'; END IF;
       RETURN NULL;
     END IF;
     RETURN 'Unknown definition kind.';
   END $$`,
  // Definition steps. Returns 'ok:id' or the reason it was refused.
  `CREATE OR REPLACE FUNCTION rsd_def(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_kind text, p_title text, p_purpose text, p_spec jsonb, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d rsd_defs; v_id bigint; e text; v_to text;
   BEGIN
     IF p_step = 'draft' THEN
       IF NOT rsd_is_analyst(p_tenant, p_actor) THEN RETURN 'Only institutional researchers draft cohorts and datasets.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_purpose, ''))) < 20 THEN RETURN 'Give a title and the purpose (20+ characters).'; END IF;
       e := rsd_spec_problem(p_tenant, p_kind, p_spec); IF e IS NOT NULL THEN RETURN e; END IF;
       INSERT INTO rsd_defs (tenant_id, kind, lineage, title, purpose, spec, spec_hash, author_id) VALUES (p_tenant, p_kind, md5(p_tenant || p_actor || clock_timestamp()::text), trim(p_title), trim(p_purpose), p_spec, rsd_spec_hash(trim(p_title), trim(p_purpose), p_spec), p_actor) RETURNING id INTO v_id;
       INSERT INTO rsd_events (tenant_id, def_id, actor_id, action, detail) VALUES (p_tenant, v_id, p_actor, 'draft', p_kind);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO d FROM rsd_defs WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR d.tenant_id <> p_tenant OR NOT (rsd_is_analyst(p_tenant, p_actor) OR dgv_is(p_tenant, p_actor)) THEN RETURN 'Definition not found.'; END IF;
     IF p_expected IS DISTINCT FROM d.rev THEN RETURN 'This definition changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF d.author_id <> p_actor THEN RETURN 'Only the author edits a draft.'; END IF;
       IF d.state <> 'draft' THEN RETURN 'Only drafts are edited. Start a new version instead.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_purpose, ''))) < 20 THEN RETURN 'Give a title and the purpose (20+ characters).'; END IF;
       e := rsd_spec_problem(p_tenant, d.kind, p_spec); IF e IS NOT NULL THEN RETURN e; END IF;
       UPDATE rsd_defs SET title = trim(p_title), purpose = trim(p_purpose), spec = p_spec, spec_hash = rsd_spec_hash(trim(p_title), trim(p_purpose), p_spec) WHERE id = d.id; v_to := 'draft';
     ELSIF p_step = 'submit' THEN
       IF d.author_id <> p_actor THEN RETURN 'Only the author submits it.'; END IF;
       IF d.state <> 'draft' THEN RETURN 'Only drafts are submitted.'; END IF;
       UPDATE rsd_defs SET state = 'in_review' WHERE id = d.id; v_to := 'in_review';
     ELSIF p_step IN ('approve', 'return') THEN
       IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward approves research definitions.'; END IF;
       IF d.author_id = p_actor THEN RETURN 'You wrote this definition, so another steward approves it.'; END IF;
       IF d.state <> 'in_review' THEN RETURN 'This definition is not waiting for review.'; END IF;
       IF p_seen IS DISTINCT FROM d.spec_hash THEN RETURN 'The definition changed since you opened it. Reload and review again.'; END IF;
       IF p_step = 'return' THEN
         IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say what needs changing (10+ characters).'; END IF;
         UPDATE rsd_defs SET state = 'draft', review_note = trim(p_note) WHERE id = d.id; v_to := 'draft';
       ELSE
         e := rsd_spec_problem(p_tenant, d.kind, d.spec); IF e IS NOT NULL THEN RETURN e; END IF;
         UPDATE rsd_defs SET state = 'retired', rev = rev + 1, updated_at = now() WHERE tenant_id = p_tenant AND lineage = d.lineage AND state = 'approved' AND id <> d.id;
         UPDATE rsd_defs SET state = 'approved', approver_id = p_actor, review_note = coalesce(p_note, '') WHERE id = d.id; v_to := 'approved';
       END IF;
     ELSIF p_step = 'new_version' THEN
       IF NOT rsd_is_analyst(p_tenant, p_actor) THEN RETURN 'Only institutional researchers start a new version.'; END IF;
       IF d.state <> 'approved' THEN RETURN 'Start a new version from the approved one.'; END IF;
       IF EXISTS (SELECT 1 FROM rsd_defs WHERE tenant_id = p_tenant AND lineage = d.lineage AND state IN ('draft', 'in_review')) THEN RETURN 'A new version is already open.'; END IF;
       INSERT INTO rsd_defs (tenant_id, kind, lineage, version, title, purpose, spec, spec_hash, author_id)
         VALUES (p_tenant, d.kind, d.lineage, (SELECT max(version) + 1 FROM rsd_defs WHERE tenant_id = p_tenant AND lineage = d.lineage), d.title, d.purpose, d.spec, d.spec_hash, p_actor) RETURNING id INTO v_id;
       INSERT INTO rsd_events (tenant_id, def_id, actor_id, action, detail) VALUES (p_tenant, v_id, p_actor, 'new_version', 'from ' || d.id);
       RETURN 'ok:' || v_id;
     ELSIF p_step = 'retire' THEN
       IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward retires a definition.'; END IF;
       IF d.state <> 'approved' THEN RETURN 'Only an approved definition is retired.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
       UPDATE rsd_defs SET state = 'retired', review_note = trim(p_note) WHERE id = d.id; v_to := 'retired';
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE rsd_defs SET rev = rev + 1, updated_at = now() WHERE id = d.id;
     INSERT INTO rsd_events (tenant_id, def_id, actor_id, action, detail) VALUES (p_tenant, d.id, p_actor, p_step, v_to);
     RETURN 'ok:' || d.id;
   END $$`,
  // Store a snapshot computed by the endpoint. p_output: {"tables":[{"key":..., "cells":[{"label":..,"value":n|null,"suppressed":bool}], "total": n|null}]}
  `CREATE OR REPLACE FUNCTION rsd_snapshot(p_tenant text, p_actor text, p_def bigint, p_seen text, p_code text, p_min int, p_output jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d rsd_defs; v_hash text; v_prev text; v_id bigint; small int;
   BEGIN
     IF NOT rsd_is_analyst(p_tenant, p_actor) THEN RETURN 'Only institutional researchers run snapshots.'; END IF;
     SELECT * INTO d FROM rsd_defs WHERE id = p_def;
     IF NOT FOUND OR d.tenant_id <> p_tenant OR d.kind <> 'dataset' THEN RETURN 'Dataset not found.'; END IF;
     IF d.state <> 'approved' THEN RETURN 'Only an approved dataset version is run.'; END IF;
     IF p_seen IS DISTINCT FROM d.spec_hash THEN RETURN 'The dataset changed since you opened it. Reload and run again.'; END IF;
     IF coalesce(p_min, 0) < 10 THEN RETURN 'The disclosure minimum is at least 10.'; END IF;
     SELECT count(*) INTO small FROM jsonb_array_elements(coalesce(p_output->'tables', '[]'::jsonb)) t, jsonb_array_elements(coalesce(t->'cells', '[]'::jsonb)) c
       WHERE jsonb_typeof(c->'value') = 'number' AND (c->>'value')::numeric > 0 AND (c->>'value')::numeric < p_min;
     IF small > 0 THEN RETURN 'The output shows a count under the disclosure minimum. Nothing was stored.'; END IF;
     SELECT count(*) INTO small FROM jsonb_array_elements(coalesce(p_output->'tables', '[]'::jsonb)) t
       WHERE jsonb_typeof(t->'total') = 'number' AND (t->>'total')::numeric > 0 AND (t->>'total')::numeric < p_min;
     IF small > 0 THEN RETURN 'The output shows a total under the disclosure minimum. Nothing was stored.'; END IF;
     v_hash := md5(p_output::text);
     SELECT output_hash INTO v_prev FROM rsd_snapshots WHERE def_id = d.id AND spec_hash = d.spec_hash AND code_version = p_code ORDER BY id DESC LIMIT 1;
     INSERT INTO rsd_snapshots (tenant_id, def_id, spec_hash, code_version, min_cell, output, output_hash, matches_previous, run_by)
       VALUES (p_tenant, d.id, d.spec_hash, p_code, p_min, p_output, v_hash, CASE WHEN v_prev IS NULL THEN NULL ELSE v_prev = v_hash END, p_actor) RETURNING id INTO v_id;
     INSERT INTO rsd_events (tenant_id, def_id, actor_id, action, detail) VALUES (p_tenant, d.id, p_actor, 'snapshot', 'snapshot ' || v_id);
     RETURN 'ok:' || v_id;
   END $$`,
];
