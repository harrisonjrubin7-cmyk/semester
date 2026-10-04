> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester legal, privacy and compliance coordination index — draft

**Status:** coordination only. Every legal item below **requires qualified human counsel review.** Nothing here approves a contract, concludes that a law applies or is satisfied, or claims compliance.
**Owner:** Harrison Rubin, company-side legal coordinator. Counsel and backup unassigned (queue row Q-00).
**Assessment date:** 2026-10-04 (America/Chicago)

The repository already holds most of a legal-coordination program. This index is the single place that says which artifact answers which question, what is only a draft, and what was missing. **Rule carried from `LEGAL-REVIEW-QUEUE.md`:** a draft is not a closed item; wording must never be used to hide a product-behaviour gap.

## 1. The ten deliverables and where each lives

| # | Deliverable | Where it lives | State | Added 2026-10-04 |
| --- | --- | --- | --- | --- |
| 1 | Legal and regulatory issue map by domain and jurisdiction | — | Was scattered across `COUNSEL-BRIEF.md`, `EDUCATION-PRIVACY-READINESS-MATRIX.md`, `LEGAL-AND-COMMERCIAL-READINESS.md` | [`LEGAL-ISSUE-MAP.md`](LEGAL-ISSUE-MAP.md) |
| 2 | DPIA framework | `docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md` (per-surface answers) | Had no trigger screen, necessity step, counsel sign-off or re-review rule | [`DPIA-FRAMEWORK-DRAFT.md`](DPIA-FRAMEWORK-DRAFT.md) |
| 3 | Privacy program requirements | §2 below | Exists; mapped here | — |
| 4 | Contracting artifact list | §3 below | Exists except marketplace and partner terms | [`MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md`](MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md) |
| 5 | Public claims review process | §4 below; `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` | Exists | — |
| 6 | Counsel checklists (education record, accessibility, minors, consumer, payment, marketplace, marketing, employment, AI) | — | Did not exist as one set | [`COUNSEL-ISSUE-CHECKLISTS.md`](COUNSEL-ISSUE-CHECKLISTS.md) |
| 7 | Legal hold, retention, litigation response, subject-rights intake | §5 below | Hold, DSR, law-enforcement, retention exist; litigation response did not | [`LITIGATION-RESPONSE-PROCEDURE-DRAFT.md`](LITIGATION-RESPONSE-PROCEDURE-DRAFT.md) |
| 8 | Legal-review queue with priority, owner, facts, external question, deadline | `LEGAL-REVIEW-QUEUE.md` | Had priority, reviewer, inputs, blocks; lacked owner/deadline/question columns and 8 matters | Working queue Q-00…Q-18 in the queue file (v0.3) |
| 9 | Compliance evidence matrix | §6 below | Registers exist; this maps control → capability → evidence → gap | §6 |
| 10 | Incident-notification decision workflow | Exhibit draft said "no deadline approved" | Decision rights and counsel/contract gates did not exist | [`INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md`](INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md) |

## 2. Privacy program requirements — map to existing artifacts

Each line **requires qualified human counsel review** before it is relied on externally.

| Requirement | Existing artifact | Open |
| --- | --- | --- |
| Data inventory and lineage | `docs/trust/DATA-INVENTORY.md`, `docs/DATA-INVENTORY-AND-LINEAGE.md`, `docs/trust/PERSONAL-DATA-PROCESSING-REGISTER.md`, `docs/trust/DATA-FLOW-MAP.md` | Roles, legal bases, ages, jurisdictions incomplete (matrix "PARTIAL") |
| Classification | `docs/trust/DATA-CLASSIFICATION-STANDARD.md` (T0–T5) | Counsel review of class-to-obligation mapping |
| Retention and deletion | `RETENTION.md`, `docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md`, `docs/company/RECORDS-RETENTION-SCHEDULE-DRAFT.md`, `docs/legal-drafts/DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md` | Approved schedule; backup tail; A1–A4 in COUNSEL-BRIEF (Q-08) |
| Export and portability | `docs/trust/DATA-EXPORT-STANDARD.md`, `docs/DATA-PORTABILITY-AND-OFFBOARDING.md`, `docs/SCHOOL-OFFBOARDING.md` | Counsel check of scope and format promises |
| Consent and preferences | `docs/trust/CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md`, `docs/CONSENT-SHARING-DESIGN.md`, `docs/trust/FERPA-CONSENT-WORKFLOW.md` | Whether consent is the right mechanism per flow (Q-04) |
| Guardian and minor controls | `docs/security/guardian-data-model.md`, `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`, `docs/COMMUNITY-PRIVACY-MODEL.md`, D-139/D-140 | Guardian authority (Q-14); minors posture (Q-02, Q-04) |
| Cross-border and vendor review | `docs/SUBPROCESSORS.md`, `docs/trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md`, `VENDOR-RISK-REGISTER.md`, `PROVIDER-TERMS.md` | Transfer mechanisms and regions (L2); AI provider terms (Q-09) |
| Subject-rights operations | `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`, `docs/trust/DATA-SUBJECT-REQUEST-RUNBOOK.md` | **No one named; no response time promised (C1)** |
| Impact assessment | PIA register + [`DPIA-FRAMEWORK-DRAFT.md`](DPIA-FRAMEWORK-DRAFT.md) | Privacy seat vacant; 6 surfaces owe answers |

## 3. Contracting artifact list

| Artifact | Draft | Status |
| --- | --- | --- |
| Master subscription agreement (MSA) | `MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md` | Draft; counsel open |
| Order form, SOW, professional services, pilot, evaluation | `ORDER-FORM-TEMPLATE-DRAFT.md`, `STATEMENT-OF-WORK-TEMPLATE-DRAFT.md`, `PROFESSIONAL-SERVICES-TERMS-DRAFT.md`, `PILOT-AGREEMENT-DRAFT.md`, `EVALUATION-AGREEMENT-DRAFT.md` | Draft |
| Data processing addendum (DPA) and student-data addendum | `DATA-PROCESSING-ADDENDUM-DRAFT.md`, `STUDENT-DATA-PRIVACY-ADDENDUM-DRAFT.md`; checklist `docs/trust/DPA-CHECKLIST.md` | Draft |
| Individual Terms of Service, mobile addendum | `TERMS-OF-SERVICE-DRAFT.md`, `MOBILE-APP-TERMS-ADDENDUM-DRAFT.md` (also `docs/legal/`) | Draft; not in force |
| Privacy notice, cookie notice | `PRIVACY-NOTICE-DRAFT.md`, `COOKIE-NOTICE-DRAFT.md` (also `docs/legal/PRIVACY-POLICY-DRAFT.md`) | Draft; 14 open lines in privacy policy |
| AI terms | `AI-USE-TERMS-EXHIBIT-DRAFT.md`, `AI-FEATURES-DISCLOSURE-DRAFT.md`, `AI-USE-AND-DATA-GOVERNANCE-POLICY-DRAFT.md` | Draft |
| Marketplace terms, provider and partner terms | [`MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md`](MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md) | **Outline only (new)** |
| Acceptable use, community guidelines, copyright | `ACCEPTABLE-USE-EXHIBIT-DRAFT.md`, `COMMUNITY-GUIDELINES-DRAFT.md`, `COPYRIGHT-DMCA-POLICY-DRAFT.md` | Draft |
| Support SLA / service expectations | `SERVICE-LEVEL-EXPECTATIONS-DRAFT.md`, `SUPPORT-POLICY-EXHIBIT-DRAFT.md`, `docs/trust/SLA.md` | Draft; no uptime promise approved (CLM-016) |
| Security exhibit | `INFORMATION-SECURITY-ADDENDUM-DRAFT.md`, `SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md` | Draft |
| Negotiation control | `CONTRACT-NEGOTIATION-PLAYBOOK.md`, `CONTRACT-DEVIATION-APPROVAL-MATRIX.md` | Draft |

No document here is executed or approved. `contracts/README.md` holds none.

## 4. Public claims review process

Controlled by [`LEGAL-CLAIMS-APPROVAL-POLICY.md`](LEGAL-CLAIMS-APPROVAL-POLICY.md), [`MARKETING-CLAIM-REVIEW-MATRIX.md`](MARKETING-CLAIM-REVIEW-MATRIX.md) and the exact-wording register [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (CLM-001…017; no unrestricted campaign approved).

1. **Propose** exact words, audience, channel, jurisdiction, product version.
2. **Classify** against evidence: verified-repository / conditional / roadmap / prohibited.
3. **Evidence** links with expiry. Repository evidence is not deployment or legal evidence.
4. **Specialist review** (security, accessibility, AI, privacy, finance) per matrix.
5. **Counsel review** (`requires qualified human counsel review`) for any compliance, security-posture, outcome, customer-name, price or availability claim.
6. **Record** approval per exact variant with start/end dates and withdrawal owner. Approval for one channel or tenant authorises no other.
7. **Monitor and withdraw** on expiry or contradiction; log removal; escalate material false claims.

Default when unclear: do not publish.

## 5. Legal hold, retention, litigation, subject rights — procedure set

| Procedure | Artifact |
| --- | --- |
| Legal hold | [`LEGAL-HOLD-PROCEDURE-DRAFT.md`](LEGAL-HOLD-PROCEDURE-DRAFT.md) |
| Litigation and third-party demand response | [`LITIGATION-RESPONSE-PROCEDURE-DRAFT.md`](LITIGATION-RESPONSE-PROCEDURE-DRAFT.md) (new) |
| Law-enforcement requests | [`LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md`](LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md) |
| Subject-rights intake | [`DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md`](DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md) and the operated runbook `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md` (intake sets a thirty-day internal due date; this is not a legal response clock) |
| Records retention | `RETENTION.md`, `docs/company/RECORDS-RETENTION-SCHEDULE-DRAFT.md` |
| Incident notification decisions | [`INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md`](INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md) |

Precedence rule across them: a hold or litigation instruction from counsel overrides ordinary deletion and a subject-rights erasure, and the requester still sees a status and reason.

## 6. Compliance evidence matrix — control → product capability → evidence → gap

"Evidence" means repository artifacts only. Each row's legal conclusion **requires qualified human counsel review**; no row asserts compliance.

| Control area | Product capability | Repository evidence | Missing evidence (needed before any external claim) | Queue |
| --- | --- | --- | --- | --- |
| Tenant isolation / access | Role and scope access, RLS, support-consent access | `docs/trust/ACCESS-CONTROL-POLICY.md`, `docs/security/ferpa-risk-and-permission-matrix.md`, RLS tests | Independent test; named-tenant negative UAT; purpose-coded access (B1) | Q-04 |
| Education-record handling | FERPA consent workflow, directory/roster features | `docs/trust/FERPA-CONSENT-WORKFLOW.md`, `docs/compliance/FERPA-ALIGNMENT-ASSESSMENT.md` | Counsel role determination; directory-information model | Q-04 |
| Minors and guardians | Age gate, guardian sharing scopes | `docs/security/guardian-data-model.md`, D-139/D-140 | Age-assurance review; guardian authority memo | Q-02, Q-14 |
| Rights requests | Privacy requests screen, export, assisted erasure | `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`, `app/src/lib/erasure.test.ts` | Named responder; counsel-stated clocks; live exercise | Q-08 |
| Retention / deletion / holds | Retention sweeps, legal-hold tables, account deletion | `RETENTION.md`, hold migrations (#1012), deletion proofs on main | Approved schedule; backup tail; hold operation exercise | Q-08, Q-17 |
| Consent / preferences | Consent records, notification preferences | `docs/trust/CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md` | Marketing-consent evidence store; cookie consent implementation | Q-10 |
| AI governance | Gateway, kill switch, human confirmation, provenance | `docs/trust/AI-GOVERNANCE-PROGRAM.md`, `AI-SYSTEM-INVENTORY.md`, `AI-RISK-ASSESSMENT.md` | Executed provider terms; use-case DPIA; target evaluation | Q-09 |
| Vendor / transfer | Sub-processor register tied to privacy policy | `docs/SUBPROCESSORS.md`, `legal-drafts.test.ts` | Signed vendor paper; regions and transfer mechanism | L2 |
| Security program | Encryption, logging, SDLC, vuln management | `docs/trust/INFORMATION-SECURITY-PROGRAM.md`, `SECURITY-THREAT-MODEL.md` | Independent assessment; DAST scan (GO-NO-GO blocker 2) | Q-05 |
| Incident response | Playbook, severity, recovery contract | `docs/trust/INCIDENT-RESPONSE-PLAN.md`, `app/src/lib/incident-recovery.ts` | Tabletop with counsel; named commander; notification decisions | Q-05, Q-16 |
| Accessibility | Automated guards; routes tested | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`, CLM-007 | Manual assistive-technology assessment; ACR | Q-06 |
| Billing / consumer | Subscription checkout and cancellation | `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`, billing disclosure draft | Counsel-approved terms; tax advice; renewal-flow review | Q-07 |
| Procurement security packet | Questionnaire answers, HECVAT mapping | `docs/trust/HECVAT-READINESS-MATRIX.md`, `COMPLIANCE-CROSSWALK.md` | Completed HECVAT is not claimed; counsel review of answers | Q-03 |

The generated registers `docs/EVIDENCE-REGISTER.md` and `docs/trust/EVIDENCE-REGISTER.md` remain the dated sources; this table does not replace them.

## 7. What to do next, in order

1. **Engage counsel (Q-00).** Everything else waits on it.
2. Record jurisdiction facts J1–J8 ([`LEGAL-ISSUE-MAP.md`](LEGAL-ISSUE-MAP.md) §2).
3. Send counsel `docs/COUNSEL-BRIEF.md` plus the working queue; ask for a scoping call.
4. Name the subject-rights responder and incident commander (both vacant).
5. Run the incident tabletop once counsel is present.
