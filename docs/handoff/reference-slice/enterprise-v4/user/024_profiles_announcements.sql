-- 024_profiles_announcements.sql: profiles with field-level visibility, portfolio, official announcements with audience routing, and
-- message read state (intercom & messaging architecture PDF, 6 Oct). Schema semester, after 023; extends 020's conversations/messages
-- and 022's notifications. NOT executed or parsed.
BEGIN;
SET LOCAL search_path = semester, public;
CREATE TABLE profiles (tenant_id uuid NOT NULL, person_id uuid NOT NULL, headline text CHECK (length(headline) <= 200), pronouns text CHECK (length(pronouns) <= 40), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));
CREATE TABLE profile_visibility_rules (tenant_id uuid NOT NULL, person_id uuid NOT NULL, field text NOT NULL CHECK (field IN ('headline', 'pronouns', 'major', 'email', 'clubs', 'portfolio')),
  audience text NOT NULL DEFAULT 'private' CHECK (audience IN ('private', 'classmates', 'campus', 'link')), PRIMARY KEY (tenant_id, person_id, field),
  FOREIGN KEY (tenant_id, person_id) REFERENCES profiles(tenant_id, person_id));
CREATE TABLE portfolio_items (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), person_id uuid NOT NULL, kind text NOT NULL CHECK (kind IN ('coursework', 'project', 'reflection', 'credential', 'media')), title text NOT NULL,
  document_id uuid, audience text NOT NULL DEFAULT 'private' CHECK (audience IN ('private', 'classmates', 'campus', 'link')), contribution_note text,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, person_id) REFERENCES profiles(tenant_id, person_id));   -- coursework items carry the work, never the grade
CREATE TABLE profile_share_links (tenant_id uuid NOT NULL, token_hash bytea NOT NULL, person_id uuid NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, open_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, token_hash), FOREIGN KEY (tenant_id, person_id) REFERENCES profiles(tenant_id, person_id), CHECK (expires_at <= now() + interval '1 year'));

-- Official announcements: author must hold the publishing permission for every audience predicate; routing is evaluated server-side.
CREATE TABLE announcements (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), author_person_id uuid NOT NULL, org_id uuid, title text NOT NULL, body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')), state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'scheduled', 'published', 'withdrawn')),
  publish_at timestamptz, approved_by uuid, PRIMARY KEY (tenant_id, id), CHECK (priority <> 'urgent' OR approved_by IS NOT NULL), CHECK (approved_by IS NULL OR approved_by <> author_person_id));
CREATE TABLE announcement_audiences (tenant_id uuid NOT NULL, announcement_id uuid NOT NULL, kind text NOT NULL CHECK (kind IN ('all', 'role', 'cohort', 'program', 'section', 'housing', 'club', 'person')), ref text,
  PRIMARY KEY (tenant_id, announcement_id, kind, ref), FOREIGN KEY (tenant_id, announcement_id) REFERENCES announcements(tenant_id, id));
CREATE TABLE announcement_receipts (tenant_id uuid NOT NULL, announcement_id uuid NOT NULL, person_id uuid NOT NULL, delivered_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, acknowledged_at timestamptz,
  PRIMARY KEY (tenant_id, announcement_id, person_id), FOREIGN KEY (tenant_id, announcement_id) REFERENCES announcements(tenant_id, id));

-- Messaging read state for 020's conversations (unread cursor per member; per-message receipts optional for small groups only).
ALTER TABLE conversation_members ADD COLUMN last_read_message_id uuid, ADD COLUMN last_read_at timestamptz, ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner', 'office_agent'));
ALTER TABLE messages ADD COLUMN reply_to_id uuid, ADD COLUMN edited_at timestamptz, ADD COLUMN deleted_at timestamptz, ADD COLUMN client_message_id uuid,
  ADD CONSTRAINT messages_client_dedupe UNIQUE (tenant_id, conversation_id, sender_person_id, client_message_id);   -- resend over a flaky socket is idempotent
CREATE TABLE message_attachments (tenant_id uuid NOT NULL, message_id uuid NOT NULL, document_id uuid NOT NULL, scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'quarantined')),
  PRIMARY KEY (tenant_id, message_id, document_id));   -- served only after scan = clean, through expiring signed URLs

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'profile_visibility_rules', 'portfolio_items', 'profile_share_links', 'announcements', 'announcement_audiences', 'announcement_receipts', 'message_attachments'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
GRANT SELECT ON semester.profiles, semester.profile_visibility_rules, semester.portfolio_items, semester.announcements, semester.announcement_receipts TO authenticated;
CREATE POLICY own ON semester.profiles FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.profile_visibility_rules FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.portfolio_items FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY campus ON semester.portfolio_items FOR SELECT TO authenticated USING (audience = 'campus' AND semester.is_member(tenant_id));
CREATE POLICY own ON semester.announcement_receipts FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY received ON semester.announcements FOR SELECT TO authenticated USING (state = 'published' AND EXISTS (SELECT 1 FROM semester.announcement_receipts r WHERE r.tenant_id = announcements.tenant_id AND r.announcement_id = announcements.id AND semester.is_me(r.tenant_id, r.person_id)));
-- Other people's profiles are read through a view-model function that applies profile_visibility_rules field by field
-- (classmates = shares an enrolled section; link = valid unexpired share token), never by a broad table policy.
COMMIT;
-- Realtime DM protocol (server notes): clients subscribe per conversation over an authenticated WebSocket (Supabase Realtime channel
-- authorized by the same membership check); messages are sent with client_message_id for idempotency; the server acks with the stored
-- id; typing indicators are ephemeral and never stored; reconnect resumes from last_read_message_id.
