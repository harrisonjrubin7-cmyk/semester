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

## Validation status (jsonschema 4.26.0, uploaded validator)

The first schema version rejected every binding because `delivery` had no `transport` property. The revised schema in `semester_workflow_execution_pack.zip` (now `workflow_engine.schema.json`) adds `delivery.transport` and makes `semantics`, `ack_rule` and `outbox_ref` conditional on it. This resolves the earlier decision in favour of adding `transport`.

With the revised schema, the uploaded validator passes:

- `workflow_engine.examples.json`: valid, 0 errors.
- `background_task_bindings.json`: valid, 0 errors, including the two `guarded_inline` bindings.
- `registration_execution_binding.example.json`: valid, 0 errors.

The strict resolved-binding mode was not run. All bindings are still drafts, so they should fail that gate; this has not been checked.

`commands/onboarding_command.schema.json` and `commands/registration_request.schema.json` pass Draft 2020-12 meta-validation. No instance tests exist for them yet.

Review fixes (PR #1572, Codex review of 76865ba1), with the schema change checked by negative cases:

- `lease`, `retry` and `partition_key_ref` are required only for `durable_queue` and `scheduled_job`. A `guarded_inline` binding validates without them.
- A `denied` or `failed` receipt must have `commit_proof_ref: null`.
- An `official_write` binding must have `scope.kind: institution`.
- `workflow_engine.examples.json` gains a `waitlisted` business state, with transitions to `enrolled` and `denied`, so the state has a terminal path. The `OUTCOME_UNKNOWN` recovery path now starts from `result_unknown`.
- Not fixed in the schema: a grant whose `approved_by` equals `requested_by`. JSON Schema cannot compare two fields' values. Activation code must reject self-approval.

The uploaded validator's semantic layer assumes every binding has `lease` and `retry`. It fails on a valid `guarded_inline` binding and is not in this repository. It needs the same transport branch before it is used as a gate.

The uploaded `ee79049f-workflow_engine_validation_results.csv` (55 checks, the 17 bindings marked `accept`) is not committed to this repository, and neither is the validator that produced it. Those results are unverified here.

## Next executable steps

1. Validate the schema and examples with a JSON Schema 2020-12 validator, using a dependency that the owning package approves.
2. Implement the state transition guards in the workflow engine for `registration.enroll` only, behind a disabled binding.
3. Write tests for the acceptance suites (happy path, replay, concurrency, recovery, authority) before enabling anything.

## Registration recovery reference model

`reference-model/` holds an in-memory model of the registration commit and recovery rules, its 34-test suite, and the 17-case REG test matrix. Run from that directory with `python3 -m unittest test_registration_recovery_reference_model`. All 34 tests pass in the repository. `registration_reference_test_results.csv` is regenerated from that run and names the committed module.

The review fixes added or changed these tests first: same-key retry after confirmed no-commit, capacity scoped by tenant and section, and redelivery after revocation observing the prior result. The second and third rounds added tests for: no receipt while the outcome is unknown, reconcile only from `result_unknown`, waitlist kept on the business track, inbox checked before fencing, durable denial, and rollback when a worker crashes before its inbox marker. Each new or changed test failed against the previous model before its fix, except the preview-to-commit revocation test (`test_REG_12_revoked_between_preview_and_commit`). The previous model already handled that path, so the test is kept as a regression guard, not as evidence of a fix. The fourth round (replay before authorization, payload snapshots, the waitlist receipt) added tests that fail against the previous model.

The schema also requires `compensation_ref` to be null when `compensation_kind` is `none`, on both bindings and recovery paths. Denied and failed receipts keep `commit_proof_ref` null.

Scope limits: these tests cover abstract contract behaviour only. Every matrix row is "not run" against the real authority adapter, database and row-level security, worker, provider or sandbox. Several checks are thin: the swap, withdrawal and authority-drift tests assert on constant return values, so they confirm the stub rather than the rule. The compiled `.pyc` in the upload was not loaded.

## Spec pack (uploaded 2026-10-13)

`spec-pack/` holds the uploaded contract and binding specifications, the onboarding fallback and resume test specifications (26 cases, not executed), and ten findings from inspected handoff code.

I checked one finding against the repository. `docs/handoff/semester-platform/supabase/migrations/100_controlled_actions.sql.txt` confirms BIND-01: `api.execute_action` sets `executed` and enqueues `ctl.outbox` before any domain work. It also confirms BIND-02: `idempotency_key` is globally unique and the lookup uses the key alone, with no payload hash. The remaining findings are unverified.

The pack's contract text says inline guards use synchronous delivery, while the schema requires `at_least_once` for every binding. That supports the open decision on `delivery.transport` above.
