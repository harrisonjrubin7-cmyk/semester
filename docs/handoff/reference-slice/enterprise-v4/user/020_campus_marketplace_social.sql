-- 020_campus_marketplace_social.sql: opportunity marketplace, clubs, applications, events, feed and messaging (Campus Marketplace +
-- Campus Platform Blueprint PDFs, 6 Oct). Schema semester, after 017. NOT executed or parsed. Same conventions as 014–017.
BEGIN;
SET LOCAL search_path = semester, public;
SET LOCAL lock_timeout = '5s';

CREATE TABLE organizations (tenant_id uuid NOT NULL REFERENCES institutions(id), id uuid NOT NULL DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('office', 'club', 'employer', 'partner')), name text NOT NULL,
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('institution', 'partner', 'student', 'unverified')), verified_by uuid, verified_at timestamptz, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  PRIMARY KEY (tenant_id, id), CHECK (verification IN ('student', 'unverified') OR verified_by IS NOT NULL));
CREATE TABLE org_officers (tenant_id uuid NOT NULL, org_id uuid NOT NULL, person_id uuid NOT NULL, role text NOT NULL, starts_on date NOT NULL, ends_on date, PRIMARY KEY (tenant_id, org_id, person_id, role),
  FOREIGN KEY (tenant_id, org_id) REFERENCES organizations(tenant_id, id), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));
CREATE TABLE org_memberships (tenant_id uuid NOT NULL, org_id uuid NOT NULL, person_id uuid NOT NULL, status text NOT NULL CHECK (status IN ('following', 'requested', 'member', 'declined', 'left')), joined_at timestamptz,
  PRIMARY KEY (tenant_id, org_id, person_id), FOREIGN KEY (tenant_id, org_id) REFERENCES organizations(tenant_id, id), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));

CREATE TABLE listings (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('job', 'internship', 'study_abroad', 'club', 'event', 'service', 'peer', 'housing', 'deal')),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'returned', 'rejected', 'approved', 'published', 'paused', 'filled', 'expired', 'archived')),
  current_version integer NOT NULL DEFAULT 1, external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'), reviewed_by uuid, reviewed_at timestamptz, expires_at timestamptz,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, org_id) REFERENCES organizations(tenant_id, id),
  CHECK (state NOT IN ('approved', 'published') OR reviewed_by IS NOT NULL), CHECK (state <> 'published' OR expires_at IS NOT NULL));
CREATE TABLE listing_versions (tenant_id uuid NOT NULL, listing_id uuid NOT NULL, version integer NOT NULL, title text NOT NULL, summary text NOT NULL, location text, accessibility text,
  eligibility jsonb NOT NULL DEFAULT '{}', disclosures jsonb NOT NULL DEFAULT '{}',   -- compensation, fees, credit, travel/risk, external handling
  deadline_at timestamptz, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, listing_id, version), FOREIGN KEY (tenant_id, listing_id) REFERENCES listings(tenant_id, id));
CREATE TRIGGER listing_versions_append_only BEFORE UPDATE OR DELETE ON listing_versions FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();
CREATE TABLE listing_risk_flags (tenant_id uuid NOT NULL, listing_id uuid NOT NULL, flag text NOT NULL CHECK (flag IN ('off_platform_payment', 'deposit_request', 'personal_financial_data', 'contract_cheating', 'unverified_employer', 'high_risk_travel')), raised_by text NOT NULL, resolved_at timestamptz,
  PRIMARY KEY (tenant_id, listing_id, flag), FOREIGN KEY (tenant_id, listing_id) REFERENCES listings(tenant_id, id));

-- Applications: one builder for jobs, internships, study abroad and selective clubs.
CREATE TABLE application_forms (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, version integer NOT NULL, questions jsonb NOT NULL, blind_review boolean NOT NULL DEFAULT false, rubric jsonb, published_at timestamptz,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, listing_id, version), FOREIGN KEY (tenant_id, listing_id) REFERENCES listings(tenant_id, id));
CREATE TABLE opportunity_applications (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), form_id uuid NOT NULL, person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'eligibility_review', 'under_review', 'interviewing', 'nominated', 'external_application', 'accepted', 'committed', 'pre_departure', 'abroad', 'returned', 'waitlisted', 'declined', 'withdrawn', 'appealed')),   -- study abroad: nominated → provider application → accepted → committed (deposit) → pre-departure → abroad → returned
  answers jsonb NOT NULL DEFAULT '{}', submitted_at timestamptz, decision_reason text, version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, form_id, person_id), FOREIGN KEY (tenant_id, form_id) REFERENCES application_forms(tenant_id, id), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id),
  CHECK (status NOT IN ('declined') OR decision_reason IS NOT NULL));               -- no rejection without a visible reason (and an appeal route)
CREATE TABLE application_reviews2 (tenant_id uuid NOT NULL, application_id uuid NOT NULL, reviewer_person_id uuid NOT NULL, scores jsonb NOT NULL, recommendation text CHECK (recommendation IN ('accept', 'waitlist', 'decline')), conflict_declared boolean NOT NULL DEFAULT false, submitted_at timestamptz,
  PRIMARY KEY (tenant_id, application_id, reviewer_person_id), FOREIGN KEY (tenant_id, application_id) REFERENCES opportunity_applications(tenant_id, id));

CREATE TABLE campus_events (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, capacity integer CHECK (capacity > 0), PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, listing_id) REFERENCES listings(tenant_id, id), CHECK (ends_at > starts_at));
CREATE TABLE event_rsvps (tenant_id uuid NOT NULL, event_id uuid NOT NULL, person_id uuid NOT NULL, status text NOT NULL CHECK (status IN ('going', 'waitlisted', 'cancelled')), position integer, checked_in_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_id, person_id), FOREIGN KEY (tenant_id, event_id) REFERENCES campus_events(tenant_id, id));
CREATE TABLE saved_searches (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), person_id uuid NOT NULL, query jsonb NOT NULL, alert boolean NOT NULL DEFAULT true, PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, person_id) REFERENCES people(tenant_id, id));

-- Feed: approved announcements only; every item carries why it's shown (ranking transparency).
CREATE TABLE feed_items (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), source_org_id uuid, listing_id uuid, audience jsonb NOT NULL, body text NOT NULL, approved_by uuid NOT NULL, published_at timestamptz NOT NULL, expires_at timestamptz,
  PRIMARY KEY (tenant_id, id));
CREATE TABLE feed_deliveries (tenant_id uuid NOT NULL, item_id uuid NOT NULL, person_id uuid NOT NULL, reason text NOT NULL, seen_at timestamptz, PRIMARY KEY (tenant_id, item_id, person_id));   -- "shown because you saved 'product design'"

-- Messaging: conversations need an opt-in or an application; moderation is a separate case, not message reading.
CREATE TABLE conversations (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('direct', 'org', 'application', 'support')), org_id uuid, application_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id), CHECK (kind <> 'application' OR application_id IS NOT NULL));
CREATE TABLE conversation_members (tenant_id uuid NOT NULL, conversation_id uuid NOT NULL, person_id uuid NOT NULL, opted_in_at timestamptz NOT NULL, muted boolean NOT NULL DEFAULT false, left_at timestamptz,
  PRIMARY KEY (tenant_id, conversation_id, person_id), FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id));
CREATE TABLE messages (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL, sender_person_id uuid NOT NULL, body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000), sent_at timestamptz NOT NULL DEFAULT now(), hidden_by_moderation_at timestamptz,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id));
CREATE TABLE moderation_reports (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), reporter_person_id uuid NOT NULL, target_type text NOT NULL CHECK (target_type IN ('listing', 'message', 'org', 'person')), target_id uuid NOT NULL, reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed', 'appealed')), decided_by uuid, PRIMARY KEY (tenant_id, id));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['organizations', 'org_officers', 'org_memberships', 'listings', 'listing_versions', 'listing_risk_flags', 'application_forms', 'opportunity_applications', 'application_reviews2', 'campus_events', 'event_rsvps', 'saved_searches', 'feed_items', 'feed_deliveries', 'conversations', 'conversation_members', 'messages', 'moderation_reports'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
GRANT SELECT ON semester.organizations, semester.listings, semester.listing_versions, semester.campus_events, semester.opportunity_applications, semester.event_rsvps, semester.saved_searches, semester.org_memberships, semester.feed_deliveries, semester.feed_items, semester.messages, semester.conversation_members TO authenticated;
CREATE POLICY published ON semester.listings FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND state = 'published' AND expires_at > now());
CREATE POLICY published ON semester.listing_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.listings l WHERE l.tenant_id = listing_versions.tenant_id AND l.id = listing_versions.listing_id AND l.state = 'published' AND l.current_version = listing_versions.version AND semester.is_member(l.tenant_id)));
CREATE POLICY directory ON semester.organizations FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'active');
CREATE POLICY members ON semester.campus_events FOR SELECT TO authenticated USING (semester.is_member(tenant_id));
CREATE POLICY own ON semester.opportunity_applications FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.event_rsvps FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.saved_searches FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.org_memberships FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.feed_deliveries FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY delivered ON semester.feed_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.feed_deliveries d WHERE d.tenant_id = feed_items.tenant_id AND d.item_id = feed_items.id AND semester.is_me(d.tenant_id, d.person_id)));
CREATE POLICY participant ON semester.conversation_members FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY participant ON semester.messages FOR SELECT TO authenticated USING (hidden_by_moderation_at IS NULL AND EXISTS (SELECT 1 FROM semester.conversation_members m WHERE m.tenant_id = messages.tenant_id AND m.conversation_id = messages.conversation_id AND m.left_at IS NULL AND semester.is_me(m.tenant_id, m.person_id)));
-- Community and social records (feed, messages, memberships, RSVPs) are a separate dataset from education records: never joined into
-- advising, grading or risk views, and never exported with academic data without their own classification and basis.
-- Reviewers, officers and moderators read through commands that call authorize() with an assignment; blind review strips identity in the command.
COMMIT;
