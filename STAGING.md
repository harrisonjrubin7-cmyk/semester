# A staging branch that actually matches production

The build-out plan asks for "staging preview branches that match production,
including Edge Functions". The three words at the end are the whole item.

## What Branching gives you, and what it does not

Supabase's Branching makes a preview branch a **separate project** with its
own ref, its own database and its own keys, built by applying
`supabase/migrations/` from empty. That is genuinely most of the work, and it
is why [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md) mattered so much: a
branch is built from the repository's migrations, so for as long as those
could not rebuild production, **a preview branch was a database nobody had
ever run**, and the first thing it would have taught you was something untrue
about production.

That is fixed. Step 4 of that repair proved the baseline against production —
five of six fingerprints match and the sixth is comments — so a branch built
from this directory now has production's shape.

Three things it still does not carry, and each one is a way for staging to
quietly stop matching:

**1 · Edge Functions.** The database is branched; the functions are not. A
preview branch has no `claude`, no `push`, no `fetchcal`, no `canvas` — so
every AI feature, every reminder and the calendar feed are simply absent, and
they are absent in a way that looks like an app bug rather than a missing
deploy.

The fix is in this repository: Actions → **Deploy Edge Functions** → Run
workflow, with **project_ref** set to the branch's ref. Left empty it deploys
to production exactly as it always has. The ref is on the branch's page in the
dashboard, and it is the subdomain of that branch's API URL.

**2 · Secrets.** Function secrets do not branch either. `ANTHROPIC_API_KEY`,
the cron secret and the rest have to be set on the branch, and the honest
advice is to set a *different* Anthropic key on staging with its own low spend
cap. A staging environment spending production's AI budget is a way to find
out about a mistake from a bill.

**3 · Postgres major.** `supabase/config.toml` carries `major_version`, and
its own comment says why: a preview branch built on a different major than
production would teach you something untrue about production on its first
run. `supabase/check.sh` reads the same number rather than repeating it, so
the two cannot drift.

## The order to do it in

1. Enable Branching on the project (dashboard; it is a paid feature and a
   person has to turn it on).
2. Create a preview branch from this repository's default branch and let it
   build. It applies every file in `supabase/migrations/` from empty.
3. Compare it to production: run [`supabase/fingerprint.sql`](supabase/fingerprint.sql)
   against both and compare the six numbers. **This is the step that makes it
   staging rather than a second database.** Five matching and the sixth
   differing on comments is the known-good answer.
4. Deploy the functions to it, with the workflow above.
5. Set the branch's secrets, with their own spend cap.
6. Run [`supabase/health.sql`](supabase/health.sql) blocks 4 and 5 against it.
   Row-level security is on for every table, and `ensure_rls` is present. A
   branch is built by applying migrations from empty, which is exactly the
   situation where that event trigger matters.

## What is proven locally, and what only a branch can prove

`supabase/check.sh` already builds every migration from empty in a throwaway
Postgres and runs twelve policy suites against it — which is most of what a
preview branch would tell you about the schema, without a paid feature or a
network. `supabase/rehearse.sh` goes further and applies the pending
migrations to production's *shape* with rows in it.

What neither can do is exercise the Edge Functions, the auth providers, the
real keys and the app against a real API URL end to end. That is what staging
is for, and it is the only reason to spend money on it.

## Where this stands

The workflow can target a branch, this document is the procedure, and the
schema half is proven by `check.sh` on every run. **Enabling Branching and
creating the first branch is a person's job in the dashboard and has not been
done.** Until it has, "staging proven" in Stage 1's exit gate is not ticked,
and nothing in this repository should be read as claiming otherwise.
