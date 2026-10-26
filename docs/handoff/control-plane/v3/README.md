> **Superseded by `../baseline/`** (see `../VERSIONS.md`). Kept for history.

# Control plane v3: the coordination baseline

The roles: OPA decides, the TypeScript coordinator manages provisioning and recovery, the PA issues and revokes limited grants, and the PEP enforces them. AsyncAPI describes how they coordinate; OpenAPI describes the request and inspection endpoints.

- **access-coordinator.ts.txt:** a 10-state machine, from EVALUATING to CLOSED. A pure `applyResult()` reducer changes state with no network side effects inside it. `Coordinator.tick()` runs it durably, and a `revokeRequested` flag means late results can never reactivate access.
- **semester_access.rego and policy-data.json:** the OPA policy (v3 field names: `action_rule`, `risk_valid`). The score threshold is illustrative.
- **access.openapi.yaml:** the public intent submission plus one internal participant-operation endpoint.
- **access.asyncapi.yaml:** command channels for each of PE, PA and PEP, plus results, lifecycle and signals channels. It also documents the routing and result-acceptance rules.
- **RUNBOOK.md:** invariants, operation identity, the failure recovery tree, the operator procedure, safe replay and the release evidence.

How the versions relate:
- **v1** (`../`): first contracts and the trust-score Rego policy.
- **v2** (`../v2/`): a 15-state coordinator.
- **v3**: simplifies to 10 states with a pure reducer and per-participant command channels.

Pick one state model before you implement. **Superseded by `../v4/`** (compensation lifecycle, PE/PEP-specific policies and contracts, policy tests).
