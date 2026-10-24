// Migration prv-001: records-rights requests and periodic access reviews (APP-013 Institution Console).
// Records rights: a student asks to inspect, amend or restrict their education record (or opt out of directory
// information). The institution's records-privacy office (prv_staff, granted by an administrator, never self) answers
// within a 45-day clock. An amendment denial must tell the student they may request a hearing. Handlers never decide
// their own request. Nothing here deletes or changes an academic record; fulfilment is recorded, the change itself goes
// through the owning workflow (registrar, grade change) with its own approvals.
// Access reviews: an administrator opens a review that snapshots every membership and its roles; each line is certified
// "keep" or "remove" by an administrator who is not the subject; a review closes only when every line is decided.
// Removal is applied through the existing membership suspension, which already refuses self-changes.
// One function call = one transaction; events are append-only; the tenant always comes from the caller's membership.
export const PRV_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS prv_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS prv_requests (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, requester_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('inspect', 'amend', 'directory_optout', 'restrict_disclosure')),
     detail text NOT NULL CHECK (length(detail) BETWEEN 10 AND 4000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'acknowledged', 'fulfilled', 'denied', 'withdrawn')),
     due_at timestamptz NOT NULL DEFAULT now() + interval '45 days', handled_by text, handled_at timestamptz, outcome_note text,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), CHECK (handled_by IS NULL OR handled_by <> requester_id))`,
  `CREATE TABLE IF NOT EXISTS arv_reviews (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, opened_by text NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')), closed_by text, closed_at timestamptz)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS arv_one_open ON arv_reviews (tenant_id) WHERE state = 'open'`,
  `CREATE TABLE IF NOT EXISTS arv_lines (review_id text NOT NULL REFERENCES arv_reviews(id), membership_id text NOT NULL, subject_id text NOT NULL, subject_name text NOT NULL,
     roles text[] NOT NULL, status text NOT NULL, decision text CHECK (decision IN ('keep', 'remove')), decided_by text, decided_at timestamptz, note text,
     PRIMARY KEY (review_id, membership_id), CHECK (decided_by IS NULL OR decided_by <> subject_id))`,
  `CREATE TABLE IF NOT EXISTS prv_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION prv_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS prv_events_append_only ON prv_events`,
  `CREATE TRIGGER prv_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prv_events FOR EACH STATEMENT EXECUTE FUNCTION prv_refuse_change()`,
  `CREATE OR REPLACE FUNCTION prv_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM prv_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION prv_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'You cannot change your own records-privacy access.'; END IF;
     IF p_on THEN
       INSERT INTO prv_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE
       UPDATE prv_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     END IF;
     INSERT INTO prv_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'office_granted' ELSE 'office_revoked' END, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_submit(p_user text, p_tenant text, p_id text, p_kind text, p_detail text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM prv_requests WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_detail, ''))) < 10 THEN RETURN 'Say which record and what you are asking for (10+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM prv_requests WHERE tenant_id = p_tenant AND requester_id = p_user AND kind = p_kind AND state IN ('submitted', 'acknowledged')) THEN
       RETURN 'You already have an open request of this kind.'; END IF;
     INSERT INTO prv_requests (id, tenant_id, requester_id, kind, detail) VALUES (p_id, p_tenant, p_user, p_kind, trim(p_detail));
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_id, p_user, 'submitted', p_kind);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_withdraw(p_user text, p_tenant text, p_id text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prv_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM prv_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.requester_id <> p_user THEN RETURN 'Request not found.'; END IF;
     IF r.state NOT IN ('submitted', 'acknowledged') THEN RETURN 'This request is closed.'; END IF;
     UPDATE prv_requests SET state = 'withdrawn', version = version + 1 WHERE id = p_id;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_user, 'withdrawn');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_handle(p_actor text, p_tenant text, p_id text, p_version int, p_decision text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prv_requests%ROWTYPE; v_note text := trim(coalesce(p_note, ''));
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office handles these requests.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.requester_id = p_actor THEN RETURN 'You cannot handle your own request.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     IF r.state NOT IN ('submitted', 'acknowledged') THEN RETURN 'This request is closed.'; END IF;
     IF p_decision = 'acknowledge' THEN
       IF r.state = 'acknowledged' THEN RETURN 'Already acknowledged.'; END IF;
       UPDATE prv_requests SET state = 'acknowledged', handled_by = p_actor, version = version + 1 WHERE id = p_id;
     ELSIF p_decision IN ('fulfill', 'deny') THEN
       IF length(v_note) < 10 THEN RETURN 'Explain the outcome to the student (10+ characters).'; END IF;
       IF p_decision = 'deny' AND r.kind = 'amend' THEN v_note := v_note || ' You may request a hearing to challenge this decision.'; END IF;
       IF p_decision = 'deny' AND r.kind IN ('directory_optout', 'restrict_disclosure') THEN RETURN 'A directory opt-out or disclosure restriction is the student''s right; it cannot be denied.'; END IF;
       UPDATE prv_requests SET state = CASE WHEN p_decision = 'fulfill' THEN 'fulfilled' ELSE 'denied' END, handled_by = p_actor, handled_at = now(), outcome_note = v_note, version = version + 1 WHERE id = p_id;
     ELSE RETURN 'Unknown decision.'; END IF;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_id, p_actor, p_decision, v_note);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION arv_open(p_admin text, p_tenant text, p_id text, p_lines jsonb) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM arv_reviews WHERE tenant_id = p_tenant AND state = 'open') THEN RETURN 'An access review is already open. Finish it first.'; END IF;
     IF jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 THEN RETURN 'There are no memberships to review.'; END IF;
     INSERT INTO arv_reviews (id, tenant_id, opened_by) VALUES (p_id, p_tenant, p_admin);
     INSERT INTO arv_lines (review_id, membership_id, subject_id, subject_name, roles, status)
       SELECT p_id, l->>'membershipId', l->>'subjectId', coalesce(l->>'name', ''), ARRAY(SELECT jsonb_array_elements_text(l->'roles')), coalesce(l->>'status', '')
       FROM jsonb_array_elements(p_lines) l;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_id, p_admin, 'review_opened', jsonb_array_length(p_lines)::text || ' memberships');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION arv_decide(p_admin text, p_tenant text, p_review text, p_membership text, p_decision text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE rv arv_reviews%ROWTYPE; ln arv_lines%ROWTYPE;
   BEGIN
     SELECT * INTO rv FROM arv_reviews WHERE id = p_review FOR UPDATE;
     IF NOT FOUND OR rv.tenant_id <> p_tenant THEN RETURN 'Review not found.'; END IF;
     IF rv.state <> 'open' THEN RETURN 'This review is closed.'; END IF;
     SELECT * INTO ln FROM arv_lines WHERE review_id = p_review AND membership_id = p_membership FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Line not found.'; END IF;
     IF ln.subject_id = p_admin THEN RETURN 'Another administrator certifies your own access.'; END IF;
     IF p_decision = 'remove' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why this access should be removed.'; END IF;
     UPDATE arv_lines SET decision = p_decision, decided_by = p_admin, decided_at = now(), note = trim(coalesce(p_note, '')) WHERE review_id = p_review AND membership_id = p_membership;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_review, p_admin, 'line_' || p_decision, p_membership);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION arv_close(p_admin text, p_tenant text, p_review text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE rv arv_reviews%ROWTYPE; v_open int;
   BEGIN
     SELECT * INTO rv FROM arv_reviews WHERE id = p_review FOR UPDATE;
     IF NOT FOUND OR rv.tenant_id <> p_tenant THEN RETURN 'Review not found.'; END IF;
     IF rv.state <> 'open' THEN RETURN 'This review is already closed.'; END IF;
     SELECT count(*) INTO v_open FROM arv_lines WHERE review_id = p_review AND decision IS NULL;
     IF v_open > 0 THEN RETURN v_open || ' memberships still need a decision.'; END IF;
     UPDATE arv_reviews SET state = 'closed', closed_by = p_admin, closed_at = now() WHERE id = p_review;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_review, p_admin, 'review_closed');
     RETURN NULL;
   END $$`,
];
