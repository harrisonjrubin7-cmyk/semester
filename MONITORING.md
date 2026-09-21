# Noticing

Everything that has gone wrong with this project so far went wrong quietly.

Seven migrations sat unapplied for three days: no failure, no notice, and the
gap was found by somebody looking for something else. Two policy check suites
had been failing on their first block since the migration that broke them, and
because a failed block aborts the transaction, thirty-eight checks after it
were skipped and reported nothing. A deploy to production had been failing
since the 18th with nobody aware. The pattern is not carelessness — it is that
**nothing in this project was arranged to say anything**, and a person cannot
watch a thing that does not speak.

The build-out plan asks for monitoring and alerts before the pilot, on four
things. This is what each one is, where it lives, what it should read, and
what to do when it does not.

## The owner

Harrison Rubin, and there is no rota. That is the constraint the whole design
below has to fit: **an alert that arrives at three in the morning to an
audience of one who is asleep is not monitoring.** So the arrangement is one
alert that is allowed to wake somebody, a weekly ten minutes that catches
everything else, and a deliberate refusal to add a dashboard nobody opens.

## The four things, and where each one lives

| What | Where it can be seen | Can the database answer it? |
| --- | --- | --- |
| Edge Function errors | Supabase dashboard → Logs → Edge Functions | No |
| AI budget | The provider's own dashboard is the bill; `supabase/health.sql` block 1 is the early warning | Partly |
| Auth failures | Supabase dashboard → Logs → Auth | No |
| Database health | `supabase/health.sql`, blocks 2–5 | Yes |

Three of the four are in the platform's logs and not in this repository. That
is worth stating plainly rather than papering over with a query: nothing in
`supabase/` can tell you that the `claude` function is returning 500s, and a
monitoring document that implies otherwise is worse than one that admits it.

## The one alert

**AI spend.** It is the only one of the four that can cost real money while
nobody is looking, and it is the only one with a hard stop available.

- Set a spend cap on the provider account. This is Stage 0's item and it is
  the actual control — an alert tells you it happened, a cap stops it.
- Set the provider's own usage alert at half the cap. Half, because an alert
  at the cap arrives at the same moment as the outage.
- `MONTHLY_CALL_LIMIT` on the `claude` function is the per-account cap and
  defaults to 60 calls a month. That is what stops one account being the whole
  bill; the provider cap is what stops all of them being it.

The three numbers should be written down together, because the only useful
question about them is whether they are in the right order: per-account cap ×
expected accounts should be comfortably under the provider cap, or the cap
that fires first is the wrong one.

## The weekly ten minutes

Once a week, in the SQL Editor, in this order. It is short on purpose: a
checklist of thirty items is a checklist that gets skipped.

1. **`supabase/health.sql`, block 2 — is anything being written at all.**
   The newest row in each table, against what you know about the pilot. With
   five people in it, a `state` row from four days ago is a quiet week and one
   from three weeks ago is a broken sync. This is the block that would have
   caught the unapplied migrations, and it is first for that reason.
2. **Block 1 — the AI budget.** Calls and tokens this month, and how many
   accounts are at the cap. An account at the cap is a pricing conversation,
   not an incident.
3. **Blocks 4 and 5 — row-level security.** Both queries return no rows, and
   `ensure_rls_present` is 1. Anything else is an incident and
   [`SECURITY.md`](SECURITY.md) is the document, not this one.
4. **Block 3 — the funnel, and the gate.** Mostly to see `invite_only`. During
   the pilot it should be `t`; `f` means the front door is open to the
   internet, which is a thing that is easy to leave undone and impossible to
   see from inside the app.
5. **Dashboard → Logs → Edge Functions**, last seven days, errors only. You are
   looking for a shape, not a count: the same error repeating is a bug, a
   scatter of different ones is usually the internet.
6. **Dashboard → Logs → Auth**, last seven days. Same question. A rise in
   failures on one provider is usually a misconfigured redirect URL rather
   than an attack, and it looks exactly like a student saying "sign-in is
   broken" in a message you have not read yet.

Ten minutes, and the result goes in one line in `CHANGELOG.md` — including
when it was fine. A record that only exists when something was wrong cannot
tell you how long something had been wrong.

## What the database cannot tell you, and what covers it instead

**That a function is failing.** Nothing writes a row when the `claude`
function returns 500. The logs are the only witness, and they are read by a
person once a week. For a pilot of ten that is proportionate; at Stage 3 it is
not, and "CI deploy gate" and "load and rate-limit tests" are the items that
change it.

**That a student is stuck.** Every figure here is about the system. A student
who cannot get their syllabus to import shows up as an account with an
`opened` mark and no `course` mark — which `ANALYTICS.md` counts and cannot
explain. The pilot's answer to this is a person asking them, and that is in
[`PILOT.md`](PILOT.md) rather than here.

**That sync is losing data.** The newest-row check in block 2 sees a sync that
has stopped, not one that is quietly merging wrongly. The instrument for that
is `lib/merge.ts`'s tests and the `sync.check.sql` suite, and neither runs
against production.

## What was deliberately not built

**A status page.** It would need something to watch it, and the thing watching
it would be the thing that needs watching.

**Automated alerting from the database.** A `pg_cron` job that emails when a
number looks wrong is a fourth thing to deploy and a fifth thing to notice has
stopped — which is the argument `access_log` and `activity` both make for
pruning on write instead of on a schedule. For a pilot of ten people, a weekly
ten minutes by the person who wrote it is better monitoring than a robot
nobody has checked is alive.

**Uptime monitoring of the app itself.** Worth it, cheap, and honestly just
not done: any external pinger hitting the deployed page would do. It is a
Stage 3 item alongside the CI deploy gate.

## Then

If something is wrong: [`SECURITY.md`](SECURITY.md) if data has got out,
[`ROLLBACK.md`](ROLLBACK.md) if a deploy is wrong, [`RESTORE.md`](RESTORE.md)
if rows are gone. This document's whole job is to be the thing that sends you
to one of those on a Tuesday instead of a Saturday.
