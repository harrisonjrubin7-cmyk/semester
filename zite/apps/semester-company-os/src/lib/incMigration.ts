// Migration inc-001: incident response (book workflow "Incident response", gap register P0 "Severity declared").
// Every step is one inc_cmd() call = one transaction: the change, its version bump, the timeline entry and the receipt.
// Customer notices are drafted and approved here; sending stays disabled. Requires co_has() from lib/coRoles.ts.
export const INC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS inc_incidents (id text PRIMARY KEY, number serial, title text NOT NULL, summary text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'reported' CHECK (state IN ('reported','triaged','declared','mitigating','resolved','closed')),
     severity text CHECK (severity IN ('SEV1','SEV2','SEV3','SEV4')), student_data_possible boolean NOT NULL DEFAULT false,
     reported_by text NOT NULL, declared_by text, tech_lead text, comms_lead text, mitigation text, resolved_by text, resolved_at timestamptz,
     privacy_reviewed_by text, privacy_note text, postmortem text, postmortem_by text, closed_by text, closed_at timestamptz,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS inc_commands (actor_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS inc_receipts (actor_id text NOT NULL, command_key text NOT NULL, incident_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (actor_id, command_key), FOREIGN KEY (actor_id, command_key) REFERENCES inc_commands (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS inc_timeline (id bigserial PRIMARY KEY, incident_id text NOT NULL REFERENCES inc_incidents(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS inc_followups (id bigserial PRIMARY KEY, incident_id text NOT NULL REFERENCES inc_incidents(id), title text NOT NULL, owner_id text NOT NULL, due date, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS inc_notices (id bigserial PRIMARY KEY, incident_id text NOT NULL REFERENCES inc_incidents(id), audience text NOT NULL, body text NOT NULL,
     drafted_by text NOT NULL, approved_by text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')), sending text NOT NULL DEFAULT 'disabled' CHECK (sending = 'disabled'),
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (approved_by IS NULL OR approved_by <> drafted_by))`,
  `CREATE OR REPLACE FUNCTION inc_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS inc_timeline_append_only ON inc_timeline`,
  `CREATE TRIGGER inc_timeline_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON inc_timeline FOR EACH STATEMENT EXECUTE FUNCTION inc_refuse_change()`,
  `DROP TRIGGER IF EXISTS inc_receipts_append_only ON inc_receipts`,
  `CREATE TRIGGER inc_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON inc_receipts FOR EACH STATEMENT EXECUTE FUNCTION inc_refuse_change()`,
  `CREATE OR REPLACE FUNCTION inc_cmd(p_actor text, p_key text, p_hash text, p_action text, p_id text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c inc_commands%ROWTYPE; i inc_incidents%ROWTYPE; n inc_notices%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_id; v_note text := trim(coalesce(p->>'note', ''));
  v_followups int;
BEGIN
  SELECT * INTO c FROM inc_commands WHERE actor_id = p_actor AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'id', incident_id, 'resultCode', result_code, 'message', message) FROM inc_receipts WHERE actor_id = p_actor AND command_key = p_key);
  END IF;
  INSERT INTO inc_commands (actor_id, command_key, payload_hash, action) VALUES (p_actor, p_key, p_hash, p_action);

  IF p_action = 'report' THEN
    IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 5 AND 140 THEN v_code := 'BAD_INPUT'; v_msg := 'Give the incident a title of 5 to 140 characters.';
    ELSE
      v_id := 'inc_' || substr(md5(p_actor || '|' || p_key), 1, 12);
      INSERT INTO inc_incidents (id, title, summary, reported_by) VALUES (v_id, trim(p->>'title'), coalesce(p->>'summary', ''), p_actor);
      v_msg := 'Incident reported. A responder will triage it.';
    END IF;
  ELSE
    SELECT * INTO i FROM inc_incidents WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN v_code := 'NOT_FOUND'; v_msg := 'Incident not found.';
    ELSIF (p->>'version')::int IS DISTINCT FROM i.version THEN v_code := 'STALE'; v_msg := 'This incident changed since you opened it. Reload and try again.';
    ELSIF i.state = 'closed' THEN v_code := 'CLOSED'; v_msg := 'This incident is closed.';
    ELSIF p_action = 'triage' THEN
      IF NOT co_has(p_actor, 'incident_responder') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Triage needs the incident responder role.';
      ELSIF i.state <> 'reported' THEN v_code := 'BAD_STATE'; v_msg := 'Only newly reported incidents are triaged.';
      ELSIF length(v_note) < 10 THEN v_code := 'BAD_INPUT'; v_msg := 'Describe what is affected (10+ characters).';
      ELSE UPDATE inc_incidents SET summary = v_note, student_data_possible = coalesce((p->>'studentData')::boolean, false), state = 'triaged' WHERE id = i.id;
        v_msg := 'Triaged. An executive declares the severity next.'; END IF;
    ELSIF p_action = 'declare' THEN
      IF NOT co_has(p_actor, 'incident_exec') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Declaring severity needs the incident executive role.';
      ELSIF i.state NOT IN ('triaged', 'declared', 'mitigating') THEN v_code := 'BAD_STATE'; v_msg := 'Triage the incident before declaring severity.';
      ELSIF coalesce(p->>'severity', '') NOT IN ('SEV1','SEV2','SEV3','SEV4') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose SEV1 to SEV4.';
      ELSIF i.severity IS NOT NULL AND length(v_note) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why the severity is changing.';
      ELSE UPDATE inc_incidents SET severity = p->>'severity', declared_by = p_actor, state = CASE WHEN state = 'triaged' THEN 'declared' ELSE state END WHERE id = i.id;
        v_msg := 'Severity ' || (p->>'severity') || ' declared.'; END IF;
    ELSIF p_action = 'assign' THEN
      IF NOT co_has(p_actor, 'incident_exec') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Assigning leads needs the incident executive role.';
      ELSIF i.severity IS NULL THEN v_code := 'BAD_STATE'; v_msg := 'Declare severity first.';
      ELSIF NOT co_has(coalesce(p->>'techLead', ''), 'incident_responder') THEN v_code := 'BAD_INPUT'; v_msg := 'The technical lead must hold the incident responder role.';
      ELSIF coalesce(p->>'commsLead', '') = '' THEN v_code := 'BAD_INPUT'; v_msg := 'Name a communications lead.';
      ELSE UPDATE inc_incidents SET tech_lead = p->>'techLead', comms_lead = p->>'commsLead' WHERE id = i.id; v_msg := 'Leads assigned.'; END IF;
    ELSIF p_action = 'update' THEN
      IF NOT (p_actor IN (coalesce(i.tech_lead, ''), coalesce(i.comms_lead, '')) OR co_has(p_actor, 'incident_responder') OR co_has(p_actor, 'incident_exec')) THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the incident team can post updates.';
      ELSIF length(v_note) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Write the update.';
      ELSE v_msg := 'Update posted.'; END IF;
    ELSIF p_action = 'mitigate' THEN
      IF NOT (p_actor = coalesce(i.tech_lead, '') OR co_has(p_actor, 'incident_responder')) THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Mitigation is recorded by the technical lead or a responder.';
      ELSIF i.state NOT IN ('declared', 'mitigating') THEN v_code := 'BAD_STATE'; v_msg := 'Declare severity before mitigating.';
      ELSIF length(v_note) < 10 THEN v_code := 'BAD_INPUT'; v_msg := 'Describe the mitigation (10+ characters).';
      ELSE UPDATE inc_incidents SET mitigation = v_note, state = 'mitigating' WHERE id = i.id; v_msg := 'Mitigation recorded.'; END IF;
    ELSIF p_action = 'resolve' THEN
      IF NOT (p_actor = coalesce(i.tech_lead, '') OR co_has(p_actor, 'incident_exec')) THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'The technical lead or an executive resolves the incident.';
      ELSIF i.state <> 'mitigating' THEN v_code := 'BAD_STATE'; v_msg := 'Record the mitigation before resolving.';
      ELSE UPDATE inc_incidents SET state = 'resolved', resolved_by = p_actor, resolved_at = now() WHERE id = i.id; v_msg := 'Resolved. Postmortem and follow-ups next.'; END IF;
    ELSIF p_action = 'privacy_review' THEN
      IF NOT co_has(p_actor, 'privacy_officer') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Privacy review needs the privacy officer role.';
      ELSIF NOT i.student_data_possible THEN v_code := 'BAD_STATE'; v_msg := 'This incident is not marked as possibly involving student data.';
      ELSIF length(v_note) < 20 THEN v_code := 'BAD_INPUT'; v_msg := 'Record what data was involved and the notification decision (20+ characters).';
      ELSE UPDATE inc_incidents SET privacy_reviewed_by = p_actor, privacy_note = v_note WHERE id = i.id; v_msg := 'Privacy review recorded.'; END IF;
    ELSIF p_action = 'postmortem' THEN
      IF NOT co_has(p_actor, 'incident_exec') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'The postmortem is recorded by an incident executive.';
      ELSIF i.state <> 'resolved' THEN v_code := 'BAD_STATE'; v_msg := 'Resolve the incident first.';
      ELSIF length(v_note) < 50 THEN v_code := 'BAD_INPUT'; v_msg := 'Write the postmortem: cause, impact, what worked, what changes (50+ characters).';
      ELSE UPDATE inc_incidents SET postmortem = v_note, postmortem_by = p_actor WHERE id = i.id; v_msg := 'Postmortem recorded.'; END IF;
    ELSIF p_action = 'followup' THEN
      IF NOT (p_actor = coalesce(i.tech_lead, '') OR co_has(p_actor, 'incident_exec')) THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Follow-ups are added by the technical lead or an executive.';
      ELSIF length(trim(coalesce(p->>'title', ''))) < 5 OR coalesce(p->>'owner', '') = '' THEN v_code := 'BAD_INPUT'; v_msg := 'A follow-up needs a title and an owner.';
      ELSE INSERT INTO inc_followups (incident_id, title, owner_id, due, created_by) VALUES (i.id, trim(p->>'title'), p->>'owner', nullif(p->>'due', '')::date, p_actor);
        v_msg := 'Follow-up added.'; END IF;
    ELSIF p_action = 'draft_notice' THEN
      IF p_actor <> coalesce(i.comms_lead, '') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the communications lead drafts notices.';
      ELSIF length(trim(coalesce(p->>'body', ''))) < 20 OR coalesce(p->>'audience', '') = '' THEN v_code := 'BAD_INPUT'; v_msg := 'A notice needs an audience and a body (20+ characters).';
      ELSE INSERT INTO inc_notices (incident_id, audience, body, drafted_by) VALUES (i.id, p->>'audience', trim(p->>'body'), p_actor);
        v_msg := 'Notice drafted. Another executive approves it; sending stays disabled.'; END IF;
    ELSIF p_action = 'approve_notice' THEN
      SELECT * INTO n FROM inc_notices WHERE id = (p->>'noticeId')::bigint AND incident_id = i.id FOR UPDATE;
      IF NOT co_has(p_actor, 'incident_exec') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Approving a notice needs the incident executive role.';
      ELSIF NOT FOUND OR n.status <> 'draft' THEN v_code := 'NOT_FOUND'; v_msg := 'Draft notice not found.';
      ELSIF n.drafted_by = p_actor THEN v_code := 'SEPARATION_OF_DUTIES'; v_msg := 'You drafted this notice, so someone else must approve it.';
      ELSE UPDATE inc_notices SET status = 'approved', approved_by = p_actor WHERE id = n.id;
        v_msg := 'Notice approved. Sending is disabled: nothing was sent.'; END IF;
    ELSIF p_action = 'close' THEN
      SELECT count(*) INTO v_followups FROM inc_followups WHERE incident_id = i.id;
      IF NOT co_has(p_actor, 'incident_exec') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Closing needs the incident executive role.';
      ELSIF i.state <> 'resolved' THEN v_code := 'BAD_STATE'; v_msg := 'Only resolved incidents close.';
      ELSIF i.severity IN ('SEV1', 'SEV2') AND (i.postmortem IS NULL OR v_followups = 0) THEN v_code := 'NEEDS_POSTMORTEM'; v_msg := 'SEV1 and SEV2 incidents need a postmortem and at least one follow-up before closing.';
      ELSIF i.student_data_possible AND i.privacy_reviewed_by IS NULL THEN v_code := 'NEEDS_PRIVACY_REVIEW'; v_msg := 'Possible student-data involvement needs a privacy review before closing.';
      ELSE UPDATE inc_incidents SET state = 'closed', closed_by = p_actor, closed_at = now() WHERE id = i.id; v_msg := 'Incident closed.'; END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown action.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_action <> 'report' THEN UPDATE inc_incidents SET version = version + 1, updated_at = now() WHERE id = v_id; END IF;
    INSERT INTO inc_timeline (incident_id, actor_id, action, detail) VALUES (v_id, p_actor, p_action,
      concat_ws(' · ', nullif(p->>'severity', ''), nullif(v_note, ''), nullif(p->>'title', ''), nullif(p->>'audience', '')));
  END IF;
  INSERT INTO inc_receipts (actor_id, command_key, incident_id, result_code, message) VALUES (p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
];
