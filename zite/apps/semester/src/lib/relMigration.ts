// Storage for sanitised releases (lib/releaseRules.ts). A release is an explicit act by an accountable person, can be
// stopped, and every share, refresh and stop is logged append-only.
export const REL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rel_readiness (tenant_id text PRIMARY KEY, snapshot jsonb NOT NULL, shared_by text NOT NULL, shared_at timestamptz NOT NULL DEFAULT now(), stopped_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS rel_assurance (capability_id text PRIMARY KEY, snapshot jsonb NOT NULL, released_by text NOT NULL, released_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS rel_events (id bigserial PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('readiness','assurance')), ref text NOT NULL,
     actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION rel_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The release log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rel_events_append_only') THEN
     CREATE TRIGGER rel_events_append_only BEFORE UPDATE OR DELETE ON rel_events FOR EACH ROW EXECUTE FUNCTION rel_refuse_change(); END IF; END $$`,
];
