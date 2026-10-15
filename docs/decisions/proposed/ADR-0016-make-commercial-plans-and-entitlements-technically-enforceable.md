# ADR-0016 · One dated price book, enforced at quote, entitlement and meter, replaces three inconsistent number sets

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Commercial / finance owner (founder until another is named) |
| Deciders / reviewers | Founder (price authority); finance advisor; counsel and accountant for pricing disclosures, renewal, refund, tax and revenue recognition (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "no quote or sale without a price book"; Phase 2 for institutional enforcement |
| Related | [`commercial/READINESS_GAP_MATRIX.md`](../../../commercial/READINESS_GAP_MATRIX.md); [`docs/ENTITLEMENT-RESOLUTION.md`](../../ENTITLEMENT-RESOLUTION.md); D-134; D-1231; D-1236; ADR-0014, ADR-0015, ADR-0024; [`PUBLIC_CLAIMS_APPROVAL_REGISTER.md`](../../legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md) C-01, C-02, C-03 |
| Supersedes / superseded by | — |

> **Counsel required (and an accountant for tax).** Subscription auto-renewal and refund rules, published prices and savings claims, sales tax, revenue recognition, held funds: `LEGAL_REVIEW_QUEUE.md` Q-07, Q-13, Q-10; `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md`. This ADR picks no price.

## Context
**Program targets (stated as targets, not repository facts):** Student Premium $8.99/mo or $69/yr; institution $18 per enrolled student per year with a $30,000 minimum; large institutions $12-16; AI overage $30 per 1,000 request units; marketplace commission 12%; implementation $35k-150k; premium support 15% of contract (minimum $15k); storage 25 GB per active student pooled, +$18/TB/month; paid pilot $30-45k.

**What the repository records** (`READINESS_GAP_MATRIX.md` §1; 0 of 9 targets found as written):
| Item | Repository value | Path |
| --- | --- | --- |
| Individual paid plan | Plus $7.99/mo, $59/yr (D-134) | `app/src/lib/plans.ts:58`; `supabase/migrations/20260929131000_plus_price.sql` |
| Institution | $11 per active student/yr + $90,000 platform; department $10 + $35,000 | `docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md` |
| Pilot | $12,000 for 26 weeks + $15,000 implementation = $27,000 | same; `docs/finance/01-MODEL-AND-CAPITAL-PLAN.md:43,55` |
| Deal-desk minimum ACV | pilot $15,000; department $25,000; campus $75,000; system $200,000 | `app/src/lib/governance/deal-desk.ts:36` |
| Public site | "From $15K / yr, $35K, $75K"; "save 38%" | `company-site/index.html:660,621`; `company-site/site.js:360` |
| Implementation | $15,000 / $40,000 / $120,000 fixed vs launchkit $5,000-20,000, $15,000-75,000 | `docs/finance/02-...md`; `app/src/lib/launchkit.ts:488-489` |
| Marketplace take | 15% vs 12% illustration; D-1236: not decided | `docs/finance/02-...md`; `docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md:357`; `docs/decisions/D-1236.md:46` |
| AI | allowance with hard cap, no overage; $0.75/$2.00/$4.00 per month (proposals) | `supabase/functions/_shared/aispend.ts`; D-1231 |

**Enforcement today:** institutional `commercial_prices` have no amounts (0 of 6; `20260929070000_commercial_core.sql:197-209`); entitlement resolver is shadow-only and "enforces nothing" (`docs/ENTITLEMENT-RESOLUTION.md` status line); a signed order form writes `tenant_plan` (`20260929080000_commercial_automation.sql`; `20261004090000_order_form_never_downgrades_plan.sql`); deal-desk is a pure function not wired to `quotes` (`deal-desk.ts`; `quotes` unit price is free text); only AI-on-shared-key is metered (`20261004170000_ai_spend_meter.sql`) - no storage, active-student, SMS or overage meter (`git grep 'storage.gb_month' -- supabase` empty); institution billing is `DOCUMENTED-UNIMPLEMENTED` (`docs/COMMERCIAL-CORE.md`).

## Problem
How does the program record exactly one price book, decide between the targets and the repository's existing figures, and make quotes, entitlements and meters refuse what the book does not allow?

## Decision drivers
1. No quote without a single authoritative number (findings-commercial #2).
2. Price decisions belong to the owner; the mechanism must not choose them.
3. Enforcement at write time (quote status change, entitlement resolution, meter), not by review.
4. One change set per decision: migration, `plans.ts`, tests, site, claims.
5. Public numbers must be backed by a decision (findings-commercial #1).

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Adopt the nine targets directly | Fast; matches program intent | Contradicts D-134 and finance model; no unit-economics check; AI overage conflicts with "never a surprise bill" | Not chosen without owner decision |
| B. Keep repository figures, treat targets as aspirations | No migration | Leaves public site and launchkit inconsistent | Not chosen alone |
| C. Decision procedure plus enforcement mechanism; price values entered by the owner as a dated record (`D-<pr>`) | Neutral on winners; enforces whichever is chosen | Delays first quote until the record exists | **Recommended** |
| D. Per-deal pricing only (no book) | Maximum flexibility | Discount and minimum unenforceable; the current state | Not chosen |

## Decision
**Recommended, unratified.** (1) Procedure: the owner records the price book as one `docs/decisions/D-<pull request number>.md` listing every price, minimum, overage, support percentage, storage meter and marketplace take, with the unit-economics check from `docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`; each target above is accepted, amended or rejected by name, and conflicting documents are marked superseded. Counsel/accountant review precedes any public use. (2) Mechanism: a `price_book_version` row set (new migration) from which `commercial_prices`, `plan_entitlements`, deal-desk minima and meter rates are generated or checked; a quote cannot move to `sent` below the deal-desk minimum or off-book unit price without a recorded approval; the entitlement resolver moves from shadow to enforcing per step, one step at a time, starting with `tenant-plan`; a meter exists for every metered unit the book names before the book may name it (storage, active student, overage); AI overage, if adopted, is opt-in with a customer-set cap. (3) Public: `company-site` and `claims.ts` may show a price only when it equals the active book (test). (4) Targets stay labelled targets until the record exists. Not ratified.

## Consequences
Positive: a quote has one source; public and internal numbers cannot drift. Negative: a delay before first institutional quote; meters (storage, active student) are real engineering. Harder: ad-hoc discounts.

## Impact
- **Data / tenancy:** `tenant_plan` and meter rows keyed by tenant; storage meter needs object-size accounting (ADR-0021).
- **Security:** entitlement enforcement must fail closed on resolver error.
- **Privacy:** active-student counting uses personal data; minimise (ADR-0017).
- **Accessibility:** price and cancellation UI covered by existing a11y suites; no claim.
- **Operations (SLO, alert, runbook, support):** premium support at 15% implies an SLA the repository has not started (`docs/trust/SLA.md` `NOT_STARTED`); see ADR-0025.
- **Cost / commercial:** enforcement of overage and storage protects margin; billing live acceptance for annual, refund, failed renewal, dispute is not exercised (`docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`; counsel required).

## Implementation
1. Owner records the price-book decision record. 2. Migration for `price_book_version`; seed from the record. 3. Wire `deal-desk.ts` to `quotes` status trigger. 4. Enforce `tenant-plan` step in `entitlement.ts` for new orders; others after shadow comparison. 5. Add meters. 6. Replace public numbers or remove them (`company-site/site.js:360`).

## Tests and verification
- `supabase/price-book.check.sql` (proposed): a quote at $20,000 for a campus tier below the $75,000 minimum cannot become `sent`; fails today. Control: an approved exception succeeds.
- `app/src/lib/site-prices.test.ts` (proposed): fails while `company-site/index.html:660` shows a price with no matching book row.
- Shadow-vs-enforce comparison test for each resolver step before enabling.
- Revert test: remove the trigger, first test goes red.

## Fitness functions
- `public-claims-evidence` (#12): fails if a published price/discount lacks an approved claim row (CLM-015).
- `release-evidence` (#11): fails if the active price book is undated or unapproved.
- `audit-outbox` (#8): fails if a quote exception writes no audit row.
- Proposed scripts: `scripts/architecture/price-book-consistency.mjs`.

## Rollback / reversal
Price-book versions are append-only; revert by activating the prior version. After a customer signs an order at a version, changing it is a contract matter (counsel required).

## Open questions
Where the targets originate; whether production holds the catalog and meter migration (not inspected); per-enrolled vs per-active metric (the finance doc rejects per-enrolled as primary); marketplace take, 12% vs 15%.

## Addenda
None.
