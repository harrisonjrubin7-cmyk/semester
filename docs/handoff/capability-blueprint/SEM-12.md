# SEM-12 — Implementation factory: signature to launch

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Implementation lead + institution project owner. Actual owner is unassigned.
Dependencies: Signed scope, SSO, data access, policy, support, release gates.

## Requirements
Use reusable tenant templates, role/policy bundles, onboarding questionnaire, integration harness, mapping studio, training and launch communications. Signature starts delivery intake; readiness depends on customer/security/procurement prerequisites and approved workflow scope.

## Workflow
Signed handoff → readiness check → tenant/SSO → sandbox integration/mapping → policy approval → train → rehearse → launch cohort → monitor.

## Acceptance tests
Incomplete source access stops clocked readiness and creates an owned blocker; launch without isolation/rollback evidence fails; signed scope traces to enabled flags.

## Metrics to define and measure
signed-to-ready time; ready-to-launch time; blocked days by owner; defect/support load. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Illustrative 4–6-week launch window is a planning target for bounded prepared workflows, not universal SLA or full-SIS replacement promise.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:107. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
