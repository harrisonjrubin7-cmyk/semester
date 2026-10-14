# edu.student_account — Student accounts

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/account
Actors declared: student
Permissions declared: self.read
Design reference: native-finance/index.html (linked target not verified)
Screen types: overview, detail

## Record authority reconciliation
- acad.holds: reference migration 130_academic_core; RLS declared True; policies: holds_self · select, holds_advise · select, holds_office · select. Verify SQL expressions, grants, tenant keys and runtime.
- instfin.student_accounts: reference migration 200_institution_domains; RLS declared True; policies: sa_self · select, sa_staff · select, sa_self · select, sa_staff · select. Verify SQL expressions, grants, tenant keys and runtime.
- instfin.charges: reference migration 200_institution_domains; RLS declared True; policies: ch_read · select, ch_read · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
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
