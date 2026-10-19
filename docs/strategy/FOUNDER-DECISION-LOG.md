# Founder decision log (strategy)

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **ALL ENTRIES PROPOSED. NONE IS APPROVED.** The founder decides; an agent or document cannot |
| Owner | `founder` seat |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Format | The entry shape of [`docs/company/FOUNDER-DECISION-LOG-TEMPLATE.md`](../company/FOUNDER-DECISION-LOG-TEMPLATE.md), compressed to one block each. Entries use `FD-2026-NNN` |
| Relationship to `docs/decisions/` | `FD-` entries are *proposals awaiting a decision*. Once the founder decides, each becomes `docs/decisions/D-<pull request number>.md` (the repository's rule, [`docs/decisions/README.md`](../decisions/README.md)) and this table's status is updated. A decision that sets a measure target is also written into `firstyear.ts` with that `D-` number |
| Review | Open entries weekly; the full log quarterly. Overdue more than 14 days escalates to the advisory board (scorecard L1) |

**Status vocabulary:** `PROPOSED`, `APPROVED`, `APPROVED WITH CONDITIONS`, `REJECTED`, `SUPERSEDED`, `EXPIRED`.
**Authority:** where an entry touches law, tax, financing terms, equity, insurance, accessibility conformance or privacy posture, qualified human counsel or the named professional decides that part (**COUNSEL**); the founder decides business timing and risk appetite only.

## Index

| ID | Decision | Decide by | Reversible? | Recommendation | Status |
| --- | --- | --- | --- | --- | --- |
| FD-2026-001 | Adopt this package as the company strategy | 2026-10-18 | Yes | Adopt | PROPOSED |
| FD-2026-002 | Entity formation path and timing | 2026-11-15 | Costly | Counsel advises; start now | PROPOSED |
| FD-2026-003 | Standing rule: no university-administered money before the written IP determination | 2026-10-11 | Yes | Adopt immediately | PROPOSED |
| FD-2026-004 | Reaffirm Vanderbilt-first, with dated tripwires | 2026-11-30 | Yes | Reaffirm | PROPOSED |
| FD-2026-005 | Individual-student monetisation posture | 2026-12-15 | Yes | No checkout through G3 | PROPOSED |
| FD-2026-006 | North star and Year 1 targets (with baseline rule) | 2026-11-15 | Yes | Approve | PROPOSED |
| FD-2026-007 | Price discovery method and cohort 1 fee posture | 2027-01-31 | Yes | No-fee design-partner activation | PROPOSED |
| FD-2026-008 | Capital strategy and timing | 2027-01-31 | Partly | Pre-seed after G1 evidence | PROPOSED |
| FD-2026-009 | Hiring order and first hire | 2027-01-31 | Costly | Implementation and success lead first | PROPOSED |
| FD-2026-010 | AI provider posture, data terms and cost cap | 2026-12-15 | Yes | Multi-provider gateway; no training on student data | PROPOSED |
| FD-2026-011 | Replacement-claim ceiling | 2026-10-18 | Yes | Adopt the ladder | PROPOSED |
| FD-2026-012 | Assurance path: order, vendor type and spend | 2026-12-15 | Yes | HECVAT, then ACR, then SOC 2 Type I | PROPOSED |
| FD-2026-013 | Governance: advisory board, decision rights, risk-rating definitions | 2026-11-15 | Yes | Form it | PROPOSED |
| FD-2026-014 | Founder capacity and enrollment posture | 2026-11-30 | Partly | Stay enrolled through G2, with a capacity test at G1 | PROPOSED |
| FD-2026-015 | Deferred-scope register | 2026-11-30 | Yes | Confirm, with revisit dates | PROPOSED |
| FD-2026-016 | Commission market-sizing and competitor research | 2026-11-30 | Yes | Commission; due 2027-01-31 | PROPOSED |
| FD-2026-017 | House mark and product name | 2027-01-31 | Costly | Decide before any raise | PROPOSED |

Each entry below gives: the question; the options; the recommendation and the criteria that drive it; the evidence needed before deciding; the consequence of no decision; what would change it; and the linked risks.

---

### FD-2026-001 · Adopt this package as the company strategy

**Owner:** `founder` · **Authority:** founder · **Reviewers:** `product`, `privacy`, finance advisor · **Decide by:** 2026-10-18

**Question.** Does the founder adopt [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md), [`BOARD-MEMO.md`](BOARD-MEMO.md), [`SCORECARD.md`](SCORECARD.md), [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md), [`MOAT-PLAN.md`](MOAT-PLAN.md), [`RISK-REGISTER.md`](RISK-REGISTER.md) and [`ADVISORS.md`](ADVISORS.md) as the company strategy, replacing the `missing` entry in the operating-system register?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Adopt as written | One document a new hire reads first; targets and gates become checkable | Locks in assumptions A-01 to A-20 not yet tested | Quarterly refresh |
| B. Adopt with edits | Founder's judgement on the hypotheses | Slower; edits may remove falsifiers | Quarterly refresh |
| C. Defer | No commitment before advisors exist | The register stays `missing`; sessions keep re-deriving strategy | Costs time |

**Recommendation: B or A.** Criteria: every hypothesis keeps its falsifier; no number becomes a target without its own decision.
**Evidence before deciding:** the founder has read the unknowns in [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md) §9.
**If no decision:** the strategy remains `missing`; the register's finding persists.
**Would change it / stop rule:** G0 not closed by 2027-01-31 (see strategy Year 1).
**Links:** SR-001, SR-010.

---

### FD-2026-002 · Entity formation path and timing

**Owner:** `founder` · **Authority:** counsel advises; founder decides timing · **COUNSEL** · **Decide by:** 2026-11-15

**Question.** Which legal entity, in which jurisdiction, formed when, with what founder IP assignment and equity structure?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Form now, on counsel's advice | Unblocks contracts, hiring, financing, insurance and diligence | Cost; early structure may need restructuring at financing | Costly to unwind |
| B. Form at financing | Defers cost | Blocks contracts and insurance; ownership chain unclear; diligence risk | Moderate |
| C. Defer indefinitely | None | Customers cannot contract; FR-001 stays open | |

**Recommendation: A**, structure chosen by counsel. Criteria: signing authority for contracts; IP chain; ability to receive financing; liability separation.
**Evidence before deciding:** the IP determination status; counsel's written options memo; founder fact sheet.
**If no decision:** no contract can be signed and no financing closed (FR-001, P0).
**Links:** SR-016, SR-009.

---

### FD-2026-003 · No university-administered money before the written IP determination

**Owner:** `founder` · **Authority:** founder · **COUNSEL** · **Decide by:** 2026-10-11

**Question.** Does the company adopt, as a standing rule, that it accepts no university-administered prize, stipend, grant, accelerator or program participation agreement until it holds the university's written ownership determination, and discloses any pending award to the technology-transfer office first?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Adopt | Closes the one exposure that can still be made worse; the policy resolves against the student if funding is a significant university resource | Forgoes some early non-dilutive money | Lift on receipt of the letter |
| B. Case by case | Flexibility | One mistake can transfer ownership of the technology | None after acceptance |

**Recommendation: A.** Criteria: asymmetry stated in [`IP.md`](../../IP.md): an hour to send the email versus the company if the order is wrong.
**Evidence before deciding:** list any award applied for, offered or expected.
**If no decision:** any award accepted in the interim is exposed.
**Links:** SR-013, SR-016.

---

### FD-2026-004 · Reaffirm Vanderbilt-first, with dated tripwires

**Owner:** `founder` · **Authority:** founder · **Reviewers:** advisory board · **Decide by:** 2026-11-30

**Question.** Does the founder reaffirm `DECISIONS.md` §1 (depth at one university before breadth) for the horizon, adding the tripwire dates in [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §5?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Reaffirm, tripwire review at 2027-05-31 | Focus; the only unfair advantage (proximity) is used; one reference beats four half-integrations | Single-institution dependency (SR-032) | Reopens on stated conditions |
| B. Open a second institution now | Hedges Vanderbilt | Splits a one-person team; no agreement behind any adapter | Hard to unwind |
| C. Drop institutional for self-serve only | Needs no agreement | Gives up the payer; the wedge's revenue model | Moderate |

**Recommendation: A.** Criteria: the decision's own reasoning still holds; no second institution has invited Semester.
**Evidence before deciding:** status of the V5 written-scoping conversation.
**If no decision:** drift between two strategies.
**Would change it:** the three reopening conditions in `DECISIONS.md` §1.
**Links:** SR-032, SR-030.

---

### FD-2026-005 · Individual-student monetisation posture

**Owner:** `founder` · **Authority:** founder, with counsel and finance on terms · **Decide by:** 2026-12-15

**Question.** Does Semester charge students directly in Years 1 to 3?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. No student checkout through G3; institution pays | Matches the release profile; avoids consumer-protection, refund and tax exposure before they are staffed | Slower revenue | Yes |
| B. Optional student subscription after G1 | Early revenue signal | Needs billing, tax, refund, support and rights operations (FR-008); safeguarding exposure; churn-prone | Moderate |
| C. Free student tier funded by institutions, paid premium AI later | Aligns with the pricing architecture | Complex before the base works | Yes |

**Recommendation: A**, revisit at G3. Criteria: do not gate accessibility or safety; no surprise bills. The pricing architecture (F7) finds that a free tier at today's cap is not funded by Plus conversion unless conversion is far above typical consumer rates, so a free student tier is an acquisition cost to be budgeted and capped in dollars, or funded by institutions (option C).
**Evidence before deciding:** S4 and S2 readings from the invitation cohort.
**If no decision:** checkout stays disabled by default.
**Links:** SR-014, SR-002.

---

### FD-2026-006 · North star and Year 1 targets

**Owner:** `founder` · **Authority:** founder · **Decide by:** 2026-11-15

**Question.** Does the founder approve the CWAR north star, its guardrail and the Year 1 PROPOSED targets in [`SCORECARD.md`](SCORECARD.md), under the rule that each target is replaced by the first cohort's baseline where one exists?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Approve all Year 1 targets | Reviews have numbers to test | Several are hypotheses without benchmarks | Re-baseline at 2027-02-01 |
| B. Approve metric definitions, defer numbers until baseline | Honest about no benchmark | The review has nothing to argue with for months | Yes |
| C. Defer | | `firstyear.ts` keeps `target: null`; no measure can be Red | Yes |

**Recommendation: A for Year 1 with a re-baseline at 2027-02-01.** Criteria: a number that is wrong and visible beats a number that is absent; the guardrail ships with the north star.
**Evidence before deciding:** the new metrics' mark requirements (D-005).
**If no decision:** `target: null` persists; the repository's own test keeps measures target-less.
**Links:** SR-002, SR-010.

---

### FD-2026-007 · Price discovery method and cohort 1 fee posture

**Owner:** `founder` · **Authority:** founder with finance advisor and counsel · **COUNSEL** (contract and tax terms) · **Decide by:** 2027-01-31

**Question.** How is the price found, and what does cohort 1 pay?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. No-fee design-partner activation with signed conversion intent; price book approved before G3 | Honest with the RED paid-pilot status; reduces friction for the first reference | Zero Year 1 revenue; risk that "free" sets the price anchor; about $13k of unpriced delivery per cohort; **a 100% pilot credit exceeds the deal-desk cap of 50% of first-year value, so it needs a recorded exception** | Yes |
| B. Scoping or implementation fee | Tests willingness to pay early | Payment is RED until controls exist | Moderate |
| C. Full paid pilot | Revenue | Not permitted before G3 | |

**Recommendation: A**, with at least 10 willingness-to-pay conversations by 2027-04-30, and **with the deal-desk exception recorded by finance and counsel before the charter is signed**. Criteria: no quote without an approved price book; floors set from observed delivery cost, not the modelled floors in [`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) §5.3 and §5.5 (which say themselves that the fixed-cost inputs are likely overstated for a founder-led company). Its decisions 1, 4 and 8 (price book, implementation floor, reviewers) are the same questions and should be decided together.
**Evidence before deciding:** first discovery readings.
**If no decision:** the charter cannot state a fee term.
**Links:** SR-014, SR-015.

---

### FD-2026-008 · Capital strategy and timing

**Owner:** `founder` · **Authority:** founder with board consent once it exists · **COUNSEL** · **Decide by:** 2027-01-31

**Question.** Lean (founder or revenue funded), non-dilutive, or outside equity, and when?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Pre-seed of about $0.75M to $1.5M after G0 and G1 evidence, target close 2027-05-31 | Funds validation, first hire and advisors; raises on evidence | Dilution; fundraising consumes founder time | Not once closed |
| B. Lean path, about $0.5M to $0.9M over two years | Control; no dilution | Slower; no second institution or assurance reports in the horizon | Can raise later |
| C. Raise now on the build | Speed | Diligence fails on IP and entity facts; weak position | Costly |

**Recommendation: A**, with B as the explicit fallback. Criteria: IP letter and entity in hand first; runway tripwires in [`BOARD-MEMO.md`](BOARD-MEMO.md) §6.4. All figures ASSUMPTIONS (A-06 to A-10).
**Evidence before deciding:** quotes replacing A-06; a bottom-up budget.
**If no decision:** drift into C by default when cash runs short.
**Links:** SR-011, SR-012, SR-013.

---

### FD-2026-009 · Hiring order and first hire

**Owner:** `founder` · **Authority:** founder · **Reviewers:** advisory board · **Decide by:** 2027-01-31

**Question.** Who is hired first, given that one person holds or acts in six of seven held seats?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Implementation and customer-success lead with higher-education experience | Binds on G2: support rota, UAT, rollout, sponsor credibility | Engineering stays a one-person bottleneck, mitigated by the existing test suite | Costly |
| B. Senior platform and security engineer | Relieves engineering and security evidence work | Leaves customer-facing work with the founder | Costly |
| C. Fractional specialists only (security, accessibility), no hire | Lowest fixed cost | Does not reduce founder dependence (SR-006) | Yes |

**Recommendation: A first (start about 2027-03-01), B at the seed, fractional security and accessibility from vendors throughout.** Criteria: the binding gate constraint is operations and evidence, not code volume (1,219 test files already exist).
**Evidence before deciding:** founder capacity test (FD-2026-014); runway.
**If no decision:** backups stay unnamed (FR-006).
**Links:** SR-006, SR-008.

---

### FD-2026-010 · AI provider posture, data terms and cost cap

**Owner:** `engineering` seat, with the AI safety advisor · **Authority:** founder · **COUNSEL** (data terms) · **Decide by:** 2026-12-15

**Question.** Which provider architecture, under what data terms, with what per-student cost cap?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Provider-agnostic gateway; zero-retention, no-training terms; regional processing where required; per-student monthly cap | Avoids provider lock-in and concentration (SR-034); matches the AI governance docs | Integration overhead | Yes |
| B. Single provider | Simpler | Concentration; terms change | Moderate |

**Recommendation: A, decided together with decision 3 of [`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) §13.2** (dollar-weighted AI units and a 40% worst-case-margin rule), since they are one question. Its first engineering steps (restrict shared-key models by plan, cap output per plan, then a dollar meter) are **preconditions for G1**, not follow-ups, because the key is capped in calls and not dollars today. Criteria: no student data used to train any model; tenant controls for models, retention, data zone and tool permissions; cost cap set from B7's baseline.
**Evidence before deciding:** provider terms read by counsel; B7 baseline.
**If no decision:** cost and terms unmanaged.
**Links:** SR-003, SR-014, SR-034.

---

### FD-2026-011 · Replacement-claim ceiling

**Owner:** `founder` · **Authority:** founder, with claims approvers and counsel · **COUNSEL** · **Decide by:** 2026-10-18

**Question.** Does the company adopt the replacement ladder (R0 to R5) as the cap on any replacement language, and the unsafe-claim table as standing instruction?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Adopt | Preserves the thesis while capping claims by evidence | Some buyers want the bold claim | Yes |
| B. Allow the bold claim in sales conversations only | Memorable | The claim reaches procurement; the claims register exists to prevent exactly this | Reputation is not reversible |

**Recommendation: A, including the buyer-facing label rule in [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §3a.** Criteria: the no-go conditions in the go/no-go decision already forbid replacement positioning, and [`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) §3.2 names a package "Replace" (SKUs `native_lms`, `university_os`) that it says may be quoted before replacement is earned; under the ladder that label is itself the claim.
**Evidence before deciding:** none beyond existing governance.
**If no decision:** the claims register governs alone, without a shared vocabulary for the ladder.
**Links:** SR-017, SR-027.

---

### FD-2026-012 · Assurance path: order, vendor type and spend

**Owner:** `security` seat (vacant; filled by the security advisor) · **Authority:** founder · **COUNSEL**/assessor independence · **Decide by:** 2026-12-15

**Question.** In what order are independent assurance artifacts commissioned?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Penetration test and accessibility audit first (G2); HECVAT draft in parallel; SOC 2 Type I (or equivalent) by 2028-06-30; Type II by 2029-06-30 | Matches what buyers ask for first; spends in the order that unlocks gates | Type I is a point-in-time report | Yes |
| B. SOC 2 first | A familiar logo | Costly before there is an operated system to attest | Yes |
| C. Defer all | Cash | Blocks G2 (FR-003, FR-007) | |

**Recommendation: A.** Criteria: assessor independent of the builder; scope matches the claims; findings remediated and retested before any claim.
**Evidence before deciding:** quotes from at least two assessors per artifact.
**If no decision:** FR-003 and FR-007 stay open.
**Links:** SR-022, SR-005.

---

### FD-2026-013 · Governance: advisory board, decision rights, rating definitions

**Owner:** `founder` · **Authority:** founder · **COUNSEL** (advisor agreements, equity) · **Decide by:** 2026-11-15

**Question.** Does the company form an advisory board with defined decision rights, adopt the proposed thresholds in [`BOARD-MEMO.md`](BOARD-MEMO.md) §8 and approve the risk-rating definitions (likelihood and impact 1 to 5) so the register's ratings stop being PROPOSED?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Form it; fill the gaps first (finance, security, registrar, higher-education administration) | Fills vacant seats; independent challenge; diligence-ready | Time; advisor equity needs counsel | Yes |
| B. Founder only | Speed | No challenge; vacant seats stay vacant | Yes |

**Recommendation: A.** Criteria: advisors advise; they do not hold decision rights that belong to counsel or the launch council.
**Evidence before deciding:** the shortlist in [`ADVISORS.md`](ADVISORS.md).
**If no decision:** 5 of 12 council seats stay vacant.
**Links:** SR-009, SR-006.

---

### FD-2026-014 · Founder capacity and enrollment posture

**Owner:** `founder` · **Authority:** the founder alone; this is a personal decision and the entry exists only so the plan's dependency on it is visible · **Decide by:** 2026-11-30

**Question.** Given that founder time is the scarcest input, how is the founder's time and enrollment arranged through G2?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Stay enrolled; run to the plan with a capacity test at G1 (2027-03-31) | The plan's unfair advantage is being at Vanderbilt; capital need is low before G2; completes the degree | Hours are limited; milestones are paced to them | Yes |
| B. Reduce the course load | More hours | Partial | Yes |
| C. Leave of absence | Full time | Changes the founder's relationship to the university; counsel should confirm the effect against the IP determination and any program agreements before it is chosen (**COUNSEL**) | Partly |

**Recommendation: A**, with the capacity test: if the Year 1 milestone load cannot be held, move to B before the next term, not after a missed gate.
**Evidence before deciding:** an honest weekly-hours estimate; the load of the Year 1 plan.
**If no decision:** capacity is implicit and the gates absorb the slip.
**Links:** SR-006, SR-007.

---

### FD-2026-015 · Deferred-scope register

**Owner:** `product` seat · **Authority:** founder · **Decide by:** 2026-11-30

**Question.** Does the company record each deferred line (public institutions, community colleges and transfer pipelines, K-12, international, family as a paid line, alumni and lifelong, employer and marketplace, sponsorship and campaigns) as *deferred, not removed*, each with a revisit date?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Record with revisit dates (all at the 2029 reset unless a trigger fires) | Honours the rule that scope is not silently reduced; keeps the requirement trail | Upkeep | Yes |
| B. Leave implicit | None | Silent scope reduction by neglect | |

**Recommendation: A.** Criteria: each line has a trigger, an owner and a date.
**Evidence before deciding:** the existing capability and replacement registers.
**If no decision:** scope can erode unrecorded.
**Links:** SR-001, SR-004.

---

### FD-2026-016 · Commission market-sizing and competitor research

**Owner:** `founder` · **Authority:** founder · **Decide by:** 2026-11-30; deliverable due 2027-01-31

**Question.** Does the company commission the sizing and competitor protocols in [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §7?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Commission (advisors plus founder time) | Replaces A-17 and A-18 with dated, cited evidence | Time | Yes |
| B. Skip | None | Strategy and any investor conversation rest on no market evidence | |

**Recommendation: A.**
**If no decision:** no market-size or competitive statement may be made.
**Links:** SR-003, SR-009.

---

### FD-2026-017 · House mark and product name

**Owner:** `founder` · **Authority:** founder with trademark counsel · **COUNSEL** · **Decide by:** 2027-01-31

**Question.** Given the finding in [`IP.md`](../../IP.md) §2 that "Semester" is very likely descriptive or generic for this product and not registrable alone, what is the brand and filing strategy?

| Option | Benefit | Risk or cost | Reversibility |
| --- | --- | --- | --- |
| A. Composite mark now; keep the name | Preserves recognition; a registration protecting the composite | The bare word stays unprotected; competitors may use it descriptively | Moderate |
| B. Coin a distinctive house mark above a descriptive product label | Strongest, registrable | Costs the recognition built | Cheapest now, dearest later |
| C. Keep as is | None | Diligence finds an unregistrable name | |

**Recommendation: decide before any raise.** Criteria: clearance search run; counsel's read of descriptiveness; cost now versus after customers exist.
**Evidence before deciding:** the clearance search `IP.md` leaves to the founder.
**If no decision:** the name issue surfaces in diligence.
**Links:** SR-016, [`MOAT-PLAN.md`](MOAT-PLAN.md) brand row.

---

## How a decision is recorded

1. Founder marks the entry `APPROVED`, `APPROVED WITH CONDITIONS` or `REJECTED` here with the date and time zone.
2. Open a pull request. Write `docs/decisions/D-<its number>.md` with the same body, start it `## D-<its number> · <the decision as a sentence>`, then **Decided <date>.**, what was decided and why, what is not done, and what would change it.
3. If it sets a target, set `target: { value, decision }` on the measure in `app/src/lib/ops/firstyear.ts` and run `npm run registers` from `app/`.
4. Update the linked risk's treatment status and the scorecard.
