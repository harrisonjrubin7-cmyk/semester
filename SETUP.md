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

```bash
npm install -g supabase
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
