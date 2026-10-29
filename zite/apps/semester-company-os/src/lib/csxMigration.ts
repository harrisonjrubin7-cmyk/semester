// Migration csx-001: Customer Success (role app "Customer Success": adoption, success plans, QBRs).
// - An account is linked to the institution (tenant) it bought for: a customer_success member proposes the link and a
//   platform_admin other than the proposer confirms it. Until confirmed, no adoption figures are shown for the account.
// - Adoption is aggregate only (membership counts by role and status, module entitlements, metered calls). The endpoint
//   suppresses any count below 5; no person, student record or message is ever read.
// - Success plans: goals with a measure, a target and a due date. Marking a goal achieved or missed needs a 10+ character
//   evidence note; edits use expected versions.
// - QBRs: a review is planned, then "prepared" freezes a snapshot of adoption and goals (hash) so the meeting discusses fixed
//   figures; "held" needs notes; follow-up actions have an owner and a due date. Nothing is sent to the customer from here.
// Requires co_has() from lib/coRoles.ts. History is append-only.
export const CSX_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS csx_links (account_id text PRIMARY KEY, tenant_id text NOT NULL, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'confirmed')),
     proposed_by text NOT NULL, confirmed_by text, confirmed_at timestamptz, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (confirmed_by IS NULL OR confirmed_by <> proposed_by), CHECK (state <> 'confirmed' OR confirmed_by IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS csx_links_tenant ON csx_links (tenant_id) WHERE state = 'confirmed'`,
  `CREATE TABLE IF NOT EXISTS csx_goals (id bigserial PRIMARY KEY, account_id text NOT NULL, goal text NOT NULL CHECK (length(trim(goal)) BETWEEN 5 AND 200),
     measure text NOT NULL CHECK (length(trim(measure)) BETWEEN 3 AND 200), target text NOT NULL CHECK (length(trim(target)) BETWEEN 1 AND 80), due_on date NOT NULL,
     owner_id text NOT NULL, state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'achieved', 'missed', 'dropped')), evidence text NOT NULL DEFAULT '',
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (state NOT IN ('achieved', 'missed') OR length(trim(evidence)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS csx_qbrs (id bigserial PRIMARY KEY, account_id text NOT NULL, scheduled_for date NOT NULL, owner_id text NOT NULL,
     state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned', 'prepared', 'held', 'cancelled')), snapshot jsonb, snapshot_hash text, attendees text NOT NULL DEFAULT '',
     notes text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (state = 'planned' OR state = 'cancelled' OR (snapshot IS NOT NULL AND snapshot_hash = md5(snapshot::text))),
     CHECK (state <> 'held' OR length(trim(notes)) >= 20))`,
  `CREATE TABLE IF NOT EXISTS csx_actions (id bigserial PRIMARY KEY, qbr_id bigint NOT NULL REFERENCES csx_qbrs(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     owner text NOT NULL CHECK (length(trim(owner)) BETWEEN 2 AND 120), due_on date NOT NULL, done_at timestamptz, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS csx_events (id bigserial PRIMARY KEY, account_id text NOT NULL, actor_id text NOT NULL, subject text NOT NULL, ref text NOT NULL, step text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION csx_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS csx_events_append_only ON csx_events`,
  `CREATE TRIGGER csx_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON csx_events FOR EACH STATEMENT EXECUTE FUNCTION csx_refuse_change()`,
  `CREATE OR REPLACE FUNCTION csx_snapshot_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF OLD.state IN ('prepared', 'held') AND (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash) THEN
       RAISE EXCEPTION 'SNAPSHOT_FIXED' USING ERRCODE = 'check_violation'; END IF;
     IF OLD.state IN ('held', 'cancelled') AND NEW.state IS DISTINCT FROM OLD.state THEN RAISE EXCEPTION 'QBR_CLOSED' USING ERRCODE = 'check_violation'; END IF;
     RETURN NEW; END $$`,
  `DROP TRIGGER IF EXISTS csx_qbrs_snapshot_fixed ON csx_qbrs`,
  `CREATE TRIGGER csx_qbrs_snapshot_fixed BEFORE UPDATE ON csx_qbrs FOR EACH ROW EXECUTE FUNCTION csx_snapshot_fixed()`,
  `CREATE OR REPLACE FUNCTION csx_log(p_account text, p_actor text, p_subject text, p_ref text, p_step text, p_note text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO csx_events (account_id, actor_id, subject, ref, step, note) VALUES (p_account, p_actor, p_subject, p_ref, p_step, coalesce(p_note, '')) $$`,
  `CREATE OR REPLACE FUNCTION csx_tenant(p_account text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT tenant_id FROM csx_links WHERE account_id = p_account AND state = 'confirmed' $$`,
  `CREATE OR REPLACE FUNCTION csx_link(p_actor text, p_step text, p_account text, p_tenant text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l csx_links%ROWTYPE; BEGIN
     SELECT * INTO l FROM csx_links WHERE account_id = p_account FOR UPDATE;
     IF p_step = 'propose' THEN
       IF NOT co_has(p_actor, 'customer_success') THEN RETURN 'Linking accounts needs the customer success role.'; END IF;
       IF FOUND AND l.state = 'confirmed' THEN RETURN 'This account is already linked. Unlink it first.'; END IF;
       IF EXISTS (SELECT 1 FROM csx_links WHERE tenant_id = p_tenant AND state = 'confirmed' AND account_id <> p_account) THEN RETURN 'That institution is already linked to another account.'; END IF;
       INSERT INTO csx_links (account_id, tenant_id, proposed_by, note) VALUES (p_account, p_tenant, p_actor, trim(coalesce(p_note, '')))
         ON CONFLICT (account_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, proposed_by = EXCLUDED.proposed_by, note = EXCLUDED.note, state = 'proposed', confirmed_by = NULL, confirmed_at = NULL;
     ELSIF p_step = 'confirm' THEN
       IF NOT co_has(p_actor, 'platform_admin') THEN RETURN 'Confirming a link needs the platform admin role.'; END IF;
       IF NOT FOUND OR l.state <> 'proposed' THEN RETURN 'There is no proposed link to confirm.'; END IF;
       IF l.proposed_by = p_actor THEN RETURN 'You proposed this link, so someone else must confirm it.'; END IF;
       IF l.tenant_id IS DISTINCT FROM p_tenant THEN RETURN 'The link changed since you opened it. Reload and check it again.'; END IF;
       UPDATE csx_links SET state = 'confirmed', confirmed_by = p_actor, confirmed_at = now() WHERE account_id = p_account;
     ELSIF p_step = 'unlink' THEN
       IF NOT (co_has(p_actor, 'platform_admin') OR co_has(p_actor, 'customer_success')) THEN RETURN 'Unlinking needs the customer success or platform admin role.'; END IF;
       IF NOT FOUND THEN RETURN 'This account is not linked.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the link is removed.'; END IF;
       DELETE FROM csx_links WHERE account_id = p_account;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM csx_log(p_account, p_actor, 'link', coalesce(p_tenant, ''), p_step, p_note);
     RETURN 'ok:' || p_account;
   END $$`,
  `CREATE OR REPLACE FUNCTION csx_goal(p_actor text, p_step text, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g csx_goals%ROWTYPE; v_id bigint; BEGIN
     IF NOT co_has(p_actor, 'customer_success') THEN RETURN 'Success plans need the customer success role.'; END IF;
     IF p_step = 'add' THEN
       IF length(trim(coalesce(p->>'goal', ''))) NOT BETWEEN 5 AND 200 THEN RETURN 'Describe the goal (5 to 200 characters).'; END IF;
       IF length(trim(coalesce(p->>'measure', ''))) NOT BETWEEN 3 AND 200 THEN RETURN 'Say how it is measured.'; END IF;
       IF length(trim(coalesce(p->>'target', ''))) NOT BETWEEN 1 AND 80 THEN RETURN 'Give a target.'; END IF;
       IF (p->>'dueOn')::date IS NULL OR (p->>'dueOn')::date < current_date THEN RETURN 'Choose a due date that is not in the past.'; END IF;
       INSERT INTO csx_goals (account_id, goal, measure, target, due_on, owner_id) VALUES (p->>'accountId', trim(p->>'goal'), trim(p->>'measure'), trim(p->>'target'), (p->>'dueOn')::date, p_actor) RETURNING id INTO v_id;
       PERFORM csx_log(p->>'accountId', p_actor, 'goal', v_id::text, 'add', trim(p->>'goal'));
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO g FROM csx_goals WHERE id = (p->>'goalId')::bigint FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Goal not found.'; END IF;
     IF (p->>'version')::int IS DISTINCT FROM g.version THEN RETURN 'This goal changed since you opened it. Reload and try again.'; END IF;
     IF g.state <> 'active' THEN RETURN 'This goal is closed.'; END IF;
     IF p_step NOT IN ('achieved', 'missed', 'dropped') THEN RETURN 'Unknown step.'; END IF;
     IF p_step IN ('achieved', 'missed') AND length(trim(coalesce(p->>'evidence', ''))) < 10 THEN RETURN 'Record the evidence for this outcome (10+ characters).'; END IF;
     IF p_step = 'dropped' AND length(trim(coalesce(p->>'evidence', ''))) < 5 THEN RETURN 'Say why the goal is dropped.'; END IF;
     UPDATE csx_goals SET state = p_step, evidence = trim(p->>'evidence'), version = version + 1, updated_at = now() WHERE id = g.id;
     PERFORM csx_log(g.account_id, p_actor, 'goal', g.id::text, p_step, trim(p->>'evidence'));
     RETURN 'ok:' || g.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION csx_qbr(p_actor text, p_step text, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE q csx_qbrs%ROWTYPE; v_id bigint; BEGIN
     IF NOT co_has(p_actor, 'customer_success') THEN RETURN 'QBRs need the customer success role.'; END IF;
     IF p_step = 'plan' THEN
       IF (p->>'scheduledFor')::date IS NULL OR (p->>'scheduledFor')::date < current_date THEN RETURN 'Choose a date that is not in the past.'; END IF;
       IF EXISTS (SELECT 1 FROM csx_qbrs WHERE account_id = p->>'accountId' AND state IN ('planned', 'prepared')) THEN RETURN 'This account already has an open review.'; END IF;
       INSERT INTO csx_qbrs (account_id, scheduled_for, owner_id) VALUES (p->>'accountId', (p->>'scheduledFor')::date, p_actor) RETURNING id INTO v_id;
       PERFORM csx_log(p->>'accountId', p_actor, 'qbr', v_id::text, 'plan', p->>'scheduledFor');
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO q FROM csx_qbrs WHERE id = (p->>'qbrId')::bigint FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Review not found.'; END IF;
     IF (p->>'version')::int IS DISTINCT FROM q.version THEN RETURN 'This review changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'prepare' THEN
       IF q.state <> 'planned' THEN RETURN 'Only a planned review can be prepared.'; END IF;
       IF p->'snapshot' IS NULL OR jsonb_typeof(p->'snapshot') <> 'object' THEN RETURN 'Nothing to freeze.'; END IF;
       UPDATE csx_qbrs SET state = 'prepared', snapshot = p->'snapshot', snapshot_hash = md5((p->'snapshot')::text), version = version + 1 WHERE id = q.id;
     ELSIF p_step = 'hold' THEN
       IF q.state <> 'prepared' THEN RETURN 'Prepare the review before recording that it was held.'; END IF;
       IF length(trim(coalesce(p->>'notes', ''))) < 20 THEN RETURN 'Write what was discussed and decided (20+ characters).'; END IF;
       UPDATE csx_qbrs SET state = 'held', notes = trim(p->>'notes'), attendees = left(trim(coalesce(p->>'attendees', '')), 500), version = version + 1 WHERE id = q.id;
     ELSIF p_step = 'cancel' THEN
       IF q.state NOT IN ('planned', 'prepared') THEN RETURN 'This review is closed.'; END IF;
       IF length(trim(coalesce(p->>'notes', ''))) < 5 THEN RETURN 'Say why it is cancelled.'; END IF;
       UPDATE csx_qbrs SET state = 'cancelled', notes = trim(p->>'notes'), version = version + 1 WHERE id = q.id;
     ELSIF p_step = 'action' THEN
       IF q.state <> 'held' THEN RETURN 'Add follow-ups after the review is held.'; END IF;
       IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 3 AND 200 OR length(trim(coalesce(p->>'owner', ''))) NOT BETWEEN 2 AND 120 THEN RETURN 'Give the follow-up a title and an owner.'; END IF;
       IF (p->>'dueOn')::date IS NULL THEN RETURN 'Give the follow-up a due date.'; END IF;
       INSERT INTO csx_actions (qbr_id, title, owner, due_on, created_by) VALUES (q.id, trim(p->>'title'), trim(p->>'owner'), (p->>'dueOn')::date, p_actor);
     ELSIF p_step = 'done' THEN
       UPDATE csx_actions SET done_at = now() WHERE id = (p->>'actionId')::bigint AND qbr_id = q.id AND done_at IS NULL;
       IF NOT FOUND THEN RETURN 'Follow-up not found or already done.'; END IF;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM csx_log(q.account_id, p_actor, 'qbr', q.id::text, p_step, coalesce(p->>'title', p->>'notes', ''));
     RETURN 'ok:' || q.id;
   END $$`,
];
