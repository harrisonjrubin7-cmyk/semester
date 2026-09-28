# The 90-day controlled launch program

Launch-readiness Phase 6. Three windows of thirty days. Each task names an owner, the evidence that closes it, and the tasks that must finish before it can start.

The tasks are `TASKS` in `app/src/lib/launch/ninety-day.ts`. `ninety-day.test.ts` checks four things:

- this page and the code list the same tasks;
- no task depends on a later window;
- there are no cycles;
- `overclaims` catches a status that says a task is done while something before it is not.

**The controlled cohort launches only after** UAT, training, support readiness, a restore rehearsal, communications and core accessibility testing are all done. The code states that, so a status column cannot skip it.

Owners are roles, not people. The `champion` is the school's named sponsor; every other role is Semester's.

## Days 1–30

| Id | Task | Owner | Closed by | After |
| --- | --- | --- | --- | --- |
| `icp-cohort` | Choose the ideal customer profile and the pilot cohort | founder | The pilot charter names the institution, the cohort and its size | — |
| `charter-drafts` | Finalize pilot charter, pricing and terms drafts | founder | Draft charter and order form, reviewed by counsel | `icp-cohort` |
| `demo-pages` | Create the demo and the role pages | product | A demo script that runs on synthetic data only | `icp-cohort` |
| `trust-outline` | Create the trust center outline | privacy | docs/SUBPROCESSORS.md and the procurement checklist, with every claim backed | — |
| `data-inventory` | Complete the data inventory and security baseline | engineering | RETENTION.md names every table; the security baseline is recorded | — |
| `recruit-beta` | Recruit beta students and institutional design partners | customer_success | Invitations recorded in the private beta, each accepted by the person | `icp-cohort` |
| `launch-metrics` | Set the launch metrics | product | docs/PRODUCT-ANALYTICS-DATA-ETHICS.md lists each metric and its floor | — |
| `a11y-core` | Conduct core accessibility testing | accessibility | A test report for the golden path with assistive technology, filed under docs/evidence/ | — |

## Days 31–60

| Id | Task | Owner | Closed by | After |
| --- | --- | --- | --- | --- |
| `sign-pilot` | Sign the pilot or design-partner agreement | founder | The signed agreement, with the data scope it approves | `charter-drafts` |
| `tenant-flags` | Configure the tenant and its flags | engineering | The tenant row and a flag list in which every flag is justified | `sign-pilot` |
| `identity` | Complete SSO, or invite-only setup | engineering | An identity acceptance run, or the invite list, recorded | `tenant-flags` |
| `content-loaded` | Load verified content and sources | champion | docs/launch/CONTENT-READINESS-REGISTER.md with every item READY, or its gap accepted in writing | `sign-pilot` |
| `uat` | Run UAT with student and staff cohorts | product | The golden-path test script run by real students, with results filed | `identity`, `content-loaded` |
| `training` | Train pilot users | customer_success | Each role has had its first-day checklist and a live session | `identity` |
| `support-ready` | Set support, status, monitoring and incident response | support | A named owner and hours for the support queue; the weekly monitoring look recorded | — |
| `restore-rehearsal` | Run a backup restore and a launch rehearsal | engineering | A restore into a disposable project, timed and filed per RESTORE.md | — |
| `comms` | Prepare communications | champion | The announcement templates filled in and approved by the school | `content-loaded` |

## Days 61–90

| Id | Task | Owner | Closed by | After |
| --- | --- | --- | --- | --- |
| `launch-cohort` | Launch the controlled cohort | founder | The go/no-go record signed, and the first invitations accepted | `uat`, `training`, `support-ready`, `restore-rehearsal`, `comms`, `a11y-core` |
| `hypercare` | Run hypercare | support | Daily issue log for the first two weeks | `launch-cohort` |
| `weekly-ops` | Hold the weekly operations review | founder | One line per week in CHANGELOG.md, including the fine weeks | `launch-cohort` |
| `track` | Track activation, actions, support, accessibility, cost and trust | product | The three figures in ANALYTICS.md, with no cell under ten | `launch-cohort`, `launch-metrics` |
| `fix-friction` | Fix the top friction | engineering | The three most-reported problems, each fixed or answered | `hypercare` |
| `midpoint-report` | Prepare the midpoint outcome report | customer_success | A report against the charter’s outcome criteria, aggregate only | `track` |
| `annual-proposal` | Create the annual proposal and expansion path | founder | A proposal that cites the midpoint report | `midpoint-report` |
| `quotes` | Capture approved quotes and case-study material | customer_success | Each quote with the speaker’s written permission | `launch-cohort` |

## Reviews and escalation

- **Weekly.** Once the cohort launches, hold the operations review (`weekly-ops`). Record a line every week, including the weeks when everything was fine.
- **Blocked tasks.** A task blocked for more than a week goes to the founder, with what it waits on. `blockers(id, status)` names the unfinished tasks in its way.
- **Stopping the launch.** Any of the pilot charter's stop conditions pauses the cohort. The school is told with the "pilot is paused" template.
