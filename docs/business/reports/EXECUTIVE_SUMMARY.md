# Semester GTM, finance, sales and compliance: executive summary

| Control | Value |
| --- | --- |
| Status | **DRAFT, INTERNAL. PLANNING ASSUMPTIONS. NOT APPROVED BY ANY NAMED OWNER.** |
| Owner | Harrison Rubin (interim; counsel, accountant, broker and security assessor unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` plus this branch |
| Labels used | `[VERIFIED]` `[ASSUMPTION]` `[DRAFT]` `[INTERNAL]` `[REVIEW: ...]`. `[APPROVED]` count: **0** |

> Operating summary. Not legal, tax, accounting, insurance, privacy, security or accessibility advice.

## What this is `[DRAFT]`

A go-to-market and operating system for Semester built on what the repository already holds, extended only where something was missing. It has five parts: a master GTM playbook, an in-app financial model, a 15-sequence institutional outreach system, a cloud security and compliance plan, and this report. The existing-versus-missing inventory is in `docs/business/INVENTORY.md`.

## The commercial thesis `[ASSUMPTION]`

Two engines. **Institutional revenue:** sell one narrow, measurable workflow, the Registration Readiness Pilot, to a named sponsor for a defined cohort, then convert it to an annual agreement and expand. **Student adoption:** create immediate utility and measure activation, first meaningful action, workflow completion, weekly use and satisfaction, so that measured outcomes become the proof for renewal. Semester is not sold as a replacement for every university system.

## What may be done today `[VERIFIED]` (`GO-NO-GO-DECISION.md`, 2026-10-03)

| Motion | Decision | Allowed now |
| --- | --- | --- |
| Individual students | Conditional GO | Invitation-only, unpaid validation |
| Design-partner institutional pilot | GO for non-activation work only | Discovery, synthetic demos, evidence exchange, conditional scoping |
| Paid institutional pilot | **NO-GO / RED** | Preparation only: no payment, no live data, no launch obligation |
| Broad enterprise sale | **NO-GO / RED** | Learning only |

Every artifact in this system carries a Gate statement saying what is allowed now and what is held. Nothing here authorises a price, a payment, live data or a customer claim.

## What was built `[VERIFIED]`

| Part | Where | What it is |
| --- | --- | --- |
| Finance model | `app/src/finance/`, Console **Finance model** tab | A 36-month engine, 12 scenarios, about 100 validated inputs, two sensitivity matrices, five warnings, five exports; 97 tests; every output labelled a forecast |
| GTM documents | `docs/business/gtm/` | Master playbook (sections A to J), customer-safe version, 90-day plan, KPI tree |
| Sales system | `docs/business/sales/` | 15 outreach sequences (29 email blocks, each with persona, trigger, action, A/B, CRM record, timing, stop condition, compliance note), discovery script, proposal, action plan, 36 objections, CRM pipeline with a 100-account template |
| Customer success | `docs/business/customer-success/`, `templates/` | Onboarding workflow, pilot success plan, health score, renewal playbook, eight fill-in templates |
| Compliance | `docs/business/compliance/` | Ten consolidated views over `docs/trust/`, including a 99-row evidence register with the brief's columns |

## What the model says `[ASSUMPTION]` (Forecast)

At the default assumptions (lean founder-led team, 20 accounts contacted a month, paid pilots from month 7) the Base case reaches about **$110k ARR in month 36**, never breaks even inside 36 months, and needs about **$724k of funding** to keep cash at zero. Only the Ambitious scenario breaks even (month 35). The finding is volume: at about three pilots a year the plan does not carry even a lean team. LTV : CAC is about 1.4x on unvalidated retention. Every rate is a placeholder until the first design-partner engagement measures it.

## Decisions that need the founder `[INTERNAL]`

1. **Pilot length.** Code enforces 26 weeks (D-134); the brief assumes 8 to 12 weeks.
2. **Student price.** D-134 $7.99 / $59; D-1154 $15 per month; the brief $8.99 / $69. None is approved.
3. **Institutional price and unit.** Per enrolled student ($18) versus per active student; the $30,000 minimum sits between the deal-desk department and campus minimums.
4. **AI pool.** 2,400 requests per student per year may cost more than the platform fee; "request" needs a definition.
5. **Whether and when to price a pilot at all**, given the paid-pilot NO-GO.

## Top 10 next actions, in order `[DRAFT]`

1. Decide conflicts 1 to 5 and record them as a decision.
2. Engage higher-ed SaaS counsel for pilot paper, DPA and public wording; fix the public 72-hour breach-notice wording first. `[REVIEW: counsel]`
3. Engage an accountant and tax adviser and a broker; replace the model's placeholders (opening cash, insurance, accounting, obligations) with quotes. `[REVIEW: accounting]` `[REVIEW: tax]` `[REVIEW: insurance]`
4. Get quotes for the independent security assessment and the accessibility review (go/no-go blockers 2 and 3). `[REVIEW: security]` `[REVIEW: accessibility]`
5. Correct existing wording that exceeds the claims register: HECVAT draft rows, privacy page, RFP library entries.
6. Build the 100-account list with a recorded reason for outreach on each account, and send sequences 1 to 7 only.
7. Hold 10 discovery calls; record them in the CRM; qualify one design partner.
8. Run a synthetic-data demo and a pilot design session; capture baselines.
9. Name a backup owner and run the first restore and rollback exercise (blockers 6 and 7).
10. Re-run the model monthly with real numbers; start the weekly revenue review.

## Evidence state

**Repository evidence.** The model, tests and documents exist and link to their sources. **Operational evidence.** None: no customer, pilot, outcome, price, certification, assessment, contract or measured financial figure exists. **Missing proof.** See the compliance evidence register and the P0 blockers in the 90-day plan.

## Claim ceiling

Internal planning and discussion with professionals and advisers.

## Prohibited claims

No customer, outcome, price, forecast, certification, compliance, integration or availability claim, to anyone, on the strength of this document.

## Professional review required

`[REVIEW: counsel]` pricing, pilot paper, public wording. `[REVIEW: accounting]` `[REVIEW: tax]` model treatment. `[REVIEW: insurance]` coverage. `[REVIEW: security]` `[REVIEW: privacy]` `[REVIEW: accessibility]` control and conformance statements. `[REVIEW: procurement]` how limits are presented.
