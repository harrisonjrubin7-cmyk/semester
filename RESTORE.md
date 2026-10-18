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

## The drill against the real project, scripted

```bash
SOURCE_DB_URL='…lzrqvlugnawcgywkhqlz…'  TARGET_DB_URL='…kpuulmnicidgdmwgfngv…' \
DRILL_WIPE_TARGET=kpuulmnicidgdmwgfngv  DRILL_CLEANUP=1  supabase/restore-drill.sh
```

[`supabase/restore-drill.sh`](supabase/restore-drill.sh) runs steps 1, 2 and
4–7 above with a logical dump: it reads the live project (read-only), restores
`public`, `private`, the accounts and the event triggers into the second
project, Semester2, and prints the four rows of the table below that it can
answer. The header lists what it copies and what it deliberately leaves out —
`cron` above all, so the copy never runs production's jobs. It refuses to
target the live project, and refuses to overwrite a target that already has
tables unless `DRILL_WIPE_TARGET` names it.

It does not replace step 3. How far back Supabase's own backups reach, and the
recovery point, are properties of the platform's physical backups: read them
off Database → Backups and write them in.

Proved against two local databases on 28 September before it was ever pointed
at the real ones: every check green; with the dump sabotaged to
`--schema-only`, row counts and the control went red and the schema checks
stayed green, as they should. Its first run found that `restore.sh` itself
had been red since 27 September — see
`migrations/20260929040000_round_trip_stable_checks.sql`.

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

Read again on 29 September 2026 through the project's database connector,
read-only: the migration ledger ends at `20260929110000_console_approvals_and_break_glass`,
so every migration on main is applied; the direct rate-limit trigger is on
fourteen tables (the go-live checklist's line now says so); and `cron.job`
lists eighteen jobs, fifteen active, with `push`, `media-scan` and
`escalation-delivery` inactive, as `supabase/DEPLOY.md` expects until each
is keyed. The organization record, read the same afternoon through the same
connector, says the plan is **Pro** (pay-as-you-go), which on Supabase's own
backups page means daily backups with the last seven days accessible and
point-in-time recovery only as a paid add-on; and `pg_settings` shows WAL
archiving on (`archive_mode` on, WAL-G `wal-push`, `archive_timeout` 120 s),
which is the mechanism the physical daily backup and PITR both use, so it
says nothing about whether the add-on is bought. The backup schedule as the
Backups page shows it, whether PITR is on and its retention were still not
readable that way: a database connection cannot see the dashboard. They stay
the owner's reading, for the table below.

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

## Re-apply the deletions made after the backup point

This step is for a restore that is real, not the drill: the day production
is put back from a backup. It exists because of what `RETENTION.md` promises
under *Backups* — that a deleted row outlives its deletion by at most the
backup retention — and a restore is the one way to break that promise: a
backup taken before a deletion holds the rows, and restoring it brings them
back, live, as though nothing had been deleted. A restore is therefore not
finished when the fingerprints match and row-level security is on. It is
finished when the deletions and sweeps that ran between the backup time and
the restore have been run again.

1. **Fix the window, and keep the restored project closed.** The backup's
   own time is the start. The end is the cutover — the moment the app and
   the gateway are pointed at the restored project — and it has not happened
   yet. The drill's own rule applies here: the restore goes into a new
   project, never over the live one, so until the cutover nothing serves the
   restored rows. If the live project is the one that lost the data, put it
   in read-only mode meanwhile (*Read-only mode* in
   [`docs/FEATURE-FLAG-REGISTRY.md`](docs/FEATURE-FLAG-REGISTRY.md):
   `VITE_READ_ONLY=true` on the deploy, `SEMESTER_READ_ONLY=on` on the
   gateway) so the window stops growing. **Do not cut over until steps 2 to
   4 are done.** A restored row is a privacy incident the moment it is
   reachable, and a weekly sweep is not a schedule anybody may wait for with
   the doors open.
2. **Run the sweeps by hand, now.** Do not wait for `pg_cron`. Against the
   restored project, run each retention job's command from
   [`supabase/scheduler.sql`](supabase/scheduler.sql) — the `$$…$$` body
   beside its name: `tombstones`, `invite-retention`, `abandoned-signups`,
   `audit-retention`, `lti-nonce`, `lti-link-ticket`, `capture-expiry`,
   `institution-gateway-retention`, `community-retention`,
   `integration-retention`. That re-applies every clock `RETENTION.md`
   lists. Then check `cron.job` is populated (a restore does not always
   bring it back; block 6 of `supabase/health.sql`) so they keep running
   after the cutover.
3. **Replay the deletions that can be identified from outside the
   database.** Every row written after the backup point went with the restore
   — the audit events, the console's archive and its manifests included, since
   they live in the same database — so nothing inside the restored project can
   list the window's deletions. What can is whatever was kept outside it: the
   operator's own notes, the support mailbox, GitHub for provisioning changes
   made through the repository, and a manifest only if one had been exported
   off the project before the restore. Re-apply each deletion those name.
4. **Say what cannot be replayed, to everyone.** A student's own deletion
   of a note, a task or an account leaves a record with the date and the row
   counts and deliberately no account id — that is the privacy design, and
   it is the reason this step cannot find them. Those rows are back and
   nothing in the tree can name whose they are, so the notice cannot be
   individual: tell every account that existed in the window, in the notice
   the incident process prescribes, that a deletion made in it may need to
   be made again. Do not promise more than that anywhere, because nothing
   here can keep more than that.
5. **Cut over.** Only now point the app and the gateway at the restored
   project, and lift read-only mode.
6. **Write it down.** The window, which sweeps ran, which deletions were
   re-applied from what record, and that the broad notice went out, filed
   with the restore record below.

A durable deletion record that survives a restore — it would have to live
outside the database being restored — would let step 4 name the accounts
instead of writing to all of them. It was considered and not built (D-124,
29 September 2026): it keeps a trace of who deleted what, which the privacy
design does not, so the broad notice is the standing rule and `RETENTION.md`
and the privacy-policy draft carry the exception in the same words.

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
