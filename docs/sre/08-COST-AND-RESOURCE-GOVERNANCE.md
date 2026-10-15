# 08 · Cost observability and resource governance

> Part of the [SRE pack](README.md). Status: **proposed; no budget is set.** Code: `app/src/lib/sre/cost.ts`. Existing: MONITORING.md (the AI spend alert), `supabase/health.sql` block 1, [GRADUATION-AND-COST-SIMULATOR.md](../GRADUATION-AND-COST-SIMULATOR.md), the CTO pack's unit-economics inputs.

Cost is a reliability signal because the failure that costs money while nobody watches is as real as the one that takes the app down, and because the controls are the same: a cap, a switch, a limit.

## 1. The rule

**An alert tells you it happened; a cap stops it.** Every cost driver has a *guardrail* — a control that stops spend — and the register distinguishes a driver with a guardrail from one with only an alert. A test requires every AI driver to carry one.

## 2. The drivers

| Driver | Unit | Guardrail today |
| --- | --- | --- |
| AI provider, shared key | model call | per-account `MONTHLY_CALL_LIMIT` (default 60) and `kill.ai_generation`; the **provider-side cap is a setting nobody has verified** |
| AI provider, institution gateway | request (cents estimated) | `SEMESTER_AI_MAX_REQUEST_CENTS` per request; monthly enforcement not traced |
| Postgres compute and storage | compute-hour, GB-month | none |
| Edge function invocations | million invocations | none |
| Bandwidth and egress | GB | none |
| Object storage | GB-month | none |
| Transactional email | message | outbox gives up after eight attempts |
| CI minutes | runner-minute | none |
| Payment fees | transaction | checkout is code-held off until live billing is enabled |
| Dynamic security scanning | scan | none |

Six of ten have **no guardrail**, and all ten have `budgetMonthly: null`. Both are shown in the scorecard as open work rather than treated as unbounded-and-fine. No price is written anywhere in the register: provider prices change and a copied price is how a plan certifies a number that was true last year.

## 3. What to measure, so a bill becomes a decision

| Measure | Why |
| --- | --- |
| Cost per active student, by cohort | the unit-economics input the audit asks the platform to produce |
| AI cost per **successful outcome**, not per call | a retried or refused call is cost with no value |
| Cost per tenant | so an institution can be priced and capped |
| Cost by component | so a catalog id joins the bill to the owner |
| Cost per journey | so the budget for reliability work is argued in the same units as the budget for features |

`unitCost()` returns `null` for zero units rather than infinity or zero, and a spend of zero is not mistaken for a collapse (`spendRatio()` returns `null` with no history).

## 4. Anomaly rule

A driver above **150% of its trailing four-week mean** is an anomaly (`cost:anomaly`, a ticket). The ratio is `null` — and so never fires — while there is no history, which is the correct behaviour and the reason the first four weeks of any new driver are read by a person.

## 5. The three AI caps, in order

Per-account cap × accounts × cost per call must sit under the provider cap, or the cap that fires first is the wrong one. See [04](04-CAPACITY-PLANNING.md) §5; `aiCapOrder()` reports `unknown` today because the provider cap and the measured cost per call are unset. **The first piece of work in this document is to set the provider spend cap and the half-cap usage alert**, which is a dashboard setting, takes minutes, and is the single control that bounds the worst outcome.

## 6. Resource governance

| Rule | Mechanism |
| --- | --- |
| Every resource has an owner role | `COST_DRIVERS.role`; the catalog's `role` |
| Every tenant-bearing resource is attributable to a tenant | tags or columns decided with the CTO pack's tenancy model |
| Quotas per tenant, per account, per feature | per-account AI cap exists; per-tenant quotas are a CTO-pack item |
| Retention is a cost control as well as a promise | retention jobs (`job:*-retention`) are C1 for exactly this double reason |
| Unused resources are removed on a schedule | a quarterly review of preview deployments, scratch projects and stale branches (`delete-landed-branches.sh` exists for branches) |
| Cost is reviewed monthly with reliability | the same meeting as the error-budget review ([02](02-SLOS-SLIS-AND-ERROR-BUDGETS.md) §8) |

## 7. Trade-offs, stated

Reliability costs money and money has a ceiling. The decision framework is the budget: a journey with a healthy budget does not need more spend; one that is exhausted does. A class target tighter than the budget can pay for is a decision to record, not a number to publish. The scorecard sorts gaps by criticality class so the first money goes where a student is hurt most: a backup person, a verified backup, a paging route — none of which is expensive in money, and all of which are expensive in attention.
