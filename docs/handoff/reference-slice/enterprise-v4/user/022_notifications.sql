-- 022_notifications.sql: event-driven notifications fed by outbox_events (approval-matrix PDF, 6 Oct). Schema semester, after 021.
-- NOT executed or parsed. One worker reads outbox events, resolves recipients through current relationships, dedupes, respects quiet
-- hours and channel preferences, and never puts student-record content in email bodies (links only, read after sign-in).
BEGIN;
SET LOCAL search_path = semester, public;
SET LOCAL lock_timeout = '5s';
CREATE TABLE notification_rules (tenant_id uuid NOT NULL REFERENCES institutions(id), event_type text NOT NULL, recipient_rule text NOT NULL CHECK (recipient_rule IN ('section_chair', 'college_dean', 'registrar_team', 'academic_affairs', 'requester', 'section_instructors', 'enrolled_students', 'subject_person')),
  template_code text NOT NULL, urgent boolean NOT NULL DEFAULT false, PRIMARY KEY (tenant_id, event_type, recipient_rule));
CREATE TABLE notification_preferences (tenant_id uuid NOT NULL, person_id uuid NOT NULL, channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'push')), enabled boolean NOT NULL DEFAULT true, quiet_start time, quiet_end time, daily_limit smallint NOT NULL DEFAULT 10,
  PRIMARY KEY (tenant_id, person_id, channel), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));
CREATE TABLE notifications (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), outbox_event_id uuid NOT NULL, person_id uuid NOT NULL, template_code text NOT NULL, link_path text NOT NULL CHECK (link_path ~ '^/'), urgent boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, outbox_event_id, person_id),                -- dedupe: one notification per event per person
  FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));
CREATE TABLE notification_deliveries (tenant_id uuid NOT NULL, notification_id uuid NOT NULL, channel text NOT NULL, state text NOT NULL CHECK (state IN ('queued', 'deferred_quiet_hours', 'sent', 'failed', 'suppressed_limit', 'suppressed_preference')),
  not_before timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0, provider_message_id text, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, notification_id, channel), FOREIGN KEY (tenant_id, notification_id) REFERENCES notifications(tenant_id, id));
-- Email/push bodies carry the template's generic text plus link_path; record details render only inside the app after authorization.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['notification_rules', 'notification_preferences', 'notifications', 'notification_deliveries'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
GRANT SELECT ON semester.notifications, semester.notification_preferences TO authenticated;
CREATE POLICY own ON semester.notifications FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.notification_preferences FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
-- Seed rules for the schedule workflow (per tenant, via the admin console):
--   registrar.section_submitted → section_chair · chair_approved → college_dean · dean_approved → registrar_team
--   exception_flagged → academic_affairs · returned/denied → requester · published → section_instructors (+ enrolled_students when time/room changed, urgent)
COMMIT;
