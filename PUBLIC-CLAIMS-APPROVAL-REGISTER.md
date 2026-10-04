> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester public claims approval register

| Control | Value |
| --- | --- |
| Status | **CONTROLLED CLAIM LIBRARY — NO UNRESTRICTED PUBLIC CAMPAIGN APPROVED** |
| Assessment date | 2026-10-03, America/Chicago |
| Owner | Harrison Rubin, claim-owner and legal-coordination primary; counsel and specialist approvers remain unassigned |
| Governing sources | [`LEGAL-CLAIMS-APPROVAL-POLICY`](docs/legal-drafts/LEGAL-CLAIMS-APPROVAL-POLICY.md), [`MARKETING-CLAIM-REVIEW-MATRIX`](docs/legal-drafts/MARKETING-CLAIM-REVIEW-MATRIX.md), [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) |

Classification states what current evidence can support. Approval state determines whether the exact words may be used in the named channel. No row marked `VERIFIED — REPOSITORY` implies deployment, availability, legal approval or unrestricted publication.

## Claim register

| ID | Proposed claim or topic | Classification | Current evidence and required qualifier | Approval state / required reviewers |
| --- | --- | --- | --- | --- |
| CLM-001 | “Semester is an academic planning and productivity experience that helps students organize academic context, tasks, deadlines and plans.” | **VERIFIED — REPOSITORY** | local product paths and golden journey; describe only the exercised experience and do not imply outcomes or official records | controlled demo/internal use; Product/Engineering approval recorded, public Legal/UAT review open |
| CLM-002 | “Semester is local-first, with optional account synchronization.” | **CONDITIONAL** | device persistence/export exists; account sync is implemented/tested in repository history but was not rerun locally against intended target in P07 | target/version qualification required; Privacy/Product/Engineering/Legal review open |
| CLM-003 | “Semester is in private or invitation-based validation.” | **VERIFIED — STATUS** | current decision limits individual motion to conditional invitation-only, unpaid validation | exact audience, terms, support, privacy, accessibility and UAT approval required before invitations |
| CLM-004 | “Semester can work alongside existing university systems in a bounded pilot.” | **CONDITIONAL / PROPOSED OFFER** | implementation and pilot templates exist; no customer, approved target or live pilot exists | permitted in qualified non-activation scoping with prominent conditions; Product/Security/Privacy/Legal/customer approval before activation |
| CLM-005 | SSO, SCIM, LTI, OneRoster, SIS/LMS or other institutional integration availability | **CONDITIONAL; PROHIBITED AS CURRENT PUBLIC AVAILABILITY** | repository contracts, gateway/control code and partial tests are not a live accepted connector | exact connector, target, provider/customer acceptance, support and Legal review required |
| CLM-006 | “Semester replaces the LMS, gradebook, SIS, registrar or another official system.” | **PROHIBITED** | current public copy was corrected to pilot-beside-existing-systems and separately approved future cutover | no approval; requires actual implementation, authority, migration/reconciliation/recovery and customer acceptance before reconsideration |
| CLM-007 | “Semester includes automated accessibility guards and selected browser accessibility checks.” | **VERIFIED — REPOSITORY** | name the six-route/local scope and limitations; no conformance conclusion | Accessibility/Product approval for exact technical statement; qualified assessment and Legal required for public conformance/status language |
| CLM-008 | WCAG conformance, completed VPAT/ACR, universal accessibility or barrier-free use | **PROHIBITED** | qualified manual assessment, remediation and approved ACR/status are absent | no approval |
| CLM-009 | “Semester maintains repository-tested security, privacy, authorization and lifecycle controls for defined paths.” | **VERIFIED — REPOSITORY** | cite exact controls/revision and open target/operational/independent gaps | Security/Privacy/Engineering review for exact technical audience; Legal and current target evidence for public/procurement use |
| CLM-010 | “Secure,” “compliant,” penetration tested, certified, SOC 2/ISO/FERPA/COPPA/GDPR/HECVAT approved, or guaranteed data residency | **PROHIBITED** | no blanket legal or independent assurance supports these conclusions | no approval; only scope-specific factual responses after qualified review |
| CLM-011 | “Semester offers assistive AI features with human review and bounded controls.” | **CONDITIONAL** | code/policy/kill-switch evidence exists for defined routes; providers, target configuration, evaluation and notices vary | exact feature/provider/data path and limitations required; AI/Privacy/Security/Product/Legal review open |
| CLM-012 | AI is always accurate, unbiased, safe, zero-retention, non-training, private or institution-approved | **PROHIBITED** | no universal evidence can support absolutes | no approval |
| CLM-013 | Named institution/customer/partner, logo, quote, endorsement, live pilot or case study | **PROHIBITED TODAY** | no executed claim-specific permission or completed substantiated pilot exists | rights-holder and Legal/Privacy/Communications approval required per exact wording/channel/term |
| CLM-014 | GPA, retention, graduation, wellbeing, time savings, ROI or efficiency outcomes | **PROHIBITED TODAY** | no approved baseline, complete measured result or causal design exists | customer/data authority, Product/Analytics, Finance as applicable and Legal approval required |
| CLM-015 | Price, discount, savings, paid-plan availability, refund/renewal term or scarcity | **PROHIBITED / `[PRICE TO BE CONFIRMED]`** | illustrative models are not an approved price book or live billing operation | Founder/Finance/Tax/Legal and verified product-flow approval required |
| CLM-016 | uptime, RTO/RPO, response time, 24/7 support, disaster-recovery or no-data-loss guarantee | **PROHIBITED TODAY** | target history, staffing, drills and contractual authority are absent | Operations/Security/Support/Finance/Legal approval with measured target evidence required |
| CLM-017 | roadmap capability or delivery date | **ROADMAP** | hypothesis only unless authorized in a separately approved contract | label non-binding, avoid dates, and require Product/Engineering/Deal Desk/Legal review |
| CLM-018 | “Where Semester shows a source label beside a fact, the label says where the fact came from (institution verified, imported, student entered, estimated, AI-assisted or needs review) and, where known, when it was last updated.” | **VERIFIED — REPOSITORY (scoped); PROPOSED, NOT APPROVED** | `SourceBadge` renders in 30 component and screen files; vocabulary in `lib/source.ts`; 40 tests across three files passed on 2026-10-04; not run in a browser; not traced whether “institution verified” can appear over non-institution data; only two call sites offer a report control; see [`docs/CLM-018-SOURCE-LABEL-EVIDENCE.md`](docs/CLM-018-SOURCE-LABEL-EVIDENCE.md). **Unscoped wording (“every fact says where it came from”) is not supported and is not covered by this row** | no approval recorded; Product/Engineering to confirm the “institution verified” data path, Accessibility for the technical statement, Legal for public use |

## Approval record required before use

For each exact variant record: claim text, ordinary audience takeaway, product/version/environment, audience/jurisdiction/channel, evidence links and expiry, limitations/disclosures, accessibility of disclosure, owner, specialist and legal approvals, start/end date, monitoring location, variants, and withdrawal owner. Approval for one proposal, tenant, channel or date does not authorize another.

## Withdrawal and incident rule

Expired, contradicted, over-broad or unapproved claims must be removed from every channel and logged. A material false claim enters legal/security/privacy/customer-communication escalation as applicable. The default when evidence or authority is unclear is do not publish.
