// Applicant submission packages (owner source S-90 §6, first milestone). Submitting freezes an exact, versioned package
// (recipient, program, term, responses, document list, attestation). It is accepted only if it matches the package the
// applicant previewed (same hash), only once per request key, and only to an institution accepting applications through
// Semester. In Semester-native admissions the package row IS the institution's receipt, so "received" is recorded in
// the same transaction; nothing is ever shown as received because a network call succeeded. Append-only.
export const APK_MIGRATION: string[] = [
  // Application documents live in the private file store (fil_*, screened, owner-scoped), never at a public link.
  `CREATE TABLE IF NOT EXISTS apk_documents (application_id text NOT NULL, file_id uuid NOT NULL, tenant_id text NOT NULL, owner_id text NOT NULL,
     filename text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (application_id, file_id))`,
  `CREATE TABLE IF NOT EXISTS apk_packages (id bigserial PRIMARY KEY, application_id text NOT NULL, tenant_id text NOT NULL, applicant_id text NOT NULL,
     version int NOT NULL CHECK (version >= 1), package jsonb NOT NULL, package_sha256 text NOT NULL, attested boolean NOT NULL CHECK (attested),
     request_key text NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(), mode text NOT NULL CHECK (mode IN ('native')),
     received_at timestamptz NOT NULL DEFAULT now(), receipt_code text NOT NULL UNIQUE,
     UNIQUE (application_id, version), UNIQUE (applicant_id, request_key))`,
  `CREATE OR REPLACE FUNCTION apk_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Submitted application packages are kept as submitted.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apk_packages_append_only') THEN
     CREATE TRIGGER apk_packages_append_only BEFORE UPDATE OR DELETE ON apk_packages FOR EACH ROW EXECUTE FUNCTION apk_refuse_change(); END IF; END $$`,
  // p_accepting: the institution currently accepts applications through Semester (a published, accepting program listing).
  // p_package and p_sha are computed by the server from the stored draft; p_preview_sha is what the applicant previewed.
  `CREATE OR REPLACE FUNCTION apk_submit(p_actor text, p_owner text, p_tenant text, p_app text, p_package jsonb, p_sha text, p_preview_sha text,
     p_attested boolean, p_key text, p_accepting boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE prior apk_packages%ROWTYPE; v int; code text;
   BEGIN
     IF p_actor <> p_owner THEN RETURN 'That application isn’t yours.'; END IF;
     IF length(coalesce(p_key,'')) < 8 THEN RETURN 'Missing request key.'; END IF;
     SELECT * INTO prior FROM apk_packages WHERE applicant_id = p_actor AND request_key = p_key;
     IF FOUND THEN
       IF prior.application_id = p_app AND prior.package_sha256 = p_sha THEN RETURN 'ok:' || prior.receipt_code || ':' || prior.version || ':replay'; END IF;
       RETURN 'This request key was already used for a different submission.';
     END IF;
     IF NOT p_accepting THEN RETURN 'This institution is not accepting applications through Semester. Submit through its own admissions channel; your checklist here is not a receipt.'; END IF;
     IF NOT coalesce(p_attested, false) THEN RETURN 'Confirm that the application is your own work and accurate.'; END IF;
     IF p_sha IS DISTINCT FROM p_preview_sha THEN RETURN 'The application changed since you previewed it. Preview it again before submitting.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('apk|' || p_app));
     IF EXISTS (SELECT 1 FROM apk_packages WHERE application_id = p_app) THEN RETURN 'This application was already submitted.'; END IF;
     SELECT coalesce(max(version), 0) + 1 INTO v FROM apk_packages WHERE application_id = p_app;
     code := upper(substr(encode(sha256(convert_to(p_app || p_sha || clock_timestamp()::text, 'UTF8')), 'hex'), 1, 10));
     INSERT INTO apk_packages (application_id, tenant_id, applicant_id, version, package, package_sha256, attested, request_key, mode, receipt_code)
       VALUES (p_app, p_tenant, p_actor, v, p_package, p_sha, true, p_key, 'native', code);
     RETURN 'ok:' || code || ':' || v;
   END $$`,
];
