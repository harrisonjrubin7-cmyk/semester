// Migration cmy-001: community setup and health (role app "Community Manager": setup, health). Extends the Zite Groups of kind
// Community (group_id is the Zite record id; Zite membership stays the member list, updated by the endpoint after these checks).
// - Community managers are appointed per institution by an administrator, never themselves; revocation applies on the next call.
// - A manager sets up a community with a description, guidelines (moderators cite them) and a join policy (open or request).
//   Archived communities take no new members and no posts; nothing is deleted.
// - Request-to-join: the person asks, a manager who is not that person approves or declines with a note. One pending request each.
// - cmy_can_join decides joins for the campus endpoint: course discussion groups and groups outside the institution are refused
//   there (fixed 29 Oct: campus toggleGroup had let anyone join any group, including course discussions).
// - History is append-only.
export const CMY_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cmy_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS cmy_communities (group_id text PRIMARY KEY, tenant_id text NOT NULL, description text NOT NULL DEFAULT '' CHECK (length(description) <= 600),
     guidelines text NOT NULL CHECK (length(trim(guidelines)) BETWEEN 40 AND 4000), join_policy text NOT NULL CHECK (join_policy IN ('open', 'request')),
     state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')), created_by text NOT NULL, version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS cmy_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_id text NOT NULL REFERENCES cmy_communities(group_id), user_id text NOT NULL,
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 500), state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'declined', 'withdrawn')),
     decided_by text, decision_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, CHECK (decided_by IS NULL OR decided_by <> user_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cmy_one_pending ON cmy_requests (group_id, user_id) WHERE state = 'pending'`,
  `CREATE TABLE IF NOT EXISTS cmy_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_id text, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cmy_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cmy_events_append_only') THEN
       CREATE TRIGGER cmy_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cmy_events FOR EACH STATEMENT EXECUTE FUNCTION cmy_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION cmy_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM cmy_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION cmy_set_staff(p_admin text, p_is_admin boolean, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only administrators appoint community managers.'; END IF;
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_on THEN INSERT INTO cmy_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE cmy_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO cmy_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'manager_added' ELSE 'manager_removed' END, p_user);
     RETURN NULL;
   END $$`,
  // Setup. p_group_tenant and p_group_kind are read by the endpoint from the Zite group record, never taken from the request.
  `CREATE OR REPLACE FUNCTION cmy_setup(p_tenant text, p_actor text, p_step text, p_group text, p_group_tenant text, p_group_kind text, p_expected int, p_desc text, p_guidelines text, p_policy text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cmy_communities;
   BEGIN
     IF NOT cmy_is_staff(p_tenant, p_actor) THEN RETURN 'Only community managers set up communities.'; END IF;
     IF p_group_tenant IS DISTINCT FROM p_tenant OR p_group_kind IS DISTINCT FROM 'Community' THEN RETURN 'Community not found.'; END IF;
     IF p_step = 'create' THEN
       IF EXISTS (SELECT 1 FROM cmy_communities WHERE group_id = p_group) THEN RETURN 'This community is already set up.'; END IF;
       IF length(trim(coalesce(p_guidelines, ''))) < 40 THEN RETURN 'Write the community guidelines (40+ characters). Moderators cite them.'; END IF;
       IF coalesce(p_policy, '') NOT IN ('open', 'request') THEN RETURN 'Choose open or request to join.'; END IF;
       INSERT INTO cmy_communities (group_id, tenant_id, description, guidelines, join_policy, created_by) VALUES (p_group, p_tenant, coalesce(p_desc, ''), trim(p_guidelines), p_policy, p_actor);
       INSERT INTO cmy_events (tenant_id, group_id, actor_id, action, detail) VALUES (p_tenant, p_group, p_actor, 'create', p_policy);
       RETURN NULL;
     END IF;
     SELECT * INTO c FROM cmy_communities WHERE group_id = p_group FOR UPDATE;
     IF NOT FOUND OR c.tenant_id <> p_tenant THEN RETURN 'Community not found.'; END IF;
     IF p_expected IS DISTINCT FROM c.version THEN RETURN 'This community changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF length(trim(coalesce(p_guidelines, c.guidelines))) < 40 THEN RETURN 'Write the community guidelines (40+ characters). Moderators cite them.'; END IF;
       IF coalesce(p_policy, c.join_policy) NOT IN ('open', 'request') THEN RETURN 'Choose open or request to join.'; END IF;
       UPDATE cmy_communities SET description = coalesce(p_desc, description), guidelines = trim(coalesce(p_guidelines, guidelines)), join_policy = coalesce(p_policy, join_policy) WHERE group_id = c.group_id;
     ELSIF p_step = 'archive' THEN
       IF c.state = 'archived' THEN RETURN 'Already archived.'; END IF;
       UPDATE cmy_communities SET state = 'archived' WHERE group_id = c.group_id;
       UPDATE cmy_requests SET state = 'declined', decided_by = p_actor, decision_note = 'The community was archived.', decided_at = now() WHERE group_id = c.group_id AND state = 'pending' AND user_id <> p_actor;
     ELSIF p_step = 'reopen' THEN
       IF c.state = 'active' THEN RETURN 'Already active.'; END IF;
       UPDATE cmy_communities SET state = 'active' WHERE group_id = c.group_id;
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE cmy_communities SET version = version + 1, updated_at = now() WHERE group_id = c.group_id;
     INSERT INTO cmy_events (tenant_id, group_id, actor_id, action) VALUES (p_tenant, c.group_id, p_actor, p_step);
     RETURN NULL;
   END $$`,
  // Joining. Returns 'join' (endpoint adds the member), 'requested', or a refusal. Group facts come from the Zite record on the server.
  `CREATE OR REPLACE FUNCTION cmy_can_join(p_tenant text, p_user text, p_group text, p_group_tenant text, p_group_kind text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cmy_communities;
   BEGIN
     IF p_group_tenant IS NULL OR p_group_tenant <> p_tenant THEN RETURN 'That group is not at your institution.'; END IF;
     IF p_group_kind = 'Course Discussion' THEN RETURN 'Course discussions follow class enrollment. Join through your course.'; END IF;
     IF p_group_kind <> 'Community' THEN RETURN 'join'; END IF;
     SELECT * INTO c FROM cmy_communities WHERE group_id = p_group;
     IF NOT FOUND THEN RETURN 'join'; END IF;
     IF c.state = 'archived' THEN RETURN 'This community is archived and not taking new members.'; END IF;
     IF c.join_policy = 'open' THEN RETURN 'join'; END IF;
     IF EXISTS (SELECT 1 FROM cmy_requests WHERE group_id = p_group AND user_id = p_user AND state = 'pending') THEN RETURN 'You already asked to join.'; END IF;
     INSERT INTO cmy_requests (tenant_id, group_id, user_id, note) VALUES (p_tenant, p_group, p_user, left(coalesce(p_note, ''), 500));
     INSERT INTO cmy_events (tenant_id, group_id, actor_id, action) VALUES (p_tenant, p_group, p_user, 'join_requested');
     RETURN 'requested';
   END $$`,
  // Decide a join request. Returns the user id to add when approved, '' when declined, or 'error:<reason>'.
  `CREATE OR REPLACE FUNCTION cmy_decide(p_tenant text, p_actor text, p_id bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r cmy_requests; c cmy_communities;
   BEGIN
     IF NOT cmy_is_staff(p_tenant, p_actor) THEN RETURN 'error:Only community managers decide join requests.'; END IF;
     SELECT * INTO r FROM cmy_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'error:Request not found.'; END IF;
     IF r.user_id = p_actor THEN RETURN 'error:Another manager decides your own request.'; END IF;
     IF r.state <> 'pending' THEN RETURN 'error:This request was already decided.'; END IF;
     SELECT * INTO c FROM cmy_communities WHERE group_id = r.group_id;
     IF p_approve AND c.state <> 'active' THEN RETURN 'error:This community is archived.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'error:Say why (10+ characters). The person sees this.'; END IF;
     UPDATE cmy_requests SET state = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END, decided_by = p_actor, decision_note = trim(coalesce(p_note, '')), decided_at = now() WHERE id = r.id;
     INSERT INTO cmy_events (tenant_id, group_id, actor_id, action, detail) VALUES (p_tenant, r.group_id, p_actor, CASE WHEN p_approve THEN 'join_approved' ELSE 'join_declined' END, r.user_id);
     RETURN CASE WHEN p_approve THEN r.user_id ELSE '' END;
   END $$`,
];
