# OAS 3.0 to 3.1 checklist
- Freeze original spec and client/server contract versions.
- Inventory Schema Objects separately from Reference Objects.
- Replace nullable with null unions; preserve required presence and enum intersections.
- Convert exclusiveMinimum/exclusiveMaximum boolean form to numeric bounds.
- Select and support jsonSchemaDialect and resource-root $schema.
- Review $ref sibling behavior; do not flatten schemas blindly.
- Assert polymorphic tags using const/enum and oneOf/anyOf; discriminator alone is insufficient.
- Review additionalProperties versus unevaluatedProperties under composition.
- Map tuple schemas to prefixItems; test extra items.
- Specify format assertion policy and direction-aware readOnly/writeOnly behavior.
- Test missing/null/empty/unknown properties and all consequential operation branches.
- Validate complete OAS document, request/response instances, HTTP headers/parameters, auth and business behavior separately.
- Revalidate SDK/code generation and schema registry consumers.
- Retain semantic diff and signed rollout acceptance.

Delivered comparison script: self-contained payload schemas only, no reference resolution or full HTTP validation. Dependencies: openapi-schema-validator, jsonschema; interactive UI adds streamlit. Pin reviewed versions. Syntax checked only, dependency/runtime validation not executed.
Run CLI: python compare_oas_payloads.py --payload synthetic.json --schema30 schema30.json --schema31 schema31.json --report comparison-report.json
Run UI locally: streamlit run interactive_oas_compare.py --server.address 127.0.0.1 --browser.gatherUsageStats false
Do not publish the UI with student fixtures. Reports omit values but fixture storage and server telemetry need operational controls.
Coverage report is an eight-operation access-control inventory, not full Semester API coverage. not_evidenced means no accepted run results supplied.
