// Migration idn-001: instructional design (S-76 E04; mirrors lib/designRules.ts). Requires CRS_MIGRATION (Course Studio).
// Reuses Course Studio's store: the only published copy of course content is crs_syllabus_versions (append-only), written only
// through crs_publish_syllabus. Design drafts live here as append-only revisions and are never the published copy, so editing a
// draft cannot change what students see. A release publishes exactly the draft the instructor approved (pinned by SHA-256), and
// only after an accessibility review and a quality review of that same draft both passed, by designers who did not write it.
// Saving a newer draft voids the approval. Publication stays with the section's instructor (checked by the endpoint from the
// Zite section and passed in as p_instructor). Revisions of published material need an impact note. Designers are granted by an
// administrator, never self. Expected-version on request steps; append-only history.
export const IDN_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS idn_designers (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS idn_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('new','revision')),
     scope text NOT NULL CHECK (length(trim(scope)) BETWEEN 10 AND 4000), requested_by text NOT NULL, designer_id text,
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','scoped','building','in_review','approved','released','closed')),
     approved_draft_id bigint, approved_hash text, approved_by text, impact_note text NOT NULL DEFAULT '', released_version int, released_by text,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (state NOT IN ('approved','released') OR (approved_draft_id IS NOT NULL AND approved_hash ~ '^[0-9a-f]{64}$' AND approved_by IS NOT NULL)),
     CHECK (state <> 'released' OR (released_version IS NOT NULL AND released_by IS NOT NULL)),
     CHECK (kind <> 'revision' OR state <> 'released' OR length(trim(impact_note)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS idn_objectives (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES idn_requests(id), code text NOT NULL CHECK (code ~ '^[A-Z0-9.-]{1,12}$'),
     statement text NOT NULL CHECK (length(trim(statement)) BETWEEN 10 AND 500), level text NOT NULL CHECK (level IN ('remember','understand','apply','analyze','evaluate','create')),
     evidence text NOT NULL DEFAULT '' CHECK (length(evidence) <= 500), author_id text NOT NULL, UNIQUE (request_id, code))`,
  `CREATE TABLE IF NOT EXISTS idn_drafts (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES idn_requests(id), rev int NOT NULL, body text NOT NULL CHECK (length(body) BETWEEN 20 AND 40000),
     sha256 text NOT NULL, note text NOT NULL DEFAULT '', author_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE (request_id, rev))`,
  `CREATE TABLE IF NOT EXISTS idn_reviews (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES idn_requests(id), draft_id bigint NOT NULL REFERENCES idn_drafts(id),
     kind text NOT NULL CHECK (kind IN ('accessibility','quality')), passed boolean NOT NULL, findings text NOT NULL DEFAULT '' CHECK (length(findings) <= 4000),
     auto_errors int NOT NULL DEFAULT 0 CHECK (auto_errors >= 0), reviewer_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp(),
     CHECK (NOT (passed AND kind = 'accessibility' AND auto_errors > 0)), CHECK (passed OR length(trim(findings)) >= 5))`,
  `CREATE TABLE IF NOT EXISTS idn_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id bigint, step text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION idn_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'idn_events_append_only') THEN
       CREATE TRIGGER idn_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON idn_events FOR EACH STATEMENT EXECUTE FUNCTION idn_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'idn_drafts_append_only') THEN
       CREATE TRIGGER idn_drafts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON idn_drafts FOR EACH STATEMENT EXECUTE FUNCTION idn_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'idn_reviews_append_only') THEN
       CREATE TRIGGER idn_reviews_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON idn_reviews FOR EACH STATEMENT EXECUTE FUNCTION idn_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_is_designer(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM idn_designers WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION idn_latest_draft(p_req bigint) RETURNS bigint LANGUAGE sql STABLE AS $$
     SELECT id FROM idn_drafts WHERE request_id = p_req ORDER BY rev DESC LIMIT 1 $$`,
  `CREATE OR REPLACE FUNCTION idn_set_designer(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own designer access.'; END IF;
     IF p_on THEN INSERT INTO idn_designers (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE idn_designers SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO idn_events (tenant_id, step, actor_id, note) VALUES (p_tenant, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_request(p_actor text, p_tenant text, p_section text, p_kind text, p_scope text, p_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT p_instructor THEN RETURN 'Only an instructor of this section requests design work.'; END IF;
     IF length(trim(coalesce(p_scope, ''))) < 10 THEN RETURN 'Describe what you need designed.'; END IF;
     IF EXISTS (SELECT 1 FROM idn_requests WHERE tenant_id = p_tenant AND section_id = p_section AND state NOT IN ('released','closed')) THEN
       RETURN 'This section already has open design work.'; END IF;
     INSERT INTO idn_requests (tenant_id, section_id, kind, scope, requested_by) VALUES (p_tenant, p_section, p_kind, trim(p_scope), p_actor) RETURNING id INTO v_id;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id) VALUES (p_tenant, v_id, 'request', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_claim(p_actor text, p_tenant text, p_req bigint, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests;
   BEGIN
     IF NOT idn_is_designer(p_tenant, p_actor) THEN RETURN 'Only an instructional designer takes on design work.'; END IF;
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload and try again.'; END IF;
     IF r.state <> 'requested' THEN RETURN 'Someone has already taken this request.'; END IF;
     UPDATE idn_requests SET designer_id = p_actor, state = 'scoped', version = version + 1 WHERE id = p_req;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id) VALUES (p_tenant, p_req, 'claim', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_objective(p_actor text, p_tenant text, p_req bigint, p_code text, p_statement text, p_level text, p_evidence text, p_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests;
   BEGIN
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL OR NOT (p_instructor OR r.designer_id IS NOT DISTINCT FROM p_actor) THEN RETURN 'Only the instructor or the assigned designer maps objectives.'; END IF;
     IF r.state IN ('released','closed') THEN RETURN 'This request is finished.'; END IF;
     INSERT INTO idn_objectives (request_id, code, statement, level, evidence, author_id) VALUES (p_req, upper(trim(p_code)), trim(p_statement), p_level, coalesce(p_evidence, ''), p_actor)
       ON CONFLICT (request_id, code) DO UPDATE SET statement = EXCLUDED.statement, level = EXCLUDED.level, evidence = EXCLUDED.evidence, author_id = p_actor;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id, note) VALUES (p_tenant, p_req, 'objective', p_actor, upper(trim(p_code)));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_save_draft(p_actor text, p_tenant text, p_req bigint, p_body text, p_note text, p_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests; v_rev int; v_id bigint;
   BEGIN
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL OR NOT (p_instructor OR r.designer_id IS NOT DISTINCT FROM p_actor) THEN RETURN 'Only the instructor or the assigned designer edits the draft.'; END IF;
     IF r.state IN ('requested','released','closed') THEN RETURN CASE WHEN r.state = 'requested' THEN 'A designer takes the request first.' ELSE 'This request is finished; open a revision request.' END; END IF;
     IF length(trim(coalesce(p_body, ''))) < 20 THEN RETURN 'The draft needs at least a few lines.'; END IF;
     SELECT coalesce(max(rev), 0) + 1 INTO v_rev FROM idn_drafts WHERE request_id = p_req;
     INSERT INTO idn_drafts (request_id, rev, body, sha256, note, author_id) VALUES (p_req, v_rev, trim(p_body), encode(sha256(convert_to(trim(p_body), 'UTF8')), 'hex'), coalesce(p_note, ''), p_actor)
       RETURNING id INTO v_id;
     -- A newer draft voids any approval: what was approved is no longer what would be released.
     UPDATE idn_requests SET state = 'building', approved_draft_id = NULL, approved_hash = NULL, approved_by = NULL, version = version + 1 WHERE id = p_req;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id, note) VALUES (p_tenant, p_req, CASE WHEN r.state = 'approved' THEN 'draft_voids_approval' ELSE 'draft' END, p_actor, 'rev ' || v_rev);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_review(p_actor text, p_tenant text, p_req bigint, p_draft bigint, p_kind text, p_passed boolean, p_findings text, p_auto_errors int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests; d idn_drafts;
   BEGIN
     IF NOT idn_is_designer(p_tenant, p_actor) THEN RETURN 'Only an instructional designer records accessibility and quality reviews.'; END IF;
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     SELECT * INTO d FROM idn_drafts WHERE id = p_draft AND request_id = p_req;
     IF r.id IS NULL OR d.id IS NULL THEN RETURN 'Draft not found.'; END IF;
     IF d.id <> idn_latest_draft(p_req) THEN RETURN 'Review the latest draft.'; END IF;
     IF d.author_id = p_actor THEN RETURN 'Someone other than the draft''s author reviews it.'; END IF;
     IF r.state NOT IN ('building','in_review') THEN RETURN 'Nothing is waiting for review.'; END IF;
     IF p_passed AND p_kind = 'accessibility' AND coalesce(p_auto_errors, 0) > 0 THEN RETURN 'The automated accessibility check found errors; fix them before passing.'; END IF;
     IF NOT p_passed AND length(trim(coalesce(p_findings, ''))) < 5 THEN RETURN 'Record the findings.'; END IF;
     INSERT INTO idn_reviews (request_id, draft_id, kind, passed, findings, auto_errors, reviewer_id) VALUES (p_req, p_draft, p_kind, p_passed, coalesce(p_findings, ''), coalesce(p_auto_errors, 0), p_actor);
     UPDATE idn_requests SET state = 'in_review', version = version + 1 WHERE id = p_req;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id, note) VALUES (p_tenant, p_req, p_kind || CASE WHEN p_passed THEN '_pass' ELSE '_changes' END, p_actor, 'rev ' || d.rev);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_review_passed(p_draft bigint, p_kind text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT passed FROM idn_reviews WHERE draft_id = p_draft AND kind = p_kind ORDER BY at DESC, id DESC LIMIT 1), false) $$`,
  `CREATE OR REPLACE FUNCTION idn_approve(p_actor text, p_tenant text, p_req bigint, p_draft bigint, p_hash text, p_instructor boolean, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests; d idn_drafts;
   BEGIN
     IF NOT p_instructor THEN RETURN 'Only an instructor of this section approves publication.'; END IF;
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     SELECT * INTO d FROM idn_drafts WHERE id = p_draft AND request_id = p_req;
     IF r.id IS NULL OR d.id IS NULL THEN RETURN 'Draft not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload and try again.'; END IF;
     IF d.id <> idn_latest_draft(p_req) THEN RETURN 'Approve the latest draft.'; END IF;
     IF d.sha256 <> p_hash THEN RETURN 'The draft you reviewed is not the one on file. Reload.'; END IF;
     IF NOT idn_review_passed(p_draft, 'accessibility') OR NOT idn_review_passed(p_draft, 'quality') THEN RETURN 'This draft needs passing accessibility and quality reviews first.'; END IF;
     UPDATE idn_requests SET state = 'approved', approved_draft_id = d.id, approved_hash = d.sha256, approved_by = p_actor, version = version + 1 WHERE id = p_req;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id, note) VALUES (p_tenant, p_req, 'approve', p_actor, d.sha256);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idn_release(p_actor text, p_tenant text, p_req bigint, p_instructor boolean, p_impact text, p_crs_expected int, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r idn_requests; d idn_drafts; v_err text;
   BEGIN
     IF NOT p_instructor THEN RETURN 'Only an instructor of this section publishes.'; END IF;
     SELECT * INTO r FROM idn_requests WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload and try again.'; END IF;
     IF r.state <> 'approved' THEN RETURN 'Approve the latest draft first.'; END IF;
     SELECT * INTO d FROM idn_drafts WHERE id = r.approved_draft_id;
     IF d.sha256 <> r.approved_hash THEN RETURN 'The approved draft does not match its record.'; END IF;
     IF r.kind = 'revision' AND length(trim(coalesce(p_impact, ''))) < 10 THEN RETURN 'Describe the impact on students already using the current version.'; END IF;
     v_err := crs_publish_syllabus(p_tenant, r.section_id, p_actor, d.body, CASE WHEN r.kind = 'revision' THEN 'Revision: ' || trim(p_impact) ELSE 'Designed release' END, p_crs_expected);
     IF v_err IS NOT NULL THEN RETURN v_err; END IF;
     UPDATE idn_requests SET state = 'released', released_version = p_crs_expected + 1, released_by = p_actor, impact_note = coalesce(trim(p_impact), ''), version = version + 1 WHERE id = p_req;
     INSERT INTO idn_events (tenant_id, request_id, step, actor_id, note) VALUES (p_tenant, p_req, 'release', p_actor, 'syllabus v' || (p_crs_expected + 1));
     RETURN NULL;
   END $$`,
];
