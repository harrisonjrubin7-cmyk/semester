# Unmapped-step audit against background tasks

Date: 2026-10-13. Scope: the 84 rows in `unmapped_step_audit.csv`, checked against
`docs/master/SEMESTER_GAP_REGISTER.md` and the repo's catalogs. Design-level only.
No executor, job, route, or deployment was verified.

## What was checked

| Check | Result |
|---|---|
| Row count | 84, matches the audit pack |
| Class counts | U 22, B 17, H 23, O 22 (sum 84), matches the PDF summary table |
| Background-only list | The 17 `B` rows match the PDF's list exactly |
| Provenance (Codex review) | All 84 step rows are `GAP` entries in `docs/master/SEMESTER_WORKFLOW_CATALOG.md` (84/84 match). The `source` column now cites that file. The earlier citation to `SEMESTER_GAP_REGISTER.md` was wrong for these rows. The 419 screen rows cite `docs/master/SEMESTER_SCREEN_CATALOG.md`. Checked: all 405 distinct screen names occur in that catalog with a blank `In workflow` value on at least one row (five also appear in workflow elsewhere in the catalog). The 419 row-level count was not re-verified |
| Source disposition wording | The CSV rows carry the class-specific dispositions. The PDF's claim that the source register assigns "Add screen to catalog and render" to every step is **not supported**: that phrase does not appear in `docs/master/SEMESTER_GAP_REGISTER.md` (0 matches) |
| Catalog references | `docs/native-platform/NATIVE_WORKFLOW_CATALOG.md` is cited by the PDF and by `registration.workflow.example.json` (`catalog_links`) but **does not exist** in this repo. It appears only in archive manifests. The example's catalog link is dangling |
| Operations catalog | `docs/operations/OPERATIONS_WORKFLOW_CATALOG.md` exists |

## Disposition of the 17 background/control steps

Each step is a proposed disposition. None is closed by classification.

| Workflow | Step | Required evidence before closure |
|---|---|---|
| Institution implementation | Reconciliation passed | Reconciliation job, discrepancy visibility, owner |
| Controlled integration | Sandbox validated | Sandbox run record, pass/fail visibility |
| Controlled integration | Monitoring enabled | Alert configuration, failure routing |
| Controlled integration | Rollback verified | Tested rollback, evidence record |
| Governed AI request | Intent identified | Classifier executor, policy binding |
| Governed AI request | Prompt/tool permission validated | Permission check at tool boundary, denial audit |
| Governed AI request | Response generated | Generation path, provenance, timeout handling |
| Governed AI request | Usage/spend logged | Metering record, spend visibility |
| Support request | Routed to team/office | Routing rules, accepted-ownership record |
| Domain migration | Validation | Validation job, mismatch queue |
| Domain migration | Dual run | Parallel-run comparison, divergence queue |
| Domain migration | Enhanced monitoring | Monitoring config, alert owner |
| Community & moderation | Integrity filter checks listing | Filter executor, human review path |
| Family & guardian consent | Audit retained | Retention rule, audit store evidence |
| Developer platform | Sandbox tenant created | Provisioning job, tenant isolation check |
| Analytics | Instrument events (no PII) | Event schema, PII review |
| Analytics | Aggregate with minimum cell size | Aggregation job, suppression rule test |

For every row, closure requires: executor or control, authorization and policy, inputs
and outputs, audit/telemetry, failure detection, recovery owner, user or operator
visibility, and acceptance evidence.

## Hybrid and operational steps

- **Hybrid (23):** Each needs a link from the executor to an existing configuration,
  status, or exception surface. New pages are not assumed.
- **Operational (22):** Each needs an owned checklist, decision, or evidence record in
  the operations workspace. Link to `OPERATIONS_WORKFLOW_CATALOG.md` where it covers the
  step.
- **User interaction (22):** Map to an existing surface first. Add UI only where none
  exists.

## Corrections to the PDF

1. Drop the claim that the source register prescribes "Add screen to catalog and render".
   Nothing in the repo says that. The CSV dispositions are the auditable source.
2. Replace or create `docs/native-platform/NATIVE_WORKFLOW_CATALOG.md` before the example
   contract's `catalog_links` can be resolved. Until then, treat that link as unverified.

## Still unverified

Actual background-job inventory, executor code, route bindings, test evidence, institution
policies, external-system deduplication behavior, and named owners.

## Contract hardening after Codex review

Codex flagged five gaps in the contract tooling. All five were reproduced and fixed:

- Official-record writes require 12 suites (adds happy_path, approval_expiry, unknown_outcome, reconciliation, correction). The example was extended to 16 tests.
- Official-record writes are rejected in personal scope.
- Institution-scoped contracts with `production_enabled` verified require `institution_authorized` verified, regardless of writes.
- `readiness.tested` or `production_enabled` verified requires non-empty `evidence_refs` on every acceptance test.

The 14 original negative cases in `workflow_schema_validation_results.csv` were not rerun, and that CSV was not updated. The executable record is `docs/workflow-audit/test_validate_workflow_contract.py`: `python3 -m unittest test_validate_workflow_contract` runs every test in the module (the count is not recorded here, since it changes with each fix), and the registration example validates.
