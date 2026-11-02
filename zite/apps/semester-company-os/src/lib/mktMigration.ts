// Migration mkt-001: Marketing and Growth (APP-021). Gate: "exact send/spend approval; consent; no education-record audiences".
// - The only audience source is inbound contacts who consented to contact (CHECK). Education records cannot be an audience.
// - Approval binds the exact content, audience snapshot and spend (content hash); any later edit voids it.
// - Sending is a CHECK-constrained 'disabled' column and there is no send action.
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
  `CREATE OR REPLACE FUNCTION mkt_hash(c mkt_campaigns) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', c.name, c.channel, c.subject, c.body, c.audience_rule, coalesce(c.audience_size, -1), c.spend_minor)) $$`,
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
    ELSIF p_action = 'submit' THEN
      IF p_actor <> m.author_id THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author submits a campaign.';
      ELSIF m.state NOT IN ('draft', 'rejected') THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be submitted.';
      ELSIF length(trim(m.subject)) < 5 OR length(trim(m.body)) < 40 THEN v_code := 'BAD_INPUT'; v_msg := 'Write a subject (5+ characters) and body (40+ characters) first.';
      ELSIF m.channel = 'email' AND position('{{unsubscribe}}' IN m.body) = 0 THEN v_code := 'BAD_INPUT'; v_msg := 'Email campaigns must include the {{unsubscribe}} link.';
      ELSIF coalesce((p->>'audienceSize')::int, 0) < 1 THEN v_code := 'NO_AUDIENCE'; v_msg := 'No contacts have consented to contact, so there is no one to reach.';
      ELSE UPDATE mkt_campaigns SET state = 'in_review', audience_size = (p->>'audienceSize')::int WHERE id = m.id;
        v_msg := 'Submitted for approval with an audience of ' || (p->>'audienceSize') || ' consented contacts.'; v_detail := 'audience ' || (p->>'audienceSize');
      END IF;
    ELSIF p_action IN ('approve', 'reject') THEN
      IF NOT co_has(p_actor, 'marketing_approver') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Reviewing campaigns needs the marketing approver role.';
      ELSIF p_actor = m.author_id THEN v_code := 'SEPARATION_OF_DUTIES'; v_msg := 'You wrote this campaign, so someone else must review it.';
      ELSIF m.state <> 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'This campaign is not awaiting review.';
      ELSIF p->>'seenHash' IS DISTINCT FROM mkt_hash(m) THEN v_code := 'CONTENT_CHANGED'; v_msg := 'The campaign changed since you opened it. Reload and review again.';
      ELSIF p_action = 'reject' AND length(trim(coalesce(p->>'note', ''))) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why it is rejected.';
      ELSIF p_action = 'approve' THEN
        UPDATE mkt_campaigns SET state = 'approved', approved_by = p_actor, approved_hash = mkt_hash(m), approved_at = now(), review_note = p->>'note' WHERE id = m.id;
        v_msg := 'Approved exactly as shown. Sending is disabled: nothing was sent.'; v_detail := 'hash ' || mkt_hash(m);
      ELSE UPDATE mkt_campaigns SET state = 'rejected', review_note = p->>'note' WHERE id = m.id; v_msg := 'Rejected and returned to the author.'; v_detail := p->>'note';
      END IF;
    ELSIF p_action = 'withdraw' THEN
      IF p_actor <> m.author_id THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author withdraws a campaign.';
      ELSIF m.state <> 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'Only campaigns in review can be withdrawn.';
      ELSE UPDATE mkt_campaigns SET state = 'draft' WHERE id = m.id; v_msg := 'Withdrawn to draft.'; END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown action.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_action <> 'create' THEN UPDATE mkt_campaigns SET version = version + 1, updated_at = now() WHERE id = v_id; END IF;
    INSERT INTO mkt_timeline (campaign_id, actor_id, action, detail) VALUES (v_id, p_actor, p_action, v_detail);
  END IF;
  INSERT INTO mkt_receipts (actor_id, command_key, campaign_id, result_code, message) VALUES (p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
];
