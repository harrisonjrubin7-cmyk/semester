# Running your own copy

The app works with none of this. Clone it, `npm run dev`, and everything —
courses, study modes, calendar, notes — runs against the browser's own storage
with no account and no server.

What the setup below adds is **accounts**: the same semester on your phone and
your laptop, and a shared Claude key so a new user can upload a syllabus without
first going and getting a key of their own.

Twenty minutes, no cost at the sizes a class of students would reach.

---

## 1 · The app itself

```bash
git clone https://github.com/<you>/semester
cd semester/app
npm install
npm run dev            # http://localhost:5173
```

### The assistant, on your own machine

Everything except the assistant works with nothing further. To have Claude
answer — study cards from a reading, a syllabus turned into deadlines, the Ask
tab — put a key from [console.anthropic.com](https://console.anthropic.com) →
**API keys** in `app/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-…
```

Restart `npm run dev` and the app answers, with nothing to type into it: the
dev server holds the key and adds it to each call, and the page is told only
the address of that proxy (`/anthropic`), never the key. Settings → The
assistant says as much where the key box would otherwise sit empty and
unexplained.

Two things to be exact about, because both are ways a key gets away from you:

- **The name has no `VITE_` on the front, and that is the whole point.**
  Anything named `VITE_…` is compiled into the page and handed to everyone who
  loads the site. `ANTHROPIC_API_KEY` is read by the dev server and stays in
  that process.
- **`app/.env.local` is gitignored, and a key that has been pasted anywhere
  else is spent.** A key in a commit, a screenshot or a chat window should be
  rotated at console.anthropic.com rather than reasoned about.

This route is development only — `vite build` neither runs the proxy nor tells
the built page it exists. A deployed copy uses the Edge Function in step 3,
which does the same job with an account check and a monthly cap in front of it.
Somewhere else that holds a key — your own proxy in front of the Messages API —
goes in `VITE_CLAUDE_PROXY`, which is an address rather than a secret and so
does survive a build.

**The two boxes on that settings screen take different things.** The first
takes a key, beginning `sk-ant-`. The second takes the address of a proxy —
`https://…`, or a path like `/anthropic` for something served alongside the
page — and nothing else: a key, a workspace id or an account number pasted
there is ignored with a line saying so, and the key above answers instead.
Leave the second box empty unless you are running a proxy.

## 2 · Accounts and sync — Supabase

1. **Create a project** at [supabase.com](https://supabase.com). Any region;
   the free tier is enough.
2. **Create the tables.** SQL Editor → New query → paste
   [`supabase/migrations/20260901000100_schema.sql`](supabase/migrations/20260901000100_schema.sql) → Run. It is safe to run twice.

   That is the first of the files in
   [`supabase/migrations/`](supabase/migrations), which are the whole schema in
   the order it has to be applied. The sections below add the rest as each
   feature comes up, and you can equally paste all eight now, in filename
   order, and have everything at once — each is guarded, so running one twice
   changes nothing.

   Pasting is the manual route, and it is the one this guide describes because
   it needs nothing installed. A project with the GitHub integration connected
   (Project Settings → Integrations, **Working directory** `.`) can apply them
   on merge instead — see [`supabase/README.md`](supabase/README.md).
3. **Copy two values** from Project Settings → API into `app/.env.local`:

   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_KEY=<the publishable / anon key>
   ```

**The publishable key is meant to be public** — it is compiled into the page and
that is fine. Security comes from the row-level policies in the schema: every
table demands `auth.uid() = user_id`, so a signed-out visitor sees nothing and a
signed-in one sees only their own rows.

**The secret / service key must never appear in `.env.local`, in the repo, or in
a chat window.** It bypasses row-level security entirely. The app has no use for
it; only the Edge Function does, and Supabase gives the function its own copy.

**You can check sync without a second device.** SQL Editor → New query → paste
[`supabase/sync.check.sql`](supabase/sync.check.sql) → Run. It makes one
synthetic account with two devices and a stranger, and asserts the things that
matter when a person owns a phone and a laptop: that a push from one device
cannot delete a course imported on the other, that the upsert updates rather
than duplicates, that `updated_at` comes from the database and not from a
device with a wrong clock, and that another account can neither read your
semester nor write into it. Thirteen checks; a clean run prints
`ALL CHECKS PASSED`, and it rolls everything back. The merge itself happens on
the device and is covered by `app/src/lib/merge.test.ts`.

### Optional · Reminders with the app shut

The app can already put a notification on screen while it is open, which is the
one moment you did not need one. This is the other half, and it needs three
things beyond the tables above.

1. **Make a key pair,** once: `npx web-push generate-vapid-keys`.
2. **The public half** goes in `app/.env.local` as `VITE_VAPID_PUBLIC_KEY`, and
   into the deploy as a repository variable alongside the Supabase two. It is
   meant to be visible — it is what a browser signs its subscription against.
   Without it the switch under Me says so plainly rather than sitting there
   doing nothing.
3. **The private half never leaves the server.** `supabase secrets set
   VAPID_PRIVATE_KEY=…` and `VAPID_SUBJECT=mailto:you@example.com`. It is what
   authorises sending to your subscribers, so it belongs in the function's
   secrets and nowhere else — not in `.env.local`, not in a build variable, not
   in the repo.

Then the table and the sender: SQL Editor → paste
[`supabase/migrations/20260901000600_push.sql`](supabase/migrations/20260901000600_push.sql) → Run, then `supabase functions deploy
push --no-verify-jwt` and the `cron.schedule` call in the header of
[`supabase/functions/push/index.ts`](supabase/functions/push/index.ts).
`--no-verify-jwt` is right for this one and wrong for the Claude function: the
scheduler calls it, not a browser, and it authenticates with its own
`CRON_SECRET`. Without that secret set it refuses every request, so a
half-finished deploy is closed rather than open.

**The server does no arithmetic.** The app works out what is worth saying and
queues a week of "a time and two strings"; the function delivers them and knows
nothing about semesters. A server that computed due dates would keep a second
copy of the rules and drift from the app within a term, and the drift would
show up as a reminder about a deadline that had moved. The queue is rebuilt
whenever the app is opened and more than twelve hours have passed — without
that it emptied after seven days while the switch still said "on".

### Optional · Classmates

Rooms per class, for people with a confirmed university address. SQL Editor →
New query → paste [`supabase/migrations/20260901000200_classmates.sql`](supabase/migrations/20260901000200_classmates.sql) → Run,
after `schema.sql`. Safe to run twice. Skip it and the Classmates screen says
the tables are not set up; nothing else is affected.

Three things about it are worth knowing before you turn it on, and the app says
all three on screen:

- **A confirmed `@vanderbilt.edu` address proves an address, not an enrolment.**
  Nothing can read the registrar, so a room is people who *say* they are in that
  class. Change the domain in `classmates.sql` (`verified_student()`) and in
  `app/src/lib/classmates.ts` (`DOMAIN`) to run this for another university.
- **Blocking is enforced by the database**, not the interface, so a blocked
  person's messages never reach the other device.
- **You can check the rules without a second person.** SQL Editor → New query →
  paste [`supabase/classmates.check.sql`](supabase/classmates.check.sql) → Run.
  It creates four synthetic accounts, walks them through joining, posting,
  blocking, reporting and leaving, asserts what each is allowed to see, and
  rolls everything back — so it leaves nothing behind and is safe against a
  project with real data in it. Twenty-two checks; a clean run prints
  `ALL CHECKS PASSED`. What it cannot cover is realtime delivery, which is a
  websocket rather than a policy and still wants one real second device.

### Optional · Reactions, and who is in the room

The class chat works on `classmates.sql` alone. Two things in it need one more
file: the faces under a message, and the dot beside somebody who has the room
open. SQL Editor → New query → paste [`supabase/migrations/20260901000400_rooms.sql`](supabase/migrations/20260901000400_rooms.sql)
→ Run, after `classmates.sql`. Safe to run twice.

Both fail to nothing rather than to an error. Without the table the room draws
the conversation and no reactions, and the first tap on a face says which file
to run. Without the presence policies the live channel is refused and the room
shows no dots — which costs an ornament, not the conversation.

The presence half is the only place in this project that writes a policy on
`realtime.messages`. A channel with no authorization is joinable by anything
holding the publishable key, so presence on one would publish which accounts
are online in which class to anybody who guessed the topic. The policy puts
that channel behind the same two questions as every table here: are you
verified, and are you in this class.

### Optional · Group work

A shared checklist for a group project, inside a class room. SQL Editor → New
query → paste [`supabase/migrations/20260901000500_groups.sql`](supabase/migrations/20260901000500_groups.sql) → Run, after
`classmates.sql`. Safe to run twice.

A group is visible to its whole class so somebody can find theirs and join it;
its list of parts needs membership. Any member may claim a part, tick one or
fix a title — group work does not survive a permission model where only the
author of a line may correct it — and nobody may remove anybody from a group
but themselves. You can check all of that without four people: paste
[`supabase/groups.check.sql`](supabase/groups.check.sql) and run it. Fifteen
checks, four synthetic accounts, rolled back at the end.

- **Reports are stored and nobody is watching them.** They land in
  `public.reports`, which no client can read — you read it in the dashboard.
  If you run this for other people, that is your job, and the app deliberately
  does not imply somebody else is doing it.

Turn on email confirmation (Authentication → Providers → Email → *Confirm
email*) or the domain check is the only gate and an unconfirmed address passes
it.

### Optional · Calls

Nothing to run. A call's offers and answers ride on a Supabase **broadcast**
channel, which needs no table and no policy — the video does not go through it,
or through any server: it goes straight between the browsers in the call.

What a build with no Supabase project gets is the green room and nothing else:
the camera, the microphone, the pickers and the level meter work, and the
screen says plainly that nobody else can join, because two browsers cannot
introduce themselves without something in the middle to carry the introduction.

### A relay for calls

Two browsers find each other with **STUN**, which is one packet, is free, and
which Google runs — that is the default and there is nothing to configure.
Roughly one network in ten will not carry a direct connection anyway, and a
locked-down campus or hotel network rather more often than that. Those need
**TURN**, which relays the media and therefore costs somebody bandwidth. There
is no free one, so none is configured:

```
VITE_TURN_URL=turns:turn.example.com:5349
VITE_TURN_USER=<username>
VITE_TURN_PASS=<credential>
```

`VITE_STUN_URLS` overrides the default STUN server, comma-separated, if you
would rather not use Google's.

Both the lobby and the green room say which of the two you have, in those
words, rather than showing a spinner on a call that is never going to connect.

### Tell Supabase where the app lives

Authentication → URL Configuration:

- **Site URL**: the deployed address, e.g.
  `https://<you>.github.io/semester/`
- **Redirect URLs**: add both that address and `http://localhost:5173/` (and
  `http://localhost:5199/` if you use that port).

Skip this and sign-up appears to work, but the confirmation email's link sends
people to `localhost:3000` — Supabase's default — and the account never
finishes. It is the most common thing to miss.

Email confirmation is on by default. To let a new account sign in immediately
while you are testing, Authentication → Providers → Email → turn off *Confirm
email*.

That setting decides what the first run does, because the fourth of its five
screens is where an account is made: with *Confirm email* on, somebody is told
to check their inbox and the run waits there with the sign-in form; with it
off, the account is live and the run moves itself on. Either way the screen is
skippable and the app works signed out — an account only decides whether the
semester follows somebody to a second device.

### Google, Microsoft and Apple sign-in (optional)

Authentication → Providers, switch on what you want, and paste each provider's
client id and secret. Email and password work immediately and are never
switched off, because some universities block third-party sign-in outright and
being locked out of the only option is not a good enough reason to be locked
out of the app.

**Microsoft is `azure`, and it is the one that is usually set up wrong.** The
registration must accept *accounts in any organizational directory and personal
Microsoft accounts* — with the default single-tenant setting, a student at any
other university, and anyone with an outlook.com address, is locked out with an
error from Microsoft rather than from here.

The app asks the project which of the three are on — GoTrue answers it at
`/auth/v1/settings` — and draws a button only for those. So a project with
nothing switched on offers the password form and says so, rather than three
buttons that spend a round trip and come back with "Unsupported provider", and
switching one on in the dashboard makes its button appear with nothing to
deploy. Nothing here checks which university an address belongs to; any Google,
Microsoft or Apple account is valid.

### Optional · Making an administrator

`public.app_admins` decides who may open the report queue at `#/moderation`
(below), and any internal screen added later.
It has row-level security on and **no policy at all**, so no account can read
it, write it, or take itself off it — including the administrator it names.
That is deliberate: an account that can make itself an administrator is one,
and there is no in-app route into this table by design.

So the only way in is a terminal and a key the app does not have:

```bash
cd app
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service key>     # Settings → API

node scripts/grant-admin.ts list
node scripts/grant-admin.ts grant ada@vanderbilt.edu "founder"
node scripts/grant-admin.ts revoke ada@vanderbilt.edu
```

They have to have signed up in the app first — the script never creates an
account, it only finds one.

#### Where an administrator actually goes

**`#/moderation`**, in the app, signed in as the account that was granted.

It is the report queue: every report a student has filed from a classmate
room, what the message said, and the four transitions —
`open · under_review · resolved · dismissed`. Reports have been collected
since 1 September and were unreadable by anybody until
`20260921214500_report_status.sql`; that migration opened the table to
`private.is_app_admin()` and this screen is what opens it.

**It is not in the app's directory and it is not meant to be.** Being an
administrator is not a fact the browser is allowed to know — `app_admins` has
no select policy, which is exactly what makes the queue's policy
un-spoofable — so there is no honest way to offer the screen to the right
people and nobody else. The address is the door, and this is where it is
written down.

Anyone may open it; the server is the gate. An account that is not an
administrator is sent the same query and gets no rows, which is the same
nothing it had before. **The screen says so**: an empty queue and an account
with no business there are identical from the device, so it states both rather
than telling somebody there are no reports when it cannot know that.

**This is the one place the service key belongs outside Supabase**, and the
paragraph above about not putting it anywhere else still holds everywhere
else. Export it for the one command and close the shell; do not put it in
`.env`, a script, or anything the app builds from. The script refuses a
publishable key rather than using it, because `app_admins` has no policy —
with the wrong key `list` returns an empty table and no error, which reads
exactly like "there are no administrators yet".

### Optional · Listing a university

`public.schools` is what `claim_school()` checks a student's confirmed address
against, and it starts empty. That is deliberate — seeding Vanderbilt would put
one university's name in the schema every other university has to live in — but
it means that until somebody lists a school, *no student can claim one*:
`claim_school()` refuses every call, because there is nothing to claim. The
screen that does the claiming is under **Account**, and until this runs it says
"No universities are set up on this server yet" and nothing else.

Writing the table is an administrator act for the same reason the admin list
is: `email_domains` is the whole of the check, so whoever can write it can
admit anyone. Same terminal, same key:

```bash
cd app
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service key>     # Settings → API

node scripts/add-school.ts list
node scripts/add-school.ts add vanderbilt "Vanderbilt University" Vanderbilt
node scripts/add-school.ts domains vanderbilt vanderbilt.edu
node scripts/add-school.ts remove vanderbilt
```

The id is the slug the app already builds room keys from — `vanderbilt/ECON
1020` — so it has to match the school profile's own id. It is not checked
against anything at write time; a mismatch is not an error, it is a school
whose rooms nobody finds.

**`add` cannot set a domain, and that is on purpose.** A school listed with no
domains admits nobody, which is the right state to be in while somebody works
out which addresses the university actually issues; `domains` is then a second
command whose only subject is who gets in. Running it with no domains at all
takes the school back to admitting nobody, without disturbing anyone who has
already claimed it.

**`remove` is refused while anybody is claiming the school.** `profiles.school_id`
is `on delete set null`, so removing the row would clear every one of those
claims with no error anywhere — students stay signed in and the server quietly
stops believing they are anywhere. The script counts first and tells you the
number.

## 3 · The shared Claude key (optional)

Without this, each user pastes their own API key under **Settings → The
assistant** and the app works fine. With it, a signed-in user can generate a
course with no key at all. This is the deployed counterpart of the dev server's
key above: same idea, same key never reaching a browser, with an account check
and a monthly cap added because this one is reachable from the internet.

**From the dashboard, no tooling required:**

1. **Edge Functions → Deploy a new function → via the editor.** Name it
   exactly `claude` — the app calls `/functions/v1/claude`.
2. Paste [`supabase/functions/claude/index.ts`](supabase/functions/claude/index.ts)
   in, replacing whatever the editor starts with, and deploy.
3. **Project Settings → Edge Functions → Secrets**: add `ANTHROPIC_API_KEY`
   (from console.anthropic.com), and optionally `MONTHLY_CALL_LIMIT`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase — do
not add them yourself, and do not put the service key anywhere else. The one
exceptions are `scripts/grant-admin.ts` and `scripts/add-school.ts`, which are
run by hand from a terminal and are described under *Making an administrator*
and *Listing a university* above; they are exceptions because `app_admins` and
writes to `public.schools` are unreachable by every key that is not this one.

**Or from a terminal:**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
supabase secrets set MONTHLY_CALL_LIMIT=60      # per account, optional
supabase functions deploy claude
```

The function verifies the caller's account, meters them in the `usage` table,
and streams Anthropic's reply straight back. The key never reaches a browser. A
generation costs a few cents, so 60 a month per account is generous for a
student and predictable for you.

## 4 · Deploying

The repo deploys itself to GitHub Pages on every push to `main`
(`.github/workflows/pages.yml`). One thing to set once:

- **Settings → Pages → Source: GitHub Actions.**

The two Supabase values come from **`app/.env.production`**, which is committed.
That is deliberate: both are public by design — the built JavaScript contains
them however they are supplied — so a build variable would hide nothing and only
add a step that can silently fail. A fork pointing at its own project sets
`VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` as repository variables, which win
over the file, or just edits the file.

The deploy prints a notice saying which of the two it used, so "accounts did not
turn on" is answerable from the run rather than by guessing.

### Forms other people can answer

A form built under **Create** can be published: the questions go to a row in
Supabase, the link is the whole of the credential, and anybody holding it
answers with no account and no app. The answers come back to the author and to
nobody else.

It needs the table, which is not applied by this repository — apply
`supabase/migrations/20260921143455_forms.sql` the same way as the rest (SQL
Editor → New query → paste → Run). Without it, publishing reports the error
Postgres gives and everything else about a form keeps working, because a form
still lives on the device that built it.

Two things it deliberately does not do. It does not know who answered: there is
no sign-in on the answering side, so an anonymous form here is not a *verified*
anonymous survey and must not be relied on as one. And it never publishes the
answer key — that stays in the author's own row, where no view and no grant
reaches it, and answers are marked on the author's device when they are
collected. `supabase/forms.check.sql` is where both are asserted rather than
described.

### Everything else this build can be given

`app/.env.local` configures a copy running on your machine. A deployed copy has
no such file, so the same settings go in as **repository variables** — Settings
→ Secrets and variables → Actions → Variables — under exactly the names
`app/.env.example` uses. A secret of the same name works too and is hidden in
the log; the variable wins if both are set.

| Variable | What the deployed app gains |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` | Accounts and cross-device sync |
| `VITE_VAPID_PUBLIC_KEY` | Reminders that arrive with the app shut |
| `VITE_UNIVERSITY_GATEWAY_URL` | The University screen reaches a school's gateway |
| `VITE_CLAUDE_PROXY` | The assistant answers without a student typing a key |
| `VITE_ICS_PROXY` | Pasted calendar links from Brightspace and Outlook are fetchable |
| `VITE_OAUTH_PROXY` | Zoom's token exchange, which sends no CORS headers |
| `VITE_MS_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ZOOM_CLIENT_ID`, `VITE_APPLE_CLIENT_ID` | Connect offers a sign-in rather than only the file route |
| `VITE_STUN_URLS`, `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_PASS` | Calls connect on networks that refuse a direct path |

None of it is required: without any of it the deployed app runs and says, on
each screen, what it cannot do. That is precisely why this list was three names
long for most of this repository's life — twelve of these settings were
documented, read by the app, and had no way into a deployed build, and nothing
went red, because a deployed copy with them missing looks exactly like one with
them deliberately switched off. `app/src/lib/deploy.test.ts` is the check that
now fails when the app reads a setting the deploy cannot supply.

Every value here is compiled into the page and handed to everyone who loads the
site — that is what `VITE_` means. A real secret never goes in one. The deploy
refuses an Anthropic key pasted into `VITE_CLAUDE_PROXY`, and refuses a
university gateway address the app itself would refuse — a plain `http://` one,
or one carrying a query string — because refused at deploy time it is a red run,
and refused in the browser it is a sentence a student reads after the deploy has
already gone out.

Pages serves a project site from `/<repo>/`, which the build handles: the
workflow passes `VITE_BASE` and nothing in the app reads a leading-slash path
directly. If you deploy somewhere that serves from the root, drop `VITE_BASE`
and it works unchanged.

### One deployment, one app

There is one thing to deploy and one address to open. There used to be two: a
separately-built three-page website — a front door, a second copy of the term
and a second copy of the study side — shipped under `<base>/web/` and linked
from the app's Connect screen. Three megabytes of generated bundles that could
not be edited in this repository, could not be tested, and drifted from the app
the day anything changed. It was a second version of the same product one tap
from the first, and it is gone.

What it was there for, the app already does. From 760px the tab bar unrolls
into a rail beside the reading column, so a laptop gets the wide layout by
opening the same address rather than a different page. On a phone, *Add to Home
Screen* installs it.

If you are looking for the old `webback` build step, `lib/web.ts`,
`lib/webback.ts`, `lib/webicons.ts` or the `semweb:*` storage keys: all removed
with the site they served. `npm run build` is now `tsc -b && vite build` and
nothing runs after it.


## 5 · The optional connectors

None of these are needed to use the app. Each is documented at length in
[`app/.env.example`](app/.env.example) — that file is the one to open, and it
has the scopes, the caveats and the exact console paths.

The Connect screen says only that a sign-in is not switched on, and offers the
file route instead. It used to print the registration instructions themselves,
which meant a student read a path through Azure and a filename in this
repository; the audience for that is you, and it is here and in `.env.example`.
`app/src/screens/rendered-words.test.ts` keeps it that way.

| What | Register at | Into |
| --- | --- | --- |
| Brightspace, iCloud, any calendar | Nothing — paste the .ics or webcal link | — |
| Microsoft 365 | portal.azure.com → App registrations → single-page application | `VITE_MS_CLIENT_ID` |
| Google Calendar / Drive | console.cloud.google.com → Credentials → OAuth client → Web application | `VITE_GOOGLE_CLIENT_ID` |
| Zoom | marketplace.zoom.us → Develop → Build App → General App (PKCE) | `VITE_ZOOM_CLIENT_ID` |
| Sign in with Apple | developer.apple.com → Identifiers → Services ID (a paid account) | `VITE_APPLE_CLIENT_ID` |

The redirect URI is wherever the app is served from — `http://localhost:5199`
in development, your deployed origin otherwise. Zoom needs the proxy as well
(`VITE_OAUTH_PROXY`), because its API sends no CORS headers; Apple needs it to
sign the client secret, and refuses `http://localhost` as a redirect entirely.

## What a new user does

Nothing on this page. They open the site, make an account if they want their
work to follow them, and upload a syllabus. The app reads it in their browser,
asks Claude for the structure, checks what comes back — dates in range, quotes
actually present in the document — and shows them a preview before anything is
saved.
