# Native checkout specification

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | `supabase/functions/billing-checkout`, `_shared/billingcheckout.ts`, `app/src/lib/membership.ts`, `app/src/components/MembershipPanel.tsx`, D-128, D-132; [`PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md`](PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md) |
| Claim ceiling | Internal design. Checkout is **held** (`billing-checkout/index.ts:27` and `lib/plans.ts:19`, both false, both pinned by tests) and this document does not lift or schedule lifting it. |
| Prohibited claims | That checkout is available; any price, refund window or renewal term (CLM-010, CLM-015); PCI compliance. |

> Not legal, tax or PCI advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. Purpose and boundary

The customer should experience Semester from first screen to receipt. Semester controls product selection, price, discount, quote, consent, tax address, order, receipt, notices and support. The rail controls only the secure capture of payment details and the payment itself.

Today (FACT) the customer is redirected to a rail-hosted page (`checkout.stripe.com`) to pay, and returns to the Account route. Two things in that page are not Semester's: the page itself and the rail's emails. This specification keeps everything before and after payment native in stage 1 and, only if the PCI path is answered, moves the card field into Semester's page as a provider-hosted field in stage 2.

| Stage | Card entry | Who sees the card number | Gate |
| --- | --- | --- | --- |
| 1 — Native shell, hosted page | Redirect to the rail's page, branded and returning to Semester | Rail only | FRG-12 |
| 2 — Embedded hosted fields | Rail-provided field (iframe) inside Semester's page; Semester's page never receives the value | Rail only; the field is served from the rail's origin | FRG-14, PCI path answered **[REQUIRES QUALIFIED REVIEW]** |
| 3 — Stored token, Semester-scheduled | Customer authorizes a token once; Semester charges it on its schedule | Rail only | FRG-15 |

Embedding a field does not by itself change who handles card data, but it can change the PCI questionnaire that applies. That is a counsel and assessor question (E2, Q-27), not an assumption. No SAQ type is stated here as fact.

## 2. Architecture

```
Student / Institution
   │  (browser: Semester screens only; no rail secret, no card number)
   ▼
Checkout shell (React)             ── reads catalog, price book, quote by id
   │  POST intent                  
   ▼
Order and pricing service          ── pure pricing function (shared with quote builder)
   │                                   price book version · quantity · discounts · exception approval
   ▼
Eligibility and entitlement check  ── plan allowed? already subscribed? age rule? institution-funded?
   ▼
Tax                                ── adapter.calculateTax or provider-inside; address required → native address step
   ▼
Billing account + draft invoice    ── `billing_accounts`, `checkout_sessions` (extended), draft `invoices`
   ▼
Consent record                     ── versioned text, timestamp, subject; enforced by existing check
   ▼
Collection session (adapter)       ── hosted page URL (stage 1) or hosted-field client secret (stage 2)
   ▼
Rail: authorize / capture
   ▼
Webhook → inbox → normalize → apply   (one transaction)
   ▼
Attempt state · ledger journal · invoice paid · entitlement activation · receipt notice · audit
   ▼
Receipt / invoice / entitlement confirmation (native)
```

Properties that must hold at every step:

1. **The browser never decides a price.** The pricing service computes it from the price book version and quantity; the client displays it. Today's rule (the catalog row, not `plans.ts`, is the price: D-128) is kept and extended to quotes.
2. **Consent precedes the rail.** `begin_checkout` records consent (`plus-v2` today) before any rail call; the same open row is reused and re-stamped on retry; one open checkout per account and price (existing partial unique index).
3. **The return page is not the source of truth.** Success is what the verified webhook applied. The return page polls (existing behaviour: 20 polls, 3 seconds) and shows "confirming" until the entitlement exists. A customer who closes the tab loses nothing.
4. **Entitlement follows capture, never the redirect.**
5. **Nothing here can suspend export, deletion or other data rights** (D-009, D-132, `ALWAYS_INCLUDED`).

## 3. Student subscription checkout

Flow for an individual plan (Plus today; any plan the price book makes buyable later).

| Step | Screen content | Native behaviour | States |
| --- | --- | --- | --- |
| 1 Plan | Plan comparison from the catalog; included-always list (records access, export, deletion, accessibility, safety alerts, support, billing management) | Reads `commercial_prices`; no price in code | loading, empty (no buyable plan), error with retry |
| 2 Interval | Monthly or annual, with the recurring amount, renewal date and cancel route stated beside the choice | Price from the catalog row | long locale content |
| 3 Account | Who is paying, which Semester account; school email notice if a school pays | Eligibility: already subscribed refused with the manage route; under-13 refused (D-139) | already-subscribed, ineligible |
| 4 Tax address | Native address form (country, postal code, state) | `tax.location_required` returns here, not to a rail page; field-level errors via `FieldMessage` | invalid, unsupported region |
| 5 AI usage | What is included, what happens at the allowance (today: refused with a message and the bring-your-own-key route; no overage) | Reads the plan's allowance; if opt-in overage exists later, it is a separate unchecked-by-default choice with a customer-set cap | n/a today |
| 6 Terms and consent | Versioned consent text naming the recurring price, tax shown before purchase, renewal, cancel route, refund wording as approved (D-1019: no window stated or granted) | Records `consent_at` and `consent_text_version`; checkbox is not pre-checked | declined, text version mismatch |
| 7 Payment | Stage 1: "Continue to secure payment" and the redirect. Stage 2: the hosted field in the page | `createCollectionSession` | 3-D Secure `requires_action`, declined, provider unavailable ("Nothing was charged") |
| 8 Confirming | "We are confirming your payment" until the entitlement exists | Polls; `unknown_outcome` shows this, never an error | slow, timed out with a support route |
| 9 Receipt | Amount, tax, period, next renewal, method (brand, last four), invoice link | From `invoices` and the attempt, not from the rail's page | |
| 10 Manage | Change method, cancel at period end, billing history, download receipts | Native screens over the adapter's portal capability in Mode A, native in Mode B | cancel reaches the rail first (D-132) |
| 11 Cancel request | Reason code (optional), exact end date, what stays (data, export, deletion) | `billing-cancel` then `request_cancellation()` as today | already ending, resume (new) |
| 12 Support | Billing help route with the invoice and attempt reference prefilled; no card data requested or accepted | Notice about never sending card numbers; the no-card pattern check on any free-text field | |

## 4. Institutional checkout (order flow)

Institutions do not enter a card on a public page by default. They request, receive a quote, accept an order form, and are invoiced. A card or bank payment on an invoice is a later convenience. Full flow in [`INSTITUTIONAL_BILLING.md`](INSTITUTIONAL_BILLING.md); the checkout shell's role is the order screens:

| Step | Screen | Controls |
| --- | --- | --- |
| 1 | Quote request or open quote by id | Quote belongs to a billing account; viewable by `billing_contact` for that account only |
| 2 | Account and tenant selection | Funded tenants from `billing_account_tenants`; one funded scope per order until two-scope schools are representable (a stated open gap) |
| 3 | Enrollment or seat estimate | Calculator is the same pure pricing function; shows list, discount, net; an unapproved discount cannot be accepted |
| 4 | Product, plan and support level | From the price book version on the quote |
| 5 | Implementation scope and exclusions | A non-draft quote must name exclusions (existing check) |
| 6 | Order form | The `contracts` row of kind `order_form`; document hash shown; signer authority checked against the signer on file |
| 7 | Purchase order | Number, amount cap, validity; an order above the PO cap is flagged |
| 8 | Billing contact, address, tax profile, exemption certificate | Exemption needs evidence and a verifier who is not the requester |
| 9 | Contract attachments and approval workflow | `quote_approvals` per the authority policy; approval expires; none after signature |
| 10 | Invoice schedule and payment terms | Net days above the default need approval |
| 11 | Review and acceptance | Terms and privacy acknowledgement; consent text versioned |
| 12 | Confirmation | Signed order form triggers `apply_signed_contract` (tenant plan, implementation project, renewal row), exactly as today; renewal date shown |

Entitlement activation for a signed order form is immediate (D-1154 point 3) and never lowers an existing plan (`20261004090000`).

## 5. Pricing and calculation

One pure function, `priceOrder(priceBookVersion, lines, quantities, discounts, exception?) → { list, discount, net, tax?, total, reasons[] }`, used by the quote builder, the checkout shell, the seat calculator and the invoice generator, so the same input gives the same number everywhere (the repository already holds the pricing page to the catalog by test; this extends it to the quote). It stores list, net and discount reason separately so a discount is computable, not typed (REVENUE-OPERATIONS invariant 3). It carries no price: the numbers come from a price book that does not yet exist and is the owner's to set (see [`COMMERCIAL_AND_ENTITLEMENT_MODEL.md`](COMMERCIAL_AND_ENTITLEMENT_MODEL.md)).

## 6. Error, retry and support flows

| Situation | Customer sees | System does |
| --- | --- | --- |
| Rail unavailable before charge | "Nothing was charged. Try again." | Keeps the open checkout; same key on retry |
| Outcome unknown | "We are confirming your payment. You do not need to pay again." | Queries the rail by key; webhook resolves |
| Declined | Reason class, update-method route, no automatic second charge | Attempt `failed`; dunning rule decides |
| 3-D Secure needed | In-page step | Attempt `requires_action` |
| Tax address missing or unsupported | Address step, or "we cannot sell here yet" | `tax.location_required`; no dunning, access stays |
| Duplicate click or two tabs | One charge | Unique open checkout and idempotency key |
| Webhook delayed | "Confirming" up to a bound, then a support route with the reference | Inbox; dead-letter alert |
| Customer disputes at their bank | Case notice, evidence request | `dispute.opened`; see [`REFUND_CREDIT_DISPUTE_POLICY.md`](REFUND_CREDIT_DISPUTE_POLICY.md) |
| Cancels | Exact end date; export and deletion unchanged | Rail first, then record |
| Wants a refund | Policy-stated route, never a promise of a window | `request_refund`, approval, rail |

Every screen covers the repository's states: default, loading, empty, error with a way back, disabled, success, long content, permission (shared `EmptyState`, `Notice`, `ErrorState`, `LoadingState`, `PermissionNotice`).

## 7. Screens and routes (checkout)

Route ids are proposals; each needs registration in `lib/nav.ts` and passes `nav.registry.test.ts`. Student routes sit under Account → Membership (the existing home, D-128); institutional routes sit under the institution's billing area for `billing_contact` and `university_admin` as scoped.

| Route (proposed) | Purpose | Replaces or extends |
| --- | --- | --- |
| `account/membership` | Plan, status, manage | Existing `MembershipPanel` |
| `account/membership/choose` | Plan and interval | New steps 1–2 |
| `account/membership/checkout` | Address, AI usage, consent, payment, confirming | New steps 3–8 |
| `account/membership/receipt/:invoice` | Receipt and invoice | New |
| `account/membership/methods` | Payment methods (token display only) | Rail portal today |
| `account/membership/history` | Invoices and refunds | Rail portal today |
| `account/membership/cancel` | Cancel request | Extends existing cancel |
| `billing/quotes/:id` | Quote view and acceptance | New |
| `billing/orders/:id` | Order form, PO, tax, contacts, schedule | New |
| `billing/invoices` and `/:id` | Institution invoice list and detail | New |

Components reuse before anything new: `components/ui.tsx`, `Page.tsx`, `unity/States.tsx`, `FieldMessage.tsx`, `ErrorSummary`. No raw colours, spacing or z-index in feature UI; the design-system ledgers may shrink and not grow. Accessibility: native elements, visible focus, accessible names, 44px targets, 320px survival, no hover dependence, and colour never the only status (use `lib/status.ts`). Details of the build order sit with the `build-semester-ui` skill, which this document does not replace.

## 8. Security requirements specific to checkout

| Requirement | Where enforced |
| --- | --- |
| No card or bank number in any request, response, log, table, error or analytics event | No such parameter exists in the adapter; free-text 13–19 digit runs refused in the browser and in the database (same pattern as the school ledger) |
| No rail secret in the browser | `VITE_` scan test over rail credential names; client receives only hosted URLs or a session-scoped client secret |
| CORS fails closed on `ALLOWED_ORIGIN` (unset or `*` allows nobody) | Existing `strictOrigin`, kept |
| Redirect targets validated | Return URL https, no credentials, origin allow-listed (existing); hosted URL host must match the rail's declared host |
| Test session never attaches to a live account | Mode match (existing `checkoutSessionMatches`, generalized) |
| Rate limit and size limit | 2048-byte body today; per-account attempt rate limit proposed |
| Consent immutable once recorded | Existing consent check; extend with append-only history |
| Idempotent create | `collect:<checkout_id>` key plus unique open checkout |

## 9. Tests

Unit: pricing function (golden cases, rounding to the cent, line-sum equals total); consent gate; every state in §6. Integration against the mock adapter: happy path, decline, 3-D Secure, unknown outcome, duplicate, early webhook. Existing 12 checkout tests stay green. A guard test that the two hold constants are still false unless the gates in [`FINANCE_RELEASE_GATES.md`](FINANCE_RELEASE_GATES.md) are met and a reviewed change flips both. Browser: drive the screens per the `run` skill and look at the screenshot.

## Evidence state

- **Repository evidence:** `billing-checkout/index.ts` (hold at line 27), `billingcheckout.ts` (consent, session params, idempotency key, response checks), `membership.ts`, `MembershipPanel.tsx`, `lib/plans.ts`, `20260929080000_commercial_automation.sql` (`begin_checkout`, `checkout_sessions`).
- **Operational evidence:** one live monthly Plus checkout on 2026-10-03, redirect flow.
- **Missing proof:** every screen after step 3, the pricing function, embedded fields, the PCI path.

## Cannot be completed from source code

The PCI path for embedded fields; consent and disclosure wording by jurisdiction; tax address coverage; any price; the owner's decision to open acquisition.
