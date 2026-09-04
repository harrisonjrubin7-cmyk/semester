# Per-record sync — for review

Nothing on this branch touches your database or changes what the deployed app
does. The SQL is written and unrun; the client half is deliberately not wired
up yet. Read this, then decide.

## The bug

Everything except courses syncs as one JSON blob. The app merges that blob
field by field rather than replacing it — `app/src/lib/merge.ts` — and for
lists the strategy is `union`, so a note written on the laptop and a note
written on the phone both survive. That is right and should stay.

A union cannot express a deletion. There is nothing in the data that
distinguishes *"the laptop never had this note"* from *"the phone deleted
it"*, so the merge keeps it.

**Delete a note on your phone, open your laptop, and it comes back.** Delete it
again there, open the phone, and it comes back again.

`app/src/lib/resurrect.test.ts` demonstrates this against the code as it stands
today — for notes, for tasks, and for practice papers. It passes right now,
because it describes what currently happens.

Courses escape it: `removedCourses` tells the account exactly what a device
removed. It is session-scoped on purpose, on the reasoning that an unsynced
deletion coming back is visible and fixable rather than a silent loss. That
reasoning is sound, and it is also an admission — the mechanism exists because
a union cannot express a deletion, and nothing else has one.

## Where I departed from the spec, and why

The spec's Phase 2 schema creates `terms`, `items` and `scores` — coursework
split into columns. **I did not create them**, and I want that decision looked
at rather than assumed.

Course modules are stored as JSON deliberately: a module is data the app
generated from a syllabus, read and written whole. Splitting it into columns
would buy joins and cost the whole import pipeline, every study format that
reads a guide, and the sharing feature. The spec's own Phase 3 warns against
this shape of change — *"the failure mode is a refactor that makes the app work
everywhere by making it good nowhere."*

So what moves out of the blob is the data that genuinely **is** a list of
independent records somebody creates and deletes one at a time:

| Moves to its own table | Stays in `state` |
|---|---|
| Notes | Settings and the whole look |
| Tasks | The map of what is ticked, and when |
| Appointments | Card review history |
| Practice papers | Work windows, the sleep floor, the contract |

The second column is not records. They are maps and scalars, and `merge.ts`
already handles them correctly with `ticks`, `latest` and `mine`. A union was
never wrong for those.

If you want the spec's schema as written, say so — it is a larger change and
a different app, and it should be a decision rather than a default.

## What is on the branch

| File | What it is |
|---|---|
| `supabase/records.sql` | The migration. Additive, guarded, safe to run twice, with the rollback written at the bottom. |
| `supabase/records.check.sql` | Proves the migration does what its comments claim. Makes its own users, rolls back, leaves nothing. |
| `app/src/lib/records.ts` | The merge semantics: newer wins, ties go to the tombstone. No network. |
| `app/src/lib/records.test.ts` | 24 tests over those semantics. |
| `app/src/lib/resurrect.test.ts` | The bug, demonstrated against today's code. |

## The decisions worth arguing with

**A tombstone beats a live row of the same age.** Two devices syncing on the
same second is a normal Tuesday. The asymmetry is deliberate: a wrongly-kept
row is a note that reappears and can be deleted again; a wrongly-deleted row is
gone. Only one of those is recoverable.

**A newer edit un-deletes.** Writing in a note you deleted on another device
this morning brings it back, rather than being silently discarded. I think this
is right; it is the one rule most likely to surprise.

**`updated_at` is set by the database and a client cannot set it.** The check
script proves this by trying to write a timestamp a year ahead. Without it, a
phone with a fast clock wins every conflict forever and nobody finds out until
their laptop's edits have been disappearing for a month.

**Tombstones are swept after 90 days**, by a function you run — not on a
schedule this file switches on for you.

## Running it

```
1. Read supabase/records.sql.
2. Supabase dashboard → SQL Editor → New query → paste its CONTENTS → Run.
3. Same again with supabase/records.check.sql. Every line should print `ok:`.
   It rolls itself back, so it is safe against a project with real data.
```

After step 3 the tables exist and nothing uses them. The deployed app keeps
using `state` exactly as it does now. That is the point of doing it in this
order: the schema is in place and checked before any client depends on it.

## What is deliberately not done

Rewiring `cloud.ts` to push and pull per record, and moving the four lists out
of `pickPersisted`. That is the change that touches every row you already have,
and it should follow the review rather than arrive with it.

The order I would take it in:

1. This migration, applied and checked.
2. A build that **writes** both ways — blob and records — and reads the blob.
   Nothing changes for anyone; the record tables fill up.
3. A build that reads records and writes both. Deletions start working.
4. Once every device has run step 3, stop writing the blob for those four
   lists.

Steps 2 and 3 are what make this safe on a live account rather than a cutover
with a backup and crossed fingers.

## Caveat I cannot remove from here

**I have not run this SQL.** There is no Postgres in this environment, so it is
reviewed-by-reading, not reviewed-by-executing. `records.check.sql` is how it
gets executed, and it rolls back — run it on your project before trusting a
line of this.
