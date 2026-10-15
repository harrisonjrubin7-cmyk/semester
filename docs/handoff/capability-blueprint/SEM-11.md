# SEM-11 — One design system across product, site and ops

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Design systems + frontend/accessibility. Actual owner is unassigned.
Dependencies: Tokens, components, trust language, process testing.

## Requirements
Reuse shared semantic tokens, components, navigation, action previews, provenance labels and six-state patterns. Domain density changes layout not identity or trust semantics. Maintain versioning, visual tests, accessibility contract and documented exceptions.

## Workflow
Inventory surfaces → map shared patterns → replace divergences → automated checks + manual process review → version package → staged adoption.

## Acceptance tests
Site cannot promise a state product does not label; ops action preview uses same semantics; keyboard/screen-reader workflow passes across surfaces; themes retain contrast.

## Metrics to define and measure
component reuse; unreviewed exceptions; visual regressions; critical accessible process pass. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Design-system compliance does not establish whole-product accessibility. Existing assets must be inspected before creating replacements.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:57. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
