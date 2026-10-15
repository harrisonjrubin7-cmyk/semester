> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester legal and regulatory issue map — draft

**Status:** issue spotting only. Every row **requires qualified human counsel review.** Naming a law here means "counsel should decide whether and how it applies"; it is not a finding that it applies, that Semester complies, or that it does not.
**Owner:** Harrison Rubin, company-side legal coordinator. Counsel and backup coordinator are unassigned.
**Assessment date:** 2026-10-04 (America/Chicago)

## How to read this map

Each product domain lists the **legal questions** it raises, the **jurisdictional questions** that change the answer, the **repository evidence** that bears on the question, and the **queue row** in [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) where it is tracked. Rows that have no queue row are gaps; they are listed in the last section.

Jurisdiction is never assumed. The facts that decide it are collected once, in section 2, and every row depends on them.

## 1. Domain × issue map

| Domain | Legal questions (all require qualified human counsel review) | Evidence in the repository | Queue |
| --- | --- | --- | --- |
| **Student OS / productivity** (planner, notes, docs, calendar) | Notice and choice for personal data; whether student-created content is an education record in any setting; user content licence; export and deletion duties; storage-law and cookie/ePrivacy questions for local storage | `docs/legal/PRIVACY-POLICY-DRAFT.md`, `docs/legal-drafts/COOKIE-NOTICE-DRAFT.md`, `docs/trust/DATA-INVENTORY.md`, `docs/DATA-RETENTION-EXPORT-DELETION.md` | L0 privacy/terms; L1 retention |
| **Institutional system** (rosters, SIS/LMS, grades, registrar, console) | Whether and when the institution treats Semester as a "school official" or equivalent; legitimate-educational-interest purposes; directory-information opt-outs; processor/service-provider roles; state student-privacy contract mandates; record-system authority and replacement claims | `docs/COUNSEL-BRIEF.md` §B, `docs/trust/FERPA-CONSENT-WORKFLOW.md`, `docs/compliance/FERPA-ALIGNMENT-ASSESSMENT.md`, `docs/trust/EDUCATION-PRIVACY-READINESS-MATRIX.md` | L0 education privacy |
| **Children and minors** (under-13, 13–17, dual-enrolment, K-12 edition) | Whether any under-13 or minor use is reachable; parental or school authorisation; age assurance; state minors' online-safety and age-appropriate-design laws; minor-specific advertising and profiling limits; minor community features | D-139/D-140 (nobody under 13 holds an account), `docs/security/guardian-data-model.md`, `docs/COMMUNITY-PRIVACY-MODEL.md` | L0 education privacy ("age/minor posture") |
| **Family / guardian portal** | Authority of the guardian over an adult student; consent and revocation records; when disclosure to a parent is permitted and by whom; separated-family and custody conflicts | `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`, `docs/CONSENT-SHARING-DESIGN.md` | **Gap — see §4** |
| **AI assistant / tutor / advisor** | Disclosure that a user is dealing with AI; data use and provider terms; training on student data; automated-decision and profiling rules; accuracy and academic-integrity claims; high-impact use boundaries; AI-specific state and international laws; provider retention | `docs/trust/AI-GOVERNANCE-PROGRAM.md`, `AI-SYSTEM-INVENTORY.md`, `AI-RISK-ASSESSMENT.md`, `PROVIDER-TERMS.md`, `docs/legal-drafts/AI-USE-TERMS-EXHIBIT-DRAFT.md` | L1 AI |
| **Accessibility** | Applicability of ADA, Section 504/508-style and state requirements; contractual WCAG commitments; accommodation process; ACR/VPAT claims; mobile and offline coverage | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md`, `docs/legal-drafts/ACCESSIBILITY-STATEMENT-DRAFT.md`, CLM-007/CLM-008 | L0 accessibility |
| **Consumer subscriptions and billing** | Auto-renewal and negative-option rules; price and fee disclosure; cancellation and refund; free-trial terms; student-age consumers; sales tax and digital-goods tax; chargeback handling | `docs/legal-drafts/SUBSCRIPTION-BILLING-DISCLOSURE-DRAFT.md`, `REFUND-CANCELLATION-AND-RENEWAL-POLICY-DRAFT.md`, `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | L1 pricing; L1 tax |
| **Payments / student accounts / dining** | Money-transmission or payment-facilitator characterisation; Title IV or institutional-fee handling; card-data scope; merchant-of-record; unclaimed-property and refund rules | `docs/COUNSEL-BRIEF.md` §E, `docs/MONEY-MODULES-SWITCH-ON.md` | **Gap — see §4** (no queue row for E1–E4) |
| **Marketplace** (providers, listings, orders, payouts, disputes) | Platform liability and role; provider vetting; sanctions screening; payout, 1099-style reporting and marketplace-facilitator tax; consumer-protection and refund duties; prohibited items; student-to-provider safety | Domain named in the audit; `docs/market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md` | **Gap — no queue row, no terms draft until now** |
| **Community / messaging / moderation** | Content liability and takedown; user-safety duties; reporting and retention of reports; law-enforcement requests; harassment and Title IX-adjacent routing; minors in community | `docs/CAMPUS-MODERATION-SOP.md`, `docs/COMMUNITY-MEDIA-SAFETY.md`, `docs/legal-drafts/COPYRIGHT-DMCA-POLICY-DRAFT.md`, `LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md` | L1 IP/DMCA (partial) |
| **Career / alumni / employers** | Employer-facing data sharing; discrimination and fair-hiring concerns in matching; credential-verification claims; consented discoverability; scraping or import of third-party profile data | `docs/CAREER-EVIDENCE.md`, `docs/CREDENTIAL-WALLET.md` | **Gap — see §4** |
| **Marketing and growth** | Email and text consent; unsubscribe and suppression; testimonial and endorsement rules; comparative claims; student ambassador programs; ads to students | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`, `docs/legal-drafts/MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`, `TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md` | L1 marketing |
| **Workforce** (founder, contractors, student interns, future staff) | Worker classification; invention assignment; confidentiality; student-worker and minor-worker rules; multi-state employment | `IP.md`, `docs/company/` | L1 employment |
| **Security and incidents** | Statutory and contractual breach-notice duties, who decides, and by when; regulator, institution, user and insurer notice; privilege over investigations | `docs/trust/INCIDENT-RESPONSE-PLAN.md`, `docs/legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md` | L0 security terms. **Decision workflow added in [`INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md`](INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md)** |
| **Records, holds and litigation** | Reasonable-anticipation trigger; scope; backup tails; deletion-request conflict; subpoena and third-party requests | `docs/legal-drafts/LEGAL-HOLD-PROCEDURE-DRAFT.md`, `docs/company/RECORDS-RETENTION-SCHEDULE-DRAFT.md` | L1 retention. **Litigation response added in [`LITIGATION-RESPONSE-PROCEDURE-DRAFT.md`](LITIGATION-RESPONSE-PROCEDURE-DRAFT.md)** |
| **Vendors / cross-border** | Data-transfer mechanisms; processor terms; sub-processor notice and objection; data-residency promises; sanctions and export controls on AI and encryption | `docs/SUBPROCESSORS.md`, `docs/trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md`, `VENDOR-RISK-REGISTER.md` | L2 international |
| **Intellectual property / open source** | Licences of dependencies; AI-output ownership; user content licence; trademark clearance | `IP.md`, `OPEN-SOURCE-LICENSE-COMPLIANCE-POLICY.md` | L1 / L2 |
| **Corporate and contracting** | Entity, authority, insurance, limitation of liability, indemnity, governing law | `LEGAL-REVIEW-QUEUE.md` L0 first row | L0 |

## 2. Jurisdictional fact sheet (answers decide which rows matter)

Counsel cannot answer the map until these are recorded. None is recorded today; each is `[TO BE CONFIRMED]`.

| # | Fact | Why it matters | Source of truth |
| --- | --- | --- | --- |
| J1 | Legal entity, state of formation, principal place of business | Governing law, venue, tax nexus, registered-agent and notice duties | `[ENTITY RECORDS]` |
| J2 | States and countries where students, institutions, guardians and providers actually are | Which privacy, consumer, minors, accessibility and employment regimes are in play | pilot scoping, `[CUSTOMER LIST]` |
| J3 | Ages of the people who can create or be given an account | Child and minor rules; guardian authority | D-139/D-140, onboarding flow |
| J4 | Institution type: public, private non-profit, for-profit, K-12, community college | Which state contracting, public-records and student-privacy rules apply | `[CUSTOMER]` |
| J5 | Semester's role per data flow: independent controller, processor/service provider, school official, or mixed | Allocates notice, rights, breach and subpoena duties | `docs/trust/PERSONAL-DATA-PROCESSING-REGISTER.md` |
| J6 | Where each data class is stored and processed, including backups and AI providers | Cross-border analysis; residency promises | `docs/trust/DATA-FLOW-MAP.md`, `SUBPROCESSORS.md` |
| J7 | Whether money moves through Semester, and who is merchant of record | Payments, tax, consumer rules | `docs/MONEY-MODULES-SWITCH-ON.md` |
| J8 | Whether federal funds, federal contracts or public-sector procurement are involved | Added accessibility, security and records clauses | `[CUSTOMER]` |

## 3. Cross-cutting questions for every row

1. Which audience, age band and jurisdiction does this exact claim or feature reach?
2. Does the product behave the way the draft says it does? (Product must change before wording is used to hide a gap — see `LEGAL-REVIEW-QUEUE.md`.)
3. What is the customer's contract position, and does it override the public policy?
4. What evidence, owner, expiry and re-review trigger will be recorded?

## 4. Gaps found while building this map

These are the places where the repository holds a question but no queue row, owner or draft.

| Gap | Where it lives today | Added to queue as |
| --- | --- | --- |
| Marketplace role, provider terms, payouts, tax facilitation | Domain named in product audit only | Q-11, Q-12 |
| Payments / money-transmission (COUNSEL-BRIEF E1–E4) | Brief only; not in the queue | Q-13 |
| Family / guardian authority over adult students | Design docs only | Q-14 |
| Career and employer data-sharing, fair-hiring concerns | Design docs only | Q-15 |
| Incident-notification decision rights | Exhibit says "no deadline approved" | Q-16 |
| Litigation response / third-party subpoena | Only a mention in the maturity doc | Q-17 |
| Student interviews and research consent (COUNSEL-BRIEF F1) | Brief only | Q-18 |
