# Deploying the backend

Edge Functions, the SQL they read, and a scheduler. No function needs the app
redeployed — the browser calls them by URL — but none does anything useful
until its secrets are set, and each fails *closed* rather than open when they
are missing.

## What is live

Read off the project at 21:27 UTC on 29 September 2026, not remembered. The
last column is which pipeline deployed that version, and it is the one worth
reading:

    claude            ACTIVE, v244, verify_jwt off  platform
    push              ACTIVE, v198, verify_jwt off  platform
    calendar          ACTIVE, v195, verify_jwt off  platform
    fetchcal          ACTIVE, v239, verify_jwt off  platform
    canvas            ACTIVE, v230, verify_jwt off  platform
    lti               ACTIVE, v232, verify_jwt off  platform
    integration-tick  ACTIVE, v88, verify_jwt off   platform
    trust-room        ACTIVE, v95, verify_jwt off   platform
    delete-account    ACTIVE, v72, verify_jwt off   platform
    billing-cancel    ACTIVE, v2, verify_jwt off    platform
    billing-checkout  ACTIVE, v32, verify_jwt off   platform
    billing-portal    PENDING THIS GATED RELEASE, verify_jwt off
    billing-webhook   ACTIVE, v32, verify_jwt off   platform
    lead-intake       ACTIVE, v32, verify_jwt off   platform
    support-reply-notify ACTIVE, v5, verify_jwt off, delivery PARKED by SUPPORT_NOTIFY_VENDOR_APPROVED pending Resend vendor approval and executed terms/DPA; provider acceptance was reached in the 3 October 2026 UAT, but that historical exercise is not current activation and Outlook inbox receipt remains pending

The same release defines `support-ticket-retention`, daily at 05:43 UTC, to
remove resolved or closed tickets after 180 days unless a legal hold applies.
The migration installs and explicitly activates that credential-free job when
pg_cron is present. It is not listed as live until a post-deploy read of
`cron.job` and its first successful execution are recorded.

    productivity-sourcecheck ACTIVE, v2, verify_jwt off   manual (first deploy)

The new source-check function was deployed through the authenticated Management API on 1 October 2026; its initial entrypoint is `/tmp/user_fn_.../source/productivity-sourcecheck/index.ts`. This is recorded as `manual` provenance in the snapshot, awaiting the first platform deploy after merge. Every POST verifies the user's JWT with `auth.getUser`; OPTIONS carries no token. It reports public page availability and exact-excerpt presence, caps redirects, bytes and time, and rejects private DNS addresses. `PRODUCTIVITY_SOURCE_HOSTS` adds approved exact hosts outside .edu. It does not store or log source URLs/page bodies.

**This file once said two, at v1, and filed three of the other four under "Not
deployed yet".** `fetchcal` had been live since 9 September when that was
written — twelve days — and `calendar` since the 8th and was named nowhere at
all. `lti` went up at 15:48 on the 21st, about two hours after its own section
said it had not.

### There are two pipelines, not one

This section used to explain that with one sentence: `functions.yml` deploys on
every push to main that touches a function's directory, so a function directory
on main is a deployed function. That is true and it is not the whole mechanism,
and the half it leaves out is the half that failed.

    platform   Supabase's own deploy off the main branch. Runs on EVERY merge.
    runner     .github/workflows/functions.yml. Runs only when a merge touches
               that function's directory.

The project reports an `entrypoint_path` per function which names the machine
the bundle was built on — `file:///app/...` for the platform,
`file:///home/runner/work/semester/semester/...` for the runner — so the column
above is read rather than assumed.

**A `runner` row means the platform deploy is not building that function.** It
runs on every merge; if it were building the function it would have overwritten
the path. So the column is not a note about provenance, it is the freeze
detector, and for three days it was sitting in plain sight reading `runner`
twice while nobody looked.

Between 18 September 17:35:25Z and 21 September 22:53:45Z, `push` and
`calendar` sat at v16 and v12 while the other four gained fifteen and sixteen
versions each. **246 merges landed on main in that window**, every one of them
running the platform deploy, which rebuilt four functions and passed over two
without a word. Neither pipeline reached them, for two different reasons:

  - the platform deploy skipped them because both still imported over
    `https://esm.sh/`, which #685 measured against a same-hour control on a
    second preview branch and fixed; and
  - `functions.yml` never fired because **no commit touched either directory in
    those three days** — checked in the log, not assumed.

So they were not stale, they were unreachable. A change merged *into*
`calendar` would have gone live in the ordinary way; a change merged anywhere
else left the live `.ics` feed on a three-day-old bundle and reported nothing.

`supabase/functions.snapshot` is that reading, kept as a file, and
`app/src/lib/functionsdeployed.test.ts` holds this directory to it —
including the rule that a `runner` row is a finding. It also records the one
reading that is transient rather than a fault: a `workflow_dispatch` deploy
writes a runner path legitimately, and the next merge overwrites it. **A runner
row that survives a merge is the freeze.**

`app/src/lib/deployfunctions.test.ts` holds the section above to the directories
that exist — it cannot see the project, so it checks what it can: that every
function here is accounted for, that none is described as unshipped, that each
has a `[functions.<slug>]` block, and that none of them imports over `https://`.

The version numbers are the part that will go stale first and the part that
matters least. The deployed-or-not column is the one that misled; the pipeline
column is the one that stayed silent.

## Deploying a function without a laptop

`.github/workflows/functions.yml` runs the same command from Actions:
**Actions → Deploy Edge Functions → Run workflow**, with the function's name
(`fetchcal` by default). It also runs itself when a push to main changes a
function's own directory, and it deploys only the directories that changed.

It needs one secret, once: `SUPABASE_ACCESS_TOKEN`, from
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens),
added under Settings → Secrets and variables → Actions. That is an *account*
credential — it can deploy — so it lives in a secret and nowhere else. It is
neither the publishable key (which is public by design and committed) nor the
service key (which must never be anywhere). Without it the workflow warns and
deploys nothing rather than failing main.

The project is read from the `SUPABASE_PROJECT_REF` variable if set, and
otherwise off `VITE_SUPABASE_URL` — so a fork deploys to its own project.

## Live: `fetchcal`

    supabase functions deploy fetchcal

`supabase/functions/fetchcal/index.ts`. It reads **one pasted calendar link**
on behalf of a signed-in device — the Connect screen's *Subscribe* button.

Why it has to exist at all: a calendar server sends no CORS headers, so the
browser is refused before the request leaves. The dev server forwards that one
request itself (`/feed?url=` in `app/vite.config.ts`), which is why pasting a
Brightspace or Outlook link works on a laptop running `npm run dev`. On the
built app it works too, through this function. For twelve days this paragraph
ended "and, until this is deployed, fails on the built app", which told anybody
reading it that a working feature was broken.

It takes no secret and needs no SQL. It verifies the caller's own JWT, refuses
anything that is not https to a public host, refuses a redirect that lands
somewhere private, caps the read at a megabyte and fifteen seconds, and returns
the body only if it is a `VCALENDAR` — so it is a calendar reader rather than a
URL proxy that happens to fetch calendars. It never logs the address, because a
feed URL carries a token that is the whole of the authentication for that
person's calendar.

`verify_jwt` should be **off** for the same reason as the other two: the
function checks the token itself, and the platform check would reject the CORS
preflight, which carries no `Authorization` header.

Were it ever down or rolled back, the app degrades rather than breaks — links
from hosts that do allow the browser still work, the screen says what failed,
and adding a downloaded `.ics` needs no network at all. That is worth keeping
written down; it is a fallback, not the current state.

## Live: `canvas`

    supabase functions deploy canvas

`supabase/functions/canvas/index.ts`. It reads **one Canvas API path** on behalf
of a signed-in device — the Connect screen's *Read my Canvas* button, which is
the route that answers whether a piece of work has actually been handed in. A
calendar feed never says.

`fetchcal`'s sibling, and the same reason for existing with one difference that
raises the stakes throughout. Canvas sends no CORS headers on any API response,
on every instance — not a majority, all of them — so `app/src/lib/canvas.ts`
does not try the browser at all. The dev server forwards it while developing
(`/canvas` in `app/vite.config.ts`); this is the deployed route.

**What is different from `fetchcal`: the secret it carries.** A feed URL reads
one calendar. A Canvas access token *is the account* — it can read the
student's messages and grades, and it can write. So on top of the JWT check,
the public-host rule, the bounded read and the no-logging that `fetchcal`
already has, this one adds the two refusals that matter for a credential that
strong:

- **`GET`, under `/api/v1/`, and nothing else.** No method but GET reaches
  upstream and no path outside the API is fetched, so the worst a mistake can
  do is read something the student can already read.
- **Redirects are not followed.** Following one would carry the
  `Authorization` header to wherever it pointed. A 3xx off a Canvas API path is
  refused with a message saying what it usually means, which is a campus
  sign-in page rather than the API.

It also requires the answer to parse as JSON, because an instance behind campus
SSO answers an unauthenticated request with an HTML login page and a cheerful
200 — returning that as data is how somebody ends up with an empty course list
and no idea why.

It takes no secret of its own and needs no SQL. `verify_jwt` should be **off**,
for the same reason as the others: the function checks the token itself, and
the platform check would reject the CORS preflight.

Were it down, the app says so and points at the calendar link, which needs no
server at all and carries most of the same dates — just not whether you did
them. Again: a fallback, not where things stand.

`verify_jwt` is off on both, and on both it is the platform check that is off,
not authentication:

- **claude** verifies the caller's token itself, with
  `admin.auth.getUser(token)`, and refuses with 401 otherwise. It has to handle
  the CORS preflight, and a browser's `OPTIONS` carries no `Authorization`
  header — with the platform check on, the preflight is rejected before the
  function runs and every call from the app fails with a CORS error that says
  nothing about the cause.
- **push** is called by the scheduler rather than by a browser, and
  authenticates with a shared secret of its own. Without `CRON_SECRET` set it
  returns 503 to everything, so a half-finished deploy is silent rather than
  open.

## Live: `lti`

    supabase functions deploy lti --no-verify-jwt

`supabase/functions/lti/index.ts`. It is the Brightspace end of the finding in
`GRADESCOPE-TURNITIN.md`: Semester cannot submit *into* Gradescope or Turnitin,
and Brightspace can launch Semester. The first needs a partner program; the
second needs a 1EdTech standard and a school administrator.

Two endpoints, and a school's administrator needs the first one's address:

    …/functions/v1/lti/login     the OIDC login initiation URL
    …/functions/v1/lti/launch    the redirect URL, and the target link URI

`--no-verify-jwt` on this one is not the same argument as on the other four.
They verify the caller's Supabase token themselves; **this one has no Supabase
caller.** Brightspace redirects a student's browser to it, and that browser has
no session with this project. A launch is authenticated by the platform's own
signed `id_token`, checked against the keys the platform publishes and then
claim by claim against the registration below — `supabase/functions/_shared/lti.ts`
is that check and `app/src/lib/lti.test.ts` walks every refusal in it.

### The tool's own key

    supabase secrets set LTI_PRIVATE_KEY='{"kty":"RSA","n":"…","e":"AQAB","d":"…", …}'

An RS256 JWK, private half included. It lives as a function secret for the
same reason `VAPID_PRIVATE_KEY` does — a signing key used only by an Edge
Function, with its public half published on purpose — and not in the Vault,
which holds only the one secret Postgres itself has to read.

Its public half is served at:

    …/functions/v1/lti/jwks

**That address is the third thing a school's administrator needs**, alongside
the two below, and they need it while they are registering the tool rather
than afterwards: Brightspace asks for a JWKS URL during the install. With no
key set the endpoint answers 503 and says so, and **launches keep working** —
a launch is the platform proving itself to us and needs nothing of ours.

**Deep linking and grade passback both sign with it.** A deep-linking answer
is a JWT signed as this tool; a grade is posted with a token this tool
obtained by presenting one. Neither works without the key, and both say so.

### Grade passback, and what decides whether a number is ever sent

Not this tool. When an instructor places the link as a **graded activity**,
the launch names the gradebook column it owns, and the launch endpoint
records that address against the student's identity. Placed as an ordinary
link, nothing is recorded and nothing is ever sent — which is most links.

The number is the quiz: ten questions, a count right. When one ends, the
app posts the course code and the score to

    …/functions/v1/lti/score      POST, with the student's own session

and is told whether that went anywhere. The server matches the code
against the course *titles* it remembered at launch, because the app knows
codes and the platform knows titles and nobody has typed the mapping. One
match sends; none or several sends nothing, and the reason is in the log:

    no-identity        this account was never launched from a platform
    no-match           no graded Brightspace course has this code in its title
    ambiguous          two do — cross-listed courses — and guessing is worse
    no-key             LTI_PRIVATE_KEY is not set, so nothing can be signed
    token-refused      the platform's token endpoint said no; check token_url
    platform-refused   the column refused the score; the scopes are in the row

`token_url` on `lti_platform` is what this needs that a launch never did.
A registration installed before that column existed has none, and the
score endpoint refuses by name (`no-token-url`) rather than guessing an
address to post a signed assertion to.

The student is told, on the screen, when a score was reported. That is the
one line this feature adds to the app, and it is not decoration.

### Deep linking, on the launch endpoint

There is no third URL for this. Deep linking is a different *message* arriving
at `…/lti/launch`, which is why the administrator's list above did not grow.

What it is for: an instructor inside Brightspace's "add an activity" flow
picks Semester, Brightspace opens the launch endpoint with an
`LtiDeepLinkingRequest`, and what comes back is not a page but a JWT this tool
signs, posted to an address the platform nominated. The instructor never
really leaves Brightspace, and the course ends up holding a link that launches
Semester properly — with a token, verified — rather than a bare address.

Three things refuse it, and each says which:

    not-a-teacher        the launch carried no instructor role
    no-key               LTI_PRIVATE_KEY is not set, so nothing can be signed
    insecure-return-url  the platform's return address was not https

The first is the one worth stating plainly: a deep-linking response is an
instruction to put something in a course, so a platform that asks a *student*
for one is confused or being driven, and the answer is no either way.

The second is why this section sits under the key rather than beside the
endpoints. A launch works with no key at all. This does not, and the person
who has to fix it is the same person standing in the dialog — so it answers
503 and names the setting rather than 500 and a log they cannot read.

### Registering a school

Nothing in the app writes `public.lti_platform`, deliberately: an account that
could would be an account that could register an issuer it controls and launch
as anybody. It is one insert, in the SQL Editor, with the four values the
administrator reads off the Brightspace side of the registration.

```sql
insert into public.lti_platform
  (issuer, client_id, deployment_id, auth_login_url, jwks_url, name)
values
  ('https://brightspace.vanderbilt.edu',
   '<client id Brightspace issued>',
   '<deployment id Brightspace issued>',
   'https://brightspace.vanderbilt.edu/d2l/lti/authenticate',
   'https://brightspace.vanderbilt.edu/d2l/.well-known/jwks',
   'Vanderbilt University');
```

`token_url` is a fourth column and is **null until somebody fills it in**. It
is where the platform hands out access tokens for calling back into it, which
a launch never does — so it can be left out now and added when grade passback
exists. Brightspace's is not on the school's own host:

```sql
update public.lti_platform
   set token_url = 'https://auth.brightspace.com/core/connect/token'
 where issuer = 'https://brightspace.vanderbilt.edu';
```

There is deliberately no default. The value is where this tool posts a
*signed assertion*, and a guess sends it to somebody else's server.

**One row per deployment, not per school.** A university with separate
Brightspace orgs for its schools is the ordinary case, and the deployment id is
the only thing in a launch that tells them apart. Registering one and expecting
it to serve both is how a launch from the medical school lands in the law
school's data — the tool refuses it, but it refuses it as `wrong-deployment`,
which is a confusing thing to debug if you did not know the row was missing.

Both URLs are `https` by a check constraint rather than by convention: they are
the two addresses this function redirects a student to and fetches keys from.

### One setting it needs

    SEMESTER_APP_URL = https://harrisonjrubin7-cmyk.github.io/semester/

Set it under Edge Functions → Secrets. There is deliberately **no default**:
this is the address a student's browser is sent to carrying a one-use session
token, so a wrong guess is not a broken link, it is a token handed to whatever
is at the address we assumed. Without it the function refuses the launch and
says which setting is missing.

### What a launch does

A first launch **makes an account**, keyed on the issuer and the platform's
subject for that person, and signs them in. A professor switches the tool on
and two hundred students click it that week; every one asked to go and sign up
first is one who does not come back.

Attaching an account a student **already had** is never automatic. Nothing in
this function reads the token's email claim to find an existing account — an
email claim is a string a registered platform sends us, and matching on it
hands an account to whoever can get one registration row wrong. Instead the
launch issues a ticket, and `adopt_lti_identity` spends it only alongside a
session the student proved. Two proofs, held by no single party.

`_shared/ltiaccount.ts` makes that structural: a provisioned account's address
is synthesised on `lti.invalid`, a domain that cannot receive mail, so there is
no account for an email match to find even if somebody later writes one.

**The invite gate is not bypassed.** While it is on, the function puts the
synthesised address on `public.invites` before creating the account — which is
the honest reading of what happened, since a school's administrator installing
this tool is an invitation issued by exactly the person the gate exists to let
issue them. It leaves a row saying so.

All three LTI directions are built now — launch, deep linking, grade
passback — and the two that sign do so with the key described above. There is
still no key material in any migration: the key was always going to live as a
function secret, and both things that needed it arrived without changing that.

## `trust-room`

The procurement room's file server. A reviewer at a university posts the link
token the account team minted (`trust_room_grant`) and gets back either the list
of what their grant covers or a one-minute signed URL for one document in the
private `trust-packet` bucket. The rules are in `_shared/trustroom.ts` and its
test; the database gate is `trust_room_open` in
`migrations/20260928100000_trust_room.sql`.

**`verify_jwt` is off** because the caller has no Semester account and no JWT.
The link token is the credential, and it is checked where it matters: the
function calls `trust_room_open` with the service key, and that function
returns nothing for a wrong, revoked or expired token, for a document the grant
does not cover, or while `kill.sharing` is engaged. The HTTP answer is the same
404 in every one of those cases.

**It is inert until someone uses it on purpose.** It is deployed, and it
refuses every request until a trust officer publishes a document version and
the account team mints a grant. There is nothing to switch off first.

**One setting it reads:** `ALLOWED_ORIGIN`, the same comma-separated list the
other functions read (see `_shared/cors.ts`). The reviewer's page is the only
browser that calls it.

**Live since #817's merge.** It went up with a `pending` row in
`functions.snapshot`, because there is no reading of a function before the
merge that deploys it. Read off the project at 00:49 UTC on 28 September, it
was v7 on a platform path, and that reading replaced the pending row.

**Not built yet:** the page a reviewer opens. It should read the token from the
URL fragment (never the query string, which servers log) and post it here.

## `delete-account`

The Privacy page's **Delete my account**. A signed-in student posts
`{"confirm": "DELETE"}` with their own access token; the function finds the
account from the token (never from the body), calls
`public.erase_account(uuid)` with the service key — every row naming the
account, in one transaction, by each foreign key's own `on delete` rule — and
then deletes the auth user through the Admin API. The order and every answer
are in `_shared/deleteaccount.ts` and its test; the SQL half is
`migrations/20260929010000_account_erasure_and_export.sql`, proved by
`deletion.check.sql`.

**`verify_jwt` is off** for the reason it is off for `claude`: the function
checks the token itself, and the platform check would reject the CORS
preflight.

**One setting it reads:** `ALLOWED_ORIGIN`, the same list as the others. It
needs no secret of its own; the service credentials are injected.

**Its answers carry `erased` and `signInRemoved`**, and the page reads those.
The one partial state — rows erased, the Admin API refusing the sign-in — says
so, and pressing the button again finishes it.

**Live since #906's merge.** It went up with a `pending` row in
`functions.snapshot`. Read off the project at 19:55 UTC on 29 September, it was
v62 on a platform path, and `public.erase_account(uuid)` was on the project;
that reading replaced the pending row. The migration has to be applied before
or with it: without
`erase_account`, the function answers that nothing was deleted, which is true.

**Known refusal:** a staff account that ever wrote a row in one of the four
immutable tenant history tables cannot be erased this way yet — the history
triggers refuse the clear its `on delete set null` asks for, the transaction
rolls back, and the student-facing answer is that nothing was deleted.

## Live on merge, off until configured: `billing-checkout`, `billing-webhook`, `billing-cancel`, `billing-portal`

The commercial core's four payment functions (`docs/COMMERCIAL-CORE.md`). The
rules are in `_shared/billingcheckout.ts`, `_shared/billingwebhook.ts`,
`_shared/billingcancel.ts` and `_shared/billingportal.ts`,
driven by `app/src/lib/billing/`; the database side is
`migrations/20260929080000_commercial_automation.sql` and
`commercial-automation.check.sql`.

**All four answer 503 until their secret is set**, so merging deploys
functions that charge nobody:

    STRIPE_SECRET_KEY       billing-checkout,  the secret API key (sk_live_… or sk_test_…)
                            billing-cancel, billing-portal
    STRIPE_WEBHOOK_SECRET   billing-webhook    the endpoint's signing secret (whsec_…)
    ALLOWED_ORIGIN          billing-checkout,  the app's origin(s), read strictly: unset or * allows nobody
                            billing-cancel, billing-portal
    CHECKOUT_RETURN_URL     billing-checkout,  where Stripe returns the student; required by billing-portal
                            billing-portal      so subpath deployments cannot fall back to the origin root
    STRIPE_PORTAL_CONFIGURATION_ID
                            billing-portal     active bpc_… configuration selected by the activation tool
    STRIPE_PRODUCT_TAX_CODE billing-checkout   owner/accountant-approved txcd_… software classification

**`verify_jwt` is off on all four.** Stripe has no Supabase token: the webhook's
credential is the `Stripe-Signature` HMAC over the raw body, checked before the
body is parsed, with a five-minute tolerance. The checkout and the cancel check the
caller's access token themselves after answering the CORS preflight, which
carries none. The cancel uses no service key: it reads the subscription and
calls `request_cancellation` *as the caller*, over the anon key, after telling
Stripe.
The portal also checks the caller's token itself and resolves the Stripe
customer only from that person's RLS-scoped individual billing account. It
creates a short-lived Stripe-hosted URL for invoice history and payment-method
management; the browser never supplies a customer id. The webhook sends no
CORS header at all and refuses anything with an `Origin`.

The webhook endpoint to register in Stripe (Developers → Webhooks) is
`https://<project-ref>.supabase.co/functions/v1/billing-webhook`, with
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
`invoice.finalization_failed`, `charge.refunded` and `charge.dispute.created`.

**Live since #942's merge**, and `billing-cancel` since #971's. Each went up
with a `pending` row in `functions.snapshot`, like trust-room did. The checkout
and the webhook read v22 on a platform path at 19:55 UTC on 29 September;
`billing-cancel` read v2 on a platform path at 21:27 UTC the same day; and
those readings replaced the pending rows.

**Two cron jobs come with them**, both in `scheduler.sql` and both active
because neither needs a secret or an endpoint: `commercial-dunning` hourly at
minute 23 (`public.run_dunning()`, which writes nothing until a payment has
failed) and `account-health` nightly at 05:41 UTC
(`public.compute_account_health()`). Neither is on the project until
`20260929080000_commercial_automation.sql` is applied and the two
`cron.schedule` statements are run; `health.sql` expects both.

**Applied.** Both migrations were on the project when #942 merged — the
GitHub integration applies main's migrations on merge, and the applied
functions were checked against the merged text (the one-open-checkout index,
the reuse in `begin_checkout`, the paid-invoice and restricted-case branches
of `apply_payment_event`). The two `cron.schedule` statements were then run
by hand. Read off `cron.job` at 02:51 UTC on 29 September 2026:

    account-health       41 5 * * *    active = true
    commercial-dunning   23 * * * *    active = true

`public.run_dunning()` was called once by hand at the same moment, exactly
as the job calls it, and answered `{"reminders": 0, "restricted": 0,
"final_notices": 0}`: correct on a project with no failed payment, not a
failure. `account-health` first runs at 05:41 UTC, and writes one snapshot
per institutional billing account — of which the project has none yet, so
the expected result of that run is no row, not a failed job; the first
snapshot follows the first signed order form. The catalog seeded as the
migration wrote it: nine plans, nine prices, thirteen `cta_routes`.

**A third job came with `billing-cancel`** (D-132):
`commercial-financial-retention`, monthly on the 2nd at 04:37 UTC
(`public.purge_financial_records()`, from
`20260929130000_financial_retention.sql`). It removes an individual
subscriber's finished payment records seven years after the end of the year
they were made, so nothing is eligible before 1 January 2034. Active, no
secret; like the other two, its `cron.schedule` statement is run by hand after
the migration is applied, and `health.sql` expects it.

**Applied.** #971's migration was on the project when it merged, and the
applied `purge_financial_records()` was checked against the merged text before
anything was scheduled: it keeps an invoice a payment event still references,
has no branch for an event it cannot attribute, and touches individual
accounts only. The `cron.schedule` statement was then run by hand. Read off
`cron.job` at 21:20 UTC on 29 September 2026:

    commercial-financial-retention   37 4 2 * *   active = true

It was not run by hand: it deletes, and nothing is eligible yet.

## Live on merge, and on from the first deploy: `lead-intake`

It no longer waits for a secret. The site's origins are built in and the
salt defaults to the service key, so forms from www.semester.website are
stored as soon as this is deployed. Only the owner's email is off until
`RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL` are set: until then leads collect
in the database with nobody told.

The company site's forms post here:
`POST https://<project-ref>.supabase.co/functions/v1/lead-intake`. The contract
is written out at the top of `_shared/leadintake.ts`; the database side is
`submit_site_lead`.

    SITE_ORIGINS        optional; origins to add, comma-separated. The site's own three
                        (www.semester.website, semester.website, the vercel.app address)
                        are built in as SITE_PRODUCTION_ORIGINS, so unset no longer means off
    RESEND_API_KEY      optional; with LEAD_NOTIFY_EMAIL, each lead is emailed to the owner
    LEAD_NOTIFY_EMAIL   optional; the owner's inbox. Configuration, never code
    LEAD_NOTIFY_FROM    optional; a verified Resend sender (default: Resend's onboarding sender)
    LEAD_IP_SALT        optional; the key the caller's IP is hashed with (default: the service key)

**`verify_jwt` is off**: a visitor has no Semester account. What protects it is
the strict origin list, a honeypot field, and a five-an-hour limit per salted
IP hash in the database. No IP address is stored, and nothing a visitor typed
is logged.

**Live since #942's merge.** Read off the project at 19:55 UTC on 29 September,
it was v22 on a platform path, and that reading replaced its pending row.

## Tables

`usage` (claude) and `push_devices` + `push_queue` (push) exist, with row-level
security on and own-row policies. The push tables were applied as the
`push_devices_and_queue` migration; the SQL is `push.sql` in this directory and
is idempotent, so re-running it is safe.

## Rate limits

Two layers, and only one of them is in this repository.

**The browser's direct writes** — class chat, reactions, both report queues,
feedback, help and mentor requests, community posts, communities and study
sessions, groups and their parts, listings, and form answers — are limited in
the database by `migrations/20260928230000_direct_rate_limits.sql`: a BEFORE
INSERT trigger on each of the fourteen tables, a per-account sliding window
(per form for signed-out answers), SQLSTATE 54000 and a sentence the app shows
as it stands. The limits and the reasoning for each are in that file's header;
`rate-limits.check.sql` is the suite. It reaches production the way every
migration does, on the schema deploy. To confirm it did:

    select tgrelid::regclass from pg_trigger where tgname = 'zz_rate_limit' order by 1;

Run against the project on 29 September 2026 through the database connector:
fourteen rows, the fourteen tables the migration names. The Auth endpoint
limits below are still unread.

should list fourteen tables. An account locked out by mistake is cleared with
the service role: `delete from private.direct_rate_limit where user_id = '…';`.

**The auth endpoints** — sign-up, sign-in, OTP and magic-link verification,
token refresh, the emails Auth sends — are limited by Supabase Auth, not by the
database, and `config.toml` deliberately says nothing about them (its header:
a setting written there silently overrides the dashboard on the next deploy).
They are set in the dashboard, in the Auth rate-limit settings, which in
`config.toml` terms are `[auth.rate_limit]`'s `email_sent`, `sms_sent`,
`token_refresh`, `token_verifications`, `sign_in_sign_ups` and
`anonymous_users`. **Nobody has yet read them off the production project and
recorded them here**; until someone does, the go-live line for rate limiting
stays open. Record the reading beside the date, as the scheduler section below
does, rather than the value somebody meant to set.

## The scheduler

`pg_cron` 1.6.4 and `pg_net` 0.20.4 are installed (migration
`push_scheduler_extensions`). A job named `push` exists on `*/15 * * * *`,
owned by `postgres` — the resolution the app queues reminders at; finer gains
nothing, because a reminder is not a stopwatch.

**The job is `active = false`.** It is parked rather than absent on purpose:
everything about it is proven except the one thing that is not set yet.
Leaving it running would fail every fifteen minutes and fill
`cron.job_run_details` with an error meaning nothing except "the deploy is half
finished".

The bearer token is read out of Vault at run time rather than baked into the
job body, so rotating it is one update to one row and the schedule is not
touched. The secret was generated inside the database — it has never been
through a chat window, a log, or a tool call.

This was checked by making the call by hand, exactly as the job would:

    503 "not configured"

which is `push`'s own first branch. pg_net reaches the function, the URL is
right, the Vault read works. Only `CRON_SECRET` is missing.

**Re-checked 22 September, 01:31 UTC, the same way: still `503 "not
configured"`.** `scheduler.sql` had been re-run on the project by then — the
`tombstones` job below is the evidence — and it leaves `push` parked on
purpose, because the one thing it cannot do is set a function secret. So the
scheduler is applied and the reminder chain is still one step short: step 2
under *Push notifications* below (`supabase secrets set CRON_SECRET=…`), and
then step 3 to unpark the job. Until then `cron.job_run_details` is empty for
`push`, which is what parked looks like and is correct.

### The hand-off sweep — written, not yet applied

`scheduler.sql` schedules a job `handoffs`, daily at `31 3 * * *`, calling `public.sweep_handoffs()`. It
marks hand-offs past their fifteen minutes expired and deletes those finished more than seven days ago. It is
active on apply, needs no secret and no endpoint, and does nothing until the onboarding migration
(`20261006000000`) has been applied, because the function does not exist before it. Applying the scheduler
before the migration fails on that job alone. Nothing here has been run against the live project.

### The tombstone sweep — on the project, measured 22 September

`scheduler.sql` now also schedules a second job, `tombstones`, weekly at
`17 4 * * 0`, calling `public.sweep_tombstones('90 days')`. It clears
soft-deleted rows from `notes`, `tasks`, `appointments`, `sittings` and
`courses` ninety days after the deletion. [`RETENTION.md`](../RETENTION.md)
carries the decision and what it costs — a device offline longer than ninety
days, still holding the row, syncs it back.

**Applied.** Read off `cron.job` at 01:31 UTC on 22 September 2026:

    push         */15 * * * *   active = false
    tombstones   17 4 * * 0     active = true

and `cron.job_run_details` empty for both — `tombstones` has not had a Sunday
yet, and `push` is parked. Nothing in this repository could apply it; a
schedule only exists once somebody runs the statement, and somebody did. If it
ever has to be re-created, re-running the whole of `scheduler.sql` is safe —
every statement in it is idempotent and `cron.schedule` replaces a job of the
same name — or run just this one:

    select cron.schedule(
      'tombstones',
      '17 4 * * 0',
      $job$select public.sweep_tombstones('90 days')$job$
    );

Unlike `push` it wants **no** `cron.alter_job`, because it is parked on
nothing: the function it calls already exists and needs no secret. Confirm it
landed active, and that both jobs are there:

    select jobname, schedule, active from cron.job order by jobname;

Expect `push` inactive on `*/15 * * * *` and `tombstones` active on
`17 4 * * 0`. Afterwards, the first run is very likely to delete nothing and
that is correct rather than a failure — the oldest migration here is dated
September 2026, so on a project this young no tombstone is ninety days old
yet. What it returns is the row count:

    select jobname, status, return_message, start_time
    from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'tombstones')
    order by start_time desc limit 5;

### Four more jobs — on the project, applied 27 September

`scheduler.sql` was re-applied in full at 19:56 UTC on 27 September 2026, as one transaction, so
`integration-sync` never existed unparked. Two of the four jobs it added had been in the file for days and
never applied; the other two came with the integration scheduler. Read off `cron.job` afterwards:

    ai-runtime-metadata             43 4 * * *           active = true
    institution-gateway-retention   11 * * * *           active = true
    integration-retention           29 3 * * *           active = true
    integration-sync                7,22,37,52 * * * *   active = false
    push                            */15 * * * *         active = false
    tombstones                      17 4 * * 0           active = true

- **`ai-runtime-metadata`** calls `private.sweep_ai_runtime_metadata()`. It removes expired AI runtime metadata
  after each school's retention window, and never touches source content.
- **`institution-gateway-retention`** calls `public.gateway_purge_journal()` hourly. `/health/ready` fails closed
  if it is missing or stalled.
- **`integration-retention`** calls `public.integration_retention_sweep()`. It visits only schools with an
  integration connection, and there are none yet, so it deletes and writes nothing until one exists.
- **`integration-sync`** is **parked**. Vault holds `integration_cron_secret`. The job now posts to the
  `integration-tick` Edge Function rather than a Vercel route. That function went up by hand at 2026-09-27T21:48:27Z, from its
  branch, before the merge that declares it: v1, on a runner path, `verify_jwt` off. Read from the project with pg_net
  before the token check existed, it answered 401 without a token and 503 with the Vault token, which is how it fails
  closed. #856's merge moved it to the platform (v2) and applied the token check; the runbook's test request then
  answered 200 with `outcome: ran` and every count zero, at 00:49 UTC on 28 September, because no adapter is registered. [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](../docs/INTEGRATION-OPERATOR-RUNBOOK.md) §4 has the test request
  and the one statement that unparks it.

`push` and `tombstones` came through unchanged, and `push_cron_secret` was not regenerated.

**28 September: `integration-sync` unparked.** The runbook's test request, sent from the project with pg_net,
answered 200 with `{"outcome":"ran","due":0,"ran":0,...}`; `cron.alter_job(..., active := true)` followed and
`cron.job` reads `active = true`. `scheduler.sql` now states it active, so a re-run keeps it on.

Re-running the whole file stays safe. Every statement is idempotent, and it parks `push` again (and keeps
`integration-sync` on), so re-run it only while `push` is meant to be parked. Otherwise run the one `cron.schedule` you need. To
watch the first runs:

    select j.jobname, d.status, d.return_message, d.start_time
    from cron.job_run_details d join cron.job j using (jobid)
    where j.jobname in ('institution-gateway-retention', 'ai-runtime-metadata', 'integration-retention')
    order by d.start_time desc limit 10;

### Three more, applied by somebody else on 28 September

Read off `cron.job` shortly before 03:00 UTC on 28 September 2026, the project held the six
jobs listed above and nothing else: `community-retention`, `escalation-delivery`
and `media-scan` had been in `scheduler.sql` for a day and never applied. Read
again at 03:02 UTC the same morning, all three were there, as jobs 9, 10 and 11,
owned by `postgres` — applied in between from outside this branch:

    community-retention             29 4 * * *           active = true
    escalation-delivery             */5 * * * *          active = false
    media-scan                      * * * * *            active = false

That is the state `scheduler.sql` asks for: the Community sweep runs, and the
two jobs whose functions are not deployed are parked. `escalation-delivery` is
unparked by `docs/CAMPUS-ESCALATION-POLICY.md` step 5 and `media-scan` by
`docs/COMMUNITY-MEDIA-SAFETY.md`, each only after its function is deployed.

### Six jobs the code expected and nothing scheduled — not applied yet

`app/src/lib/scheduler.test.ts` now fails when a sweep function in the
migrations has no job, and it found three that never had one. Three more come
with `migrations/20260929030000_retention_sweeps.sql`, which decides the
retention `RETENTION.md` had listed as missing. All six are **active** in the
file — none needs a secret or an endpoint:

    lti-nonce                       41 * * * *     public.sweep_lti_nonce()
    lti-link-ticket                 47 * * * *     public.sweep_lti_link_ticket()
    capture-expiry                  19 * * * *     private.expire_capture_assets()
    invite-retention                13 5 * * *     private.sweep_stale_invites()
    abandoned-signups               23 5 * * *     private.sweep_abandoned_signups()
    audit-retention                 33 5 * * *     private.sweep_audit_retention()

**None of these is on the project until the owner applies them**, and the last
three need the migration first. In order:

1. Deploy the schema so `20260929030000_retention_sweeps.sql` is applied (the
   usual migration path). Confirm the three functions exist:

       select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'
          and p.proname in ('sweep_stale_invites', 'sweep_abandoned_signups', 'sweep_audit_retention');

2. Apply the jobs. Re-running the whole of `scheduler.sql` is safe while
   `push`, `integration-sync`, `escalation-delivery` and `media-scan` are all
   meant to be parked (it parks them again); otherwise run only the six
   `cron.schedule` statements from its last two sections.

3. Check it landed: block 6 of `health.sql` should read `ok` on every active
   job and `parked` on the four parked ones, with no `MISSING` row.

4. After a day, the second query in that block shows each new job's runs. A
   first run of `invite-retention` removing one row is expected: on 28
   September the project held one invitation whose address has no account.

### The console audit chain's nightly job — applied 28 September 2026

`migrations/20260929100000_console_control_plane.sql` adds the operations
console's hash-chained audit archive, and `scheduler.sql` adds the one job that
keeps it honest. **Active** in the file; nothing to park and no secret:

    console-audit-integrity         23 3 * * *     private.console_audit_seal(); private.console_audit_verify()

It seals yesterday's manifest and re-verifies the whole chain, recording the
result where `public.console_audit_status()` reads it. Applied to the project
on 28 September 2026 (23:58Z), after the platform deploy of #933 had applied
both console migrations; `private.console_audit_verify()` was run once by
hand and recorded `ok` over an empty chain. Block 6 of `health.sql` expects
the job.

### The ledger chains' nightly job — not yet applied

`migrations/20260930110000_ledger_chains.sql` chains the academic-record and
student-account ledgers, and `migrations/20260930150000_ledger_chain_seals.sql`
signs a manifest of each day's links and adds the one job that seals and checks
them. **Active** in the file; nothing to park and no secret (the signing key is
generated inside the database by the migration and read by no API role):

    ledger-chain-integrity          27 3 * * *     private.ledger_chain_nightly()

It seals yesterday's links into an HMAC-signed manifest per ledger and school,
then walks every chain with the link check and the seal check, and records the
run in `private.ledger_chain_verification`. With no chains it verifies nothing
and says so. **Not applied to the project**: apply the migrations first, run
`select private.ledger_chain_nightly();` once by hand and expect `ok` over an
empty set, then schedule it. Block 6 of `health.sql` expects the job. The key is
never rotated by a redeploy; a rotation makes every earlier manifest
unverifiable and is a decision with a record.

## Security advisor

Nine of the ten findings are closed (migration
`harden_security_definer_helpers`). One is left and it is a dashboard toggle —
see below.

### What the revokes were not doing

`classmates.sql` ended each helper with `revoke all on function ... from
public`, which reads like it locks anon out. It never did. Supabase ships
default privileges granting EXECUTE on new functions in `public` to `anon`,
`authenticated` and `service_role`, so the grant to anon is *explicit* — and
revoking from the PUBLIC pseudo-role does not touch an explicit grant. The
revoke was aimed at the wrong grantee, so `/rest/v1/rpc/classmate`,
`/rpc/in_class` and `/rpc/verified_student` were callable by anyone holding
the publishable key for as long as they had existed.

`classmate` is the one that mattered: give it a user id and it answered
whether that person shares a class with you.

### What changed

- **`classmate`, `in_class`, `verified_student`** moved to a `private` schema.
  PostgREST publishes `public` and `graphql_public`, so the endpoints stopped
  existing. The seven RLS policies built on them followed automatically —
  a policy stores a function's OID, not its name, so not one was rewritten.
  Both roles keep EXECUTE on purpose: every one of those policies is `TO
  public`, so the expression is evaluated for anon too, and taking the
  privilege away would turn "you see nothing" into "the query errors".
- **`touch_updated_at`** had no `search_path` at all, so it resolved names
  against whatever the caller had set. Now `''`; its body calls only `now()`.
- **`touch_updated_at` and `rls_auto_enable`** lost their EXECUTE grants.
  Neither needs one: Postgres checks that privilege when a trigger is created,
  not each time it fires. This entry used to add that `rls_auto_enable` "is
  Supabase's own event-trigger function and is not defined anywhere in this
  repo, so only the live grant changed". The second half was true and the first
  half is why: Supabase's documentation offers the function and its `ensure_rls`
  trigger as a recipe to run yourself, under *Auto-enable RLS for new tables*,
  and somebody ran it here. `20260901000100_schema.sql` creates it now, so a
  rebuild gets the trigger and the revoke above has something to close.
- **`groups.sql`** got the same treatment ahead of time. It was not applied to
  the live project when this was written (it is now — `groups` is in the
  ledger and `private.group_room` exists, read 22 September), and it had no
  grants at all — so its three helpers would
  have inherited the same default EXECUTE and appeared as three more
  endpoints. `group_room` is the one worth noticing: it answers "which class
  is group X in" for any id, an enumeration away from a map of who studies
  what.

Checked after, not assumed: every policy still evaluates for both `anon` and
`authenticated` without erroring, and both trigger functions still fire — an
event trigger enabling RLS on a fresh table, and a row trigger moving
`updated_at`.

### Performance

Every WARN is closed too (migrations `rls_initplan_and_policy_overlap` and
`wrap_auth_uid_in_helpers`), leaving eight INFO notices.

- **`auth.uid()` re-evaluated per row**, in fourteen policies. Written bare,
  the planner treats it as a per-row expression and re-runs it for every row
  scanned; wrapped in `(select ...)` it becomes an InitPlan, evaluated once
  before the scan. `explain` on `enrollments` now shows
  `Filter: (((InitPlan 1).col1 = user_id) OR private.classmate(user_id))`.
- **Two permissive policies on the same SELECT**, on `enrollments` and on
  `profiles`. Each carried a `for all` policy beside a `for select` one, and
  permissive policies are ORed — so reading evaluated
  `(uid = user_id) OR (uid = user_id OR classmate(user_id))`, whose left side
  is contained in its right. The `for all` contributed nothing to reading and
  cost a second pass over every row, including a second call into `classmate`.
  Split into the three commands they were actually for.

Checked against the real account rather than an empty table: it still sees its
four enrolments, its profile and its state row; a different signed-in user and
an anonymous one see none of them.

The five unindexed foreign keys are now covered (migration
`index_foreign_keys`): `blocks(blocked)`, `messages(user_id)`, and the three
on `reports`. Each is the foreign key column alone — the read paths were
already covered by `blocks_pkey` on (user_id, blocked) and `messages_by_room`
on (term, code, created_at desc), and neither of those leads with a foreign
key column, so a composite would have duplicated one of them.

What an unindexed foreign key costs is not the insert. It lands on the
*parent*: deleting a row in `auth.users` has to prove nothing still references
it, and without an index that proof is a sequential scan of the child table.
Deleting one account would have scanned every message ever posted — and it is
the operation nobody notices is slow, because it only becomes slow once there
is data, and then it is a timeout in a delete-my-account path rather than a
page somebody complained about.

Checked with `enable_seqscan = off`, which asks the narrow question that
matters on an empty table: is there an index path for the lookup a foreign key
check performs? All five answered with a Bitmap Index Scan on the new index.

**The count did not go down.** It was eight INFO notices before and it is
eight now: the five unindexed-key notices became five unused-index ones,
because an index nothing has queried yet reads to the linter as an index
nothing needs. That is the trade, and it is worth making in this direction —
an unindexed foreign key is a latent timeout, while an unused index on an
empty table is the linter correctly observing that the feature has not shipped
to anybody yet. Revisit after the classmates feature has real traffic; if any
of these are still unused with messages in the table, they are genuinely dead
and can go.

The remaining three:

- **Two unused indexes on the push tables** (`push_devices_user`,
  `push_queue_due`), for the same reason: the scheduler is parked.
- **Auth connection strategy** is a fixed 10 rather than a percentage, and it
  is the lowest-value item on this list. The database allows 60 connections on
  this tier, so Auth's 10 is already about a sixth of them — a sane share. The
  finding is about what happens *later*: resize the instance to a tier with
  more connections and Auth stays pinned at 10 instead of scaling with it. It
  is a no-op until that day.

  It is an Auth setting rather than SQL, so it cannot be changed from a
  migration or from the MCP tools — same wall as leaked password protection.
  The advisor's own remediation link is
  <https://supabase.com/docs/guides/deployment/going-into-prod>; the dashboard
  path is not recorded here because supabase.com is not reachable from the
  environment these notes were written in, and a guessed menu path is worse
  than none.

### The one that is left

**Leaked password protection** is off. It is an Auth setting rather than
anything in SQL, so it cannot be changed from a migration or from the MCP
tools — it needs the dashboard, under Authentication → Sign In / Providers.

It is worth turning on rather than dismissing: this app signs people in with
`signInWithPassword` and registers them with `signUp`, so students are
choosing passwords here, and a password reused from a breached site is the
realistic way in. The check is against HaveIBeenPwned at sign-up and
password-change time.

## What is left, in order

Three things, and none of them can be done from a coding session: two need
secrets that must not pass through one, and the third needs a GitHub Actions
API path that agent proxies block.

### 1. The shared Claude key

    supabase secrets set ANTHROPIC_API_KEY=sk-ant-…

Set it in the dashboard or with the CLI — **never** in this repo, in a build
variable, or in a chat window. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are injected by the platform and need no action.

Setting it is not enough. The function first asks
[`_shared/provideractivation.ts`](functions/_shared/provideractivation.ts),
and answers 501 with *"The shared key is switched off until Semester's
agreements with its AI provider are in place"* until the owner's five
decisions are recorded with evidence and `SHARED_AI_PROVIDER=on` is set
([`docs/trust/SHARED-PROVIDER-ACTIVATION.md`](../docs/trust/SHARED-PROVIDER-ACTIVATION.md)).
Once that clears, and until the key is set, the function returns 501 and the
app says so plainly: *"This deployment has no shared key. Add your own under
Ask Claude → Settings."* A
student with their own key is unaffected either way — the app prefers a key set
on the device and only falls back to this one.

Read on 29 September 2026 at 20:24:59 UTC: a signed-in call to the deployed
function answered exactly that 501. The secret is not set, and the kill-switch
drill and the red-team's proxy route (`docs/LAUNCH-DECISIONS.md` item 15) wait
on it; the red-team's direct route, with the raw key in the environment, does
not.

By 21:26 UTC the secret was set (an unsigned call answered 401, not 501), and
two signed-in calls still answered 502, "Claude could not be reached": the
`fetch` to Anthropic threw with nothing sent (0 tokens metered), and nothing in
the logs said why. The function now checks the key before anybody is
authenticated or counted. A key that cannot be sent as a header (the `…` of
the placeholder above, a quote mark, a break inside it) is refused with 503,
*"This deployment's shared key is set but cannot be used"*, and its shape is
logged without a character of it; a send that still throws is logged by its
kind, `header`, `network` or `other` (`functions/_shared/sharedkey.ts`). Look
for `claude:` in the function's logs.

That check answered at 22:43 UTC: 503, with the value's shape logged as 82
characters, not starting `sk-ant-`, five spaces or breaks and one character
outside ASCII — not a key. It was saved again, and at 22:51 UTC a signed-in call
answered 200. Both AI drills ran minutes later and held
(`docs/LAUNCH-DECISIONS.md` item 15, `docs/evidence/ai/`).

Optional: `MONTHLY_CALL_LIMIT` (default 60 calls per account per month),
`ALLOWED_ORIGIN` (extra https origins; the Pages origin is built in) and
`CORS_ALLOW_DEV` (unset on the live project).

**CORS fails closed (since 29 September 2026).** There is no `*` any more.
`https://harrisonjrubin7-cmyk.github.io` is built into
`supabase/functions/_shared/cors.ts`, so an unset or wrong secret can no longer
take the deployed site out. `ALLOWED_ORIGIN` only *adds* exact `https://`
origins; `*`, paths and plain http entries are ignored. An origin that is not
allowed gets no `Access-Control-Allow-Origin` header at all. Localhost is
answered only when `CORS_ALLOW_DEV=1` — set that for a local
`supabase functions serve`, never on the live project.

**`ALLOWED_ORIGIN` is a comma-separated list, and setting it to one origin is
how this was broken for weeks.** It is read by `claude`, `fetchcal` and
`canvas` alike, so a wrong value takes out the shared key, the calendar-link
reader and the Canvas sync together. On 21 September 2026 it was found set to a
**localhost** address on the live project: all three were unreachable from the
deployed site while the functions were ACTIVE, the deployed code matched this
repository byte for byte, and every check was green.

It hides because a CORS refusal cannot be seen from either end. The browser
rejects the response before the page sees it, so the app can only say *"could
not reach"* — the same sentence it prints for a dead host — and the function's
own side shows a request that arrived and was answered. Nothing logs it.

So list every *other* https origin that must work (a second deployment, a
custom domain); the Pages origin needs no entry:

    supabase secrets set ALLOWED_ORIGIN=https://semester.example.edu

The header echoes back whichever entry the request came from. A `localhost`
entry here does nothing on the live project: local development sets
`CORS_ALLOW_DEV=1` in its own `supabase/functions/.env` instead. No trailing slashes — though
`supabase/functions/_shared/cors.ts` trims them, because the address bar adds
one and that is the mistake this is most likely to meet. After changing it,
press **Check the shared key works** on Settings → The assistant from the
deployed site; that is the one place the answer is real.

### 2. Reminder keys

The VAPID pair has to be generated where you can keep the private half:

    npx web-push generate-vapid-keys        # once; keep both halves

Then, on Supabase:

    supabase secrets set VAPID_PUBLIC_KEY=…
    supabase secrets set VAPID_PRIVATE_KEY=…
    supabase secrets set VAPID_SUBJECT=mailto:you@example.com

And `CRON_SECRET`, which already exists — read it out of Vault in the SQL
editor and paste it in:

    select decrypted_secret from vault.decrypted_secrets
    where name = 'push_cron_secret';

    supabase secrets set CRON_SECRET=<that value>

It must match exactly. The job sends it as a bearer token and `push` compares
the whole string; a trailing newline from a careless copy is a 401 every
fifteen minutes.

The **public** half of the VAPID pair also has to reach the browser, or the app
cannot subscribe a device at all: set `VITE_VAPID_PUBLIC_KEY` as a repository
variable and rebuild. The Pages workflow already reads it and says so in the
build log either way. The private half never leaves Supabase.

### 3. Turn the job on

Only after `CRON_SECRET` is set, or it will 503 every fifteen minutes:

    select cron.alter_job(
      (select jobid from cron.job where jobname = 'push'),
      active := true
    );

`update cron.job set active = true` does not work — the table is not writable
directly, even as `postgres`. `cron.alter_job` is the supported path.

## Checking it worked

The app is the honest test, because it is the only caller.

- **claude** — sign in, open the assistant, ask something. Under Ask Claude the
  route line should read *the shared key*. A 501 means step 1 is not done; a
  429 means that account has spent its month.
- **push** — turn reminders on under Me → Alerts, which writes a row to
  `push_devices`. A row appearing in `push_queue` and disappearing within
  fifteen minutes means the whole chain works.

To watch the scheduler directly:

    select status, return_message, start_time
    from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'push')
    order by start_time desc limit 10;

    select id, status_code, left(content, 200), created
    from net._http_response order by id desc limit 10;

A `status_code` of 200 is the whole chain working. 503 means a secret is
missing on the function; 401 means `CRON_SECRET` does not match what is in
Vault.

## Rotating the cron secret

One row, and the schedule is untouched:

    select vault.update_secret(
      (select id from vault.secrets where name = 'push_cron_secret'),
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'push_cron_secret',
      null,
      null
    );

Then read it back with the query in step 2 and set `CRON_SECRET` to the new
value. Between those two the job gets 401s, so do them together.
