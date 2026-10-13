# SEM-05 — Zero student records to AI providers

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Security + AI engineering. Actual owner is unassigned.
Dependencies: Data classification, retrieval controls, egress boundary, minimized telemetry.

## Requirements
Deny official education records and prohibited sensitive content across prompts, attachments/OCR, retrieval, conversation history, tools, diagnostics and fallback. Defense includes provenance-based denies plus classification; pattern scans are not sole enforcement. All provider-bound paths pass an inspected egress boundary.

## Workflow
Create synthetic canaries → exercise all data surfaces and routes → intercept actual serialized payload → verify deny/no canary → independently review → regression-gate change.

## Acceptance tests
Test obfuscated/multilingual record, embedded roster, cached context and tool-output leak; prove no provider call on forbidden payload and no sensitive logs; positive permitted public cases still work.

## Metrics to define and measure
prohibited canary escapes; unauthorized provider attempts; boundary coverage; critical test failures. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Zero observed failures in a specified corpus is a release criterion, not universal proof of immunity. Existing unit suite is not live transport evidence.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:94;file:95. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
