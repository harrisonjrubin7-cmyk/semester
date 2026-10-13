# Workflow engine v2: uploaded specification set

Status: **proposed, unverified.** These files are the specification inputs for the workflow engine. They are not runtime behaviour. No handler is resolved, no binding is active, and no engine code in this repository reads them yet.

## Files

| File | Contents |
|---|---|
| `workflow_engine.schema.json` | JSON Schema 2020-12 contract covering six document types: `workflow_definition`, `execution_binding`, `execution_instance`, `execution_receipt`, `approval_grant`, `domain_event`. |
| `workflow_engine.examples.json` | Illustrative `registration.enroll` workflow with one binding, instance, receipt, approval and event. All IDs and refs are placeholders. |
| `registration_execution_binding.example.json` | Single draft binding for the registration commit step. |
| `background_task_bindings.json` | 17 draft `execution_binding` documents for background and AI, migration, community, privacy, developer and analytics steps. |
| `background_execution_binding_register.csv` | Human register of the same 17 bindings: transport, effect kind, durable result, failure and compensation, owner, and policy target. |

## What is already encoded

- Scope kinds (`personal`, `institution`, `company`) and tenant rules.
- Authority modes and `writer_policy`; official writes require `institution_scope_ref` and `activation_ref`.
- Execution states (`queued`, `running`, `result_unknown`, `reconciling`, `committed`, `failed`, …) and receipt kinds.
- At-least-once delivery with lease fencing, retry classes, and `reconcile_before_retry` for unknown outcomes.
- Approval grants with payload and impact hashes, expiry and revocation.

## Blockers before any of this can run

1. **Handler resolution.** Every `resolution.resolved` is `false` and every `handler_registry_key` is a draft. A binding cannot become `active` without a code reference, a digest and evidence.
2. **Registration authority, activation and institution scope.** `proposed:registration-authority`, `proposed:activation-required` and `proposed:tenant-registration-scope` are placeholders. Official writes stay blocked until an institution owner supplies them.
3. **Outbox and queue.** `ctl.outbox` is noted as an existing handoff definition with deployment unverified.
4. **Retry, lease and timeout values.** The register states these are illustrative and need approval per environment.
5. **Acceptance evidence.** All readiness gates are `unverified`, and every acceptance test has empty `evidence_refs`.

## Validation status (run with the uploaded validator, jsonschema 4.26.0)

Run against the schema as uploaded (`workflow_engine.schema.json`):

- `registration_execution_binding.example.json`: **rejected.** `delivery` allows no `transport` property, and every binding carries one.
- `workflow_engine.examples.json`: **rejected** for the same reason (its binding).
- `background_task_bindings.json`: **17 of 17 rejected**, same reason.

Removing `delivery.transport` in a scratch copy isolates the remaining failures:

- Registration example and workflow examples: pass.
- 15 of 17 background bindings: pass.
- `proposed.binding.ai.intent_identify` and `proposed.binding.ai.permission_validate` (`transport: guarded_inline`): still fail. The schema requires `delivery.semantics: at_least_once`, `ack_rule: after_durable_outcome` and a non-null `outbox_ref`, which a guarded inline call does not have.

`ee79049f-workflow_engine_validation_results.csv` reports these bindings as `accept`. Its fixtures are not in this repository, so this result has not been reproduced here.

Decision needed: either add `transport` (`durable_queue`, `scheduled_job`, `guarded_inline`) to `delivery` and make the durable-delivery fields conditional on it, or drop `transport` from the data. The two `guarded_inline` bindings need the same decision. The schema is the contract, so it was not edited without sign-off.

## Next executable steps

1. Validate the schema and examples with a JSON Schema 2020-12 validator, using a dependency that the owning package approves.
2. Implement the state transition guards in the workflow engine for `registration.enroll` only, behind a disabled binding.
3. Write tests for the acceptance suites (happy path, replay, concurrency, recovery, authority) before enabling anything.

## Registration recovery reference model

`reference-model/` holds an in-memory model of the registration commit and recovery rules, its 22-test suite, and the 17-case REG test matrix. Run from that directory with `python3 -m unittest test_registration_recovery_reference_model`. On 2026-10-13 all 22 tests passed in a scratch copy, matching `registration_reference_test_results.csv`.

Scope limits: these tests cover abstract contract behaviour only. Every matrix row is "not run" against the real authority adapter, database and row-level security, worker, provider or sandbox. Several checks are thin: the swap, withdrawal and authority-drift tests assert on constant return values, so they confirm the stub rather than the rule. The compiled `.pyc` in the upload was not loaded.

## Spec pack (uploaded 2026-10-13)

`spec-pack/` holds the uploaded contract and binding specifications, the onboarding fallback and resume test specifications (26 cases, not executed), and ten findings from inspected handoff code.

I checked one finding against the repository. `docs/handoff/semester-platform/supabase/migrations/100_controlled_actions.sql.txt` confirms BIND-01: `api.execute_action` sets `executed` and enqueues `ctl.outbox` before any domain work. It also confirms BIND-02: `idempotency_key` is globally unique and the lookup uses the key alone, with no payload hash. The remaining findings are unverified.

The pack's contract text says inline guards use synchronous delivery, while the schema requires `at_least_once` for every binding. That supports the open decision on `delivery.transport` above.
