# Real-numbers intake: replacing placeholders with the company's own figures

| Control | Value |
| --- | --- |
| Status | **DRAFT INTAKE FORM. EVERY BLANK IS AN OWNER DECISION OR A DOCUMENT THE OWNER HOLDS; NOTHING IN THIS FILE IS A FIGURE OF THE COMPANY** |
| Owner | Harrison Rubin: finance owner; qualified accountant, tax adviser, counsel and broker unassigned |
| Evidence date | 2026-10-04 at repository revision `f318c19` |
| Source | [`assumption-register.md`](assumption-register.md) (IDs below), the workbook's `Assumptions` and `Scenario_Control` sheets, [`10-GO-NO-GO-GATES.md`](10-GO-NO-GO-GATES.md) |
| Claim ceiling | Semester may use this to collect inputs for its internal model. |
| Prohibited claims | Do not enter a number here that is not backed by a document, a signed decision or a quote you can name. A guess entered as an input becomes the model's fact the next time it is read. |

> The model's outputs are only as good as the inputs this form replaces. Entering a number does not make it approved: prices need the deal desk and counsel, financing terms need counsel and the board, and tax and accounting treatment needs the qualified professionals named in [`06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`](06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md).

## How to use it

1. For each row, write the value, **the source** (a bank statement, a quote, a signed decision, an invoice) and **the date**. "Don't know" is a valid answer and keeps the placeholder.
2. Rows marked **ask** are decisions only you can make. Rows marked **document** want a document, not an opinion.
3. When a section is complete, the update procedure at the end applies it to the workbook and re-proves every scenario. Nothing is changed until then.

## 1. Cash and funding

The model's opening cash is **$0**, a placeholder: no company cash is evidenced in the repository. The three financing rounds are illustrative.

| ID | Input | Today in the model | Your value | Source, date | Kind |
| --- | --- | --- | --- | --- | --- |
| A-002 | Opening cash on the first day of model month 1 (reconciled bank balance) | $0 | | | document |
| A-001 | First month of the model | Nov 2026 | | | ask |
| A-137, A-138 | Round 1 (seed): amount and month | $4.5M in month 1 | | Term sheet, SAFE or note, or "not raising" | document |
| A-139, A-140 | Round 2 (Series A): amount and month | $14M in month 13 | | | ask |
| A-141, A-142 | Round 3: amount and month | $9M in month 26 | | | ask |
| A-136 | Legal and closing cost on equity raises | 3% | | Counsel's estimate | document |
| A-143 | Minimum cash policy, in months of net burn | 6 | | | ask |
| | Other funding: grants, non-dilutive money, founder loans, revenue already booked | none | | | document |
| | Existing debts, deferred pay or commitments the model does not know about | none | | | document |

Two answers move the most. **Opening cash** sets whether the first tranche is a bridge or a real seed; and **whether the seed will be raised at all** decides whether the staged, gated plan or a bootstrapped plan is the right comparison. If you are not raising, tell me and I will add a bootstrap scenario that holds hiring to what cash allows.

## 2. Price points

Only the Plus price is a documented fact (A-011 $7.99 a month and A-012 $59 a year, decision D-134). Every institutional price below is **PROPOSED**: no approved price book exists, and a price is not evidence of willingness to pay.

| ID | Input | Today in the model | Your value | Source, date | Kind |
| --- | --- | --- | --- | --- | --- |
| A-011, A-012 | Plus monthly and annual price | $7.99, $59 | confirm | D-134 | confirm |
| A-013 | Average promotion or campus-code discount | 8% | | Any promotion actually run | document |
| A-024 | Premium AI add-on price (monthly) | $4.99 | | | ask |
| A-026 | Pilot software fee (whole 26 weeks) | $12,000 | | A quoted or agreed figure, or "unpaid" | ask |
| A-028 | Pilot implementation fee | $15,000 | | | ask |
| A-034, A-036 | Department: annual platform fee and per-student price | $35,000; $10 | | | ask |
| A-037 | Department: implementation fee | $40,000 | | | ask |
| A-044, A-046 | Institution: annual platform fee and per-student price | $90,000; $11 | | | ask |
| A-047 | Institution: implementation fee | $120,000 | | | ask |
| A-074 | Institution AI credit price per attaching student | $2.50 a year | | | ask |
| A-059 | Sales commission on first-year ACV | 10% | | An offer, a plan document or "none yet" | ask |

If any price is "unpaid" or "not yet decided" because of the go/no-go decision, say so: scenario 8 already holds paid pilots behind their gate, so an unpaid design-partner pilot is a legitimate answer and is modeled as a cost with no fee (see the limits in [`10-GO-NO-GO-GATES.md`](10-GO-NO-GO-GATES.md)).

## 3. Volume and conversion hypotheses

These are hypotheses until [`11-PILOT-EVIDENCE-PLAN.md`](11-PILOT-EVIDENCE-PLAN.md) produces a reading. Enter only what you have evidence for.

| ID | Input | Today in the model | Your value | Evidence, date | Kind |
| --- | --- | --- | --- | --- | --- |
| A-025 | Pilots signed per year | 4 / 10 / 14 | | Discovery log entries, or "none yet" | document |
| A-031 | Pilot-to-annual conversion | 50% | | A measured reading, or "none" | document |
| A-033, A-043 | Direct Department and Institution logos per year | 1 / 8 / 18 and 0 / 3 / 9 | | | ask |
| A-005 | Paid student-acquisition budget | $30k / $90k / $150k a year | | Only if the go/no-go conditions allow it | ask |
| A-009 | Activated-to-paid (Plus) conversion | 6.0% / 6.5% / 7.0% | | A cohort reading, or "none" | document |

## 4. People

Founder pay is a board decision and the model's numbers are placeholders.

| Input | Today in the model | Your value | Source |
| --- | --- | --- | --- |
| CEO / founder base pay | $90,000 | | Decision record or "unpaid until" |
| CTO / co-founder base pay | $130,000 | | |
| Who is actually on the team today (roles and start dates) | 3 heads in month 1 | | Offer letters, contracts |
| A-003, A-004 | Wage inflation; employer burden | 3%; 20% | Payroll provider's or PEO's quote |
| A-133, A-134 | Onboarding cost per hire; recruiting fee as a share of base | $3,500; 12% | Recruiter quote |
| A-129 to A-132 | Software, workspace, payroll and travel per head | $450; $300; $20; $350 a month | Actual subscriptions |

## 5. Vendors and operating costs

Replace the placeholder with the quote or the invoice. Vendor prices (A-084 onward) should come from the vendor's current price page; list prices change.

| ID | Input | Today in the model | Your value | Source, date | Kind |
| --- | --- | --- | --- | --- | --- |
| A-084 to A-099 | AI inference prices and usage assumptions | See register | | Current vendor price pages and your usage logs | document |
| A-102, A-103 | Platform hosting, fixed and variable | $4,000 / $9,000 / $16,000 a month; $0.08 per active user | | Cloud invoices | document |
| A-105, A-108 | Object storage; egress | $0.02 per GB-month; $0.05 per GB | | | document |
| A-123 | Security and compliance programme | $60k / $180k / $260k a year | | Assessor and tooling quotes | document |
| A-124 | Accessibility audits | $25k / $50k / $60k a year | | Assessor quote | document |
| A-125 | Outside counsel | $120k / $200k / $320k a year | | Engagement letter or fee estimate | document |
| A-126 | Insurance premiums | $30k / $75k / $140k a year | | Broker quote | document |
| A-127 | Accounting, bookkeeping, tax and first audit | $40k / $90k / $220k a year | | Accountant's quote | document |
| A-020, A-021, A-022 | Card fees; app-store commission | 2.9% + $0.30; 15% | | Processor and store terms | document |

## 6. Go/no-go gate months

The five gate months are your decisions, not the model's predictions. Enter the month you would *plan* for and the evidence you expect to have by then.

| ID | Gate | Today | Your month | Evidence you expect to have |
| --- | --- | --- | --- | --- |
| A-160 | Broad or paid individual acquisition | 15 (Jan 2028) | | |
| A-161 | Share of registrations run as invitation-only before that gate | 25% | | |
| A-162 | First paid institutional pilot signed | 12 (Oct 2027) | | |
| A-163 | Direct Department annual sales | 24 (Oct 2028) | | |
| A-164 | Direct Institution-segment sales | 28 (Feb 2029) | | |

For the ten hiring gates in [`12-GATED-HIRING-SCHEDULE.md`](12-GATED-HIRING-SCHEDULE.md), say which gate months you would change, and whether any should be split.

## 7. Questions only a professional can close

Name who you will ask; none of these is decided here.

| Question | Professional | Named? |
| --- | --- | --- |
| Entity and signing authority; fiscal year; equity structure | Counsel; accountant | |
| Revenue recognition for pilots, implementation, AI usage and the marketplace | Accountant | |
| Sales tax or VAT on software, services and marketplace sales | Tax adviser | |
| App-store rules for subscriptions and education apps | Counsel | |
| Credit-loss method and bad-debt allowance (A-058) | Accountant | |
| Cyber, tech E&O, GL and D&O coverage; certificates buyers ask for | Broker | |

## Applying your answers

When you return a section, the update is partly scripted:

1. Edit the value in `Assumptions` column D (or the scenario's column on `Scenario_Control`) and note it in the register.
2. **The pasted snapshots go stale on any input change, and the guard will say so.** `Scenario_Results` (all nine rows) and the pasted columns of `Gate_Schedule` hold values from the current inputs. `tools/verify_scenarios.py` fails when they drift, which is its job. `tools/fill_snapshot.py` today rewrites only scenarios 8 and 9 and treats drift in 1 to 7 as a failure, so a real-input update needs a snapshot refresh for all nine scenarios and the gate columns first; I will write that when the first real numbers arrive.
3. `python3 docs/finance/tools/build_dashboard.py` rebuilds the dashboard from the workbook.
4. The decision to adopt each number is recorded in the decision log with its source; the numbers in the other documents in this folder are then refreshed from the new results, never edited by hand.

A value that fails a check is shown, not hidden. If a real number makes a scenario unfundable, that is the finding, and the board pack should say so.
