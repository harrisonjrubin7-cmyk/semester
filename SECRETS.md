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
| **`STRIPE_SECRET_KEY`** (preferred) or **`STRIPE_API_KEY`** (legacy deployed name) | Supabase function secret (`billing-checkout`, `billing-cancel`, `billing-portal`) | Create charges, refunds, customers and short-lived billing portal sessions on Semester's Stripe account. The functions prefer `STRIPE_SECRET_KEY` and fall back to `STRIPE_API_KEY`; if neither is set, billing answers 503 | Roll at `dashboard.stripe.com` → Developers → API keys, then set `STRIPE_SECRET_KEY` with `supabase secrets set`; remove the legacy name after the canonical key is installed and verified |
| **`STRIPE_WEBHOOK_SECRET`** | Supabase function secret (`billing-webhook`) | Forge a payment event: mark an invoice paid, start or end a subscription. **Unset, the webhook answers 503** | Roll the endpoint's signing secret in Stripe → Developers → Webhooks, then `supabase secrets set`. Stripe signs with both during its overlap window, and the function accepts either |
| **`RESEND_API_KEY`** | Supabase function secret (`lead-intake`, `support-reply-notify`) | Send email as Semester's Resend account | Revoke at `resend.com/api-keys`, then `supabase secrets set`. Stored leads and in-app support replies remain; only email hints stop |
| **`LEAD_IP_SALT`** | Supabase function secret (`lead-intake`), optional | Link a stored rate-limit hash back to an IP address by guessing addresses. Falls back to the service key when unset | `supabase secrets set`; the one-day hashes already stored simply stop matching |
| **`integration_cron_secret`** | Supabase Vault only. The `integration-tick` function checks tokens against it through the database, so no copy is set anywhere else | Make the integration sync tick run early. It returns counts only and reads nothing out | Update the Vault row; nothing else holds it. See `docs/INTEGRATION-OPERATOR-RUNBOOK.md` §4 |
| **`INFRA_GITHUB_TOKEN`** | Actions **environment secret** (`infrastructure-plan`, `infrastructure-production`), used by `drift.yml` and `infra-apply.yml` | Change this repository's branch rules, environments and Actions permissions: the ability to switch off every control in `infra/`. Meant to be a GitHub App installation token on this one repository, not a personal token | Revoke the App installation or token in GitHub, issue a new one, update the environment secret. Drift detection fails until replaced |
| **`VERCEL_API_TOKEN`** | Actions environment secret (same two environments) | Change the Vercel project's firewall, retention and settings for everything the token's team owns | Revoke at vercel.com → Account → Tokens, issue a new one, update the secret |
| **`TF_STATE_ACCESS_KEY_ID`**, **`TF_STATE_SECRET_ACCESS_KEY`** | Actions environment secrets (same two environments) | Read and write the Terraform state, which holds attribute values the providers read, including a created project's database password. Scoped to the state bucket and nothing else | Revoke in the state store's console, issue a new pair, update both secrets |

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
| `SEMESTER_PRODUCTION_APP_URL`, `SEMESTER_PRODUCTION_GATEWAY_URL` | Actions **variables** | Public HTTPS origins used only by the hourly production smoke. The public probe defaults the app origin to this repository's Pages address; the institutional probe runs only when both variables are present and fails a partial pair. Neither value is a credential |
| **`HAWK_API_KEY`** | Actions **secret** | Submit and associate HawkScan DAST results with the StackHawk account. Add it under Settings → Secrets and variables → Actions; rotate or revoke it in StackHawk, then replace the Actions secret |
| `STACKHAWK_APPLICATION_ID` | Actions **variable** | The non-secret StackHawk application UUID used by `.github/workflows/hawkscan.yml`. Set it under Settings → Secrets and variables → Actions → Variables |
| `CODEQL_ENABLED` | Actions **variable** | Not a secret. Set to `true` only after code scanning is available for the repository (public, or GitHub Advanced Security); until then `.github/workflows/codeql.yml` is skipped rather than failing on upload. Set it under Settings → Secrets and variables → Actions → Variables |
| `TF_STATE_BUCKET`, `TF_STATE_REGION`, `TF_STATE_ENDPOINT` | Actions **variables** (`infrastructure-plan`, `infrastructure-production`) | Where Terraform state lives: a bucket name, a region and, for an S3-compatible store, an endpoint. Identifiers, not credentials; read by `scripts/infra/tf-init.sh`. Unset means `drift.yml` reports NOT CHECKED |
| `VITE_STUN_URLS`, `VITE_MONTHLY_CALL_LIMIT` | Actions | A public STUN list and a number |
| `VITE_INSTITUTIONAL_PREVIEW` | Actions variable or secret | A public build-time feature flag. Only the exact value `true` enables the synthetic institutional preview; leave it unset for the production-default interface. The Pages deploy ignores it: that site is the real app the Log in button goes to, so a demo is its own deployment (`npm run preview:institutional` locally) |
| `VITE_TODAY_ACTION_CENTER`, `VITE_REGISTRATION_DAY_MODE`, `VITE_GRADUATION_SIMULATOR`, `VITE_COST_PLANNER`, `VITE_ACADEMIC_LIFE_BALANCE`, `VITE_CRUNCH_WEEK_FORECAST`, `VITE_COURSE_DETAIL_V2`, `VITE_ADVISOR_MEETING_MODE`, `VITE_STUDY_READINESS`, `VITE_SOURCE_LOCKER`, `VITE_CAREER_EVIDENCE`, `VITE_OFFICE_ACTION_FEED`, `VITE_DEMAND_FORECASTING`, `VITE_SEMESTER_WRAPPED`, `VITE_OFFLINE_MODE`, `VITE_OFFLINE_ENGINE_TASKS`, `VITE_TRUST_CENTER`, `VITE_COURSE_STUDIO` | Actions variable or secret | Feature-expansion module states, same four values. Unlike the row above, none inherits `preview` from `VITE_INSTITUTIONAL_PREVIEW`: each is `off` until set on its own — see [`docs/FEATURE-EXPANSION-CROSSWALK.md`](docs/FEATURE-EXPANSION-CROSSWALK.md) and `DECISION-LOG` D-012 |
| `VITE_SEMESTER_INTELLIGENCE`, `VITE_JOURNEY_NAVIGATION`, `VITE_ADAPTIVE_LEARNING`, `VITE_CAREER_SKILLS_GRAPH`, `VITE_MULTIMODAL_CAPTURE`, `VITE_UNIVERSITY_CONTROL_PLANE`, `VITE_INTEGRATION_DASHBOARD`, `VITE_HUMAN_HELP`, `VITE_INSTITUTIONAL_OPERATIONS`, `VITE_CAMPAIGN_MANAGER`, `VITE_MIGRATION_CENTER`, `VITE_CONFIGURATION_STUDIO`, `VITE_WORKFLOW_BUILDER`, `VITE_RECORD_LEDGER`, `VITE_STUDENT_ACCOUNTS`, `VITE_SUPPORT_TICKETS`, `VITE_PRIVATE_BETA`, `VITE_DOMAIN_TASKS`, `VITE_DOMAIN_TODAY` | Actions variable or secret | Public additive-experience states. Each accepts only `off`, `preview`, `sandbox` or `production`; an omitted value inherits `preview` only when `VITE_INSTITUTIONAL_PREVIEW=true`, otherwise `off` — except `VITE_DOMAIN_TASKS` (adding, ticking, moving and deleting a task through `src/domains/tasks`, D-1149: only `production` switches it on, every other state is the legacy reducer), `VITE_DOMAIN_TODAY` (the Action Center's commitment rows through `src/domains/today`, D-1261: `preview` and `sandbox` only compare them with the screen's own in the console, `production` draws them while they are current and complete), `VITE_SUPPORT_TICKETS` and `VITE_PRIVATE_BETA`, which a preview never turns on: a ticket is a real message to real support staff, and the beta panel shows a real account's membership |
| `VITE_AI_TOOLKIT`, `VITE_TOOLKIT_RESEARCH`, `VITE_TOOLKIT_DATA`, `VITE_TOOLKIT_DATA_UPLOAD`, `VITE_TOOLKIT_WORKBENCHES`, `VITE_TOOLKIT_DISCLOSURE` | Actions variable or secret | Public AI Toolkit states (`app/src/lib/toolkit/flags.ts`). Each accepts only `off`, `preview`, `sandbox` or `production`; an omitted value is `off` and does **not** follow `VITE_INSTITUTIONAL_PREVIEW`. `VITE_AI_TOOLKIT=off` forces the other five off. See `docs/ai-toolkit/AI-TOOLKIT-FEATURE-FLAGS.md` |
| `VITE_READ_ONLY` | Actions variable or secret | Read-only mode ([`docs/FEATURE-FLAG-REGISTRY.md`](docs/FEATURE-FLAG-REGISTRY.md)). Only the exact value `true` engages it: the app stops pushing state to the account service and shows the banner, and every edit stays on the device until the mode ends. Anything else, or unset, is off. Rollback is deleting the variable and redeploying |
| `VITE_DEPLOY_ENVIRONMENT` | Actions variable or secret | The environment word the operations console shows on every page (`app/src/lib/environment.ts`): the exact value `staging` makes a build say so; anything else, or unset, is production. A demo build is decided by `VITE_INSTITUTIONAL_PREVIEW`, not this. It changes only a word and a shape on staff screens; leave it unset on the Pages deploy |
| `VITE_ME_LANGUAGE` | Actions variable or secret | Whether the Appearance page offers **Dates and numbers** (`app/src/lib/locale.ts`). Accepts `off`, `preview`, `sandbox` or `production`; an omitted value is `off` and does **not** follow `VITE_INSTITUTIONAL_PREVIEW`. Off, a student's stored choice is ignored and every date is written as before, so setting it back to `off` is the rollback |
| `VITE_PATH_LEARNER_PATHWAYS` | Actions variable or secret | Whether Pathway offers **Pathways that fit you** and Registration's course search offers when/format filters (`app/src/lib/learner-pathways.ts`). Accepts `off`, `preview`, `sandbox` or `production`; an omitted value is `off` and does **not** follow `VITE_INSTITUTIONAL_PREVIEW`. The student's ticks are kept on their device under their own key and never synced; setting the flag back to `off` hides the panel and the filters and is the rollback |
| `VITE_ME_LIFE_EVENTS` | Actions variable or secret | Whether the Behind screen offers **If something has changed** (`app/src/lib/lifeevents.ts`): twelve plain sentences with no field to type in, and a plan that clears itself after four weeks. Accepts `off`, `preview`, `sandbox` or `production`; an omitted value is `off` and does **not** follow `VITE_INSTITUTIONAL_PREVIEW`. What a student picks (the event and the day) is kept on their device under its own key, outside the synced state, and is sent nowhere; setting it back to `off` hides the panel and leaves what was kept unread |
| `VITE_ME_MOMENT_FEEDBACK` | Actions variable or secret | Whether two optional one-question prompts are asked (after an Ask Semester answer that has a source, and after a help request is sent) and What's new shows **You said, we changed** with its controls (`app/src/lib/momentfeedback.ts`). Accepts `off`, `preview`, `sandbox` or `production`; an omitted value is `off` and does **not** follow `VITE_INSTITUTIONAL_PREVIEW`. Answers are kept on the student's device and there is no collection path to a school; setting it back to `off` stops the questions and hides the panel |
| `VITE_COMMUNITY_FEED`, `VITE_COMMUNITY_REPORTING`, `VITE_MODERATION_CONSOLE`, `VITE_INSTITUTION_ESCALATION`, `VITE_VOLUNTEER_MODERATION`, `VITE_SCOPED_PSEUDONYMITY`, `VITE_ACCOUNT_SAFETY_STATE`, `VITE_COMMUNITY_IMAGES` | Actions variable or secret | Public Community states, same four values. The first three inherit `preview` like the row above; the last five are high-risk, stay `off` unless set by hand, and read `production` as `off` — see [`docs/FEATURE-FLAG-REGISTRY.md`](docs/FEATURE-FLAG-REGISTRY.md) |
| `VITE_TODAY_SHADOW` | Actions variable or secret | A public build flag, not a secret. `on` runs the domain layer beside Today's Action Center and warns in the browser console where the two differ (`app/src/composition/shadow.ts`). It draws nothing, changes nothing and sends nothing; absent is off. Remove once Today reads the domain layer (modularization phase 3) |
| `SUPABASE_PROJECT_REF` | Actions **variable** | The project reference, which is in the Supabase URL already |
| `ALLOWED_ORIGIN`, `MONTHLY_CALL_LIMIT`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Supabase function secrets | Limits and public halves. `ALLOWED_ORIGIN` only adds https origins to the built-in Pages origin for five functions (claude, fetchcal, canvas, lti, trust-room); CORS fails closed, and `CORS_ALLOW_DEV` (local only) is what admits localhost — see [`supabase/DEPLOY.md`](supabase/DEPLOY.md) |
| `SITE_ORIGINS`, `CHECKOUT_RETURN_URL`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_PRODUCT_TAX_CODE`, `BILLING_LIVE_ENABLED`, `LEAD_NOTIFY_EMAIL`, `LEAD_NOTIFY_FROM`, `SUPPORT_NOTIFY_FROM`, `SUPPORT_RETURN_URL` | Supabase function secrets (`lead-intake`, `billing-checkout`, `billing-portal`, `support-reply-notify`) | Configuration. `SITE_ORIGINS` is read strictly. The activation tool stores the exact active `bpc_…` portal configuration and owner/accountant-approved `txcd_…` software classification; billing refuses absent or malformed values. `BILLING_LIVE_ENABLED=true` is necessary but cannot override the current code-level paid-acquisition hold. `SUPPORT_NOTIFY_FROM` falls back to `LEAD_NOTIFY_FROM`; `SUPPORT_RETURN_URL` defaults only to the production GitHub Pages app. See [`docs/COMMERCIAL-CORE.md`](docs/COMMERCIAL-CORE.md) |
| `SUPABASE_URL` | Injected into functions | Nothing. It is in the JavaScript every visitor downloads |
| `SUPABASE_ANON_KEY` | Injected into functions | Nothing beyond what a visitor has: it is the publishable key in the JavaScript every visitor downloads. `billing-cancel` uses it with the *caller's* token, so row-level security decides what it reaches |
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

### Productivity source hosts

`PRODUCTIVITY_SOURCE_HOSTS` is optional Supabase function configuration: a comma-separated exact hostname allowlist for public institutional sources outside .edu. It carries no credential. Removing a host revokes future source checks to it; redeploy is unnecessary. `CORS_ALLOW_DEV` controls local-only CORS for this function, following the existing shared helper. Never enable it in production.
