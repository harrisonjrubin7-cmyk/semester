// Migration rcr-001: recruiting and appointments (S-76 E06; mirrors lib/recruitRules.ts). Institution hiring, separate from the
// Employers app (outside employers' student job postings). Prefix rcr_ because rec_ is taken.
// Enforced here: a requisition is approved by a hiring authority who did not request it; committees are named by a hiring
// authority and see only their own search; a member who declares a conflict with an applicant is recused from that applicant —
// no evaluation and no view of their confidential references; the chair's selection needs two independent evaluations and the
// approval of a hiring authority who is not the chair; an offer is approved by an appointment authority as an exact version
// (SHA-256 of its terms), any edit makes a new version that needs approval again, and the applicant accepts that exact version.
// Accepting hands off to HR (an HR officer then proposes the appointment in Work and HR). Closing keeps every record. No
// automated candidate decisions anywhere. Roles are granted by an administrator, never self. Append-only history.
export const RCR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rcr_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('hiring','appointment')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS rcr_requisitions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     description text NOT NULL DEFAULT '' CHECK (length(description) <= 6000), justification text NOT NULL CHECK (length(trim(justification)) >= 10), position_code text NOT NULL DEFAULT '',
     requested_by text NOT NULL, approved_by text,
     state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','rejected','approved','open','selection_pending','offer','filled','closed')),
     selected_app bigint, selection_by text, selection_approved_by text, close_reason text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> requested_by),
     CHECK (state IN ('pending','rejected') OR approved_by IS NOT NULL),
     CHECK (selection_approved_by IS NULL OR selection_approved_by <> selection_by),
     CHECK (state NOT IN ('offer','filled') OR (selected_app IS NOT NULL AND selection_approved_by IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS rcr_committee (req_id bigint NOT NULL REFERENCES rcr_requisitions(id), user_id text NOT NULL, chair boolean NOT NULL DEFAULT false, added_by text NOT NULL,
     removed_at timestamptz, PRIMARY KEY (req_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS rcr_applications (id bigserial PRIMARY KEY, req_id bigint NOT NULL REFERENCES rcr_requisitions(id), applicant_id text NOT NULL,
     statement text NOT NULL CHECK (length(trim(statement)) BETWEEN 20 AND 6000), state text NOT NULL DEFAULT 'applied' CHECK (state IN ('applied','withdrawn','declined','selected','hired')),
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rcr_one_application ON rcr_applications (req_id, applicant_id) WHERE state <> 'withdrawn'`,
  `CREATE TABLE IF NOT EXISTS rcr_conflicts (app_id bigint NOT NULL REFERENCES rcr_applications(id), member_id text NOT NULL, reason text NOT NULL CHECK (length(trim(reason)) >= 5),
     declared_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (app_id, member_id))`,
  `CREATE TABLE IF NOT EXISTS rcr_references (id bigserial PRIMARY KEY, app_id bigint NOT NULL REFERENCES rcr_applications(id), referee text NOT NULL CHECK (length(trim(referee)) >= 3),
     body text NOT NULL CHECK (length(trim(body)) BETWEEN 10 AND 8000), added_by text NOT NULL, added_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rcr_evaluations (app_id bigint NOT NULL REFERENCES rcr_applications(id), member_id text NOT NULL, score int NOT NULL CHECK (score BETWEEN 1 AND 5),
     notes text NOT NULL CHECK (length(trim(notes)) >= 10), at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (app_id, member_id))`,
  `CREATE TABLE IF NOT EXISTS rcr_offers (id bigserial PRIMARY KEY, req_id bigint NOT NULL REFERENCES rcr_requisitions(id), app_id bigint NOT NULL REFERENCES rcr_applications(id), rev int NOT NULL,
     terms text NOT NULL CHECK (length(trim(terms)) BETWEEN 20 AND 8000), sha256 text NOT NULL, drafted_by text NOT NULL, approved_by text, approved_at timestamptz,
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','superseded','accepted','declined')), responded_at timestamptz, UNIQUE (req_id, rev),
     CHECK (approved_by IS NULL OR approved_by <> drafted_by), CHECK (state NOT IN ('approved','accepted') OR approved_by IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS rcr_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, req_id bigint, step text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rcr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rcr_events_append_only') THEN
       CREATE TRIGGER rcr_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rcr_events FOR EACH STATEMENT EXECUTE FUNCTION rcr_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rcr_references_append_only') THEN
       CREATE TRIGGER rcr_references_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rcr_references FOR EACH STATEMENT EXECUTE FUNCTION rcr_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rcr_conflicts_append_only') THEN
       CREATE TRIGGER rcr_conflicts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rcr_conflicts FOR EACH STATEMENT EXECUTE FUNCTION rcr_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rcr_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION rcr_member(p_req bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rcr_committee WHERE req_id = p_req AND user_id = p_user AND removed_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION rcr_chair(p_req bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rcr_committee WHERE req_id = p_req AND user_id = p_user AND chair AND removed_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION rcr_recused(p_app bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rcr_conflicts WHERE app_id = p_app AND member_id = p_user) $$`,
  `CREATE OR REPLACE FUNCTION rcr_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own hiring authority.'; END IF;
     IF p_role NOT IN ('hiring','appointment') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO rcr_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE rcr_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     INSERT INTO rcr_events (tenant_id, step, actor_id, note) VALUES (p_tenant, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user || ' ' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_requisition(p_actor text, p_tenant text, p_title text, p_desc text, p_just text, p_position text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF length(trim(coalesce(p_just, ''))) < 10 THEN RETURN 'Explain why this hire is needed.'; END IF;
     INSERT INTO rcr_requisitions (tenant_id, title, description, justification, position_code, requested_by) VALUES (p_tenant, trim(p_title), coalesce(p_desc, ''), trim(p_just), upper(trim(coalesce(p_position, ''))), p_actor)
       RETURNING id INTO v_id;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id) VALUES (p_tenant, v_id, 'request', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_req_step(p_actor text, p_tenant text, p_req bigint, p_step text, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcr_requisitions;
   BEGIN
     SELECT * INTO r FROM rcr_requisitions WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Requisition not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This search changed since you opened it. Reload and try again.'; END IF;
     IF p_step IN ('approve','reject') THEN
       IF NOT rcr_has(p_tenant, p_actor, 'hiring') THEN RETURN 'Only a hiring authority approves requisitions.'; END IF;
       IF p_actor = r.requested_by THEN RETURN 'A different hiring authority approves your own requisition.'; END IF;
       IF r.state <> 'pending' THEN RETURN 'Already decided.'; END IF;
       UPDATE rcr_requisitions SET state = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'rejected' END, approved_by = CASE WHEN p_step = 'approve' THEN p_actor END, version = version + 1 WHERE id = p_req;
     ELSIF p_step = 'publish' THEN
       IF NOT (rcr_has(p_tenant, p_actor, 'hiring') OR rcr_chair(p_req, p_actor)) THEN RETURN 'Only a hiring authority or the committee chair publishes.'; END IF;
       IF r.state <> 'approved' THEN RETURN 'Only an approved requisition is published.'; END IF;
       IF NOT EXISTS (SELECT 1 FROM rcr_committee WHERE req_id = p_req AND chair AND removed_at IS NULL) THEN RETURN 'Name a committee chair first.'; END IF;
       UPDATE rcr_requisitions SET state = 'open', version = version + 1 WHERE id = p_req;
     ELSIF p_step = 'close' THEN
       IF NOT rcr_has(p_tenant, p_actor, 'hiring') THEN RETURN 'Only a hiring authority closes a search.'; END IF;
       IF r.state IN ('filled','closed','rejected') THEN RETURN 'This search is already finished.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record why the search closes.'; END IF;
       UPDATE rcr_applications SET state = 'declined' WHERE req_id = p_req AND state IN ('applied','selected');
       UPDATE rcr_offers SET state = 'superseded' WHERE req_id = p_req AND state IN ('draft','approved');
       UPDATE rcr_requisitions SET state = 'closed', close_reason = trim(p_note), version = version + 1 WHERE id = p_req;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (p_tenant, p_req, p_step, p_actor, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_committee_set(p_actor text, p_tenant text, p_req bigint, p_user text, p_chair boolean, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcr_requisitions;
   BEGIN
     IF NOT rcr_has(p_tenant, p_actor, 'hiring') THEN RETURN 'Only a hiring authority names the committee.'; END IF;
     SELECT * INTO r FROM rcr_requisitions WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL OR r.state IN ('pending','rejected','filled','closed') THEN RETURN 'The committee is named for an approved, unfinished search.'; END IF;
     IF EXISTS (SELECT 1 FROM rcr_applications WHERE req_id = p_req AND applicant_id = p_user AND state <> 'withdrawn') THEN RETURN 'An applicant cannot sit on the committee.'; END IF;
     IF p_on THEN
       IF p_chair THEN UPDATE rcr_committee SET chair = false WHERE req_id = p_req; END IF;
       INSERT INTO rcr_committee (req_id, user_id, chair, added_by) VALUES (p_req, p_user, p_chair, p_actor)
         ON CONFLICT (req_id, user_id) DO UPDATE SET chair = EXCLUDED.chair, removed_at = NULL, added_by = p_actor;
     ELSE UPDATE rcr_committee SET removed_at = now(), chair = false WHERE req_id = p_req AND user_id = p_user; END IF;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (p_tenant, p_req, CASE WHEN p_on THEN 'committee_add' ELSE 'committee_remove' END, p_actor, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_apply(p_user text, p_req bigint, p_statement text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcr_requisitions; v_id bigint;
   BEGIN
     SELECT * INTO r FROM rcr_requisitions WHERE id = p_req FOR UPDATE;
     IF r.id IS NULL OR r.state <> 'open' THEN RETURN 'This search is not accepting applications.'; END IF;
     IF rcr_member(p_req, p_user) THEN RETURN 'Committee members cannot apply to their own search.'; END IF;
     IF EXISTS (SELECT 1 FROM rcr_applications WHERE req_id = p_req AND applicant_id = p_user AND state <> 'withdrawn') THEN RETURN 'You have already applied.'; END IF;
     INSERT INTO rcr_applications (req_id, applicant_id, statement) VALUES (p_req, p_user, trim(p_statement)) RETURNING id INTO v_id;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id) VALUES (r.tenant_id, p_req, 'apply', p_user);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_withdraw(p_user text, p_app bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a rcr_applications; r rcr_requisitions;
   BEGIN
     SELECT * INTO a FROM rcr_applications WHERE id = p_app AND applicant_id = p_user FOR UPDATE;
     IF a.id IS NULL OR a.state NOT IN ('applied','selected') THEN RETURN 'This application can no longer be withdrawn.'; END IF;
     SELECT * INTO r FROM rcr_requisitions WHERE id = a.req_id FOR UPDATE;
     UPDATE rcr_applications SET state = 'withdrawn' WHERE id = p_app;
     IF r.selected_app = p_app THEN
       UPDATE rcr_offers SET state = 'superseded' WHERE app_id = p_app AND state IN ('draft','approved');
       UPDATE rcr_requisitions SET state = 'open', selected_app = NULL, selection_by = NULL, selection_approved_by = NULL, version = version + 1 WHERE id = r.id;
     END IF;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id) VALUES (r.tenant_id, r.id, 'withdraw', p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_conflict(p_member text, p_app bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a rcr_applications; r rcr_requisitions;
   BEGIN
     SELECT * INTO a FROM rcr_applications WHERE id = p_app; SELECT * INTO r FROM rcr_requisitions WHERE id = a.req_id;
     IF a.id IS NULL OR NOT rcr_member(a.req_id, p_member) THEN RETURN 'Only a committee member declares a conflict.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Describe the conflict.'; END IF;
     INSERT INTO rcr_conflicts (app_id, member_id, reason) VALUES (p_app, p_member, trim(p_reason)) ON CONFLICT DO NOTHING;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (r.tenant_id, r.id, 'recuse', p_member, p_app::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_reference(p_actor text, p_tenant text, p_app bigint, p_referee text, p_body text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a rcr_applications;
   BEGIN
     SELECT * INTO a FROM rcr_applications WHERE id = p_app;
     IF a.id IS NULL OR NOT EXISTS (SELECT 1 FROM rcr_requisitions WHERE id = a.req_id AND tenant_id = p_tenant) THEN RETURN 'Application not found.'; END IF;
     IF NOT (rcr_chair(a.req_id, p_actor) OR rcr_has(p_tenant, p_actor, 'hiring')) THEN RETURN 'Only the chair or a hiring authority files references.'; END IF;
     IF rcr_recused(p_app, p_actor) THEN RETURN 'You are recused from this applicant.'; END IF;
     INSERT INTO rcr_references (app_id, referee, body, added_by) VALUES (p_app, trim(p_referee), trim(p_body), p_actor);
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id) VALUES (p_tenant, a.req_id, 'reference', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_evaluate(p_member text, p_app bigint, p_score int, p_notes text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a rcr_applications; r rcr_requisitions;
   BEGIN
     SELECT * INTO a FROM rcr_applications WHERE id = p_app; SELECT * INTO r FROM rcr_requisitions WHERE id = a.req_id;
     IF a.id IS NULL OR NOT rcr_member(a.req_id, p_member) THEN RETURN 'Only committee members evaluate.'; END IF;
     IF rcr_recused(p_app, p_member) THEN RETURN 'You are recused from this applicant.'; END IF;
     IF a.state <> 'applied' OR r.state NOT IN ('open','selection_pending') THEN RETURN 'This application is not under review.'; END IF;
     IF length(trim(coalesce(p_notes, ''))) < 10 THEN RETURN 'Give the evidence for your score.'; END IF;
     INSERT INTO rcr_evaluations (app_id, member_id, score, notes) VALUES (p_app, p_member, p_score, trim(p_notes))
       ON CONFLICT (app_id, member_id) DO UPDATE SET score = EXCLUDED.score, notes = EXCLUDED.notes, at = now();
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (r.tenant_id, r.id, 'evaluate', p_member, p_app::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_select(p_actor text, p_tenant text, p_req bigint, p_app bigint, p_step text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcr_requisitions; a rcr_applications; n int;
   BEGIN
     SELECT * INTO r FROM rcr_requisitions WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Requisition not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This search changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'propose' THEN
       SELECT * INTO a FROM rcr_applications WHERE id = p_app AND req_id = p_req;
       IF NOT rcr_chair(p_req, p_actor) THEN RETURN 'The committee chair proposes the selection.'; END IF;
       IF rcr_recused(p_app, p_actor) THEN RETURN 'You are recused from this applicant.'; END IF;
       IF r.state <> 'open' OR a.id IS NULL OR a.state <> 'applied' THEN RETURN 'That applicant cannot be selected now.'; END IF;
       SELECT count(*) INTO n FROM rcr_evaluations e WHERE e.app_id = p_app AND NOT rcr_recused(p_app, e.member_id) AND rcr_member(p_req, e.member_id);
       IF n < 2 THEN RETURN 'At least two committee members must evaluate this applicant first.'; END IF;
       UPDATE rcr_requisitions SET state = 'selection_pending', selected_app = p_app, selection_by = p_actor, version = version + 1 WHERE id = p_req;
     ELSIF p_step IN ('approve','return') THEN
       IF NOT rcr_has(p_tenant, p_actor, 'hiring') THEN RETURN 'Only a hiring authority approves the selection.'; END IF;
       IF p_actor = r.selection_by THEN RETURN 'A hiring authority other than the chair approves the selection.'; END IF;
       IF rcr_recused(r.selected_app, p_actor) THEN RETURN 'You are recused from this applicant.'; END IF;
       IF r.state <> 'selection_pending' THEN RETURN 'No selection is waiting.'; END IF;
       IF p_step = 'approve' THEN
         UPDATE rcr_requisitions SET state = 'offer', selection_approved_by = p_actor, version = version + 1 WHERE id = p_req;
         UPDATE rcr_applications SET state = 'selected' WHERE id = r.selected_app;
       ELSE UPDATE rcr_requisitions SET state = 'open', selected_app = NULL, selection_by = NULL, version = version + 1 WHERE id = p_req; END IF;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (p_tenant, p_req, 'selection_' || p_step, p_actor, coalesce(p_app::text, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_offer_draft(p_actor text, p_tenant text, p_req bigint, p_terms text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcr_requisitions; v_rev int; v_id bigint;
   BEGIN
     SELECT * INTO r FROM rcr_requisitions WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL OR r.state <> 'offer' THEN RETURN 'No approved selection is waiting for an offer.'; END IF;
     IF NOT (rcr_has(p_tenant, p_actor, 'hiring') OR rcr_chair(p_req, p_actor)) THEN RETURN 'Only the chair or a hiring authority drafts the offer.'; END IF;
     IF EXISTS (SELECT 1 FROM rcr_offers WHERE req_id = p_req AND state = 'accepted') THEN RETURN 'The offer was already accepted.'; END IF;
     UPDATE rcr_offers SET state = 'superseded' WHERE req_id = p_req AND state IN ('draft','approved');
     SELECT coalesce(max(rev), 0) + 1 INTO v_rev FROM rcr_offers WHERE req_id = p_req;
     INSERT INTO rcr_offers (req_id, app_id, rev, terms, sha256, drafted_by) VALUES (p_req, r.selected_app, v_rev, trim(p_terms), encode(sha256(convert_to(trim(p_terms), 'UTF8')), 'hex'), p_actor)
       RETURNING id INTO v_id;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (p_tenant, p_req, 'offer_draft', p_actor, 'rev ' || v_rev);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_offer_approve(p_actor text, p_tenant text, p_offer bigint, p_hash text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o rcr_offers; r rcr_requisitions;
   BEGIN
     IF NOT rcr_has(p_tenant, p_actor, 'appointment') THEN RETURN 'Only an appointment authority approves offers.'; END IF;
     SELECT * INTO o FROM rcr_offers WHERE id = p_offer FOR UPDATE;
     SELECT * INTO r FROM rcr_requisitions WHERE id = o.req_id AND tenant_id = p_tenant;
     IF o.id IS NULL OR r.id IS NULL THEN RETURN 'Offer not found.'; END IF;
     IF o.state <> 'draft' THEN RETURN 'Only the current draft is approved.'; END IF;
     IF p_actor = o.drafted_by THEN RETURN 'Someone other than the drafter approves the offer.'; END IF;
     IF o.sha256 <> p_hash THEN RETURN 'The offer you read is not the current version. Reload.'; END IF;
     UPDATE rcr_offers SET state = 'approved', approved_by = p_actor, approved_at = now() WHERE id = p_offer;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (p_tenant, o.req_id, 'offer_approve', p_actor, o.sha256);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rcr_offer_respond(p_user text, p_offer bigint, p_hash text, p_accept boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o rcr_offers; a rcr_applications; r rcr_requisitions;
   BEGIN
     SELECT * INTO o FROM rcr_offers WHERE id = p_offer FOR UPDATE;
     SELECT * INTO a FROM rcr_applications WHERE id = o.app_id;
     IF o.id IS NULL OR a.applicant_id <> p_user THEN RETURN 'Offer not found.'; END IF;
     IF o.state <> 'approved' THEN RETURN 'This offer is not open for a response.'; END IF;
     IF o.sha256 <> p_hash THEN RETURN 'The offer changed. Reload and read the current terms.'; END IF;
     SELECT * INTO r FROM rcr_requisitions WHERE id = o.req_id FOR UPDATE;
     IF p_accept THEN
       UPDATE rcr_offers SET state = 'accepted', responded_at = now() WHERE id = p_offer;
       UPDATE rcr_applications SET state = 'hired' WHERE id = a.id;
       UPDATE rcr_applications SET state = 'declined' WHERE req_id = r.id AND id <> a.id AND state = 'applied';
       UPDATE rcr_requisitions SET state = 'filled', version = version + 1 WHERE id = r.id;
     ELSE
       UPDATE rcr_offers SET state = 'declined', responded_at = now() WHERE id = p_offer;
       UPDATE rcr_applications SET state = 'declined' WHERE id = a.id;
       UPDATE rcr_requisitions SET state = 'open', selected_app = NULL, selection_by = NULL, selection_approved_by = NULL, version = version + 1 WHERE id = r.id;
     END IF;
     INSERT INTO rcr_events (tenant_id, req_id, step, actor_id, note) VALUES (r.tenant_id, r.id, CASE WHEN p_accept THEN 'offer_accept' ELSE 'offer_decline' END, p_user, o.sha256);
     RETURN NULL;
   END $$`,
];
