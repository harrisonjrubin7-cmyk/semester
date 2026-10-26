# SEM-04 — Course-, policy- and source-aware AI

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: AI engineering + security/privacy + academic policy. Actual owner is unassigned.
Dependencies: Graph, approved sources, deterministic policy, provider registry.

## Requirements
Use one gateway that resolves institution/course/assessment/user/provider restrictions before retrieval and routing. Explain official rules without becoming the rule. Allow only policy-approved context and bounded tools; no direct browser provider keys.

## Workflow
Classify request → evaluate effective policies → retrieve permitted current sources → select approved route → evaluate output → label/cite → student review or human handoff.

## Acceptance tests
Outline-only policy denies prohibited writing; source injection cannot grant tools; fallback cannot weaken policy; model-generated confidence is not presented as validated certainty.

## Metrics to define and measure
policy denials; unsupported citations; applicable evaluation results; human escalation completion. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Resolve existing approved-sources-only policy versus broader personal-context UI before widening retrieval. No student record transmission is permitted.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:94;file:110. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
