-- PROPOSED, NOT APPLIED. Reconcile against the existing governance schema first; don't duplicate official stores.
BEGIN;
CREATE SCHEMA IF NOT EXISTS release_transport;
REVOKE ALL ON SCHEMA release_transport FROM PUBLIC, anon, authenticated;
CREATE TABLE release_transport.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  environment text NOT NULL CHECK (environment IN ('preview','staging','production')),
  configuration_digest text NOT NULL CHECK (length(configuration_digest) > 0),
  cohort text NOT NULL CHECK (length(cohort) > 0),
  data_mode text NOT NULL CHECK (data_mode IN ('synthetic','manual','connected')),
  captured_at timestamptz NOT NULL,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  secure_store_reference text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_mode = 'synthetic' OR tenant_id IS NOT NULL),
  UNIQUE (commit_sha, environment, configuration_digest, cohort, manifest_sha256)
);
CREATE TABLE release_transport.artifacts (
  bundle_id uuid NOT NULL REFERENCES release_transport.bundles(id) ON DELETE RESTRICT,
  artifact_id text NOT NULL,
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  owner_reference text NOT NULL,
  captured_at timestamptz NOT NULL,
  PRIMARY KEY (bundle_id, artifact_id)
);
-- Append-only: evidence is never edited in place.
CREATE FUNCTION release_transport.append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'release_transport is append-only' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER bundles_append_only BEFORE UPDATE OR DELETE ON release_transport.bundles FOR EACH ROW EXECUTE FUNCTION release_transport.append_only();
CREATE TRIGGER artifacts_append_only BEFORE UPDATE OR DELETE ON release_transport.artifacts FOR EACH ROW EXECUTE FUNCTION release_transport.append_only();
ALTER TABLE release_transport.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_transport.bundles FORCE ROW LEVEL SECURITY;
ALTER TABLE release_transport.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_transport.artifacts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA release_transport FROM PUBLIC, anon, authenticated;
-- No browser access. Create audited least-privilege append/read roles separately.
-- Service-role bypass is NOT tenant authorization. There is deliberately no release-approval column.
COMMIT;
