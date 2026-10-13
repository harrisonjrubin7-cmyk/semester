# Registration readiness pilot — build spine coverage (continue_3)

**Source:** `continue_3.pdf` (14 pages; text extracted with `pdftotext -layout`). It specifies the next layer after the readiness pilot plan: workflow state contract, policy bundle, durable job model, outbox and receipts, worker guards, failure matrix, contract semantic checks, config-change control, break-glass, release pack, drill catalogue, and a nine-step first code sprint.
**Repository base:** `origin/main` `2ff4c7ca`. Branch `claude/peaceful-bohr-l46545` was identical to it. No open pull request existed for the branch.
**Companion matrix:** `docs/program/PDF_EXECUTION_MATRIX_2026-10-09.md` covers the earlier eleven PDFs. This document covers only the continuation spec.

This is a requirement-to-evidence map, not a launch claim. A source file or a passing local test is implementation evidence only. It does not establish deployment, a connected institution, legal authority, tenant activation, or pilot results.

## Verification status for this change

- Docs only. No code, migration, or policy file changed.
- Tests were **not run**. The `node --test` command was denied by the session's permission system, so every "Observed" below comes from reading source, not from a green run.
- Claims about migrations, policy, and release gates were checked with `grep` and `Read` against the working tree.

## Nine-step first code sprint

| # | Spec artifact | Repository state | Status | Gap |
|---|---|---|---|---|
| 1 | Workflow state schema and transition tests | `packages/institution/src/readiness-workflow.ts` defines 8 states and the transition table. `readiness-workflow.test.ts` has 7 tests. `packages/platform-control/registry/workflows/registration-readiness.json` mirrors the same 8 states. | **Implemented for its own state set** | The spec has 11 states. `referred`, `resolved`, `cancelled`, and `failed` are absent from code. No exhaustive legal/illegal transition matrix test exists. See Decision 1. |
| 2 | Policy bundle and decision-record persistence | `infra/policy/` holds Rego for terraform and workflows, not readiness. `packages/institution/src/policy.ts` is a 609-line TypeScript policy module. No `readiness.rego`. No `policy_decision` record table or contract. | **Not started for readiness** | Needs Decision 3 (which engine enforces readiness commands). |
| 3 | Core tenancy, audit, outbox, and job migrations | Tenancy, RLS checks, and an outbox exist under other names (for example `support_notification_outbox`). No `jobs`, `job_attempts`, `job_state`, or `outbox_events` DDL found. | **Partial** | The generic durable job model in the spec is absent. |
| 4 | Readiness tables and source-verification records | `supabase/migrations/20261009160000_registration_readiness_store.sql`, plus `20261009202000` (FK indexes), `20261010000000` (completed outcome), and `20261010140000` (timeout contract). | **Implemented; one migration held** | `20261010140000` is held behind approval. Merging auto-applies production SQL (`docs/reference/registration-readiness-workflow.md` line 7). |
| 5 | Worker leasing, retry, quarantine, and replay guard | Evaluator caller with deadline, claim, and `unknown → reconciling` path is documented. Production injects no evaluator, so the command returns `503`. No `SKIP LOCKED` worker, lease, quarantine, or dead-letter for readiness. | **Not started** | The spec's lease/retry/quarantine worker does not exist. |
| 6 | Student summary and registrar queue projections | `packages/institution/src/readiness.ts` carries `sources` and `freshness` (lines 84, 139–141). No registrar queue projection found. | **Partial** | Student projection shape exists; registrar queue does not. |
| 7 | Student and registrar routes with all state variants | Student-only `POST /v1/registration-readiness/evaluations` and `…/evaluate` exist and fail closed. No registrar route. | **Partial** | Registrar surface absent. Student routes not exercised against a live source. |
| 8 | Release-pack generator and evidence validator | `packages/platform-control/scripts/check-release.ts` and `validators/release-validator.ts` are a platform release gate. No `releases/registration-readiness-0.1.0/` folder or pilot manifest. | **Partial** | Platform gate exists; pilot pack is not generated. |
| 9 | Launch rehearsals and institution sign-off | None. | **Blocked** | Requires approvals and an institution. See Launch blockers. |

## Invariants INV-RDY-001 to 007

The spec's invariant IDs do not appear anywhere in the repository. The rows below map each invariant to the nearest existing evidence.

| ID | Rule (abridged) | Nearest evidence | Status |
|---|---|---|---|
| INV-RDY-001 | Only a complete, current set of authoritative checks produces `ready` | Enforced by the evaluator adapter contract, not by the pure state machine. The machine checks only that a projection version is newer. | Partial |
| INV-RDY-002 | Stale or unknown source cannot produce `ready` | `docs/reference/registration-readiness-workflow.md`: expired or future-dated evidence is committed as `stale`. | Documented; not re-tested this turn |
| INV-RDY-003 | No readiness state confirms enrollment | `readiness.ts` has no enrollment vocabulary (grep for `enrol`: zero hits). No test asserts the rule. | Gap: add test |
| INV-RDY-004 | Every transition records audit and correlation ID | Every receipt and event carries `correlationId` (`readiness-workflow.ts`). Audit rows are written per the store migration, per the reference doc. | Partial |
| INV-RDY-005 | Human override is an independently approved decision | No override transition exists. | Not implemented |
| INV-RDY-006 | Late worker result cannot revive cancelled, revoked, or superseded evaluation | No `cancelled` or revoked state. Late results are fenced by compare-and-swap on version (reference doc). | Partial |
| INV-RDY-007 | Every student-visible outcome shows source, freshness, and next action | Projection carries `sources` and `freshness`. No `nextAction` field found (grep). | Partial |

## Named spec artifacts with no repository counterpart

None of these exist in the working tree:

- `docs/contracts/readiness-workflow.yaml`, `policy-decision.yaml`, `semantic-rules.yaml` (SEM-001 to SEM-006)
- `packages/authorization/policies/readiness.rego`
- `docs/governance/config-change-policy.yaml`
- `docs/security/break-glass-access.yaml`
- `docs/operations/drill-catalogue.yaml` (DRL-001 to DRL-009)
- `releases/registration-readiness-0.1.0/` with manifest, approvals, and rollback plan
- Generic `jobs`, `job_attempts`, and `outbox_events` tables

Some of these may map onto existing mechanisms. The platform-control registry already validates workflow contracts (`packages/platform-control/validators/workflow-validator.ts`). Choosing between parallel artifacts and extensions of the registry is Decision 2.

## Decisions needed from the owner

These change scope, data, or security, so the build does not pick them silently.

1. **State set.** The spec's 11 states or the code's 8. Adopting the spec means a state-machine change and a schema change to the held constraint. Recommendation: keep 8 for the first pilot slice and record `referred`, `resolved`, `cancelled`, and `failed` as deferred decisions.
2. **Where contracts live.** A new `docs/contracts/` tree or the existing platform-control registry. Recommendation: extend the registry so the existing validators enforce the contracts.
3. **Policy engine.** Rego as the spec describes, or the existing TypeScript `policy.ts`. Recommendation: pick one engine for readiness commands before writing any policy bundle.
4. **Held migration `20261010140000`.** Approve or defer. Merging it applies production SQL.
5. **Evaluator provider and institution SIS.** Required before any live readiness. Out of scope for this build.

## Launch blockers

- **No deployment performed.** No staging target is configured for this session.
- **Release approvals are all pending** in the spec's manifest: product, platform, security, institution business, and institution technical.
- **Merging to main auto-applies migrations.** A new migration is therefore a production change and needs explicit approval.
- **No SIS connection and no injected evaluator.** The production command path fails closed with `503` by design.

## Next executable task

After Decisions 1 and 2 are answered:

1. Add an exhaustive legal/illegal transition matrix test for the registry's states, and an INV-RDY-003 test asserting no enrollment vocabulary in the projection. Run it, then revert one transition to confirm the test fails.
2. Choose the policy engine (Decision 3), then write the readiness command policy and a decision-record contract, with tests.
3. Only then consider the worker and job model (spec steps 3 and 5), which needs the held migration decision first.
