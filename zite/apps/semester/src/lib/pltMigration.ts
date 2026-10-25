// Migration plt-001: platform slices C3-C5 from the unified-ecosystem backlog (Semester-Unified-Ecosystem-Project-Specification.zip).
// C3 context + revocation: every person has a permission epoch per institution. Membership or role changes bump it; any command
//    carrying an older epoch is refused, so a stale screen or queued action cannot act on revoked authority.
// C4 command receipt + outbox: each command is keyed by (actor, idempotency key); the same key with the same payload returns the
//    first receipt, with a different payload it is refused. The domain change, the receipt and an outbox row commit together.
// C5 shared work + referrals: a cross-app handoff (e.g. advisor → tutoring, career, accessibility office). The student approves
//    disclosure of the minimum summary before anyone in the receiving office sees it; someone in that office other than the
//    sender accepts and resolves it; the student sees each step. Sent is not accepted; accepted is not resolved.
// The endpoint resolves who belongs to the receiving office from server membership and passes it in; nothing comes from the client.
export const PLT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS plt_epochs (tenant_id text NOT NULL, user_id text NOT NULL, epoch int NOT NULL DEFAULT 1, bumped_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL DEFAULT 'initial', PRIMARY KEY (tenant_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS plt_commands (tenant_id text NOT NULL, actor_id text NOT NULL, idem_key text NOT NULL, kind text NOT NULL, payload_hash text NOT NULL,
     receipt text NOT NULL, ref text, at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (tenant_id, actor_id, idem_key))`,
  `CREATE TABLE IF NOT EXISTS plt_outbox (id bigserial PRIMARY KEY, tenant_id text NOT NULL, topic text NOT NULL, ref text NOT NULL, payload jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT clock_timestamp(), delivered_at timestamptz, attempts int NOT NULL DEFAULT 0, dead_letter boolean NOT NULL DEFAULT false)`,
  `CREATE TABLE IF NOT EXISTS plt_handoffs (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL, sender_id text NOT NULL,
     from_app text NOT NULL, to_app text NOT NULL, purpose text NOT NULL CHECK (length(purpose) BETWEEN 10 AND 300), summary text NOT NULL CHECK (length(summary) BETWEEN 10 AND 1000),
     state text NOT NULL DEFAULT 'awaiting_consent' CHECK (state IN ('awaiting_consent', 'queued', 'accepted', 'resolved', 'declined', 'withdrawn', 'expired')),
     recipient_id text, outcome text, version int NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (sender_id <> student_id), CHECK (recipient_id IS NULL OR recipient_id <> sender_id))`,
  `CREATE OR REPLACE FUNCTION plt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS plt_commands_append_only ON plt_commands`,
  `CREATE TRIGGER plt_commands_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON plt_commands FOR EACH STATEMENT EXECUTE FUNCTION plt_refuse_change()`,
  `CREATE OR REPLACE FUNCTION plt_epoch(p_tenant text, p_user text) RETURNS int LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     SELECT epoch INTO v FROM plt_epochs WHERE tenant_id = p_tenant AND user_id = p_user;
     IF v IS NULL THEN INSERT INTO plt_epochs (tenant_id, user_id) VALUES (p_tenant, p_user) ON CONFLICT DO NOTHING; v := 1; END IF;
     RETURN v;
   END $$`,
  `CREATE OR REPLACE FUNCTION plt_bump(p_tenant text, p_user text, p_reason text) RETURNS int LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     INSERT INTO plt_epochs (tenant_id, user_id, epoch, reason) VALUES (p_tenant, p_user, 2, p_reason)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET epoch = plt_epochs.epoch + 1, bumped_at = now(), reason = p_reason RETURNING epoch INTO v;
     INSERT INTO plt_outbox (tenant_id, topic, ref, payload) VALUES (p_tenant, 'permission.epoch', p_user, jsonb_build_object('epoch', v, 'reason', p_reason));
     RETURN v;
   END $$`,
  // Shared command gate: epoch, idempotency (same key + same payload = first receipt; changed payload = refused).
  // Returns: NULL to proceed, 'DUP:<receipt>' for a replay, or an error message.
  `CREATE OR REPLACE FUNCTION plt_gate(p_tenant text, p_actor text, p_epoch int, p_key text, p_kind text, p_hash text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c plt_commands%ROWTYPE;
   BEGIN
     IF p_epoch <> plt_epoch(p_tenant, p_actor) THEN RETURN 'Your access changed since this page loaded. Reload and try again.'; END IF;
     SELECT * INTO c FROM plt_commands WHERE tenant_id = p_tenant AND actor_id = p_actor AND idem_key = p_key;
     IF FOUND THEN
       IF c.kind = p_kind AND c.payload_hash = p_hash THEN RETURN 'DUP:' || c.receipt; END IF;
       RETURN 'This request key was already used for a different request.';
     END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION plt_record(p_tenant text, p_actor text, p_key text, p_kind text, p_hash text, p_ref text, p_topic text, p_payload jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_receipt text := 'RCPT-' || substr(md5(p_tenant || p_actor || p_key || clock_timestamp()::text), 1, 12);
   BEGIN
     INSERT INTO plt_commands (tenant_id, actor_id, idem_key, kind, payload_hash, receipt, ref) VALUES (p_tenant, p_actor, p_key, p_kind, p_hash, v_receipt, p_ref);
     INSERT INTO plt_outbox (tenant_id, topic, ref, payload) VALUES (p_tenant, p_topic, p_ref, p_payload || jsonb_build_object('receipt', v_receipt));
     RETURN v_receipt;
   END $$`,
  // Every handoff command: one transaction = gate + domain change + receipt + outbox. Returns 'OK:<receipt>', 'DUP:<receipt>' or an error.
  `CREATE OR REPLACE FUNCTION plt_handoff_cmd(p_tenant text, p_actor text, p_epoch int, p_key text, p_cmd text, p_id text, p_version int,
     p_student text, p_from text, p_to text, p_purpose text, p_summary text, p_office text[], p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g text; h plt_handoffs%ROWTYPE; v_hash text := md5(concat_ws('|', p_cmd, p_id, p_version, p_student, p_from, p_to, p_purpose, p_summary, p_text)); v_next text;
   BEGIN
     g := plt_gate(p_tenant, p_actor, p_epoch, p_key, 'handoff.' || p_cmd, v_hash);
     IF g IS NOT NULL THEN RETURN g; END IF;
     IF p_cmd = 'propose' THEN
       IF p_actor = p_student THEN RETURN 'Staff propose referrals; you can ask a service directly.'; END IF;
       IF p_from = p_to THEN RETURN 'Refer to a different office.'; END IF;
       INSERT INTO plt_handoffs (id, tenant_id, student_id, sender_id, from_app, to_app, purpose, summary) VALUES (p_id, p_tenant, p_student, p_actor, p_from, p_to, trim(p_purpose), trim(p_summary));
       v_next := 'awaiting_consent';
     ELSE
       SELECT * INTO h FROM plt_handoffs WHERE id = p_id FOR UPDATE;
       IF NOT FOUND OR h.tenant_id <> p_tenant THEN RETURN 'Referral not found.'; END IF;
       IF h.version <> p_version THEN RETURN 'This referral changed since you opened it. Reload.'; END IF;
       IF h.expires_at < now() AND h.state IN ('awaiting_consent', 'queued') THEN UPDATE plt_handoffs SET state = 'expired', version = version + 1 WHERE id = p_id; RETURN 'This referral expired.'; END IF;
       IF p_cmd IN ('consent', 'refuse') THEN
         IF p_actor <> h.student_id THEN RETURN 'Only the student decides what is shared.'; END IF;
         IF h.state <> 'awaiting_consent' THEN RETURN 'This referral is no longer waiting for you.'; END IF;
         v_next := CASE WHEN p_cmd = 'consent' THEN 'queued' ELSE 'declined' END;
         UPDATE plt_handoffs SET state = v_next, version = version + 1 WHERE id = p_id;
       ELSIF p_cmd = 'withdraw' THEN
         IF p_actor <> h.sender_id THEN RETURN 'Only the sender can withdraw it.'; END IF;
         IF h.state NOT IN ('awaiting_consent', 'queued') THEN RETURN 'It can no longer be withdrawn.'; END IF;
         v_next := 'withdrawn'; UPDATE plt_handoffs SET state = v_next, version = version + 1 WHERE id = p_id;
       ELSIF p_cmd IN ('accept', 'decline') THEN
         IF NOT (p_actor = ANY (p_office)) THEN RETURN 'Only the receiving office can respond.'; END IF;
         IF p_actor = h.sender_id OR p_actor = h.student_id THEN RETURN 'Someone else in the receiving office must respond.'; END IF;
         IF h.state <> 'queued' THEN RETURN 'This referral is not waiting for the office.'; END IF;
         IF p_cmd = 'decline' AND length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Tell the student and sender why (10+ characters).'; END IF;
         v_next := CASE WHEN p_cmd = 'accept' THEN 'accepted' ELSE 'declined' END;
         UPDATE plt_handoffs SET state = v_next, recipient_id = CASE WHEN p_cmd = 'accept' THEN p_actor END, outcome = CASE WHEN p_cmd = 'decline' THEN trim(p_text) END, version = version + 1 WHERE id = p_id;
       ELSIF p_cmd = 'resolve' THEN
         IF p_actor IS DISTINCT FROM h.recipient_id THEN RETURN 'Only the person who accepted it can resolve it.'; END IF;
         IF h.state <> 'accepted' THEN RETURN 'Accept it before resolving.'; END IF;
         IF length(trim(coalesce(p_text, ''))) < 10 THEN RETURN 'Record the outcome for the student (10+ characters).'; END IF;
         v_next := 'resolved'; UPDATE plt_handoffs SET state = v_next, outcome = trim(p_text), version = version + 1 WHERE id = p_id;
       ELSE RETURN 'Unknown command.'; END IF;
     END IF;
     RETURN 'OK:' || plt_record(p_tenant, p_actor, p_key, 'handoff.' || p_cmd, v_hash, p_id, 'handoff.' || v_next, jsonb_build_object('handoff', p_id, 'state', v_next));
   END $$`,
];
