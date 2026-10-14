# Semester registrar validation
Target confirmed: semester (lzrqvlugnawcgywkhqlz). No remote changes performed.
Postgres harness requires psycopg 3 and a fresh local database named semester_mock_*. It refuses other hosts/names. It is a test-only controller, not an installed production rollback mechanism. Run: MOCK_DATABASE_URL=postgresql://...@localhost/semester_mock_cutover python postgres_mock_cutover.py
OAS runner requires openapi-spec-validator and jsonschema; run with actual spec JSON and captured response-fixture JSON array. Fixtures need case,path,method,status,content_type,payload,expected_valid. No fixtures/spec are fabricated here. Do not store live student payloads in artifacts. Resolve response refs and pin reviewed dependencies before CI integration.
The scripts have been Python syntax checked only. No PostgreSQL or endpoint execution was performed. The earlier SQLite mock tests are separate evidence.
Production handover requires audited server command integration, current policy evidence, actual old-writer fencing, transaction-coupled commit/uncertainty counts, target/config-bound telemetry and named approval. Test-owner privileges are not application IAM.
