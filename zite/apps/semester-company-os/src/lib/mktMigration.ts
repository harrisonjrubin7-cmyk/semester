// Migration mkt-001: Marketing and Growth (APP-021). Gate: "exact send/spend approval; consent; no education-record audiences".
// - The only audience source is inbound contacts who consented to contact (CHECK). Education records cannot be an audience.
// - Approval binds the exact content, audience snapshot and spend (content hash); any later edit voids it.
// - Sending is a CHECK-constrained 'disabled' column and there is no send action.
// mkt-002 (29 Oct, Campaign Reviewer claims and launch gating):
// - A campaign declares its claims (price, customer, outcome, certification, security, metric, availability, integration);
//   each must cite an approved, unexpired source of the same kind whose approver recorded publication permission.
// - Submission is refused while the text has claim-like wording and no declared claim, an unsourced claim, or accessibility issues.
// - Approval re-checks claims (a trigger is the backstop) and needs the reviewer's accessibility confirmation; the hash covers claims.
// - Revoking a source voids every approval that cites it. A launch check records blockers; even a clean check sends nothing.
// Every step is one mkt_cmd() call = one transaction (change, version, timeline, receipt). Requires co_has() from lib/coRoles.ts.
export const MKT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS mkt_campaigns (id text PRIMARY KEY, number serial, name text NOT NULL,
     channel text NOT NULL CHECK (channel IN ('email', 'event', 'social')), goal text NOT NULL DEFAULT '', subject text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '',
     audience_rule text NOT NULL DEFAULT 'consented_inbound' CHECK (audience_rule = 'consented_inbound'), audience_size int,
     spend_minor bigint NOT NULL DEFAULT 0 CHECK (spend_minor >= 0),
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in_review', 'approved', 'rejected')),
     author_id text NOT NULL, approved_by text, approved_hash text, approved_at timestamptz, review_note text,
     sending text NOT NULL DEFAULT 'disabled' CHECK (sending = 'disabled'),
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> author_id))`,
  `CREATE TABLE IF NOT EXISTS mkt_commands (actor_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS mkt_receipts (actor_id text NOT NULL, command_key text NOT NULL, campaign_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (actor_id, command_key), FOREIGN KEY (actor_id, command_key) REFERENCES mkt_commands (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS mkt_timeline (id bigserial PRIMARY KEY, campaign_id text NOT NULL REFERENCES mkt_campaigns(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION mkt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS mkt_timeline_append_only ON mkt_timeline`,
  `CREATE TRIGGER mkt_timeline_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mkt_timeline FOR EACH STATEMENT EXECUTE FUNCTION mkt_refuse_change()`,
  `DROP TRIGGER IF EXISTS mkt_receipts_append_only ON mkt_receipts`,
  `CREATE TRIGGER mkt_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mkt_receipts FOR EACH STATEMENT EXECUTE FUNCTION mkt_refuse_change()`,
  `CREATE TABLE IF NOT EXISTS mkt_sources (id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('price', 'customer', 'outcome', 'certification', 'security', 'metric', 'availability', 'integration')),
     title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160), reference text NOT NULL CHECK (length(reference) >= 8), permission_note text NOT NULL DEFAULT '', expires_on date,
     state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'revoked')),
     proposed_by text NOT NULL, approved_by text, approved_at timestamptz, revoked_by text, revoked_at timestamptz, revoke_reason text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> proposed_by),
     CHECK (state <> 'approved' OR (approved_by IS NOT NULL AND length(permission_note) >= 10)))`,
  `CREATE TABLE IF NOT EXISTS mkt_claims (id bigserial PRIMARY KEY, campaign_id text NOT NULL REFERENCES mkt_campaigns(id), kind text NOT NULL CHECK (kind IN ('price', 'customer', 'outcome', 'certification', 'security', 'metric', 'availability', 'integration')),
     text text NOT NULL CHECK (length(text) BETWEEN 3 AND 300), source_id text REFERENCES mkt_sources(id), added_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (campaign_id, text))`,
  `CREATE TABLE IF NOT EXISTS mkt_source_events (id bigserial PRIMARY KEY, source_id text NOT NULL REFERENCES mkt_sources(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS mkt_launch_checks (id bigserial PRIMARY KEY, campaign_id text NOT NULL REFERENCES mkt_campaigns(id), actor_id text NOT NULL, hash text NOT NULL,
     blockers text[] NOT NULL, outcome text NOT NULL CHECK (outcome IN ('blocked', 'ready_sending_disabled')), at timestamptz NOT NULL DEFAULT clock_timestamp(),
     CHECK ((outcome = 'blocked') = (cardinality(blockers) > 0)))`,
  `DROP TRIGGER IF EXISTS mkt_source_events_append_only ON mkt_source_events`,
  `CREATE TRIGGER mkt_source_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mkt_source_events FOR EACH STATEMENT EXECUTE FUNCTION mkt_refuse_change()`,
  `DROP TRIGGER IF EXISTS mkt_launch_checks_append_only ON mkt_launch_checks`,
  `CREATE TRIGGER mkt_launch_checks_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mkt_launch_checks FOR EACH STATEMENT EXECUTE FUNCTION mkt_refuse_change()`,
  `CREATE OR REPLACE FUNCTION mkt_source_ok(p_id text, p_kind text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM mkt_sources s WHERE s.id = p_id AND s.kind = p_kind AND s.state = 'approved' AND (s.expires_on IS NULL OR s.expires_on >= current_date)) $$`,
  `CREATE OR REPLACE FUNCTION mkt_claim_blockers(p_campaign text) RETURNS text[] LANGUAGE sql STABLE AS $$
     SELECT coalesce(array_agg(CASE WHEN k.source_id IS NULL THEN 'Claim "' || k.text || '" cites no source.'
       ELSE 'Claim "' || k.text || '": its source is not an approved, current ' || k.kind || ' source.' END ORDER BY k.id), '{}')
     FROM mkt_claims k WHERE k.campaign_id = p_campaign AND (k.source_id IS NULL OR NOT mkt_source_ok(k.source_id, k.kind)) $$`,
  `CREATE OR REPLACE FUNCTION mkt_hints(p_text text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
     SELECT coalesce(array_agg(DISTINCT lower(m[1])), '{}') FROM regexp_matches(coalesce(p_text, ''),
       '([0-9]+(?:[.][0-9]+)?[[:space:]]?%|[$][[:space:]]?[0-9][0-9,.]*|[[:<:]](?:certified|certification|compliant|soc ?2|iso ?27001|guarantee[ds]?|award[- ]winning|trusted by|customers|clients|uptime|integrates with|encrypted)[[:>:]]|#1|number one)', 'gi') AS m $$`,
  `CREATE OR REPLACE FUNCTION mkt_a11y(p_text text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
     SELECT array_remove(ARRAY[
       CASE WHEN p_text ~* '[[:<:]](click here|read more|learn more here)[[:>:]]' THEN 'Link text must say where it goes, not "click here" or "read more".' END,
       CASE WHEN p_text ~ '![[][[:space:]]*[]][(]' THEN 'Every image needs alternative text.' END,
       CASE WHEN p_text ~ '[A-Z][A-Z ]{24,}[A-Z]' THEN 'Long runs of capital letters are hard to read; use sentence case.' END], NULL) $$`,
  `CREATE OR REPLACE FUNCTION mkt_guard_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF NEW.state = 'approved' AND OLD.state IS DISTINCT FROM 'approved' AND cardinality(mkt_claim_blockers(NEW.id)) > 0 THEN
       RAISE EXCEPTION 'UNSOURCED_CLAIM' USING ERRCODE = 'check_violation'; END IF;
     RETURN NEW; END $$`,
  `DROP TRIGGER IF EXISTS mkt_campaigns_claims_sourced ON mkt_campaigns`,
  `CREATE TRIGGER mkt_campaigns_claims_sourced BEFORE UPDATE ON mkt_campaigns FOR EACH ROW EXECUTE FUNCTION mkt_guard_approval()`,
  `CREATE OR REPLACE FUNCTION mkt_hash(c mkt_campaigns) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT md5(concat_ws('|', c.name, c.channel, c.subject, c.body, c.audience_rule, coalesce(c.audience_size, -1), c.spend_minor,
       (SELECT string_agg(k.kind || ':' || k.text || ':' || coalesce(k.source_id, ''), ';' ORDER BY k.text) FROM mkt_claims k WHERE k.campaign_id = c.id))) $$`,
  `CREATE OR REPLACE FUNCTION mkt_cmd(p_actor text, p_key text, p_hash text, p_action text, p_id text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c mkt_commands%ROWTYPE; m mkt_campaigns%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_id; v_detail text := '';
BEGIN
  SELECT * INTO c FROM mkt_commands WHERE actor_id = p_actor AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'id', campaign_id, 'resultCode', result_code, 'message', message) FROM mkt_receipts WHERE actor_id = p_actor AND command_key = p_key);
  END IF;
  INSERT INTO mkt_commands (actor_id, command_key, payload_hash, action) VALUES (p_actor, p_key, p_hash, p_action);

  IF p_action = 'create' THEN
    IF NOT co_has(p_actor, 'marketer') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Creating campaigns needs the marketer role.';
    ELSIF length(trim(coalesce(p->>'name', ''))) NOT BETWEEN 3 AND 120 THEN v_code := 'BAD_INPUT'; v_msg := 'Name the campaign (3 to 120 characters).';
    ELSIF coalesce(p->>'channel', '') NOT IN ('email', 'event', 'social') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose email, event or social.';
    ELSE
      v_id := 'cmp_' || substr(md5(p_actor || '|' || p_key), 1, 12);
      INSERT INTO mkt_campaigns (id, name, channel, goal, author_id) VALUES (v_id, trim(p->>'name'), p->>'channel', coalesce(p->>'goal', ''), p_actor);
      v_msg := 'Draft campaign created.'; v_detail := trim(p->>'name');
    END IF;
  ELSE
    SELECT * INTO m FROM mkt_campaigns WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN v_code := 'NOT_FOUND'; v_msg := 'Campaign not found.';
    ELSIF (p->>'version')::int IS DISTINCT FROM m.version THEN v_code := 'STALE'; v_msg := 'This campaign changed since you opened it. Reload and try again.';
    ELSIF p_action = 'edit' THEN
      IF p_actor <> m.author_id OR NOT co_has(p_actor, 'marketer') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the campaign author (a marketer) edits it.';
      ELSIF m.state = 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'Withdraw it from review before editing.';
      ELSIF coalesce((p->>'spendMinor')::bigint, 0) < 0 THEN v_code := 'BAD_INPUT'; v_msg := 'Spend cannot be negative.';
      ELSE
        UPDATE mkt_campaigns SET subject = coalesce(p->>'subject', subject), body = coalesce(p->>'body', body), goal = coalesce(p->>'goal', goal),
          spend_minor = coalesce((p->>'spendMinor')::bigint, spend_minor),
          state = 'draft', approved_by = NULL, approved_hash = NULL, approved_at = NULL WHERE id = m.id;
        v_msg := CASE WHEN m.state = 'approved' THEN 'Saved. The approval no longer applies because the content changed; submit it for approval again.' ELSE 'Saved.' END;
        v_detail := CASE WHEN m.state = 'approved' THEN 'approval voided by edit' ELSE '' END;
      END IF;
    ELSIF p_action IN ('claim_add', 'claim_remove') THEN
      IF p_actor <> m.author_id OR NOT co_has(p_actor, 'marketer') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the campaign author (a marketer) changes its claims.';
      ELSIF m.state = 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'Withdraw it from review before changing claims.';
      ELSIF p_action = 'claim_add' AND coalesce(p->>'kind', '') NOT IN ('price', 'customer', 'outcome', 'certification', 'security', 'metric', 'availability', 'integration') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose what kind of claim this is.';
      ELSIF p_action = 'claim_add' AND length(trim(coalesce(p->>'text', ''))) NOT BETWEEN 3 AND 300 THEN v_code := 'BAD_INPUT'; v_msg := 'Quote the claim exactly as it appears (3 to 300 characters).';
      ELSIF p_action = 'claim_add' AND EXISTS (SELECT 1 FROM mkt_claims WHERE campaign_id = m.id AND text = trim(p->>'text')) THEN v_code := 'BAD_INPUT'; v_msg := 'That claim is already listed.';
      ELSIF p_action = 'claim_add' AND p->>'sourceId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mkt_sources WHERE id = p->>'sourceId') THEN v_code := 'NOT_FOUND'; v_msg := 'Source not found.';
      ELSIF p_action = 'claim_remove' AND NOT EXISTS (SELECT 1 FROM mkt_claims WHERE id = (p->>'claimId')::bigint AND campaign_id = m.id) THEN v_code := 'NOT_FOUND'; v_msg := 'Claim not found on this campaign.';
      ELSE
        IF p_action = 'claim_add' THEN
          INSERT INTO mkt_claims (campaign_id, kind, text, source_id, added_by) VALUES (m.id, p->>'kind', trim(p->>'text'), p->>'sourceId', p_actor);
          v_detail := p->>'kind' || ': ' || trim(p->>'text');
        ELSE
          SELECT kind || ': ' || text INTO v_detail FROM mkt_claims WHERE id = (p->>'claimId')::bigint;
          DELETE FROM mkt_claims WHERE id = (p->>'claimId')::bigint;
        END IF;
        UPDATE mkt_campaigns SET state = 'draft', approved_by = NULL, approved_hash = NULL, approved_at = NULL WHERE id = m.id;
        v_msg := CASE WHEN m.state = 'approved' THEN 'Claims changed, so the approval no longer applies; submit it again.' ELSE 'Claims updated.' END;
        IF m.state = 'approved' THEN v_detail := v_detail || ' (approval voided)'; END IF;
      END IF;
    ELSIF p_action = 'submit' THEN
      IF p_actor <> m.author_id THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author submits a campaign.';
      ELSIF m.state NOT IN ('draft', 'rejected') THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be submitted.';
      ELSIF length(trim(m.subject)) < 5 OR length(trim(m.body)) < 40 THEN v_code := 'BAD_INPUT'; v_msg := 'Write a subject (5+ characters) and body (40+ characters) first.';
      ELSIF m.channel = 'email' AND position('{{unsubscribe}}' IN m.body) = 0 THEN v_code := 'BAD_INPUT'; v_msg := 'Email campaigns must include the {{unsubscribe}} link.';
      ELSIF coalesce((p->>'audienceSize')::int, 0) < 1 THEN v_code := 'NO_AUDIENCE'; v_msg := 'No contacts have consented to contact, so there is no one to reach.';
      ELSIF cardinality(mkt_hints(m.subject || ' ' || m.body)) > 0 AND NOT EXISTS (SELECT 1 FROM mkt_claims WHERE campaign_id = m.id) THEN v_code := 'UNDECLARED_CLAIM';
        v_msg := 'The text reads like a claim (' || array_to_string(mkt_hints(m.subject || ' ' || m.body), ', ') || '). List each claim with its approved source, or remove the wording.';
      ELSIF cardinality(mkt_claim_blockers(m.id)) > 0 THEN v_code := 'UNSOURCED_CLAIM'; v_msg := array_to_string(mkt_claim_blockers(m.id), ' ');
      ELSIF cardinality(mkt_a11y(m.subject || ' ' || m.body)) > 0 THEN v_code := 'ACCESSIBILITY'; v_msg := array_to_string(mkt_a11y(m.subject || ' ' || m.body), ' ');
      ELSE UPDATE mkt_campaigns SET state = 'in_review', audience_size = (p->>'audienceSize')::int WHERE id = m.id;
        v_msg := 'Submitted for approval with an audience of ' || (p->>'audienceSize') || ' consented contacts.'; v_detail := 'audience ' || (p->>'audienceSize');
      END IF;
    ELSIF p_action IN ('approve', 'reject') THEN
      IF NOT co_has(p_actor, 'marketing_approver') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Reviewing campaigns needs the marketing approver role.';
      ELSIF p_actor = m.author_id THEN v_code := 'SEPARATION_OF_DUTIES'; v_msg := 'You wrote this campaign, so someone else must review it.';
      ELSIF m.state <> 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'This campaign is not awaiting review.';
      ELSIF p->>'seenHash' IS DISTINCT FROM mkt_hash(m) THEN v_code := 'CONTENT_CHANGED'; v_msg := 'The campaign changed since you opened it. Reload and review again.';
      ELSIF p_action = 'reject' AND length(trim(coalesce(p->>'note', ''))) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why it is rejected.';
      ELSIF p_action = 'approve' AND cardinality(mkt_claim_blockers(m.id)) > 0 THEN v_code := 'UNSOURCED_CLAIM'; v_msg := 'Cannot approve: ' || array_to_string(mkt_claim_blockers(m.id), ' ');
      ELSIF p_action = 'approve' AND coalesce(p->>'a11yReviewed', '') <> 'true' THEN v_code := 'BAD_INPUT'; v_msg := 'Confirm you checked headings, link text, image descriptions and contrast before approving.';
      ELSIF p_action = 'approve' THEN
        UPDATE mkt_campaigns SET state = 'approved', approved_by = p_actor, approved_hash = mkt_hash(m), approved_at = now(), review_note = p->>'note' WHERE id = m.id;
        v_msg := 'Approved exactly as shown. Sending is disabled: nothing was sent.'; v_detail := 'hash ' || mkt_hash(m);
      ELSE UPDATE mkt_campaigns SET state = 'rejected', review_note = p->>'note' WHERE id = m.id; v_msg := 'Rejected and returned to the author.'; v_detail := p->>'note';
      END IF;
    ELSIF p_action = 'launch_check' THEN
      IF NOT (co_has(p_actor, 'marketer') OR co_has(p_actor, 'marketing_approver')) THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Launch checks need a marketing role.';
      ELSE
        v_detail := array_to_string(array_remove(ARRAY[
          CASE WHEN m.state <> 'approved' THEN 'It is not approved.' END,
          CASE WHEN m.state = 'approved' AND m.approved_hash IS DISTINCT FROM mkt_hash(m) THEN 'It changed after approval.' END,
          CASE WHEN coalesce((p->>'audienceNow')::int, 0) < 1 THEN 'No one currently consents to contact.' END,
          CASE WHEN m.audience_size IS NOT NULL AND coalesce((p->>'audienceNow')::int, 0) < m.audience_size THEN 'Consent was withdrawn since the audience was approved (' || m.audience_size || ' then, ' || coalesce((p->>'audienceNow')::int, 0) || ' now).' END,
          CASE WHEN cardinality(mkt_claim_blockers(m.id)) > 0 THEN array_to_string(mkt_claim_blockers(m.id), ' ') END,
          CASE WHEN cardinality(mkt_a11y(m.subject || ' ' || m.body)) > 0 THEN array_to_string(mkt_a11y(m.subject || ' ' || m.body), ' ') END], NULL), '|');
        INSERT INTO mkt_launch_checks (campaign_id, actor_id, hash, blockers, outcome) VALUES (m.id, p_actor, mkt_hash(m),
          CASE WHEN v_detail = '' THEN '{}'::text[] ELSE string_to_array(v_detail, '|') END, CASE WHEN v_detail = '' THEN 'ready_sending_disabled' ELSE 'blocked' END);
        v_msg := CASE WHEN v_detail = '' THEN 'Every launch check passes. Sending is disabled in this environment: nothing was sent.' ELSE 'Blocked: ' || replace(v_detail, '|', ' ') END;
        v_detail := CASE WHEN v_detail = '' THEN 'ready (sending disabled)' ELSE 'blocked: ' || replace(v_detail, '|', ' ') END;
      END IF;
    ELSIF p_action = 'withdraw' THEN
      IF p_actor <> m.author_id THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author withdraws a campaign.';
      ELSIF m.state <> 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'Only campaigns in review can be withdrawn.';
      ELSE UPDATE mkt_campaigns SET state = 'draft' WHERE id = m.id; v_msg := 'Withdrawn to draft.'; END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown action.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_action NOT IN ('create', 'launch_check') THEN UPDATE mkt_campaigns SET version = version + 1, updated_at = now() WHERE id = v_id; END IF;
    INSERT INTO mkt_timeline (campaign_id, actor_id, action, detail) VALUES (v_id, p_actor, p_action, v_detail);
  END IF;
  INSERT INTO mkt_receipts (actor_id, command_key, campaign_id, result_code, message) VALUES (p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
  `CREATE OR REPLACE FUNCTION mkt_source(p_actor text, p_action text, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s mkt_sources%ROWTYPE; v_id text; n int;
BEGIN
  IF p_action = 'propose' THEN
    IF NOT (co_has(p_actor, 'marketer') OR co_has(p_actor, 'marketing_approver')) THEN RETURN 'Proposing a source needs a marketing role.'; END IF;
    IF coalesce(p->>'kind', '') NOT IN ('price', 'customer', 'outcome', 'certification', 'security', 'metric', 'availability', 'integration') THEN RETURN 'Choose what the source supports.'; END IF;
    IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 3 AND 160 THEN RETURN 'Name the source (3 to 160 characters).'; END IF;
    IF length(trim(coalesce(p->>'reference', ''))) < 8 THEN RETURN 'Say where the evidence is kept (a document, contract clause or report).'; END IF;
    v_id := 'src_' || substr(md5(p_actor || clock_timestamp()::text || random()::text), 1, 12);
    INSERT INTO mkt_sources (id, kind, title, reference, expires_on, proposed_by) VALUES (v_id, p->>'kind', trim(p->>'title'), trim(p->>'reference'), (p->>'expiresOn')::date, p_actor);
    INSERT INTO mkt_source_events (source_id, actor_id, action, detail) VALUES (v_id, p_actor, 'propose', trim(p->>'title'));
    RETURN 'ok:' || v_id;
  END IF;
  SELECT * INTO s FROM mkt_sources WHERE id = p->>'sourceId' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'Source not found.'; END IF;
  IF NOT co_has(p_actor, 'marketing_approver') THEN RETURN 'Approving or revoking sources needs the marketing approver role.'; END IF;
  IF p_action = 'approve' THEN
    IF s.state <> 'proposed' THEN RETURN 'Only proposed sources can be approved.'; END IF;
    IF p_actor = s.proposed_by THEN RETURN 'You proposed this source, so someone else must approve it.'; END IF;
    IF length(trim(coalesce(p->>'permissionNote', ''))) < 10 THEN RETURN 'Record who gave publication permission and where it is written down.'; END IF;
    IF s.expires_on IS NOT NULL AND s.expires_on < current_date THEN RETURN 'This source has already expired.'; END IF;
    UPDATE mkt_sources SET state = 'approved', approved_by = p_actor, approved_at = now(), permission_note = trim(p->>'permissionNote') WHERE id = s.id;
    INSERT INTO mkt_source_events (source_id, actor_id, action, detail) VALUES (s.id, p_actor, 'approve', trim(p->>'permissionNote'));
    RETURN 'ok:' || s.id;
  ELSIF p_action = 'revoke' THEN
    IF s.state = 'revoked' THEN RETURN 'Already revoked.'; END IF;
    IF length(trim(coalesce(p->>'reason', ''))) < 5 THEN RETURN 'Say why it is revoked.'; END IF;
    UPDATE mkt_sources SET state = 'revoked', revoked_by = p_actor, revoked_at = now(), revoke_reason = trim(p->>'reason') WHERE id = s.id;
    WITH hit AS (UPDATE mkt_campaigns c SET state = 'draft', approved_by = NULL, approved_hash = NULL, approved_at = NULL, version = version + 1, updated_at = now()
      WHERE c.state IN ('approved', 'in_review') AND EXISTS (SELECT 1 FROM mkt_claims k WHERE k.campaign_id = c.id AND k.source_id = s.id) RETURNING c.id)
    INSERT INTO mkt_timeline (campaign_id, actor_id, action, detail) SELECT id, p_actor, 'source_revoked', 'Returned to draft: source "' || s.title || '" was revoked' FROM hit;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO mkt_source_events (source_id, actor_id, action, detail) VALUES (s.id, p_actor, 'revoke', trim(p->>'reason') || ' (' || n || ' campaigns returned to draft)');
    RETURN 'ok:' || s.id;
  END IF;
  RETURN 'Unknown action.';
END $$`,
];
