# SEM-16 — Developer platform and scoped installs

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Platform/API lead + partner security. Actual owner is unassigned.
Dependencies: API contracts, grants, sandbox, events, review program.

## Requirements
Provide versioned APIs/events, scoped app credentials, synthetic sandboxes, documentation, signed webhooks and deprecation. Install requires tenant approval plus student grant for private work; no broad service credential sharing. Semester-reviewed app badge has explicit tests/scope/expiry.

## Workflow
Register developer → assess app/scopes → sandbox tests → security/privacy/accessibility review → tenant install → student grant if needed → monitor/revoke.

## Acceptance tests
App cannot read outside grants or call unauthorized writes; uninstall invalidates access; scope expansion requires fresh review; webhook verification prevents forged events.

## Metrics to define and measure
scoped installs; contract test pass; revoked-token denials; deprecated API usage; app incidents. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Build full interface design now; ecosystem production activation waits for platform and partner assurance. Existing plan labels ecosystem post-pilot, not deployed.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:111. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
