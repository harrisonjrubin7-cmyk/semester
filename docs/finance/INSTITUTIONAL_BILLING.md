# Institutional billing

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md`](../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md) §2, §3, §6, §9; [`../commercial/ORDERING-AND-BILLING-OPERATIONS.md`](../commercial/ORDERING-AND-BILLING-OPERATIONS.md); [`06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`](06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md); `app/src/lib/governance/deal-desk.ts` |
| Claim ceiling | Internal design. A paid institutional pilot is NO-GO (GO-NO-GO-DECISION, 3 Oct); nothing here charges, invoices or contracts with an institution. |
| Prohibited claims | That Semester invoices institutions today; any institutional price, minimum, payment term or discount authority (none is set: D-1154, D-1160). |

> Not accounting, tax or legal advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

This document extends the revenue-operations architecture and does not restate it. Read that document's customer hierarchy (§3), approval matrix (§6) and review points (§11) first; the sections below add the build.

## 1. What exists (FACT)

`billing_accounts` (kind `institution`, funded tenants through `billing_account_tenants`), `quotes` and `quote_lines` (no discount, list-price, term or approval columns), `contracts` (kind `order_form`, `msa`, `dpa`, `sla`, `amendment`; mutable in place; `version` integer, no supersession link), `invoices` (mutable, `po_reference` text, no lines populated, no balance), `renewal_opportunities` (120/90/60/30-day stages), `account_health_snapshots`. A signed order form starts the tenant plan, an implementation project and a renewal row, and never lowers an existing plan. Roles: `billing_contact` (not global; reads its account's contracts, invoices, subscriptions, renewals), `finance_operator`, `customer_success`, `compliance_owner`. **No screen reads institutional invoices or contracts.** Invoice numbers come from a Postgres sequence (`SEM-000001`). Institutional records are not age-purged; the contract governs.

## 2. Principle

An institution pays against a purchase order, through an accounts-payable queue, often by bank transfer, on terms. A card form is the wrong front door and a dunning email is the wrong collection instrument. The native build is therefore **order, invoice and cash application first**; the rail is optional for paying an invoice, and **an institutional invoice can be fully operated with no processor at all** (bank transfer applied from a bank statement and reconciled).

## 3. Data model (PROPOSED, additive)

| Table | Purpose and rules |
| --- | --- |
| `billing_contacts` | `billing_account_id`, `role` (bill_to, ap, buyer, signer, tax), `name`, `email`, `ap_portal_ref`, `valid_from/to`. A contact is a row, not only a role grant. Changing bill-to is a hierarchy change (finance + counsel, because it changes who can read financial data) |
| `billing_addresses` | Bill-to, ship-to, tax address; country and region validated; one current per kind |
| `tax_profiles` | Registration ids, jurisdictions, treatment note, set by finance with the tax adviser; **[REQUIRES QUALIFIED REVIEW]** |
| `tax_exemptions` | Certificate reference (document in the controlled store, hash only here), jurisdiction, valid_to, `verified_by` ≠ `submitted_by`, expiry alert 60 days out; an expired certificate blocks exempt treatment on the next invoice |
| `purchase_orders` | Number, `amount_cap_cents`, `consumed_cents` (derived), validity dates, linked contract; an order or invoice above the cap is flagged for finance, never silently accepted |
| `payment_terms` | Net days; default and the approval needed above it (05 proposes net 45 default, net 60 with CFO, beyond with CEO+CFO: PROPOSED, not adopted) |
| `invoice_schedules`, `invoice_schedule_items` | Contract-derived dates and amounts; generated at signature; changes are amendments |
| `credit_memos` | Document with number, linked invoice, reason code, approval; reduces a specific invoice or future charges |
| `payment_allocations` | Links a payment to invoices and lines, allowing partial payment and over/under-payment handling |
| Columns | `contracts.supersedes_contract_id`, `contracts.document_sha256`, `contracts.total_value_cents` and `arr_cents` (frozen at signature), `invoices.amount_paid_cents`, `balance_cents` |

`order_forms` and `contract_versions` are deliberately **not** new tables: the order form is a `contracts` row, and a version is a superseding row with a document hash (REVENUE-OPERATIONS invariants 1 and 4).

## 4. Quote to cash

```
request → quote draft → price (price book version) → approvals → quote sent → accepted
   → order form (contract) → signature (signer authority on file) → schedule generated
   → invoice issued (immutable) → delivered with evidence → payment received (bank or rail)
   → applied → reconciled → entitlements active (at signature, D-1154) → renewal tracked
```

| Stage | System rule |
| --- | --- |
| Quote | Lines carry list, net and discount reason; a non-draft quote names exclusions; expires; `quote_approvals` per the policy; approver ≠ requester; none after signature |
| Order form | Needs a quote link (today nullable and not enforced; make it required for new order forms), an effective date, an end date for any pilot, a document hash |
| Signature | Signer authority on file; only an `order_form` triggers tenant activation; MSAs, DPAs and SLAs are terms |
| Invoice generation | From the executed order or schedule only; unique number; lines populated; tax by the approved path; issued invoices immutable; a correction is a credit memo plus a new invoice |
| First invoice per customer | Reviewed by a second person (FC-08) |
| Delivery | Sent time, recipient role, portal submission id where an AP portal is used |
| Cash application | Each payment matched to invoices (FC-10); unmatched cash cleared in two business days; a payment with no invoice or a credit with no invoice left is an exception the accountant resolves |
| Renewal | Notice date computed and calendared; value at risk on the renewal row; a pilot never converts by default |

## 5. Payment methods for an invoice

| Method | Needs a rail | How it is recorded |
| --- | --- | --- |
| Bank transfer (ACH, wire) to Semester's account | No | Bank statement line imported or keyed by finance; applied to the invoice; reconciled (FC-11) |
| Check | No | Same, with a deposit record |
| Card or ACH through the rail's hosted payment page for that invoice | Yes (adapter) | Normal attempt, journal and settlement path |
| Purchase order terms | No | The invoice is the request for payment; the PO is a reference, not a payment |

Remit-to instructions live in a controlled record, and **any change to remit-to or bank details requires call-back verification (FC-04)**: invoice fraud is the commonest loss in this area.

## 6. Tax exemption workflow

1. Customer submits an exemption certificate against a billing account and jurisdiction.
2. Finance verifies it (a different person from whoever submitted it), records the verifier, the expiry and the evidence reference.
3. The invoice generator applies exempt treatment only while a verified, unexpired certificate covers the jurisdiction; otherwise standard treatment.
4. An alert 60 days before expiry goes to the billing contact and to finance.
5. A customer who was wrongly treated as exempt generates a tax adviser review item, not an automatic correction.

Which jurisdictions Semester must register in, what is taxable (software, usage, implementation services), and how exemption certificates for public institutions are validated are **[REQUIRES QUALIFIED REVIEW]** questions for the tax adviser; the system records the decision and the evidence, it does not make the decision.

## 7. Collections

Institutions follow a separate ladder from individuals (REVENUE-OPERATIONS §6): confirm PO and portal submission before due; reminder days 1–15; AP call 16–30; escalate to buyer and sponsor 31–60; executive-to-executive 61–90; counsel beyond. [`05`](05-BUDGET-GOVERNANCE.md) and [`01`](01-MODEL-AND-CAPITAL-PLAN.md) assume a different cadence (day 30/45/60/75/90); the two differ and the owner should pick one **(open, flagged)**. Rules common to both: a dispute pauses the ladder for the disputed amount only; **overdue payment never suspends export, deletion or other non-waivable data rights**; any restriction of service follows the contract's notice terms, not the ladder; every step is logged on the account; a write-off follows [`REFUND_CREDIT_DISPUTE_POLICY.md`](REFUND_CREDIT_DISPUTE_POLICY.md).

## 8. Approvals (structure; thresholds proposed, not adopted)

| Event | Request | Approver | Source of the proposed band |
| --- | --- | --- | --- |
| Discount from price book | Account executive | Deal desk, finance, executive by band | 05 §4 (10% / 20% / 30% / above) and `deal-desk.ts` |
| Non-standard payment terms | Account executive | Finance, counsel, executive | 05 §4 |
| Pilot-to-annual credit, free period | Deal desk | Finance, executive | `deal-desk.ts` (pilot credit cap) |
| Credit memo | Finance | Finance up to a limit, then CFO | 05 §4 |
| Write-off | Finance | CFO up to a limit, then CEO+CFO; board informed above a larger one | 05 §4 |
| Hierarchy or bill-to change | Finance | Counsel | REVENUE-OPERATIONS §6 |
| Minimum ACV | Deal desk | Per tier ($15k pilot, $25k department, $75k campus, $200k system in `deal-desk.ts`) | Implemented as a proposed policy in code; the finance model's own minimums differ (open) |

All of this is enforced by `finance_approvals` and `finance_authority_policies`; with no adopted policy every request blocks.

## 9. Screens (institution side)

Billing account overview, contacts, quotes, order forms, contracts, invoices, payment schedules, purchase orders, tax exemption, payment methods (token display), entitlements, usage, AI overage (if opted in), support plan, renewal, audit history. Routes in [`NATIVE_CHECKOUT_SPEC.md`](NATIVE_CHECKOUT_SPEC.md) §7 and console screens in [`FINANCE_OPERATIONS_CONSOLE.md`](FINANCE_OPERATIONS_CONSOLE.md). Visibility follows `private.can_read_billing`: `billing_contact` sees only its account's contracts, invoices, subscriptions and renewals; a `university_admin` does not see invoices unless also a billing contact.

## 10. Consortium, multi-campus and bill-to variants

A parent funding several tenants uses the existing many-to-many. A school with two funded scopes is a stated open gap; the proposed `customer_parties`, `party_relationships` and `account_party_roles` in REVENUE-OPERATIONS §2 are the answer and are not duplicated here. Consortium admin fee (1% in `05`) is a proposal. Public-sector vendor registration and AP-portal submission are captured on the bill-to role.

## 11. Open decisions

The institutional price and unit; whether the $30,000 minimum sits between deal-desk department and campus minimums; the collections cadence; who signs for Semester and with what authority; whether the first paid pilot is invoiced by bank transfer only. None is decided; D-1154 records that no thresholds or authority-matrix entries are set.

## Evidence state

- **Repository evidence:** `20260929070000_commercial_core.sql`, `20260929080000_commercial_automation.sql` (`apply_signed_contract`), `20261004090000_order_form_never_downgrades_plan.sql`, `governance/deal-desk.ts`, the docs cited.
- **Operational evidence:** none for institutions.
- **Missing proof:** every table in §3; every screen in §9.

## Cannot be completed from source code

Institutional pricing; payment terms; tax registrations and exemption validity; signer authority; counsel on contract terms; purchasing practices of any particular institution (each is discovered per account).
