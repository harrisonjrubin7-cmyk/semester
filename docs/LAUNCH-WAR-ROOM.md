# Launch war room

<!-- Rendered from app/src/lib/ops/warroom.ts by warroom.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The board for the final weeks before a cohort goes live, with daily
ownership. Thirteen items, each with the seat that reports it every day and
the document it is read from. It exists for one rule: **no launch happens
through informal messaging and memory.**

## Today, as the repository can read it

| Line | Reads |
| --- | --- |
| Launch status | **NO-GO** as of 2026-09-27, for 31 reasons listed in [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) |
| P0/P1 blockers | none recorded (0 open blockers of any severity) |
| Readiness register | 142 rows: 2 not-started, 28 designed, 68 building, 43 tested, 1 evidenced |
| Role launch register | 69 roles; every rung is in [`docs/ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) |
| Billing/contract status | no customer commitments recorded |
| Go-live approvals | 0 of 12 seats signed; 7 of 12 seats held |
| Board ownership | 9 of 13 items owned |

The rest of the board is read by a person each morning from the document
in the table below. A line on the board names its document; a line with no
document is a rumour.

## The board

| # | Item | Owner | Held by | Read from | The daily line |
| --- | --- | --- | --- | --- | --- |
| 1 | Launch status | `founder` | Founder | [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md) | The council verdict, and which gate moved since yesterday |
| 2 | P0/P1 blockers | `engineering` | Founder, acting | [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) | Each open P0 and P1 with its owner and age; none closed without the test that proves it |
| 3 | Readiness register | `founder` | Founder | [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](MASTER-LAUNCH-READINESS-REGISTER.md) | Rows that moved, and the count per gate |
| 4 | Role launch register | `security` | *vacant* | [`docs/ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) | The roles the cohort needs switched on, and the rung each has reached |
| 5 | Security/accessibility findings | `security` | *vacant* | [`docs/SECURITY-ACCESSIBILITY-READINESS.md`](SECURITY-ACCESSIBILITY-READINESS.md) | Open findings by severity; the accessibility seat reads its half from the WCAG scorecard |
| 6 | Integration test status | `data` | *vacant* | [`docs/UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md) | Each connector the cohort depends on: tested, syncing, or not |
| 7 | Billing/contract status | `founder` | Founder | [`ops/customer-commitments/README.md`](../ops/customer-commitments/README.md) | The agreement’s state, and every commitment it carries with its due date |
| 8 | Support staffing | `success` | Founder, acting | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) | Who is on the queue, the hours covered, and yesterday’s volume |
| 9 | Customer communications | `champion` | *vacant* | [`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) | What the school has been told, what goes out next, and who approved it |
| 10 | Go-live approvals | `founder` | Founder | [`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md) | Seats signed for this decision, and seats still to sign |
| 11 | Rollback readiness | `engineering` | Founder, acting | [`ROLLBACK.md`](../ROLLBACK.md) | The last rehearsed rollback, its duration, and whether today’s deploy changed the plan |
| 12 | Incident contacts | `engineering` | Founder, acting | [`docs/vanderbilt/incident-routing.md`](vanderbilt/incident-routing.md) | That the routing was tested today, and reached a person |
| 13 | Academic critical-period plan | `product` | Founder, acting | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) | Days to the next registration or finals window, and what is frozen until it passes |

## The rules

- Every line on the board names the document it was read from. A line with no document is a rumour.
- A decision exists only once it is in the go/no-go record that `decide()` reads. A message, a call or a memory is not a decision.
- A seat that is vacant is an item nobody reports. The board shows it as unowned rather than letting the founder report everything.
- The board is read from the tree each morning: verdict, blockers, register counts and seats come from the code, not from yesterday’s recollection.
- The war room closes when the cohort has launched and hypercare has ended (docs/90-DAY-LAUNCH-PROGRAM.md, `hypercare`), and the daily lines become the weekly operations review.

## Opening it

1. The founder seat names the target cohort and the launch window in the
   go/no-go record ([`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md)).
2. Each seat above is held, in writing, or its items are marked unowned on
   the board until it is. The founder does not report thirteen lines.
3. Every morning, each owner posts one line per item in the war-room
   channel, naming the document it was read from. The lines are the record;
   the channel is not.
4. A blocker found on the board goes into `CURRENT.blockers` in
   `app/src/lib/launchreadiness.ts` the same day, with its severity, so
   `decide()` sees what the room sees.
5. The room closes when hypercare ends, and the daily lines become the
   weekly operations review of [`docs/90-DAY-LAUNCH-PROGRAM.md`](90-DAY-LAUNCH-PROGRAM.md).

## How this page is held

[`app/src/lib/ops/warroom.test.ts`](../app/src/lib/ops/warroom.test.ts) fails when an item reads from a
document that does not exist, when an owner is not a council seat, when an
item is counted as owned while its seat is vacant, or when this page is
stale. The "today" table is computed from the same data the council and the
registers use.
