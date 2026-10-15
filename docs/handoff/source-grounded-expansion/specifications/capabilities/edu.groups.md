# edu.groups — Collaboration

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/groups, /app/groups/:id
Actors declared: student
Permissions declared: post.create, report.create
Design reference: community/index.html (linked target not verified)
Screen types: list, detail, edit

## Record authority reconciliation
- community.groups: reference migration 020_community; RLS declared True; policies: g_read · select, g_create · insert. Verify SQL expressions, grants, tenant keys and runtime.
- community.members: reference migration 020_community; RLS declared True; policies: m_read · select, m_join · insert, m_read_same_group · select. Verify SQL expressions, grants, tenant keys and runtime.
- community.posts: reference migration 020_community; RLS declared True; policies: p_read · select, p_write · insert, p_moderate · update. Verify SQL expressions, grants, tenant keys and runtime.
- community.reports: reference migration 020_community; RLS declared True; policies: r_create · insert, r_mod · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.create_post: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.report: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: post.created, report.filed.

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
