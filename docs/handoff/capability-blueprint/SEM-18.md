# SEM-18 — Company runs on Semester

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Company operations owner + security. Actual owner is unassigned.
Dependencies: Ops identity boundary, controls, approved external adapters.

## Requirements
Run sales handoff, delivery, trust evidence, customer success, incident work, planning and renewal queues in shared workspace. Keep company data isolated from student tenants. External specialist tools may execute identity, banking/payments, code hosting or legal functions through scoped integrations.

## Workflow
Company action → native work item → approval → authorized adapter/processor → reconcile receipt → evidence/support follow-up.

## Acceptance tests
Support resolves tenant configuration without browsing student records; finance approval does not grant academic access; external service failure is surfaced/recoverable.

## Metrics to define and measure
native workflow completion; duplicated work; reconciliation; company-access denials. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Nobody leaves the product means unified operational context, not eliminating necessary external systems or lawful approvals. No blanket student-data superuser.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:57;file:92. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
