# The competitor implementation plan, checked against the code — September 2026

The tracked copy of *Semester — Competitor Feature Implementation Plan*
(20 September 2026), which takes the nine proposals from the feature-comparison
report and says **how to build** each of eight of them, in a sized build order.

It is filed here for the reason [`ACTION-PLAN.md`](ACTION-PLAN.md) and
[`COMPETITION.md`](COMPETITION.md) give for their own existence: every item
that names something about this repository was checked against the code before
it was filed. That habit has now been run three times against three outside
documents, and it has now returned the same answer three times.

**Checked against `3075fbc` on 20 September 2026**, and rebased onto `2558309`
before pushing. The four commits in between are the AI-video lesson renderer and
an essay-screen pointer id; none of them touches an item below, and none of them
is a referral link. That is worth a line rather than a silent rebase, because
`CLAUDE.md` opens with why: two sessions reached the same two items within nine
hours on the 19th, neither knowing about the other.

## What it came to

Of the eight items, **seven need no building.** Six are already in the app, one
is a recommendation not to build something and it is the right recommendation.
**One was genuinely open — the ambassador referral mechanic — and it is built
in this change.**

| # | The item | Verdict |
| --- | --- | --- |
| 1 | Live "what grade do I need" calculator | **Landed** — `lib/grades.ts`, on four surfaces |
| 2 | Proactive start-time nudges | **Landed** — `lib/start.ts`, and the tenth rule in `lib/notify.ts` |
| 3 | Camera-scan + voice quick-add | **Landed, both halves** — and the camera is on Import, which the document says it is not |
| 4 | Self-serve Canvas token read-sync | **Landed** — `lib/canvas.ts` and `supabase/functions/canvas/` |
| 5 | Lecture-capture to notes and flashcards | **Landed** — `components/RecordButton.tsx`, and its landing spot exists too |
| 6 | Toggleable calendar layers | **Landed, both halves** — `lib/calsource.ts` and `dayCount` in `lib/monthgrid.ts` |
| 7 | Ambassador referral mechanic | **Open — built here.** The only one |
| 8 | Open-seat registration alerts — *don't build* | **Agreed, and for a better reason than the one given** |

The document is sound about the market and sound about what these features are
worth. What it could not do is read this codebase, and `CLAUDE.md` says why
that gap opens as fast as it does: **seventy-nine commits landed in the two days
before this plan was written.** Four of the six already-built items are sized
here as sprint work — a week apiece for two of them — so the cost of not
checking is four sprints spent rebuilding things a student can use today.

Two things are worth saying in the document's defence, because they are not
research failures:

- **Item 4 was true when its research was done and false when it was filed.**
  `lib/canvas.ts` merged on 19 September, the day before. The document's own
  scoping of it — "1–2 weeks: encrypted token storage, a Canvas API client,
  mapping/merge logic, refresh scheduling" — is an accurate estimate of work
  that had just been finished.
- **The one it got right about this repository is the one it recommends against
  building.** See item 8.

---

## The prerequisites, which the document is right to lead with

> Don't start any of this until Tier 1 in the action plan is closed: the course
> deep-link bug, the AI-gate on first use, OAuth sign-in, and the Vanderbilt IP
> email.

Correct as a principle, and all four have moved since it was written. **Three of
the four are closed as code; none of the three remaining halves is code.**

- **The course deep-link bug** — closed. `e9c7d73` (19 September): a refresh or
  a bookmark on a course URL was answered before the course had arrived, and
  drew a different course entirely, twice out of two.
- **The AI gate on first use** — closed as code. `screens/Import.tsx` draws the
  gate *in the primary button's place* rather than under a button that cannot
  succeed, and `screens/deadends.test.tsx` pins both directions. What is open
  is whether the shared key is switched on for pilot testers, which is a
  deployment decision and not a build.
- **OAuth sign-in** — built; `lib/cloud.ts` reads GoTrue `/auth/v1/settings` so
  a provider that is switched off no longer draws a button that fails after the
  press. Pasting client IDs into the Supabase dashboard is the remaining step
  and this repository cannot take it.
- **The Vanderbilt IP email** — prepared. [`IP.md`](IP.md) §1 carries the
  deciding facts as a checklist and the email ready to send.

So the gate the document puts in front of its own list is, as of this commit,
down for everything except two dashboard steps.

---

## The eight

### 1 · Live "what grade do I need" calculator · **Landed — on four surfaces**

> Semester's Grades screen already parses each course's grade weighting, so
> this is a computed field on data already loaded. Effort: small, 1–2 days,
> front-end only.

The estimate is the right size for the work, and the work is done.
`lib/grades.ts:339` is `needFor(standing, target)`, which solves the weighted
average for what everything left has to average — the document's own formula,
`needed = (target - sum(weight_i * score_i)) / remaining_weight`.

It ships on `screens/Grades.tsx:220` under *"To finish with, you need"*,
recomputing as scores are typed, against the school's own cutoffs through
`lib/cutoffs.ts` rather than against assumed bands. Three more consumers:
`lib/gradesheet.ts` builds a course an editable grade sheet from the syllabus's
own weights, `screens/Grades.tsx:282` runs it against practice-exam averages,
and `lib/termgpa.ts:339` runs `needFor` and `reachFor` across every course at
once to answer a question none of the ten competitors asks — which single course,
raised one band, moves the term GPA most.

Two things this has that the document's version does not, and both are the
reason it is more than arithmetic:

- **A verdict, not just a number.** `reachFor` exists because 104% is
  arithmetically correct and means "not happening", and −12% is correct and
  means "already yours". Each is a different thing to do about the same figure.
- **The caveat that has to travel with all of it.** `needCaveat`: a syllabus
  whose weights sum to 95 makes every figure a ratio of the wrong denominator.

The document's "adjust individually toggle" for splitting effort unevenly
across remaining assignments is the one part not built. It is a genuine small
addition and it is not what the feature turns on.

### 2 · Proactive start-time nudges · **Landed**

> Derive a `start_by` timestamp per task and store it on the existing task
> record. Effort: medium — roughly a week for push infrastructure.

The document guesses the input would be Tonight's hours-vs-available
arithmetic. The real input is better and already existed: `lib/start.ts` walks
each deadline backwards through the hours the student's own work windows
actually offer, takes half a day for any one piece of work because they have
other courses, and **refuses to produce a start date at all for work the app has
never timed** — a made-up start date being the one number somebody would
arrange a fortnight around.

The delivery layer landed in `720e6ce` as a tenth rule in `lib/notify.ts`
(`notify.ts:381`), beside the nine that all keyed on an end date. Web Push over
SMS, exactly as the document recommends, and for the reason it gives.

The part worth repeating is the one that decides whether this is a reminder or
a nag: a start date that has gone by stays in `beginNow()` every morning
afterwards, so an id keyed on *today* would buzz about the same unstarted paper
daily until the student switched the feature off. Keyed on the start date, each
piece of work says its piece once.

### 3 · Camera-scan + voice quick-add · **Landed, both halves**

> Build — camera scan: the Import screen (`#/import`) is file-upload only
> today. Add `<input type="file" accept="image/*" capture="environment">` as a
> second option alongside the file picker.

**"File-upload only" is wrong twice over.** Import has four doors and three
need no key at all — paste the syllabus as text, open a course somebody shared,
add a course by hand with no syllabus. And the camera is on that screen:
`screens/Import.tsx:14` imports `components/Capture.tsx`, which draws exactly
the input the document specifies, and the shots go through `readPages` in
`lib/claude.ts` — the vision read — rather than through the text extractor.

It landed in `374d3e5`, and the file records why it is a *second* door rather
than an extra media type on the existing picker: an image in the file picker
would go to `extractText`, which cannot see it, and be refused. Two doors,
because they are two different things a browser does.

The voice half is `lib/mic.ts`, `lib/transcribe.ts` and
`components/RecordButton.tsx`, and it is more than the document asks for: a
live recogniser with a **restart loop**, because the browser's recogniser stops
on a pause long enough for a professor to write on a board, and a naive one
goes quiet twenty minutes into a fifty-minute class without saying so.

### 4 · Self-serve Canvas token read-sync · **Landed — one day before this plan was written**

> A student pastes in their own Canvas personal access token. Effort:
> medium-to-large, 1–2 weeks.

`lib/canvas.ts` (313 lines) and `supabase/functions/canvas/index.ts` merged in
`#516` on 19 September. The property the document correctly identifies as the
point — self-serve, per-student, no institutional agreement — is exactly what
ships, and `screens/Connect.tsx` is the flow.

Three of its design decisions are worth knowing before anybody re-reads this
item as open, because each is a place the predictable design is wrong:

- **The token is not stored.** The document's step (2) is "store the token
  encrypted server-side via an Edge Function, never exposed back to the
  client". What shipped does not store it at all, which is strictly better and
  removes the encrypted-storage work the estimate is mostly made of.
- **There is no direct route, and that is not a deployment problem.** Canvas
  sends no `Access-Control-Allow-Origin` on any API response, on every
  instance, so asking would spend a round trip to be refused.
- **It maps onto ordinary `FeedEvent`s**, so `lib/reconcile.ts` and the feed
  screens had nothing to learn — which is the document's step (4), done by
  construction rather than as a merge layer.

The document's warning here is the one piece of it that is still live and worth
keeping: **don't overclaim it.** UpAhead's "Canvas integration" turned out to be
a shallow read-only feed and got called out publicly. This one carries
submission state, which is the honest difference, and it should be described as
read-only and student-initiated.

### 5 · Lecture-capture to notes and flashcards · **Landed, and so is its landing spot**

> Effort: large, 2–3 weeks. Dependencies: a reliably working metered AI key,
> and the Study-screen redesign as its landing spot.

`components/RecordButton.tsx` opens with *"Record a lecture, and write it down
while it happens."* It ships on `screens/Update.tsx` and `screens/Mine.tsx`,
and on Update the transcript lands in the same pipeline every other piece of
material goes through — `lib/parse.ts`, `lib/classify.ts`, `lib/changeset.ts` —
which is how it becomes cards and study parts rather than a wall of text.

The document's transcription design is the one place it is factually behind the
platform rather than behind the repository: it proposes an Edge Function
sending audio to a transcription service. What ships takes the transcript
**live**, in the browser, and the module states the limit rather than implying
otherwise — there is no offline recogniser you can hand an hour of finished
audio to. That is a real constraint the plan's server-side design would have
discovered in week one.

The dependency is also satisfied. The Study screen is not the flat wall of
six-plus equal buttons the plan inherits from the UI audit: `screens/Study.tsx:257`
draws a `studio-entry` with a single `portal-primary` call to action. And
`lib/studystudio.ts` with `lib/studysources.test.ts` (19 September) is the guard
on the four-file chain from `RecordButton` to the Study Studio's source list —
cutting any link failed nothing, and the lecture quietly stopped being offered
as a source on the screen whose own words promise it.

### 6 · Toggleable calendar layers · **Landed, both halves, and bundled exactly as suggested**

> Add a row of toggle chips above the calendar. Bundle this with the
> already-planned "give calendar day-dots a count, not just a color" fix since
> both touch the same rendering code — one PR, two wins.

Both halves ship and they did land together.

**Layers** are `lib/calsource.ts`, and the file exists because the four
calendar views had each written the filtering conditions out and had therefore
come to disagree — Week ignored the source axis entirely and Semester had no
branch for classes, so the exact combination the feature advertises produced
"nothing from this source across the whole semester" about a term with four
courses meeting all week. Three buckets, plus a second row of chips under
Campus. **The count** is `dayCount` in `lib/monthgrid.ts:112`.

The document's instinct to bundle them was right for the reason it gives, and
`COMPETITION.md` notes this closed an item `ACTION-PLAN.md` had left explicitly
unchecked.

### 7 · Ambassador referral mechanic · **Open — and built in this change**

> MVP only: (1) a unique referral code/link per account, generated at signup and
> stored on the profile row; (2) attribution — a new signup that arrives via a
> referral link writes a `referred_by` field; (3) a simple Supabase view counting
> "active" referred users per ambassador. Don't build an automated
> credit/payout system yet.

**This is the item, and the scoping instinct is right: the MVP is the counting,
and the payout is deliberately not built.** `ACTION-PLAN.md` flags the
ambassador GTM model as untested, and automating a credit before the mechanic
is known to work is building the expensive half of an untested idea.

It is built here as `supabase/migrations/20260921002623_referrals.sql`,
`app/src/lib/referral.ts` and `app/src/components/ReferralLink.tsx`, and it
lands on the account screen rather than as a new destination — which is the
document's own last rule, and the registry is **58** screens, not the 60 it
quotes from the UI audit.

Four things in the specification could not be built as written, and each is a
finding rather than a preference:

**The link cannot make an account at all while the pilot is on, and nothing
would have said so.** `supabase/migrations/20260921002428_invites.sql` is an
allow-list enforced by a trigger on `auth.users`. With it on, a stranger who
follows an ambassador's link is refused at sign-up — so the feature is inert,
the count stays at nought, and the ambassador has no way to tell that from
nobody clicking. The document lists this item's dependency as "Track 2
(accounts)", and accounts are not the blocker: **the gate is.** So
`referral_standing()` returns the gate's state along with the numbers and the
screen says it in words. This is the single most valuable thing the check found,
because it is the difference between a feature and a week of silence.

**The "simple Supabase view" cannot work.** Row-level security is enforced
through a view as the *invoker*, and an ambassador querying it gets their own
rows — but the rows being counted belong to the people they referred. A view
that returned the right number would be a view that lets one account read
another's. The counting is a `security definer` function returning aggregates
only: same number, and it cannot be joined back to a person. An ambassador
learns "9 joined, 4 active", never who.

**"Active" cannot mean "opened the app in the last 14 days".** This app is
offline-first and fully usable signed out, so the only server-side evidence of
life is `public.state.updated_at`, which is a *sync*. A referred student using
the app daily on one device counts as inactive. That is under-counting, which is
the right direction to err when somebody eventually gets paid on the figure, and
the screen says so in a line under the number rather than leaving "active" to be
read as "using it".

**"Generated at signup and stored on the profile row" is two mistakes.** There
is no profile row for this — `public.profiles` is the display name strangers in
a lecture read, and a referral code is not that. And generating one at signup
means a row for every account for a feature most accounts ignore; it is minted
when somebody first asks for a link. The code is also generated rather than
accepted from the client, with the alphabet pinned by a `check` on the column,
because a code anybody can choose is a code somebody chooses `FINANCIALAID` and
sends to two thousand freshmen.

Two more decisions that the specification does not mention and that a referral
mechanic needs:

- **A claim is refused once the claiming account is more than seven days old.**
  Otherwise "people I brought" quietly becomes "friends I asked", and the number
  stops meaning what it will be paid on.
- **The person who followed the link is told, once.** A row was written
  associating them with somebody else's code, and an app whose privacy page
  makes a good deal of how little it keeps should say so rather than let it be
  something a student would have to read the schema to find.

The evidence for all of it is `supabase/referrals.check.sql` — 39 checks — and
`app/src/lib/referral.test.ts` — 25. Both were mutation-tested rather than
merely passed; each file's header names what was caught and what was
deliberately not.

### 8 · Open-seat registration alerts · **Don't build — agreed, and the reason is better than the one given**

> It cuts against a real differentiator: the live-app sweep specifically praised
> Semester's refusal to hold university SSO credentials or fake data it can't
> get honestly.

This is the item the document gets most right, and the codebase agrees with it
more strongly than the document knows. The refusal is not a stance somebody
wrote on a marketing page; it is load-bearing in the code, and two shipped
features exist *because* of it — `lib/canvas.ts` takes a token the student
issues in forty seconds rather than an OAuth developer key an administrator
must grant, and `lib/feedlink.ts` takes a calendar link a student copies. Both
chose the route that works today without anybody's permission over the
better-designed one that needs a meeting first.

An open-seat alert has no such route. It needs scraping behind SSO or a
registrar agreement, which is Track 3. **Leave it out.**

---

## What the build order should say now

The document's order is sized by leverage, and every judgement in it is
defensible. Six of its seven build items are done, so what is left of the order
is one line:

| Order | Feature | Effort | Depends on |
| --- | --- | --- | --- |
| 1 | Ambassador referral link MVP | Small | Accounts — **and the invite gate being off, which is the real dependency** |
| — | Everything else in the list | — | Already built; see above |
| — | Open-seat registration alerts | — | Don't build |

Two follow-ons this change does not do, named rather than left implicit:

- **Testing it.** The plan's own next step is two or three real ambassadors
  tracked by hand off these numbers. Nothing here automates a credit, and
  nothing should until that has happened.
- **The gate.** While invite-only is on, the honest thing to hand an ambassador
  is not a link. Either the gate comes off, or a referred address has to reach
  the invite list, and that is a decision about who the pilot is for rather
  than a thing to build.

## And the rule the document ends with, which this change kept

> Don't add a ship without a landing spot.

The referral link is on `screens/Account.tsx`, between what the account does and
leaving it. No new route, no new tab, no new entry in the registry — which
stays at 58.
