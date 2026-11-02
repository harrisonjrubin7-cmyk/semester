# SEM-19 — Accessibility as product feature

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Accessibility + design/product/engineering. Actual owner is unassigned.
Dependencies: Shared components, manual tests, disabled-user feedback.

## Requirements
Target WCAG 2.2 AA with complete-process reviews; add user-controlled pacing, focus, reminders, reduced motion and alternatives. Provide accessible documents, charts, authentication, error recovery and institution support. Cognitive support cannot become coercive monitoring.

## Workflow
Co-design needs → implement semantics/options → automated checks → keyboard/assistive technology → disabled-user validation → remediate → retest.

## Acceptance tests
Registration/tutoring/study workflows work without mouse; drag has alternative; alerts are understandable; opting out of support has no penalty; offline/errors remain accessible.

## Metrics to define and measure
critical process success; blocker age; support resolution; regression rate; user-reported usability. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Conformance is scoped tested evidence, not inferred from tokens or a spot check. Never publish unverified ACR/conformance claims.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: web:61;file:57. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
