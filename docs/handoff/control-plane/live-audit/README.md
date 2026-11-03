# Live registrar audit scaffold
Requires requests, PyYAML, jsonschema and openapi-spec-validator; pin reviewed dependencies.
Run: python live_registrar_oas_runner.py --spec bundled.openapi.yaml --plan approved-plan.json --report live-report.json
Case: {"name":"expired token","method":"GET","path":"/pep/access-requests/{requestId}","path_parameters":{"requestId":"synthetic-id"},"token_env":"TEST_EXPIRED_TOKEN","expected_statuses":[401]}
No target, tokens or captures supplied. Python syntax checked; no endpoint/OAS validator execution. GET/HEAD only. All mutating methods blocked. Manually review even GET endpoints before using an allowlist. Test data synthetic; tokens loaded from environment and omitted from reports. Reports omit payloads and exception messages but schema paths may contain field names. No retry, no redirect, no arbitrary headers. OAS document validation runs before requests. Missing operations cause failing full-coverage verdict, even when read cases pass.
Coverage CSV covers only eight base access-contract operations; it is not the entire Semester API. No execution evidence means not evidenced, not necessarily unimplemented.

## Repository status (2026-10-13)

- Source: uploaded `semester_live_oas_package.zip`. Files are unmodified except this README and the spec fix below.
- Spec under test: `docs/handoff/control-plane/access.openapi.yaml`. One YAML indentation defect (`revokeGrant` parameters, line 129) stopped the runner from loading it; fixed. `docs/handoff/control-plane/v2/access.openapi.yaml` has the same defect and is unchanged.
- Pinned verification deps: PyYAML 6.0.2, requests 2.32.3, jsonschema 4.23.0, openapi-spec-validator 0.7.1.

| Check | Result |
|---|---|
| Runner compiles | pass |
| Spec validates as OAS 3.1.0 (7 paths, 8 operations) | pass |
| Guard: `live_test_plan.template.json` (no approved host) | refused, `Unapproved HTTPS target` |
| Local self-signed HTTPS mock (not a Semester environment): two GET cases, 401 | both pass |
| Control: same case with a wrong expected status | fails, `UNEXPECTED_STATUS` |
| Full run against mock | overall FAIL, 6 operations `not_tested` (by design) |

Not done: no run against any Semester staging host. No approved target, synthetic data or tokens were supplied. Write operations are blocked by design; full coverage needs a separately approved isolated write runner. Six of eight operations are not evidenced.

Known runner caveats: uses `jsonschema.RefResolver`, deprecated since 4.18 (DeprecationWarning); no directional `readOnly`/`writeOnly` handling; JSON response bodies only.
