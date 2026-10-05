# Native financial platform

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md), [`../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md`](../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md), [`08-FINANCE-CONTROLS-AND-OPERATIONS.md`](08-FINANCE-CONTROLS-AND-OPERATIONS.md), D-146, D-1236 |
| Claim ceiling | Internal planning and engineering. Nothing here is a price, a forecast, an approved control, a legal or accounting conclusion, or a statement about what Semester can do today. |
| Prohibited claims | That Semester processes, holds, transmits or custodies money; that any PCI standard is met; that checkout, refunds, disputes or institutional invoicing are available; any price or refund window (CLM-010, CLM-015). |

> This document organizes a design for the founder and for qualified professionals. It is not accounting, tax, legal, payments-regulatory or PCI advice. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it. Basis labels follow the [assumption register](assumption-register.md): FACT (verified in the repository), PROPOSED, HYPOTHESIS, REVIEW.

This is the hub of fourteen documents. Section numbers 1–14 below are the fourteen items the brief asked for.

| Document | Holds |
| --- | --- |
| This file | 1 existing architecture, 2 capability matrix, 3 rail boundary, 5 ledger design (billing), 10 maturity path, 11 backlog, 12 professional review, 13 plans, 14 first 25 actions |
| [`PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md`](PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md) | 6 adapter design, webhook normalization, event verification |
| [`NATIVE_CHECKOUT_SPEC.md`](NATIVE_CHECKOUT_SPEC.md) | 4 checkout architecture, checkout screens and routes |
| [`COMMERCIAL_AND_ENTITLEMENT_MODEL.md`](COMMERCIAL_AND_ENTITLEMENT_MODEL.md) | catalog, price book, subscriptions, entitlements, usage and AI usage billing, pricing exceptions |
| [`STUDENT_ACCOUNT_LEDGER.md`](STUDENT_ACCOUNT_LEDGER.md) | the school-side ledger, kept apart from Semester's own books |
| [`INSTITUTIONAL_BILLING.md`](INSTITUTIONAL_BILLING.md) | accounts, contacts, quotes, orders, POs, tax exemption, invoice schedules, collections |
| [`PAYMENT_PLAN_ENGINE.md`](PAYMENT_PLAN_ENGINE.md) | student payment plans, and Semester's own installment plans |
| [`REFUND_CREDIT_DISPUTE_POLICY.md`](REFUND_CREDIT_DISPUTE_POLICY.md) | refunds, credits, write-offs, chargebacks, retries, cancellation |
| [`RECONCILIATION_AND_SETTLEMENT.md`](RECONCILIATION_AND_SETTLEMENT.md) | settlement ingestion, matching, exceptions, period close |
| [`FINANCE_OPERATIONS_CONSOLE.md`](FINANCE_OPERATIONS_CONSOLE.md) | 7 screens and routes, 8 workflow catalog |
| [`FINANCIAL_CONTROLS.md`](FINANCIAL_CONTROLS.md) | 9 security and compliance controls |
| [`PCI_AND_REGULATORY_BOUNDARY.md`](PCI_AND_REGULATORY_BOUNDARY.md) | what stays with the rail, what needs counsel |
| [`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md) | stages 3–5, each behind its own decision |
| [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md) | the technical and finance gates before any money moves |

## Thesis

Semester owns the financial product: catalog, price book, quote, order, invoice, subscription, entitlement, student account, plan, credit and refund workflow, ledger, reconciliation, console, notices, reporting. A regulated payment rail moves the money, behind one interface, until Semester makes a separate, deliberate decision to become a regulated payment business.

**What "does not use Stripe" can honestly mean.** Customers never see Stripe's brand, pages or emails, and no Semester logic depends on Stripe's data model. It does not mean Semester processes cards: card authorization, capture, settlement and network disputes need a licensed processor, and the repository already decided that no money moves through Semester (D-146) and that a licensed processor holds funds (D-1236). Stripe is therefore the *first adapter*, not the architecture. A second rail (for ACH and bank transfer, or a campus processor) is an adapter, not a rewrite.

**What this proposal does not change.** D-146 and D-1236 stand. The checkout hold in code (`billing-checkout/index.ts:27`, `plans.ts:19`) stands. Anything beyond them (Semester holding funds, a wallet, payouts, financing, BNPL, issuing) needs a new owner decision that supersedes them, plus counsel, and is only sketched in [`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md).

## 1. Existing finance architecture

All FACT, read from the repository at the revision above.

**Schema (Supabase).** Integer cents everywhere; lowercase ISO currency per row; no FX.

| Family | Tables | Posture |
| --- | --- | --- |
| Catalog | `commercial_products`, `commercial_plans`, `commercial_prices`, `entitlement_definitions`, `plan_entitlements` | Public read, no API write. Prices retired and replaced, never edited. No price book, tiers, usage prices or coupons. |
| Accounts | `billing_accounts` (individual xor institution), `billing_account_tenants` | One provider customer ref per account. No contacts, addresses, tax profile or hierarchy rows. |
| Quote to contract | `quotes`, `quote_lines`, `contracts` (kind includes `order_form`) | No approval, discount, list-price or term columns; contracts mutable in place; `contract_signed_to_tenant` trigger starts `tenant_plan`, an implementation project and a renewal row; a later order never lowers a plan. |
| Subscription | `subscriptions` (one plan each), `subscription_entitlements`, `checkout_sessions` | No items, quantity or seats. Statuses mirror Stripe's. |
| Invoice and payment | `invoices`, `invoice_lines`, `payment_events`, `credits_refunds` | Invoices mutable; nothing writes `invoice_lines`; `payment_events` append-only and unreadable by the API, hash only; **nothing writes `credits_refunds`**. |
| Recovery | `dunning_cases`, `dunning_actions`, `cancellation_requests` | Hourly `run_dunning()`; 14-day grace; paid entitlements only are removed. |
| School side | `student_account_settings/requests/entries/reconciliations/closes`, `student_payment_plans` (+ installments) | Single-entry signed ledger, maker-checker, $1,000 default high-value threshold, reversal once, closes on passing reconciliation by a second person, hash-chained. No money moves; flag off. |
| Integrity | `ledger_chain*` (private) | Covers `academic_record` and `student_account` only. Commercial tables are not chained. |

**Code.** Four Edge Functions (`billing-checkout`, `-webhook`, `-cancel`, `-portal`) over pure handlers in `supabase/functions/_shared/`. One provider (Stripe), called with plain `fetch`; Checkout Sessions with inline `price_data`, Stripe Tax, Billing Portal, subscription cancel-at-period-end. Webhook verification (HMAC-SHA256, 5-minute tolerance, constant-time) is correct and tested. **There is no provider interface**; `_shared/stripe.ts` is a Stripe utility module, and the `*Deps` types abstract I/O for tests, not the provider. 57 billing tests plus 6 SQL check suites.

**Surfaces.** Student: the Membership panel on Account (behind the hold), and the school-side "The bill" ledger view (flag off). Staff: **no screen reads `invoices`, `payment_events`, `dunning_cases`, `credits_refunds`, `contracts` or `quotes`**; `finance_operator` can read them under RLS with nowhere to look. The Console's Finance tab is a forecast tool on sample data.

**State.** Plus billing was live-accepted once (2026-10-03, monthly, owner account). Not exercised: annual charge, refund, failed renewal, dispute, tax in a registered jurisdiction. New checkout is held by two constants that must change together and are pinned by tests.

**Known gaps this design closes** (each verified in the audit): refund and dispute events change nothing (`FEATURE-TRUTH-TABLE` "PARTIAL"); `payment_events` cannot be replayed and there is no dead-letter queue; an invoice event that precedes its subscription is answered 500 forever instead of parked; dunning notices are Stripe's own emails; no double-entry record of Semester's own billing; no approval mechanism for product-billing refunds, credits, write-offs or pricing exceptions; no settlement or reconciliation for Semester's own billing; AI allowances are hard caps with no metered billing; `pro` has a plan row, no price and no entitlements.

## 2. Native financial capability matrix

Status words follow `FEATURE-TRUTH-TABLE`: ABSENT, PLANNED, PARTIAL, IMPLEMENTED_NOT_RELEASED. "Rail" says whether a regulated rail is needed to *operate* the capability.

| Capability | Today | Target | Rail needed |
| --- | --- | --- | --- |
| Product and plan catalog | IMPLEMENTED_NOT_RELEASED (`commercial_*`) | Extend with price book versions | No |
| Price book, discounts, coupons | ABSENT (`PRICING-AND-PACKAGING`: no price book) | `price_books`, versioned; structure only, no numbers | No |
| Seat/enrollment calculator | ABSENT | Pure function over price book + quantity, shared by quote and checkout | No |
| Quote builder | PARTIAL (`quotes`, `quote_lines`; no UI, no approval) | List/net/discount, `quote_approvals`, deal-desk policy | No |
| Order form and contract | PARTIAL (`contracts.kind='order_form'`, signing trigger) | Supersession link, document hash; no new `order_forms` table | No |
| Institutional billing account | PARTIAL | Contacts, addresses, PO, payment terms, hierarchy | No |
| Purchase-order workflow | PARTIAL (`invoices.po_reference` text) | `purchase_orders` with cap and balance | No |
| Tax exemption workflow | ABSENT | `tax_profiles`, `tax_exemptions` with evidence, verifier, expiry | No (tax *engine* is an adapter) |
| Invoice generation | PARTIAL (provider-mirrored; no lines) | Native schedules, lines, immutability, credit memos | No |
| Subscription engine | PARTIAL (provider-mirrored, one plan) | Items, quantity, renewals scheduled by Semester | Charge command only |
| Entitlement engine | IMPLEMENTED_NOT_RELEASED (SQL + `packages/platform` pure engine, not wired) | Single resolver fed by subscription items | No |
| Usage metering | ABSENT for billing (AI spend meter is a cap) | Meter definitions, idempotent events, aggregates | No |
| AI usage billing | ABSENT (hard 429 caps) | Opt-in metered overage, spend cap, shadow first | Charge command only |
| Student subscription checkout | IMPLEMENTED_NOT_RELEASED, held | Native screens, provider-hosted card fields | **Yes** (collect, authorize, capture) |
| Student account ledger | IMPLEMENTED_NOT_RELEASED, flag off | Unchanged; separate from Semester's books | No (D-146) |
| Payment-plan engine | PARTIAL (school schedule only; no payment link) | Link installments to payments; Semester's own installment option is a counsel question | Charge command for any collection |
| Refund/credit workflow | ABSENT (`credits_refunds` unwritten) | Request → approve → submit → confirm → ledger | Refund command |
| Dunning | PARTIAL (records; notices are Stripe's) | Native notices, retry schedule through adapter | Charge command |
| Chargeback/dispute handling | PARTIAL (event recorded, no effect) | Case table, evidence due dates, outcome posting | Network dispute rail stays external |
| Billing ledger (double entry) | ABSENT | `ledger_*` for Semester's own billing, chained | No |
| Reconciliation | PARTIAL (school side only) | Settlement ingestion and three-way match | Settlement reports from rail |
| Finance operations console | ABSENT (forecast tab only) | See `FINANCE_OPERATIONS_CONSOLE.md` | No |
| Customer communications | PARTIAL (dunning rows; Stripe emails) | `finance_notices` outbox, versioned templates | No |
| Reporting, profitability, cash forecast | PARTIAL (forecast tab on sample data) | Frozen snapshots; forecasts labelled as forecasts | No |
| Pricing exceptions | PARTIAL (`deal-desk.ts` proposed policy) | `pricing_exceptions` with approval, expiry, margin check | No |
| Provider adapter, webhook normalization, event verification | PARTIAL (verification correct; no interface) | See adapter document | Is the rail |
| Financial audit trail, approval controls | PARTIAL (student side only) | `finance_approvals`, history rows, chain extension | No |
| Card/ACH authorization, capture, settlement, network disputes, KYC/KYB, acquiring | n/a | Stay with the rail | **Yes, always** |

**Reconciled with the data model in the brief.** The brief listed 58 tables. 25 already exist under the same name (catalog 5, accounts 2, quote/contract 3, subscription 2, invoice/payment/recovery 6, school ledger 7). This design does not recreate them, and does not recreate the partial ones either: `order_forms` is `contracts.kind='order_form'`; `contract_versions` becomes a supersession column and a document hash; `credits` and `refunds` are `credits_refunds`; `chargebacks` fold into `disputes`; `ledger_entries` and `ledger_reversals` fold into journals and `reversal_of`; `payment_methods` is new but holds tokens only. New tables are listed per document, all additive, none before its `*.check.sql` proof.

## 3. Payment rail boundary

| Semester owns | The rail owns |
| --- | --- |
| Which product, which price, which discount, who approved | Card and bank authorization, capture, clearing |
| Quote, order, contract, signature evidence | Tokenization and secure collection of payment details |
| Invoice number, lines, tax treatment, due date | Merchant acquiring, settlement to Semester's bank, payouts |
| When to charge and what to say when it fails | Network rules, 3-D Secure, fraud scoring at the rail |
| Entitlement on and off | Network dispute rails and their deadlines |
| Refund *decision*, approval and ledger effect | Executing the refund to the original method |
| Dispute *case*, evidence, outcome posting | Receiving and forwarding evidence to the network |
| Ledger, reconciliation, close, reporting | Settlement and fee reports (the external source of truth for cash) |
| Customer notices and support | KYC/KYB of the merchant; AML at the rail |

**Hard lines, until a new owner decision and counsel say otherwise:** Semester stores no card number, no CVV, no bank account number, no raw payment credential (only provider tokens and display-safe brand, last four and expiry); never exposes a provider secret to the browser; never holds customer or provider funds; never originates a payment except through an adapter; never writes the school student-account ledger from a payment event (D-146).

**Rail selection** is procurement's job, not this document's. Capability flags on each adapter (card, ACH, invoice-pay, recurring, installments, tax, disputes, settlement report) let routing and the console say what a rail can do without naming it.

## 5. Ledger design (Semester's own billing)

Two ledgers exist, and they must never be mixed. [`ORDERING-AND-BILLING-OPERATIONS.md`](../commercial/ORDERING-AND-BILLING-OPERATIONS.md) already says the institutional student-account functionality "must not be used as [Semester's] accounting ledger".

| | Semester billing ledger (new) | School student-account ledger (exists) |
| --- | --- | --- |
| Whose books | Semester's own customer billing | The school's, kept by Semester software (D-146) |
| Form | Double entry: journals of lines, debits equal credits | Single entry, signed amount per student |
| Scope | `billing_scope = 'semester'` | `tenant_id` |
| Money | Semester's revenue and receivables from its customers | The school's receivables; no money moves |
| Source events | Invoice issued, payment captured, refund, dispute, fee, write-off | Charge, payment, refund, adjustment, aid, reversal, chargeback entered by people |

**Operational sub-ledger, not the statutory books.** The billing ledger is Semester's operational record of what billing did. The general ledger and financial statements stay with the accountant's system; this ledger feeds it by accounting export (journal export mapped to the accountant's chart). Revenue recognition treatment is a **[REQUIRES QUALIFIED REVIEW]** decision (see [`REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md)); the ledger records the facts (billed, collected, entitled, delivered) and does not conclude recognition. That is "separate product billing state from statutory accounting records" made structural.

### Tables (PROPOSED; additive migration with its own `*.check.sql`)

| Table | Purpose and rules |
| --- | --- |
| `ledger_accounts` | Chart of accounts: code, name, type (asset, liability, revenue, expense, contra), normal side, `active`. Seeded by the accountant's chart **[REQUIRES QUALIFIED REVIEW]**; the migration ships a placeholder set marked unreviewed. |
| `ledger_periods` | Month, status `open`, `closing`, `closed`; closing needs a passing reconciliation by a second person (mirrors `student_account_close_guard`). |
| `ledger_journals` | One per business event. `journal_kind`, `source_kind`, `source_id`, `idempotency_key` **unique**, `effective_on`, `currency`, `period`, `reversal_of` (nullable, unique where set), `approval_id`, `provider_event_ref`, `recorded_by`. |
| `ledger_lines` | `journal_id`, `account_id`, `side` (debit/credit), `amount_cents > 0`, optional `billing_account_id`, `invoice_id`, `tenant_id`, `memo` (no card-number pattern, same check as the school ledger). |

**Invariants, each with a proof obligation:**

1. A journal's debits equal its credits in one currency, enforced by a deferred constraint trigger; an unbalanced journal cannot commit.
2. Journals and lines are append-only for every role including the owner (same trigger family as `student_account_append_only`). A correction is a **reversal journal** (all lines flipped, `reversal_of` set, at most one per journal, a reversal is not reversed) plus a new journal. Nothing is edited.
3. No journal posts into a closed period; a correction in a closed month posts in the open month with a `corrects_period` reference.
4. `idempotency_key` is derived from the source (`pay:<attempt_id>:captured`, `refund:<refund_id>:succeeded`), so replaying a webhook or re-running a job posts nothing twice.
5. One currency per journal; one billing account never mixes currencies (REVENUE-OPERATIONS invariant 2, not enforced today).
6. The ledger is added to `ledger_chain` as `semester_billing`, so a rewrite is noticed by the existing nightly verifier. Stated limit, as for the others: a database owner holding the key could re-sign; no external anchor.
7. Writers: `service_role` through posting functions only. No API role inserts. `finance_operator` reads.

### Posting rules (conceptual; the accountant owns the real chart)

| Event | Debit | Credit |
| --- | --- | --- |
| Invoice issued | Accounts receivable | Deferred revenue; Tax payable |
| Payment captured at the rail | Processor receivable (funds the rail owes Semester) | Accounts receivable |
| Processor fee (from settlement) | Payment processing expense | Processor receivable |
| Settlement payout received | Cash (bank) | Processor receivable |
| Service delivered or period elapsed | Deferred revenue | Revenue — **treatment per accountant** |
| Credit memo | Revenue or deferred revenue | Accounts receivable |
| Refund succeeded | Accounts receivable or revenue | Processor receivable |
| Chargeback opened | Disputed receivable | Processor receivable |
| Chargeback lost / won | Bad debt or revenue / Processor receivable | Disputed receivable / Disputed receivable |
| Write-off | Bad debt expense (or allowance) | Accounts receivable |

`Processor receivable` is the key to the boundary: it is money the rail holds and owes Semester as revenue, not customer funds Semester holds. It clears when the settlement line arrives; unmatched balances are reconciliation exceptions ([`RECONCILIATION_AND_SETTLEMENT.md`](RECONCILIATION_AND_SETTLEMENT.md)).

**Rollout in shadow.** The first release posts journals beside the existing flow and changes no behaviour (`apply_payment_event` stays authoritative); a nightly job compares the ledger to `invoices` and `payment_events` and reports drift. Only after drift is zero for a stated period does anything read the ledger for a decision.

## 10. Payment maturity roadmap

Extends the five stages in the brief; each stage lists its entry gate. Stages 3–5 are in [`EMBEDDED_FINANCE_ROADMAP.md`](EMBEDDED_FINANCE_ROADMAP.md).

| Stage | Semester owns | Rail handles | Entry gate (all FACT-checkable) |
| --- | --- | --- | --- |
| 0 — Today | Catalog, ledger for schools, entitlements mirror | Stripe Billing owns the subscription and invoice lifecycle; Semester mirrors it | — |
| 1 — Native layer on one rail | Adapter interface, inbox, billing ledger (shadow), approvals, refund and dispute workflow, reconciliation, console, native notices, institutional invoicing by bank transfer | Stripe through the adapter: card capture, tax, settlement | Gates FRG-01 to FRG-12 |
| 2 — Multi-rail | Routing, Semester-scheduled renewals charging stored tokens, ACH rail, Semester-generated invoices, native checkout with provider-hosted fields, AI overage billing | Two or more rails | FRG-13 to FRG-18; a second adapter passes the same contract suite |
| 3 — Embedded finance | Credits, campus-commerce interface, onboarding workflows | A licensed partner holds funds | New owner decision superseding D-146/D-1236 + counsel |
| 4 — Payments platform | Risk, routing, treasury controls | Banks and networks | Counsel, capital, and a business case |
| 5 — Regulated entity | Processing and network participation | Direct relationships | Separate company decision |

**Stop signs, any stage:** an adapter that stores a card number; a ledger journal that bypasses a posting function; a refund that skips approval; a webhook handled before its signature is verified; a rail credential reachable from a `VITE_` variable.

## 11. Backlog

P0 blocks any real money beyond the owner's own account. P1 makes operating it possible. P2 is revenue and efficiency. P3 is optionality. IDs are planning references, not tracker IDs.

| ID | Item | Why now |
| --- | --- | --- |
| P0-1 | Owner decision for the adapter and ledger scope; engage counsel, accountant, payments adviser | Gates everything; no one is retained (D-1154) |
| P0-2 | Adapter interface, Stripe adapter, event normalizer, contract tests | Removes direct Stripe coupling without changing behaviour |
| P0-3 | Verified-event inbox, park-not-500 for early events, dead-letter, replay | Today a failed event is unrecoverable |
| P0-4 | Billing ledger in shadow, drift report | No double-entry record exists |
| P0-5 | Approval policy tables, fail-closed when no active policy | Refunds, credits, write-offs have no control |
| P0-6 | Refund workflow end to end (and make `charge.refunded` post) | Refund is unexercised and has no effect today |
| P0-7 | Dispute case workflow with evidence deadlines | Dispute is unexercised and has no effect today |
| P0-8 | Settlement ingestion and reconciliation with period close | Cash is unverified |
| P0-9 | Close the five live-acceptance gaps | Annual, refund, failed renewal, dispute, registered-jurisdiction tax |
| P1-1 | Read-only Finance Operations console | `finance_operator` has no screen |
| P1-2 | Invoice immutability, lines, allocations, balance | Invoices are mutable and lineless |
| P1-3 | Native finance notices (receipt, failed payment, final notice, refund) | Notices are Stripe's |
| P1-4 | `payment_attempts` and `payment_methods` (token only, no-card guard) | Needed before Semester schedules charges |
| P1-5 | Billing contacts, tax profiles and exemptions, purchase orders | Institutional invoicing prerequisites |
| P1-6 | Statement and accounting export | The accountant needs it |
| P2-1 | Price book, quote lines with list/net/discount, quote approvals | Discounts are uncomputable today |
| P2-2 | Invoice schedules and Semester-generated institutional invoices | Institutional billing is manual |
| P2-3 | Subscription items and quantity | One plan per subscription today |
| P2-4 | Usage meters, AI usage shadow metering | Precondition for any overage |
| P2-5 | Customer profitability and cash runway views, labelled forecasts | Uses the existing model |
| P2-6 | Native embedded card fields, Semester-scheduled renewals | Removes redirect to the rail's page |
| P3-1 | Second rail (ACH or bank-transfer) behind the same contract suite | Cost and resilience |
| P3-2 | Credits and wallet design, marketplace payouts | Each needs the stage-3 decision |
| P3-3 | Accounting system integration beyond export | After the accountant is chosen |

## 12. Required professional review

None of these is a formality; each is a place the design assumes an answer it cannot give. Q- and E- numbers refer to [`06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`](06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md) and [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md). Counsel is not retained and no qualified accountant is engaged (D-1154), so every row below is open.

| Question | Professional | Blocks |
| --- | --- | --- |
| Does the adapter model keep Semester outside money transmission, including processor connected accounts and the school student-account flow (Q-26, E1, E3)? | Payments / financial-regulatory counsel | Any stage-2+ routing, payouts, wallet |
| Which PCI path applies when card fields are embedded in Semester's page instead of redirecting to the rail's page (Q-27, E2)? Which SAQ type, and who attests? | Qualified security assessor or acquirer guidance | Native embedded checkout (FRG-14) |
| Chart of accounts; whether `Processor receivable` is the right shape; revenue recognition for monthly, annual, pilot and usage; deferred revenue; fee treatment | Qualified accountant | Ledger leaving shadow; exports |
| Invoice numbering gaps (Postgres sequences skip on rollback), credit-memo numbering, retention of financial records beyond seven years where a contract or tax rule requires more (D-132) | Accountant + tax adviser | Invoice generation by Semester |
| Sales tax and VAT: registrations, nexus, exemption-certificate handling, tax on SaaS and on usage, who calculates | Tax adviser | Tax exemption workflow; any new jurisdiction |
| Auto-renewal, cancellation, refund and installment disclosure rules by consumer jurisdiction; whether "no refund window" (D-1019) is lawful where offered (Q-24, Q-07) | Consumer-protection counsel | Native checkout copy, refund policy |
| Student data in billing: FERPA, minors (D-139–141), whether payment data is education records, and what can be shared with a school (Q-25) | Privacy counsel | Student checkout; school-visible plan status |
| Stored value, prepaid access, credits and refunds of credits | Financial-regulatory counsel | Wallet or credits (stage 3) |
| Installment plans offered by Semester itself as consumer credit | Consumer-credit counsel | Semester-run plans (see [`PAYMENT_PLAN_ENGINE.md`](PAYMENT_PLAN_ENGINE.md)) |
| Unclaimed balances and escheat on credit balances | Accountant + counsel | Credit balances that persist |
| Authority matrix adoption; signer authority; who is the second approver where one person holds every seat (R-018, D-1154 names Bramm Rubin) | Counsel + board | Approval policy activation |
| Insurance for payment errors, cyber and crime | Broker | First live volume |

## 13. Execution plans

Both plans are PROPOSED effort orderings, not commitments or forecasts. Every build step is shadow or sandbox until its gate in [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md). **No step in either plan lifts the checkout hold.**

### 90 days

| Weeks | Outcome | Evidence of done |
| --- | --- | --- |
| 1–2 | Owner decision recorded; counsel, accountant and payments adviser engaged or an explicit "not yet" recorded with the blocker; adapter types and contract suite written | `docs/decisions/D-<PR>.md`; red-then-green contract tests |
| 3–4 | Stripe adapter and normalizer; billing-webhook reads through them with identical behaviour | Existing 57 billing tests unchanged and green; revert test goes red |
| 5–6 | Event inbox, parked events, dead-letter, replay | SQL check suite; chaos case for event-before-subscription |
| 7–8 | Billing ledger in shadow; chain extension; drift report | Balanced-journal property test; zero drift on test data |
| 9–10 | Approval policy tables and the refund workflow in test mode; disputes table | Maker-checker and fail-closed proofs; test-mode refund round trip |
| 11 | Settlement ingestion and reconciliation run against test-mode reports | Reconciliation fixtures including every exception type |
| 12 | Read-only Finance console; live-acceptance gap plan scheduled with the owner | Screenshots; role-gated access check |
| 13 | Review gate: FRG-01 to FRG-12 scored with evidence | Scorecard committed; unmet gates named |

### 12 months (quarters)

| Quarter | Outcome |
| --- | --- |
| 1 | The 90-day plan. Hold unchanged. |
| 2 | Live-acceptance gaps closed with the owner's own account (annual, refund, failed renewal, dispute, tax); refund and dispute workflow on in the console; native notices; billing contacts, tax profiles, purchase orders; institutional invoices by bank transfer with manual cash application and reconciliation. Individual acquisition decision is the owner's, on the evidence. |
| 3 | Price book and quote approvals; invoice schedules; subscription items; usage meters and AI usage in shadow; accounting export. Native embedded card fields only if the PCI path is answered (FRG-14). |
| 4 | Second adapter (ACH or bank transfer) passes the contract suite; Semester-scheduled renewals on stored tokens; AI overage opt-in if shadow data supports it; stage-3 decision brief prepared for the owner and counsel (no build). |

## 14. First 25 implementation actions

Each is small enough for one pull request. "Proof" is what must exist before merge, in the repository's own standard: a guard is shown red against a revert of the thing it guards. Gates are the CLAUDE.md gates run from `app/` (`npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`), plus `design-system:check` for UI.

| # | Action | Where | Proof |
| --- | --- | --- | --- |
| 1 | Open the pull request, then write the owner decision: adapter layer and two-ledger boundary, D-146/D-1236 unchanged | `docs/decisions/D-<PR>.md` | Decision-log test; owner decides, not this session |
| 2 | Write the canonical types: `PaymentRail`, `PaymentProviderAdapter`, command and result types, `NormalizedPaymentEvent`, error taxonomy. Deno-free, no I/O | `supabase/functions/_shared/payments/types.ts` | `tsc -b`; `check:university` stays green (nothing imports it from the gateway) |
| 3 | Adapter contract test suite parameterized over any adapter, plus a deterministic `MockAdapter` | `app/src/lib/payments/contract.test.ts`, `_shared/payments/mock.ts` | Mock passes; a deliberately broken mock fails each clause |
| 4 | Move Stripe specifics (signature verify, status map, form encoding, host and prefix checks) behind `StripeAdapter` without changing them | `_shared/payments/stripe.ts` wrapping `_shared/stripe.ts` | All 57 billing tests green unchanged |
| 5 | `normalizeStripeEvent` to `NormalizedPaymentEvent` with golden fixtures taken from `webhook.test.ts` | `_shared/payments/normalize.ts` | Fixture round trip; unknown event type becomes `other`, never throws |
| 6 | Migration: `payment_rails` (provider, mode, status, capability flags jsonb, no credentials) | `supabase/migrations/…_payment_rails.sql` + `payment-rails.check.sql` | RLS, grants, no secret column; check suite |
| 7 | Migration: `provider_event_inbox` (provider, event id unique, received, verified-at, minimized payload projection, status, attempts, last error code) | migration + `.check.sql` | Allowlist projection test: no email, name or address stored |
| 8 | Refactor `billing-webhook` to adapter, then inbox, then apply; park an event that arrives before its subscription (retry window) instead of answering 500 forever; dead-letter after N | `billing-webhook/index.ts`, `_shared/billingwebhook.ts` | Existing webhook tests green; new tests for park and dead-letter; revert shows red |
| 9 | Replay tool (service-role function) that re-applies an inbox row | `_shared/billingreplay.ts` | Replay of an applied event is a no-op (`duplicate`) |
| 10 | Migration: `ledger_accounts`, `ledger_periods`, `ledger_journals`, `ledger_lines`, balance trigger, append-only, reversal rules | migration + `billing-ledger.check.sql` | Unbalanced, edited, deleted, double-reversed and closed-period cases each refused |
| 11 | Extend `ledger_chain` with `semester_billing`; verifier and seal cover it | `ledger_chains` follow-up migration + `ledger-chains.check.sql` | Each tamper kind caught for the new ledger |
| 12 | Posting functions and rule table (pure TS mirror for property tests): invoice issued, payment captured, fee, payout, credit, refund, chargeback, write-off | `_shared/payments/posting.ts`, SQL `post_billing_journal` | Property test: for random event sequences every journal balances and replay posts nothing |
| 13 | Shadow-post from `apply_payment_event` behind a setting; nightly drift report between ledger, `invoices`, `payment_events` | `scheduler.sql` job + SQL function | Drift zero on fixtures; planted drift reported |
| 14 | Migration: `finance_authority_policies` and `finance_approvals` (maker-checker; requester cannot decide; approval expires; **no active policy means every request blocks**) | migration + `finance-approvals.check.sql` | Fail-closed proof; self-approval refused; expired approval refused |
| 15 | Extend `credits_refunds` (approval id, provider ref, payment attempt, idempotency key, extended status) and add `request_refund` and `submit_refund`; refund goes through `adapter.refund` with a deterministic idempotency key | migration, `_shared/billingrefund.ts` | Test-mode round trip; resubmit is idempotent; refund above amount paid refused; no approval means no submit |
| 16 | Make `charge.refunded` post the refund journal and update invoice balance | `billingwebhook.ts`, posting rules | Refund event now changes state; replay is a no-op |
| 17 | Migration: `disputes` and `dispute_evidence_items`; handle created, updated, closed; evidence-due worker | migration, webhook, `scheduler.sql` | Deadline reminder fires once; outcome posts the right journal |
| 18 | Migration: `payment_attempts` + transitions (state machine, idempotency key unique) and `payment_methods` (token and display-safe fields only, no-card check) | migration + `.check.sql` | Illegal transitions refused; 13–19 digit runs refused |
| 19 | Migration: `settlement_batches`, `settlement_lines`; `adapter.getSettlement` for Stripe test mode | migration, adapter | Fixture report ingested; fees and net recomputed and agree |
| 20 | Reconciliation engine (pure function) and `reconciliation_runs`/`items`/`exceptions`; daily job; close guard | `app/src/lib/finance/reconcile.ts`, SQL | One fixture per exception type; planted mismatch blocks close |
| 21 | Invoice immutability after issue; populate `invoice_lines` from the provider invoice; `amount_paid_cents`, `balance_cents`, `payment_allocations` | migration | Edit after issue refused; allocations sum to payment |
| 22 | `finance_notices` outbox and receipt, failed-payment, final-notice, refund templates (versioned, idempotent) | migration, `_shared/financenotices.ts` | One notice per event; replay sends nothing |
| 23 | Read-only Finance Operations console tab: invoices, payments, inbox, disputes, reconciliation; role-gated | `app/src/screens/Console.tsx` + `components/console/finance/` | `design-system:check`; screenshot per the `run` skill; `finance_operator` allowed, others not |
| 24 | Billing contacts, addresses, tax profiles, tax exemptions, purchase orders migration | migration + `.check.sql` | Exemption needs evidence and verifier ≠ requester; PO balance never negative |
| 25 | Write the live-acceptance gap test plan (annual, refund, failed renewal, dispute, registered-jurisdiction tax) and hand it to the owner to run | `docs/evidence/` plan | The owner runs it; evidence recorded, not asserted |

## Decisions requested (the owner's, not this session's)

1. Adopt the two-ledger boundary and the adapter layer as the direction (proposed decision D-<PR>, to be written after the PR is opened).
2. Name who is retained as counsel, qualified accountant, tax adviser and payments adviser, or record "not yet" and which gates therefore stay closed.
3. Adopt, change or reject the proposed approval thresholds in [`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) for the product-billing approval policy. Until adopted the system blocks every request.
4. State the price conflict's resolution (D-134 vs D-1154 vs program targets). This design carries no price.

## Evidence state

- **Repository evidence:** the audit above, read from migrations `20260929070000` through `20261004150000`, the four billing functions, `_shared/`, `app/src/lib/billing`, `app/src/lib/finance`, and the docs cited.
- **Operational evidence:** one live monthly Plus charge on 2026-10-03 ([record](../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md)). Nothing else.
- **Missing proof:** every new table, function, screen and test named here. No part of this design has been built, run or reviewed by a professional.

## Cannot be completed from source code

Counsel, accountant, tax adviser and payments adviser answers; PCI scope determination; the chart of accounts; processor contracts and the rail's actual capabilities and fees; authority-matrix adoption; any price.
