# Live registrar OpenAPI audit (v2)

Read-only GET/HEAD checks against an approved **staging** host with synthetic data. Writes are never sent from here; they're covered by the captured-fixture validator in `../validator/`. `original/` is the package as uploaded. **Not run** — the design project has no Python or network access to your hosts.

```bash
pip install requests PyYAML "jsonschema>=4.18" referencing openapi-spec-validator   # pin reviewed versions
cp original/live_test_plan.template.json approved-plan.json   # fill in host, allowed_hosts, cases
python live_registrar_oas_runner.py --spec bundled.openapi.yaml --plan approved-plan.json --report live-report.json
```

## What changed from the uploaded runner

| | Original | v2 |
|---|---|---|
| Coverage verdict | Any POST/PATCH/DELETE in the spec counted as "missing", so a GET-only runner could never pass. | `missing_read_operations` fails the run; write operations are listed in `write_operations_for_capture_audit` for `../validator`. |
| Plan checks | A typo'd path or an undocumented expected status surfaced only as a runtime `KeyError`. | Refused before any request: unknown operation, write method, expected status not documented. |
| Coverage | A case counted as covered even when it got an unexpected status. | Only cases that received an expected status count. |
| Non-JSON body | Failed with just the exception type. | `RESPONSE_NOT_JSON` with the media type. |
| Missing token | `KeyError`. | `TOKEN_ENV_MISSING` naming the variable (never the value). |
| Host | Allow-list check. | Same, plus `allowed_hosts` required and IP-literal hosts refused. |
| Refs | `RefResolver` (removed in newer `jsonschema`). | `referencing` registry, remote retrieval refused. |

## Coverage note

`original/semester_access_missing_coverage.csv` lists only the eight base access-contract operations. It isn't the whole Semester API, and "not evidenced" doesn't mean "not implemented".
