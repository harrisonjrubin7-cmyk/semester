# Trust document map

> **Type:** reference · **Audience:** security-reviewers, buyers · **Owner:** `trust` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/trust-docs.test.ts`

This page lists every document in `docs/trust/`, `docs/security/`, `docs/compliance/` and `docs/legal/` once, grouped by what a reviewer wants, with each document's own status; stop reading if you want a question answered, and use `REVIEWER-QUESTION-MAP.md` instead.

**Status:** PARTIAL. Almost every document here is a draft, a plan or a baseline. None is a certification, a signed agreement or an audit report.

## What this page adds to the existing indexes

- `README.md` in this directory is the long-form package introduction. It says it is not the packet index, and it keeps the list of what blocks a signature.
- [SECURITY-ACCESSIBILITY-READINESS.md](../SECURITY-ACCESSIBILITY-READINESS.md) lists the items in the trust packet, with the confidentiality tier of each and how reviewers are granted access.
- This page covers four directories, including the security notes, compliance assessments and legal drafts that neither index lists, and groups them by purpose. A test fails when a document is added to any of the four directories without a row here, or when a document is listed twice.

How to read the **Status** column: it is the status the document gives itself, shortened. "Controlled draft" is the document's own phrase. "Draft" for a legal file means the effective date is still to be decided and counsel has not reviewed it. A status of `NOT BUILT`, `NOT_STARTED`, "not in force" or "not usable" is stated plainly because those documents describe something that does not operate.

## Start here

| Document | What it is | Status |
| --- | --- | --- |
| [`README.md`](README.md) | The trust package introduction, the three rules it holds, and what blocks a signature. | Index; says no certification is held |
| [`SECURITY-OVERVIEW.md`](SECURITY-OVERVIEW.md) | How the security model works as built, one statement at a time, with evidence and status for each. | PARTIAL; opens with what has not been done |
| [`REVIEWER-QUESTION-MAP.md`](REVIEWER-QUESTION-MAP.md) | The questions reviewers ask, and the page that answers each. | PARTIAL; holds no answers of its own |
| [`CONTROL-FACTS.md`](CONTROL-FACTS.md) | Counts and lists generated from the code: RLS posture, suites, headers, functions, register sizes. | Generated; proves text exists, not that a control operates |
| [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md) | The long-form whitepaper, written to be true of the tree, gaps stated inline. | Draft, version 0.1 |
| [`ENTERPRISE-READINESS.md`](ENTERPRISE-READINESS.md) | The four readiness levels, what "done" means at each, and where Semester stands. | Reviewed prose |
| [`THREAT-MODEL.md`](THREAT-MODEL.md) | The threat model as a trust index over the detailed models. | PARTIAL; requires revalidation |

## Policies and programs

| Document | What it is | Status |
| --- | --- | --- |
| [`INFORMATION-SECURITY-PROGRAM.md`](INFORMATION-SECURITY-PROGRAM.md) | The governing security program: scope, roles and the control domains. | Controlled draft; PARTIAL, not operationally accepted |
| [`ACCESS-CONTROL-POLICY.md`](ACCESS-CONTROL-POLICY.md) | Default-deny, least-privilege access rules. | Controlled draft; PARTIAL |
| [`CHANGE-MANAGEMENT-POLICY.md`](CHANGE-MANAGEMENT-POLICY.md) | How a material change is owned, risk-rated, reviewed and recorded. | Controlled draft; PARTIAL, not fully operated |
| [`RELEASE-MANAGEMENT-POLICY.md`](RELEASE-MANAGEMENT-POLICY.md) | How a release candidate is frozen, verified and shipped. | Controlled draft; PARTIAL, repository-controlled |
| [`VULNERABILITY-MANAGEMENT-POLICY.md`](VULNERABILITY-MANAGEMENT-POLICY.md) | How findings are found, rated, fixed and closed. | Controlled draft; PARTIAL, not fully operated |
| [`RISK-TREATMENT-PLAN.md`](RISK-TREATMENT-PLAN.md) | How risks are rated and treated. | Controlled draft; INCOMPLETE, no adopted risk appetite |
| [`STUDENT-DATA-GOVERNANCE-PROGRAM.md`](STUDENT-DATA-GOVERNANCE-PROGRAM.md) | Governance of student and education-related data from collection to deletion. | Controlled draft; PARTIAL, not operationally accepted |

## Standards

| Document | What it is | Status |
| --- | --- | --- |
| [`IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md`](IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md) | Identity binding, roles and access by tenant. | Controlled draft; PARTIAL, tenant-configuration dependent |
| [`PASSWORD-SESSION-AND-MFA-STANDARD.md`](PASSWORD-SESSION-AND-MFA-STANDARD.md) | Authentication, session and multi-factor requirements. | Controlled draft; PARTIAL |
| [`ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md`](ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md) | Transport and stored-data encryption and key handling. | Controlled draft; PARTIAL, provider-dependent |
| [`LOGGING-MONITORING-AND-ALERTING-STANDARD.md`](LOGGING-MONITORING-AND-ALERTING-STANDARD.md) | What is logged, monitored and alerted. | Controlled draft; PARTIAL, not fully staffed or operated |
| [`SECURE-DEVELOPMENT-LIFECYCLE.md`](SECURE-DEVELOPMENT-LIFECYCLE.md) | Development steps from design to release, with the security checks at each. | Controlled draft; PARTIAL, repository-controlled |
| [`SECURITY-TESTING-PLAN.md`](SECURITY-TESTING-PLAN.md) | The testing a run must record and the plan for it. | Controlled draft; PARTIAL, plan not fully executed |
| [`ASSET-INVENTORY.md`](ASSET-INVENTORY.md) | Systems, repositories, stores and providers that count as assets. | Controlled draft; INCOMPLETE |
| [`DATA-CLASSIFICATION-STANDARD.md`](DATA-CLASSIFICATION-STANDARD.md) | How data is classified, from authorized context. | Controlled draft; PARTIAL |
| [`DATA-MINIMIZATION-STANDARD.md`](DATA-MINIMIZATION-STANDARD.md) | Collect and keep only what a defined purpose needs. | Controlled draft; PARTIAL |

## Runbooks

| Document | What it is | Status |
| --- | --- | --- |
| [`SECURITY-INCIDENT-RUNBOOK.md`](SECURITY-INCIDENT-RUNBOOK.md) | The steps for a security incident, from scoping to closure. | Controlled draft; DESIGNED, not target-exercised |
| [`INCIDENT-RESPONSE-PLAN.md`](INCIDENT-RESPONSE-PLAN.md) | The incident response plan: detect, classify, contain, recover. | Controlled draft; DESIGNED, not target-exercised |
| [`BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md`](BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md) | Which path to take for a failure, and how restore and rollback proceed. | Controlled draft; PARTIAL, logical rehearsal only |
| [`BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md) | Continuity priorities and recovery arrangements. | Controlled draft; PARTIAL, target recovery not proven |
| [`APM-RUNBOOK.md`](APM-RUNBOOK.md) | The target telemetry and alert set for a pilot, marked with what exists. | IN_PROGRESS |
| [`DATA-SUBJECT-REQUEST-RUNBOOK.md`](DATA-SUBJECT-REQUEST-RUNBOOK.md) | How a data-subject request is received and answered. | Controlled draft; PARTIAL, not operationally accepted |
| [`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md) | AI incidents and engaging the AI kill switch. | Controlled draft; limited drill evidence, target exercise required |

## Evidence and assurance

| Document | What it is | Status |
| --- | --- | --- |
| [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) | For each control, the artifact that would prove it operates, its owner and frequency. | Generated; says the evidence its rows ask for has not been produced |
| [`SOC2-READINESS.md`](SOC2-READINESS.md) | Gap assessment against SOC 2 criteria, scored; it is not an audit. | IN_PROGRESS; no auditor engaged, no report |
| [`BRIDGE-LETTER.md`](BRIDGE-LETTER.md) | A bridge-letter process; no SOC 2 report exists to bridge. | Not usable yet; no report exists to bridge |
| [`PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md) | Scope, rules of engagement and success criteria for a first external test. | Plan only; no test performed |
| [`HECVAT-READINESS-MATRIX.md`](HECVAT-READINESS-MATRIX.md) | Readiness per HECVAT domain. | Controlled draft; PARTIAL, not a completed HECVAT |
| [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md) | A 90-day plan for a HECVAT and an accessibility conformance report. | Plan only |
| [`COMPLIANCE-CROSSWALK.md`](COMPLIANCE-CROSSWALK.md) | HECVAT 4, 1EdTech TrustEd Apps and EDUCAUSE as one control library. | Generated; neither instrument is completed |
| [`NIST-800-53-READINESS-MATRIX.md`](NIST-800-53-READINESS-MATRIX.md) | Selective mapping of evidence to NIST SP 800-53 Rev. 5 families. | Controlled draft; selective mapping, no conformance claim |
| [`EDUCATION-PRIVACY-READINESS-MATRIX.md`](EDUCATION-PRIVACY-READINESS-MATRIX.md) | Education-data obligations by jurisdiction, age and role. | Controlled draft; PARTIAL, legal and customer determinations open |
| [`SECURITY-QUESTIONNAIRE.md`](SECURITY-QUESTIONNAIRE.md) | The response rule and readiness map for buyer questionnaires. | Controlled draft; PARTIAL, no customer response approved |
| [`STANDARDS-PRIVACY-AUDIT.md`](STANDARDS-PRIVACY-AUDIT.md) | The standards and privacy implementation audit of 2026-10-01. | Audit of the repository against supplied documents; not operational evidence |
| [FERPA-ALIGNMENT-ASSESSMENT.md](../compliance/FERPA-ALIGNMENT-ASSESSMENT.md) | A technical-control assessment against FERPA themes. | Published assessment; no certification claimed or available |
| [ISO-27001-READINESS-ASSESSMENT.md](../compliance/ISO-27001-READINESS-ASSESSMENT.md) | An internal gap assessment against ISO/IEC 27001. | Internal gap assessment; not certified |
| [VPAT-ACR-SELF-ASSESSMENT.md](../compliance/VPAT-ACR-SELF-ASSESSMENT.md) | An internal accessibility self-assessment. | Self-assessment; no formal ACR issued |
| [README.md](../compliance/README.md) | The evidence index behind the Trust Center's green state, and what green requires. | Index; says a dated artifact must exist |

## AI governance

| Document | What it is | Status |
| --- | --- | --- |
| [`AI-GOVERNANCE-PROGRAM.md`](AI-GOVERNANCE-PROGRAM.md) | The program governing AI from intake to retirement. | Controlled draft; not in force, not production-approved |
| [`AI-SYSTEM-INVENTORY.md`](AI-SYSTEM-INVENTORY.md) | The AI capabilities, one entry each. | Controlled baseline; repository-inferred, deployment reconciliation required |
| [`AI-RISK-ASSESSMENT.md`](AI-RISK-ASSESSMENT.md) | Credible harms; a feature-specific assessment is still required. | Controlled baseline |
| [`AI-DATA-USE-STANDARD.md`](AI-DATA-USE-STANDARD.md) | The data AI may use and the checks before sending it. | Controlled draft; approval and enforcement evidence required |
| [`AI-HUMAN-OVERSIGHT-STANDARD.md`](AI-HUMAN-OVERSIGHT-STANDARD.md) | When a person must review and decide. | Controlled draft; human operating model not yet proven |
| [`AI-TRANSPARENCY-AND-USER-NOTICE.md`](AI-TRANSPARENCY-AND-USER-NOTICE.md) | How AI is identified to users. | Controlled draft; notice coverage and approval incomplete |
| [`MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md`](MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md) | Treating a model or prompt change as a governed release. | Controlled draft; operating adoption unproven |
| [`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) | The no-training-by-default policy and its implementation requirements. | Draft; not in force |
| [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md) | The AI providers' published terms, quoted per DPA-checklist question. | Nothing is signed |
| [`SHARED-PROVIDER-ACTIVATION.md`](SHARED-PROVIDER-ACTIVATION.md) | What Semester's shared AI key waits on. | Off; every row pending the owner |
| [AI-USE-POLICY-DRAFT.md](../legal/AI-USE-POLICY-DRAFT.md) | The user-facing AI use policy. | Draft; effective date undecided |

## Data lifecycle

| Document | What it is | Status |
| --- | --- | --- |
| [`DATA-INVENTORY.md`](DATA-INVENTORY.md) | Where Semester data is described and who reconciles it. | Trust control index; PARTIAL |
| [`DATA-FLOW-MAP.md`](DATA-FLOW-MAP.md) | The trust view of how data moves. | Controlled trust view; PARTIAL |
| [`PERSONAL-DATA-PROCESSING-REGISTER.md`](PERSONAL-DATA-PROCESSING-REGISTER.md) | Candidate processing activities and the evidence to approve them. | Controlled draft; INCOMPLETE |
| [`DATA-RETENTION-AND-DELETION-STANDARD.md`](DATA-RETENTION-AND-DELETION-STANDARD.md) | Retention rules, deletion triggers and backup tails. | Controlled draft; PARTIAL |
| [`DATA-EXPORT-STANDARD.md`](DATA-EXPORT-STANDARD.md) | How an export is authenticated, scoped and delivered. | Controlled draft; PARTIAL |
| [`CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md`](CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md) | How consent differs from notices, contracts and required messages. | Controlled draft; PARTIAL, scope-dependent |
| [`FERPA-CONSENT-WORKFLOW.md`](FERPA-CONSENT-WORKFLOW.md) | When consent is needed and the workflow controls. | Blueprint, not legal advice |
| [ferpa-risk-and-permission-matrix.md](../security/ferpa-risk-and-permission-matrix.md) | Risk and permission matrix for education records. | Engineering and privacy baseline; no FERPA claim |
| [guardian-data-model.md](../security/guardian-data-model.md) | The guardian and family data model. | Target projection model |
| [operations-console-access-model.md](../security/operations-console-access-model.md) | What an operator may see and do, for how long. | Access model |
| [DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md](../legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md) | The user-facing retention and deletion policy. | Draft; effective date undecided |
| [COOKIE-AND-STORAGE-NOTICE-DRAFT.md](../legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md) | The cookie and device-storage notice. | Draft; effective date undecided |
| [PRIVACY-POLICY-DRAFT.md](../legal/PRIVACY-POLICY-DRAFT.md) | The privacy policy. | Draft; effective date undecided |

## Third parties and contracts

| Document | What it is | Status |
| --- | --- | --- |
| [`SUBPROCESSOR-GOVERNANCE-PROGRAM.md`](SUBPROCESSOR-GOVERNANCE-PROGRAM.md) | Rules before a provider processes customer data. | Controlled draft; INCOMPLETE, no provider approved by it |
| [`VENDOR-SECURITY-REVIEW-PROGRAM.md`](VENDOR-SECURITY-REVIEW-PROGRAM.md) | How a vendor is reviewed. | Controlled draft; DESIGNED, reviews not established |
| [`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md) | One row per subprocessor: data shared, attestation, DPA status. | Generated; no vendor has been assessed |
| [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md) | Requirements a data processing agreement must satisfy, for counsel. | NOT_STARTED as a signed agreement |
| [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) | Sections for a pilot agreement. | Outline for counsel, not agreement language |
| [`SLA.md`](SLA.md) | Availability formula and a starting schedule. | NOT_STARTED as a commitment |

## Legal drafts

Every file here is a draft with its effective date undecided. None has been reviewed by counsel or published as policy. The privacy policy, the AI use policy, the retention policy and the cookie notice are listed under their subject above.

| Document | What it is | Status |
| --- | --- | --- |
| [TERMS-OF-SERVICE-DRAFT.md](../legal/TERMS-OF-SERVICE-DRAFT.md) | The terms of service. | Draft |
| [ACCEPTABLE-USE-POLICY-DRAFT.md](../legal/ACCEPTABLE-USE-POLICY-DRAFT.md) | What users may not do. | Draft |
| [COMMUNITY-GUIDELINES-DRAFT.md](../legal/COMMUNITY-GUIDELINES-DRAFT.md) | Conduct guidelines for community features. | Draft |
| [COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md](../legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md) | The copyright and takedown process. | Draft |
| [ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md](../legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md) | Rules for advertising and sponsorship. | Draft |
| [ACCESSIBILITY-STATEMENT-DRAFT.md](../legal/ACCESSIBILITY-STATEMENT-DRAFT.md) | The public accessibility statement. | Draft |
| [INCIDENT-RESPONSE-SUMMARY-DRAFT.md](../legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md) | A public summary of incident response. | Draft |
| [REFUND-AND-CANCELLATION-POLICY-DRAFT.md](../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md) | Refunds and cancellation. | Draft |
| [SUPPORT-POLICY-DRAFT.md](../legal/SUPPORT-POLICY-DRAFT.md) | What support is offered. | Draft |

## Outside these directories

The documents above are the governed set. Other registers they depend on are linked from `SECURITY-OVERVIEW.md` and `REVIEWER-QUESTION-MAP.md`: [FEATURE-TRUTH-TABLE.md](../FEATURE-TRUTH-TABLE.md), [EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) in `docs/`, and the claims register in `app/src/lib/ops/claims.ts`.
