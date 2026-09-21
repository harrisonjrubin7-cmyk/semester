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

### Settled on 21 September: declare the live ones, and pin the flag

`supabase/config.toml` now carries a `[functions]` block. The argument that
stood against one is answered rather than overruled, and the answer has two
halves.

**Only the functions that are live.** `claude` and `push`, which is what
`DEPLOY.md` records as ACTIVE — and not `fetchcal`, `canvas`, `lti` or
`calendar`, which production deliberately does not have. This is the point
rather than a shortcut: the plan asks for a branch that *matches* production,
and a branch carrying four functions production lacks would not match it, it
would exceed it. Declaring a function is also **how it gets deployed**, so
listing those four would have shipped them.

**The one flag they can disagree about is pinned.** Two deploy paths hurt when
they can disagree *silently*, and the thing these two can disagree about is
`verify_jwt`. `app/src/lib/functionconfig.test.ts` reads this file, the
workflow and `DEPLOY.md` as text and goes red when any pair stops agreeing —
the instrument `lib/referral.test.ts` and `lib/allowance.test.ts` use for every
other pair of sides in this repository that cannot import from each other.

It holds three things, in both directions:

| | |
| --- | --- |
| a live function missing from `config.toml` | a preview branch that silently lacks it — the original fault |
| a function declared that is not live | worse, because declaring it deploys it |
| `verify_jwt` disagreeing with `--no-verify-jwt` | every AI request failing in the browser, at whichever deploy ran last |

That third one is why the objection deserved taking seriously rather than
waving through. `claude` answers a CORS preflight, which carries no
`Authorization` header at all, so the *stricter* of the two paths is the one
that breaks the app.

Seven mutations were run against the guard and all seven are caught: dropping
a live function, declaring one that is not live, a slug matching no directory,
`verify_jwt` flipped to true, `verify_jwt` left unset, the workflow dropping
its flag, and a function going live in `DEPLOY.md` without being declared here.

**What this does not do** is deploy anything new. Both functions were already
live and already deployed by the workflow; what changes is that a preview
branch now gets them too.

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
Rebuilding the branch is the remedy, and the bot says how: close and reopen the
pull request.

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

The Edge Functions half is settled and done. None of it can be *checked* while
the Migrations task is refusing, which it is on every branch that predates the
renumbering — the first branch built after that clears is the first one where
any of this can be confirmed rather than reasoned about.
