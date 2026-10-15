# edu.courses — Courses and terms

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/courses, /app/courses/:id
Actors declared: student, instructor
Permissions declared: course.read
Design reference: course-studio/index.html (linked target not verified)
Screen types: list, detail

## Record authority reconciliation
- acad.terms: reference migration 130_academic_core; RLS declared True; policies: terms_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.courses: reference migration 130_academic_core; RLS declared True; policies: courses_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.sections: reference migration 130_academic_core; RLS declared True; policies: sections_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- acad.enrollments: reference migration 130_academic_core; RLS declared True; policies: enr_self · select, enr_teach · select, enr_advise · select, enr_registrar · select. Verify SQL expressions, grants, tenant keys and runtime.

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
