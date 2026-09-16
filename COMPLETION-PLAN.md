# What is left to build, and the order to build it in

A completion plan for Semester. Written 15 September 2026, measured against
`origin/main` at `02cd9fe`.

---

## 1. What this document is, and how to read it

Semester ships four courses built by hand and an app that will build a fifth
from a syllabus you upload. Most of it is done. This document is about the part
that is not: every feature short of full parity, what specifically is missing,
how it closes, and in what order.

It runs system by system — Study Modes ([§3](#3-study-modes)), Cross-Course
Intelligence ([§4](#4-cross-course-intelligence)), Production Suite
([§5](#5-production-suite)) — and then re-arranges the same items once more as a
single schedule ([§6](#6-the-whole-plan-as-one-schedule)), because the
feature-by-feature view hides the dependencies and the schedule is the thing you
actually work from. [§7](#7-phase-3--depth-and-scale) is the hardening phase that
only makes sense once real students have used it. [§8](#8-what-this-plan-does-not-cover)
says what is deliberately not here.

### Every "current state" below is a measurement

This plan grew out of a draft written from the product's own feature list —
eleven items, each with a paragraph on where it stands. Every one of those
paragraphs was then checked against the code. **Seven of the eleven did not
survive**, and they failed in the same direction: they described as outstanding
work that had already landed.

The draft said Exam Runway "does not exist in the app today — this is the one
feature in the entire product with no working version yet". It is 922 lines
across `app/src/lib/runway.ts`, `app/src/lib/covers.ts` and
`app/src/screens/Runway.tsx`. It said pivot tables were missing;
`app/src/lib/pivot.ts` is 424 lines and writes its aggregates back into cells as
live `SUMIFS`. It proposed building a weighted best-case / expected / worst-case
GPA model; `app/src/lib/termgpa.ts` has computed exactly that band, across
courses, with the letter cliffs handled, for some time.

That is not a failing of the draft. It is what happens when a status document is
written from a feature list rather than from the tree, in a repository where
several sessions land work every hour — [CLAUDE.md](CLAUDE.md) opens with the
same warning for the same reason. It is also why this document is written the
other way round. Every "Current state" below names the file it was read out of,
every count in it was run today, [Appendix A](#appendix-a--what-measurement-corrected)
lists each claim that measurement contradicted, and
[Appendix B](#appendix-b--how-to-re-measure-every-number-here) is the commands to
re-run all of it. If a number here disagrees with the tree, the tree is right and
this file is stale.

### Live, Partial, Planned

| Status | Means |
| --- | --- |
| **Live** | Works for every course the app can hold, hand-built or generated, with no caveat a pilot student would have to be told. |
| **Partial** | Works, with one named limit. The limit is stated in the item, not implied by the word. |
| **Planned** | No working version exists. |

After the correction pass, **nothing in this document is Planned.** Every item
has a working version; each is short of parity in a specific, nameable way. That
is a materially different plan from the one the draft described, and a much
shorter one.

### The distinction that turned out to matter more than the three statuses

Four of the five Partial study modes are not partial *engines*. They are finished
engines with nothing to run on for a course the app built itself. The line is at
`app/src/lib/generate.ts:463`:

```ts
// Figures, examples and audio belong to a course built by hand. A
// generated one gets them when someone adds them, not by pretending.
```

A course generated in-app from an uploaded syllabus gets units, cards, a
glossary, dated obligations with the sentence each came from, and a grading
policy. It does not get figures, worked examples, narrated lessons or podcast
editions — because those four were made by a Python pipeline and a speech
synthesiser that run in this repository, not in the browser.

So the honest statement of four gaps in §3 is one sentence: **the four hand-built
courses have every asset; a generated course has none of them, and the pipeline
that makes them does not run in the app.** That changes what the work is. It is
not "make Watch cover more concepts" — Watch covers 44 units out of 44. It is
"give a generated course a way to earn what the hand-built ones were given".

Throughout this document that distinction is written as **content coverage**
(which courses have the assets) against **engine coverage** (what the code can
do at all). They want different work, and conflating them is how the draft came
to describe four finished engines as unfinished features.

---

## 2. How Sequencing Was Decided

Every feature below was placed into one of three phases using three questions, in
order: does another unfinished feature depend on this one being done first; does
closing this gap materially change what a pilot group can honestly be shown; and
how much of the underlying engine already exists versus needs to be built new.
Foundational, low-risk, and already-mostly-built items are front-loaded into
Phase 1 so the pilot starts on the strongest possible footing.

* **Phase 1 — Foundational and pilot-ready:** closes gaps that either block other
  features or are quick, high-value wins. Target: complete before a structured
  multi-student pilot begins.
* **Phase 2 — Full parity:** brings every remaining feature to the same standard
  as the Phase 1 and already-Live features. Target: complete before any wider
  release beyond the pilot group.
* **Phase 3 — Depth and scale:** not a gap-closing phase but a hardening phase —
  performance, cost, and edge-case coverage once real usage data exists
  ([§7](#7-phase-3--depth-and-scale)).

### A fourth question, added by this pass

**Has it already been built?**

It sounds like a joke and it moved four items between phases. Asked first, it
takes minutes; asked last, it is discovered by a pull request that duplicates
work already on `main`. [CLAUDE.md](CLAUDE.md) records two such duplicates inside
one hour, one missed by ten minutes and one by forty-four, both by authors who
had scanned the commit titles and not grepped for the thing itself. A completion
plan is the document most exposed to that failure, because its entire content is
claims about what does not exist yet.

The question is answered the way that file prescribes — grep for the mechanism,
not the name:

```bash
git fetch origin main
git log --oneline -40 origin/main | grep -i <the-thing>
git show origin/main:<path> | grep -n <the-symbol>
rg -l '<the capability, in the words the code would use>' app/src
```

Four items in this plan were re-phased by that question: Exam Runway (Phase 2 →
Phase 1, and from "the only fully net-new build" to one small gap), GPA
Projection (Phase 1 build → Phase 1 residual), Spreadsheet pivot tables (Phase 2
→ done), and Document Editor equation embedding (Phase 1 → done).

### What "done" means for an item here

Each item below ends with a **Done when** — the observable condition that closes
it, written so a person other than its author can check it. Some of those are
tests, because this repository argues from measurement and a guard that has never
failed is not known to be a guard; where a **Done when** names a test, the test is
expected to have been run against a revert of the fix and seen to go red.

---

## 3. Study Modes

A study guide in this app has <!--modes-->eleven<!--/--> study modes —
eleven ways through the same material, listed in `app/src/lib/modes.ts`. The
draft called five of them Partial. Measured, the picture is different: the
engines behind all eleven work, and four of the five are limited by content
rather than by code.

### The eleven, measured

Counts are for the four shipped courses (ECON 1020, PSCI 1104, BUS 1600,
CORE 2500 — 44 units between them).

| Mode | Built from | Four shipped courses | A generated course | Status |
| --- | --- | --- | --- | --- |
| Cards | Units and cards | Every unit | Every unit | **Live** |
| Read | Units | Every unit | Every unit | **Live** |
| Field guide | Units and glossary | Every unit | Every unit | **Live** |
| Doc | Units | 3 formats | 3 formats | **Live** |
| Quiz | Cards, ≥ 4 distinct answers | Every course | Every course with enough answers | **Live** |
| Cram | Units | Every unit | Every unit | **Live** |
| Slides | Units and cards | Every unit, 6 slide kinds | Every unit, 6 slide kinds | **Partial — engine** |
| Figures | Figure assets | 4 shapes, 17 named diagrams | None | **Partial — both** |
| Cases | Worked examples and pairings | 32 examples, 8 pairings | None | **Partial — both** |
| Watch | Narrated lesson per unit | 44 lessons over 44 units | None | **Partial — content** |
| Listen | Podcast editions | 8 editions, all chaptered | None | **Partial — content** |

Read the last two rows carefully, because they are the ones the draft got
backwards. Watch is not "a limited set of concepts": it is 13 lessons for BUS's
13 units, 6 for CORE's 6, 11 for ECON's 11, 14 for PSCI's 14 — complete coverage
of every unit the app ships. Listen is not missing chapter marks: all eight
editions carry a `chapters` block, and `audio/synth.py` renders them exact rather
than estimated. What both are missing is a fifth course.

### 3.1 · Figures — Partial (engine and content)

**Current state.** Two figure systems exist and do not meet.

The Figures study mode draws from a closed union of four shapes — `bars`,
`steps`, `diagram`, `image` (`app/src/lib/types.ts`) — where `diagram` names one
of seventeen hand-drawn SVGs in `app/src/components/Diagram.tsx`
(`DIAGRAM_KINDS`). `app/src/lib/figure.ts` turns what a model reports in a newly
added reading into one of those four, with strict validation, so a figure read
out of week six's reading comes out looking like the guide's own figures because
it *is* one of them. Its own header states the cost plainly: the app "can
*recognise* the curve a reading is about but cannot draw a new one."

Separately, `app/src/lib/diagram.ts` (331 lines) already does the thing the draft
proposed building: Claude writes a **Mermaid or SVG specification** for an
arbitrary concept, and the app renders it after `cleanSvg` walks the parsed
document and strips scripts, event handlers and `foreignObject`. It is wired to
`app/src/screens/Draw.tsx` and `app/src/screens/Create.tsx`. It is not wired to
the Figures mode.

**What's missing.**

1. The two systems are not joined. A student in the Figures tab gets the closed
   seventeen; a student who finds Draw gets anything, in a different place, that
   does not become part of the guide.
2. The seventeen are economics, statistics and marketing diagrams. There is no
   free-body diagram, no circuit, no titration curve, no phase diagram — the
   quantitative and STEM coverage the draft named, and the one genuinely absent
   capability here.
3. A generated course gets no figures at all (`generate.ts:463`).

**Technical approach.** Do not build a third system. Route the Figures mode
through `lib/diagram.ts`, and keep every property that makes the closed union
safe:

* Extend `Figure` with a fifth arm — a generated `drawn` figure holding the
  sanitised markup and the specification it came from — so a generated diagram is
  stored, re-renderable, and distinguishable from a hand-drawn one on sight and
  in code.
* Keep `figure.ts`'s validation in front of it. The rule that a figure never
  carries a number the reading did not give is the reason this feature is
  trustworthy, and it must survive the widening.
* Add STEM diagram kinds to `DIAGRAM_KINDS` where a shape is stable and worth
  drawing by hand, and let the generated arm carry the rest. The list is a
  `const` array with the type derived from it precisely so an eighteenth is one
  line.
* For anything quantitative, plot through the existing engine —
  `app/src/lib/plot.ts` (1,860 lines) and `app/src/lib/calc.ts` — rather than
  building a second charting path. `app/src/lib/svgout.ts` already resolves theme
  tokens to hex so an exported figure is not a black rectangle outside the app.

**Dependencies.** `lib/diagram.ts` (built), `lib/plot.ts` (Live), `lib/svgout.ts`
(built). No new backend dependency.

**Estimated effort.** Medium. Lower than the draft's medium-high, because the
generation and sanitising half exists; what remains is the join, the storage arm,
and the STEM kinds.

**Done when.** The Figures tab of a generated course can produce a correct
diagram for a concept not in `DIAGRAM_KINDS`; a test asserts that nothing from the
generated arm renders a script, an event handler or a `foreignObject` after
`cleanSvg`; and a test asserts a generated figure is visually distinguishable
from a hand-drawn one.

**Sequencing: Phase 1** — Watch and Slides both reuse this rendering layer.

### 3.2 · Slides — Partial (engine)

**Current state.** `app/src/screens/Slides.tsx` cuts a unit into a deck of six
slide kinds — `title`, `q`, `a`, `figure`, `note`, `end` — question always before
answer, arrow keys or tap halves. It works for every course, hand-built or
generated, because it is derived from units and cards and nothing else. A
diagram-anchored layout already exists: that is the `figure` kind.

Note that the app has a *second*, richer deck system for the Production Suite —
`app/src/lib/deck.ts` plans slides from a brief with a model,
`app/src/lib/decks.ts` stores them, `app/src/lib/pptx.ts` writes the `.pptx`.
That one is not the study mode, and the two should not be merged: one is your own
material rearranged with no model and no wait, and that is the property worth
keeping.

**What's missing.** Three layouts, not a library from nothing: **bullet** (a
unit's key points, for material whose shape is a list rather than a question),
**comparison** (two columns, for the "X versus Y" unit every course has), and
**quote-and-source** (a passage with its citation, which the app already holds
verbatim for every deadline and reading). Today all three are forced into `q`/`a`
or into `note`.

**Technical approach.** Add the three kinds to the `Slide` union in
`Slides.tsx` and render each in the existing component. Selection stays
mechanical first — a unit whose cards are one-line facts becomes bullets, a unit
whose glossary holds a contrasted pair becomes a comparison — with Claude
choosing only where the mechanical rule is ambiguous, from the verified course
model. A deck that needs no model call is a deck with no wait and no key, and
that is worth protecting for the commonest case.

**Dependencies.** Figures (§3.1) for the diagram-anchored layout to improve
beyond the existing `figure` kind. Nothing blocking for the other three.

**Estimated effort.** Low-medium.

**Done when.** Every unit across the four shipped courses and one generated test
course maps to a layout no reviewer calls "forced", and a test asserts the
question-before-answer invariant survives the new kinds.

**Sequencing: Phase 1.**

### 3.3 · Watch — Partial (content)

**Current state.** Complete for every unit of every shipped course: 44 narrated
lessons over 44 units (`app/public/audio/lessons/` — bus 13, core 6, econ 11,
psci 14), each a voice with the slide changing under it. They are produced by
`pipeline/lessons.py`, which reads the same guide through `pipeline/guide_reader.py`
that the deck and handout generators read, so a lesson cannot disagree with the
app about what the course says. `audio/synth.py` renders the audio.

**What's missing.** One thing: a course the app generated has no lessons, because
the pipeline is Python in this repository and does not run in a browser. The
draft's "full-course coverage and a repeatable production pipeline rather than
concept-by-concept manual assembly" describes work that `pipeline/lessons.py`
already is; the gap is that it is on the wrong side of the app boundary.

**Technical approach.** Compose Watch in-app from assets the other modes already
produce, avoiding a video renderer entirely:

* **Script** — reuse the Listen pipeline's script-generation step (§3.5), run
  against the verified course model for a generated course.
* **Voice** — `app/src/lib/speak.ts` is already the browser's own
  `speechSynthesis`: no network, no account, no coursework leaving the device.
  That is a lower-fidelity voice than `audio/synth.py` and it is the correct
  default for a student's own uploaded material, for the reason that file gives.
* **Visuals** — the Figures rendering layer from §3.1, sequenced against the
  script's cues.
* **Playback** — a timed visual sequence in the existing player, which is what
  the shipped lessons already are.

A generated course's Watch will be honestly labelled as synthesised on-device
rather than presented as equivalent to the recorded lessons. A mode that looks
identical whether it has forty-four produced lessons behind it or a robot voice
is the exact failure `lib/modes.ts` was written to end.

**Dependencies.** Figures (§3.1) and Listen (§3.5) both at Phase 1 completion.

**Estimated effort.** Medium.

**Done when.** A course generated from an uploaded syllabus offers Watch for
every unit, the mode card states which kind of narration it has, and no shipped
course's lessons change.

**Sequencing: Phase 2** — depends on Figures and Listen.

### 3.4 · Cases — Partial (engine and content)

**Current state.** Two kinds of thing show in the Cases tab, and
`app/src/lib/modes.ts` counts both: the catalogue's worked examples, and the
guide's claim-and-test pairings. Measured: **8 worked examples per course, 32 in
all**, and **8 pairings, all of them in PSCI 1104**. A generated course has
neither.

The worked examples are also thinner than the name suggests. `Example` is
`{ tag, t, d }` (`app/src/lib/types.ts`) — a tag, a title, a description. It is a
worked example in the sense of a short illustrated case, not in the sense of a
problem carried through its steps with the arithmetic shown.

**What's missing.**

1. Depth: no step structure, so a quantitative course cannot show a worked
   solution the way a problem set does.
2. Breadth: claim-and-test pairings exist for one course of four; the shape is
   general and only PSCI has them.
3. Generated courses get none.

**Technical approach.** Widen `Example` into a discriminated union rather than
adding optional fields to the existing shape — a **worked problem** (a statement,
ordered steps, a result), a **case study** (situation, question, analysis,
what it turned on), and the existing short applied scenario, with the course type
selecting the few-shot template. Then pass every generated case through the
grounding check the rest of the product relies on: `app/src/lib/cite.ts` already
checks a generated quote against its source document, and that is the same
question asked of a case — does this trace back to the material, or did the model
supply it. A case that introduces a fact the course does not support is refused
rather than shown with a caveat.

**Dependencies.** The verified course model (Live) and `lib/cite.ts` (Live).
Benefits from Figures (§3.1) for diagram-supported cases.

**Estimated effort.** Medium.

**Done when.** A generated course produces cases in the shape its course type
calls for; every generated case has passed the grounding check; and a test feeds
in a case containing an unsupported fact and asserts it is refused.

**Sequencing: Phase 2.**

### 3.5 · Listen — Partial (content)

**Current state.** Eight podcast editions ship across four courses — bus 1, core
2, econ 2, psci 3 — and **every one carries a `chapters` block**. The chapter
marks are exact rather than estimated, because `audio/synth.py` knows where each
line starts; `pipeline/chapters.py` recovers them for a recording that arrived
without. `pipeline/make-script.mjs` drafts a script from a guide, and
`audio/README.md` records that the scripts are also the transcripts, which is the
text alternative an audio-only mode needs to be usable at all.

**What's missing.** Again one thing, and again it is the boundary: a generated
course gets no audio. The draft's "complete chapter-mark indexing across all
content" is already true of all content that exists.

The second half of the draft's ask is real and unaddressed: there is no
cost-aware pre-generation. Today's eight editions were rendered once, by hand, by
a person running a script. Nothing decides *when* audio for a new course gets
built, or caches it so it is built once per topic rather than per listen.

**Technical approach.** Two pieces, and they split cleanly across phases.

*Phase 1 — scripting and coverage.* Move the script-generation step into the app
and run it across the full verified course model, so a generated course has a
script per topic and therefore a transcript per topic. A script with no audio is
already useful: it is readable, searchable and accessible, and it is what the
audio is rendered from later.

*Phase 2 — the batch pipeline.* A pre-generation and caching job: audio built
once per topic, keyed by the topic's content hash so an edited unit re-renders
and an untouched one does not, with chapter-mark metadata written as part of the
same job rather than as a second pass. Cost is the reason this is a job and not a
button — see [§7](#7-phase-3--depth-and-scale) for the figures that decide its
budget.

**Dependencies.** The custom audio engine (`audio/synth.py`, Live) and
`pipeline/make-script.mjs` (Live).

**Estimated effort.** Low-medium for scripting; medium for the batch pipeline.

**Done when.** Every topic of a generated course has a script and a transcript
(Phase 1); audio for a topic is rendered at most once per content hash, with
chapter marks, and the job's cost per course is measured and recorded (Phase 2).

**Sequencing: Phase 1 for scripting and coverage; cost-optimised batch pipeline
in Phase 2.**

---

## 4. Cross-Course Intelligence

This system is Semester's most distinctive claim: that it can reason across a
student's whole semester rather than one course at a time. The draft called three
of its four tools Partial and the fourth — Exam Runway — Planned, "the one
feature in the entire product with no working version yet".

Measured, **all four have working versions**, and Exam Runway is the largest of
them.

| Tool | Where it lives | Lines | Status |
| --- | --- | --- | --- |
| Where Courses Meet | `lib/meet.ts`, `screens/Meet.tsx` | 186 + screen | **Partial — matching depth** |
| GPA Projection | `lib/termgpa.ts` (+ `worth`, `cutoffs`, `grades`, `credits`) | 401 | **Partial — three named exclusions** |
| Exam Runway | `lib/runway.ts`, `lib/covers.ts`, `screens/Runway.tsx` | 313 + 206 + 403 | **Partial — one input is manual** |
| Quote Verification | `lib/quotes.ts`, `screens/Proof.tsx` | 669 + 263 | **Live** — four verdicts, adversarially tested ([§4.4](#44--quote-verification--live)) |

### 4.1 · Where Courses Meet — Partial

**Current state.** The draft's description is accurate, and understates it.
`app/src/lib/meet.ts` finds the same idea sitting in two courses and sorts what
it finds into **four grades of evidence**, kept apart on the screen rather than
mixed: both courses define the term (two glossary entries, the strongest, and the
only grade that can show two definitions to read against each other); one term's
phrase contained in the other's; one course defines it and the other merely uses
it in a card; and a single distinctive word in common, which the row names so a
coincidence is obvious on sight.

It never asserts two things are the same. Where both courses define a term it
shows **both definitions**, side by side, and lets the reader decide — and its
own header makes the case that a pair which turns out to *disagree* is the single
most valuable row on the screen.

**What's missing.** It is string work on glossaries and cards. There is no model
and no embedding, which its header says out loud. So it misses the case where two
courses use different words for the same underlying idea — PSCI's *selection
effect* and BUS's *sampling bias*, which share no distinctive word and are the
same problem.

**Technical approach.** Add semantic similarity as a **fifth grade of evidence**,
below the four that exist, rather than replacing the string work. This matters:
the string grades are explainable — the row can say which word did it — and a
similarity score is not. A fifth grade keeps every existing row exactly as
trustworthy as it is today and adds a weaker, clearly-labelled one.

* A lightweight embedding per Field Guide (glossary) entry per course, computed
  once and stored with the course.
* Compare across courses, surface above a threshold, and keep the human check
  the other four grades already have: the screen shows both definitions and asks
  nothing to be believed.
* The threshold is a measured number, not a guessed one — chosen against the
  four shipped courses' glossaries, where the true overlaps are known and can be
  counted.

**Dependencies.** Field Guide / glossary data per course (Live).

**Estimated effort.** Medium.

**Done when.** The fifth grade finds at least one true cross-course pair the four
string grades miss, on the shipped courses; the false-positive rate at the chosen
threshold is measured and stated on the screen's own terms; and the four existing
grades' output is byte-identical before and after.

**Sequencing: Phase 1.**

### 4.2 · GPA Projection — Partial

**Current state.** Built, and built as the draft proposed to build it.
`app/src/lib/termgpa.ts` computes the term's GPA as a **band — low, middle and
high** — where the middle is "if the rest goes like the graded part" and the
edges come from each course's own variation, carried through the arithmetic
rather than thrown away at the last step. It composes four existing files:
`lib/worth.ts` projects one course's landing as a band, `lib/grades.ts` says
where a course stands and what the rest has to be, `lib/cutoffs.ts` turns a
percentage into a letter and a letter into grade points, `lib/credits.ts` reads
credit hours off the syllabus line. It also reports what this term does to the
cumulative record.

Two decisions in it are worth keeping and are easy to undo by accident. It never
prints a single number, because every input is already a range and "3.62" would
be the most confident-looking and least earned figure in the app. And it never
rounds a percentage before the scale reads it, because 89.94 is a B+ and rounding
it to an A− moves a whole grade point on a tenth of a percent, in exactly the
case where somebody is looking.

**What's missing.** Not the model — the **exclusions**. `Missing` is
`'' | 'ungraded' | 'hours' | 'points'`: a course with nothing graded yet, a
course whose credit hours could not be read off the syllabus line, and a scale
that leaves a letter this course could land on unpriced. Each is named per course
rather than silently dropped, which is the right behaviour and is still a course
missing from the student's term GPA. A band computed over three of four courses
is the thing the file's own header warns is worse than no band.

**Technical approach.** Close the two that are closeable by asking:

* `hours` — the credit hours are on the student's registration record and in
  their own head. One field on the course, prefilled from
  `lib/credits.ts` where it parsed, editable where it did not.
* `points` — where a scale states a letter without grade points, ask once for
  that school's scale and store it with the school (`lib/school.ts` already holds
  per-school data), rather than guessing 4.0-scale values that vary by
  institution.
* `ungraded` stays. A course with nothing graded genuinely cannot be projected,
  and the screen saying so is correct.

**Dependencies.** Verified grading-policy extraction (Live). Nothing blocking.

**Estimated effort.** Low — a genuine quick win, and smaller than the draft's
low-medium because the model is not the work.

**Done when.** Across the four shipped courses and one generated course, no
course is excluded for `hours` or `points` without the student having declined to
supply them; and the band's arithmetic is unchanged, proven by a test that fixes
the inputs and compares.

**Sequencing: Phase 1.**

### 4.3 · Exam Runway — Partial *(the draft said Planned; it is not)*

**Current state.** 922 lines, three files, one screen, shipping.

`app/src/lib/runway.ts` measures the weeks before an exam **backwards from the
exam**, in bands rather than as a smooth percentage, because at three weeks the
useful move is to find out what you do not know and at three days it is to stop
finding out and start rehearsing — and a percentage blurs exactly that
distinction. It counts units never drilled, cards never answered, cards due back,
papers sat and what they scored, and every other deadline standing between now
and the exam. Every one of those is a number the app already holds: the
"performance log recording which topics a student has actually engaged with in
Quiz and Cram" that the draft says "does not exist yet and must be built as part
of this item" is `lib/review.ts` and the sittings record, and Runway already
reads it.

`app/src/lib/covers.ts` is the coverage engine. It answers what is actually *on
the paper*, from three sources, and always says which: the **syllabus said so**
("units 1 to 8", read out of the deadline's own verbatim words, which the app
keeps); **you said so** (a box on the runway, because the professor says it in
the last lecture and what you were told beats what the PDF managed to write
down); or **nobody said**, in which case it counts the whole course and says on
screen that it is counting everything because it was not told otherwise. It
refuses the available inference — three exams, fourteen units, split them evenly
— because a student told "Midterm 2 covers units 6 to 10" by arithmetic will
revise 6 to 10, and when the real split was 5 to 9 the app has caused the exact
failure it exists to prevent.

`app/src/screens/Runway.tsx` shows it, with no readiness score, for the reason
every other screen in this app refuses one: a percentage claiming to say whether
you will pass would be believed, and the app cannot know.

**What's missing.** One input. Exam scope comes from the syllabus's own wording
or from the student typing it in; a syllabus that describes scope in a sentence
the parser does not match falls through to "nobody said" and the whole course.
That is the safe failure and it is still a failure — it is the fourteen-units-for-an-eight-unit-midterm
case, arrived at from the other direction.

**Technical approach.** Add a model-read scope proposal as a *fourth, weakest*
source, with the same discipline `covers.ts` already applies to the other three:
Claude reads the deadline's verbatim sentence and proposes a unit range; the
range is shown **as a proposal the student confirms**, labelled as read rather
than stated, and never counted until confirmed. The refusal to infer stays intact
— a proposal a person accepted is "you said so", which is a source `covers.ts`
already has.

**Dependencies.** The calendar and grading infrastructure GPA Projection uses
(Live); the Quiz/Cram engagement record (Live — `lib/review.ts`, `lib/sitting.ts`).

**Estimated effort.** Low. The draft's "medium-high, the only fully net-new build
in this document" was wrong by three files.

**Done when.** A syllabus whose scope sentence today falls through to "nobody
said" produces a confirmable proposal; a test asserts an unconfirmed proposal
changes no count on the screen; and the three existing sources' behaviour is
unchanged.

**Sequencing: Phase 1** *(moved from Phase 2 — the dependency it was waiting on
already exists).*

### 4.4 · Quote Verification — Live

**Current state.** `app/src/lib/quotes.ts` checks the quotations in a student's
own draft against the material the app holds — the readings added to a course,
the guides, the glossaries, the case files, or a file dropped in for the purpose
— and returns one of four verdicts: **found** (with the source's own sentence
beside yours), **close** (the words are there but not as typed, shown as the
document writes it so the fix is a paste rather than a hunt), **near** (there is
a passage here that is mostly these words in this order, printed with an
instruction to compare rather than a claim that it matched), and **not in
anything here**.

The third verdict is the one that had to be got right, and it is. It is not
"wrong". The app holds a fraction of what a student reads, and a screen that
turned "I have never seen this book" into a red flag would be lying in the most
damaging possible direction — about somebody's academic honesty, in a tool they
trust. The wording is flat, the count says how much material was searched, and
nothing is coloured like an error.

It is **entirely on-device**. The file imports `./cite` and `./types` and nothing
else: no `fetch`, no model call, no key. That is checkable by reading two lines
of imports, which is the point. It also already handles the cases that make
literal matching fail on real writing — curly quotes, moved commas, scare quotes
that are not quotations, apostrophes, and ellipses, where each side of the gap is
looked for separately and in order, because that is what the ellipsis claims.
`lib/quotes.test.ts` holds 37 tests and `lib/quotes.adversarial.test.ts` holds
20 more.

**What was missing, and what closing it turned out to require.**

1. **Matching breadth.** Comparison was literal and loose-literal, so a
   quotation typed from a different edition read as "not in anything here" —
   true of the app, and useless to a student holding the page. `nearest` now
   places a window around the rarest distinctive word the quote and the source
   share and aligns the two in order, which finds the passage.
2. **Adversarial testing.** This was the real gap.
   `lib/quotes.adversarial.test.ts` is a pass written by someone trying to make
   the checker say **found** for a quotation that is not in the source: numbers
   changed inside an otherwise verbatim passage, sentences assembled from
   fragments that each appear separately, a different work by the same author,
   and near-miss paraphrases. It ends in three controls, because a file of
   adversarial cases that all come back "missing" is what a matcher switched
   off looks like.

**What the approach turned out to be.** Not a looser `found`. Widening the
verdict that asserts is the one change this file must never make — a
confirmation meaning "near enough" confirms nothing, in a screen a person may
act on when deciding whether their own citation is honest. So the breadth went
into a fourth verdict that never reads as a pass, is counted on its own line in
the summary, and is worded as an instruction to compare. Four rules came out of
the adversarial pass and are enforced in `nearest`: numbers are never forgiven,
the passage is one window rather than a collection, ordinary words cannot carry
a match, and quotations under eight words get no near verdict at all. Two of
them survived being reverted under the first version of the tests and have
cases of their own now.

It is still **entirely on-device**, and that is now asserted rather than
described: three tests read `lib/quotes.ts` and check that it imports `./cite`
and `./types` and nothing else, that no name reaching the network appears in it,
and that it holds no key and no address.

**Dependencies.** None technically. Release is gated separately on Vanderbilt
review, per [VANDERBILT-AUDIT.md](VANDERBILT-AUDIT.md) — this item can be
technically complete well before it is appropriate to show outside single-user
use.

**Estimated effort.** Was medium. Release timing remains an institutional
decision, not an engineering one.

**Done when — and it is.** The adversarial pass exists as a test file, was
written to break the checker, and passes; a test asserts `lib/quotes.ts` imports
nothing that reaches the network; and the "not in anything here" wording is
unchanged, which has a test of its own asserting the sentence character for
character.

**Sequencing: Phase 1, done. Public release still gated separately
([§8](#8-what-this-plan-does-not-cover)).**

---

## 5. Production Suite

Two of the four tools here are Live at full parity: the custom Equation Solver
and Grapher (`lib/calc.ts`, `lib/plot.ts` — 1,860 lines of plotting alone,
`lib/solve.ts`, `lib/maths.ts`) and the read-only Email Viewer
(`lib/mail.ts`, deliberately read-only: the app drafts, and you press send in
your own client).

The other two are complete enough to use daily and not yet complete enough to
hand to another student without caveats — though both caveats are narrower than
the draft records.

### 5.1 · Document Editor — Partial

**Current state.** Twelve block kinds (`app/src/lib/document.ts`): heading, text,
bullets, quote, table, equation, code, checks, image, table of contents, rule and
page break, each with notes. It exports to real `.docx` (`lib/docx.ts`, 1,019
lines of OOXML written directly) and to real `.pdf` (`lib/pdf.ts`, written
without a library, placing every line by hand because nothing in a PDF wraps
text).

Equations are already embedded properly, which the draft lists as work to do.
`lib/maths.ts` renders one notation three ways — MathML for the screen, **OMML
for Word**, Unicode for everywhere else — and `lib/docx.ts:610` calls
`omml(parse(block.latex))`, so an equation in an exported `.docx` is a real Word
equation object you can click and edit, not a picture somebody has to retype.

**What's missing.**

1. **Table edge cases** — merged cells and column widths do not survive every
   round trip through `.docx`.
2. **Embedded figures** — an `image` block holds a file you added. There is no
   way to place one of the app's *own* figures, charts or plots into a document,
   which is the thing a student actually wants when writing up a problem set.
3. **Export fidelity under wider structures** — a nested list inside a table
   cell, a long table crossing a page boundary, a figure with a caption near a
   page break. Each is checkable and none is currently checked.

**Technical approach.** Close the table cases against a fixture document that
contains every one of them. Add a figure block that references an app figure by
id and renders through the same path §3.1 builds, with `lib/svgout.ts` resolving
theme tokens so the exported file is not a black rectangle. Then add the export
QA step the draft describes and this repository's own practice already demands:
render every export to PDF, diff it against the in-app view, and treat a
difference as a failure rather than as a rendering quirk.

One caution learned in this repository and worth writing into that QA step: a
clean reading is a claim about the probe too. A visual diff that reports every
export perfect is also what a broken differ looks like, so the step ships with a
control — a document known to export wrong — and the control must fail.

**Dependencies.** The math engine (Live, already wired). Figures (§3.1) for the
figure block.

**Estimated effort.** Medium.

**Done when.** The fixture document round-trips through `.docx` and `.pdf` with
no visual diff against the in-app view; the control document fails the same
check; and an app figure can be placed in a document and exported legibly.

**Sequencing: Phase 1.**

### 5.2 · Spreadsheet — Partial

**Current state.** Substantially more built than the draft records.

* **159 functions** in `app/src/lib/sheet.ts`, catalogued for a reader in
  `app/src/lib/functions.ts`, with `functions.test.ts` reading the `case` labels
  out of the engine so the catalogue cannot drift from it.
* **Lookups are done**: `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`,
  `CHOOSE`.
* **Pivot tables are done**: `app/src/lib/pivot.ts`, 424 lines. Drawn under the
  grid and recomputed from the cells on every read so it cannot go stale — and
  **Put it in cells** writes the pivot out as a live block of
  `SUMIFS`/`COUNTIFS`/`AVERAGEIFS`, not as the numbers it happens to show. That
  is the difference between this and an "export summary" button: the block stays
  live, it can be charted because a chart reads cells, and it goes into the
  `.xlsx` as arithmetic Excel recalculates.
* Charts (`lib/chart.ts`), conditional formatting (`lib/condfmt.ts`), joined
  cells (`lib/joined.ts`), filters, fill handle, paste special, and a real
  `.xlsx` in and out.

**What's missing.** One thing, and it is the one the draft listed last:
**array-style formulas**. There is no spill mechanism — `sheet.ts:1877` says so
directly, "a grid has no way to spill one value across several cells" — and
therefore no `FILTER`, `SORT`, `UNIQUE`, `SEQUENCE`, `TEXTSPLIT`, `LET` or
`LAMBDA`. Every one of those returns a range, and a range needs somewhere to go.

**Technical approach.** This is a change to the grid's model, not an addition to
the function library, and it should be sequenced as one:

1. Give a cell's evaluated value a range shape — a result that is a 2-D block
   rather than a scalar.
2. Add a spill region to the sheet, computed like a pivot rather than written
   into cells: derived on read, so it cannot go stale, and so the underlying
   cells stay empty and honest.
3. Define the collision behaviour before the first function — a spill blocked by
   a non-empty cell must produce a visible error in the formula's own cell, not a
   partial write.
4. Then the functions, cheaply, because each is a few lines once the shape
   exists.

**Dependencies.** None blocking. This item can proceed in parallel with
everything else in this document, which is why it is the natural Phase 2
workstream for a second person.

**Estimated effort.** Medium-high — unchanged from the draft, but for a different
reason: the work is the spill model, not the function count.

**Done when.** `=FILTER(...)`, `=SORT(...)` and `=UNIQUE(...)` spill correctly; a
blocked spill shows an error in the formula's cell and writes nothing; a spilled
range charts and exports to `.xlsx` as a formula Excel recalculates; and
`functions.test.ts` still reconciles the catalogue against the engine.

**Sequencing: Phase 2.**

---

## 6. The whole plan as one schedule

The per-feature view above hides two things: what blocks what, and how much of
each phase one person can actually hold at once. This section is the same eleven
items rearranged into the order they get worked.

### What blocks what

```
Phase 1
  Figures (§3.1) ─────┬──────────────► Slides (§3.2, diagram-anchored layout)
                      ├──────────────► Watch (§3.3, visual assets)      [Phase 2]
                      ├──────────────► Cases (§3.4, diagram-backed)     [Phase 2]
                      └──────────────► Document Editor (§5.1, figure block)

  Listen · scripting (§3.5) ─────────► Watch (§3.3, narration script)   [Phase 2]
                                     └► Listen · batch pipeline (§3.5)  [Phase 2]

  Where Courses Meet (§4.1) ──── independent
  GPA Projection (§4.2) ──────── independent
  Exam Runway (§4.3) ─────────── independent
  Quote Verification (§4.4) ──── independent (release gated, §8)
  Document Editor · tables + QA (§5.1) ── independent

Phase 2
  Watch (§3.3) · Cases (§3.4) · Listen batch (§3.5) · Spreadsheet arrays (§5.2)
  Spreadsheet is independent of every other item in this document.

Phase 3
  Hardening only. Nothing here blocks anything. (§7)
```

Figures is the only real fan-out, which is why it is first and why its effort
estimate deserves the most scepticism. If Figures slips, Slides keeps its
existing `figure` layout and the Document Editor keeps shipping without a figure
block; nothing in Phase 1 stops.

### Phase 1 — foundational and pilot-ready

Everything here either unblocks something else or is a short job with a
disproportionate effect on what a pilot student sees.

| # | Item | Effort | Blocks | Why it is in Phase 1 |
| --- | --- | --- | --- | --- |
| 1 | **Figures** — join `lib/diagram.ts` to the Figures mode; STEM kinds (§3.1) | Medium | 4 items | The only fan-out in the plan |
| 2 | **Listen · scripting** — scripts and transcripts for a generated course (§3.5) | Low-med | Watch | Unblocks Watch; a script is useful with no audio |
| 3 | **GPA Projection** — close the `hours` and `points` exclusions (§4.2) | Low | — | Smallest job here; removes "why is my course missing" |
| 4 | **Exam Runway** — model-read scope as a confirmable fourth source (§4.3) | Low | — | Smaller than believed; visible in the weeks a pilot runs |
| 5 | **Where Courses Meet** — semantic matching as a fifth grade (§4.1) | Medium | — | The most distinctive claim in the product |
| 6 | **Quote Verification** — local semantic match + adversarial pass (§4.4) | Medium | — | Technical work must precede any release decision |
| 7 | **Document Editor** — tables, figure block, export QA with a control (§5.1) | Medium | — | Exports are what leaves the app and gets marked |
| 8 | **Slides** — bullet, comparison, quote-and-source layouts (§3.2) | Low-med | — | Cheap once Figures lands |

**Phase 1 exit criteria.** All eight **Done when** conditions met; `cd app` and
all five gates green (`npx tsc -b`, `npm run lint`, `npm test`,
`npm run test:shuffle`, `npm run build`); the regression baseline in
[REGRESSION-CHECKLIST.md](REGRESSION-CHECKLIST.md) met or exceeded with no test
dropped or weakened; and a course generated from a syllabus nobody on the project
has seen before renders every one of the eleven modes without an empty state that
a student would read as breakage.

**What a pilot can honestly be shown at this gate.** A student uploads their own
syllabi and gets: every deadline with the sentence it came from, a drillable
guide, a quiz, a cram sheet, slides, figures, a field guide, exportable
documents, a term GPA band that counts all their courses, an exam runway that
knows what the paper covers, and the places two of their courses teach the same
word. They are told plainly that narrated lessons and podcast editions exist for
the four hand-built courses and are coming for theirs, and that Quote
Verification is not part of the pilot ([§8](#8-what-this-plan-does-not-cover)).

### Phase 2 — full parity

| # | Item | Effort | Depends on |
| --- | --- | --- | --- |
| 9 | **Watch** — on-device narration over Figures assets (§3.3) | Medium | Figures, Listen scripting |
| 10 | **Cases** — worked-problem / case-study union, grounding check (§3.4) | Medium | Verified course model, `lib/cite.ts` |
| 11 | **Listen · batch** — content-hash pre-generation and caching (§3.5) | Medium | Listen scripting |
| 12 | **Spreadsheet** — the spill model, then the array functions (§5.2) | Medium-high | Nothing |

**Phase 2 exit criteria.** Every one of the eleven study modes is Live by the
definition in [§1](#live-partial-planned) — works for a generated course with no
caveat a student has to be told; the cost of generating one course's audio is
measured and recorded; the five gates green; and no mode card in
`lib/modes.ts` reports an empty state for a course the app built itself.

**Sequencing note.** Item 12 touches no file the other three touch. If two people
are working, that is the split.

### Phase 3 — hardening

Not gap-closing. See [§7](#7-phase-3--depth-and-scale) — and note that it cannot
start until Phase 1 has been in real hands for long enough to produce the
measurements it is sequenced against.

---

## 7. Phase 3 — depth and scale

Phase 3 is the work that only makes sense once real students have used the thing:
performance under real content volumes, cost under real generation volumes, and
the edge cases that only appear in somebody else's semester. It is deliberately
unscheduled. Committing to a hardening plan before the measurements exist is how
a team spends a month optimising the path nobody takes.

### First, the problem with "once real usage data exists"

This app does not collect usage data, and that is a decision rather than a gap.
`app/src/lib/usage.ts` counts screen opens **in `localStorage`, outside
everything that syncs**, and its header says why: the privacy page states that
signed out, nothing leaves the device and there is no third-party analytics, and
"those sentences are the reason somebody hands this app their coursework.
Quietly making them narrower to learn which screens are popular is a bad trade."
It stores counts and not a trail — a number per screen, not when, not in what
order, not for how long.

So Phase 3's inputs come from the pilot the way research data comes from
participants: students who agreed, telling us. Concretely — a session with each
pilot student where they open the usage screen and read their own counts out; the
exports they actually produced; the courses they uploaded, shared deliberately.
Slower than telemetry, and it does not require narrowing a promise that is load-
bearing. If that trade is ever revisited it should be revisited in the open, as a
decision, and not as a side effect of wanting a dashboard.

### 7.1 Performance

Measured today, against the four shipped courses: 44 units, 44 narrated lessons,
8 podcast editions, 60 destinations, 159 spreadsheet functions.

| Watch for | Today | What would trigger work |
| --- | --- | --- |
| Catalogue build on load | 4 courses | A student with 6–7 courses and their own added readings, where `buildCatalog` runs over an order of magnitude more material |
| Figure and diagram render | 17 hand-drawn SVGs | Generated diagrams (§3.1), which are parsed and sanitised per render rather than precompiled |
| Spreadsheet recalculation | Recomputed from cells on every read, by design | A gradebook with a spilled range (§5.2) feeding a pivot feeding a chart |
| Audio caching | Cached as played, never up front | A course whose audio is generated in-app (§3.5) rather than fetched from `public/` |
| Storage | IndexedDB, with `lib/quota.ts` warning before the disk fills | Generated audio, which is the first thing the app would store at megabyte scale |

The honest first move is not optimisation — it is instrumentation a student can
see: a measured render and build time on the existing diagnostics screen, so the
first person with seven courses can say what is slow rather than that it feels
slow.

### 7.2 Cost

Cost has two halves and only one of them is the API.

**Per generation.** `app/src/lib/claude.ts` already returns
`input_tokens`, `output_tokens`, `cache_creation_input_tokens` and
`cache_read_input_tokens` for every reply. Nothing yet aggregates them into
"what did this course cost to build". That aggregation is the prerequisite for
every other cost decision in this section, it is small, and it should be done in
Phase 2 alongside the batch pipeline rather than waiting for Phase 3.

**Per asset.** Audio is the expensive one, which is why §3.5's batch job is keyed
by content hash: a topic renders once, an edited unit re-renders, an untouched one
does not. The figure that decides whether that job runs eagerly or on demand is
cost per course, and it is not known until one generated course has been through
it end to end.

**What is deliberately not a cost lever.** Quality of the grounding checks.
`lib/cite.ts`'s verification of every generated quote against its source, and
§3.4's grounding check on cases, are the reason the output can be trusted; they
are the wrong place to save tokens, and a cheaper model that fabricates one
citation costs more than it saves.

### 7.3 Edge cases

The ones already known, each from a real failure recorded elsewhere in this
repository:

* **A syllabus that says a date two ways.** [VANDERBILT-AUDIT.md](VANDERBILT-AUDIT.md)
  records 4 September and 30 October each carrying two meanings, and a first pass
  writing only one of them.
* **A course with no units the parser recognises.** Quiz needs four distinct
  answers before it can field plausible wrong options (`lib/quiz.ts`); a thin
  guide must say so rather than open empty.
* **A term that is not a semester.** Quarters, summer sessions, a course that
  starts in week six.
* **A grading scale that is not the shipped one.** Already handled by naming the
  exclusion (§4.2) and worth revisiting with real scales from real schools.
* **Timezones.** `npm run test:zones` runs the suite in America/Chicago and
  Pacific/Kiritimati, which is the guard; a pilot outside Central time is the
  test.
* **A phone with no room.** `lib/quota.ts` warns before the disk fills; generated
  audio is the first thing likely to trip it.

### 7.4 What Phase 3 will not do

It will not add a readiness score, a mastery percentage presented as a
prediction, or a single-number GPA. Those refusals are made in
`lib/runway.ts`, `lib/ahead.ts`, `lib/stats.ts` and `lib/termgpa.ts`
independently and for the same reason: a number claiming to say whether you will
pass would be believed, and the app cannot know. Scale is not a reason to revisit
them — it is a reason they matter more.

---

## 8. What this plan does not cover

**Institutional gates.** Quote Verification can be technically complete and still
must not ship to students. A tool that returns a verdict about whether a
quotation in somebody's coursework is real carries academic-integrity weight, and
the decision to put it in front of a Vanderbilt student is the university's, not
this project's. [VANDERBILT-AUDIT.md](VANDERBILT-AUDIT.md) §7 holds that gate.
The engineering plan in §4.4 runs to completion regardless; the release does not
follow from it.

**Institutional data.** `server/institution/` has an empty production adapter
registry, and `app/src/lib/where.ts` publishes an `official` trust level that no
code path in this build returns — `where.test.ts` asserts it, which makes the
assertion a tripwire rather than a decoration. Connecting a real institutional
source is a separate piece of work with its own approvals, and nothing in this
document assumes it.

**The four hand-built courses.** Nothing in this plan changes them. They are the
fixture every measurement here is taken against, and a change to them invalidates
the baselines.

**Things deliberately refused, which are not gaps.** The app does not send email
(`lib/mail.ts`: something that can post a message as you to your professor is a
bigger promise than a study app should make). It does not look up textbook prices
(`lib/cost.ts`: a wrong price shown confidently is worse than a blank field). It
does not write coursework (`lib/doctemplates.ts`: every template is headings and
empty paragraphs). It does not infer exam scope (`lib/covers.ts`). A completion
plan that quietly reads these as unfinished features would be proposing to undo
the product's argument, which is why they are listed here rather than left to
inference.

---

## Appendix A — What measurement corrected

Each row is a claim in the draft this plan grew out of, what the tree said when
it was checked on 15 September 2026, and where to look.

| The draft said | Measurement says | Read it in |
| --- | --- | --- |
| Exam Runway "does not exist in the app today — the one feature in the entire product with no working version yet" | 922 lines and a screen, shipping, including a three-source coverage engine that refuses to infer scope | `lib/runway.ts` (313), `lib/covers.ts` (206), `screens/Runway.tsx` (403) |
| Exam Runway needs "a new Quiz/Cram engagement log (does not exist yet and must be built as part of this item)" | The engagement record exists and Runway already reads it — cards never answered, units never opened, papers sat | `lib/review.ts`, `lib/sitting.ts`, `lib/runway.ts` |
| GPA Projection is "a simple estimate rather than a modeled distribution"; build "a small weighted-scenario model (best / expected / worst)" | The low / middle / high band across courses exists, composed from four files, with letter cliffs handled and no rounding before the scale reads a percentage | `lib/termgpa.ts` (401), `lib/worth.ts`, `lib/cutoffs.ts`, `lib/grades.ts` |
| Spreadsheet is missing "pivot tables and deeper formula coverage (lookups, array-style formulas)" | Pivot tables ship, and write back as live `SUMIFS`; lookups ship (`VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`). Array formulas are genuinely absent, and need a spill model first | `lib/pivot.ts` (424), `lib/sheet.ts` (159 functions), `lib/functions.ts` |
| Document Editor should "wire in direct equation embedding from the existing math engine rather than a static image of an equation" | Already wired: a `.docx` equation is a real OMML equation object, editable in Word | `lib/docx.ts:610`, `lib/maths.ts` |
| Watch "produces visual, video-style walkthroughs for a limited set of concepts"; missing "full-course coverage" | 44 narrated lessons over 44 units — complete coverage of every shipped course. The gap is a generated course, which gets none | `public/audio/lessons/`, `pipeline/lessons.py` |
| Listen is missing "complete chapter-mark indexing across all content" | All eight editions carry a `chapters` block, rendered exact by the synthesiser. The gap is a generated course, and the absent batch pipeline | `src/data/courses/*/index.ts`, `audio/synth.py`, `pipeline/chapters.py` |
| Figures needs "a repeatable pipeline for turning arbitrary course concepts into a correct diagram" built from scratch | That pipeline exists — Claude writes a Mermaid or SVG specification, `cleanSvg` sanitises it, the app renders it — but is wired to the Draw screen and not to the Figures mode | `lib/diagram.ts` (331), `screens/Draw.tsx`, `screens/Create.tsx` |

Two claims in the draft survived unchanged and are repeated above on their own
merits: Where Courses Meet matches words rather than meanings (`lib/meet.ts`
says so in its own header), and Quote Verification has had no adversarial
false-positive pass.

The pattern in the corrected rows is one pattern. Eight of them describe an
engine that exists and a place it has not been connected to, or a capability that
exists for the four hand-built courses and not for a generated one. That is the
finding this pass produced, and it is why [§1](#the-distinction-that-turned-out-to-matter-more-than-the-three-statuses)
puts content coverage and engine coverage on separate axes.

---

## Appendix B — How to re-measure every number here

Every figure in this document came from one of these. Run them before trusting a
number that matters, and before opening a pull request against any item — the
first thing [CLAUDE.md](CLAUDE.md) asks is whether the work already landed.

```bash
# Start here, always.
git fetch origin main
git log --oneline -30 origin/main

# The gates. All five, from app/ — the repository root has no package.json
# with these scripts, so npm test there silently does nothing.
cd app
npx tsc -b            # types
npm run lint          # oxlint, plus the style and label audits
npm test              # the suite, in file order
npm run test:shuffle  # the suite, in an order nobody chose
npm run build         # production build

# Study modes, and the count this document states.
sed -n '/^  return \[/,$p' src/lib/modes.ts | grep -c "^      id:"
npm run counts        # rewrites the generated counts in the files that state them

# Content coverage, per course.
for c in bus core econ psci; do
  printf '%s units: '   "$c"; grep -c 'cards: \[' src/data/courses/$c/guide.ts
  printf '%s lessons: ' "$c"; ls public/audio/lessons/$c | grep -c mp3
  printf '%s editions: ' "$c"; grep -c 'chapters: \[' src/data/courses/$c/index.ts
  printf '%s examples: ' "$c"; sed -n '/examples: \[/,/^  \],/p' src/data/courses/$c/index.ts | grep -c 'tag:'
done

# Engine coverage.
grep -oE "case '[A-Z0-9.]+'" src/lib/sheet.ts | sort -u | wc -l   # 159 functions
sed -n '/DIAGRAM_KINDS = \[/,/\] as const/p' src/lib/types.ts | grep -c "^  '"
grep -c '^  {' src/lib/nav.ts                                      # 60 destinations
wc -l src/lib/runway.ts src/lib/covers.ts src/screens/Runway.tsx
wc -l src/lib/pivot.ts src/lib/termgpa.ts src/lib/diagram.ts src/lib/quotes.ts

# The two facts that decide four of the five study-mode plans.
sed -n '460,466p' src/lib/generate.ts     # figures, examples and audio
grep -n 'import' src/lib/quotes.ts        # two imports, neither of them the network
```

A number in this document that these commands contradict is this document being
stale. Correct it here, and say in the commit message which measurement moved.
