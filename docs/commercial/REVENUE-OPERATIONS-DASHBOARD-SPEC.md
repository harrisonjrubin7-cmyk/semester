# Revenue Operations Dashboard Specification

| Control | Value |
| --- | --- |
| Status | **CONTROLLED SPECIFICATION — NO CURRENT REVENUE DASHBOARD OR ACTUALS ASSERTED** |
| Owner | Harrison Rubin — company-side revenue-operations owner; finance/accounting reviewer, backup analyst and data steward unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |

## Purpose and audience

Provide authorized commercial, delivery and finance operators a reconciled view of prospect flow, contracted scope, implementation, billing, renewal and customer risk without treating product engagement as revenue or exposing student-level data. Every tile shows definition/version, source, as-of time, owner, population, currency, evidence status and data-quality warning.

## Required views

| View | Measures | Required boundary |
| --- | --- | --- |
| pipeline | account/opportunity counts by controlled stage, age, next action, source, segment, decision date; quoted amount and assumption status | targets/leads/proposals are not customers or revenue; no invented probabilities |
| forecast | approved amount by forecast category/scenario/time plus changes and coverage assumptions | estimate only; reconcile to signed orders, exclude duplicate pilot/annual value |
| orders/delivery | signed orders by scope/start/end, implementation gate, launch status, acceptance/offboarding | signature, implementation, activation and acceptance are separate |
| billing/cash | approved invoice, due/paid/overdue/refund/dispute/reconciliation status | billing/cash are not recognized revenue; source only from approved finance systems |
| revenue review | accountant-approved recognition schedule/status by contract/obligation | blank/unavailable until qualified policy and records exist |
| renewals/health | renewal window, reviewed account-level health reasons, QBR/decision, risk/action | human-reviewed; no hidden individual/student scoring |
| unit economics | acquisition/delivery/support/provider cost, gross-margin and payback inputs | all cost allocation and accounting definitions approved; otherwise placeholder |
| data quality | missing/stale/duplicate records, unreconciled sources, unsupported dates/amounts, access anomalies | blocks publication/forecast confidence where material |

Default outputs contain aggregate organization-level data. Drill-down follows least privilege and logs access. Suppress small/sensitive pilot outcome cells under the approved threshold. Never join prospect/contact identity to individual student product behavior for sales pressure.

## Reconciliation and cadence

Daily/weekly operational refresh may support actions; monthly close/management reporting requires finance reconciliation. Reconcile CRM opportunity → executed order → implementation → invoice → processor/bank/accounting → accountant-approved revenue, preserving exceptions. Display unavailable rather than zero when a source is absent. Freeze closed periods and record restatements with reason/approver.

## Evidence state

**Repository evidence.** GTM, commercial, implementation, billing, renewal and account-health structures plus metric proposals can supply future dashboard inputs.

**Operational evidence.** No approved source integration, finance ledger/bank reconciliation, accountant policy, forecast history, actual CAC/margin, customer set or operated dashboard is evidenced.

**Missing test/proof.** Approve metric dictionary and roles; map/reconcile sources; validate currency/time/duplicate/cutoff logic; perform privacy/security review; test row-level access and data quality; obtain finance/accounting acceptance and run a close rehearsal.

## Claim ceiling

Semester may use this specification to build and test an internal dashboard populated with clearly labeled synthetic or unapproved data.

## Prohibited claims

Do not report pipeline, bookings, billings, cash, ARR/MRR, recognized revenue, CAC, LTV, margin, retention, churn, renewal or forecast accuracy as actual until the defined sources and approvals exist.
