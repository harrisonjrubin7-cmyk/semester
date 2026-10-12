# Control-plane versions

**Build from `baseline/`.** The other folders record how the design evolved. Don't build from them in parallel.

| Folder | Source PDF | Status | What carried forward |
|---|---|---|---|
| `baseline/` | OPA suite + saga runbook (Oct 2026) | **Current** | Unified zta.rego, saga guard, two workers, PostgreSQL jobs, tests |
| `v4/` (+ v4.1 files) | State machine runbook × 2 | Superseded | Compensation lifecycle, revocation barriers, operator runbook, time limits, escalation |
| `v3/` | AsyncAPI mapping | Superseded | Per-participant command channels, result acceptance rules, safe replay |
| `v2/` | Saga state machine | Superseded | Adapter requirements, transactional outbox, release gate |
| `./` (v1) | Saga orchestrator | Superseded | Idempotency model, the rule that a trust score can't compensate for missing authorization, component JSON Schema |

The event contracts (AsyncAPI) in v3 and v4 are still the most complete message descriptions. Update their state names to the baseline's (EVALUATE … VERIFY_CLEANUP) before use.
