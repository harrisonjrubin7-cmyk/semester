# SEM-07 — Reconciliation and recovery in every domain

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Data reliability + domain owner. Actual owner is unassigned.
Dependencies: Versioned snapshots, mappings, command ledger, recovery checkpoints.

## Requirements
Define per-domain comparisons for records, statuses, relationships, totals and meaning. Support stop, route rollback, restore, replay, compensation and forward correction; not every official transaction can legally or technically be undone. Preserve acknowledged post-checkpoint writes.

## Workflow
Snapshot → semantic compare → classify/assign differences → resolve → rerun → approve; on failure stop affected writes → authorized recovery → reconcile again.

## Acceptance tests
Grades, seats, credits and account balances have domain-specific tests; rollback cannot erase a confirmed grade or payment; external receipt survives retry/recovery.

## Metrics to define and measure
unresolved critical mismatch; drift age; recovery drill result; post-checkpoint write coverage. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Every activated domain needs tested recovery semantics. Do not promise literal undo for irreversible transactions; require institution-approved compensation paths.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:57. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
