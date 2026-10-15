# edu.calendar — Calendar

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/calendar
Actors declared: student
Permissions declared: calendar.edit
Design reference: student/index.html (linked target not verified)
Screen types: overview, detail, edit

## Record authority reconciliation
- acad.advising_slots: reference migration 130_academic_core; RLS declared True; policies: slots_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- work.assignments: reference migration 140_coursework_comms; RLS declared True; policies: asg_enrolled · select. Verify SQL expressions, grants, tenant keys and runtime.
- comms.calendar_events: reference migration 140_coursework_comms; RLS declared True; policies: cal_self · all. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- create_event: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: event.created.

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
