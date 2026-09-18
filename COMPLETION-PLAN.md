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
feature in the entire product with no working version yet". It is 1,189 lines
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
| Cases | Worked examples and pairings | 32 examples, 7 pairings | None | **Partial — both** |
| Watch | Narrated lesson per unit | 44 lessons over 44 units | None | **Partial — content** |
| Listen | Podcast editions | 8 editions, all chaptered | None | **Live — engine** (content per course) |

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
of twenty-one hand-drawn SVGs in `app/src/components/Diagram.tsx`
(`DIAGRAM_KINDS`). `app/src/lib/figure.ts` turns what a model reports in a newly
added reading into one of those four, with strict validation, so a figure read
out of week six's reading comes out looking like the guide's own figures because
it *is* one of them. Its own header states the cost plainly: the app "can
*recognise* the curve a reading is about but cannot draw a new one."

Separately, `app/src/lib/diagram.ts` (343 lines) already does the thing the draft
proposed building: Claude writes a **Mermaid or SVG specification** for an
arbitrary concept, and the app renders it after `cleanSvg` walks the parsed
document and strips scripts, event handlers and `foreignObject`. It is wired to
`app/src/screens/Draw.tsx` and `app/src/screens/Create.tsx`.

> **Measured 17 September: the join described below as missing has landed, and
> this section had not been updated.** `Figure` carries its fifth arm —
> `{ type: 'drawn', language, code }`, storing the specification rather than
> rendered markup so the sanitiser that runs is always today's;
> `lib/figure.ts:readDrawn` validates one; `components/FigureCard.tsx` draws
> one; and `lib/live.ts` merges figures read out of an added reading into the
> map the Figures mode reads. A drawn figure from a week-six reading reaches
> the Figures tab of a generated course. `lib/parity.test.ts` is the guard.
>
> What is still true of the two systems is narrower than "they do not meet":
> the hand-drawn kinds were all economics, statistics and marketing, and gap 2
> below was the genuine remaining one. **Closed 17 September**: `free-body`,
> `titration-curve`, `series-parallel` and `phase-diagram` are hand-drawn kinds
> now, seventeen having become twenty-one.

**What's missing.**

1. The two systems are not joined. A student in the Figures tab gets the closed
   closed list; a student who finds Draw gets anything, in a different place, that
   does not become part of the guide.
2. ~~The seventeen are economics, statistics and marketing diagrams. There is no
   free-body diagram, no circuit, no titration curve, no phase diagram — the
   quantitative and STEM coverage the draft named, and the one genuinely absent
   capability here.~~
   **Closed 17 September.** Four kinds added on the rule this section states —
   "where a shape is stable and worth drawing by hand". `free-body`,
   `titration-curve`, `series-parallel`, `phase-diagram`: each is drawn the
   same way in every introductory text, which is what stable means here, and
   each has one thing the figure is actually about to put in the accent — the
   horizontal pair that decides whether the block moves, the half-equivalence
   point where pH equals pKa, the junctions where the current divides, and the
   critical point where the liquid–gas line *ends* rather than running off the
   edge. A shape that varies by course still belongs in the generated arm,
   where the card says it was written to a description rather than checked by
   a person.
3. ~~A generated course gets no figures at all (`generate.ts:463`).~~
   **Corrected 17 September.** A *freshly* generated course gets none, and that
   is right rather than missing: at that moment it is a syllabus, and there is
   nothing to draw a figure *of*. `generate.ts` says so in its own words —
   "figures, examples and audio belong to a course built by hand. A generated
   one gets them when someone adds them, not by pretending." They arrive with
   the first reading, through `readMaterial` → `readFigures` → `adopt` →
   `mergeFigures`, which is not pretending. Measured: a generated course with
   one reading added leaves **0 of 11 mode cards empty**.

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

### 3.2 · Slides — Live

**Current state.** `app/src/lib/slides.ts` cuts a unit into a deck of nine slide
kinds — `title`, `q`, `a`, **`compare`**, **`bullet`**, `figure`, **`quote`**,
`note`, `end` — question always before answer, arrow keys or tap halves. The
cut moved out of the screen so the plan's own condition below could be run
against it. It works for every course, hand-built or
generated, because it is derived from units and cards and nothing else. A
diagram-anchored layout already exists: that is the `figure` kind.

Note that the app has a *second*, richer deck system for the Production Suite —
`app/src/lib/deck.ts` plans slides from a brief with a model,
`app/src/lib/decks.ts` stores them, `app/src/lib/pptx.ts` writes the `.pptx`.
That one is not the study mode, and the two should not be merged: one is your own
material rearranged with no model and no wait, and that is the property worth
keeping.

**What was missing.** Three layouts, all now built, and the yields are worth
recording because two of the three are not what the plan expected:

| Layout | Fires on | Measured against the four shipped courses |
| --- | --- | --- |
| **comparison** | a card whose question asks `X vs. Y` and whose answer names both sides | **20 of 279 cards**, and five `vs.` cards refused |
| **bullet** | an answer that is a numbered list of three or more | **1 of 279.** This material is written as prose |
| **quote-and-source** | a reading added to a unit, short enough to be a passage, with a source | **none shipped** — readings are added, not shipped |

**The refusals are the work.** §3.2's own condition is that no unit maps to a
layout "a reviewer calls forced", so each rule declines rather than reaches.
`comparison` refuses an answer that argues for one side rather than contrasting
two (*Total vs. marginal analysis — why does marginal win?*), halves named by
something other than the two sides (*Shutdown vs. exit rule?*), two labels
sharing every distinguishing word (*Type I vs. Type II error?*), a `vs.` buried
in a clause rather than asked about, and three sides, where two columns would
drop one (*Owned vs. earned vs. paid media?*). Each is a shipped card, and each
is asserted by name in `lib/slides.test.ts`. `bullet` refuses semicolons, which
were the obvious second rule and would have turned
`%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56` into three unrelated facts.

**No model call, and that is not a shortcut.** §3.2 proposed the mechanical rule
first "with Claude choosing only where the mechanical rule is ambiguous". There
is nowhere for that to happen: a card either has one `vs.` in its question with
two sides its answer names, or it does not. The property §3.2 asks to protect —
a deck with no wait and no key — is kept by there being nothing to call.

**A crash found by driving it, and not by this change.** Moving to the next
unit from the last slide of a longer one took the whole screen down — two
clicks in the app's own chrome. The reset that starts a new deck at slide one
is a `setAt(0)` during render, which schedules another render and does not stop
the current one, so the pass continued with an index past the end of the
shorter deck. Reproduced on `origin/main` before any of this was in the tree
(ECON's first unit is fifteen slides, its second eleven), fixed, and asserted
by a component test that performs exactly those two clicks.

**Dependencies.** Figures (§3.1) for the diagram-anchored layout to improve
beyond the existing `figure` kind. Nothing blocking for the other three.

**Estimated effort.** Was low-medium.

**Done when — and it is.** ~~Every unit across the four shipped courses and one
generated test course maps to a layout no reviewer calls "forced", and a test
asserts the question-before-answer invariant survives the new kinds.~~
`lib/slides.test.ts` walks every unit of all four shipped courses and asserts
both: every card gets exactly one answer slide, and every answer slide — `a`,
`compare` or `bullet` — is immediately preceded by its own question. A
generated course is the same walk with no figures and no readings, which is
what `lib/generate.ts:463` says one is.

**Sequencing: Phase 1, done.**

### 3.3 · Watch — Live

**Current state.** Complete for every unit of every shipped course: 44 narrated
lessons over 44 units (`app/public/audio/lessons/` — bus 13, core 6, econ 11,
psci 14), each a voice with the slide changing under it. They are produced by
`pipeline/lessons.py`, which reads the same guide through `pipeline/guide_reader.py`
that the deck and handout generators read, so a lesson cannot disagree with the
app about what the course says. `audio/synth.py` renders the audio.

**What was missing.** One thing: a course the app generated had no lessons,
because the pipeline is Python in this repository and does not run in a
browser. The draft's "full-course coverage and a repeatable production pipeline
rather than concept-by-concept manual assembly" describes work that
`pipeline/lessons.py` already is; the gap was that it is on the wrong side of
the app boundary — the same shape `lib/script.ts` closed for Listen.

**Closed by `app/src/lib/watch.ts`.** A unit with no recording gets a lesson
made of its own cards, read by `lib/speak.ts`. Every word is the guide's: a
unit's name, a card's question, a card's answer, a figure's title and caption.
No summarising, no bridging line, no model call — so no key, no wait, and
nothing invented. `speakable` is `lib/script.ts`'s, because a formula read out
loud should sound the same in both places.

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

A generated course's Watch is honestly labelled as synthesised on-device rather
than presented as equivalent to the recorded lessons. A mode that looks
identical whether it has forty-four produced lessons behind it or a robot voice
is the exact failure `lib/modes.ts` was written to end — so the Watch card now
has **three** states rather than two, and `modesFor` asks the browser whether it
will speak rather than taking a caller's word for it. Four places build that
argument and a fifth will; a field every one of them has to remember is how a
mode comes to promise narration a device cannot give.

**Beats, not seconds.** A recorded lesson has a timeline: every cue carries the
second it lands on, the player draws a scrub bar against it, and seeking works
because the synthesiser knew where it put every line. `speechSynthesis` offers
no duration before it speaks and no way to seek, so a spoken lesson advances one
utterance at a time and states no length at all. An estimated total printed
where the recorded lessons print an exact one is the failure
[`lib/where.ts`](app/src/lib/where.ts) is about.

**Two things found by driving it, both fixed.**

1. **A silent race.** Headless Chromium has `speechSynthesis` and *no voices*:
   every utterance completes instantly, so a lesson advancing on completion went
   through six beats in under a second and a half while saying nothing. Counting
   voices is the obvious check and is unreliable — the list loads
   asynchronously and is empty on the first call in browsers that do have one.
   How long the utterance took is reliable and does not care why, so an
   utterance that returns in under 250ms is reported as not spoken, the lesson
   stops, and the screen says what it says to a browser with no speech at all.
2. **A stranded reader.** The player stepped between units by walking
   `Object.keys(lessons)` — the units with an mp3 — which was right while a
   unit without one was a dead end. Measured on ECON with a reading added as a
   unit of its own: *unit 11 of 12*, `Next unit` greyed out, and a unit beyond
   it holding three cards the device would have read happily.

**Dependencies.** Figures (§3.1) and Listen (§3.5) both at Phase 1 completion.

**Estimated effort.** Was medium.

**Done when — and it is.** ~~A course generated from an uploaded syllabus offers
Watch for every unit, the mode card states which kind of narration it has, and
no shipped course's lessons change.~~ `lib/watch.test.ts` derives a lesson for
all forty-four units of the four shipped courses — they have recordings and do
not need one, which is exactly why they are the fixture: a derivation that fails
on material somebody wrote by hand will fail on material a model wrote.
`small.test.ts` asserts the three states of the mode card, and nothing in
`public/audio/` is touched.

**Sequencing: Phase 2, done.**

### 3.4 · Cases — Live (engine)

**Current state.** Two kinds of thing show in the Cases tab, and
`app/src/lib/modes.ts` counts both: the catalogue's worked examples, and the
guide's claim-and-test pairings. Measured: **8 worked examples per course, 32 in
all**, and **7 pairings, all of them in PSCI 1104** — this section said eight,
and seven is what is there.

The worked examples are also thinner than the name suggests. `Example` is
`{ tag, t, d }` (`app/src/lib/types.ts`) — a tag, a title, a description. It is a
worked example in the sense of a short illustrated case, not in the sense of a
problem carried through its steps with the arithmetic shown.

**What was missing.**

1. ~~Depth: no step structure~~ — **closed.** `Example` is a union in
   `lib/types.ts`: the existing short applied scenario, a **worked problem**
   (statement, ordered steps, result) and a **case study** (situation,
   question, analysis, what it turned on). `kind` is optional and absent reads
   as `applied`, so all thirty-two shipped examples stay valid and nothing is
   migrated — the choice `Figure` made about `figures?` for the same reason.
2. Breadth: claim-and-test pairings exist for one course of four. **Still
   open**, and it is content rather than engine: the shape is general, nothing
   stops a course having them, and nobody has written them.
3. ~~Generated courses get none~~ — **closed for the engine.**
   `lib/casework.ts` asks for cases from one unit's material, in the shape that
   unit calls for, and keeps only what the material supports.

**The one thing in the approach that did not survive the tree.** §3.4 proposed
"the course type selecting the few-shot template". *There is no course type.*
`Course` has a code, a name, a professor and a grading table, and nothing that
says whether a course is quantitative. Inventing one would be a field somebody
has to maintain and nobody has a reason to fill in — so `shapeFor` reads the
material instead: a unit whose cards carry arithmetic wants a worked problem, a
unit with people and dates in it wants a case study, and a unit of definitions
wants the applied scenario the shipped courses chose thirty-two times.

**Grounding, and the exact strength of the claim.** Every case must carry
`from` — a sentence copied word for word out of the unit it was written from —
and `readCases` checks it against that unit's own material, not the whole
course. A case whose quote is not found is dropped **whole**, not trimmed. It is
`lib/covers.ts`'s arrangement for exam scope and it works for the same reason: a
model that has to quote the source to be believed cannot support an invented
claim with an invented citation, because the citation is the thing being
checked. That is weaker than "every fact in this case is in the course" and it
is the strongest claim that can actually be checked; `lib/casework.ts` says so
in its own header so nobody reads the refusal as more than it is.

**Dependencies.** The verified course model (Live) and `lib/cite.ts` (Live).
Benefits from Figures (§3.1) for diagram-supported cases.

**Estimated effort.** Was medium.

**Done when — and it is.** ~~A generated course produces cases in the shape its
course type calls for~~ — in the shape its *material* calls for, for the reason
above; ~~every generated case has passed the grounding check~~; ~~and a test
feeds in a case containing an unsupported fact and asserts it is refused~~.
`casework.test.ts` has that test three ways: a citation that is nowhere in the
unit, a paraphrase of one that is, and a citation from a different unit of the
same course. It also walks all forty-four shipped units to check that every one
has a shape and material to write from.

**Still open, as content rather than engine:** claim-and-test pairings for the
three courses that have none.

**Sequencing: Phase 2, engine done.**

### 3.5 · Listen — Live (engine)

**Current state.** Eight podcast editions ship across four courses — bus 1, core
2, econ 2, psci 3 — and **every one carries a `chapters` block**. The chapter
marks are exact rather than estimated, because `audio/synth.py` knows where each
line starts; `pipeline/chapters.py` recovers them for a recording that arrived
without. `pipeline/make-script.mjs` drafts a script from a guide, and
`audio/README.md` records that the scripts are also the transcripts, which is the
text alternative an audio-only mode needs to be usable at all.

> **Measured 17 September: the Phase 1 half below is closed.** `lib/script.ts`
> is the script generation, in the app, over any course's own guide —
> `scriptFor(courseId, guide)`, whose header names this exact gap: "the
> capability existed on the wrong side of the app boundary". A generated course
> with cards opens Listen on a script, and `lib/modes.ts` says which it is
> rather than counting it as an episode: *"Script, not recorded"*. What a
> generated course still has no *audio* — rendered MP3 — and that is the
> boundary this section is really about, unchanged.

**What's missing.** Again one thing, and again it is the boundary: a generated
course gets no audio. The draft's "complete chapter-mark indexing across all
content" is already true of all content that exists.

The second half of the draft's ask was real and is now answered: there was no
cost-aware pre-generation. The eight editions and forty-four lessons were
rendered once, by hand, by a person running a script, and nothing recorded what
had been made from what — so a corrected card meant re-speaking the course it
was in. `npm run audio` is the other arrangement; the figures and what the
job refuses to claim are under Phase 2 below.

**Technical approach.** Two pieces, and they split cleanly across phases.

*Phase 1 — scripting and coverage.* Move the script-generation step into the app
and run it across the full verified course model, so a generated course has a
script per topic and therefore a transcript per topic. A script with no audio is
already useful: it is readable, searchable and accessible, and it is what the
audio is rendered from later.

*Phase 2 — the batch pipeline.* **Done** — `app/scripts/audio.ts`, deciding with
`app/scripts/audiocache.ts`, `npm run audio`. A pre-generation and caching job:
audio built once per topic, keyed by the topic's content hash so an edited unit
re-renders and an untouched one does not.

**The figures, measured on one machine with the shipped Piper voices.** 53.1 ms
of wall clock per spoken word, 0.174× realtime. The four courses from nothing:
**26.4 minutes** — bus 6.8, core 5.6, econ 5.8, psci 8.1. One card in econ
corrected, the way the repository did it before this: **2 minutes 14 seconds**,
because `lessons.py econ` speaks all eleven units to fix one. The same
correction through the job: **12.6 seconds**. That ratio is the whole of the
item.

**Two things the plan asked for turned out already to be true**, and the third
was not what it looked like:

* *"chapter-mark metadata written as part of the same job rather than as a
  second pass"* — `audio/synth.py` has always written `*.chapters.json` from the
  real audio positions in the render that produced them. `pipeline/chapters.py`
  is the recovery path for a recording that arrived without marks, not a second
  pass over one this repository made. Nothing needed changing.
* *"built once per topic"* — `pipeline/lessons.py --unit N` already rendered one
  unit. What was missing was never the granularity; it was any record of what
  had been rendered from what, so the only safe answer was always "all of it".
* The key had to cover **the renderer as well as the material**. Hashing the
  words alone is the version that looks right: change a gap constant or teach
  `speakable` a new symbol and every hash still matches while every file on disk
  is something the renderer would no longer produce. So the key is taken over
  the material and the renderers' own source together, per kind — a lesson rule
  cannot stale the four episodes, which would cost eighty minutes to no purpose.

**Four editions are outside it and the job says so.** `core-full`,
`econ-guide`, `psci-condensed` and `psci-full` are the older single-narrator
recordings; they have no script in this repository, nothing can rebuild them,
and nothing can say what they were made from. They get no manifest row, because
a row is a claim to know. Every run names them.

**What it does not do.** There is no `--check` in CI and the suite does not fail
when audio is stale — that would mean a synthesiser and two voice models on the
runner. `app/src/lib/audiobatch.test.ts` holds the shape instead: every asset
the repository wants has a row and a file, and the units are numbered the way
the renderer numbers them, which is the part a machine with no voices can still
be sure of.

**Dependencies.** The custom audio engine (`audio/synth.py`, Live) and
`pipeline/make-script.mjs` (Live).

**Estimated effort.** Low-medium for scripting; medium for the batch pipeline.

**Done when.** Every topic of a generated course has a script and a transcript
(Phase 1, done); audio for a topic is rendered at most once per content hash,
with chapter marks, and the job's cost per course is measured and recorded
(Phase 2, done — `audio/manifest.json`).

One honest qualification on "measured": the forty-eight rows committed there are
**adopted**, not timed. They record audio a person rendered before the job
existed, they carry `ms: 0`, and the cost report counts none of them — because
the alternative, filling the column in from the rate above, would put an
estimate in the one column whose point is that it is not one. The figures in
this section were measured; the manifest will hold its own the first time
somebody renders through it.

**Sequencing: Phase 1 for scripting and coverage; cost-optimised batch pipeline
in Phase 2. Both done.**

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

> **Measured 17 September: closed.** `lib/meet.ts:readSame` is the fifth grade
> — a model proposes pairs, they are checked against the glossaries it was
> given, and any pair the four string grades already hold is dropped, "so a row
> both can claim belongs to the stronger". The header sentence below is still
> true of the four string grades, which is what it is about.

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

> **Measured 17 September: closed, and this section had not been updated.**
> `termgpa.ts` exports `missingLine` and `fixFor`; `screens/Degree.tsx` lists
> every excluded course by code, says which field is missing in that course's
> own terms, and offers the tap that fixes it — Edit for `hours`, Grades for
> `points`, and nothing for `ungraded`, which has no fix but sitting an
> assessment. `EditCourse.tsx` has had a Credits field throughout. What is
> below is the argument for that design and is worth keeping; the "missing" is
> not missing.

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

**Current state.** 1,189 lines, three files, one screen, shipping.

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

> **Measured 17 September: closed.** `screens/Runway.tsx` does exactly what the
> approach below describes — `readScope` asks, `readProposal` checks the reply
> against the guide's own unit numbers, the range is shown as a proposal with
> the sentence it was read from, and confirming dispatches `setExamCovers` so
> it arrives as `yours`. There is no fourth `Source`, which is the design
> rather than an omission.

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

### 5.1 · Document Editor — Live

**Current state.** Thirteen block kinds (`app/src/lib/document.ts`): heading,
text, bullets, quote, table, equation, code, checks, image, **figure**, table of
contents, rule and page break, each with notes. It exports to real `.docx` (`lib/docx.ts`, 1,019
lines of OOXML written directly) and to real `.pdf` (`lib/pdf.ts`, written
without a library, placing every line by hand because nothing in a PDF wraps
text).

Equations are already embedded properly in the `.docx`, which the draft lists as
work to do. `lib/maths.ts` renders one notation three ways — MathML for the
screen, **OMML for Word**, Unicode for everywhere else — and `lib/docx.ts:619`
calls `omml(parse(block.latex))`, so an equation in an exported `.docx` is a
real Word equation object you can click and edit, not a picture somebody has to
retype.

The third of those three renderings was never wired to anything. The PDF wrote
the LaTeX as typed until the comparison below went looking, which is the shape
of this whole item: not a missing engine, a missing wire, found by nothing
having compared the two files a student can hand in.

**What's missing — and the first item of this list did not survive the tree.**

1. ~~**Table edge cases** — merged cells and column widths do not survive every
   round trip through `.docx`.~~ **Measured: neither exists.** A table is
   `{ rows: string[][]; header: boolean; caption: string }`
   (`app/src/lib/document.ts:173`). There is no span, no merge and no width in
   the model, in the editor or in either exporter, and both divide the columns
   evenly (`lib/docx.ts:408`, `lib/pdfout.ts:316`). This was a round-trip bug
   reported against a feature that has never been built. The *real* table gaps
   are in item 3, where the comparison below found them.
2. **Embedded figures** — an `image` block holds a file you added. There is no
   way to place one of the app's *own* figures, charts or plots into a document,
   which is the thing a student actually wants when writing up a problem set.
   **Closed.** A `figure` block carries one of the app's own figures — a copy
   rather than a reference, because exporting is a pure function of the
   document and a guide edited in October would otherwise change what a
   September essay says. `figureTable` reduces it once and the `.docx`, the
   PDF, the markdown and the page the editor draws all read that one
   reduction, so a new kind could not open a sixth way for the renderings to
   disagree.
3. **Export fidelity under wider structures.** The real gap, and much wider than
   "edge cases": the two exporters had never been asked whether they agreed, and
   they did not. **Closed**, by `app/src/lib/exportqa.ts` and what it found.

**What the comparison found.** `lib/exportqa.ts` takes what each block obliges
an export to carry — written from the block, not from either exporter — and
checks both files for it. On a fixture document holding one of everything:

| One document, two exports | `.docx` | `.pdf` before | `.pdf` after |
| --- | --- | --- | --- |
| An equation | a real Word equation object | `\frac{a+b}{c^2}`, as typed | `(a+b)/(c²)` |
| A table's caption | Word's own Caption style | nothing at all | printed under the table |
| A 60-row table over three pages | header repeats (`w:tblHeader`) | header on page 1 only | header on every page |
| Greek and operators in a formula | carried | dropped to spaces | spelled out |
| A picture | embedded | `[Alt text]` in italics | the picture (`lib/pdfimage.ts`) |

**The probe is a claim about itself.** Three of the first four findings were
faults in the comparison rather than in the exporters, and the control surfaced
each: it obliged both files to print the `*` around an italic word; it read the
*layout* rather than the bytes the file will hold, so it could not see an
encoding loss at all; and it then read the encoding's own em-dash byte back as
Unicode and called every high character lost. `control()` is a document that
must fail — a paragraph in a script WinAnsi has no bytes for, which is a
difference that is correct and permanent, so it cannot quietly stop failing the
day somebody fixes a defect.

**Dependencies.** The math engine (Live, already wired). Figures (§3.1) for the
figure block.

**Three of the five figure arms, and why.** A document figure is narrowed at
the type to `bars`, `steps` and `image` (`DocFigure`). The other two — the
hand-drawn diagrams and anything from the Draw screen — are SVG at
the moment of display, neither exporter can rasterise one, and a figure that
arrived in the `.docx` as a caption over an empty space is precisely the defect
the comparison was written to find. `lib/imagesize.ts:151` makes the same call
one layer down in the same words: not offer them rather than offer them and
fail on export. The picker says which two are missing and why, because a
figure simply absent from a list reads as a bug.

**A sixth difference, in the rendering nothing was comparing.** The comparison
reads two files; the page the editor draws is a React tree and it cannot see
that one. Asking every renderer what it does with every kind — the question
that found the other five — found that `screens/write/Paper.tsx` had **no case
for a picture at all**, so a document with a figure in it drew a blank space on
the page headed "the way it will print" while both exports carried it. Closed,
with a `never` at the foot of that switch and of `lib/pdfout.ts`'s, since both
return nothing and a missing case in either draws nothing rather than failing
the typecheck.

**What the PDF will not carry, stated rather than discovered.**
`lib/pdfimage.ts` hands a picture's bytes to the file without decoding them —
a baseline JPEG under `DCTDecode`, a PNG's concatenated `IDAT` under
`FlateDecode` with PNG's own row filters as `Predictor 15`. It refuses a PNG
with an alpha channel (a PDF has no image with alpha in it; transparency is a
second image, and splitting one interleaved stream means inflating it), a
palette with `tRNS`, an interlaced or non-8-bit PNG, a progressive JPEG and a
GIF. A refusal prints the alt text exactly as before: visibly not there rather
than silently wrong.

**Estimated effort.** Was medium. Spent.

**Done when — and it is.** ~~The fixture document round-trips through `.docx`
and `.pdf` with no visual diff against the in-app view; the control document
fails the same check~~ — done, as a content comparison rather than a pixel
diff, for the reason `lib/exportqa.ts` gives: a real visual diff needs Word, a
PDF renderer and a browser in one room, and this has to run in the suite.
~~An app figure can be placed in a document and exported legibly~~ — done, for
the three arms both exports can carry, with the other two refused at the type
and named in the picker.

**Sequencing: Phase 1, done.**

### 5.2 · Spreadsheet — Live

**Current state.** Substantially more built than the draft records.

* **164 functions** in `app/src/lib/sheet.ts` — 159 when this was written, plus
  the five array functions below — catalogued for a reader in
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

**What was missing, and is now built.** One thing, and it was the one the draft
listed last: **array-style formulas**. There was no spill mechanism — the
comment on `SPLIT` said so directly, *"a grid has no way to spill one value
across several cells"* — and therefore no `FILTER`, `SORT`, `UNIQUE`,
`SEQUENCE` or `TEXTSPLIT`. Every one of those returns a range, and a range
needed somewhere to go.

**The four steps below were right and were followed in that order.** The spill
region is `spillOf` in `lib/sheet.ts`, derived on read exactly as `lib/pivot.ts`
is derived on read, and the cells under a block stay empty — which is what makes
deleting the formula take the whole block with it and makes a `SUM` over the
area read what is on screen. A blocked spill is `#SPILL!` in the formula's own
cell, an eighth member of `ERRORS`, and never a partial write.

**One thing the four steps did not anticipate**, and `FILTER` is unusable
without it: `FILTER(A2:C40, C2:C40>60)` is how every spreadsheet writes it and
how every student has been taught to write it, and a range compared to a value
had no meaning in this engine at all — a bare range in an expression is
`#VALUE!`, deliberately, so `=A1:A3` cannot quietly mean `=A1`. So a range
argument may now be put to a **comparison** against one value, cell by cell,
keeping its shape. Deliberately only that: range plus range and range times two
are a larger change to the expression evaluator, and half of array arithmetic
shipped quietly would be worse than none — a student would find `>` working and
conclude `*` does. `=B1:B9*2` is still `#VALUE!`, which is a thing somebody can
see.

**Three things in the app turned out to be wrong the moment a cell could show a
value it did not hold**, each a shortcut that had been exactly right until then:

* **The `.xlsx` export wrote what a cell showed.** A spilled cell shows a value
  and holds nothing, so the export put typed-in text in exactly the cells Excel
  was about to spill the same formula into — and Excel answers that with
  `#SPILL!`. The file would have arrived broken, having looked right on the way
  out. A cell empty in `cells` now exports blank, whatever is drawn in it.
* **The chart skipped empty cells before evaluating them.** A spilled column
  charted as one bar and a row of gaps.
* **Focusing a spilled cell blanked it.** A focused cell shows what was typed
  into it, which is right for a formula and was the whole of the bug here: the
  name you clicked on vanished. A cell showing somebody else's block keeps its
  value and selects it, so the first keystroke replaces it rather than appending
  to it — and typing over a spill is allowed, because that is how the block gets
  blocked and how deleting what you typed brings it back.

**The four steps, as they were planned:**

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

`LET` and `LAMBDA` are **not** built and are not in this item's "done when":
neither returns a range, so neither needed the spill model, and both are a
change to the parser's idea of a name rather than to the grid's idea of a
value.

**Dependencies.** None blocking. This item can proceed in parallel with
everything else in this document, which is why it is the natural Phase 2
workstream for a second person.

**Estimated effort.** Medium-high — unchanged from the draft, but for a different
reason: the work is the spill model, not the function count.

**Done when.** `=FILTER(...)`, `=SORT(...)` and `=UNIQUE(...)` spill correctly
(**done**); a blocked spill shows an error in the formula's cell and writes
nothing (**done**); a spilled range charts and exports to `.xlsx` as a formula
Excel recalculates (**done** — the formula goes at its anchor and the cells
under it go as blanks, which is the half that had to be fixed; the export does
not write a spill-range annotation, and Excel recalculates a dynamic-array
function without one); and `functions.test.ts` still reconciles the catalogue
against the engine (**done** — it failed the moment the five functions landed,
which is the whole reason it exists, and the catalogue grew an eighth shelf,
**Blocks**, rather than filing them under Lookup).

**Sequencing: Phase 2, done.**

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
| 1 | ~~**Figures** — join `lib/diagram.ts` to the Figures mode; STEM kinds (§3.1)~~ **Done** | Medium | 4 items | The only fan-out in the plan |
| 2 | ~~**Listen · scripting** — scripts and transcripts for a generated course (§3.5)~~ **Done** | Low-med | Watch | Unblocks Watch; a script is useful with no audio |
| 3 | ~~**GPA Projection** — close the `hours` and `points` exclusions (§4.2)~~ **Done** | Low | — | Smallest job here; removes "why is my course missing" |
| 4 | ~~**Exam Runway** — model-read scope as a confirmable fourth source (§4.3)~~ **Done** | Low | — | Smaller than believed; visible in the weeks a pilot runs |
| 5 | ~~**Where Courses Meet** — semantic matching as a fifth grade (§4.1)~~ **Done** | Medium | — | The most distinctive claim in the product |
| 6 | ~~**Quote Verification** — local semantic match + adversarial pass (§4.4)~~ **Done** | Medium | — | Technical work must precede any release decision |
| 7 | ~~**Document Editor** — tables, figure block, export QA with a control (§5.1)~~ **Done** | Medium | — | Exports are what leaves the app and gets marked |
| 8 | ~~**Slides** — bullet, comparison, quote-and-source layouts (§3.2)~~ **Done** | Low-med | — | Cheap once Figures lands |

**Phase 1 is done.** All eight items above have landed, each as its own pull
request with its own measurement. Two of them changed shape on contact with the
tree and the item says which: §5.1's first missing item was a round-trip bug
reported against merged cells and column widths that do not exist anywhere in
the app, and §3.2's bullet layout fires on one card in two hundred and
seventy-nine because this material is written as prose. Both are recorded where
they happened rather than quietly dropped, which is the same discipline
[Appendix A](#appendix-a--what-measurement-corrected) applies to the draft this
plan grew out of.

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
| 9 | ~~**Watch** — on-device narration over Figures assets (§3.3)~~ **Done** | Medium | Figures, Listen scripting |
| 10 | ~~**Cases** — worked-problem / case-study union, grounding check (§3.4)~~ **Engine done** | Medium | Verified course model, `lib/cite.ts` |
| 11 | ~~**Listen · batch** — content-hash pre-generation and caching (§3.5)~~ **Done** | Medium | Listen scripting |
| 12 | ~~**Spreadsheet** — the spill model, then the array functions (§5.2)~~ **Done** | Medium-high | Nothing |

**Phase 2 exit criteria.** Every one of the eleven study modes is Live by the
definition in [§1](#live-partial-planned) — works for a generated course with no
caveat a student has to be told; the cost of generating one course's audio is
measured and recorded; the gates green; and no mode card in `lib/modes.ts`
reports an empty state for a course the app built itself.

**That last one is a test now, not a sentence** — `app/src/lib/parity.test.ts`.
It was the one criterion here that nothing checked, and it is the kind that
stops being true quietly: a twelfth mode, a stricter `ready`, a generated
course losing its path into one of the assembly functions, and the prose keeps
saying otherwise. Measured on the real path — a generated course with one
reading added — it is **0 of 11 empty**. On a device with no speech synthesis
it is one, Watch, and the test asserts that too, because that is a statement
about the browser rather than about the course and the criterion should be
exactly as strong as it is and no stronger.

**Sequencing note.** Item 12 touches no file the other three touch. If two people
are working, that is the split.

### Phase 3 — hardening

Not gap-closing. See [§7](#7-phase-3--depth-and-scale) — and note that most of
it cannot start until Phase 1 has been in real hands for long enough to produce
the measurements it is sequenced against.

Two pieces need no pilot, because they are the instruments the rest is measured
with rather than conclusions drawn from measurements:

| # | Item | Effort | Depends on |
| --- | --- | --- | --- |
| 13 | ~~**Per-generation cost** — every call that spends is counted, and a course's build cost is answerable (§7.2)~~ **Done** | Medium | Nothing |
| 14 | ~~**Measured render and build time on the diagnostics screen** (§7.1) — "the honest first move is not optimisation, it is instrumentation a student can see"~~ **Done** | Low-medium | Nothing |

Everything else in §7 waits for students — by the argument at the top of that
section, which is about what this app refuses to collect rather than about
effort.

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
8 podcast editions, 60 destinations, 164 spreadsheet functions.

| Watch for | Today | What would trigger work |
| --- | --- | --- |
| Catalogue build on load | 4 courses | A student with 6–7 courses and their own added readings, where `buildCatalog` runs over an order of magnitude more material |
| Figure and diagram render | 17 hand-drawn SVGs | Generated diagrams (§3.1), which are parsed and sanitised per render rather than precompiled |
| Spreadsheet recalculation | Recomputed from cells on every read, by design. A spill is derived on read too, once per cells object rather than once per cell — see the memo on `spillOf` | A gradebook with a spilled range (§5.2) feeding a pivot feeding a chart |
| Audio caching | Cached as played, never up front | A course whose audio is generated in-app (§3.5) rather than fetched from `public/` |
| Storage | IndexedDB, with `lib/quota.ts` warning before the disk fills | Generated audio, which is the first thing the app would store at megabyte scale |

The honest first move is not optimisation — it is instrumentation a student can
see: a measured render and build time on the existing diagnostics screen, so the
first person with seven courses can say what is slow rather than that it feels
slow.

**Done** — `lib/timing.ts`, shown under **How fast** on the Data screen. It is
the instrument and not a conclusion: nothing in it decides anything is too
slow, because the figure that would decide it does not exist until somebody's
own semester produces one.

*It is not telemetry, and that is the design rather than a caveat.* The
readings live in memory, are gone on reload, and are in nothing that is stored
or synced. Each name keeps how many times, the last, the slowest and the total
— a summary and not a trail, which is the same refusal `lib/usage.ts` makes
about screen opens. `lib/timing.test.ts` reads the file and fails on a line
that writes one of these figures anywhere, because the preamble above is
explicit that this trade should be made in the open if it is ever made, "and
not as a side effect of wanting a dashboard".

**And the first thing it measured contradicts the row above it.** Driven in
Chromium over the four shipped courses:

| Reading | Measured |
| --- | --- |
| First drawn (the browser's own `first-contentful-paint`) | 620–684 ms |
| Drawing a screen | **259 ms**, worst over the guide |
| Catalogue build | **0.20 ms**, over 4 courses |

The catalogue build is the first row of the table above — the thing this
section expects to slow down first — and it is *three orders of magnitude*
cheaper than drawing a screen. Multiplying it by the order of magnitude more
material a seven-course student brings still leaves it under a fifth of one
screen draw. That does not retire the row: a linear extrapolation from four
courses is a guess, which is the kind of claim this instrument exists to
replace. It does say where the first person to look should look, and it is not
where this plan said.

### 7.2 Cost

Cost has two halves and only one of them is the API.

**Per generation. Done**, and it was worse than this paragraph said.
`app/src/lib/claude.ts` has always returned `input_tokens`, `output_tokens`,
`cache_creation_input_tokens` and `cache_read_input_tokens` for every reply,
through an `onUsage` hook the caller had to remember — and **one of
twenty-five callers remembered it**. So the trouble was not that nothing
aggregated the counts. It was that nothing *recorded* them: building a course
from a syllabus, checking a generated quote against its source, reading a
syllabus for dates, drafting an email, planning an assignment, solving a
problem and eighteen more spent the student's money and wrote down nothing.
The meter in Settings → The assistant was the Ask tab's figure, presented as
the app's.

Seeded with a plausible term's work, the old meter read **2.0¢ of 76.4¢**.

Four pieces, and the first is the one that matters:

* **Recording moved inside `ask`**, so a call site cannot forget. What a caller
  supplies now is what the call is *for* — `about`, and `courseId` where it
  knows one. A call that says neither is still counted, under `unnamed`, which
  is a row somebody can see and fix; money that was never counted is not.
* **`lib/spendnames.test.ts` reads the source** and fails on an `ask` call that
  does not say what it is for, the way `functions.test.ts` reads the engine's
  `case` labels. Adding a call site and describing it are two different
  afternoons.
* **`claimFrom` closes the one gap that could not be closed at the call site.**
  `generateCourse` cannot name its course: the id comes from the code in the
  reply it is paying for. So the build notes when it started and claims its own
  rows once it knows what they were for — never a row that already names a
  course, because two builds can overlap.
* **The meter shows both answers**: by course, which is this section's
  question, and by what asked, which is the other one — *which course was
  expensive* and *which part of the work was* are different questions, and the
  build is the large line in every course.

One thing found on the way, and it is a note about probes rather than about
cost: the first version of the source check cleared `lib/classify.ts`, the one
silent call site whose *prompt* lists a field called `about`. The probe was
reading the words the model is sent rather than the code that sends them. It
empties every string literal before looking now, and the line that fooled it is
a test.

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

## 8b. Deployment — the settings a deployed copy could not be given

Every phase above measures the app as it runs from `app/`. This section is about
the only copy a student ever opens, and it was found by asking a question none of
the phases ask: of the settings this app reads, how many can the thing that
builds the deployed site actually supply?

**Three of fifteen.** The app reads fifteen `VITE_…` build inputs and
`app/.env.example` documents every one. `.github/workflows/pages.yml` — the only
thing that builds the deployed site — carried the Supabase pair and the push key.
The other twelve had no way in at all: the university gateway that the whole of
[§10](#10-phase-1--one-complete-course-workflow) was built against, the assistant
proxy, the calendar forwarder, the OAuth proxy, four client IDs, and the four
STUN/TURN settings.

Two of those twelve are documented *as* deployment settings. `VITE_ICS_PROXY`:
"a deployment points it at anything serving the same one route."
`VITE_CLAUDE_PROXY`: "unlike it, it survives a build, so this is the field a
deployed copy uses." Both described a configuration the deploy had no way to
apply.

**Why it lasted.** Nothing breaks. Every one of the twelve degrades politely and
says so on the screen: the University screen reports that no approved connection
is configured, Connect offers the `.ics` file route instead of a sign-in, the
call screen says plainly that some networks will refuse. A deployed copy with
all twelve missing is indistinguishable from one where somebody switched them
off on purpose. The failure mode of good degradation is that it hides the
difference between *off* and *unreachable*.

**Measured, with a control.** A build given `VITE_BUILD`, `VITE_ICS_PROXY` and
`VITE_UNIVERSITY_GATEWAY_URL` as sentinels put all three into the bundle (6, 5
and 6 chunks). The same build with nothing set carried none of them. So the
variables work and only the deploy was missing them — which is the claim, and
without the second build it would have been an assumption.

**What the probe nearly got wrong, again.** The obvious scan is for
`import.meta.env.VITE_X`. It finds six of the fifteen. `cloud.ts`, `connect.ts`,
`rtc.ts`, `feedlink.ts` and `assistant.ts` all alias `const env = import.meta.env`
and then read `env.VITE_X`, so nine names — including `VITE_SUPABASE_KEY`, which
the deploy *does* carry — are invisible to it. A probe reporting six of six
present would have read as a clean bill of health.
`app/src/lib/deploy.test.ts` therefore matches the bare name anywhere in the
source, and its first test is a control on itself rather than on the workflow.

**And what it found that nobody was looking for.** With comments still in scope,
the scan reported a sixteenth name: `VITE_BUILD`, read by the diagnostics report
in `screens/Privacy.tsx` and set by nothing anywhere. The Build row at the top of
every diagnostics file a student has ever sent said `dev`, including the ones
from the deployed site, where that row is the only thing identifying which build
the bug is in. The stamp that exists is `VITE_BUILD_ID`, which `vite.config.ts`
writes on every build and `lib/warm.ts` already uses. Fixed, and the test now
asserts that a name appearing only in a comment is not counted — the comment
explaining the dead variable was itself enough to make the first version of the
scan demand the deploy carry it.

**Done when.** `pages.yml` maps every settable input as
`NAME: ${{ vars.NAME || secrets.NAME }}`, a repository variable winning over a
secret of the same name; the run prints which of the fifteen this build got,
by length and never by value; and `deploy.test.ts` fails when the app reads a
setting the deploy cannot supply. Mutated against the pre-fix workflow, fifteen
of its nineteen tests go red.

**Two refusals, at deploy time rather than in a browser.** An Anthropic key
pasted into `VITE_CLAUDE_PROXY` fails the run, because anything named `VITE_…`
is handed to everyone who loads the site. And a gateway address the app would
refuse — a plain `http://` one, or one carrying userinfo, a query or a fragment,
the rules `lib/university.ts` applies — fails the run too. Refused there it is a
sentence on a screen after the deploy has gone out; refused here it is a red run
before it does. Five refusals, each tested, each with a control that must not
fire: an `https` address with an `@` in its path, one with a port and a path,
and a proxy address that is an address.

**What this does not do.** It does not deploy the university gateway itself.
`server/institution/` still runs from a command line behind a reverse proxy
somebody sets up, and `docs/UNIVERSITY_CONNECTIONS.md` says how; what changed is
that the deployed app can now be *pointed* at one. Nor does it set any of the
fifteen: they are empty on this repository and the deploy says so on every run.

---

## 8c. Forms — publishing to real respondents

The build-out plan this document grew out of carries a table of University
Services domains that **§1 to §8 above never tracked**. Three of them are
Phase 2 and none is gated on an institutional conversation; the first is
described, in the source document's own words, as *"publishing to real
respondents, branching logic, permissions, response analysis — an engineering
lift, not an institutional-approval one."* This section is that lift.

**Measured first.** Branching logic was already built: a question carries
`condition: { questionId, equals }` and `visibleQuestions` applies it.
Permissions were partly built — `accepting`, `opens`, `closes`, `limit`.
Response analysis was built, as the per-option bars on the builder's Answers
tab. What did not exist was the item the sentence leads with. `formResponse`
had exactly one caller, `FormBuilder.tsx`, and the responses sat in a device
library on the author's own machine. **A form nobody but its author could open
is a questionnaire with one respondent.**

**The decision the rest follows from.** A question carries `answer` and
`points`. Uploading the questions unchanged would hand a respondent's browser
the marking scheme for a quiz it is about to sit — and a score computed on the
respondent's device is a score the respondent chose, which is not a scoring
system. So the row is split by *who may see it*: `questions` holds what a
respondent must be shown, `marking` stays in the author-only table and appears
in no view and no grant, and a response carries answers and nothing else. The
mark is computed on the author's device when they collect, which is the only
place both halves exist at once.

That is also why `creations.ts` now has `checkedAnswers` and `markAnswers`
where it had one function: checking is what a respondent's browser does and
marking is what the author's does, and they had been one pass only because
until now they always ran on the same machine. Three cases assert the seam
changed no mark.

**The link is the whole of the credential**, as it already is for a published
`.ics` feed, because a respondent has no account and cannot be asked for one.
So the deliberate hole has to be exactly the shape it was meant to be and no
larger, and that is a claim about row-level security rather than about
TypeScript. `supabase/forms.check.sql` runs **26 checks against a real
Postgres** — `supabase/check.sh`, which was already here and which nothing in
this plan had used.

**Mutated, because a policy that has never refused anything is not known to
refuse.** Six mutations of the migration, each re-run through the harness:
widening the form's select policy to `true`, widening the response read,
exposing `marking` through the published view, exposing `owner`, and dropping
the cap clause are **all five caught**. The sixth — granting `select` on
`forms` to `anon` — **passes, and should**: row-level security is the gate, as
`anon` has no `auth.uid()` and no policy matches, so the revoke is defence in
depth and the checks being indifferent to it is the accurate reading. That is
written into the check file, because a reader finding five caught and one not
deserves the reason rather than a gap.

On the app's side, five mutations of `lib/formshare.ts` — making `asked()` a
spread of the source question, un-stripping the answer, un-zeroing the marks,
claiming the respondent's form is a quiz, and accepting any string as a
published id — are all five caught by `formshare.test.ts`.

**A respondent is not shown the app.** `screens/Respond.tsx` is mounted from
`main.tsx` *instead of* `<App />`: no store, no assistant, no tab bar, and no
first-run prompt about importing a syllabus. Somebody followed a link to answer
two questions. It is a **2.62 kB chunk**, so that is what a stranger downloads.

**And then a screenshot found two things the gates could not.** The page
rendered with every line against the left edge of the phone, because its
padding asked for `var(--sp-8)` and the scale stops at `--sp-7`: one undefined
token voids the whole shorthand, and it typechecks, it lints, and the suite has
no opinion about a custom property that does not exist. The second was prose —
the builder said *"Sending a link … needs your school's own form service"*,
which this change makes false. Both are fixed, and the padding is longhand now
so a future bad token costs one property rather than all four.

Driven in a real browser end to end: the form loads, four question types
answer, and what goes on the wire is `{ form_id, answers }` and nothing else —
no score, which is the design, proved on the wire rather than in a comment.

**Done when.** A form built under Create publishes to a link; somebody with no
account answers it; the answers return to the author and to nobody else; the
answer key never leaves the author; a closed form, an unopened window, a passed
window and a form at its cap each refuse in the database; and withdrawing takes
the answers with it. All of it asserted, in `forms.check.sql` and
`formshare.test.ts`.

**What this does not do.** It does not know who answered — there is no sign-in
on the answering side — so an anonymous form here is not a *verified* anonymous
survey and the screen says so. It does not apply its own migration: like every
other table in `supabase/`, that is a person pasting SQL into a dashboard, and
until they do, publishing reports the error and every other part of a form
still works.

---

## 8e. Meetings — the door

The build-out plan's Meetings row is *"authentication, waiting rooms, relay
infrastructure, captions, moderation, recording."* This section is the first
three words of it and the moderation that follows from them; captions and
recording are separate and are not here.

**Measured first.** `lib/call.ts` is unusually clear about what it was:
*"Nothing about this is a secret — a code is a name, and the fact that anybody
holding one can walk in is said on the screen rather than implied by its
length."* That is the right default for a study group and the wrong one for
office hours, and there was no way to change it. Relay infrastructure already
existed as `VITE_TURN_URL`/`_USER`/`_PASS` in `lib/rtc.ts`, and became settable
on a deployed build in [§8b](#8b-deployment--the-settings-a-deployed-copy-could-not-be-given).

**The argument this had to answer.** `hostOf` has been in `lib/mesh.ts` since
the call was built, and its comment is a refusal: *"There is no host in a mesh
— no server, nobody with a switch — so this is the only honest definition, and
the only thing it unlocks is asking… It does not mute anybody, because nothing
here can, and a button that claimed to would be a lie somebody relied on in a
seminar."*

That is correct and a waiting room does not contradict it, because the two asks
are not the same shape. **Muting somebody is compulsion**: it needs their device
to act against them, and nothing here can reach it. **Keeping somebody out is
refusal**: it needs every other device to *not* act, and a connection nobody
opens carries nothing. So one is a request with a polite name and the other is
a fact about the mesh. The call gains a door and still no switch — there is no
host mute here, and there should not be.

**Who holds it.** The same `hostOf`, reused rather than reinvented. Two rules
for who is in charge are two rules that can disagree, and a call where two
people each think they are the host is worse than one with none.

**What actually keeps somebody out** is `gated` — `reconcile` narrowed to the
people this device has been told are inside — reached through `Session.keep`.
Not the host's refusal, which is a message a client can be written to ignore.

**The first design put the hinges outside the door.** Arrivals were to send a
`knock` instead of a `here`, and the queue was built from those. A client that
skipped knocking and simply shouted `here` walked straight in. The queue is
derived instead — the roster, less the people let in — so every arrival is at
the door by default whatever it sent, and a client written to bypass the queue
has nothing to bypass. A test asserts exactly that case.

**Removal needed its own set.** In an open call `allowed` means nothing —
everybody in the roster gets a connection — so evicting somebody would have
reconnected them on the next roster change. The alternative was to silently
switch the host to holding the door, which is a setting they did not touch
appearing to change by itself. `removed` is separate and always applies, and
an ordinary call with nobody removed still takes `reconcile` unchanged.

**Mutated.** Seven mutations of `lib/mesh.ts`, each caught: the gate ignoring
the allowed set, the gate never closing an evicted link, `admit` obeyed from
anybody rather than the host, `evict` not removing, the queue built from the
allowed list rather than the roster, the queue sorted by id instead of arrival,
and `held` believed from anybody. There is a control too — with everybody
allowed, `gated` must equal `reconcile`, which is what notices a gate that
refuses everyone.

**What it does not do, and the screen says so.** Somebody held at the door is
still on the signalling channel: it is a Supabase broadcast topic named after
the code, and anybody with the code and the publishable key can subscribe. They
get no audio, no video and no chat, and they can see who is here. Closing that
needs the channel itself to refuse them, which needs the call to exist
somewhere other than in the heads of the people in it — `rooms.sql` does that
for a class room against a policy, and a call code belongs to no class. That is
the next piece and this is not it.

**What could not be checked here, stated rather than implied.** The two-peer
run does not work in this container: the agent proxy will not tunnel `wss://`,
so the Supabase realtime socket never opens and no two browsers can meet — with
this change or without it, which a control run with the door left open
confirmed. The host's controls were driven and screenshotted; the door itself
is proven by the pure tests and the mutations above, not by two cameras.

**Done when.** The host can hold the door; somebody arriving is listed and gets
no media until let in; being let in connects them; being removed disconnects
them; refusing leaves them listed as refused rather than vanishing; and a call
with the door open behaves exactly as it did. All of it asserted in
`mesh.test.ts`, except the last two lines of wiring in `Stage.tsx`, which are
typechecked and driven but not unit-tested.

---

## 8f. Design — somewhere to start

The build-out plan's Design & video row is *"professional-grade editing,
real-time collaboration, rendering, templates and layers."* Layers, editing and
rendering were built — four layer kinds, a canvas, `designSvg`, and a video
export that plays each clip through a `MediaRecorder`. This is **templates**.
Real-time collaboration is not here.

**What the gap actually was.** Every design ever made in this app began the
same way: a white rectangle nine hundred by twelve hundred and a decision about
where to put the first word. That is the part of a design tool that is hard for
somebody who is not a designer. Five arrangements now answer the five briefs
this app already knows its user gets — a research poster, a title card, a study
group flyer, a handout header and a one-page summary board. Not a general
gallery: a template nobody has a use for is a menu item that makes the menu
longer.

**A template is never a mode.** `apply` returns ordinary layers with fresh ids,
the same shape the editor already moves and recolours, so the second thing
anybody does is drag something and nothing here has an opinion about that. It
is offered only while the canvas is empty, which is why there is no confirm: a
button that could throw away an afternoon's work needs either a warning or a
reason it cannot happen, and this is the reason.

**The test that matters is not that it looks right.** `readCreations` refuses a
design whose numbers are out of range, so a template producing one would be a
project this app could create and then refuse to reopen — the worst failure a
starting point can have, and one that would not show until somebody came back
to their work. Every template goes through the real reader rather than a
restatement of its rules, because a restatement can drift from the rule and the
rule cannot drift from itself. Four mutations confirm it bites: a font size of
4, a colour that is not a colour, a canvas wider than 2,400, and every layer
handed the same id.

**Then the screenshots found two faults that every one of those checks passed.**

`designSvg` draws a text layer as one `<text>` with a `<tspan>` per newline.
There is no line box, so `w` is where a layer *starts* being wide and not where
its words stop: the flyer's first draft read *"Bring the problem set. We work
through it together and nobody expl"* and then the edge of the paper. Every
number in it was inside every range the reader checks.

And the title card put its headline at `x: 0`, flush against the left edge of
the slide. Nothing objects to zero — it is inside the canvas.

Both are guarded now, and both guards were written by mutating the templates
back to the exact faults the screenshots showed and watching them go red. The
width guard is an approximation — Arial's average advance is about half its
point size — and it is deliberately generous, because what it is for is a line
half again too long rather than one two pixels over.

This is the third time in this document that a green gate and a wrong picture
have coexisted, after the figure palette and the respondent page's padding.
The rule is the same each time and it is worth stating once more here: **for
anything that is drawn, the gates say it is well-formed and only a screenshot
says it is right.**

**Done when.** Five templates, each readable by the reader that has to reopen
it, each with unique ids per application, each with no line wider than its box
and no text against the edge, offered on an empty canvas and gone once
something is on it. `designtemplates.test.ts` asserts all of it — 44 tests.

**What this does not do.** Real-time collaboration, the other half of the row.
Two people editing one canvas needs a merge story for layers, and
`lib/merge.ts` merges a semester field by field rather than an ordered list
where both ends insert. That is its own piece of work and this is not it.

---

## 8g. Captions — written by the person speaking

The fourth word of the build-out plan's Meetings row, after the door in
[§8e](#8e-meetings--the-door).

**The shape is forced by the medium, and it is worth stating first.** A browser
can transcribe the microphone it is holding and cannot usefully transcribe an
incoming `MediaStream`. In a mesh with no server, that means **a caption can
only be made at the mouth it came out of**: each person's device turns their own
speech into text and sends the text. There is no arrangement in which this app
makes a caption of somebody else's voice, and the screen says so rather than
letting it be assumed from a switch labelled "captions".

**Most of it already existed.** `lib/mic.ts` has had `dictate` and
`dictationSupported` since note dictation was built — the browser's own
recogniser, with Firefox's absence already handled in those words. So this is
thirty lines of call wiring and a pure model, not a speech feature.

**The sentence beside the switch is the point of the feature.** Turning captions
on starts *this* browser's recogniser on *this* microphone, and where a browser
sends that audio to be recognised is the browser's business — on Chrome, it is
Google's servers. This app uploads none of it and cannot stop that. Saying so
next to the switch, rather than in a settings page nobody opens, is the whole
difference between a feature and a surprise. It is also why the switch is
per-device and not something a host can turn on for a room: nobody else's
microphone is anybody's to start.

**Muting stops it**, and that is not a nicety. A caption of what somebody said
while muted would be the worst possible bug here, because the one thing a mute
button promises is that the call does not learn what you just said.

**The model is `reacted`'s**, deliberately: one line per person, latest
replacing theirs, expiring on every call rather than on a timer. A speaker
leaning on it cannot bury the screen, and a call left in a background tab does
not come back holding an afternoon of lines. An empty line *removes* theirs
rather than drawing a blank — that is what a recogniser sends when it hears
nothing, and an empty box under somebody's name reads as a fault.

**Mutated, six of six caught**: captions never expiring, an empty line drawn as
a blank, the 220-character cap removed so a caption becomes a transcript, two
lines kept per person, the reading order reversed, and `readable` sorting the
caller's array in place.

**Looked at.** Driven in a browser: the switch, the full sentence, and the
absence case are all on screen, and checking it raises nothing. What could not
be driven here is two people captioning each other, for the reason
[§8e](#8e-meetings--the-door) records — the agent proxy will not tunnel `wss://`,
so no two browsers in this container can meet.

**Done when.** A caption appears under the speaker's name and goes when they
stop; a browser without recognition says so and still shows everybody else's;
muting stops yours; and nothing is uploaded by this app. Asserted in
`mesh.test.ts`, except the wiring, which is driven.

**What is left of Meetings after this.** Recording. And it is the one item in
the whole document that should not be built without a decision made away from
the keyboard: recording a call is a thing you do *to* the other people in it,
and a study app that can record a seminar has a consent question before it has
an engineering one.

---

## 8h. Two people on one canvas

The last unbuilt half of the build-out plan's Design row, and the last item in
that document that is engineering rather than a decision.

**The granularity is the layer, and this repository had already decided it.**
`lib/merge.ts` settled the app's position on two devices changing one thing and
said so plainly: fields merge, and *"what still does not merge is one record
edited on both devices: the later edit of the same note is the one that
survives. Anything cleverer is a distributed-systems project, and pretending
otherwise in the UI would be worse than saying it plainly."* This follows that
rather than inventing a second answer. Two people editing **different** layers
never collide — which is nearly every minute of two people on a poster, since
you move the headline and I move the photograph. Two people dragging the
**same** layer end with the later edit, and the screen says so instead of
implying a merge that is not happening.

**Ties break by sender id**, so every device resolves a collision the same way.
Which one wins matters less than that two devices never disagree: disagreement
is how a canvas ends up different on two screens with nobody able to say why,
and it is the failure the round-trip test asserts against.

**Tombstones, because deleting is the edit that comes back.** A layer deleted
here and dragged there, with the drag arriving second, resurrects it unless the
delete is remembered. `seen` holds the moment of the last edit applied per
layer and keeps holding it after a delete, so a stale update to a dead layer is
older than what was applied and is dropped. That is the test worth reading in
`coedit.test.ts`.

**A joiner never lands on top of work.** `whole` — the state sent to somebody
who has just arrived — is applied only to a canvas with nothing on it. One
person opening a shared canvas and everybody else losing an afternoon is this
feature's worst possible failure, and it is a two-line rule with its own test.

**Remote edits never enter undo.** One line, and the distinction that matters:
undo is *your* history. A stack that also held a collaborator's moves would let
you undo their work, which is not what the button says and not a thing anybody
wants to discover.

**Mutated, seven of seven caught**: the tombstone forgotten after a delete, a
joiner's state overwriting local work, stale edits applied anyway, a tie broken
by nothing, `changes` comparing layers by reference (which would flood the
channel on every keystroke), `changes` forgetting removals, and `same()`
dropping one field from its comparison.

**And the screenshot found the failure path, which is the part that mattered
here.** Switching sharing on in this container ticks the box, unticks it, and —
in the first draft — said nothing anybody could see, because the explanation
went to a notice rendered a hundred lines of JSX further down the page. That
reads exactly like a broken switch. A failure has to appear where the thing
that failed is, and it does now.

**What could not be checked, stated rather than implied.** Two devices on one
canvas, for the same reason as the call's door in
[§8e](#8e-meetings--the-door): the agent proxy will not tunnel `wss://`, so no
Realtime channel opens in this container and no two browsers can meet. The
arithmetic is proved by 35 tests and seven mutations, including a full
round trip that asserts two devices end holding the same canvas. **The wire is
not proved, and this is where that is written down.**

**Done when.** A switch shares the canvas; edits to different layers land on
both screens; the same layer resolves the same way on both; a delete stays
deleted; a joiner takes the state only when empty; somebody else's edit is not
on your undo stack; and a failure to connect says so at the switch.

---

## 8i. Phase 3 · Registration — against the sandbox, labelled

Phases 3 and 4 are gated in the source document on things that are not
engineering: a formal data-sharing agreement, a security and compliance review
by Vanderbilt IT, and a legal review of student-data implications including
FERPA — *"treated as a question for Vanderbilt's own counsel, never an
engineering decision Harrison can make unilaterally."* None of that is
satisfied by anything in this section and none of it is claimed.

What **is** built is the demonstration, against the sandbox institution, at the
explicit request of this project's owner. The Comprehensive Master Brief's own
standing commitment is the test this has to pass: *"No official institutional
transaction (registration, billing, financial aid, family access) touches real
data — these remain Prepare-only until Phase 3/4 and full institutional
review."* A sandbox demonstration touches no real data, every record it makes
carries `SANDBOX`, and every receipt says that no seat here is a seat at any
real institution.

**Why registration first, and why it is the right thing to demonstrate.** The
brief calls it *"the transactional standard's first full application"*, and it
is the first part of a university that is genuinely a *transaction*. Reading a
bill is a query. Submitting coursework is a write nobody competes for. **A seat
is finite**: two people can want the last one and only one can have it, and
everything hard about institutional software lives in that sentence. The
two-phase prepare/commit the gateway has enforced since Phase 1 exists for
exactly this, and now it is carrying something that can actually be lost.

**Five refusals, each one a real registrar's.** A hold on the account, named
rather than generic. A prerequisite not met, checked against what this student
has actually passed here. Add/drop closed, from a date on the section. A clash
with something already held. And no seat — which is not a refusal at all but a
redirection to the waiting list, and the difference is the point of it.

**The seat is taken at commit, never at prepare.** `sandbox.ts`'s header
already argued this and it matters most here: a review that reserved a seat
would mean somebody who read the confirmation and walked away had taken a seat
from somebody who would have used it. So `review` reports the count as it
currently is, `execute` checks it again, and the window between them is where a
waiting list comes from. Two people reading the last seat both get a
confirmation to read; the second commit is refused.

**The seat count is derived, never stored.** A `taken` column and a table of
enrolments are two answers to one question, and they come apart the first time
a write half-fails.

**Mutated, nine of nine caught**: the seat not rechecked at commit (which puts
two people in one seat), the idempotency check removed (which enrols a retry
twice), the hold unchecked, the prerequisite unchecked, add/drop never closing,
a clash allowed, the queue never moving on a drop, a waiting place counted as a
seat, and a hold blocking somebody from *leaving* a queue — which is a bug and
not a policy, since a hold blocks taking something rather than giving it back.

**It needed no screen.** `screens/University.tsx` lists all thirty-seven areas,
draws whichever the gateway reports as connected, and renders records and their
actions generically. A Phase 3 domain is an adapter. That is the Phase 1
architecture paying for itself, and it is worth noticing that the payoff
arrived without a line of UI.

**One check earned its keep immediately.** `smoke:gateway` asserts the number in
the gateway's startup line, and it went red the moment a sixth adapter was
installed — which is exactly the fault it was written for, since that line is
what somebody reads to know what a booted gateway is carrying.

---

## 8j. Phase 3 · Money — read access, and never a processor

Phase 3's second domain, against the sandbox, labelled. The source documents
constrain its shape in one sentence and this obeys it exactly: a real account
balance *"built as read access to Vanderbilt's own systems first, **not a
competing processor**"*.

**What that sentence rules out, concretely.** Semester never holds money, never
takes a card number, and has no payment credential of any kind. The one write a
student makes — paying — is prepared by Semester and **committed by the
institution's own adapter**, which is what issues the receipt. That is the
architectural claim rather than a detail: the same two-phase prepare/commit
that puts a student in a seat, with the institution on the far side of it. In
this demonstration the sandbox *is* the institution; against a real school the
same adapter hands off to that school's processor and returns its receipt, and
nothing about the app changes.

The sentence is on the record itself, not only in a file header: every charge
carries a **"Who moves the money"** line saying the institution does and that
Semester holds no card. A student reading their bill should not have to take a
developer's word for it from somewhere they will never look.

**A ledger, not a balance.** What is owed is charges minus what is paid against
them, computed every time — the same argument registration makes about seats,
and worth making twice because money is where somebody notices. Cents
throughout, because money in a float is a bug waiting for a decimal.

**Aid's amount is the institution's and nobody else's.** A student accepts or
declines; they send no number, and `execute` reads the row rather than the
field. That is the obvious attack on a screen like this, and it is refused by
there being nowhere to put a number rather than by validating one away — a test
sends `cents: 99999999` anyway and asserts the award is unchanged.

**The lie this screen could most easily tell** is that accepted aid is money
paid. It is not, and `balance` keeps them as separate numbers: aid accepted is
reported beside what is owed and never subtracted from it. A mutation that
subtracts it is caught.

**Mutated, twelve of twelve caught**: over-payment allowed at the write
boundary, idempotency removed (a retry pays twice), a stranger paying somebody
else's bill, a stranger answering somebody else's award, a non-student paying,
the award amount taken from the request, accepted aid counted as money paid,
the answer-by date never passing, a disbursed award becoming declinable, and
the dollar parser accepting anything. Two of those mutations initially reported
"45 passed" because an apostrophe in the label broke the script that applied
them — they had never been applied, and a pass that means nothing is the same
trap this document keeps recording. Re-run with the labels fixed, all twelve
bite.

**And a correct test whose example rotted.** `sandbox.test.ts` asserted that
the sandbox does not light up the whole University screen, using `billing` as
its example of an unimplemented area — which was fine until this section
implemented billing. The rule is still exactly right; the example was the
problem. It now *derives* the area to probe from the areas no adapter covers,
asserts there are more than twenty of them, and checks three. A rule whose
example can be built out from under it is a rule that fails on the day somebody
does the work.

---

## 8k. Phase 3 · Family access — and the asymmetry that is the whole of it

Phase 3's third domain, and the one where its gate matters most: family access
is the only domain that discloses a student's record to somebody who is not the
student. The institutional agreement, the security review and the FERPA legal
review are exactly the right gates for it, and none of them is satisfied by a
sandbox demonstration.

**Almost all the thinking was already done, in the contract.**
`packages/institution` carries `FamilyGrant`, `FamilyRequest` and
`allowsFamilyRequest`, and names precisely what was missing: *"A real grant
lives in verified server storage, and every resource operation is checked
against it… A permission object that arrived from a browser is a request, never
an authority."* This adds the storage and the lifecycle around it — a student
gives, the person named accepts, the student revokes — and calls the contract's
predicate for every question.

**The asymmetry is the feature and it is the contract's.**
`allowsFamilyRequest` makes `payment` not a level of reading: *"Paying requires
`finances` and `payment` exactly. Reading requires `selected` or `view` — which
`payment` is not, so **payment-only access discloses nothing**."*

So a parent who can pay the tuition bill **cannot read it** — not the balance,
not the history, not the aid. That is unusual and it is right: the common real
arrangement is a parent who pays and a student whose record stays theirs. The
billing adapter keeps it exactly — a granted payer may `execute` a payment and
still gets `null` from `get` and nothing from `list` — and the tests assert it
from both directions.

**Four things a grant is not.** Not an account: the recipient is whoever the
institution verified. Not permanent: every grant has an expiry and no grant can
be made without one. Not silent: the student sees every grant they have made.
And not a category: a category with no items named grants nothing, which is
refused when the grant is *made* rather than discovered when it fails to work.

**Mutated, ten of ten caught** — including a payer being allowed to read, a
grant being live before it is accepted, revocation not stopping it, an expired
grant still being acceptable, and `familyMay` trusting the caller instead of
storage. One mutation first reported a full pass because the check it removed
appears in both `review` and `execute` and only the first was replaced; a
mutation that half-applies is a mutation that proved nothing, which is the same
lesson this document keeps writing down.

**Three corrections the gates found.**

`'family'` is not a role. The contract's six are student, faculty, advisor,
admin, **payer** and staff, and a parent paying a bill is the one it already
named. The test had written `family`, which typechecked as a string and would
have run as a role nothing recognises.

The billing refusal split in two, and both halves now have a test: a stranger
is told *"that is not your account"*, and the account's own holder without the
student role is told which role it needs. One message covering both cases was
one of them being wrong.

And `sandbox.test.ts`'s rule that every adapter lists something, all of it
marked, went red because family lists nothing until a grant exists. The rule is
right, so the test now *makes* a grant rather than exempting the area — an
exemption would have weakened the rule for every adapter to accommodate one.

**Phase 3 is complete as a demonstration**: registration
([§8i](#8i-phase-3--registration--against-the-sandbox-labelled)), money
([§8j](#8j-phase-3--money--read-access-and-never-a-processor)) and family
access. Four adapters, no screens — `University.tsx` renders all thirty-seven
areas generically, so the whole of Phase 3 was adapters. **Phase 4's first
three** — career, advising and the alumni network — followed the same way in
[§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled),
taking the sandbox to twelve. Neither phase's real gates are satisfied by any
of it and neither section claims they are.

---

## 8l. Phase 4 · Career, advising and the alumni network — against the sandbox, labelled

**What the source document asks for.** Phase 4 is "official institutional
transactions", and it opens with Career: live listings, employer accounts,
applications, advising appointments, an alumni network. It is gated, in that
document's own words, on everything in Phase 3 *sustained* through a live
pilot **plus** a university choosing to extend trust into official
transactions one function at a time.

**None of that is satisfied and none of it is claimed here.** No employer named
in `EMPLOYERS` exists, no application is delivered to anybody, nothing is in an
adviser's diary, and the alumni are invented. What was built is the *shape*,
against the sandbox institution, marked `SANDBOX` on every record and in every
receipt — for the same reason Phase 3 was: the shape is the part that can be
argued with before anybody is asked to trust it.

Three adapters, taking the sandbox from nine to twelve:
`career.ts` and `advising.ts` (which carries advising and alumni both).

### Finding the finite thing, which is how each of the three was designed

Registration taught this repository where to look: the hard part of any
institutional area is the sentence *two people can want the last one*, and an
area without that sentence in it is a list that does not need a transaction at
all. Each of the three was built by finding it first.

| Area | The finite thing | Why not the obvious one |
| --- | --- | --- |
| Career | The **offer** | Not the application — a posting takes a thousand of those and nothing is lost. Two openings and three offers is a promise the employer cannot keep. |
| Advising | The **half-hour** | One person has it. This is registration's seat, and it is built the same way. |
| Alumni | The mentor's **willingness** | A number of students they will take, counted from the accepted mentorships rather than stored beside them. |

Each is checked twice — at `review` and again at `execute` — because the review
reserves nothing. And each check is now tested at **both** call sites, which it
was not at first: see below.

### Three disclosures, each an absence rather than a lock

Family access settled the rule ([§8k](#8k-phase-3--family-access--and-the-asymmetry-that-is-the-whole-of-it)):
a permission the server does not hold shows up as *missing data*, not as a
greyed-out row. Three of those are here, and each is tested by reading the
record as somebody who should not see the field and searching the whole
serialised record for it:

1. **An employer sees the applicants to their own postings and no others.** A
   career site where a competitor can read your pipeline is not a career site.
2. **A student never sees who else applied** — not the names, and *not the
   count*. A line reading "2 applications" is a disclosure with the names taken
   off, and it is the one people leave in.
3. **An alumnus's contact address is not on the record until they have said
   yes.** Not redacted, not behind a flag — absent. That one sentence is the
   whole of the alumni network.

Each absence carries a **control** that reads the same record as somebody
entitled to the field and asserts it *is* there, because a search for an
absence passes just as well against a record that came back empty.

### Why an employer is a table and not a role

The contract's six roles are the six a *draft* can be written as, and there is
no employer among them — which turned out to be the right answer rather than a
gap. An employer is not a kind of person at a university; it is a relationship
the career office has approved and can suspend. So it lives in a row the server
owns, with a state the office sets, and the only thing granting the right to
act for one is being named in its `owner` column. A pending employer cannot
post. A suspended one cannot be applied to either. Both are real career-office
controls, and the sandbox carries one of each so both are walkable by a person
rather than only reachable by a test.

### Two rules that are this demonstration's own

**Withdrawing an application is final for that posting.** The employer has
already read it. A career site whose "undo" quietly un-reads something a person
acted on is teaching a student the wrong thing about what an application is, so
re-applying is refused and the refusal says why.

**Accepting an offer declines the student's other outstanding offers**, inside
the accept's own commit — the way a drop promotes the waiting list inside its
own. A student holding three offers is holding two openings somebody else could
have had, which is the reason one-offer policies exist.

**And cancelling an advising appointment inside twenty-four hours is refused**,
with the reason on the screen rather than only the rule: a place given back
that late cannot be offered to anybody else in time, so it is not given back,
it is wasted.

### What the mutations found

Thirty-three guards were removed or inverted one at a time and the suite
required to go red. Twenty-nine were caught on the first pass. The four that
were not are the findings worth recording, because each was a real gap rather
than a formality:

**Three escapes, all the same fault, and it was in the tests.** Removing the
`review`-phase call to the finite-resource check — the offer limit, the
advising place, the mentor's capacity — left the suite **green** every time,
because `execute` caught it a moment later. The commit-time check is the one
that keeps the promise, so nothing was broken. But it meant the review-time
check was untested, and that is worse than it sounds: the entire point of a
two-phase action is that the review tells the truth. A review that says *go
ahead* before a commit that says *no* has turned a refusal into a loss. Three
tests were added that call `review` alone, and all three mutations are now
caught.

**One mutation never applied at all.** Its anchor was a paraphrase of the
refusal rather than the refusal, so it matched nothing — and a mutation that
matches nothing reports a clean pass. This is the third time in this repository
that a mutation has lied, and the only reason it was noticed is that the script
asserts its own anchor count before every run. **A mutation harness that does
not check that it mutated something is a harness that reports whatever you
hoped.**

### And two faults the tests found in the code

**A refusal doing two jobs with one message.** An unknown action on a listing
fell through to the branch that reads an applicant name, so somebody who typed
a wrong action was told they had left a field out. Guarded before the read, in
both `review` and `execute`.

**A type predicate that asserted something false.** `vetted` was written as
`e is Employer`, which narrowed the *refusing* branch to `null` — making the
refusal that names the employer ("QuickCash Partners is not currently
approved") unreachable as far as the types were concerned, though at run time
the name was always there. A predicate that lies about the failure path is
worse than no predicate, because the failure path is the one nobody reads. It
is a plain boolean now, and a test asserts the message names the employer.

### Measured

| | |
| --- | --- |
| Adapters installed in the sandbox | 9 → **12** |
| New tests | **116** across `career.test.ts` and `advising.test.ts` |
| Mutations applied | **33**, all caught |
| Refusals with their own message | 26 |
| Gates | `tsc -b`, `check:university`, `lint`, `test`, `test:shuffle`, `test:zones`, `build`, `smoke:gateway` |

### What this does not do

It does not connect to a university. Career, advising and alumni remain, in the
source document's own framing, gated on a successful pilot and a real
institutional partnership. This is a labelled demonstration of the shape those
transactions would have, and the label is on every record it produces.

---

## 8m. Phase 4 · Athletics — where the hard part is time, not contention

**What the source document asks for.** Team rosters, travel logistics,
eligibility forms, coaching and staff workflows. Gated exactly as
[§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled)
is, and just as unsatisfied: **no team named here exists**, nobody is cleared
to play anything, and no coach is going anywhere.

One adapter, taking the sandbox from twelve to thirteen.

### A roster spot looks like a seat and is not one

This is the first area in this repository whose hard part is **time** rather
than contention, and finding that out changed the design.

Teams do not generally turn people away for want of a number. What they turn
people away for is **eligibility**, and eligibility is not a finite resource at
all — it is a condition that *expires*. So:

> **A clearance is a date, never a flag.** Nothing anywhere asks whether
> somebody *was* cleared. Every check asks whether their clearance is good on
> the day being asked about, against the clock the adapter was given.

A demonstration that stored `eligible: true` and set it once would have been
demonstrating the bug rather than the rule — and it is precisely the bug that
lets an athlete with a lapsed physical get on a bus. The tests for this move
the clock rather than editing a row, which is the only version of that test
that proves the date is doing the work.

The genuinely finite thing is the **seat on the coach**. So the two rules
compose, and the order they compose in is itself a decision:

> **Eligibility is checked before the seat.** Telling somebody the bus is full
> when the true answer is that their return-to-play assessment is outstanding
> sends them to the travel office, which cannot help them, and they come back
> no better off.

That ordering has its own mutation: the eligibility block is moved below the
seat check and the suite is required to go red.

### The disclosure here is a medical one

Why somebody is not cleared is a medical fact. `Eligibility.why` is readable by
the athlete and by **nobody else — including their coach**. A coach sees *that*
a player is not cleared, because that is what picking a team needs, and does
not see why, because that is between the athlete and whoever assessed them.

Four readings are asserted separately: the athlete's own (the reason is there —
the control), the coach's (it is not), a team-mate's (it is not), and a
stranger's (there is no squad list at all).

**And a clearance file is opened late** — the first time somebody is put on a
roster, not the first time they log in, the same reason a bill is opened late.
Opening one for everybody with an account would be recording a medical question
about people who have no business with one.

### What the mutations found, which was more than last time

Twenty-four guards, removed or inverted one at a time. **Sixteen** were caught
on the first pass. The eight that were not break into four kinds, and three of
them are findings rather than formalities.

**A real design gap: boarding twice was not refused.** Removing the idempotency
check entirely left the suite green — which meant the retried-key test was not
testing anything. The reason is worth writing down: with boarding twice
permitted, a retry simply wrote the same row to the same state, the manifest
count did not move, and the two receipts were identical, so *no assertion could
distinguish a retry that was caught from one that was not*. The fix was a
refusal, not a test: your name is already on that manifest. Now a retry without
`already` would be refused, which is exactly what a dropped connection produces.

**Two guards whose second call site was untested.** Stepping off a manifest
checks both that you are on it and that the manifest has not gone to the
driver, in `review` and again in `execute` — and only the review's check was
load-bearing in the suite. A commit that trusts its own review is a commit
acting on a world that has moved, which is the whole reason there are two
phases. Same finding as [§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled)'s
three escapes, arriving from the opposite direction: there the review was
untested, here the commit was.

**A disclosure nothing was checking.** The mutation replaced the reader's own
id with the squad's first entry on the line that carries the medical reason —
and every test in that block was blind to it, because in each one the reader
either *was* the first entry or was cleared and saw no reason at all. Somebody
reading a team-mate's medical reason in place of their own is the worst version
of this bug and it had no test. It has one now: two uncleared athletes with
different reasons, and the second one reads the roster.

**And two mutations that were simply wrong.** One flipped a condition that
discloses nothing extra either way (the rows it maps are the reader's own
clearances whichever way the condition falls), and two used stale line numbers
after the file had grown. Both were caught by the harness asserting its own
anchors — the same protection that caught the lying mutation in §8l. **The
harness checking that it mutated something is the only reason any of this
section is trustworthy.**

### Measured

| | |
| --- | --- |
| Adapters in the sandbox | 12 → **13** |
| New tests | **56** in `athletics.test.ts` |
| Mutations applied | **24**, all caught |
| Suite | **487 files, 10,035 passed, 10 skipped** |

### What this does not do

It does not connect to a university, clear anybody to compete, or put anybody
on a bus. The label is on every record it produces.

---

## 8n. Phase 4 · Clubs — and the hardest thing in the whole phase, which is a ballot

**What the source document asks for.** Membership management, events, budgets,
dues, elections, room requests. Gated exactly as
[§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled)
and [§8m](#8m-phase-4--athletics--where-the-hard-part-is-time-not-contention)
are, and just as unsatisfied: **no club named here exists**, no money moves,
and no election decides anything.

One adapter, thirteen to fourteen.

### Four finite things, and they are not the same kind of finite

Which is what makes this the most interesting area in Phase 4, because up to
now every finite thing in this repository has been a **count**.

| Thing | Kind | Why it needed its own shape |
| --- | --- | --- |
| A room at a time | A count of one | Registration's seat exactly. Two clubs cannot hold Buttrick 101 at eight on Tuesday. |
| A budget | **A sum** | Two claims of forty fit inside a hundred and a third does not, and *no number of slots expresses that*. The check is against the remainder. |
| A vote | One per member | The only thing in this repository that must be both **counted and secret**. |
| An event's capacity | A count | The room's, so a seat again. |

The budget remainder is derived from the approved claims rather than stored,
for the reason the seat count is — and `approved` counts as committed rather
than only `paid`, because a budget that counted only what had gone out would
let a club promise the same thousand dollars to four people.

### The ballot, which is the hardest thing in Phase 4

An election has to satisfy two requirements that pull against each other:

> **Nobody votes twice**, which needs a record of who has voted.
> **Nobody can tell how anybody voted**, which forbids a record joining a
> person to a choice.

Both at once is the whole problem. A demonstration storing `{ voter, choice }`
would have satisfied the first and *pretended* at the second by not showing a
column — and **a column somebody can select is a column somebody will select.**

So the ballot is **two tables that are never joined**: a roll of who has voted,
carrying no choice, and a pile of papers, carrying no voter. The count comes
from the papers; the double-vote refusal comes from the roll. Nothing in either
row names a row in the other, so no query puts them back together.

Three decisions hold that up:

1. **A paper's id is `randomUUID()`**, deliberately not derived from the voter.
   An id anybody could recompute is a join waiting for somebody who knows the
   recipe.
2. **Both writes go through one transaction.** A marked roll with no paper
   loses somebody's vote; a paper with no mark lets them vote twice.
3. **The receipt does not say what was voted for.** A receipt naming the choice
   is a receipt somebody can be *made to show*, which is how a secret ballot
   stops being one.

And the count by candidate is published only once the poll has shut. Turnout is
published throughout, because turnout is not a result — but a running total by
candidate during an open poll tells late voters which way it is going, which is
a thing real elections take trouble to avoid.

**The test that matters reads the stored rows, not the adapter's output.** It
takes every row on the roll and every paper in the box and asserts that no
value appearing in one appears in the other. A test of what the adapter
*returns* could not make that claim, because the claim is about what somebody
holding the database could reconstruct — and an adapter that merely declined to
return the join would pass a test of its output while storing it.

All thirteen ballot mutations were caught on the first pass, including the two
that matter most: putting the voter on the paper, and deriving the paper's id
from the voter.

### And a real bug the tests found

**Giving a room back did not give it back.** The first version kept the row and
blanked its club, and the room stayed unbookable: the clash check found a hold,
saw a club that was not the one asking, and refused *on behalf of nobody at
all*. A hold nobody holds is not a hold, and the honest way to say that in a
table is for the row not to be in it. `dropHold` replaced the sentinel.

### What the mutations found

Thirty-two guards, removed or inverted one at a time. Twenty-seven caught on
the first pass. The five that escaped were all the same class, and it is the
same class as [§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled)'s:
**the review's own copy of a refusal was untested**, because the helper driving
both phases could not tell which one had refused, and `execute` caught
everything.

It is worth saying why that is not cosmetic, in this area especially: an
officer told at the *commit* that the room was taken has already told somebody
the meeting is happening. A review that says *go ahead* before a commit that
says *no* is precisely the failure two phases exist to prevent. Five tests now
call `review` alone.

Across Phase 4 that finding has now appeared three times, in three different
shapes — the review untested in §8l and here, the *commit* untested in §8m. It
is the characteristic failure of testing a two-phase action through a helper
that drives both, and is now written down as such.

### Measured

| | |
| --- | --- |
| Adapters in the sandbox | 13 → **14** |
| New tests | **68** in `clubs.test.ts` |
| Mutations applied | **32**, all caught |
| Suite | **488 files, 10,103 passed, 10 skipped** |

### What this does not do

It does not connect to a university, hold anybody's money, book a real room, or
run an election that decides anything. The label is on every record.

---

## 8o. Phase 4 · Housing and dining — a signature, and an amount that is computed

**What the source document asks for.** Applications, contracts, room
assignments, meal-plan changes. Gated as the rest of Phase 4 is, and just as
unsatisfied: **no building named here exists**, nobody is housed, and no meal
plan feeds anybody.

Two adapters, fourteen to sixteen — which completes Phase 4 as a demonstration.

### The room is a seat; the contract is something this repository had not met

A bed in a double is registration's seat again and needs no new argument. What
is new is that somebody **signs** something, and a signature has two properties
a transaction does not.

**It binds.** After it, the money is owed whether or not the person turns up.
That is what a housing contract is *for*, and it is what students are surprised
by. So the review says the figure and the date it becomes unbreakable, in those
words — and this is the one action in Phase 4 where the review is doing the
thing it is actually best at. Everywhere else the review answers *can I have
it*; here it answers **what am I agreeing to**.

**It has a window in which it does not bind yet.** Every real housing contract
has one, and that window is the only reason offering a signature in software is
honest at all. Inside it, cancelling is free. Outside it, the adapter **refuses
and names a human**:

> The time to cancel ran out on 2026-09-27. That contract binds you for
> $11,800.00, and only the housing office can release you from it — write to
> them.

A button that released somebody silently would be pretending the signature
meant less than it does.

**Three states and not one**, deliberately: *applied* costs nothing and binds
nobody; *assigned* is the institution's answer and still binds nobody; *signed*
binds. Collapsing them would have hidden the only moment that matters.

### Dining, where the amount is computed and the interesting part is a refusal

A meal plan is not a seat — the dining hall does not run out. What it has is a
deadline and a price that depends on when you ask, which makes it the first
thing in Phase 4 whose *amount* is worked out rather than stated.

And it is worked out one way only. **A downgrade after the deadline is refused
rather than prorated**, because the meals already bought are already bought.
Offering a refund the dining contract does not give would be the software lying
about somebody's money, which is worse than the software saying no. An
*upgrade* after the deadline is allowed, because nothing has to be given back
for that to be true.

The property asserted is not a formula but an absence: `changeCosts` is
exercised over **every ordered pair of plans** and required never to come out
negative — with a control asserting that at least one pair costs something, so
it is not a suite of zeroes passing a test about signs.

### What the mutations found

Thirty-two guards. Twenty-six caught on the first pass, and the six that were
not produced two findings and one durable fix.

**A guard that could not fire.** `bedIn` re-checked a free bed immediately
after the line that had already *selected* a room by requiring one, copying the
review/commit pattern the rest of Phase 4 uses — except there is no review
phase here, because the office assigning a room is one operation. Removing it
changed nothing, which is how it was found. It is gone: **a guard that cannot
fire is worse than no guard, because it reads like protection that is not
there.**

**Three more review-phase escapes**, the same class Phase 4 has now produced in
every single area. It lands hardest here: somebody told at the *commit* that
their contract is binding has already pressed the button believing it was not.

**And a durable fix to the harness.** Two mutations reported `BAD` because
their line numbers had gone stale as the file grew — the second time that
happened in this phase. The harness now addresses a duplicated call site by
*which occurrence*, found by searching, so the anchor cannot rot. Combined with
the anchor-count assertion, a mutation in this repository now fails loudly in
both of the ways it can silently lie.

### Measured

| | |
| --- | --- |
| Adapters in the sandbox | 14 → **16** |
| New tests | **61** in `housing.test.ts` |
| Mutations applied | **32**, all caught |
| Suite | **489 files, 10,164 passed, 10 skipped** |

---

## 8p. Phase 4, as a whole — what four areas taught that one could not

Seven adapters across four sections
([§8l](#8l-phase-4--career-advising-and-the-alumni-network--against-the-sandbox-labelled),
[§8m](#8m-phase-4--athletics--where-the-hard-part-is-time-not-contention),
[§8n](#8n-phase-4--clubs--and-the-hardest-thing-in-the-whole-phase-which-is-a-ballot),
[§8o](#8o-phase-4--housing-and-dining--a-signature-and-an-amount-that-is-computed)),
nine to sixteen, **301 new tests and 121 mutations, all caught.**

### The finite thing is never where you first look

Registration taught this repository to ask *can two people want the last one*.
Phase 4 taught that the answer is usually **not the obvious noun**:

| Area | What looks finite | What is |
| --- | --- | --- |
| Career | The application | **The offer** |
| Athletics | The roster spot | **Nothing** — eligibility is a *date*, and the finite thing is the seat on the coach |
| Clubs | A membership | **A vote**, a **sum**, and a room |
| Housing | The room | The room — but the hard part is **the signature**, which is not finite at all |

Two of the four turned out to have a hard part that is not contention:
athletics' is **time**, and housing's is **commitment**. Neither would have
been found by copying registration.

### And a finding about testing, which appeared in every area

**Testing a two-phase action through a helper that drives both phases cannot
tell you which phase refused.** In §8l three mutations escaped because the
*review*'s copy of a check was untested; in §8m two escaped because the
*commit*'s was; in §8n five review copies; in §8o three more. Twelve of the
fourteen escapes across the whole phase were this one thing.

It is not cosmetic, and each area supplied its own reason why:

> An employer told at the commit that the opening is gone has told somebody
> they have a job. An officer told at the commit that the room is taken has
> told people the meeting is happening. A student told at the commit that their
> contract is binding pressed the button believing it was not.

A review that says *go ahead* before a commit that says *no* has turned a
refusal into a loss. Every duplicated guard in Phase 4 is now asserted at
**both** call sites, separately.

### What none of this does

It does not connect to a university. Phase 4 remains gated, in the source
document's own words, on everything in Phase 3 sustained through a live pilot
**plus** a university choosing to extend trust into official institutional
transactions one function at a time. No employer, team, club or building named
in the sandbox exists; no money moves; no election decides anything; nobody is
housed, cleared to compete, or hired. Every record carries `SANDBOX` and every
receipt says so.

---

## 8d. What the source document has left, and what it is waiting on

For the record, measured rather than assumed, since §1 to §8 of this plan were
scoped to Study Modes, Cross-Course Intelligence and the Production Suite and
the source document is wider than that.

**Phase 0 — all six done.** Global search ([§9b](#9b-phase-0--global-search))
and the accessibility minimums ([§9](#9-phase-0-of-the-build-out-plan--accessibility-minimums))
are sections of this plan. The other four were never tracked here and measure
as built: developer configuration is off the student screens — `Connect.tsx`
says "Signing in to X is not switched on in this copy of Semester" and offers
the `.ics` route, with the portal instructions in the file's comments where a
student never sees them; backup coverage is `lib/workspace-backup.ts`, which
names all six workspaces the main backup does not reach; Teach-back is
`components/StudyJournal.tsx`, a real attempt-then-compare with a private
mistake log and review scheduling, not a label; and the server-side AI gateway
is route 4 in `lib/claude.ts` — "an Edge Function checks the account and meters
it, so a new user can generate a course without first going and getting a key
of their own."

That last one connects to [§8b](#8b-deployment--the-settings-a-deployed-copy-could-not-be-given)
and is worth stating plainly: the Phase 0 gateway existed, and until §8b landed
the deployed copy had no way to be pointed at a proxy at all, because
`VITE_CLAUDE_PROXY` was one of the twelve settings the Pages build could not
carry. The item was built and unreachable, which is a third state the plan's
Live/Partial/Planned vocabulary has no word for.

**Phase 1 and Phase 2 of the source document** are [§6](#6-the-whole-plan-as-one-schedule)'s
two tables, all twelve items done, plus the three University Services rows this
plan had not tracked: **Forms**, done in [§8c](#8c-forms--publishing-to-real-respondents);
**Meetings** — the door is done in
[§8e](#8e-meetings--the-door), and captions and recording are not; and
**Design & video**, whose templates are done in
[§8f](#8f-design--somewhere-to-start) and whose real-time collaboration is not.

So of the three, one thing is left, and it is not engineering: **call
recording**. See the note at the end of
[§8g](#8g-captions--written-by-the-person-speaking) — recording a call is
something done *to* the other people in it, and a study app that can record a
seminar has a consent question before it has an engineering one. Captions are
done in [§8g](#8g-captions--written-by-the-person-speaking) and two people on
one canvas in [§8h](#8h-two-people-on-one-canvas). Each is its
own piece of work and each is named here rather than left inside a row that
reads as untouched.

**Phases 3 and 4** — Registration, Money, Family access, Career, Athletics,
Clubs, Housing & dining — now exist as **labelled demonstrations against the
sandbox institution**, sixteen adapters in all
([§8i](#8i-phase-3--registration--against-the-sandbox-labelled) through
[§8p](#8p-phase-4-as-a-whole--what-four-areas-taught-that-one-could-not)).
That changes nothing about the gate, which is the point of building them that
way: they are gated by the source document itself, not by this one: *"explicitly gated on a successful Vanderbilt pilot and real institutional
partnership, not proposed as anything close to a near-term ask."* Every one of
them is read access to, or a transaction against, a system this project cannot
build unilaterally. They are not unfinished engineering, and building screens
that look like them would be the exact failure `data/campus.ts` refuses.

### One row where the brief and the code disagree, and the code is right

Worth recording rather than leaving to whoever notices it next. The
comprehensive master brief lists **Email — native sending** as unbuilt, in the
column that means *not done yet*. It is not unbuilt. `lib/mail.ts` **refuses**
it, on purpose, and [§8](#8-what-this-plan-does-not-cover) records that as a
refusal rather than a gap: *"something that can post a message as you to your
professor is a bigger promise than a study app should make."*

The two documents are not describing different code; they are describing the
same code with different vocabularies. A feature matrix has no cell for *we
considered this and decided against it*, so anything not present reads as
pending — which is the same missing word [§8b](#8b-deployment--the-settings-a-deployed-copy-could-not-be-given)
ran into from the other direction, where a setting was built and unreachable and
the Live/Partial/Planned vocabulary had no term for that either.

The practical consequence is small but real: **a reader of the brief alone would
schedule work to build this, and building it would undo a decision.** The same
caution applies to the other three refusals in that list — textbook prices
(`lib/cost.ts`), writing coursework (`lib/doctemplates.ts`), and inferring exam
scope (`lib/covers.ts`). If the brief is ever revised, those four want a row of
their own that says *refused, and why*, because a plan that reads a refusal as a
backlog item is a plan to reverse it by accident.

---

## 9. Phase 0 of the build-out plan — accessibility minimums

The build-out plan carries this as work to *"complete before any pilot tester
touches the app"*, with a number attached: **"a sampled pass on the desktop
Directory screen found 93 of 166 interactive elements below the 44-pixel
minimum touch target, and 7 text elements below 12 pixels"**, and asks to fix
the Directory first and then *"run the same measurement method across the rest
of the app rather than assuming the problem is isolated"*.

The measurement method is now `app/scripts/targets-sweep.mjs` — `npm run
sweep:targets` — which walks every destination in the registry on a phone and
a desktop in real Chromium. Written down rather than sampled once, because a figure nobody
can retake goes stale without anybody noticing it has.

(57 until `scripts/destinations.mjs` took over the list. Three destinations —
`deck`, `write` and `sheet` — were excluded by a hand-kept set on the belief
that they need an id in the address. Opened, they draw "Make a deck", "Write a
document" and "Sheet or table" with no id at all. The walk also proves it
arrived on each screen from the rendered heading now, rather than from the hash
it had just written, and names any it did not reach. That check cost a
destination before it paid for one: `home` draws whichever of four shapes the
navigation asks for — this sweep seeds `nav: 'springboard'`, so the heading is
"Semester" — and holding it to the registry's "Today" skipped the screen for
one run. All four are recorded in the proof table now.)

### Two criteria, and only one of them is AA

| | Size | Standard | Level |
| --- | --- | --- | --- |
| 2.5.5 Target Size | 44×44 | WCAG 2.1 | **AAA** |
| 2.5.8 Target Size (Minimum) | 24×24 | WCAG 2.2 | **AA** |

The plan names "a 44-pixel minimum touch target" beside a "WCAG 2.1 AA
acceptance target". Those are two different criteria. 44 is the comfortable aim
and 24 is the bar an AA acceptance target actually sets, so the sweep counts and
reports both apart — a run that gave only the 44 figure would read as an app
failing AA when that question had not been asked.

### Measured

Re-taken 18 September 2026 over all 58 destinations — 60 until `80fbc5c` made
`ahead` and `tonight` two of Today's tabs:

| | Phone 420×900 | Desktop 1280×900 |
| --- | --- | --- |
| destinations opened | 58 / 58 | 58 / 58 |
| under 44px — 2.5.5, an aim | 810 / 1,480 | 1,425 / 2,082 |
| under 24px — 2.5.8, the failure | 3 | 3 |
| of those, genuine | **0** | **0** |

The three are the same three on each tier: Leaflet's map container and its two
zoom buttons, under the panel `components/LiveMap.tsx` paints over them at
z-index 1200 to say *"the map itself needs a connection"*. A covered control
has no hit area at all, so each reads `0x0` — and 0 is under 24. A sweep run
somewhere tiles are reachable would not see them. The sweep names the cover —
`BLOCKED under role=status` — because naming it is what tells a deliberate
overlay from a fault.

(This table read **0** and said the three were "counted in neither column".
The conclusion was right and the sentence was not: `targets-sweep.mjs` scores
a blocked control by its hit size and has always put these three in the AA
column, where the list underneath names each one as blocked. A number in a
document that the tool contradicts is the thing this file exists to stop, so
the column stays as the tool prints it and the row under it carries the
judgement.)

One control in the app was genuinely under the AA minimum, on desktop, and it
is fixed here: **PIN** under each saved conversation, 20×25. Its own comment
recorded the same control measured at 19×17 and gave it a 24px floor on height
only; 2.5.8 asks for 24 *by* 24, and the spacing exception does not rescue it
because these three sit eight pixels apart. `styles/taps.test.ts` now holds
both axes.

The sampled figure itself cannot be reproduced, and it is worth saying why
rather than quietly replacing it. It was taken at `#/directory`, which is not a
route this app has: the address does not resolve, the screen does not change,
and the pass measured whichever screen was already on. The screens it might
have meant read 21 of 28 (Courses), 26 of 50 (Me), 16 of 22 (People) and 21 of
36 (the springboard) under 44px on a desktop today — none of them has 166
controls on it, so 93-of-166 is not a stale reading of any of them.

### What the sampled figure was measuring

The 93-of-166 figure, and the 162 this sweep's own first version reported, were
both `getBoundingClientRect` — the box the label is painted in. This app grows
the *target* without growing the *drawing*: `.tap`, `.tap-x` and `.tap-y` put a
transparent overlay over a small control reaching out to 44px, because a dense
design cannot make every nine-pixel caps label 44px tall and stay the same
screen. `styles/taps.test.ts` says the consequence in a line — *"an overlay is
invisible to a checker, which reads the element and is right to"*.

So the sweep measures by hit test: from inside the control it walks outward
asking `elementFromPoint` who would receive the tap. That reads the overlay,
and it reads occlusion, which a rect cannot. Four separate readings were wrong
before the figures above held still, and the probe found each of them by
disagreeing with a control of known size rather than by looking wrong:

| The probe said | It was measuring |
| --- | --- |
| 162 under AA on each tier | the drawing, not the target |
| 603 of 2,066 desktop controls unreachable | the fold — `elementFromPoint` is null outside the viewport |
| the links screen's EDIT buttons at 0×0 | the phone's fixed tab bar, which a two-line scroll clears |
| three checkboxes at 13×13 and 18×18 | the box, when the label beside it toggles it too |

Five controls of known size are now injected and measured by the same code
before each tier is walked — a real 44×44, a real 10×10, a 20px control wearing
`tap-y`, a bare 18px checkbox and the same checkbox inside a 120px label. If
any of the five comes back wrong the run prints why and exits rather than
reporting a figure taken with a broken instrument. Two of them exist only
because the rule they pin is the one that turned three failures into none, and
so the one most worth doubting.

### The 12-pixel figure is not a WCAG failure and has an answer already

1,418 of 3,663 desktop text elements are under 12px, mostly 10–11.5px caps
labels. There is no WCAG minimum font size; the criterion that covers this is
1.4.4 Resize Text, and the app satisfies it twice over — `a11y/type.test.ts`
holds the root to a *percentage* of the browser's own font size, so raising the
default from 16 to 24 makes the whole app 1.5× larger, and the app's own four
text sizes compose with that rather than replacing it. The figure is worth
keeping in view as a design question. It is not an acceptance blocker.

---

## 9b. Phase 0 — global search

The build-out plan's other Phase 0 item says the global search returns nothing
for `"cram sheet"`, `"podcast"` and `"teach back"`. It does, and the reason is
larger than three missing words.

`lib/find.ts` is thorough about what it covers — deadlines, courses, units,
notes, tasks, appointments, documents, sheets, decks, and the app's own
screens — and its header is explicit that a search covering a tenth of the app
"teaches people not to search". What it does not cover is everything the app
does that is **not a screen**, and there were two whole registries of that:

| Registry | Holds | Searched by |
| --- | --- | --- |
| `lib/nav.ts` `DESTINATIONS` | 60 screens | the global search |
| `lib/modes.ts` | the 11 ways through a course | nothing |
| `lib/settings.ts` | 11 settings pages, each with label, contents and synonyms | only the Settings screen's own box |

Measured against the four shipped courses before the fix:

| Typed | Answered | The app has |
| --- | --- | --- |
| `podcast` | nothing | 10 podcast editions, in a mode called Listen |
| `cram sheet` | nothing | Cram |
| `listen` | nothing | Listen |
| `worked examples` | nothing | Cases |
| `field guide` | nothing | Field guide |
| `narrated lesson` | nothing | 44 of them, in Watch |
| `colour`, `font`, `typeface`, `dark mode` | nothing | Colour and type, which carries all four as keywords |
| `change the layout` | nothing | Layout and navigation, which `layout` alone finds |
| `teach back` | **the Costs screen** | the teach-back journal on Study |
| `audio` | **the degree audit and the registrar** | Listen |

The last two rows are the ones that matter. A search that answers "teach back"
with a screen about money has not failed to find something — it has said
something false in a confident voice about an app that has exactly that
feature. `find.ts`'s near-miss tier is doing what it was built for ("audio" is
one edit from "audit"); the reason it gets to answer at all is that nothing
true was in the index to outrank it. **A missing index is worse than a missing
keyword**, and that is the finding.

**Done.** `lib/doing.ts` is the registry of what the app does that is not
somewhere you go — the eleven modes and the named panels on a screen — and
`find.ts` now reads it and the settings pages alongside the destinations.
Results say what they are (*Ways to study · In Study · **Listen** · The podcast
editions, with chapter marks that seek*) and land on the screen they live in.

`doing.test.ts` is the guard, in the shape `findable.test.ts` uses for screens:
it reads the `StudyMode` union out of `types.ts` and fails on a mode that is
not in the registry, and reads `modes.ts` for the labels so a mode renamed in
one file and not the other cannot leave search offering a name no screen uses.
Ten mutations, ten red.

A third fault turned up in the measuring and is fixed in the same place it
lives: `layout` found the settings page and `change the layout` found nothing,
because the loose tier required "change" to appear in it. `FILLER` in
`lib/search.ts` — the list that already exists so "delete my account" does not
fail on "my" — now also carries the verbs people put in front of what they
want. They are still matched directly when one is the whole query, so `make`
still finds Make a deck; only the every-word tier ignores them.

One entry was written and removed: a focus timer. `screens/Clocks.tsx` says in
its own header that it is a *kitchen* timer and that nothing on it touches your
pace or your grades; the timer that belongs to work attaches to one deadline
and stands nowhere. An entry claiming otherwise would have been the same fault
as the Costs screen answering "teach back", with the registry as the source
instead of a near miss.

---

## 10. Phase 1 — one complete course workflow

The build-out plan calls this *"by a wide margin, the single most urgent build
in this document"* and *"the single largest build in the entire completion
plan"*, and is specific about the shape: build **exactly one complete vertical
first, end to end**, before any breadth —

> Account → Institution → Course → Syllabus → Calendar → Study → Assignment →
> Submission → Receipt → Faculty Grade → Student Feedback → Record

— against *"a clearly labeled sandbox institution and sandbox course … so
nothing here is ever a placeholder success state presented as real."*

### Two corrections to the dependencies before anything was built

**The account foundation exists.** The plan names as a prerequisite "a verified
account, login, and multi-device-sync foundation — not yet formally scoped
elsewhere in this package". `lib/cloud.ts` is that foundation and has been:
email sign-up and sign-in, three OAuth providers, password reset, a Postgres
copy reconciled **field by field** on the device (`lib/merge.ts`, written
because whole-copy last-write-wins silently ate a note), device registration,
and an account-deletion path. Offline-first throughout — the app is fully
usable signed out. Nothing in Phase 1 was blocked on it.

**Most of the vertical exists too, and it is the *institutional* half that is
missing.** Account, Institution, Course, Syllabus, Calendar and Study are all
shipping. So is a great deal of the machinery nobody would guess was there:
`packages/institution` is a 399-line gateway contract with paginated records,
form fields, a two-phase review and a receipt; `server/institution/` is a real
gateway with an origin policy, tenant-scoped adapter lookup, per-user rate
limits, record-version checks, and an encrypted SQLite journal whose whole
purpose is the case where *"execute was called, the connection died, and nobody
knows whether the course was dropped"*.

What did not exist was **anything on the other end of the wire**.
`server/institution/adapters.ts` is empty on purpose — an entry there means a
school has approved an adapter for its students' real records — so every route
answered 503, and the loop could not be built, demonstrated or tested.

### Done — the sandbox institution

`server/institution/sandbox.ts`: one course, two published assignments, and the
whole loop across the four areas the contract already names.

| Stage | Area | Who |
| --- | --- | --- |
| Enrol | `courses` | student |
| Submit → receipt | `assignments` | student |
| Mark | `grades` | faculty |
| Release feedback | `grades` | faculty |
| Archive the record | `records` | faculty |

It is a sandbox in the three ways that can be checked rather than only in name:
it is never installed unless `SEMESTER_SANDBOX_INSTITUTION=1` is set on the
server (the approved registry stays empty, and a test fails if the sandbox is
imported into it); it answers only to an identity whose server-side
`app_metadata` says `institutionId: "sandbox"`, which no client can write; and
the institution name, every connection's provider and every record title begin
with `SANDBOX`, which a test reads back. The other thirty-three service areas
keep answering "not configured" — a demonstration that lit the whole University
screen up would be the placeholder the plan forbids.

**A sandbox that accepts everything proves nothing**, so the refusals outnumber
the acceptances: a student may act only on their own work, faculty on the
roster; an action carrying a stale version is refused; nothing is marked before
it is submitted, released before it is marked, or archived before it is
released, and nothing at all happens to an archived record; a mark outside the
assignment's range is refused; and a repeat of the same idempotency key returns
the *first* receipt and changes nothing.

Eighteen mutations reverted and watched go red. Three of them survived the
first pass and each was a real gap rather than a bad mutation — a redundant
idempotency check that meant enrolment's own guard was untested, a label test
that asserted a variable was *mentioned* rather than *used*, and a claim in a
comment about splitting an id on its last colon that no test exercised.

**One order-of-operations bug was found by writing the test rather than by
reading the code.** The idempotency answer has to come *before* the version
check, because the case it exists for — execute ran, it worked, the connection
died, the gateway retried — is exactly the case where the version has moved.
Checked the other way round, a student whose submission is sitting safely in
the store is told "this record has changed", and submits again.

The vertical is also driven **through the gateway** rather than only against
the adapters: HTTP in, status codes and JSON out, over a real journal on a real
file, including the two-phase prepare/confirm and a test that a confirmation
whose review has moved under it is refused and does not submit twice.

### Then the roster, which the plan calls the difference itself

The plan's "what's missing" list ends with *"a real class roster — the
difference between organizing a course and actually running one"*, and the
first version of the sandbox did not have one. Its roster was *whoever had
happened to open the app*: a work row came into being the first time somebody
looked at it, and faculty saw the set of rows that existed. Three things
followed, and the middle one is a bug rather than a thin demonstration.

| | |
| --- | --- |
| A marker's list of outstanding work left out everyone who had not opened the app | which under-reported exactly the students who owed work |
| **Anybody at all holding the student role could submit to the course** | there was nothing to be enrolled *in*, so there was nothing to check against |
| There was no way to see the class as a class | which is the difference the plan is naming |

Written as three failing tests first, then fixed. The course has a roster now,
seeded with three named sandbox classmates so a faculty view is a view of a
class rather than of one tester; a marker's list is built from the roster, so a
student who has never opened the app appears with nothing submitted; the course
record says how many are enrolled, how many pieces are in hand, how many are
outstanding and how many are waiting to be marked; and submission is refused to
anybody not on the roster. A test called `gatecrasher-1` is what that last rule
is measured against.

Self-enrolment stays, and is the sandbox's one concession to not being an
institution — a pilot tester needs a way onto the roster and there is no
registrar here to put them on it. It is a concession rather than a pretence:
the roster they join is the same list faculty mark from.

One thing fell out of the fix. Reads no longer write: materialising a row the
first time anybody looked made every faculty list a write, and made the stored
rows a record of who had *browsed* rather than of who was enrolled. Seven more
mutations, seven red — two of which survived a first pass and were a
no-op mutation of mine and a rule (enrolling twice) that nothing tested.

### And the rubric, which is the difference between a grade and feedback

The plan lists rubrics second in what is missing, right after submission, and
the first version of the loop marked work out of twenty with a paragraph
attached. That is a grade. A student who loses six marks learns nothing from
the number about *which* six — and the student-side half of this app is built
on the opposite premise: `lib/assignment.ts` pulls a rubric out of an
instruction sheet precisely so that "effort goes where the marks are rather
than where the writing is easiest".

Each published assignment now carries its criteria, and each criterion carries
what it is worth **and what it means**:

| Problem set 1 | | |
| --- | --- | --- |
| Method | 8 | The steps are shown and each follows from the last. |
| Accuracy | 8 | The answers are right, with units. |
| Clarity | 4 | A reader can follow it without asking you anything. |

Four things follow, and each is tested.

- **The student reads it before starting**, not with the mark. A rubric that
  arrives attached to the grade arrived too late to be used.
- **The marker gets a field per criterion and no field for the total.** The
  total is the sum, so a mark cannot disagree with its own parts.
- **An empty box is refused, not scored zero.** A marker who left one blank has
  not decided it is worth nothing — they have not finished — and writing the
  zero for them is the kind of helpfulness that ends up on a transcript. It is
  refused at *prepare*, so they are told before they confirm rather than after.
- **The released feedback says which criterion lost the marks**, and what that
  criterion was asking for. `Accuracy · 3 of 8 — the answers are right, with
  units` is a thing to do differently next time; `14/20` is not.

Seven more mutations, seven red.

### And discussion, which is the first part of this that is many-to-many

The last item on the plan's list, and the first one where the interesting
question is not *whose* something is. Everything before it concerned one
student's work. A question is different: the useful ones are useful to the
whole class, and some of them must never reach it.

> "I do not understand what Q3 is asking" should be answered once, where
> everybody can read it.
>
> "I am struggling and may need an extension" is addressed to the same person
> and must not be.

A board with one visibility either loses the first or publishes the second,
and a student cannot be expected to keep a rule the system does not enforce.
So every post carries who it is for, chosen at the time and never defaulted —
a person about to say something they would not say to the class should have had
to choose, not have had a default chosen for them. An unknown or missing
audience is refused rather than guessed.

Threads hang off the course and its published work, **not off anybody's work
row**. That is not a filing decision: a thread attached to a submission would
make the list of threads a list of who has submitted, and the existence of a
question would say something about the person who asked it before a word of it
was read.

The refusal that matters is tested from the other student's side rather than
the poster's — a test that checked an author can see their own private post
would pass against a board with no privacy at all. It is also tested at the
*write* as well as the read: a mutation removing the roster check inside the
post survived the first pass, because every test went through the record
first and the read refused them earlier. A client does not have to read
anything first, which is exactly why the check is in both places.

One real bug, found by the test rather than by reading: a retried post hit a
database constraint instead of returning its first receipt, because posting
never wrote a receipt down for `already` to find. The same dropped-connection
case the loop's other actions were built around, in the one path that had been
written without it.

Eleven more mutations, eleven red.

### The deadline, which was displayed and enforced nowhere

Both assignments carried a due date from the first commit, and nothing read it.
Work submitted three days late was recorded exactly as work submitted three
days early, which makes the due date decoration.

It is worked out from the two timestamps the record already has rather than
stored as a flag, so it cannot drift from them — a stored `late` and a
`submittedAt` are two facts that can disagree, and only one of them is
evidence. Both sides read the same sentence: the student is warned *before*
confirming, the receipt they keep says `Late by 3 days` or `On time, with 2
days to spare`, and the marker's record says the same. The course record now
separates **overdue** from merely outstanding, which is a difference a course
runs on: one is work still coming and the other is work that is not.

**It does not refuse a late submission**, and that is the design rather than
an omission. Plenty of courses take late work with a penalty, some up to a
cut-off, some not at all. A sandbox that hard-refused would be modelling one
policy as though it were the only one — the quiet assumption this whole
package is written against. It records the truth and leaves the policy to the
course.

One bug, introduced and then caught by an existing test within the same hour:
the lateness sentence was added to the receipt that was *handed back* after a
plain one had already been stored, so a retry disagreed with the original about
whether the work was late. A receipt is evidence; two versions of it is the one
thing it cannot be. The note is stored with the receipt now.

Eight more mutations, eight red.

### Publishing, which was the one stage of the chain with nothing behind it

The plan's chain begins *"faculty creates a course, a student enrolls, **an
assignment is published**"*, and for four commits publishing was a `const` in a
source file. Everything downstream of it was a real action with a review, a
receipt and a refusal; the thing that starts the loop was a deployment.

Faculty publish work now — a title, a deadline and a marking scheme — and it
reaches the whole roster with a thread to ask about it. The refusals are the
part worth reading: not into the past, not on top of something already
published, not by anybody who is not faculty, and not with a rubric that
cannot be read.

**The marking scheme is pasted, one criterion a line, as `Name | marks | what
it means`.** The alternative inside this contract was a fixed number of
criterion slots — `ActionField` has no repeating group — and three slots is
not a rubric, it is a form. Parsing free text is the risk, and the two-phase
action is exactly what makes it safe: `review` reads the whole thing back,
every criterion and the total, and nothing is published until somebody has
looked at that and confirmed. A line that does not parse is refused **at
prepare**, with the line quoted, so the person fixing it can see which one.

One thing that had to be got right and is not obvious: a criterion's name
becomes a *field id* on the marking form, and the gateway's own validator
refuses an id that does not match its pattern. "Method & rigour" becomes
`method-rigour` rather than a form nobody can submit.

Twelve more mutations, twelve red.

*Also caught here: `npx tsc -b` does not typecheck `server/`.* A call site left
with the wrong arity passed the app's typecheck and failed at runtime in the
tests. `npm run check:university` is the gate that covers this directory, and
it belongs in the list at the top of this document rather than in somebody's
memory.

### Recourse, which the loop assumed nobody would need

A released mark was final and an archived record was terminal, so the whole
vertical was built on the assumption that nobody is ever marked wrongly. Every
real course has a way to say otherwise, and the contract already had the area
for it — `appeals`, *"Feedback & appeals"* — with nothing behind it.

Two rules give it its shape:

- **Only against a mark the student has seen.** A mark you cannot read is not
  one you can dispute.
- **Only before the record is archived** — which is what finally gives
  archiving a consequence. Until now it changed a status and nothing else;
  closing the appeal window is what makes it an archive rather than a label.
  A record cannot be archived while an appeal is open, because archiving over
  one would answer it by ignoring it.

Faculty **uphold** with a reason, or **amend** by re-marking against the same
rubric with a reason. **Nothing is overwritten.** The appeal keeps the mark as
it stood when it was raised, and the trail keeps `Marked`, `Appealed` and
`Mark amended on appeal` as three separate entries. An academic record holding
only the latest number cannot answer *"what changed, and why"*, which is the
one question an appeal exists to leave an answer to.

Twelve more mutations, twelve red. One survived a first pass and it was the
same shape of hole the discussion board produced: the test checked that the
appeal action is not *offered* before a mark is released, and never tried
sending it anyway. A client does not need the menu.

### And then it was booted, which had never happened

Every test above proves the adapters, and the gateway tests drive the whole
vertical through `createGateway` in memory. Neither touches `start.ts` — the
configuration it refuses to start without, the directories it makes, the
umask, and the line it prints. **That file had never been run with the sandbox
switched on.** The first time it was, it said

> SANDBOX INSTITUTION IS ON: **4** demonstration adapters are installed

with five installed. The `4` was a literal, inside an expression reading the
*arity* of `sandboxAdapters` rather than the length of what it returns. No unit
test could have caught it, because no unit imports that line.

A second fault came out of the same boot and had not caused a failure yet: the
sandbox's store directory was never created. By default it shares one with the
journal, whose own `mkdirSync` happened to cover it — a dependency on another
variable's default and on the order the two run in. Point `SEMESTER_SANDBOX_PATH`
somewhere of its own and it throws on the way up. The smoke test points it at a
directory nothing else makes, for exactly that reason.

`npm run smoke:gateway` is the boot, written down so it can be taken again: it
starts the server, checks the count in its own startup line, that it still
reports no *approved* adapters, that `/status` without a token is refused and
another origin is refused, and that both stores are `0600` inside a `0700`
directory. Deliberately not part of `npm test` — it binds a port and spawns a
process, and a suite that does either fails on somebody else's machine for
reasons that are not about the code. Three mutations, three red, including the
literal `4` coming back.

### Where you stand, which the chain ends at and nothing answered

The plan's chain runs *"… Faculty Grade → Student Feedback → **Record**"*, and
for nine commits the Record was per piece of work — a trail, a mark, an
archive. Nothing anywhere answered the question a student actually asks, which
is not *what did I get on the problem set* but *where am I in this course*. The
course record answered a different question instead, and answered it to
everybody.

**The marker's view was on the course record for every reader.** `3 of 4 in
hand · 1 outstanding · 2 to mark` is exactly right for the person marking and
wrong for everyone else: on a class of four it tells an enrolled student
precisely how many of their classmates have not handed in, which is a fact
about other people published to somebody with no business in it, and on a class
this size it is one step from a name. The record has two faces now. Faculty get
the queue, unchanged. A student gets their own work.

**Twenty marks and forty marks is not a weighting.** Each piece now carries
what it is *worth* as well as what it is marked out of, and those are two
different facts: out-of-twenty is a count of how many criteria somebody wrote,
and a student reading the two totals cannot tell whether the paper is worth
twice the problem set or whether its rubric is simply longer. Faculty state the
share when they publish, it is read back at prepare with what will still be
unpublished afterwards, and a course cannot be published past a hundred percent
of itself — a course whose weights add to a hundred and sixty cannot report a
standing at all, because every fraction it prints is a fraction of a course
that does not exist.

Two rules give the standing its shape, and both are refusals:

- **Only marks the student has been shown.** A standing that moved when the
  marking was done rather than when it was released would let the mark out
  through the back door — the number would not be displayed, but it could be
  subtracted for. "Not released" has to mean not counted, or it means nothing.
- **It is never stated as a grade for the course.** Seventeen out of twenty on
  a fifth of a course is not an eighty-five. The record says `17 of 20 marks.
  20% of this course has been marked.` and then, out loud, `80% of this course
  has not been marked, and nothing here guesses at it.` The app does project a
  term — with a band, and its name on it, in `lib/termgpa.ts` — and that is a
  different kind of thing from a record, which states what happened and stops.

Before enrolling, the same face is a syllabus rather than a standing: what is
published, what it is worth and when it is due, which is how somebody decides.
A place in a class you have not joined is not a thing to be told you have.

Fifteen mutations, fifteen red. One survived the first pass and it was the
weakest-looking of them: what a piece is worth was on the *course* record and
on the piece of work itself, and only the first was tested — the second is the
one a student reads the evening before they start, which is the whole argument
for having it.

### And then it was driven through the wire, which had also never happened

Two commits ago the finding was that `start.ts` had never been run. This one
is the same shape one layer in: **the loop had never been refused through the
gateway.** Every refusal above is tested — sixty of them — and every one of
those tests calls the adapter directly. Between the adapter and a person sit
authentication, the origin check, the two-phase action, the journal and an
error handler, and the error handler ate all sixty.

A plain `Error` is not the gateway's own `HttpError`, so every refusal fell to
the outer catch, which exists for a good reason — an exception out of a
school's system can carry a connection string, a stack, or a row of somebody
else's data — and flattens anything it did not mean to say into:

> The university service is unavailable. Please try again later.

with a **503**. So a marker who mistyped one rubric line was told the
university was down, and the status code invited them to try it again. The
two-phase action's whole argument for accepting a pasted marking scheme is
that *"a line that does not parse is refused at prepare, with the line quoted,
so the person fixing it can see which one"* — and the quote could not reach
them.

`Refusal` is the fix and it is a type rather than a rule about `review`,
because the distinction is real and worth keeping. Throwing one asserts two
things: **this sentence is meant to be read**, and **nothing was written**. The
gateway answers it with a 400 carrying the message; an ordinary exception out
of the same method is still flattened, and a test proves that with a message
containing a database password. The second assertion is what lets a refusal
thrown from `execute` — twelve of the forty are there, because a client does
not have to prepare anything first — be marked `refused` in the journal rather
than `uncertain`, instead of sending somebody to their registrar to reconcile
an action that provably did not happen.

**Two more came out of the same probe, and neither could have been found any
other way.**

The first is the test that should have caught it. One test did drive a refusal
through the gateway, and it asserted `expect(late.status).toBeGreaterThanOrEqual(400)`.
A 503 satisfies that. A test that cannot tell a refusal from an outage is why
nobody noticed for nine commits; it asserts the exact status and the exact
sentence now.

The second is worse. `canWrite` on the `courses` area was `isStudent`, written
when enrolling was the only thing anybody did to a course. Publishing landed
there later, and so did faculty posting in a thread — and the gateway checks
`canWrite` *before* it asks the adapter anything. **Faculty could not publish
through the gateway at all**: 403, "This connection does not permit that
action", on the stage the plan's chain begins with. Sixty adapter tests passed
throughout, because not one of them goes through the wire.

Eleven mutations, eleven red. One of them is structural rather than behavioural
and it is the one carrying the weight: a runtime test can only pin the refusals
it happens to drive, so a test reads `sandbox.ts` and fails on any `throw new
Error` left in it. That is the guard that covers the fortieth refusal and the
forty-first, which is the same argument `src/rootunmount.test.ts` makes about
React roots.

### And what late work costs, which the course had no way to say

The deadline commit recorded lateness and deliberately refused to act on it:
*"a sandbox that hard-refused would be modelling one policy as though it were
the only one … it records the truth and leaves the policy to the course."* That
was right about the absence of a policy, and it left a thread hanging. There
was nowhere for a course to state one, so both sides read the sentence **"The
course decides what that costs"** and neither of them could find out what it
decided.

A course states it now, as the two numbers nearly every real policy is made of
— a rate per day and the most it can reach — and `0` is a policy too: a course
saying late work is not penalised is saying something, and it is not the same
as a course that has not said anything. Both sentences are distinct and both
are tested, because "unstated" and "stated as nothing" are different facts.

**Four numbers, kept apart.** What the work earned, how late it was, what that
cost under the stated rule, and what goes on the record:

| | |
| --- | --- |
| Mark | 17 out of 20 |
| Deadline | Late by 3 days |
| Late penalty | 30% of 20 — 6 marks, for 3 days. 10% of the mark per day late, or part of a day, up to 30%. |
| Recorded | 11 out of 20 |

One number cannot answer *what did I lose it on*. The rule the whole thing
rests on is that **the penalty never comes out of a criterion**: "Accuracy 6 of
8" is a judgement about the answers, lateness is not a statement about
accuracy, and scaling the criteria would make the rubric lie about the work in
order to carry a fact about the clock. The recorded mark is computed from the
rubric and the rate rather than stored, for the same reason the lateness
sentence is — two stored facts can disagree, and only one of them is evidence.

That is also what makes the last refusal necessary. **A policy cannot be
changed once a mark has been released under it**, because the mark is computed
from it: change the rate afterwards and every released mark silently restates
itself, nobody is told, and the number on the record stops matching the number
the student was shown.

The policy is on the course and on each piece of work, not only in the warning
attached to submitting three days late — the same argument the rubric is here
for. A policy somebody meets at the moment they are already late arrived too
late to change anything they did.

One thing fell out of reading the diff adversarially rather than out of a
test. The appeal record showed the mark as marked, and the grades record now
showed the mark as recorded — two answers to *"what is my mark"* on the two
screens a student reads together, on the one occasion where that question has
to have one answer. The appeal carries the recorded mark now, with the
difference named beside it.

Twenty mutations, twenty red. Four survived the first pass and every one
was the test rather than the code: a claim in a sentence ("or part of a day")
that no test exercised, an assertion that read the whole record as one string
and so could not tell a renamed label from a missing one, and a "nothing is
invented" test that checked the rubric mark was still there rather than that
the penalty was not. Fixing the second one turned up a guard that could not be
made to fail — an early-work check whose work was already done by the line
below it — which was removed rather than left looking like a guard.

### The syllabus, which was one sentence on a constant

The plan's chain reads Course → **Syllabus** → Calendar, and the syllabus was a
`const` string used as the course record's summary. That is a *description* of
a course. It does not say when the course meets, when anybody can be asked a
question, what counts as working together and what counts as copying, or how
the marks add up — which are the questions a student has before a course
starts, and the third of them is the one people get wrong and lose a degree
over.

It is a document of its own now, with its own record, published and revised by
faculty. Three things about it are worth reading.

**The assessment section is derived, not typed.** A syllabus that says "problem
set 20%, paper 35%" is a second copy of the published weights, and the two
drift the first time faculty publish anything — at which point the contract
with the class says one thing and the course does another. It is read off what
is actually published, every time, and it says what is still unpublished. The
same goes for the late policy: the syllabus carries it, it does not restate it.

**A revision must say what changed.** A syllabus is a contract with a class,
and the complaint people have about one is never that it changed — courses
change — it is that it changed and nobody said. The first one needs no note,
because there is nothing to have changed from; every one after it is refused
without one, and the note is on the record where the class reads it, beside
`Revision 3, 2026-10-14`.

**An unpublished syllabus says so.** "The course faculty have not published a
syllabus" is an answer; a blank page laid out like a document is not, and it is
the same placeholder the plan forbids everywhere else.

It sits beside the course rather than behind the roster, because somebody
deciding whether to take a course reads it before they enrol — unlike the
discussion threads, which stay closed to anybody not in the class.

Fifteen mutations, fifteen red.

### And the Record itself, which had no mark on it

The chain's last stage, and for eleven commits it read

> Archived. This is the closed record of one piece of work.

above a course code, a student id, and a trail of timestamps. A trail is a
record of the *transitions*. It is not a record of the work, and an academic
record that cannot answer *what was it, what did I get, and why* is a filing
stub. Every one of those facts already existed — on three other screens.

It carries them now: what the piece was worth, when it was handed in, whether
it was late and what that cost, the mark and the recorded mark, **which
criterion lost the marks and what that criterion was asking for**, the
feedback, and how an appeal came out if there was one. "17 out of 20" and
nothing else is the grade this document already refused once; the archive is
not the place for it to come back.

Everything on it is composed live rather than copied in at archive time,
because a stored copy is a second version of a fact that can disagree with the
first — the argument the recorded mark and the lateness sentence are both built
on. That only counts as a record if none of its inputs can move underneath it,
and none can: a published assignment's weight and criteria have no edit action,
and the late policy is frozen the moment a mark goes out under it. **The test
archives one, runs the course on, and compares the two byte for byte.**

Ten mutations, ten red. Three survived the first pass and all three were the
same fault, which has now been caught three times in this file and is worth
writing down: **a test that greps `JSON.stringify(details)` cannot tell a label
from a value from a trail entry.** One "no unreleased mark" probe matched the
`2026-09-17` in a timestamp; two appeal probes matched the phrase "Mark amended
on appeal" sitting in the trail, and so passed against a record that said
nothing about the appeal at all. Read the line by its label.

### Calendar, which is where the chain finally reaches the app

The chain reads Course → Syllabus → **Calendar → Study**, and for the whole of
Phase 1 the first two lived on the university gateway and the last two lived in
the app with nothing between them. A student enrolled in the sandbox course had
two published assignments whose deadlines Today could not see — the shape
[Appendix A](#appendix-a--what-measurement-corrected) calls the dominant finding
in this codebase: an engine that exists, and a place it has not been connected
to.

**This is a change of position, and it is written down as one.** A school's
records used to be read, drawn, and never kept — `lib/university.ts` said so on
the function that fetches them, and `screens/University.tsx` said so in its
header. They are kept now. "Add my courses to this app" copies the course and
every published deadline into the same library the student's own imported
courses live in, on the same terms: editable, exportable, deletable, theirs.
Both of those comments now say what is true instead, because a comment that
contradicts the code is the same defect as two copies of a fact.

What the old separation was actually for is kept:

- **A copy happens because somebody asked.** Nothing syncs itself.
- **Everything copied says where it came from** — the institution's name on the
  course, on every deadline's detail line, and in `source`, which everywhere
  else in this app names the file a deadline was lifted from. A SANDBOX date
  arriving in Today beside four real courses has to be tellable apart.
- **Nothing is labelled official without a receipt.** Unchanged.

**A date is carried as a date.** `UniversityRecord` gained an optional `dates`,
machine-readable, beside the `details` a person reads — because parsing "Due
2026-10-02 23:59" back into a timestamp would make a display string the source
of a calendar entry. One fact with two versions, where only one is evidence, is
the thing this package refuses everywhere else. An adapter must write both from
the same value; the sandbox does, and a test reads them together. A record with
no `dates`, or with one a `Date` cannot parse, produces **no calendar entry** —
not an Invalid Date sitting in Today as a deadline with no day.

**A sync is not an import, and the reducer says so with its own action.**
Importing is something a student does once to a document they hold. This is a
sync against a system that is the source of truth for the work it set, so
pressing it twice must mean *bring me up to date* rather than *give me another
one*. Three rules fall out, and the middle one is the one worth arguing:

| | |
| --- | --- |
| A deadline the school withdrew goes | nobody is being marked on it |
| **A date the student moved survives a sync that did not move it** | `Item.movedFrom` exists because "what must not happen is the app quietly forgetting that it now disagrees with the document it is showing underneath". A sync that silently put the date back is that same fault wearing a network request. |
| Unless the school moved it too, in which case the school wins | a move is a correction *to a date*; once that date is gone, keeping the correction leaves somebody holding a deadline their course does not have |

Anything the student added themselves is left alone.

**And `npm run test:zones` earned its place in the list.** The first version of
this read the date with local getters and the time with `toISOString` — a
single item carrying a UTC time beside a local day. Everything passed: types,
lint, the suite, the shuffled suite. Pacific/Kiritimati is fourteen hours
ahead, where `2026-10-02T23:59Z` is the third of October, and four tests went
red. `Item` is month/day/year with no zone on it and these sync between a
student's devices, so a deadline reading 2 October on a laptop and 3 October on
a phone would be two records of one fact. The school said 2 October; the app
stores 2 October, and a test now walks three zones rather than leaving that
gate as the only thing that would notice.

Sixteen mutations, sixteen red. Three survived the first pass: a date the
parser cannot read had no test, the contract's own `dates` field had no test on
the adapter that writes it, and one anchor was ambiguous because the same line
appears on the course and on its guide. The reducer's exhaustiveness test —
*"a switch statement is exhaustive by construction and eight chained functions
are not"* — caught the new action before a line of it was written.

### What this does not do

It does not connect to Vanderbilt or to anything else, and nothing here changes
what the app tells a student about that. With this, every item on the plan's
"what's missing" list for the institutional side — submission, rubrics, faculty
grading, feedback delivery, discussion and a real class roster — has a working
version against the sandbox, and none of it has a version against a real
school, which remains an institutional decision rather than an engineering
one.

---

## Appendix A — What measurement corrected

Each row is a claim in the draft this plan grew out of, what the tree said when
it was checked on 15 September 2026, and where to look.

| The draft said | Measurement says | Read it in |
| --- | --- | --- |
| Exam Runway "does not exist in the app today — the one feature in the entire product with no working version yet" | 1,189 lines and a screen, shipping, including a three-source coverage engine that refuses to infer scope | `lib/runway.ts` (313), `lib/covers.ts` (322), `screens/Runway.tsx` (554) |
| Exam Runway needs "a new Quiz/Cram engagement log (does not exist yet and must be built as part of this item)" | The engagement record exists and Runway already reads it — cards never answered, units never opened, papers sat | `lib/review.ts`, `lib/sitting.ts`, `lib/runway.ts` |
| GPA Projection is "a simple estimate rather than a modeled distribution"; build "a small weighted-scenario model (best / expected / worst)" | The low / middle / high band across courses exists, composed from four files, with letter cliffs handled and no rounding before the scale reads a percentage | `lib/termgpa.ts` (426), `lib/worth.ts`, `lib/cutoffs.ts`, `lib/grades.ts` |
| Spreadsheet is missing "pivot tables and deeper formula coverage (lookups, array-style formulas)" | Pivot tables ship, and write back as live `SUMIFS`; lookups ship (`VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`). Array formulas were genuinely absent and did need a spill model first — both are built now (§5.2) | `lib/pivot.ts` (424), `lib/sheet.ts` (164 functions), `lib/functions.ts` |
| Document Editor should "wire in direct equation embedding from the existing math engine rather than a static image of an equation" | Already wired: a `.docx` equation is a real OMML equation object, editable in Word | `lib/docx.ts:610`, `lib/maths.ts` |
| Watch "produces visual, video-style walkthroughs for a limited set of concepts"; missing "full-course coverage" | 44 narrated lessons over 44 units — complete coverage of every shipped course. The gap is a generated course, which gets none | `public/audio/lessons/`, `pipeline/lessons.py` |
| Listen is missing "complete chapter-mark indexing across all content" | All eight editions carry a `chapters` block, rendered exact by the synthesiser. The gap is a generated course, and the absent batch pipeline | `src/data/courses/*/index.ts`, `audio/synth.py`, `pipeline/chapters.py` |
| Figures needs "a repeatable pipeline for turning arbitrary course concepts into a correct diagram" built from scratch | That pipeline exists — Claude writes a Mermaid or SVG specification, `cleanSvg` sanitises it, the app renders it. ~~Wired to the Draw screen and not to the Figures mode~~ — **wired to both, as of the `drawn` arm**; the remaining gap was the hand-drawn kinds' subject coverage, closed 17 September | `lib/diagram.ts` (343), `lib/figure.ts:readDrawn`, `components/FigureCard.tsx`, `lib/live.ts` |

Two claims in the draft survived the 15 September pass and were repeated above
on their own merits. **One of them has since been closed, and re-measuring on
17 September is what found it.**

| | |
| --- | --- |
| Where Courses Meet matches words rather than meanings | still true — `lib/meet.ts` says so in its own header, and §4.1's fifth grade of evidence is unbuilt |
| ~~Quote Verification has had no adversarial false-positive pass~~ | **`lib/quotes.adversarial.test.ts`**, twenty cases in four families — numbers changed inside a verbatim passage, fragments assembled from pieces that each appear separately, a different work by the same author, and near-miss paraphrases. Written, in its own words, "by someone trying to break it, because the two directions are not the same test". |

### What a second pass over this document found

Re-reading §3 to §5 against the tree on 17 September, **five claims of
incompleteness were stale** and two were real:

| | |
| --- | --- |
| §3.1 — the figure systems "do not meet" | closed; the `drawn` arm joins them |
| §3.1 — "a generated course gets no figures at all" | closed, and was never quite the gap it reads as |
| §3.1 — no STEM diagram kinds | **real**, and closed on 17 September |
| Phase 2 exit — "no mode card reports an empty state" | true, and now a test rather than a sentence |
| §4.2 — the GPA exclusions are not offered as fixes | closed; `missingLine` and `fixFor` |
| Appendix A — no adversarial pass on quotes | closed; twenty cases |
| §4.3 — a fourth, model-read scope source | closed; `readScope` and `readProposal` |
| §4.1 — a fifth, semantic grade of evidence | closed; `readSame` |
| §5.1 — embedded figures, export fidelity | closed, and recorded as closed |

| §3.5 — script generation is not in the app | closed; `lib/script.ts:scriptFor` |

**Seven of eight, and the eighth was built on 17 September.** By measurement,
§3 to §5 has nothing left in its "what's missing" lists that is not a statement
about rendered audio for a generated course, which §3.5 names as a boundary
rather than a gap.

### The two rows that took two passes, and why

The first version of this audit had the last two as *real and open*, and both
were wrong by exactly the fault the rest of this document keeps recording — a
probe answering a narrower question than the one being asked.

**§4.3.** The check was whether `covers.ts` had a fourth value in its `Source`
union. It does not, and it should not: this section's own technical approach
says a proposal the student accepts becomes `yours`, *"a source `covers.ts`
already has"*. The absence being tested for is what the design asks for. The
feature is in `screens/Runway.tsx` — `readScope` asks, `readProposal` validates
against the guide's own unit numbers, and confirming dispatches
`setExamCovers`, under a comment that ends "No fourth source, and the app still
never infers what an exam covers."

**§4.1.** The check was a grep of `meet.ts`'s header for the sentence about
matching words rather than meanings. That sentence is still there and is still
true *of the four string grades*, which is what it describes. Line 558 of the
same file says "The fifth grade writes its own line", and `readSame` is it.

**A third probe was wrong while this was being written**, which is why the
paragraph below is stated as strongly as it is. A script that listed every
"What's missing" in this file and looked at the sixteen lines *after* each one
for a resolution marker reported §4.1, §4.2 and §4.3 as open — because the
notes resolving them had been written immediately *above* the heading, not
below it. The probe searched in one direction and the answer was in the other.

So the thing to carry forward is not the ratio, though the ratio is striking.
It is that **the probe is part of the claim**. This document's own instruction —
*find out which of them is lying before editing either* — is not only about a
command disagreeing with a number. A search that looks for the wrong symbol
returns a clean, confident, wrong answer, and nothing about it feels like a
guess. Read the section's own technical approach before deciding what absence
would prove it unbuilt.

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

# The gates, from app/ — the repository root has no package.json
# with these scripts, so npm test there silently does nothing.
cd app
npx tsc -b            # types
npm run lint          # oxlint, plus the style and label audits
npm test              # the suite, in file order
npm run test:shuffle  # the suite, in an order nobody chose
npm run test:zones    # the suite, in two timezones that disagree about the date
npm run check:university  # server/institution — `tsc -b` above does NOT cover it
npm run build         # production build

# Tap targets, both tiers, all 57 id-free screens. Needs `npm run dev` on
# :5173 and a Playwright installed somewhere scratch — the script says where
# and why it is not a dependency. It checks its own instrument first.
SWEEP_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run sweep:targets

# The university gateway, booted with the sandbox on. Not in `npm test`: it
# binds a port and spawns a process.
npm run smoke:gateway

# Study modes, and the count this document states.
#
# `npm run counts` and nothing else. The hand-rolled grep that used to be here
# counted the ids inside `modes.ts`'s `return [` and answered ten, because
# Watch is built by a function above that block — so anybody who ran it would
# have "corrected" a correct eleven down to ten. A probe that convicts the
# innocent is worse than a stale number, and `counts.mjs` is the thing the
# generated markers in this document are written by.
npm run counts        # rewrites the generated counts in the files that state them

# Content coverage, per course.
for c in bus core econ psci; do
  printf '%s units: '   "$c"; grep -c 'cards: \[' src/data/courses/$c/guide.ts
  printf '%s lessons: ' "$c"; ls public/audio/lessons/$c | grep -c mp3
  printf '%s editions: ' "$c"; grep -c 'chapters: \[' src/data/courses/$c/index.ts
  printf '%s examples: ' "$c"; sed -n '/examples: \[/,/^  \],/p' src/data/courses/$c/index.ts | grep -c 'tag:'
done

# Engine coverage.
grep -oE "case '[A-Z0-9.]+'" src/lib/sheet.ts | sort -u | wc -l   # 164 functions
sed -n '/DIAGRAM_KINDS = \[/,/\] as const/p' src/lib/types.ts | grep -c "^  '"   # 21 kinds
grep -c '^  {' src/lib/nav.ts                                      # 60 destinations
wc -l src/lib/runway.ts src/lib/covers.ts src/screens/Runway.tsx
wc -l src/lib/pivot.ts src/lib/termgpa.ts src/lib/diagram.ts src/lib/quotes.ts

# The two facts that decide four of the five study-mode plans.
#
# By what they say rather than by where they sit. The first of these was a line
# range, `sed -n '460,466p'`, and the lines moved — it printed a card count and
# a note about dated obligations, which is not what its comment claimed and is
# not evidence for anything this document argues.
grep -n 'Figures, examples and audio' src/lib/generate.ts
grep -n 'import' src/lib/quotes.ts        # two imports, neither of them the network
```

A number in this document that these commands contradict is this document being
stale. Correct it here, and say in the commit message which measurement moved.

**Unless the command is the stale one**, which is what a pass through this
appendix on 17 September found. Four of these had rotted, and the two that
matter are the two that would have produced a *wrong correction* rather than
no answer:

| | |
| --- | --- |
| The study-mode grep answered **ten** against a true eleven | it counted the ids inside `modes.ts`'s `return [`, and Watch is built by a function above it. Anybody running it would have edited a correct figure down. Replaced with `npm run counts`, which is what writes the generated markers in the first place. |
| `sed -n '460,466p' src/lib/generate.ts` printed a card count | the lines moved; the comment still said "figures, examples and audio". A line range is a reference that rots silently. It greps for the sentence now. |
| `# 159 functions` beside a command answering 164 | the body text said 164 in two places, so only the comment was wrong — which is the version of this that survives longest, because the number on screen looks like a disagreement with the document rather than with the comment. |
| `lib/docx.ts:610` | the OMML call is at 619. |

Four line counts in Appendix A had also drifted, all upward, and one sum with
them: Exam Runway is 1,189 lines rather than 922. So: **prefer a command that
names what it is looking for over one that says where it used to be**, and when
a command and this document disagree, find out which of them is lying before
editing either.
