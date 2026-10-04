# 2 · Decision rights, delegation and escalation

> **PROPOSED — NOT ADOPTED.** Extends, and does not replace, [`COMPANY-OPERATING-MODEL.md`](../COMPANY-OPERATING-MODEL.md#operating-system) (decision classes), the owner matrix ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md#decision-rights)) and the database-enforced two-person rules in [`DECISION-RIGHTS.md`](../../DECISION-RIGHTS.md). Anything marked `[COUNSEL]` needs qualified review.

## Principles

1. **One decider.** Every decision has exactly one person who decides. Others recommend, advise or can block. "We decided" is not an owner.
2. **Reversibility sets the speed.** Reversible decisions are made by the person closest to the facts, quickly. Irreversible ones slow down on purpose.
3. **A block is not a vote.** Where a role holds *stop authority*, its objection stands until the evidence that removes it is attached. The founder cannot overrule it by preference. The founder can accept risk only where the rules below allow, with an expiry.
4. **The checker is not the maker.** Whoever produced a control or its evidence does not accept it when a second qualified reviewer is reasonably available.
5. **Decide by a date.** Every open decision has a deadline. Past it, it escalates ([escalation](#escalation-rules)).

## Decision classes

| Class | What it is | Who decides | Clock | Recorded |
| --- | --- | --- | --- | --- |
| **A — one-way door** | Hard or impossible to reverse, or touches a trust floor: financing and equity, signing a contract with data/uptime/exit commitments, activating a tenant with live data, changing a data-classification floor, a new high-risk AI use, a claim from outside the approved library, wind-down | Founder, after the recorded consults in the matrix | Within 10 working days of a complete proposal | Always, as a decision record |
| **B — significant two-way** | Reversible but costly: pricing changes, a hire, an architecture change, a vendor choice, a release with a trust-floor change | The accountable function owner (DRI); founder if cross-functional | Within 5 working days | If it crosses functions, changes a stated commitment, or reverses a prior decision |
| **C — routine** | Reversible and local | The DRI | Same day | Only if surprising |

When unsure of the class, treat it as the stricter one for the first month, then calibrate in the quarterly decision review ([07](07-communications-and-tracking.md#decision-log)).

## Decision-rights matrix

Codes: **D** decides · **R** prepares and recommends · **A** must approve in writing before it takes effect (a gate) · **V** may stop it, and the stop stands until the objection's evidence is attached · **C** consulted before · **I** informed after · **—** no role.

"Independent check" is whoever holds the stop right *because they did not build the thing*. At pre-seed this is outside the company; [who holds it, by stage](#independent-checks-by-stage).

| # | Decision | Class | Founder | Function owner (DRI) | Independent check | External (counsel, CPA, assessor) | Board / advisors | Customer |
| ---: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | Strategy and annual plan | A | D | R | — | — | C (Seed+: A) | I |
| 2 | Financing, equity, entity actions | A | D | — | — | A (counsel, CPA) | C (Seed+: A) | — |
| 3 | Annual budget and reforecast | A | D | R (finance/ops) | — | C (CPA) | C (Seed+: A) | — |
| 4 | Spend within an approved line | C | per [delegation](#delegation-matrix) | D | — | — | — | — |
| 5 | Hire (non-leadership) | B | D | R | — | C (classification) | I | — |
| 6 | Leadership hire/exit; compensation bands | A | D | R | — | C | C (Series A+: A via Compensation) | — |
| 7 | Sign institutional paper (order, data-processing terms) | A | D | R (deal desk) | V (capacity covenant; launch-council gate) | A (counsel for non-standard terms) | C above threshold | A (customer signs) |
| 8 | Price book and discounts | B | D | R (deal desk) | — | C (CPA/tax) | C | — |
| 9 | Public claim, new or changed | A | D only for classified claims with evidence | R (claim owner) | V (any reviewer named on the claim's row) | A (counsel for legal-sensitive categories) | I | A if it names a customer |
| 10 | Release, standard | C | — | D (engineering) | V (automated gates) | — | — | — |
| 11 | Release touching a trust floor (identity, tenancy, data classes, AI routes) | B | C | R | V (security and privacy reviewer) | assessor evidence where required | I | — |
| 12 | Architecture standard | B | C | D | V (security, on trust floors) | — | — | — |
| 13 | New data class, or classification floor change | A | C | R (privacy/data) | V (privacy; two-key) | A (counsel for minors, regulated data) | I | A for tenant data |
| 14 | New vendor or subprocessor receiving student data | B | C | R (vendor owner) | V (security and privacy) | A (counsel on data-processing terms) | I | I (tenant notice per contract) |
| 15 | New AI use case, provider or model change | A | C | R | V (AI quorum; **any member** may engage the kill switch) | C | I | C |
| 16 | Security exception (accept a finding) | B | A, **P2/P3 only**, with expiry | R (security) | V (second reviewer) | C (assessor) | I | I |
| 17 | Privacy or data exception; data-subject request | B | C | D (privacy owner, within the procedure) | V (counsel for novel cases) | C | I | per controller authority |
| 18 | Accessibility conformance statement or report | A | C | R | V (qualified evaluator's report is a precondition) | A (counsel on wording) | I | — |
| 19 | Declare an incident; customer and public communications | A | A for Sev-1 communications | D (incident commander) | V (security and privacy on notification content) | C (counsel on notification duties) | I within 24 h | I per contract |
| 20 | Tenant go-live (activation) | A | D | R (success/implementation) | V (launch-council gate, each seat) | A (counsel); assessor evidence | I (Series A+: reviewed) | A (customer sponsor) |
| 21 | Marketplace provider approval | B | C | D | V (trust and safety, legal) | C | — | — |
| 22 | Risk acceptance | B | A, **P2/P3 only**, with expiry | R (risk owner) | V (**P0/P1 are never waivable**) | — | I | — |
| 23 | Internal policy exception | B | A | R | V (policy owner) | — | — | — |
| 24 | Pause or stop a market motion | A | D | R | May trigger | — | C | I |
| 25 | Org change: reporting lines, reorg | B | D | R | — | C (employment) | I (Series A+: C) | — |

**Rules the matrix assumes:**

- `D` in the Founder column never covers legal conclusions, independent security or accessibility findings, or customer-side authority. The founder coordinates and produces internal evidence but is not their own assessor, counsel or customer ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md#final-motion-accountability)).
- A `V` held by a gate in code (the launch-council `decide()` and the release evaluator) has no override. A risk acceptance cannot waive a P0 or P1 ([`LAUNCH-READINESS-COUNCIL.md`](../../LAUNCH-READINESS-COUNCIL.md)).
- Security, privacy, accessibility and data-rights protections are not tradable for price or schedule.

### Independent checks by stage

| Domain | Pre-seed holder | Seed | Series A and later |
| --- | --- | --- | --- |
| Release and activation | Gates in code; a second reviewer (contractor or advisor) on trust-floor changes | First engineer plus the gates | Engineering lead and security lead, distinct people |
| Security | Independent assessor; fractional security lead (consultant) | Fractional lead, then a first security hire | Security lead reporting outside the engineering line |
| Privacy and data | Retained counsel; privacy practitioner advisor | Part-time privacy/compliance role | Privacy lead |
| Accessibility | Qualified external evaluator | Same, plus a designer with accessibility depth | Accessibility specialist; external evaluator still validates |
| AI | Minimum quorum ([06](06-domain-governance.md#ai)) | Trust & Risk sub-group | Trust committee; full [AI board](../../operating-model/AI-GOVERNANCE-BOARD.md) |
| Claims | Counsel for legal-sensitive categories | Same | Claims owner independent of marketing |
| Finance | CPA and bookkeeper | Same | Finance lead; Audit & Risk |

## Delegation matrix

Dollar values would be invented, so authority is set as **a percentage of trailing-three-month average monthly burn (TMB)**. It scales with the company and survives changing runway. Dollar limits and approval workflow live in [`EXPENSE-APPROVAL-POLICY.md`](../EXPENSE-APPROVAL-POLICY.md) and [`FINANCIAL-CONTROLS.md`](../FINANCIAL-CONTROLS.md); this table sets the structure. Percentages are `[PROPOSE]` starting values for the founder to set (F5).

| Authority | IC (as DRI) | Function lead | Founder | Above the founder |
| --- | --- | --- | --- | --- |
| Spend within an approved budget line, per item | ≤ 0.5% TMB | ≤ 3% | ≤ 20% | Advisors consulted above 20%; board approves above 50% (Seed+) |
| Unbudgeted spend, per item | None | ≤ 1% | ≤ 5% | Advisors consulted above 5% |
| Commitments longer than 12 months, or auto-renewing | None | None | Allowed with counsel on terms | Same |
| Discount from list | Within deal-desk bands | Within bands | Beyond bands, with deal-desk record | Pricing outside the price book: board consulted |
| Hiring | Request only | Within the approved plan | Within the approved plan | Outside plan: advisors consulted |
| Production write access | Two-person for destructive actions; least privilege by role | Same | Same | — |
| Grant access to student data | Never self-grant | Per role design, time-bound | Break-glass only, reviewed afterward | — |
| Contract liability beyond standard terms | None | None | Only after counsel review | Board consulted |

**Non-delegable** (cannot be handed down without a recorded decision and a named, bounded scope): legal conclusions; signing; any claim outside the approved library; accepting a P0 or P1 risk (never allowed); activating a tenant; break-glass access to student content; deleting or disabling audit evidence.

**Delegation is written, bounded and expiring.** A delegation names the person, scope, ceiling, and an end date, and is itself a decision record. "Acting" delegations end when the person who delegated returns or after 30 days, whichever is first.

## Escalation rules

| Trigger | Goes to | Clock | Outcome |
| --- | --- | --- | --- |
| **Stop-work trigger**: suspected secret exposure; unauthorized or cross-tenant access; material data loss; unsupported legal or compliance claim; uncertain customer or data authority; critical accessibility barrier with no equivalent path; unavailable monitoring or support; failed recovery or offboarding; unapproved high-impact AI use (from [`COMPANY-OPERATING-MODEL.md`](../COMPANY-OPERATING-MODEL.md#escalation-and-stop-work-triggers)) | Incident commander, then founder | Immediate; advisors informed within 24 hours | Affected motion withheld until evidence clears it |
| **Anyone pulls the cord** on a trust floor (kill switch, hold on a release or claim) | Founder and the relevant independent check | Reviewed after, not approved before | Reviewed within 2 working days; reversal needs recorded evidence |
| **Two owners disagree** | Founder | Raised within 1 working day; founder decides within 2 | Written decision with the dissent recorded |
| **Class B decision aging** past 5 working days; **Class A** past 10 | Surfaced in the weekly operating review | Automatic | Decide, delegate, or drop; no silent carry-over |
| **Founder conflicted or unreachable more than 72 hours on a Class A item** | Interim operator and counsel ([08](08-continuity.md#activation-ladder)) | At 72 hours | Safe-mode actions only; no new commitments |
| **Independent check and founder disagree** on a trust-floor item | Operator advisor and counsel | 2 working days | The stop stands until the evidence is supplied; the founder may escalate evidence, not authority |
| **Customer executive escalation** | Founder | Same business day | Written response; decision-log if it changes scope |
| **Repeated miss**: the same metric red two quarters running | QBR | Next QBR | Re-scope, resource or stop; "try harder" is not an outcome |

**Dissent protocol:** disagree and commit is allowed only with the dissent written in the record (name, reason, what evidence would change the mind) and a review date. Dissent on a trust-floor item cannot be overridden by commit; it needs evidence.

## Closing the "not enforced" list

[`DECISION-RIGHTS.md`](../../DECISION-RIGHTS.md#where-it-is-not-enforced-owner-decisions-none-made) lists five decisions the database does not yet make two-person. Its own rule is that a line joins that page only with the migration and check that enforce it. So these are **proposals for the owner's decision**, not enforced controls, and they are not added to that page.

| Gap there | Proposed rule | Proposed holder | Where it would eventually be enforced |
| --- | --- | --- | --- |
| Policy or rules exception | Maker and approver differ; written expiry; reviewed at the QBR | Policy owner approves; founder countersigns | Versioned policy engine (row F of the gap matrix) |
| Security exception | Two-person; P2/P3 only; expiry ≤ 90 days `[HYPOTHESIS]`; second reviewer is not the author | Security reviewer + founder | Exceptions register with an enforcing check |
| Data exception (a school asks for a field outside its scope) | Two-person; counsel for minors or regulated data; tenant's own privacy owner approves | Privacy owner + customer privacy owner | Tenant configuration with approval flow |
| Data-subject request | Named owner; acknowledged and answered within the contractual or legal clock `[COUNSEL]`; novel cases to counsel | Privacy owner | [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md) clock and a status record |
| Pilot go/no-go signature | Every council seat signs; customer seats sign their side | Seat holders | `decide()` already refuses without them |

## What to delete

If a row of the matrix has never been used in two quarters, collapse it into its class default. If a delegation threshold is hit more than weekly, raise it deliberately; a ceiling that is always exceeded trains people to ignore it.
