# What is validated, and what is not — September 2026

Written for the deck, and for the question that follows every claim in it.

The market analysis this repository filed as [`MARKET-POSITION.md`](MARKET-POSITION.md)
ends on an investor recommendation: *"Add a 'what we've validated / what we
haven't' section to the deck. Investors trust an honest gap more than a polished
projection built on zero real users."* This is that section, and it is kept here
rather than only in the deck for the same reason every other figure in this
repository is: **a number in a slide cannot be re-checked, and a number with a
command under it can.**

## How to read this

Everything in the left column was measured on **`1c305ee`, 21 September 2026**,
with the command beside it. Everything in the right column has **no evidence in
this repository or anywhere else**, and saying so is the point of the document.

**Every figure carries a commit, because these move.** The test count alone took
six values in one afternoon — 11,236 → 11,265 → 11,414 → 11,648 → 11,788 → 12,046 — and the
number of files the RLS suite lives in went 13 → 14 → 17 → 19 in a few hours. A figure without a commit beside it is not a fact about the product,
it is a fact about the afternoon somebody wrote the slide.

---

## Validated — there is evidence, and you can re-run it

| Claim | Evidence | Re-check with |
| --- | --- | --- |
| **The product is built and runs** | 12,046 tests passing across 615 files, 10 skipped, 0 failing | `cd app && npm test` |
| **The tests do not depend on each other** | The same suite passes in a randomised order (seed 1790028722879), which is a different fault from a broken test and a real one | `npm run test:shuffle` |
| **It compiles and ships** | Typecheck, lint (including style and accessible-label audits) and production build all exit 0 | `npx tsc -b`, `npm run lint`, `npm run build` |
| **Row-level security is enforced and checked** | 93 `create policy` statements; **241 assertions across 19 `.check.sql` files** that create real users and assert a stranger can neither read nor write, then roll back | `grep -c 'create policy' supabase/migrations/*` |
| **The schema can be rebuilt from the repository** | 37 migrations, **none empty**; the 15 migrations applied to production outside the repo are recorded byte-for-byte in `supabase/history/` | `find supabase/migrations -name '*.sql' -empty` |
| **Every commit is gated** | `ci.yml` runs six checks on every pull request: typecheck, lint, university typecheck, video typecheck, the suite, and the suite again in other timezones | `.github/workflows/ci.yml` |
| **The instrument for the missing number is already built** | `ANALYTICS.md` defines activation, weekly active use and **30-day retention**, with the SQL for each; `lib/activity.ts` and `supabase/migrations/20260921151000_activity.sql` implement them. One table, three marks, no screen names or titles or counts | `cat ANALYTICS.md` |
| **The engineering culture is real, not claimed** | Structural guards catch defects that runtime probes miss — during this review two of them caught errors in work being written *for* this review, and a third caught a broken citation on `main` | `app/src/lib/migrationcitations.test.ts` |

### The differentiating features exist and are reachable

Not roadmap. Each is a module you can open:

- **Cross-course concept linking** — `lib/meet.ts`. Finds the same term defined
  in two courses and shows **both definitions** rather than asserting they are
  the same thing. String matching over glossaries, no model, and the screen says
  so.
- **What-If grade simulation** — `lib/whatif.ts`, `components/Suppose.tsx`.
- **Workload fitting against real hours** — with a sleep floor.
- **Multi-LMS, and outside an LMS entirely** — `lib/feedlink.ts` (any calendar
  feed), `lib/canvas.ts` (Canvas via a student-issued token),
  `supabase/functions/lti/` (Brightspace LTI 1.3 launch), plus syllabus PDFs
  that never touch an LMS.
- **Hands-free voice** — `lib/voiceloop.ts`, a four-phase loop with the
  self-hearing echo hazard handled as a state machine rather than left to a
  component.
- **Cross-tool memory** — `lib/aboutme.ts`, applied at the single point every
  assistant feature leaves by, so it cannot reach some tools and not others.

### Privacy is architectural, with one nuance worth stating first

**Semester never asks for an LMS or SSO password.** There is no credential
scraping anywhere in the codebase, and that is a structural choice rather than a
policy promise.

The nuance, because a university compliance office will find it and it is better
to say it: **a Canvas personal access token is account-equivalent.** It can read
a student's messages and grades and it can write. `lib/canvas.ts` says so in its
own docstring rather than glossing it. What the app does about it:

- Only ever issues `GET` under `/api/v1/`.
- The token travels in a request **body**, never a query string — a query string
  is the part of a request that lands in every log on the way.
- **The forwarder refuses anything that is not a `GET` under `/api/v1/`**, so a
  bug in the client cannot become a write. Enforced server-side in
  `supabase/functions/canvas/index.ts`, not only by convention.

Also real: a documented data-retention decision (`RETENTION.md`), a data-access
audit log (a migration, not a plan), and a written incident-response runbook
(`SECURITY.md`).

---

## Not validated — there is no evidence, here or anywhere

This is the honest half, and it is the half worth leading with.

| Claim | Status |
| --- | --- |
| **Users** | **Zero.** No real user has ever used this product. |
| **Revenue** | **Zero.** |
| **Retention** | **No data.** Not a weak number — no number. |
| **Willingness to pay** | **Never tested.** No paywall experiment, no pricing interviews. |
| **LTV:CAC ≈ 17x** | **Modeled, not observed.** Every input is an assumption. |
| **Year-2 break-even** | **Modeled.** Depends on the above. |
| **Ambassador growth engine (60–270x organic ratio)** | **Never run once**, at any campus, with any ambassador. |
| **Payment processing** | **Does not exist.** Verified: no payment code in `app/src`. The product cannot take money today. |
| **Unit-cost model under real usage** | **Untested.** The shared AI key is metered at 60 generations per account per month; nobody has ever hit that ceiling because nobody has ever used it. |
| **Deploy safety** | **No staging environment.** CI passing is not the same as a deploy being gated on it. |
| **Trademark** | **"Semester" is likely unregistrable** — *merely descriptive* under 15 U.S.C. §1052(e)(1) for software that plans a semester. The clearance search has not been run. |
| **University IP position** | **Unresolved.** The Vanderbilt CTTC conversation is drafted and unsent. |
| **Internal financial consistency** | **Figures disagree** across founder-facing documents — licence fee, premium price, infrastructure cost per user, and conversion rate each have two values. |

---

## The one sentence to fix before the deck goes out

The analysis recommends leading with *"the only free, **unlimited**,
workload-aware planner."* The first half is defensible and the word *unlimited*
is not, flat, because this product meters:

> `supabase/functions/claude/index.ts` — the shared AI key is capped at **60
> generations per account per month**; a student's own key removes the cap.

The honest form is stronger anyway, because it survives a competitor's
screenshot:

> **The planner is free and unlimited** — courses, deadlines, workload fitting,
> grades, calendar, sharing. No cap, no tier, no paywall.
> **The shared AI key is free and generous** — 60 syllabus-scale generations a
> month, and your own key removes the limit.

Rivals that paywall the syllabus upload itself cannot say either half.

---

## What would move a row from right to left, cheapest first

1. **Ten real users with a 30-day retention number.** The single highest-value
   missing fact, the one an investor asks for first, and — this is the part
   worth knowing before anybody scopes work for it — **it needs no engineering
   at all.**

   `ANALYTICS.md` already defines the three figures, already holds the query
   for each, and already reasons about a pilot of exactly ten people. The
   table, the marks and the one call site that writes them are built and
   shipped. Nothing is missing from the instrument; what is missing is people
   walking through it.

   So this item is not a sprint. It is ten students and thirty days, and the
   number falls out of a query somebody runs by hand — which `ANALYTICS.md`
   says is deliberately a person's job, with no dashboard and no third party
   holding a copy.
2. **A soft paywall or 20–30 structured pricing interviews.** Converts
   *willingness to pay* from assumption to observation.
3. **Two or three ambassadors at one campus, with tracked installs.** Tests the
   growth engine the whole financial model rests on.
4. **Branch protection: require branches to be up to date before merging.** Sixty
   seconds. Three separate collisions landed on `main` during this review alone,
   each one green on its own branch.
5. **Stripe, before charging anyone.** Pricing is modelled; collection does not
   exist.

The first item is worth more than the other four combined.

---

## What this document is not

It is not a third-party audit. Every figure here is self-measured, which is
exactly why each one ships with the command that reproduces it and the commit it
was taken on. Anyone who doubts a number in the left column can run one line and
settle it; nothing in the right column requires trust at all, because it claims
nothing.
