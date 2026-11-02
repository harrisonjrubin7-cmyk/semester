# Required database tests (migrations 010–210)

Each test runs against a fresh local Supabase with two institutions (A, B), the platform tenant, and these people: student S (A), student T (A), instructor I (teaches section X in A), advisor V (advises S), registrar R (A), support agent G, finance F, and an outsider O (B). Write them as SQL tests (pgTAP) or as Vitest tests using per-user JWTs. **No test passes by default.** Each one must assert both the allowed case and the denied case.

Implemented as pgTAP in `tests/database/required.test.sql.txt` (40 assertions: 1–6, 11, 15–18, 21–24) and `tests/database/documents.test.sql.txt` (22 assertions: 7–9, 11, 12, 14, 19, 20). Tests 10 (parallel activation) and 13 (independent file authorization) need two concurrent sessions and storage, so they belong in Vitest integration tests. Run with `supabase test db`. They haven't been run yet, so a red first run is expected while ids and columns are reconciled.

| # | Test | Objects | Expect |
|---|---|---|---|
| 1 | Tenant isolation | every tenant table | O reads 0 rows of A; a direct RPC on A's ids returns NOT_FOUND |
| 2 | Section scope | acad.teaching_assignments, learn.* | I reads X's submissions; I reads 0 rows for section Y |
| 3 | Own-submission access | learn.submissions | S reads own; T reads 0 of S's |
| 4 | Draft invisibility | learn.modules/content/announcements, learn.grade_entries | Students see only published or returned; drafts are 0 rows |
| 5 | Client writes denied | all schemas | insert/update/delete as authenticated fails, except tasks, preferences, personal calendar, career, study artifacts |
| 6 | Cross-tenant FKs | learn.modules→acad.sections(id, institution_id) | inserting a module with B's institution_id on A's section fails |
| 7 | Self-review denied | api.transition_document | author approve → SELF_REVIEW_FORBIDDEN |
| 8 | Quorum | docs.review_tasks | first approval returns in_review; the last returns approved |
| 9 | Exact signature evidence | docs.record_signature_event | wrong hash → rejected_hash_mismatch, no evidence row; correct hash → evidence for that version only |
| 10 | Parallel activation | docs.version_states one_effective_per_doc | two versions made effective concurrently: exactly one effective, the other superseded or a conflict |
| 11 | Idempotency, conflicting payload | api.submit_work, api.create_document_version, api.transition_document | same key returns the same receipt; same key with a different payload must not create a second effect |
| 12 | Held archive | api.transition_document archive | legal hold → LEGAL_HOLD; retention worker marks blocked_by_hold and deletes nothing |
| 13 | Independent file authorization | comms.files + storage policies | a file id in a submission doesn't grant read to anyone outside the submission's RLS |
| 14 | Outbox retry and delivery | ctl.outbox + outbox.publish | a publisher crash after send but before mark re-sends; consumers dedupe on id |
| 15 | Ready needs evidence | acad.readiness_items | ready_as_of without as_of or fresh → check violation |
| 16 | Resolve ≠ ready | api.resolve_handoff | item becomes stale, never ready_as_of |
| 17 | Support window ≤ 4 h | opsx.support_access_windows | 241 minutes → check violation; revoke ends access immediately |
| 18 | AI grade review | learn.grade_entries | ai_suggested + returned without reviewed_by → violation; submit_grades_for_approval → UNREVIEWED_AI_SUGGESTIONS |
| 19 | Sensitive documents | docs.can_read with sensitivity | holder of docs:restricted without an audience row reads 0; an audience row whose access has ended reads 0 |
| 20 | Compensation separation | people.compensation_records | people:read alone reads 0 rows |
| 21 | Separation of duties | cofin.expense_claims, vend.purchase_orders, ops.repair_requests | approver = requester → check violation |
| 22 | Production deploy approval | ops.deployments | production live without approved_by → violation |
| 23 | Invitation | api.issue/accept/revoke_invitation | duplicate returns the same id; wrong email → FORBIDDEN; expired → EXPIRED |
| 24 | Accommodation visibility | svc.accommodation_plans | I sees plans only for students enrolled in I's section; never sees svc.restricted_cases |
