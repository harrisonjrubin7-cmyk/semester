# Registrar schema-hardening package

Reconstructed from the immediately preceding deliverables and rerun. Not a byte-identical copy of earlier files.

Install jsonschema in an approved local environment. Run: python -m unittest -v test_registrar_schemas.py

Includes guarded subset converter, enrollment schema, regression tests, actual results and hashes. Does not include every historical conversation artifact. No database migration, live endpoint, full OAS document or authentication validation performed. Swap execution remains unverified. Dependencies must be reviewed and pinned before production CI.
