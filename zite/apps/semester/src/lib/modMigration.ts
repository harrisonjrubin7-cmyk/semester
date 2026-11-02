// Migration mod-001: community moderation and appeals (APP-007). Gate (drill-down spec): "organization officers cannot access
// unrelated memberships; disciplinary authority is not implied by moderation permissions; appeals remain independently reviewable".
// - Moderators are appointed per institution by an administrator, never themselves.
// - A moderator never decides on their own post or a report they filed. Decisions hide or remove from view; nothing is deleted.
// - The author may appeal within 14 days; a DIFFERENT moderator reviews the appeal. Overturning restores the post.
// - Moderation has no effect on accounts, memberships or discipline. Tenant always comes from the caller's membership.
export const MOD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS mod_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS mod_reports (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, message_id text NOT NULL, author_id text NOT NULL, reporter_id text NOT NULL,
     reason text NOT NULL CHECK (length(reason) >= 3), excerpt text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'decided', 'appealed', 'appeal_decided')),
     decision text CHECK (decision IN ('no_action', 'hide', 'remove')), policy text, decided_by text, decided_at timestamptz,
     appeal_text text, appealed_at timestamptz, appeal_outcome text CHECK (appeal_outcome IN ('upheld', 'overturned')), appeal_by text, appeal_at timestamptz, appeal_note text,
     created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (decided_by IS NULL OR (decided_by <> author_id AND decided_by <> reporter_id)),
     CHECK (appeal_by IS NULL OR (appeal_by <> decided_by AND appeal_by <> author_id)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS mod_reports_one_open ON mod_reports (message_id, reporter_id) WHERE state = 'open'`,
  `CREATE TABLE IF NOT EXISTS mod_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, report_id text, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION mod_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS mod_events_append_only ON mod_events`,
  `CREATE TRIGGER mod_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mod_events FOR EACH STATEMENT EXECUTE FUNCTION mod_refuse_change()`,
  `CREATE OR REPLACE FUNCTION mod_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM mod_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION mod_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'You cannot change your own moderator access.'; END IF;
     IF p_on THEN INSERT INTO mod_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE mod_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO mod_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'moderator_added' ELSE 'moderator_removed' END, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION mod_report(p_reporter text, p_tenant text, p_id text, p_message text, p_author text, p_reason text, p_excerpt text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM mod_reports WHERE id = p_id) THEN RETURN NULL; END IF;
     IF p_reporter = p_author THEN RETURN 'You can delete your own post instead of reporting it.'; END IF;
     IF EXISTS (SELECT 1 FROM mod_reports WHERE message_id = p_message AND reporter_id = p_reporter AND state = 'open') THEN RETURN 'You already reported this post.'; END IF;
     INSERT INTO mod_reports (id, tenant_id, message_id, author_id, reporter_id, reason, excerpt) VALUES (p_id, p_tenant, p_message, p_author, p_reporter, trim(p_reason), left(coalesce(p_excerpt, ''), 300));
     INSERT INTO mod_events (tenant_id, report_id, actor_id, action) VALUES (p_tenant, p_id, p_reporter, 'reported');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION mod_decide(p_actor text, p_tenant text, p_id text, p_decision text, p_policy text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r mod_reports%ROWTYPE;
   BEGIN
     IF NOT mod_is_staff(p_tenant, p_actor) THEN RETURN 'Only moderators decide reports.'; END IF;
     SELECT * INTO r FROM mod_reports WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Report not found.'; END IF;
     IF r.state <> 'open' THEN RETURN 'This report was already decided.'; END IF;
     IF p_actor IN (r.author_id, r.reporter_id) THEN RETURN 'You are involved in this report, so another moderator must decide it.'; END IF;
     IF p_decision NOT IN ('no_action', 'hide', 'remove') THEN RETURN 'Unknown decision.'; END IF;
     IF p_decision <> 'no_action' AND length(trim(coalesce(p_policy, ''))) < 10 THEN RETURN 'Cite the community guideline and why it applies (10+ characters).'; END IF;
     UPDATE mod_reports SET state = 'decided', decision = p_decision, policy = p_policy, decided_by = p_actor, decided_at = now() WHERE id = r.id;
     -- Other open reports on the same post are resolved by the same decision.
     UPDATE mod_reports SET state = 'decided', decision = p_decision, policy = p_policy, decided_by = p_actor, decided_at = now()
       WHERE message_id = r.message_id AND state = 'open' AND id <> r.id AND reporter_id <> p_actor AND author_id <> p_actor;
     INSERT INTO mod_events (tenant_id, report_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, p_decision, coalesce(p_policy, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION mod_appeal(p_author text, p_tenant text, p_id text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r mod_reports%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM mod_reports WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.author_id <> p_author THEN RETURN 'Decision not found.'; END IF;
     IF r.state <> 'decided' OR r.decision = 'no_action' THEN RETURN 'There is nothing to appeal.'; END IF;
     IF r.decided_at < now() - interval '14 days' THEN RETURN 'The 14-day appeal window has closed.'; END IF;
     IF length(trim(coalesce(p_text, ''))) < 20 THEN RETURN 'Explain why the decision should change (20+ characters).'; END IF;
     UPDATE mod_reports SET state = 'appealed', appeal_text = trim(p_text), appealed_at = now() WHERE id = r.id;
     INSERT INTO mod_events (tenant_id, report_id, actor_id, action) VALUES (p_tenant, r.id, p_author, 'appealed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION mod_review_appeal(p_actor text, p_tenant text, p_id text, p_outcome text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r mod_reports%ROWTYPE;
   BEGIN
     IF NOT mod_is_staff(p_tenant, p_actor) THEN RETURN 'Only moderators review appeals.'; END IF;
     SELECT * INTO r FROM mod_reports WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Appeal not found.'; END IF;
     IF r.state <> 'appealed' THEN RETURN 'This report has no pending appeal.'; END IF;
     IF p_actor IN (r.decided_by, r.author_id, r.reporter_id) THEN RETURN 'Appeals are reviewed by a moderator who was not involved.'; END IF;
     IF p_outcome NOT IN ('upheld', 'overturned') THEN RETURN 'Unknown outcome.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Explain the outcome to the author (10+ characters).'; END IF;
     UPDATE mod_reports SET state = 'appeal_decided', appeal_outcome = p_outcome, appeal_by = p_actor, appeal_at = now(), appeal_note = p_note WHERE id = r.id;
     INSERT INTO mod_events (tenant_id, report_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, 'appeal_' || p_outcome, p_note);
     RETURN NULL;
   END $$`,
  // Posts currently hidden or removed for an institution: a decision of hide/remove that was not overturned on appeal.
  `CREATE OR REPLACE FUNCTION mod_hidden(p_tenant text) RETURNS TABLE (message_id text) LANGUAGE sql STABLE AS $$
     SELECT DISTINCT message_id FROM mod_reports WHERE tenant_id = p_tenant AND decision IN ('hide', 'remove') AND coalesce(appeal_outcome, '') <> 'overturned' $$`,
];
