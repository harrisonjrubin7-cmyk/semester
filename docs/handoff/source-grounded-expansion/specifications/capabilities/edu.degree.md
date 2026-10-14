# edu.degree — Degree planning

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/degree
Actors declared: student, advisor
Permissions declared: plan.edit
Design reference: student/index.html (linked target not verified)
Screen types: overview, detail, edit

## Record authority reconciliation
- acad.requirements: reference migration 130_academic_core; RLS declared True; policies: reqs_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.programs: reference migration 200_institution_domains; RLS declared True; policies: prog_read · select, prog_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.degree_evaluations: reference migration 200_institution_domains; RLS declared True; policies: de_self · select, de_advise · select, de_self · select, de_advise · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- run_scenario: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: none declared; review required for mutations.

## Connected operating loop to complete
Identify first meaningful action and owning source; authorize scoped record access; render current provenance; preview consequence/recovery where applicable; issue canonical command; persist receipt/event; refetch projection; reconcile discrepancies; provide support/revoke/rollback path. Do not invent a write for a read-only capability.

## Acceptance
- Confirm actual repo key, routes, record owners and command handlers.
- Deny cross-tenant and unauthorized-object reads/search/cache access.
- Recheck expired/revoked grants and current versions at execution.
- For mutations: prove duplicate handling, durable transaction/receipt and event replay.
- For UI: ready/loading/empty/error/forbidden/offline/unavailable; freshness stays independent.
- For consequential actions: distinct approver where required; bind exact target/payload/version; reject changed or expired approval.
- Test relevant outage, reconciliation, accessibility and recovery paths.
- Collect exact-SHA code/test/deployment and applicable professional/customer evidence before activation.

## Evidence to retain
Owner [assign]; canonical key [resolve]; repo path [verify]; test command/run [retain]; environment/config/cohort [scope]; approval [authority + expiry]; outstanding risks [record]. No maturity promotion from this brief.
