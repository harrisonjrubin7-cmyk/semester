// Migration prv-001: records-rights requests and periodic access reviews (APP-013 Institution Console).
// Records rights: a student asks to inspect, amend or restrict their education record (or opt out of directory
// information). The institution's records-privacy office (prv_staff, granted by an administrator, never self) answers
// within a 45-day clock. An amendment denial must tell the student they may request a hearing. Handlers never decide
// their own request. Nothing here deletes or changes an academic record; fulfilment is recorded, the change itself goes
// through the owning workflow (registrar, grade change) with its own approvals.
// Access reviews: an administrator opens a review that snapshots every membership and its roles; each line is certified
// "keep" or "remove" by an administrator who is not the subject; a review closes only when every line is decided.
// Removal is applied through the existing membership suspension, which already refuses self-changes.
// Extension (S-76 E31, 27 Oct): records found for a request are routed to their owner and collected; each is decided
// release / redact / withhold (a record that mentions someone else is never released unredacted; withholding needs a
// reason); a second office member approves the prepared response, pinned to a fingerprint of the decisions (changing a
// decision withdraws it); an inspect request is fulfilled only with an approved response, which the student can open for
// 14 days; a records hold blocks fulfilling an amendment; after a denied amendment the student may request a hearing within
// 30 days, decided by an office member other than the one who denied it.
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
  `CREATE TABLE IF NOT EXISTS prv_items (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id text NOT NULL REFERENCES prv_requests(id),
     source text NOT NULL CHECK (length(trim(source)) BETWEEN 2 AND 120), description text NOT NULL CHECK (length(description) BETWEEN 5 AND 1000), owner_id text NOT NULL,
     collected boolean NOT NULL DEFAULT false, collected_note text NOT NULL DEFAULT '', third_party boolean NOT NULL DEFAULT false,
     decision text CHECK (decision IN ('release','redact','withhold')), reason text NOT NULL DEFAULT '', redaction text NOT NULL DEFAULT '',
     CHECK (NOT (third_party AND decision = 'release')), CHECK (decision <> 'withhold' OR length(reason) >= 10), CHECK (decision <> 'redact' OR length(redaction) >= 10),
     CHECK (decision IS NULL OR collected))`,
  `CREATE TABLE IF NOT EXISTS prv_responses (request_id text PRIMARY KEY REFERENCES prv_requests(id), tenant_id text NOT NULL, prepared_by text NOT NULL, decisions_key text NOT NULL,
     approved_by text, approved_key text, approved_at timestamptz, delivered_at timestamptz, views int NOT NULL DEFAULT 0,
     CHECK (approved_by IS NULL OR approved_by <> prepared_by), CHECK (approved_by IS NULL OR approved_key = decisions_key), CHECK (delivered_at IS NULL OR approved_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS prv_holds (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject_id text NOT NULL, reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
     placed_by text NOT NULL, placed_at timestamptz NOT NULL DEFAULT now(), released_by text, released_at timestamptz, release_reason text NOT NULL DEFAULT '',
     CHECK (released_by IS NULL OR released_by <> placed_by))`,
  `CREATE TABLE IF NOT EXISTS prv_hearings (request_id text PRIMARY KEY REFERENCES prv_requests(id), tenant_id text NOT NULL, reason text NOT NULL CHECK (length(reason) BETWEEN 20 AND 2000),
     requested_at timestamptz NOT NULL DEFAULT now(), denied_by text NOT NULL, decided_by text, outcome text CHECK (outcome IN ('upheld','amended')), note text NOT NULL DEFAULT '', decided_at timestamptz,
     CHECK (decided_by IS NULL OR decided_by <> denied_by), CHECK (outcome IS NULL OR (decided_by IS NOT NULL AND length(note) >= 10)))`,
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
       IF p_decision = 'fulfill' AND r.kind = 'inspect' THEN
         IF NOT EXISTS (SELECT 1 FROM prv_responses x WHERE x.request_id = p_id AND x.approved_by IS NOT NULL AND x.approved_key = prv_items_key(p_id)) THEN
           RETURN 'An inspect request is fulfilled with a response another office member has approved.'; END IF;
         UPDATE prv_responses SET delivered_at = now() WHERE request_id = p_id;
       END IF;
       IF p_decision = 'fulfill' AND r.kind = 'amend' AND prv_on_hold(p_tenant, r.requester_id) THEN
         RETURN 'A records hold applies to this student. The record cannot be amended until the hold is released.'; END IF;
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
  `CREATE OR REPLACE FUNCTION prv_items_key(p_request text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT encode(sha256(convert_to(coalesce(string_agg(id || ':' || coalesce(decision, '') || ':' || trim(redaction) || ':' || trim(reason), '|' ORDER BY id), ''), 'UTF8')), 'hex')
     FROM prv_items WHERE request_id = p_request $$`,
  `CREATE OR REPLACE FUNCTION prv_on_hold(p_tenant text, p_subject text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM prv_holds WHERE tenant_id = p_tenant AND subject_id = p_subject AND released_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION prv_route(p_actor text, p_tenant text, p_request text, p_source text, p_desc text, p_owner text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prv_requests%ROWTYPE; v_id bigint;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office routes records.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = p_request FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.requester_id = p_actor THEN RETURN 'You cannot handle your own request.'; END IF;
     IF r.kind <> 'inspect' OR r.state NOT IN ('submitted','acknowledged') THEN RETURN 'Records are gathered for an open inspect request.'; END IF;
     IF p_owner = r.requester_id THEN RETURN 'Route to the record owner, not the student.'; END IF;
     INSERT INTO prv_items (tenant_id, request_id, source, description, owner_id) VALUES (p_tenant, p_request, trim(p_source), trim(p_desc), p_owner) RETURNING id INTO v_id;
     UPDATE prv_requests SET version = version + 1 WHERE id = p_request;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_request, p_actor, 'record_routed', trim(p_source));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_collect(p_actor text, p_tenant text, p_item bigint, p_note text, p_third boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i prv_items%ROWTYPE; r prv_requests%ROWTYPE;
   BEGIN
     SELECT * INTO i FROM prv_items WHERE id = p_item AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR (i.owner_id <> p_actor AND NOT prv_is_staff(p_tenant, p_actor)) THEN RETURN 'Record not found.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = i.request_id FOR UPDATE;
     IF r.state NOT IN ('submitted','acknowledged') THEN RETURN 'This request is closed.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say what was found and where it is kept.'; END IF;
     UPDATE prv_items SET collected = true, collected_note = trim(p_note), third_party = p_third,
       decision = CASE WHEN p_third AND decision = 'release' THEN NULL ELSE decision END WHERE id = p_item;
     UPDATE prv_requests SET version = version + 1 WHERE id = r.id;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, 'record_collected', CASE WHEN p_third THEN 'mentions others' ELSE '' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_decide_item(p_actor text, p_tenant text, p_item bigint, p_decision text, p_reason text, p_redaction text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i prv_items%ROWTYPE; r prv_requests%ROWTYPE;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office decides records.'; END IF;
     SELECT * INTO i FROM prv_items WHERE id = p_item AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Record not found.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = i.request_id FOR UPDATE;
     IF r.requester_id = p_actor THEN RETURN 'You cannot handle your own request.'; END IF;
     IF r.state NOT IN ('submitted','acknowledged') THEN RETURN 'This request is closed.'; END IF;
     IF NOT i.collected THEN RETURN 'Collect the record before deciding.'; END IF;
     IF p_decision = 'release' AND i.third_party THEN RETURN 'This record mentions another person: redact or withhold it.'; END IF;
     IF p_decision = 'withhold' AND length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Give the reason for withholding (10+ characters).'; END IF;
     IF p_decision = 'redact' AND length(trim(coalesce(p_redaction, ''))) < 10 THEN RETURN 'Describe what the student will see after redaction.'; END IF;
     UPDATE prv_items SET decision = p_decision, reason = trim(coalesce(p_reason, '')), redaction = trim(coalesce(p_redaction, '')) WHERE id = p_item;
     IF EXISTS (SELECT 1 FROM prv_responses WHERE request_id = r.id AND delivered_at IS NULL) THEN
       DELETE FROM prv_responses WHERE request_id = r.id AND delivered_at IS NULL;
       INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, 'response_withdrawn', 'a decision changed');
     END IF;
     UPDATE prv_requests SET version = version + 1 WHERE id = r.id;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, 'record_' || p_decision, left(trim(coalesce(p_reason, '')), 300));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_prepare(p_actor text, p_tenant text, p_request text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prv_requests%ROWTYPE;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office prepares responses.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = p_request FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.requester_id = p_actor THEN RETURN 'You cannot handle your own request.'; END IF;
     IF r.kind <> 'inspect' OR r.state NOT IN ('submitted','acknowledged') THEN RETURN 'Responses are prepared for an open inspect request.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM prv_items WHERE request_id = p_request) THEN RETURN 'Route at least one record first.'; END IF;
     IF EXISTS (SELECT 1 FROM prv_items WHERE request_id = p_request AND NOT collected) THEN RETURN 'Some records have not been collected from their owners yet.'; END IF;
     IF EXISTS (SELECT 1 FROM prv_items WHERE request_id = p_request AND decision IS NULL) THEN RETURN 'Decide every record first.'; END IF;
     INSERT INTO prv_responses (request_id, tenant_id, prepared_by, decisions_key) VALUES (p_request, p_tenant, p_actor, prv_items_key(p_request))
       ON CONFLICT (request_id) DO UPDATE SET prepared_by = EXCLUDED.prepared_by, decisions_key = EXCLUDED.decisions_key, approved_by = NULL, approved_key = NULL, approved_at = NULL
       WHERE prv_responses.delivered_at IS NULL;
     UPDATE prv_requests SET version = version + 1 WHERE id = p_request;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_request, p_actor, 'response_prepared');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_approve(p_actor text, p_tenant text, p_request text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x prv_responses%ROWTYPE; r prv_requests%ROWTYPE;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office approves responses.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = p_request FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.requester_id = p_actor THEN RETURN 'You cannot handle your own request.'; END IF;
     SELECT * INTO x FROM prv_responses WHERE request_id = p_request FOR UPDATE;
     IF NOT FOUND OR x.delivered_at IS NOT NULL THEN RETURN 'There is no prepared response waiting for approval.'; END IF;
     IF x.prepared_by = p_actor THEN RETURN 'Another office member approves a response you prepared.'; END IF;
     IF x.decisions_key <> prv_items_key(p_request) THEN RETURN 'The decisions changed after it was prepared; prepare it again.'; END IF;
     UPDATE prv_responses SET approved_by = p_actor, approved_key = x.decisions_key, approved_at = now() WHERE request_id = p_request;
     UPDATE prv_requests SET version = version + 1 WHERE id = p_request;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_request, p_actor, 'response_approved');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_view(p_user text, p_tenant text, p_request text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x prv_responses%ROWTYPE;
   BEGIN
     SELECT x2.* INTO x FROM prv_responses x2 JOIN prv_requests r ON r.id = x2.request_id WHERE x2.request_id = p_request AND r.tenant_id = p_tenant AND r.requester_id = p_user FOR UPDATE OF x2;
     IF NOT FOUND OR x.delivered_at IS NULL THEN RETURN 'There is no response to open yet.'; END IF;
     IF now() - x.delivered_at > interval '14 days' THEN RETURN 'This response was available for 14 days and has expired. Ask the records office to send it again.'; END IF;
     UPDATE prv_responses SET views = views + 1 WHERE request_id = p_request;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_request, p_user, 'response_opened');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_hold(p_actor text, p_tenant text, p_subject text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office places holds.'; END IF;
     IF p_subject = p_actor THEN RETURN 'You cannot place a hold on your own records.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Give the reason for the hold (10+ characters).'; END IF;
     INSERT INTO prv_holds (tenant_id, subject_id, reason, placed_by) VALUES (p_tenant, p_subject, trim(p_reason), p_actor) RETURNING id INTO v_id;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, 'hold:' || v_id, p_actor, 'hold_placed', trim(p_reason));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_release(p_actor text, p_tenant text, p_hold bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE h prv_holds%ROWTYPE;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office releases holds.'; END IF;
     SELECT * INTO h FROM prv_holds WHERE id = p_hold AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR h.released_at IS NOT NULL THEN RETURN 'Hold not found.'; END IF;
     IF h.placed_by = p_actor THEN RETURN 'Another office member releases a hold you placed.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Give the reason for releasing it (10+ characters).'; END IF;
     UPDATE prv_holds SET released_by = p_actor, released_at = now(), release_reason = trim(p_reason) WHERE id = p_hold;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, 'hold:' || p_hold, p_actor, 'hold_released', trim(p_reason));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_hearing_request(p_user text, p_tenant text, p_request text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prv_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM prv_requests WHERE id = p_request FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.requester_id <> p_user THEN RETURN 'Request not found.'; END IF;
     IF r.kind <> 'amend' OR r.state <> 'denied' THEN RETURN 'A hearing can be requested after an amendment is denied.'; END IF;
     IF now() - r.handled_at > interval '30 days' THEN RETURN 'Hearings must be requested within 30 days of the decision.'; END IF;
     IF EXISTS (SELECT 1 FROM prv_hearings WHERE request_id = p_request) THEN RETURN 'A hearing has already been requested.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 20 THEN RETURN 'Explain why the record is inaccurate or misleading (20+ characters).'; END IF;
     INSERT INTO prv_hearings (request_id, tenant_id, reason, denied_by) VALUES (p_request, p_tenant, trim(p_reason), r.handled_by);
     INSERT INTO prv_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_request, p_user, 'hearing_requested');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prv_hearing_decide(p_actor text, p_tenant text, p_request text, p_outcome text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE h prv_hearings%ROWTYPE; r prv_requests%ROWTYPE;
   BEGIN
     IF NOT prv_is_staff(p_tenant, p_actor) THEN RETURN 'Only the records-privacy office records hearing outcomes.'; END IF;
     SELECT * INTO h FROM prv_hearings WHERE request_id = p_request AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR h.outcome IS NOT NULL THEN RETURN 'There is no open hearing for this request.'; END IF;
     SELECT * INTO r FROM prv_requests WHERE id = p_request;
     IF h.denied_by = p_actor THEN RETURN 'Someone other than the person who denied the amendment decides the hearing.'; END IF;
     IF r.requester_id = p_actor THEN RETURN 'You cannot decide your own hearing.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record the outcome and reasons (10+ characters).'; END IF;
     IF p_outcome = 'amended' AND prv_on_hold(p_tenant, r.requester_id) THEN RETURN 'A records hold applies. The record cannot be amended until it is released.'; END IF;
     UPDATE prv_hearings SET decided_by = p_actor, outcome = p_outcome, note = trim(p_note), decided_at = now() WHERE request_id = p_request;
     INSERT INTO prv_events (tenant_id, ref, actor_id, action, detail) VALUES (p_tenant, p_request, p_actor, 'hearing_' || p_outcome, trim(p_note));
     RETURN NULL;
   END $$`,
];
