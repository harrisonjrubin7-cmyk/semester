// Migration cne-001: continuing education (S-76 E02; mirrors lib/continuingRules.ts).
// Four outcomes stay separate columns that never overwrite each other: enrollment state (enrolled / withdrawn / cancelled by the
// institution), payment (unpaid / paid / sponsored / waived / not required), completion (in progress / completed / not completed)
// and refund (none / requested / approved / denied / issued). Table CHECKs keep them consistent: a completion needs an active
// enrollment, settled payment and a decider other than the learner; a credential exists only for a completed enrollment; a
// refund is never approved for a completed enrollment, never above what was paid, never by the learner or whoever asked for it.
// Roles (coordinator, authority, finance) are granted by an administrator, never self. Money is never moved here: payments and
// refunds are recorded with an external reference by finance staff. Expected-version on edits; append-only history.
export const CNE_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cne_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('coordinator','authority','finance')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS cne_offerings (id bigserial PRIMARY KEY, tenant_id text NOT NULL, code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{3,20}$'),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200), description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
     fee_cents int NOT NULL DEFAULT 0 CHECK (fee_cents BETWEEN 0 AND 10000000), capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 5000),
     prereqs text[] NOT NULL DEFAULT '{}', min_attendance int NOT NULL DEFAULT 80 CHECK (min_attendance BETWEEN 0 AND 100), open_to_public boolean NOT NULL DEFAULT false,
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','cancelled','closed')), cancel_reason text NOT NULL DEFAULT '',
     created_by text NOT NULL, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code),
     CHECK (NOT (code = ANY(prereqs))), CHECK (state <> 'cancelled' OR length(trim(cancel_reason)) >= 5))`,
  `CREATE TABLE IF NOT EXISTS cne_sessions (id bigserial PRIMARY KEY, offering_id bigint NOT NULL REFERENCES cne_offerings(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
     location text NOT NULL DEFAULT '' CHECK (length(location) <= 200), cancelled boolean NOT NULL DEFAULT false, version int NOT NULL DEFAULT 1, CHECK (ends_at > starts_at))`,
  `CREATE TABLE IF NOT EXISTS cne_enrollments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, offering_id bigint NOT NULL REFERENCES cne_offerings(id), learner_id text NOT NULL,
     state text NOT NULL DEFAULT 'enrolled' CHECK (state IN ('enrolled','withdrawn','cancelled_by_institution')),
     payment_state text NOT NULL CHECK (payment_state IN ('unpaid','paid','sponsored','waived','not_required')), paid_cents int NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
     payment_ref text NOT NULL DEFAULT '', sponsor text NOT NULL DEFAULT '', payment_by text,
     completion_state text NOT NULL DEFAULT 'in_progress' CHECK (completion_state IN ('in_progress','completed','not_completed')), completion_by text, completion_note text NOT NULL DEFAULT '',
     refund_state text NOT NULL DEFAULT 'none' CHECK (refund_state IN ('none','requested','approved','denied','issued')), refund_cents int, refund_requested_by text,
     refund_reason text NOT NULL DEFAULT '', refund_by text, refund_ref text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (payment_by IS NULL OR payment_by <> learner_id),
     CHECK (payment_state NOT IN ('paid','sponsored') OR (payment_by IS NOT NULL AND length(trim(payment_ref || sponsor)) > 0)),
     CHECK (completion_state = 'in_progress' OR (completion_by IS NOT NULL AND completion_by <> learner_id)),
     CHECK (completion_state <> 'completed' OR (state = 'enrolled' AND payment_state IN ('paid','sponsored','waived','not_required'))),
     CHECK (refund_state NOT IN ('approved','issued') OR (completion_state <> 'completed' AND refund_by IS NOT NULL AND refund_by <> learner_id AND refund_by <> coalesce(refund_requested_by, '')
            AND refund_cents IS NOT NULL AND refund_cents BETWEEN 0 AND paid_cents)),
     CHECK (refund_state <> 'issued' OR length(trim(refund_ref)) > 0))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cne_enrollments_one_active ON cne_enrollments (offering_id, learner_id) WHERE state = 'enrolled'`,
  `CREATE TABLE IF NOT EXISTS cne_attendance (enrollment_id bigint NOT NULL REFERENCES cne_enrollments(id), session_id bigint NOT NULL REFERENCES cne_sessions(id),
     present boolean NOT NULL, recorded_by text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (enrollment_id, session_id))`,
  `CREATE TABLE IF NOT EXISTS cne_credentials (id bigserial PRIMARY KEY, tenant_id text NOT NULL, enrollment_id bigint NOT NULL UNIQUE REFERENCES cne_enrollments(id), learner_id text NOT NULL,
     offering_code text NOT NULL, title text NOT NULL, verify_code text NOT NULL UNIQUE, issued_by text NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, revoked_by text, revoke_reason text NOT NULL DEFAULT '', CHECK (issued_by <> learner_id), CHECK (revoked_at IS NULL OR length(trim(revoke_reason)) >= 5))`,
  `CREATE TABLE IF NOT EXISTS cne_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref bigint, step text NOT NULL, actor_id text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cne_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cne_events_append_only') THEN
       CREATE TRIGGER cne_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cne_events FOR EACH STATEMENT EXECUTE FUNCTION cne_refuse_change();
     END IF;
   END $$`,
  // A credential is never deleted; only revocation fields may change.
  `CREATE OR REPLACE FUNCTION cne_credential_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF TG_OP = 'DELETE' OR NEW.enrollment_id <> OLD.enrollment_id OR NEW.learner_id <> OLD.learner_id OR NEW.verify_code <> OLD.verify_code OR NEW.issued_by <> OLD.issued_by
        OR NEW.offering_code <> OLD.offering_code THEN RAISE EXCEPTION 'CREDENTIAL_IMMUTABLE' USING ERRCODE = '42501'; END IF;
     RETURN NEW; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cne_credentials_guard') THEN
       CREATE TRIGGER cne_credentials_guard BEFORE UPDATE OR DELETE ON cne_credentials FOR EACH ROW EXECUTE FUNCTION cne_credential_guard();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM cne_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION cne_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own continuing-education access.'; END IF;
     IF p_role NOT IN ('coordinator','authority','finance') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO cne_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE cne_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     INSERT INTO cne_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'staff', CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user || ' ' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_offering_save(p_actor text, p_tenant text, p_id bigint, p_code text, p_title text, p_desc text, p_fee int, p_cap int, p_prereqs text[], p_min int, p_public boolean, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o cne_offerings; v_id bigint; v_code text := upper(trim(p_code));
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator manages offerings.'; END IF;
     IF v_code !~ '^[A-Z0-9-]{3,20}$' THEN RETURN 'Offering codes are 3–20 letters, digits or dashes.'; END IF;
     IF v_code = ANY(coalesce(p_prereqs, '{}')) THEN RETURN 'An offering cannot be its own prerequisite.'; END IF;
     IF p_id IS NULL THEN
       IF EXISTS (SELECT 1 FROM cne_offerings WHERE tenant_id = p_tenant AND code = v_code) THEN RETURN 'That offering code is already used.'; END IF;
       INSERT INTO cne_offerings (tenant_id, code, title, description, fee_cents, capacity, prereqs, min_attendance, open_to_public, created_by)
         VALUES (p_tenant, v_code, trim(p_title), coalesce(p_desc, ''), p_fee, p_cap, coalesce(p_prereqs, '{}'), p_min, p_public, p_actor) RETURNING id INTO v_id;
       INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'offering', v_id, 'create', p_actor, v_code);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF o.id IS NULL THEN RETURN 'Offering not found.'; END IF;
     IF o.version <> p_version THEN RETURN 'This offering changed since you opened it. Reload and try again.'; END IF;
     IF o.state <> 'draft' THEN RETURN 'Published offerings are not edited; cancel and republish, or reschedule sessions.'; END IF;
     UPDATE cne_offerings SET code = v_code, title = trim(p_title), description = coalesce(p_desc, ''), fee_cents = p_fee, capacity = p_cap, prereqs = coalesce(p_prereqs, '{}'),
       min_attendance = p_min, open_to_public = p_public, version = version + 1 WHERE id = p_id;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'offering', p_id, 'edit', p_actor);
     RETURN 'ok:' || p_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_session_add(p_actor text, p_tenant text, p_offering bigint, p_starts timestamptz, p_ends timestamptz, p_loc text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o cne_offerings; v_id bigint;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator schedules sessions.'; END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = p_offering AND tenant_id = p_tenant;
     IF o.id IS NULL THEN RETURN 'Offering not found.'; END IF;
     IF o.state IN ('cancelled','closed') THEN RETURN 'This offering is no longer running.'; END IF;
     IF p_ends <= p_starts THEN RETURN 'A session ends after it starts.'; END IF;
     INSERT INTO cne_sessions (offering_id, starts_at, ends_at, location) VALUES (p_offering, p_starts, p_ends, coalesce(p_loc, '')) RETURNING id INTO v_id;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'session', v_id, 'add', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_publish(p_actor text, p_tenant text, p_offering bigint, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o cne_offerings;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator publishes offerings.'; END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = p_offering AND tenant_id = p_tenant FOR UPDATE;
     IF o.id IS NULL THEN RETURN 'Offering not found.'; END IF;
     IF o.version <> p_version THEN RETURN 'This offering changed since you opened it. Reload and try again.'; END IF;
     IF o.state <> 'draft' THEN RETURN 'Only drafts are published.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM cne_sessions WHERE offering_id = p_offering AND NOT cancelled) THEN RETURN 'Schedule at least one session first.'; END IF;
     UPDATE cne_offerings SET state = 'published', version = version + 1 WHERE id = p_offering;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'offering', p_offering, 'publish', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_session_change(p_actor text, p_tenant text, p_session bigint, p_cancel boolean, p_starts timestamptz, p_ends timestamptz, p_loc text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s cne_sessions; o cne_offerings;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator changes sessions.'; END IF;
     SELECT * INTO s FROM cne_sessions WHERE id = p_session FOR UPDATE;
     SELECT * INTO o FROM cne_offerings WHERE id = s.offering_id AND tenant_id = p_tenant;
     IF s.id IS NULL OR o.id IS NULL THEN RETURN 'Session not found.'; END IF;
     IF s.version <> p_version THEN RETURN 'This session changed since you opened it. Reload and try again.'; END IF;
     IF s.cancelled THEN RETURN 'This session is already cancelled.'; END IF;
     IF EXISTS (SELECT 1 FROM cne_attendance WHERE session_id = p_session) THEN RETURN 'Attendance is recorded for this session; it can no longer change.'; END IF;
     IF p_cancel THEN UPDATE cne_sessions SET cancelled = true, version = version + 1 WHERE id = p_session;
     ELSE
       IF p_ends <= p_starts THEN RETURN 'A session ends after it starts.'; END IF;
       UPDATE cne_sessions SET starts_at = p_starts, ends_at = p_ends, location = coalesce(p_loc, location), version = version + 1 WHERE id = p_session;
     END IF;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'session', p_session, CASE WHEN p_cancel THEN 'cancel' ELSE 'reschedule' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_enroll(p_learner text, p_offering bigint, p_is_member boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o cne_offerings; e cne_enrollments; v_id bigint; v_missing text;
   BEGIN
     SELECT * INTO o FROM cne_offerings WHERE id = p_offering FOR UPDATE;
     IF o.id IS NULL OR o.state <> 'published' OR NOT (o.open_to_public OR p_is_member) THEN RETURN 'This offering is not open for enrollment.'; END IF;
     SELECT * INTO e FROM cne_enrollments WHERE offering_id = p_offering AND learner_id = p_learner AND state = 'enrolled';
     IF e.id IS NOT NULL THEN RETURN 'replay:' || e.id; END IF;
     IF (SELECT count(*) FROM cne_enrollments WHERE offering_id = p_offering AND state = 'enrolled') >= o.capacity THEN RETURN 'This offering is full.'; END IF;
     SELECT string_agg(x, ', ') INTO v_missing FROM unnest(o.prereqs) x
       WHERE NOT EXISTS (SELECT 1 FROM cne_credentials c WHERE c.tenant_id = o.tenant_id AND c.learner_id = p_learner AND c.offering_code = x AND c.revoked_at IS NULL);
     IF v_missing IS NOT NULL THEN RETURN 'Complete first: ' || v_missing || '.'; END IF;
     INSERT INTO cne_enrollments (tenant_id, offering_id, learner_id, payment_state) VALUES (o.tenant_id, p_offering, p_learner, CASE WHEN o.fee_cents = 0 THEN 'not_required' ELSE 'unpaid' END)
       RETURNING id INTO v_id;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (o.tenant_id, 'enrollment', v_id, 'enroll', p_learner);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_pay(p_actor text, p_tenant text, p_enrollment bigint, p_kind text, p_ref text, p_sponsor text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments; o cne_offerings;
   BEGIN
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Enrollment not found.'; END IF;
     IF p_kind = 'waived' AND NOT cne_has(p_tenant, p_actor, 'authority') THEN RETURN 'Only the continuing-education authority waives a fee.'; END IF;
     IF p_kind IN ('paid','sponsored') AND NOT cne_has(p_tenant, p_actor, 'finance') THEN RETURN 'Only finance records a payment or sponsorship.'; END IF;
     IF p_kind NOT IN ('paid','sponsored','waived') THEN RETURN 'Unknown payment kind.'; END IF;
     IF p_actor = e.learner_id THEN RETURN 'Someone other than the learner records their payment.'; END IF;
     IF e.version <> p_version THEN RETURN 'This enrollment changed since you opened it. Reload and try again.'; END IF;
     IF e.state <> 'enrolled' THEN RETURN 'This enrollment is not active.'; END IF;
     IF e.payment_state <> 'unpaid' THEN RETURN 'Payment is already settled for this enrollment.'; END IF;
     IF p_kind = 'paid' AND length(trim(coalesce(p_ref, ''))) < 4 THEN RETURN 'Record the payment reference from the finance system.'; END IF;
     IF p_kind = 'sponsored' AND length(trim(coalesce(p_sponsor, ''))) < 3 THEN RETURN 'Name the sponsor.'; END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = e.offering_id;
     UPDATE cne_enrollments SET payment_state = p_kind, paid_cents = CASE WHEN p_kind = 'waived' THEN 0 ELSE o.fee_cents END, payment_ref = trim(coalesce(p_ref, '')),
       sponsor = trim(coalesce(p_sponsor, '')), payment_by = p_actor, version = version + 1 WHERE id = p_enrollment;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'enrollment', p_enrollment, 'payment_' || p_kind, p_actor, coalesce(p_ref, p_sponsor, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_attend(p_actor text, p_tenant text, p_enrollment bigint, p_session bigint, p_present boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments; s cne_sessions;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator records attendance.'; END IF;
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND tenant_id = p_tenant;
     SELECT * INTO s FROM cne_sessions WHERE id = p_session;
     IF e.id IS NULL OR s.id IS NULL OR s.offering_id <> e.offering_id THEN RETURN 'That session is not part of this enrollment''s offering.'; END IF;
     IF s.cancelled THEN RETURN 'That session was cancelled.'; END IF;
     IF s.starts_at > now() THEN RETURN 'Attendance is recorded once the session has started.'; END IF;
     IF e.state <> 'enrolled' OR e.completion_state <> 'in_progress' THEN RETURN 'Attendance is recorded only for active, undecided enrollments.'; END IF;
     INSERT INTO cne_attendance (enrollment_id, session_id, present, recorded_by) VALUES (p_enrollment, p_session, p_present, p_actor)
       ON CONFLICT (enrollment_id, session_id) DO UPDATE SET present = EXCLUDED.present, recorded_by = p_actor, recorded_at = now();
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'attendance', p_enrollment, CASE WHEN p_present THEN 'present' ELSE 'absent' END, p_actor, p_session::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_attendance_pct(p_enrollment bigint) RETURNS int LANGUAGE sql STABLE AS $$
     SELECT CASE WHEN count(s.id) = 0 THEN 0 ELSE (100 * count(a.session_id) FILTER (WHERE a.present) / count(s.id))::int END
     FROM cne_enrollments e JOIN cne_sessions s ON s.offering_id = e.offering_id AND NOT s.cancelled
     LEFT JOIN cne_attendance a ON a.enrollment_id = e.id AND a.session_id = s.id WHERE e.id = p_enrollment $$`,
  `CREATE OR REPLACE FUNCTION cne_complete(p_actor text, p_tenant text, p_enrollment bigint, p_passed boolean, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments; o cne_offerings; v_pct int; v_cid bigint;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'authority') THEN RETURN 'Only the continuing-education authority decides completion.'; END IF;
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Enrollment not found.'; END IF;
     IF p_actor = e.learner_id THEN RETURN 'You cannot decide your own completion.'; END IF;
     IF e.version <> p_version THEN RETURN 'This enrollment changed since you opened it. Reload and try again.'; END IF;
     IF e.state <> 'enrolled' THEN RETURN 'This enrollment is not active.'; END IF;
     IF e.completion_state <> 'in_progress' THEN RETURN 'Completion is already decided.'; END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = e.offering_id;
     IF p_passed THEN
       IF e.payment_state = 'unpaid' THEN RETURN 'Payment is not settled.'; END IF;
       IF EXISTS (SELECT 1 FROM cne_sessions WHERE offering_id = o.id AND NOT cancelled AND starts_at > now()) THEN RETURN 'Sessions are still to come.'; END IF;
       v_pct := cne_attendance_pct(p_enrollment);
       IF v_pct < o.min_attendance THEN RETURN 'Attendance is ' || v_pct || '%; this offering requires ' || o.min_attendance || '%.'; END IF;
       UPDATE cne_enrollments SET completion_state = 'completed', completion_by = p_actor, completion_note = coalesce(p_note, ''), version = version + 1 WHERE id = p_enrollment;
       INSERT INTO cne_credentials (tenant_id, enrollment_id, learner_id, offering_code, title, verify_code, issued_by)
         VALUES (p_tenant, p_enrollment, e.learner_id, o.code, o.title, upper(substr(md5(random()::text || clock_timestamp()::text || p_enrollment::text), 1, 12)), p_actor) RETURNING id INTO v_cid;
       INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'enrollment', p_enrollment, 'completed', p_actor, 'credential ' || v_cid);
     ELSE
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the requirements were not met.'; END IF;
       UPDATE cne_enrollments SET completion_state = 'not_completed', completion_by = p_actor, completion_note = trim(p_note), version = version + 1 WHERE id = p_enrollment;
       INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'enrollment', p_enrollment, 'not_completed', p_actor);
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_withdraw(p_learner text, p_enrollment bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments; v_started boolean;
   BEGIN
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND learner_id = p_learner FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Enrollment not found.'; END IF;
     IF e.state <> 'enrolled' OR e.completion_state <> 'in_progress' THEN RETURN 'This enrollment can no longer be withdrawn.'; END IF;
     v_started := EXISTS (SELECT 1 FROM cne_sessions WHERE offering_id = e.offering_id AND NOT cancelled AND starts_at <= now());
     UPDATE cne_enrollments SET state = 'withdrawn', version = version + 1,
       refund_state = CASE WHEN e.paid_cents > 0 AND NOT v_started THEN 'requested' ELSE refund_state END,
       refund_cents = CASE WHEN e.paid_cents > 0 AND NOT v_started THEN e.paid_cents ELSE refund_cents END,
       refund_requested_by = CASE WHEN e.paid_cents > 0 AND NOT v_started THEN p_learner ELSE refund_requested_by END,
       refund_reason = CASE WHEN e.paid_cents > 0 AND NOT v_started THEN 'Withdrew before the first session' ELSE refund_reason END
       WHERE id = p_enrollment;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (e.tenant_id, 'enrollment', p_enrollment, 'withdraw', p_learner);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_refund_request(p_learner text, p_enrollment bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments;
   BEGIN
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND learner_id = p_learner FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Enrollment not found.'; END IF;
     IF e.paid_cents = 0 THEN RETURN 'Nothing was paid for this enrollment.'; END IF;
     IF e.completion_state = 'completed' THEN RETURN 'A completed enrollment with a credential is not refunded.'; END IF;
     IF e.refund_state NOT IN ('none','denied') THEN RETURN 'A refund is already in progress.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Explain the refund request.'; END IF;
     UPDATE cne_enrollments SET refund_state = 'requested', refund_cents = paid_cents, refund_requested_by = p_learner, refund_reason = trim(p_reason), refund_by = NULL, version = version + 1 WHERE id = p_enrollment;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id) VALUES (e.tenant_id, 'enrollment', p_enrollment, 'refund_request', p_learner);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_cancel_offering(p_actor text, p_tenant text, p_offering bigint, p_reason text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o cne_offerings;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'coordinator') THEN RETURN 'Only a continuing-education coordinator cancels offerings.'; END IF;
     SELECT * INTO o FROM cne_offerings WHERE id = p_offering AND tenant_id = p_tenant FOR UPDATE;
     IF o.id IS NULL THEN RETURN 'Offering not found.'; END IF;
     IF o.version <> p_version THEN RETURN 'This offering changed since you opened it. Reload and try again.'; END IF;
     IF o.state NOT IN ('draft','published') THEN RETURN 'This offering is already closed or cancelled.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Give the reason learners will see.'; END IF;
     IF EXISTS (SELECT 1 FROM cne_enrollments WHERE offering_id = p_offering AND completion_state = 'completed') THEN RETURN 'Learners have already completed this offering; close it instead.'; END IF;
     UPDATE cne_offerings SET state = 'cancelled', cancel_reason = trim(p_reason), version = version + 1 WHERE id = p_offering;
     UPDATE cne_enrollments SET state = 'cancelled_by_institution', version = version + 1,
       refund_state = CASE WHEN paid_cents > 0 AND refund_state IN ('none','denied') THEN 'requested' ELSE refund_state END,
       refund_cents = CASE WHEN paid_cents > 0 AND refund_state IN ('none','denied') THEN paid_cents ELSE refund_cents END,
       refund_requested_by = CASE WHEN paid_cents > 0 AND refund_state IN ('none','denied') THEN 'institution-cancellation' ELSE refund_requested_by END,
       refund_reason = CASE WHEN paid_cents > 0 AND refund_state IN ('none','denied') THEN 'Offering cancelled: ' || trim(p_reason) ELSE refund_reason END
       WHERE offering_id = p_offering AND state = 'enrolled';
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'offering', p_offering, 'cancel', p_actor, trim(p_reason));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_refund_decide(p_actor text, p_tenant text, p_enrollment bigint, p_step text, p_cents int, p_text text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e cne_enrollments;
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'finance') THEN RETURN 'Only finance decides refunds.'; END IF;
     SELECT * INTO e FROM cne_enrollments WHERE id = p_enrollment AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Enrollment not found.'; END IF;
     IF e.version <> p_version THEN RETURN 'This enrollment changed since you opened it. Reload and try again.'; END IF;
     IF p_actor = e.learner_id OR p_actor = e.refund_requested_by THEN RETURN 'Someone other than the learner or requester decides this refund.'; END IF;
     IF p_step = 'approve' THEN
       IF e.refund_state <> 'requested' THEN RETURN 'No refund request is waiting.'; END IF;
       IF e.completion_state = 'completed' THEN RETURN 'A completed enrollment with a credential is not refunded.'; END IF;
       IF p_cents IS NULL OR p_cents < 0 OR p_cents > e.paid_cents THEN RETURN 'A refund is between zero and the amount paid.'; END IF;
       UPDATE cne_enrollments SET refund_state = 'approved', refund_cents = p_cents, refund_by = p_actor, version = version + 1 WHERE id = p_enrollment;
     ELSIF p_step = 'deny' THEN
       IF e.refund_state <> 'requested' THEN RETURN 'No refund request is waiting.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Say why the refund is denied.'; END IF;
       UPDATE cne_enrollments SET refund_state = 'denied', refund_by = p_actor, refund_reason = refund_reason || ' | Denied: ' || trim(p_text), version = version + 1 WHERE id = p_enrollment;
     ELSIF p_step = 'issued' THEN
       IF e.refund_state <> 'approved' THEN RETURN 'Approve the refund first.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 4 THEN RETURN 'Record the refund reference from the finance system.'; END IF;
       UPDATE cne_enrollments SET refund_state = 'issued', refund_ref = trim(p_text), version = version + 1 WHERE id = p_enrollment;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'enrollment', p_enrollment, 'refund_' || p_step, p_actor, coalesce(p_text, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cne_revoke(p_actor text, p_tenant text, p_credential bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT cne_has(p_tenant, p_actor, 'authority') THEN RETURN 'Only the continuing-education authority revokes credentials.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Give the reason for revocation.'; END IF;
     UPDATE cne_credentials SET revoked_at = now(), revoked_by = p_actor, revoke_reason = trim(p_reason) WHERE id = p_credential AND tenant_id = p_tenant AND revoked_at IS NULL;
     IF NOT FOUND THEN RETURN 'Credential not found or already revoked.'; END IF;
     INSERT INTO cne_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'credential', p_credential, 'revoke', p_actor, trim(p_reason));
     RETURN NULL;
   END $$`,
];
