# 9 · Business continuity for leadership and key-person risk

> **PROPOSED — NOT ADOPTED.** Extends [`BUSINESS-CONTINUITY-OPERATING-PLAN.md`](../BUSINESS-CONTINUITY-OPERATING-PLAN.md), which covers continuity in general and lists key-person loss as one scenario row. This page is the leadership-specific plan that row points to. **A tabletop is not proof of recovery.** Authority, incapacity and succession documents are `[COUNSEL]`. This page contains no credentials and the repository must never hold any.

## Where the company stands

`[FACT]` One person is primary for all 15 company-side seats and every backup is unassigned. The owner matrix already states what follows: a missing primary/backup is a NO-GO for the affected motion, and one person's assignment "cannot substitute for … proof of backup coverage" ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)).

That means the company currently has: one set of credentials, one set of decisions, one memory, one calendar. Anything that happens to that person, including an ordinary bad week, stops everything. For a full-time student founder the ordinary risks include exam periods, illness, travel, internships and graduation. None of these is a failure; all are predictable. **The plan treats predictable capacity dips as scheduled events, and unpredictable loss as a drill-tested path.**

## Key-person risk register

Scored for each critical seat and asset: **concentration** (how many people hold it), **impact** (what stops if it is unavailable), **substitutability** (how long to replace). High on all three is Tier 1.

| # | Seat / asset | Today | Impact if unavailable | Tier | Mitigation | Target by |
| ---: | --- | --- | --- | :-: | --- | --- |
| 1 | Production deploy, rollback, restore | Founder | Cannot fix or recover the product | 1 | Runbooks verified by a second person; second engineer; restore drill | Seed (backup named); Month 3 (drill) |
| 2 | Cloud, database and hosting admin | Founder | No access to production or data | 1 | Second admin; emergency recovery kit; access review | Month 1 |
| 3 | Source repository and CI admin | Founder | Cannot ship; cannot revoke access | 1 | Second owner on the organisation; branch protection | Month 1 |
| 4 | Secrets and key management | Founder | Cannot rotate after exposure | 1 | Documented rotation; second holder ([`SECRETS.md`](../../../SECRETS.md)) | Month 1 |
| 5 | Domain registrar and DNS | Founder | Cannot control the web or email identity | 1 | Second registrant contact; registry lock if available | Month 1 |
| 6 | Banking, payment processor, accounting | Founder | Cannot pay, bill or reconcile | 1 | Second authorised person or CPA-held access per advice; dual approval above threshold `[COUNSEL]` | Month 2 |
| 7 | Legal signature and entity authority | Founder | Cannot sign or act | 1 | Incapacity and successor documents `[COUNSEL]`; operator advisor's bounded authority | Month 2 |
| 8 | Incident command | Founder | No one declares or leads an incident | 1 | Named incident commander and backup; runbook; tabletop | Month 3 |
| 9 | Data-rights request owner | Founder | Clocks missed | 2 | Named owner and backup; clock tracker | Month 3 |
| 10 | App-store and developer accounts | Founder | Cannot ship mobile; cannot respond to a store action | 2 | Second admin; recovery kit | Month 2 |
| 11 | Customer and design-partner relationships | Founder | Relationships depend on one person | 2 | Second named contact per pilot; shared notes | First pilot |
| 12 | Brand, social and public accounts | Founder | Cannot correct or withdraw a claim | 2 | Second holder; claims register | Month 2 |
| 13 | Product and architectural knowledge | Founder | Decisions undocumented | 2 | Decision records; runbooks; recorded walkthroughs | Ongoing |
| 14 | Advisor and counsel relationships | Founder | Introductions are personal | 3 | Shared contacts in the restricted package | Month 2 |

**Exit criteria for "key-person risk retired":** every Tier-1 asset has at least two independent holders; a drill has passed in the last six months; no seat is single-held ([stage trigger for Series A](04-organization-and-hiring.md#stage-triggers)).

## Bus-factor sprint

First 30 days. Everything here is possible **without a hire**. In order of risk retired per hour.

| # | Action | Owner | Evidence |
| ---: | --- | --- | --- |
| 1 | **Emergency recovery kit**: a sealed, offline package in restricted storage (recovery codes, account inventory, contact list, procedures), never in the repository, with a defined process for who can open it and when | Founder | Kit exists; opening procedure written; tested with the holder |
| 2 | **Second holder on every Tier-1 account** (items 2–6 and 10 in the register), using the provider's own delegation features, not a shared password | Founder | Access list reviewed |
| 3 | **Runbook-from-recording** for the ten most critical operations: record the founder performing each, have someone else follow the written result | Founder + second reviewer | The follower completed the operation unaided |
| 4 | **Interim operator** named (F4): a trusted advisor with a written, bounded, time-limited authority to run [safe mode](#safe-mode) | Founder + counsel | Signed document `[COUNSEL]` |
| 5 | **Incapacity and succession documents** for entity matters: who may act, how, and for how long `[COUNSEL]` | Counsel | Executed documents |
| 6 | **Capacity covenant** adopted ([below](#capacity-covenant)) | Founder | Decision record |
| 7 | **Insurance explored** with a broker: key-person cover, D&O, cyber, E&O `[COUNSEL]` | Broker | Coverage assessment |
| 8 | **Contact and access package** maintained in restricted storage: primary and backups, emergency contacts, bank, provider, customer and professional contacts, critical contracts ([`BUSINESS-CONTINUITY-OPERATING-PLAN.md`](../BUSINESS-CONTINUITY-OPERATING-PLAN.md#contact-and-access-package)) | Founder | Package reviewed monthly |
| 9 | **Unplug drill** scheduled ([below](#unplug-drill)) | Founder + operator advisor | Date in calendar |

## Capacity covenant

> **Semester does not sign, promise or publish a commitment whose delivery depends on one named person unless a named, accepted backup exists for it.**

This is the contractual form of the owner-matrix rule that an unassigned backup is a NO-GO. It applies to: institutional paper, service levels, support hours, response times, implementation dates, and anything in a claim that implies a staffed service. It is checked at the [contract-signing decision](02-decision-rights.md#decision-rights-matrix) and the QBR. Where a customer asks for more than Semester can staff, the answer is a smaller scope, not an optimistic one.

## Capacity planning for a student founder

| Practice | How |
| --- | --- |
| **Declared capacity** | Founder states hours per week by month and the exam, travel and transition windows in advance (F7) |
| **Blackout weeks** | In declared windows: no launches, no new commitments, no contract signatures, no activations; weekly meetings move to writing; on-call is held by the backup or the interim operator |
| **Seasonal use** | Long breaks are for build work and drills, not for stacking new commitments on top of them |
| **Transitions** | A planned change (graduation, internship, relocation) triggers a handover plan 8 weeks ahead and a review of every seat held |
| **Visible** | Capacity and blackouts appear in the [calendar](09-calendar.md) and in each board packet's capacity page |

## Activation ladder

Activation is deliberately boring and timed, so nobody has to judge it alone while stressed. The continuity owner may activate earlier when harm is likely ([`BUSINESS-CONTINUITY-OPERATING-PLAN.md`](../BUSINESS-CONTINUITY-OPERATING-PLAN.md#activation)).

| Founder status | Who acts | What happens |
| --- | --- | --- |
| **Unreachable under 24 hours** | Nobody | Business as usual; planned blackout weeks follow the same path |
| **Unreachable 24–72 hours** | Interim operator checks silently | Confirms monitoring and support are up; contacts the founder's emergency contact |
| **Unreachable beyond 72 hours, or an incident with the founder unavailable** | Interim operator, with counsel | **Safe mode** begins; advisors informed within 24 hours |
| **Unavailable beyond 14 days** | Interim operator and board/advisor chair | Review scope; may extend safe mode, delegate named decisions, or begin a counsel-led plan |
| **Permanent loss or exit** | Governing body and counsel | Succession per documents `[COUNSEL]`; customer, data and vendor continuity plan; wind-down or transition option |

### Safe mode

The interim operator's authority is **bounded and does only the following**:

1. **Preserve safety and data.** Confirm monitoring, backups and access control are working; run incident response if needed.
2. **Freeze change.** No new releases except security fixes; no new customer, financial or legal commitments; no tenant activations; no public statements beyond the pre-approved holding statement ([`CRISIS-COMMUNICATIONS-TEMPLATE.md`](../CRISIS-COMMUNICATIONS-TEMPLATE.md)).
3. **Keep support and data rights running** at the minimum viable level; status page accurate.
4. **Communicate** to design partners, pilots and advisors with facts only.
5. **Hold deadlines** that carry legal or financial consequence (filings, payments) with the CPA and counsel.
6. **Record every action** as a decision record, for the founder's review on return.

The interim operator cannot sign contracts, raise capital, change pricing, approve claims, access student content, or change security exceptions.

## Other leadership-continuity scenarios

| Scenario | Immediate action | Path | Evidence before normal operation |
| --- | --- | --- | --- |
| **Co-founder or partner dispute** `[COUNSEL]` | Pause irreversible decisions; counsel and operator advisor consulted | Documented decision rights; vesting and IP terms apply; mediation | Governance documents and decision log; no unilateral change to access |
| **A critical hire leaves** | Revoke access the same day; hand over owned runbooks | Backup takes over; backfill per hiring plan | Seat map and owner matrix updated; access audit |
| **Advisor or counsel unavailable** | Use the listed alternate | Contact package names two alternates per role | Package updated |
| **Founder conflict of interest** | Recuse; operator advisor or counsel decides | Conflict recorded | Decision record with recusal |
| **Cash constraint** | Invoke the approved runway trigger: the finance model proposes 12, 9, 6 and 3 months, and at 3 months activates this plan ([`05-BUDGET-GOVERNANCE.md` §5](../../finance/05-BUDGET-GOVERNANCE.md#5-cash-and-performance-triggers-proposed); template: [`BUDGET-AND-CASH-RUNWAY-TEMPLATE.md`](../BUDGET-AND-CASH-RUNWAY-TEMPLATE.md)) | Freeze non-essential spend; narrow scope; protect safety and data obligations first | Authorised forecast and obligations review |
| **Vendor failure** | Fail closed or degrade; contact vendor | Replacement per vendor register | Integrity and reconciliation checks |
| **Wind-down or transition** | Counsel-led preservation and notices | Export and return of data; deletion per schedule; contract, vendor and account closure | Stakeholder-approved closure register; student data handled per the offboarding and retention rules |

## Unplug drill

The only way to know the plan works is to remove the founder and watch.

| Step | Detail |
| --- | --- |
| **When** | First within the first 90 days; then at least every six months; always in a calendar window that is not a blackout |
| **Scope** | The founder is genuinely offline (no phone, no messages) for 72 hours; the interim operator and backups run the company in safe mode and handle a **scripted** event (for example a support request and a simulated alert) |
| **Pass** | Monitoring and support stayed up; the scripted event was handled correctly with the runbooks; nobody needed the founder's credentials; the interim operator did only what safe mode allows |
| **Fail** | Anything needed the founder; any step undocumented; any access gap |
| **Evidence** | A filed report: scenario, participants, timing, gaps, owners, retest date. A tabletop is recorded as a tabletop and never as recovery evidence |

Offboarding is exercised in the same drill: revoke a test account and confirm it is gone in every system.

## Review

Quarterly with the QBR: the key-person register, the seats without a backup, capacity for the next quarter, the status of the sprint and drills. Annually: the continuity plan itself, the insurance assessment, the interim operator's agreement.

## What to delete

If a mitigation has been in place and a drill has passed twice, move it from "plan" to "routine" and stop reporting it. If the register has more than about fifteen rows, merge the minor ones; attention is finite.
