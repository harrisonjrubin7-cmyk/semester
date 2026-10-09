# When data has got out

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](SEMESTER-OPERATING-SYSTEM.md).

What to do when somebody can read rows that are not theirs, who does it, in
what order, how a problem is reported from outside, and how fast each severity
is answered. Written because the pre-pilot checklist asks for a *formal*
incident-response process and what this project had instead was a sentence —
that the owner would tell people the same day — which is a commitment about the
one step that comes last.

This is [`ROLLBACK.md`](ROLLBACK.md)'s sibling and not a copy of it. That
document is for a deploy that made the app worse; **this one is for a deploy,
a policy or a leaked key that made somebody else's coursework readable.** The
two overlap in exactly one place and it is named below.

Every mechanism here is checked by
[`app/src/lib/security.test.ts`](app/src/lib/security.test.ts), which fails
when the things this document depends on stop being true — most usefully when a
function starts reading a secret this document does not know how to rotate.

## The owner

**[@harrisonjrubin7-cmyk](https://github.com/harrisonjrubin7-cmyk)**, who owns
the repository, the Supabase project and the only mailbox
(`harrisonjrubin7@gmail.com`) a student is given to write to.

That mailbox is the owner's personal address and is the one contact for
security reports, privacy questions and rights requests alike. No dedicated
address has been decided or published (**[COUNSEL REQUIRED]**, P-20, owner to
decide); the policy drafts and `security.txt` use this one until then, and
nothing here promises how fast it is read.

The same single point of failure [`ROLLBACK.md`](ROLLBACK.md) names, and it is
worse here: a rollback can wait an hour with no one harmed, and a live read of
other people's rows cannot. During a pilot there is nobody else to page, so the
commitments below are about **mechanism** — how long each step takes once
somebody starts — and not about how quickly somebody wakes up.

## Reporting a problem from outside

Anybody who finds a way to read rows that are not theirs, or a key that is
out, writes to **`harrisonjrubin7@gmail.com`** with *Security report* in the
subject. The same address is published in machine-readable form at
[`app/public/.well-known/security.txt`](app/public/.well-known/security.txt),
which the deployed app serves under its own base path
(`…/semester/.well-known/security.txt`) and whose `Policy` field points back
at this file. The format is RFC 9116's; the *discovery* is not yet, because
the app is a project site on a shared origin and the origin-root
`/.well-known/security.txt` that scanners start from is not this project's to
serve. Until the app is served from a domain the project controls, the URL is
found by a person on the site's `/security/` page rather than by a scanner.
It is the owner's own
address and not a company one, on purpose: [`D-110`](docs/DECISION-LOG.md)
rejected addresses at a domain the company does not own, because they would be
invented, and an invented security contact is worse than none. A dedicated
address arrives with the domain and replaces this one in three places — this
file, `security.txt`, and `app/src/site/config.ts` — and
[`app/src/lib/security.test.ts`](app/src/lib/security.test.ts) fails while any
of the three disagrees with the app's privacy page.

What a useful report says: which screen or endpoint, what was readable or
writable that should not have been, the account it was seen from, and the
steps to see it again. What is asked of a reporter: do not test against other
students' accounts, do not read more than proves the point, and give the owner
time to close the gate before saying anything in public. A report made in good
faith inside those rules is treated as a report and not as an incident about
the reporter. Formal safe-harbour wording is not written here, because it is
legal language and every other legal sentence in this file is flagged as
unverified; it waits on the same counsel as the clocks under *Telling people*.

`security.txt` carries an `Expires` date. It is renewed at each review of this
file, and the test above goes red the day it lapses, so a stale contact cannot
sit unnoticed.

## Severity, and the clock each is held to

One severity model, used for a report from outside, a Dependabot advisory and
a finding of the owner's own, so that a question about "how fast" has one
answer wherever it is asked. The four rows are the patch policy in
[`app/src/lib/supplychain.ts`](app/src/lib/supplychain.ts) (PATCH_POLICY),
which [`docs/SUPPLY-CHAIN.md`](docs/SUPPLY-CHAIN.md) renders, and
[`app/src/lib/security.test.ts`](app/src/lib/security.test.ts) holds this table
to that one — the day counts cannot drift apart without a test going red.

This is the scale for vulnerability reports and advisories only. Other scales
stay in their own lanes: `INCIDENT-RECOVERY-PLAYBOOK.md` (SEV1–4) for service
recovery, the trust incident runbook (P0/P1) for a suspected security incident,
and the Community runbook for its own queues. Where a privacy incident needs a
level, use the overlay in
[`docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md`](docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md)
§4, which maps to all of them and implies no notice duty.

| Severity | What it looks like here | First response | Fixed within | Escalate to |
| --- | --- | --- | ---: | --- |
| **Critical** | Another account's rows readable; a service-role or signing key out; an exploit in the wild against a package or Action this project ships | The same day: rotate, close the gate or roll back before anything else ships (the moves above) | 2 days | Owner; every affected account, per *Telling people* |
| **High** | An auth, tenancy or infrastructure flaw with a credible path to it, not yet shown to expose a row | A prioritised patch; a compensating control recorded if the patch waits | 14 days | Owner |
| **Medium** | Exploitable only under constrained conditions, or with limited impact | Scheduled by risk | 60 days | Owner |
| **Low** | Minimal impact, or only in a tool that never ships (`video/`, `pipeline/`) | Normal maintenance; the grouped Dependabot update is usually the fix | 180 days | Nobody |

The clock starts when the finding is **confirmed**, not when it is reported —
a report that turns out to be nothing has no clock, and one that turns out to
be critical starts at zero on the hour it is confirmed. Any suspected read of
another account's rows is critical until disproven, as
[`docs/market-readiness/INCIDENT_RESPONSE.md`](docs/market-readiness/INCIDENT_RESPONSE.md)
says of its SEV1; the asymmetry is deliberate and the same in both files.

Two honest limits. The day counts are **accepted internal targets**: the
founder, acting in the security seat, accepted them unchanged on 29 September
2026 (D-124); nobody has yet held a finding against them, and nothing here is a
commitment to a customer until a contract or
[`docs/trust/SLA.md`](docs/trust/SLA.md) says so — which is why the public site
still says that no response time is promised. And a target for *fixing* is not
a target for *acknowledging*: with one person reading the mailbox, the honest
acknowledgement clock is "when the owner next reads mail", and this file does
not dress that up as a number. The 72-hour clock under *Telling people* is
about notice, not repair, and it is a target pending counsel, not a commitment:
no notice deadline has been approved (**[COUNSEL REQUIRED]**, P-02).

The row this closes in the HECVAT register is `VULN-1`
([`docs/market-readiness/HECVAT_READINESS.md`](docs/market-readiness/HECVAT_READINESS.md)),
as far as writing can close it: to *in progress*, with the record of findings
answered inside their clocks still to be produced.

## What counts

Three kinds, because the first move is different for each. Deciding which one
you have is the only diagnosis that must happen before acting.

| | What it looks like | First move |
| --- | --- | --- |
| **A key is out** | A secret in a screenshot, a commit, a chat window, a log line, a shared terminal | **Rotate**, below. Do not investigate first |
| **A policy is open** | A row-level-security check that lets one account read another's; `check.sh` red; a Supabase security advisor lint | **Close the gate**, then fix forward |
| **The app is wrong but nothing leaked** | A bad render, a lost feature, a broken deploy | Not this document — [`ROLLBACK.md`](ROLLBACK.md) |

The overlap: **a bad deploy that opened a policy is both.** Roll back the page
first because it is three minutes, then work this document, because rolling the
app back does not roll the schema back and a policy lives in the schema.

## Stop it before you understand it

Both of the first two moves are reversible and neither needs a deploy. Nothing
below requires knowing yet what happened.

### Rotate

Every secret this project holds, what holding it gets somebody, and how it is
taken away. The four in bold are the ones that are worth anything to a
stranger; the rest are configuration and appear here so that the list is
complete rather than a selection.

| Secret | Lives in | What it gets somebody | Revoked by |
| --- | --- | --- | --- |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Injected by Supabase into every function, and exported by hand for the two commands the app has no route for — writing `app_admins` (`app/scripts/grant-admin.ts`) and writing `public.schools` (`app/scripts/add-school.ts`), both in SETUP.md | **Everything.** It bypasses row-level security: every row of every table, for every account | Dashboard → Settings → API → roll the key. Functions pick the new one up on their next invocation; nothing is redeployed |
| **`AI_GATEWAY_API_KEY`** | Supabase function secret | The same Claude bill, routed through Vercel AI Gateway, at the monthly cap per account and no cap in total | Revoke under AI Gateway → API Keys in the Vercel dashboard, then `supabase secrets set AI_GATEWAY_API_KEY=…`. Unset, the function falls back to `ANTHROPIC_API_KEY` |
| **`ANTHROPIC_API_KEY`** | Supabase function secret | The project's Claude bill, at the monthly cap per account and no cap in total | Revoke at `console.anthropic.com`, then `supabase secrets set ANTHROPIC_API_KEY=…`. The app degrades to "add your own key" in between, which it already says |
| **`VAPID_PRIVATE_KEY`** | Supabase function secret | The ability to push a notification to any device subscribed to this project | `npx web-push generate-vapid-keys`, set both halves, and set `VITE_VAPID_PUBLIC_KEY` as a repository variable and rebuild. **Every existing subscription dies** — see below |
| **`LTI_PRIVATE_KEY`** | Supabase function secret | The ability to sign as this tool to any Brightspace that has registered it — to write a grade, or to answer a deep-linking request as us. Its public half is published at `…/lti/jwks` on purpose; the JWK in this secret contains that half **and** the private one | Generate a new RS256 JWK, `supabase secrets set LTI_PRIVATE_KEY=…`, and the JWKS endpoint serves the new public half within the hour it is cached for. Every platform picks it up on its next fetch, so unlike the VAPID rotation below nothing is lost — no launch depends on this key |
| **`CRON_SECRET`** | Supabase Vault and a function secret | The ability to make the sender run early. Not to read anything | Rotate in Vault and `supabase secrets set CRON_SECRET=…`, both, or the job 401s every fifteen minutes |
| **`STRIPE_SECRET_KEY`** (preferred) or **`STRIPE_API_KEY`** (legacy deployed name) | Function secret (`billing-checkout`, `billing-cancel`, `billing-portal`) | Charges, refunds and customers on Semester's Stripe account | Roll in Stripe → Developers → API keys, then set `STRIPE_SECRET_KEY` with `supabase secrets set`. The functions temporarily fall back to `STRIPE_API_KEY`; if neither is set, checkout answers 503. Remove the legacy name after the canonical key is installed and verified |
| **`STRIPE_WEBHOOK_SECRET`** | Function secret (`billing-webhook`) | The ability to forge a payment event | Roll the endpoint's signing secret in Stripe, then `supabase secrets set`. Unset, the webhook answers 503 |
| **`RESEND_API_KEY`** | Function secret (`lead-intake`, `support-reply-notify`) | Sending email as Semester's Resend account | Revoke at `resend.com/api-keys`, then `supabase secrets set` |
| `LEAD_IP_SALT` | Function secret, optional | Reversing a one-day rate-limit hash by guessing addresses | `supabase secrets set`; falls back to the service key |
| `SITE_ORIGINS`, `CHECKOUT_RETURN_URL`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_PRODUCT_TAX_CODE`, `BILLING_LIVE_ENABLED`, `LEAD_NOTIFY_EMAIL`, `LEAD_NOTIFY_FROM`, `SUPPORT_NOTIFY_ACTIVATED_AT`, `SUPPORT_NOTIFY_FROM`, `SUPPORT_RETURN_URL`, `SUPPORT_NOTIFY_VENDOR_APPROVED` | Function secrets | Nothing. Origins, return addresses, exact Stripe portal configuration, reviewed product classification, explicit billing and support-delivery gates, and notification routing | `SITE_ORIGINS` and `ALLOWED_ORIGIN` are read strictly. Billing refuses absent or invalid return, portal or `txcd_…` values. `BILLING_LIVE_ENABLED=false` closes checkout without removing credentials; `true` is necessary but cannot override the current code-level paid-acquisition hold. Support email requires literal `SUPPORT_NOTIFY_VENDOR_APPROVED=true` plus a valid UTC `SUPPORT_NOTIFY_ACTIVATED_AT`; absent or invalid values keep delivery parked, and the activation instant prevents older queued intents from being released later. `SUPPORT_NOTIFY_FROM` falls back to `LEAD_NOTIFY_FROM`; `SUPPORT_RETURN_URL` defaults only to the production GitHub Pages app. See `docs/COMMERCIAL-CORE.md` |
| `SUPABASE_URL` | Injected | Nothing. It is in the JavaScript every visitor downloads | — |
| `SUPABASE_ANON_KEY` | Injected | Nothing beyond a visitor's reach: the publishable key the app ships. `billing-cancel` pairs it with the caller's own token, so row-level security decides what it reads | — |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Function secrets | Nothing. The public half is compiled into the page on purpose | — |
| **`SEMESTER_APP_URL`** | Function secret | Where a validated Brightspace launch sends the student's browser, carrying a one-use session token. Not a credential itself, but a wrong value hands that token to whatever is at the address — so it is treated as one | `supabase secrets set SEMESTER_APP_URL=…`. The `lti` function has **no default** and refuses a launch while it is unset, which is the intended behaviour: a guess here is worse than an outage |
| `PRODUCTIVITY_SOURCE_HOSTS` | Function configuration | Approved public source destinations outside .edu; no credential | Remove host entries with `supabase secrets set` to revoke future checks. Exact hostnames only; public DNS, HTTPS and bounded-read checks remain mandatory |
| `ALLOWED_ORIGIN`, `MONTHLY_CALL_LIMIT` | Function secrets | Nothing. Limits, not credentials | `ALLOWED_ORIGIN` is a comma-separated list of extra https origins; the Pages origin is built in, `*` is ignored, an unlisted origin gets no CORS header, and localhost is answered only with `CORS_ALLOW_DEV=1` (never set on the live project). See `supabase/DEPLOY.md` |

Two more that are not environment variables and are easy to forget:

- **A calendar token.** 24 random bytes in a URL, and whoever holds the URL
  reads that student's deadline titles, dates and course codes until it is
  replaced. It is the one credential in this project **a student can rotate
  themselves** — *replace this link*, on the Export screen — and the one the
  owner cannot rotate on their behalf without taking the feed away.
  [`supabase/CALENDAR-REVIEW.md`](supabase/CALENDAR-REVIEW.md) draws that blast
  radius: a leaked link leaks a timetable, not an identity.
- **A student's own Anthropic key**, if they set one. It never leaves their
  device — not in the database, not in the sync, not in a log — so it cannot
  leak from here. Said in the table so that nobody spends an hour of an
  incident looking for where it is stored.

**The service-role key is the only one whose leak is an incident about other
people's data.** The other three cost money, noise or a feature.

### Close the gate

One statement, in the SQL editor, and no new account can be created while you
work:

```sql
select public.set_invite_only(true);
```

It does not touch anybody already signed in and it is undone the same way with
`false`. Use it when you do not yet know whether the way in is still open;
[`supabase/migrations/20260921002428_invites.sql`](supabase/migrations/20260921002428_invites.sql)
is the whole of it, and `invites.check.sql` is what proves a signed-out visitor
cannot call it.

**What there is no lever for, and you should know before reaching for one:**
signing every session out. Supabase can invalidate refresh tokens from the
dashboard, but nothing in this repository does it and it has never been
exercised here, so it is not written down as a step with a time attached. If an
incident needs it, it is dashboard work done for the first time under pressure
— which is a reason to try it once on a spare account before a pilot rather
than a reason to leave it out of this list.

## Then find out what happened, with what there is

Being honest about the records first, because the temptation during an hour
like this is to describe what you wish you could see:

- **Supabase keeps a month of logs.** Function invocations, Postgres statements
  and auth events. That is where a reconstruction starts and it is the only
  place the *content* of a request from outside is recorded at all.
- **`public.access_log` holds ninety days of the two reads that go around
  row-level security** — a calendar feed served by token, and the reminder
  sender — as one row per account per day per kind of client. It is coarse on
  purpose and it is the only record here that outlives the platform's month.
  What it is good for during an incident is the question "was anything
  fetching this student's feed that was not their calendar app", which the
  platform logs cannot answer because they do not know whose feed it was. What
  it cannot tell you is who, from where, or with which link:
  [`app/src/lib/clientfamily.ts`](app/src/lib/clientfamily.ts) is the whole
  vocabulary, and `access_log`'s check constraint is what stops a later
  function widening it.
- **No function in this project prints a token, a URL or a body.** That is
  deliberate and it is the right trade — a token in a log is a password in a
  log — and it means the logs can tell you that a calendar feed was fetched
  four thousand times and cannot tell you which feed.
- **The app records nothing about anybody else.** Screen counts are a number
  per screen in the student's own browser storage, and
  [`app/src/lib/privacy.ts`](app/src/lib/privacy.ts) says so on the page.
- **Beyond ninety days there is nothing, and beyond a month there is almost
  nothing.** A leak discovered in February about a
  key that went out in November cannot be scoped from records. Say that rather
  than implying a bound nobody can stand behind.

## Telling people

The part the old commitment was about, and the part that has to survive the
owner wanting it to be smaller than it was.

**Target, pending counsel (P-02), not a commitment — [COUNSEL REQUIRED].** The
aim is: Within 72 hours of confirming that rows were readable by somebody they do not
belong to, every affected account is emailed — addresses are in `auth.users`
and reachable from the dashboard, so the mechanism is a query and a mail merge
rather than a project. Seventy-two hours is the working target because it is the
tightest clock any of the regimes below is believed to set (not verified), and one clock is easier to keep
than three. No notice deadline has been approved, and nothing here promises
one to a customer or a user.

What the mail says, in this order: **what was readable, for how long, whether
it was read, and what the person should do.** "Whether it was read" is usually
*we cannot tell*, and writing that is not a failure — an incident note that
implies certainty it does not have is the thing a pilot does not recover from.
If the answer is *we cannot tell*, the mail says which records were checked and
how far back they go.

**Nothing waits on the fix.** Notice is not a press release issued once
everything is tidy; it is the thing that lets somebody change a password they
reused, and it is worth less every hour.

> **The one part of this document nobody here verified.** A pilot with real
> students may sit under Tennessee's breach-notification statute
> (Tenn. Code Ann. § 47-18-2107), under GDPR's 72-hour duty if any user is in
> the EU, and under whatever a university agreement adds — and FERPA reaches
> this app only if a school ever hands it records, which none has. Those are
> named so the question is not forgotten, **not** because they were checked:
> every other number in this repository is measured and these are not. Before a
> pilot signs, a lawyer confirms which apply and this section is rewritten with
> what they say.

## Then

Say what happened in [`CHANGELOG.md`](CHANGELOG.md), the same as a rollback,
and for a stronger version of the same reason: a tester who hears about an
incident from somewhere other than the people who had the data stops being a
tester. If a mitigation is permanent — a policy tightened, a key rotated on a
schedule, a lever added — it belongs in the schema or in this file, and a fix
that lives only in the memory of the hour it happened is not a fix.

## What this document cannot do

It cannot make somebody be awake, it cannot reconstruct a month it has no logs
for, and it cannot tell you that an incident has started. Nothing here watches:
every path above begins with a person noticing. The checks that run on their
own — `supabase/check.sh` on every CI run, and the Supabase security advisors —
are what stand in for that, and they see a policy that is wrong, never a key
that is out.
