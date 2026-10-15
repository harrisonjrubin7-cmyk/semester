# Finance operations console

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | `app/src/screens/Console.tsx` (tabs, `console:operate`), `app/src/finance/FinancialModel.tsx` (forecast tab), `private.can_read_billing`, `finance_operator`, D-1275, D-1294 |
| Claim ceiling | Internal design. The Console's Finance tab today is a forecast tool on sample data and reads no ledger, bank or billing system. |
| Prohibited claims | That any console screen shows real billing data; that any figure is an actual (D-1275 refuses "actual" until a real feed exists). |

> Not accounting advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. State today (FACT)

The Console has tabs command, support, approvals, breakglass, audit, customers, figures, finance ("Finance model"), releases, evidence, views, gated by `console:operate` at platform scope. The Finance tab renders `FinancialModel.tsx`: eight sub-views on local sample data, tagged "forecast", writing nothing. `Customers.tsx` lists tenants with no billing reads. **No client UI reads `invoices`, `payment_events`, `dunning_cases`, `credits_refunds`, `contracts`, `quotes`, `renewal_opportunities` or `account_health_snapshots`.** `finance_operator` can read all of them under RLS and has no screen. The Console's `Figures.tsx` says billing is "not applicable" per D-009.

## 2. Principles

1. **Read before write.** Phase 1 is read-only. Actions arrive one at a time, each behind approval, each tested.
2. **One source per number** (09): a figure shown names its source table or job and its as-of time. A forecast is labelled **FORECAST** in the figure itself and never shares a tile with an actual.
3. **Pseudonymous by default.** Rows show a billing-account reference and plan, not a name or email. Revealing a person's identity is a logged action with a reason (data minimization for individual subscribers; D-1294's written-list rule).
4. **Every action is a request that the system, not the screen, authorizes.** The console shows buttons only where the caller's capability and the policy allow; the database refuses the rest.
5. **Never a card number.** No screen has an input that accepts one; free text carries the no-card pattern check.
6. **Break-glass is visible.** Any override uses the existing breakglass tab, with notice.

## 3. Roles and capabilities

Existing: `finance_operator` (`billing:operate`), `billing_contact` (`billing:read`, scoped), `compliance_owner`, `customer_success`. PROPOSED capability additions in the `billing:` namespace (distinct from the school-side `finance:*`): `billing:request`, `billing:approve`, `billing:approve_high`, `billing:reconcile`, `billing:close`, `billing:replay`, `billing:reveal`.

| Role | Can | Cannot |
| --- | --- | --- |
| Support agent | Open a refund or credit request within the proposed band; view an account's invoices and attempts | Approve, submit, reveal identity without reason |
| Finance operator | Request; approve within band if not the requester; run reconciliation; resolve exceptions; replay events | Approve own request; close a period it reconciled |
| Finance lead / CFO | Approve high; sign close; adopt a policy version | Release a payment they requested |
| Compliance owner | Read controls, evidence, audit | Change money state |
| Engineer | Read the inbox and dead letters (no payloads), replay | Approve anything |
| `billing_contact` (customer) | Own account only | Anything in the console |

**Separation:** requester, approver, releaser and reconciler are different people (FC-03). With one person in every seat (R-018), compensating review is required and visible as a badge on the action ("single-seat compensating review"), never hidden.

## 4. Screens and routes

Route ids are proposals registered in `lib/nav.ts`. Phase: **A** read-only (stage 1), **B** actions, **C** later. Source says where the number comes from.

| Screen | Route | Shows | Source | Phase |
| --- | --- | --- | --- | --- |
| Overview | `console/finance` | Open exceptions, dead letters, approvals waiting, restrictions today, dunning cases, last reconciliation, last close | Counts from the tables below | A |
| Cash dashboard | `console/finance/cash` | Settled to date, processor receivable, payouts, bank agreement; **13-week cash forecast in its own panel marked FORECAST** | Settlement, ledger; forecast from the model | A (actuals), C (forecast on real feed) |
| Revenue dashboard | `console/finance/revenue` | Billed, collected, deferred, entitled; MRR and ARR as defined in the metrics dictionary; recognition **not shown** until the accountant adopts a method | Ledger, subscriptions | A |
| Invoices | `console/finance/invoices` and `/:id` | List and detail: lines, tax, allocations, history, journal links | `invoices`, ledger | A |
| Payments | `…/payments` and `/:id` | Attempts with state history, failure codes, rail and event references | `payment_attempts`, inbox | A |
| Event inbox | `…/events` | Received, applied, parked, dead-lettered; replay with `billing:replay` | `provider_event_inbox` | A (read), B (replay) |
| Reconciliation | `…/reconciliation` | Runs, exceptions by type and age, resolutions, bank pass, close readiness | `reconciliation_*` | A (read), B (resolve) |
| Refunds and credits | `…/refunds` | Queue by status, requests, approval state | `credits_refunds`, `finance_approvals` | A (read), B (request, approve, submit) |
| Disputes | `…/disputes` | Cases, evidence due dates, outcomes | `disputes` | A, B |
| Dunning | `…/dunning` | Open cases, next action, restriction dates | `dunning_cases`, actions | A |
| Collections | `…/collections` | Institutional ladder by day past due | `invoices`, contracts | B |
| Quotes and pricing exceptions | `…/quotes`, `…/exceptions` | Quotes by status, approvals, exception report by approver and reason | `quotes`, `pricing_exceptions` | B |
| Customer profitability | `…/profitability` | Revenue by account (ledger) minus allocated cost (AI usage, processor fees, support cost) | Ledger, `usage_aggregates`, settlement fees; method disclosed on screen | C |
| Forecast and runway | `…/forecast` | The existing model, versioned; every tile says FORECAST | `finance_forecasts` | C |
| AI and cloud cost | `…/cost` | AI spend by model and plan vs allowance; vendor reconciliation (FC-16) | `aispend` records, vendor invoices | C |
| Vendor spend | `…/vendors` | Vendor register, renewal dates, spend vs approval | Vendor register | C |
| Accounting export | `…/export` | Period journal export mapped to the accountant's chart; export log | Ledger | B |
| Tax calendar | `…/tax` | Filings and remittances tracked to proof (FC-19) | Manual entries with evidence | C |
| Financial controls | `…/controls` | NF- and FC- control status, last evidence, exceptions | Control register | A |
| Approvals | `…/approvals` | Mine to decide, mine requested, expiry; policy versions | `finance_approvals`, policies | B |
| Audit | `…/audit` | Immutable trail of every action | Audit tables, chain status | A |
| Board report | `…/board` | The 09 package from frozen snapshots | `finance_reporting_snapshots` | C |

**Student-facing** (not console): Account overview, charges, credits, balance, statements, payment plans, installments, payment methods, checkout, receipts, refunds, financial aid handoffs, budget, cost planning, help, privacy. Billing for Semester's own subscription lives under Account → Membership ([`NATIVE_CHECKOUT_SPEC.md`](NATIVE_CHECKOUT_SPEC.md)); the school ledger views (`Bill`, `MyStudentAccount`) stay the school's and are off. Budget and cost planning exist as the student's own tracker (`lib/bill.ts`) and take no payments.

**Institution-facing** screens are in [`INSTITUTIONAL_BILLING.md`](INSTITUTIONAL_BILLING.md) §9.

## 5. Reuse and build rules

Reuse `components/ui.tsx`, `Page.tsx`, `unity/States.tsx`, existing Console tab patterns and the lazy "load the tab on demand" approach used for Releases (opening-cost budget). No new UI dependency. Every list has loading, empty, error-with-retry, long-content and permission states. Every number states its as-of time. Tables work at 320px (card layout under the first breakpoint). No raw values; `design-system:check` must pass. A new shared component needs the case in `docs/design/GOVERNANCE.md` §2.

## 6. Workflow catalog

Each workflow lists trigger, steps, approver, proposed target time (HYPOTHESIS, not a promise), the record, and the failure path. "FC" refers to `08`; "NF" to [`FINANCIAL_CONTROLS.md`](FINANCIAL_CONTROLS.md).

| ID | Workflow | Trigger | Key steps | Approver | Target | Record | If it fails |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W-01 | Individual checkout | Student starts | Select, tax address, consent, collect, capture, confirm, entitle, receipt | None (automatic) | Seconds | Attempt, journal, entitlement change | Customer sees "confirming"; inbox dead-letter alert; support route |
| W-02 | Institutional order | Quote accepted | Approvals, order form, signature, schedule, tenant plan | By band (FC-06, FC-07) | Per deal | Contract, tenant plan | Blocked step named; owner notified |
| W-03 | Invoice generation | Schedule date | Generate from order, tax, number, review first invoice, send, evidence | Second person for first invoice (FC-08) | Day of | Invoice, journal | Exception queue |
| W-04 | Cash application | Payment arrives | Match, allocate, clear unapplied | Finance | 2 business days (FC-10) | Allocation | Unapplied-cash exception |
| W-05 | Failed payment (individual) | `payment.failed` | Notice, retry per schedule, final notice, restrict paid entitlements only, recover | Automatic | 14-day grace | Dunning rows, notices | Escalate if notices bounce |
| W-06 | Collections (institution) | Past due | Ladder from reminder to counsel | By step | Cadence per ladder | Account log | Dispute pauses the disputed amount only |
| W-07 | Refund | Request | Policy check, approval, submit, confirm, journal, notice | Per band | 2 business days | `credits_refunds`, journal | Failed at rail → finance queue, customer told |
| W-08 | Credit memo | Request | Reason, approval, apply, journal | Per band | 2 business days | Credit memo | Unapplied credit exception |
| W-09 | Write-off | After ladder | Evidence, approval, journal | Per band | Monthly | Journal, register | Accountant review item |
| W-10 | Dispute | `dispute.opened` | Case, evidence, submit, outcome, journal | Finance | Before deadline | `disputes` | Missed deadline → incident review (FC-21) |
| W-11 | Cancellation | Student or contract | Rail first, record, end date notice | None / contract notice | Immediate request | Cancellation request | Rail refuses → nothing recorded, customer told |
| W-12 | Pricing exception | Request | Margin check, approval, expiry | Per band | Per deal | `pricing_exceptions` | Blocks the quote |
| W-13 | Tax exemption | Certificate submitted | Verify (≠ submitter), expiry alert | Finance | 3 business days | `tax_exemptions` | Standard treatment until verified |
| W-14 | Purchase order | Order | Cap check, link, over-cap flag | Finance | Day of | PO | Flag, not silent accept |
| W-15 | Daily reconciliation | Schedule | Passes 1, 2, 4, exceptions, alerts | Automatic | Daily | Run | Alert if the job did not run |
| W-16 | Weekly processor reconciliation | Weekly | Review by a second person | Finance (FC-11) | Weekly | Signed run | Escalate to CFO |
| W-17 | Month-end close | Month end | Bank pass, resolve exceptions, journals, checklist, close | CFO (FC-22) | Business day 5 (HYPOTHESIS) | Close record | Close blocked with reasons |
| W-18 | Manual journal | Need | Draft, second-person approval, no closed period | CFO (FC-14) | As needed | Journal | Refused |
| W-19 | Event replay | Dead letter | Inspect, fix cause, replay | `billing:replay` | Same day | Inbox, audit | Remains dead-lettered, alert |
| W-20 | Rail incident | Rail outage or `auth_failed` | Pause rail, communicate, backlog replay | Finance lead + engineering | Immediate | Incident record | Playbook |
| W-21 | Payment method change | Customer | Collect token, attach, detach old | None | Immediate | `payment_methods` | Retry |
| W-22 | Renewal | Notice date | Calendar, value at risk, price change per matrix | Per band | By notice date | Renewal row | Missed notice date is a revenue event |
| W-23 | Entitlement-to-billing reconciliation | Nightly | Compare, leakage report | Finance + RevOps (FC-09) | Monthly review | Leakage report | Exceptions |
| W-24 | Usage billing (stage 2) | Period end | Aggregate, rate, invoice lines, notice | Finance | Period end + 3 days | Usage records | Hold the invoice, not the customer |
| W-25 | Accounting export | Close | Export journals, accountant ack | CFO | Close + 1 day | Export log | Re-export is idempotent |
| W-26 | Policy adoption | Owner decision | Version, approve, activate, effective date | Owner + board where required (FC-02) | Per decision | Policy version | No active policy blocks requests |
| W-27 | Access review | Quarterly | Review who holds finance capabilities (FC-01) | CFO | Quarterly | Review record | Revoke |
| W-28 | Customer support: billing | Contact | Verify by account, no card data, route to W-07 / W-08 / W-11 | Support lead | 1 business day | Case | Escalate to finance |
| W-29 | Data right request | Customer | Export or delete; billing records kept per retention (D-132) | Privacy | Per policy | Data-rights record | Never blocked by a balance |
| W-30 | Student ledger entry (school) | School staff | Request, different approver, entry; threshold; close | Per school | School's | School ledger | School's process |

## 7. Tests

Role matrix (each role sees exactly its screens and actions; a non-finance role gets the permission state); pseudonymous default; reveal is logged; no input accepts a 13–19 digit run; every action is refused by the database when the policy is missing, expired or self-approved; screenshots of each state per the `run` skill; keyboard path and accessible names for icon-only controls (`lint:labels`); 320px.

## Evidence state

- **Repository evidence:** `Console.tsx` tabs and gating; `FinancialModel.tsx`; `commercial_core.sql` RLS helpers; D-1275 and D-1294.
- **Operational evidence:** none.
- **Missing proof:** every screen except the forecast tab.

## Cannot be completed from source code

Which people hold which roles; the authority bands; service targets (all hypotheses); the accountant's close procedure.
