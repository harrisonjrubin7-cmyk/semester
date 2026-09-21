# Rolling back

What to do when a deploy has made the live app worse, who does it, and how long
it takes. Written because the pre-pilot checklist asks for a *defined* rollback
owner and commitment, and a rollback plan nobody has named an owner for is a
plan to improvise during the one hour improvising is worst.

Every number here is measured, and
[`app/src/lib/rollback.test.ts`](app/src/lib/rollback.test.ts) fails if the
things this document depends on stop being true.

## The owner

**[@harrisonjrubin7-cmyk](https://github.com/harrisonjrubin7-cmyk)**, who owns
the repository and is the only person who can run the workflows.

That is a single point of failure and saying so is the point of writing it
down: during a pilot there is nobody else to page. The commitment below is
therefore a commitment about the *mechanism* — how long it takes once somebody
starts — and not a promise that somebody is awake.

## The commitment

**The live page can be back to any previous commit in under five minutes of
pressing the button**, without an empty commit, a revert, or a code change.

Measured over the last four deploys: **76s, 80s, 114s and 180s**. The spread is
the audio — about 200 MB of lessons and podcast editions, which the workflow's
own comment already names as the slow part — plus queueing, because deploys run
one at a time.

## What can and cannot be rolled back

Three surfaces, and they are not the same. **This is the part worth reading
before writing a migration**, not during an incident.

| Surface | Rolled back by | How long | Reversible? |
| --- | --- | --- | --- |
| The page | `pages.yml` on an earlier ref | 1–3 min | **Yes** |
| Edge Functions | `functions.yml` on an earlier ref | 1–2 min | **Yes** |
| The database schema | nothing, in either direction | — | **No** |

No workflow in this repository applies a migration, and `rollback.test.ts` still
holds that line. **As of 18 September that is no longer the same sentence as
"nothing does."** Supabase Branching was pointed at the right directory that
day, and its deploy workflow's fifth step is *Migrate* — so a merge now applies
pending migrations to production on its own, while nothing here reverses one.
The second path below is no longer hypothetical, and this row got worse rather
than better: schema changes arrive automatically and leave by hand or not at
all. **Rolling the app back does not roll the schema back.** One rule follows
from that and it is the only rule in this document that has to be obeyed
*before* an incident:

> **Every migration must leave the database readable by the app version that
> was live before it.** Add columns and tables; do not drop or rename one in
> the same deploy that stops using it. Drop it a deploy later, once the version
> that needed it can no longer be rolled back to.

A migration that breaks that rule turns a five-minute rollback into an outage
with no way out, because the old page will be served against a schema it cannot
read. `rollback.test.ts` cannot check this one — it is a property of a change,
not of a file — so it is stated here and in the migration directory's own
README rather than pretended at.

### The second path, which the tripwire cannot see

`rollback.test.ts` asserts that no **workflow in this repository** applies a
migration, and that is exactly as far as it reaches. The second way migrations
get applied is not a file: **Supabase Branching**, configured in the Supabase
dashboard rather than here. `supabase/config.toml` exists precisely so that
integration can find the project, and its own header says so.

As of this writing that integration is **not** doing anything, and not because
somebody turned it off. It says so on every pull request, including ones that
add migrations to `supabase/` — which is how it was noticed at all. What it
has said, twice, with the setting changed in between:

> `https:/harrisonjrubin7-cmyk.github.io/semester/supabase`

> no changes detected in `supabase/supabase`

**Both end in `/supabase`, and that is the whole diagnosis.** The integration
appends `supabase` to whatever base path it is given, so the field wants the
directory *containing* `supabase/` — which in this repository is the root. The
first reading of this, that a URL had been pasted where a path belongs, got the
symptom right and the mechanism wrong, and the correction that followed from it
(entering `supabase`) is what produced the second message.

So the value is the repository root: empty, or `.` if the field insists on
something. Neither string above is it.

This paragraph used to end by saying that fixing it would change this document.
It did, and this is the change: the table above is why. Supabase's own
documentation describes the deploy workflow that runs "when you merge any branch
into your main project", with **Migrate — applies pending database migrations**
as its fifth step. The tripwire is still true and is no longer sufficient, and
no test in this repository can see the thing that replaced it.

- **The setting is worth fixing**, because a branching integration that
  silently matches nothing is indistinguishable from one that is working until
  the day you need it. The test of whether it *is* fixed is the bot's next
  comment on a pull request touching `supabase/`: a preview branch rather than
  a sentence saying it was ignored. This repository cannot check a dashboard,
  so nothing here will tell you.
- **Fixing it changes this document.** If Branching begins applying migrations
  on merge, the table above is wrong and the rule in the block quote becomes
  load-bearing in a way nothing here will warn you about. Check it by hand when
  that setting changes; no test in this repository can.

### Settled on 21 September: it is on, and its deploys to production fail

Pull request #545 touched `supabase/` and the integration built it a preview
branch — `lztuwtiymlvueulmhduj`, reaching `FUNCTIONS_DEPLOYED`. So the setting
is right and the section below, written while it was wrong, is history rather
than the current state.

**And the same listing carries the answer to the question the next section
could not settle.** The `main` branch entry reads `MIGRATIONS_FAILED`, stamped
`2026-09-18T17:37` — three minutes after the merge that carried
`20260901001300_access_log.sql`. The deploy to production ran, and it failed.

That corrects this document's own earlier sentence, which said a migration
reached main and did not reach the database and *nothing failed*. Something
failed. It failed where nobody was looking: on a branch record in the Supabase
dashboard, with no issue, no red tick and no comment. **Production's schema
deploy has been broken since 18 September and the repository could not tell.**

Why it fails is in `MIGRATION-HISTORY.md` and is structural rather than a bad
statement: the four migration files production has never had are numbered
between `20260901000900` and `20260901001300`, and production has thirteen
migrations
applied with *later* numbers. Migrations run in timestamp order, so these are
in the past, and Supabase's own documentation names the cause — "Using the
Dashboard's SQL editor or Table Editor on your remote database bypasses the
migration history, and `db push` will start failing with sync errors."

One consequence is worth stating plainly, because it cuts the other way from
what this document has said since: **a merge cannot currently apply anything to
production**, because the step that would apply it is the step that is failing.
The instruction below still stands, for the opposite reason to the original
one — not that a merge will push four untested migrations, but that the deploy
is broken and every merge quietly adds to what it will have to survive when it
is fixed.

### Where that stood on the evening of 18 September

The setting was changed that afternoon, and the section above is the result:
the first correction produced `supabase/supabase` and the diagnosis that
followed it is the one to trust. Two later observations, neither of which
settles it:

- The bot's comment on a pull request at 17:43 read **"no changes detected in
  `supabase` directory"** — a third string, and on the append model above the
  one a correctly-set root would produce.
- **A migration merged and did not arrive.** `20260901001300_access_log.sql`
  landed on main at 17:34. Twenty-five minutes later production's history still
  held eighteen rows, its newest still `20260911151826`, and `public.access_log`
  did not exist.

So the honest reading is that it was **not** applying migrations on merge, and
that whether it is now is a question this repository cannot answer — the test is
still the one above, the bot's next comment on a pull request that touches
`supabase/`.

The second observation matters on its own, whatever the setting turns out to
be. A migration reached main and did not reach the database, nothing failed,
and nothing said so. **That is the drift growing while being watched**, and it
is the subject of the section below rather than of this one.

## The schema cannot be rebuilt from its own history

Measured 18 September, and the most serious thing in this document. It is
independent of the setting above: it was true before Branching was touched and
would be true if Branching were removed tomorrow.

Production's `supabase_migrations.schema_migrations` has eighteen rows. **Eight
of them carry no SQL at all** — the version and the name were recorded without
the statements, so there is nothing to replay:

| Rows | Which | Statements |
| --- | --- | --- |
| 8 | `schema`, `classmates`, `classmates_schools`, `rooms`, `groups`, `push`, `records`, `calendar` | **0 — name only** |
| 10 | `push_devices_and_queue` … `groups` (20260911151826) | 1 each |

Those eight are the entire core schema. `courses`, `state`, `usage` and the
classmate tables exist as live objects in one database and in no record that
could recreate them.

This was not deduced, it was watched. A preview branch created that afternoon
replayed the history and reached `MIGRATIONS_FAILED` at row eleven: the first
eight ran as no-ops, `push_devices_and_queue` created the only two tables the
branch ended up with, and `harden_security_definer_helpers` then failed on
`alter function public.verified_student() set schema private` because
`verified_student` had never been created — its migration was one of the
name-only eight. Two tables and no functions, from a history claiming ten
applied migrations. The branch was deleted immediately; it billed for minutes.

Three consequences, in the order they matter. **The first two were closed on
21 September** by steps 2 to 4 of [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md),
and are kept here because the third is not, and because the argument only makes
sense whole.

- ~~**There is no disaster recovery.**~~ If the project were lost, the recorded
  migrations would produce two push tables and an error. **Closed.** The ten
  migrations that existed only in production were recovered into files, each
  hashing to the row it came from, and the repaired file set now rebuilds
  production's schema: the md5 of every column, every constraint and every
  policy matches `schema.snapshot.sql` and a live read of production, with two
  controls that differ.
- ~~**Nothing can reproduce production to test against.**~~ **Closed, on a
  throwaway cluster rather than a preview branch.** `supabase/check.sh` now
  applies all twenty-five files and passes twelve suites against them. A
  preview branch still cannot reach production's state, for the second reason
  further up — it has no Edge Functions — and that is unchanged.
- **The repository and production describe different databases.** Ten of those
  migrations exist only in production and as no file here; **four** files here —
  `usage_atomic`, `group_columns_pinned`, `forms` and `access_log` — have never
  reached production, verified object by object rather than inferred from the
  history. `invites` and `referrals` were on that list until 21 September, when
  they were applied by hand; the ledger recorded them under today's timestamps
  rather than their filenames, which is a third fault and not a fix.
  `supabase/check.sh` builds its schema from the files, so a green check is a
  fact about a database nobody is running: the same shape as the Postgres-major
  mismatch fixed in #502, one level up.

**Until this is repaired, do not merge a pull request that touches
`supabase/` by adding or changing a migration.** (A change that only narrows
the gap — the ten recovered files, whose versions production's ledger already
carries — is not one of these; `MIGRATION-HISTORY.md`'s status table says why.) If Branching is applying migrations, a merge sends those four to
a schema no test has ever reproduced — and the one that has already been
applied by hand, `invites`, is the shape of the risk: it puts a `before insert`
trigger on `auth.users`, the table every sign-up passes through, and it went in
with `set_invite_only` executable by anybody holding the browser's publishable
key. If Branching is not applying migrations, the merge widens the gap by one
more file, silently, which is what `access_log` has just demonstrated. Neither
is a good reason to merge one.

[`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md) holds the repair.

## Rolling the page back

1. **Find the commit to go back to.** The deploy history is the Pages workflow's
   run list, and every run names the merge commit it built:
   `https://github.com/harrisonjrubin7-cmyk/semester/actions/workflows/pages.yml`

2. **Run the workflow on that ref.** Actions → *Deploy to Pages* → *Run
   workflow* → choose the branch or tag. `workflow_dispatch` exists on that
   workflow for exactly this; without it the only way to redeploy would be an
   empty commit, which is slower and lies about the history.

   A commit that is not the tip of a branch needs a tag first:

   ```bash
   git tag rollback-$(date +%Y%m%d-%H%M) <commit>
   git push origin rollback-$(date +%Y%m%d-%H%M)
   ```

   The workflow file has to exist on that ref, which it does for anything
   recent. For an older one, tag a branch that has both.

3. **Wait.** Deploys do not cancel each other — `cancel-in-progress: false` —
   because an interrupted deploy can leave the site serving a partial build.
   A rollback queued behind a bad deploy waits for it and then replaces it.

4. **Check the page itself**, not the green tick:
   `https://harrisonjrubin7-cmyk.github.io/semester/` — and hard-reload, because
   the service worker will otherwise hand you what you already had.

## Rolling a function back

Same shape: Actions → *Deploy Edge Functions* → *Run workflow*, on the earlier
ref, naming the functions to redeploy. Functions and the page are deployed
separately and roll back separately; a rollback of one is not a rollback of the
other, and an incident that touched both needs both.

## Then

Say what happened in [`CHANGELOG.md`](CHANGELOG.md), including that a rollback
happened and what a tester will see change back. A pilot tester who watches a
feature disappear without a word learns to distrust the whole thing, and that
is harder to recover than the deploy was.
