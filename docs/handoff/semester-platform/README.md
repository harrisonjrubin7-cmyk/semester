# semester-platform

Database and API code for community, marketplace, ops and audit, built on the core Semester app (Next.js + Supabase).
Files end in .txt so they don't run in the design project. Strip the suffix when you copy them into the repo.

Install:
  cp supabase/migrations/*.sql.txt <repo>/supabase/migrations/ (rename to .sql)
  cp -r app lib tests <repo>/ (rename .ts.txt to .ts)
  npx supabase db reset && npm test

Status: written to the architecture guide. Not yet run, typechecked or tested; do that before you rely on it.

## Security hardening (Oct 2026)

migrations/050_security_hardening.sql.txt closes 11 findings from the review of 010–040 (2 critical/high: ops.staff self-insert as 'ceo', and moving a profile to another institution). tests/security.test.ts.txt proves each one. Apply 050 before any real data. Review: docs/secure/Platform Security Review.html in the design project.

migrations/060_command_functions.sql.txt: all community/market writes go through audited api.* functions (validation, rate limits, integrity filter, campus checks); storage policies for listing photos. Proven by tests/commands.test.ts.txt.

AI gateway: app/api/ai/route.ts.txt (auth → policy → gate → content scan → provider → audit), lib/ai/redact.ts.txt (blocks IDs, SSN, GPA, grades, transcripts, DOB, cards typed into prompts), migrations/070_ai_gateway.sql.txt (tenant policy, course rules, usage log with no prompt content), tests/ai-redteam.test.ts.txt (launch gate).

080_sources_storage_delegations: approved-source AI context, private buckets with path rules, audited delegations. middleware.security.ts.txt: CSP/HSTS/headers. .github/ci-security-job.yml.txt: secret scan, audit, guards, security tests.

## Education core and company (Oct 6 2026)

The first twelve migrations had no academic domain. These add it, with operations and company data:
- 130_academic_core: terms, courses, sections, enrollment mirror, holds, requirements, readiness_items (seven states; 'ready_as_of' needs a time and fresh source), advising (assignments, slots, notes), office_handoffs. api.book_advising, api.route_blocker, api.resolve_handoff (resolving never marks ready; the next sync must confirm).
- 140_coursework_comms: assignments, grades mirror, tasks, threads/participants/messages, notifications + preferences, files, calendar. api.send_message.
- 150_operations: fin.ledger_accounts RLS fix; support cases, case events, student-approved support access windows (≤ 4 h by constraint), privacy requests, integrations (SIS/LMS read-only by constraint), sync runs, incidents, access_jobs (control-plane baseline). api.approve/revoke_support_access.
- 160_company: CRM accounts/contacts/opportunities, contracts register (renewal date generated), pilots and measures ('measured' needs a result), partner apps and installs, subprocessors (student data needs a DPA). New capabilities.

- 170_ownership_learning_docs_workflow_commerce: core.workspaces (personal / institution / company, enforced by constraint); course_versions; teaching_assignments (course access needs a course relationship); learn schema with composite tenant-aware FKs: modules, content, rubrics, submissions (idempotent api.submit_work with receipt), assessments and attempts, working grade_entries separate from SIS final grades (AI suggestions can't leave draft without a human reviewer), grade_revisions, feedback, announcements; docs (immutable versions by trigger, explicit join tables instead of entity_type/entity_id, signature evidence tied to a version, retention, legal holds, acknowledgments); workflow engine; commerce (account ≠ institution via account_organization_links; no active subscription without a contract).

- 180_document_state_machine: docs.version_states (one effective version per document), review_tasks, transition_events; api.transition_document runs the nine-state machine in one transaction: idempotent replay, expected-state check, allowed edge, reviewer assignment, author conflict, all required approvals, signature evidence, legal hold, outbox.

- 190_document_gaps: sensitive document classes with explicit audiences, external signers, verified provider callbacks (docs.record_signature_event), retention schedule with holds. Route: app/api/signatures/callback.route.ts.txt. Worker: workers/retention.ts.txt.

- 200_institution_domains: iam (memberships, invitations with api.issue/accept/revoke_invitation, org units, campuses, access reviews), programs, rooms, degree evaluations, admissions, services and cases, restricted cases with explicit staff, accommodation plans (faculty see instructions only for their enrolled students), student accounts, integration mappings, implementation projects, credentials, careers, study artifacts, governance.
- 210_company_ops_domains: company finance (posted history immutable), people (compensation needs its own capability), vendors and purchase orders (approver ≠ requester), quotes, campaigns, CMS with approved claims, exec, legal, product, research, IT, analytics, AI configs and evaluations, developer credentials, permission-aware search index, security, and ops (services, SLOs, alerts, builds, deployments with production approval, flags, jobs, migrations, repairs, backups, restore exercises, tenant lifecycle, usage).
- tests/REQUIRED.md: 24 tests, each asserting the allowed and the denied case.

- 220_outbound_webhooks: endpoints (https, one allowed host, vault secret ref), deliveries with fenced leases; enqueue (fan-out from outbox), claim (SKIP LOCKED, reclaims expired leases), complete (STALE_LEASE on token mismatch), api.replay_webhook (job.replay, audited). Worker: workers/webhook-delivery.ts.txt (uploaded) + workers/webhook-store.supabase.ts.txt.

- 230_commands: 44 more api.* commands following one pattern (authorize → validate → write → audit → outbox): grants and access reviews (no self-grant; high-impact grants expire ≤ 90 days), extensions, assessment attempts (accommodation minutes applied), service requests, restricted support, privacy requests (identity verified before fulfilment), accommodations, admissions, governance votes (no self-vote), sync runs, rollout evidence, CRM, quotes (>15% discount needs approval), invoices, expenses and purchases (no self-approval; vendors touching student data need a current review), offboarding (revokes every grant), tenant lifecycle via controlled actions, flags, deploys (blocked by failing AI evaluations), rollback, incidents (72 h notice clock when student data is affected), job replay, repairs, restore tests, findings, moderation, key rotation (24 h overlap).

229 tables in total, all with RLS. Browse them: ui_kits/data-model/index.html. Server reference: SERVER.md.
Not applied or tested. The repo already has its own supabase/migrations: reconcile table by table first.
