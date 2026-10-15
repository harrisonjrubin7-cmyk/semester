# Workflow engine validation contract v2

## Scope

Proposed JSON Schema Draft 2020-12 contract for six engine document types: workflow_definition, execution_binding, execution_instance, execution_receipt, approval_grant, domain_event. Seventeen reusable definitions cover scope, authority, controls, evidence, readiness, step/transition/recovery, retry and lease. Unknown object fields are rejected.

The schema supersedes the earlier outline; version 2 must be introduced through a compatibility adapter and explicit version negotiation. Do not mutate stored v1 definitions in place. Definition versions and execution snapshots are immutable. In-flight executions remain pinned to their reviewed version unless an authorized migration records how they change.

## Conditional rules

Institution scope requires tenant; personal scope requires person and no tenant. High/consequential risk requires human authority policy. Official writes require institution scope, supported authority mode, institutional activation reference and idempotency. Human authority may be institution-delegated deterministic registration, not mandatory human approval of every eligible enrollment. Exceptions follow approved policies.

Background/hybrid steps require bindings; interactive/hybrid steps require surfaces. Active bindings require resolved code, digest and evidence; draft proposed handlers cannot activate. Event triggers require event type; scheduled triggers require schedule. Durable delivery is at least once with ACK after durable outcome; inline guards use synchronous delivery. Unknown effects require reconciliation before retry. Running instances require a lease; committed instances require a receipt. Accepted receipts cannot claim business completion. Corrected receipts require a predecessor. Approval validity is payload/scope-bound and time-limited; self-approval forbidden for this explicit grant type.

AI consequential decision authority is false. Verified readiness needs evidence. Production enablement requires design/code/test/deployment gates; official record use additionally requires institutional authorization.

## Semantic and bundle checks

Validator checks duplicate IDs, references, reachability, terminal paths, recovery/test coverage, official-write suites, lease timing, retry delays, scope/effect mismatch, timestamp ordering and requester/approver distinction. Bundle validation checks definition/binding/version/state links and instance/receipt/approval tenant and payload binding. Strict resolution mode rejects draft bindings.

CLI: pass the schema and one JSON document or the six-document examples array to the included Python validator. Target environment requires jsonschema. The validator enables FormatChecker; draft 2020-12 format annotations alone are not sufficient to assume date/UUID validation.

## Runtime checks not established by JSON validity

Verify authentic identity and signature; current grant/approval expiry/revocation; source freshness; actual registry and code digest; policy and authority scope; provider idempotency; data-store isolation; transactions; supported schema references; evidence integrity; capacity concurrency; retention and legal holds; accessibility; deployment; operational readiness. Proposed example references are deliberately unresolved. Successful schema validation is not permission to run.

The local validation report contains 55 checks: 23 accepted documents, 30 rejected mutations, one accepted six-document bundle, and one rejected cross-document payload mismatch. The strict activation check correctly blocks the illustrative unresolved registration binding. These checks do not prove actual database or provider behavior.
