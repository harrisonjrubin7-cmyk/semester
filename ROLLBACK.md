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
| The database schema | nothing here | — | **No** |

No workflow in this repository applies a migration. Schema changes are made by
hand against the Supabase project, they are forward-only, and **rolling the app
back does not roll the schema back.** One rule follows from that and it is the
only rule in this document that has to be obeyed *before* an incident:

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
migration, and that is exactly as far as it reaches. There is a second way
migrations could start being applied automatically, and it is not a file:
**Supabase Branching**, configured in the Supabase dashboard rather than here.
`supabase/config.toml` exists precisely so that integration can find the
project, and its own header says so.

As of this writing that integration is **not** doing anything, and not because
somebody turned it off. Its comment on every pull request reads:

> no changes detected in `https:/harrisonjrubin7-cmyk.github.io/semester/supabase`

That is a *URL* where a repository-relative directory path belongs, so it is
looking somewhere that cannot exist. It said this on a pull request that added
a migration and a check suite to `supabase/`, which is how the setting was
noticed at all.

Two things follow, and both are for a person rather than a test:

- **The setting is worth fixing**, because a branching integration that
  silently matches nothing is indistinguishable from one that is working until
  the day you need it.
- **Fixing it changes this document.** If Branching begins applying migrations
  on merge, the table above is wrong and the rule in the block quote becomes
  load-bearing in a way nothing here will warn you about. Check it by hand when
  that setting changes; no test in this repository can.

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
