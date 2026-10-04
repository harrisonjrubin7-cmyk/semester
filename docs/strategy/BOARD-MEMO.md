# Board strategy memo

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT FOR DECISION — written for a governing body that does not yet exist (A-01); it is the founder's memo to the advisory board proposed in FD-2026-013** |
| Owner | `founder` seat |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Period covered | 2026-10-01 to 2029-09-30 |
| Cadence | Memo refreshed quarterly (it is the "one-page strategy memo" `docs/operating-model/OPERATING-RHYTHM.md` schedules); full board pack monthly; annual reset each September |

**Not legal, tax, accounting or investment advice.** Entity form, equity, financing terms, contracts, insurance and every regulatory position in this memo are **COUNSEL** items: they are framed for qualified professionals to decide.

## 1. What the board is asked to decide in the next 90 days

| # | Decision | Recommendation | Decide by | Log entry |
| --- | --- | --- | --- | --- |
| 1 | Adopt the three-year strategy and the claim ceilings as the company's strategy | Adopt | 2026-10-18 | FD-2026-001, -011 |
| 2 | Stand up an advisory board with defined decision rights | Yes, five to seven advisors with the gaps in [`ADVISORS.md`](ADVISORS.md) filled first | 2026-11-15 | FD-2026-013 |
| 3 | Adopt the standing rule: no university-administered money, prize, stipend or grant is accepted before the written IP determination is in hand | Adopt immediately | 2026-10-11 | FD-2026-003 |
| 4 | Confirm entity formation path with counsel | Counsel decides form; founder decides timing | 2026-11-15 | FD-2026-002 |
| 5 | Approve the north-star measure and the proposed Year 1 targets | Approve with the baseline-adjustment rule | 2026-11-15 | FD-2026-006 |
| 6 | Reaffirm Vanderbilt-first with dated tripwires | Reaffirm | 2026-11-30 | FD-2026-004 |
| 7 | Commission the external validation set (security, accessibility, counsel) and receive quotes | Commission; quotes replace A-06 | 2026-12-15 | FD-2026-012 |

## 2. Core thesis

Every part of a student's educational life works in Semester from day one: natively when necessary, connected when available, governed everywhere, and supported operationally. Commercially, this becomes **a governed layer between the student and the institution's fragmented systems**, entered through a student-controlled planning experience and paid for by institutions that need governance, rollout and cohort-level readiness. The whole platform is preserved as requirements; its **claims, sales and activation are sequenced by evidence** ([`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md) §2).

## 3. Position in five lines

1. **Product:** unusually broad (152 screen entries, 1,219 test files, 171 migrations); breadth is not operability.
2. **Customers and revenue:** none. All paid and activation motions are RED.
3. **Company:** no confirmed entity, no confirmed IP chain, a written university IP determination pending, and a single person holding or acting in six of seven held council seats.
4. **Evidence:** no independent security assessment, no qualified accessibility review, no operated restore, no staffed support rota.
5. **Standing decisions:** go deep at Vanderbilt before wide; nothing legal is concluded without counsel; no claim is public without the claims register.

## 4. Strategic risks the board should watch

The full register is [`RISK-REGISTER.md`](RISK-REGISTER.md) (36 risks, proposed ratings; likelihood times impact, each 1 to 5). These ten score highest. Ratings are inherent and PROPOSED until the rating definitions are approved (FD-2026-013); the ordering is the signal, not the digits.

| Rank | ID | Score | Risk | Why it ranks | Leading indicator | Owner seat |
| ---: | --- | ---: | --- | --- | --- | --- |
| 1 | SR-006 | 25 | Founder capacity and key-person dependence | One person holds or acts in six of seven held seats and is the sole decision-maker; no backups | Backups not named by 2027-03-31 | `founder` |
| 2 | SR-016 | 20 | Entity and IP chain unresolved | Blocks contracts, hiring, financing, insurance and diligence | Determination letter and counsel confirmation not in hand by 2026-12-15 | `founder`, `privacy` |
| 3 | SR-032 | 20 | Dependence on one institution | The first reference, pilot and roadmap all route through Vanderbilt; a no restarts the institutional track | No written scoping conversation by 2027-03-31 | `founder` |
| 4 | SR-001 | 16 | Breadth outruns operability | The audit's central finding: claiming "live" without operation | Any capability promoted without the completion evidence | `product` |
| 5 | SR-003 | 16 | AI assistants and incumbents commoditise planning | Raises the bar on differentiation inside the wedge | Return rate below its line while competitors ship equivalents | `product` |
| 6 | SR-007 | 16 | Founder-as-student: conflict of interest and load | Selling to the institution where the founder is enrolled needs written guidance | Written answer not received by 2026-11-30 | `founder`, `privacy` |
| 7 | SR-009 | 16 | Governance gap and vacant seats | Five of twelve council seats vacant; no independent challenge | FD-2026-013 undecided by 2026-11-15 | `founder` |
| 8 | SR-025 | 16 | AI wrong-deadline or wrong-policy harm | The reputational event most likely in a student-facing AI product | Sourced-fact accuracy below threshold | `product`, `trust` |
| 9 | SR-013 | 15 | University funding captures the IP | Irreversible once an award is accepted; the policy resolves against the student if funding is a significant university resource | Any pending university-administered award | `founder` |
| 10 | SR-022 | 15 | Cross-tenant exposure or breach | One incident ends institutional trust; no independent review exists | No independent assessment commissioned by 2027-01-31 | `security` |

At 15 and just outside the ten: SR-002 (wedge not valued), SR-011 (runway), SR-018 (student-record and privacy regimes). SR-015 (fiscal-year window) and SR-017 (unsupported claims) score 12 and are watched through the scorecard.

## 5. Milestones and gates

Gates are evidence thresholds mapped to the repository's existing release profiles. A gate can move **earlier** when evidence closes early. It never moves by waiver.

| Gate | Meaning | Target date | Evidence required | Release profile | Decides |
| --- | --- | --- | --- | --- | --- |
| **G0** | Clean to engage | 2026-12-15 | IP determination in writing; entity status confirmed; counsel engaged; founder fact sheet; standing funding rule recorded | None (company facts, FR-001) | `founder`, with counsel |
| **G1** | Clean to validate (invitation-only, unpaid) | 2027-03-31 | Exact-SHA hosted CI; production smoke; counsel-approved terms and public-policy posture; representative-user UAT; account-lifecycle acceptance; accessibility review commissioned; validation support; stop criteria | `invitation-only-individual-validation` | Launch council computed verdict |
| **G2** | Clean to activate one named cohort | 2027-07-31 | FR-002 to FR-006, FR-011, FR-012 closed for the cohort; signed charter, data map, roles, UAT, baseline; independent security and target isolation evidence; operated restore and incident drills | Bounded design-partner activation | Launch council computed verdict; customer sponsor accepts |
| **G3** | Clean to charge | 2028-03-31 | G2 plus measured closeout; price book; tax/accounting/payment controls; insurance; counsel-approved paper; DAST, restore, incident, data-rights, revocation and offboarding exercises on the target | `paid-institutional-manual-pilot` (then `paid-institutional-pilot` for connected data) | Launch council; `finance` and counsel |
| **G4** | Clean to repeat | 2029-06-30 | G3 plus three scoped deployments, capacity and error-budget acceptance, independent assurance current, claim-specific reference permission | `broad-enterprise-sale` | Separate broad-sale decision |

The launch council's `decide()` function has no override; a P2 or P3 blocker can be waived by the founder seat with an expiry and a disclosure, and a P0 or P1 cannot ([`LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md)). This memo does not weaken that.

## 6. Capital requirements

**Every figure in this section is an ASSUMPTION or an order-of-magnitude estimate to be replaced by quotes and a bottom-up budget (A-06 to A-10).** The repository holds no financial records: runway "lives in the financial workspace, not the repository" ([`COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md)). The structure is the deliverable; the numbers are placeholders that make the discussion concrete.

### 6.1 Year 1 spend (2026-10-01 to 2027-09-30), gross

| Line | Range | Basis |
| --- | --- | --- |
| Counsel: entity, IP, privacy, contracts, claims review | $40k to $80k | A-06 |
| Independent penetration test and retest | $20k to $40k | A-06 |
| Accessibility audit, ACR, remediation retest | $15k to $35k | A-06 |
| Insurance (cyber, technology E&O, general liability), first year | $8k to $25k | A-06 |
| Accounting, tax, bookkeeping | $8k to $15k | A-06 |
| Compliance tooling and evidence automation | $0 to $15k | A-06 |
| Infrastructure, AI inference, tooling | $20k to $50k | A-09 |
| Go-to-market (travel, regional conferences, demo environment) | $10k to $25k | A-06 |
| Advisor cash stipends (equity is a separate **COUNSEL** matter) | $15k to $40k | A-06 |
| Payroll: first hire from about 2027-03, fractional design/accessibility, founder stipend | $108k to $227k | A-07 |
| **Year 1 total** | **about $0.25M to $0.55M** | |

### 6.2 Three-year envelope, net of revenue

| | Year 1 | Year 2 | Year 3 |
| --- | --- | --- | --- |
| Team at year end (FTE, ASSUMPTION A-07) | 2 to 3 incl. founder and fractional | 6 to 8 | 12 to 16 |
| Gross spend | $0.25M to $0.55M | $1.05M to $1.75M | $2.1M to $3.4M |
| Illustrative revenue (A-08; no price book exists) | $0 | $0.05M to $0.3M | $0.4M to $1.6M |
| Net funding need | $0.25M to $0.55M | $0.8M to $1.6M | $0.5M to $3.0M |
| Cumulative net need | $0.25M to $0.55M | $1.05M to $2.15M | **$1.55M to $5.15M** |

**Read this candidly.** Under these assumptions the company does not reach break-even inside the horizon. At Year 3 gross spend, break-even needs roughly 18 to 57 annual agreements at an illustrative $60k to $120k each (the low end pairs the lowest spend with the highest price), well above the Year 3 target of 6 (stretch 12). The three years buy **fundable proof**, not profitability. Self-sustaining operation under the base case is a Year 4 to Year 5 outcome and is a **HYPOTHESIS**.

### 6.3 Funding path

| Stage | Size (ASSUMPTION) | Trigger (conditions, not dates) | Use | Constraints |
| --- | --- | --- | --- | --- |
| **Pre-seed or equivalent** | $0.75M to $1.5M | G0 closed and G1 accepted; counsel confirms entity and IP chain; target milestone 2027-05-31 | Year 1 validation spend, first hire, advisors, runway to a live cohort and closeout | Sequenced **after** the IP determination. Counsel reviews all terms (**COUNSEL**) |
| **Seed** | $2.5M to $4.0M | First cohort closeout beat its baseline; one annual agreement signed or in final paper; target milestone 2028-06-30 | Implementation and support capacity, assurance (SOC 2 path), second institution, Years 2 and 3 | Conditional on evidence; no raise on narrative alone |
| **Bridge or non-dilutive** | As needed | Runway tripwire amber | Hold gates, not growth | Non-dilutive money administered by the university is **excluded** until the IP determination (SR-013); any grant needs counsel's read of ownership and reporting terms |

**HYPOTHESIS:** a later growth round typically asks for repeatable annual recurring revenue in the low millions with retention evidence; the advisors named for `finance` should confirm the current bar before the seed pitch.

**The lean alternative.** Founder-funded or revenue-funded, staying at one or two people, closing only G0 to G3 with the cheapest independent validation. Cost: roughly $0.5M to $0.9M over two years (ASSUMPTION). Forfeits: the pace to a second institution, assurance reports, and any chance of the Year 3 targets. It remains a legitimate path; FD-2026-008 chooses between them on 2027-01-31.

### 6.4 Runway rules (proposed)

| Reading | State | Required response, owner, deadline |
| --- | --- | --- |
| 12 months or more of runway at current net burn | Green | None |
| 9 to 12 months | Yellow | Founder presents bridge options to the board within 14 days |
| Under 9 months | Red | Freeze hiring and non-gate spend within 7 days; scope to gates only; raise or bridge decision within 30 days |
| Under 6 months | Critical | Board decides continue-or-wind-down plan within 14 days; customer commitments reviewed with counsel before any new one is made |

No commitment above the spending authority in §8 is made on an assumed raise.

## 7. Milestone summary for the board pack

| Year | Headline outcome | Hard evidence | Capital state |
| --- | --- | --- | --- |
| 1 | Trusted enough to be allowed in: G0 to G2 closed, one charter signed, first cohort live | Determination letter, independent reports, operated drills, signed charter, go-live record | Pre-seed closed by 2027-05-31 (or lean path chosen) |
| 2 | Proved it repeats: closeout beat baseline, first annual agreement, 3 cohorts in 2 units | Closeout report, executed agreement effective 2028-07-01, implementation time reading | Seed closed by 2028-06-30 |
| 3 | A business: 6 agreements (floor 4, stretch 12) across 2 institutions, first renewals, repeatability pack | Executed agreements, renewal records, independent assurance, evidence pack | Runway 12 months or more at all times |

Dated milestones with owners are in [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md) §5.

## 8. Decision rights (proposed)

The repository already enforces two-person rules in the database for sensitive operations ([`DECISION-RIGHTS.md`](../DECISION-RIGHTS.md)). It names what it does **not** enforce: policy exceptions, security exceptions, data exceptions, data-subject requests and the pilot go/no-go signatory. This table proposes company-level rights for the decisions a strategy touches. Amounts and thresholds are **ASSUMPTIONS** pending FD-2026-013 and counsel.

| Decision | Decides | Must consult | Must be informed | Cannot be decided by |
| --- | --- | --- | --- | --- |
| Strategy, segment order, product scope | Founder | Advisory board; product and finance advisors | Council seats | An agent or contractor |
| Annual budget; any spend above $25k, or any commitment longer than 3 months | Founder with advisory-board consent once it exists | Finance advisor | Board | One person alone once a board exists |
| Spend $5k to $25k | Founder, with the finance advisor's concurrence | | Board at next meeting | |
| Spend under $5k | Founder | | | |
| Signing any customer contract | Founder, using signing authority confirmed by counsel (FR-001, FR-008) | Counsel; customer's authorized signatory | Board | Anyone without confirmed authority; no contract is signed before counsel-approved paper |
| Pricing, discounts, pilot credit | Founder within deal-desk limits | Finance advisor; counsel | Board | Sales or success staff beyond deal-desk limits |
| Public claims | Claims register approvers | Counsel; evidence owners | Founder | Marketing or any agent publishing outside the register |
| Release or activation for a cohort | Launch council `decide()` verdict | Customer sponsor | Board | Anyone overriding a P0 or P1 blocker |
| Risk acceptance, P2 or P3 | Founder seat, with expiry and disclosure | Domain seat | Board | |
| Risk acceptance, P0 or P1; or any legal conclusion | Not acceptable by waiver; counsel or the domain authority decides | | | The founder alone |
| Fundraising terms, equity grants, advisor equity | Founder with board consent | Counsel (**COUNSEL**) | | |
| Senior hires; first FTE | Founder | Advisory board | | |
| Material incident communications | Incident commander and founder | Counsel | Affected customers per contract | |
| Reopening the Vanderbilt-first decision | Founder, on a reading that meets a stated condition | Advisory board | | A request alone |

## 9. Board cadence and reporting

| Meeting | Frequency | Inputs | Output (every meeting writes something down) |
| --- | --- | --- | --- |
| Board or advisory board | Monthly during Year 1; quarterly after the seed | Scorecard ([`SCORECARD.md`](SCORECARD.md)), risk register movements, decision log, runway | Decisions taken, risks accepted or escalated, asks of the board |
| Gate review | At each gate | The gate's evidence pack | A recorded verdict |
| Annual reset | September | Full-year scorecard, moat review, risk re-rating | Next three-year strategy memo |

Board pack contents, fixed: the scorecard with **NO READING** shown honestly rather than green; the top-ten risks and every tripwire that fired; decisions due in the next 60 days; runway and the capital state; evidence expiring in 90 days; claims audit result.

## 10. Assumptions and open questions

Assumptions are numbered in [`README.md`](README.md) §4. The ones this memo most depends on: A-01 (no board exists), A-02 (entity unconfirmed), A-03 and A-04 (sales and fiscal cycles), A-06 to A-10 (all cost and price figures), A-12 and A-13 (Vanderbilt and the IP determination go well; the plan has a branch for each if they do not), A-14 (founder capacity).

Open questions with owners are in [`FOUNDER-DECISION-LOG.md`](FOUNDER-DECISION-LOG.md); the unresolved legal questions go to counsel through [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) and [`docs/COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md).
