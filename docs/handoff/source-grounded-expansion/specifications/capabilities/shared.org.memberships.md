# shared.org.memberships — Memberships

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Shared services
Routes: /institution/members, /invite/*
Actors declared: institution_admin
Permissions declared: membership.invite, membership.revoke
Design reference: role-lifecycle/index.html (linked target not verified)
Screen types: list, detail, edit, history

## Record authority reconciliation
- core.profiles: reference migration 010_platform_core; RLS declared True; policies: profiles_same_campus · select, profiles_self_update · update, profiles_self_read · select, profiles_staff_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- iam.memberships: reference migration 200_institution_domains; RLS declared True; policies: mem_self · select, mem_admin · select. Verify SQL expressions, grants, tenant keys and runtime.
- iam.invitations: reference migration 200_institution_domains; RLS declared True; policies: inv_admin · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.issue_invitation: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.accept_invitation: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.revoke_invitation: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: invitation.issued, invitation.accepted, invitation.revoked.

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
