# SEM-15 — LTI, OneRoster, Edu-API and SIS interoperability

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Integration engineering + source owner. Actual owner is unassigned.
Dependencies: Pinned adapter contracts, scopes, canonical mapping.

## Requirements
Implement standards and vendor adapters as versioned boundary layers. Declare LTI tool/platform role and individual Advantage services, OneRoster binding/service profiles, Edu-API published version/status, and SIS supported entities/directions. Separate implement/test/deploy/certify states.

## Workflow
Partner discovery → pin contract → scope authorization → sandbox conformance/negative tests → map → reconcile → scoped activation.

## Acceptance tests
Wrong issuer/deployment launch fails; repeated roster batch is idempotent; unsupported SIS write remains disabled; schema drift quarantines records.

## Metrics to define and measure
adapter contract pass; semantic coverage; unsupported fields; replay defects; certification scope. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Only claim 1EdTech conformance/certification under its actual membership/certification requirements; Semester internal app review is not 1EdTech certification.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: web:115. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
