# Semester company operating system

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Every financial number here comes from `docs/finance/`, which is labelled **"DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET"**. Opening cash in the model is **$0, a placeholder**; no company cash is evidenced and there is no real runway figure. Do not quote any number on this page as runway, revenue or a commitment. The company has no customer, no signed pilot and no revenue other than one live $7.99 Stripe test.

Semester must run itself with the quality it sells: one operating system for the company as well as the product. This page is the map. The depth lives in [`docs/company/`](../company/), [`docs/finance/`](../finance/README.md), [`docs/commercial/`](../commercial/README.md), [`docs/gtm/`](../gtm/), [`docs/strategy/`](../strategy/README.md), [`docs/sre/`](../sre/README.md), [`docs/operating-model/`](../operating-model/README.md) and [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

## Where the company actually stands

| Fact | Source |
| --- | --- |
| One named person, the founder (Harrison Rubin), holds or acts in every company seat; every backup is `UNASSIGNED` | `OWNER-AND-ACCOUNTABILITY-MATRIX.md` |
| 7 of 12 council seats are held (founder; product, engineering, accessibility, success, operations "acting"; privacy "outside counsel", a label only). Security, trust, data, finance and champion are vacant in `COUNCIL`. None has signed | `app/src/lib/launchreadiness.ts` |
| No advisor is engaged; target is nine roles by 2026-12-31 | `docs/strategy/ADVISORS.md` |
| No customer, champion, sponsor, cohort, pilot agreement or discovery finding | `ops/customer-commitments/README.md`; `docs/pilot/DISCOVERY-EVIDENCE-LOG.md`; `LAUNCH-RISK-REGISTER.md` FR-002 |
| Legal entity is attested only ("single-member LLC"); formation certificate, state, signing authority and IP chain unconfirmed; Vanderbilt IP and name question open | `docs/LAUNCH-DECISIONS.md`; FR-001 |
| Motions: individual acquisition CONDITIONAL GO; design-partner pilot GO for non-activation engagement only; paid institutional pilot NO-GO; enterprise sale NO-GO | `GO-NO-GO-DECISION.md` (2026-10-03) |
| External evidence: 0 of 18 closed (3 partial, 8 open, 7 blocked) | `docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md` |
| Only fact-level prices: Plus $7.99/mo and $59/yr, not on sale. Every institutional price is proposed | `docs/finance/13-REAL-NUMBERS-INTAKE.md` |

## The twenty-one company functions

Mapped from the brief's thirteen blocks and its operating-function table. "State" is what exists as evidence, not as a plan.

| Function | Owns | Seat today | State | Existing pack |
| --- | --- | --- | --- | --- |
| Corporate governance | Entity, board, policies, decision log | founder | Templates; entity facts unconfirmed | `docs/company/CORPORATE-GOVERNANCE-CHECKLIST.md` |
| Finance and runway | Budget, cash, collections, reporting | finance (vacant seat; founder primary) | Hypothesis model; $0 cash placeholder | `docs/finance/` |
| Pricing and packaging | Price book, entitlements | founder | Plus only is fact; three inconsistent institutional sets | `docs/commercial/PRICING-AND-PACKAGING.md` ("no current price book or selling authority") |
| Billing | Subscriptions, invoices, dunning | finance | Individual monthly path exercised once; institutional documented-unimplemented | `docs/commercial/ORDERING-AND-BILLING-OPERATIONS.md` |
| Sales and GTM | ICP, messaging, pipeline | founder | Playbooks; no pipeline | `docs/commercial/`, `docs/gtm/` |
| Marketing | Site, content, claims | founder | Site live per one report; 15 statements over evidence | `company-site/`, `docs/gtm/BRAND-AND-MARKETING-STRATEGY.md` |
| Customer success and implementation | Onboarding, health, renewal | success | Playbooks; no customer | `docs/commercial/CUSTOMER-SUCCESS-PLAYBOOK.md`, `INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md` |
| Support | Tickets, status, escalation | operations | One person; no rota | `docs/support/` |
| Product operations | Roadmap, requirements, decisions | product | Registers and program pack | `docs/program/`, `docs/product/` |
| Engineering | Architecture, quality, delivery | engineering | Strong repo discipline; main CI red; no ruleset | `docs/target-architecture/`, `docs/quality-system/` |
| Design | Research, interaction, system | product | Design system and audits; no user research recorded | `docs/product-design/` |
| Security | Access, vulnerabilities, evidence | security (vacant) | Findings register; no assessment | `docs/security/` |
| Compliance and trust | Frameworks, claims, trust room | trust (vacant) | Readiness matrices; no certification | `docs/trust/` |
| Privacy and legal | Data policy, contracts, holds | privacy (counsel label) | Drafts with 77 `[DECIDE]` placeholders; counsel not engaged | `docs/legal-drafts/`, `docs/COUNSEL-BRIEF.md` |
| Vendor management | Subprocessors, DPAs | founder | "No vendor risk-assessed; no DPAs on file" | `docs/trust/VENDOR-RISK-REGISTER.md` |
| Partnerships | Integrations, channels | founder | Strategy docs; no partner | `docs/commercial/PARTNER-AND-CHANNEL-STRATEGY.md` |
| People and hiring | Hiring, access lifecycle, training | founder | Gated hiring schedule; one person | `docs/finance/12-GATED-HIRING-SCHEDULE.md` |
| Risk management | Registers, review | founder | Four registers | [risk register](SEMESTER_RISK_REGISTER.md) |
| Incident and release operations | On-call, postmortems, releases | operations | Plans; no alert reaches a person | `docs/sre/` |
| Data and AI governance | Classification, model policy, spend | data (vacant), engineering | Designs and gates | `docs/operating-model/` |
| Operations Command Center | The console | operations | Built | [D31](SEMESTER_DOMAIN_CATALOG.md#d31-operations-command-center) |

## Operating cadence

From the brief; the existing rituals are in `docs/program/04-RITUALS-STATUS-ESCALATION.md` and `docs/operating-model/OPERATING-RHYTHM.md`. With one person the cadence is the same and the reviewer is missing. Until a second person exists, every review below records "self-review" and is not counted as independent evidence.

| Cadence | Review | Core questions | Artifact |
| --- | --- | --- | --- |
| Daily | Operations triage | What is broken, blocked, urgent, customer-impacting? | Console queue; incident log |
| Weekly | Product/engineering | What shipped, failed, learned, needs a decision? | Program status report (next due 2026-10-11) |
| Weekly | Revenue/pilot | What accounts moved, what is blocked, what closes next? | Pipeline view (empty today) |
| Weekly | Customer success | Which pilots or customers are at risk or ready to expand? | Health view (no customers) |
| Weekly | Security/reliability | What changed, what is vulnerable, what is consuming error budget? | Findings register delta; SLO readout |
| Monthly | Finance | Runway, spend, margin, collections, forecast variance | Intake sheet (real numbers first) |
| Monthly | Trust/compliance | What evidence, policy, vendor or review is due? | Evidence queue |
| Monthly | Leadership | Highest-leverage decisions and risks | Decision log |
| Quarterly | Strategy/OKR | What to stop, continue, fund, hire, replace, scale? | Scorecard (`docs/strategy/SCORECARD.md`) |
| Quarterly | Board/investor | What is true about traction, risks, capital, strategic choices? | Board package (`docs/finance/09-BOARD-REPORTING-PACKAGE.md`) |

## Executive dashboard

Fourteen tiles. Each states its source and whether it can be populated truthfully today. The console surfaces some from `lib/ops/`; no tile may show a number that is a placeholder without saying so.

| Tile | Metric | Source | Populated today |
| --- | --- | --- | --- |
| Revenue | MRR, ARR, bookings | Stripe, contracts | One test charge; no revenue |
| Pipeline | Qualified opportunities by stage | CRM tables (`gtm_*`) | Empty |
| Pilots | Active, scoped, exit status | `customer*`, pilot scorecard | None |
| Conversion | Pilot to annual | Pilot outcomes | None (hypothesis 50%) |
| Product adoption | Weekly active share; feature use | Analytics events (`docs/ANALYTICS-EVENTS.md`) | Pre-launch |
| Customer health | Score with named inputs | `docs/commercial/CUSTOMER-HEALTH-SCORE.md` | No customers |
| Churn risk | Reasons | Churn playbook | None |
| Support | Response and resolution | Tickets | One person; low volume |
| Reliability | SLO attainment, error budget | Production smoke; SLO doc | Targets unmeasured; one point-in-time smoke |
| Security | Open findings by severity | Findings register | 2 High, 8 Medium, 5 Low (F-01 to F-17; see trust model) |
| Compliance | Evidence due, certificates | Evidence queue | 0 of 18 closed |
| Cash runway | Months at current burn | Intake sheet | **Not computable: no real cash entered** |
| Hiring capacity | Seats filled, gates met | Gated hiring schedule | 1 person; 0 gates met |
| Risks requiring decision | Open P0/P1 | Risk register | See risk register |

## Commercial model

All proposed, none approved (`docs/finance/13-REAL-NUMBERS-INTAKE.md`, `docs/commercial/READINESS_GAP_MATRIX.md`).

| Package | Proposed figure | Status |
| --- | --- | --- |
| Individual Plus | $7.99/mo; $59/yr | **Fact** (D-134); not on sale; checkout held by flag |
| Individual Pro | Unpriced | Undecided |
| Institutional pilot | $12,000 software over 26 weeks + $15,000 implementation | Proposed |
| Department | $35K platform + $10 per student + $40K implementation | Proposed |
| Institution | $90K platform + $11 per active student + $120K implementation | Proposed |
| AI credit | $2.50 per attaching student | Proposed |
| Sales commission | 10% | Proposed |
| Pilot-to-annual conversion | 50% | Hypothesis |
| Marketplace take rate | 12% vs 15% | Conflict; D-1236 says undecided |

The public site shows "From $15K / yr · $35K · $75K" (claim C-01), which appears nowhere else in the repository. **Decision owed (founder):** one price book, and a test that the site, `plans.ts` and the finance model agree.

## Budget and capacity model

From the finance model's base case, quoted only to show the shape. Not a forecast.

| | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Revenue ($ thousands) | 159 | 1,386 | 4,717 |
| EBITDA ($ thousands) | (3,330) | (8,657) | (9,967) |
| Ending headcount | 25 | 44 | 50 |

Three-year net burn is about $21.1M against illustrative rounds of $4.5M (month 1), $14M (month 13) and $9M (month 26), with a six-month minimum-cash policy. The base case "books revenue that decision does not yet authorize". **Read this as a model of what the plan would cost, not of what the company has.** Thirty-seven of the 50 end-of-horizon heads are gated; 13 are core. Scenario 9 delays every flexible hire nine months. The gating evidence is in `docs/finance/12-GATED-HIRING-SCHEDULE.md` (ten gates, G9 first: seed closed plus a design-partner discovery programme under way).

### Capacity for the next twelve months, if no one is hired

One person has roughly the following capacity; this is a planning estimate, not a measurement.

| Work | Why a person is the constraint | Implication |
| --- | --- | --- |
| Engineering | Agents do implementation; review needs a human | Reviews are the bottleneck; X-06 is P0 |
| External evidence | Needs outside assessors and counsel with calendars | Start the longest-lead items first (EXT-008, EXT-006, EXT-003) |
| Discovery | Interviews are founder time | Ten interviews is a hard floor before further builds |
| Support and incidents | One person, no rota | No 24/7; no SLA; no paid pilot |

## Required team and ownership model

The minimum structure that makes each review independent, by gate in `docs/finance/12-GATED-HIRING-SCHEDULE.md`. Roles, not names.

| Seat | Needed by | Minimum | Release authority |
| --- | --- | --- | --- |
| Independent reviewer for security, privacy, release | Before any pilot data | A contract or advisory reviewer | Founder engages |
| Counsel | Before public policies, paper, claims | A named firm | Founder |
| Qualified accessibility evaluator | Before any "accessible" claim | A named evaluator | Founder |
| Second operator | Before two-person controls can run | A person with console and break-glass | Founder |
| Customer-side seven seats | Before activation | Named by the design partner | Institution |
| Mobile/offline, accessibility lead, QA/SDET | Gate G1 | Four hires | CEO + CTO |
| Integration engineers, solutions engineer | Gate G2 | Three | CEO + CRO |
| Security/GRC, privacy and compliance | Gate G3 | Two | CEO + CFO |

## Company policies that exist as templates

`docs/company/`: document control, expense approval, financial controls, policy exception, procurement and vendor management, records retention schedule (draft), insurance readiness, tax and accounting readiness, business continuity, crisis communications, founder decision log, quarterly operating review, board or advisor update. None is an approved policy; the first approval is a decision for the founder with counsel.

## What to do first, in company terms

1. Enter real cash and costs (X-10). Everything else in the finance model is hypothetical until then.
2. Engage counsel and an independent reviewer (X-06, X-08).
3. Ten discovery interviews, recorded (X-12).
4. Decide Track B (X-13).
5. Do not publish a price, an SLA, an uptime figure or a customer reference until its claim row is approved.
