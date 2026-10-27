// Migration aff-001: which of a person's active memberships is current (S-76 E28). Written only by api/affiliation.ts after it
// checks the membership is the caller's own and active; read by lib/server.ts on every request. A stale row (membership no
// longer active) is ignored, never honoured. Switch history is append-only.
export const AFF_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS aff_current (user_id text PRIMARY KEY, membership_id text NOT NULL, set_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS aff_events (id bigserial PRIMARY KEY, user_id text NOT NULL, step text NOT NULL CHECK (step IN ('switch','join_request')), membership_id text,
     institution_id text, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION aff_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'aff_events_append_only') THEN
       CREATE TRIGGER aff_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON aff_events FOR EACH STATEMENT EXECUTE FUNCTION aff_refuse_change();
     END IF;
   END $$`,
];
