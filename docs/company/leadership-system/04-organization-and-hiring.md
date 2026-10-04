# 4 and 5 · Organization design and hiring

> **PROPOSED — NOT ADOPTED.** Headcount figures are `[HYPOTHESIS]` ranges to be reconciled at each stage review. Compensation contains **principles only**; no salary or equity figure appears in this repository. Employment, classification, equity and tax points are `[COUNSEL]`.

---

# Part A — Organization design by stage

## Relationship to the CTO architecture pack

[`docs/target-architecture/08-ORGANIZATION-AND-MILESTONES.md`](../../target-architecture/08-ORGANIZATION-AND-MILESTONES.md) (merged in #1144, after this work began) already proposes the **engineering** team topology, a technical staffing sequence and the architecture-review process. This page does not restate them.

| Topic | Where it lives | Note |
| --- | --- | --- |
| Engineering team topology, collapsing rules, architecture review | The CTO pack | **Authoritative for engineering.** The "Team topology" section below covers only company-level shape |
| First technical hires | Both | **They agree on hire #1:** a platform/SRE engineer who becomes the second operator, to retire the single-holder production risk. Order after that is the CTO pack's for engineering and this page's for the rest |
| What triggers a hire | This page | The CTO pack's staffing table is a *funded-build* hypothesis keyed to T0 (the day the first engineer beyond the founder starts). This page keys hires to **evidence and a named risk**, so a hire is justified even before funding and is not forced by it |
| Non-engineering functions (counsel, finance, support, implementation, go-to-market, trust) | This page | The CTO pack names counsel, a support lead, finance/revenue operations and an implementation lead as gates and defers them to the CEO and CFO: this page is that input |
| Headcount | Reconcile at each stage review | Ranges here are company-wide `[HYPOTHESIS]`; the CTO pack's S1/S2 tech counts fall inside the Seed and Series A ranges |
| Contract engineers | CTO pack | Contract engineers do not hold production access or approve changes; the [delegation matrix](02-decision-rights.md#delegation-matrix) applies the same rule |

## The starting point

All 15 company-side seats have the same person as primary and no backup ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)). The 12 launch-council seats ([`launchreadiness.ts`](../../../app/src/lib/launchreadiness.ts)) are held or vacant, and none has signed. A conventional org chart of function-by-function executives (as in the audit's role map) would be a list of vacancies. This design is organised around **seats, risks and triggers** instead.

## Principles

1. **Seats, not titles.** A seat is a set of accountabilities that must be held. A person holds one or more seats. Titles are assigned late.
2. **Retire the largest unmitigated risk first.** Order hires by key-person concentration, then by missing independent evidence, then by delivery bottleneck.
3. **Independence by design.** Seats that build and seats that accept are split as soon as a second person exists; before then the acceptor is external.
4. **Small teams, one owner.** Teams of 4–7, one accountable lead, one mission. Two layers of management until about 40 people.
5. **Domains are staffed by commitment.** The audit's twelve bounded domains are all requirements. Only domains in a committed motion get a squad; the rest are owned by Core and not marketed.
6. **Contract and fractional first for specialists and independent roles**; employees for the core product and the customer relationship.
7. **Reorganise rarely.** A reorg is a Class B decision with a record, no more than once in two quarters.

## Stage triggers

A stage is entered when its **triggers** are evidenced. Funding alone is never a trigger. Thresholds are `[DECIDE: F8]`; the qualitative triggers are `[PROPOSE]`.

| From → to | Trigger (any two, evidenced) |
| --- | --- |
| **Pre-seed → Seed** | A design-partner agreement with at least one binding commitment is signed (the commitment register is non-empty) · Founder capacity is over 100% of stated hours for two consecutive months · A named seat blocks a GO and no external stand-in exists · A first financing is agreed · Weekly active students and return rate have stable readings for two quarters |
| **Seed → Series A** | More than one institution in controlled operation with repeatable implementation · A second market motion (for example paid pilot) is GO · No seat is single-held and the unplug drill passes · A function (security, privacy, success) is larger than one part-time role · Financing closes |
| **Series A → Growth** | Repeatable multi-institution delivery with measured implementation time and support load · Multiple domain squads in committed motions · Independent assurance renewed on a schedule · A leadership layer is needed to keep spans under 8 |
| **Any stage backwards** | A trust-floor incident, an expired evidence item that withdraws a GO, or runway below the approved trigger returns the affected motion to PAUSE and reduces scope; it does not reduce the controls |

## The four stages

| | **Pre-seed (today)** | **Seed** | **Series A** | **Growth** |
| --- | --- | --- | --- | --- |
| **People** `[HYPOTHESIS]` | 1–4: founder plus part-time student builders and contractors | 5–12 | 15–35 | 50–150 |
| **Shape** | One working team; no managers; seats grouped into four **hats** (below) | One product-and-engineering team; first function leads; a small trust function | Functional leads plus **domain squads** for committed domains; a standing platform-trust squad | Functions with directors; squads grouped into product areas; leadership layer |
| **Leadership** | Founder + advisor council | Founder + 2–3 function leads (engineering, customer, trust or finance by need) | Function heads: engineering, product and design, customer, trust, go-to-market, finance and operations | Executive team; titles formalised |
| **Who holds independence** | External: counsel, assessor, evaluator, CPA, operator advisor; gates in code | First non-founder engineer is the second reviewer; assessor still external | Security, privacy and accessibility report outside the engineering line | Audit and trust committees |
| **Operating forums** | Weekly review, monthly note, quarterly QBR ([07](07-communications-and-tracking.md)) | Adds a weekly leadership sync and per-release council | Adds committees and the full [AI board](../../operating-model/AI-GOVERNANCE-BOARD.md) | Adds functional QBRs and an annual operating cycle |
| **Main org risk** | One person is every control | Founder becomes the bottleneck for every decision | Silos between squads and trust; inconsistent standards | Process outruns judgment; culture dilution |
| **Counter** | Bus-factor sprint, external independence | Delegation matrix actually used | Platform-trust squad and one standards owner | Deletion reviews; hiring-bar owner |

## Pre-seed: four hats instead of fifteen seats

The 15 owner-matrix seats collapse into four hats so the founder can see the real conflicts.

| Hat | Seats (from the owner matrix) | Conflict if one person holds it | Independent source now |
| --- | --- | --- | --- |
| **Build and operate** | Engineering/Operations, Design, Vendor management | Builds and accepts own changes; sole production access | Second reviewer on trust-floor changes; gates in code; second admin on accounts |
| **Trust** | Security, Privacy/Data, Accessibility | Same person produces and accepts evidence | Independent assessor; retained counsel; qualified accessibility evaluator |
| **Customer and revenue** | Product, Revenue/Deal Desk, Implementation, Customer Success, Support, Communications | Sells commitments it must deliver | Deal-desk rules; capacity covenant ([08](08-continuity.md#capacity-covenant)); counsel on paper |
| **Company** | Founder/CEO, Finance/Business Ops, Legal coordinator | Authority, money and legal in one hand | CPA, counsel, operator advisor; board-style consults |

## Seat map across stages

Which seat is held by whom as the company grows. "Fractional" means a part-time or contract holder who is not the founder.

| Seat | Pre-seed | Seed | Series A | Growth |
| --- | --- | --- | --- | --- |
| Founder/CEO | Founder | Founder | Founder/CEO | CEO |
| Product | Founder | Founder, first product/design hire | Product lead | Product leaders by area |
| Engineering/Operations | Founder + contractor backup | First platform engineer(s); on-call rota of two | Engineering lead; SRE function | VP-level engineering |
| Security | Founder coordinates; **external assessor; fractional lead** | Fractional lead, then first security hire | Security lead outside engineering | Security org; CISO if warranted |
| Privacy/Data | Founder coordinates; **counsel; practitioner advisor** | Part-time privacy/compliance | Privacy lead | Privacy office |
| Accessibility | Founder coordinates; **qualified external evaluator** | Designer with accessibility depth + evaluator | Accessibility specialist | Accessibility program |
| Design | Founder | First designer | Design lead | Design org |
| Revenue/Deal Desk | Founder with deal-desk rules | Founder + seller or partnerships lead | Go-to-market lead | Revenue org |
| Finance/Business Ops | Founder + **CPA/bookkeeper (fractional)** | Fractional finance/ops | Finance and operations lead | Finance org |
| Legal coordinator | Founder + **retained counsel** | Same | Counsel on retainer or in-house at scale | General counsel |
| Vendor management | Founder | Ops generalist | Operations lead | Procurement/vendor mgmt |
| Implementation | Founder | First implementation lead | Implementation team | Implementation org |
| Customer Success | Founder | Same person as implementation, then split | Success team | Success org |
| Support | Founder | Shared support rota, tooling | Support lead; tiering | Support org |
| Communications | Founder | Founder | Communications owner | Communications org |

## Team topology

Company-level shape only; for the engineering team structure and collapsing rules see the [CTO pack](../../target-architecture/08-ORGANIZATION-AND-MILESTONES.md#2-team-topology-team-topologies-vocabulary).

- **Platform-trust squad** (from Seed): identity, tenancy, policy, audit and authorization. Every domain depends on it, so it has a standing owner from the first non-founder engineer on. This follows the audit's identity-policy-audit spine.
- **Domain squads** (from Series A, on commitment): a squad per domain in a committed motion, for example Academic core, Learning, Productivity, or Campus. A squad owns its service, data, runbook, SLO and support routing.
- **Platform services** (as scale needs): AI gateway, integration hub, notification, search, reporting.
- **Size and span:** 4–7 per squad; span of control 6–8; a new layer only when a lead cannot give each report a real 1:1.
- **Domains not staffed** are listed with owner "Core" in the capability register and never appear in public claims beyond what the claims register allows.

## Student-specific talent

| Topic | Approach | `[COUNSEL]` |
| --- | --- | --- |
| Student builders and interns | Paid, scoped work with a real owner; a defined learning and delivery outcome; no unpaid production responsibility | Classification and wage rules; university internship and IP rules |
| Campus ambassadors | Not employees by default; defined, limited tasks; no access to student data | Status, compensation, and the university's name |
| Student advisory seats | A small stipend (F11), real written-response rights, rotation every two terms | Compensation treatment |
| Academic calendar | Founder and student-builder capacity is planned by term; launches and commitments avoid exam windows ([09](09-calendar.md)) | — |
| Graduation and transition | Every student-held seat has a documented handover 8 weeks before a known transition | IP and access removal |

## Org change record

Any change to the seat map, reporting line or squad structure is recorded with: reason, affected people and seats, what changes for decision rights, the backup plan, and a review date. Employment consequences go to counsel first.

---

# Part B — Hiring

## Principles

1. **Hire to retire a named risk.** A requisition states the seat, the risk it retires, the trigger that justifies it, and the outcome expected in the first 90 days.
2. **Engagements before employees.** Counsel, a CPA and an insurance broker come before the first employee.
3. **A hiring bar is owned.** One person is accountable for the bar in each function. A hire who lowers it is a decision, not a drift.
4. **Trust and integrity are not compensable.** A strong signal of concern on integrity ends the process regardless of other strengths.
5. **Structured over charming.** Same questions, scored against the rubric, before discussing with anyone.
6. **Speed is a courtesy and a competitive edge.** Targets in [interview loops](#interview-loops).

## Sequence of the first ten

Order is `[PROPOSE]`; each is triggered by evidence, not by calendar. Where an item can be a contract role first, it should be.

| # | Seat / role | Type | Trigger | Risk it retires | First-90-day outcome |
| ---: | --- | --- | --- | --- | --- |
| 0a | **Corporate and privacy counsel** | Engagement | Immediately | Legal authority; every `[COUNSEL]` item | Entity, IP assignments, advisor agreements, pilot paper first pass |
| 0b | **CPA and bookkeeper** | Engagement | Immediately | Financial controls; runway visible | Chart of accounts, monthly close, 13-week cash view |
| 0c | **Insurance broker** | Engagement | Before first paid or live-data engagement | Uninsured exposure | Coverage assessment; contract statements match bound cover |
| 1 | **Platform engineer** (backup for Engineering/Operations; second reviewer) | Employee or long-term contractor | A backup seat blocks a GO; the founder is the only holder of production access | Production bus factor; builder = acceptor | Runs the restore drill and an on-call week; ships behind the real gates in week one |
| 2 | **Security lead** | Fractional first | Before any tenant with live data | Independent security evidence | Threat models for identity and tenancy; assessor engaged; access review run |
| 3 | **Implementation and support lead** | Employee | First design-partner agreement signed | Founder delivers what the founder sells; support coverage | Runs a pilot plan to the scoped acceptance; first support rota and tested channel |
| 4 | **Product designer with accessibility depth** | Employee | Accessibility baseline filed and a backlog exists | Quality of the core journey; accessibility as practice | Closes the first baseline findings; owns the design system's accessibility checks |
| 5 | **Second engineer** (mobile and offline, or domain) | Employee | The first committed domain beyond Core | Delivery capacity | Owns one domain's runbook and SLO |
| 6 | **Data and AI engineer / evaluator** | Employee or fractional | An AI use case moves toward G3 | AI quality and cost, evaluation evidence | Evaluation harness running on a schedule; cost per successful outcome measured |
| 7 | **Partnerships / sales lead with higher-ed experience** | Employee | Repeatable discovery and a qualified pipeline | Founder-led sales ceiling | Qualified pipeline source of record; procurement response library |
| 8 | **Finance and operations lead** | Fractional → employee | Runway horizon or contract volume exceeds what a CPA covers | Financial controls at scale | Month-end close in days; vendor and contract calendar |
| 9 | **Privacy and compliance lead** | Fractional → employee | More than one tenant or any minors/regulated data | Data-rights operation; evidence for security reviews | Data-rights clock met; HECVAT evidence maintained |
| 10 | **Chief of staff / operator** | Employee | Founder time on coordination exceeds a stated share `[DECIDE]` | Founder as coordination bottleneck | Runs the operating cadence and decision log |

**Do not hire early:** executives for functions with no work yet, a full sales team before one repeatable motion, a marketplace team before a marketplace is in a committed motion.

## Hiring plan by function

Ranges are headcount including fractional FTE `[HYPOTHESIS]`.

| Function | Pre-seed | Seed | Series A | Growth |
| --- | --- | --- | --- | --- |
| Engineering and platform | 0–1 | 2–4 | 6–12 | 20–50 |
| Product and design | 0 (founder) | 1–2 | 3–6 | 8–20 |
| Data and AI | 0 | 0–1 | 2–4 | 5–12 |
| Security, privacy, accessibility | External; fractional | 1–2 | 3–5 | 8–15 |
| Customer: implementation, success, support | 0 (founder) | 1–2 | 4–8 | 12–35 |
| Go-to-market | 0 (founder) | 0–1 | 2–5 | 8–25 |
| Finance and operations | External | 0–1 (fractional) | 2–3 | 5–12 |
| People and talent | Founder | Founder + contract recruiter | 1 | 3–6 |
| Legal | External | External | External | In-house at scale |

## Competency rubric

Seven core competencies for everyone, then function-specific ones. Each is scored 1–4 against behaviors, not adjectives. **Trust and integrity is a gate:** a 1 or a serious concern ends the process.

| Score | Meaning |
| ---: | --- |
| 1 | Does not meet the bar for the level |
| 2 | Partly meets: mixed evidence |
| 3 | Meets the bar for the level, with clear evidence |
| 4 | Clearly exceeds; evidence of operating a level above |

### Core competencies

| Competency | What 3 looks like (at the expected level) | What 4 adds |
| --- | --- | --- |
| **Trust and integrity** *(gate)* | Tells the truth under pressure, names limitations, handles others' data and confidences as if they were their own, owns mistakes without defensiveness | Makes others safer to be honest; has changed an outcome by raising a hard truth early |
| **Ownership** | Takes an outcome from ambiguity to done; finds the gap before it is reported; says clearly when something will not be done | Owns cross-team outcomes; builds mechanisms so the outcome does not depend on them |
| **Student and user judgment** | Anchors choices on what a real student or user needs; can name what they have learned from users and what they would change | Challenges the stated requirement with evidence from users; protects the user's agency against the buyer's convenience |
| **Execution quality** | Ships small, tested, reversible work; proves a change worked; leaves things better documented | Sets the standard others copy; prevents a class of failure, not just an instance |
| **Clear thinking and writing** | Reasons from evidence; writes short documents others can act on; distinguishes facts, assumptions and hypotheses | Frames the decision others could not frame; writing changes what the team does |
| **Collaboration and disagreement** | Disagrees specifically and early, commits after the decision, records dissent without relitigating | Makes disagreement productive for others; resolves a stuck conflict |
| **Learning velocity** | Seeks and acts on feedback; learns a new domain fast enough to be useful in weeks | Teaches the domain; changes how the team learns |

### Function-specific competencies

| Function | Competencies |
| --- | --- |
| **Engineering** | Systems and data modelling for tenant isolation and offline sync · Testing discipline (including negative controls) · Operational ownership: monitoring, rollback, incident response · Security and privacy by default |
| **Product** | Problem framing and prioritisation under constraint · Evidence from users and metrics · Scope discipline against a broad vision · Writing requirements with acceptance criteria and failure states |
| **Design and accessibility** | Interaction and visual craft in a design system · Accessibility as a practice (keyboard, screen reader, cognitive load, contrast) · Research with real users · Content clarity |
| **Security, privacy, compliance** | Threat modelling · Control design and evidence · Judgment on risk acceptance · Plain-language communication of limits to non-experts · Honest scope: knows what they cannot conclude |
| **Customer: implementation, success, support** | Institutional change and procurement fluency · Project delivery with scoped acceptance · Clear, calm incident communication · Routing sensitive cases correctly |
| **Go-to-market** | Higher-ed buying process (procurement, security review, sponsor, champion) · Honest qualification; no claims beyond evidence · Pipeline discipline |
| **Finance and operations** | Controls and close discipline · Unit economics and pricing · Vendor and contract management · Audit-ready records |

## Leveling

Levels describe **scope and autonomy**, not title or tenure. Levels are shared across functions so pay and promotion are comparable. Typical experience is a non-binding signal.

| Level | Scope | Autonomy | Typical signal |
| --- | --- | --- | --- |
| **L1** | A defined task | Guided; reviews before merge | Early career, interns, new graduates |
| **L2** | A well-bounded piece of work | Works independently on defined problems; asks early | 1–3 years |
| **L3** | A feature or a component, end to end | Owns scope and quality; handles ambiguity within a domain | 3–6 years |
| **L4** | A domain or a product area | Sets technical or product direction for a domain; mentors; owns outcomes and runbooks | 6–10 years |
| **L5** | Several domains or a function | Sets direction across teams; shapes standards and hiring | 10+ years |
| **L6** | The company | Executive scope; sets strategy for a function; accountable at board level | Rare |

**Management track:** M1 leads a squad (4–7); M2 leads leads or a function; M3 leads a function across areas. A manager is not a higher IC level; moving between tracks is allowed and neutral.

**Promotion:** twice a year. Evidence packet written by the person and the manager: scope sustained for two cycles at the next level, competency evidence, impact. A calibration of the whole company by the leadership group at Series A; before that, the founder with the operator advisor reviewing. No promotion for tenure; no title inflation.

## Interview loops

### Standard loop

| Step | What | Who | Time target |
| --- | --- | --- | --- |
| 1 | Intake conversation | Founder or recruiter | Within 3 business days of application |
| 2 | Hiring-manager screen: role fit, motivation, a first look at the competencies | Hiring manager | Within 5 business days |
| 3 | **Work sample**, paid for anything over about 3 hours; role-specific (below) | Candidate; reviewed by two people independently | 2–5 days to complete; reviewed within 2 business days |
| 4 | **Loop of four 45–60 minute sessions**, each assessing *different* competencies so the same ground is not covered twice | Four interviewers | Within 7 business days of step 3 |
| 5 | **Trust interview**: integrity, ownership, disagreement, student judgment; interviewer is outside the hiring line and holds a veto on the integrity gate | Trust interviewer | Same loop |
| 6 | **References**: two the candidate names, one backchannel with consent | Hiring manager | Before the offer |
| 7 | **Debrief**: every interviewer submits a written scorecard *before* any discussion; the discussion focuses on disagreement in scores | All interviewers | Same or next day |
| 8 | **Decision and offer**: the hiring manager decides; founder consulted | Hiring manager | Offer within 2 business days of the debrief |

Total from application to offer: aim for about 3 weeks `[HYPOTHESIS]`. A candidate hears something every 5 business days.

### Loop by role family

| Role family | Sessions (distinct competencies) | Semester-specific work sample |
| --- | --- | --- |
| **Engineering** | System design for multi-tenancy · Code and testing review of a small change · Operational scenario (an incident and rollback) · Collaboration and disagreement | Threat-model and implement a small slice of the guardian consent-sharing flow with tests, including a negative case; or design offline conflict handling for a shared document |
| **Product** | Problem framing with constraints · Metrics and evidence · Writing a requirement with failure states · Collaboration | Write a one-page requirement for a student-control feature including what the student can change, how success is measured, and what could harm a student |
| **Design / accessibility** | Portfolio and craft · Accessibility review of a screen · Research planning · Collaboration | Audit a provided flow against keyboard, screen-reader and cognitive-load criteria and propose fixes with trade-offs |
| **Security / privacy** | Threat modelling · Control and evidence design · Risk-acceptance judgment · Communicating limits | Review a data-flow diagram, name the top risks, and state what you can and cannot conclude |
| **Implementation, success, support** | Institutional rollout scenario · Incident communication · Routing a sensitive case · Collaboration | Triage a support ticket involving a minor's data: what you do, what you escalate, what you say |
| **Go-to-market** | Higher-ed procurement scenario · Qualification · Honest positioning · Collaboration | Respond to a security-questionnaire item truthfully when the evidence is partial |
| **Finance / operations** | Close and controls · Unit economics · Vendor and contract management · Collaboration | Reconcile a small set of transactions and flag what needs approval |

### Scorecard and decision rules

- Score each assessed competency 1–4 with **observed evidence**, not impressions ([template](templates.md#interview-scorecard)).
- **Hire:** no integrity concern, every core competency at 3 or above for the level or a documented trade-off, and at least one 4 in a function-specific competency.
- **No hire:** any integrity concern; or a core competency at 1 with no offsetting evidence.
- **Calibration:** quarterly, review a sample of hires against first-90-day outcomes. If the loop did not predict the outcome, change the loop.
- **Fairness** `[COUNSEL]`: written job-related criteria before sourcing; same questions per role; interviewers trained on structured scoring; background and reference checks only as lawful and role-appropriate; record reasons for every decision.
- **Conflicts:** relationships with candidates (classmates, friends, family) are disclosed and the interviewer recuses. For anyone given equity or significant authority, a paid trial period before the commitment is preferred over a long conversation.

## Compensation principles

No figures are held here. Bands live in a controlled system (F9, F10).

1. **Pay for scope.** Pay follows level (above), not who negotiated hardest. One band per level and location tier; offers inside the band.
2. **Market-referenced, sourced and dated.** Use a named benchmark source, refreshed at least annually, with the location policy stated in writing `[COUNSEL]`.
3. **A cash-and-equity menu.** At early stage, a small set of pre-agreed combinations of cash and equity within one total-value band, so offers are comparable and easy to explain.
4. **Equity is explained, not oversold.** Every offer says what the equity is, what it is not, that value is uncertain, and that there is no promised liquidity. Grants require a current valuation basis and counsel/CPA review before any option is issued; vesting terms and refresh guidelines are set before the first grant `[COUNSEL]`.
5. **Fair pay is checked.** An annual review of pay by level, role and group for unexplained differences, with corrections made in the next cycle.
6. **No unpaid production work.** Interns and student builders are paid; classification follows counsel's advice `[COUNSEL]`.
7. **Classification is decided, not assumed.** Contractor versus employee status is reviewed per person and place `[COUNSEL]`.
8. **Transparent process.** People can see the level definitions, the band for their level, and how a change happens.
9. **Two cycles a year**, aligned to promotions. Off-cycle changes are recorded decisions.
10. **Leadership pay** is set deliberately; once there is outside capital it is approved by the board's compensation process, and founders do not set their own terms alone.

## Onboarding

### Before day one

| Item | Owner |
| --- | --- |
| Signed agreements: employment or contract, confidentiality, IP assignment, acceptable use, code of conduct `[COUNSEL]` | Founder / counsel |
| Accounts created through role-based, least-privilege access; passkeys or MFA on; no standing production or student-data access by default | Engineering |
| Equipment and secure setup | Operations |
| A named buddy who is not the manager | Manager |

### First week

- **Read:** this folder's [README](README.md), [culture](05-culture.md), [`SEMESTER-OPERATING-SYSTEM.md`](../../../SEMESTER-OPERATING-SYSTEM.md), [`DEFINITION-OF-DONE.md`](../../DEFINITION-OF-DONE.md).
- **Ship something real in week one** behind the real gates (a small change, a doc fix, a runbook correction). Nothing teaches the system faster, and it proves access and the gates both work.
- **Meet** two students or users and two colleagues outside the team.

### Within 14 days, before touching production or student data

Trust training: handling student data and consent; the claims register; security basics; accessibility basics; the AI-use policy; incident reporting. Content reviewed by counsel; refreshed annually; completion recorded.

### 30 / 60 / 90

| By | Outcome (not tasks) | Check |
| --- | --- | --- |
| **30 days** | Understands the product, the domain and who owns what; has shipped; has met users; knows the escalation path | Written note from manager and buddy |
| **60 days** | Owns a defined piece of work end to end; first written decision or proposal | Manager review against rubric |
| **90 days** | Delivered the outcome named on the requisition; knows what to stop or change | Written review; decide to continue, adjust or end, in writing |

### Offboarding

Same-day removal of access and credentials; return of assets; handover of owned runbooks and registers; reminder of confidentiality and IP; update the seat map and owner matrix; exit conversation recorded for the org review. The tested route for access revocation is part of the [continuity](08-continuity.md#unplug-drill) drills.

## Hiring governance

| Item | Rule |
| --- | --- |
| **Requisition** | One page: seat, risk retired, trigger, 90-day outcome, level, budget reference, loop. Approved by the founder against the plan and the runway rule (F12); outside plan, advisors consulted |
| **Expiry** | A requisition with no qualified slate in 90 days is re-justified or closed |
| **Referrals and relationships** | Disclosed at the start; recusal in the loop |
| **Records** | Scorecards and decisions retained per the records schedule `[COUNSEL]`; sensitive records stay out of this repository |
| **Review** | Quarterly: time to offer, offer acceptance, 90-day outcomes, loop calibration, pay-equity flags |

## What to delete

If a requisition does not retire a named risk, it is a want, not a need: close it. If an interview step does not change decisions in a quarter of hires, remove it.
