# Embedded finance roadmap

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPTION SPACE — NOT A PLAN OF RECORD, NOT AUTHORIZED, NOTHING BUILT** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`NATIVE_FINANCIAL_PLATFORM.md`](NATIVE_FINANCIAL_PLATFORM.md) §10, [`../commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md`](../commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md), D-1236, D-1157, ADR-0024, ADR-0019 |
| Claim ceiling | Option analysis only. **Stages 3, 4 and 5 are each held** until a new owner decision supersedes D-146 and D-1236 and counsel has answered. |
| Prohibited claims | That Semester offers a wallet, credits, payouts, financing, cards, or marketplace payments; that any such capability is planned for a date. |

> Not legal, regulatory or investment advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. Why this document exists and what it is not

The brief's maturity path ends in a regulated payments company. This document keeps that option visible without letting it leak into the build. It is deliberately negative in tone: for each capability it states what would have to be true first. D-1157 says it directly: a payments phase needs a new owner decision and counsel. D-1236 holds marketplace, payments, payouts and provider access until four gates (G-OWN, G-DATA, G-TERMS, G-QUEUE) are met by named-person-verified evidence, none of which was met on 4 October.

## 2. Stages and what each adds

| Stage | Capability | Funds held by | New to Semester | Prerequisites |
| --- | --- | --- | --- | --- |
| 1 | Native finance layer on one rail | The rail, paid to Semester only for Semester's own revenue | Adapter, ledger, workflows | [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md) FRG-01 to FRG-12 |
| 2 | Multi-rail, ACH, Semester-scheduled renewals, institutional invoicing, AI overage | Rails | Routing, stored-token charging, second adapter | FRG-13 to FRG-18 |
| 3a | Credits and prepaid balances | Semester or a partner (the question) | Stored-value design | New owner decision + stored-value counsel (R-4) |
| 3b | Marketplace checkout and provider payouts (M4) | **A licensed processor** (D-1236) | Split payments, provider onboarding workflow, take-rate accounting | G-OWN, G-DATA, G-TERMS, G-QUEUE met; processor chosen; counsel item 1 |
| 3c | Campus commerce interface (dining, bookstore, dues) | The campus's own processor or a partner | A UI over the school's rail | D-146 superseded for any collection; school contracts |
| 3d | Partner revenue share | Semester receives its share from the partner's settlement | Revenue-share accounting | Contract + accountant |
| 3e | Embedded finance partner (financing, accounts, cards for students) | A licensed partner | Referral and UX only | Class E review (financial products and loans are prohibited as marketplace offerings today) |
| 4 | Payments platform: risk, routing, treasury | Banks and networks | Fraud operations, treasury, 24/7 incident response | Capital, staff, counsel, a business case |
| 5 | Regulated entity | Semester's own licensed entity | Everything the brief's "what it takes" list names | A separate company decision; not a launch dependency of the Education OS |

## 3. What each stage-3 capability needs

### 3a. Credits and prepaid balances

A credit that is purchased and later spent on Semester's own services is the simplest case, and still raises stored-value, refundability, expiry, unclaimed-property and revenue-recognition questions **[REQUIRES QUALIFIED REVIEW]**. A balance that can be sent to another person or spent elsewhere is a different and more regulated thing. Design stance: credits are **service credits** denominated in service, non-transferable, expiring only as counsel allows, with a ledger of their own (`credit_ledger`, double entry, same invariants) and never cash-out. Not designed further.

### 3b. Marketplace payouts

Per D-1236 and `MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md` M4: student-paid checkout needs a licensed processor acting as merchant of record or payment facilitator that holds the funds and pays providers; Semester never custodies money; fees never buy ranking; Class E (housing leases, health and counselling, legal, immigration, financial products and loans, proctoring, AI providers receiving student data, under-18s) is prohibited. Take rates (12% vs 15% conflict) and reserves (0.8% of GMV dispute cost) are hypotheses. What the adapter layer contributes is a `split` capability (payment with a fee for the platform) and a settlement parser that understands connected-account payouts; what it must not do is hold an intermediate balance. Whether using connected accounts keeps Semester outside money transmission is R-3.

### 3c. Campus commerce

Today's school ledger records payments typed by people against the school's own provider (D-146). A commerce interface (pay a dining plan, club dues, a bookstore order) would put a Semester screen in front of the **school's** rail. The adapter model fits (the school's rail is an adapter instance scoped to a tenant), but money still must not touch Semester's accounts, and the school, not Semester, would be merchant of record. Entirely new: tenant-scoped rails, per-school credentials in a secret store, per-school settlement reconciliation, and a decision on who answers disputes.

### 3d. Partner revenue share and 3e. embedded partners

Revenue share from a partner's settlement is an accounting and contract matter. Financial-product partners (loans, cards, BNPL) are Class E for the marketplace and would be a referral-only integration at most, with no Semester advice, no ranking by payment, and disclosure review.

## 4. What the adapter layer buys, and what it does not

Buys: a second rail without a rewrite; per-tenant rails; a canonical event stream; a ledger that does not care who moved the money; reconciliation that works for any rail; the ability to **pause** a rail without losing the business logic.

Does not buy: a licence, a bank, a card-network relationship, PCI scope reduction by itself, fraud tooling, treasury, a legal opinion. Stage 4 and 5 are different businesses; the adapter is a prerequisite for choosing among them, not a step toward them.

## 5. Decision gates for stages 3 to 5

1. A written owner decision, new, superseding D-146 and/or D-1236 for exactly the capability in question.
2. Counsel's written answers to the matching R-rows in [`PCI_AND_REGULATORY_BOUNDARY.md`](PCI_AND_REGULATORY_BOUNDARY.md) §4.
3. A named provider (processor, bank or partner) with contracts reviewed, subprocessor and vendor-risk entries, and the provider's own responsibility matrix.
4. A capital and staffing view: fraud operations, dispute operations, finance staff who know the domain, incident response. For stage 4+ the brief's list (banking partners, acquiring relationships, PCI program, tokenization infrastructure, fraud, chargeback and AML controls, money-transmitter analysis, settlement and reserve management, treasury, 24/7 incident response, external audit) is the minimum; none exists.
5. A business case that is **not** a forecast presented as fact: planning labels and `assumption-register` entries.
6. A rollback: how the capability is paused and unwound without moving anyone's money by hand.
7. For stage 5, a separate entity, since "it should not be a launch dependency for the Education OS".

## 6. Revisit triggers

Review this document when any of these happens, and not before: counsel is retained and answers R-1 to R-3; the owner chooses a rail; a school asks Semester to collect on its behalf; marketplace gates G-OWN to G-QUEUE are evidenced; payment volume makes fees a material cost (the finance model's processor-fee line, `03`); a rail changes terms.

## Evidence state

- **Repository evidence:** D-1236, D-1157, D-146, `MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md`, `docs/operations/coo/08-marketplace-partner-trust-fulfillment.md`, ADR-0019, ADR-0024 (proposed, unratified), `COUNSEL-BRIEF.md`.
- **Operational evidence:** none; capability register marks marketplace BLOCKED.
- **Missing proof:** everything stage 3 and beyond.

## Cannot be completed from source code

Whether any of stages 3 to 5 is lawful, commercially sensible or desired; partner terms; capital; staffing; take rates; licensing analysis.
