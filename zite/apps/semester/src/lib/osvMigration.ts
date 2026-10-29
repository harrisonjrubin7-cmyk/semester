// Migration osv-001: office service layer (role app "University Staff": office queues, requests, knowledge, resolution).
// Enforced here, not in the screen:
// - Offices belong to one institution and are set up by an administrator. Office staff are appointed by an administrator,
//   never themselves; a revoked appointment stops working on the next call.
// - Requests are idempotent per requester and key (same key + different content is refused). Every step names the version
//   it expects. Staff see and act only on their own office's queue; nobody handles a request they sent.
// - Resolving needs an outcome and a summary the student sees. The student confirms (closed) or reopens once within 14 days.
//   Referral moves the request to another office in the same institution and back to its queue.
// - Knowledge articles: staff of an office draft; a different staff member of that office publishes the exact text they saw.
//   Published text is never edited in place: a revision is a new draft, and publishing it retires the one it replaces.
// - Messages and history are append-only. Internal notes are staff-only.
export const OSV_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS osv_offices (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
     description text NOT NULL DEFAULT '' CHECK (length(description) <= 600), hours text NOT NULL DEFAULT '' CHECK (length(hours) <= 120),
     active boolean NOT NULL DEFAULT true, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS osv_offices_name ON osv_offices (tenant_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS osv_staff (office_id bigint NOT NULL REFERENCES osv_offices(id), tenant_id text NOT NULL, user_id text NOT NULL,
     lead boolean NOT NULL DEFAULT false, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (office_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS osv_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, office_id bigint NOT NULL REFERENCES osv_offices(id),
     request_key text NOT NULL, requester_id text NOT NULL, reference text NOT NULL UNIQUE,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140), details text NOT NULL DEFAULT '' CHECK (length(details) <= 4000),
     state text NOT NULL DEFAULT 'sent' CHECK (state IN ('sent','claimed','waiting_on_student','resolved','closed','withdrawn')),
     assignee_id text, outcome text CHECK (outcome IN ('answered','done','referred_out','declined')), resolution text NOT NULL DEFAULT '',
     resolved_at timestamptz, reopen_count int NOT NULL DEFAULT 0 CHECK (reopen_count BETWEEN 0 AND 1), version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, requester_id, request_key),
     CHECK (state NOT IN ('claimed','waiting_on_student') OR assignee_id IS NOT NULL),
     CHECK (assignee_id IS NULL OR assignee_id <> requester_id),
     CHECK (state NOT IN ('resolved','closed') OR (outcome IS NOT NULL AND length(resolution) >= 10)))`,
  `CREATE TABLE IF NOT EXISTS osv_messages (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES osv_requests(id), author_id text NOT NULL,
     body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000), internal boolean NOT NULL DEFAULT false, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS osv_articles (id bigserial PRIMARY KEY, tenant_id text NOT NULL, office_id bigint NOT NULL REFERENCES osv_offices(id),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140), body text NOT NULL CHECK (length(trim(body)) BETWEEN 40 AND 20000),
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','published','retired')),
     author_id text NOT NULL, reviewer_id text, review_note text NOT NULL DEFAULT '', supersedes bigint REFERENCES osv_articles(id),
     version int NOT NULL DEFAULT 1, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (reviewer_id IS NULL OR reviewer_id <> author_id),
     CHECK (state <> 'published' OR (reviewer_id IS NOT NULL AND published_at IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS osv_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('office','staff','request','article')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION osv_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'osv_events_append_only') THEN
       CREATE TRIGGER osv_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON osv_events FOR EACH STATEMENT EXECUTE FUNCTION osv_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'osv_messages_append_only') THEN
       CREATE TRIGGER osv_messages_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON osv_messages FOR EACH STATEMENT EXECUTE FUNCTION osv_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION osv_text_hash(p_title text, p_body text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(coalesce(p_title,'') || '|' || coalesce(p_body,'')) $$`,
  `CREATE OR REPLACE FUNCTION osv_is_staff(p_tenant text, p_office bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM osv_staff WHERE tenant_id = p_tenant AND office_id = p_office AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION osv_is_lead(p_tenant text, p_office bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM osv_staff WHERE tenant_id = p_tenant AND office_id = p_office AND user_id = p_user AND lead AND revoked_at IS NULL) $$`,

  // Administrator: create or edit an office.
  `CREATE OR REPLACE FUNCTION osv_office(p_tenant text, p_actor text, p_is_admin boolean, p_id bigint, p_name text, p_desc text, p_hours text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only administrators set up offices.'; END IF;
     IF length(trim(coalesce(p_name, ''))) < 2 THEN RETURN 'Name the office.'; END IF;
     IF EXISTS (SELECT 1 FROM osv_offices WHERE tenant_id = p_tenant AND lower(name) = lower(trim(p_name)) AND id IS DISTINCT FROM p_id) THEN RETURN 'An office with that name already exists.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO osv_offices (tenant_id, name, description, hours, active, created_by) VALUES (p_tenant, trim(p_name), coalesce(p_desc, ''), coalesce(p_hours, ''), coalesce(p_active, true), p_actor) RETURNING id INTO v_id;
     ELSE
       UPDATE osv_offices SET name = trim(p_name), description = coalesce(p_desc, ''), hours = coalesce(p_hours, ''), active = coalesce(p_active, active) WHERE id = p_id AND tenant_id = p_tenant RETURNING id INTO v_id;
       IF v_id IS NULL THEN RETURN 'Office not found.'; END IF;
     END IF;
     INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'office', v_id, CASE WHEN p_id IS NULL THEN 'create' ELSE 'edit' END, CASE WHEN coalesce(p_active, true) THEN 'active' ELSE 'inactive' END, p_actor, trim(p_name));
     RETURN 'ok:' || v_id;
   END $$`,

  // Administrator: appoint, change or revoke office staff. Never oneself.
  `CREATE OR REPLACE FUNCTION osv_set_staff(p_admin text, p_is_admin boolean, p_tenant text, p_office bigint, p_user text, p_lead boolean, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only administrators appoint office staff.'; END IF;
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own office access.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM osv_offices WHERE id = p_office AND tenant_id = p_tenant) THEN RETURN 'Office not found.'; END IF;
     IF p_active THEN
       INSERT INTO osv_staff (office_id, tenant_id, user_id, lead, granted_by) VALUES (p_office, p_tenant, p_user, coalesce(p_lead, false), p_admin)
         ON CONFLICT (office_id, user_id) DO UPDATE SET lead = EXCLUDED.lead, granted_by = p_admin, granted_at = now(), revoked_at = NULL;
     ELSE
       UPDATE osv_staff SET revoked_at = now() WHERE office_id = p_office AND user_id = p_user AND revoked_at IS NULL;
     END IF;
     INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note)
       VALUES (p_tenant, 'staff', p_office, 'set_staff', CASE WHEN NOT p_active THEN 'revoked' WHEN p_lead THEN 'lead' ELSE 'staff' END, p_admin, p_user);
     RETURN NULL;
   END $$`,

  // Anyone in the institution: send a request to an office. Returns 'ok:id', 'replay:id' or a refusal.
  `CREATE OR REPLACE FUNCTION osv_open(p_tenant text, p_key text, p_actor text, p_office bigint, p_title text, p_details text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r osv_requests; v_id bigint;
   BEGIN
     SELECT * INTO r FROM osv_requests WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF r.title = trim(p_title) AND r.details = trim(coalesce(p_details, '')) AND r.office_id = p_office THEN RETURN 'replay:' || r.id; END IF;
       RETURN 'That request was already sent with different details. Refresh and try again.';
     END IF;
     IF length(coalesce(p_key, '')) < 8 THEN RETURN 'Missing request key.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM osv_offices WHERE id = p_office AND tenant_id = p_tenant AND active) THEN RETURN 'That office is not taking requests.'; END IF;
     IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Say what you need (5+ characters).'; END IF;
     INSERT INTO osv_requests (tenant_id, office_id, request_key, requester_id, reference, title, details)
       VALUES (p_tenant, p_office, p_key, p_actor, 'OSV-' || upper(substr(md5(p_tenant || '|' || p_actor || '|' || p_key), 1, 8)), trim(p_title), trim(coalesce(p_details, ''))) RETURNING id INTO v_id;
     INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'request', v_id, 'open', 'sent', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,

  // One step on a request. Returns NULL when done, otherwise the reason it was refused.
  `CREATE OR REPLACE FUNCTION osv_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_outcome text, p_target text, p_office bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r osv_requests; staff boolean; lead boolean; mine boolean; v_to text; n text := trim(coalesce(p_note, '')); v_note text := n;
   BEGIN
     SELECT * INTO r FROM osv_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     staff := osv_is_staff(p_tenant, r.office_id, p_actor); lead := osv_is_lead(p_tenant, r.office_id, p_actor); mine := r.requester_id = p_actor;
     IF NOT staff AND NOT mine THEN RETURN 'Request not found.'; END IF;
     IF p_expected IS DISTINCT FROM r.version THEN RETURN 'This request changed since you opened it. Refresh and try again.'; END IF;
     IF r.state IN ('closed','withdrawn') THEN RETURN 'This request is finished.'; END IF;

     IF p_step = 'claim' THEN
       IF NOT staff OR mine THEN RETURN 'Only staff of this office can take it, and not on a request you sent.'; END IF;
       IF r.state <> 'sent' THEN RETURN 'Someone already has this request.'; END IF;
       UPDATE osv_requests SET state = 'claimed', assignee_id = p_actor WHERE id = r.id; v_to := 'claimed'; v_note := '';
     ELSIF p_step = 'assign' THEN
       IF NOT lead THEN RETURN 'Only the office lead assigns requests.'; END IF;
       IF r.state NOT IN ('sent','claimed','waiting_on_student') THEN RETURN 'This request cannot be reassigned now.'; END IF;
       IF p_target IS NULL OR p_target = r.requester_id OR NOT osv_is_staff(p_tenant, r.office_id, p_target) THEN RETURN 'Assign it to a staff member of this office who did not send it.'; END IF;
       UPDATE osv_requests SET state = CASE WHEN state = 'sent' THEN 'claimed' ELSE state END, assignee_id = p_target WHERE id = r.id;
       v_to := CASE WHEN r.state = 'sent' THEN 'claimed' ELSE r.state END; v_note := p_target;
     ELSIF p_step = 'ask' THEN
       IF r.assignee_id IS DISTINCT FROM p_actor THEN RETURN 'Only the person handling this request asks the student.'; END IF;
       IF r.state <> 'claimed' THEN RETURN 'You can ask once you have the request.'; END IF;
       IF length(n) < 5 THEN RETURN 'Write the question (5+ characters).'; END IF;
       INSERT INTO osv_messages (request_id, author_id, body) VALUES (r.id, p_actor, n);
       UPDATE osv_requests SET state = 'waiting_on_student' WHERE id = r.id; v_to := 'waiting_on_student';
     ELSIF p_step = 'reply' THEN
       IF NOT mine THEN RETURN 'Only the person who sent it replies here. Staff use a note.'; END IF;
       IF r.state = 'resolved' THEN RETURN 'This request is resolved. Reopen it if it is not.'; END IF;
       IF length(n) < 1 THEN RETURN 'Write a reply.'; END IF;
       INSERT INTO osv_messages (request_id, author_id, body) VALUES (r.id, p_actor, n);
       v_to := CASE WHEN r.state = 'waiting_on_student' THEN 'claimed' ELSE r.state END;
       UPDATE osv_requests SET state = v_to WHERE id = r.id;
     ELSIF p_step = 'note' THEN
       IF NOT staff OR mine THEN RETURN 'Internal notes are for staff of this office.'; END IF;
       IF length(n) < 3 THEN RETURN 'Write the note.'; END IF;
       INSERT INTO osv_messages (request_id, author_id, body, internal) VALUES (r.id, p_actor, n, true); v_to := r.state; v_note := 'internal note';
     ELSIF p_step = 'refer' THEN
       IF r.assignee_id IS DISTINCT FROM p_actor AND NOT lead THEN RETURN 'Only the person handling it, or the office lead, refers it.'; END IF;
       IF r.state NOT IN ('sent','claimed','waiting_on_student') THEN RETURN 'This request cannot be referred now.'; END IF;
       IF p_office IS NULL OR p_office = r.office_id OR NOT EXISTS (SELECT 1 FROM osv_offices WHERE id = p_office AND tenant_id = p_tenant AND active) THEN RETURN 'Choose another office at your institution.'; END IF;
       IF length(n) < 10 THEN RETURN 'Say why it belongs with that office (10+ characters). The student sees this.'; END IF;
       INSERT INTO osv_messages (request_id, author_id, body) VALUES (r.id, p_actor, n);
       UPDATE osv_requests SET office_id = p_office, state = 'sent', assignee_id = NULL WHERE id = r.id; v_to := 'sent'; v_note := 'to office ' || p_office || ': ' || n;
     ELSIF p_step = 'resolve' THEN
       IF r.assignee_id IS DISTINCT FROM p_actor THEN RETURN 'Only the person handling this request resolves it.'; END IF;
       IF r.state NOT IN ('claimed','waiting_on_student') THEN RETURN 'Take the request before resolving it.'; END IF;
       IF coalesce(p_outcome, '') NOT IN ('answered','done','referred_out','declined') THEN RETURN 'Choose an outcome.'; END IF;
       IF length(n) < 10 THEN RETURN 'Write what was done (10+ characters). The student sees this.'; END IF;
       UPDATE osv_requests SET state = 'resolved', outcome = p_outcome, resolution = n, resolved_at = now() WHERE id = r.id; v_to := 'resolved';
     ELSIF p_step = 'confirm' THEN
       IF NOT mine THEN RETURN 'Only the person who sent it confirms it is resolved.'; END IF;
       IF r.state <> 'resolved' THEN RETURN 'There is nothing to confirm yet.'; END IF;
       UPDATE osv_requests SET state = 'closed' WHERE id = r.id; v_to := 'closed';
     ELSIF p_step = 'reopen' THEN
       IF NOT mine THEN RETURN 'Only the person who sent it reopens it.'; END IF;
       IF r.state <> 'resolved' THEN RETURN 'Only a resolved request can be reopened.'; END IF;
       IF r.reopen_count >= 1 THEN RETURN 'This request was already reopened once. Send a new request.'; END IF;
       IF r.resolved_at < now() - interval '14 days' THEN RETURN 'It has been more than 14 days. Send a new request.'; END IF;
       IF length(n) < 10 THEN RETURN 'Say what is still wrong (10+ characters).'; END IF;
       INSERT INTO osv_messages (request_id, author_id, body) VALUES (r.id, p_actor, n);
       UPDATE osv_requests SET state = 'claimed', reopen_count = reopen_count + 1, outcome = NULL, resolution = '', resolved_at = NULL WHERE id = r.id; v_to := 'claimed';
     ELSIF p_step = 'withdraw' THEN
       IF NOT mine THEN RETURN 'Only the person who sent it withdraws it.'; END IF;
       IF r.state = 'resolved' THEN RETURN 'It is already resolved. Confirm or reopen it.'; END IF;
       UPDATE osv_requests SET state = 'withdrawn' WHERE id = r.id; v_to := 'withdrawn';
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE osv_requests SET version = version + 1, updated_at = now() WHERE id = r.id;
     INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'request', r.id, p_step, v_to, p_actor, left(v_note, 600));
     RETURN NULL;
   END $$`,

  // Knowledge articles. Returns 'ok:id' when done, otherwise the reason it was refused.
  `CREATE OR REPLACE FUNCTION osv_article(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_office bigint, p_title text, p_body text, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a osv_articles; v_id bigint; v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     IF p_step = 'draft' THEN
       IF NOT EXISTS (SELECT 1 FROM osv_offices WHERE id = p_office AND tenant_id = p_tenant) THEN RETURN 'Office not found.'; END IF;
       IF NOT osv_is_staff(p_tenant, p_office, p_actor) THEN RETURN 'Only staff of that office write its articles.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_body, ''))) < 40 THEN RETURN 'Write a title (5+ characters) and the answer (40+ characters).'; END IF;
       INSERT INTO osv_articles (tenant_id, office_id, title, body, author_id) VALUES (p_tenant, p_office, trim(p_title), trim(p_body), p_actor) RETURNING id INTO v_id;
       INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'article', v_id, 'draft', 'draft', p_actor);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO a FROM osv_articles WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR a.tenant_id <> p_tenant OR NOT osv_is_staff(p_tenant, a.office_id, p_actor) THEN RETURN 'Article not found.'; END IF;
     IF p_expected IS DISTINCT FROM a.version THEN RETURN 'This article changed since you opened it. Refresh and try again.'; END IF;
     v_id := a.id;
     IF p_step = 'edit' THEN
       IF a.author_id <> p_actor THEN RETURN 'Only the author edits a draft.'; END IF;
       IF a.state <> 'draft' THEN RETURN 'Only drafts can be edited. Published text changes through a revision.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_body, ''))) < 40 THEN RETURN 'Write a title (5+ characters) and the answer (40+ characters).'; END IF;
       UPDATE osv_articles SET title = trim(p_title), body = trim(p_body) WHERE id = a.id; v_to := 'draft';
     ELSIF p_step = 'submit' THEN
       IF a.author_id <> p_actor THEN RETURN 'Only the author submits it.'; END IF;
       IF a.state <> 'draft' THEN RETURN 'Only drafts are submitted.'; END IF;
       UPDATE osv_articles SET state = 'in_review' WHERE id = a.id; v_to := 'in_review';
     ELSIF p_step IN ('publish', 'return') THEN
       IF a.author_id = p_actor THEN RETURN 'You wrote this article, so another staff member reviews it.'; END IF;
       IF a.state <> 'in_review' THEN RETURN 'This article is not waiting for review.'; END IF;
       IF p_seen IS DISTINCT FROM osv_text_hash(a.title, a.body) THEN RETURN 'The text changed since you opened it. Reload and review again.'; END IF;
       IF p_step = 'return' THEN
         IF length(n) < 5 THEN RETURN 'Say what needs changing.'; END IF;
         UPDATE osv_articles SET state = 'draft', review_note = n WHERE id = a.id; v_to := 'draft';
       ELSE
         UPDATE osv_articles SET state = 'published', reviewer_id = p_actor, review_note = n, published_at = now() WHERE id = a.id; v_to := 'published';
         IF a.supersedes IS NOT NULL THEN
           UPDATE osv_articles SET state = 'retired', version = version + 1, updated_at = now() WHERE id = a.supersedes AND state = 'published';
           INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'article', a.supersedes, 'superseded', 'retired', p_actor, 'by ' || a.id);
         END IF;
       END IF;
     ELSIF p_step = 'revise' THEN
       IF a.state <> 'published' THEN RETURN 'Only a published article is revised.'; END IF;
       IF EXISTS (SELECT 1 FROM osv_articles WHERE supersedes = a.id AND state IN ('draft','in_review')) THEN RETURN 'A revision of this article is already open.'; END IF;
       INSERT INTO osv_articles (tenant_id, office_id, title, body, author_id, supersedes) VALUES (p_tenant, a.office_id, a.title, a.body, p_actor, a.id) RETURNING id INTO v_id;
       INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'article', v_id, 'revise', 'draft', p_actor, 'of ' || a.id);
       RETURN 'ok:' || v_id;
     ELSIF p_step = 'retire' THEN
       IF NOT osv_is_lead(p_tenant, a.office_id, p_actor) THEN RETURN 'Only the office lead retires an article.'; END IF;
       IF a.state <> 'published' THEN RETURN 'Only a published article is retired.'; END IF;
       IF length(n) < 5 THEN RETURN 'Say why it is retired.'; END IF;
       UPDATE osv_articles SET state = 'retired' WHERE id = a.id; v_to := 'retired';
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE osv_articles SET version = version + 1, updated_at = now() WHERE id = a.id;
     INSERT INTO osv_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'article', a.id, p_step, v_to, p_actor, left(n, 600));
     RETURN 'ok:' || v_id;
   END $$`,
];
