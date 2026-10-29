// Migration gas-001: graduate assistantships (role app "Graduate Student": funding, assistantships).
// - Faculty or staff post an assistantship (teaching, research or graduate assistant) for a term: 5 to 20 hours a week, the
//   stipend per term and whether tuition is remitted. Graduate students apply with a short statement.
// - The poster offers it to an applicant; the offer copies the posting's terms (frozen with a hash). The student accepts or
//   declines. Accepting is refused if the student's accepted and confirmed appointments for that term would exceed 20 hours.
// - A graduate-office officer (appointed by an administrator, never self, never the poster or the student) confirms the
//   appointment; only confirmed appointments count as official funding. The office can end one early with a reason.
// - No money moves here: stipends and remission are recorded terms for payroll and the bursar, not payments.
// Students see their own applications and appointments; posters see their postings' applicants; the office sees the queue.
export const GAS_KINDS = ['teaching', 'research', 'graduate'] as const;
export const GAS_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS gas_officers (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS gas_postings (id bigserial PRIMARY KEY, tenant_id text NOT NULL, poster_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('teaching', 'research', 'graduate')),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 4 AND 140), unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 2 AND 120), term text NOT NULL CHECK (length(trim(term)) BETWEEN 3 AND 40),
     hours numeric NOT NULL CHECK (hours BETWEEN 5 AND 20), stipend_minor bigint NOT NULL CHECK (stipend_minor >= 0), tuition_remission boolean NOT NULL,
     duties text NOT NULL CHECK (length(trim(duties)) BETWEEN 20 AND 4000), openings int NOT NULL CHECK (openings BETWEEN 1 AND 50),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')), created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS gas_applications (id bigserial PRIMARY KEY, posting_id bigint NOT NULL REFERENCES gas_postings(id), student_id text NOT NULL,
     statement text NOT NULL CHECK (length(trim(statement)) BETWEEN 20 AND 2000),
     state text NOT NULL DEFAULT 'applied' CHECK (state IN ('applied', 'offered', 'accepted', 'declined', 'not_selected', 'withdrawn', 'confirmed', 'ended')),
     offer jsonb, offer_hash text, decided_by text, end_reason text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (posting_id, student_id), CHECK (offer IS NULL OR offer_hash = md5(offer::text)),
     CHECK (state NOT IN ('offered', 'accepted', 'confirmed', 'ended') OR offer IS NOT NULL), CHECK (state <> 'confirmed' OR decided_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS gas_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text NOT NULL, actor_id text NOT NULL, step text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION gas_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS gas_events_append_only ON gas_events`,
  `CREATE TRIGGER gas_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON gas_events FOR EACH STATEMENT EXECUTE FUNCTION gas_refuse_change()`,
  `CREATE OR REPLACE FUNCTION gas_offer_fixed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF OLD.offer IS NOT NULL AND NEW.offer IS DISTINCT FROM OLD.offer THEN RAISE EXCEPTION 'OFFER_FIXED' USING ERRCODE = 'check_violation'; END IF;
     RETURN NEW; END $$`,
  `DROP TRIGGER IF EXISTS gas_applications_offer_fixed ON gas_applications`,
  `CREATE TRIGGER gas_applications_offer_fixed BEFORE UPDATE ON gas_applications FOR EACH ROW EXECUTE FUNCTION gas_offer_fixed()`,
  `CREATE OR REPLACE FUNCTION gas_log(p_tenant text, p_ref text, p_actor text, p_step text, p_note text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO gas_events (tenant_id, ref, actor_id, step, note) VALUES (p_tenant, p_ref, p_actor, p_step, coalesce(p_note, '')) $$`,
  `CREATE OR REPLACE FUNCTION gas_is_officer(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM gas_officers WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  /** Hours a student already holds in a term: accepted and confirmed appointments. */
  `CREATE OR REPLACE FUNCTION gas_hours(p_tenant text, p_student text, p_term text) RETURNS numeric LANGUAGE sql STABLE AS $$
     SELECT coalesce(sum((a.offer->>'hours')::numeric), 0) FROM gas_applications a JOIN gas_postings p ON p.id = a.posting_id
     WHERE p.tenant_id = p_tenant AND a.student_id = p_student AND lower(p.term) = lower(p_term) AND a.state IN ('accepted', 'confirmed') $$`,
  `CREATE OR REPLACE FUNCTION gas_set_officer(p_tenant text, p_actor text, p_is_admin boolean, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator appoints graduate-office officers.'; END IF;
     IF p_user = p_actor THEN RETURN 'Another administrator appoints you.'; END IF;
     IF p_on THEN INSERT INTO gas_officers (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_actor)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by, granted_at = now();
     ELSE UPDATE gas_officers SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     PERFORM gas_log(p_tenant, 'officer:' || p_user, p_actor, CASE WHEN p_on THEN 'appoint' ELSE 'remove' END, '');
     RETURN 'ok:' || p_user;
   END $$`,
  `CREATE OR REPLACE FUNCTION gas_post(p_tenant text, p_actor text, p_is_staff boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; BEGIN
     IF NOT p_is_staff THEN RETURN 'Only faculty and staff post assistantships.'; END IF;
     IF coalesce(p->>'kind', '') NOT IN ('teaching', 'research', 'graduate') THEN RETURN 'Choose teaching, research or graduate assistant.'; END IF;
     IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 4 AND 140 THEN RETURN 'Give it a title.'; END IF;
     IF length(trim(coalesce(p->>'unit', ''))) NOT BETWEEN 2 AND 120 THEN RETURN 'Name the department or lab.'; END IF;
     IF length(trim(coalesce(p->>'term', ''))) NOT BETWEEN 3 AND 40 THEN RETURN 'Choose the term.'; END IF;
     IF coalesce((p->>'hours')::numeric, 0) NOT BETWEEN 5 AND 20 THEN RETURN 'Hours must be 5 to 20 a week.'; END IF;
     IF coalesce((p->>'stipendMinor')::bigint, -1) < 0 THEN RETURN 'Enter the stipend for the term (0 if unpaid credit).'; END IF;
     IF length(trim(coalesce(p->>'duties', ''))) NOT BETWEEN 20 AND 4000 THEN RETURN 'Describe the duties (20+ characters).'; END IF;
     IF coalesce((p->>'openings')::int, 0) NOT BETWEEN 1 AND 50 THEN RETURN 'Openings must be 1 to 50.'; END IF;
     INSERT INTO gas_postings (tenant_id, poster_id, kind, title, unit, term, hours, stipend_minor, tuition_remission, duties, openings)
       VALUES (p_tenant, p_actor, p->>'kind', trim(p->>'title'), trim(p->>'unit'), trim(p->>'term'), (p->>'hours')::numeric, (p->>'stipendMinor')::bigint,
         coalesce((p->>'tuitionRemission')::boolean, false), trim(p->>'duties'), (p->>'openings')::int) RETURNING id INTO v_id;
     PERFORM gas_log(p_tenant, 'posting:' || v_id, p_actor, 'post', trim(p->>'title'));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION gas_apply(p_tenant text, p_actor text, p_is_grad boolean, p_posting bigint, p_statement text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o gas_postings%ROWTYPE; v_id bigint; BEGIN
     IF NOT p_is_grad THEN RETURN 'Assistantships are for graduate students.'; END IF;
     SELECT * INTO o FROM gas_postings WHERE id = p_posting AND tenant_id = p_tenant;
     IF NOT FOUND OR o.state <> 'open' THEN RETURN 'This assistantship is not open.'; END IF;
     IF o.poster_id = p_actor THEN RETURN 'You posted this one.'; END IF;
     IF length(trim(coalesce(p_statement, ''))) NOT BETWEEN 20 AND 2000 THEN RETURN 'Write a short statement (20 to 2000 characters).'; END IF;
     IF EXISTS (SELECT 1 FROM gas_applications WHERE posting_id = o.id AND student_id = p_actor) THEN RETURN 'You already applied.'; END IF;
     INSERT INTO gas_applications (posting_id, student_id, statement) VALUES (o.id, p_actor, trim(p_statement)) RETURNING id INTO v_id;
     PERFORM gas_log(p_tenant, 'application:' || v_id, p_actor, 'apply', '');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION gas_step(p_tenant text, p_actor text, p_step text, p_id bigint, p_version int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a gas_applications%ROWTYPE; o gas_postings%ROWTYPE; v_offer jsonb; BEGIN
     SELECT * INTO a FROM gas_applications WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     SELECT * INTO o FROM gas_postings WHERE id = a.posting_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     IF p_version IS DISTINCT FROM a.version THEN RETURN 'This application changed since you opened it. Reload and try again.'; END IF;
     IF p_step IN ('offer', 'pass') THEN
       IF p_actor <> o.poster_id THEN RETURN 'Only the person who posted it makes offers.'; END IF;
       IF a.state <> 'applied' THEN RETURN 'This application was already answered.'; END IF;
       IF p_step = 'offer' THEN
         IF (SELECT count(*) FROM gas_applications WHERE posting_id = o.id AND state IN ('offered', 'accepted', 'confirmed')) >= o.openings THEN RETURN 'All openings are already offered or filled.'; END IF;
         v_offer := jsonb_build_object('title', o.title, 'kind', o.kind, 'unit', o.unit, 'term', o.term, 'hours', o.hours, 'stipendMinor', o.stipend_minor, 'tuitionRemission', o.tuition_remission, 'duties', o.duties);
         UPDATE gas_applications SET state = 'offered', offer = v_offer, offer_hash = md5(v_offer::text) WHERE id = a.id;
       ELSE UPDATE gas_applications SET state = 'not_selected' WHERE id = a.id; END IF;
     ELSIF p_step IN ('accept', 'decline') THEN
       IF p_actor <> a.student_id THEN RETURN 'Only the student answers an offer.'; END IF;
       IF a.state <> 'offered' THEN RETURN 'There is no open offer.'; END IF;
       IF p_step = 'accept' AND gas_hours(p_tenant, a.student_id, o.term) + (a.offer->>'hours')::numeric > 20 THEN
         RETURN 'Accepting would put you over 20 hours a week in ' || o.term || ' (you hold ' || gas_hours(p_tenant, a.student_id, o.term) || ').'; END IF;
       UPDATE gas_applications SET state = CASE WHEN p_step = 'accept' THEN 'accepted' ELSE 'declined' END WHERE id = a.id;
     ELSIF p_step = 'withdraw' THEN
       IF p_actor <> a.student_id THEN RETURN 'Only the student withdraws.'; END IF;
       IF a.state <> 'applied' THEN RETURN 'Only a pending application can be withdrawn.'; END IF;
       UPDATE gas_applications SET state = 'withdrawn' WHERE id = a.id;
     ELSIF p_step IN ('confirm', 'end') THEN
       IF NOT gas_is_officer(p_tenant, p_actor) THEN RETURN 'Confirming appointments needs a graduate-office officer.'; END IF;
       IF p_actor IN (a.student_id, o.poster_id) THEN RETURN 'Someone other than the student and the hiring person confirms.'; END IF;
       IF p_step = 'confirm' AND a.state <> 'accepted' THEN RETURN 'Only an accepted offer can be confirmed.'; END IF;
       IF p_step = 'end' AND a.state <> 'confirmed' THEN RETURN 'Only a confirmed appointment can be ended.'; END IF;
       IF p_step = 'end' AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record why the appointment ends early (10+ characters).'; END IF;
       UPDATE gas_applications SET state = CASE WHEN p_step = 'confirm' THEN 'confirmed' ELSE 'ended' END, decided_by = p_actor, end_reason = trim(coalesce(p_note, '')) WHERE id = a.id;
     ELSE RETURN 'Unknown step.'; END IF;
     UPDATE gas_applications SET version = version + 1 WHERE id = a.id;
     PERFORM gas_log(p_tenant, 'application:' || a.id, p_actor, p_step, coalesce(p_note, ''));
     RETURN 'ok:' || a.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION gas_close(p_tenant text, p_actor text, p_posting bigint) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
     UPDATE gas_postings SET state = 'closed' WHERE id = p_posting AND tenant_id = p_tenant AND poster_id = p_actor AND state = 'open';
     IF NOT FOUND THEN RETURN 'Only the poster closes an open posting.'; END IF;
     UPDATE gas_applications SET state = 'not_selected', version = version + 1 WHERE posting_id = p_posting AND state = 'applied';
     PERFORM gas_log(p_tenant, 'posting:' || p_posting, p_actor, 'close', '');
     RETURN 'ok:' || p_posting;
   END $$`,
];
