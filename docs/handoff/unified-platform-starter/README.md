# Semester unified platform starter

## Purpose
Semester connects planning, learning, registration, advising, tutoring, career, campus services and institutional operations through one account, Action Center, search, workspace, education graph and policy-controlled AI gateway. Build native, integrate responsibly, transition authority by domain with proof.

## Actual artifact status
This package is a NEW LOCAL DEMO, not a modification or verification of the existing Semester repository. It implements a shared responsive shell, SQLite persistence, sample task completion, course draft/publish with version conflict rejection, local preference persistence, board narrative inputs and local event logging. All records are samples. No institution integrations, login, tenant isolation, real permissions, AI, payments, submissions, official grades, deployed services or assurance certifications are implemented.

## Local launch
Requires Python 3.10 or newer. Extract the archive, enter its directory and run:

```sh
python server.py
```

Open http://127.0.0.1:8000. The server binds loopback only. Stop with Ctrl+C. Data persists in semester-demo.sqlite in the launch directory. Do not bind publicly or use real data. No additional Python dependencies.

## Proposed production architecture
Shared experience shell → identity/context → policy/capability enforcement → domain services → transactions/outbox → durable workflows/reconciliation → permission-aware projections/search → source-aware UI. Company reports use approved aggregates and business records, never raw education records. Personal workspace, institution workspace and company workspace are distinct authorization contexts.

## Context and authority
One account can hold multiple memberships; grants are evaluated per resource, tenant, purpose, action and session. Student-private notes do not become official records. Native content does not make grades authoritative. Cutover requires reconciliation, dual-run, institutional sign-off, rollback and release evidence.

## Course Studio specification
Audience: faculty authoring, scoped teaching assistants, enrolled students, authorized support. Structure: course home, syllabus, objectives, modules/resources, schedule, assignments, assessments, discussions, feedback, working grades, study support, teaching team, analytics, course AI rules, archive/import/export.
Workflow: draft → validate → preview → approval if required → schedule/publish → notify/projection → student submission → receipt → review → feedback release → archive.
Required entities: CourseOffering, EnrollmentMembership, TeachingDelegation, CourseModule, ResourceVersion, AssignmentVersion, AssessmentAttempt, SubmissionVersion, SubmissionReceipt, RubricVersion, FeedbackRevision, GradeProposal, GradeRelease, CourseAIPolicy. Published assignments pin versions; submission deadlines use explicit timezone; attempts retain accommodation settings; retries must not create duplicate receipts.
Student-private study artifacts remain separate from submitted work. Faculty can draft assistance but not automate official grade decisions through an unconstrained agent. Search and previews enforce membership. Working grades are labelled nonofficial until institutional authority gates pass.
States: loading, empty, error, no permission, offline, stale, draft, scheduled, published, late/grace, receipt pending, conflict, reconciliation required.
Acceptance: unauthorized roster access denied; duplicate submissions reconcile; timeout is not assumed failure; edits preserve submitted versions; accessibility tested; official passback reconciles; release evidence and rollback approved. These are requirements, not demo capabilities.

## Device and privacy mobile specification
Pages: privacy overview; app permissions; notification controls; active sessions/devices; connected accounts; sharing grants; access history; export; deletion request; accessibility.
Permission sequence: explain purpose → user chooses → request OS/browser permission → record observed result → offer fallback. App preference, OS permission, sharing consent and institutional processing authority are separate states.
Do not request background location, microphone or camera on onboarding. Ask at point of use; no permission means a usable fallback. Family grants specify recipient, fields, purpose, expiry and revocation. Recheck authorization on every read; stop future access after revocation; explain downloaded-copy limitations. Device removal requires confirmation and actual session/token revocation, not merely deleting a UI row.
Deletion: identify personal versus retained official data; check holds/retention; preview affected data; confirm; execute controlled jobs; verify cleanup; issue receipt. An account closure is not permission to erase academic records.
Offline: private draft storage and retry behavior require threat review; do not cache sensitive records by default. No real permission APIs, export/deletion or session revocation are implemented in this demo.

## Command center specification
Views: Action Center, workflow queues, launch gates, evidence, dependencies, incidents, reconciliation, document review, metrics and board reporting. Every action carries context, owner, source, due date, capability, state and receipt. High-risk operations require preview, approval, idempotency, audit and reconciliation. An operator cannot bypass tenant policy.

## Metric framework
Definition version; unit; actual/target/forecast distinction; numerator/denominator; exclusions; comparable period; source; freshness; completeness; owner; disclosure audience. Null is missing, never automatic zero. Targets remain historically fixed; revised forecasts are separate versions. Gross operating burn = operating payments. Net operating burn = operating payments minus operating receipts. Static runway = unrestricted cash / positive historical average monthly net operating burn. Forecast runway = first projected period below approved reserve; horizon absence is not infinity.
Risk rubric: likelihood 1–5 × impact 1–5; proposed scores 1–4 low, 5–9 moderate, 10–16 high, 17–25 critical. Record residual exposure, evidence, treatment, owner, due date and approved override.

## Data room
00 Index/disclosure; 01 Corporate/governance; 02 Capitalization; 03 Financials; 04 Commercial; 05 Product; 06 Trust/readiness; 07 Team/operations; 08 Investor reports; 09 Superseded. Stable document identity; immutable versions; exact-version approval; audience scopes; retention/hold; content hash; redaction lineage; pinned publication references.

## Production activation gates
1. Audit existing code and schema before choosing integration points.
2. Implement identity, membership, least privilege, tenant isolation and negative authorization tests.
3. Introduce server-owned capabilities, policy and durable command semantics.
4. Build source ingestion, freshness and reconciliation with rollback.
5. Complete Course Studio submission/review/release workflows before official-record use.
6. Implement real consent, permissions, sessions and verified deletion/export.
7. Enforce permission-aware search and bounded AI with evaluation.
8. Test accessibility, load, fault handling, recovery and observability.
9. Reconcile financial reports and obtain disclosure approval.
10. Obtain institution-specific approval, accountable owner acceptance and release evidence.

## Files
server.py: local API/store. index.html: responsive UI. tests.py: store tests. board-deck.html: printable slide outline. README.md: scope/specification. No deployment was performed.

## Evidence baseline
Project artifacts: docs/native-platform/NATIVE_SCREEN_CATALOG.md and NATIVE_DOMAIN_CATALOG.md, plus prior board-update materials. Their listed routes/statuses are design evidence, not verified implementation.
