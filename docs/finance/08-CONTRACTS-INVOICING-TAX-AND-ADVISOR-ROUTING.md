<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 08. Contracts, invoicing, tax and marketplace: financial requirements and advisor routing

| Control | Value |
| --- | --- |
| Status | **ROUTING DOCUMENT: NO LEGAL, TAX OR ACCOUNTING CONCLUSION IS STATED** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Rule for this page.** Everything phrased as a question is a question for the named professional. Where the page says "proposal", it is an input to that professional's review, not a position. This follows the audit's rule that *qualified human counsel must approve legal conclusions and contracts*, and `LEGAL-REVIEW-QUEUE.md`, `COUNSEL-BRIEF.md` and `docs/commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`, which are the existing queues. Nothing here is a legal, tax or accounting conclusion, and nothing here authorizes a signature, an invoice or a charge.

## 1. What finance needs in every customer contract

For counsel to draft and approve; finance's list of what must be *in* the paper so the money can be billed, collected and recognized.

| Area | Finance needs the contract to state | Why finance cares |
| --- | --- | --- |
| Parties | Exact legal names of both entities, authorized signers, bill-to and ship-to contacts, tax ID where required | Wrong entity means an invoice that cannot be paid or an unenforceable debt |
| Order form | Package, tier or band, active-student definition and count method, term, start date, renewal mechanics, cohorts and environments, modules, integrations in scope | The unit of billing must be countable from data Semester holds |
| Price | Fixed fees, currency, band thresholds and what happens when a band is exceeded, price on renewal (cap or index), AI allowance and overage rates | Prevents an uncollectable true-up and unpriced usage |
| Billing schedule | Invoice dates, amounts, milestones tied to named acceptance evidence, who receives invoices, PO number, vendor-portal registration | The invoice calendar drives cash and deferred revenue |
| Payment terms | Days, method, bank details, late-payment consequence, dispute window, set-off | Collections and DSO |
| Taxes | Price exclusive of tax; exemption certificate; who files; withholding for foreign payers | Prevents absorbing tax by accident (tax adviser) |
| Credits and refunds | Pilot credit definition (eligible fees, expiry, what it cannot offset), SLA credits (cap, sole remedy), refund triggers | Credits are contra-revenue and must be bounded |
| Termination | Convenience, cause, **non-appropriation** (public institutions), effect on prepaid fees, wind-down and export period, offboarding fee if any | Determines what is billable, refundable and recognizable (CPA) |
| Acceptance | Objective acceptance criteria for implementation and pilot closeout, deemed-acceptance clock | Recognition and collection both depend on it |
| Liability and insurance | Cap relative to fees, super-cap for data events, required insurance limits and certificates | Drives the insurance program and its cost (broker, counsel) |
| Data and offboarding | Retention, export, deletion and the cost and timing of each; no suspension of export or deletion for non-payment | Rights that cannot be monetized or withheld |
| Assignment, change of control, MFN, exclusivity, audit rights | Prohibit or escalate | Each can break a financing or an acquisition |
| Reference and publicity | Permission, scope and expiry; claim-specific | Claims register |
| Service levels | Only commitments backed by staffed coverage and measured history | A 24x7 promise without a rota is a liability |

Contract stop conditions (from the repository): no revenue is recorded from an unsigned or non-enforceable proposal, an unapproved price, unperformed delivery or missing acceptance where required.

## 2. Public-sector buying realities to verify (hypotheses, not facts)

Institutions often buy from fixed budget cycles, require purchase orders and vendor registration, take 30 to 90 days to pay, ask for accessibility reports and security questionnaires before a PO, and have rules on non-appropriation, indemnity and governing law. Each of these affects when cash arrives (the model collects after two months and bills annual in advance as a conservative proxy). **Verify with each prospect's procurement office and with counsel; do not generalize from this paragraph.**

## 3. Invoice flow

| # | Step | System of record | Control | Owner | Evidence |
| ---: | --- | --- | --- | --- | --- |
| 1 | Qualify: legal customer, signer, scope, budget path, tax and exemption needs, PO need | CRM | Customer legal entity verified against a source document | Sales | Qualification record |
| 2 | Quote from the **approved** price book; discounts by ladder | Quote tool / CRM | Approver recorded; floor and margin check | Sales; deal desk | Quote version, approval |
| 3 | Review and contract | Contract repository | Counsel for non-standard paper; security/privacy/accessibility for scope | Counsel; founder | Reviewed paper |
| 4 | Sign; create order | Contract repository -> `contracts`, `quotes` tables | Immutable order version; seller is not the sole approver where staffing allows | Founder; finance | Executed order |
| 5 | Invoice | Approved accounting/billing system | Unique numbering; duplicate prevention; invoice matches order lines and dates; tax per adviser's rules | Finance | Invoice, order link |
| 6 | Deliver and obtain acceptance | Implementation project | Acceptance criteria met and recorded | Implementation | Acceptance record |
| 7 | Collect | Bank, billing system | Cash applied to invoice; unapplied cash investigated | Finance | Remittance |
| 8 | Dunning and escalation | Billing system, CRM | Schedule in section 5 of [02](02-REVENUE-STREAMS-AND-PRICING.md); never suspend export or deletion | Finance; account owner | Contact log |
| 9 | Reconcile | Ledger | Bank, billing system and ledger agree monthly ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) | Finance | Reconciliation |
| 10 | Revenue review | Ledger | Accountant's policy applied; billed, collected, entitled, delivered and recognized kept separate | CPA; finance | Contract memo, schedules |
| 11 | Entitle and activate | Platform | A signed order is not a launch GO; activation needs release evidence | Implementation; founder | Release record |
| 12 | Renew, change or close | CRM, contracts | Notice dates tracked (renewal review opens 120 days before term end); credits and refunds approved | Account owner; finance | Renewal record |

Semester's own customer billing is **separate** from any institutional student-account feature of the product and must not use it as its ledger (`ORDERING-AND-BILLING-OPERATIONS.md`).

## 4. Tax and marketplace questions, by topic

Each row is a **question to be answered in writing by the named professional** before the related activity starts. Status for every row: *not concluded*.

| ID | Topic | Why it arises for Semester | Question for the professional | Adviser | Needed before |
| --- | --- | --- | --- | --- | --- |
| T-01 | Sales and use tax on software, SaaS and digital subscriptions | Plus sold to students in many states; institutional contracts | Which jurisdictions tax which products; when does Semester have nexus; registration, collection and filing; exemptions for public institutions | Tax adviser | Any charge |
| T-02 | Marketplace facilitator rules | Semester would take payment for third-party services | In which states is Semester a marketplace facilitator and what must it collect and remit | Tax adviser; counsel | Marketplace open (m31) |
| T-03 | Provider tax forms and reporting | Providers are paid by or through Semester | W-9 / W-8 collection, 1099-K / 1099-NEC / 1099-MISC responsibility between Semester and any payments processor | Tax adviser; processor | First payout |
| T-04 | Money flow and licensing | Collecting from buyers and paying providers | Does the chosen funds flow (processor-managed accounts versus Semester holding funds) trigger money-transmission or similar licensing | Counsel | Marketplace design |
| T-05 | Auto-renewal and subscription law | Plus renews automatically | State and federal requirements for disclosure, consent, cancellation, reminders and refunds; interaction with existing consent text | Counsel | Plus checkout re-enabled (G3) |
| T-06 | App-store distribution | Native iOS/Android apps may sell digital subscriptions | Which purchases must use store billing, what exceptions exist, how store tax and commission are treated | Counsel; platform policy | Native app release |
| T-07 | Consumers who are minors | Students under 18 may sign up or pay | Age gating, parental consent for purchase, COPPA and state laws | Counsel | G3 |
| T-08 | Student workers, ambassadors and stipends | Campus ambassador program | Employee versus contractor versus volunteer classification; payroll tax; school-policy interactions | Counsel; tax adviser; PEO | Program launch |
| T-09 | Payroll taxes and state registration | Remote hires in several states | Registrations, withholding, unemployment, local taxes, workers' compensation | PEO; tax adviser | First out-of-state hire |
| T-10 | Research and development costs | Significant engineering spend | Current-law tax treatment of domestic software development costs and any credits | Tax adviser | First tax year |
| T-11 | Income tax posture and entity | Losses, possible equity compensation | Entity type, state filings, loss carryforwards, equity grants and valuation | Tax adviser; counsel | Entity formation |
| T-12 | International students and payers | Students outside the US; foreign institutions | VAT/GST, withholding, sanctions screening, data transfer | Tax adviser; counsel | First non-US payer |
| T-13 | Unclaimed property and credit balances | Prepaid balances, refunds, credits | Treatment and holding periods | Tax adviser | Credits issued |
| T-14 | Payment card scope | Card data passes through the processor | Confirm the hosted-checkout approach keeps Semester out of card-data scope and which attestation applies | Security assessor; processor | First charge |
| T-15 | Gross versus net presentation and recognition | Marketplace and app-store sales | Principal or agent; timing | CPA | First marketplace order |
| T-16 | Financial-aid and student-account adjacency | Product shows bills and aid for students | Confirm the product's boundary (no payment execution, no eligibility determination) is consistent with the relevant rules | Counsel | Any billing feature release |
| T-17 | Gift, discount and promotion rules | Student promos, referral credits, scholarships | Advertising claims, sweepstakes and promotion law, tax on in-kind benefits | Counsel | Any promo |
| T-18 | Insurance requirements in customer contracts | Customers will require certificates | Required coverages and limits; fit with the cyber and E&O policy | Broker; counsel | First paid pilot |

## 5. Who to engage, in what order

Order follows `GO-NO-GO-DECISION.md` priority 5 ("entity, signing, price, tax/accounting, payment and insurance authority") and the cost lines already in the model.

| Order | Adviser | Engage by | Scope | Deliverable the founder needs | Model cost line |
| ---: | --- | --- | --- | --- | --- |
| 1 | Corporate and commercial counsel (education and student-privacy experience) | Month 1 | Entity and authority, customer paper, DPA, privacy notices, minors, terms, public claims | Executed authority matrix; approved templates; completed rows of the legal queue | Legal retainer |
| 2 | CPA / outside accountant | Month 1 | Accrual books, chart of accounts, monthly close, revenue-recognition policy, tax preparation | Policy memo; monthly close; financial statements | Accounting |
| 3 | Insurance broker | Month 3 | Cyber, tech E&O, GL, D&O; contract certificate requirements | Bound program; certificates | Insurance |
| 4 | Fractional CFO / controller | Month 1 | Model ownership, budget, board package, controls | Board package; approval matrix operating | Fractional CFO (0.4 FTE) |
| 5 | Tax adviser | Before the first charge | Rows T-01 to T-14 | Written advice per row | Accounting / legal |
| 6 | Banker / processor | Before the first charge | Operating accounts, processor account, payout and reserve terms | Accounts; signer matrix | Fees |
| 7 | Payroll / PEO | Before the first hire beyond the founder | Payroll, benefits, burden, state registrations | Quote and burden rate | Payroll burden |
| 8 | Independent security assessor and accessibility assessor | Per GO priorities 2-3 | Pen test, DAST, SOC 2 readiness, accessibility review | Reports; ACR | Security programs |
| 9 | Auditor or reviewer | When an institution or investor requires | Financial statement review or audit | Report | Audit line |

## 6. Open-items register for finance

Not a replacement for `LEGAL-REVIEW-QUEUE.md`; these are the finance-origin rows that should be mirrored there when the founder agrees.

| ID | Item | Owner | Blocks | Status |
| --- | --- | --- | --- | --- |
| F-01 | Approve or replace the proposed institutional price points and pilot terms | Founder; deal desk | Any quote | Not decided |
| F-02 | Revenue recognition policy memo (questions in [02](02-REVENUE-STREAMS-AND-PRICING.md) section 6) | CPA | First invoice | Not started |
| F-03 | Tax rows T-01 to T-18 | Tax adviser; counsel | See table | Not concluded |
| F-04 | Insurance program and required limits | Broker | First paid pilot | Not started |
| F-05 | Entity, bank, signer authority and board resolution | Counsel; CPA | Any contract | Not evidenced |
| F-06 | Refund, credit and dunning policy approval | Founder; counsel | Plus checkout (G3) | Not decided |
| F-07 | Auto-renewal and cancellation terms for Plus | Counsel | G3 | Not decided |
| F-08 | Payment processor account in production, test-to-live drill | Finance; engineering | First charge | Stripe wired, not connected |
| F-09 | Financial controls operating (close, reconciliations, approvals) | Finance | Audit, diligence | Designed ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) |
| F-10 | Vendor price verification (section 4 of [03](03-COST-MODEL.md)) | Finance | Model reliance | Not started |
| F-11 | Commission plan design and accounting | CPA; counsel | First sales hire | Not designed |
| F-12 | Marketplace funds flow, terms and tax design | Counsel; tax adviser | Marketplace (m31) | Not started |
