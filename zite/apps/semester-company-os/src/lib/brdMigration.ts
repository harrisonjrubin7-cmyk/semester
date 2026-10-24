// Migration brd-001: Board and Investor reporting (APP-031). Gate: "audience-specific grants; redaction; exact release approval".
// - A board_preparer freezes a snapshot: figures computed on the server + a narrative. Content is immutable once created.
// - A board_approver who did not prepare it releases that exact snapshot (content hash). Nothing else is ever shown to readers.
// - board_reader sees released snapshots only. Requires co_has() from lib/coRoles.ts.
export const BRD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS brd_snapshots (id text PRIMARY KEY, number serial, period text NOT NULL, figures jsonb NOT NULL, narrative text NOT NULL CHECK (length(narrative) >= 40),
     content_hash text NOT NULL, state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'released', 'withdrawn')),
     prepared_by text NOT NULL, released_by text, released_at timestamptz, withdrawn_reason text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (released_by IS NULL OR released_by <> prepared_by))`,
  // Content columns can never change after creation; only the release state moves (through brd_release / brd_withdraw).
  `CREATE OR REPLACE FUNCTION brd_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'SNAPSHOTS_ARE_KEPT' USING ERRCODE = '42501'; END IF;
     IF NEW.figures IS DISTINCT FROM OLD.figures OR NEW.narrative IS DISTINCT FROM OLD.narrative OR NEW.period IS DISTINCT FROM OLD.period
        OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by THEN
       RAISE EXCEPTION 'SNAPSHOT_IS_FROZEN' USING ERRCODE = '42501';
     END IF;
     RETURN NEW;
   END $$`,
  `DROP TRIGGER IF EXISTS brd_snapshots_frozen ON brd_snapshots`,
  `CREATE TRIGGER brd_snapshots_frozen BEFORE UPDATE OR DELETE ON brd_snapshots FOR EACH ROW EXECUTE FUNCTION brd_freeze()`,
  `CREATE TABLE IF NOT EXISTS brd_events (id bigserial PRIMARY KEY, snapshot_id text NOT NULL REFERENCES brd_snapshots(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION brd_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS brd_events_append_only ON brd_events`,
  `CREATE TRIGGER brd_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON brd_events FOR EACH STATEMENT EXECUTE FUNCTION brd_refuse_change()`,
  `CREATE OR REPLACE FUNCTION brd_create(p_actor text, p_id text, p_period text, p_figures jsonb, p_narrative text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT co_has(p_actor, 'board_preparer') THEN RETURN 'Preparing board snapshots needs the board preparer role.'; END IF;
     IF EXISTS (SELECT 1 FROM brd_snapshots WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_period, ''))) < 4 THEN RETURN 'Name the reporting period.'; END IF;
     IF length(trim(coalesce(p_narrative, ''))) < 40 THEN RETURN 'Write the narrative (40+ characters).'; END IF;
     INSERT INTO brd_snapshots (id, period, figures, narrative, content_hash, prepared_by)
       VALUES (p_id, trim(p_period), p_figures, trim(p_narrative), md5(trim(p_period) || '|' || p_figures::text || '|' || trim(p_narrative)), p_actor);
     INSERT INTO brd_events (snapshot_id, actor_id, action) VALUES (p_id, p_actor, 'prepared');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION brd_release(p_actor text, p_id text, p_seen_hash text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s brd_snapshots%ROWTYPE;
   BEGIN
     IF NOT co_has(p_actor, 'board_approver') THEN RETURN 'Releasing needs the board approver role.'; END IF;
     SELECT * INTO s FROM brd_snapshots WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Snapshot not found.'; END IF;
     IF s.state <> 'draft' THEN RETURN 'Only draft snapshots are released.'; END IF;
     IF s.prepared_by = p_actor THEN RETURN 'You prepared this snapshot, so someone else must release it.'; END IF;
     IF p_seen_hash IS DISTINCT FROM s.content_hash THEN RETURN 'This is not the snapshot you reviewed.'; END IF;
     UPDATE brd_snapshots SET state = 'released', released_by = p_actor, released_at = now() WHERE id = s.id;
     INSERT INTO brd_events (snapshot_id, actor_id, action) VALUES (s.id, p_actor, 'released');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION brd_withdraw(p_actor text, p_id text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s brd_snapshots%ROWTYPE;
   BEGIN
     IF NOT co_has(p_actor, 'board_approver') THEN RETURN 'Withdrawing needs the board approver role.'; END IF;
     SELECT * INTO s FROM brd_snapshots WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR s.state = 'withdrawn' THEN RETURN 'Nothing to withdraw.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
     UPDATE brd_snapshots SET state = 'withdrawn', withdrawn_reason = p_reason WHERE id = s.id;
     INSERT INTO brd_events (snapshot_id, actor_id, action, detail) VALUES (s.id, p_actor, 'withdrawn', p_reason);
     RETURN NULL;
   END $$`,
];
