// Migration org-001: student organizations (Organization Member / Officer / Admin role apps). Extends the existing Zite Groups
// (kind Club) and Events rather than adding a second club store: group_id and event_id are those Zite record ids, and Zite
// group membership stays the membership list (the endpoint passes p_member after reading it on the server).
// Enforced here: charters are submitted by a member and recognized by a student-life organization admin (granted by an
// administrator) who is not the submitter, pinned by SHA-256 and versioned; officer roles are delegated by the president or an
// org admin, never self; channels (some officers-only); RSVPs with capacity; dues recorded by a treasurer who is not the member
// (no payment here); budgets allocated by an org admin, expenses approved by a treasurer other than the requester and within
// the line; elections with a secret ballot (who voted is kept apart from what was voted), one vote per member, certified by an
// org admin, which sets the new president; handover records; suspension and archiving keep every record. Append-only history.
export const ORG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS org_admins (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS org_charters (group_id text PRIMARY KEY, tenant_id text NOT NULL, purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 10 AND 1000),
     constitution text NOT NULL CHECK (length(trim(constitution)) BETWEEN 50 AND 20000), sha256 text NOT NULL, rev int NOT NULL DEFAULT 1,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','recognized','returned','suspended','archived')),
     submitted_by text NOT NULL, recognized_by text, recognized_hash text, recognized_until date, state_note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1,
     CHECK (recognized_by IS NULL OR recognized_by <> submitted_by),
     CHECK (state <> 'recognized' OR (recognized_by IS NOT NULL AND recognized_hash = sha256 AND recognized_until IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS org_roles (group_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('president','treasurer','officer')),
     granted_by text NOT NULL, term_end date, granted_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, CHECK (granted_by <> user_id OR granted_by = 'election'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS org_one_president ON org_roles (group_id) WHERE role = 'president' AND ended_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS org_role_once ON org_roles (group_id, user_id, role) WHERE ended_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS org_channels (id bigserial PRIMARY KEY, group_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 60), officers_only boolean NOT NULL DEFAULT false,
     created_by text NOT NULL, archived_at timestamptz, UNIQUE (group_id, name))`,
  `CREATE TABLE IF NOT EXISTS org_posts (id bigserial PRIMARY KEY, channel_id bigint NOT NULL REFERENCES org_channels(id), author_id text NOT NULL, body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
     at timestamptz NOT NULL DEFAULT clock_timestamp(), removed_by text, removed_reason text)`,
  `CREATE TABLE IF NOT EXISTS org_event_caps (event_id text PRIMARY KEY, group_id text NOT NULL, capacity int CHECK (capacity IS NULL OR capacity > 0), members_only boolean NOT NULL DEFAULT false, set_by text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS org_rsvps (event_id text NOT NULL, user_id text NOT NULL, status text NOT NULL CHECK (status IN ('going','maybe','no')), at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (event_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS org_dues (id bigserial PRIMARY KEY, group_id text NOT NULL, member_id text NOT NULL, term text NOT NULL, amount int NOT NULL CHECK (amount >= 0),
     state text NOT NULL DEFAULT 'due' CHECK (state IN ('due','recorded_paid','waived')), recorded_by text, reference text NOT NULL DEFAULT '', UNIQUE (group_id, member_id, term),
     CHECK (recorded_by IS NULL OR recorded_by <> member_id), CHECK (state = 'due' OR recorded_by IS NOT NULL), CHECK (state <> 'recorded_paid' OR length(trim(reference)) > 0))`,
  `CREATE TABLE IF NOT EXISTS org_budget_lines (id bigserial PRIMARY KEY, group_id text NOT NULL, term text NOT NULL, category text NOT NULL, amount int NOT NULL CHECK (amount >= 0),
     allocated_by text NOT NULL, UNIQUE (group_id, term, category))`,
  `CREATE TABLE IF NOT EXISTS org_expenses (id bigserial PRIMARY KEY, line_id bigint NOT NULL REFERENCES org_budget_lines(id), amount int NOT NULL CHECK (amount > 0), description text NOT NULL CHECK (length(trim(description)) >= 5),
     requested_by text NOT NULL, state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','approved','rejected')), decided_by text, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT now(), CHECK (decided_by IS NULL OR decided_by <> requested_by))`,
  `CREATE TABLE IF NOT EXISTS org_elections (id bigserial PRIMARY KEY, group_id text NOT NULL, office text NOT NULL CHECK (office IN ('president','treasurer')), closes_at timestamptz NOT NULL,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed','certified','voided')), opened_by text NOT NULL, certified_by text, winner_id text, note text NOT NULL DEFAULT '',
     CHECK (state <> 'certified' OR (certified_by IS NOT NULL AND winner_id IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS org_candidates (election_id bigint NOT NULL REFERENCES org_elections(id), user_id text NOT NULL, statement text NOT NULL DEFAULT '', PRIMARY KEY (election_id, user_id))`,
  // Secret ballot: who voted and what was voted are separate tables with no link between them.
  `CREATE TABLE IF NOT EXISTS org_voted (election_id bigint NOT NULL REFERENCES org_elections(id), voter_id text NOT NULL, PRIMARY KEY (election_id, voter_id))`,
  `CREATE TABLE IF NOT EXISTS org_ballots (id bigserial PRIMARY KEY, election_id bigint NOT NULL REFERENCES org_elections(id), candidate_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS org_handovers (id bigserial PRIMARY KEY, group_id text NOT NULL, role text NOT NULL, from_id text, to_id text NOT NULL, notes text NOT NULL CHECK (length(trim(notes)) >= 10),
     recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS org_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_id text, step text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION org_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'org_events_append_only') THEN
       CREATE TRIGGER org_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON org_events FOR EACH STATEMENT EXECUTE FUNCTION org_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'org_ballots_append_only') THEN
       CREATE TRIGGER org_ballots_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON org_ballots FOR EACH STATEMENT EXECUTE FUNCTION org_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'org_voted_append_only') THEN
       CREATE TRIGGER org_voted_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON org_voted FOR EACH STATEMENT EXECUTE FUNCTION org_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'org_handovers_append_only') THEN
       CREATE TRIGGER org_handovers_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON org_handovers FOR EACH STATEMENT EXECUTE FUNCTION org_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_is_admin(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM org_admins WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION org_role_of(p_group text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM org_roles WHERE group_id = p_group AND user_id = p_user AND role = p_role AND ended_at IS NULL AND (term_end IS NULL OR term_end >= current_date)) $$`,
  `CREATE OR REPLACE FUNCTION org_is_officer(p_group text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT org_role_of(p_group, p_user, 'president') OR org_role_of(p_group, p_user, 'treasurer') OR org_role_of(p_group, p_user, 'officer') $$`,
  `CREATE OR REPLACE FUNCTION org_active(p_group text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM org_charters WHERE group_id = p_group AND state = 'recognized' AND recognized_until >= current_date) $$`,
  `CREATE OR REPLACE FUNCTION org_set_admin(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own organization-admin access.'; END IF;
     IF p_on THEN INSERT INTO org_admins (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE org_admins SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO org_events (tenant_id, step, actor_id, note) VALUES (p_tenant, CASE WHEN p_on THEN 'admin_grant' ELSE 'admin_revoke' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_submit_charter(p_actor text, p_tenant text, p_group text, p_purpose text, p_const text, p_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c org_charters; h text := encode(sha256(convert_to(trim(p_const), 'UTF8')), 'hex');
   BEGIN
     IF NOT p_member THEN RETURN 'Only members submit the charter.'; END IF;
     SELECT * INTO c FROM org_charters WHERE group_id = p_group FOR UPDATE;
     IF c.group_id IS NULL THEN
       INSERT INTO org_charters (group_id, tenant_id, purpose, constitution, sha256, submitted_by) VALUES (p_group, p_tenant, trim(p_purpose), trim(p_const), h, p_actor);
     ELSE
       IF c.tenant_id <> p_tenant THEN RETURN 'Organization not found.'; END IF;
       IF c.state = 'archived' THEN RETURN 'This organization is archived.'; END IF;
       IF c.state = 'recognized' AND NOT org_is_officer(p_group, p_actor) THEN RETURN 'Only officers amend a recognized charter.'; END IF;
       -- An amendment needs recognition again; until then the organization is not recognized.
       UPDATE org_charters SET purpose = trim(p_purpose), constitution = trim(p_const), sha256 = h, rev = rev + 1, state = 'submitted', submitted_by = p_actor,
         recognized_by = NULL, recognized_hash = NULL, version = version + 1 WHERE group_id = p_group;
     END IF;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'charter_submit', p_actor, h);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_charter_decide(p_actor text, p_tenant text, p_group text, p_step text, p_hash text, p_until date, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c org_charters;
   BEGIN
     IF NOT org_is_admin(p_tenant, p_actor) THEN RETURN 'Only an organization admin decides recognition.'; END IF;
     SELECT * INTO c FROM org_charters WHERE group_id = p_group AND tenant_id = p_tenant FOR UPDATE;
     IF c.group_id IS NULL THEN RETURN 'Charter not found.'; END IF;
     IF c.version <> p_version THEN RETURN 'This charter changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'recognize' THEN
       IF c.state <> 'submitted' THEN RETURN 'Only a submitted charter is recognized.'; END IF;
       IF p_actor = c.submitted_by THEN RETURN 'Someone other than the submitter recognizes the charter.'; END IF;
       IF c.sha256 <> p_hash THEN RETURN 'The charter you read is not the current version. Reload.'; END IF;
       IF p_until IS NULL OR p_until <= current_date THEN RETURN 'Recognition needs an end date in the future.'; END IF;
       UPDATE org_charters SET state = 'recognized', recognized_by = p_actor, recognized_hash = c.sha256, recognized_until = p_until, state_note = coalesce(p_note, ''), version = version + 1 WHERE group_id = p_group;
     ELSIF p_step IN ('return','suspend','archive','reinstate') THEN
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record the reason.'; END IF;
       IF p_step = 'return' AND c.state <> 'submitted' THEN RETURN 'Only a submitted charter is returned.'; END IF;
       IF p_step = 'suspend' AND c.state <> 'recognized' THEN RETURN 'Only a recognized organization is suspended.'; END IF;
       IF p_step = 'reinstate' AND c.state <> 'suspended' THEN RETURN 'Only a suspended organization is reinstated.'; END IF;
       IF p_step = 'archive' AND c.state = 'archived' THEN RETURN 'Already archived.'; END IF;
       UPDATE org_charters SET state = CASE p_step WHEN 'return' THEN 'returned' WHEN 'suspend' THEN 'suspended' WHEN 'archive' THEN 'archived' ELSE 'recognized' END,
         state_note = trim(p_note), version = version + 1 WHERE group_id = p_group;
       IF p_step = 'archive' THEN UPDATE org_roles SET ended_at = now() WHERE group_id = p_group AND ended_at IS NULL; UPDATE org_channels SET archived_at = now() WHERE group_id = p_group AND archived_at IS NULL; END IF;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'charter_' || p_step, p_actor, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_set_role(p_actor text, p_tenant text, p_group text, p_user text, p_role text, p_on boolean, p_term_end date, p_user_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM org_charters WHERE group_id = p_group AND tenant_id = p_tenant AND state <> 'archived') THEN RETURN 'Submit a charter first.'; END IF;
     IF p_actor = p_user THEN RETURN 'Someone else changes your own officer role.'; END IF;
     IF p_role = 'president' THEN
       IF NOT org_is_admin(p_tenant, p_actor) THEN RETURN 'The president is set by a certified election or an organization admin.'; END IF;
     ELSIF NOT (org_role_of(p_group, p_actor, 'president') OR org_is_admin(p_tenant, p_actor)) THEN RETURN 'Only the president or an organization admin delegates officer roles.'; END IF;
     IF p_on THEN
       IF NOT p_user_member THEN RETURN 'Officers are members of the organization.'; END IF;
       IF p_role = 'president' THEN UPDATE org_roles SET ended_at = now() WHERE group_id = p_group AND role = 'president' AND ended_at IS NULL; END IF;
       INSERT INTO org_roles (group_id, user_id, role, granted_by, term_end) VALUES (p_group, p_user, p_role, p_actor, p_term_end) ON CONFLICT DO NOTHING;
     ELSE UPDATE org_roles SET ended_at = now() WHERE group_id = p_group AND user_id = p_user AND role = p_role AND ended_at IS NULL; END IF;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, CASE WHEN p_on THEN 'role_grant' ELSE 'role_end' END, p_actor, p_user || ' ' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_channel(p_actor text, p_tenant text, p_group text, p_name text, p_officers boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT org_is_officer(p_group, p_actor) THEN RETURN 'Officers create channels.'; END IF;
     IF NOT org_active(p_group) THEN RETURN 'The organization is not currently recognized.'; END IF;
     INSERT INTO org_channels (group_id, name, officers_only, created_by) VALUES (p_group, trim(p_name), p_officers, p_actor);
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'channel', p_actor, trim(p_name));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_post(p_actor text, p_channel bigint, p_body text, p_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE ch org_channels;
   BEGIN
     SELECT * INTO ch FROM org_channels WHERE id = p_channel;
     IF ch.id IS NULL OR ch.archived_at IS NOT NULL THEN RETURN 'Channel not found.'; END IF;
     IF NOT p_member THEN RETURN 'Join the organization to post.'; END IF;
     IF ch.officers_only AND NOT org_is_officer(ch.group_id, p_actor) THEN RETURN 'This channel is for officers.'; END IF;
     IF NOT org_active(ch.group_id) THEN RETURN 'The organization is not currently recognized.'; END IF;
     INSERT INTO org_posts (channel_id, author_id, body) VALUES (p_channel, p_actor, trim(p_body));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_rsvp(p_user text, p_event text, p_group text, p_status text, p_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cap org_event_caps; n int;
   BEGIN
     SELECT * INTO cap FROM org_event_caps WHERE event_id = p_event FOR UPDATE;
     IF cap.members_only AND NOT p_member THEN RETURN 'This event is for members.'; END IF;
     IF p_status = 'going' AND cap.capacity IS NOT NULL THEN
       SELECT count(*) INTO n FROM org_rsvps WHERE event_id = p_event AND status = 'going' AND user_id <> p_user;
       IF n >= cap.capacity THEN RETURN 'This event is full.'; END IF;
     END IF;
     INSERT INTO org_rsvps (event_id, user_id, status) VALUES (p_event, p_user, p_status) ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, at = now();
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_event_rules(p_actor text, p_tenant text, p_group text, p_event text, p_cap int, p_members_only boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT org_is_officer(p_group, p_actor) THEN RETURN 'Officers set event rules.'; END IF;
     IF p_cap IS NOT NULL AND (SELECT count(*) FROM org_rsvps WHERE event_id = p_event AND status = 'going') > p_cap THEN RETURN 'More people are already going than that capacity.'; END IF;
     INSERT INTO org_event_caps (event_id, group_id, capacity, members_only, set_by) VALUES (p_event, p_group, p_cap, p_members_only, p_actor)
       ON CONFLICT (event_id) DO UPDATE SET capacity = EXCLUDED.capacity, members_only = EXCLUDED.members_only, set_by = p_actor;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'event_rules', p_actor, p_event);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_dues(p_actor text, p_tenant text, p_group text, p_member text, p_term text, p_amount int, p_state text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d org_dues;
   BEGIN
     IF NOT org_role_of(p_group, p_actor, 'treasurer') THEN RETURN 'Only the treasurer records dues.'; END IF;
     IF p_actor = p_member THEN RETURN 'Someone other than the treasurer records the treasurer''s own dues.'; END IF;
     SELECT * INTO d FROM org_dues WHERE group_id = p_group AND member_id = p_member AND term = trim(p_term) FOR UPDATE;
     IF d.id IS NULL THEN INSERT INTO org_dues (group_id, member_id, term, amount) VALUES (p_group, p_member, trim(p_term), p_amount) RETURNING * INTO d; END IF;
     IF p_state = 'due' THEN RETURN NULL; END IF;
     IF d.state <> 'due' THEN RETURN 'Dues for this term are already settled.'; END IF;
     IF p_state = 'recorded_paid' AND length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Record the receipt reference (payment happens outside Semester).'; END IF;
     UPDATE org_dues SET state = p_state, recorded_by = p_actor, reference = coalesce(trim(p_ref), '') WHERE id = d.id;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'dues_' || p_state, p_actor, p_member || ' ' || p_term);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_budget(p_actor text, p_tenant text, p_group text, p_term text, p_category text, p_amount int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l org_budget_lines;
   BEGIN
     IF NOT org_is_admin(p_tenant, p_actor) THEN RETURN 'Only an organization admin allocates budgets.'; END IF;
     SELECT * INTO l FROM org_budget_lines WHERE group_id = p_group AND term = trim(p_term) AND category = trim(p_category) FOR UPDATE;
     IF l.id IS NOT NULL AND p_amount < (SELECT coalesce(sum(amount), 0) FROM org_expenses WHERE line_id = l.id AND state = 'approved') THEN RETURN 'That is below what is already approved.'; END IF;
     INSERT INTO org_budget_lines (group_id, term, category, amount, allocated_by) VALUES (p_group, trim(p_term), trim(p_category), p_amount, p_actor)
       ON CONFLICT (group_id, term, category) DO UPDATE SET amount = EXCLUDED.amount, allocated_by = p_actor;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'budget', p_actor, trim(p_category) || ' ' || p_amount);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_expense(p_actor text, p_tenant text, p_line bigint, p_amount int, p_desc text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l org_budget_lines; v_id bigint;
   BEGIN
     SELECT * INTO l FROM org_budget_lines WHERE id = p_line;
     IF l.id IS NULL OR NOT org_is_officer(l.group_id, p_actor) THEN RETURN 'Officers request spending from their organization''s budget.'; END IF;
     IF NOT org_active(l.group_id) THEN RETURN 'The organization is not currently recognized.'; END IF;
     INSERT INTO org_expenses (line_id, amount, description, requested_by) VALUES (p_line, p_amount, trim(p_desc), p_actor) RETURNING id INTO v_id;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, l.group_id, 'expense_request', p_actor, p_amount::text);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_expense_decide(p_actor text, p_tenant text, p_expense bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x org_expenses; l org_budget_lines;
   BEGIN
     SELECT * INTO x FROM org_expenses WHERE id = p_expense FOR UPDATE;
     SELECT * INTO l FROM org_budget_lines WHERE id = x.line_id FOR UPDATE;
     IF x.id IS NULL THEN RETURN 'Expense not found.'; END IF;
     IF NOT org_role_of(l.group_id, p_actor, 'treasurer') THEN RETURN 'Only the treasurer decides spending.'; END IF;
     IF p_actor = x.requested_by THEN RETURN 'Someone other than the requester approves spending.'; END IF;
     IF x.state <> 'requested' THEN RETURN 'Already decided.'; END IF;
     IF p_approve AND (SELECT coalesce(sum(amount), 0) FROM org_expenses WHERE line_id = l.id AND state = 'approved') + x.amount > l.amount THEN RETURN 'This would overspend the ' || l.category || ' line.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
     UPDATE org_expenses SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, note = coalesce(trim(p_note), '') WHERE id = p_expense;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, l.group_id, CASE WHEN p_approve THEN 'expense_approve' ELSE 'expense_reject' END, p_actor, x.amount::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_election_open(p_actor text, p_tenant text, p_group text, p_office text, p_closes timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT (org_is_admin(p_tenant, p_actor) OR org_role_of(p_group, p_actor, 'president')) THEN RETURN 'An organization admin or the president opens an election.'; END IF;
     IF NOT org_active(p_group) THEN RETURN 'The organization is not currently recognized.'; END IF;
     IF p_closes <= now() THEN RETURN 'The election closes in the future.'; END IF;
     IF EXISTS (SELECT 1 FROM org_elections WHERE group_id = p_group AND office = p_office AND state IN ('open','closed')) THEN RETURN 'An election for that office is already running.'; END IF;
     INSERT INTO org_elections (group_id, office, closes_at, opened_by) VALUES (p_group, p_office, p_closes, p_actor) RETURNING id INTO v_id;
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'election_open', p_actor, p_office);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_candidate(p_user text, p_election bigint, p_statement text, p_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e org_elections;
   BEGIN
     SELECT * INTO e FROM org_elections WHERE id = p_election;
     IF e.id IS NULL OR e.state <> 'open' OR e.closes_at <= now() THEN RETURN 'Nominations are closed.'; END IF;
     IF NOT p_member THEN RETURN 'Candidates are members.'; END IF;
     IF EXISTS (SELECT 1 FROM org_voted WHERE election_id = p_election) THEN RETURN 'Voting has started; nominations are closed.'; END IF;
     INSERT INTO org_candidates (election_id, user_id, statement) VALUES (p_election, p_user, coalesce(p_statement, '')) ON CONFLICT (election_id, user_id) DO UPDATE SET statement = EXCLUDED.statement;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_vote(p_user text, p_election bigint, p_candidate text, p_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e org_elections;
   BEGIN
     SELECT * INTO e FROM org_elections WHERE id = p_election FOR UPDATE;
     IF e.id IS NULL OR e.state <> 'open' OR e.closes_at <= now() THEN RETURN 'Voting is closed.'; END IF;
     IF NOT p_member THEN RETURN 'Only members vote.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM org_candidates WHERE election_id = p_election AND user_id = p_candidate) THEN RETURN 'Not a candidate.'; END IF;
     IF EXISTS (SELECT 1 FROM org_voted WHERE election_id = p_election AND voter_id = p_user) THEN RETURN 'You have already voted.'; END IF;
     INSERT INTO org_voted (election_id, voter_id) VALUES (p_election, p_user);
     INSERT INTO org_ballots (election_id, candidate_id) VALUES (p_election, p_candidate);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_certify(p_actor text, p_tenant text, p_election bigint, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e org_elections; v_win text; v_top int; v_ties int;
   BEGIN
     IF NOT org_is_admin(p_tenant, p_actor) THEN RETURN 'Only an organization admin certifies results.'; END IF;
     SELECT * INTO e FROM org_elections WHERE id = p_election FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Election not found.'; END IF;
     IF e.state NOT IN ('open','closed') THEN RETURN 'Already finished.'; END IF;
     IF e.closes_at > now() THEN RETURN 'Voting is still open.'; END IF;
     IF EXISTS (SELECT 1 FROM org_candidates WHERE election_id = p_election AND user_id = p_actor) THEN RETURN 'A candidate cannot certify their own election.'; END IF;
     SELECT max(n) INTO v_top FROM (SELECT count(*) n FROM org_ballots WHERE election_id = p_election GROUP BY candidate_id) t;
     IF v_top IS NULL THEN RETURN 'No votes were cast.'; END IF;
     SELECT count(*) INTO v_ties FROM (SELECT candidate_id FROM org_ballots WHERE election_id = p_election GROUP BY candidate_id HAVING count(*) = v_top) t;
     IF v_ties > 1 THEN RETURN 'The result is tied; run a new election.'; END IF;
     SELECT candidate_id INTO v_win FROM org_ballots WHERE election_id = p_election GROUP BY candidate_id HAVING count(*) = v_top;
     UPDATE org_elections SET state = 'certified', certified_by = p_actor, winner_id = v_win, note = coalesce(p_note, '') WHERE id = p_election;
     UPDATE org_roles SET ended_at = now() WHERE group_id = e.group_id AND role = e.office AND ended_at IS NULL;
     INSERT INTO org_roles (group_id, user_id, role, granted_by) VALUES (e.group_id, v_win, e.office, 'election');
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, e.group_id, 'election_certify', p_actor, e.office);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION org_handover(p_actor text, p_tenant text, p_group text, p_role text, p_to text, p_notes text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT (EXISTS (SELECT 1 FROM org_roles WHERE group_id = p_group AND user_id = p_actor AND role = p_role AND (ended_at IS NULL OR ended_at > now() - interval '60 days')) OR org_is_admin(p_tenant, p_actor)) THEN RETURN 'The outgoing officer or an organization admin records the handover.'; END IF;
     IF NOT org_role_of(p_group, p_to, p_role) THEN RETURN 'Hand over to the person who now holds the role.'; END IF;
     IF length(trim(coalesce(p_notes, ''))) < 10 THEN RETURN 'Write the handover notes: open tasks, accounts, contacts, dates.'; END IF;
     INSERT INTO org_handovers (group_id, role, from_id, to_id, notes, recorded_by) VALUES (p_group, p_role, CASE WHEN EXISTS (SELECT 1 FROM org_roles WHERE group_id = p_group AND user_id = p_actor AND role = p_role) THEN p_actor END, p_to, trim(p_notes), p_actor);
     INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES (p_tenant, p_group, 'handover', p_actor, p_role);
     RETURN NULL;
   END $$`,
];
