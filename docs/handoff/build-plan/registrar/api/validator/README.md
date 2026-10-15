# Registrar OpenAPI 3.1 contract validator (v2)

Checks captured request and response bodies against the registrar API's OpenAPI 3.1 document, and that every operation has at least one captured case. No production endpoint is called. `original/` is the package as uploaded.

## Run

```bash
pip install "jsonschema>=4.18" referencing openapi-spec-validator   # pin reviewed versions in the lockfile
python registrar_oas_validator.py --self-test                         # 16 synthetic cases → validator_self_test_results.json
python registrar_oas_validator.py --spec actual.openapi.json --captures approved-captures.json --report oas-report.json
```

Exit code 0 only when every case passes and there are no error findings. **Not run here** — the design project has no Python runtime, so `validator_self_test_results.json` is a placeholder until you run the self-test.

## What changed from the uploaded version, and why

| | Original | v2 |
|---|---|---|
| Why a negative case failed | Not checked. Six of the original ten passed on the same "matched none of `oneOf`" error, so a case would still pass if it was invalid for the wrong reason. | Negative cases must list `expected_errors` (keyword + instance path) and pass only if each one is reported. |
| Discriminated `oneOf` | Validated as a plain `oneOf`; errors stayed at the root. | The branch named by the discriminator is validated, so a bad UUID reports `/sectionIds/0 format`. Unknown values report `DISCRIMINATOR_UNKNOWN`; unmappable discriminators are a lint error. |
| `expected_valid` | Defaulted to `true`. | Required. |
| Coverage | A case that crashed still counted as covering its operation. | Only cases that ran count. |
| Reference resolution | `RefResolver` (deprecated, removed in newer `jsonschema`). | `referencing` registry; remote retrieval refused; local `#/components/...` refs resolve. |
| Formats | Implicit. | `uuid`, `date-time`, `date`, `email` asserted and listed in the report. |
| Self-test | 10 cases. | 16: adds valid swap and withdraw, missing discriminator, a client-sent server-only field (`readOnly`), a confirmed receipt, and a non-UUID receipt. |

## Captures

```json
{ "case": "invalid UUID", "path": "/registration", "method": "POST", "direction": "request",
  "content_type": "application/json", "payload": { "operation": "add", "sectionIds": ["bad"] },
  "expected_valid": false, "expected_errors": [{ "keyword": "format", "instance_path": "/sectionIds/0" }] }
```

Responses add `status`. Use synthetic identities only — never real student payloads in CI captures or reports.

## Limits (unchanged — still need work before it gates production)

- Request bodies only: parameters, headers, cookies and serialization aren't checked.
- Required-but-`readOnly` omission rules need an OAS-aware instance validator.
- No JWT signature or live-grant verification; that's covered by the RLS and connected-journey suites.
- Passing the contract doesn't prove FERPA handling, transactions or SIS correctness.
- A live HTTP runner must use an allow-listed staging target and authorization, and must never submit enrollment to production.
