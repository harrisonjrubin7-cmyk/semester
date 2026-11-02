# Stream 27: Executive OS decision layer + cross-domain gaps

Source: `docs/system/Executive OS and Completion Gaps.pdf`, `docs/system/semester-gap-matrix.csv` (35 gaps, all unverified). Prototype: `#/executive/decisions` (`ExecutiveOS.jsx`, data `execGap.js`). Your local workbench: `docs/system/Semester Completion Workbench.html`.

## Rules
- Decision-first: every screen connects evidence → accountable decision → confirmed outcome.
- Institution Executive OS and Semester Company Executive OS share components, never unrestricted data. Executive or admin title ≠ access to everything.
- Workflow: metric/exception → verify evidence + scope → brief → alternatives → domain-authorized decision → accountable work → controlled change → reconcile → outcome review.
- AI prepares briefs and explains uncertainty; never authorizes restrictions, money, discipline or academic changes. Delinquency = factual overdue + human review, no opaque score.
- Metric contract (all 11 required, else provisional): definition+version, population, period, sources, last complete load, watermark, exclusions/missing, owner, quality, publication approval, permitted drill-down.
- Partner scorecard: service, adoption, quality, trust, commercial kept separate; decision renew/remediate/restrict/suspend/retire. Never average away a security finding.
- AI cost: C = Σ N·(I·Pin + O·Pout)/1e6 + retrieval + compute + storage + evaluation + support. Prices from verified rates only.
- Identity lifecycle: stable person + separately governed, overlapping memberships; never a single mutable person.role.
- Finance: catalog, billing, ledger, payments, reconciliation, operations as six components; scholarships, credits, refunds, write-offs separate authorities; autopay needs a mandate, schedule, revocation, retries, notices.

## Screens
Executive overview · Decision inbox · Strategic initiatives · Finance decision brief · Student outcomes · Service performance · Marketplace & partner performance · Risk & trust · Data confidence · Decision history.

## Gap matrix
Import `semester-gap-matrix.csv` into the completion register (stream 25). Each row: domain, gap, proposed screen, workflow, owner, status (unverified until repo evidence).

## Marketplace decision layer (Oct 7 2026)
Source: `docs/system/Marketplace Decision Layer.pdf` + user code `docs/system/marketplace-decision-layer.js.txt` (ported into `ExoMarket` in ExecutiveOS.jsx, Marketplace tab).
- Snapshot schema v1 (mode synthetic|live, currency, period, freshness, complete, partners[]); strict validation incl. aligned-cohort checks (refunds ≤ GMV, reversals ≤ fees, SLA met ≤ total), unique IDs.
- Headline: gross GMV, net GMV, net fees, realized take rate (ratio of totals), contribution, starting-cohort exit rate. One currency per view.
- Routing (illustrative): incomplete → blocked; trust ≠ clear → trust review; exited → exit/portability review; negative contribution → economics review; negative ROI → investment review; else growth review, never auto-promote tier.
- Live mode: same-origin authenticated adapter only, 60 s poll, keep previous snapshot on failure. Exports are `draft-not-approved`.

## Partner financial model, forecast, alerts, SQL (Oct 7 2026)
Sources in `docs/system/`: `semester-partner-financial-model.xlsx`, `forecast-cross-check.json`, `marketplace-alert-rules.js.txt`, `marketplace-dashboard-query.sql.txt`, `Live Marketplace Dashboard.pdf`. Prototype: Executive → Decisions → Forecast and Alerts tabs (`exoModel`, `exoEvaluateAlerts`); the JS model reproduces all four cross-check totals exactly.
- Model: 36 expected-value months; end = begin × (1 − churn) + new; gross GMV = avg(begin,end) × productivity; net = gross × (1 − refund); fees = net × take; contribution = fees − variable; program ROI vs assumed counterfactual. Scenario changes independent (no demand elasticity). Example: take 12%→13% with churn 2%→3% lowers 36-month fees by $37,356.
- Fees are transaction-fee projections, not recognized revenue, cash, settlement or subscription revenue.
- Blocker: Supabase has no verified marketplace-order / partner-performance fact model. Build it (transaction cohorts; refunds and reversals aggregated per order before joins) before connecting the dashboard. Do not use subscription billing as GMV.
- SQL: reference read-only query over an inline JSON snapshot in cents; scope/currency/period resolved server-side; not a substitute for RLS/capability checks.
- Alerts: churn (min partners) and take-rate drop in percentage points (min GMV both periods); blocked/stale data yields only data-quality states; candidates carry `scope:period:kind:version` dedupe keys backed by a unique constraint; cooldown, repeated-breach, routing, delivery/ack/resolve logging; never automatic tier, hold, payment or suspension actions.
- Forecast upgrade once history exists: complete periods, separate count vs productivity, acquisition/churn/reactivation, term seasonality, backtest, report error.

## Read-only schema check (Oct 7 2026)
Source: `docs/system/Marketplace Schema Mapping (read-only check).pdf`. Prototype: Executive → Decisions → Data mapping. 13 contract fields: partly mappable — scope_id (schools.id), currency, periods, refunds (credits_refunds); missing or unresolved — partner_id, gmv, fees, fee reversals, variable costs, program cost, incremental contribution, lifecycle, completeness. Reusable joins: billing_accounts → invoices → invoice_lines / payment_events / credits_refunds; subscriptions; provider_registry → provider_evidence. Add (after inspecting org model, constraints, permission functions): partner identity link, lifecycle history, transaction attribution, transaction financial facts, tier history, program investment, ROI evidence, reporting-period status, alert state. Worker disabled until mappings and thresholds approved.

## Canonical partner mapping draft (Oct 7 2026)
Source: `docs/system/Marketplace Partner Mapping SQL Draft.pdf` (untested review draft; nothing applied). Tables: marketplace_partners, marketplace_partner_billing_links (purpose fee_billing|payout_reference|program_sponsorship, effective dates, source, authorization evidence; grants no access), marketplace_transactions (unique source identity), marketplace_transaction_classifications (versioned GMV eligibility), marketplace_transaction_adjustments (refunds, commissions, reversals, variable costs). FK types only schools.id (text), billing_accounts.id (uuid). Fail closed for browser roles. Blocker: canonical commercial-organization record not identified. Require isolated staging + deployment review before approval.

## Migration walkthrough + classification (Oct 7 2026)
Source: `docs/system/Partner Mapping Migration Walkthrough.pdf`. Three identities: canonical organization, marketplace partner (participation), billing account; never merged. Resolve the organization link via inventory → authoritative entity master → add participation → namespace+key external IDs → conflict review → scope rules. Release blockers on billing links: overlap, revocation, scope authorization, verified approval reference. Transactions in currency minor units; classifications versioned, report from latest approved as of cutoff; aggregate adjustments before joins. RLS on, browser revoked; service role bypasses RLS so ingestion enforces scope. Partition only measured large event tables (unique keys must include the partition key). Concurrent index builds separate from the transactional migration; reporting query separate from the migration file.
