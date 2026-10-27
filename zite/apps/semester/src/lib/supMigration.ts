// Migration sup-001: peer mentoring (Peer Mentor), teaching-assistant escalation (Teaching Assistant) and tutoring quality review
// (Learning Center Staff). Builds on tut-001 (tut_requests, tut_is_staff) and the course-team delegation (crs_is_delegate).
// Peer mentoring: supervisors are granted by an administrator, never self; a student offers to mentor and a supervisor (not the
// student) approves; mentees opt in; a supervisor matches an approved mentor with an opted-in mentee (never the same person, and
// never themselves). Mentors log short check-ins on their own matches; goals belong to the mentee; either side ends a match; a
// mentor escalates to supervisors with a category and short note, and a supervisor other than the mentor resolves it.
// TA escalation: an active grading delegate raises a question to the section's instructors; an instructor answers it.
// Tutoring quality: a student rates their own completed session once; center staff see per-tutor averages only at three or more
// ratings and record a review note for a tutor who is not themselves. Append-only history.
export const SUP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS pmn_supervisors (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS pmn_people (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('mentor','mentee')), interests text NOT NULL DEFAULT '' CHECK (length(interests) <= 500),
     state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','opted_in','withdrawn')), approved_by text, PRIMARY KEY (tenant_id, user_id, role),
     CHECK (approved_by IS NULL OR approved_by <> user_id), CHECK (role = 'mentee' OR state <> 'opted_in'), CHECK (role = 'mentor' OR state IN ('opted_in','withdrawn')))`,
  `CREATE TABLE IF NOT EXISTS pmn_matches (id bigserial PRIMARY KEY, tenant_id text NOT NULL, mentor_id text NOT NULL, mentee_id text NOT NULL, matched_by text NOT NULL,
     state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','ended')), ended_by text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (mentor_id <> mentee_id), CHECK (matched_by NOT IN (mentor_id, mentee_id)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pmn_one_active_mentee ON pmn_matches (tenant_id, mentee_id) WHERE state = 'active'`,
  `CREATE TABLE IF NOT EXISTS pmn_checkins (id bigserial PRIMARY KEY, match_id bigint NOT NULL REFERENCES pmn_matches(id), mood text NOT NULL CHECK (mood IN ('good','okay','struggling')),
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 500), at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS pmn_goals (id bigserial PRIMARY KEY, match_id bigint NOT NULL REFERENCES pmn_matches(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','met','dropped')), progress text NOT NULL DEFAULT '' CHECK (length(progress) <= 1000))`,
  `CREATE TABLE IF NOT EXISTS pmn_escalations (id bigserial PRIMARY KEY, match_id bigint NOT NULL REFERENCES pmn_matches(id), raised_by text NOT NULL,
     category text NOT NULL CHECK (category IN ('wellbeing','academic','conduct','boundary','other')), note text NOT NULL CHECK (length(trim(note)) BETWEEN 10 AND 1000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')), resolution text NOT NULL DEFAULT '', resolved_by text,
     CHECK (resolved_by IS NULL OR resolved_by <> raised_by), CHECK (state <> 'resolved' OR length(trim(resolution)) >= 5))`,
  `CREATE TABLE IF NOT EXISTS tae_questions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, ta_id text NOT NULL,
     topic text NOT NULL CHECK (topic IN ('grading','integrity_concern','student_request','content','other')), question text NOT NULL CHECK (length(trim(question)) BETWEEN 10 AND 2000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','answered')), answer text NOT NULL DEFAULT '', answered_by text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (answered_by IS NULL OR answered_by <> ta_id), CHECK (state <> 'answered' OR length(trim(answer)) >= 3))`,
  `CREATE TABLE IF NOT EXISTS tqr_ratings (request_id text PRIMARY KEY, tenant_id text NOT NULL, tutor_id text NOT NULL, student_id text NOT NULL, score int NOT NULL CHECK (score BETWEEN 1 AND 5),
     comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 1000), at timestamptz NOT NULL DEFAULT now(), CHECK (tutor_id <> student_id))`,
  `CREATE TABLE IF NOT EXISTS tqr_reviews (id bigserial PRIMARY KEY, tenant_id text NOT NULL, tutor_id text NOT NULL, reviewer_id text NOT NULL, note text NOT NULL CHECK (length(trim(note)) BETWEEN 10 AND 2000),
     action text NOT NULL CHECK (action IN ('no_action','coaching','observe','pause')), at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK (reviewer_id <> tutor_id))`,
  `CREATE TABLE IF NOT EXISTS spt_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION spt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'spt_events_append_only') THEN
       CREATE TRIGGER spt_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON spt_events FOR EACH STATEMENT EXECUTE FUNCTION spt_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pmn_checkins_append_only') THEN
       CREATE TRIGGER pmn_checkins_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON pmn_checkins FOR EACH STATEMENT EXECUTE FUNCTION spt_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tqr_reviews_append_only') THEN
       CREATE TRIGGER tqr_reviews_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON tqr_reviews FOR EACH STATEMENT EXECUTE FUNCTION spt_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION spt_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO spt_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION pmn_is_sup(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM pmn_supervisors WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION pmn_set_sup(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_on THEN INSERT INTO pmn_supervisors (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin) ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin;
     ELSE UPDATE pmn_supervisors SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     PERFORM spt_log(p_tenant, 'supervisor', p_user, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_join(p_user text, p_tenant text, p_role text, p_interests text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_role NOT IN ('mentor','mentee') THEN RETURN 'Unknown role.'; END IF;
     IF NOT p_on THEN UPDATE pmn_people SET state = 'withdrawn' WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role; RETURN NULL; END IF;
     INSERT INTO pmn_people (tenant_id, user_id, role, interests, state) VALUES (p_tenant, p_user, p_role, coalesce(p_interests, ''), CASE WHEN p_role = 'mentee' THEN 'opted_in' ELSE 'pending' END)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET interests = EXCLUDED.interests,
         state = CASE WHEN p_role = 'mentee' THEN 'opted_in' WHEN pmn_people.state = 'approved' THEN 'approved' ELSE 'pending' END;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_approve(p_actor text, p_tenant text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT pmn_is_sup(p_tenant, p_actor) THEN RETURN 'Only mentoring supervisors approve mentors.'; END IF;
     IF p_actor = p_user THEN RETURN 'Another supervisor approves you.'; END IF;
     UPDATE pmn_people SET state = 'approved', approved_by = p_actor WHERE tenant_id = p_tenant AND user_id = p_user AND role = 'mentor' AND state = 'pending';
     IF NOT FOUND THEN RETURN 'No pending mentor application.'; END IF;
     PERFORM spt_log(p_tenant, 'mentor', p_user, 'approve', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_match(p_actor text, p_tenant text, p_mentor text, p_mentee text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT pmn_is_sup(p_tenant, p_actor) THEN RETURN 'Only mentoring supervisors make matches.'; END IF;
     IF p_actor IN (p_mentor, p_mentee) THEN RETURN 'Another supervisor makes a match that includes you.'; END IF;
     IF p_mentor = p_mentee THEN RETURN 'Choose two different people.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pmn_people WHERE tenant_id = p_tenant AND user_id = p_mentor AND role = 'mentor' AND state = 'approved') THEN RETURN 'Choose an approved mentor.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pmn_people WHERE tenant_id = p_tenant AND user_id = p_mentee AND role = 'mentee' AND state = 'opted_in') THEN RETURN 'The mentee has not opted in.'; END IF;
     INSERT INTO pmn_matches (tenant_id, mentor_id, mentee_id, matched_by) VALUES (p_tenant, p_mentor, p_mentee, p_actor) RETURNING id INTO v_id;
     PERFORM spt_log(p_tenant, 'match', v_id::text, 'match', p_actor);
     RETURN 'ok:' || v_id;
   EXCEPTION WHEN unique_violation THEN RETURN 'That mentee already has an active mentor.';
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_checkin(p_actor text, p_tenant text, p_match bigint, p_mood text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pmn_matches WHERE id = p_match AND tenant_id = p_tenant AND mentor_id = p_actor AND state = 'active') THEN RETURN 'Log check-ins on your own active matches.'; END IF;
     INSERT INTO pmn_checkins (match_id, mood, note) VALUES (p_match, p_mood, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_goal(p_actor text, p_tenant text, p_match bigint, p_goal bigint, p_title text, p_state text, p_progress text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m pmn_matches;
   BEGIN
     SELECT * INTO m FROM pmn_matches WHERE id = p_match AND tenant_id = p_tenant AND state = 'active';
     IF m.id IS NULL THEN RETURN 'Match not found.'; END IF;
     IF p_goal IS NULL THEN
       IF p_actor <> m.mentee_id THEN RETURN 'Goals belong to the mentee.'; END IF;
       INSERT INTO pmn_goals (match_id, title) VALUES (p_match, trim(p_title));
     ELSE
       IF p_actor NOT IN (m.mentee_id, m.mentor_id) THEN RETURN 'Only the pair updates goals.'; END IF;
       IF p_state IN ('met','dropped') AND p_actor <> m.mentee_id THEN RETURN 'The mentee closes their own goals.'; END IF;
       UPDATE pmn_goals SET state = coalesce(p_state, state), progress = coalesce(p_progress, progress) WHERE id = p_goal AND match_id = p_match;
       IF NOT FOUND THEN RETURN 'Goal not found.'; END IF;
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_end(p_actor text, p_tenant text, p_match bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m pmn_matches;
   BEGIN
     SELECT * INTO m FROM pmn_matches WHERE id = p_match AND tenant_id = p_tenant FOR UPDATE;
     IF m.id IS NULL OR m.state <> 'active' THEN RETURN 'Match not found.'; END IF;
     IF p_actor NOT IN (m.mentor_id, m.mentee_id) AND NOT pmn_is_sup(p_tenant, p_actor) THEN RETURN 'Only the pair or a supervisor ends a match.'; END IF;
     UPDATE pmn_matches SET state = 'ended', ended_by = p_actor WHERE id = p_match;
     PERFORM spt_log(p_tenant, 'match', p_match::text, 'end', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_escalate(p_actor text, p_tenant text, p_match bigint, p_category text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pmn_matches WHERE id = p_match AND tenant_id = p_tenant AND mentor_id = p_actor) THEN RETURN 'Mentors escalate on their own matches.'; END IF;
     INSERT INTO pmn_escalations (match_id, raised_by, category, note) VALUES (p_match, p_actor, p_category, trim(p_note)) RETURNING id INTO v_id;
     PERFORM spt_log(p_tenant, 'escalation', v_id::text, 'raise', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION pmn_resolve(p_actor text, p_tenant text, p_id bigint, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e pmn_escalations;
   BEGIN
     IF NOT pmn_is_sup(p_tenant, p_actor) THEN RETURN 'Only mentoring supervisors resolve escalations.'; END IF;
     SELECT x.* INTO e FROM pmn_escalations x JOIN pmn_matches m ON m.id = x.match_id WHERE x.id = p_id AND m.tenant_id = p_tenant FOR UPDATE OF x;
     IF e.id IS NULL THEN RETURN 'Escalation not found.'; END IF;
     IF e.state <> 'open' THEN RETURN 'Already resolved.'; END IF;
     IF e.raised_by = p_actor THEN RETURN 'Another supervisor resolves what you raised.'; END IF;
     IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Record what was done.'; END IF;
     UPDATE pmn_escalations SET state = 'resolved', resolution = trim(p_text), resolved_by = p_actor WHERE id = p_id;
     PERFORM spt_log(p_tenant, 'escalation', p_id::text, 'resolve', p_actor);
     RETURN NULL;
   END $$`,
  // TA escalation. p_is_delegate / p_is_instructor are computed by the endpoint from the section record and crs_is_delegate.
  `CREATE OR REPLACE FUNCTION tae_ask(p_actor text, p_tenant text, p_section text, p_is_delegate boolean, p_topic text, p_question text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT p_is_delegate THEN RETURN 'Only a teaching assistant with an active delegation for this section escalates to its instructors.'; END IF;
     INSERT INTO tae_questions (tenant_id, section_id, ta_id, topic, question) VALUES (p_tenant, p_section, p_actor, p_topic, trim(p_question)) RETURNING id INTO v_id;
     PERFORM spt_log(p_tenant, 'ta_question', v_id::text, 'ask', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION tae_answer(p_actor text, p_tenant text, p_id bigint, p_is_instructor boolean, p_answer text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE q tae_questions;
   BEGIN
     SELECT * INTO q FROM tae_questions WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF q.id IS NULL THEN RETURN 'Question not found.'; END IF;
     IF NOT p_is_instructor THEN RETURN 'Only an instructor of the section answers.'; END IF;
     IF q.ta_id = p_actor THEN RETURN 'Someone else answers your own question.'; END IF;
     IF q.state <> 'open' THEN RETURN 'Already answered.'; END IF;
     IF length(trim(coalesce(p_answer, ''))) < 3 THEN RETURN 'Write an answer.'; END IF;
     UPDATE tae_questions SET state = 'answered', answer = trim(p_answer), answered_by = p_actor WHERE id = p_id;
     PERFORM spt_log(p_tenant, 'ta_question', p_id::text, 'answer', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tqr_rate(p_student text, p_tenant text, p_request text, p_score int, p_comment text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tut_requests;
   BEGIN
     SELECT * INTO r FROM tut_requests WHERE id = p_request AND tenant_id = p_tenant;
     IF r.id IS NULL OR r.student_id <> p_student THEN RETURN 'Rate your own tutoring sessions.'; END IF;
     IF r.state <> 'completed' THEN RETURN 'Rate a session after it is completed.'; END IF;
     INSERT INTO tqr_ratings (request_id, tenant_id, tutor_id, student_id, score, comment) VALUES (p_request, p_tenant, r.tutor_id, p_student, p_score, coalesce(p_comment, ''));
     RETURN NULL;
   EXCEPTION WHEN unique_violation THEN RETURN 'You already rated this session.';
   END $$`,
  // Per-tutor averages; tutors with fewer than three ratings show no average.
  `CREATE OR REPLACE FUNCTION tqr_summary(p_tenant text) RETURNS TABLE (tutor_id text, n int, avg_score numeric) LANGUAGE sql STABLE AS $$
     SELECT tutor_id, count(*)::int, CASE WHEN count(*) >= 3 THEN round(avg(score), 2) END FROM tqr_ratings WHERE tenant_id = p_tenant GROUP BY tutor_id $$`,
  `CREATE OR REPLACE FUNCTION tqr_review(p_actor text, p_tenant text, p_tutor text, p_note text, p_action text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT tut_is_staff(p_tenant, p_actor) THEN RETURN 'Only learning center staff review tutors.'; END IF;
     IF p_actor = p_tutor THEN RETURN 'Someone else reviews your own tutoring.'; END IF;
     INSERT INTO tqr_reviews (tenant_id, tutor_id, reviewer_id, note, action) VALUES (p_tenant, p_tutor, p_actor, trim(p_note), p_action);
     PERFORM spt_log(p_tenant, 'tutor_review', p_tutor, p_action, p_actor);
     RETURN NULL;
   END $$`,
];
