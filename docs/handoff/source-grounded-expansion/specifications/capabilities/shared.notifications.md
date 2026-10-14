# shared.notifications — Notifications

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Shared services
Routes: /app/notifications, /app/settings/notifications
Actors declared: any
Permissions declared: notification.read, preference.edit
Design reference: mobile/index.html (linked target not verified)
Screen types: list, settings

## Record authority reconciliation
- comms.notifications: reference migration 140_coursework_comms; RLS declared True; policies: notif_self · select, notif_mark · update. Verify SQL expressions, grants, tenant keys and runtime.
- comms.preferences: reference migration 140_coursework_comms; RLS declared True; policies: pref_self · all. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- mark_read: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
- set_preferences: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: notification.delivered.

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
