# Commercial and entitlement model

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md), [`../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md), [`../commercial/PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md), [`../ENTITLEMENT-RESOLUTION.md`](../ENTITLEMENT-RESOLUTION.md), `02-PRICING-PACKAGING-ENTITLEMENTS.md` |
| Claim ceiling | Structure only. **This document sets no price, discount, allowance, rate, take rate or term.** |
| Prohibited claims | Any figure as a Semester price (CLM-015); that Pro, usage billing or AI overage is on sale. |

> Not accounting, tax or legal advice. Basis labels: FACT, PROPOSED, HYPOTHESIS, REVIEW.

## 1. The price conflict this document does not resolve

The student price appears five ways: $3.99/$29.99 (retired seed), **$7.99/$59** (live catalog, owner decision D-134, exercised on 2026-10-03), **$15/month** (D-1154, "replaces $7.99/$59", yearly price unstated, catalog still prints the old figures), $8.99/$69 (program target, A-017, ADR-0016 proposal), and Pro at $14.99 (proposed, not on sale). Institution figures conflict too (deal-desk minimums $15k/$25k/$75k/$200k; $11/active student + $90k in `02`; $18/enrolled student with a $30k minimum as a program target). D-1160 says the Plus figures are an owner decision, not an approved price book. Everything below works with any of them; the owner names the figures, and the price book (§3) is where they would live once named.

## 2. Four ideas kept apart (FACT, from COMMERCIAL-CORE, kept)

| Idea | Table | Decides |
| --- | --- | --- |
| Plan | `commercial_plans`, `commercial_prices` | What is sold, at what price |
| Subscription | `subscriptions` | Who pays for which plan, which period |
| Entitlement | `plan_entitlements`, `subscription_entitlements` | Which paid features and tiers apply |
| Authorization | RLS + `private.has_capability` | Who may read or change which record |

A subscription grants entitlements and never authorization. No policy on student data reads a commercial table. This stays absolute in the native platform.

## 3. Catalog and price book (PROPOSED)

Today prices are rows in `commercial_prices` with an interval and an `effective_from/to`. There is no price book, no discount model, no tiered or usage price. ADR-0016 (proposed, unratified) asks for one dated price book enforced at quote, entitlement and meter.

| Addition | Shape |
| --- | --- |
| `price_books` | `id`, `name`, `audience`, `status` (draft, approved, retired), `approved_by` ≠ `created_by`, `effective_from`, `effective_to` |
| `price_book_versions` | Immutable once approved; a change is a new version. Carries `approval_id` from `finance_approvals` |
| `price_book_lines` | `plan_code`, `model` (flat, per_unit, tiered, volume, usage, minimum), `currency`, `amount_cents`, `unit`, `interval`, `floor_cents` (margin floor, from the cost model) |
| `commercial_prices` | Keeps working; becomes a derived view of the individual-audience lines of the approved version, so the existing checkout and `plans.test.ts` keep their single source |

Rules: a price is never edited in place (existing rule); every quote line and invoice line stores the `price_book_version` it was priced from; **a number not in an approved version cannot be sold**; the migration ships structure and test fixtures only. Floors come from [`03-COST-MODEL.md`](03-COST-MODEL.md) and the AI cost model, not from the sales side.

## 4. Subscriptions and items

Today: one plan per subscription, no quantity, no add-ons, statuses mirroring Stripe (`trialing`, `active`, `past_due`, `grace`, `canceled`, `ended`).

PROPOSED `subscription_items`: `subscription_id`, `plan_code`, `quantity`, `unit_amount_cents`, `price_book_version`, `starts_at`, `ends_at`, `kind` (base, add_on, seat, usage). A subscription's contracted quantity becomes visible, so contracted, entitled and used can be compared (REVENUE-OPERATIONS invariant 7).

Semester-owned lifecycle states (separate from the rail's): `draft → trialing → active → past_due → grace → restricted → canceled → ended`, with `paused` reserved. Each transition writes one history row (actor or job, time, reason, prior values) in an append-only `subscription_history`. In Mode A the rail's status is mapped in by the adapter; in Mode B Semester decides.

| Rule | Value |
| --- | --- |
| Grace | 14 days today, hard-coded. Move to a setting per plan with a finance-approved default (HYPOTHESIS: keep 14) |
| Restriction removes | Paid entitlements only. Never data, export, deletion, accessibility, safety alerts, support (`ALWAYS_INCLUDED`) |
| Cancel | At period end; reaches the rail first, then the record (D-132). Add resume before period end (a stated gap) |
| Plan change | Upgrade immediately with proration decided by finance; downgrade at period end; neither is available today |
| Order form never lowers a plan | Existing (`20261004090000`) |
| Renewal notice dates | Computed and calendared for any contract with `auto_renews` or `renewal_notice_days` |

## 5. Entitlements

FACT: `entitlement_definitions` (kind feature, limit, service_tier) and `plan_entitlements` (value jsonb) copy into `subscription_entitlements` on checkout completion; the dunning worker removes plan and contract sources at grace end; payment restores them; `my_entitlements()` is presentation only. A pure engine exists in `packages/platform/src/engines/entitlements.ts` but is not wired to the edge functions, and a separate institutional resolver (`_shared/entitlement.ts`, 12 ordered steps) serves LTI. `pro` has a plan row, no price and no entitlements, so a Pro subscriber would read as Free (pinned by `sharedplan.test.ts`).

PROPOSED, in order:

1. **One resolver, two inputs.** The 12-step institutional resolver stays the authority for institutional access. Personal plans enter it through `PersonalGrant`, which already models a bought or sponsored plan. The SQL `my_entitlements()` and the shared-key `planFromSubscriptions` both call the same resolution rule, tested against the same fixtures, so a client display, the AI gateway and a function can never disagree.
2. **Entitlement effects are events.** Each grant or removal writes `entitlement_changes` (subject, key, before, after, cause: `payment.captured`, `dunning.restrict`, `contract.signed`, `refund.succeeded`, `manual_grant`; actor; idempotency key). Today a removal is a `delete`, which loses history.
3. **A refund can adjust an entitlement** only by an explicit rule in the refund policy (full refund of the current period ends the period's paid entitlements; partial refund does not), never silently.
4. **Entitlement-to-billing reconciliation** (FC-09): nightly, every active paid entitlement maps to a paid order or approved grant; every paid order to an entitlement; usage to caps. Differences go to the leakage report.
5. **Pro**: until it has a price and entitlements, either hide it or give it entitlements; do not leave a plan row that silently reads as Free. That is a product decision, listed so it is not forgotten.

## 6. Usage metering (PROPOSED)

AI spend today is a cap, not a bill: `RATE_CARD` in micro-dollars per model, atomic `add_spend` reserve-then-settle, allowances ($0.75 / $2.00 / $4.00 a month per plan, marked proposals), a 60-call backstop, and a hard 429 with a bring-your-own-key route. Nothing is billed.

| Table | Rules |
| --- | --- |
| `meter_definitions` | `key`, `unit`, `aggregation` (sum, max, count_distinct), `source`, `version`, `billable` bool, `price_book_line` |
| `usage_events` | Append-only. `meter_key`, `billing_account_id`, `quantity`, `occurred_at`, `source_ref`, `idempotency_key` **unique**. Written by the service that did the work, never by the browser |
| `usage_aggregates` | Derived and rebuildable from events per account, meter and period; a rebuild must equal the stored value (a nightly check) |
| `usage_adjustments` | The only way to change a billed quantity: reason, approval, new event, never an edit |

**Shadow first.** Dual-write the existing AI spend settlement into `usage_events` without billing anything. Compare aggregates with `private.ai_usage_month` until they agree for a stated period. The micro-dollar unit is converted to a billable unit only through the price book's line, so a currency never mixes into the meter.

## 7. AI usage billing (PROPOSED, stage 2, opt-in only)

Principles, none of them a price:

1. **The default stays a hard cap.** Overage billing exists only for an account that turned it on.
2. **A spend ceiling the customer sets**, enforced by the same atomic reserve that exists today (`add_spend` with the customer's cap), so a runaway loop cannot bill more than the ceiling.
3. **Included allowance is shown before and during** (the student checkout step 5, and a usage meter in Account).
4. **Rated from the price book**, with the provider cost as the floor so a model-price change cannot make usage unprofitable silently; a provider or routing change that moves cost per active user by more than the approved band needs approval (05, §4).
5. **Billed as invoice lines on the next invoice**, or a threshold charge, never as a surprise: a notice at 80% and 100% of the allowance, and before the first overage charge.
6. **School-funded AI** is the tenant meter (`reserve_ai_budget` in cents) and is invoiced to the institution under its contract; a student on a school plan is never billed personally for it.
7. **A refund of usage** is a credit memo against the invoice line with the usage evidence attached.
8. Provider activation (`SHARED_PROVIDER`, five requirements all `pending-owner`) is a separate gate; no usage billing exists to bill while the shared key is off.

## 8. Pricing exceptions (PROPOSED)

`pricing_exceptions`: `id`, `kind` (discount, free_period, pilot_credit, custom_term, price_lock, non_standard_payment_terms), `quote_id` or `subscription_id`, `list_cents`, `net_cents`, `discount_percent` (computed), `reason_code`, `reciprocal_value`, `margin_floor_ok` (computed against the version's floor), `approval_id`, `expires_at`, `status`.

| Rule | Detail |
| --- | --- |
| Requires an approval | `finance_approvals` with the policy for `pricing_exception`; self-approval refused; approval expires; none after signature |
| Margin floor | Below floor cannot be approved by the deal desk; it escalates to the highest level |
| Never discounted | Security, privacy, accessibility, data rights, support minimums, clean exit (REVENUE-OPERATIONS §6) |
| No silent extension | A pilot ends on `ends_at`; an extension is an amendment with approval |
| Reporting | An exception report: count, value, by approver and by reason, reviewed monthly (FC-06) |

**Thresholds are not set here.** Proposed bands exist in `05-BUDGET-GOVERNANCE.md` §4 (discount: 10% account executive, 20% head of sales above margin floor, 30% CEO+CFO, above 30% or below floor or multi-year price lock needs the board). They are proposals; until the owner adopts a matrix the approval policy has no active row and **every exception request blocks** (fail closed).

## 9. Data model summary (new, additive)

`price_books`, `price_book_versions`, `price_book_lines`, `subscription_items`, `subscription_history`, `entitlement_changes`, `meter_definitions`, `usage_events`, `usage_aggregates`, `usage_adjustments`, `pricing_exceptions`; columns on `quote_lines` (`list_unit_amount_cents`, `discount_reason_code`, `price_book_version`); `quote_approvals` (quote, level, approver ≠ requester, decision, expiry, reason). Each ships with RLS, grants review, an `*.check.sql`, and finance sign-off (REVENUE-OPERATIONS §2).

## 10. Revenue-state separation

Booked, billed, collected, entitled, delivered and recognized are six different states and none implies another (REVENUE-OPERATIONS invariant 6). The commercial model records the first five as facts with timestamps; **recognized** is the accountant's, computed outside this model per [`../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md). Pilot fee, annual prepayment, usage and seat true-up treatment are **[REQUIRES QUALIFIED REVIEW]**.

## Evidence state

- **Repository evidence:** `20260929070000_commercial_core.sql`, `20260929131000_plus_price.sql`, `20260929080000_commercial_automation.sql`, `_shared/aispend.ts`, `_shared/sharedplan.ts`, `_shared/entitlement.ts`, `packages/platform/src/engines/entitlements.ts`, `governance/deal-desk.ts`.
- **Operational evidence:** the live Plus acceptance only.
- **Missing proof:** every table in §9.

## Cannot be completed from source code

Any price, rate, allowance, floor, discount band or take rate; the choice among the five student prices; revenue-recognition treatment; the decision whether Pro exists.
