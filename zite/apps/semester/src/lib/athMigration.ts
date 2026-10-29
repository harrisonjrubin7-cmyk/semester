// Migration ath-001: athletics compliance (role app "Athletics Compliance Officer": versioned eligibility rules, roster reviews,
// certifications, exceptions). The rules are the institution's own: Semester ships no association's thresholds and claims no
// association compliance. Authority is resolved on the server; p_is_admin = institution Administrator.
// - Officers are appointed by an administrator, never themselves.
// - Rule sets are versioned. A draft lists 1-10 distinct rules (minimum term credits, minimum cumulative GPA on the 4.0 letter
//   scale, minimum completed credits). Another officer approves the exact rules (hash); approving retires the previous version.
// - Teams and rosters are kept by officers; a roster line is a student of the institution (the endpoint checks membership).
// - A roster review for a term snapshots each athlete's facts (computed by the endpoint from enrolments, course credits and
//   current official grades) and the database evaluates the approved rules on them (ath_eval). Passing lines are eligible;
//   failing lines are ineligible unless an exception is requested with a reason and reference and approved by a second officer.
// - A review is certified by an officer or administrator other than the one who opened it, only when every line is decided.
//   Certified reviews and their lines never change. History is append-only.
// - Athletes see their own certified results only (ath_my_lines).
export const ATH_RULE_KINDS = ['min_term_credits', 'min_cumulative_gpa', 'min_completed_credits'] as const;
const KINDS = ATH_RULE_KINDS.map((k) => `'${k}'`).join(', ');

export const ATH_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS ath_officers (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS ath_rule_sets (id bigserial PRIMARY KEY, tenant_id text NOT NULL, version int NOT NULL, rules jsonb NOT NULL, rules_hash text NOT NULL, note text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'approved', 'retired')), author_id text NOT NULL, approver_id text, approved_at timestamptz, rev int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, version), CHECK (approver_id IS NULL OR approver_id <> author_id), CHECK (state = 'draft' OR approver_id IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ath_rules_one_live ON ath_rule_sets (tenant_id) WHERE state = 'approved'`,
  `CREATE TABLE IF NOT EXISTS ath_teams (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120), sport text NOT NULL CHECK (length(trim(sport)) BETWEEN 2 AND 60),
     active boolean NOT NULL DEFAULT true, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ath_teams_name ON ath_teams (tenant_id, lower(name)) WHERE active`,
  `CREATE TABLE IF NOT EXISTS ath_roster (team_id bigint NOT NULL REFERENCES ath_teams(id), student_id text NOT NULL, active boolean NOT NULL DEFAULT true, added_by text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (team_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS ath_reviews (id bigserial PRIMARY KEY, tenant_id text NOT NULL, team_id bigint NOT NULL REFERENCES ath_teams(id), term text NOT NULL CHECK (length(trim(term)) BETWEEN 3 AND 40),
     rule_set_id bigint NOT NULL REFERENCES ath_rule_sets(id), state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'certified', 'cancelled')), opened_by text NOT NULL, certified_by text, certified_at timestamptz,
     note text NOT NULL DEFAULT '', rev int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), CHECK (certified_by IS NULL OR certified_by <> opened_by), CHECK (state <> 'certified' OR certified_by IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ath_reviews_one_open ON ath_reviews (team_id, term) WHERE state <> 'cancelled'`,
  `CREATE TABLE IF NOT EXISTS ath_review_lines (review_id bigint NOT NULL REFERENCES ath_reviews(id), student_id text NOT NULL, facts jsonb NOT NULL, results jsonb NOT NULL, passes boolean NOT NULL,
     outcome text CHECK (outcome IN ('eligible', 'ineligible', 'exception')), exception_reason text, exception_ref text, exception_by text, exception_approved_by text,
     decided_by text, decided_at timestamptz, PRIMARY KEY (review_id, student_id),
     CHECK (outcome <> 'eligible' OR passes), CHECK (outcome <> 'exception' OR (exception_approved_by IS NOT NULL AND exception_approved_by <> exception_by)))`,
  `CREATE TABLE IF NOT EXISTS ath_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, actor_id text NOT NULL, area text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '', detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION ath_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `CREATE OR REPLACE FUNCTION ath_refuse_certified() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN IF EXISTS (SELECT 1 FROM ath_reviews WHERE id = OLD.review_id AND state = 'certified') THEN RAISE EXCEPTION 'CERTIFIED' USING ERRCODE = '42501'; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ath_events_append_only') THEN
       CREATE TRIGGER ath_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON ath_events FOR EACH STATEMENT EXECUTE FUNCTION ath_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ath_lines_frozen') THEN
       CREATE TRIGGER ath_lines_frozen BEFORE UPDATE OR DELETE ON ath_review_lines FOR EACH ROW EXECUTE FUNCTION ath_refuse_certified();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION ath_is_officer(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM ath_officers WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION ath_rules_problem(p_rules jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   DECLARE r jsonb; seen text[] := '{}'; v numeric;
   BEGIN
     IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN RETURN 'List 1 to 10 rules.'; END IF;
     FOR r IN SELECT * FROM jsonb_array_elements(p_rules) LOOP
       IF coalesce(r->>'kind', '') NOT IN (${KINDS}) THEN RETURN 'Unknown rule kind.'; END IF;
       IF (r->>'kind') = ANY(seen) THEN RETURN 'Each kind of rule appears once.'; END IF;
       seen := seen || (r->>'kind');
       IF jsonb_typeof(r->'value') <> 'number' THEN RETURN 'Each rule needs a number.'; END IF;
       v := (r->>'value')::numeric;
       IF (r->>'kind') = 'min_cumulative_gpa' AND (v < 0 OR v > 4) THEN RETURN 'A GPA minimum is between 0 and 4.'; END IF;
       IF (r->>'kind') <> 'min_cumulative_gpa' AND (v < 0 OR v > 300 OR v <> trunc(v)) THEN RETURN 'A credit minimum is a whole number from 0 to 300.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,
  // Evaluate the rules on one athlete's facts: {term_credits, cumulative_gpa (null if no graded work), completed_credits}.
  `CREATE OR REPLACE FUNCTION ath_eval(p_rules jsonb, p_facts jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
     SELECT coalesce(jsonb_agg(jsonb_build_object('kind', r->>'kind', 'required', (r->>'value')::numeric, 'actual', a.actual,
       'pass', a.actual IS NOT NULL AND a.actual >= (r->>'value')::numeric) ORDER BY r->>'kind'), '[]'::jsonb)
     FROM jsonb_array_elements(p_rules) r, LATERAL (SELECT CASE r->>'kind' WHEN 'min_term_credits' THEN (p_facts->>'term_credits')::numeric
       WHEN 'min_cumulative_gpa' THEN (p_facts->>'cumulative_gpa')::numeric WHEN 'min_completed_credits' THEN (p_facts->>'completed_credits')::numeric END AS actual) a $$`,

  `CREATE OR REPLACE FUNCTION ath_set_officer(p_tenant text, p_actor text, p_is_admin boolean, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator appoints compliance officers.'; END IF;
     IF p_user = p_actor THEN RETURN 'Another administrator appoints you.'; END IF;
     IF p_on THEN INSERT INTO ath_officers (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_actor) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by, granted_at = now();
     ELSE UPDATE ath_officers SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'officer', CASE WHEN p_on THEN 'appoint' ELSE 'remove' END, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION ath_rule_set(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_rules jsonb, p_note text, p_seen text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r ath_rule_sets; v_id bigint; bad text;
   BEGIN
     IF NOT ath_is_officer(p_tenant, p_actor) THEN RETURN 'Only an athletics compliance officer manages eligibility rules.'; END IF;
     IF p_step = 'draft' THEN
       bad := ath_rules_problem(p_rules); IF bad IS NOT NULL THEN RETURN bad; END IF;
       IF EXISTS (SELECT 1 FROM ath_rule_sets WHERE tenant_id = p_tenant AND state = 'draft') THEN RETURN 'A draft rule set already exists. Edit or approve it first.'; END IF;
       INSERT INTO ath_rule_sets (tenant_id, version, rules, rules_hash, note, author_id)
         VALUES (p_tenant, (SELECT coalesce(max(version), 0) + 1 FROM ath_rule_sets WHERE tenant_id = p_tenant), p_rules, md5(p_rules::text), trim(coalesce(p_note, '')), p_actor) RETURNING id INTO v_id;
       INSERT INTO ath_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'rules', 'draft', 'rules:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO r FROM ath_rule_sets WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Rule set not found.'; END IF;
     IF r.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this rule set. Reload and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF r.state <> 'draft' THEN RETURN 'Approved rules are not edited. Start a new version.'; END IF;
       bad := ath_rules_problem(p_rules); IF bad IS NOT NULL THEN RETURN bad; END IF;
       UPDATE ath_rule_sets SET rules = p_rules, rules_hash = md5(p_rules::text), note = trim(coalesce(p_note, '')), author_id = p_actor, rev = rev + 1 WHERE id = r.id;
     ELSIF p_step = 'approve' THEN
       IF r.state <> 'draft' THEN RETURN 'This version is not waiting for approval.'; END IF;
       IF r.author_id = p_actor THEN RETURN 'You wrote these rules, so another officer approves them.'; END IF;
       IF p_seen IS DISTINCT FROM r.rules_hash THEN RETURN 'The rules changed since you opened them. Reload and read them again.'; END IF;
       UPDATE ath_rule_sets SET state = 'retired', rev = rev + 1 WHERE tenant_id = p_tenant AND state = 'approved';
       UPDATE ath_rule_sets SET state = 'approved', approver_id = p_actor, approved_at = now(), rev = rev + 1 WHERE id = r.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'rules', p_step, 'rules:' || r.id);
     RETURN 'ok:' || r.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ath_team(p_tenant text, p_actor text, p_step text, p_team bigint, p_name text, p_sport text, p_student text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT ath_is_officer(p_tenant, p_actor) THEN RETURN 'Only an athletics compliance officer manages teams.'; END IF;
     IF p_step = 'create' THEN
       IF length(trim(coalesce(p_name, ''))) < 3 OR length(trim(coalesce(p_sport, ''))) < 2 THEN RETURN 'Give the team a name and sport.'; END IF;
       IF EXISTS (SELECT 1 FROM ath_teams WHERE tenant_id = p_tenant AND active AND lower(name) = lower(trim(p_name))) THEN RETURN 'A team with that name already exists.'; END IF;
       INSERT INTO ath_teams (tenant_id, name, sport, created_by) VALUES (p_tenant, trim(p_name), trim(p_sport), p_actor) RETURNING id INTO v_id;
       INSERT INTO ath_events (tenant_id, actor_id, area, action, target) VALUES (p_tenant, p_actor, 'team', 'create', 'team:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM ath_teams WHERE id = p_team AND tenant_id = p_tenant AND active) THEN RETURN 'Team not found.'; END IF;
     IF p_step = 'add' THEN
       INSERT INTO ath_roster (team_id, student_id, added_by) VALUES (p_team, p_student, p_actor) ON CONFLICT (team_id, student_id) DO UPDATE SET active = true, added_by = EXCLUDED.added_by, added_at = now();
     ELSIF p_step = 'remove' THEN
       UPDATE ath_roster SET active = false WHERE team_id = p_team AND student_id = p_student;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'roster', p_step, 'team:' || p_team, p_student);
     RETURN 'ok:' || p_team;
   END $$`,
  // Open a review: p_facts is {student_id: {term_credits, cumulative_gpa, completed_credits}} for every active roster athlete.
  `CREATE OR REPLACE FUNCTION ath_open_review(p_tenant text, p_actor text, p_team bigint, p_term text, p_facts jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE rs ath_rule_sets; v_id bigint; s text; f jsonb; res jsonb; missing int;
   BEGIN
     IF NOT ath_is_officer(p_tenant, p_actor) THEN RETURN 'Only an athletics compliance officer opens roster reviews.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM ath_teams WHERE id = p_team AND tenant_id = p_tenant AND active) THEN RETURN 'Team not found.'; END IF;
     SELECT * INTO rs FROM ath_rule_sets WHERE tenant_id = p_tenant AND state = 'approved';
     IF NOT FOUND THEN RETURN 'Approve an eligibility rule set first.'; END IF;
     IF length(trim(coalesce(p_term, ''))) < 3 THEN RETURN 'Choose the term.'; END IF;
     IF EXISTS (SELECT 1 FROM ath_reviews WHERE team_id = p_team AND term = trim(p_term) AND state <> 'cancelled') THEN RETURN 'This team already has a review for that term.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM ath_roster WHERE team_id = p_team AND active) THEN RETURN 'The roster is empty.'; END IF;
     SELECT count(*) INTO missing FROM ath_roster WHERE team_id = p_team AND active AND NOT (coalesce(p_facts, '{}'::jsonb) ? student_id);
     IF missing > 0 THEN RETURN 'Academic facts are missing for ' || missing || ' athlete(s).'; END IF;
     INSERT INTO ath_reviews (tenant_id, team_id, term, rule_set_id, opened_by) VALUES (p_tenant, p_team, trim(p_term), rs.id, p_actor) RETURNING id INTO v_id;
     FOR s IN SELECT student_id FROM ath_roster WHERE team_id = p_team AND active LOOP
       f := p_facts->s; res := ath_eval(rs.rules, f);
       INSERT INTO ath_review_lines (review_id, student_id, facts, results, passes) VALUES (v_id, s, f, res, NOT EXISTS (SELECT 1 FROM jsonb_array_elements(res) x WHERE NOT (x->>'pass')::boolean));
     END LOOP;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'review', 'open', 'review:' || v_id, 'rules v' || rs.version);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ath_line(p_tenant text, p_actor text, p_step text, p_review bigint, p_student text, p_reason text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE rv ath_reviews; l ath_review_lines;
   BEGIN
     IF NOT ath_is_officer(p_tenant, p_actor) THEN RETURN 'Only an athletics compliance officer decides roster lines.'; END IF;
     SELECT * INTO rv FROM ath_reviews WHERE id = p_review FOR UPDATE;
     IF NOT FOUND OR rv.tenant_id <> p_tenant THEN RETURN 'Review not found.'; END IF;
     IF rv.state <> 'open' THEN RETURN 'This review is closed.'; END IF;
     SELECT * INTO l FROM ath_review_lines WHERE review_id = rv.id AND student_id = p_student FOR UPDATE;
     IF NOT FOUND THEN RETURN 'That athlete is not in this review.'; END IF;
     IF p_step = 'eligible' THEN
       IF NOT l.passes THEN RETURN 'This athlete does not meet every rule. Mark ineligible or request an exception.'; END IF;
       UPDATE ath_review_lines SET outcome = 'eligible', decided_by = p_actor, decided_at = now() WHERE review_id = rv.id AND student_id = p_student;
     ELSIF p_step = 'ineligible' THEN
       UPDATE ath_review_lines SET outcome = 'ineligible', exception_reason = NULL, exception_ref = NULL, exception_by = NULL, exception_approved_by = NULL, decided_by = p_actor, decided_at = now() WHERE review_id = rv.id AND student_id = p_student;
     ELSIF p_step = 'request_exception' THEN
       IF l.passes THEN RETURN 'This athlete meets every rule; no exception is needed.'; END IF;
       IF length(trim(coalesce(p_reason, ''))) < 30 OR length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Give the reason (30+ characters) and the waiver or document reference.'; END IF;
       UPDATE ath_review_lines SET outcome = NULL, exception_reason = trim(p_reason), exception_ref = trim(p_ref), exception_by = p_actor, exception_approved_by = NULL WHERE review_id = rv.id AND student_id = p_student;
     ELSIF p_step = 'approve_exception' THEN
       IF l.exception_by IS NULL THEN RETURN 'No exception has been requested.'; END IF;
       IF l.exception_by = p_actor THEN RETURN 'You requested this exception, so another officer approves it.'; END IF;
       UPDATE ath_review_lines SET outcome = 'exception', exception_approved_by = p_actor, decided_by = p_actor, decided_at = now() WHERE review_id = rv.id AND student_id = p_student;
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE ath_reviews SET rev = rev + 1 WHERE id = rv.id;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'review', p_step, 'review:' || rv.id, p_student);
     RETURN 'ok:' || rv.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ath_certify(p_tenant text, p_actor text, p_is_admin boolean, p_review bigint, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE rv ath_reviews; undecided int;
   BEGIN
     IF NOT (ath_is_officer(p_tenant, p_actor) OR p_is_admin) THEN RETURN 'Only an athletics compliance officer or administrator certifies a review.'; END IF;
     SELECT * INTO rv FROM ath_reviews WHERE id = p_review FOR UPDATE;
     IF NOT FOUND OR rv.tenant_id <> p_tenant THEN RETURN 'Review not found.'; END IF;
     IF rv.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this review. Reload and try again.'; END IF;
     IF rv.state <> 'open' THEN RETURN 'This review is already closed.'; END IF;
     IF rv.opened_by = p_actor THEN RETURN 'You opened this review, so someone else certifies it.'; END IF;
     SELECT count(*) INTO undecided FROM ath_review_lines WHERE review_id = rv.id AND outcome IS NULL;
     IF undecided > 0 THEN RETURN undecided || ' athlete(s) still need a decision.'; END IF;
     UPDATE ath_reviews SET state = 'certified', certified_by = p_actor, certified_at = now(), note = trim(coalesce(p_note, '')), rev = rev + 1 WHERE id = rv.id;
     INSERT INTO ath_events (tenant_id, actor_id, area, action, target, detail) VALUES (p_tenant, p_actor, 'review', 'certify', 'review:' || rv.id, coalesce(p_note, ''));
     RETURN 'ok:' || rv.id;
   END $$`,
  // An athlete's own certified results only (decision 29 Oct). Drafts, open reviews and other athletes' lines are never returned.
  `CREATE OR REPLACE FUNCTION ath_my_lines(p_tenant text, p_user text) RETURNS TABLE (facts jsonb, results jsonb, outcome text, exception_ref text, term text, certified_at timestamptz, team text, sport text, rules_version int)
     LANGUAGE sql STABLE AS $$
     SELECT l.facts, l.results, l.outcome, l.exception_ref, v.term, v.certified_at, t.name, t.sport, s.version
       FROM ath_review_lines l JOIN ath_reviews v ON v.id = l.review_id JOIN ath_teams t ON t.id = v.team_id JOIN ath_rule_sets s ON s.id = v.rule_set_id
      WHERE v.tenant_id = p_tenant AND l.student_id = p_user AND v.state = 'certified' ORDER BY v.certified_at DESC LIMIT 20 $$`,
];
