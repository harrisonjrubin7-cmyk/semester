> **Superseded by `./baseline/`** (see `./VERSIONS.md`). Kept for history.

# Control plane: access saga, contracts and policies

Reference implementation design from `uploads/Build an end-to-end saga orchestrator state machin.pdf` (Oct 2026). It's meant for building and checking in the repository, **not for direct production deployment**. Nothing here has been compiled, linted or tested.

The interactive version is in `ui_kits/governance-backbone/index.html#saga` (the access saga) and `#control` (the control plane and PEP).

> **Superseded for the saga:** see `v2/` (access-saga.ts and aligned OpenAPI/AsyncAPI with VALIDATING/EVALUATING/PREPARING/INSTALLING/EXPIRED states). The Rego policy and component schema here remain current.

## Files
- `component.schema.json`: JSON Schema 2020-12 for one component definition. Server checks are still needed for:
  - references existing
  - dates in the right order
  - publish permissions
  - authority assignments that conflict or overlap
- `access.openapi.yaml`: OpenAPI 3.1 contract for the PEP, PE, PA and evidence endpoints. These are Semester's own API design; NIST doesn't define a standard API.
- `access.asyncapi.yaml`: AsyncAPI 3.0 contract for access lifecycle events and evidence observation events.
- `access.rego` and `policy-data.json`: OPA policy in Rego v1 syntax, plus its policy data. The trust thresholds 60 and 80 are illustrative, not NIST recommendations.

## Rules that are easy to get wrong
- A timeout means the outcome is unknown, not that the operation failed. Query the PEP or PA state before retrying.
- Idempotency: the same key with the same payload returns the recorded result; the same key with a different payload returns 409 `IDEMPOTENCY_CONFLICT`. Uniqueness must be enforced in durable storage.
- An expired decision is never reused to reinstall a missing grant; evaluate the policy again first.
- A trust score can never make up for:
  - the wrong institution
  - a missing capability
  - an expired membership
  - an unrelated resource
  - a revoked sharing grant
  - a missing approval
  - an invalid policy context
- Never build a trust score from grades, disability information, financial hardship or student-success labels.
- Compensation doesn't undo data someone has already viewed or downloaded. Never restore access that has been revoked.
- Lifecycle events must never contain credentials, raw trust signals or protected student data.

## Validate (only where OPA is installed)
```
opa check --strict access.rego
opa eval --data access.rego --data policy-data.json --input input.json 'data.semester.access.decision'
```

## Tests to add before deployment
- [ ] Same idempotency key with a different payload produces a conflict
- [ ] A restarted worker resumes the saved saga
- [ ] An install timeout queries the actual enforcement state before retrying
- [ ] A stale policy decision can't create a grant
- [ ] An approval is tied to the exact inputs and the current resource version
- [ ] The wrong institution is denied despite a high trust score
- [ ] An unknown policy action defaults to deny
- [ ] A failed revocation triggers recovery and a bounded expiry
- [ ] Duplicate and out-of-order events don't restore revoked access
- [ ] A failed evidence delivery doesn't erase audit history
- [ ] The OpenAPI, AsyncAPI and JSON Schema files validate with the chosen tools
- [ ] The PEP actually enforces every declared obligation
