// Migration pta-001: partner administration (S-76 E30; mirrors lib/partnerRules.ts).
// Enforced here: organization names unique (normalised); org members are added and removed only by that organization's own
// admins, who cannot change themselves or remove the last admin; institution partner managers are granted by an
// administrator, never self, and act on no organization they belong to; verification and the agreement proposal are made by
// different managers; agreement text, end date and scopes are pinned by hash and accepted by an org admin; scopes come only
// from the published list and only from the institution; pta_live() is the single check other modules use for partner
// access (active and not past its end date); offboarding keeps every row. Expected-version everywhere; append-only history.
export const PTA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS pta_orgs (id bigserial PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120), name_key text NOT NULL UNIQUE,
     kind text NOT NULL CHECK (kind IN ('marketplace','transfer','research','employer','service')), website text NOT NULL DEFAULT '' CHECK (length(website) <= 200),
     created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS pta_members (org_id bigint NOT NULL REFERENCES pta_orgs(id), user_id text NOT NULL, role text NOT NULL CHECK (role IN ('admin','member')),
     added_by text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(), removed_by text, removed_at timestamptz, PRIMARY KEY (org_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS pta_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS pta_relationships (id bigserial PRIMARY KEY, tenant_id text NOT NULL, org_id bigint NOT NULL REFERENCES pta_orgs(id),
     state text NOT NULL DEFAULT 'applied' CHECK (state IN ('applied','verified','agreement_pending','active','suspended','offboarded','rejected')),
     requested_scopes text[] NOT NULL DEFAULT '{}', application_note text NOT NULL DEFAULT '' CHECK (length(application_note) <= 2000),
     verified_by text, verification_note text NOT NULL DEFAULT '', proposed_by text, agreement_text text NOT NULL DEFAULT '', scopes text[] NOT NULL DEFAULT '{}', valid_to date,
     agreement_hash text, accepted_hash text, accepted_by text, accepted_at timestamptz, status_note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, org_id),
     CHECK (proposed_by IS NULL OR proposed_by <> verified_by),
     CHECK (scopes <@ ARRAY['publish_listings','view_orders','propose_articulation','manage_course_mappings','submit_research_requests','post_opportunities']::text[]),
     CHECK (state <> 'active' OR (accepted_hash IS NOT NULL AND accepted_hash = agreement_hash AND valid_to IS NOT NULL AND cardinality(scopes) > 0)))`,
  `CREATE TABLE IF NOT EXISTS pta_events (id bigserial PRIMARY KEY, tenant_id text, org_id bigint, subject text NOT NULL, step text NOT NULL, actor_id text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION pta_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pta_events_append_only') THEN
       CREATE TRIGGER pta_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON pta_events FOR EACH STATEMENT EXECUTE FUNCTION pta_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_role(p_org bigint, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT role FROM pta_members WHERE org_id = p_org AND user_id = p_user AND removed_at IS NULL $$`,
  `CREATE OR REPLACE FUNCTION pta_is_manager(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM pta_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION pta_live(p_tenant text, p_org bigint, p_scope text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM pta_relationships WHERE tenant_id = p_tenant AND org_id = p_org AND state = 'active' AND valid_to >= current_date AND p_scope = ANY(scopes)) $$`,
  `CREATE OR REPLACE FUNCTION pta_hash(p_text text, p_to date, p_scopes text[]) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT encode(sha256(convert_to(trim(p_text) || '|' || p_to::text || '|' || array_to_string(ARRAY(SELECT unnest(p_scopes) ORDER BY 1), ','), 'UTF8')), 'hex') $$`,
  `CREATE OR REPLACE FUNCTION pta_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own partner-manager access.'; END IF;
     IF p_on THEN INSERT INTO pta_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE pta_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO pta_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'staff', CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_register(p_user text, p_name text, p_kind text, p_website text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; k text := lower(regexp_replace(trim(p_name), '\\s+', ' ', 'g'));
   BEGIN
     IF EXISTS (SELECT 1 FROM pta_orgs WHERE name_key = k) THEN RETURN 'An organization with that name is already registered. Ask one of its administrators to add you.'; END IF;
     INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES (trim(p_name), k, p_kind, trim(coalesce(p_website, '')), p_user) RETURNING id INTO v_id;
     INSERT INTO pta_members (org_id, user_id, role, added_by) VALUES (v_id, p_user, 'admin', p_user);
     INSERT INTO pta_events (org_id, subject, step, actor_id) VALUES (v_id, 'org', 'register', p_user);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_member(p_actor text, p_org bigint, p_user text, p_role text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE admins int; cur text;
   BEGIN
     PERFORM 1 FROM pta_orgs WHERE id = p_org FOR UPDATE;
     IF pta_role(p_org, p_actor) IS DISTINCT FROM 'admin' THEN RETURN 'Only an administrator of this organization manages its members.'; END IF;
     IF p_user = p_actor THEN RETURN 'Another administrator of your organization changes your own role.'; END IF;
     cur := pta_role(p_org, p_user);
     SELECT count(*) INTO admins FROM pta_members WHERE org_id = p_org AND role = 'admin' AND removed_at IS NULL;
     IF cur = 'admin' AND coalesce(p_role, '') <> 'admin' AND admins <= 1 THEN RETURN 'An organization keeps at least one administrator.'; END IF;
     IF p_role IS NULL THEN
       IF cur IS NULL THEN RETURN 'That person is not a member.'; END IF;
       UPDATE pta_members SET removed_by = p_actor, removed_at = now() WHERE org_id = p_org AND user_id = p_user;
     ELSIF p_role NOT IN ('admin','member') THEN RETURN 'Unknown role.';
     ELSE
       INSERT INTO pta_members (org_id, user_id, role, added_by) VALUES (p_org, p_user, p_role, p_actor)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, added_by = p_actor, added_at = now(), removed_by = NULL, removed_at = NULL;
     END IF;
     INSERT INTO pta_events (org_id, subject, step, actor_id, note) VALUES (p_org, 'member', coalesce(p_role, 'remove'), p_actor, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_apply(p_actor text, p_tenant text, p_org bigint, p_scopes text[], p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r pta_relationships; v_id bigint;
   BEGIN
     IF pta_role(p_org, p_actor) IS DISTINCT FROM 'admin' THEN RETURN 'Only an administrator of the organization applies for it.'; END IF;
     IF cardinality(p_scopes) = 0 OR NOT (p_scopes <@ ARRAY['publish_listings','view_orders','propose_articulation','manage_course_mappings','submit_research_requests','post_opportunities']::text[]) THEN
       RETURN 'Choose what you are asking to do from the published list.'; END IF;
     SELECT * INTO r FROM pta_relationships WHERE tenant_id = p_tenant AND org_id = p_org FOR UPDATE;
     IF FOUND THEN
       IF r.state NOT IN ('rejected','offboarded') THEN RETURN 'Your organization already has an application or agreement with this institution.'; END IF;
       UPDATE pta_relationships SET state = 'applied', requested_scopes = p_scopes, application_note = trim(coalesce(p_note, '')), verified_by = NULL, verification_note = '', proposed_by = NULL,
         agreement_text = '', scopes = '{}', valid_to = NULL, agreement_hash = NULL, accepted_hash = NULL, accepted_by = NULL, accepted_at = NULL, version = version + 1, updated_at = now() WHERE id = r.id;
       v_id := r.id;
     ELSE
       INSERT INTO pta_relationships (tenant_id, org_id, requested_scopes, application_note) VALUES (p_tenant, p_org, p_scopes, trim(coalesce(p_note, ''))) RETURNING id INTO v_id;
     END IF;
     INSERT INTO pta_events (tenant_id, org_id, subject, step, actor_id) VALUES (p_tenant, p_org, 'relationship', 'apply', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_manage(p_actor text, p_tenant text, p_rel bigint, p_step text, p_expected int, p_note text, p_text text, p_to date, p_scopes text[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r pta_relationships; n text := trim(coalesce(p_note, '')); v_to text;
   BEGIN
     IF NOT pta_is_manager(p_tenant, p_actor) THEN RETURN 'Only partner managers of this institution do this.'; END IF;
     SELECT * INTO r FROM pta_relationships WHERE id = p_rel AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Partner not found.'; END IF;
     IF pta_role(r.org_id, p_actor) IS NOT NULL THEN RETURN 'You belong to this organization, so another manager handles it.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This partner changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'verify' THEN
       IF r.state <> 'applied' THEN RETURN 'Only a new application is verified.'; END IF;
       IF length(n) < 10 THEN RETURN 'Record how the organization was verified (10+ characters).'; END IF;
       UPDATE pta_relationships SET state = 'verified', verified_by = p_actor, verification_note = n WHERE id = p_rel; v_to := 'verified';
     ELSIF p_step = 'reject' THEN
       IF r.state NOT IN ('applied','verified','agreement_pending') OR length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
       UPDATE pta_relationships SET state = 'rejected', status_note = n WHERE id = p_rel; v_to := 'rejected';
     ELSIF p_step = 'propose' THEN
       IF r.state NOT IN ('verified','agreement_pending','active','suspended') THEN RETURN 'Verify the organization first.'; END IF;
       IF r.verified_by = p_actor THEN RETURN 'A different manager from the one who verified prepares the agreement.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 40 THEN RETURN 'Write the agreement terms (40+ characters).'; END IF;
       IF p_to IS NULL OR p_to <= current_date THEN RETURN 'The agreement needs an end date in the future.'; END IF;
       IF cardinality(p_scopes) = 0 OR NOT (p_scopes <@ ARRAY['publish_listings','view_orders','propose_articulation','manage_course_mappings','submit_research_requests','post_opportunities']::text[]) THEN
         RETURN 'Choose the access granted from the published list.'; END IF;
       UPDATE pta_relationships SET state = 'agreement_pending', proposed_by = p_actor, agreement_text = trim(p_text), valid_to = p_to, scopes = p_scopes,
         agreement_hash = pta_hash(p_text, p_to, p_scopes), accepted_hash = NULL, accepted_by = NULL, accepted_at = NULL WHERE id = p_rel;
       v_to := 'agreement_pending';
     ELSIF p_step = 'suspend' THEN
       IF r.state <> 'active' OR length(n) < 5 THEN RETURN 'Only an active partner can be suspended, with a reason.'; END IF;
       UPDATE pta_relationships SET state = 'suspended', status_note = n WHERE id = p_rel; v_to := 'suspended';
     ELSIF p_step = 'reinstate' THEN
       IF r.state <> 'suspended' THEN RETURN 'Only a suspended partner can be reinstated.'; END IF;
       IF r.valid_to < current_date THEN RETURN 'The agreement has expired; propose a renewed agreement instead.'; END IF;
       UPDATE pta_relationships SET state = 'active', status_note = n WHERE id = p_rel; v_to := 'active';
     ELSIF p_step = 'offboard' THEN
       IF r.state IN ('offboarded','rejected') OR length(n) < 5 THEN RETURN 'Give a reason for offboarding.'; END IF;
       UPDATE pta_relationships SET state = 'offboarded', status_note = n WHERE id = p_rel; v_to := 'offboarded';
     ELSE RETURN 'Unknown step.'; END IF;
     UPDATE pta_relationships SET version = version + 1, updated_at = now() WHERE id = p_rel;
     INSERT INTO pta_events (tenant_id, org_id, subject, step, actor_id, note) VALUES (p_tenant, r.org_id, 'relationship', p_step, p_actor, left(n, 500));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pta_accept(p_actor text, p_rel bigint, p_expected int, p_hash text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r pta_relationships;
   BEGIN
     SELECT * INTO r FROM pta_relationships WHERE id = p_rel FOR UPDATE;
     IF NOT FOUND OR pta_role(r.org_id, p_actor) IS DISTINCT FROM 'admin' THEN RETURN 'Only an administrator of the organization accepts its agreement.'; END IF;
     IF r.version <> p_expected THEN RETURN 'The agreement changed since you opened it. Read it again.'; END IF;
     IF r.state <> 'agreement_pending' THEN RETURN 'There is no agreement waiting for acceptance.'; END IF;
     IF p_hash IS DISTINCT FROM r.agreement_hash THEN RETURN 'The agreement changed since you read it. Read it again.'; END IF;
     UPDATE pta_relationships SET state = 'active', accepted_hash = r.agreement_hash, accepted_by = p_actor, accepted_at = now(), version = version + 1, updated_at = now() WHERE id = p_rel;
     INSERT INTO pta_events (tenant_id, org_id, subject, step, actor_id) VALUES (r.tenant_id, r.org_id, 'relationship', 'accept', p_actor);
     RETURN NULL;
   END $$`,
  // Wiring (27 Oct): a transfer partner proposes articulation rules for its own courses only, while its relationship is live with
  // the propose_articulation scope. The rule enters Transfer as 'proposed' and a registrar decides it (trf_decide_rule; the
  // proposer is never the decider). Requires TRF_MIGRATION.
  `CREATE OR REPLACE FUNCTION pta_propose_articulation(p_user text, p_rel bigint, p_course text, p_outcome text, p_code text, p_credits numeric, p_term text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r pta_relationships; v_name text; v_err text; v_id bigint;
   BEGIN
     SELECT * INTO r FROM pta_relationships WHERE id = p_rel;
     IF r.id IS NULL OR pta_role(r.org_id, p_user) IS NULL THEN RETURN 'Relationship not found.'; END IF;
     IF NOT pta_live(r.tenant_id, r.org_id, 'propose_articulation') THEN RETURN 'This institution has not given your organization live access to propose articulations.'; END IF;
     SELECT name INTO v_name FROM pta_orgs WHERE id = r.org_id;
     v_err := trf_propose_rule(p_user, r.tenant_id, v_name, p_course, p_outcome, p_code, p_credits, p_term);
     IF v_err IS NOT NULL THEN RETURN v_err; END IF;
     SELECT max(id) INTO v_id FROM trf_rules WHERE tenant_id = r.tenant_id AND proposed_by = p_user AND state = 'proposed';
     UPDATE trf_rules SET partner_org_id = r.org_id WHERE id = v_id;
     INSERT INTO pta_events (tenant_id, org_id, subject, step, actor_id, note) VALUES (r.tenant_id, r.org_id, 'articulation', 'propose', p_user, trf_norm(p_course));
     RETURN 'ok:' || v_id;
   END $$`,
];
