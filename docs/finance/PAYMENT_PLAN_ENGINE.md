# Payment plan engine

| Control | Value |
| --- | --- |
| Status | **PROPOSED DESIGN — NOTHING HERE IS OPERATING, LIVE OR AUTHORIZED** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned (D-1154) |
| Evidence date | 2026-10-05 at repository revision `3bd382d` |
| Extends | D-146, `20260929230000_student_payment_plans.sql`, `app/src/lib/finance/plans.ts`, `app/src/lib/finance/accounts.ts` (`paymentPlan`, `planStanding`), `student-payment-plans.check.sql` |
| Claim ceiling | The school payment plan is a built, off schedule of installments. **Nothing collects an installment.** This document does not say Semester offers financing. |
| Prohibited claims | That Semester lends, finances, or collects installments; any interest, fee, or rate; that a plan can be paid through Semester. |

> Not legal or accounting advice. **[REQUIRES QUALIFIED REVIEW]** marks what needs a named professional.

## 1. Two different things share the name

| | **A. School payment plan** (exists, off) | **B. Semester installment plan** (does not exist) |
| --- | --- | --- |
| Whose receivable | The school's, on the student account ledger | Semester's, on a Semester invoice (an annual plan paid in parts, an institution paid in tranches) |
| Who decides | The school: an approver with `finance:approve` who did not ask | Semester finance under the approval policy |
| Money | Does not move through Semester (D-146) | Through a rail, if ever |
| Credit question | The school's policy; a legal question for the school | **Whether Semester is extending consumer credit is a counsel question (Q-26)** |

Keep the two apart in code, tables and copy. Part A is extended; part B is a design that is not built until counsel answers.

## 2. Part A: school payment plan (FACT, then PROPOSED)

### What exists

- A student asks (`student_payment_plans`: installments 2 to 24, `first_due`, `balance_cents` read from the ledger by the guard). The school's `student_account_settings` set the rules: `plans_offered`, `plan_min_down_percent` (10), `plan_max_installments` (6), `plan_min_installment_cents` (5,000, i.e. $50). The first date is today to 30 days out. One live plan (proposed or approved) per student.
- A trigger writes `student_payment_plan_installments`: the schedule sums to the balance to the cent (the last absorbs rounding), is immutable, and has no payment link.
- Decision: an approver with `finance:approve` who is not the requester approves or rejects; only an approver can cancel, with a reason. Withdraw by the student before decision.
- The financial hold is derived from the ledger (overdue beyond the school's window and above `hold_minimum_cents`, default $100); plan standing is computed in the app.
- **No installment is linked to a payment.** A payment entry in the ledger does not know which installment it satisfies.

### Proposed (extends, does not replace)

| # | Change | Purpose |
| --- | --- | --- |
| PP-1 | `student_payment_plan_installment_payments` linking an installment to the ledger payment entry that settled it (many-to-many, amount applied, applied_by) | Installments become satisfiable; standing is derivable |
| PP-2 | Server-side `plan_standing(plan)` returning current, late (days), defaulted, completed; the app and the hold use it | Today standing is app-computed (PIA open item) |
| PP-3 | Missed-installment workflow as school-side states: reminder due (a notice record, **not sent by Semester without the school's setting**), late, grace, default, with each step an append-only record | The brief's "missed installment workflow" |
| PP-4 | Plan change request (re-schedule, defer one installment) as a new request needing the same approver rule, never an edit of the schedule | Schedules are immutable; changes must be new versions |
| PP-5 | Plan terms record: the exact text shown to the student, its version, and consent time | The student must review terms (step in the brief's workflow); not recorded today |
| PP-6 | Effect on the hold: an approved plan in good standing suspends the financial hold for the covered balance, a defaulted plan reinstates it | Rule is the school's setting, visible, tested |
| PP-7 | Completion: all installments applied closes the plan; a cancelled plan leaves the ledger untouched | Terminal states |

### Lifecycle

```
student asks → balance read from ledger → policy check against settings → schedule generated (trigger)
→ student reviews terms (PP-5) → approver decides (not the requester)
→ approved: reminders (school setting) → payment entries applied to installments (PP-1)
→ on time: completed │ late: grace → default → hold reinstated (PP-6) │ cancelled by an approver with a reason
```

Every transition writes the existing tenant audit event (`audit_student_account_change`, actor's grant id). A plan never changes the ledger balance; it is a schedule over the balance.

## 3. Part B: Semester's own installment option (DESIGN ONLY, BLOCKED)

Examples: an annual Plus subscription paid in monthly parts; an institution's annual invoice paid in tranches. The institutional tranche is simply an **invoice schedule** ([`INSTITUTIONAL_BILLING.md`](INSTITUTIONAL_BILLING.md)), which is a contract payment term, not credit, and needs no engine beyond that schedule.

The student-facing one is different. A subscription billed monthly is already a recurring charge, not an installment plan. Offering an annual price payable in parts adds a **consumer-credit question**: whether it is credit, whether any disclosure, licensing or fee limit applies in a given state. Until counsel answers (Q-26, E1), Semester offers monthly and annual as two ordinary subscription prices and **no installment plan**. If cleared, design inputs are:

| Input | Position |
| --- | --- |
| Fees or interest | None; a plan priced differently from monthly is a pricing question, not a credit one, but still needs review |
| Collection | A stored token charged on the schedule (Mode B), each charge an idempotent attempt with a failure path |
| Failure | Dunning, not collections agencies; a missed part ends the plan at the period already paid |
| Disclosure | Terms text versioned and consented before the first charge |
| Student data | Plan status is not shared with any school unless the school pays |

Not designed: financing by a third party, deferred-interest or BNPL products, anything that reports to a credit bureau. Those are Class E (financial products and loans) in D-1236 and are prohibited as marketplace offerings.

## 4. Controls

| Control | Mechanism |
| --- | --- |
| Asker ≠ decider | Existing guard |
| Schedule sums to the cent, immutable | Existing trigger |
| One live plan | Existing partial unique index |
| Changes are new requests | PP-4 |
| Approver cannot self-approve a cancel | Existing |
| No card data in notes | Existing no-card pattern |
| Plan terms recorded | PP-5 |
| Idempotent application of payments to installments | PP-1 unique on (installment, payment entry) |

## 5. Tests

Existing `student-payment-plans.check.sql` (who may ask or decide, schedule sums, one live plan, immutability, cancel only by an approver with a reason) and `lib/finance/plans.test.ts`. New: application of a payment to installments (over, under, exact, out of order); standing at each boundary day; hold derivation matches the app function on fixtures; a revert of each guard goes red.

## Evidence state

- **Repository evidence:** the migration and code above; D-146 describes the plan defaults.
- **Operational evidence:** none; the feature has never been on for a school.
- **Missing proof:** PP-1 to PP-7; every part-B item.

## Cannot be completed from source code

Whether any Semester-run installment option is consumer credit; each school's own plan policy and limits; collection and hold policy a school adopts.
