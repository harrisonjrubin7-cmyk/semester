# The competitive review, checked against the code — September 2026

The tracked record of *Semester — Competitive review and implementation plan*
(prepared 17 September 2026), an independent product assessment that compares
this app against seventeen products, walks eight of its screens, and proposes
a backlog in four priority bands.

It is the **second** outside document filed here, and it is not the one
`COMPETITION.md` holds. That one was *Semester vs. the Competition*, ten
competitors and nine proposals. This one is longer, pins the same source
snapshot (`3287929`), and reaches different findings — so the two are filed
apart rather than merged, and where they agree that is said.

Filed for the reason `ACTION-PLAN.md` gives for its own existence: **every item
that names something about this repository was checked against the code before
it was filed.** That habit has now been run three times against three outside
documents, and this is the first time it has come back with a **defect**.

**Checked against `5e7f9eb` on 18 September 2026.** Every verdict names what
was measured and where, and every file and line quoted below was opened rather
than inferred.

Legend: **Open** · **Landed** (built here) · **Already built** (was already in
the app; nothing to do) · **Declined** (checked, and deliberately not done) ·
**Not a code item**.

---

## The headline: the review found a real bug, and it was right

Every previous outside document filed here has been a list of proposals, and
the checking has mostly returned *already built*. This one contains a finding
of a different kind, stated in four lines in the middle of step 4:

> **Code finding:** `Study.tsx` dispatches `finishSession` as a planned session
> is opened, before `startStretch`. The session model calls `doneAt` a finish
> time. Opening and abandoning a session can therefore count as completion.

That was true, it was still true at `5e7f9eb`, and it is fixed here.

What makes it worth the length below is that it was **not an oversight**. The
line had a comment arguing for it, and the screen that drew the result had a
docstring arguing the opposite:

```
// Started counts as done. A sitting you open and abandon is a sitting
// you did some of, and a plan that only counts a finished deck is a
// plan that says you did nothing on the night you did twenty cards.
dispatch({ type: 'finishSession', id: session.id, at: Date.now() });
```

…in `screens/Study.tsx`, one line above the drill. And in
`components/Plan.tsx`, the component whose rows that line was firing from:

> ## Why there is no tick box
>
> A sitting is finished by doing it. […] a checkbox beside it would be a
> second, easier way to make the plan say you had studied, and a plan you can
> satisfy without studying is a plan that measures nothing.

**The row was the tick box.** The component documented the rule and the screen
behind it broke the rule, and the two files had been that way long enough for
both comments to read as settled. The argument in `Study.tsx` is about a
student — someone who opens a sitting has usually done some of it — and the
line it justified is about a *record*, which could not tell that student apart
from one who tapped a row and pressed back. Both wrote the same `doneAt`.

So the plan's only real measurement was **which rows had been tapped**, and
every consequence of that is a sentence the app says to a student:

- `missed()` in `lib/sessions.ts` filters on `!s.doneAt`, so a sitting opened
  for two seconds on Monday was never missed on Tuesday. The missed banner —
  which `Plan.tsx`'s own docstring calls "the whole feature" — could be
  emptied by tapping.
- `onDay()` filters the same way, so the row vanished from the evening it was
  planned for, and the day read *All done*.

An outside reviewer found this by reading the source. Nothing inside the
repository could have: the tests passed, and they passed **vacuously** — every
session in them was done the moment it was seen.

### What replaces it

Two facts instead of one, and completion earned by work:

| Field on `Session` | What it is |
|---|---|
| `startedAt` | when the sitting was opened. New. |
| `answered` | cards actually answered in it. New. |
| `cards` | how many it was **sized for** — its planned questions. New. |
| `doneAt` | unchanged in meaning, and now written only by answers. |

`progressOf()` reads them back as one of four states — `planned`, `started`,
`partly`, `done` — which is the vocabulary the review asked for, and the two in
the middle are the ones that make the outer two mean anything.

The mechanism is three changes and no new screen:

1. **`startDrill` carries the sitting it was opened for.** `Study.tsx` now
   makes one dispatch where it made two, and that dispatch starts the run and
   says which sitting the run is for. A drill started anywhere else — the
   ranking below the plan, a course guide, the gap filler — carries no sitting,
   and `state.liveSession` is `null`. That is deliberate: a run on the same
   unit from the ranking is real study and it is *not this sitting*, and
   crediting it because the two happen to name one unit would be the same bug
   with a longer fuse.
2. **`markCard` counts the answer against the open sitting** and stamps
   `doneAt` on the one that reaches `cards`. This is the only place a `doneAt`
   is now written by a student studying.
3. **A spent deck finishes it too.** A unit can hold fewer cards than the
   sitting was sized for a fortnight ago — some answered in a gap run, some
   deleted with the reading they came from. Without this the sitting would stop
   one short and the plan would report a missed evening on the night the
   student emptied the deck.

`undoCard` takes the credit back, `doneAt` included. Without that, the last
card of a sitting could be answered, taken back, and still have finished it —
the same bug, one card wide.

**The row says what it knows.** A sitting nobody has touched carries no note; a
sitting opened and abandoned says *opened, nothing answered yet*; one part way
through says *7 of 12 cards*. Said as a count, because the count is the
evidence and "in progress" is a label that could be printed over anything.

### What the old stamps do

**They stand.** Every `doneAt` in a student's storage right now was written by
opening a row, and none of them can be shown to be study — but none can be
shown *not* to be either, and rewriting somebody's term to say they studied
less than their app has been telling them all term is the one outcome worse
than the bug. The rule changes from here. This is the review's own instruction
(*"Historic doneAt values cannot retrospectively prove completion; do not
fabricate missing history"*) and it is pinned in `state/storage.test.ts`.

One consequence is worth naming: a sitting from before this change has no
`cards`, so it **cannot** be finished by counting to a number it never had. It
finishes when its deck runs dry, which is why that second rule is not optional.

### How it was proved

Per `CLAUDE.md`, a guard that has never failed is not known to be a guard.
Every case was run against a faithful revert — `startDrill` stamping `doneAt`
the way `Study.tsx` used to — and **ten of them go red there**, including the
three that state the bug in the student's own terms: opening does not finish
it, the count is the real work, and last night is still missed this morning.

Driven in a browser at 420px as well, because the suite cannot see a row:

- Plan rows draw all four states, and the missed banner still counts the one
  sitting that was actually missed.
- Tapping a row opens the drill and the sitting is **not** done; backing out
  without answering leaves *opened, nothing answered yet*.
- Four real answers against a sitting sized for four turn the day to *All
  done*.
- Two answers against a sitting sized for four read *2 of 4 cards* — and still
  read *2 of 4 cards* after a reload.

`pageerror` was empty on every run.

---

## The eight-step review of the app

### 1 · Directory — "discovery is crowded" · **Partly landed — two of four were already built, two were open and are done**

Taken item by item, because the four proposals in this step do not have one
verdict between them:

- **"Provide a result count"** — **Open, and landed.** There was none. While
  filtering, the screen now says *10 of 58 apps* in a `role="status"` region,
  because the list below it changes under a screen reader with nothing said
  about it otherwise. Hidden when nothing is narrowed: *58 of 58 apps* over the
  whole directory answers a question nobody has asked.
- **"…and a clear recovery action"** — **Open, and landed.** The dead end said
  *Nothing here matches that* and left you holding a filter you would have to
  find and empty yourself — one of the two controls being a category chip you
  may not remember pressing. There is now a **Show them all** button beside the
  count, and the empty state names it.
- **"Replace repetitive favorite-category text with the registry's existing
  descriptions"** — **Open, and landed**, and the review is exactly right about
  why it was worth doing. The second line of a favourite card was `d.group`, so
  a row read *Semester · Courses · Study* — the least distinguishing thing
  about three screens, under names the chips below already group. The sentence
  was in hand the whole time: `saysFor()` returns it, and the card was passing
  it to `title`, which is a tooltip, which is **nothing at all on a phone**.
  One word changed; the cards now say what each screen does.
- **"Use a proper page heading (H1)"** — **Already built, and the patch would
  have regressed it.** The app shell prints the screen's name as the page's
  `<h1>` for every screen (`App.tsx:351`). `screens/settings/Page.tsx` carries
  the scar in its own docstring: that page *did* add a second `<h1>` of its
  own, and the two was the bug. Adding one to the directory would have put it
  back.
- **"Put the local filter directly below the heading"** — **Declined**, with
  the reasoning the file already holds. The three standing lists are hidden the
  moment anything is typed, and `Directory.tsx` says why: somebody typing has
  stopped asking *where was that* and started asking *where is the thing called
  this*, and lists that ignore the filter above a list that obeys it read as a
  bug. So the filter is never *below* content it competes with — the content
  steps aside. The report's concern is real and it is already answered; moving
  the box would trade an argued design for an untested one. Worth revisiting
  with the five-student test the report proposes, which is the evidence neither
  of us has.

**58 destinations is right.** The report noticed the directory change from 60
to 58 mid-review and pinned the refreshed figure. This repository has now got
that number wrong twice in its own documents in the other direction — see *A
fourth row that was not wrong* in `COMPETITION.md` — so the correction is
recorded here rather than argued with.

### 2 · Today — "weak first-use reassurance" · **Already built**

The sample banner, the labelling, and the count-what-is-actually-there
onboarding all landed earlier, and `screens/Onboarding.tsx` carries the reason
in its own docstring: the first two screens used to say *"We found 38 dated
obligations across four courses"* before anything had been uploaded. *"The
first thing the app said was false, which is a bad way to be trusted with a
semester."* The remaining half — leading a real account with one achievable
next action — is a design question, not a defect, and is left open.

### 3 · Study entry — "too many decisions before practice" · **Open, not done here**

Fair, and a layout decision rather than a correctness one. `lib/revise.ts`
already ranks and `planFor` already sizes an evening, so the *Continue / 10 ·
25 · 45* default the report asks for is a rearrangement of things that exist.
Left for a change that can be tested against the usage data the report
recommends collecting, rather than bundled behind a defect fix.

### 4 · Revision — "progress semantics need work" · **Landed.** See the headline above.

### 5 · Calendar intake — "the claim that a feed carries every due date is too broad" · **Open, and landed**

Correct, and it was in three files.

`screens/Connect.tsx` told the student, in the app's own plain-speaking voice:

> the **calendar feed** carries every due date and needs nothing but the link.

It carries what instructors put on the Brightspace calendar. That is most of a
term and it is not the syllabus, and the gap is **invisible from inside the
app** — the student sees a full-looking calendar beside a promise that it is
complete, and finds out which one was wrong in week nine. The sentence now says
what a feed holds, that it is not always everything on the syllabus, and that
it never says whether anything has been submitted.

### 6 · Provider connections — "overstates the impossibility of richer access" · **Open, and landed**

The sharper of the two corrections, and the one that is easiest to defend the
wrong way. The same paragraph said:

> no app you install can read them on your behalf, however it asks.

Grades and submissions genuinely are out of reach today. The reason is not
impossibility: D2L documents registered OAuth applications, scopes and
user-context permissions, so a school that registered this one could grant
them. **Nobody has asked Vanderbilt.** Saying it cannot be done closes a door
the app would like to walk through during a pilot, and tells a student
something about their own university's systems that is false.

The copy now names the missing thing as a permission nobody has requested, and
— this is the part that matters — **still says the answer today is no**. A
correction that becomes an implied promise is a second false sentence.

The claim lived in two more places and both are corrected: `lib/connect.ts`'s
module docstring and `screens/Courses.tsx`'s `LmsLink`. Fixing one of three
would have left the app disagreeing with itself, which is the failure mode
`COMPETITION.md` records under *the five copies of one calibration*.

All of it is pinned in `screens/lmsclaims.test.ts`, by the words rather than by
their shape, because the failure is a sentence somebody rewrites while tidying
the copy. The probe carries a **control** — `lib/guidebook.ts`, which describes
what the app asks of a student and makes no Brightspace claim — for the reason
`CLAUDE.md` gives: a probe with no control that convicts everything it looks at
is indistinguishable from a broken probe. It was run against the old wording
and goes red there.

### 7 · Add a course — "late explanation of AI requirements" · **Already built**

`ACTION-PLAN.md` item 1 carries this at length: `screens/Import.tsx` has four
doors in, three need no key, and the gate stands in the primary button's place
rather than under a button that cannot succeed. `screens/deadends.test.tsx`
pins both directions.

### 8 · Calendar use — "room to connect planning" · **Open, not done here**

A compact phone agenda and *work to schedule* beside the calendar. This is the
P1 scheduling item in smaller clothes and belongs with it.

---

## The backlog, band by band

Each verdict is about whether the *claim* is true of this code, not about
whether the proposal is good.

| Band | Item | Verdict |
|---|---|---|
| P0 | Repeatable first setup | **The term half landed; the rest was already built or stays open.** The manual route and the key-free doors were already there. The *term* was not asked at all — it was a constant, correct in the week it was written — and it is now the first thing on the school step. The three-step shape itself (add course → confirm dates → first action, inside the run) is still open. See below. |
| P1 | Make tools easy to find | **Partly landed.** Three of the patch's five items above; the filter move declined with reasons; user testing is not a code item. |
| P1 | **Make progress mean actual progress** | **Landed.** The defect. |
| P1 | One calendar integration, then one LMS | **Not a code item here.** Provider registration and an institutional agreement. The copy that misdescribed it is fixed above. |
| P1 | Schedule work into real availability | **Open.** The largest genuinely-new item in the document, and correctly sequenced behind trustworthy calendar input. |
| P1 | Carry exact source locations | **Landed, and the claim was exact.** The three locators still say what is true of the original — a prepared unit and a pasted excerpt have no page — but a citation now names the place inside the source it was found at. See below. |
| P2 | Mistakes into the next practice session | **The prerequisite landed; the loop is still open.** The claim was exact — `cardKey()` was FNV-1a over the *question text* — and the report was right that stable ids come first. They are in: all 325 shipped cards carry one, minted as the hash they already keyed on, so nothing stored moved. The closed loop itself — error → concept → scheduled revisit → measured improvement — is what is left. See below. |
| P2 | Offline, sync and reminders | **Open, and the claim is exact.** `HORIZON_DAYS = 7` in `lib/push.ts`: *"How far ahead to queue. A week is enough to survive a phone left in a bag."* The report's question — what happens after longer inactivity — is not answered anywhere. |
| P2 | Shared coursework with a small group | **Open.** Needs two real accounts, which is the report's own acceptance criterion. |
| P3 | Lecture capture, career discovery | **Open, and correctly deferred.** |


---

### Repeatable first setup — the half of it that was a constant

The report asks for **school + term** before anything else. The school has
been asked since the first run existed. The term never was: `state.term`
started life as `LEGACY_TERM`, whose own docstring calls it "the term every
course saved before terms existed belongs to" and "only ever a fallback". It
was doing two jobs, and it only does one of them correctly.

Measured on the real `loadPersisted`, with nothing stored:

    opened Mon Sep 21 2026 · app says 2026FA · actually 2026FA
    opened Wed Feb 03 2027 · app says 2026FA · actually 2027SP
    opened Thu Jun 03 2027 · app says 2026FA · actually 2027SU
    opened Sun Jan 09 2028 · app says 2026FA · actually 2028SP

`lib/term.ts` has always had `termNow` — *"the term a date falls in, for
defaulting a new course sensibly"* — and outside its own tests **nothing
called it**.

This is not a label. `screens/Import.tsx` stamps every course it adds with
`state.term`, and `yearFor` resolves a bare month against that term's own
start month, so a September deadline filed under Fall 2026 is a deadline a
year in the past. And `components/TermSwitch.tsx` is deliberately absent until
there is more than one term — an argued decision, and the right one — so a
student in that state has nothing on screen to correct it with.

**Two changes, and the control is the half that must not move.** A fresh
install now starts in the term of the day it is opened, through both doors
onto a first install (`state/shape.ts` and `state/persist/index.ts`; fixing
one would have left the path this build actually takes still in Fall 2026).
The constant itself stays exactly where it was, because a *saved* state with
no term was written before terms existed and its courses really do hold Fall
2026 dates — filing those under today would move every deadline in them by a
year, which is the failure `LEGACY_TERM` exists to prevent. Both directions
are asserted.

Then it is asked. Step 3 of the run becomes *"When and where do you study?"*,
with the calendar's guess preselected among its neighbours rather than assumed
— because the two cases a first run actually meets are the ones the calendar
gets wrong: setting up in December for a term that begins in January, and a
summer session the calendar has already called Fall.

Driven in Chromium at 420px, `pageerror` empty: the row draws with Fall 2026
selected, `data-more="end"` so the app's own overflow affordance is doing its
job at 477px of chips in a 354px row, and choosing Spring 2027 survives a
reload — read off the screen rather than out of `localStorage`, which this
document's own last section explains is the wrong store to ask.

**Still open, and it is the larger half:** the run ends and hands an empty app
to `FirstRun` rather than carrying somebody through add-a-course, confirm the
dates, and a first task. That is the "three-step shape" proper.

---

### Carry exact source locations — what landed, and what did not

The studio has always *found* the place a quotation sits and then dropped it.
A citation is only accepted because `normalized(source.text)` **includes**
`normalized(quote)` — a search that knows the index and returns a boolean. So
the app could tell a student the quotation was somewhere in their material and
not where, and the panel that showed the evidence printed the entire source
underneath for them to find it by eye.

`locateQuote` in `lib/studystudio.ts` keeps the index, in the *source's own*
offsets. That is the whole difficulty: normalized offsets are not original
offsets, because NFKC expands (ﬁ → fi), `toLowerCase` can expand, and — the
case that matters, since models quote sentences the source wrapped — a run of
whitespace collapses to one space. The map is therefore rebuilt one original
character at a time. `quotelocation.test.ts` pins a line-break quote that a raw
`indexOf` cannot find at all, and a ﬁ quote where a normalized offset used as
an original one lands mid-word and reads back *wrong* rather than absent.

**What did not change is the sentence the report quoted.** A prepared guide
unit has no page; a pasted excerpt has no page; an upload with no page
structure has no page. Rewording those three locators would have been the
cosmetic fix, and the report's own standing instruction — never hide "page not
recorded" — argues against it. They still say it, and a citation from one now
reads *Prepared course guide · Unit 1; original page not recorded · characters
27–65*, with the quotation marked in place in the panel rather than a wall of
source text beside it. The honest half of the old string is kept; the useless
half is answered.

**The controls are two, and the second is the one that matters.** A quotation
that is not in the source must come back with no span *and* still be refused.
And a quotation only the looser whole-string check can match — NFKC composes
"e" + U+0301 into "é" across characters, which a per-character map cannot —
must still be **accepted**, with no location. A locator that becomes a new way
to reject a true citation is worse than the gap it closes, so the strict search
decides where, and the loose one goes on deciding whether.

### Stable card ids — the prerequisite, and the measurement that nearly stopped it

`cardKey` hashed the question and nothing else, and the docstring above it
argued for that: a materially different question deserves to be re-learned.
The argument is not silly and it is not what happens. The app cannot tell a
rewrite from a rewording, so it answers both with the harsher of the two — a
typo fixed in a guide, a sentence tightened, a question asked in clearer words,
and the row holding what a student knew becomes one nothing will look up again.
Silently: no message, and the unit's mastery figure quietly falls back to the
estimate the guide shipped with.

**The measurement came first, and it argued the other way.** Across this
repository's whole history, no shipped question has ever been edited — 325
`q:` lines added under `src/data/`, 0 removed. The failure has never fired.
`CLAUDE.md` is explicit that a merged decision is a decision and that re-tuning
what somebody has already argued for is not work, so an argued trade-off with
no victims is close to a reason to leave it alone.

What settles it is the price. `StudyCard` gains an optional `id`, and every id
on the 325 shipped cards was minted as **the hash `cardKey` already returned
for that card's question** — so `cardIdentity` and `cardKey` agreed on every
card in the app on the day it landed, 325 of 325, and not one stored review row
moved. There is no migration, because there was nothing to migrate. A loaded
gun unloaded for free is worth doing before it goes off rather than after.

Two things the change made newly breakable, both guarded. A copy-pasted id on
two different questions would merge two cards' histories and read as an
ordinary line of data, so `cardidentity.test.ts` asserts that cards share an id
only where they share a question — which the five deliberate unit/self-test
repeats do. And `allCards` collapsed those repeats by question text; keyed on
text it agrees with keying on id only until one half is reworded, at which
point the pair splits in the deck while still sharing one review row, which is
the bug that function exists to prevent, back again wearing the fix.

**Not covered, and said rather than left to be found:** cards a student adds
with their own material still have no id and keep the old behaviour exactly.
There is nothing to key them on — re-importing a reading produces new card
objects with no thread back to the old ones — and inventing one would be a
migration nobody asked for. The fallback is the old failure, kept deliberately
and documented where it lives.

---

## What this document got wrong about itself

Kept, for the reason `COMPETITION.md` keeps its fourth row: how a checking
document reached a wrong number is worth more than the number.

- **The first browser run "proved" that a sitting's progress did not
  persist.** Storage read back the seed with no `startedAt`, across three
  scripts, while the screen went on showing *opened, nothing answered yet*
  through a reload. The screen was right. The probe was reading
  `localStorage`, and `state/store.tsx` writes through a database path that had
  taken the dependency over — so the reading was true of the wrong store.
  `CLAUDE.md` names this exact shape: when a measurement clears (or convicts) a
  suspect the cheap signal disagrees with, find out which one is lying before
  believing the measurement. The reload test that settles it drives the real
  app and reads the row.
- **A `role="status"` probe came back empty in the live app** and non-empty in
  the mounted-screen test. Both were right: the app draws an earlier live
  region, and `querySelector` found that one. The count is in a status region;
  the probe was pointed at the app rather than at the screen.
