# Semester developer integration brief

## Goal
One living Education OS connecting planning, learning, registration, advising, tutoring, career, campus services, finance and administration. Shared account, Action Center, search, workspace, education graph, design language and governed AI. Build native; integrate responsibly; transition authority by domain with proof.

## Delivery status
This pack contains a NEW LOCAL reference Course Studio domain, SQLite migration, tests and documentation. It is not a replacement repository, complete platform, public deployment or patch applied to existing Semester. Previous-turn generated files were not present in the current execution environment, so this pack is standalone rather than an unverified modification of that archive. No real student/company data is included.

## Verified repository setup
Read from harrisonjrubin7-cmyk/semester package.json and app/package.json. Root workspaces: app and packages/*. Node >=22. Application scripts: Vite development, TypeScript plus Vite build, Vitest tests.

```sh
npm ci
npm run dev --workspace app
npm run test --workspace app
npm run build --workspace app
npm run registry:validate
npm run platform-control:test
npm run release:check
npm run release:report
```
These commands were inspected, not executed here. Review current environment instructions and each script before running; some reports may write local artifacts. Existing manifests are evidence of available commands, not passing results.

## Local reference setup
Python 3.10+; standard library only.

```sh
python migrate.py --database semester-local.sqlite --backup semester-local.backup.sqlite
python -m unittest discover -s tests -v
python demo.py
```
Migration backup must not already exist. No prior backup is created for a nonexistent database. Local demo and tests do not connect to remote systems. No web server/UI is included in this domain reference pack; the previous starter remains a separate UI demonstration.

## Architecture flow
Identity → trusted tenant/context → membership and capability → policy → domain command → transaction/outbox → workflow execution → audit/reconciliation → receipt → permission-aware projection/search → UI.
Personal, institution and company contexts share infrastructure, not blanket access. Authentication must establish user identity server-side; caller-supplied IDs in the reference code are not production authentication. SQLite offers no built-in row-level security here. Application filters and tests do not replace production tenant isolation.

## Course Studio reference contract
create: scoped faculty create a draft. save: owner capability plus optimistic version validation. publish: owner capability, matching version, draft status; atomic snapshot + working-state update + audit. read: faculty workspace sees working state; student/viewer sees latest published snapshot, never subsequent private draft edits. Publication snapshots are protected by triggers against update/delete in this local reference.
This reference uses simplified tenant-wide membership, NOT real section enrollment or teaching delegation. Faculty reading other faculty drafts is allowed in the sample policy and must be replaced with institutional scope rules. No submissions, grade decisions, notifications, AI or institution authority are implemented.

## Full Course Studio completion contract
Course/section enrollment; scoped teaching delegations; syllabus; objectives; resource versions; assignment versions; accommodation-aware assessments; durable submission receipts; human review; feedback and grade-release policy; course AI rules; analytics disclosure; import/export; archive. Published versions must remain stable, retries idempotent, timeouts reconciled, and official grade passback verified. Private study work remains separate from submitted work.

## Integration events — proposed, not verified production contracts
AssignmentPublished → course projection → Action Center/calendar → permission-aware notification. SubmissionAccepted → receipt → review queue → authorized feedback release. FinancialReportingApproved → audience-specific immutable board package. Use transactional outbox and durable consumers in production; reference code does not implement them.

## SQLite migration and recovery
Versioned migration creates tenants, memberships, courses, publications and audit. Checksum changes are rejected. Foreign keys are enabled by reference connections. Database owners can bypass triggers; these are not tamper-proof audit controls. Use approved retention/holds before restricting real deletion. This migration is standalone, NOT an upgrade of previously generated objects-based schemas. Do not apply it to existing Semester or Supabase. Recover local failures using a verified backup; do not blindly roll back production schemas.

## Existing connected environment discovery
Vercel has existing repository-linked projects including semester, semester-company-site, web and api. Latest listed semester production build reports READY for commit 3af3ab1fb2d5bd7dad3bc2ffa9bc49477b3a5a09. This is build metadata, not end-to-end verification. Supabase lists Semester2, semester and a restore-drill environment, all ACTIVE_HEALTHY at inspection. Their production mapping was not established. Do not choose the target based on name alone.

## Production launch sequence
Audit exact repository code and environments → reconcile canonical registry → implement/harden shared identity and policies → complete every catalogued workflow and role → verify domain data and authority → test staging journeys and failures → verify monitoring/restore/rollback → approve exact release and migrations → deploy → verify endpoints and role journeys → enable institution-authorized capabilities.
Every capability tracks design, implementation, tests, deployment, institutional authority and availability separately. No screen count or READY build proves every workflow is live.

## Metrics and stakeholder publication
Definitions pin units, period, source, numerator/denominator, exclusions, actual/target/forecast, owner and disclosure. Distinguish recurring contracts, recognized revenue, cash collections and one-time pilots. Static runway = unrestricted cash / positive historical mean operating net burn. Forecast runway = first reserve breach in an approved scenario; horizon is explicit. Missing is not zero. Pipeline probabilities are assumptions. Risk likelihood × impact uses approved severity policy.

## Testing scope
18 local unit tests executed. Covers draft/publish, stale versions, immutable snapshots, scoped reads, membership denial, cross-tenant lookups, atomic validation, foreign keys, migration idempotence, persistence and audit. Not tested: browser, HTTP, authentication, production database/RLS, real enrollment, full app CI, accessibility, load, provider integration or live journeys.

## Change approval
No remote state changes were made. Repository commits, database migration, deployment or production promotion require exact target/content review and confirmation.
