# Semester legal review queue

> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

**Version:** 0.3

**Assessment date:** 2026-10-04 (America/Chicago)

**Owner:** Harrison Rubin, company-side legal coordinator primary; qualified counsel and backup coordinator unassigned

**Approval authority:** qualified counsel plus the authorized company decision-maker; customer counsel/authority where applicable
**Review cadence:** weekly while drafts are active; before publication, signature, product-behavior change, or new jurisdiction/audience

## Intake rule

No item leaves this queue because a draft exists. It closes only when the correct reviewer has reviewed the identified version, all material business decisions are recorded, required product/operational changes are evidenced, and an authorized approver records the permitted use: internal, publishable, negotiable, or executable.

The exact public-claim wording and its evidence/expiry/withdrawal state are controlled in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](PUBLIC-CLAIMS-APPROVAL-REGISTER.md). The final four-motion boundary is controlled in [`GO-NO-GO-DECISION.md`](GO-NO-GO-DECISION.md). Neither document supplies legal approval; all applicable rows below remain open until their exit evidence exists.

## Priority queue

| Priority | Matter | Required reviewer/authority | Inputs still required | Exit evidence | Blocks |
| --- | --- | --- | --- | --- | --- |
| L0 | Entity, jurisdiction, ownership, IP assignments, signing authority | startup/corporate counsel + founder | entity records, cap table/ownership, contributor/contractor history, domains/trademarks | counsel memo/approved records and authority matrix | every paid/signature motion |
| L0 | Individual Terms, Privacy Notice, Cookie/Storage Notice, age/minor posture | consumer/privacy counsel | confirmed entity/contact/geography/ages; product/data map; retention; support; billing model | approved version/effective date/publication instruction | broad individual launch |
| L0 | Pilot agreement, MSA/order form, SOW, DPA, student-data addendum | commercial/privacy/education counsel + founder/customer | exact scope, data roles, fees, term, support, offboarding, subprocessors, security/accessibility exhibits | approved negotiating forms and executed deal documents | paid pilot |
| L0 | Education privacy applicability: FERPA, COPPA, state student-privacy laws | education/privacy counsel + customer authority | user ages, institution role, records/data map, geography, parental/school authorization | applicability/requirements memo and implemented obligations | affected launch |
| L0 | Security/incident terms and representations | commercial/privacy counsel + security owner | verified controls, incident process, vendors, target environment, insurance | approved clauses mapped to current evidence | institutional signature |
| L0 | Accessibility statement, contract terms, accommodation/escalation, ACR disposition | accessibility counsel + qualified assessor | manual evaluation, remediation, support path, intended claim | approved statement/terms and assessment record | broad launch/pilot |
| L1 | Pricing, subscription billing, cancellation/refund/renewal, auto-renewal | consumer/commercial counsel + finance | price book, processor, geographies, renewal/cancellation UX, tax/accounting review | approved disclosures, terms, and verified product flow | accepting payment |
| L1 | Records retention, deletion, legal hold, law-enforcement requests | privacy/litigation counsel + data owner | data inventory, backup behavior, operational owners, jurisdictions | approved schedules/procedures and exercises | production personal data |
| L0 | Subject-rights operations: roles, response clocks, verification standard, refusal catalogue, guardian/institution-originated requests | privacy/education counsel + data owner | `docs/legal-drafts/DSR-OPERATING-KIT-TEMPLATE.md` §1, §3, §5, §7; entity and audience facts | approved clock table, exception catalogue, verification matrix, message wording | any promise of a rights-response time; operator screen launch |
| L0 | Minors: age floor, under-13 handling, guardian verification and rights, dual-enrollment authority | children's/education privacy counsel + customer authority | `docs/legal-drafts/MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md`; user ages; institution roles | written answers recorded in `docs/decisions/`; implemented controls | any K-12, under-18 or guardian launch |
| L1 | Privacy incident notification: statutory and contractual duties, the 72-hour operational commitment, regulator/institution/guardian audiences | privacy/litigation counsel + security owner | `docs/legal-drafts/PRIVACY-BREACH-ASSESSMENT-WORKSHEET-TEMPLATE.md` Step 3; `SECURITY.md` | approved decision table, notice wording, recorded tabletop | production personal data; institutional signature |
| L1 | Vendor roles, DPAs, regions, cross-border transfers, subprocessor-change notice period | privacy/commercial counsel + security | `docs/legal-drafts/VENDOR-PRIVACY-REVIEW-TEMPLATE.md`; per-vendor records | signed DPAs or recorded exceptions; role analysis per vendor | production personal data; institutional signature |
| L1 | Privacy review gate for AI, marketplace/extensions, integrations, analytics and marketing | privacy counsel + product/security | `docs/legal-drafts/PRIVACY-REVIEW-INTAKE-TEMPLATE.md` add-ons A–E | approved add-on answers; first exercised review | switching any of those on |
| L1 | Deletion wording versus backup tails and the in-app "no archive kept" and "nothing trains anything" promises | privacy counsel + data owner | `app/src/lib/privacy.ts`, `RETENTION.md` backup section, `VENDOR-PRIVACY-REVIEW-TEMPLATE.md` §4 | approved wording that matches behavior | deletion claims; privacy notice |
| L1 | AI disclosures, acceptable use, training/data use, high-impact boundaries | AI/privacy/education counsel + product/security | AI inventory, providers, prompts/data, consent, human oversight, kill switch | approved policy/terms mapped to behavior | AI launch claims |
| L1 | Marketing consent, testimonials/case studies, communications | marketing/privacy counsel + revenue | channels, consent records, suppression, reference permissions | approved forms/process and evidence store | campaigns/references |
| L1 | Open-source licensing, notices, content/IP/DMCA | IP counsel + engineering | dependency/SBOM/license inventory; content sources; agent details | approved notices/policy and remediation | distribution/publication |
| L1 | Employment/contractor classification, confidentiality, invention assignment | employment/corporate counsel + founder | worker history, locations, agreements, compensation/authority facts | executed compliant agreements and records | workforce scale/IP diligence |
| L1 | Insurance requirements and contractual risk | insurance broker + counsel + founder | product/data/contract scope, revenue/headcount, requested limits | broker recommendation, coverage decision, approved contract position | contracted launch |
| L1 | Tax, nexus, revenue recognition, subscriptions | CPA/tax adviser + finance | entity, geographies, prices, processor, contract structure | written accounting/tax position and controls | accepting revenue |
| L2 | Trademarks, brand usage, domains, digital assets | IP counsel + founder | asset inventory, registrations, ownership, conflicts | approved register/guidelines/filings decision | scaled marketing |
| L2 | International expansion/GDPR and cross-border transfers | privacy counsel | intended countries, roles, vendors/regions, rights operation | applicability plan and implemented controls | affected geography |

## Working queue — owner, facts, external-counsel question, decision deadline

Every row **requires qualified human counsel review.** This table carries the working fields the priority table above lacks. Rows Q-01 to Q-10 restate the L0–L2 rows above in the same order; Q-11 to Q-18 are matters found missing on 2026-10-04 (see [`docs/legal-drafts/LEGAL-ISSUE-MAP.md`](docs/legal-drafts/LEGAL-ISSUE-MAP.md) §4).

**Owner** is the person who assembles facts and chases the answer. The *decider* is always qualified counsel plus the authorised approver; no row has counsel assigned, so **no deadline below can be met until counsel is engaged (Q-00).**

**Deadlines are proposed by the coordinator, not legal deadlines.** They are anchored to the motion each row blocks in [`GO-NO-GO-DECISION.md`](GO-NO-GO-DECISION.md) and slip with it. A statutory or contractual deadline, when counsel identifies one, replaces the proposal and is recorded with its source.

| ID | Pri | Matter | Owner | Facts still needed | External-counsel question | Proposed decision deadline |
| --- | --- | --- | --- | --- | --- | --- |
| Q-00 | L0 | Engage counsel and name backup coordinator | Harrison Rubin | budget, scope, jurisdictions J1–J2, conflicts | Which firm/solo practitioner can cover corporate, privacy/education, consumer and commercial for an early-stage edtech, and on what retainer? | 2026-10-11 |
| Q-01 | L0 | Entity, ownership, IP assignments, signing authority | Harrison Rubin | formation docs, cap table, contributor history incl. university IP policy, domains | Is the entity properly formed and are all IP assignments in place before any customer paper is signed? | 2026-10-25 |
| Q-02 | L0 | Individual Terms, Privacy Notice, Cookie/Storage Notice, age posture | Harrison Rubin | entity/contact, ages (J3), geographies (J2), data map, retention, billing model | Which of the 77 `[DECIDE]` lines can be closed, and what must change in product before the notice can be published? | 2026-11-08 (before any invitation-only validation) |
| Q-03 | L0 | Pilot agreement, MSA/order form, SOW, DPA, student-data addendum | Harrison Rubin | named design partner, scope, roles (J5), subprocessors, security and accessibility exhibits | Are the pilot paper and DPA acceptable as negotiating forms; which positions are fallback-approved (deviation matrix)? | 2026-11-15 (before any design-partner data exchange) |
| Q-04 | L0 | FERPA, COPPA, state student-privacy applicability | Harrison Rubin | COUNSEL-BRIEF B1–B4 facts, institution type (J4), ages | Does Semester act as school official or vendor, per tenant, and what consent/authority is required? | 2026-11-15 |
| Q-05 | L0 | Security/incident terms and representations | Harrison Rubin | controls evidence, target environment, insurance status | Which representations can truthfully be made; who decides notification (see workflow draft)? | 2026-11-22 |
| Q-06 | L0 | Accessibility statement, contract terms, ACR | Harrison Rubin | manual AT evaluation, remediation, intended claim | Publish at all before an assistive-technology pass exists? What contractual WCAG promise, if any? | 2026-11-22 |
| Q-07 | L1 | Pricing, billing, renewal, refund; tax | Harrison Rubin | price book, processor, geographies, renewal/cancel UX | Are disclosures and flows adequate in each state served; tax and revenue-recognition advice? | before any payment (paid motions are NO-GO today) |
| Q-08 | L1 | Retention, deletion, hold, law-enforcement requests | Harrison Rubin | data inventory, backup behaviour, COUNSEL-BRIEF A1–A4, C1–C2 | Approve retention schedule and hold procedure; backup-tail position? | 2026-12-06 (before production personal data) |
| Q-09 | L1 | AI disclosures, acceptable use, training/data use | Harrison Rubin | AI inventory, provider terms (D-147), consent, kill switch | Which provider terms are acceptable for student data (F3); training prohibition wording? | 2026-12-06 (before AI launch claims) |
| Q-10 | L1 | Marketing consent, testimonials, communications; open source; employment; insurance; tax; trademarks; international | Harrison Rubin | per source rows above | One scoping call, then per-matter memos | rolling; first memo 2026-12-20 |
| Q-11 | L1 | Marketplace role and Marketplace Terms | Harrison Rubin | role decision, provider model, payout design | Facilitator/agent/seller characterisation; consumer-protection and sanctions duties? | before any marketplace motion; none authorised |
| Q-12 | L1 | Provider and partner agreements | Harrison Rubin | partner list, data flows | Approve outline in `MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md` as drafting basis? | with Q-11 |
| Q-13 | L1 | Payments / money transmission / PCI (COUNSEL-BRIEF E1–E4) | Harrison Rubin | flows in `docs/MONEY-MODULES-SWITCH-ON.md`, merchant of record | Is a ledger/plan/swipe pool a regulated activity; remove code or keep off? | before any money module is switched on |
| Q-14 | L1 | Guardian authority over adult students; family consent | Harrison Rubin | guardian data model, ages, custody edge cases | When may a guardian see what, and who verifies the relationship? | with Q-04 |
| Q-15 | L1 | Career / employer data sharing, fair-hiring concerns | Harrison Rubin | matching logic, employer access design | Employer-facing sharing consent and anti-discrimination review? | before any employer partner |
| Q-16 | L0 | Incident-notification decision rights | Harrison Rubin | decision-maker roster, contract extractions | Adopt [`INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md`](docs/legal-drafts/INCIDENT-NOTIFICATION-DECISION-WORKFLOW-DRAFT.md)? State clocks per J2. | 2026-11-22 (with Q-05) |
| Q-17 | L1 | Litigation / subpoena response and registered agent | Harrison Rubin | agent of record, panel counsel, insurer | Adopt [`LITIGATION-RESPONSE-PROCEDURE-DRAFT.md`](docs/legal-drafts/LITIGATION-RESPONSE-PROCEDURE-DRAFT.md)? | 2026-12-06 (with Q-08) |
| Q-18 | L1 | Student interviews and research consent (F1) | Harrison Rubin | interview protocol, institutions involved | Consent or institutional review before the first interview? | before the first interview |

Ordering rule: Q-00 gates every other row. When counsel is engaged, re-date this table in the same commit that records the engagement.

## Required decision fields for every legal draft

`[LEGAL ENTITY]`, `[ENTITY TYPE/JURISDICTION]`, `[ADDRESS]`, `[CONTACTS]`, `[EFFECTIVE DATE]`, `[AUDIENCE/AGE]`, `[GEOGRAPHY]`, `[GOVERNING LAW/VENUE/DISPUTES]`, `[PRICING/PAYMENT/TAX]`, `[TERM/RENEWAL/CANCELLATION/REFUND]`, `[DATA ROLES/PURPOSES/CATEGORIES]`, `[RETENTION/DELETION/BACKUPS/LEGAL HOLD]`, `[SUBPROCESSORS/REGIONS]`, `[SECURITY/INCIDENT COMMITMENTS]`, `[SUPPORT/SERVICE LEVELS]`, `[INSURANCE]`, `[AI USE]`, and `[AUTHORIZED APPROVERS]` as applicable.

## Publication and signature prohibition

Until the relevant row closes, drafts must remain visibly marked, must not be linked as in-force public policy, and must not be presented as executed, enforceable, jurisdiction-complete, or evidence of compliance. Product behavior must be changed when necessary to make approved language true; wording must not be used to conceal a behavior gap.
