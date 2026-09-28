# Product analytics and data ethics

Launch-readiness Phase 5. What Semester measures about the people who use it,
what it has promised never to measure, and the test that holds each promise.
[`ANALYTICS.md`](../ANALYTICS.md) is the operating document for the three
figures; this page is the index a reviewer, a university or a student reads to
find out whether the promises are enforced or only written.

## What is measured

| What | Grain | Where | Enforced by |
| --- | --- | --- | --- |
| Activation, weekly active use, 30-day retention | One row per account per day per mark; three marks | `public.activity` (`20260921151000_activity.sql`) | The table's `check` constraint allows only the three marks; `ANALYTICS.md` §"What is checked, and where" |
| Render and build timings | Per device, in memory, never synced | `app/src/lib/timing.ts` | `app/src/lib/timing.test.ts` fails on any line that stores or syncs a reading |
| Institutional aggregates: course demand, cohort outcomes | Ten students or more per cell | `course_demand_snapshots`, `outcome_aggregates` (`20260926150000_expansion_roles_and_features.sql`) | Check constraints in SQL; `MIN_COHORT` in `app/src/lib/institution-ops.ts`; and, new here, `app/src/lib/cohortfloor.test.ts` holding the two to the same number |
| Support tickets | Not analytics | `support_tickets` | Tickets are read by people to answer them; no function aggregates them, and the queue carries no identity to aggregate by |

Nothing else. A fourth figure needs a fourth question written into
`ANALYTICS.md` first.

## What is never measured

`FORBIDDEN` in `app/src/lib/institution-ops.ts` is the list, and `defineMetric`
refuses any metric that sources one. Each id below is checked against that file
by `phase5docs.test.ts`, so this page cannot drift from the code.

| Id | Never |
| --- | --- |
| `risk_score` | Individual student risk scores |
| `reading_time` | Covert reading-time tracking |
| `mouse` | Mouse or keystroke tracking |
| `attention` | Attention or engagement inference |
| `ai_usage` | Tracking individual AI usage |
| `integrity_flag` | Automated academic-integrity accusations |
| `wellbeing_score` | Wellbeing or behavioral scoring |
| `location` | Location or presence tracking |

## The small-cell floor, in one number

Every aggregate a university can read is suppressed below ten students. Until
this phase that was two numbers: `MIN_COHORT = 10` in TypeScript, and a literal
`10` in each SQL check and `having` clause. `institution-ops.test.ts` pinned the
TypeScript to 10 without reading the SQL, so lowering a database floor to 5
left every test green. `cohortfloor.test.ts` reads each floor out of the
migrations and fails when any differs from `MIN_COHORT`; it was checked by
lowering one and watching it go red.

## No third-party analytics

The Content-Security-Policy in `app/index.html` lists every host the app can
connect to. None is an analytics or session-replay vendor, and
`phase5docs.test.ts` fails if one is added — so adding one is a reviewed
change to a test, not a script tag. `ANALYTICS.md` §"Why it is first-party"
is the reasoning.

## What a student is told

The Privacy screen (`app/src/lib/privacy.ts`, `CLAIMS`) states who can see a
student's rows, with four named exceptions. Support tickets are the fourth, and
`privacy.test.ts` asserts the wording: read by Semester's support staff, only
what the student wrote and the app details they ticked, never their name or
email address.

## Open items

- **No time-based purge of closed support tickets**, recorded in `RETENTION.md`.
- **Pilot outcome measures** (the GTM work in #817) will need their own row in
  the first table before any is reported to a university; the cohort floor
  applies to them as to everything else.
