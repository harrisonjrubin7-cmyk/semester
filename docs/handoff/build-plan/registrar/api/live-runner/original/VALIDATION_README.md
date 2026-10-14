# Live registrar audit scaffold
Requires requests, PyYAML, jsonschema and openapi-spec-validator; pin reviewed dependencies.
Run: python live_registrar_oas_runner.py --spec bundled.openapi.yaml --plan approved-plan.json --report live-report.json
Case: {"name":"expired token","method":"GET","path":"/pep/access-requests/{requestId}","path_parameters":{"requestId":"synthetic-id"},"token_env":"TEST_EXPIRED_TOKEN","expected_statuses":[401]}
No target, tokens or captures supplied. Python syntax checked; no endpoint/OAS validator execution. GET/HEAD only. All mutating methods blocked. Manually review even GET endpoints before using an allowlist. Test data synthetic; tokens loaded from environment and omitted from reports. Reports omit payloads and exception messages but schema paths may contain field names. No retry, no redirect, no arbitrary headers. OAS document validation runs before requests. Missing operations cause failing full-coverage verdict, even when read cases pass.
Coverage CSV covers only eight base access-contract operations; it is not the entire Semester API. No execution evidence means not evidenced, not necessarily unimplemented.
