# Legal review queue: Phase 0 reconciliation view

> **Not legal advice. Every row requires qualified counsel (and, where marked, an accountant or tax adviser). This file lists questions; it concludes nothing.**

| Field | Value |
| --- | --- |
| Purpose | Reconcile the repository's legal, privacy, accessibility, minors, payments, tax, AI, cross-border and contract questions into one Phase 0 view and show what the existing queues do not yet carry |
| Authoritative queue (linked, not copied) | [`../../LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md): priority table L0-L2 and working rows Q-00 to Q-24 |
| Related controlled documents | [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) (A1-H9); [`../privacy-operations/07-COUNSEL-REVIEW-QUEUE.md`](../privacy-operations/07-COUNSEL-REVIEW-QUEUE.md) (P-01 to P-21); [`../legal-drafts/LEGAL-ISSUE-MAP.md`](../legal-drafts/LEGAL-ISSUE-MAP.md); [`../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| Date | 2026-10-04 |
| Status | **Phase 0 baseline — evidence-cited, not a readiness claim** |
| Method | Read `LEGAL-REVIEW-QUEUE.md`, `docs/COUNSEL-BRIEF.md`, `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md`; `grep -c '\[DECIDE' docs/legal/*.md` (77 in 13 drafts); `ls docs/legal docs/legal-drafts` (13 and 72 files); read pricing, billing and site paths named below; mapped each question to an existing ID or marked it NEW |

## 1. State of the existing queue

| Measure | Value | Evidence |
| --- | --- | --- |
| Counsel engaged | No: "no row has counsel assigned" and Q-00 gates every other row | `LEGAL-REVIEW-QUEUE.md` working-queue preface |
| Rows closed | 0 (queue `OPEN`; "no item closed") | `LEGAL-REVIEW-QUEUE.md`; `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` line 3 |
| Policy drafts in force | 0 of 13 (each says "Not in force. Not reviewed by a lawyer") | `docs/legal/*-DRAFT.md`; `app/src/lib/trust/legal-drafts.test.ts:55-75`; `app/src/lib/ops/claims.ts:681-698` (`POLICIES`) |
| Open `[DECIDE]` placeholders | 77 across 13 drafts | `grep -c '\[DECIDE' docs/legal/*.md` |
| Earliest proposed deadline | Q-00 on 2026-10-11 (a coordinator proposal, not a legal deadline) | `LEGAL-REVIEW-QUEUE.md` |

## 2. Questions by area, mapped to the existing queue

"Existing" = already carried; "NEW" = found in this audit and not found in any of the three queues.

| Area | Question for qualified counsel | Where it arises (path) | Existing ID / NEW |
| --- | --- | --- | --- |
| Entity and authority | Is the entity formed; who may sign; are IP assignments in place; does a university IP policy reach the code | `LEGAL-REVIEW-QUEUE.md` Q-01; `docs/company/CORPORATE-GOVERNANCE-CHECKLIST.md` | Q-01 |
| Entity and identity | The public site presents a company but links signup to a personal GitHub Pages host and a personal mailbox | `company-site/index.html:19,208,236` | NEW (adjacent to Q-01, P-20) |
| University name | Permission to use "Vanderbilt University" as origin/affiliation in public copy | `company-site/index.html:872,1565,3223` | NEW |
| Consumer terms and privacy | Terms, Privacy Notice, cookie/storage notice, 77 `[DECIDE]` lines | `docs/legal/TERMS-OF-SERVICE-DRAFT.md`, `PRIVACY-POLICY-DRAFT.md` | Q-02 |
| Minors | Age floor 13; ages 13-17 "parent or guardian has agreed" in the terms draft; no under-13 consent path; guardian verification; dual enrolment | `docs/legal/TERMS-OF-SERVICE-DRAFT.md:24-27`; `docs/legal-drafts/MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md`; COUNSEL-BRIEF B4, H3-H5 | Q-04, Q-14, P-04, P-06 |
| FERPA / education privacy | School-official vs vendor; consent; directory information; "FERPA-aligned" public wording | `docs/compliance/FERPA-ALIGNMENT-ASSESSMENT.md`; `company-site/site.js:651` | Q-04, B1-B3; wording is NEW (see `PUBLIC_CLAIMS_APPROVAL_REGISTER.md` C-09) |
| Accessibility | Whether to publish a statement before an assistive-technology pass; contractual WCAG promise; ACR | `docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`; `claims.ts` ids `a11y-human`, `vpat` | Q-06; the tagline "Built for accessibility" at `company-site/index.html:247` is NEW (claims C-04) |
| Payments and subscriptions | Auto-renewal and cancellation rules by state; refund policy; consent text `plus-v2`; "forever"/"two clicks" wording | `docs/legal-drafts/SUBSCRIPTION-BILLING-DISCLOSURE-DRAFT.md`; `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md`; `docs/COMMERCIAL-CORE.md` | Q-07; wording NEW (claims C-03) |
| Payments: held funds | Whether a student-account ledger, payment plans or swipe pool is a regulated activity; PCI scope; merchant of record | `docs/MONEY-MODULES-SWITCH-ON.md`; COUNSEL-BRIEF E1-E4 | Q-13 |
| Tax | Sales-tax treatment of software subscriptions (Stripe tax code `STRIPE_PRODUCT_TAX_CODE` is "owner/accountant-approved"); nexus; revenue recognition; seven-year retention period | `docs/COMMERCIAL-CORE.md` secrets table and "Financial retention"; `docs/company/TAX-AND-ACCOUNTING-READINESS-CHECKLIST.md`; `docs/commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md` | Q-07 and the tax row (accountant, not counsel) |
| Public pricing | A published institutional price list ($15K/$35K/$75K) and an annual-savings claim on a plan not on sale | `company-site/index.html:660,621` | NEW (claims C-01, C-02) |
| Institutional pricing and quotes | Legal status of a quote; price validity; public-sector procurement rules; discount authority with no approver in existence | `app/src/lib/governance/deal-desk.ts`; `docs/legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md` | Q-03 (partial); deal-desk approvers NEW |
| AI | Provider terms for student data (none signed); training prohibition wording; disclosures; AI overage and allowance terms to consumers | `docs/trust/PROVIDER-TERMS.md`; `docs/decisions/D-1231.md`; Q-09, F3 | Q-09, P-12; allowance disclosure NEW |
| Cross-border | GDPR applicability; transfer mechanisms; data region promises; subprocessor change notice | `docs/SUBPROCESSORS.md`; Q-10 last clause; COUNSEL-BRIEF H6; P-18 | Q-10, P-18, H6. Note `docs/legal-drafts/INTERNATIONAL-DATA-TRANSFER-DRAFT.md` does not exist |
| Contracts | Pilot agreement, MSA, order form, DPA, student-data addendum; SLA; support terms | `docs/trust/PILOT-AGREEMENT-OUTLINE.md`; `docs/trust/DPA-CHECKLIST.md`; `docs/trust/SLA.md` (`NOT_STARTED`) | Q-03, Q-05; see `CONTRACT_REVIEW_CHECKLIST.md` |
| Support and SLA representations | "24/7 critical support" in package copy with one responder | `company-site/index.html:662,1717` | NEW (claims C-05) |
| Marketplace | Facilitator vs seller; consumer protection; payouts; take rate (12% vs 15% in two documents; D-1236 says none decided) | `docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md:357`; `docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`; `docs/decisions/D-1236.md:46` | Q-11, Q-12; the 12/15 conflict is NEW |
| Marketing | Consent, testimonials, ambassador compensation disclosure, third-party statistics | `company-site/index.html:440-445,898` | Q-10, P-11; statistics use NEW (claims C-10) |
| Retention and deletion | Backup tails; "no archive kept"; seven-year financial records; legal holds | `app/src/lib/privacy.ts:231`; `RETENTION.md` | Q-08, P-07 to P-09, H8 |
| Employment and insurance | Contractor classification, invention assignment, insurance | `docs/finance/06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`; `docs/company/INSURANCE-READINESS-CHECKLIST.md` | Q-10 |
| Trust and safety | Duty-of-care, restricted material reporting, moderators | `LEGAL-REVIEW-QUEUE.md` Q-19 to Q-24 | Q-19 to Q-24 |

## 3. Process findings

| Finding | Evidence |
| --- | --- |
| Three queues overlap (L-table, Q-table, P-table, COUNSEL-BRIEF letters) and use four ID schemes; no single table says which ID answers which | `LEGAL-REVIEW-QUEUE.md`; `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` ("slice of `LEGAL-REVIEW-QUEUE.md`"); `docs/COUNSEL-BRIEF.md` |
| Every owner field is one named person; backup coordinator and backup claim-owner unassigned | `LEGAL-REVIEW-QUEUE.md` header; `docs/CLAIM-WITHDRAWAL-RUNBOOK.md` header |
| **Placement conflict for this file set.** Two tests enumerate `docs/legal/*.md`: `app/src/lib/trust/legal-drafts.test.ts:55-60` requires every file to end `-DRAFT.md`, carry the "Not in force. Not reviewed by a lawyer." banner and the support link; `app/src/lib/docs/trust-docs.test.ts:700-705` requires each file to have a "draft" row in the trust document map. The four Phase 0 files placed here by instruction (this file, the claims view, `CONTRACT_REVIEW_CHECKLIST.md`, `PRIVACY_REVIEW_QUEUE.md`) satisfy neither; tests were **not run** (Phase 0) but expected red | cited lines |

## Open questions / not verified

- Whether any counsel has been consulted outside the repository is unknown.
- Jurisdictions J1-J5 referenced by the existing queue are unresolved there; not resolved here.
- No statutory deadline was identified; none is asserted.
