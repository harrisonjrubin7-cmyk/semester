# shared.ai.gateway — AI gateway

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Shared services
Routes: /app/assistant
Actors declared: student, instructor
Permissions declared: ai.use
Design reference: student/index.html (linked target not verified)
Screen types: detail, settings

## Record authority reconciliation
- core.ai_policy: reference migration 070_ai_gateway; RLS declared True; policies: aip_admin · select. Verify SQL expressions, grants, tenant keys and runtime.
- core.course_ai_rules: reference migration 070_ai_gateway; RLS declared True; policies: car_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- audit.ai_usage: reference migration 070_ai_gateway; RLS declared True; policies: aiu_admin · select. Verify SQL expressions, grants, tenant keys and runtime.
- core.sources: reference migration 080_sources_storage_delegations; RLS declared True; policies: src_read · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.ai_policy: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.ai_context: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.ai_log: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: ai.answered.

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
