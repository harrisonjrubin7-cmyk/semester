# SEM-09 — Tenant isolation proven per table in CI

Status: Proposed build specification, 2026-10-08. Not a verified implementation, test result, deployment, certification or approved commitment.

## Accountable roles and dependencies
Proposed owner: Database engineering + security. Actual owner is unassigned.
Dependencies: Schema discovery, policy manifest, test identities, CI.

## Requirements
Discover tables/views/functions/storage scopes from actual schemas. Register tenant/private/global scope with approved rationale. Fail CI on missing classifications or policies. Test SELECT/INSERT/UPDATE/DELETE, mutable tenant/role fields, RPC definer paths, services and company-role separation.

## Workflow
Schema change → compare manifest → generate role/tenant negative fixtures → run DB tests → publish table-operation results → independently review exceptions.

## Acceptance tests
Tenant A cannot access B; company role cannot see records; forged tenant insert/update fails; legitimate owner succeeds; global catalogs expose only approved fields.

## Metrics to define and measure
covered sensitive table operations; unclassified objects; unauthorized grants; failing denials. Define eligible population, numerator/denominator, observation window, source, exclusions, uncertainty and owner before reporting. No achieved values or universal targets are asserted.

## Activation boundary
Per-table proof is mandatory but not sufficient: test APIs, storage, search, caches, queues and exports too. No actual CI execution is claimed in this blueprint.

All relevant tenant isolation, privacy, source-authority, accessibility, monitoring/support, audit, recovery and institutional authorization gates remain mandatory. Evidence attaches to exact artifact/configuration and tenant/domain scope. Unresolved critical isolation, prohibited egress, unauthorized-action or official-integrity defects block activation.

## Existing evidence and implementation handoff
Source IDs: file:57. Existing design references are not proof of working production behavior. Audit relevant repository objects before coding; record exists/extend/new decisions and reuse shared contracts. Attach code/configuration mapping, scoped test output, independent review, institution approval and activation receipt separately.
