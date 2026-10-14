# Three complete-loop increments anchored to actual source IDs
## Registration readiness
edu.registration → inst.handoffs → inst.registrar → shared.authz.approvals → shared.events.outbox → edu.today.
Records: acad.readiness_items, acad.holds, acad.office_handoffs, acad.terms and relevant enrollment/source records. Commands include api.route_blocker and api.request_action; verify handlers rather than treating catalog names as proof.
Acceptance: missing prerequisite unknown; one resolved hold never implies whole-cohort readiness; source age visible; no enrollment claim without owning authority; reconciliation of repeated/out-of-order events; approved office outreach; student view updated without repeating confirmed work.
Owner: Product/Registrar domain lead + Platform Engineering; institution source authority must be named.

## Student–faculty foundation
edu.courses → edu.content → edu.assignments → edu.assessment → edu.grading → edu.today.
Source commands include api.publish_module, api.submit_work, api.request_extension, api.start_attempt, api.submit_attempt, api.record_grade and api.submit_grades_for_approval. Publication must gate accessibility/AI rules; grade release must be distinct from grading. Add release command only after canonical repository reconciliation identifies the existing one or a genuine gap.
Acceptance: private drafts, accessible sources, course-tenant integrity, atomic submission/dedupe, scoped accommodations, rubric versioning, unreleased-grade protection and human-reviewed AI suggestions.

## Operations and privacy
shared.identity.sessions + shared.delegation + edu.privacy → ops.privacy + ops.access → shared.authz.approvals + shared.audit.
Separate the student's private work from institution records and company business reporting. Device revoke, delegation revoke and access expiry must invalidate actual server access/search/caches. A company operator cannot browse education-record bodies merely to triage.
Acceptance: exact scope and expiry; self-approval blocked; sensitive logs minimized; rights workflows respect authorized retention/holds; receipt, reconciliation and secure support handoff.

## Common connection chain
actor → record → action → preview → command → event → receipt → support → revoke/rollback.
Tie each loop to canonical workflow/capability keys and evidence. Do not create a second role, outbox or Action Center system. New abstractions remain design proposals until tested in the repository.
