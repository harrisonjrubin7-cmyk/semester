# How long this project keeps things

The schedule exists. It was never written down in one place, which is a
different problem from not having one, and it is the problem this file is for.

Four clocks run today — the fourth was written three weeks before anything
called it — and everything else is kept until somebody deletes it. Two are in
migrations, two are in an Edge Function, one of them is scheduled from a file
applied by hand, and the promise they are all held to is a paragraph on a
screen.
Nobody deciding whether this project is safe to pilot could have assembled that,
and the first person who had to would have been assembling it under pressure.

`app/src/lib/retention.test.ts` is the tripwire. It is bidirectional, in the
shape [`SECURITY.md`](SECURITY.md) uses: every table in the schema must appear
here, and every table named here must exist. A table added later with no
retention answer is the failure this catches, and it is silent otherwise —
nothing goes red, the document still reads well, and the answer is missing on
the day somebody needs it.

## The promise this cannot break

`app/src/lib/privacy.ts` tells every student, on a screen in the app:

> **How long anything is kept.** Until you delete it. There is no retention
> schedule that quietly removes your work, and no archive kept after you delete
> your account. Nothing is used to train anything. The one thing that does age
> out is not your work but a record about it: the log of who has read your rows,
> described below, keeps ninety days and drops what is older.

That is a commitment, not a default, and it decides the shape of everything
below. **A retention schedule here may age out records _about_ a student's work.
It may not age out the work.** Adding a clock to `notes`, `tasks`, `courses`,
`state` or anything else a student typed would make that paragraph false, and
the paragraph is load-bearing — `VANDERBILT-AUDIT.md` and the competitive
review both rest the product's honest-privacy claim on it.

So "no retention schedule" is not a gap in this project. It is the decision.
What was missing is the sentence saying so, and the list of the exceptions.

## The clocks that run

| What | Kept | Where it is enforced | How it runs |
| --- | --- | --- | --- |
| `access_log` | **90 days** | `supabase/migrations/20260921143653_access_log.sql` | On write, inside `note_access()`, scoped to the account being written to |
| `activity` | **400 days** | `supabase/migrations/20260921151000_activity.sql` | On write, inside `note_activity()`, scoped to the account being written to |
| `push_queue` | **Until sent** | `supabase/functions/push/index.ts` | Deleted per account by id after a successful send |
| `push_devices` | **Until a gateway has said it is gone twice running** | `supabase/functions/push/index.ts` | A 404 or 410 *marks* the row (`gone_at`); still gone on the next run retires it, and any success clears the mark |
| Tombstones in `notes`, `tasks`, `appointments`, `sittings`, `courses` | **90 days after deletion** | `public.sweep_tombstones`, in `supabase/migrations/20260901000700_records.sql` | `pg_cron`, weekly — the `tombstones` job in `supabase/scheduler.sql` |

### This file describes the repository, and the repository is not the database

Every row above was read out of the migration or the function that enforces it.
That is the right source for *what the rule is* and the wrong one for *whether
it is running*, and on 21 September [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md)
established the difference: four migrations in `supabase/migrations/` have never
been applied to production — `usage_atomic`, `group_columns_pinned`, `forms` and
`access_log` — verified object by object rather than inferred, with the project's
schema deploy recorded as `MIGRATIONS_FAILED` since three minutes after the
`access_log` merge.

So two things in this file are claims about a schema production does not yet
have:

- **`access_log`'s ninety days is not running**, because the table and
  `note_access()` are not there. Nothing is over-retained by that — there is no
  log at all — but the row above says a clock runs, and it does not.
- **`forms` and `form_responses`** are named in the account-deletion table for
  the same reason.

Neither is a contradiction of the privacy page, which promises a *ceiling* on
what is kept rather than a floor. Both are this file describing intent as
though it were deployment, which is the error it exists to prevent.

`MIGRATION-HISTORY.md` carries the repair plan. Until those four land, read the
rows above as the rule each table will be kept under, and that document as the
list of which tables exist to keep.

The whole push queue is also deleted immediately when a student switches
reminders off — that is in the privacy text above and is a user action rather
than a clock, but it is the reason the queue never holds much.

**One row above is easy to write down wrong, and this file did.** It said a 404
or 410 retires the device. It does not, and the difference is the whole reason
`gone_at` exists. A single rejection only marks the row; a device is deleted
only if the *next* run finds it gone as well, and an endpoint that answers at
any point in a run is neither marked nor retired — proof that it is alive
outranks proof that it is not. `functions/push/index.ts` is explicit that a
single 404 deleting the device is "exactly the behaviour the column exists to
prevent", because the failure is silent: the phone just stops getting
reminders and no screen has anything to say about it. So the retention here is
two consecutive failed runs, not one rejection, and this file described the bug
that was fixed rather than the code that fixed it.

`access_log` prunes on write rather than on a schedule, and the migration says
why: a `pg_cron` entry is a third thing to deploy and a fourth thing to notice
has stopped. The cost is that a dormant account's log is not pruned until
something touches it again, which is a property worth knowing and not a defect —
the rows are per account per day per client family, never an address and never a
user agent.

## The tombstone sweep, and the decision behind it

`public.sweep_tombstones(older_than interval default '90 days')`, in
`supabase/migrations/20260901000700_records.sql`, deletes soft-deleted rows from
`notes`, `tasks`, `appointments`, `sittings` and `courses`.

**For a long time nothing called it.** It is revoked from `public`, `anon` and
`authenticated`, so it is not reachable from the API, and for weeks the only
caller anywhere in this repository was `supabase/records.check.sql` — the test
suite. So the live state was that a row a student deleted left a tombstone kept
indefinitely. That was never a contradiction of the privacy page above: a
tombstone is `{ id, deleted_at }` with the content already gone. But
"indefinitely" was a decision nobody had taken, and this project *does* have
`pg_cron` — `supabase/scheduler.sql` already runs the push job on it.

**It is scheduled now**, as the `tombstones` job in `scheduler.sql`: weekly, at
04:17 UTC on Sunday, at the function's own ninety-day default. The migration's
header asked for exactly this and said what it wanted first —

> Not scheduled here. Run it by hand, or attach it to `pg_cron` if you have it —
> an automatic job that deletes rows is not something this file should switch on
> without you having read this paragraph.

— and the paragraph it points at is the reasoning this rests on: *"Ninety days
is far longer than any device is plausibly offline and short enough that the
tables do not accumulate a term of deletions."*

**What it costs, stated rather than buried.** A tombstone is what stops a
deletion being resurrected by a device that was offline when it happened.
Deleting one after ninety days means a device offline for longer than that,
still holding the row, syncs it back as though it were new. Ninety days is
where `records.sql` drew that line, and this schedule adopts it rather than
re-arguing it.

Two smaller properties worth knowing. The job is **active**, unlike `push`,
which is parked until its Edge Function has a secret — this one calls a
function that is already there and waits for nothing. And it is **weekly rather
than nightly**, because the work is proportional to deletions rather than to
the size of the tables, so running it seven times as often would delete the
same rows seven days sooner and buy nothing.

**This is not covered by `supabase/check.sh`.** That harness applies the
migrations to a throwaway Postgres that has no `pg_cron`, so no `.check.sql`
suite can see a schedule. What holds it instead is
`app/src/lib/retention.test.ts`, which pins this document and `scheduler.sql`
to the same interval and the same job name — a sweep silently unscheduled, or
rescheduled at a different retention than the one written here, goes red there.

## Everything else: until you delete it

Every remaining table is kept for the life of the account and removed when the
account is deleted. That path is `deleteEverything` in `app/src/lib/cloud.ts`,
which sends one delete per table under row-level security, and it is checked two
ways: `app/src/lib/privacy.test.ts` reads every module that writes a table and
fails if one is missing from the list, and `supabase/deletion.check.sql` proves
the policies actually permit each delete against a real Postgres.

That pairing matters more than it looks. A delete the policies refuse returns
`row_count = 0` rather than an error, so a forgotten delete policy is a row left
behind and a client that believes it succeeded.

| Table | Kept until | Notes |
| --- | --- | --- |
| `state` | account deletion | the sync payload |
| `courses` | account deletion | soft-deleted rows leave a tombstone — see above |
| `usage` | account deletion | which screens have been opened, and the day each last was |
| `notes`, `tasks`, `appointments`, `sittings` | account deletion | soft-deleted rows leave a tombstone — see above |
| `profiles`, `enrollments` | account deletion | |
| `messages`, `message_reactions` | account deletion | |
| `groups`, `group_members`, `group_tasks` | account deletion of the member | a group you started **stays** — other members rely on it. `KEPT_TABLES` in `deletion.check.sql` holds the three exceptions with the reason the privacy page prints |
| `forms`, `form_responses` | account deletion | |
| `calendar_feeds` | account deletion | the published feed token; the Export screen can retire and reissue it |
| `reports` | account deletion of the reporter | |
| `schools` | **never**, by any account's deletion | reference data, not anybody's record: the list of universities the server recognises, written only by an admin and readable by everyone. No account creates a row here, so no account's departure can take one. `profiles.school_id` points at it and is cleared to null when a school is removed, which is a school closing rather than a student leaving |
| `blocks` | **not** lifted by deletion | keyed on `blocked`, not `user_id`, so deleting your account cannot undo somebody else's protection. This is deliberate and `deletion.check.sql` pins it |
| `push_devices`, `push_queue` | see the clocks above | |
| `access_log` | 90 days, see above | readable by the account it is about, which is the difference between an audit log and an operator's private diary |
| `activity` | 400 days, see above | one row per account, day and mark, for the three figures the pilot is judged on. Readable by the account it is about, for the same reason the access log is. `ANALYTICS.md` is what it is for; `lib/privacy.ts` names it on the screen |
| `referral_codes` | account deletion | one generated code per ambassador. Deleting it takes every `referrals` row pointing at it, by the foreign key — an ambassador who leaves is not remembered by a count of who they recruited |
| `referrals` | account deletion, of either side | the row saying which code an account arrived on. It goes when that account is deleted, **and** when the ambassador whose code it names is. Never readable by the ambassador: it is a count on their screen and nothing else |
| `lti_platform` | **kept until an administrator removes it** | not personal data at all: one row per Brightspace deployment of this tool, holding an issuer, a client id and two public URLs. It is configuration a school installed, and it outlives every student who launches through it — deleting it on any account's deletion would uninstall the integration for everybody |
| `lti_nonce` | minutes, swept an hour past expiry | the one-time state and nonce of a launch in flight, and deliberately nothing about the person: no subject, no name, no course. It exists for the few seconds between redirecting a student to Brightspace and Brightspace posting back, is single-use, and `sweep_lti_nonce()` deletes what is an hour past expiry. There is nothing here for an account deletion to reach, which is the point of it carrying no identity |
| `family_grants` | account deletion of the student | what a student let one named person see, per category and per named thing, with an expiry of its own. It is the student's statement, so it is keyed on the student's column and goes when they do. **A recipient deleting their account does not take it** — `OWNED_TABLES` sends one filter per table and that filter is the student's — so a parent who leaves is still named by a grant until the student revokes it or it lapses. `supabase/family.check.sql` proves either party *may* delete one; the button does not yet send both |
| `app_admins` | account deletion, by cascade only | who may open the internal administrator dashboard. Not written or readable through the API by anyone, including the administrator it names, so no client deletes from it — the row goes when the `auth.users` row does. Deleting everything does not remove the sign-in itself, so an administrator who empties their account is still an administrator |
| `lti_identity` | account deletion | which Semester account a Brightspace launch opens. It cascades on the account it points at, so deleting your account unbinds the launch too — and a later launch from the same school provisions a fresh account rather than reopening a deleted one, which is the correct reading of having asked to be forgotten |
| `lti_link_ticket` | minutes, swept an hour past expiry | the single-use proof that a launch was validated, held only long enough for a student to say they already have an account. It names no person: an issuer, an opaque subject the platform chose, and the account the launch just made. Cascades with that account, and sweep_lti_link_ticket() removes what is an hour past expiry |
| `organizations` | **never**, by any account's deletion | a student organization outlives everybody in it, which is what distinguishes it from a study group. `organizations.created_by` is `on delete set null`, so a founder who deletes their account leaves the organization standing with no founder recorded — the opposite of `groups.created_by`, and for the opposite reason: a group is its four people, an organization is not its founder |
| `organization_members` | **no answer yet** — see below | |
| `invites`, `access_gate` | **no answer yet** — see below | |

## What has no answer, stated rather than rounded off

Three. Two are not urgent and should be answered before a pilot grows past
people the owner knows by name. The third is urgent in the narrow sense that it
has to be answered before anything in the app writes to `organization_members`,
and it is listed first for that reason.

- **What deleting everything does to a membership is undecided, and the
  reason is a real problem rather than an oversight.** Every other row about a
  person goes, and a membership row should: it names an account on a roster,
  and `profiles` goes in the same pass, so leaving it behind means a roster
  entry nobody can identify or ask. But `20260921230000_organizations.sql`
  refuses to let the only administrator of an organization leave, because an
  organization with members and no administrator cannot be edited, cannot admit
  anybody and cannot appoint a replacement — it is locked, permanently, with no
  route back. Deleting an account cannot be refused for that reason, and it
  cannot be allowed to lock a club either, so one of three things has to be
  decided: the organization is deleted with its last administrator, or
  administration passes to somebody by a rule written down in advance, or the
  deletion leaves the row and says so. Until one of them is chosen,
  `organization_members` is in neither `OWNED_TABLES` nor `KEPT_TABLES` in
  `app/src/lib/cloud.ts` — which is safe only because nothing in the app writes
  the table yet. `privacy.test.ts` turns red the moment that stops being true,
  which is the right moment for this paragraph to be replaced by an answer.
- **`invites` is an allow-list of email addresses with no expiry.** The table is
  `(email, invited_at, note)` and nothing removes a row. Somebody invited to a
  pilot in September is still an invited address indefinitely. It is revoked
  from `anon` and `authenticated` and unreachable from the API, so the exposure
  is small — but an address collected for a pilot that ended is a record kept
  for no one's benefit, which is the same argument `access_log` was given a
  ninety-day life on.
- **An abandoned account is kept forever.** Nothing ages out an account nobody
  opens again. That is the correct default for coursework — a student who comes
  back in January should find their semester — but it is a default, not a
  decision, and it is the one a data-protection reviewer will ask about.

None is a bug. All three are questions this document exists to stop being
invisible.

## Changing any of this

1. Decide it, and write the reason here — this file is the record.
2. If it touches what a student sees, `app/src/lib/privacy.ts` says it in the
   app, and that text is what people are actually told. It wins over this file;
   this file explains it.
3. Run `supabase/check.sh` — the policy suites run against a real Postgres with
   every migration applied, and a retention change that breaks a delete policy
   fails there rather than in production.
4. `npm test` from `app/` runs the tripwire.
