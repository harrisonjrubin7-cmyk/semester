// Migration cna-001: community announcements (role app "Community Manager": announcements). Builds on cmy-001 (cmy_staff,
// cmy_communities). Membership stays on the Zite group; the endpoint checks it before a member reads or acknowledges.
// - A community manager drafts an announcement for 1 to 20 active communities of the institution, with an optional schedule
//   (at most 30 days ahead) and expiry (at most 90 days after it goes live).
// - Sending to more than one community, or marking it important, needs a second manager to approve the exact text (hash).
// - Once live, the text is never edited: a manager appends a correction, which members see. Withdrawing needs a reason.
// - "Must acknowledge" announcements record each member's acknowledgement once; managers see counts, not a list.
// - In-app only: nothing is emailed or pushed from here. History is append-only.
export const CNA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cna_announcements (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_ids text[] NOT NULL CHECK (cardinality(group_ids) BETWEEN 1 AND 20),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 4 AND 140), body text NOT NULL CHECK (length(trim(body)) BETWEEN 10 AND 8000), body_hash text NOT NULL,
     important boolean NOT NULL DEFAULT false, must_ack boolean NOT NULL DEFAULT false, publish_at timestamptz, expires_at timestamptz,
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'pending_approval', 'approved', 'withdrawn')), author_id text NOT NULL, approver_id text,
     withdrawn_reason text, corrections jsonb NOT NULL DEFAULT '[]', rev int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approver_id IS NULL OR approver_id <> author_id),
     CHECK (state <> 'approved' OR publish_at IS NOT NULL),
     CHECK (state <> 'approved' OR (cardinality(group_ids) = 1 AND NOT important) OR approver_id IS NOT NULL),
     CHECK (expires_at IS NULL OR publish_at IS NULL OR (expires_at > publish_at AND expires_at <= publish_at + interval '90 days')))`,
  `CREATE TABLE IF NOT EXISTS cna_acks (announcement_id bigint NOT NULL REFERENCES cna_announcements(id), user_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (announcement_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS cna_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, announcement_id bigint, actor_id text NOT NULL, step text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cna_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cna_events_append_only') THEN
       CREATE TRIGGER cna_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cna_events FOR EACH STATEMENT EXECUTE FUNCTION cna_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION cna_needs_second(a cna_announcements) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT cardinality(a.group_ids) > 1 OR a.important $$`,
  // Live now: approved, published, not expired, not withdrawn.
  `CREATE OR REPLACE FUNCTION cna_live(a cna_announcements) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT a.state = 'approved' AND a.publish_at <= now() AND (a.expires_at IS NULL OR a.expires_at > now()) $$`,
  `CREATE OR REPLACE FUNCTION cna_step(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_groups text[], p_title text, p_body text,
     p_important boolean, p_must_ack boolean, p_publish timestamptz, p_expires timestamptz, p_seen text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a cna_announcements; v_id bigint; bad int; v_pub timestamptz;
   BEGIN
     IF NOT cmy_is_staff(p_tenant, p_actor) THEN RETURN 'Only a community manager posts announcements.'; END IF;
     IF p_step IN ('draft', 'edit') THEN
       IF p_groups IS NULL OR cardinality(p_groups) NOT BETWEEN 1 AND 20 THEN RETURN 'Choose 1 to 20 communities.'; END IF;
       SELECT count(*) INTO bad FROM unnest(p_groups) g WHERE NOT EXISTS (SELECT 1 FROM cmy_communities c WHERE c.group_id = g AND c.tenant_id = p_tenant AND c.state = 'active');
       IF bad > 0 THEN RETURN 'Announcements go only to active communities set up at your institution.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 4 OR length(trim(coalesce(p_body, ''))) < 10 THEN RETURN 'Give a title and the announcement text.'; END IF;
       IF p_publish IS NOT NULL AND p_publish > now() + interval '30 days' THEN RETURN 'Schedule at most 30 days ahead.'; END IF;
       v_pub := greatest(coalesce(p_publish, now()), now());
       IF p_expires IS NOT NULL AND (p_expires <= v_pub OR p_expires > v_pub + interval '90 days') THEN RETURN 'An announcement expires after it goes live and within 90 days.'; END IF;
     END IF;
     IF p_step = 'draft' THEN
       INSERT INTO cna_announcements (tenant_id, group_ids, title, body, body_hash, important, must_ack, publish_at, expires_at, author_id)
         VALUES (p_tenant, (SELECT array_agg(DISTINCT g) FROM unnest(p_groups) g), trim(p_title), trim(p_body), md5(trim(p_title) || '|' || trim(p_body) || '|' || array_to_string(p_groups, ',') || '|' || coalesce(p_important, false)),
           coalesce(p_important, false), coalesce(p_must_ack, false), p_publish, p_expires, p_actor) RETURNING id INTO v_id;
       INSERT INTO cna_events (tenant_id, announcement_id, actor_id, step) VALUES (p_tenant, v_id, p_actor, 'draft');
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO a FROM cna_announcements WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR a.tenant_id <> p_tenant THEN RETURN 'Announcement not found.'; END IF;
     IF a.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this announcement. Reload and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF a.state NOT IN ('draft', 'pending_approval') THEN RETURN 'A published announcement is not edited. Add a correction instead.'; END IF;
       UPDATE cna_announcements SET group_ids = (SELECT array_agg(DISTINCT g) FROM unnest(p_groups) g), title = trim(p_title), body = trim(p_body),
         body_hash = md5(trim(p_title) || '|' || trim(p_body) || '|' || array_to_string(p_groups, ',') || '|' || coalesce(p_important, false)), important = coalesce(p_important, false), must_ack = coalesce(p_must_ack, false),
         publish_at = p_publish, expires_at = p_expires, author_id = p_actor, approver_id = NULL, state = 'draft', rev = rev + 1, updated_at = now() WHERE id = a.id;
     ELSIF p_step = 'submit' THEN
       IF a.state <> 'draft' THEN RETURN 'Only a draft is submitted.'; END IF;
       IF a.author_id <> p_actor THEN RETURN 'The author submits their own draft.'; END IF;
       IF cna_needs_second(a) THEN
         UPDATE cna_announcements SET state = 'pending_approval', rev = rev + 1, updated_at = now() WHERE id = a.id;
       ELSE
         UPDATE cna_announcements SET state = 'approved', publish_at = greatest(coalesce(publish_at, now()), now()), rev = rev + 1, updated_at = now() WHERE id = a.id;
       END IF;
     ELSIF p_step = 'approve' THEN
       IF a.state <> 'pending_approval' THEN RETURN 'This announcement is not waiting for approval.'; END IF;
       IF a.author_id = p_actor THEN RETURN 'You wrote this, so another community manager approves it.'; END IF;
       IF p_seen IS DISTINCT FROM a.body_hash THEN RETURN 'The announcement changed since you opened it. Reload and read it again.'; END IF;
       IF a.expires_at IS NOT NULL AND a.expires_at <= now() THEN RETURN 'This announcement would already have expired. Edit the dates.'; END IF;
       UPDATE cna_announcements SET state = 'approved', approver_id = p_actor, publish_at = greatest(coalesce(publish_at, now()), now()), rev = rev + 1, updated_at = now() WHERE id = a.id;
     ELSIF p_step = 'correct' THEN
       IF a.state <> 'approved' THEN RETURN 'Only a published announcement takes corrections.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Write the correction (10+ characters).'; END IF;
       UPDATE cna_announcements SET corrections = corrections || jsonb_build_array(jsonb_build_object('text', trim(p_text), 'by', p_actor, 'at', now())), rev = rev + 1, updated_at = now() WHERE id = a.id;
     ELSIF p_step = 'withdraw' THEN
       IF a.state = 'withdrawn' THEN RETURN 'Already withdrawn.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
       UPDATE cna_announcements SET state = 'withdrawn', withdrawn_reason = trim(p_text), rev = rev + 1, updated_at = now() WHERE id = a.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO cna_events (tenant_id, announcement_id, actor_id, step, detail) VALUES (p_tenant, a.id, p_actor, p_step, left(coalesce(p_text, ''), 500));
     RETURN 'ok:' || a.id;
   END $$`,
  // Member acknowledgement. p_member_of lists the caller's community group ids, read from Zite by the endpoint.
  `CREATE OR REPLACE FUNCTION cna_ack(p_tenant text, p_user text, p_id bigint, p_member_of text[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a cna_announcements;
   BEGIN
     SELECT * INTO a FROM cna_announcements WHERE id = p_id;
     IF NOT FOUND OR a.tenant_id <> p_tenant OR NOT (a.group_ids && coalesce(p_member_of, '{}')) OR NOT cna_live(a) THEN RETURN 'Announcement not found.'; END IF;
     IF NOT a.must_ack THEN RETURN 'This announcement does not ask for acknowledgement.'; END IF;
     INSERT INTO cna_acks (announcement_id, user_id) VALUES (a.id, p_user) ON CONFLICT DO NOTHING;
     RETURN NULL;
   END $$`,
];
