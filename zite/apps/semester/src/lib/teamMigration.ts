// Migration team-001: teaching-team delegation and rubrics.
// - Delegation: an instructor of record lets a member grade in one section until a date. Delegates grade and give
//   feedback; they never release grades (role boundary: "no implied final-grade release"). Revocable; history kept.
// - Rubrics: versions are frozen and append-only; a score records the rubric version and the level chosen per criterion.
// The endpoint checks that the actor is an instructor of the section (Zite section data) before calling these.
export const TEAM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS crs_delegations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, delegate_id text NOT NULL,
     granted_by text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (delegate_id <> granted_by), CHECK (expires_at <= created_at + interval '181 days'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crs_delegations_live ON crs_delegations (section_id, delegate_id) WHERE revoked_at IS NULL`,
  `CREATE OR REPLACE FUNCTION crs_delegate(p_tenant text, p_section text, p_actor text, p_delegate text, p_days int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_delegate = p_actor THEN RETURN 'You already teach this section.'; END IF;
     IF p_days < 1 OR p_days > 180 THEN RETURN 'Delegate for 1 to 180 days.'; END IF;
     UPDATE crs_delegations SET revoked_at = now() WHERE section_id = p_section AND delegate_id = p_delegate AND revoked_at IS NULL;
     INSERT INTO crs_delegations (tenant_id, section_id, delegate_id, granted_by, expires_at) VALUES (p_tenant, p_section, p_delegate, p_actor, now() + make_interval(days => p_days));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION crs_is_delegate(p_tenant text, p_section text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM crs_delegations WHERE tenant_id = p_tenant AND section_id = p_section AND delegate_id = p_user AND revoked_at IS NULL AND expires_at > now()) $$`,
  `CREATE TABLE IF NOT EXISTS rbr_versions (tenant_id text NOT NULL, section_id text NOT NULL, rubric_key text NOT NULL, version int NOT NULL,
     title text NOT NULL, criteria jsonb NOT NULL, max_points numeric NOT NULL CHECK (max_points > 0), author_id text NOT NULL,
     published_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (section_id, rubric_key, version))`,
  `CREATE TABLE IF NOT EXISTS rbr_scores (id bigserial PRIMARY KEY, tenant_id text NOT NULL, submission_id text NOT NULL, section_id text NOT NULL,
     rubric_key text NOT NULL, version int NOT NULL, selections jsonb NOT NULL, score numeric NOT NULL, grader_id text NOT NULL,
     at timestamptz NOT NULL DEFAULT clock_timestamp(), FOREIGN KEY (section_id, rubric_key, version) REFERENCES rbr_versions (section_id, rubric_key, version))`,
  `CREATE OR REPLACE FUNCTION rbr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rbr_versions_append_only') THEN
       CREATE TRIGGER rbr_versions_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rbr_versions FOR EACH STATEMENT EXECUTE FUNCTION rbr_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rbr_scores_append_only') THEN
       CREATE TRIGGER rbr_scores_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rbr_scores FOR EACH STATEMENT EXECUTE FUNCTION rbr_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rbr_publish(p_tenant text, p_section text, p_key text, p_actor text, p_title text, p_criteria jsonb, p_max numeric, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('rbr:' || p_section || ':' || p_key));
     SELECT coalesce(max(version), 0) INTO v FROM rbr_versions WHERE section_id = p_section AND rubric_key = p_key;
     IF v <> p_expected THEN RETURN 'Someone published a newer version of this rubric. Reload.'; END IF;
     INSERT INTO rbr_versions (tenant_id, section_id, rubric_key, version, title, criteria, max_points, author_id) VALUES (p_tenant, p_section, p_key, v + 1, trim(p_title), p_criteria, p_max, p_actor);
     RETURN NULL;
   END $$`,
];
