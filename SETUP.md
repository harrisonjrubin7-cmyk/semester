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

## 2 · Accounts and sync — Supabase

1. **Create a project** at [supabase.com](https://supabase.com). Any region;
   the free tier is enough.
2. **Create the tables.** SQL Editor → New query → paste
   [`supabase/schema.sql`](supabase/schema.sql) → Run. It is safe to run twice.
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
[`supabase/push.sql`](supabase/push.sql) → Run, then `supabase functions deploy
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
New query → paste [`supabase/classmates.sql`](supabase/classmates.sql) → Run,
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

### Optional · Group work

A shared checklist for a group project, inside a class room. SQL Editor → New
query → paste [`supabase/groups.sql`](supabase/groups.sql) → Run, after
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

### Google and Apple sign-in (optional)

Authentication → Providers, switch on what you want, and paste each provider's
client id and secret. Until then those two buttons return a provider error,
which is the truth rather than a broken button. Email and password work
immediately.

## 3 · The shared Claude key (optional)

Without this, each user pastes their own API key under **Ask Claude →
Settings** and the app works fine. With it, a signed-in user can generate a
course with no key at all.

**From the dashboard, no tooling required:**

1. **Edge Functions → Deploy a new function → via the editor.** Name it
   exactly `claude` — the app calls `/functions/v1/claude`.
2. Paste [`supabase/functions/claude/index.ts`](supabase/functions/claude/index.ts)
   in, replacing whatever the editor starts with, and deploy.
3. **Project Settings → Edge Functions → Secrets**: add `ANTHROPIC_API_KEY`
   (from console.anthropic.com), and optionally `MONTHLY_CALL_LIMIT`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase — do
not add them yourself, and do not put the service key anywhere else.

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

Pages serves a project site from `/<repo>/`, which the build handles: the
workflow passes `VITE_BASE` and nothing in the app reads a leading-slash path
directly. If you deploy somewhere that serves from the root, drop `VITE_BASE`
and it works unchanged.

## 5 · The optional connectors

None of these are needed to use the app; each is documented in
[`app/.env.example`](app/.env.example) and announces itself on the Connect
screen when it is missing.

| What | Needs |
| --- | --- |
| Brightspace, iCloud, any calendar | Nothing — paste the .ics or webcal link |
| Microsoft 365 | An app registration (single-page application) |
| Google Calendar / Drive | An OAuth client (web application) |
| Zoom | A General App with PKCE, plus the dev proxy |
| Sign in with Apple | A paid developer account, an https redirect, a signing key |

## What a new user does

Nothing on this page. They open the site, make an account if they want their
work to follow them, and upload a syllabus. The app reads it in their browser,
asks Claude for the structure, checks what comes back — dates in range, quotes
actually present in the document — and shows them a preview before anything is
saved.
