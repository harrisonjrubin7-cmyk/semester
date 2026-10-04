# Semester legal review queue

> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

**Version:** 0.2

**Assessment date:** 2026-10-03 (America/Chicago)

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

## Required decision fields for every legal draft

`[LEGAL ENTITY]`, `[ENTITY TYPE/JURISDICTION]`, `[ADDRESS]`, `[CONTACTS]`, `[EFFECTIVE DATE]`, `[AUDIENCE/AGE]`, `[GEOGRAPHY]`, `[GOVERNING LAW/VENUE/DISPUTES]`, `[PRICING/PAYMENT/TAX]`, `[TERM/RENEWAL/CANCELLATION/REFUND]`, `[DATA ROLES/PURPOSES/CATEGORIES]`, `[RETENTION/DELETION/BACKUPS/LEGAL HOLD]`, `[SUBPROCESSORS/REGIONS]`, `[SECURITY/INCIDENT COMMITMENTS]`, `[SUPPORT/SERVICE LEVELS]`, `[INSURANCE]`, `[AI USE]`, and `[AUTHORIZED APPROVERS]` as applicable.

## Publication and signature prohibition

Until the relevant row closes, drafts must remain visibly marked, must not be linked as in-force public policy, and must not be presented as executed, enforceable, jurisdiction-complete, or evidence of compliance. Product behavior must be changed when necessary to make approved language true; wording must not be used to conceal a behavior gap.
