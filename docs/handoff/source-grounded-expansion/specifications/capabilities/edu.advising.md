# edu.advising — Advising

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/advising
Actors declared: student, advisor
Permissions declared: appointment.book, note.write
Design reference: readiness-pilot/index.html (linked target not verified)
Screen types: overview, detail, edit, history

## Record authority reconciliation
- acad.advising_assignments: reference migration 130_academic_core; RLS declared True; policies: aa_parties · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.advising_slots: reference migration 130_academic_core; RLS declared True; policies: slots_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.advising_notes: reference migration 130_academic_core; RLS declared True; policies: notes_advisors · select, notes_student · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.book_advising: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: advising.booked.

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
