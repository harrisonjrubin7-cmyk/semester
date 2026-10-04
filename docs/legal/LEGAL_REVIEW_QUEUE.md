> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational working list, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction. It states no legal conclusion.**

# Semester — legal review queue (program view, Phase 0)

| Control | Value |
| --- | --- |
| Date | 2026-10-04 (America/Chicago) |
| Status | **PROGRAM VIEW. The controlled queue is [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) (v0.3, rows Q-00…Q-24 and the L0/L1/L2 priority table).** This page does not replace it, close any row in it, or approve anything. |
| Why it exists | The program asks for `docs/legal/LEGAL_REVIEW_QUEUE.md`. Duplicating a controlled register would create two authorities (`CLAUDE.md`: check main for the thing itself), so this page (a) maps the program's legal categories to the controlled rows, and (b) lists **new items Phase 0 found** that the controlled queue does not carry. |
| Counsel | **None engaged.** Primary and backup coordinator unassigned (controlled queue header, Q-00) |
| Owner of the queue | Harrison Rubin, company-side legal coordinator primary |

## 1. What requires qualified human counsel (program §3) → where it is tracked

| Program item | Controlled row | State |
| --- | --- | --- |
| Pilot agreements | Q-03 (L0) | Draft `docs/legal-drafts/PILOT-AGREEMENT-DRAFT.md`; parties `[SEMESTER LEGAL ENTITY]`; not in force |
| Master subscription agreement, order form, SOW | Q-03 | Drafts in `docs/legal-drafts/` |
| Data-processing agreement | Q-03 | `DATA-PROCESSING-ADDENDUM-DRAFT.md` outline; student-data addendum "not-started" |
| Privacy policy | Q-02 (L0) | `docs/legal/PRIVACY-POLICY-DRAFT.md` "Not in force. Not reviewed by a lawyer"; `[DECIDE with counsel]` on school-official language |
| Terms of service | Q-02 | `docs/legal/TERMS-OF-SERVICE-DRAFT.md`; banner held by `app/src/lib/trust/legal-drafts.test.ts` |
| Marketplace terms | Q-11 (L1) | `MARKETPLACE-AND-PARTNER-TERMS` draft; role decision open |
| Student / guardian / minor policies | Q-14 (L1); register rows on minors | `guardian_links`, `minimum_age` implemented; policy open |
| AI terms and disclosures | Q-09 (L1) | `docs/legal/AI-USE-POLICY-DRAFT.md` |
| Public compliance/security claims | Q-05, Q-06 and `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` | see [`PUBLIC_CLAIMS_APPROVAL_REGISTER.md`](PUBLIC_CLAIMS_APPROVAL_REGISTER.md) |
| Incident notification language | Q-16 (L0) and privacy-incident row | decision rights unassigned |
| Data-transfer positions | vendor/transfers row (L1), international row (L2) | `docs/SUBPROCESSORS.md` is test-held to code |
| Tax / payment / marketplace obligations | Q-07, Q-13 (payments/PCI), tax row (L1) | no CPA/tax adviser |
| Entity, IP, signing authority | Q-01 (L0) | no entity evidenced |
| FERPA / COPPA / state applicability | Q-04 (L0) | `docs/FERPA-COPPA-1EDTECH-READINESS.md` is readiness, not a conclusion |
| Accessibility statement / ACR | Q-06 (L0) | `docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`; no assessor |

Program §3 also names these companion files. They are **not created in Phase 0** (the build rule); each is queued as a Phase 1/2 deliverable and maps to existing material:

| Program file | Existing material | Phase |
| --- | --- | --- |
| `docs/legal/CONTRACT_REVIEW_CHECKLIST.md` | `docs/trust/DPA-CHECKLIST.md`, `docs/legal-drafts/COUNSEL-ISSUE-CHECKLISTS.md`, `CONTRACT-DEVIATION-APPROVAL-MATRIX` | after counsel engaged |
| `docs/legal/PRIVACY_REVIEW_QUEUE.md` | controlled queue privacy rows; `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md` | Phase 1 |
| `docs/legal/PROCUREMENT_REVIEW_QUEUE.md` | `docs/legal-drafts/RFP-RESPONSE-CONTENT-LIBRARY.md` | Phase 9 |
| `docs/legal/AI_GOVERNANCE_REVIEW_QUEUE.md` | Q-09; `docs/ai-governance/*` | Phase 5 |

## 2. New items found by Phase 0 (not in the controlled queue)

Each is a *question for counsel or an owner decision*, with the evidence that raised it. None is a conclusion.

| ID | Priority | Item | Evidence | Reviewer / authority | Blocks |
| --- | --- | --- | --- | --- | --- |
| PL-01 | **L0** | **A published statement implies legal review is complete.** `ops/billing/README.md`: "The owner confirmed legal and independent reviews complete on 2026-10-01". The controlled queue and `GO-NO-GO-DECISION.md` say counsel is unassigned and legal authority open. Counsel should say whether any statement of this kind may stand and whether a billing tool's activation record relied on it | `ops/billing/README.md`; `LEGAL-REVIEW-QUEUE.md` Q-00; `ops/billing/activate-live.mjs` | counsel + founder | any paid motion |
| PL-02 | **L0** | **Live billing acceptance took a real payment before counsel-approved terms/refund/privacy existed.** One $7.99 live checkout was accepted; tax recorded $0.00. Is any remediation, disclosure, tax or refund step owed for that transaction? | `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | counsel + CPA/tax adviser | paid motion |
| PL-03 | **L0** | **Public price and savings figures** on a page whose own claims register marks prices PROHIBITED (CLM-015): `company-site/index.html:621` ("save 38%"), `:623/637` ($7.99/$59 "planned; not yet on sale"), `:660` (institution bands "From $15K / yr…"). `D-1154` supersedes the Plus price. Counsel decides whether and how the text may remain | `company-site/index.html`; `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` CLM-015 | counsel + founder + finance | any public push |
| PL-04 | L0 | **Accessibility over-claim on the marketing site**: `company-site/site.js:48` "Every screen uses … WCAG 2.2 AA standards." CLM-008 prohibits conformance claims; the product's own CI says its a11y checks are "not a formal WCAG audit" | `company-site/site.js:48`; CLM-007/008 | accessibility counsel | any public push |
| PL-05 | L1 | **"FERPA-aligned" wording** in the FAQ and trust cards (`company-site/site.js:737`, `:605`): "Semester provides FERPA-aligned contractual and technical controls". CLM-010 prohibits compliance conclusions; counsel should decide whether "aligned" is acceptable and under what qualifier | `company-site/site.js:737` | education/privacy counsel | trust-center publication |
| PL-06 | L1 | **BYO-key AI for school-managed accounts.** A student's own provider key is used straight from the browser with no Semester policy, kill, budget or redaction. Data-use, FERPA/school-official posture and the provider's own terms apply to content sent. Is BYO-key permissible for managed accounts, with what disclosure? | `app/src/lib/claude.ts:960-967`; `openai.ts:186`; `lib/governance/ai-systems.ts:135` (`read_grades` reaches the model on consumer routes) | AI/privacy/education counsel | institutional AI |
| PL-07 | L1 | **Platform AI path sends records-derived content to a provider on consumer routes** (`read_grades`, `read_attendance`). Whether that is permitted for a school's students, and under whose authority, is for counsel | `lib/governance/ai-systems.ts:135` | education/privacy counsel | institutional AI |
| PL-08 | L1 | **Support/billing contact is a personal mailbox; app hosted on a personal GitHub Pages host.** Counsel/finance to advise what notices, terms and processor records must name | `company-site/index.html` billing-contact row; claims register note on company addresses | counsel + founder | paid / individual launch |
| PL-09 | L1 | **Restore/backup deletion tails vs deletion promises.** `export_my_data`/`erase_account` exist; backup behaviour has never been measured (`RESTORE.md`), so any "deleted" wording cannot be tied to an observed tail | `RESTORE.md`; Q-08; deletion-wording row | privacy counsel | privacy notice |
| PL-10 | L1 | **Subject-rights clock is a human daily check**, not a worker. Counsel decides what response clocks the company may state | `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`; `data_subject_request.due_at` | privacy counsel | privacy notice |
| PL-11 | L2 | **Marketplace**: no transaction code was found; the draft terms and a 12%/15% take-rate discrepancy exist. Counsel to confirm the company's role before any build | `docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md:353`; `docs/finance/02-…` | commercial/payments counsel | marketplace |
| PL-12 | L2 | **Pricing authority**: which written approval makes a price "approved"? `D-1154` names a second approver without an authority-matrix entry | `docs/decisions/D-1154.md`; `docs/commercial/PRICING-AND-PACKAGING.md` | founder + counsel | any quote |

## 3. Rules this page follows

- It assigns no legal outcome. "Counsel decides" means exactly that.
- It does not draft contract language.
- A row closes only in the controlled queue, with the correct reviewer, the identified version, recorded business decisions, evidence of required product changes and an authorized approver's recorded permitted use (controlled queue intake rule).
- New rows PL-01…PL-12 are proposed for adoption into the controlled queue by its owner; until then they live here and in [`../program/RISK_REGISTER.md`](../program/RISK_REGISTER.md) (PR-07).
