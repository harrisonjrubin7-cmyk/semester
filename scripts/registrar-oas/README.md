# Registrar OAS validator

Checks captured registrar JSON requests and responses against an OpenAPI 3.1
document, and writes a report that omits payload values. It is a validator
scaffold, not a certification that the registrar API complies with OAS 3.1.

`registrar_oas_validator.py` is the uploaded package file, unchanged
(sha256 `597465a2…`).

## Run

```bash
python3 -m venv .venv-oas
.venv-oas/bin/pip install -r scripts/registrar-oas/requirements.txt

.venv-oas/bin/python -I scripts/registrar-oas/registrar_oas_validator.py \
  --spec actual.openapi.json --captures approved-captures.json --report oas-report.json

.venv-oas/bin/python -I -m unittest discover -s scripts/registrar-oas -v
```

Exit status is 0 only when there are no findings and every case matches its
expected validity. Captures must be synthetic or approved test data.

## Verified (2026-10-13, Python 3.13.16, jsonschema 4.26.0, openapi-spec-validator 0.9.0)

- Synthetic OAS 3.1 document: document validation **passed**.
- The 10 synthetic self-tests all pass. These match the uploaded self-test results, which had recorded document validation as `not_run`.
- `scripts/registrar-oas/test_registrar_oas_validator.py`: 12 tests pass.
- Control mutations, each run on a scratch copy: disabling the directional check, the dialect check, the external-reference lint, the nullable lint, the coverage check, or the payload-redaction guarantee each turns its matching test red.
- Repo OAS 3.1 drafts (`docs/handoff/action-center/contracts/semester-openapi-draft.json`, `semester-compliance-openapi-draft.json`, `docs/api/productivity.v1.openapi.json`): document validation passes. They have no captures, so every operation is reported uncovered. This is the intended block.
- Not run against the registrar's actual contract. No such file is in the repo or the upload. The validator takes JSON, and the registrar contract is not JSON in the repo.

## Not covered (from the package; reported as limitations)

- Live HTTP calls. Parameters, headers, cookies and serialization.
- JWT signature and current-grant verification.
- readOnly/writeOnly omission semantics and inherited annotations. These need an OAS-aware instance validator before CI approval.
- Every status code and schema branch. Dynamic refs, custom vocabularies, non-JSON media, remote resources.
- Registrar business invariants, FERPA authority, transactions, SIS correctness.

## Known issues

- `jsonschema.RefResolver` is deprecated since 4.18 and scheduled for removal. Move to `referencing` before upgrading jsonschema.
- Captures match the literal `paths` key. The uploaded README's "path (template)" is not implemented.
- The pins are the versions run here, not a reviewed compatibility assessment. The repo has no Python lockfile; `requirements.txt` is the only pin file.
