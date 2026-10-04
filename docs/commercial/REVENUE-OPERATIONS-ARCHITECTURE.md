# Revenue and Finance Operations Architecture

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, APPROVED OR LIVE** |
| Owner | Harrison Rubin — company-side revenue-operations owner; finance operator, deal desk, accountant, tax reviewer, counsel and backup for every role below unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Repository basis | `supabase/migrations/20260929070000_commercial_core.sql`, `20260929080000_commercial_automation.sql`, `20260928004730_tenant_plan.sql`, `20260927235000_governance_registries.sql`, `20260928090000_gtm_foundation.sql`, `20260930110000_ledger_chains.sql`, `app/src/lib/gtm/stages.ts`, `supabase/functions/_shared/entitlement.ts` |
| Extends | [`CRM-DATA-MODEL`](CRM-DATA-MODEL.md), [`SALES-PIPELINE-DEFINITIONS`](SALES-PIPELINE-DEFINITIONS.md), [`ORDERING-AND-BILLING-OPERATIONS`](ORDERING-AND-BILLING-OPERATIONS.md), [`PRICING-AND-PACKAGING`](PRICING-AND-PACKAGING.md), [`REVENUE-OPERATIONS-DASHBOARD-SPEC`](REVENUE-OPERATIONS-DASHBOARD-SPEC.md), [`REVENUE-RECOGNITION-REVIEW-CHECKLIST`](REVENUE-RECOGNITION-REVIEW-CHECKLIST.md), [`RENEWAL-AND-EXPANSION-PLAYBOOK`](RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`ANALYTICS-AND-METRICS-DICTIONARY`](ANALYTICS-AND-METRICS-DICTIONARY.md), [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md), [`../ENTITLEMENT-RESOLUTION.md`](../ENTITLEMENT-RESOLUTION.md), [`../company/FINANCIAL-CONTROLS.md`](../company/FINANCIAL-CONTROLS.md), [`../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md`](../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md) |

> This is an operating design for qualified finance, accounting, tax and legal review. It is not accounting, tax or legal advice. Every price, discount, approval threshold, SLA and probability below is a placeholder or a labeled proposal. None is approved.

## What this adds

The repository already holds a controlled commercial core and eight short commercial documents. This document does not restate them. It joins them into one model, checks that model against the actual tables, and names what is missing. Each of the ten requested deliverables maps as follows.

| # | Requested | Section | Already on main | What this adds |
| ---: | --- | --- | --- | --- |
| 1 | Canonical data model | [2](#2-canonical-data-model) | `billing_accounts`, `quotes`, `contracts`, `subscriptions`, `invoices`, `tenant_plan`, `gtm_*` | one entity map, invariants, and the verified gaps (findings 3–8) |
| 2 | Lifecycle and handoffs | [4](#4-lifecycle-and-handoff-rules) | 16 GTM stages, `implementation_projects`, `account_health_snapshots` | handoff contracts with entry evidence and blocked actions |
| 3 | CRM and product-data integration | [5](#5-crm-and-product-data-integration) | lead intake, Stripe webhook, health job | integration contract table; a billing meter that does not yet exist |
| 4 | Quote-to-cash | [6](#6-quote-to-cash) | order-to-cash sequence, dunning, renewal stages | approval matrix, institutional collections, credit/refund/write-off paths |
| 5 | Forecasting | [7](#7-forecasting-and-dashboards) | pipeline and dashboard definitions | method, snapshots, accuracy tracking |
| 6 | Data quality, audit, access | [8](#8-data-quality-deduplication-audit-and-access) | RLS "who reads what", `ledger_chains` pattern | rule catalog, merge procedure, audit extension |
| 7 | Leakage and exceptions | [9](#9-revenue-leakage-and-pricing-exceptions) | discount authority prose | leak taxonomy with detection and prevention |
| 8 | Customer hierarchy | [3](#3-customer-hierarchy-model) | `governance_policy_nodes`, `billing_account_tenants` | party, role and rollup model |
| 9 | KPIs and cadence | [10](#10-kpi-definitions-and-reporting-cadence) | metric dictionary | financial KPI definitions and cadence |
| 10 | Review points | [11](#11-required-financelegalaccounting-review-points) | revrec checklist, deviation matrix | one gate table |

## What the repository does and does not do today

Read from the migrations and functions, not inferred from the documents. Nothing was executed: this session had no database.

1. **Built and tested for individuals:** checkout, signed idempotent webhook, dunning with a 14-day grace, cancellation, seven-year financial retention. Nothing charges anyone until the owner sets the Stripe secrets, and a code-level hold keeps new checkout closed ([`ops/billing/README.md`](../../ops/billing/README.md)).
2. **Built for institutions, but only the front half:** quote, contract, and a trigger that turns a signed order form into a `tenant_plan`, an `implementation_projects` row per tenant and a `renewal_opportunities` row. There is no institutional collections workflow: `dunning_cases` hangs off `subscriptions`, and an institution's invoice has none.
3. **There is no sales opportunity table.** `renewal_opportunities` is the only table with that word. Opportunities exist as `gtm_accounts.status` plus the stage vocabulary in `app/src/lib/gtm/stages.ts`.
4. **Money fields are thin.** `contracts` carries no value. `quote_lines` stores one `unit_amount_cents`, so a list price and a discount cannot both be recorded. `invoices` has no amount-paid or balance, and `status` has no partially-paid state.
5. **The financial tables are mutable and outside the tamper-evidence chain.** I found no history or immutability trigger on `quotes`, `quote_lines`, `contracts`, `invoices` or `credits_refunds`. The hash chain, its HMAC-signed daily manifests and its nightly verifier exist (`20260930110000_ledger_chains.sql`, `20260930150000_ledger_chain_seals.sql`), but they accept only two ledgers, `academic_record` and `student_account`.
6. **A later order form can overwrite an earlier plan.** `tenant_plan` is one row per school (`tenant_id` primary key), and `apply_signed_contract` upserts it from the contract just signed with no comparison to the current row. A department pilot ending in December signed after a campus agreement ending the next June would replace the campus tier and end date. The change lands in `tenant_plan_history`, so it is recoverable, but nothing prevents it and no check covers overlapping order forms. Read from the code, not reproduced.
7. **A signed order form writes `tenant_plan.status = 'active'`** (never `trial`), dated from `effective_at`. [`ORDERING-AND-BILLING-OPERATIONS`](ORDERING-AND-BILLING-OPERATIONS.md) says signature is separate from launch GO. Today the separation rests on `starts_at` and the module step, and the entitlement order runs in shadow and enforces nothing; a school with no plan row passes ([`ENTITLEMENT-RESOLUTION`](../ENTITLEMENT-RESOLUTION.md)).
8. **Two documents disagree about the individual price.** [`COMMERCIAL-CORE`](../COMMERCIAL-CORE.md) and `ops/billing` print $7.99/month and $59/year as catalog prices; [`PRICING-AND-PACKAGING`](PRICING-AND-PACKAGING.md) says no price is approved and a price in code is not the price book. This document uses no number and treats price approval as open.

## 1. Systems of record

The rule: **one system owns each object, and everything else holds a derived, labeled copy.** A spreadsheet is never a system of record. A spreadsheet export is permitted only as a read-only, dated, source-labeled extract that cannot be edited back in.

| Object | System of record | Status |
| --- | --- | --- |
| prospect, stakeholder, stage, decision log | `gtm_*` tables (Supabase) | exists; an external CRM is an **open decision** — pick one system, never both |
| price book, quote, order form, amendment | commercial core (Supabase) | exists, with gaps in §2 |
| entitlement, tenant plan | `tenant_plan`, `subscription_entitlements` | exists |
| payment, refund, dispute facts | Stripe (processor), mirrored by `payment_events` | exists; production unconfigured |
| invoice (institutional) | commercial core `invoices` | exists; delivery and AR gaps in §6 |
| general ledger, AR subledger, revenue schedule, tax filings | **accounting system — not selected** | `[ACCOUNTING SYSTEM TO BE SELECTED BY OWNER AND ACCOUNTANT]` |
| product usage for billing | billing meter | **absent**, §5 |
| audit trail | append-only history plus chained ledger | partial, §8 |

Two accounting-facing rules follow. Semester's own customer billing is separate from the institutional student-account ledger (`student_account_*`), which is the school's data and never Semester's books. And product subscriptions, entitlements and engagement are never a source for ARR, bookings or revenue ([`ANALYTICS-AND-METRICS-DICTIONARY`](ANALYTICS-AND-METRICS-DICTIONARY.md)).

## 2. Canonical data model

```text
                    party (legal entity) ──parent_of──► party
                     │  ▲
        party_role   │  │ bill_to / payer / buyer / signer / sponsor
                     ▼  │
 gtm_account ──1:n──► billing_account ──m:n──► tenant (school) ──► policy node (system/campus/school/program/course)
      │                    │
 stakeholder          ┌────┼────────────┬───────────────┐
 opportunity*         ▼    ▼            ▼               ▼
                   quote  contract   subscription    invoice ──► payment_event
                     │      │ ▲ parent    │              │
                  quote_line│ └ (MSA→order)│          invoice_line, credit_memo*
                            ▼             ▼
                   renewal_opportunity  subscription_item* ──► entitlement ──► tenant_plan
                                          │
                                          └──► meter_reading* (billable usage)
                    * = absent today
```

### Entities

| Entity | Table today | Key fields (existing in plain, proposed in *italics*) | State |
| --- | --- | --- | --- |
| Party | none | *legal name, jurisdiction, tax ID reference, external institution ID, parent party, status* | **absent** |
| Account | `gtm_accounts`, `billing_accounts` | stable ID, `public_id`, segment, status, `tenant_id`; billing: `kind`, `currency`, `gtm_account_id` (non-unique) | partial |
| Contact | `gtm_stakeholders` | account, role, authority, consent basis | exists; *billing and signing roles absent* |
| Opportunity | stage vocabulary in code only | *account, scope, stage, stage-entered time, amount, currency, evidence state, close date* | **absent as a table** |
| Quote | `quotes`, `quote_lines` | version, status, currency, scope, exclusions, `valid_until` | exists; *list price, discount, approval absent* |
| Contract | `contracts` | `kind` msa/order_form/dpa/sla/amendment, status, `effective_at`, `ends_at`, `renewal_notice_days`, `auto_renews`, `document_ref` | exists; *value, parent contract absent* |
| Subscription | `subscriptions` | one `plan_code`, period, status, consent, `contract_id` | exists; *no quantity, no multi-line* |
| Entitlement | `plan_entitlements`, `subscription_entitlements`, `tenant_plan` | key, value, source plan/contract/grant | exists |
| Usage | `usage` (per-user AI call cap) | user, month, calls, tokens | exists for **cost control only**; not a billing meter |
| Invoice | `invoices`, `invoice_lines` | `SEM-` number, status, subtotal, tax, PO, due/paid dates | exists; *balance, payment allocation absent* |
| Payment | `payment_events` | provider, event ID (unique), kind, amount, payload hash | exists |
| Credit / refund | `credits_refunds` | kind, amount, reason, status | exists; *approver, provider ref, original-payment link absent* |
| Renewal | `renewal_opportunities` | contract, `renewal_date`, stage 120/90/60/30, outcome | exists; *no amount* |
| Health | `account_health_snapshots` | status, reason, next action, account-level signals | exists |

### Invariants (some enforced today, the rest are the design)

1. A signed order form has a quote, an effective date, an end date for any pilot, and an immutable document reference. *(quote linkage proposed, not enforced: `contracts.quote_id` is nullable and the signing trigger does not require it; end date enforced; immutability not)*
2. Money is integer minor units with an explicit currency, and one billing account never mixes currencies. *(integer cents enforced; one-currency rule not seen)*
3. A quote line stores list price, net price and discount reason separately, so the discount is computable. *(proposed)*
4. Sent and signed commercial records are append-only; a change is a new version linked to the one it supersedes. *(`version` exists; supersession link and immutability proposed)*
5. A contract has at most one active order form per tenant per product unless an amendment links them, and a later order never silently lowers an existing plan. *(violated today, finding 6)*
6. Booked, billed, collected, entitled, delivered and recognized are six separate states. None implies another.
7. A subscription records contracted quantity, so contracted, entitled and used can be compared. *(proposed)*
8. Every state change on a financial record writes one history row with actor, time, reason and prior values. *(proposed beyond `tenant_plan_history`)*

### Proposed additions (design only, not a migration)

Any migration needs its own `*.check.sql` proof, RLS and grants review, and finance sign-off first ([`CLAUDE.md`](../../CLAUDE.md) gates apply).

| Addition | Purpose | Minimum shape |
| --- | --- | --- |
| `customer_parties`, `party_relationships`, `account_party_roles` | hierarchy and payer/buyer split, §3 | party, parent, relationship kind, role, valid-from/to |
| `opportunities` | forecast and stage history on a table, not a code vocabulary | account, stage, `stage_entered_at`, amount, currency, evidence state; history table |
| `quote_lines`: `list_unit_amount_cents`, `discount_reason_code`, `price_book_version` | computable discounts | discount = list − net, never typed |
| `quote_approvals` | deal-desk record | quote, level required, approver, decision, expiry, reason; approver ≠ requester enforced |
| `contracts`: `parent_contract_id`, `total_value_cents`, `arr_cents` | MSA→order lineage, value | value derived from lines at signature and frozen |
| `subscription_items` | quantity and multiple lines | subscription, plan, quantity, unit price, start/end |
| `invoices`: `amount_paid_cents`, `balance_cents`; `payment_allocations` | partial payment and application | allocation links payment to invoice lines |
| `credit_memos` and `credits_refunds` approver and provider-ref columns | traceable credits | approver, approval level, provider refund ID, original payment |
| `meter_definitions`, `meter_readings` | billable usage, §5 | definition version, tenant, period, quantity, source, idempotency key |
| `forecast_snapshots` | forecast accuracy | weekly frozen forecast rows |
| history rows and chain entries for the commercial tables | tamper evidence | widen the existing ledger chain (§8) |

## 3. Customer hierarchy model

Institutions are not flat. A system office signs, a campus orders, a department pays, a foundation sponsors, and a student or guardian pays for something else entirely. The model keeps **legal identity, billing responsibility, product scope and policy** as four separate axes, so a change in one does not rewrite the others.

| Axis | What it answers | Existing anchor |
| --- | --- | --- |
| Party (legal) | who exists in law and signs | none: `customer_parties` |
| Account (commercial) | who we sell to and bill | `gtm_accounts`, `billing_accounts` |
| Tenant (product scope) | which school instance is entitled | `schools`, `billing_account_tenants`, `tenant_plan` |
| Policy node (governance) | what features, AI and retention apply | `governance_policy_nodes`: system → campus → school → program → course |

### Roles on an account

Each role is dated, one party can hold several, and a role is a row, not a column.

| Role | Meaning | Constraint |
| --- | --- | --- |
| buyer | owns the budget decision | named on the opportunity |
| signer | has authority to bind the party | authority evidence stored by reference; checked at signature |
| bill-to / payer | receives and pays the invoice | may differ from the buyer; carries PO, tax-exemption reference, AP-portal route |
| sponsor | funds a population or pilot | scope and cap recorded; students are never billed for a sponsored service without separate lawful basis |
| user organization | the campus or department that uses it | maps to a tenant or policy node |
| subsidiary / affiliate | related legal entity | parent link; never inherits a contract without an amendment |

### Rules

1. **Contract hierarchy:** an MSA, DPA or SLA sits at the highest signing party. Order forms hang off it through `parent_contract_id`, and amendments off the order form. Terms flow down; commercial scope does not flow up or sideways.
2. **Billing rollup:** a billing account may have a parent billing account for consolidated statements. Each invoice still names one bill-to, and consolidation is a view, not a merged ledger.
3. **Entitlement inheritance narrows only**, matching policy nodes. A system-level purchase may fund several campuses, a campus limit cannot be exceeded by a child, and a child cannot grant itself more than its parent bought.
4. **Overlapping funding:** when two contracts fund one tenant, entitlements resolve by explicit rule, not "last signed wins" (finding 6). Proposed: the later contract is an amendment, or it is refused until the earlier plan's scope is stated.
5. **Segmentation of money flows:** institution pays Semester (this model); the institution bills its students on its own ledger (`student_account_*`, not ours); a guardian or family payer is governed by the consent model, not by an institutional contract; the individual subscription is a separate `kind = 'individual'` account.
6. **Mergers, renames, affiliations:** a party relationship ends with a date rather than being edited. Open contracts are re-papered by amendment. History is preserved.
7. **Hierarchy changes are approval events** because they change who may read financial data. Access follows the account's tenants (`can_read_billing`), so a rollup never widens access by itself.

### Scenarios the model must handle

| Scenario | Handling |
| --- | --- |
| System signs one MSA, three campuses order separately | one MSA party, three order forms, three bill-tos, three tenant plans |
| One campus buys, a foundation pays | buyer = campus, payer = foundation; invoice to payer; contract names the payer's obligation |
| Department-funded pilot inside a campus that is also a customer | pilot is its own order form; tenant plan conflict resolved by rule 4 |
| Consortium or cooperative contract | cooperative party holds the master; members order under it with their own bill-to |
| Reseller or channel | **not designed**: needs counsel, tax and revenue review before any channel is offered |
| Subsidiary of a customer wants the terms | amendment naming the new party; no automatic inheritance |
| Student or guardian pays | individual account or consented family relationship; never an institutional invoice |

## 4. Lifecycle and handoff rules

States reuse the repository vocabulary; none is invented. A **handoff** is an event with required artifacts, a named receiving role and a blocked action until accepted.

| Stage group | GTM stages (`stages.ts`) | `gtm_accounts.status` |
| --- | --- | --- |
| Attract | `target_account` | target |
| Qualify | `discovery`, `qualified` | engaged |
| Evaluate | `multi_stakeholder_demo` … `security_privacy_accessibility_review` | engaged |
| Propose | `proposal`, `pilot_or_implementation_SOW`, `procurement_legal` | engaged |
| Commit | `contracted` | pilot / customer |
| Deliver | `implementation`, `live` | pilot / customer |
| Retain | `renewal`, `expansion` | customer |
| Exit | `closed_lost` | closed_lost |

| Handoff | Trigger | Required artifacts | Receiving role | Blocked until accepted |
| --- | --- | --- | --- | --- |
| Marketing → Sales | institutional route in `site_leads` becomes a `gtm_accounts` row | route, organization, role, consent basis, suppression check | seller | outreach beyond the consented basis |
| Sales → Deal desk | `proposal` | scope, price status, discount request with reason, term, exclusions | deal desk | sending the quote |
| Deal desk → Legal | exception in terms | deviation record per the [approval matrix](../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md) | counsel | signature |
| Sales → Finance | `contracted` (signed order form) | executed order, parties, bill-to, PO, tax treatment, payment terms | finance | first invoice |
| Sales → Implementation | `contracted` → `implementation` | accepted handoff, scope, tenants, owners, launch prerequisites | implementation lead | activation |
| Implementation → Success | launch council returns GO (`live`) | acceptance, training, health baseline | customer success | handoff to renewal clock |
| Success → Support | go-live | named admins, escalation path, SLA scope | support | none (support is not gated by payment) |
| Success → Renewal | 120 days before `renewal_date` | outcomes with caveats, usage vs contract, price approach | renewal owner | renewal quote |
| Finance → Success | invoice overdue | days past due, dispute state | success | collections escalation to the customer's executive |
| Any → Closed | disqualification or loss | reason, learning, future-contact rule | pipeline owner | re-entry as a fresh `target_account` |

**Single-person reality.** Every role above is currently unassigned and the owner is one person. Until a second person exists, the compensating control is: every approval is recorded as self-approved, flagged, and sampled monthly by the outside accountant. A self-approved exception is never retroactively blessed by the same person.

**Proposed time boxes** (unapproved; calibrate after the first real cases): acknowledge an inbound institutional lead in two business days; deal-desk decision in three; invoice within five business days of signature; handoff to implementation the same day as signature.

## 5. CRM and product-data integration

| Integration | Direction | Key | Failure behavior | Privacy rule | State |
| --- | --- | --- | --- | --- | --- |
| Site form → `site_leads` → `gtm_accounts` | in | route, HMAC of IP | filled honeypot discarded; rate limit | no student data, no raw IP | exists |
| Signed order form → tenant, project, renewal | internal | contract ID | idempotent on re-sign | none | exists, finding 6 |
| Stripe → `payment_events` and invoices | in | provider + event ID (unique) | duplicate returns `duplicate`; out-of-order invoice answered 500 and retried | no card data stored | exists, unconfigured |
| Accounting system ← invoices, credits, payments | out | invoice number, event ID | queue with retry; unposted items on a daily exception list | financial minimum only | **absent** |
| SIS or roster → eligible-student counts | in | tenant, term | stale count blocks true-up, never invoices | counts only, no rosters | **absent** |
| Product → billing meter | in | tenant, meter, period, idempotency key | late data lands in the next open period; closed periods are restated explicitly | tenant-level counts only | **absent** |
| Health job → renewal board | internal | billing account, day | pending review before outreach | account-level signals | exists |
| Tax engine (Stripe Tax) | in | invoice | activation refuses without active tax setup | address only where required | exists, review pending |

### Billing meter requirements

The existing `usage` table counts per-user AI calls to cap cost. It must not be reused for billing, because it is per person and a person-level bill invites surveillance.

1. A meter is defined by a versioned `meter_definition`: name, unit, what counts, what is excluded, aggregation (distinct, peak, sum), window and owner.
2. Readings are append-only, keyed by tenant, meter, period and an idempotency key, and are counts only. No student identifier enters a billing reading.
3. "Active student", "sponsored seat" and "enrolled student" are different meters with different definitions. Which one prices a contract is a pricing decision still open ([`PRICING-AND-PACKAGING`](PRICING-AND-PACKAGING.md)).
4. Each period ends in a reviewed, frozen statement shown to the customer before any invoice relies on it. Disputes reopen with a recorded reason.
5. Premium-AI usage uses institution-managed allowances with a visible budget. No student is surprised with a bill.
6. Meter data never joins prospect or contact identity to individual product behavior.

## 6. Quote-to-cash

```text
qualify → quote → approve → contract → order record → invoice → collect → apply → entitle/activate → renew/close
              │       │         │          │             │          │         │
         price book  deal desk  counsel   immutable   numbering   AR/cash   reconcile
         version     + finance  + finance  version     + tax       follow-up  to ledger
```

### Approval matrix

Structure is proposed. Every threshold is `[THRESHOLD TO BE APPROVED]`; none may be filled with a guess. Rows extend the [deviation matrix](../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md).

| Event | Level 1 | Level 2 | Level 3 | Hard rules |
| --- | --- | --- | --- | --- |
| Discount from price book | deal desk, within `[BAND]` | finance, within `[BAND]` | executive, beyond | recorded reason, expiry, margin-floor check, reciprocal value; never discounts security, privacy, accessibility, rights, support or clean exit |
| Non-standard payment terms | finance | finance + counsel | executive | terms stated on the order, not in email |
| Free or pilot period; pilot-to-annual credit | deal desk | finance | executive | eligible fees and expiry stated; no silent extension |
| Credit memo or service credit | finance, up to `[LIMIT]` | finance + executive | — | linked to an invoice and a reason code |
| Refund | finance, up to `[LIMIT]` | finance + executive | — | to the original payment method; never above what was paid |
| Write-off | finance + accountant | executive | — | after collection steps; accountant reviews policy |
| Price change at renewal | deal desk | finance | executive | notice period honored |
| Order form signature | authorized signer | — | — | signer authority on file |
| Hierarchy or bill-to change | finance | counsel | — | changes who can read financial data |

Hard rules for every row: no self-approval by the requester; no approval after signature; no "same as last deal" without a current comparison; an approval expires; a missing approval blocks the next step in the system, not by convention. Where the owner is the only person, see §4.

### Invoicing

1. Invoices are produced only from the executed order or an active subscription, through the approved billing and accounting path, with a unique number and duplicate prevention. Today numbers come from a Postgres sequence (`SEM-000001`). Sequences can skip values when a transaction rolls back, so whether gaps are acceptable is a **tax and accounting question** for the reviewer, not an assumption.
2. An issued invoice is immutable. A correction is a credit memo plus a new invoice, never an edit.
3. Each invoice names bill-to, PO, currency, tax treatment, exemption reference where the customer is exempt, remit-to and due date. Public institutions often need a vendor registration or AP-portal submission; capture the route on the bill-to role.
4. Tax is calculated by the approved tax engine, with registration and nexus decided by the tax reviewer. The activation tool already refuses to open without active tax setup.
5. Delivery is evidenced: sent time, recipient role, portal submission ID where used.

### Collections

Individual subscriptions already follow `run_dunning()`: notice, retry, reminder, final notice with the exact restriction date, restriction of **paid entitlements only**. Data, export and deletion are never touched.

Institutions need a separate ladder because they pay through purchase orders and AP queues, and a dunning email is the wrong instrument.

| Day past due (proposed) | Action | Owner |
| --- | --- | --- |
| before due | confirm PO, bill-to and portal submission 10 days out | finance |
| 1–15 | friendly reminder to bill-to and buyer; check portal status | finance |
| 16–30 | call the AP contact; confirm no dispute; attach copy | finance |
| 31–60 | escalate to buyer and sponsor; success reviews account health | success |
| 61–90 | executive-to-executive; formal notice per the contract | executive |
| beyond | counsel decides on suspension rights, written off per policy | counsel, accountant |

Rules: a dispute pauses the ladder for the disputed amount only; **overdue payment never suspends export, deletion or other non-waivable data rights**; any restriction of service follows the contract's stated notice, not the ladder; every step is logged on the account.

### Credits, refunds, disputes, write-offs

1. **Credit memo:** reduces a specific invoice or future charges, with a reason code (billing error, service credit, goodwill, contract concession). Goodwill is the only reason that needs an executive above a limit.
2. **Refund:** returns cash to the original method through the processor, only against a recorded payment, never above it. The processor's refund event is applied by the webhook and reconciled.
3. **Chargeback:** the `chargeback` event opens a case, preserves evidence, and flags the account. Evidence upload is a deadline-driven task.
4. **Unapplied cash and credit balances:** a payment with no invoice, or a credit memo with no invoice left, is an exception that must be resolved. Unclaimed balances may carry legal obligations, so the accountant decides treatment.
5. **Write-off:** moves an invoice to `uncollectible` after the ladder, with approval and a reason, and is visible to the accountant monthly.

### Renewals

The repository already opens a `renewal_opportunities` row 120 days before term end, with stages at 120, 90, 60 and 30 days. This design adds:

1. **Notice-date control.** For any contract with `auto_renews = true` or a `renewal_notice_days`, compute the last day to give or receive notice and put it on a calendar owned by a person. Missing it is a revenue event in either direction.
2. **Value at risk.** The renewal row has no amount. Add the contract's frozen annual value so the board ranks by money, not date.
3. **Outcomes** stay `renewed`, `expanded`, `downgraded`, `churned` or `pending`. A narrow extension stays `pending` and is reported separately, as the [playbook](RENEWAL-AND-EXPANSION-PLAYBOOK.md) already requires.
4. **Price changes at renewal** follow the approval matrix and the contract's notice terms.
5. **A pilot never converts by default.** It ends on `ends_at`, or an amendment extends it with approval.
6. Renewal evidence is aggregate and human-reviewed; no hidden individual scoring.

## 7. Forecasting and dashboards

### Method

There is no stage history, no closed deal and no calibrated probability yet, so the method starts conservative and tightens as data arrives.

| Layer | Source | Method | Until data exists |
| --- | --- | --- | --- |
| Contracted recurring | signed contracts | deterministic schedule from term, value and billing frequency | exact from the first contract |
| Renewals | `renewal_opportunities` | per contract; outcome categories with a human note; no weighting until ≥ `[N]` decided cohorts | listed individually, unweighted |
| New business | `opportunities` by stage | amount × stage conversion measured from history | scenario ranges (low / base / high), **no probabilities** |
| Expansion | health plus meter vs allowance | per account, reviewed | listed individually |
| Usage and overage | meter readings | measured, never extrapolated before two closed periods | unavailable |
| Services | SOWs | milestone schedule | per SOW |

**Forecast categories are defined by evidence, not opinion:** *committed* means a signed order not yet billed; *probable* means `procurement_legal` with an identified approver and decision date; *possible* means `proposal` or earlier. A rep cannot promote a deal by relabeling it. Moving a stage requires the exit evidence in [`SALES-PIPELINE-DEFINITIONS`](SALES-PIPELINE-DEFINITIONS.md).

**Discipline:**

1. Freeze a snapshot each week into `forecast_snapshots`. A forecast that can be quietly edited cannot be scored.
2. Score each month: absolute error, bias (over or under), and error by category, using the snapshot as it was.
3. Report booked, billed, collected and recognized side by side. Each must reconcile to its source; a break is a published exception.
4. A pilot and its hypothetical annual conversion are never both counted.
5. Unavailable is not zero. A blank tile says why.

### Dashboards

Each tile shows definition version, source, as-of time, owner, population, currency and a data-quality flag. Extends [`REVENUE-OPERATIONS-DASHBOARD-SPEC`](REVENUE-OPERATIONS-DASHBOARD-SPEC.md).

| Dashboard | Audience | Cadence | Tiles |
| --- | --- | --- | --- |
| Pipeline | seller, owner | weekly | stage counts and age, next-action overdue, stage-entry history, evidence gaps |
| Forecast | owner, finance | weekly, monthly | layers above, snapshot error, coverage by category |
| Deal desk | deal desk, finance | daily | open approvals, aged approvals, discounts vs band, exceptions near expiry |
| Order and delivery | implementation | weekly | signed, started, launched, accepted; days signature → go-live |
| Billing and AR | finance | daily | invoices issued, due, overdue by age bucket, disputed, unapplied cash |
| Renewals | success, finance | weekly | calendar with notice dates, value at risk, health, decisions due |
| Leakage | finance | weekly | each control in §9 with open count and value |
| Metering | finance, success | per period | readings vs allowance, unfrozen periods, disputes |
| Hierarchy | finance | monthly | rollup by system → campus → bill-to; accounts with no bill-to or no signer |
| Data quality | RevOps | daily | rule violations by severity, blocked publications |

Default output is aggregate at organization level. Drill-down follows least privilege and is logged. Small cells are suppressed under the approved threshold (current proposal: 10).

## 8. Data quality, deduplication, audit and access

### Quality rules

| Rule | Entity | Severity | Blocks |
| --- | --- | --- | --- |
| signed order has no end date, effective date or document ref | contract | critical | invoice, entitlement |
| account has no bill-to or signer | account | critical | quote send |
| billing account has more than one currency | billing account | critical | invoice |
| tenant has two contracts with overlapping dates | contract | critical | second signature |
| contract is active but nothing was invoiced in the last billing period | contract | high | none; opens a leakage case |
| invoice open and past due with no collections step in 7 days | invoice | high | none; assigns owner |
| discount with no reason or approver | quote | critical | send |
| stage advanced without exit evidence | opportunity | high | forecast inclusion |
| duplicate account (see below) | account | high | merge review |
| stale next action (> `[DAYS]`) | opportunity | medium | forecast confidence |
| amount without currency, or currency not on the account | any | critical | publication |
| meter period closed without a frozen statement | meter | high | invoice |
| payment event with no invoice | payment | high | month close |
| role holder has left but still holds a role | party role | high | access review |

A material violation **blocks publication** of the figure it affects, as the dashboard spec already requires.

### Deduplication and merge

1. **Match keys, in order:** an external institution identifier approved by the data owner `[IDENTIFIER SCHEME TO BE CONFIRMED]`; then the verified primary web domain; then normalized legal name plus country and state. Fuzzy name match produces a *review candidate*, never an automatic merge.
2. **Contacts:** work email is the key. Personal enrichment is excluded by the CRM model.
3. **Merge procedure:** a person proposes, a second reviewer approves where one exists; the survivor is the record with signed contracts; every loser is kept as a tombstone with a redirect to the survivor; foreign keys are repointed in one transaction; a merge event records who, when, why and the before-state. Nothing is hard-deleted. A merge that would join two billing accounts is a finance-approved event.
4. **Imports** go through the same keys before insert and report matched, created and rejected counts.

### Audit

1. Every financial record change writes one append-only history row with actor, time, reason and prior values, following `tenant_plan_history` and `tenant_sso_policy_history`.
2. Add a `commercial` ledger to the existing chain, covering signed contracts, issued invoices, credits/refunds and approvals. The mechanism is already built and runs nightly (link check plus HMAC seal check), but `ledger` is constrained to `academic_record` and `student_account` in both migrations, so this needs a migration to widen it and a decision on which events are ledger entries.
3. The chain's own header states what it does not cover: someone who can read the signing key (the database owner or a superuser) can re-sign a manifest over rewritten rows, and an external anchor for the head hash is not in place. Finance records inherit that limit until it is closed.
4. Person columns are excluded from the hash so account deletion does not break the chain, as the existing design does.
5. Payload hashes, not payloads, are stored for payment events (already true).

### Access

Extends the "who reads what" table in [`COMMERCIAL-CORE`](../COMMERCIAL-CORE.md). All writes remain the service role's.

| Role | Reads | Writes (via service path) | Never |
| --- | --- | --- | --- |
| seller | own accounts, stage, quote drafts | stage moves with evidence, quote drafts | invoices, bank, other sellers' discounts |
| deal desk | all quotes, approvals, exceptions | approvals | its own requests |
| finance operator | all billing records | invoices, credits, collections steps | account health, product content |
| accountant (external) | read-only ledger extracts and sampled records | none | production secrets |
| customer success | delivery, health | health review, renewal notes | invoices, contract prices |
| institution `billing_contact` | own account's invoices, contracts, renewals | none | implementation, student data |
| institution admin | own implementation and configuration | none | invoices unless also billing contact |
| executive | dashboards | high-level approvals | direct edits |
| support | none | none | all commercial records |

Controls: least privilege; quarterly access review recorded; revoke on role change; break-glass requires a reason and creates an alert; exports are logged with preparer, reviewer and purpose; provider secrets, bank details and tax identifiers never enter the repository ([`FINANCIAL-CONTROLS`](../company/FINANCIAL-CONTROLS.md)).

## 9. Revenue leakage and pricing exceptions

| # | Leak | Where it occurs | Detection | Prevention |
| ---: | --- | --- | --- | --- |
| 1 | Contracted seats exceed entitled or billed seats | subscription has no quantity | contracted vs metered vs invoiced per tenant, monthly | `subscription_items` quantity; true-up at period close |
| 2 | Active contract, nothing invoiced | missed billing run | contracts active in a period with no invoice | billing schedule generated at signature, not by memory |
| 3 | Plan outlives contract | `tenant_plan` end date not matching contract | plan end vs contract end report | single writer; finding 6 rule |
| 4 | Plan lowered by a later small order | `apply_signed_contract` upsert | overlap check at signature | refuse or require amendment |
| 5 | Auto-renewal not invoiced, or non-renewal notice missed | renewal board | notice-date calendar | owner per notice date |
| 6 | Discount not recorded | `quote_lines` has one price | list vs net absent today | list, net and reason columns, approvals |
| 7 | Discount beyond authority | quote | discount vs band | approval required before send |
| 8 | Free pilot continues past end | pilot extended informally | pilots past `ends_at` with active plan | pilot needs an end date (enforced); extension by amendment |
| 9 | Overage or usage not billed | no meter | readings above allowance with no line | meter, frozen statement |
| 10 | Credit issued without approval | `credits_refunds` has no approver | credits with no approval row | approver required, ≠ requester |
| 11 | Refund above payment | manual | refund vs captured amount | provider-enforced, internal check |
| 12 | Unpaid invoice aging unseen | no institutional collections | aging buckets and steps | ladder, owner, logs |
| 13 | Unapplied cash or credit balance | no allocation table | unapplied list | `payment_allocations` |
| 14 | Wrong tax or tax-exempt status unrecorded | invoicing | exemption reference missing on exempt buyers | tax engine, bill-to role field |
| 15 | Currency mismatch | quote, contract, invoice carry separate currency | cross-check report | one-currency invariant |
| 16 | Dispute left open | processor | disputes past deadline | tracked cases |
| 17 | Services delivered outside scope | implementation | hours vs SOW | change orders |
| 18 | Free use after cancellation | entitlement removal fails | entitlements with no active paying source | nightly entitlement-to-source match |

### Pricing exceptions

An **exception** is any quote, contract or invoice that departs from the approved price book, standard payment terms or standard term. Each has a register entry with: requester, customer, what differs, reason, financial effect against list, margin-floor check, approver and level, expiry, renewal treatment, whether it sets precedent, and the related deviation record. Rules: exceptions expire; a renewal re-asks; precedent is a decision, not a habit; a monthly review reports count, value and the top reasons; and the register is queryable from the system of record, not maintained by hand. The margin floor is `[FINANCE TO COMPUTE FROM OBSERVED COSTS]`; unknown inputs stay placeholders ([`PRICING-AND-PACKAGING`](PRICING-AND-PACKAGING.md)).

## 10. KPI definitions and reporting cadence

All are definitions only. None has a value until its source and approval exist ([`ANALYTICS-AND-METRICS-DICTIONARY`](ANALYTICS-AND-METRICS-DICTIONARY.md)). Finance and the accountant confirm each before first use.

| KPI | Definition | Source |
| --- | --- | --- |
| Bookings | total contract value of order forms signed in the period, by type new/renewal/expansion | signed contracts |
| ARR | annualized recurring fees of active contracts at a date; excludes services, one-time fees and usage | contract schedule |
| MRR | ARR ÷ 12, for monthly-billed individual subscriptions reported separately | subscriptions |
| Billings | amount invoiced in the period | invoices |
| Collections / cash | cash received and applied in the period | payments |
| Recognized revenue | per accountant-approved policy | accounting system |
| Deferred and contract balances | per accountant | accounting system |
| DSO | average receivable balance ÷ billings × days, institutional only | AR |
| AR aging | open balances by days past due bucket | invoices |
| Gross revenue retention | retained recurring revenue from a cohort ÷ starting recurring revenue, excluding expansion | contracts |
| Net revenue retention | (starting + expansion − contraction − churn) ÷ starting | contracts |
| Logo retention | accounts retained ÷ accounts up for renewal | renewals |
| Renewal decision rate | per the dictionary: final `renewed`, `expanded` or `downgraded` ÷ final decisions | renewals |
| Quote cycle time | `proposal` entry → `contracted` or `closed_lost` | stage history |
| Discount rate | (list − net) ÷ list, by approver and reason | quote lines |
| Exception rate | exceptions ÷ signed order forms | register |
| Leakage rate | detected leak value ÷ billings | §9 board |
| Forecast error and bias | per §7 | snapshots |
| Credit and refund rate | credits plus refunds ÷ billings | credits_refunds |
| Metering variance | metered ÷ contracted allowance | meter |
| Gross margin, CAC, payback | **finance-approved cost policy required** | accounting system |

### Cadence

| When | What | Owner | Output |
| --- | --- | --- | --- |
| daily | data-quality board, approvals queue, AR movements, webhook and sync failures | RevOps | exceptions closed or assigned |
| weekly | pipeline hygiene, forecast snapshot, renewals within 120 days, leakage board, aging review | owner and finance | frozen snapshot; action list |
| monthly | close: reconcile CRM → order → invoice → processor → bank → ledger; exception and discount review; forecast scoring; access spot-check | finance with accountant | signed close checklist; closed period frozen |
| quarterly | access review, price-book review, approval-threshold review, cohort retention, metric definition review | owner, finance, counsel as needed | recorded decisions |
| annually | audit readiness, retention schedule, policy review, tax and nexus review, disaster-recovery drill for finance data | owner, accountant, counsel | approved updates |

A closed period is frozen. A change reopens it with a reason and approver, and the restatement is displayed.

## 11. Required finance/legal/accounting review points

Nothing below is a conclusion. Each is a gate that blocks the action named until the named reviewer decides, in writing, and the decision is recorded.

| # | Decision or event | Reviewer | Decides | Blocks |
| ---: | --- | --- | --- | --- |
| 1 | Legal entity, bank, merchant account, authority matrix | counsel, accountant | who can sign, bank and charge | any live charge or order |
| 2 | Accounting system and chart of accounts | accountant | system of record for AR and GL | accounting export |
| 3 | Price book, packages, discount bands, margin floor | finance, counsel | what may be quoted | any quote with a number |
| 4 | Order form, MSA and payment terms templates | counsel | standard terms | signatures |
| 5 | Each non-standard term (bundles, free periods, acceptance, SLA credits, termination, usage, financing) | counsel, accountant | whether and how to accept | signature |
| 6 | Revenue recognition policy and contract memos | qualified accountant | treatment per obligation and timing | any revenue report |
| 7 | Tax: nexus, registrations, product tax code, exemption handling, e-invoicing | tax adviser | what is collected and filed | invoices in affected places |
| 8 | Invoice numbering rules and gap tolerance | accountant, tax adviser | whether gapless numbering is required | invoicing at scale |
| 9 | Public-sector procurement: vendor registration, cooperative contracts, W-9, insurance, bonding | counsel | eligibility to sell | first public-sector order |
| 10 | Consumer rules: auto-renewal, cancellation, refund, price-change notice | consumer counsel | purchase and cancel flows | individual paid acquisition |
| 11 | Refund, credit and write-off policy and limits | finance, accountant, counsel | authority levels | refunds and credits |
| 12 | Credit balances and unapplied cash treatment (possible unclaimed-property rules) | accountant, counsel | handling and reporting | closing credit balances |
| 13 | Collections and suspension rights | counsel | what may be done to a non-paying customer | any suspension; data-rights handling is never suspended |
| 14 | Data tied to payment: FERPA, DPA, retention and deletion | privacy counsel | what payment can and cannot affect | any link between billing status and data rights |
| 15 | Financial record retention for institutional contracts | accountant, counsel | period and disposal (the individual rule is seven years, D-132; institutions follow the contract) | purge of institutional records |
| 16 | Commissions, partner and channel arrangements | counsel, accountant | whether and how | any commission or reseller offer |
| 17 | Currency and cross-border pricing, VAT/GST | tax adviser | which currencies and places | non-USD or non-US sale |
| 18 | Period close and the first audit or review | accountant | close procedure | external financial reporting |
| 19 | Forecast and KPI publication to investors, board or customers | finance, counsel | what may be stated | any external revenue claim |

## 12. Build order and open decisions

Ordered by risk to money and to the record, not by effort. Each step needs its own proof file and review.

| Step | Work | Closes | Gate |
| ---: | --- | --- | --- |
| 1 | Add an overlap rule so a later order form cannot lower or shorten a plan; add a check for it | finding 6, leaks 3–4 | engineering, finance |
| 2 | List price, net price, discount reason and `quote_approvals`; approver ≠ requester | leaks 6–7 | finance, counsel |
| 3 | History rows and immutability for `quotes`, `contracts`, `invoices`, `credits_refunds`; add `credits_refunds` approver and provider reference | leaks 10–11 | finance |
| 4 | Contract value and ARR frozen at signature; amount on `renewal_opportunities` | forecast, KPIs | accountant |
| 5 | `subscription_items` with quantity; `invoices` balance, payment allocation | leaks 1, 13 | finance |
| 6 | Institutional collections workflow with aging and dispute state | leak 12 | counsel, finance |
| 7 | Party, role and hierarchy tables; parent contract and parent billing account | §3 | counsel, finance |
| 8 | Meter definitions and readings, frozen period statements | leaks 1, 9 | pricing decision first |
| 9 | `opportunities` and stage history; weekly `forecast_snapshots` | §7 | owner |
| 10 | Widen the ledger chain to a `commercial` ledger (the nightly verifier already runs) | §8 | engineering |
| 11 | Accounting export and period close | §6 | accountant selected first |

### Decisions needed from the owner

1. Which single system holds the CRM: the `gtm_*` tables, or an external CRM (§1).
2. The accounting system and who the accountant is.
3. Whether the $7.99 / $59 catalog values are approved prices, or still proposals (finding 8).
4. Whether a signed order form should create an `active` plan immediately, or a `trial`/pending state until launch GO (finding 7).
5. Which unit prices an institutional contract: enrolled student, active student, sponsored seat, or platform fee (§5).
6. Who the second person is for approvals, and what the interim compensating control will be (§4).

## Evidence state

**Repository evidence.** The tables, functions and documents cited above exist at revision `7287ddc`. Findings 2 through 8 were read from the migrations and functions; none was reproduced because no database was available in the authoring session.

**Operational evidence.** No operating CRM, price book, issued institutional invoice, collected payment, accounting system, accountant, deal desk, collections process, close or audit is evidenced. All roles are unassigned.

**Not read.** The source audit PDF has 86 pages. Pages 1–10 were read in full; the remainder was searched for revenue, pricing, billing, hierarchy and KPI passages only.

**Missing test/proof.** Owner decisions in §12; finance, tax, legal and accounting approvals in §11; migrations with `*.check.sql` proof for each step; a quote-to-cash and a refund/dispute rehearsal in test mode; a close rehearsal; a role-based access test for every table added.

## Claim ceiling

Semester may say it has a proposed revenue-operations design, built on a repository-tested commercial core, with identified gaps and a staged plan. It may use this document to scope work and brief reviewers.

## Prohibited claims

Do not claim live billing, issued or collected institutional invoices, a price book, discount authority, an operating deal desk, collections, reconciliation, a close, revenue recognition, ARR/MRR, retention, forecast accuracy or any customer, from this document or the tables it describes. Do not fill a `[PLACEHOLDER]` with an estimate.
