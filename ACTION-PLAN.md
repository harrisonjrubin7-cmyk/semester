# Action plan — September 2026

Seventeen items, written against the market analysis, the financial model, the
consistency findings, the UI audit and the live sweep of all sixty screens.
This file is the tracked copy, and it is not the plan as written: every item
that names something about *this repository* was checked against the code
before it was filed, and seven of them came back different from the claim.

That is the point of tracking it here rather than in the project folder. The
same thing has happened to every audit in this repository — `COMPLETION-PLAN.md`
found seven of one document's eight "what's missing" items already built, and
`CLAUDE.md` says why: several sessions work this app at once and the documents
describing it lag the merges. A plan item that has quietly landed is worse than
no plan item, because somebody will spend a week on it.

**Checked against `88aa741` on 17 September 2026, and re-checked against
`b7f7c27` on 19 September — see the section under the legend for what moved.** Each verdict below says what
was measured and where. Items with no code in them are marked as such and carry
no verdict — they are open because nobody has done them, not because anything
was found.

Legend: **Open** · **Landed** (already in the app; nothing to do) · **Partly**
(some of it is in, the rest is named) · **Not a code item**.

---

## Re-checked 19 September 2026, against `b7f7c27`

**Seventy-nine commits landed between `88aa741` and this re-check**, which is
two days. That rate is the reason this section exists rather than a quiet edit
to the verdicts above: a plan item that has quietly landed is worse than no plan
item, and so is a plan that claims to have been checked more recently than it
was.

What moved, and nothing else did:

| # | Was | Now |
| --- | --- | --- |
| 1 | Partly — the code half fixed here | **Landed as code.** The gate stands in the button's place on `screens/Import.tsx`, held by `screens/deadends.test.tsx:339`. The shared key for pilot accounts is still not a code item and still open |
| 2 | Partly — built; providers a deployment step | **Unchanged, and worth restating**, because it is the item most often reported as missing. `lib/cloud.ts` reads GoTrue `/auth/v1/settings`, so a provider that is switched off no longer draws a button that fails after the press (`bbc788b`). Pasting client IDs into Supabase is the remaining step, and it is not one this repository can take |
| 4 | Partly — the "what's due" merge open | **Closed.** `80fbc5c` merged it; `#/ahead` and `#/tonight` are Today's tabs. **The registry is 58.** The paragraphs above this section still count to sixty and are wrong to; the figures in items 16 and 17 are already figures about fifty-eight |
| 8 | Open — single-campus depth vs. multi-LMS breadth | **Partly answered, in the direction that needed no decision.** `lib/canvas.ts` (19 September) reads Canvas with a token the student issues themselves — depth on the LMS that matters most, with no institutional agreement and therefore without spending the decision this item is about. The breadth question is still open |

Filed against the market analysis rather than against this plan, and landed in
the same window: the start-time nudges (`720e6ce`), the camera door for a
syllabus on paper (`374d3e5`), the grade solver's four consumers (`8ea757b`),
and the deep link that answered before the course had arrived (`e9c7d73` — a
refresh or a bookmark on a course URL drew a different course entirely, twice
out of two). `COMPETITION.md` carries the verdicts on the first three.

**And the two non-code items moved while this was being written, which is the
same lesson twice.** This section was drafted against `b7f7c27` saying the
Vanderbilt IP question (#3) and the trademark search (#10) were exactly where
it found them. Both were rewritten in `#517`, merged at 13:41 on the 19th, into
[`IP.md`](IP.md) — a fuller treatment than the one this branch had written for
the same two items, with the deciding facts as a checklist, a ready-to-send
email, and the descriptiveness refusal under 15 U.S.C. §1052(e)(1). The
duplicate write-ups were dropped on the rebase and the entries above now point
at that file.

Two sessions reached the same two items within nine hours, neither knowing
about the other, and `CLAUDE.md` opens with exactly this. It cost a rebase here
because the overlap was prose; it is worth noticing that the same convergence
in code would have cost more.

---

## Tier 1 — do now

### 1 · The AI gate on first use · **Partly — the code half is fixed here**

> Onboarding's main call to action — "Add a course → upload a syllabus" — is
> itself blocked behind "NEEDS CLAUDE". A brand-new pilot student with no API
> key and no account hits a wall on the very first real action.

**Two-thirds of that is not what the screen does, and the last third was worse
than described.**

`screens/Import.tsx` has four doors in and three of them need no key at all:
paste the syllabus as text, open a course somebody shared with you, and add a
course by hand with no syllabus (`ByHand`, written for exactly this student —
"a student who joined a seminar in week two … or who simply never set a key,
could not add it at all"). All three are drawn above the gate. The screen was
not a wall.

What it *was*: the one screen of the six that need a key which drew its primary
button live regardless. `Essay`, `Deck`, `Exam` and `changes/FromText` all write
`configured() ? <ActionButton/> : <NeedsKey/>` — the gate stands *instead of*
the action. Import drew a full-width `Build the course from 8,412 words` and put
the gate underneath it as grey prose. Press it with no key and the files are
read, the wait is spent, and `lib/claude.ts` answers *"No key yet. Sign in to
use the shared one, or add your own under Settings"* into an error card:
directions, after the work, with no button on them. `components/NeedsKey.tsx`
exists to abolish that shape, and this was the one screen still drawing it — on
the screen `screens/FirstRun.tsx` sends every new account to first.

**Fixed in this change.** The gate now stands in the button's place, the
sentence names the two routes that need no key, and `screens/deadends.test.tsx`
pins both directions — no live build button without a key, and a build button
the moment there is one. The guard fails against a faithful revert.

**Still open, and not code:** whether the shared key is switched on for pilot
testers. `SETUP.md` and `supabase/DEPLOY.md` cover deploying the `claude`
function; until it is deployed for this project, `lib/claude.ts:133` tells a
student so by name. Decide it, then walk the syllabus-upload flow as a
zero-setup new user before inviting anyone.

### 2 · Account/login and multi-device sync · **Partly — built; the providers are a deployment step**

"Not yet formally scoped anywhere" is stale. `supabase/migrations/` carries the
schema, row-level security, rooms, records, calendar and push; `lib/cloud.ts`
and `components/Credentials.tsx` are the client half.

The live sweep's finding — Google/Microsoft/Apple sign-in each return "a
provider error" — is a configuration step that is already written down, in the
same words: `SETUP.md:268` *"Authentication → Providers, switch on what you want
… Until then those two buttons return a provider error."* Somebody has to go and
do it in the dashboard. Nothing needs building.

### 3 · The Vanderbilt IP question · **Sent — [`IP.md`](IP.md) §1; the reply in writing is what is open**

Unresolved, and everything downstream assumes the answer is no. Cheap to check
with Vanderbilt's tech transfer / entrepreneurship office, expensive to ignore.
Before pitching anyone for money.

**The policy was read and the position is written down.** Vanderbilt's
Technology Policy gives students ownership of work product created in the
classroom, and explicitly disclaims ideas made with commonly available
resources. Three exceptions decide this rather than the default: significant
use of University resources, university-administered **funding** — a prize or a
stipend is enough, and the policy says the student "would forego ownership" —
and university-supported research. §1 lists the five facts that settle which
side of that line Semester falls on, and carries a ready-to-send email that
*states* those facts and asks for confirmation, rather than asking an open
question that starts a review nobody needed.

**Sent, September 2026.** Still open, and not a code item: the answer in
writing. Until it arrives the order §1 argues for still holds — no university
money accepted before the reply.

### 4 · The simplify / merge pass · **Partly — the empty shells are already deferred**

Two halves, and they are in opposite states.

**The empty shells are done.** "Roughly 17 of the 60 destinations are empty
shells on first visit — hiding or clearly deferring them for new users would cut
the effective destination count dramatically." That is `lib/reveal.ts`, shipping:
a brand-new account sees **eleven** destinations of fifty-eight, and each of the rest
is unlocked by a fact about the semester rather than a timer — an exam runway
when there is an exam, the grade machinery when there is a grade, the reflective
screens when a week has happened. Visited screens never re-lock, search finds
everything whether or not it is unlocked, and the whole thing switches off in
Settings. Every screen the plan names by hand — Money, Meal plan, Housing,
Email, Registration, Career, Family, Athletics, Applications, Activities,
Personal — is outside `FIRST` and therefore already deferred.

**The duplicates are still real, for one of the two clusters.** Six
destinations still answer "what's due": Today, Reports, The week ahead, When you
are behind, Tonight, Progress (`lib/nav.ts`). The "where you stand" cluster has
already been worked — the Standing shelf was dissolved and Grades, Worked and
Proof are no longer top-level entries in the sixty.

So the open piece is the "what's due" merge, and `.claude/skills/simplify` is
the pass written for it. It is a real refactor, not a tidy-up, and it is its own
change.

**And it landed on 17 September, in `80fbc5c`** — "The question that was built
twice and kept once". `#/ahead` and `#/tonight` are two of Today's four tabs
now, and the registry is **fifty-eight**, not sixty. Noted here because this
file was checked at `88aa741` and the paragraphs above still count to sixty:
the registry is the number, and anything quoting it goes stale the moment a
merge lands. Every figure in item 16 below is a figure about fifty-eight.

### 5 · The assistant-button overlap · **Landed**

Already fixed, and guarded. `--bottom-chrome` is measured rather than assumed
(`lib/bottomchrome.hook.ts`), `--assistant-strip` reserves the button's whole
footprint under every screen, and `ai/clearance.test.ts` pins the two numbers
against each other in all three shells — it exists because a plausible-looking
fallback of 76px left 64px of the last card on Today under an opaque circle with
no scroll left to clear it.

Confirmed live at 420×900: the button sits clear of the last control, and
`pageerror` was empty.

Nothing to do. Do not re-tune the numbers — they have been argued for once.

---

## Tier 2 — this semester

Six items, five of which are not code at all — they are open because they are
unstarted, not because anything was found. The sixth (#11) is a label, and
this repository has already changed it.

Two of the five have had desk research done on them since (#8 and #10, and #3
in Tier 1). None of the three is closed by it: research is not the written
confirmation, the clearance search or the pricing signal each one is asking
for. What it does is make two of them cheaper to finish and one of them —
#10 — a different question than it was filed as.

### 6 · Test willingness to pay directly · **Open**

Every one of the ten direct competitors is free or under $10/mo and the research
says students expect free. A soft paywall on one feature, or direct interviews —
a real signal, before more premium features get built.

### 7 · Test the ambassador GTM model · **Open**

Flagged in the project's own docs as the untested, load-bearing assumption.
Recruit a handful this semester; measure installs-per-ambassador and 30-day
retention, not signups.

### 8 · Single-campus depth vs. multi-LMS breadth · **Partly — depth arrived without the decision having to be made**

Raised in the market research, answered nowhere. It decides where the next
quarter of engineering time goes, so it blocks planning rather than building.

**One side of it moved on 19 September without spending the decision.**
`lib/canvas.ts` reads Canvas with an access token the student issues
themselves, which is depth — assignments with their submission state, the thing
a calendar feed cannot carry — on the LMS with the largest share of the market
this app is aimed at, and it needed no institutional agreement to get. The
whole reason this item blocks planning is that the breadth road costs
partnership conversations per campus; the self-serve token route is the one
piece of depth that costs none.

So what is left open here is narrower than it was, and worth restating as the
question it actually is: **not** "depth or breadth", but "is a second
LMS's self-serve route worth building before there are students on the first
one". That is a question about pilot evidence rather than about engineering
strategy, and it should wait for the pilot rather than be decided now.

### 9 · Reconcile the financial model · **Open**

License fee $25K vs $100K; premium $6–7/mo vs a flat $72/yr; infrastructure
$7.80 vs $3.00 per user per year; conversion 10%/12% vs 9%/10%. The most likely
thing a numerate investor catches. Both documents live in the project folder,
not in this repository.

### 10 · USPTO trademark search on "Semester" · **Answered ahead of the search — [`IP.md`](IP.md) §2**

Cheap, fast, unchecked. `tmsearch.uspto.gov`.

**The search is still unrun — the databases are blocked from the container this
was written in, and a clearance search nobody ran is not one to report.** But
the search was the second question. The first is whether the word is
registrable at all, and it very likely is not: "Semester" for software that
plans a semester is *merely descriptive* under **15 U.S.C. §1052(e)(1)** and
can be refused with no prior mark in sight, generic at worst. That holds
whatever a collision search turns up, which is why it is worth having before
one. §2 has the four routes out, a recommendation, and the fifteen-minute
search to run for the *infringement* question, which is the separate and more
urgent one.

One concrete hit from a desk check on 19 September, recorded here because it is
the kind of thing the search will want to start from rather than rediscover:
**`SEMESTERWARE`, Reg. 3195876 (2007), for educational software.** Adjacent
rather than obviously fatal, and it does nothing to the descriptiveness point
above — which is the point that section is making.

### 11 · The Exam Runway status · **Landed in this repository; open outside it**

Already corrected here, at length: `COMPLETION-PLAN.md` §4.3 carries *"the draft
said Planned; it is not"*, and the table at line 624 files it Partial against
`lib/runway.ts`, `lib/covers.ts` and `screens/Runway.tsx` — 1,189 lines and a
three-source coverage engine. No audit file in this repository still says
otherwise.

What is left is the pitch deck's slide 8 and the executive summary's "WHAT'S
BUILT" section, which are in the project folder. A label, not a feature.

---

## Tier 3 — before scaling past the pilot

Real, none of it urgent, and the last one has measurements attached.

| # | Item | State |
| --- | --- | --- |
| 12 | Data-retention schedule | **Written and now decided — [`RETENTION.md`](RETENTION.md).** It was never absent, only scattered, and the privacy page already *promises* no schedule over a student's work, so the job was recording the decision rather than inventing one. The one thing genuinely open — `sweep_tombstones`, written and called by nothing — is **scheduled**: weekly at 90 days, as the `tombstones` job in `supabase/scheduler.sql`. **Applied — `tombstones` read active on `17 4 * * 0` off `cron.job` on 22 September.** The `push` job beside it is still parked, because `CRON_SECRET` is still unset on the function (measured: `503 "not configured"`); `supabase/DEPLOY.md` has the two remaining steps. `lib/retention.test.ts` is the bidirectional tripwire and pins the interval across all three files |
| 13 | Data-access audit log and a formal incident-response process | **Both landed — see below.** The commitment was one sentence about the last step; it is now [`SECURITY.md`](SECURITY.md), and the log it depends on exists |
| 14 | A staging environment | **Gated, and the gap was worse than a missing URL.** `pages.yml` and `ci.yml` both fired on push to main independently, so a commit that failed CI deployed anyway. Pages now runs on `workflow_run` and deploys only a CI run that passed, pinned to `head_sha`. CI also opens every course address cold in a real browser against the production build (`smoke:cold`) — the class the deep-link bug was in |
| 15 | Multi-vendor AI redundancy | **Partly** — `lib/assistant.ts` already routes to OpenAI as a second provider, and `ask()` is the one branch in the app that knows there are two. The open part is a *policy*: which vendor answers when, and who decides |
| 16 | An app-wide accessibility sweep | **Taken, both instruments, every destination — the numbers are below.** Both tools need Playwright pointed at the container's Chromium (`.claude/skills/run`) |

### 13 · The audit log, and the process it feeds

Two halves that read as one item and are not. The process was a sentence — the
owner would tell people the same day — which is a commitment about the step
that comes *last*, with nothing in front of it about rotating a key, closing
the way in, or working out what happened. [`SECURITY.md`](SECURITY.md) is the
rest of it, in [`ROLLBACK.md`](ROLLBACK.md)'s shape: a named owner, three kinds
of incident with a different first move each, every secret this project holds
with its blast radius and how it is revoked, the one containment lever that
needs no deploy (`select public.set_invite_only(true);`), and what the records
can and cannot reconstruct.

`app/src/lib/security.test.ts` is the tripwire, and the useful half of it is
bidirectional: **every environment variable an Edge Function reads must appear
in the document, and every variable the document names must be one something
reads.** The first direction catches a function added later whose secret
nobody knows how to rotate. The second catches the more dangerous drift — a
row in that table for a key nothing uses sends somebody to rotate something
harmless while the live one is still out. Both were checked by mutation: a
fabricated `Deno.env.get` in `push` turns it red, and so does a fabricated
entry in the table.

**The log was the harder half, because the app had argued against it.**
`functions/calendar/index.ts` said, in its own header: *"It will not write. Not
a read receipt, not a hit counter — a feed polled by four devices every four
hours is a write every twenty minutes for the life of the account, and it would
buy nothing."* That is reversed, and only half of it was wrong. A hit counter
does buy nothing. But the same review says three paragraphs earlier that
whoever holds a published link reads the deadlines *"indefinitely, until it is
replaced"* — and the Export screen has had the replace button all along with
nothing that would ever make a student press it. A leaked link and a private
one are identical from inside the app. The single place they differ is in what
is asking: **a calendar subscription is fetched by a calendar, and a person is
a browser.**

So `public.access_log` records the two paths in this project that go around
row-level security — the feed served by token, and the reminder sender run by
the scheduler — and the policy on it makes the log readable by **the account it
is about**, which is the difference between an audit log and an operator's
private diary. One row per account per day per client family, never a
user-agent string, never an address, never the token; the family is one of
seven words and the table's own `check` constraint is what enforces that rather
than a habit in a function. `read_feed` does the lookup and the note in one
statement so that the Edge Function still never learns whose calendar it just
served — the property its old `select` was written to have.

**Measured, by `supabase/check.sh access` against a real Postgres with every
migration applied: 29 checks.** Nine mutations of the migration were run
against them and all nine go red — an added insert policy, a widened select
policy, a dropped delete policy, a dropped client vocabulary, a prune that
keeps everything, a `read_feed` that returns `user_id`, one that notes unknown
tokens, and the execute grant loosened at either end.

Two of those mutations are the reason the number is worth anything, because
both passed first:

- **The PUBLIC revoke was untested.** The check called `note_access` as
  `authenticated` and expected a refusal, and got one — from row-level security
  one layer further in, not from the missing grant. It passed against a
  migration revoking from `anon, authenticated` by name, which is the exact
  hole `invites.check.sql` caught once already. It asks `pg_proc` now.
- **The unknown-token check counted rows.** A `read_feed` that noted every
  unknown token against a real account produced no new row, because the note is
  an upsert and the family was one already present. It asserts the total hits
  as well, with a family nothing else uses.

What the student sees is one sentence beside the link, and it says the day:
*"Fetched 42 times in the last 30 days, mostly by Apple Calendar — and 2 of
those were a web browser, most recently on 2026-09-14."* It stops short of
saying the link leaked, because opening your own feed once is a reasonable
thing to do and the QR code beside it makes that likelier.

### 16 · The contrast sweep, across all sixty

The plan said *"the 93-of-166 contrast finding is from one sampled screen — the
true number across all 60 is unknown"*, and it was worse than that: the
instrument could not have answered. `scripts/contrast-sweep.mjs` had six screens
written out by hand, so every contrast figure in this repository was a figure
about a tenth of the app, printed under a `FINDINGS:` heading with nothing
beside it to say so. Its sibling `targets-sweep.mjs` had walked the registry
from the day it was written; the two disagreed about what this app contains and
neither said so. Both read one list now, and every run prints how many of the
sixty it opened.

**The number, taken 17 September 2026.** Every destination, all thirteen
grounds, both widths, resting states, one navigation — 1,560 passes, **64,944
elements measured**, 60 of 60 destinations opened and each one proved from what
it rendered rather than from the address the sweep had just written.

**88 findings, which are four elements on two screens**, and the two are not
the same kind of thing:

- **26 of them were the probe.** `screens/Ahead.tsx` holds a `·` at
  `color: transparent` on purpose — a spacer keeping the width of the column
  that carries a day's due-dot, so rows do not shift sideways as days gain and
  lose one. Invisible text has no pair and cannot fail, and the audit was
  scoring it 1.00:1 on every ground: the worst number it can print, for a run
  nobody can see. It is counted apart now, beside the gradient and skipped
  counts that were already there.
- **62 of them were the map credit, and it is the mistake `CLAUDE.md` keeps
  a standing warning about.** The credit's ink was `--app-faint`, which follows
  the ground and turns *dark* on a light one, while its box was a fixed dark
  `rgba(10, 11, 14, 0.72)` — 28% transparent, so on a light ground it
  composited to a mid grey. Dark ink on mid grey: **1.45:1** on `industry`,
  1.50 on `fog`, and 3.67:1 even on `ink`, which is the ground it was
  presumably chosen against. app.css's own comment says why this one matters
  more than most — *"the credit is the licence"*. Both ends of the pair are
  pinned to the box now rather than to the ground, at 6.01:1 and 10.30:1.

**Two things this run could not close, recorded rather than rounded off:**

- One pass of the 1,560 (`industry`, phone) could not prove it arrived and
  measured nothing. Which screen is not in that run's output, because naming
  the screen in that line landed after the run had started. A re-run names it.
- Two `useStore must be used inside StoreProvider` page errors appeared during
  the 780-pass phone walk and did not reappear — not in the 780 desktop passes,
  not in a 240-screen replay across four grounds, not with `src/` being written
  under the dev server while it walked. They are unattributed, and guessing at
  a cause would be worse than saying so. The sweep records the screen and the
  ground with a page error now, so the next one names itself.

### The targets half, taken 18 September 2026

`sweep:targets` walks every destination on a phone and a desktop, with five
controls of known size measured by the same code before each tier so a broken
probe fails the run instead of reporting a figure.

| | Phone 420×900 | Desktop 1280×900 |
| --- | --- | --- |
| destinations opened | **58 / 58** | **58 / 58** |
| under 44px — 2.5.5, an aim | 810 / 1,480 (55%) | 1,425 / 2,082 (68%) |
| under 24px — 2.5.8, the bar that is a failure | 3 | 3 |
| text under 12px | 1,161 / 3,067 | 1,471 / 3,739 |

**The three under 24px are the same three on both tiers, and none of them is a
control anybody can miss:** Leaflet's map container and its two zoom buttons,
each reading `0x0 BLOCKED under role=status` because `components/LiveMap.tsx`
paints a panel over them at z-index 1200 saying the map needs a connection.
They read as failures because a covered control has no hit area at all, and 0
is under 24. Counting them is the instrument being careful rather than wrong —
it names the cover, and naming the cover is what tells a deliberate overlay
from a fault. **Genuine failures of 2.5.8: none, on either tier.**

`COMPLETION-PLAN.md` §9 said those three were "counted in neither column" and
printed 0 in the table. The tool does count them, and always has —
`targets-sweep.mjs` scores a blocked control by its hit size. The conclusion
there was right and the sentence under it was not; both are corrected there.

**The run found a defect in the instrument, which is the second time this
month the arrival check has earned itself.** The first tier came back *"57 of
58 destinations opened, 1 not reached: home (saw Semester)"*. `home` is the one
screen whose component is a function of the *navigation* rather than of
`state.screen` — `lib/chrome.ts`'s `homeShape` returns four shapes — and
`targets-sweep.mjs` seeds `nav: 'springboard'` on purpose, which draws the
springboard and its "Semester" heading. Held to the registry's label ("Today")
the check called it unreached and skipped it: one destination silently out of
the walk, dropped by the check written to stop screens being dropped silently.
All four headings are measured and recorded now (Today · Everything · Semester
· Guides), and the figures above are the re-run with `home` back in it — the
phone tier moved from 799/1,454 to 810/1,480 by its return.

### 17 · The UI pass · mixed, and two of the five numbers have moved

- **Contrast — closed, and it was two rather than 85.** Re-run on the
  instrument the 85 came from (`scripts/paint.mjs`, sixty screens on Ink and
  Fog, `APP-AUDIT.md` §"What the branch leaves behind"): **2 runs of text
  below AA**, both on Fog, both now fixed. The same run is 0 today, exit 0.

  This entry pointed at the 185 hand-written dim values `npm run lint`
  counts, and that count is real but is not this number and does not produce
  it. Neither of the two findings was a hand-written `opacity`: both were
  `--app-accent-deep`, which `lib/contrast.test.ts` holds to 4.5:1 and which
  *passed* — against `--app-bg`, which is not the surface the text was on.
  The surface was `--app-bg` with half the primary button's drop shadow over
  it, and a shadow is in no ramp, so no token audit could have seen it.

  **The bigger find is why nobody had re-measured.** `paint.mjs` — the half
  that samples the screenshot and so is the only instrument that can see text
  on a gradient or under a shadow — imported `playwright` bare and could not
  run in this container, in CI, or anywhere without a global install. Its
  sibling `contrast-sweep.mjs` had solved exactly that and written down why;
  the fix never reached it. Meanwhile that sibling reports ~2,000 elements a
  pass it declines to measure *and points here for them*. Fixed.

  `CLAUDE.md`'s standing warning for `lib/look.ts` still applies and wants one
  more clause: measure a fade against every surface a ground has — and a
  shadow is a surface.
- **The list row — was open; the migration half is done.** `Rows.tsx` is the
  shared row and 21 files use it: `Group` 62 times, `CustomRow` 54, `ItemRow`
  29, `NavRow` 15.

  This entry hedged that `space-between` was "one proxy rather than the
  audit's own definition", and it was right to: the audit's own definition is
  `borderBottom: '1px solid var(--app-line)'`, and `ENGINEERING-AUDIT.md` had
  attributed that count to the `space-between` grep. Measured on the real
  pattern: **24 across 20 files**, down from 74 across 41.

  What remains is short. **Not one** of the 68 hairline-setting style objects
  retypes the shared row's padding-and-hairline pair, and most of the rest are
  compact lists that differ on purpose — converting those would change their
  layout, which is what `CustomRow` exists to avoid. Asked instead for
  `ItemRow`'s own shape — meta stacked *under* the title — the tree had four;
  two are converted (`screens/call/Lobby.tsx`, `components/ForThis.tsx`) and
  two are the call room's dense chrome. `components/shell/rows.shape.test.ts`
  keeps the retyping from starting again.
- **Counts on calendar day-dots — closed.** `lib/monthgrid.ts` gives a day with
  more than one thing on it a number rather than an unlabelled cluster, which is
  what `COMPETITION.md` §7 records. This line said "not checked in this pass"
  for one pass longer than it was true.
- **Visual hierarchy in the Study button wall — closed, and the second half was
  the real one.** The row of six was deleted in PR #503, which found they were
  aliases rather than a hierarchy problem. What `COMPETITION.md` §8 then left
  open — *"the hierarchy is local rather than designed — each section decided
  its own emphasis"* — turned out to be measurable and true, in one place.

  **Measured across all fifty-eight destinations at phone width, from what
  Chromium drew: zero walls, and one screen offering more than one filled
  action.** That screen was Study, with five — the studio entry, plus a
  `tone="primary"` recommendation in each of four course cards. Because
  `lib/nextstep.ts` gives a course with nothing started the same answer as the
  next one, the four were not four offers: they were the words **Start reading**
  in filled white, four times, down one phone screen. Each card was locally
  right and the screen had no answer at all, which is the sentence above stated
  as a number.

  The recommendation is `btn-secondary` now — still first in its card, still
  full width at 44px, still above the small uppercase alternatives. One word,
  and the screen went from five filled actions to one.

  `scripts/wallsweep.mjs` is the instrument, and it got four things wrong before
  it got this right: it flagged the app's own tab bar (which marks the current
  tab with `aria-current`), it flagged a correctly-ranked row whose primary was
  one element outside the parent it was looking at, and — the one that would
  have done damage — it reported four new walls the moment the fix landed,
  because it knew only the top rung and not the middle. A probe that reads
  `btn-secondary` as unranked argues for putting five filled buttons back.
- **"Default new users to the tab bar" — already answered, differently.** The
  app does not present six navigations as equal choices: it opens as `guides`,
  and `lib/types.ts` says why — it is the only one that treats a *course* as the
  top level rather than a screen. `lib/chrome.ts` is the single rule that decides
  which navigation is drawn, and `chrome.test.ts` asserts no two are ever drawn
  together. Changing the default to `tabs` would be re-deciding something that
  was decided with an argument. If it should be re-decided, that is a product
  call with a reason, not a UI nit.

---

## What this buys

Tier 1 protects and unblocks, and two of its five items turned out to be
already-protected. What was genuinely exposed was narrow and is fixed: the first
real action a pilot student takes no longer offers a button that cannot succeed.

Tier 2 is where the odds actually move, and none of it is in this repository.
It replaces assumptions — willingness to pay, the ambassador model, the
credibility of the financial model — with evidence. Tier 3 is what gets cleaned
up once Tier 2 shows the model works; doing it earlier is effort spent on a
business that might still turn out not to have product-market fit.

The one thing worth carrying out of this pass is the habit rather than any
item: **check the claim against the code before scheduling the work.** Seven of
seventeen came back different, and the two marked Landed would each have been a
week spent rebuilding something that was already there.
