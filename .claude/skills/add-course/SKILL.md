---
name: add-course
description: Add a course to the Semester app from a syllabus and its readings, or update one already in it. Use whenever the user provides a syllabus, a study guide, a reading list, or new course material — PDF, HTML, Markdown or pasted text — and wants it turned into deadlines, a study guide, figures and audio. Also use when they say a class has new readings or announcements to fold in.
---

# Adding a course

You are turning documents into a course module the app can use. The whole
pipeline exists so this takes one pass, not a day of guesswork.

The end state: `app/src/data/courses/<id>/` holds the course, `validate.mjs`
passes, the app typechecks, and the course appears with real deadlines, a real
study guide, figures and — if there is time to render — audio.

## Before you start

Ask only what you cannot read off the documents. Usually that is nothing. If the
syllabus omits a meeting time or room, note it as invented in the module's
header comment rather than quietly inventing it — the existing four courses do
exactly this for BUS 1600's 11:00a slot and ECON's 9:05 section.

## 1 · Read the sources

```bash
python3 pipeline/ingest.py <file.pdf|file.html|file.md> -o /tmp/course.txt
python3 pipeline/ingest.py sources/*.pdf -d /tmp/extracted/     # several at once
```

Read the extracted text in full before writing anything. You are looking for:

- every dated obligation, and the sentence that states it
- how the grade is built, component by component
- the meeting pattern, room, professor, contact
- what the readings actually argue — the content of the study guide

If the user references a Claude artifact, try `Artifact` with `action: "read"`
first. **Published** artifacts (`claude.ai/code/artifact/<uuid>`) are readable.
Artifacts that live inside a chat are not addressable by any tool — `claude.site`
is egress-blocked, the public page is a client-rendered shell, and an
authenticated fetch returns 403. Do not spend several attempts discovering this
again. Say so plainly and ask them to publish it or upload the file.

## 2 · Scaffold

```bash
node pipeline/new-course.mjs --id hist --code "HIST 1620" \
  --name "The Cold War" --prof "Dr. A. Reed" --email a.reed@vanderbilt.edu \
  --meets "MW · 10:10–11:25a" --room "Buttrick 205" --credits "3 credits" \
  --source "HIST1620_Fall26.pdf" --days MW --at 10:10
```

Writes `guide.ts` and `index.ts` full of TODOs and registers the course in
`data/catalog.ts`. Nothing else needs editing — the catalog derives every lookup
the app uses.

## 3 · Fill in `index.ts`

**Deadlines.** Every dated thing, with `quote` set to the syllabus sentence it
came from, verbatim. That quote is shown in the app under "Straight from the
syllabus" and is the reason a student can trust the entry. Months are 0-based:
August is 7, September 8, October 9, November 10, December 11.

**Schedule.** The weekly pattern. Put one-off changes — a cancelled class, a
guest speaker — in `exceptions`, naming the block with `title` if it is not the
main class.

**Grading.** Every component. Do not round or summarise.

## 4 · Write the guide

This is the part that carries the value, and the part no tool can do for you.

Units follow the course's own structure — its chapters, weeks, or sessions. Each
card is a question the exam could actually ask, and an answer in **full prose
with the numbers in it**. Not a hint, not a topic label.

Good: *"Gerber, Green & Larimer — the four treatments and their effects?"* →
*"Civic Duty +1.8, Hawthorne +2.5, Self +4.9, Neighbors +8.1 against a 29.7%
control, across 180,002 households. Turnout is driven by being seen, not by
information."*

Bad: *"Know the GGL study"* → *"It's about social pressure and voting."*

Also fill in, where the material supports them:

- `frames` — the recurring question shapes and how to answer them
- `terms` — the glossary
- `selfTest` — questions written to be answered out loud
- `cases` — claim / test / verdict, where a reading argues against a received story

Read `app/src/data/courses/psci/guide.ts` for the shape at full size.

## 5 · Figures

`figures` is keyed by **unit index**. Insert a unit at the top and every key
shifts — this has already caused one real bug. Run the validator after any
change to the unit list.

Bar and step figures are data. Curve pictures need a `DiagramKind`, drawn in
`app/src/components/Diagram.tsx`; add a new one there if the course needs a
picture that does not exist yet.

Figures belonging to no single unit go in `extraFigures`.

## 6 · Validate, typecheck, look at it

```bash
node pipeline/validate.mjs
cd app && npx tsc -b --noEmit && npm run dev
```

The validator catches figure keys past the end of the unit list, duplicate item
ids, months out of range, missing audio files, and chapter marks past the end of
an episode. All of those are mistakes that produce no error at runtime — they
just quietly render the wrong thing.

Then actually open the app and click through the course. Screenshot it.

## 7 · Audio, if wanted

```bash
node pipeline/make-script.mjs hist > audio/scripts/hist1620.json
# rewrite the TODO lines, the openings and the unit transitions by hand
python3 audio/synth.py audio/scripts/hist1620.json app/public/audio
```

The generated draft is correct and a little mechanical. The openings, the
transitions and the closing are what make it listenable — rewrite those.

Then paste the emitted `*.chapters.json` into the course's `podcast.editions`.
**Chapter marks come out of the render**, measured from the real audio, so every
seek lands on the first word of its section. Never estimate them.

For a recording that already exists and shipped without chapters:

```bash
python3 pipeline/chapters.py app/public/audio/whatever.mp3
```

If it finds nothing, that recording has no pauses to lock to. Label its chapters
approximate in the data rather than inventing marks — the ECON full read is in
exactly that state and says so.

## 8 · Lessons, decks and handouts

Once the guide is right, everything else is generated from it:

```bash
python3 pipeline/lessons.py hist --dry-run   # sizes the render first
python3 pipeline/lessons.py hist             # a narrated lesson per unit
python3 pipeline/slides.py hist              # public/decks/hist.pptx
python3 pipeline/handout.py hist             # public/handouts/hist.docx and .pdf
```

`lessons.py` writes `courses/hist/lessons.ts`; add `import lessons from
'./lessons'` and `lessons,` to the module and Watch mode has them. Roughly a
minute of audio per ten cards, and about a megabyte a minute.

Re-run all three after changing a guide. The validator warns when a course has
no deck or handout, because the app links to them unconditionally.

## Updating a course already in the app

Same pipeline, no scaffold. Extract the new document, then extend the existing
module: add items, add or extend units, add figures. Re-run the validator —
adding a unit is precisely what shifts the figure keys — then re-run
`lessons.py`, `slides.py` and `handout.py` so the generated formats catch up.

If the new material is a whole new reading with its own argument, it usually
wants its own unit and its own entry in `cases`.

**Note the two routes, and which one the user wants.** In the app itself,
**Guide → New reading or handout** merges added material into every study mode
immediately, with no code change and no re-render — that is the right route for
a student adding a handout mid-semester, and it is what `lib/live.ts` exists
for. Editing the module is the right route when the material is permanent, or
when it should be narrated: the lesson audio only picks it up on a re-render.
Do not do both for the same material or it appears twice.

## House style

- Prose in the data is user-facing. Write it the way the rest of the app is
  written: specific, unhedged, no filler.
- Never invent a quote, a number or a date. If the syllabus does not say, leave
  it out or mark it inferred.
- Everything visual reads a token. No hex values in a course module.
- Keep `mastery` values honest — they drive the "weakest unit" shortcut, so
  wrong values send the user to the wrong place.
