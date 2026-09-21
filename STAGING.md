# Staging, and what a preview branch is actually telling you

The build-out plan asks for "staging preview branches that match production,
including Edge Functions". **Branching is already on**, has been since before
18 September, and builds a preview branch for every pull request touching
`supabase/`. [`ROLLBACK.md`](ROLLBACK.md) is the history of how that setting was
found to be misconfigured, corrected, and then watched.

So this item is not "turn it on". It is two harder halves: **a preview branch
exists and nobody has established that it matches production**, and **the
three words at the end of the plan's sentence are not true today**.

## The Edge Functions, which a preview branch does not have

This was read off a branch rather than reasoned about. The preview branch for
the pull request that added this file finished its Edge Functions task with a
warning, and the warning is the whole finding:

> **⚠️ Warning — Only Functions declared in config.toml will be automatically
> deployed to branches: `[functions.my-slug]`**

[`supabase/config.toml`](supabase/config.toml) declares none, and says so in
its own header, deliberately:

> In particular there is no `[functions]` block. Edge Functions are deployed by
> `.github/workflows/functions.yml` … Declaring them here as well would give
> one function two deploy paths that can disagree about which version is live.

That reasoning is about **production**, where it is sound. Its consequence is
about **staging**, and the file does not mention it: a preview branch has no
`claude`, no `push`, no `fetchcal`, no `canvas`, no `lti`, no `calendar`.
Every AI feature, every reminder and the calendar feed are simply absent from
staging — and absent in the way that looks like an app bug rather than a
missing deploy.

`functions.yml` cannot cover for that. It works the project ref out from
`SUPABASE_PROJECT_REF` or `VITE_SUPABASE_URL`, both of which name production,
so it has never deployed a function anywhere else.

### The decision this needs, which is not mine to take

Two ways out, and the first is a change to how production's functions are
deployed, so it belongs to whoever wrote that comment.

**Declare the functions in `config.toml`** with `verify_jwt = false` on each,
matching the `--no-verify-jwt` that `functions.yml` passes to every one of
them. Branching then deploys them to every preview branch, and staging becomes
what the plan asks for.

The comment's objection survives this and should be taken seriously: two deploy
paths for one function can disagree, and the specific thing they can disagree
about is exactly that flag. `claude`, `fetchcal` and `canvas` verify the
caller's token themselves and must answer a CORS preflight, which carries no
`Authorization` header at all — so a path that quietly turned platform JWT
verification back on would break every AI feature in the app, and it would
break it at whichever deploy ran last.

But *undetected* divergence is the fault, not duplication. This repository
already has the instrument for two sides that cannot import from each other and
must agree: `lib/referral.test.ts` and `lib/allowance.test.ts` read the other
side as text and go red when the two stop matching. A test holding every
`[functions.*]` block in `config.toml` against the flag `functions.yml` passes,
and against the set of directories in `supabase/functions/`, turns "two paths
that can disagree" into "two paths pinned to agree".

**Or leave it, and say so.** Staging then covers the database, the policies and
the app, and does not cover the functions. That is a smaller thing than it
sounds — `check.sh` exercises the schema far harder than a branch does — and it
is an honest position as long as it is written down rather than discovered by
somebody testing a feature on staging that was never there.

What is not an option is the current state, where the plan's exit gate says
"including Edge Functions" and nobody had established that they are not
included.

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
nothing in this repository should be read as claiming otherwise. That part is
twenty minutes in a dashboard and a SQL editor, and it is twenty minutes
nobody has spent.

The Edge Functions half is not twenty minutes; it is the decision above.
