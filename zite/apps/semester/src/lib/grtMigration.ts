// E24 Grants and Sponsored Projects: the sponsored-projects register, built on E23's project
// registry. A grants officer records a grant against a registered project; a DIFFERENT officer
// verifies the sponsor (the scholarship sponsor-verification pattern: a separate recorded act,
// without which activation is impossible — the table CHECK enforces it too). The principal
// investigator files cumulative spend reports against an active grant; reports are records —
// Semester holds and moves no grant money.
export const GRT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS grt_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS grt_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, project_id bigint REFERENCES rsa_requests(id),
     sponsor_org_id bigint REFERENCES pta_orgs(id), sponsor_name text NOT NULL CHECK (length(trim(sponsor_name)) BETWEEN 2 AND 160),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160), amount_cents bigint NOT NULL CHECK (amount_cents > 0),
     pi_id text NOT NULL, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','verified','active','closed','declined')),
     verified_by text, verified_at timestamptz, verification_note text NOT NULL DEFAULT '',
     starts_on date, ends_on date, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
     CHECK (state NOT IN ('active','closed') OR verified_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS grt_reports (id bigserial PRIMARY KEY, grant_id bigint NOT NULL REFERENCES grt_grants(id), actor_id text NOT NULL,
     period text NOT NULL CHECK (length(trim(period)) BETWEEN 3 AND 60), spent_cents bigint NOT NULL CHECK (spent_cents >= 0),
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS grt_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, grant_id bigint NOT NULL, actor_id text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION grt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'grt_events_append_only') THEN
       CREATE TRIGGER grt_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON grt_events FOR EACH STATEMENT EXECUTE FUNCTION grt_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'grt_reports_append_only') THEN
       CREATE TRIGGER grt_reports_append_only BEFORE UPDATE OR DELETE ON grt_reports FOR EACH ROW EXECUTE FUNCTION grt_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_is_officer(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM grt_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION grt_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own grants access.'; END IF;
     IF p_on THEN INSERT INTO grt_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE grt_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_create(p_actor text, p_tenant text, p_project_code text, p_sponsor_org bigint, p_sponsor text, p_title text, p_amount bigint, p_pi text, p_starts date, p_ends date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; v_proj bigint;
   BEGIN
     IF NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only a grants officer can record a grant.'; END IF;
     IF p_project_code IS NOT NULL AND trim(p_project_code) <> '' THEN
       SELECT id INTO v_proj FROM rsa_requests WHERE tenant_id = p_tenant AND project_code = upper(trim(p_project_code)) AND state IN ('approved','closed');
       IF v_proj IS NULL THEN RETURN 'That project code is not a registered project here. Register it in Research admin first.'; END IF;
     END IF;
     INSERT INTO grt_grants (tenant_id, project_id, sponsor_org_id, sponsor_name, title, amount_cents, pi_id, starts_on, ends_on, created_by)
       VALUES (p_tenant, v_proj, p_sponsor_org, trim(p_sponsor), trim(p_title), p_amount, p_pi, p_starts, p_ends, p_actor) RETURNING id INTO v_id;
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step, note) VALUES (p_tenant, v_id, p_actor, 'create', trim(p_sponsor));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_verify(p_actor text, p_tenant text, p_id bigint, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g grt_grants;
   BEGIN
     IF NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only a grants officer can verify a sponsor.'; END IF;
     SELECT * INTO g FROM grt_grants WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Grant not found.'; END IF;
     IF g.state <> 'proposed' THEN RETURN 'Only a proposed grant can be verified.'; END IF;
     IF g.created_by = p_actor THEN RETURN 'The officer who recorded this grant cannot verify its sponsor. Ask another officer.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record what you verified about the sponsor, in a few words.'; END IF;
     UPDATE grt_grants SET state = 'verified', verified_by = p_actor, verified_at = now(), verification_note = left(p_note, 500), updated_at = now() WHERE id = p_id;
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'verify', left(p_note, 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_activate(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only a grants officer can activate a grant.'; END IF;
     SELECT state INTO st FROM grt_grants WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Grant not found.'; END IF;
     IF st <> 'verified' THEN RETURN 'Only a verified grant can be activated — the sponsor must be verified first.'; END IF;
     UPDATE grt_grants SET state = 'active', updated_at = now() WHERE id = p_id;
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'activate');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_decline(p_actor text, p_tenant text, p_id bigint, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only a grants officer can decline a grant.'; END IF;
     SELECT state INTO st FROM grt_grants WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Grant not found.'; END IF;
     IF st NOT IN ('proposed','verified') THEN RETURN 'Only a proposed or verified grant can be declined.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the grant is declined, in a few words.'; END IF;
     UPDATE grt_grants SET state = 'declined', updated_at = now() WHERE id = p_id;
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'decline', left(p_note, 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_report(p_actor text, p_tenant text, p_id bigint, p_period text, p_spent bigint, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g grt_grants;
   BEGIN
     SELECT * INTO g FROM grt_grants WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Grant not found.'; END IF;
     IF g.pi_id <> p_actor AND NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only the principal investigator or a grants officer files spend reports.'; END IF;
     IF g.state <> 'active' THEN RETURN 'Spend reports are filed on active grants.'; END IF;
     IF p_spent > g.amount_cents THEN RETURN 'Reported spend cannot exceed the awarded amount.'; END IF;
     IF EXISTS (SELECT 1 FROM grt_reports WHERE grant_id = p_id AND spent_cents > p_spent) THEN RETURN 'Cumulative spend cannot go down — a later report already recorded more.'; END IF;
     INSERT INTO grt_reports (grant_id, actor_id, period, spent_cents, note) VALUES (p_id, p_actor, trim(p_period), p_spent, left(coalesce(p_note, ''), 500));
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'report', trim(p_period));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grt_close(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT grt_is_officer(p_tenant, p_actor) THEN RETURN 'Only a grants officer can close a grant.'; END IF;
     SELECT state INTO st FROM grt_grants WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Grant not found.'; END IF;
     IF st <> 'active' THEN RETURN 'Only an active grant can be closed.'; END IF;
     UPDATE grt_grants SET state = 'closed', updated_at = now() WHERE id = p_id;
     INSERT INTO grt_events (tenant_id, grant_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'close');
     RETURN NULL;
   END $$`,
];
