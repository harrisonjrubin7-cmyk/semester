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

### The website that goes with it

Three pages — a front door, the term, and the study side — live in
`app/public/web/`. Vite copies `public/` through verbatim, so they deploy with
everything else and land at `<base>/web/`. Nothing to configure, and no change
to `pages.yml`.

Same origin as the app, which is the whole point: one `localStorage`, one
Supabase session. Sign in on either and the other already knows you.

The app links to all three from **Connect → On a desktop**, at addresses
derived from wherever the app is served (`app/src/lib/web.ts`), so they are
right under any base.

The other direction needs one note. Those three files are **generated
bundles** — one line of minified HTML wrapping the real document as an escaped
string — regenerated whole whenever the website changes. Its front door links
back to the app; `app.html` and `study.html` did not, so a shared link to
either left you with no way home but the address bar. Rather than edit a
generated file, the build appends a small return link to the copies in
`dist/`: `app/scripts/webback.mjs`, run by `npm run build`, with the work in
`app/src/lib/webback.ts` and tests in `webback.test.ts`.

So **regenerating the website loses nothing** — drop the new bundles in and the
return link is re-applied on the next build. Two things worth knowing:

- The added link computes the app's address from `location.pathname`, so it is
  right on a fork or a local `vite preview`. The front door's own link home is
  written out in full and points at this deployment; a fork should change it
  wherever the website is generated.
- It only appears in a built site. `npm run dev` serves `public/` directly, so
  the website is there but the added link is not. Use `npm run build && npx
  vite preview` to see it.

#### The bundles ask for their own source tree — fix this where they are made

The same build step repairs a second thing, and this one is not cosmetic. The
generator wrote asset paths relative to the directory it ran in rather than to
the page it was writing. Verbatim out of `study.html`:

```js
fetch('app/public/audio/lessons/' + course + '/lessons.json')
```

Served from `/semester/web/study.html` that resolves to
`/semester/web/app/public/audio/…`, which is nothing. The file is really at
`/semester/audio/…`: Vite publishes the *contents* of `public/`, so `app/public/`
is where a file sits in the repository and is never part of a URL.

It cost the whole study page. Every course read "0 units", the contents list was
empty and the script pane blank, because the 404 is swallowed by an
`r.ok ? … : null`. The term page lost its logo to the same prefix.

`webback` now rewrites `app/public/…` to the deployment root at run time — it
patches `fetch`, `XMLHttpRequest.open`, `setAttribute` and the `<img>` `src`
setter before the bundler unpacks the document, because `study.html` has the
path as a literal and `app.html` builds its own at run time, so a search and
replace would only catch half. Regenerating the website is safe; the repair is
re-applied on the next build.

It belongs upstream; see [the list below](#what-has-to-change-in-the-generator).

#### The other fourteen files, which the shim could never have reached

`app.html` also asked for a stylesheet, a script and twelve icons. None of them
came through `fetch` or a `src` attribute — they are in a `<sc-helmet>` block the
page writes with `innerHTML`, and the icons arrive as **CSS masks**:

```css
.ic-today { mask-image: url("icons/today.svg"); background: currentColor }
```

A mask URL is not an attribute, so nothing the shim hooks ever sees it, and a
404 on a mask paints nothing and reports nothing. That is also why the count was
wrong at first: only nine icons 404 on the home screen. `make`, `campus` and
`person` appear on screens further in. Reading the helmet block out of the live
page gives all twelve.

None of these were missing in the sense of not existing. They were missing in
the sense of never having been published:

| What | Where it really is | How it now ships |
| --- | --- | --- |
| `_ds/industry-ec2ca40c-…/styles.css`, `_ds_bundle.js` | `project/_ds/industry-ec2ca40c-…/` — outside `app/`, so Vite never saw it | copied into `dist/web/_ds/…` by `webback` |
| twelve `icons/*.svg` | drawn in `app/src/components/icons.data.ts`, as the app's own glyphs | written out by `app/src/lib/webicons.ts` |

Two things worth knowing about those:

- **The stylesheet changes nothing visible**, and that is the point rather than a
  disappointment. It is the Industry token sheet; the page carries its own styles
  inline, *after* the link, so they win. It ships so the page loads what it says
  it loads, and so a regeneration that leans on a token finds one.
- **The icons are generated, not drawn twice.** Every name the website asks for
  is one the app already had. Twelve hand-written files would mean two copies of
  each glyph, and the day somebody redraws the map icon in the app the website
  would keep the old one — silently, because a stale glyph is still a glyph. The
  shapes moved into `icons.data.ts`, `Icons.tsx` renders them, and the build
  writes the same shapes out as files. They are stroked in flat black rather than
  `currentColor`, which a mask cannot resolve.

After all three repairs, **all three pages load with no failed request at all.**

#### "NaNm left" — the term page could not read its own deadlines

A third repair, and the one worth understanding, because it is about the data
rather than the plumbing. The countdown for anything due today read:

```js
const hh = parseInt(it.time, 10) + (/PM/.test(it.time) && … ? 12 : 0);
const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, 59);
```

`it.time` is the deadline **as the syllabus words it** — that is deliberate and
documented in `app/src/lib/duetime.ts`: "In class" and "Window is Sep 8–17" mean
things no clock can hold, and rewriting them would lose the only wording you can
check against the PDF. `parseInt` of any of those is `NaN`, which makes an
Invalid Date, which makes `Math.max(0, NaN)` — `NaN`, not `0`.

Of the thirteen wordings in the data the page carries, three survive:

| Wording | Deadlines | The page read | Actually |
| --- | --- | --- | --- |
| `Before class, 1:15p` | 24 | `NaN` | 13:15 |
| `11:59 PM` | 6 | 23:00 — right only because the next line hard-codes `, 59` | 23:59 |
| `In class`, `Before class`, `` (blank) | 9 | `NaN` | no clock time |
| `Before class, 2:45p`, `In class, 2:45p` | 6 | `NaN` | 14:45 |
| `Window is …` | 2 | `NaN` | no clock time |
| `Take-home posted 9a Sep 14` | 1 | `NaN` | 09:00 |
| `5:00p` | 1 | **05:00** — `/PM/` does not match a lowercase `p` | 17:00 |
| `9:00–11:00 AM`, `3:00–5:00 PM` | 2 | correct, by luck | 09:00, 15:00 |

Weighted by items, **44 of 50 deadlines showed `NaN` on the day they were due**,
and `5:00p` counted down to a deadline twelve hours before the real one — worse
than `NaN`, because nothing about a plausible number looks wrong.

This one is a **source patch**, not a shim: the bad value is computed and
rendered inside the bundle, so nothing at a boundary can see it. `webback`
replaces those two lines in `dist/`, anchored on a long literal, and injects a
reader — `readDue` from `duetime.ts` written out as browser JavaScript. A
wording with no clock time now returns "today", beside the page's own
"tomorrow", instead of counting down to a time nobody stated.

Two things keep that patch honest, and both are tests rather than intentions:

- `webback.test.ts` reads the committed `app.html` and asserts the anchor still
  matches **exactly once**. A regeneration that rewrites the countdown turns
  `npm test` red, rather than the site quietly going back to `NaNm left`.
- The injected reader is checked against `readDue` on every wording in the data.
  They must agree; `readDue` is the one with the reasoning behind it.

Upstream this is one line; see [the list below](#what-has-to-change-in-the-generator).

#### What has to change in the generator

Everything above is a **repair applied at build time to `dist/`**, because the
thing that produces these three pages is not in this repository. Neither is the
website's source: `docs/data-contract.md` §0 records the search, by name and by
content. The bundles arrived as a zip of three built HTML files and a README.

So this section is the handover. Each item is a defect in whatever emits the
bundles, and each has a repair here that becomes dead weight the moment it is
fixed properly.

| # | In the generated page | What it should emit | Repaired here by |
| --- | --- | --- | --- |
| 1 | `app/public/…` in a URL | the path alone — Vite publishes the *contents* of `public/`, so the prefix is a repository path and never part of a URL | `PATH_SNIPPET`, a runtime shim |
| 2 | `_ds/industry-ec2ca40c-…/styles.css`, `_ds_bundle.js` | inline the stylesheet, as the pages already inline the rest of their CSS, or emit a path relative to the deployed page — not one into the design-system source tree | the two real files copied out of `project/_ds/` |
| 3 | twelve `icons/*.svg` as `mask-image` | ship the files beside the page, or inline them as `data:` URIs | generated from `app/src/components/icons.data.ts` |
| 4 | `parseInt(it.time, 10)`, then `new Date(…, hh, 59)` | read the time out of the wording, and take the minutes from it instead of assuming `59` | `BROKEN` → `MENDED`, a source patch |
| 5 | `const BASE = 'https://harrisonjrubin7-cmyk.github.io/semester'` in `study.html`, and `window.open('https://harrisonjrubin7-cmyk.github.io/semester/#/home')` in `index.html` | derive the base from `location.pathname`, the way the injected return link does | **nothing yet — see below** |

**Item 5 is the one nothing here repairs**, and it is worth knowing what that
costs. `study.html` sets an `<audio>` element's `src` to `BASE + l.file`, so a
fork, a renamed repository or a local `vite preview` streams from *this*
deployment or not at all; the front door's "open the app" button goes to this
deployment from anywhere. On the real site both work, which is exactly why it is
easy to miss. It is left alone because it is the one item where the shim would
be guessing — `location.pathname` is right for a fork and wrong for a page
deliberately pointing somebody at the hosted app — so it wants a decision rather
than a patch.

Two things make these safe to leave until then. The committed bundles are
untouched — byte for byte as they arrived — so **regenerating the website loses
nothing**, and every repair is re-applied on the next build. And where a repair
depends on matching a literal, a test asserts the literal is still there, so a
regeneration that fixes item 4 upstream turns `npm test` red rather than
silently reverting the site. Red there means "delete the patch", not "something
broke".

Finally, the bundles answer a question `docs/data-contract.md` §0 was still
holding open. It listed the `semweb:*` keys among the things no file in the
repository mentioned; the bundles carry them, and they are the website's half of
the mapping table that section could not fill. §0 now records this, and the
names are:

| Page | Keys it reads and writes |
| --- | --- |
| `index.html` | `semweb:cloud:v1` |
| `app.html` | `semweb:v1`, `semweb:custom:v1`, `semweb:grades:v1`, `semweb:places:v1` |
| `study.html` | `semweb:study:v1`, `semweb:custom:v1` |

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
