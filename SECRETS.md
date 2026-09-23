# Where every secret lives

An inventory: what this project holds, which store each one is in, and who can
change it. Written because the rotation the owner is doing this week needs a
list of *places*, and the list that existed was a list of *revocations*.

This is [`SECURITY.md`](SECURITY.md)'s sibling and deliberately not a copy of
it. That document is the incident process — what to do in the hour after a key
is out, and how each one is revoked. **This one answers the question that comes
first and has no answer there: where is it, and what else breaks when it
changes.** Where they touch, this one links rather than repeating: a rotation
procedure written twice is a rotation procedure that drifts, and the copy
somebody reads at two in the morning will be the stale one.

> **There is a reason this is a second file rather than a section of
> `SECURITY.md`, and it is structural rather than editorial.**
> [`app/src/lib/security.test.ts`](app/src/lib/security.test.ts) holds that
> document to exactly the secrets the Edge Functions read — bidirectionally, so
> a name in it that no `Deno.env.get` reads fails the suite. That is the right
> rule for an incident list and it makes the document unable to hold the two
> secrets this week's rotation is actually about: `SUPABASE_ACCESS_TOKEN` is a
> GitHub Actions secret no function reads, and `VITE_SUPABASE_KEY` is a build
> variable. Adding them there turns the suite red.
> [`app/src/lib/secrets.test.ts`](app/src/lib/secrets.test.ts) is this file's
> equivalent guard and covers the stores that one cannot.

## The four stores

Every secret below is in exactly one of these. Knowing which is most of
knowing how to change it.

| Store | Reached by | Who can read it back |
| --- | --- | --- |
| **Supabase function secrets** | `supabase secrets set NAME=…`, or Dashboard → Edge Functions → Secrets | Nobody, including the owner. Set-only; a lost value is replaced, not recovered |
| **Supabase dashboard** | Dashboard → Settings → API | The owner. The service-role and publishable keys are shown on that page |
| **GitHub Actions** | Settings → Secrets and variables → Actions | Nobody for a *secret* — write-only once saved, and masked in every log. A *variable* is readable and appears in logs |
| **`app/.env.local`** | A file on the owner's laptop, ignored by git ([`.gitignore`](.gitignore) line 18) | Whoever is at that laptop |

A fifth place is worth naming so that nobody goes looking for a store that
does not exist: [`app/.env.production`](app/.env.production) **is committed**,
and holds the two values that are public by design. Its own header says why.

## The inventory

Sorted by what a leak costs, because that is the order a rotation happens in.
"Revoked by" is the short form; [`SECURITY.md`](SECURITY.md) has the steps.

### Worth something to a stranger

| Secret | Store | What it gets somebody | Revoked by |
| --- | --- | --- | --- |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Injected by Supabase into every function — it is in no store and is set by nobody | **Everything.** It bypasses row-level security: every row of every table, for every account | Dashboard → Settings → API → roll. Functions take the new one on their next invocation |
| **`SUPABASE_ACCESS_TOKEN`** | GitHub Actions secret, used by [`functions.yml`](.github/workflows/functions.yml) | The Supabase **account**, not one project: the CLI can deploy functions, run migrations and read secrets for everything the owner owns | `supabase.com/dashboard/account/tokens` → revoke, issue a new one, update the Actions secret. Deploys fail until it is replaced |
| **`ANTHROPIC_API_KEY`** | Supabase function secret | The project's Claude bill, capped per account and uncapped in total | Revoke at `console.anthropic.com`, then `supabase secrets set` |
| **`VAPID_PRIVATE_KEY`** | Supabase function secret | Push a notification to any device subscribed to this project | `npx web-push generate-vapid-keys`. **Every existing subscription dies**, and the public half has to be set in two places — see below |
| **`LTI_PRIVATE_KEY`** | Supabase function secret | Sign as this tool to any Brightspace that has registered it — write a grade, or answer a deep-linking request as us. The JWK in it holds the private half **and** the public one, which is served at `…/lti/jwks` on purpose | Generate a new RS256 JWK and `supabase secrets set`. The JWKS endpoint serves the new public half within its one-hour cache and every platform takes it on the next fetch, so unlike the VAPID rotation above **nothing is lost** — no launch depends on this key |
| **`SEMESTER_APP_URL`** | Supabase function secret | Not a credential — it is where a validated Brightspace launch sends the browser, carrying a one-use session token. A wrong value hands that token to whatever is at the address, which is why it is in this half of the table. The `lti` function has **no default** and refuses a launch while it is unset | `supabase secrets set` |
| **`CRON_SECRET`** | Supabase Vault *and* a function secret | Make the reminder sender run early. Not to read anything | Rotate in **both**, or the job 401s every fifteen minutes |

### Configuration that is stored like a secret and is not

These are in a secret-shaped store, and the reason is worth stating once:
anything named `VITE_…` is compiled into the JavaScript every visitor
downloads. Putting one in GitHub Actions hides it from the *build log*, which
is worth having for a TURN password, and hides it from nobody else.
[`pages.yml`](.github/workflows/pages.yml) reads each as a variable first and a
secret second, so either works.

| Name | Store | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_KEY` | `app/.env.production` (committed), overridable by an Actions variable or secret | The publishable key. Public by design; the row-level policies are what make that safe. Allowlisted in [`.gitleaks.toml`](.gitleaks.toml) for that reason, by prefix — `sb_secret_…` and a JWT are not |
| `VITE_SUPABASE_URL` | Same | In the JavaScript every visitor downloads |
| `VITE_VAPID_PUBLIC_KEY` | Actions variable or secret | The public half. **Rotating the VAPID pair is not finished until this is set and the site rebuilt** — the step that gets forgotten |
| `VITE_TURN_USER`, `VITE_TURN_PASS`, `VITE_TURN_URL` | Actions | A TURN credential, carried in the page regardless. A secret here only keeps it out of the log |
| `VITE_MS_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ZOOM_CLIENT_ID`, `VITE_APPLE_CLIENT_ID` | Actions | OAuth **client** IDs. Public by the standard's design; the secret half never reaches the browser |
| `VITE_CLAUDE_PROXY`, `VITE_ICS_PROXY`, `VITE_OAUTH_PROXY`, `VITE_UNIVERSITY_GATEWAY_URL` | Actions | Addresses. Each also contributes an origin to the app's Content-Security-Policy — see the header of [`app/index.html`](app/index.html) |
| `VITE_STUN_URLS`, `VITE_MONTHLY_CALL_LIMIT` | Actions | A public STUN list and a number |
| `VITE_INSTITUTIONAL_PREVIEW` | Actions variable or secret | A public build-time feature flag. Only the exact value `true` enables the synthetic institutional preview; leave it unset for the production-default interface |
| `SUPABASE_PROJECT_REF` | Actions **variable** | The project reference, which is in the Supabase URL already |
| `ALLOWED_ORIGIN`, `MONTHLY_CALL_LIMIT`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Supabase function secrets | Limits and public halves. One wrong `ALLOWED_ORIGIN` makes three functions unreachable from the browser and says nothing — see [`supabase/DEPLOY.md`](supabase/DEPLOY.md) |
| `SUPABASE_URL` | Injected into functions | Nothing. It is in the JavaScript every visitor downloads |
| `GITHUB_TOKEN` | Issued by Actions for each run | Not stored by anybody and not rotatable. Scoped per job — see the `permissions:` blocks in [`ci.yml`](.github/workflows/ci.yml) |

### Two that are in no store at all

- **A student's calendar token.** 24 random bytes inside a URL. Whoever holds
  the URL reads that student's deadline titles and dates until it is replaced.
  The one credential here **a student rotates themselves** — *replace this
  link*, on the Export screen — and the one the owner cannot rotate for them
  without taking the feed away.
  [`supabase/CALENDAR-REVIEW.md`](supabase/CALENDAR-REVIEW.md) draws the blast
  radius: a leaked link leaks a timetable, not an identity.
- **A student's own Anthropic key**, if they set one. It never leaves their
  device — not in the database, not in the sync, not in a log — so it cannot
  leak from here. Said out loud so nobody spends an hour of an incident looking
  for where it is kept.

## What a laptop needs

`app/.env.local`, which git ignores. `app/.env.example` is the template and is
committed. Only two of these are secrets in the strict sense and neither is
shared with anybody:

```
ANTHROPIC_API_KEY=sk-ant-…        # the dev server's Claude proxy; never compiled in
APPLE_PRIVATE_KEY=/path/to/AuthKey.p8
```

The `.p8` is a file rather than a value and the path is what goes here —
[`app/vite.config.ts`](app/vite.config.ts) explains why the key is signed on
the machine and never reaches the browser.

## Rotation log

**Fill this in by hand, at the time, including the ones that went badly.** A
log with only the tidy rotations in it is a log that makes the next incident
harder: the useful row is the one that says the deploy broke for twenty minutes
because the public half of the VAPID pair was set in one of its two places.

"Reason" is the field that earns the table. *Routine* and *it was in a
screenshot* are different events with the same procedure, and only this column
remembers which one happened.

| Date | Secret | Rotated by | Reason | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

<!--
  Left with one empty row on purpose rather than an example row. An example
  gets copied, and a rotation log with a made-up first entry in it is a log
  nobody trusts the rest of.

  The shape of a real entry, for whoever fills in the first one:

  | 2026-09-22 | SUPABASE_ACCESS_TOKEN | @harrisonjrubin7-cmyk | Routine, pre-pilot | Old token revoked first; functions.yml re-run to confirm. |
-->

## What this file cannot do

It cannot tell you that a secret has leaked — [`SECURITY.md`](SECURITY.md) says
plainly that nothing here watches, and that is still true. It cannot rotate
anything. And it is only as current as the last person to edit it, which is why
the two lists that *can* be derived from the code are:
[`app/src/lib/secrets.test.ts`](app/src/lib/secrets.test.ts) reads the Edge
Functions and the workflows and fails when this file is short a name.
