// E25 Research Ethics and Protocol Review: the ethics committee workflow, on the curriculum-
// committee review pattern. A researcher submits a protocol (optionally against an E23 project);
// committee members record individual reviews; the chair decides — but never on a protocol with
// fewer than two recorded reviews, and never on their own: nobody reviews or decides a protocol
// they submitted (conflict of interest). Approvals carry an expiry date; conditional approvals
// carry the conditions. Reviews and events are append-only.
export const ETH_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS eth_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('member','chair')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS eth_protocols (id bigserial PRIMARY KEY, tenant_id text NOT NULL, project_id bigint REFERENCES rsa_requests(id),
     submitter_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160),
     summary text NOT NULL CHECK (length(trim(summary)) >= 50), subjects text NOT NULL CHECK (subjects IN ('human','animal','both','none')),
     risk text NOT NULL CHECK (risk IN ('minimal','greater')), consent text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','under_review','approved','conditions','declined','closed')),
     expires_on date, conditions_text text NOT NULL DEFAULT '', decision_note text NOT NULL DEFAULT '', decided_by text, decided_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (state NOT IN ('approved','conditions') OR expires_on IS NOT NULL),
     CHECK (state <> 'conditions' OR length(trim(conditions_text)) >= 10),
     CHECK (subjects = 'none' OR length(trim(consent)) >= 20))`,
  `CREATE TABLE IF NOT EXISTS eth_reviews (id bigserial PRIMARY KEY, protocol_id bigint NOT NULL REFERENCES eth_protocols(id), reviewer_id text NOT NULL,
     position text NOT NULL CHECK (position IN ('approve','conditions','decline')), note text NOT NULL CHECK (length(trim(note)) >= 5),
     at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE (protocol_id, reviewer_id))`,
  `CREATE TABLE IF NOT EXISTS eth_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, protocol_id bigint NOT NULL, actor_id text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION eth_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'eth_events_append_only') THEN
       CREATE TRIGGER eth_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON eth_events FOR EACH STATEMENT EXECUTE FUNCTION eth_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'eth_reviews_append_only') THEN
       CREATE TRIGGER eth_reviews_append_only BEFORE UPDATE OR DELETE ON eth_reviews FOR EACH ROW EXECUTE FUNCTION eth_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_role(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT role FROM eth_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE OR REPLACE FUNCTION eth_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own ethics committee access.'; END IF;
     IF p_role NOT IN ('member','chair') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO eth_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE eth_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_submit(p_actor text, p_tenant text, p_project_code text, p_title text, p_summary text, p_subjects text, p_risk text, p_consent text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; v_proj bigint;
   BEGIN
     IF p_subjects <> 'none' AND length(trim(coalesce(p_consent, ''))) < 20 THEN RETURN 'Describe how consent is obtained (or why it is waived) — at least a sentence.'; END IF;
     IF p_project_code IS NOT NULL AND trim(p_project_code) <> '' THEN
       SELECT id INTO v_proj FROM rsa_requests WHERE tenant_id = p_tenant AND project_code = upper(trim(p_project_code)) AND state IN ('approved','closed');
       IF v_proj IS NULL THEN RETURN 'That project code is not a registered project here.'; END IF;
     END IF;
     INSERT INTO eth_protocols (tenant_id, project_id, submitter_id, title, summary, subjects, risk, consent)
       VALUES (p_tenant, v_proj, p_actor, trim(p_title), trim(p_summary), p_subjects, p_risk, coalesce(p_consent, '')) RETURNING id INTO v_id;
     INSERT INTO eth_events (tenant_id, protocol_id, actor_id, step) VALUES (p_tenant, v_id, p_actor, 'submit');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_begin(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF eth_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only the ethics committee opens a review.'; END IF;
     SELECT state INTO st FROM eth_protocols WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Protocol not found.'; END IF;
     IF st <> 'submitted' THEN RETURN 'Only a submitted protocol can move to review.'; END IF;
     UPDATE eth_protocols SET state = 'under_review', updated_at = now() WHERE id = p_id;
     INSERT INTO eth_events (tenant_id, protocol_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'begin_review');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_review(p_actor text, p_tenant text, p_id bigint, p_position text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr eth_protocols;
   BEGIN
     IF eth_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only ethics committee members record reviews.'; END IF;
     SELECT * INTO pr FROM eth_protocols WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND THEN RETURN 'Protocol not found.'; END IF;
     IF pr.state <> 'under_review' THEN RETURN 'Reviews are recorded while a protocol is under review.'; END IF;
     IF pr.submitter_id = p_actor THEN RETURN 'You submitted this protocol, so you cannot review it — that is a conflict of interest.'; END IF;
     IF EXISTS (SELECT 1 FROM eth_reviews WHERE protocol_id = p_id AND reviewer_id = p_actor) THEN RETURN 'You have already recorded a review of this protocol.'; END IF;
     INSERT INTO eth_reviews (protocol_id, reviewer_id, position, note) VALUES (p_id, p_actor, p_position, trim(p_note));
     INSERT INTO eth_events (tenant_id, protocol_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'review', p_position);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_decide(p_actor text, p_tenant text, p_id bigint, p_decision text, p_note text, p_expires date, p_conditions text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr eth_protocols; n int;
   BEGIN
     IF eth_role(p_tenant, p_actor) IS DISTINCT FROM 'chair' THEN RETURN 'Only the committee chair renders the decision.'; END IF;
     SELECT * INTO pr FROM eth_protocols WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Protocol not found.'; END IF;
     IF pr.state <> 'under_review' THEN RETURN 'Only a protocol under review can be decided.'; END IF;
     IF pr.submitter_id = p_actor THEN RETURN 'You submitted this protocol, so the chair cannot be you for this one — another chair must decide it.'; END IF;
     SELECT count(*) INTO n FROM eth_reviews WHERE protocol_id = p_id;
     IF n < 2 THEN RETURN 'The committee needs at least two recorded reviews before a decision.'; END IF;
     IF p_decision = 'approve' THEN
       IF p_expires IS NULL OR p_expires <= current_date THEN RETURN 'Give the approval an expiry date in the future.'; END IF;
       UPDATE eth_protocols SET state = 'approved', expires_on = p_expires, conditions_text = '', decision_note = left(coalesce(p_note, ''), 500), decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_id;
     ELSIF p_decision = 'conditions' THEN
       IF p_expires IS NULL OR p_expires <= current_date THEN RETURN 'Give the approval an expiry date in the future.'; END IF;
       IF length(trim(coalesce(p_conditions, ''))) < 10 THEN RETURN 'Write out the conditions of the approval.'; END IF;
       UPDATE eth_protocols SET state = 'conditions', expires_on = p_expires, conditions_text = trim(p_conditions), decision_note = left(coalesce(p_note, ''), 500), decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_id;
     ELSIF p_decision = 'decline' THEN
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why the protocol is declined, in a few words.'; END IF;
       UPDATE eth_protocols SET state = 'declined', decision_note = left(p_note, 500), decided_by = p_actor, decided_at = now(), updated_at = now() WHERE id = p_id;
     ELSE RETURN 'Unknown decision.'; END IF;
     INSERT INTO eth_events (tenant_id, protocol_id, actor_id, step, note) VALUES (p_tenant, p_id, p_actor, 'decide', p_decision);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION eth_close(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr eth_protocols;
   BEGIN
     SELECT * INTO pr FROM eth_protocols WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Protocol not found.'; END IF;
     IF pr.submitter_id <> p_actor AND eth_role(p_tenant, p_actor) IS NULL THEN RETURN 'Only the submitter or the committee can close a protocol.'; END IF;
     IF pr.state NOT IN ('approved','conditions') THEN RETURN 'Only an approved protocol can be closed.'; END IF;
     UPDATE eth_protocols SET state = 'closed', updated_at = now() WHERE id = p_id;
     INSERT INTO eth_events (tenant_id, protocol_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, 'close');
     RETURN NULL;
   END $$`,
];
