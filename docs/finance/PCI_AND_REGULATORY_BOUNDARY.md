# PCI and regulatory boundary

| Control | Value |
| --- | --- |
| Status | **PROPOSED BOUNDARY STATEMENT AND QUESTION LIST — NO DETERMINATION HAS BEEN MADE BY ANY QUALIFIED PERSON** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) §E (E1–E4), [`06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`](06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md) (Q-24 to Q-27), [`../MONEY-MODULES-SWITCH-ON.md`](../MONEY-MODULES-SWITCH-ON.md), D-146, D-1236 |
| Claim ceiling | Internal. **No PCI standard, SAQ type, license analysis or exemption is stated as fact anywhere.** Two repository tests fail text that claims PCI compliance or certification. |
| Prohibited claims | "PCI compliant", "PCI certified", any SAQ type as determined, "not a money transmitter", "licensed", "FERPA compliant", "SOC 2 compliant" (CLM-010; `trust-docs.test.ts`, `trust.test.ts`). |

> This document is not legal advice, a PCI assessment, or a regulatory opinion. It states how Semester intends to stay on the safe side of a boundary and lists who must decide whether it does. **[REQUIRES QUALIFIED REVIEW]** marks every place that needs a named professional.

## 1. Position, in one paragraph

Semester intends never to receive, store, process or transmit a card number or bank account number; never to hold customer or provider funds; never to originate a payment except through a regulated rail; and never to act as a payment processor, money transmitter or lender. Whether that intention is **sufficient** to put Semester outside each regulation is a question for counsel and an assessor, not a conclusion of this repository (E1, E2, E3, Q-26, Q-27). None has been retained (D-1154).

## 2. The design controls that serve the intention (FACT or PROPOSED)

| Intention | Mechanism | State |
| --- | --- | --- |
| No card number reaches Semester | Today's checkout redirects to the rail's hosted page; the client only receives an https URL on the rail's host; no card field or payment SDK exists in `app/src`; no `@stripe` dependency | FACT |
| None enters later | The adapter interface has no card-capable parameter; collection returns a token; embedded fields (if ever) are rail-served | PROPOSED |
| None is typed into a note or reference | 13–19 digit runs refused in browser and database on the school ledger; the same check on every finance free-text column | FACT (school), PROPOSED (rest) |
| No payload retained | `payment_events` keeps a hash only; the inbox keeps an allowlist projection | FACT, PROPOSED |
| Display data only | Brand, last four, expiry, status; truncation rules confirmed by an assessor **[REQUIRES QUALIFIED REVIEW]** | PROPOSED |
| No secret in the browser | Edge Function secrets only; scan test | FACT, PROPOSED |
| No funds held | Ledger accounts show money owed *by the rail to Semester* (`processor receivable`), not balances held for customers; no payouts, wallet or stored value | PROPOSED |
| School money never passes through Semester | D-146: nothing moves; the school's own provider holds it | FACT |
| Marketplace money never custodied | D-1236: a licensed processor holds funds and pays providers | FACT (decision), nothing built |

## 3. PCI DSS

**State.** No SAQ type has been determined. `COUNSEL-BRIEF` E2 asks: what PCI scope follows from provider payments as built? Finance Q-27 asks the same with chargebacks. The vendor register lists "PCI scope confirmation (Semester never sees card numbers)" as an open item for the rail.

**What this design needs answered, by a qualified assessor or the acquirer's guidance, in writing:**

1. Which self-assessment (if any) applies to **today's** arrangement: redirect to a rail-hosted page.
2. Whether **embedding a rail-served field** in Semester's page changes it, and what Semester must then do (script inventory and integrity on the checkout page, content security policy, page change detection are the controls assessors commonly look at; whether they apply, and in what form, is theirs to say).
3. Whether **stored tokens charged by Semester** (Mode B, off-session) change anything.
4. What display data (brand, last four, expiry) may be stored, for how long, and where.
5. Whether Semester's receipts, notices and support tooling can hold truncated data.
6. Who attests, when, and what the rail attests to for its part (the responsibility matrix).
7. Whether an internal scan or penetration test is required of the checkout page and the webhook endpoint.

**Operating rules until answered.** No embedded field ships (FRG-14). No SAQ type, attestation or "PCI" wording appears in any customer-facing, sales or trust page (CLM-010). The only PCI sentence permitted internally is the intention in §1.

## 4. Money transmission, stored value and lending

**Position.** Semester's flows are: (a) customers pay Semester for Semester's own software; (b) a school records a student's balance in a school ledger and the school's own provider moves the money (D-146); (c) a marketplace, if ever, uses a licensed processor that holds funds (D-1236). None is built for (b) or (c).

**Questions** (counsel, **[REQUIRES QUALIFIED REVIEW]**):

| # | Question | Source |
| --- | --- | --- |
| R-1 | Does (a), as an ordinary merchant selling its own product through a processor, raise any licensing issue? Does accepting payments for **another party** on a school's behalf, if ever, change that? | E1, Q-26 |
| R-2 | Does recording a student's balance and payments on a school's behalf make Semester a service provider under federal student-aid rules, or a money transmitter, or neither? | E1 |
| R-3 | If a processor's connected accounts hold funds for providers or schools, does that keep Semester outside money-transmission rules in every state it operates? | Q-26 |
| R-4 | Are credits, prepaid balances or a wallet **stored value** or prepaid access? Are refunds of credits restricted? | roadmap stage 3 |
| R-5 | Is a Semester-run installment option consumer credit in any state? | Q-26; [`PAYMENT_PLAN_ENGINE.md`](PAYMENT_PLAN_ENGINE.md) |
| R-6 | Who is merchant of record, who refunds, who reconciles when a school collects through Semester? | E3 |
| R-7 | Is removing the money code acceptable if the answers are unfavourable? | E4 |
| R-8 | Anti-money-laundering and sanctions obligations at Semester's level, if any, given the rail performs KYC/KYB | roadmap |
| R-9 | Marketplace Class E exclusions (financial products and loans) and any partner-payment structure | D-1236 |

Until R-1 to R-3 are answered nothing beyond (a) is built or advertised, and (a) is gated by [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md).

## 5. Consumer protection, tax and records

| Area | Question | Owner |
| --- | --- | --- |
| Auto-renewal and cancellation | Disclosure, consent, reminder and cancellation rules by consumer jurisdiction; whether the consent text (`plus-v2`) is sufficient; the effect of D-132's end-of-period cancel (Q-24, Q-07) | Consumer-protection counsel |
| Refund policy | Whether "no refund window" (D-1019) is lawful where Plus is offered | Same |
| Sales tax and VAT | Registrations, nexus, taxability of subscriptions, usage and implementation fees, exemption certificates; the rail's tax engine is a tool, not a determination | Tax adviser |
| Invoice rules | Required invoice fields by jurisdiction; numbering gaps from sequences; credit-note numbering | Accountant + tax adviser |
| Records | Seven-year individual retention (D-132) against any longer statutory period; institutional records by contract | Accountant + counsel |
| Unclaimed balances | Credit balances that persist | Accountant + counsel |
| Minors | Nobody under 13 holds an account (D-139); 13–17 purchasing and parental consent; K-12 edition waits (D-141) | Privacy counsel |
| Education records | Whether payment or balance data is an education record when a school pays or is shown it; what Semester may disclose to a school (Q-25) | Privacy counsel |
| Data rights | Export and deletion never blocked by payment (D-009); billing records kept for retention only | Privacy counsel |
| Sensitive data | Amounts owed are sensitive (PIA); student accounts HIGH residual | Privacy |
| Cross-border | Currency, VAT, data transfer for non-US customers; the platform is USD-only today with no FX | Tax adviser + privacy counsel |
| Accessibility of checkout | Accessibility obligations for payment flows | Accessibility lead |

## 6. What is outside the boundary and stays outside

Semester does not: store raw payment credentials; custody funds; issue cards or accounts; offer credit or financing; hold a license; perform KYC/KYB on end customers; process network disputes; set interchange or fees; underwrite risk. Each of these is a regulated function of the rail or a partner. Stage 3 to 5 of the roadmap describe what changes if that is ever revisited, and each needs a new owner decision and counsel first.

## 7. If the answers are unfavourable

The adapter model makes retreat cheap: pause the rail, keep checkout held, keep the ledger and workflows (which are Semester's own record-keeping and do not move money). The repository's own plan (E4) already asks whether removing money code would be acceptable. Nothing in this design makes retreat harder, and every build step is shadow or sandbox until its gate.

## 8. Engagement order (proposed)

1. Payments counsel and a qualified accountant first (neither is retained). Hand them [`NATIVE_FINANCIAL_PLATFORM.md`](NATIVE_FINANCIAL_PLATFORM.md) §12, this document, E1–E4 and Q-24 to Q-27.
2. A qualified security assessor, or the rail's own guidance, on §3 before any embedded field.
3. A tax adviser before any new jurisdiction or invoice generation by Semester.
4. Consumer-protection and privacy counsel before native checkout copy and Mode B.
5. A broker on payment-error, cyber and crime cover before the first live volume.

## Evidence state

- **Repository evidence:** `COUNSEL-BRIEF.md` §E, `06` Q-24–Q-27, `MONEY-MODULES-SWITCH-ON.md`, `VENDOR-RISK-REGISTER` rows, `trust-docs.test.ts` and `trust.test.ts` claim tests, D-146, D-1236.
- **Operational evidence:** none. ops/billing/README.md says the owner "confirmed legal and independent reviews complete on 2026-10-01"; no counsel sign-off is documented, and GO-NO-GO blockers and the counsel brief contradict it, so it is not relied on here.
- **Missing proof:** every determination above.

## Cannot be completed from source code

Every determination in §3, §4 and §5. This document records the questions and the design that keeps the answers favourable; it does not answer them.
