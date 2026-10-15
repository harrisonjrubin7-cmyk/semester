# SEM-08 — Trusted consent and sharing

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Privacy + identity engineering + student product. Actual owner is unassigned.
Dependencies: Grants, classification, legal authority, revocation propagation.

## Requirements
Private workspace is private by default. Student sharing selects recipient, items/category, purpose and duration. Distinguish optional grants from institution-authorized record processing; consent cannot override prohibition. Enforce on reads, traversal, search, exports, agents and installs.

## Workflow
Preview precise scope → authorize grant → log recipient access → student views sharing dashboard → revoke/expire → invalidate derivatives and future access.

## Acceptance tests
Advisor sees selected plan but not private notes; family grant expires; app uninstall revokes tokens; already downloaded copies receive accurate limits and supplier follow-up rather than false erasure claims.

## Metrics to define and measure
grant clarity; revocation propagation; unauthorized read attempts; student comprehension; unresolved supplier deletions. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Revocation stops future authorized access; copies and legally retained official records require explicit disposition. Qualified review sets lawful/policy boundaries.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:109;file:99. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
