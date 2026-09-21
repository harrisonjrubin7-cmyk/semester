# The Top Hat companion, checked against the code — September 2026

The tracked copy of *Top Hat — feature audit, integration reality, and what
Semester should build instead*, a companion piece to the ten-competitor
comparison this repository already holds as [`COMPETITION.md`](COMPETITION.md).

It is the **fourth** outside document filed here, and it is the first about a
product that is not a competitor. Top Hat is the instructor's classroom tool,
not a student planner; it is in scope because two of the four courses this app
ships with are graded on it, and the document is right that this makes it a
grade category sitting in the app rather than market research.

Filed for the reason [`ACTION-PLAN.md`](ACTION-PLAN.md) gives for its own
existence: **every item that names something about this repository was checked
against the code before it was filed.** That habit has now been run four times
against four outside documents. It has come back with a defect twice — once in
[`COMPETITIVE-REVIEW.md`](COMPETITIVE-REVIEW.md), and once here.

**Checked against `4e62a1a` on 21 September 2026.** Every verdict names what
was measured and where, and every file and line quoted below was opened rather
than inferred.

Legend: **Open** · **Landed** (built here) · **Already built** (was already in
the app; nothing to do) · **Declined** (checked, and deliberately not done) ·
**Not a code item**.

---

## The headline: the warning this document makes is already true of the app

The document's sharpest paragraph is not one of its three tiers. It is the
sentence that says what *not* to build:

> What shouldn't be built is anything that implies a live sync Semester can't
> actually deliver; that's the exact mistake UpAhead made with its Canvas
> "integration" and got publicly called out for.

That mistake is already in this app, on the one screen whose entire job is to
say where a number came from, and **Top Hat is one of the four rows in it.**

`screens/settings/About.tsx:29-33` draws `SOURCES` from `data/misc.ts` under the
header *Where the numbers come from*, on a page blurbed *"Where the app's own
figures come from, and how to say something is wrong."* As shipped, the list
read:

| | | |
|---|---|---|
| Brightspace | 4 courses · synced 6:40 AM | **On** |
| Gradescope | ECON 1020 problem sets | **On** |
| Apple Calendar | Two-way, "Fall 2026" calendar | **On** |
| Top Hat | Join code 782449 | **Link** |

Three of those four name something this repository does not do, and the fourth
names something no third-party app can do:

- **Brightspace — "4 courses · synced 6:40 AM · On".** `lib/connect.ts:7-14`
  states the Brightspace route in the app's own words: a per-user `.ics` feed
  the student pastes, read-only, carrying "what instructors put on the
  Brightspace calendar". Nothing syncs on a clock, and a feed carries no course
  list to count to four.
- **Gradescope — "On".** The word occurs nowhere in `app/src` outside sample
  course data and the notification fixtures beside it. There is no Gradescope
  route of any kind, in any file.
- **Apple Calendar — "Two-way".** `lib/connect.ts:24-26` again, flatly:
  *"Apple — sign-in only. There is no iCloud calendar API."* `lib/subscribe.ts`
  publishes a feed outward, and a feed is one direction by construction.
  Nothing in `app/src` implements two-way anything; outside this row the only
  hits for the phrase are an unrelated pivot-table test and two lines of
  `SPEC-AUDIT.md` describing what a production deployment would still need.
- **Top Hat — a join code, beside three sources marked *On*.** This is the row
  the document's own research rules out hardest. Top Hat's only integration
  surface is LTI, which joins it to an institution's LMS; there is no public
  API and no student-initiated export. A student reading that list has been
  told their Top Hat is hooked up. It is not, and on the document's evidence it
  cannot be.

### Why it survived the pass that was hunting for exactly this

[`COMPETITIVE-REVIEW.md`](COMPETITIVE-REVIEW.md) item 6 found this same class
of over-claim and corrected it in three files — `screens/Connect.tsx`,
`screens/Courses.tsx` and `lib/connect.ts` — and pinned all three in
`screens/lmsclaims.test.ts`, by the words rather than by their shape, because
"the failure is a sentence somebody rewrites while tidying the copy."

This was the fourth place and the probe could not reach it, **because it is not
a sentence.** It is a four-element array in `data/misc.ts`, and it came
straight out of the design comp — `project/Semester Phone.dc.html:2240-2243` holds
the same four rows verbatim. Four plausible connected accounts are exactly what
a mockup should have. It shipped as provenance.

That is the useful half of this finding, and it is worth more than the four
rows: a claim that is data is invisible to a probe that reads prose, and the
place a repository is most likely to leave one is the file it thinks of as
fixtures.

### What it says now, and what is pinned

The rows name the routes that exist, and the tag says **what each one takes**
rather than whether it is switched on — there is no switch, and a status column
for connections the app does not hold was the whole defect:

| | | |
|---|---|---|
| Your syllabus | Every date, weight and quote, read from the file you upload | File |
| A calendar link | Brightspace, Outlook, Google, iCloud — read-only, and never whether you submitted | Link |
| Canvas | A token you issue yourself — assignments, and your own submissions | Token |
| What you enter | Scores, absences, hours. Nothing is filled in on your behalf. | Yours |
| Top Hat | Not connected — no app can read your score. Its grade line comes from the syllabus; the number is yours. | By hand |

Top Hat keeps a row rather than losing one. Dropping it would leave a student
who has a Top Hat grade category — two of the four shipped courses do — with no
answer at all, and "no answer" is how the question gets asked again.

`screens/lmsclaims.test.ts` gains a fourth section that reads the **data**:
no row may claim a sync or two-way traffic, no row may name a system with no
route, and the Top Hat row must say it is not connected. The probe carries its
control both ways, for the reason [`CLAUDE.md`](CLAUDE.md) gives:

- **It convicts.** The three rows as they shipped are kept in the test and run
  back through the same matcher, which is the revert-and-watch-it-go-red check
  made permanent instead of done once by hand. Against a faithful revert of
  `data/misc.ts`, four assertions go red.
- **It does not convict everything.** A genuine connection — Canvas, with a
  token the student issues — is run through the same matcher and must pass. A
  probe that flagged that one too would be matching the shape of a source row
  rather than the claim, which is the failure the teardown probes in
  `CLAUDE.md` record.

---

## The three tiers

### Tier A · A Top Hat grade category the parser detects and pre-fills · **Already built — and item 1 would undo item 3**

The tier has three parts. The third one is right, and it is the reason the
first one should not be built.

> 3. Ship this as a generic "external tool grade category" template, not a Top
>    Hat-only special case — the same pattern covers iClicker, Poll Everywhere,
>    or any other clicker system a different course uses, for free.

**That is what is there, and it is there because the parser has no vocabulary
at all.** The grading table is not detected by a table-finder or a keyword
list. It is asked of the model, and the whole schema for it is one line —
`lib/generate.ts:97`:

```
"grading": [{ "what": "Problem sets", "pct": "20%" }]
```

What comes back is shape-checked and nothing more (`lib/generate.ts:294-299`):
two strings, or the row is dropped and the import says so. `lib/harvest.ts:122`
does the same job for material added to a course that already exists, and
`lib/harvest.ts:348-353` applies the same two-string check.

The app's own parsing touches only the **weight**. `readWeight` in
`lib/grades.ts:86` reads `20%`, takes `25–30%` at its midpoint, reads
`80 pts`, and detects extra credit at `lib/grades.ts:115` on `+3`, `EC`,
"extra credit" or "bonus". The category *name* is never inspected — it is
carried verbatim and rendered at `screens/Grades.tsx:180`.

So "Top Hat participation", "Attendance (Top Hat 782449)", "iClicker points"
and "Poll Everywhere" all arrive as categories today, for the same reason and
with no rule written for any of them. Both shipped Top Hat courses prove it:
`data/courses/econ/index.ts:29` carries `{ what: 'Top Hat participation',
pct: '+3% EC' }` and `data/courses/psci/index.ts:26` carries
`{ what: 'Attendance (Top Hat 782449)', pct: '5%' }`. The ECON row's arithmetic
is pinned in `lib/gradesheet.test.ts:122-135` — extra credit kept out of the
100% and counted on top of it.

**Teaching the parser to recognise "Top Hat" would therefore be a regression
toward exactly the special case the tier's own item 3 says not to build.** The
generic version is not a thing to ship after the specific one; it is what is
already running, and a keyword list is how it would be lost.

Item 2 — *a fast manual "update my score" affordance* — is built on four
surfaces, which is the same verdict [`COMPETITION.md`](COMPETITION.md) item 2
reached about the calculator it feeds:

- **The field.** `screens/Grades.tsx:195` puts a `ScoreField` on every grading
  row, dispatching `setGrade`. `components/ScoreField.tsx:31` takes `88`,
  `88%`, `17/20`, "17 out of 20" or `B+`, because a student reading a number
  off the Top Hat app has whichever of those it gave them.
- **Per piece, where a syllabus drops the lowest.** `components/PiecesRow.tsx`,
  with `lib/drop.ts`.
- **The calculator it feeds.** `needFor` at `lib/grades.ts:339` and `reachFor`
  at `:379`, whose verdicts run *settled · secured · ordinary · hard ·
  unreachable*, rendered at `screens/Grades.tsx:226`.
- **A sheet you can export.** `lib/gradesheet.ts:62`, titled
  `"<code> — what do I need?"`, with the formulas live.

The document's own premise for item 2 — *"their Top Hat app shows them their
own live score; Semester just needs a place to log it"* — is a description of
what shipped.

### Tier A, the attendance half · **Already built, and it draws the same privacy line first**

> Semester can't verify physical presence (nor should it — that's the
> instructor's job and a real privacy line).

`lib/attend.ts` is that line, written as code before the document made the
argument. Its header, at `lib/attend.ts:31-36`:

> **The app never decides you were absent.** There is no inference from a phone
> that did not move, no default after the class ends, nothing filled in on your
> behalf. An unmarked class is unmarked, and the counts say how many are. A
> number that quietly assumed the worst would be wrong on exactly the days
> somebody most needs it to be right.

That is the same refusal the document makes about Top Hat's geolocation
check-in, and the file goes further than the tier proposes:

- **Both shapes a syllabus has** (`lib/attend.ts:16-21`): a *penalty* — n free
  absences, then points off per class — or a *category* worth a weight. Some
  courses have both; neither is derivable from the other.
- **Excused is not a third kind of absent** (`lib/attend.ts:24-27`): every
  count is unexcused only, "because that is what every syllabus that has one
  says."
- **Read from the syllabus, and correctable.** The importer asks for it
  separately from the grading table (`lib/generate.ts:134-146`), refuses to
  guess a common policy, and quotes the sentence it took the rule from into
  `note`. `components/Attendance.tsx:9-19` keeps every field editable, because
  "a read rule is a proposal, not a fact."
- **Folded into the projection twice**: as points subtracted from the finished
  grade (`lib/grades.ts:319`), and as a synthesised weighted row when the
  policy has a `worth` (`lib/grades.ts:295-303`).
- **Marked per meeting**, Went / Missed / Excused, from the calendar
  (`components/MarkClass.tsx:28`), one record per `courseId:date` so two
  devices can never make one absence into two.
- **Triaged** when it starts costing points (`lib/misses.ts:46`).

PSCI 1104's five percent is therefore already a scored line with a budget
behind it. Nothing in this half is open.

### Tier B · Screenshot your Top Hat score, and have it read · **Landed — and both halves of its premise were wrong in the cheap direction**

> Worth scoping only after Tier A ships and after the camera-scan syllabus
> feature (which this reuses the OCR pipeline from) is built.

Neither condition is pending, and the second is wrong about what it would be
reusing.

**The camera path already ships.** `components/Capture.tsx:66-75` offers the
rear camera and the photo library, the difference between them being the one
`capture="environment"` attribute; `screens/Import.tsx:278` calls `readPages` on the
shots and hands the text to the same intake a PDF goes through, so a
photographed syllabus and an uploaded one land in one place.
`screens/camera.test.tsx` pins both halves. [`COMPETITION.md`](COMPETITION.md)
item 4 filed the camera half as a decision somebody had already made; it is
built.

**It is not OCR, and that matters to the sizing.** There is no OCR engine in
this repository — no tesseract, no wasm recogniser — and `lib/extract.ts:324`
tells a student who uploads a scanned PDF to go and run it through OCR
somewhere else. What exists is model vision transcription, `readPages` at
`lib/claude.ts:1385`, and its prompt already asks for the one thing Tier B
needs (`lib/claude.ts:1396-1398`):

> Keep tables as tables, one row per line, with the columns separated by ' | '.
> A grading table is the most important thing on a syllabus and its percentages
> are read literally later, so keep '25%', '25–30%' and '80 pts' exactly as
> written.

A Top Hat score screen is a small table of numbers. The expensive half of Tier
B — a camera, a resizer, a transcriber that preserves a column of figures, and
a test around it — is built and shipped. **What is open is a destination, not a
pipeline:** somewhere to send one transcribed number so it reaches `setGrade`
on the right category, rather than the course-intake path every shot takes
today. That is smaller than the document sizes it, and it stays behind the
honest line, because it is one student handing over their own already-visible
data.

**That destination is now built**, and it is `components/ScoreShot.tsx` on the
Grades screen, behind the same key gate as every other door a model reads
through. The shape of it is the argument this file has been making all the way
down:

- **The model transcribes; the app reads.** `readPages` is asked for the text
  on the screen and nothing else, and which of those words is a score is
  decided in code by `lib/readout.ts`. Asking the model for the score directly
  is one round trip shorter and has no floor under it — a blurred 8 comes back
  as a confident 9 with nothing to check it against, and a page with no grade
  on it comes back with a number anyway, because that is what it was asked for.
- **It refuses more than it reads.** A score screen is mostly not scores, and
  the deck this app ships proves it: PSCI 1104's own Top Hat join code is
  `782449`, a six-digit number two lines from the grade. A reader that took
  every number it saw would offer it, and a student tapping the first
  suggestion would file a 782,449% attendance mark. So a bare number counts
  only where its line says what it is, and `lib/readout.test.ts` keeps that
  page as its fixture.
- **Nothing is filed without two taps.** The candidate is chosen, the category
  is agreed, and only then does anything reach `setGrade`. The category is
  proposed from the line's own words and **refuses a tie** rather than opening
  on an arbitrary row — a chooser that opens on a guess invites the tap that
  files a mark there.

What goes in is the string that was on their screen — `13/14`, not `92.857` —
because `components/ScoreField.tsx` reads a photographed fraction the same way
it reads a typed one, and a student who opens the field in November should see
what they photographed in September.

### Tier C · A true live sync · **Declined — and the repository settled this before the document asked**

Agreed, for the document's reasons, and this codebase agrees more strongly than
the document knows. [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) item 8
declines open-seat registration alerts on precisely this ground and names the
pattern that decides it — the *honest bridge*, of which three ship:

- `lib/canvas.ts` — a personal access token the student issues in about forty
  seconds, chosen over an OAuth developer key "an administrator must grant".
- `lib/feedlink.ts` — a calendar link the student copies, which needs
  registration from nobody.
- `lib/yes.ts` — the clipboard, because the registrar sits behind single
  sign-on: *"the honest bridge is not a scraper."*

Top Hat has none of those three doors. It has no token a student can issue, no
feed, and nothing to copy. That absence is what makes Tier C right rather than
cautious, and it is why the fix at the top of this file matters: a source list
that implies the door exists is the only version of this anybody could ship
today, and it was shipped.

---

## The feature audit, where it names this repository

| Row | The document's reading | Verdict |
|---|---|---|
| Live polling | Not portable; the question-type variety is the idea worth taking | **Open — but it is this app's own spec, not Top Hat's.** See below. |
| In-class discussion | Not portable | Agreed. **Not a code item.** |
| Attendance tracking | Semester should track the category and let the student log it | **Already built** — `lib/attend.ts`, and further than proposed. |
| Interactive eTexts | Out of scope | Agreed. **Declined.** |
| Interactive homework & quizzes | Expand Practice Quiz's question types | **Open**, and see below. |
| Ace AI assistant | Already covered | Agreed; no claim about this repository to check. |
| Gradebook | "the one real, actionable gap" | **Already built** — four surfaces, above. This is the row the document gets most wrong, and it is wrong in the expensive direction. |
| LMS integration | No student-facing door in | **Correct**, and load-bearing. See Tier C. |
| Course catalog | Out of scope | Agreed. **Declined.** |

### The question types, which are open and are not Top Hat's

The document proposes expanding Practice Quiz "toward Top Hat's list
(matching, click-on-target, word-answer, not just MC/TF/short-answer)". Two
corrections, and the second is the one worth acting on.

**The app does not ship MC/TF/short-answer.** It ships multiple choice.
`lib/quiz.ts:43` builds up to ten four-option questions whose decoys are real
answers to other cards in the same guide, and `lib/modes.ts:191` refuses the
mode below four distinct answers. The exam builder has three kinds and they are
`'choice' | 'short' | 'long'` (`lib/exam.ts:34`). There is no true/false, no
matching, no ordering and no cloze anywhere in `app/src`.

**And the gap is already written down here, dated before Top Hat.**
`docs/PRODUCT_REQUIREMENTS.md:236-237` specifies Practice Quiz as:

> Multiple-choice, true-or-false, matching, and short-answer questions with
> explanations.

Two of the four are built. The two that are not are **true-or-false and
matching** — which are two of the three the document names. So the proposal is
sound and the provenance is not: this is the app failing its own specification,
not a feature to borrow from a classroom polling tool, and it should be filed
and sized as the former. "Click-on-target" is Top Hat's alone and belongs to a
projector; it has no reading on a phone at a desk.

Open, unbuilt here, and deliberately not started in this change: it is a
generator and a marker per type, which is a larger piece of work than the
defect this pass was opened by, and sizing it against `docs/STUDY_REQUIREMENTS.md`
is the next step rather than a paragraph in this file.

---

## Housekeeping: three of the documents this one cites are not filed here

The companion names five sibling documents. One is here under a different name
and three are not in the repository at all:

- `competitor-feature-comparison-2026-09.md` — filed, as
  [`COMPETITION.md`](COMPETITION.md). Every cross-reference the Top Hat
  document makes to it (the grade calculator as item 2, camera-scan import as
  item 4, Canvas tokens as item 5, the UpAhead call-out) checks out against it.
- `updated-brief-completion-roadmap-2026-09-21.md` — not in the repository.
  [`COMPLETION-PLAN.md`](COMPLETION-PLAN.md) is the completion roadmap this
  repository holds, written 15 September against `02cd9fe`, and it is not the
  same document.
- `big-ai-assistant-capability-gap-2026-09.md` — not in the repository.
- `scaling-roadmap-2026-09.md` — not in the repository. "Track 3" is cited
  twice as the home for institutional agreements; the nearest thing filed here
  is `IMPLEMENTATION-PLAN.md` item 8.

Not a criticism of the research, for the reason `COMPETITION.md` gives about
its own source: the reading is first-hand and the market judgement is sound.
It is a note for the next reader, who will otherwise go looking for four files
and find one.

---

## What this pass actually found

Four things, in the order they are worth.

1. **The app was already making the claim the document warns against**, on the
   provenance screen, about Top Hat among three others — and the probe written
   to catch that exact failure could not see it, because the claim was data.
   Fixed here, pinned both directions, control included.
2. **Tier A is built, and its first item would undo its third.** The parser has
   no category vocabulary, which is what makes it generic; writing "Top Hat"
   into it is how that would be lost.
3. **Tier B was cheaper than sized, and was not an OCR job.** The camera, the
   transcriber and the table-preserving prompt all shipped already; what was
   missing was a destination for one number, and that is now built. See the
   tier above.
4. **The question-type gap is real and is the app's own.** It is in
   `docs/PRODUCT_REQUIREMENTS.md` and it has been since before this document
   was written. Filing it against Top Hat would have credited the wrong source
   and, worse, would have sized it as a small borrowing rather than the
   generator-and-marker work it is.

The Top Hat category itself — the thing that started this, the five percent in
PSCI 1104 and the three extra-credit points in ECON 1020 — has been parsed,
weighted, scored, projected and triaged in this app for some time. What was
wrong was what the app said about where that number comes from.
