# Strategic risk register

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT. Ratings are PROPOSED until the rating definitions are approved (FD-2026-013). Every risk is OPEN** |
| Owner | `founder` seat as risk coordinator; each risk names an owner seat |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Review | Weekly for any risk scoring 15 or more; monthly for the whole register; re-rating each quarter and at every gate |
| Relationship to the other registers | This register covers **company and strategy** risk. It cites, and does not re-rate or duplicate, the launch risks in [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) (`FR-001` to `FR-016`, which carry P0 to P3 priorities) and the company risks in [`docs/company/RISK-REGISTER.md`](../company/RISK-REGISTER.md) (`CR-001` to `CR-007`). Where they overlap, the more conservative reading controls |

## Method

| Element | Rule |
| --- | --- |
| Likelihood (L) | 1 rare, 2 unlikely, 3 possible, 4 likely, 5 almost certain **within the three-year horizon** |
| Impact (I) | 1 minor, 2 moderate, 3 serious (a gate slips a quarter or a customer is lost), 4 severe (a gate is lost or a trust event occurs), 5 existential (the company cannot continue as planned) |
| Score | L times I. 15 or more: reviewed weekly. 20 or more: the board sees it every month |
| Inherent versus residual | The ratings below are **inherent**: they precede any control. Residual risk reflects *evidenced* controls only, and **missing evidence cannot reduce it**. Every residual rating equals its inherent rating today because no control is yet operated or independently reviewed |
| Evidence states | DESIGNED, IMPLEMENTED, OPERATED, INDEPENDENTLY REVIEWED, ACCEPTED. A risk closes only at ACCEPTED, with a dated approver |
| Treatment | **Avoid** (do not perform the activity); **mitigate** (named actions that produce evidence); **transfer** (contract or insurance, confirmed rather than assumed); **accept** (an authorized, time-bounded record with rationale and expiry) |
| What cannot be accepted | A P0 or P1, anything unlawful, and anything customer-owned unless the customer authorizes it. The founder cannot accept it alone (launch council rules) |
| Triggers | Each risk has a leading indicator with a date or threshold. When it fires, the risk is escalated and the response is recorded in the decision log |

## Register

Owners are launch-council seats. "Close" is the evidence that would let a risk move toward ACCEPTED. Items marked **COUNSEL** need qualified human review; this register draws no legal conclusion.

### Product

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-001 | **Breadth outruns operability.** A very large surface is promoted as live without ownership, monitoring, recovery or support, and a customer finds the gap | Any capability promoted to "live" without the completion evidence | 4 | 4 | **16** | Mitigate | Completion standard enforced for every capability sold or activated; deferred-scope register; golden-path operability evidence | `product` | 2027-03-31 | FR-009, FR-013, FD-015 |
| SR-002 | **The wedge is not valued.** Students try the planning layer and do not return, so the institution has nothing to buy | Return rate under 20% after two iterations (S4) | 3 | 5 | **15** | Mitigate | Invitation-cohort readings; B1 falsifier review; change the wedge, not the target | `product` | 2027-06-30 | B1 |
| SR-003 | **General AI assistants and incumbents commoditise planning.** Free or institution-licensed assistants gain calendar and course access; incumbents ship planners | Competitors ship equivalents while S4 stagnates (A-16) | 4 | 4 | **16** | Mitigate | Dated competitor research; positioning on governed context and consequential-action safety; the sourced-fact accuracy metric | `product` | 2027-01-31 | FD-016, FD-010 |
| SR-004 | **Native-first dilutes focus.** Effort spreads to non-wedge modules before the wedge is proven | Non-wedge module work scheduled before G2 without a decision | 3 | 3 | 9 | Mitigate | Deferred-scope register; quarterly portfolio review | `product` | 2026-11-30 | FD-015 |
| SR-005 | **Accessibility defects block procurement and exclude users** | Qualified review finds blockers; any critical journey without an assistive-technology path | 3 | 4 | 12 | Mitigate | Qualified review, remediation, retest, approved statement | `accessibility` | 2027-05-31 | FR-007, CR-004, FD-012 |

### Company

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-006 | **Founder capacity and key-person dependence.** One person holds or acts in six of seven held seats and is the sole decision-maker | Backups not named by 2027-03-31; a milestone missed for capacity | 5 | 5 | **25** | Mitigate | First hire; named and trained backups; delegation; operational documentation exercised; capacity test | `founder` | 2027-03-31 | FR-006, CR-005, FD-009, FD-014 |
| SR-007 | **Founder-as-student.** Academic load, and a conflict-of-interest question from selling to the institution where the founder is enrolled **COUNSEL** | Written conflict guidance not received by 2026-11-30; coursework collides with a gate | 4 | 4 | **16** | Mitigate | Written answer from the university and counsel; disclosure; capacity plan | `founder`, `privacy` | 2026-11-30 | FD-014, entry step V2 |
| SR-008 | **Cannot hire.** Higher-education implementation talent is scarce; equity terms need counsel **COUNSEL** | No qualified candidate by 2027-03-01 | 3 | 4 | 12 | Mitigate | Advisor networks; fractional bridge; compensation bands | `founder` | 2027-03-01 | FD-009, SR-006 |
| SR-009 | **Governance gap.** No board or advisors; five of twelve council seats vacant; decisions unchallenged; diligence fails | FD-2026-013 undecided by 2026-11-15 | 4 | 4 | **16** | Mitigate | Advisory board formed; vacant seats filled in writing | `founder` | 2026-12-31 | FD-013, [`ADVISORS.md`](ADVISORS.md) |
| SR-010 | **Execution entropy.** Parallel sessions produce duplicate or contradictory work and several hundred overlapping documents; strategy drifts | A duplicate pull request; a document contradicting the register | 4 | 3 | 12 | Mitigate | The check-main rule in `CLAUDE.md`; this package as the single authoritative strategy; quarterly document audit | `engineering` | 2026-10-18 | FR-014, FD-001 |

### Capital

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-011 | **Runway shortfall before G3** | Runway under 9 months | 3 | 5 | **15** | Mitigate | Bottom-up budget; runway rules; lean fallback path | `finance` | 2027-01-31 | CR-006, FD-008 |
| SR-012 | **Raise timing and terms.** Raising before the IP determination and entity are in hand fails diligence or costs valuation; raising too late stalls the plan **COUNSEL** | Diligence request for documents not in hand | 3 | 4 | 12 | Mitigate | Sequence: determination, then entity, then raise; counsel on terms | `founder` | 2027-05-31 | FD-008, SR-016 |
| SR-013 | **University funding captures the IP.** Under the university's policy, funding that counts as a significant university resource can transfer ownership of the technology **COUNSEL** | Any pending university-administered award or program agreement | 3 | 5 | **15** | Avoid | Standing rule adopted; disclosure to the technology-transfer office; written determination | `founder` | 2026-10-11 | FD-003, [`IP.md`](../../IP.md) §1 |
| SR-014 | **Unit economics fail.** AI, support and implementation cost exceed price; revenue is mostly services | Subscription gross margin, AI cost or services share crossing their red lines (B4, B7, B8) | 3 | 4 | 12 | Mitigate | Cost cap; approved price book with floors; productised configuration | `finance` | 2028-03-31 | FR-008, FD-007, FD-010 |
| SR-015 | **Missing the fiscal-year window slips revenue a year** | G2 not reached by 2027-07-31 | 3 | 4 | 12 | Mitigate | Calendar planning; spring start as the fallback with its own budget cycle | `founder`, `success` | 2027-07-31 | A-04, A-05 |

### Legal and regulatory (all **COUNSEL**)

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-016 | **Entity and IP chain unresolved.** No contract can be signed, no financing closed, no insurance bound | Determination letter and counsel confirmation not in hand by 2026-12-15 | 4 | 5 | **20** | Mitigate | Entity formed or status confirmed; IP assignment; written determination | `founder`, `privacy` | 2026-12-15 | FR-001, CR-007, FD-002, FD-003, FD-017 |
| SR-017 | **Unsupported public or market claim** | Any external claim outside the register | 3 | 4 | 12 | Mitigate | Claims register; claim ladder; monthly audit | `privacy` | Standing | CR-001, FD-011 |
| SR-018 | **Student-record and privacy regimes misapplied.** Student-record law, state privacy law, and (if aid, billing or other financial data is ever touched) financial-data safeguards obligations of institutions that flow to vendors | A request whose scope includes aid, billing, health, disability, conduct, counseling or immigration data; a counsel gap list | 3 | 5 | **15** | Mitigate | Counsel and privacy advisor read; data scope kept to the minimum necessary; no restricted classes in any pilot; terms approved | `privacy` | 2027-03-31 | FR-010, [`docs/COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) |
| SR-019 | **Minors and guardian exposure.** The family portal and any under-18 user carry heightened obligations | Any under-18 user or activation of the family module | 3 | 4 | 12 | Avoid until posture approved | Age posture decided; family module gated behind its consent controls | `privacy` | 2027-03-31 | FR-001, FR-010 |
| SR-020 | **AI and academic-integrity policy shifts.** An institution restricts AI; rules change | A partner restricts AI; new state or federal rules | 4 | 3 | 12 | Mitigate | Tenant AI controls; a manual non-AI path for every feature; AI safety advisor watch | `product`, `privacy` | Standing | FD-010 |
| SR-021 | **Contract, liability and insurance mismatch.** An institution's paper demands uncapped indemnity or cover Semester does not carry | First institutional paper received | 3 | 4 | 12 | Transfer, with confirmation | Counsel-negotiated paper; insurance broker; coverage bound before G2 | `finance`, `privacy` | 2027-05-31 | FR-008 |

### Security

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-022 | **Cross-tenant exposure or breach.** One incident ends institutional trust; no independent review yet exists | No independent assessment commissioned by 2027-01-31; any isolation test failure | 3 | 5 | **15** | Mitigate | Independent penetration test and clean rescan; target isolation test; access review | `security` | 2027-05-31 | FR-003, FR-004, CR-003, FD-012 |
| SR-023 | **Privileged-access abuse, secrets and supply-chain compromise; AI prompt-injection and exfiltration** | Any finding; a dependency advisory | 3 | 4 | 12 | Mitigate | Time-bound least-privilege support access; secrets handling; dependency policy; annual AI red-team | `security` | 2027-05-31 | [`SECRETS.md`](../../SECRETS.md), [`SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md) |
| SR-024 | **Sub-processor failure or policy change** (hosting, database, AI provider) | An outage; a terms change | 3 | 4 | 12 | Mitigate | Sub-processor register; exit plans; degraded-mode tests; restore drill | `engineering` | 2027-03-31 | FR-005, FR-015, [`SUBPROCESSORS.md`](../SUBPROCESSORS.md) |

### Reputation

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-025 | **AI gives a student a wrong deadline or policy and a consequence follows** | Sourced-fact accuracy under threshold; any wrong deadline traced to AI | 4 | 4 | **16** | Mitigate | Sourced mode with citations; evaluation harness; human confirmation for consequential actions; incident process | `product`, `trust` | 2027-05-31 | S9, B7 |
| SR-026 | **Perceived surveillance.** Individual scoring, or visibility the student did not consent to, causes a backlash | A proposal for individual risk scores; guardian or institution visibility without consent | 2 | 5 | 10 | Avoid | The product refuses individual scoring; consent controls; plain-language visibility labels | `trust` | Standing | S8 |
| SR-027 | **Overclaiming "replace everything"** triggers IT and procurement hostility | A replacement claim reaches a buyer | 3 | 4 | 12 | Avoid | Replacement ladder; unsafe-claim table | `founder` | 2026-10-18 | FD-011 |
| SR-028 | **Incident communications fail** | A drill or incident shows delay or inconsistency | 3 | 4 | 12 | Mitigate | Counsel-reviewed incident-communications policy; drill | `trust`, `operations` | 2027-03-31 | CR-005, [`INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md) |

### Delivery

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-029 | **A pilot fails to produce evidence.** Low participation or no agreed baseline means no conversion | Baseline not agreed by week -4 | 3 | 4 | 12 | Avoid activation without it | Charter rules; sponsor communications; faculty enablement | `success` | Per cohort | FR-012, D-134 |
| SR-030 | **Institutional integration blocked or slow** (agreement, central IT queue) | Written scoping missing at 2027-03-31 | 4 | 3 | 12 | Mitigate | Manual or read-only scope; student-side path; native fallback | `data` | 2027-03-31 | FD-004 |
| SR-031 | **Migration or reconciliation errors in a pilot** | A reconciliation mismatch | 2 | 4 | 8 | Mitigate | Dry run; reconciliation report; rollback; manual data first | `data` | Per cohort | FR-005 |

### Concentration

| ID | Risk and consequence | Trigger | L | I | Score | Treatment | Close with | Owner | Due | Links |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| SR-032 | **Everything depends on one institution saying yes.** Reference, pilot and roadmap fit all route through it; a no restarts the institutional track | No written scoping conversation by 2027-03-31; silence across two terms | 4 | 5 | **20** | Mitigate, not avoid (accepted in `DECISIONS.md` §1) | Self-serve path independent of any agreement; tripwire review; practitioner interviews elsewhere; readiness to be invited by a second institution | `founder` | 2027-05-31 | FD-004, FR-002 |
| SR-033 | **A single champion or sponsor leaves** | A named champion changes role | 3 | 4 | 12 | Mitigate | Multi-threaded sponsorship (sponsor, champion, IT, privacy, accessibility contacts); deputies named in the charter | `success` | Per charter | FR-002 |
| SR-034 | **Single AI provider** | A terms or price change; an outage | 3 | 3 | 9 | Mitigate | Provider-agnostic gateway | `engineering` | 2026-12-15 | FD-010 |
| SR-035 | **Revenue concentration.** One customer is over half of revenue (inevitable early) | Any customer above 50% of ARR | 4 | 3 | 12 | Accept with disclosure, reduce by Year 3 | Reporting; contract terms; diversification target | `finance` | 2029-09-30 | B1 |
| SR-036 | **Single database and hosting vendor** | A terms change; a restore failure | 3 | 3 | 9 | Mitigate | Portability; restore drills; documented exit plan | `engineering` | 2027-03-31 | FR-005, FR-015 |

## Top ten by score

Ties are broken by whether the risk can block a gate or is irreversible once it occurs.

| Rank | ID | Score | Short name |
| ---: | --- | ---: | --- |
| 1 | SR-006 | 25 | Founder capacity and key-person dependence |
| 2 | SR-016 | 20 | Entity and IP chain unresolved |
| 3 | SR-032 | 20 | Dependence on one institution |
| 4 | SR-001 | 16 | Breadth outruns operability |
| 5 | SR-003 | 16 | AI assistants and incumbents commoditise planning |
| 6 | SR-007 | 16 | Founder-as-student conflict and load |
| 7 | SR-009 | 16 | Governance gap and vacant seats |
| 8 | SR-025 | 16 | AI wrong-deadline harm |
| 9 | SR-013 | 15 | University funding captures the IP |
| 10 | SR-022 | 15 | Cross-tenant exposure or breach |

At 15 and just outside the ten: SR-002 (wedge not valued), SR-011 (runway), SR-018 (student-record and privacy regimes).

## Maintenance

1. **Monthly:** re-read every trigger; move scores only on evidence; record each movement and its reason.
2. **Any new P0 or P1** in the launch register gets a strategic read-across here within 7 days.
3. **Closure:** a risk moves to ACCEPTED only with the evidence in its "Close with" cell, a dated approver and (if accepted rather than closed) an expiry.
4. **Never silently accepted:** a P0, a P1, anything unlawful, or anything the customer owns.
5. **Rating definitions** become final when FD-2026-013 is approved; until then every score is PROPOSED and the board treats the ordering, not the digits, as the signal.
