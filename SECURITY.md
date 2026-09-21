# When data has got out

What to do when somebody can read rows that are not theirs, who does it, and in
what order. Written because the pre-pilot checklist asks for a *formal*
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

The same single point of failure [`ROLLBACK.md`](ROLLBACK.md) names, and it is
worse here: a rollback can wait an hour with no one harmed, and a live read of
other people's rows cannot. During a pilot there is nobody else to page, so the
commitments below are about **mechanism** — how long each step takes once
somebody starts — and not about how quickly somebody wakes up.

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
| **`SUPABASE_SERVICE_ROLE_KEY`** | Injected by Supabase into every function | **Everything.** It bypasses row-level security: every row of every table, for every account | Dashboard → Settings → API → roll the key. Functions pick the new one up on their next invocation; nothing is redeployed |
| **`ANTHROPIC_API_KEY`** | Supabase function secret | The project's Claude bill, at the monthly cap per account and no cap in total | Revoke at `console.anthropic.com`, then `supabase secrets set ANTHROPIC_API_KEY=…`. The app degrades to "add your own key" in between, which it already says |
| **`VAPID_PRIVATE_KEY`** | Supabase function secret | The ability to push a notification to any device subscribed to this project | `npx web-push generate-vapid-keys`, set both halves, and set `VITE_VAPID_PUBLIC_KEY` as a repository variable and rebuild. **Every existing subscription dies** — see below |
| **`CRON_SECRET`** | Supabase Vault and a function secret | The ability to make the sender run early. Not to read anything | Rotate in Vault and `supabase secrets set CRON_SECRET=…`, both, or the job 401s every fifteen minutes |
| `SUPABASE_URL` | Injected | Nothing. It is in the JavaScript every visitor downloads | — |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Function secrets | Nothing. The public half is compiled into the page on purpose | — |
| `ALLOWED_ORIGIN`, `MONTHLY_CALL_LIMIT` | Function secrets | Nothing. Limits, not credentials | `ALLOWED_ORIGIN` is a comma-separated allowlist read by three functions; one wrong value makes all three unreachable from the browser and says nothing. See `supabase/DEPLOY.md` |

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

**Within 72 hours of confirming that rows were readable by somebody they do not
belong to, every affected account is emailed** — addresses are in `auth.users`
and reachable from the dashboard, so the mechanism is a query and a mail merge
rather than a project. Seventy-two hours is the commitment because it is the
tightest clock any of the regimes below sets, and one clock is easier to keep
than three.

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
