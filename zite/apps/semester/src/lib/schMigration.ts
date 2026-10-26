// Migration sch-001: scholarships (mirrors lib/scholarshipRules.ts). Shared by the Semester app (students, the institution's
// scholarship office) and Semester Employers (external sponsors).
// Enforced here: office members are granted by an administrator (never themselves); a sponsor is verified per institution by
// that institution's office, never by its own owner; programs exist only under a verified link; applications need an open
// program before its deadline, a consent hash and a statement; one application per student per program (idempotent);
// awards lock the program row and never exceed its number; only the student accepts or declines; only the office hands off,
// and the hand-off moves no money; renewals are requested by the awardee, decided by the sponsor and handed off by the
// office; nobody acts on their own application; expected-version everywhere; append-only history.
export const SCH_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS sch_office (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION sch_is_office(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM sch_office WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE TABLE IF NOT EXISTS sch_sponsors (id bigserial PRIMARY KEY, owner_id text NOT NULL UNIQUE, org_name text NOT NULL CHECK (length(trim(org_name)) BETWEEN 2 AND 160),
     website text NOT NULL DEFAULT '' CHECK (length(website) <= 300), about text NOT NULL DEFAULT '' CHECK (length(about) <= 2000), created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS sch_links (sponsor_id bigint NOT NULL REFERENCES sch_sponsors(id), tenant_id text NOT NULL,
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','verified','rejected','suspended')), version int NOT NULL DEFAULT 1,
     note text NOT NULL DEFAULT '', decided_by text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (sponsor_id, tenant_id))`,
  `CREATE TABLE IF NOT EXISTS sch_programs (id bigserial PRIMARY KEY, sponsor_id bigint NOT NULL REFERENCES sch_sponsors(id), tenant_id text NOT NULL,
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120), amount_cents int NOT NULL CHECK (amount_cents BETWEEN 100 AND 10000000),
     awards int NOT NULL CHECK (awards BETWEEN 1 AND 1000), criteria text NOT NULL CHECK (length(criteria) BETWEEN 20 AND 4000), deadline date NOT NULL,
     renewable boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS sch_apps (id bigserial PRIMARY KEY, tenant_id text NOT NULL, program_id bigint NOT NULL REFERENCES sch_programs(id), student_id text NOT NULL,
     request_key text NOT NULL, statement text NOT NULL CHECK (length(statement) BETWEEN 50 AND 4000), consent_hash text NOT NULL CHECK (length(consent_hash) = 64),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','shortlisted','awarded','not_selected','withdrawn','accepted','declined_award','handed_off')),
     version int NOT NULL DEFAULT 1, note text NOT NULL DEFAULT '', handoff_by text, handoff_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, student_id, request_key), UNIQUE (program_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS sch_renewals (id bigserial PRIMARY KEY, app_id bigint NOT NULL REFERENCES sch_apps(id), term text NOT NULL CHECK (length(trim(term)) BETWEEN 2 AND 40),
     statement text NOT NULL CHECK (length(statement) BETWEEN 20 AND 2000), state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','approved','denied','handed_off')),
     version int NOT NULL DEFAULT 1, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (app_id, term))`,
  `CREATE TABLE IF NOT EXISTS sch_events (id bigserial PRIMARY KEY, tenant_id text, subject text NOT NULL, subject_id bigint NOT NULL, step text NOT NULL,
     to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION sch_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sch_events_append_only') THEN
       CREATE TRIGGER sch_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sch_events FOR EACH STATEMENT EXECUTE FUNCTION sch_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_set_office(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own scholarship-office access.'; END IF;
     IF p_on THEN INSERT INTO sch_office (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE sch_office SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'office', 0, 'set_office', CASE WHEN p_on THEN 'granted' ELSE 'revoked' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_sponsor_save(p_owner text, p_org text, p_web text, p_about text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE sid bigint; old text;
   BEGIN
     IF length(trim(coalesce(p_org, ''))) < 2 THEN RETURN 'Enter your organization name.'; END IF;
     SELECT org_name INTO old FROM sch_sponsors WHERE owner_id = p_owner FOR UPDATE;
     INSERT INTO sch_sponsors (owner_id, org_name, website, about) VALUES (p_owner, trim(p_org), trim(coalesce(p_web, '')), coalesce(p_about, ''))
       ON CONFLICT (owner_id) DO UPDATE SET org_name = EXCLUDED.org_name, website = EXCLUDED.website, about = EXCLUDED.about RETURNING id INTO sid;
     -- A renamed sponsor is re-checked: its verified links go back to requested and its programs close.
     IF old IS NOT NULL AND old <> trim(p_org) THEN
       UPDATE sch_links SET state = 'requested', version = version + 1, updated_at = now(), note = 'Organization renamed from ' || old WHERE sponsor_id = sid AND state = 'verified';
       UPDATE sch_programs SET active = false, version = version + 1 WHERE sponsor_id = sid AND active;
     END IF;
     INSERT INTO sch_events (subject, subject_id, step, to_state, actor_id, note) VALUES ('sponsor', sid, 'save', 'saved', p_owner, trim(p_org));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_link_request(p_owner text, p_tenant text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE sid bigint;
   BEGIN
     SELECT id INTO sid FROM sch_sponsors WHERE owner_id = p_owner;
     IF sid IS NULL THEN RETURN 'Save your organization details first.'; END IF;
     INSERT INTO sch_links (sponsor_id, tenant_id) VALUES (sid, p_tenant) ON CONFLICT (sponsor_id, tenant_id) DO UPDATE
       SET state = CASE WHEN sch_links.state = 'rejected' THEN 'requested' ELSE sch_links.state END, updated_at = now();
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'link', sid, 'request', 'requested', p_owner);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_link_decide(p_tenant text, p_actor text, p_sponsor bigint, p_decision text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l sch_links; nxt text; t text := trim(coalesce(p_note, ''));
   BEGIN
     IF NOT sch_is_office(p_tenant, p_actor) THEN RETURN 'Only the scholarship office verifies sponsors.'; END IF;
     IF EXISTS (SELECT 1 FROM sch_sponsors WHERE id = p_sponsor AND owner_id = p_actor) THEN RETURN 'You cannot verify your own organization.'; END IF;
     SELECT * INTO l FROM sch_links WHERE sponsor_id = p_sponsor AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'No request from this sponsor.'; END IF;
     IF l.version <> p_expected THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     nxt := CASE WHEN p_decision = 'verify' AND l.state IN ('requested','rejected','suspended') THEN 'verified'
       WHEN p_decision = 'reject' AND l.state = 'requested' THEN 'rejected' WHEN p_decision = 'suspend' AND l.state = 'verified' THEN 'suspended' ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That decision is not open now.'; END IF;
     IF length(t) < 10 THEN RETURN 'Record how you checked this sponsor, or why (10+ characters).'; END IF;
     UPDATE sch_links SET state = nxt, version = version + 1, note = t, decided_by = p_actor, updated_at = now() WHERE sponsor_id = p_sponsor AND tenant_id = p_tenant;
     IF nxt = 'suspended' THEN UPDATE sch_programs SET active = false, version = version + 1 WHERE sponsor_id = p_sponsor AND tenant_id = p_tenant; END IF;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'link', p_sponsor, p_decision, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_program(p_owner text, p_id bigint, p_tenant text, p_name text, p_amount int, p_awards int, p_criteria text, p_deadline date, p_renewable boolean, p_active boolean, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE sid bigint; pr sch_programs; held int; pid bigint := p_id;
   BEGIN
     SELECT id INTO sid FROM sch_sponsors WHERE owner_id = p_owner;
     IF sid IS NULL THEN RETURN 'Save your organization details first.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM sch_links WHERE sponsor_id = sid AND tenant_id = p_tenant AND state = 'verified') THEN RETURN 'That institution has not verified your organization yet.'; END IF;
     IF length(trim(coalesce(p_criteria, ''))) < 20 THEN RETURN 'Describe the eligibility criteria (20+ characters).'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO sch_programs (sponsor_id, tenant_id, name, amount_cents, awards, criteria, deadline, renewable, active)
         VALUES (sid, p_tenant, trim(p_name), p_amount, p_awards, trim(p_criteria), p_deadline, p_renewable, p_active) RETURNING id INTO pid;
     ELSE
       SELECT * INTO pr FROM sch_programs WHERE id = p_id AND sponsor_id = sid FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
       IF pr.version <> p_expected THEN RETURN 'This program changed since you opened it. Reload.'; END IF;
       IF pr.tenant_id <> p_tenant THEN RETURN 'A program stays with the institution it was created for.'; END IF;
       SELECT count(*) INTO held FROM sch_apps WHERE program_id = p_id AND state IN ('awarded','accepted','handed_off');
       IF p_awards < held THEN RETURN held || ' awards are already made; the number cannot go below that.'; END IF;
       IF held > 0 AND p_amount <> pr.amount_cents THEN RETURN 'The amount cannot change after awards are made.'; END IF;
       UPDATE sch_programs SET name = trim(p_name), amount_cents = p_amount, awards = p_awards, criteria = trim(p_criteria), deadline = p_deadline,
         renewable = p_renewable, active = p_active, version = version + 1 WHERE id = p_id;
     END IF;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'program', pid, 'program', CASE WHEN p_active THEN 'open' ELSE 'closed' END, p_owner, p_awards || ' awards');
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION sch_apply(p_tenant text, p_key text, p_student text, p_program bigint, p_statement text, p_consent text, p_today date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sch_apps; pr sch_programs; nid bigint;
   BEGIN
     SELECT * INTO pr FROM sch_programs WHERE id = p_program AND tenant_id = p_tenant;
     IF NOT FOUND THEN RETURN 'Scholarship not found.'; END IF;
     SELECT * INTO a FROM sch_apps WHERE tenant_id = p_tenant AND student_id = p_student AND request_key = p_key;
     IF FOUND THEN
       IF a.program_id = p_program AND a.statement = trim(p_statement) THEN RETURN 'replay:' || a.id; END IF;
       RETURN 'This application was already sent with different details.';
     END IF;
     IF NOT pr.active OR NOT EXISTS (SELECT 1 FROM sch_links WHERE sponsor_id = pr.sponsor_id AND tenant_id = p_tenant AND state = 'verified') THEN RETURN 'This scholarship is not open.'; END IF;
     IF p_today > pr.deadline THEN RETURN 'The deadline for this scholarship has passed.'; END IF;
     IF EXISTS (SELECT 1 FROM sch_sponsors WHERE id = pr.sponsor_id AND owner_id = p_student) THEN RETURN 'You cannot apply to your own scholarship.'; END IF;
     IF length(trim(coalesce(p_statement, ''))) < 50 THEN RETURN 'Write a statement (50+ characters).'; END IF;
     IF coalesce(length(p_consent), 0) <> 64 THEN RETURN 'Agree to what is shared with the sponsor.'; END IF;
     IF EXISTS (SELECT 1 FROM sch_apps WHERE program_id = p_program AND student_id = p_student) THEN RETURN 'You already applied to this scholarship.'; END IF;
     INSERT INTO sch_apps (tenant_id, program_id, student_id, request_key, statement, consent_hash) VALUES (p_tenant, p_program, p_student, p_key, trim(p_statement), p_consent) RETURNING id INTO nid;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'app', nid, 'apply', 'submitted', p_student);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_step(p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sch_apps; pr sch_programs; actor text; nxt text; held int; t text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO a FROM sch_apps WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     SELECT * INTO pr FROM sch_programs WHERE id = a.program_id;
     actor := CASE WHEN p_actor = a.student_id THEN 'student'
       WHEN EXISTS (SELECT 1 FROM sch_sponsors WHERE id = pr.sponsor_id AND owner_id = p_actor) THEN 'sponsor'
       WHEN sch_is_office(a.tenant_id, p_actor) THEN 'office' ELSE NULL END;
     IF actor IS NULL THEN RETURN 'You cannot act on this application.'; END IF;
     IF a.version <> p_expected THEN RETURN 'This application changed since you opened it. Reload.'; END IF;
     nxt := CASE
       WHEN p_step = 'shortlist' AND actor = 'sponsor' AND a.state = 'submitted' THEN 'shortlisted'
       WHEN p_step = 'award' AND actor = 'sponsor' AND a.state IN ('submitted','shortlisted') THEN 'awarded'
       WHEN p_step = 'not_select' AND actor = 'sponsor' AND a.state IN ('submitted','shortlisted') THEN 'not_selected'
       WHEN p_step = 'withdraw' AND actor = 'student' AND a.state IN ('submitted','shortlisted') THEN 'withdrawn'
       WHEN p_step = 'accept' AND actor = 'student' AND a.state = 'awarded' THEN 'accepted'
       WHEN p_step = 'decline_award' AND actor = 'student' AND a.state = 'awarded' THEN 'declined_award'
       WHEN p_step = 'handoff' AND actor = 'office' AND a.state = 'accepted' THEN 'handed_off'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step = 'award' THEN
       PERFORM 1 FROM sch_programs WHERE id = pr.id FOR UPDATE;
       IF NOT EXISTS (SELECT 1 FROM sch_links WHERE sponsor_id = pr.sponsor_id AND tenant_id = a.tenant_id AND state = 'verified') THEN RETURN 'Your organization is not verified at this institution.'; END IF;
       SELECT count(*) INTO held FROM sch_apps WHERE program_id = pr.id AND state IN ('awarded','accepted','handed_off');
       IF held >= pr.awards THEN RETURN 'All ' || pr.awards || ' awards for this scholarship are made.'; END IF;
     END IF;
     IF p_step IN ('not_select','handoff') AND length(t) < 5 THEN RETURN CASE WHEN p_step = 'handoff' THEN 'Record the aid term and reference for the hand-off (5+ characters).' ELSE 'Give a short reason (5+ characters).' END; END IF;
     UPDATE sch_apps SET state = nxt, version = version + 1, updated_at = now(), note = CASE WHEN t <> '' THEN t ELSE note END,
       handoff_by = CASE WHEN p_step = 'handoff' THEN p_actor ELSE handoff_by END, handoff_at = CASE WHEN p_step = 'handoff' THEN now() ELSE handoff_at END WHERE id = a.id;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (a.tenant_id, 'app', a.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_renew_request(p_student text, p_app bigint, p_term text, p_statement text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a sch_apps; nid bigint;
   BEGIN
     SELECT * INTO a FROM sch_apps WHERE id = p_app FOR UPDATE;
     IF NOT FOUND OR a.student_id <> p_student THEN RETURN 'Only the award holder can ask to renew.'; END IF;
     IF a.state <> 'handed_off' THEN RETURN 'Renewal opens once the award has been handed to financial aid.'; END IF;
     IF NOT (SELECT renewable FROM sch_programs WHERE id = a.program_id) THEN RETURN 'This scholarship is not renewable.'; END IF;
     IF length(trim(coalesce(p_statement, ''))) < 20 THEN RETURN 'Say how the year went and why to renew (20+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM sch_renewals WHERE app_id = p_app AND term = trim(p_term)) THEN RETURN 'You already asked to renew for this term.'; END IF;
     INSERT INTO sch_renewals (app_id, term, statement) VALUES (p_app, trim(p_term), trim(p_statement)) RETURNING id INTO nid;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (a.tenant_id, 'renewal', nid, 'request', 'requested', p_student, trim(p_term));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sch_renew_step(p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r sch_renewals; a sch_apps; sponsor boolean; office boolean; nxt text; t text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO r FROM sch_renewals WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Renewal not found.'; END IF;
     SELECT * INTO a FROM sch_apps WHERE id = r.app_id;
     IF p_actor = a.student_id THEN RETURN 'You cannot decide your own renewal.'; END IF;
     sponsor := EXISTS (SELECT 1 FROM sch_programs p JOIN sch_sponsors s ON s.id = p.sponsor_id WHERE p.id = a.program_id AND s.owner_id = p_actor);
     office := sch_is_office(a.tenant_id, p_actor);
     IF r.version <> p_expected THEN RETURN 'This renewal changed since you opened it. Reload.'; END IF;
     nxt := CASE WHEN p_step = 'approve' AND sponsor AND r.state = 'requested' THEN 'approved' WHEN p_step = 'deny' AND sponsor AND r.state = 'requested' THEN 'denied'
       WHEN p_step = 'handoff' AND office AND r.state = 'approved' THEN 'handed_off' ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step IN ('deny','handoff') AND length(t) < 5 THEN RETURN 'Add a short note (5+ characters).'; END IF;
     UPDATE sch_renewals SET state = nxt, version = version + 1, note = CASE WHEN t <> '' THEN t ELSE note END WHERE id = r.id;
     INSERT INTO sch_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (a.tenant_id, 'renewal', r.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
];
