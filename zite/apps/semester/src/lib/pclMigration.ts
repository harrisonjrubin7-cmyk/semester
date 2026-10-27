// Migration pcl-001: Portfolio Council (credential evidence governance). Works on program-level evidence packages, never on
// individual student records or student portfolios. Council members and chairs are granted by an administrator, never self.
// Rubrics are drafted by one member and adopted by another. Members keep a reviewer pool; a reviewer who declares a conflict on a
// package cannot be assigned to it, and nobody reviews a package they submitted. A package is validated only when at least two
// assigned reviews exist and every one says the standard is met. A chair who is not the submitter recommends the credential to
// the registrar (a recommendation, not an award). The submitter may appeal a "not validated" outcome once; a chair who did not
// review the package decides it. Append-only history.
export const PCL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS pcl_members (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('member','chair')), granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_rubrics (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120), criteria text NOT NULL CHECK (length(trim(criteria)) >= 20),
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','adopted','retired')), author_id text NOT NULL, adopted_by text, version int NOT NULL DEFAULT 1,
     CHECK (adopted_by IS NULL OR adopted_by <> author_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_reviewers (tenant_id text NOT NULL, user_id text NOT NULL, added_by text NOT NULL, active boolean NOT NULL DEFAULT true, PRIMARY KEY (tenant_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_packages (id bigserial PRIMARY KEY, tenant_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200), credential text NOT NULL,
     rubric_id bigint NOT NULL REFERENCES pcl_rubrics(id), summary text NOT NULL CHECK (length(trim(summary)) >= 20), submitted_by text NOT NULL,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','validated','not_validated','appealed','recommended','closed')),
     appealed boolean NOT NULL DEFAULT false, appeal_reason text NOT NULL DEFAULT '', decided_by text, decision_note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS pcl_conflicts (package_id bigint NOT NULL REFERENCES pcl_packages(id), reviewer_id text NOT NULL, reason text NOT NULL CHECK (length(trim(reason)) >= 5),
     at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (package_id, reviewer_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_assignments (package_id bigint NOT NULL REFERENCES pcl_packages(id), reviewer_id text NOT NULL, assigned_by text NOT NULL, PRIMARY KEY (package_id, reviewer_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_reviews (package_id bigint NOT NULL, reviewer_id text NOT NULL, score int NOT NULL CHECK (score BETWEEN 0 AND 4), met boolean NOT NULL,
     note text NOT NULL CHECK (length(trim(note)) >= 10), at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (package_id, reviewer_id),
     FOREIGN KEY (package_id, reviewer_id) REFERENCES pcl_assignments(package_id, reviewer_id))`,
  `CREATE TABLE IF NOT EXISTS pcl_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION pcl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pcl_events_append_only') THEN
       CREATE TRIGGER pcl_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON pcl_events FOR EACH STATEMENT EXECUTE FUNCTION pcl_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pcl_reviews_append_only') THEN
       CREATE TRIGGER pcl_reviews_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON pcl_reviews FOR EACH STATEMENT EXECUTE FUNCTION pcl_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_role(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT role FROM pcl_members WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE OR REPLACE FUNCTION pcl_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO pcl_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION pcl_set_member(p_admin text, p_tenant text, p_user text, p_role text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_role IS NULL OR p_role = 'none' THEN UPDATE pcl_members SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_role IN ('member','chair') THEN INSERT INTO pcl_members (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE RETURN 'Unknown role.'; END IF;
     PERFORM pcl_log(p_tenant, 'member', p_user, coalesce(p_role, 'none'), p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_rubric(p_actor text, p_tenant text, p_name text, p_criteria text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF pcl_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only council members draft rubrics.'; END IF;
     INSERT INTO pcl_rubrics (tenant_id, name, criteria, author_id) VALUES (p_tenant, trim(p_name), trim(p_criteria), p_actor) RETURNING id INTO v_id;
     PERFORM pcl_log(p_tenant, 'rubric', v_id::text, 'draft', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_rubric_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r pcl_rubrics;
   BEGIN
     IF pcl_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only council members decide rubrics.'; END IF;
     SELECT * INTO r FROM pcl_rubrics WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Rubric not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This rubric changed since you opened it. Reload and review again.'; END IF;
     IF p_step = 'adopt' THEN
       IF r.state <> 'draft' THEN RETURN 'Only drafts are adopted.'; END IF;
       IF r.author_id = p_actor THEN RETURN 'Another member adopts your draft.'; END IF;
       UPDATE pcl_rubrics SET state = 'adopted', adopted_by = p_actor, version = version + 1 WHERE id = p_id;
     ELSIF p_step = 'retire' THEN
       IF r.state <> 'adopted' THEN RETURN 'Only adopted rubrics are retired.'; END IF;
       UPDATE pcl_rubrics SET state = 'retired', version = version + 1 WHERE id = p_id;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM pcl_log(p_tenant, 'rubric', p_id::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_reviewer(p_actor text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF pcl_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only council members manage the reviewer pool.'; END IF;
     INSERT INTO pcl_reviewers (tenant_id, user_id, added_by, active) VALUES (p_tenant, p_user, p_actor, p_on)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET active = p_on, added_by = p_actor;
     PERFORM pcl_log(p_tenant, 'reviewer', p_user, CASE WHEN p_on THEN 'add' ELSE 'remove' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_submit(p_actor text, p_tenant text, p_title text, p_credential text, p_rubric bigint, p_summary text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pcl_rubrics WHERE id = p_rubric AND tenant_id = p_tenant AND state = 'adopted') THEN RETURN 'Choose an adopted rubric.'; END IF;
     INSERT INTO pcl_packages (tenant_id, title, credential, rubric_id, summary, submitted_by) VALUES (p_tenant, trim(p_title), trim(p_credential), p_rubric, trim(p_summary), p_actor) RETURNING id INTO v_id;
     PERFORM pcl_log(p_tenant, 'package', v_id::text, 'submit', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_declare(p_actor text, p_tenant text, p_package bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pcl_packages WHERE id = p_package AND tenant_id = p_tenant) THEN RETURN 'Package not found.'; END IF;
     IF EXISTS (SELECT 1 FROM pcl_reviews WHERE package_id = p_package AND reviewer_id = p_actor) THEN RETURN 'You already reviewed this package; tell the chair directly.'; END IF;
     INSERT INTO pcl_conflicts (package_id, reviewer_id, reason) VALUES (p_package, p_actor, trim(p_reason)) ON CONFLICT DO NOTHING;
     DELETE FROM pcl_assignments WHERE package_id = p_package AND reviewer_id = p_actor;
     PERFORM pcl_log(p_tenant, 'conflict', p_package || ' ' || p_actor, 'declare', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_assign(p_actor text, p_tenant text, p_package bigint, p_reviewer text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k pcl_packages;
   BEGIN
     IF pcl_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only council members assign reviewers.'; END IF;
     SELECT * INTO k FROM pcl_packages WHERE id = p_package AND tenant_id = p_tenant;
     IF k.id IS NULL THEN RETURN 'Package not found.'; END IF;
     IF k.state NOT IN ('submitted','appealed') THEN RETURN 'This package is not open for review.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pcl_reviewers WHERE tenant_id = p_tenant AND user_id = p_reviewer AND active) THEN RETURN 'Choose someone in the reviewer pool.'; END IF;
     IF p_reviewer = k.submitted_by THEN RETURN 'The submitter cannot review their own package.'; END IF;
     IF EXISTS (SELECT 1 FROM pcl_conflicts WHERE package_id = p_package AND reviewer_id = p_reviewer) THEN RETURN 'That reviewer declared a conflict on this package.'; END IF;
     INSERT INTO pcl_assignments (package_id, reviewer_id, assigned_by) VALUES (p_package, p_reviewer, p_actor) ON CONFLICT DO NOTHING;
     PERFORM pcl_log(p_tenant, 'package', p_package::text, 'assign ' || p_reviewer, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pcl_review(p_actor text, p_tenant text, p_package bigint, p_score int, p_met boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k pcl_packages;
   BEGIN
     SELECT * INTO k FROM pcl_packages WHERE id = p_package AND tenant_id = p_tenant;
     IF k.id IS NULL THEN RETURN 'Package not found.'; END IF;
     IF k.state NOT IN ('submitted','appealed') THEN RETURN 'This package is not open for review.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pcl_assignments WHERE package_id = p_package AND reviewer_id = p_actor) THEN RETURN 'You are not assigned to this package.'; END IF;
     IF EXISTS (SELECT 1 FROM pcl_reviews WHERE package_id = p_package AND reviewer_id = p_actor) THEN RETURN 'Your review is already recorded.'; END IF;
     INSERT INTO pcl_reviews (package_id, reviewer_id, score, met, note) VALUES (p_package, p_actor, p_score, p_met, trim(p_note));
     PERFORM pcl_log(p_tenant, 'package', p_package::text, 'review', p_actor);
     RETURN NULL;
   END $$`,
  // validate: a member closes review once two or more reviews exist. recommend: a chair, not the submitter. appeal: the submitter, once.
  `CREATE OR REPLACE FUNCTION pcl_step(p_actor text, p_tenant text, p_package bigint, p_step text, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k pcl_packages; n int; m int; v_role text := pcl_role(p_tenant, p_actor);
   BEGIN
     SELECT * INTO k FROM pcl_packages WHERE id = p_package AND tenant_id = p_tenant FOR UPDATE;
     IF k.id IS NULL THEN RETURN 'Package not found.'; END IF;
     IF k.version <> p_version THEN RETURN 'This package changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'close_review' THEN
       IF v_role IS NULL THEN RETURN 'Only council members close review.'; END IF;
       IF k.state NOT IN ('submitted','appealed') THEN RETURN 'Review is not open.'; END IF;
       IF k.state = 'appealed' AND (v_role <> 'chair' OR EXISTS (SELECT 1 FROM pcl_reviews WHERE package_id = p_package AND reviewer_id = p_actor) OR p_actor = k.submitted_by)
         THEN RETURN 'A chair who did not review this package decides the appeal.'; END IF;
       SELECT count(*), count(*) FILTER (WHERE met) INTO n, m FROM pcl_reviews WHERE package_id = p_package;
       IF n < 2 THEN RETURN 'At least two reviews are needed.'; END IF;
       UPDATE pcl_packages SET state = CASE WHEN m = n THEN 'validated' ELSE 'not_validated' END, decided_by = p_actor, decision_note = coalesce(p_note, ''), version = version + 1 WHERE id = p_package;
     ELSIF p_step = 'recommend' THEN
       IF v_role IS DISTINCT FROM 'chair' THEN RETURN 'Only a council chair recommends a credential.'; END IF;
       IF p_actor = k.submitted_by THEN RETURN 'Another chair recommends your package.'; END IF;
       IF k.state <> 'validated' THEN RETURN 'Only validated packages are recommended.'; END IF;
       UPDATE pcl_packages SET state = 'recommended', decided_by = p_actor, decision_note = coalesce(p_note, ''), version = version + 1 WHERE id = p_package;
     ELSIF p_step = 'appeal' THEN
       IF p_actor <> k.submitted_by THEN RETURN 'Only the submitter appeals.'; END IF;
       IF k.state <> 'not_validated' THEN RETURN 'Only a "not validated" outcome can be appealed.'; END IF;
       IF k.appealed THEN RETURN 'This package was already appealed once.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 20 THEN RETURN 'Explain the grounds for appeal.'; END IF;
       UPDATE pcl_packages SET state = 'appealed', appealed = true, appeal_reason = trim(p_note), version = version + 1 WHERE id = p_package;
     ELSIF p_step = 'close' THEN
       IF p_actor <> k.submitted_by AND v_role IS NULL THEN RETURN 'Only the submitter or a member closes a package.'; END IF;
       IF k.state IN ('recommended','closed') THEN RETURN 'Already finished.'; END IF;
       UPDATE pcl_packages SET state = 'closed', version = version + 1 WHERE id = p_package;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM pcl_log(p_tenant, 'package', p_package::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
];
