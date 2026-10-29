// Migration dea-001: deans and college roll-ups (role apps "Dean": college plans, department health, resources, escalations,
// governance; "Department Chair": department planning). Builds on tcp-001 (tcp_units, tcp_unit_depts) and sreq-001
// (inst_departments.chair_id). Authority is resolved on the server; p_is_admin = institution Administrator.
// - Deans are appointed to a unit by an administrator, never themselves. A dean covers every department assigned to their
//   unit or to any unit nested under it (dea_covers).
// - Plans: a chair writes the department plan for an academic year, a covering dean approves or returns it; a dean writes the
//   college plan, an administrator approves it. Never by the author; approval bound to the plan seen (hash).
// - Resources: a chair requests a position, budget, space or equipment with a justification. A covering dean decides; an
//   approval draws on the year's allocation of the dean's unit (set by an administrator) and can never exceed what is left.
//   These are planning figures. No money moves here.
// - Escalations: a chair raises an issue; a covering dean (not the person who raised it) acknowledges and resolves it with a note.
// - Governance: a dean opens a motion for their unit; the chairs of the departments it covers at that moment are the
//   electorate; each votes once (changeable until close); closing needs the deadline passed or everyone voted; it carries only
//   with a quorum of half the electorate and more yes than no.
// - History is append-only.
export const DEA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dea_deans (tenant_id text NOT NULL, unit_id bigint NOT NULL REFERENCES tcp_units(id), user_id text NOT NULL, granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (unit_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS dea_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, level text NOT NULL CHECK (level IN ('department', 'college')),
     dept_id bigint REFERENCES inst_departments(id), unit_id bigint REFERENCES tcp_units(id), year text NOT NULL CHECK (year ~ '^[0-9]{4}-[0-9]{2}$'),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160), goals jsonb NOT NULL, plan_hash text NOT NULL,
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'approved', 'returned')), author_id text NOT NULL, decider_id text, note text NOT NULL DEFAULT '',
     rev int NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK ((level = 'department') = (dept_id IS NOT NULL)), CHECK ((level = 'college') = (unit_id IS NOT NULL)),
     CHECK (decider_id IS NULL OR decider_id <> author_id), CHECK (state <> 'approved' OR decider_id IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dea_plans_one ON dea_plans (tenant_id, level, coalesce(dept_id, 0), coalesce(unit_id, 0), year)`,
  `CREATE TABLE IF NOT EXISTS dea_allocations (tenant_id text NOT NULL, unit_id bigint NOT NULL REFERENCES tcp_units(id), year text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
     set_by text NOT NULL, set_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (unit_id, year))`,
  `CREATE TABLE IF NOT EXISTS dea_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, dept_id bigint NOT NULL REFERENCES inst_departments(id), year text NOT NULL CHECK (year ~ '^[0-9]{4}-[0-9]{2}$'),
     kind text NOT NULL CHECK (kind IN ('position', 'budget', 'space', 'equipment')), amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
     justification text NOT NULL CHECK (length(trim(justification)) >= 30), state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'approved', 'declined', 'returned', 'withdrawn')),
     requester_id text NOT NULL, decider_id text, alloc_unit bigint REFERENCES tcp_units(id), note text NOT NULL DEFAULT '', rev int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     CHECK (decider_id IS NULL OR decider_id <> requester_id), CHECK (state <> 'approved' OR alloc_unit IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS dea_escalations (id bigserial PRIMARY KEY, tenant_id text NOT NULL, dept_id bigint NOT NULL REFERENCES inst_departments(id),
     category text NOT NULL CHECK (category IN ('staffing', 'curriculum', 'facilities', 'conduct', 'budget', 'other')), detail text NOT NULL CHECK (length(trim(detail)) >= 20),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved')), raised_by text NOT NULL, handled_by text, note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz, resolved_at timestamptz, CHECK (handled_by IS NULL OR handled_by <> raised_by))`,
  `CREATE TABLE IF NOT EXISTS dea_motions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, unit_id bigint NOT NULL REFERENCES tcp_units(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160),
     body text NOT NULL CHECK (length(trim(body)) >= 20), electorate text[] NOT NULL, opened_by text NOT NULL, closes_at timestamptz NOT NULL,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'carried', 'failed', 'withdrawn')), outcome text NOT NULL DEFAULT '', closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS dea_votes (motion_id bigint NOT NULL REFERENCES dea_motions(id), voter_id text NOT NULL, vote text NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')), at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (motion_id, voter_id))`,
  `CREATE TABLE IF NOT EXISTS dea_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, actor_id text NOT NULL, area text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '', detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dea_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dea_events_append_only') THEN
       CREATE TRIGGER dea_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dea_events FOR EACH STATEMENT EXECUTE FUNCTION dea_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dea_is_dean(p_tenant text, p_unit bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dea_deans WHERE tenant_id = p_tenant AND unit_id = p_unit AND user_id = p_user AND revoked_at IS NULL) $$`,
  // Units from a department's unit up to the root, nearest first.
  `CREATE OR REPLACE FUNCTION dea_units_up(p_dept bigint) RETURNS TABLE (unit_id bigint, depth int) LANGUAGE sql STABLE AS $$
     WITH RECURSIVE up AS (SELECT u.id, u.parent_id, 0 AS depth FROM tcp_unit_depts d JOIN tcp_units u ON u.id = d.unit_id WHERE d.dept_id = p_dept
       UNION ALL SELECT t.id, t.parent_id, up.depth + 1 FROM tcp_units t JOIN up ON t.id = up.parent_id WHERE up.depth < 20)
     SELECT id, depth FROM up $$`,
  `CREATE OR REPLACE FUNCTION dea_covers(p_tenant text, p_user text, p_dept bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dea_units_up(p_dept) x WHERE dea_is_dean(p_tenant, x.unit_id, p_user)) $$`,
  `CREATE OR REPLACE FUNCTION dea_depts_under(p_unit bigint) RETURNS TABLE (dept_id bigint) LANGUAGE sql STABLE AS $$
     WITH RECURSIVE down AS (SELECT id, 0 AS depth FROM tcp_units WHERE id = p_unit AND active UNION ALL SELECT t.id, down.depth + 1 FROM tcp_units t JOIN down ON t.parent_id = down.id WHERE t.active AND down.depth < 20)
     SELECT d.dept_id FROM tcp_unit_depts d JOIN down ON down.id = d.unit_id $$`,
  `CREATE OR REPLACE FUNCTION dea_is_chair(p_tenant text, p_dept bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant AND active AND chair_id = p_user) $$`,

  `CREATE OR REPLACE FUNCTION dea_set_dean(p_tenant text, p_actor text, p_is_admin boolean, p_unit bigint, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator appoints deans.'; END IF;
     IF p_user = p_actor THEN RETURN 'Another administrator appoints you.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM tcp_units WHERE id = p_unit AND tenant_id = p_tenant AND active) THEN RETURN 'Choose an active unit.'; END IF;
     IF p_on THEN
       INSERT INTO dea_deans (tenant_id, unit_id, user_id, granted_by) VALUES (p_tenant, p_unit, p_user, p_actor)
         ON CONFLICT (unit_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by, granted_at = now();
     ELSE
       UPDATE dea_deans SET revoked_at = now() WHERE unit_id = p_unit AND user_id = p_user AND revoked_at IS NULL;
     END IF;
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'dean', CASE WHEN p_on THEN 'appoint' ELSE 'remove' END, 'unit:' || p_unit, p_user);
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION dea_goals_problem(p_goals jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   DECLARE g jsonb;
   BEGIN
     IF p_goals IS NULL OR jsonb_typeof(p_goals) <> 'array' OR jsonb_array_length(p_goals) NOT BETWEEN 1 AND 12 THEN RETURN 'List 1 to 12 goals.'; END IF;
     FOR g IN SELECT * FROM jsonb_array_elements(p_goals) LOOP
       IF length(trim(coalesce(g->>'goal', ''))) < 5 OR length(trim(coalesce(g->>'measure', ''))) < 3 THEN RETURN 'Each goal needs a description and how it will be measured.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dea_plan(p_tenant text, p_actor text, p_is_admin boolean, p_step text, p_id bigint, p_expected int, p_level text, p_dept bigint, p_unit bigint,
     p_year text, p_title text, p_goals jsonb, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p dea_plans; v_id bigint; bad text;
   BEGIN
     IF p_step = 'draft' THEN
       IF p_level = 'department' AND NOT dea_is_chair(p_tenant, p_dept, p_actor) THEN RETURN 'Only the department chair writes the department plan.'; END IF;
       IF p_level = 'college' AND NOT dea_is_dean(p_tenant, p_unit, p_actor) THEN RETURN 'Only the dean writes the college plan.'; END IF;
       IF p_level NOT IN ('department', 'college') THEN RETURN 'Unknown plan level.'; END IF;
       IF coalesce(p_year, '') !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN 'Give the academic year like 2026-27.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Give the plan a title.'; END IF;
       bad := dea_goals_problem(p_goals); IF bad IS NOT NULL THEN RETURN bad; END IF;
       IF EXISTS (SELECT 1 FROM dea_plans WHERE tenant_id = p_tenant AND level = p_level AND coalesce(dept_id, 0) = coalesce(p_dept, 0) AND coalesce(unit_id, 0) = coalesce(p_unit, 0) AND year = p_year)
         THEN RETURN 'A plan for that year already exists. Open it instead.'; END IF;
       INSERT INTO dea_plans (tenant_id, level, dept_id, unit_id, year, title, goals, plan_hash, author_id)
         VALUES (p_tenant, p_level, CASE WHEN p_level = 'department' THEN p_dept END, CASE WHEN p_level = 'college' THEN p_unit END, p_year, trim(p_title), p_goals, md5(trim(p_title) || p_goals::text), p_actor) RETURNING id INTO v_id;
       INSERT INTO dea_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'plan', 'draft', 'plan:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO p FROM dea_plans WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR p.tenant_id <> p_tenant THEN RETURN 'Plan not found.'; END IF;
     IF p.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this plan. Reload and try again.'; END IF;
     IF p_step IN ('edit', 'submit') THEN
       IF p.author_id <> p_actor THEN RETURN 'Only the author changes this plan.'; END IF;
       IF p.state NOT IN ('draft', 'returned') THEN RETURN 'This plan is not open for changes.'; END IF;
       IF p_step = 'edit' THEN
         IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Give the plan a title.'; END IF;
         bad := dea_goals_problem(p_goals); IF bad IS NOT NULL THEN RETURN bad; END IF;
         UPDATE dea_plans SET title = trim(p_title), goals = p_goals, plan_hash = md5(trim(p_title) || p_goals::text), rev = rev + 1, updated_at = now() WHERE id = p.id;
       ELSE
         UPDATE dea_plans SET state = 'submitted', rev = rev + 1, updated_at = now() WHERE id = p.id;
       END IF;
     ELSIF p_step IN ('approve', 'return') THEN
       IF p.state <> 'submitted' THEN RETURN 'This plan is not waiting for a decision.'; END IF;
       IF p.author_id = p_actor THEN RETURN 'You wrote this plan, so someone else decides it.'; END IF;
       IF p.level = 'department' AND NOT dea_covers(p_tenant, p_actor, p.dept_id) THEN RETURN 'Only a dean over this department decides its plan.'; END IF;
       IF p.level = 'college' AND NOT p_is_admin THEN RETURN 'An institution administrator decides the college plan.'; END IF;
       IF p_seen IS DISTINCT FROM p.plan_hash THEN RETURN 'The plan changed since you opened it. Reload and read it again.'; END IF;
       IF p_step = 'return' AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say what needs to change (10+ characters).'; END IF;
       UPDATE dea_plans SET state = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'returned' END, decider_id = p_actor, note = trim(coalesce(p_note, '')), rev = rev + 1, updated_at = now() WHERE id = p.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'plan', p_step, 'plan:' || p.id, coalesce(p_note, ''));
     RETURN 'ok:' || p.id;
   END $$`,

  `CREATE OR REPLACE FUNCTION dea_allocate(p_tenant text, p_actor text, p_is_admin boolean, p_unit bigint, p_year text, p_amount bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE used bigint;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator sets allocations.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM tcp_units WHERE id = p_unit AND tenant_id = p_tenant AND active) THEN RETURN 'Choose an active unit.'; END IF;
     IF coalesce(p_year, '') !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN 'Give the academic year like 2026-27.'; END IF;
     IF p_amount IS NULL OR p_amount < 0 THEN RETURN 'The allocation cannot be negative.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say where the figure comes from (10+ characters).'; END IF;
     SELECT coalesce(sum(amount_minor), 0) INTO used FROM dea_requests WHERE alloc_unit = p_unit AND year = p_year AND state = 'approved';
     IF p_amount < used THEN RETURN 'That is less than has already been approved this year.'; END IF;
     INSERT INTO dea_allocations (tenant_id, unit_id, year, amount_minor, set_by) VALUES (p_tenant, p_unit, p_year, p_amount, p_actor)
       ON CONFLICT (unit_id, year) DO UPDATE SET amount_minor = EXCLUDED.amount_minor, set_by = EXCLUDED.set_by, set_at = now();
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'resources', 'allocate', 'unit:' || p_unit || ' ' || p_year, p_amount || ' — ' || trim(p_reason));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dea_request(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_dept bigint, p_year text, p_kind text, p_amount bigint, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r dea_requests; v_id bigint; v_unit bigint; cap bigint; used bigint;
   BEGIN
     IF p_step = 'submit' THEN
       IF NOT dea_is_chair(p_tenant, p_dept, p_actor) THEN RETURN 'Only the department chair requests resources.'; END IF;
       IF coalesce(p_year, '') !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN 'Give the academic year like 2026-27.'; END IF;
       IF p_kind NOT IN ('position', 'budget', 'space', 'equipment') THEN RETURN 'Choose what you are asking for.'; END IF;
       IF p_amount IS NULL OR p_amount < 0 THEN RETURN 'Give the estimated cost (0 if none).'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 30 THEN RETURN 'Explain the need (30+ characters).'; END IF;
       INSERT INTO dea_requests (tenant_id, dept_id, year, kind, amount_minor, justification, requester_id) VALUES (p_tenant, p_dept, p_year, p_kind, p_amount, trim(p_text), p_actor) RETURNING id INTO v_id;
       INSERT INTO dea_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'resources', 'request', 'request:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO r FROM dea_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this request. Reload and try again.'; END IF;
     IF r.state <> 'submitted' THEN RETURN 'This request is already decided.'; END IF;
     IF p_step = 'withdraw' THEN
       IF r.requester_id <> p_actor THEN RETURN 'Only the person who asked can withdraw it.'; END IF;
       UPDATE dea_requests SET state = 'withdrawn', rev = rev + 1 WHERE id = r.id;
     ELSIF p_step IN ('approve', 'decline', 'return') THEN
       IF r.requester_id = p_actor THEN RETURN 'You asked for this, so a dean decides it.'; END IF;
       IF NOT dea_covers(p_tenant, p_actor, r.dept_id) THEN RETURN 'Only a dean over this department decides its requests.'; END IF;
       IF p_step <> 'approve' AND length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Say why (10+ characters). The chair sees this.'; END IF;
       IF p_step = 'approve' THEN
         -- Nearest unit above the department that this dean leads and that has an allocation for the year.
         SELECT x.unit_id, a.amount_minor INTO v_unit, cap FROM dea_units_up(r.dept_id) x JOIN dea_allocations a ON a.unit_id = x.unit_id AND a.year = r.year
           WHERE dea_is_dean(p_tenant, x.unit_id, p_actor) ORDER BY x.depth LIMIT 1;
         IF v_unit IS NULL THEN RETURN 'Your college has no allocation for that year yet. An administrator sets it.'; END IF;
         PERFORM 1 FROM dea_allocations WHERE unit_id = v_unit AND year = r.year FOR UPDATE;
         SELECT coalesce(sum(amount_minor), 0) INTO used FROM dea_requests WHERE alloc_unit = v_unit AND year = r.year AND state = 'approved';
         IF used + r.amount_minor > cap THEN RETURN 'Approving this would go over the year''s allocation (' || (cap - used) || ' left).'; END IF;
       END IF;
       UPDATE dea_requests SET state = CASE p_step WHEN 'approve' THEN 'approved' WHEN 'decline' THEN 'declined' ELSE 'returned' END, decider_id = p_actor,
         alloc_unit = CASE WHEN p_step = 'approve' THEN v_unit END, note = trim(coalesce(p_text, '')), decided_at = now(), rev = rev + 1 WHERE id = r.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'resources', p_step, 'request:' || r.id, coalesce(p_text, ''));
     RETURN 'ok:' || r.id;
   END $$`,

  `CREATE OR REPLACE FUNCTION dea_escalate(p_tenant text, p_actor text, p_step text, p_id bigint, p_dept bigint, p_category text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e dea_escalations; v_id bigint;
   BEGIN
     IF p_step = 'raise' THEN
       IF NOT dea_is_chair(p_tenant, p_dept, p_actor) THEN RETURN 'Only the department chair escalates to the dean.'; END IF;
       IF NOT EXISTS (SELECT 1 FROM dea_units_up(p_dept) x JOIN dea_deans d ON d.unit_id = x.unit_id AND d.revoked_at IS NULL) THEN RETURN 'No dean covers this department yet. Ask an administrator to assign one.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 20 THEN RETURN 'Describe the issue (20+ characters).'; END IF;
       INSERT INTO dea_escalations (tenant_id, dept_id, category, detail, raised_by) VALUES (p_tenant, p_dept, coalesce(p_category, 'other'), trim(p_text), p_actor) RETURNING id INTO v_id;
       INSERT INTO dea_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'escalation', 'raise', 'escalation:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO e FROM dea_escalations WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR e.tenant_id <> p_tenant THEN RETURN 'Escalation not found.'; END IF;
     IF e.raised_by = p_actor THEN RETURN 'You raised this, so a dean handles it.'; END IF;
     IF NOT dea_covers(p_tenant, p_actor, e.dept_id) THEN RETURN 'Only a dean over this department handles it.'; END IF;
     IF p_step = 'acknowledge' THEN
       IF e.state <> 'open' THEN RETURN 'This escalation is already acknowledged.'; END IF;
       UPDATE dea_escalations SET state = 'acknowledged', handled_by = p_actor, acknowledged_at = now() WHERE id = e.id;
     ELSIF p_step = 'resolve' THEN
       IF e.state = 'resolved' THEN RETURN 'This escalation is already resolved.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Record how it was resolved (10+ characters).'; END IF;
       UPDATE dea_escalations SET state = 'resolved', handled_by = p_actor, note = trim(p_text), acknowledged_at = coalesce(acknowledged_at, now()), resolved_at = now() WHERE id = e.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'escalation', p_step, 'escalation:' || e.id, coalesce(p_text, ''));
     RETURN 'ok:' || e.id;
   END $$`,

  `CREATE OR REPLACE FUNCTION dea_motion(p_tenant text, p_actor text, p_step text, p_id bigint, p_unit bigint, p_title text, p_text text, p_days int, p_vote text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m dea_motions; v_id bigint; elect text[]; n_yes int; n_no int; cast_n int; quorum int;
   BEGIN
     IF p_step = 'open' THEN
       IF NOT dea_is_dean(p_tenant, p_unit, p_actor) THEN RETURN 'Only the dean opens a motion for this unit.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_text, ''))) < 20 THEN RETURN 'Give the motion a title and its full text (20+ characters).'; END IF;
       IF coalesce(p_days, 0) NOT BETWEEN 1 AND 30 THEN RETURN 'Voting stays open 1 to 30 days.'; END IF;
       SELECT array_agg(DISTINCT x.chair_id) INTO elect FROM inst_departments x JOIN dea_depts_under(p_unit) u ON u.dept_id = x.id WHERE x.active AND x.chair_id IS NOT NULL;
       IF coalesce(cardinality(elect), 0) < 2 THEN RETURN 'A motion needs at least two department chairs to vote.'; END IF;
       INSERT INTO dea_motions (tenant_id, unit_id, title, body, electorate, opened_by, closes_at) VALUES (p_tenant, p_unit, trim(p_title), trim(p_text), elect, p_actor, now() + make_interval(days => p_days)) RETURNING id INTO v_id;
       INSERT INTO dea_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'governance', 'open', 'motion:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO m FROM dea_motions WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR m.tenant_id <> p_tenant THEN RETURN 'Motion not found.'; END IF;
     IF m.state <> 'open' THEN RETURN 'This motion is closed.'; END IF;
     IF p_step = 'vote' THEN
       IF NOT (p_actor = ANY(m.electorate)) THEN RETURN 'Only the chairs in this unit vote on this motion.'; END IF;
       IF now() >= m.closes_at THEN RETURN 'Voting has closed.'; END IF;
       IF p_vote NOT IN ('yes', 'no', 'abstain') THEN RETURN 'Vote yes, no or abstain.'; END IF;
       INSERT INTO dea_votes (motion_id, voter_id, vote) VALUES (m.id, p_actor, p_vote) ON CONFLICT (motion_id, voter_id) DO UPDATE SET vote = EXCLUDED.vote, at = now();
       RETURN 'ok:' || m.id;
     END IF;
     IF NOT dea_is_dean(p_tenant, m.unit_id, p_actor) THEN RETURN 'Only the dean of this unit closes or withdraws the motion.'; END IF;
     IF p_step = 'withdraw' THEN
       UPDATE dea_motions SET state = 'withdrawn', outcome = 'Withdrawn by the dean', closed_at = now() WHERE id = m.id;
     ELSIF p_step = 'close' THEN
       SELECT count(*) FILTER (WHERE vote = 'yes'), count(*) FILTER (WHERE vote = 'no'), count(*) INTO n_yes, n_no, cast_n FROM dea_votes WHERE motion_id = m.id AND voter_id = ANY(m.electorate);
       IF now() < m.closes_at AND cast_n < cardinality(m.electorate) THEN RETURN 'Voting is still open and not everyone has voted.'; END IF;
       quorum := ceil(cardinality(m.electorate) / 2.0);
       UPDATE dea_motions SET state = CASE WHEN cast_n >= quorum AND n_yes > n_no THEN 'carried' ELSE 'failed' END,
         outcome = n_yes || ' yes, ' || n_no || ' no, ' || (cast_n - n_yes - n_no) || ' abstain of ' || cardinality(m.electorate) || CASE WHEN cast_n < quorum THEN ' (no quorum)' ELSE '' END, closed_at = now() WHERE id = m.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO dea_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'governance', p_step, 'motion:' || m.id);
     RETURN 'ok:' || m.id;
   END $$`,
];
