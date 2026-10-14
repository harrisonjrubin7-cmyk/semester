# edu.inbox — Communications

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/inbox, /app/inbox/:thread
Actors declared: student, instructor, advisor
Permissions declared: message.send
Design reference: ops-inbox/index.html (linked target not verified)
Screen types: list, detail

## Record authority reconciliation
- comms.threads: reference migration 140_coursework_comms; RLS declared True; policies: th_member · select. Verify SQL expressions, grants, tenant keys and runtime.
- comms.participants: reference migration 140_coursework_comms; RLS declared True; policies: pt_member · select, pt_self_update · update. Verify SQL expressions, grants, tenant keys and runtime.
- comms.messages: reference migration 140_coursework_comms; RLS declared True; policies: msg_member · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.send_message: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: message.sent.

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
