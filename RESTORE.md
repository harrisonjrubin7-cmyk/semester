# Getting the data back

[`ROLLBACK.md`](ROLLBACK.md) is about putting the code back. This is the other
half, and it is the one nobody has ever done: the day the *data* is wrong and
the only way out is a copy from before it happened.

The build-out plan asks for a first backup-and-restore drill, timed, before the
pilot. It asks for it before rather than after for the same reason as
everything else in that stage — **a restore procedure that has never been run
is a document, not a capability**, and the first time it is read should not be
the hour it is needed.

## The owner

Harrison Rubin. One person, which is the standing problem this project has and
which `SECURITY.md` says in the same words: a second operator trained to run a
restore is a Stage 3 item and is not done.

## What this is for, and what it is not

Three different bad days, and only one of them is a restore.

| What happened | The answer |
| --- | --- |
| A deploy is wrong — the app is broken, the schema is fine | [`ROLLBACK.md`](ROLLBACK.md). Put the page back. Do not touch the data. |
| A migration did something wrong to the schema | A **forward** fix, almost always. `ROLLBACK.md` is explicit that the schema does not roll back, and a restore to undo a migration also throws away every row written since. |
| Rows are gone or wrong, and no forward fix can invent them | This document. |

The third is the only case a backup solves, and it is worth naming the
realistic version rather than the dramatic one. It is not a hacker. It is a
`delete` in the SQL editor at one in the morning that matched more rows than it
was meant to — which is how ten migrations in this schema were applied in the
first place, and the reason [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md)
exists.

## Before the drill: what the project actually has

**Read this off the dashboard and write the answer in the table at the bottom.
Do not assume it from a plan page.** Supabase's backup arrangements differ by
tier — daily backups on some, point-in-time recovery as a paid add-on, and on
the smallest projects none at all — and the number that matters is not which
feature is listed but which one this project has switched on today.

Three questions, and each has a number for an answer:

1. **How far back can this project be restored to?** (backup retention)
2. **How much work would be lost in the worst case?** (the gap between
   backups — the recovery point)
3. **How long would a restore take, start to finish?** (the recovery time)

Until those three are written down, the honest statement about this project is
that its recovery position is unknown. That is a worse thing to say to a
university than any particular number would be.

## The drill

Run it against the live project, deliberately, at a time nobody is using it.
It is the only way to learn the answers above.

1. **Note the time.** The drill is timed from here, not from the restore.
2. **Write down the check.** Pick something you can verify afterwards and
   record its value now — the row counts from block 0 of
   [`supabase/analytics.sql`](supabase/analytics.sql) are a good one, because
   they read a whole table and hold no student's work.
3. **Take the backup, or find the most recent one.** Record which it is and
   what time it is from.
4. **Restore it — into a new project, not over the live one.** This is the
   step people skip and it is the step that makes a drill a drill: restoring
   over production to prove that restoring works is a way of turning a
   rehearsal into the incident.
5. **Compare.** Run `supabase/fingerprint.sql` against both and compare the
   six numbers. Then run block 0 of `analytics.sql` against both.
6. **Check the two things a comparison of tables cannot see**, both of which
   this schema has already been caught losing once:
   - the `ensure_rls` event trigger, which is what makes row-level security
     on by default true. `select count(*) from pg_event_trigger where evtname
     = 'ensure_rls'` — it is 1 or the restored database is quietly less safe
     than the original.
   - that row-level security is *enabled*, not merely that the policies
     exist: `select relname from pg_class c join pg_namespace n on n.oid =
     c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not
     c.relrowsecurity` — it returns nothing, or those tables are open.
7. **Note the time again**, fill in the table below, and delete the restored
   project.

Point 6 is not a formality. `schema.snapshot.sql` was first written without
that event trigger, and every count of tables, constraints and policies
matched. The control is what caught it; nothing else would have.

## The rehearsal, which is already runnable

```bash
supabase/restore.sh
```

It builds production's shape from this repository in a throwaway cluster, puts
an account with a semester in it, dumps the whole database, restores the dump
into an empty one, and compares the two six ways: schema fingerprints, row
counts, the contents of what was seeded, the event trigger, whether row-level
security is still enforced, and a control that the comparison had anything to
compare at all.

**What it proves:** the procedure, and that nothing in this schema is the kind
of object a logical dump quietly leaves behind.

**What it does not prove:** that the live project's own backups can be
restored. Those are a different mechanism — physical, point-in-time, run from
the dashboard against real infrastructure — and only the drill above says
anything about them.

It was run on 21 September 2026 and passes. On that machine, with one account
in the database:

| | |
| --- | --- |
| dump | 0.1s, 124 KB |
| restore | 0.2–0.5s across runs |
| compared | 29 tables, 6 fingerprints, 3 seeded rows plus the two controls |

Those figures are about a database with one account in it, and the sub-second
timings are noise rather than measurements — they are quoted so that a later
run against a real one has something to be compared against, and the thing
that will actually be comparable is the dump's size. **They are not a recovery
time.** The recovery time is question 3 above and is still unanswered.

It was proved rather than trusted, in the shape [`CLAUDE.md`](CLAUDE.md) asks
for: the dump was mutated to `--schema-only` and re-run. Row counts and the
seeded contents went red; the three schema checks stayed green. A drill whose
data comparison cannot fail is a drill that reports success for a backup with
no data in it.

## Point-in-time recovery — **not verified**

**Nobody has confirmed that point-in-time recovery (PITR) is enabled on the
production project, and nobody has restored from it.** Until the table at the
end of this section has a row with a date, an owner and a measured recovery
point, the honest answer to "can you restore to a moment before the bad
`delete`?" is *we do not know*. A daily backup, if the tier has one, is up to a
day of every student's work; PITR is what shrinks that to minutes, and it is a
paid add-on that has to be switched on.

What could be read from here on 28 September 2026, and what could not: the
project (`lzrqvlugnawcgywkhqlz`, us-west-2, Postgres 17) is healthy. Its plan
tier, its backup schedule and whether PITR is on are dashboard settings no
query in this repository can read. That is the gap.

### The procedure, for the owner

1. **Turn it on.** Dashboard → Project Settings → Add-ons → Point in Time
   Recovery. It needs a paid plan and, on the smaller compute sizes, a compute
   upgrade the dashboard names. Record the retention chosen (7, 14 or 28 days)
   and the monthly cost in the table below. **Also note the plan tier and
   whether daily backups are listed under Database → Backups** — that answers
   the first question at the top of this file even if PITR is not bought.
2. **Wait for the first base backup.** PITR can only restore to a moment after
   it has one; the Backups page shows the earliest restorable time. Write it
   down.
3. **Pick a target moment and a marker.** At a known time `T`, write one row you
   can recognise — a note in a test account, never a real student's — and
   record the fingerprint and row counts from step 2 of *The drill* above.
   Wait a few minutes and write a second row after `T`.
4. **Restore to `T` somewhere that is not production.** Use *Restore to a new
   project* (or a branch, where the plan offers restoring a branch to a point in
   time). **Never restore over the live project to test this** — see step 4 of
   the drill. Note the wall-clock time from clicking restore to the new project
   answering queries: that is the recovery time.
5. **Verify.** The first marker row must be there and the second must not —
   that pair *is* the recovery-point measurement, and a restore missing both
   has proved nothing. Then run steps 5 and 6 of the drill against the restored
   project: fingerprints, `ensure_rls`, row-level security enabled.
6. **Check what a database restore does not bring back**: Edge Function
   secrets, Vault secrets (`push_cron_secret` and the others — check they are
   present), the `cron.job` list (`supabase/health.sql` block 6), and Storage
   objects, which are not in the database. Write down each one that needed
   putting back by hand.
7. **Record, then delete the restored project.**

Repeat after any plan change, and at least once a term.

### PITR results

| Date | Owner | PITR enabled? retention | Earliest restorable time | Target `T` | Recovery point (marker before `T` present, after `T` absent?) | Recovery time (restore clicked → queries answered) | Secrets / cron / storage needing manual repair | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | not yet verified |

## After the drill, fill this in

Nothing below is known yet, and saying so is the point of the table. A row
with a number in it is a fact about this project; a row without one is work.

| Question | Answer | Measured on |
| --- | --- | --- |
| How far back can the project be restored? | not yet measured | — |
| Worst-case work lost (recovery point) | not yet measured | — |
| Time to restore, start to finish (recovery time) | not yet measured | — |
| Did the six fingerprints match? | not yet run | — |
| Did `ensure_rls` survive? | not yet run | — |
| Was row-level security still enforced? | not yet run | — |

## Then

Tell whoever is in the pilot if anything of theirs was lost, in the shape
`SECURITY.md` uses for telling people: what happened, what it means for them,
and what they should do. A restore that silently loses a day of somebody's
notes and is never mentioned is the same failure as not restoring at all,
with better paperwork.
