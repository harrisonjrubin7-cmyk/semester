# Workflow expansion coverage

Source of truth: the workflow expansion register (`PROP-WF-001`…`PROP-WF-028`) and the workflow contract, both supplied with the build request. Neither is in the repository, and neither has been reconciled with existing IDs yet. This file is the first coverage map. It is not evidence that any workflow exists.

## Status of every item

The register gives every item the same status, so it is stated once here rather than repeated in 28 rows:

| Stage | Status for all 28 items |
| --- | --- |
| Design | Proposed expansion |
| Implemented | Unverified |
| Tested | Unverified |
| Deployed | Unverified |
| Institution authorized | Unverified |
| Production enabled | Unverified |

Evidence scope recorded by the register: "Project design catalogs inspected; live implementation not audited." Activation gate: "Verified implementation + negative tests + operational evidence + scoped authority where required."

## Contract every workflow must satisfy

Each workflow is a proposed specification until it carries all of these:

- **Identity:** stable ID, version, supersedes, existing catalog links.
- **Scope:** tenant, domain, actor, role grant, purpose.
- **Definition:** trigger, preconditions, inputs, outputs, states, transitions, exception paths.
- **Authority:** mode, authoritative system, effective dates, approval scope.
- **Controls:** classification, consent or other access basis, policy version, idempotency key, expected record version, audit events.
- **Completion:** receipt, projection updates, reconciliation, recovery or compensation, support owner.
- **Readiness:** design, code, test, deployment, institution authorization and production activation evidence.
- **Acceptance suites (10):** happy path, tenant isolation, role denial, concurrency, replay, revocation, stale sources, provider timeout, accessibility, restore or compensation.

No workflow in this file meets the contract yet.

## Coverage map

"Nearest existing docs" lists specification files in `docs/` whose names match the workflow's domain. It is a filename match, not a check that the document or code covers the capability. "None by filename" means no matching spec was found and the capability needs a new design.

| ID | Domain | Capability | Owner (register) | Nearest existing docs | Build state |
| --- | --- | --- | --- | --- | --- |
| PROP-WF-001 | Identity | Account and institutional membership | Platform identity lead | ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md, FERPA-IDENTITY-GUARDRAILS.md, SSO-TENANT-ONBOARDING.md | Unverified |
| PROP-WF-002 | Student workspace | Daily action loop | Student experience lead | ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md, RESILIENT-STUDENT-MODE.md | Unverified |
| PROP-WF-003 | Planning | Degree and term planning | Academic planning lead | None by filename | Unverified |
| PROP-WF-004 | Registration | Enroll, waitlist, add, drop, withdraw | Registrar domain lead | REGISTRATION-DAY-MODE.md, SPRINT-1-REGISTRATION-PATH.md | Unverified |
| PROP-WF-005 | Faculty | Course setup and publishing | Learning domain lead | FACULTY-COURSE-STUDIO-DESIGN.md, FACULTY-ENABLEMENT.md | Unverified |
| PROP-WF-006 | Learning | Syllabus ingestion | Learning domain lead | None by filename | Unverified |
| PROP-WF-007 | Learning | Study and mastery | Learning experience lead | None by filename | Unverified |
| PROP-WF-008 | Assessment | Assignment submission | Assessment lead | LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md | Unverified |
| PROP-WF-009 | Grades | Feedback, grade release, correction | Gradebook lead | LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md | Unverified |
| PROP-WF-010 | Advising | Advising and success plan | Advising lead | ADVISOR-MEETING-MODE.md, ADVISOR-RECONCILIATION-2026-09-30.md | Unverified |
| PROP-WF-011 | Tutoring | Tutoring and peer mentoring | Tutoring lead | None by filename | Unverified |
| PROP-WF-012 | Support | Service request and referral | Service operations lead | SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md, SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md, SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md | Unverified |
| PROP-WF-013 | Accessibility | Accommodation and accessible delivery | Accessibility lead | None for accommodation (RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md covers UI testing only) | Unverified |
| PROP-WF-014 | Registrar | Catalog sections and academic calendar | Registrar domain lead | None by filename | Unverified |
| PROP-WF-015 | Registrar | Transfer credit, degree audit, graduation, transcript | Academic records lead | None by filename | Unverified |
| PROP-WF-016 | Admissions | Prospect application and matriculation | Admissions lead | None by filename | Unverified |
| PROP-WF-017 | Student accounts | Charges, payment plans, refunds, holds | Student accounts lead | None by filename | Unverified |
| PROP-WF-018 | Aid | Scholarships, aid, eligibility | Financial aid lead | None by filename | Unverified |
| PROP-WF-019 | Campus | Housing, dining, spaces, transit, jobs | Campus services lead | CAMPUS-ESCALATION-POLICY.md | Unverified |
| PROP-WF-020 | Community | Organizations, events, marketplace, moderation | Community lead | COMMUNITY-PRIVACY-MODEL.md, COMMUNITY-FEED-ARCHITECTURE.md, COMMUNITY-MEDIA-SAFETY.md, CAMPUS-MODERATION-SOP.md, COMMUNITIES-REGISTER.md | Unverified |
| PROP-WF-021 | Career | Evidence portfolio, opportunities, hiring | Career lead | CAREER-EVIDENCE.md, CAREER_REQUIREMENTS.md | Unverified |
| PROP-WF-022 | Alumni | Alumni and lifelong learning | Alumni lead | CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md | Unverified |
| PROP-WF-023 | Privacy | Family advisor sharing, export, correction, deletion | Privacy lead | CONSENT-SHARING-DESIGN.md, SUPPORTER-FAMILY-PRIVACY-MODEL.md, DATA-RIGHTS-REQUEST-RUNBOOK.md, STUDENT-DATA-CONTROL-CENTER.md | Unverified |
| PROP-WF-024 | AI | Governed assistance and bounded agents | AI platform lead | AI-RECOMMENDATION-EVALUATION-HARNESS.md, ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md | Unverified |
| PROP-WF-025 | Integration | Connect, sync, reconcile, domain replacement | Integration lead | INTEGRATION-CONTROL-PLANE.md, INTEGRATION-QUALITY-AND-RECONCILIATION.md, DOMAIN-REPLACEMENT-REGISTER.md, INTEGRATION-PERMISSION-MATRIX.md | Unverified |
| PROP-WF-026 | Institution | Tenant configuration, governance, rollout | Implementation lead | SSO-TENANT-ONBOARDING.md, ACTIVATION-CONTROL-PLANE.md, ROLE-LAUNCH-REGISTER.md | Unverified |
| PROP-WF-027 | Developer platform | Partner app certification, installation, retirement | Developer platform lead | API-PLATFORM.md, DEVELOPER-TOOLS.md, LTI-1.3-LAUNCH-RUNBOOK.md | Unverified |
| PROP-WF-028 | Operations | Release, incident, recovery, renewal | Reliability and operations lead | RELEASE-INCIDENT-OPERATOR-RUNBOOK.md, OPERATIONAL-READINESS-PACK.md, RUNBOOKS.md, CRISIS-RESPONSE-RUNBOOK.md | Unverified |

Coverage summary by filename: 18 of 28 items have at least one related spec, and 10 items have none (PROP-WF-003, 006, 007, 011, 013, 014, 015, 016, 017, 018). No item has verified coverage.

## Blockers and decisions required

1. **Authoritative source not in the repository.** The attached design PDF could not be read in this environment (a read hook rejects binary files). The workflow register and contract were read directly. The PDF needs to be supplied as text or Markdown before the coverage map can be checked against it.
2. **Reconcile IDs.** The register says "reconcile with existing IDs". Existing expansion registers (`SERVICE-EXPANSION-REGISTER.md`, `STRATEGIC-EXPANSION-REGISTER.md`) and the capability activation register have not yet been cross-referenced to `PROP-WF-*`.
3. **Activation is governed.** `CAPABILITY-ACTIVATION-REGISTER.md` states that no tenant is activated by the register. Registration, grades, aid, payments, family access and AI-assisted decisions are high-risk classes that require institution authority, scoped approvals and evidence. No code change in this repository can satisfy those gates.
4. **External systems.** Registration, payments, aid, SIS and LMS sync need provider contracts, credentials and sandbox access. None are present in the session.
5. **Scope.** Building all 28 workflows to the contract is a multi-quarter program, not one change set. The first executable slice needs a product decision on which workflow to take first.

## Next executable steps

- Obtain the design PDF as text and diff its workflow list against `PROP-WF-001`…`028`.
- Cross-reference each row to existing `*-REGISTER.md` IDs and record conflicts.
- Choose the first vertical slice (suggested: `PROP-WF-002` daily loop or `PROP-WF-012` service request, since both have spec coverage and no external-provider dependency).
- For the chosen slice, write the contract fields above, then implement, test and verify with the gates in `app/` (`tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`).
