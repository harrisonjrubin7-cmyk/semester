# The three figures, and what each is worth

Stage 1 of the build-out plan cannot be closed until the pilot is "reporting".
This is what it reports, how, and — the part that decides whether any of it is
useful — what each number is not able to say.

Three figures, because the plan names three: **activation**, **weekly active
use**, **30-day retention**. Nothing else is collected. A fourth number needs a
fourth question written down here first, and the `check` constraint in
[`supabase/migrations/20260921151000_activity.sql`](supabase/migrations/20260921151000_activity.sql)
is what makes adding one a decision rather than a habit.

## The owner

Harrison Rubin. Running the queries is a person's job and stays one: there is
no dashboard, no scheduled export and no third party holding a copy.

## Where the numbers come from

One table, `public.activity`. One row per account, per day, per mark, where a
mark is one of three words:

| Mark | Means |
| --- | --- |
| `opened` | the app was open with this account signed in, that day |
| `course` | the account had at least one course of its own by then |
| `studied` | the account had answered at least one card by then |

That is the whole record. No screen names, no titles, no course, no counts, no
time of day, no device, no address. The day is UTC and is written by the
database, not by the browser — [`activity.check.sql`](supabase/activity.check.sql)
holds that structurally, and it is the only thing standing between these
figures and a claim about a browser.

The app's half is [`app/src/lib/activity.ts`](app/src/lib/activity.ts). It
derives the marks from state it already holds rather than firing an event at
each moment worth counting, and that file argues why at length. The short
version: a call site that gets forgotten in a refactor looks exactly like a
student who did not do the thing, and the figure it feeds is activation.

## Running them

[`supabase/analytics.sql`](supabase/analytics.sql), a block at a time, in the
dashboard's SQL Editor. **Run block 0 first, every time.** Every query in the
file returns nothing in two opposite situations — nobody used the app, and
nothing is writing to the table — and block 0 is what tells them apart.

Reading a zero without having run the control is the mistake this whole file
exists to prevent. The migration history in this repository is a record of
exactly that kind of silence: seven migrations sat unapplied for three days
with no failure and no notice.

## What each one is

### Weekly active use

Distinct accounts with an `opened` row, by week, Monday to Sunday.

The current week is always low because it is not over; the query returns
`is_partial` beside it rather than hiding the row, because a report whose last
line is always a week stale is a report people stop opening.

**What it cannot say:** anything about depth. An account that opened the app
for four seconds to dismiss a notification is in this number, and so is one
that studied for an hour. That is not a flaw to fix by adding a duration — it
is what the word "active" means here, and anyone quoting the figure should
quote the definition with it.

### Activation

Of the accounts first seen in a week, how many had a course of their own **and**
had answered a card, within **7 days** of arriving.

This is Stage 0's exit gate restated as a number: a stranger completes
onboarding → syllabus → study. The seven-day window is the whole of the
measurement. Without it an account from August has had six weeks to activate
and one from last Tuesday has had three days, so the figure would rise on its
own and mean nothing.

Cohorts younger than 7 days are excluded for the same reason.

**Read the two middle columns when the headline disappoints.** A cohort that
adds courses and never studies is a different product problem from one that
never gets a course in, and the single activation figure cannot tell them
apart. That is the entire reason the funnel is three marks rather than one.

### 30-day retention

Of the accounts first seen in a week, how many opened the app again between
**28 and 34 days** after their first day.

A band rather than a day: "came back on day 30 exactly" is a question about a
Tuesday. With a pilot of ten people, day-exact retention produces zeroes that
mean nothing at all.

Cohorts younger than 34 days are excluded, because their band has not
finished. Including them would report 0% for the newest weeks for ever, which
is the shape of mistake that gets a product killed on a slide.

## What none of these can say, stated rather than rounded off

**They are the client's account of itself.** The database decides *who* and
*when*; the browser decides *which of three words*. A student who blocked the
call, or who uses the app signed out, is invisible. That is accepted rather
than defended against: there is no incentive to lie about having studied, and
the alternative — routing every action through a server so the server can
witness it — would be a worse app and a worse privacy position for a number
nobody is being paid on.

**A mark's date can be a day late.** The marks are derived from state when the
app is open, so a student who imports a syllabus and closes the tab in the
same second has it dated to their next visit. The app re-sends when the
derived set changes, so the usual gap is seconds — but it is not zero. **No
figure here is accurate to the day for one account.** Every question above is
about a population over weeks, and that is the only way they should be read.

**Ten people is not a sample.** With a pilot cohort of 5–10, one person's
fortnight abroad moves retention by ten points. The figures are for noticing
something is badly wrong and for arguing with a hypothesis, not for a slide
with a percentage on it. The plan asks for a willingness-to-pay test
*alongside* these for exactly that reason — see [`PILOT.md`](PILOT.md).

**Nothing here explains anything.** Retention says how many came back. Why
they did is twenty minutes on a call with one of them, and it is the more
valuable half of the exercise.

## Why it is first-party, and what that promised

The ordinary build is a script tag from an analytics vendor. It would answer
all three questions in an afternoon and put every student's reading of every
screen on somebody else's server.

`app/src/lib/privacy.ts` says, on a screen a student reads, that there is **no
third-party analytics in this app** and that signed out nothing leaves the
device. Both sentences are still true, and both are load-bearing: `VANDERBILT-AUDIT.md`
and the competitive review rest this product's honest-privacy claim on them.

The obligations that came with keeping them:

- The page names this record in the same words it names the access log —
  a first-party record a student cannot read about is not meaningfully better
  than a third-party one.
- A student can read their own rows, and delete them.
- Deleting an account deletes them, by policy and by cascade.
- There is a clock: 400 days, in [`RETENTION.md`](RETENTION.md) with the rest
  of the schedule, pruned on write.
- Signed out, nothing is recorded at all.

`app/src/lib/activity.test.ts` goes red if the privacy page stops saying so,
which is the tripwire for the sentence rather than for the code.

## What is checked, and where

| Claim | Where it is held |
| --- | --- |
| A caller cannot write a row about another account, or another day | `supabase/activity.check.sql`, structurally against the function's signature |
| The table takes no insert and no update through the API | same, from both directions — your own row and somebody else's |
| An account reads and deletes only its own | same |
| The arithmetic of all three figures | same — a seeded population of four whose answer is known in advance |
| The windows in this document and in the queries are the same numbers | `app/src/lib/activity.test.ts` |
| The app sends only words the database accepts | same, read out of the migration as text |
| The privacy page still names what is sent | same |
| The clock here and the clock in the migration agree | `app/src/lib/retention.test.ts` |

Fourteen mutations were run against the migration to find out which line each
check actually holds. Eleven are caught; the three that are not are written up
in the suite's header with the measurement that showed why, rather than left
for a reader to assume.
