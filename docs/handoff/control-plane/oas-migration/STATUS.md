# OAS 3.0 → 3.1 migration kit: status

Package delivered 2026-10-13. Files here are unmodified copies of the uploaded package, plus `fixtures/` (synthetic) and `evidence/` (reports from the runs below).

## What the repository contains

- Every OpenAPI document in the repo declares `openapi: 3.1.0`: `docs/handoff/control-plane/access.openapi.yaml` (and `v2/`, `v3/`), `docs/api/productivity.v1.openapi.json`, `docs/reference/openapi/institution-gateway.openapi.yaml`, and the two `docs/handoff/action-center/contracts/*-draft.json` files.
- None contains `nullable`, a boolean `exclusiveMinimum`/`exclusiveMaximum`, or tuple `items`. **There is no OpenAPI 3.0 source in the repo to migrate.** The checklist asks to freeze the original 3.0 contract and its consumers first; that baseline is not identified here.
- `access_operation_coverage.csv` lists the eight operations of `access.openapi.yaml`; the operation IDs match one-to-one. All eight are `not_evidenced`. Two GET operations (`getAccessRequest`, `inspectEnforcement`) are marked live-read eligible. No accepted run results are supplied, so no operation is evidenced.
- `live_test_plan.template.json` still has `base_url` set to `REPLACE_WITH_APPROVED_TEST_HOST`, an empty `allowed_hosts`, and no cases. No approved host exists, so no live run is possible.

## Executed

Environment: Python venv with `openapi-schema-validator` 0.9.0, `jsonschema` 4.26.0, `streamlit` 1.65.0. Scripts run with `python -I`.

| Run | Payload | 3.0 schema | 3.1 schema | Result | Exit | Report |
|---|---|---|---|---|---|---|
| A | `payload_ok.json` (`{"receiptId": null}`) | `schema30.json` (nullable) | `schema31.json` (type union) | 3.0 valid, 3.1 valid | 0 | `evidence/A.json` |
| B | `payload_missing.json` (`{}`) | same | same | 3.0 invalid, 3.1 invalid (required) | 1 | `evidence/B.json` |
| C (control) | `payload_ok.json` | `schema30.json` | `schema31_unmigrated.json` (still `nullable`) | 3.1 blocked (`ValueError`) | 1 | `evidence/C.json` |

Run C is the guard check: the comparator must refuse a 3.1 schema that still uses `nullable`, and it does.

Streamlit UI: started headless on 127.0.0.1; `/_stcore/health` returned HTTP 200. Not exercised in a browser.

## Not done, and why

- **Migrating any schema:** no 3.0 baseline in the repo (above). Needs the 3.0 contract and its consumers named.
- **Live test run:** needs an approved staging host and `allowed_hosts`, plus approval to run. Not requested here.
- **Launch / deploy:** the kit is a local validation tool and the repo has nothing to deploy from it. The UI must not be published with student fixtures (checklist).
- **Signed rollout acceptance, SDK regeneration, schema-registry consumers:** not in the repo; out of scope for this change.
- **The two PDFs** (`OAS_MIGRATION_CHECKLIST.pdf` and the 11-page 3.0 vs 3.1 checklist) were not read: the session's file-read hook blocks binary PDFs. The `.md` checklist was used.

## Limitations (from the kit itself)

Payload Schema Objects only. No `$ref` resolution (standalone schemas only), no full OAS or HTTP compliance, no authentication or business-policy validation, no full directional `readOnly`/`writeOnly` validation.

## Next executable step

Name the 3.0 baseline (the contract or SDK that still speaks 3.0). Then: freeze it, convert its Schema Objects to standalone form, run `compare_oas_payloads.py` per payload case, and record reports under `evidence/`.
