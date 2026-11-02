# SEM-03 — Education graph of relationships

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Data platform + academic architecture. Actual owner is unassigned.
Dependencies: Tenant identity, fact envelopes, grant model.

## Requirements
Model person→membership→section→assignment→objective→evidence→skill and requirement→credit→program relationships, plus services/opportunities. Node and edge permissions, ownership and retention are explicit. Derived relationships retain inputs and method versions.

## Workflow
Resolve canonical IDs → validate endpoints and tenant/grant boundaries → append versioned relationship → update authorized projections → detect duplicate/stale/missing edges.

## Acceptance tests
A tutoring referral can relate to an objective without exposing private notes; revoked sharing removes related search visibility; cross-tenant paths are denied unless explicitly granted.

## Metrics to define and measure
duplicate identities; orphan edges; denied unauthorized traversals; graph lineage coverage. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Use relational canonical tables plus explicit edges if suitable; a separate graph database is not required. Inspect and extend existing models before adding a new store.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:109. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
