# Staging, and what a preview branch is actually telling you

The build-out plan asks for "staging preview branches that match production,
including Edge Functions". **Branching is already on**, has been since before
18 September, and builds a preview branch for every pull request touching
`supabase/` — including the Edge Functions, which reach `FUNCTIONS_DEPLOYED`.
[`ROLLBACK.md`](ROLLBACK.md) is the history of how that setting was found to be
misconfigured, corrected, and then watched.

So this item is not "turn it on". It is the harder half: **a preview branch
exists, and nobody has established that it matches production.** Those are
different claims, and the second is the one the plan is asking for.

## What a preview branch is built from, which is the crux

Not simply `supabase/migrations/`. The one time it was watched closely — a
branch created on 18 September, recorded in `ROLLBACK.md` — it **replayed
production's ledger**, and the first eight entries of that ledger carry no SQL
at all. It ran them as no-ops, created two tables, and reached
`MIGRATIONS_FAILED` at row eleven when a migration tried to alter a function
that had never been created. Two tables and no functions, from a history
claiming ten applied migrations.

The bot says the same thing in one line on every pull request it comments on:

> Tasks are run on every commit but **only new migration files are pushed**.
> Close and reopen this PR if you want to apply changes from existing seed or
> migration files.

Two consequences, and both are ways staging quietly stops being staging:

1. **A branch inherits production's history, including the parts of it that
   cannot replay.** That is the fault `MIGRATION-HISTORY.md` is about, and it
   is why a preview branch was never a trustworthy staging environment: it was
   not a rebuild, it was a replay of a record that is known to be incomplete.
2. **Editing an existing migration file changes nothing on the branch.** Only
   new files are pushed. A branch built before an edit is a branch testing the
   old text, silently, and closing and reopening the pull request is the only
   thing that rebuilds it.

## What is known to work, without a branch

`supabase/check.sh` builds every migration from empty in a throwaway Postgres
and runs fourteen policy suites against it. That is a genuine rebuild rather
than a replay, and it is what establishes that `supabase/migrations/` produces
production's schema — six fingerprints, five matching production exactly and
the sixth differing only in comments. `supabase/rehearse.sh` goes further and
applies the pending migrations to production's *shape*, with rows in it.

Neither can exercise the Edge Functions, the auth providers, the real keys or
the app against a real API URL. That is what a preview branch is for, and it
is the only reason to have one.

## What to check before calling staging proven

1. **Did the branch build at all?** The branch record in the dashboard, not
   the pull request comment. `MIGRATIONS_FAILED` on a branch record is how
   production's own schema deploy stayed broken for three days with no issue,
   no red tick and nothing in this repository able to tell.
2. **Does it match production?** Run [`supabase/fingerprint.sql`](supabase/fingerprint.sql)
   against both and compare the six numbers. **This is the step that makes it
   staging rather than a second database**, and it is the step that has never
   been done.
3. **Is row-level security actually on?** [`supabase/health.sql`](supabase/health.sql)
   blocks 4 and 5. A branch is built by applying migrations to a fresh
   database, which is exactly where the `ensure_rls` event trigger matters.
4. **Do the functions have their secrets?** Function secrets do not branch.
   `ANTHROPIC_API_KEY` and the cron secret have to be set on the branch, and
   the honest advice is a *different* Anthropic key with its own low spend cap
   — a staging environment spending production's AI budget is a way to find
   out about a mistake from a bill.
5. **Is it the same Postgres major?** `supabase/config.toml` carries
   `major_version` and its own header says why: a branch built on a different
   major would teach you something untrue about production on its first run.
   `supabase/check.sh` reads the same number rather than repeating it.

## Where this stands

Steps 1 and 5 are arranged. **Steps 2, 3 and 4 have never been run against a
preview branch, so "staging proven" in Stage 1's exit gate is not ticked**, and
nothing in this repository should be read as claiming otherwise. The work is
twenty minutes in a dashboard and a SQL editor, and it is twenty minutes
nobody has spent.
