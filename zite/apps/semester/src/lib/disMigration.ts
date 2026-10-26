// Migration dis-001: course discussion replies and moderation. Post bodies stay in Zite Messages (the section's
// "Course Discussion" group); these tables add the reply link, the current hidden state and an append-only moderation log.
// Enforced here: a reply's parent must be in the same section; hiding needs a reason; the log cannot change.
// The endpoint decides who is course staff (instructor of record or live delegate) and who is enrolled.
export const DIS_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dis_posts (message_id text PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, author_id text NOT NULL,
     parent_id text REFERENCES dis_posts(message_id), created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS dis_posts_section ON dis_posts (tenant_id, section_id)`,
  `CREATE TABLE IF NOT EXISTS dis_hidden (message_id text PRIMARY KEY REFERENCES dis_posts(message_id), tenant_id text NOT NULL, hidden_by text NOT NULL,
     reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 300), at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS dis_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, message_id text NOT NULL, action text NOT NULL CHECK (action IN ('hide','restore')),
     actor_id text NOT NULL, reason text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dis_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dis_events_append_only') THEN
       CREATE TRIGGER dis_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dis_events FOR EACH STATEMENT EXECUTE FUNCTION dis_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dis_add(p_tenant text, p_section text, p_message text, p_author text, p_parent text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dis_posts WHERE message_id = p_parent AND tenant_id = p_tenant AND section_id = p_section)
       THEN RETURN 'You can only reply to a post in this course.'; END IF;
     INSERT INTO dis_posts (message_id, tenant_id, section_id, author_id, parent_id) VALUES (p_message, p_tenant, p_section, p_author, p_parent);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION dis_moderate(p_tenant text, p_section text, p_message text, p_actor text, p_hide boolean, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p dis_posts;
   BEGIN
     SELECT * INTO p FROM dis_posts WHERE message_id = p_message AND tenant_id = p_tenant AND section_id = p_section FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Post not found in this course.'; END IF;
     IF p_hide THEN
       IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Say why the post is being removed (5+ characters).'; END IF;
       IF EXISTS (SELECT 1 FROM dis_hidden WHERE message_id = p_message) THEN RETURN 'Already removed.'; END IF;
       INSERT INTO dis_hidden (message_id, tenant_id, hidden_by, reason) VALUES (p_message, p_tenant, p_actor, left(trim(p_reason), 300));
     ELSE
       DELETE FROM dis_hidden WHERE message_id = p_message;
       IF NOT FOUND THEN RETURN 'That post is not removed.'; END IF;
     END IF;
     INSERT INTO dis_events (tenant_id, message_id, action, actor_id, reason) VALUES (p_tenant, p_message, CASE WHEN p_hide THEN 'hide' ELSE 'restore' END, p_actor, left(trim(coalesce(p_reason, '')), 300));
     RETURN NULL;
   END $$`,
];
