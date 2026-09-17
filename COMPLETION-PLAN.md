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

### 5.1 · Document Editor — Live

**Current state.** Thirteen block kinds (`app/src/lib/document.ts`): heading,
text, bullets, quote, table, equation, code, checks, image, **figure**, table of
contents, rule and page break, each with notes. It exports to real `.docx` (`lib/docx.ts`, 1,019
lines of OOXML written directly) and to real `.pdf` (`lib/pdf.ts`, written
without a library, placing every line by hand because nothing in a PDF wraps
text).

Equations are already embedded properly in the `.docx`, which the draft lists as
work to do. `lib/maths.ts` renders one notation three ways — MathML for the
screen, **OMML for Word**, Unicode for everywhere else — and `lib/docx.ts:610`
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
seventeen hand-drawn diagrams and anything from the Draw screen — are SVG at
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
measured and recorded; the five gates green; and no mode card in
`lib/modes.ts` reports an empty state for a course the app built itself.

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

## 9. Phase 0 of the build-out plan — accessibility minimums

The build-out plan carries this as work to *"complete before any pilot tester
touches the app"*, with a number attached: **"a sampled pass on the desktop
Directory screen found 93 of 166 interactive elements below the 44-pixel
minimum touch target, and 7 text elements below 12 pixels"**, and asks to fix
the Directory first and then *"run the same measurement method across the rest
of the app rather than assuming the problem is isolated"*.

The measurement method is now `app/scripts/targets-sweep.mjs` — `npm run
sweep:targets` — which walks all 57 id-free screens on a phone and a desktop in
real Chromium. Written down rather than sampled once, because a figure nobody
can retake goes stale without anybody noticing it has.

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

| | Phone 420×900 | Desktop 1280×900 |
| --- | --- | --- |
| under 44px — 2.5.5, an aim | 818 / 1,474 | 1,427 / 2,066 |
| under 24px — 2.5.8, the failure | **0** | **0** |

Three more read as under 24 on each tier and are counted in neither column:
Leaflet's map container and its two zoom buttons, under the panel
`components/LiveMap.tsx` paints over them at z-index 1200 to say *"the map
itself needs a connection"*. A sweep run somewhere tiles are reachable would
not see them at all. The sweep names the cover — `BLOCKED under role=status` —
because naming it is what tells a deliberate overlay from a fault.

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
| Exam Runway "does not exist in the app today — the one feature in the entire product with no working version yet" | 922 lines and a screen, shipping, including a three-source coverage engine that refuses to infer scope | `lib/runway.ts` (313), `lib/covers.ts` (206), `screens/Runway.tsx` (403) |
| Exam Runway needs "a new Quiz/Cram engagement log (does not exist yet and must be built as part of this item)" | The engagement record exists and Runway already reads it — cards never answered, units never opened, papers sat | `lib/review.ts`, `lib/sitting.ts`, `lib/runway.ts` |
| GPA Projection is "a simple estimate rather than a modeled distribution"; build "a small weighted-scenario model (best / expected / worst)" | The low / middle / high band across courses exists, composed from four files, with letter cliffs handled and no rounding before the scale reads a percentage | `lib/termgpa.ts` (401), `lib/worth.ts`, `lib/cutoffs.ts`, `lib/grades.ts` |
| Spreadsheet is missing "pivot tables and deeper formula coverage (lookups, array-style formulas)" | Pivot tables ship, and write back as live `SUMIFS`; lookups ship (`VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`). Array formulas were genuinely absent and did need a spill model first — both are built now (§5.2) | `lib/pivot.ts` (424), `lib/sheet.ts` (164 functions), `lib/functions.ts` |
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
