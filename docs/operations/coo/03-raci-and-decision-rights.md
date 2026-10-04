# 03 · Operational RACI and decision rights

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — SEATS ARE ACCEPTANCES, NOT USERNAMES** |
| Owner seat | `founder` |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`OWNER-AND-ACCOUNTABILITY-MATRIX`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md), [`LAUNCH-READINESS-COUNCIL`](../../LAUNCH-READINESS-COUNCIL.md), [`DECISION-RIGHTS`](../../DECISION-RIGHTS.md), [`RACI-MATRIX`](../../market-readiness/RACI-MATRIX.md), [`COMPANY-OPERATING-MODEL`](../../company/COMPANY-OPERATING-MODEL.md) |
| Claim ceiling | Semester may say it has defined decision rights. It may not say any seat is staffed beyond the seats the council records as held. |

## What this page adds

The existing matrices say who is accountable for a *domain* (the owner matrix) and who decides a handful of *launch* motions (the council and the pilot RACI). This page says who decides each *operational* decision a working week produces, what kind of decision it is, who may stop it, and how far a decision may be delegated.

## Principles

1. **One accountable seat per decision.** Exactly one `A` in every row. Where a customer holds the authority, the customer is the `A` and Semester's seats are `R` or `C`. Where both sides must approve, the matrix has two rows.
2. **A seat is an acceptance.** The seats are those of the [council](../../LAUNCH-READINESS-COUNCIL.md): `founder`, `product`, `engineering`, `security`, `privacy`, `accessibility`, `success`, `trust`, `data`, `finance`, `operations`, and the customer's `champion`. A seat counts only once somebody accepted it in writing. Today `security`, `trust`, `data`, `finance` and `champion` are vacant and `privacy` is outside counsel.
3. **Acting is disclosed.** Where the Founder acts in a vacant or shared seat, the decision record says *acting* and no one reads that as independent assurance. A person cannot be their own qualified assessor, counsel or customer approver.
4. **Hold is not decide.** A seat with a hold right may stop a motion in its own domain. It does not thereby make the decision. Lifting a hold needs remediation evidence, or a founder risk acceptance for a P2 or P3 blocker only. A P0 or P1 hold cannot be waived.
5. **Protections are not tradable.** Security, privacy, accessibility and data-rights protections are not traded for price or schedule.
6. **Decisions leave a record.** The record location is in the last column of each table and the rule is in [01](01-operating-cadence.md#rules).

## Legend

`A` accountable (decides, answers for it) · `R` responsible (does the work) · `C` consulted before the decision · `I` informed after · `H` hold right in its own domain (may stop, may not decide) · `—` no role.

Columns: **F** founder · **Pr** product · **En** engineering · **Se** security · **Pv** privacy (counsel) · **Ax** accessibility · **Su** success · **Ts** trust · **Da** data · **Fi** finance · **Op** operations · **Cu** customer sponsor or champion.

## Decision classes

| Class | Test | Who decides | Speed | Record |
| --- | --- | --- | --- | --- |
| **1 · One-way** | Hard to reverse, binds the company, touches rights, or exposes student data | The `A` in the matrix, after every `C` has answered in writing | Scheduled; decided at the next WOR or by an explicit date | Decision record; for repository changes `D-<pull request number>` |
| **2 · Two-way** | Reversible within a normal cycle at modest cost | The `A`, after consulting the `C`s | Within three business days of being raised | One-paragraph record in WOR notes |
| **3 · Standard** | Covered by a standing policy or template | Anyone the policy authorizes | Immediate | The artifact the policy produces |
| **E · Emergency** | Active SEV1 or SEV2, or imminent harm | The incident commander, with the authority in [05](05-incident-and-continuity.md#roles) | Immediate; reviewed within five business days | Incident record |

**Reversibility test** (use before classing a decision as 2): *can we undo this within a week, at a cost we would pay, without anyone outside the company having relied on it?* If any answer is no, it is Class 1.

**Decision aging** is a dashboard metric ([09](09-dashboards-and-indicators.md#d1-executive-scorecard)): the number of Class 1 and Class 2 decisions open beyond their speed. More than two open past their date at a WOR is an agenda item.

## The matrix

### Company and strategy

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | Company strategy, positioning, market sequencing | 1 | A | R | C | C | C | I | C | I | I | C | I | — | Strategy memo |
| C-02 | Annual plan and budget envelope | 1 | A | C | C | I | I | I | C | I | I | R | C | — | Annual plan |
| C-03 | Quarterly objectives | 2 | A | R | R | C | I | C | R | C | C | C | R | — | QBR notes |
| C-04 | Stage promotion or demotion | 1 | A | C | C | C | C | C | C | C | C | C | R | — | QBR notes |
| C-05 | Open or close a hire against a trigger | 1 | A | C | C | C | I | I | C | I | I | C | R | — | Hiring record |
| C-06 | Financing, equity, major commitments | 1 | A | — | — | — | C | — | — | — | — | R | — | — | Private |
| C-07 | Approve a public claim | 1 | A | R | C | C/H | C/H | C/H | C | C | C | I | C | — | [Claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| C-08 | Accept a P2 or P3 risk (never P0 or P1) | 1 | A | C | C | C | C | C | C | C | C | C | R | I | Acceptance log: owner, reason, user disclosure, expiry |
| C-09 | Grant a policy exception | 2 | A | C | C | C | C | C | I | I | I | I | R | — | [Exception process](../../company/POLICY-EXCEPTION-PROCESS.md) |
| C-10 | Retire or sunset a capability | 2 | C | A | R | C | C | C | R | I | I | I | C | I | Portfolio review |

### Product and release

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | Product scope and roadmap | 2 | C | A | C | C | C | C | C | C | C | I | C | — | Roadmap |
| P-02 | Platform release GO or NO-GO | 2 | I | R | A | C/H | C/H | C/H | C | I | C | I | R | — | Release record |
| P-03 | Enable a capability for a named tenant | 1 | I | A | R | C/H | C/H | C/H | R | C | C | I | C | C | Activation register |
| P-04 | Release an AI feature, tiers 0–2 | 2 | I | A | R | C/H | C/H | C | I | C | C | I | I | — | AI inventory |
| P-05 | Release an AI feature, tiers 3–5 | 1 | A | R | R | R/H | C/H | C | I | C | C | I | I | C | AI governance record |
| P-06 | Change AI model or provider | 2 | I | C | A | C/H | C/H | I | I | I | C | C | R | — | Change record |
| P-07 | Architecture standard, ADR | 2 | I | C | A | C | C | I | I | I | C | I | I | — | ADR |
| P-08 | Production database migration | 1 | I | I | A | C/H | C | I | I | I | C/H | I | R | I | Change record |
| P-09 | Roll back a release | E | I | I | A | C | I | I | I | I | I | I | R | I | Incident or change record |
| P-10 | Emergency change | E | I | C | R | C | C | I | I | I | I | I | A | I | Change record |

### Customers and implementation

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I-01 | Qualify an opportunity | 2 | A | C | C | I | C | I | R | I | I | C | I | — | Qualification record |
| I-02 | Price, discount, pilot credit | 1 | R | C | I | I | C | I | C | I | I | A | I | — | Deal-desk record |
| I-03 | Sign a contract or data-processing terms (Semester side) | 1 | A | C | C | C | R | C | C | I | I | C | I | — | Contract tracker; private |
| I-04 | Implementation charter (Semester side) | 2 | C | C | C | C | C | C | A | I | C | I | C | C | Charter |
| I-05 | Accept the security and privacy review package (customer side) | 1 | I | I | C | R | R | I | C | I | I | I | I | A | Customer's own record |
| I-06 | Council GO or NO-GO (Semester side) | 1 | A | R | R | R/H | R/H | R/H | R | C | C | C | R | C | Council decision record |
| I-07 | Customer launch approval (customer side) | 1 | I | I | I | I | I | I | R | I | I | I | I | A | Customer's own record |
| I-08 | Live-tenant configuration change | 2 | I | C | R | C | I | I | A | I | C | I | C | C | Change record |
| I-09 | Enable a read-only integration | 2 | I | C | R | C/H | C/H | I | C | I | A | I | C | C | Integration catalog |
| I-10 | Enable a write-enabled integration | 1 | A | C | R | C/H | C/H | C | C | I | R | I | C | C | Approval record |
| I-11 | Pause or suspend a tenant | E | I | I | C | C/H | C/H | I | R | I | I | I | A | I | Incident or change record |
| I-12 | Renewal, expansion proposal | 1 | A | C | I | I | C | I | R | I | I | R | I | I | Proposal |
| I-13 | Convert, extend or stop verdict (Semester side) | 1 | A | C | C | C | C | C | R | I | I | C | C | C | Verdict record |
| I-14 | Offboarding and deletion under a legal hold or retention rule | 1 | I | I | R | C | A | I | R | I | R | I | I | C | Completion certificate |

### Support and incidents

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | Support hours, channels, scope | 1 | C | I | I | I | C | C | C | I | I | C | A | I | Support policy |
| S-02 | Override a case priority | 3 | I | I | I | I | I | I | C | I | I | I | A | — | Case record |
| S-03 | Grant support access to a person's data | 2 | I | I | I | A | C | I | I | I | I | I | R | C | Access grant: purpose, scope, expiry, audit |
| S-04 | Declare, escalate, close an incident | E | I | I | R | C | C | I | I | I | I | I | A | I | Incident record |
| S-05 | Public or customer incident communication, not security or privacy | 2 | I | I | R | I | I | I | R | I | I | I | A | I | Notice record |
| S-06 | Security or privacy incident communication | 1 | A | I | R | R | C/H | I | R | I | I | I | R | I | Notice record |
| S-07 | Decide notification duties | 1 | C | I | I | R | A | I | R | I | I | I | I | C | Counsel record |
| S-08 | Accept a post-incident review and its actions | 2 | I | I | R | C | C | I | I | I | I | I | A | I | Review record |
| S-09 | Fulfil a data-rights request | 1 | I | I | R | C | A | I | I | I | R | I | R | C | Request record |
| S-10 | Prioritize an accessibility barrier | 2 | I | R | R | I | I | A | C | I | I | I | I | I | Barrier record |
| S-11 | Crisis or imminent-harm referral | E | I | I | I | I | C | I | I | A | I | I | C | I | [Crisis runbook](../../CRISIS-RESPONSE-RUNBOOK.md) |

### Security, vendors and money

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-01 | Approve a new vendor or subprocessor | 2 | I | C | C | R | R | I | I | I | C | C | A | I | Vendor register |
| V-02 | Renew or terminate a vendor | 2 | C | I | C | C | C | I | I | I | I | A | R | — | Vendor register |
| V-03 | Publish a change to the subprocessor list | 1 | C | I | I | C | A | I | R | I | I | I | R | I | [`SUBPROCESSORS`](../../SUBPROCESSORS.md) |
| V-04 | Grant or remove privileged access | 2 | I | I | R | A | I | I | I | I | I | I | R | — | Access log |
| V-05 | Spend above the approval policy | 1 | R | C | C | I | I | I | I | I | I | A | I | — | [Expense policy](../../company/EXPENSE-APPROVAL-POLICY.md) |
| V-06 | Credit or refund (Semester's own commercial) | 2 | I | I | I | I | I | I | C | I | I | A | I | — | Ledger entry; the database's two-person rule applies |
| V-07 | Revenue-recognition treatment | 1 | C | I | I | I | I | I | I | I | I | A | I | — | Advisor memo |

### Trust, marketplace and partners

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | Approve a provider for listing | 2 | I | R | C | C | C | C | I | A | I | C | I | — | Provider record |
| M-02 | Suspend or remove a provider | 2 | I | I | I | C | C | I | C | A | I | C | I | I | Provider record |
| M-03 | Resolve a marketplace dispute, not safety | 2 | I | I | I | I | C | I | C | R | I | A | I | — | Dispute record |
| M-04 | Resolve a dispute involving safety | E | I | I | I | I | C | I | I | A | I | I | I | — | T&S case |
| M-05 | Decide a moderation action or appeal | 2 | I | I | I | I | I | I | I | A | I | I | I | I | T&S case; appeals reviewed by a second person |
| M-06 | Partner agreement or certification claim | 1 | A | C | C | C | R | C | C | I | C | I | I | — | Partner record; [claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| M-07 | Promote the marketplace to the next phase | 1 | A | R | C | C/H | C/H | C | I | R | C | R | I | — | Decision record; counsel |
| M-08 | Enable a new community type | 1 | C | A | C | C/H | C/H | C | I | C/H | I | I | I | — | Activation register |

### People and operations

| ID | Decision | Class | F | Pr | En | Se | Pv | Ax | Su | Ts | Da | Fi | Op | Cu | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| O-01 | Accept a process transfer from the founder | 2 | R | I | I | I | I | I | I | I | I | I | A | — | [Transfer record](11-founder-to-team-transition.md#the-transfer-ladder) |
| O-02 | Certify a person for a sensitive role | 2 | I | I | I | C | C | I | I | C | I | I | A | — | Training record |
| O-03 | Approve a runbook as exercised | 2 | I | I | R | C | I | I | I | I | I | I | A | — | Runbook header |
| O-04 | Change this operating system | 2 | A | C | C | C | C | C | C | C | C | C | R | — | Pull request with decision file |

## Stop authority

Anyone may stop a motion by naming a safety, privacy or security concern; the stop holds until an owner of the domain reviews it. The named holders may stop in their own domain with no further process.

| Stop | Holder | Scope | Lifted by |
| --- | --- | --- | --- |
| Halt a release or change | `engineering`, `operations` (incident commander) | Any deployment during SEV1 or SEV2, or on a failed gate | Gate evidence or the incident's close |
| Freeze deploys | Incident commander | All non-essential changes during an active incident | Incident commander |
| Disable a feature flag or kill switch | `engineering`, incident commander | Any capability | Re-enable through the activation control plane |
| Halt a launch on an unresolved P0 or P1 | `security`, `privacy`, `accessibility` | The tenant or capability affected | Remediation evidence; never waived |
| Suspend a tenant | `operations` | One tenant | Remediation evidence and the rollout state machine |
| Suspend a provider or listing | `trust` | One provider | T&S case outcome |
| Suspend an AI route | `engineering`, AI governance board | One feature or provider route | Re-run of the evaluation suite |
| Withdraw | The customer | Their own participation | Their own decision |

The database enforces two-person rules for several of these ([`DECISION-RIGHTS`](../../DECISION-RIGHTS.md)): grade changes, refunds, role grants and others. They hold whatever this page says. Where a decision is not enforced there, this page and the decision record are the only control; the owner decisions still open are listed there.

## Two-person and independent-approval rules

| Situation | Rule |
| --- | --- |
| Support access to a person's data | Requester and approver differ. Where the Founder is the only person, the customer's consent record is the second party and an outside reviewer reads the access log within one business day. |
| Production access grant | Requester and approver differ; access is least-privilege and time-limited; recertified quarterly |
| Contract signature | Counsel's written review precedes signature; the signer is not the only reader |
| Refund or credit above threshold | The database's rule: whoever requested or approved a payment does not approve its reversal |
| Tier 3–5 AI release | `security`, `privacy` and `engineering` each signed; the founder decides |
| Any decision where the sole producer and sole approver are the same person | Marked *self-approved* in the record; read by an independent reviewer at the next monthly review |

## Delegation of authority

Delegation is explicit, bounded and revocable. Amounts and thresholds are set by their own policies, not invented here.

| Authority | Retained by the founder | May be delegated | Limit set by |
| --- | --- | --- | --- |
| Spending | Above the policy ceiling | Within the ceiling to a named budget owner | [`EXPENSE-APPROVAL-POLICY`](../../company/EXPENSE-APPROVAL-POLICY.md) |
| Discounts and credits | Outside the deal-desk policy | Within it to `finance` | `DEAL_POLICY`, [`COMMERCIAL-GOVERNANCE`](../../operating-model/COMMERCIAL-GOVERNANCE.md) |
| Contract signature | All, until counsel advises otherwise | Never without written authority | Counsel |
| Risk acceptance | P2 and P3 | Never P0 or P1 | Council rules |
| Incident command | During SEV3 and SEV4 | To any trained incident commander | [05](05-incident-and-continuity.md#roles) |
| Public claims | All | Approval to a trained owner for a claim class once the class is approved | Claims register |
| Hiring | All | Offer authority to a hiring manager inside an approved role | Annual plan |
| Customer-facing commitments | All beyond the chartered scope | Within a signed charter to `success` | Charter |

Record each delegation with [TPL-21](templates.md#tpl-21-delegation-of-authority-record): who, what, limit, start, end, revocation condition, and the person who reads exceptions.

## Rules for editing this page

A change to the matrix is a pull request with a decision file. A new decision type is added when it has occurred twice and caused confusion, not before. A seat is added to a row only with a reason and an owner for the consequences.

## Related

[Council](../../LAUNCH-READINESS-COUNCIL.md) · [Owner matrix](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) · [Handoffs](handoffs.md) · [Templates TPL-04, TPL-21](templates.md)
