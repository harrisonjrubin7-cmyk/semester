# 06 · Tenant launch coordination and post-launch follow-up

> Part of the [program pack](README.md). Applies to one design-partner cohort,
> after the council records GO for activation (PGM-07). Nothing here authorizes
> live data: until that record exists the only authorized institutional work is
> discovery, synthetic demonstration, evidence exchange and scoping
> ([`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).
> The [90-day program](../90-DAY-LAUNCH-PROGRAM.md) is the task list and
> `app/src/lib/launch/ninety-day.ts` is its source; this page sequences and
> coordinates it and does not copy it.

## The 90-day program is necessary, not sufficient

The 90-day program's last launch task, `launch-cohort`, waits on six others
(`uat`, `training`, `support-ready`, `restore-rehearsal`, `comms`, `a11y-core`). The 3 October conditions
add what no task there produces: an independent security review, a qualified
accessibility evaluator, counsel-approved paper, a witnessed target-environment
restore and a signed customer scope. Closing every 90-day task therefore does
not close PGM-07. The table says which node each task feeds, and where the
task's own evidence is narrower than the node requires.

| 90-day task | Window | Feeds | Gap to the node |
| --- | --- | --- | --- |
| `icp-cohort` | 1 | PGM-03 | a chosen profile is not a named, willing sponsor (PDR-06) |
| `charter-drafts` | 1 | EXT-003 | drafts reviewed by counsel are not executed paper |
| `demo-pages` | 1 | S0 discovery | synthetic data only |
| `trust-outline` | 1 | EXT-017, EXT-002 | claims backed by the register, not counsel's approval |
| `data-inventory` | 1 | EXT-017 | inventory is not approved provider terms |
| `recruit-beta` | 1 | PGM-08 | invitations accepted, not UAT |
| `launch-metrics` | 1 | EXT-015 | metrics with floors, not a signed customer baseline |
| `a11y-core` | 1 | EXT-008 | closes on a test report; EXT-008 needs a *qualified* evaluator |
| `sign-pilot` | 2 | EXT-003, EXT-012 | needs EXT-006, EXT-008, EXT-009 first, per the queue's preconditions |
| `tenant-flags` | 2 | EXT-012 | the flag list, not the customer's approval of scope |
| `identity` | 2 | EXT-013, EXT-018 | an acceptance run, not signed role and isolation results |
| `content-loaded` | 2 | product readiness | none beyond the register |
| `uat` | 2 | EXT-014 | needs EXT-013 first; the node requires signed acceptance |
| `training` | 2 | product readiness | none |
| `support-ready` | 2 | EXT-009, EXT-010 | a named owner is not a backup, a rota or a tested alert |
| `restore-rehearsal` | 2 | EXT-011 | a disposable restore is not a witnessed target-environment drill |
| `comms` | 2 | product readiness | the school's approval, not counsel's |
| `launch-cohort` | 3 | PGM-07 | all of the above, plus every node in 02 |
| `hypercare` | 3 | PGM-06 | none |
| `weekly-ops` | 3 | PGM-06 | none |
| `track` | 3 | PGM-06 | thresholds from EXT-015 |
| `fix-friction` | 3 | PGM-06 | none |
| `midpoint-report` | 3 | PGM-06, EXT-015 | aggregate only |
| `annual-proposal` | 3 | S6 decision | must cite the midpoint report |
| `quotes` | 3 | EXT-016 | each quote needs written permission naming the claim, channel and term |

## Coordination: who signs what

Company seats are all Harrison Rubin as primary with no backup, so every row
below that names a company seat carries RAID-R05 until EXT-009 closes. The
customer's seats are all "NOT IDENTIFIED" today.

| Stage | Customer signs | Company signs | Independent | Entry needs | Exit evidence |
| --- | --- | --- | --- | --- | --- |
| **Qualify** (S0) | nothing; the prospect controls its name and what it shares | claim ceilings; no customer status | none | PDR-06 answered | cohort, size and decision date named in a charter draft |
| **Contract** | sponsor and procurement or counsel: pilot agreement, data terms | founder: scope, price authority (not for a paid motion) | counsel on both sides (EXT-003) | PGM-03; EXT-001 | executed paper with the data scope it approves (`sign-pilot`) |
| **Configure** | IT: identity and integration scope; privacy: data map; security and accessibility: review dates | engineering: tenant and flags | assessor (EXT-006) and evaluator (EXT-008) report | executed paper; PGM-02 | tenant row, flag list, identity run; role and isolation results signed (EXT-013) |
| **Prove** | champion and users: UAT; sponsor: baseline and stop criteria | product; support | witness for drills (EXT-011) | configured tenant | signed UAT (EXT-014); signed baseline (EXT-015); drills filed |
| **Decide** | sponsor: launch approval | the council seats | none | every PGM-07 node closed | the signed go/no-go record |
| **Launch** | champion: communications to its users | support: hypercare staffing | none | PGM-07 | first invitations accepted |

## Stop conditions

Any stop condition in the pilot charter pauses the cohort. In addition, the
program stops activation, whatever the stage, on the launch risk register's
[immediate escalation conditions](../../LAUNCH-RISK-REGISTER.md) and on any of:
an expired or withdrawn artifact that a PGM-07 node rests on; a named customer
seat vacating without a replacement; a change to legal, data, AI, identity,
payment or high-impact workflow that has not been reviewed. The school is told
with the "pilot is paused" template in
[`ANNOUNCEMENT-TEMPLATES.md`](../launch/ANNOUNCEMENT-TEMPLATES.md).

## Post-launch follow-up

Starts at the first accepted invitation. The war room runs daily until hypercare
ends; the weekly program review (04) continues throughout.

| Point | Review | Output | Owner (role) |
| --- | --- | --- | --- |
| Daily, first 14 days | `hypercare`: issue log, alert and support queue | the daily line | support |
| Weekly | `weekly-ops`: one line a week, including the fine weeks; program review | changelog line; status report | founder |
| Day 14 | hypercare exit: open issues by severity, stop criteria read against the baseline | continue or pause, written | founder with the champion |
| Day 30 | `track`: activation, actions, support, accessibility, cost and trust, no cell under ten | the three figures in `ANALYTICS.md` | product |
| Midpoint | `midpoint-report`: against the charter's outcome criteria, aggregate only; `fix-friction` closed for the top three problems | the report | customer success |
| Closeout | measured closeout accepted by the sponsor; evidence reconciled | accepted closeout record (PGM-06); permission letters for any reference (EXT-016) | founder; sponsor |
| After closeout | one of: expand or convert ([`PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md)); extend with a new written scope; stop and offboard ([`SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md)) | a decision record; `annual-proposal` if expanding | founder; sponsor |

A paid pilot is reconsidered only on an accepted closeout, per the decision. The
retrospective is not optional: gaps found during the pilot return to this pack
as RAID rows and to the launch risk register as risks, so the second deployment
starts from a corrected plan.

## What the pack cannot do for a tenant launch

It cannot name the customer, engage counsel or an assessor, or supply a second
operator. It can say, for each of those, which node waits on it, for how long at
best, and what happens if the answer is no. That is the whole of RAID-D01 to
RAID-D10.
