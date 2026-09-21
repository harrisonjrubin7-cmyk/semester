# Staging, and what a preview branch is actually telling you

The build-out plan asks for "staging preview branches that match production,
including Edge Functions". **Branching is already on**, has been since before
18 September, and builds a preview branch for every pull request touching
`supabase/`. [`ROLLBACK.md`](ROLLBACK.md) is the history of how that setting was
found to be misconfigured, corrected, and then watched.

So this item was never "turn it on". It is two harder halves: **the three
words at the end of the plan's sentence — "including Edge Functions" — were
not true**, which is settled below; and **a preview branch exists and nobody
has ever established that it matches production**, which is not.

## The Edge Functions, and what a preview branch actually runs

This took three goes to get right, and the wrong versions are worth keeping in
view because each was wrong in a way that reads as careful.

**First I wrote that Branching does not carry Edge Functions at all.** False —
`ROLLBACK.md` records a branch reaching `FUNCTIONS_DEPLOYED`.

**Then the branch's own warning suggested it carried none of ours:**

> ⚠️ Only Functions declared in config.toml will be automatically deployed to
> branches: `[functions.my-slug]`

and `supabase/config.toml` declared none, so I concluded a preview branch had
no functions. **Also false, and this is the one worth understanding.**

The management API settles it. The preview branch for pull request #618 lists
`claude`, `push`, `calendar`, `fetchcal`, `canvas` and `lti`, all ACTIVE. A
branch **inherits production's functions**. What the warning means is narrower:
only the declared ones are *rebuilt from the repository*. The rest keep the
build production had when the branch was cut.

That is worse than absence, not better. A missing function fails loudly the
first time a screen calls it. A function running last week's code answers
every call successfully and with the wrong behaviour, and staging reports that
the pull request works.

The same listing shows it happening, which is why this version is measured
rather than reasoned:

| | `claude` on the branch | `claude` in production |
| --- | --- | --- |
| version | 20 | 19 |
| checksum | `da4011ce…` | `8f8d4bec…` |
| built at | `/app/supabase/functions/…` | `/home/runner/work/…` |

The branch rebuilt it from the repository; production's is still the one the
workflow deployed.

### Settled: declare all six, and pin the three lists to each other

`config.toml` now declares every function in `supabase/functions/`, because
every one of them is live. **And the third mistake is the instructive one:**
the first attempt declared two, on the strength of `DEPLOY.md`'s "What is
live" section — which listed `claude` and `push` and was four functions out of
date. I trusted a document in this repository over the system it describes,
in a repository whose `CLAUDE.md` is largely a record of that exact failure.

`DEPLOY.md` is corrected, and `app/src/lib/functionconfig.test.ts` now holds
**three** sets equal rather than two:

    supabase/functions/  ==  [functions.*] in config.toml  ==  DEPLOY.md's live list

with `supabase/functions/` as the ground truth, because a directory either
exists or it does not. Pinning the config to the prose is what let the prose
steer; pinning both to the directories is what stops it.

The flag is pinned too. `verify_jwt = false` on all six, matching the
`--no-verify-jwt` the workflow passes and what the project reports for each.
`claude`, `fetchcal` and `canvas` answer a CORS preflight, which carries no
`Authorization` header, so the *stricter* of the two paths is the one that
breaks the app.

Seven mutations, all seven caught: a real function left undeclared, a slug
with no directory, `DEPLOY.md` going stale again, `DEPLOY.md` naming something
that does not exist, the flag flipped, the flag unset, and the workflow
dropping `--no-verify-jwt`.

**Declaring them deploys nothing new.** All six were already live and
`functions.yml` remains the only thing that deploys to production. What
changes is that a branch now rebuilds them from the branch.

## Renaming a migration breaks every branch that already applied it

A third thing, found the same way as the second — by watching this pull
request's own branch rather than by reasoning about the platform.

`20260921003700_lti.sql` was renumbered to `20260921160000_lti.sql` on main at
15:57 on 21 September, in the pull request that fixed it being stranded below
the ledger watermark. That fix was correct and necessary. What nobody had
established is what it does to a preview branch that already exists:

| | |
| --- | --- |
| This branch, Migrations task | ✅ 16:10 · ✅ 16:13 · ✅ 16:15 · **❌ 16:31** |
| What changed at 16:26 | merged main, which renamed that file and nothing else about migrations |
| The error | `Remote migration versions not found in local migrations directory.` |

The branch had applied `20260921003700` when it was built. After the rename
there is no file with that version, so the branch's own ledger carries a
version the repository cannot account for, and the task refuses. Pull request
#611 hit the identical error at 16:13, on a different branch with an unrelated
diff, once it too carried the renamed file.

So a preview branch is **not** rebuilt from the repository on each push. It
keeps its own accumulated ledger, and the bot's own line — *only new migration
files are pushed* — has a sharper consequence than it sounds: **adding a
migration is cheap, and renaming one invalidates every branch in flight.**
Rebuilding the branch is the remedy. The bot suggests closing and reopening
the pull request, and there is a narrower way that does not touch the pull
request at all: **reset the branch through the management API**, which is what
was done here. It rebuilt from `CREATING_PROJECT` through `RUNNING_MIGRATIONS`
to `FUNCTIONS_DEPLOYED` in about four minutes, and cleared the stale ledger
entry without deleting anything a reviewer was looking at.

This repository has now renumbered migrations twice in one day — seven files in
the history repair, then this one — and both times the reasoning was sound and
the cost to staging was invisible. It is not an argument against renumbering,
which fixed a broken production deploy. It is a cost to say out loud next time,
because a staging environment that is red for a reason nobody can name is one
people stop looking at, which is how production's schema deploy stayed broken
for three days.

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

The Edge Functions half is settled and, unusually for this document, checked:
the branch for pull request #618 was reset, rebuilt to `FUNCTIONS_DEPLOYED`,
and its function list read back from the management API. That is where the
version-20-against-19 table above comes from.

What remains unchecked is the comparison itself — the six fingerprints — which
is the step that turns "a branch built" into "staging proven".
