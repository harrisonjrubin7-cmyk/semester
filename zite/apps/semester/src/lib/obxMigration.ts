// Migration obx-001: outbox consumer, dead letters and reviewed replay (Integration Admin app; backlog C4 consumer side).
// plt_outbox rows (written atomically with each command) are delivered here to idempotent handlers:
//   handoff.*          → recompute the referral load projection for the receiving office (recompute, so replays are safe)
//   permission.epoch   → acknowledged (sessions already read the epoch directly)
// Unknown topics or handler failures increase attempts; after 3 the row becomes a dead letter with the reason kept.
// A dead letter is replayed only after one administrator requests it with a reason and a different administrator approves.
// At-least-once delivery with idempotent handlers; no claim of exactly-once. Replay decisions are append-only.
export const OBX_MIGRATION: string[] = [
  `ALTER TABLE plt_outbox ADD COLUMN IF NOT EXISTS last_error text`,
  `CREATE TABLE IF NOT EXISTS plt_office_load (tenant_id text NOT NULL, to_app text NOT NULL, awaiting_consent int NOT NULL, queued int NOT NULL, accepted int NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, to_app))`,
  `CREATE TABLE IF NOT EXISTS plt_replays (id bigserial PRIMARY KEY, tenant_id text NOT NULL, outbox_id bigint NOT NULL REFERENCES plt_outbox(id), requested_by text NOT NULL,
     reason text NOT NULL CHECK (length(reason) >= 10), approved_by text, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> requested_by))`,
  `CREATE OR REPLACE FUNCTION plt_handle(o plt_outbox) RETURNS void LANGUAGE plpgsql AS $$
   DECLARE v_app text;
   BEGIN
     IF o.topic LIKE 'handoff.%' THEN
       SELECT to_app INTO v_app FROM plt_handoffs WHERE id = o.ref AND tenant_id = o.tenant_id;
       IF v_app IS NULL THEN RAISE EXCEPTION 'handoff % not found', o.ref; END IF;
       INSERT INTO plt_office_load (tenant_id, to_app, awaiting_consent, queued, accepted, updated_at)
         SELECT o.tenant_id, v_app, count(*) FILTER (WHERE state = 'awaiting_consent'), count(*) FILTER (WHERE state = 'queued'), count(*) FILTER (WHERE state = 'accepted'), now()
         FROM plt_handoffs WHERE tenant_id = o.tenant_id AND to_app = v_app
       ON CONFLICT (tenant_id, to_app) DO UPDATE SET awaiting_consent = EXCLUDED.awaiting_consent, queued = EXCLUDED.queued, accepted = EXCLUDED.accepted, updated_at = now();
     ELSIF o.topic = 'permission.epoch' THEN
       NULL;
     ELSE
       RAISE EXCEPTION 'no handler for topic %', o.topic;
     END IF;
   END $$`,
  // Processes up to p_limit pending rows for one tenant. Each row is handled in its own subtransaction.
  `CREATE OR REPLACE FUNCTION plt_process(p_tenant text, p_limit int) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE o plt_outbox; v_ok int := 0; v_fail int := 0; v_dead int := 0;
   BEGIN
     FOR o IN SELECT * FROM plt_outbox WHERE tenant_id = p_tenant AND delivered_at IS NULL AND NOT dead_letter ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
       BEGIN
         PERFORM plt_handle(o);
         UPDATE plt_outbox SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = o.id;
         v_ok := v_ok + 1;
       EXCEPTION WHEN others THEN
         UPDATE plt_outbox SET attempts = attempts + 1, last_error = left(SQLERRM, 300), dead_letter = (attempts + 1 >= 3) WHERE id = o.id;
         IF o.attempts + 1 >= 3 THEN v_dead := v_dead + 1; ELSE v_fail := v_fail + 1; END IF;
       END;
     END LOOP;
     RETURN jsonb_build_object('delivered', v_ok, 'retrying', v_fail, 'dead', v_dead);
   END $$`,
  `CREATE OR REPLACE FUNCTION plt_request_replay(p_admin text, p_tenant text, p_outbox bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM plt_outbox WHERE id = p_outbox AND tenant_id = p_tenant AND dead_letter) THEN RETURN 'That event is not a dead letter here.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say what was fixed before replaying (10+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM plt_replays WHERE outbox_id = p_outbox AND approved_by IS NULL) THEN RETURN 'A replay request is already waiting.'; END IF;
     INSERT INTO plt_replays (tenant_id, outbox_id, requested_by, reason) VALUES (p_tenant, p_outbox, p_admin, trim(p_reason));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION plt_approve_replay(p_admin text, p_tenant text, p_replay bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r plt_replays%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM plt_replays WHERE id = p_replay AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Replay request not found.'; END IF;
     IF r.approved_by IS NOT NULL THEN RETURN 'Already approved.'; END IF;
     IF r.requested_by = p_admin THEN RETURN 'A different administrator must approve the replay.'; END IF;
     UPDATE plt_replays SET approved_by = p_admin, approved_at = now() WHERE id = p_replay;
     UPDATE plt_outbox SET dead_letter = false, attempts = 0, last_error = NULL WHERE id = r.outbox_id;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION plt_replays_refuse() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP = 'DELETE' OR OLD.approved_by IS NOT NULL OR NEW.requested_by <> OLD.requested_by OR NEW.reason <> OLD.reason OR NEW.outbox_id <> OLD.outbox_id THEN
       RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END IF;
     RETURN NEW;
   END $$`,
  `DROP TRIGGER IF EXISTS plt_replays_guard ON plt_replays`,
  `CREATE TRIGGER plt_replays_guard BEFORE UPDATE OR DELETE ON plt_replays FOR EACH ROW EXECUTE FUNCTION plt_replays_refuse()`,
];
