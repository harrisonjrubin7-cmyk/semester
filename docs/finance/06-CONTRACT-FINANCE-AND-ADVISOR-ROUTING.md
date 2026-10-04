# Customer contract financial requirements, invoice flow, and advisor routing

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Extends [`../commercial/ORDERING-AND-BILLING-OPERATIONS.md`](../commercial/ORDERING-AND-BILLING-OPERATIONS.md), [`../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md) and [`../company/TAX-AND-ACCOUNTING-READINESS-CHECKLIST.md`](../company/TAX-AND-ACCOUNTING-READINESS-CHECKLIST.md) |
| Rule | **This document states no legal, tax or accounting conclusion.** It lists what Finance needs from a contract and routes every open question to the professional who can answer it. |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. What every institutional contract must say financially

The positions below are Finance's proposed minimums. Counsel decides the legal wording; the accountant decides the accounting consequence.

| Term | Proposed minimum position | Why Finance cares | Reviewed by |
| --- | --- | --- | --- |
| Legal customer and bill-to | Exact legal entity, bill-to and ship-to, tax-exempt status and certificate, billing contact, PO number if required | Invoices that do not match a PO are rejected by accounts payable | Finance |
| Order form | Package, term, start date, go-live target, active-student band, modules, support tier, region, price, currency (USD), payment schedule | Everything the invoice, the entitlement and the revenue schedule need | Finance + RevOps |
| Term and renewal | 12-month initial term; renewal by written order, not silent auto-renewal for public customers; renewal notice 90 days | Public contracts often forbid auto-renewal; ARR quality depends on renewal discipline | Counsel |
| Billing schedule | Annual in advance for platform and per-student fees; implementation 50% at signing and 50% at go-live; credit packs prepaid | Cash conversion; every month of delay is cash in the model | Finance |
| Payment terms | Net 45 default; net 60 with CFO approval; beyond net 60 needs CEO and CFO | Collections profile is net 45-60 | CFO |
| Payment method | ACH or wire preferred; card only below a set invoice size, with any surcharge cleared by counsel | Card fees of about 3% on large invoices are material | Counsel, Finance |
| Price protection and escalator | Price locked for the initial term; renewal increase capped at 5% or CPI, whichever is greater, unless the band changes | Protects against under-pricing as usage grows | CFO |
| Active-student band and true-up | Band set at signing; usage measured at term end; step to the next band at renewal, not mid-term; no retroactive charges | Avoids surprise bills and disputes; captures expansion | CFO |
| Included usage and AI allowance | Included AI allowance per active student, hard cap, credit packs above it; no automatic overage billing | AI cost is the margin swing factor (doc 07) | CFO + CTO |
| Implementation scope and change orders | Fixed scope, assumptions, customer responsibilities, acceptance criteria, change-order rate card | Overruns of 25% cost real money (doc 07) | COO/CS + CFO |
| Acceptance | Written acceptance within 10 business days or deemed accepted; milestone defined | Controls when the second implementation invoice is due and may affect recognition | Counsel, accountant |
| Termination | Termination for cause with cure; termination for convenience only with notice and no refund of prepaid fees except as stated; non-appropriation clause pro rata only | Defines the contract term and the refund liability | Counsel, accountant |
| Refunds and credits | Service credits only as the sole remedy, capped at a percentage of monthly fees; refunds only on termination for Semester's uncured breach | Variable consideration and cash exposure | Counsel |
| Service levels | Availability targets matching the published SLOs; credits calculated and applied by Finance | Promises must match evidence; credits hit revenue | CTO + Counsel |
| Liability cap and indemnity | General cap at 12 months of fees; data-incident super-cap at a multiple agreed with the broker's coverage | Insurance limits must match what is promised | Counsel + broker |
| Insurance certificates | Evidence of cyber, errors and omissions, general liability limits | Often required before signature | CFO + broker |
| Data, exit and deletion | Export on request and at exit; deletion on a stated schedule subject to legal holds; unpaid fees do not block export | Matches the repository's rights-always-available rule | Counsel |
| Taxes | Prices exclude taxes; exemption certificate collected; tax shown separately | Avoids absorbing tax | Tax adviser |
| Late payment | Notice and suspension rights only after a cure period; interest or fees only as counsel approves; never suspend safety, accessibility or export | Collections leverage without breaking trust rules | Counsel |
| Cooperative or consortium vehicle | Admin fee payable (modeled at 1% of billings) and reporting duties identified | Fee reduces margin; reporting is an obligation | Counsel + Finance |
| Reseller or partner | Share, payment timing and who owns the customer relationship stated | Changes revenue presentation and cash | Counsel, accountant |
| Non-standard terms | Logged and approved on the Approval_Matrix before signature | Prevents hidden obligations | Counsel + CFO + CEO |

## 2. Quote-to-cash and invoice flow

```
Opportunity (CRM)
  │  discount and terms inside authority?  ──no──► approval per matrix (document 05), counsel for non-standard terms
  ▼
Quote ──► order form signed by an authorized signer; PO if the customer requires one
  │  RevOps validates: legal entity, bill-to, tax status, band, modules, term, dates, price vs price book
  ▼
Closed-won ──► tenant provisioning request (entitlements from the order, never from the CRM stage)
  │           contract and order copied to the contract register; commission record opened
  ▼
Invoice schedule created in the billing system (signing, go-live, anniversary)
  │  invoice carries: legal entity, PO, order reference, period, line items, tax shown separately, remit-to, terms
  ▼
Invoice issued ──► delivered by the customer's required channel (email, accounts-payable portal)
  │  dunning cadence day 30 / 45 / 60 / 75 / 90 (document 02)
  ▼
Cash received (bank / processor) ──► cash application to the invoice ──► receivable cleared
  ▼
Revenue schedule in the accounting system, as the accountant specifies  ──►  month-end close
  ▼
Renewal: 120 days out the success plan and quote start; 90 days notice; renewal order, not silent roll-over for public customers
```

| Step | Owner | Control | Evidence |
| --- | --- | --- | --- |
| Quote approval | Sales + Finance | Price book and discount authority checked before the quote leaves | CRM approval trail |
| Order validation | RevOps | Order form fields complete; entity matches the bill-to; no unapproved terms | Validation checklist on the order |
| Provisioning | RevOps + engineering | Entitlements set from the validated order only; audit event written | Audit event ID on the order |
| Invoicing | Finance | Invoice generated from the schedule, not typed by hand; second person reviews first invoice per customer | Invoice register |
| Delivery | Finance | Sent to the customer's AP contact and portal; proof of delivery stored | Delivery log |
| Collections | Finance + customer success | Aging reviewed weekly; escalation per cadence | Aging report |
| Cash application | Finance | Payment matched to invoice by reference; unmatched cash investigated within two days | Bank reconciliation |
| Revenue entry | Finance + accountant | Schedule agrees to contract; manual entries reviewed by a second person | Contract-to-ledger sample |
| Credit memos and refunds | Finance | Per the approval matrix; reason code; customer record | Credit register |

## 3. Public-sector and institutional payment mechanics

- **Vendor onboarding.** Expect a vendor-registration form, W-9, certificate of insurance, bank verification and sometimes a security questionnaire before first payment. Keep a standing packet.
- **Purchase orders.** Many institutions pay only against a PO; an invoice without the PO number is rejected. Finance owns the PO log.
- **E-invoicing portals.** Some institutions require invoices to be submitted through a procurement or accounts-payable portal; Finance keeps the credentials under access control.
- **Tax-exempt status.** Collect and file the exemption certificate before the first invoice (Q-15).
- **Bank-detail fraud.** Any request to change Semester's remit-to details, or a customer's request to pay elsewhere, is verified by call-back to a known number. The same applies to Semester's own vendors.
- **Fiscal calendars.** Many institutions budget on a July-June year and have spending deadlines in spring; order timing and the signing seasonality in the model reflect that.
- **Cooperative contracts.** If an institution buys through a consortium or cooperative vehicle, an admin fee and reporting duties follow (modeled at 1% of billings).

## 4. Invoice content standard

Every invoice shows: Semester legal name and address, remit-to and bank details as approved, customer legal name and bill-to, PO number, order form reference, invoice number and date, service period, line items for platform fee, active-student band, modules and implementation milestone, currency, subtotal, tax shown separately (or exemption reference), total, payment terms and due date, and a contact for billing questions. Credit memos reference the invoice they reduce.

## 5. Tax, accounting, legal and marketplace questions routed to professionals

There are 40 open questions. None has an answer in this repository. Each shows the facts to bring and who answers it; the model's treatment is a labelled assumption until they do.

**Revenue recognition**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-01 | Is the platform subscription a single stand-ready obligation recognized ratably, and are implementation, AI credit packs and the alumni module distinct obligations or part of it? | Order forms, SOWs, entitlement design (doc 02) | Accountant |
| Q-02 | Is implementation a distinct service (recognize as performed) or a set-up activity that is recognized over the subscription term? The model assumes straight-line over the implementation window. | SOW scope, acceptance terms, whether the customer can use it separately | Accountant |
| Q-03 | How should a pilot fee, and a pilot credit applied to a later annual agreement, be treated (material right, price concession, consideration payable)? | Pilot paper, conversion credit terms | Accountant |
| Q-04 | What is the contract term when an agreement allows termination for convenience or contains a non-appropriation clause, and how does it affect deferred revenue and remaining-performance disclosures? | Termination and funding clauses in the first contracts | Accountant, counsel |
| Q-05 | How are usage true-ups, AI credit packs (breakage, expiry), and service-level credits treated as variable consideration? | Meter definitions, credit-pack terms, SLA credit schedule | Accountant |
| Q-06 | Is Semester principal or agent in the marketplace, so is revenue GMV or the take rate? Is it principal or agent for app-store fees on student subscriptions? | Marketplace terms, payout flow, who sets price and bears fulfilment and refund risk; app-store terms | Accountant, counsel |
| Q-07 | How are refunds, chargebacks and the 14-day consumer cancellation window handled for student subscriptions, and when is annual-plan revenue recognized? | Refund policy, processor data | Accountant, counsel |
| Q-08 | How are free-tier and institution-sponsored seats treated when the student pays nothing and the institution pays a platform fee? | Sponsorship terms | Accountant |
| Q-09 | How are discounts and bundled prices allocated across obligations (standalone selling price evidence)? | Price book, discount log, quotes | Accountant |

**Costs and capitalization**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-10 | Which software development and implementation costs, if any, are capitalized, and when does capitalization start? Which commissions are capitalized? | Development plan, commission plan | Accountant |
| Q-11 | Where do free-tier users' hosting, AI and support costs belong: cost of revenue or sales and marketing? | Cost model (doc 03) | Accountant |
| Q-12 | How are customer-success, implementation and trust-and-safety people classified between cost of revenue and operating expense? | Role descriptions | Accountant |

**Compensation**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-13 | How should equity grants be valued and expensed, and what is the option pool policy? | Cap table, grant plan | Accountant, counsel |

**Reporting**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-14 | Which accounting framework and fiscal year-end should be adopted, and when is a review or audit expected by customers or lenders? | Customer asks, investor asks | Accountant |

**Sales and use tax**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-15 | Is a SaaS subscription taxable in the states where students and institutions are, and which institutions are exempt (certificates, resale)? | Customer list by state, exemption certificates | Tax adviser |
| Q-16 | Where does Semester have economic nexus, when must it register, and who is responsible for collecting tax on app-store and marketplace sales? | Sales by state, app-store and marketplace flows | Tax adviser |

**Income tax**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-17 | How should research and development costs be treated, and do any credits apply? | Engineering time records, contractor agreements | Tax adviser |

**Payroll and workers**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-18 | Are contractors correctly classified, and which states must payroll register in as remote hires grow? | Hiring map, contractor agreements | Tax adviser, counsel |

**Marketplace tax**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-19 | Which information returns and withholding apply to provider payouts (for example, forms for payees and platform reporting), and are provider sales subject to marketplace-facilitator rules? | Payout design, provider types | Tax adviser |

**International**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-20 | If students or institutions outside the US are served, what indirect-tax registration and data-transfer terms apply? | Customer geography | Tax adviser, counsel |

**Entity**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-21 | Which entity type, state and ownership structure best suit financing, and what franchise or state filings follow? | Founder and investor plans | Counsel, tax adviser |

**Contracts**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-22 | What master agreement, order form, data-processing terms, service-level terms and liability caps are acceptable to institutions and to Semester? | Draft paper from the first design partner | Counsel |
| Q-23 | What terms must a public institution's contract carry (non-appropriation, auto-renewal limits, governing law, insurance, indemnity, accessibility), and what procurement thresholds trigger bidding? | Institution procurement rules | Counsel |

**Consumer terms**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-24 | Do auto-renewal, free-trial, cancellation and refund terms for student subscriptions comply with federal and state consumer-protection and negative-option rules, and with app-store rules? | Checkout flows, cancellation path, copy | Counsel |

**Students and minors**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-25 | What consent and notice apply for students under 18, for guardian features and for sponsored seats, and how do education-records rules shape the data Semester may hold and use for pricing and analytics? | Age mix, data inventory, sponsorship design | Counsel |

**Payments**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-26 | Does holding or moving customer funds (payment plans, tuition payments, marketplace payouts) create money-transmission, lending or consumer-credit obligations, and can a payment processor's connected-account model keep Semester outside them? | Finance-domain design, processor terms | Payments counsel |
| Q-27 | What card-data scope applies (self-assessment level) and how are chargebacks and disputes governed? | Checkout design | Counsel, security lead |

**Marketplace**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-28 | What terms, provider verification, prohibited categories, refund and dispute rules, sanctions screening and safety rules must be in place before launch, and what liability does Semester carry for provider conduct? | Marketplace blueprint | Counsel |

**Employers**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-29 | What anti-discrimination, data-sharing and consent limits apply to employer access to student profiles and to employer pricing? | Career product design | Counsel |

**Pricing claims**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-30 | What substantiation does a claim about savings, ROI or outcomes need, and how are discounts and price comparisons presented? | Public claims register | Counsel |

**Data and incidents**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-31 | What breach-notification duties, contractual notice periods and regulator contacts apply to each customer and state, and what does the insurer require before spending? | Contracts, data map, policy | Counsel, broker |

**Antibribery and sanctions**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-32 | What screening applies to customers, providers and payees, and what gifts and hospitality rules apply to public-sector sales staff? | Sales process | Counsel |

**Insurance**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-33 | What limits and retentions do institutions expect for cyber, technology errors and omissions, general liability and crime, and what is covered in a breach? | Customer questionnaires, quotes | Broker |
| Q-34 | Does the policy cover regulatory penalties, notification, forensics, business interruption and contractual liabilities in the incident scenario? | Policy wording | Broker, counsel |

**Treasury**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-35 | Where should cash be held, and how should balances above deposit-insurance limits be managed? | Bank terms | Accountant, banker |

**Financing**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-36 | What instruments, valuation, pro rata and information rights fit each round, and how does dilution affect founder control? | Term sheets | Counsel |
| Q-37 | What disclosures and projections language is appropriate in investor materials? | Investor deck | Counsel |

**Grants and credits**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-38 | Do any grants, cloud credits or research funding carry reporting, ownership or use conditions? | Award terms | Counsel, accountant |

**Collections**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-39 | What late-fee, interest and collections practices are permitted for institutional and consumer accounts? | Contract templates | Counsel |

**Records**

| ID | Question | Facts to bring | Route to |
| --- | --- | --- | --- |
| Q-40 | What retention periods apply to financial, contract and tax records, and how do they interact with legal holds and deletion requests? | Retention schedule | Counsel, accountant |

### Marketplace concerns in one place

| Concern | Why it matters for Semester | Questions |
| --- | --- | --- |
| Gross versus net revenue | Take-rate revenue (modeled) is far smaller than GMV; presentation changes reported revenue and margin | Q-06 |
| Who is the seller | Determines tax collection duties, consumer-protection exposure and refund liability | Q-16, Q-19, Q-28 |
| Payouts and held funds | Holding or moving funds may create regulated activity; a processor's connected-account design may avoid it | Q-26 |
| Provider verification, sanctions, prohibited categories | Fraud, safety and legal exposure | Q-28, Q-32 |
| Disputes, refunds, chargebacks | Cost modeled at 0.8% of GMV plus moderation; real rate unknown | Q-06, Q-27 |
| Information returns on payouts | Provider tax reporting duties | Q-19 |
| Student protection and minors | Consent and age rules for transactions and guardians | Q-25 |
| Launch gate | The audit forbids launching payments, payouts or provider access without operating controls and counsel review | All of the above |

## 6. Advisor engagement plan

| When | Professional | First asks | Planning budget in the model |
| --- | --- | --- | --- |
| Before the first quote | Counsel (education and commercial) | Master agreement, order form, DPA terms, consumer terms and renewal rules (Q-22 to Q-25, Q-30) | Legal $255,000 in year 1 including financing costs |
| Before the first invoice | Accountant and tax adviser | Entity and year-end, revenue-recognition memo, exemption handling, sales-tax registration (Q-01 to Q-09, Q-14 to Q-16, Q-21) | Accounting and tax $40,000 in year 1 |
| Before the first payment is taken | Payments counsel and processor | Card-data scope, connected-account design, auto-renewal and cancellation flow (Q-24, Q-26, Q-27) | Inside the legal line |
| Before signing a pilot with live data | Broker | Cyber, technology errors and omissions, general liability and crime limits and certificates (Q-33, Q-34) | Insurance $30,000 in year 1 |
| Before the first raise | Counsel | Instruments, terms, data-room disclosures (Q-36, Q-37) | 3% of each raise |
| Before launching a marketplace | Counsel and tax adviser | Q-06, Q-16, Q-19, Q-26, Q-28 | Inside the legal and accounting lines; scope the work before launch |
| Before hiring remotely or using contractors | Tax adviser and counsel | Q-18 | Inside the accounting and legal lines |
| When customers ask for a security attestation | Auditor | Report scope and timing | Security and compliance $85,000 year 1, $230,000 year 2 |

## 7. Questions for the accountant on revenue recognition, in plain terms

The model recognizes revenue on a labelled simplification: ratable for subscriptions and licences from go-live; implementation straight-line over the implementation window; pilot fees ratable over 26 weeks; marketplace at the net take rate; student refunds as a percentage reduction. Q-01 to Q-09 ask whether each is right. Until they are answered, do not describe any figure as recognized revenue; use billings, ARR and contracted ARR for operating decisions and keep recognized revenue for the accountant.

## Cannot be completed from source code

Every question above needs a named professional, the executed paper and the facts listed. No contract, tax registration, accounting policy or insurance term is evidenced.
