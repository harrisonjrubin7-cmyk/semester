# Gradebook regression and React wireframe

## SQL prerequisites
Apply the previous gradebook_transcript_reference.sql first in an isolated fresh local Supabase database, then degree_audit_rls_extension.sql. This package does not reproduce the base migration. The extension is not idempotent. Existing what-if owners require validated backfill.
Put gradebook_transcript_pgtap.sql in supabase/tests/database; run supabase test db. Tests use pgTAP, synthetic auth.users and claims, SET LOCAL ROLE authenticated/anon, and roll back fixtures. Do not run on production. Assertions use a fresh empty reference schema and are not suitable for populated databases.
The tests have not been executed. They do not verify real JWT signatures, external transcript delivery, final-grade acceptance, all audit functions, actual concurrency, or FERPA compliance as a whole. The suite exercises actual release and override functions from the prerequisite migration.

## React
Extract source, npm install, npm run dev. npm run build typechecks and compiles. Dependencies are not bundled. The UI has local role guards, not actual RLS or authentication. It is not connected to Supabase. Navigation is an inspection shell. The full ledger is developer-only. Degree audit is synthetic unknown evidence, not an evaluator.

## Security
A released-results portal restriction is distinct from statutory education-record inspection rights. No Registrar override may bypass privacy or missing-evidence gates. Official degree audits are scoped; personal what-if runs are private unless explicitly shared with an active scoped grant. Private transcript storage keys are never client readable. Release RPCs use privileged functions and require independent scope/capability/state checks. Current evidence logs are not complete FERPA disclosure records.
