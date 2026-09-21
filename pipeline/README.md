# Pipeline

Tools for turning a syllabus and its readings into a course the app can use —
and for keeping a course honest once it is in.

The first four courses were built by hand. Everything that turned out to be
mechanical about that, or turned out to be a mistake worth catching, is here.

```
ingest.py        any document → clean text
new-course.mjs   scaffold a course folder and register it
validate.mjs     the checks that catch silent breakage
guide_reader.py  read a guide out of its TypeScript source
make-script.mjs  guide → podcast script draft
lessons.py       guide → a narrated lesson per unit, with slide cues
slides.py        guide → a PowerPoint deck
handout.py       guide → a Word document and a PDF
chapters.py      recover chapter marks from an existing recording
align-audio.mjs  recover where every line starts, from the episode itself
align.mjs        the arithmetic that does it, pure
shorts.py        lessons → one vertical short per flashcard
documentary.py   podcast episode → a documentary cut of it
explainer.py     lessons → one YouTube-length video of a course
explainer.mjs    which units fit, where they land, and what the hook promises
restyle-script.mjs  script → the same script in a hosting style (calls a model)
styles.mjs       the hosting styles, as structural parameters
persona-sheet.mjs   persona → its character reference sheet
personas.mjs     the animated series' characters, as structural parameters
broll-shots.mjs  chapter marks → a shot list, checked and priced
broll.mjs        what a shot may ask for, and the spend ceiling
likeness.mjs     the one rule both of those share
```

Everything after `guide_reader.py` reads the same guide through it, so a deck, a
handout and a lesson cannot disagree with the app or with each other.

`audio/synth.py` renders a script to an MP3 with exact chapter marks and exact
line times. See [`../audio/README.md`](../audio/README.md).

## Line times, for captions

`synth.py` has always known the second every line begins at — it concatenates
an episode piece by piece and keeps a running position — and until now wrote
down only the dozen-odd values where a chapter opened. It writes all of them
now, to `audio/scripts/<stem>.lines.json`.

The four episodes that shipped before it did have to be recovered:

```bash
node pipeline/align-audio.mjs econ
node pipeline/align-audio.mjs --all --dry-run
```

This is not a forced aligner in the usual sense — nothing listens to speech or
matches phonemes, and there is no model to download. It does not need one. The
silences between lines were not performed, they were *inserted*, at three
lengths `synth.py` declares and in an order the script fixes, so finding them
is arithmetic. `chapters.py` makes the same move for chapter marks.

Measured across all four episodes, every one of the 55 chapter marks
`synth.py` recorded lands inside the second the recovery puts it in — which is
the whole resolution those marks have, since they were stored as
`int(position)`. The control that makes that mean something: given the first
and last mark of each episode and asked to interpolate the rest by word count,
the cheap method misses all 47 interior marks, by up to 21 seconds.

It refuses rather than guesses. If the quiet runs cannot be made to fit the
script, or any chapter mark is missed, nothing is written and it says why.

Where these formats go next — movie-format lessons, one short per flashcard,
several podcast hosting styles from one draft, and what each of those actually
costs — is in [`../docs/VIDEO_PODCAST_ROADMAP.md`](../docs/VIDEO_PODCAST_ROADMAP.md).

## The YouTube-length explainer

```bash
python3 pipeline/explainer.py econ --dry-run    # the plan and the chapters
python3 pipeline/explainer.py econ              # 8–15 minutes of it
python3 pipeline/explainer.py econ --from 0 --to 5
```

A run of a course's units played in order, with a hook over the opening and a
chapter mark on every unit boundary. Nothing is synthesised: the audio is the
unit MP3s the app already serves, sequenced, and the cue list is those units'
own cues offset onto one timeline — the same move the shorts make.

**It is always a truncation.** Measured from unit 0, counting the beat between
units:

| course | units | length | left out |
| --- | --- | --- | --- |
| econ | 10 of 11 | 13:48 | 1 |
| bus | 9 of 13 | 13:37 | 4 |
| psci | 7 of 14 | 13:06 | 7 |
| core | 5 of 6 | 12:35 | 1 |

Not one fits whole. ECON is closest — eleven units is 15:00 of narration
exactly, and the ten beats between them put it eight seconds over the ceiling.

**The hook ends on a cue, not on the number.** The roadmap asks for one in the
first fifteen seconds; this takes the last cue at or before 15s, so the cut to
the first slide lands where a sentence starts. For ECON that is 8.92s: the
title and the first question are the hook, and the cut happens as the answer
begins. What it promises is drawn from the units *after* the first, because the
narration underneath is already asking and answering something and listing that
question would be reading the viewer their own subtitles.

A `chapters.txt` lands beside the MP4, first mark at `0:00`, ready to paste
into a description box.

## B-roll for a documentary cut

```bash
node pipeline/broll-shots.mjs econ --draft      # one blank shot per chapter
node pipeline/broll-shots.mjs econ             # check what was written
node pipeline/broll-shots.mjs econ --price 10 --max-spend 8.40
```

A shot list lives at `video/shots/<course>.json` and is **edited by hand**.
`--draft` writes one shot per chapter, landing on the second that chapter's
mark does, with the subject blank — and nothing prices or buys a list with
blanks in it.

That is not ceremony. `render-documentary.mjs` used to build its clip jobs
with `prompt: c.name`, so the fourteen clips it costed for ECON would have
been generated from "Cold open", "Optimisation and opportunity cost" and "The
formula sheet". A chapter title names a passage of argument; a shot is
something a camera can point at; and the estimate for fourteen unusable clips
looks exactly like the estimate for fourteen good ones. Same arrangement as
`make-script.mjs`: the tool writes the structure, a person writes the words.

What a subject may not be, and why:

- **the chapter's own title** — it is right there in the file, it is the wrong
  thing, and pasting it across is the likeliest way this ends up producing what
  it was written to prevent;
- **text, signage, charts, whiteboards, equations** — a video model renders
  those as convincing nonsense, and this frame already carries the real chapter
  card and the real captions, typeset from the script;
- **anything pointing at a person** — `likeness.mjs`, the same rule
  `personas.mjs` enforces on an appearance note.

Three guardrails on the money, stopping three different things. The manifest
stops a second run paying for the first run's clips. `--price` has to be
supplied because a rate committed here would be quoted in a `--dry-run` next
year as though it were measured. And `--max-spend` stops a run that is
correctly priced, correctly deduplicated and far larger than anybody meant —
which is what a hand-edited shot list makes possible for the first time.

Generating is still not wired to a provider.

## The animated series' characters

```bash
node pipeline/persona-sheet.mjs --all --dry-run       # the prompt, first
node pipeline/persona-sheet.mjs host-nell --layout    # the sheet's layout, $0
node pipeline/persona-sheet.mjs host-nell --image <provider>   # not wired
```

A character reference sheet is nine panels of one character, generated once
and then used as the reference every later clip of a course has to match. It
is the artefact of step 4 that cannot be walked back: settle a persona
carelessly and it is a face on four courses.

`personas.mjs` is why the appearance is not a paragraph. §7 of the roadmap
commits to no real person's name, voice or likeness in a persona preset or a
character sheet, and a commitment a file merely states is one a `--style "like
<somebody>"` walks straight through. So appearance is a choice from enumerated
axes — build, age, hair, wardrobe, what they carry, manner — and a likeness is
not refused so much as unrepresentable. The one free-text field is a note about
lighting and posture, and it is checked: it may not use a construction that
points at somebody, and it may not carry a capital letter anywhere but the
first. `app/src/lib/personas.test.ts` says what that catches and what it does
not.

`--layout` draws the nine panels at the arrangement and proportion the prompt
asks for, labelled, in the persona's own accent — for nothing, before a
provider is involved. It is the storyboard for an image nobody has bought, and
afterwards it is what you hold the bought one against.

`--image <provider>` is not wired to anything and exits non-zero saying so. No
per-image price is written into this repository: those move faster than the
code, and a stale one quoted in a `--dry-run` reads like a measurement.

## Adding a course

```bash
# 1 · read the sources
python3 pipeline/ingest.py syllabus.pdf -o /tmp/syllabus.txt
python3 pipeline/ingest.py field-guide.html -o /tmp/guide.txt

# 2 · scaffold and register
node pipeline/new-course.mjs --id hist --code "HIST 1620" \
  --name "The Cold War" --prof "Dr. A. Reed" --days MW --at 10:10

# 3 · fill in the TODOs from the extracted text

# 4 · check
node pipeline/validate.mjs
cd app && npx tsc -b --noEmit && npm run dev
```

Step 3 is the work. Steps 1, 2 and 4 are one command each.

The procedure in full — what makes a good study card, where figures attach, how
to word a syllabus quote — is in the `add-course` skill
(`.claude/skills/add-course/SKILL.md`), so a Claude session can run the whole
thing from a dropped-in PDF.

## Why the validator exists

Every check corresponds to a mistake that produces **no error at runtime** — the
app just renders the wrong thing:

| Check | What goes wrong without it |
| --- | --- |
| Figure keys within the unit count | Figures are keyed by unit index. Insert a unit at the top of a guide and every figure silently re-attaches to the wrong one. This happened. |
| Duplicate item ids | One of the two becomes unreachable. |
| Months 0-based and in range | A September deadline quietly lands in October. |
| Audio files exist on disk | A player that loads nothing, with no error shown. |
| Chapter marks inside the episode | Seeks that go nowhere. |
| Course registered in the catalog | A course folder the app never sees. |
| `c:` matches the folder | Items filed against the wrong course. |

Run it after any data change:

```bash
node pipeline/validate.mjs
```

It prints a per-course summary and exits non-zero on a real problem.

## ingest.py

PDF, HTML, Markdown or plain text in; readable text out.

```bash
python3 pipeline/ingest.py guide.html -o /tmp/guide.txt
python3 pipeline/ingest.py sources/*.pdf -d /tmp/extracted/
```

HTML keeps structural markers (`#`, `-`, `|`) so headings and tables survive,
which is what makes a published field guide readable enough to port from. PDFs
need `pypdf` or `poppler-utils`:

```bash
pip install pypdf
```

## chapters.py

Recovers chapter marks from a recording that shipped without any, by finding the
pauses a narrator leaves between sections.

```bash
python3 pipeline/chapters.py app/public/audio/core-full.mp3
python3 pipeline/chapters.py lecture.mp3 --names sections.txt --json
```

The method was checked against a recording whose real timestamps were published:
run over the PSCI condensed edition it reproduced all twenty marks to within a
second. That is why the CORE marks in the app are trustworthy despite that
episode never shipping a list.

If it finds nothing, the recording has no pauses long enough. Say so in the data
rather than inventing marks — the ECON full read is in exactly that state and is
labelled approximate.

## lessons.py

A narrated lesson for every unit: the tutor names the unit, poses each question,
leaves two seconds, answers it, and closes.

```bash
python3 pipeline/lessons.py econ --dry-run     # what it would render, and how long
python3 pipeline/lessons.py econ               # all units
python3 pipeline/lessons.py econ --unit 3      # just one, keeping the rest
```

It writes `app/public/audio/lessons/<course>/unit-<n>.mp3`, a `lessons.json`
beside it, and `app/src/data/courses/<course>/lessons.ts` for the module to
import — one line in `index.ts` and the Watch mode has them.

The cues are the point. Each line records the second its beat begins, measured
from the render, so the app draws the slide in step with the voice instead of
playing a video of type. Forty-four lessons come to 46 MB; the same content as
video would be ten times that and blurrier.

`--mp4` also writes a video file per unit, for handing to someone who wants a
file rather than an app.

## slides.py and handout.py

The same guide as a deck and as a document.

```bash
python3 pipeline/slides.py --all      # app/public/decks/<course>.pptx
python3 pipeline/handout.py --all     # app/public/handouts/<course>.docx and .pdf
```

The deck puts every question on its own slide, with the answer on the next — a
deck that shows both at once is a document, and there is a document for that.
The .docx opens in Word, in Pages, and in Google Docs; the PDF is for reading
and printing. Both are linked from the guide's Doc mode, and the validator warns
when a course has no files for those links to point at.

Print styling in the app covers the third case: a machine with no pipeline can
still turn the guide into a PDF through the browser.

## make-script.mjs

Drafts a two-voice podcast script from a course's guide.

```bash
node pipeline/make-script.mjs econ > audio/scripts/econ.draft.json
```

It walks the units, turns each card into a question the host asks and an answer
the expert gives, pulls the guide's self-test in with pauses to answer, and
spells out the symbols a synthesiser reads badly. Roughly a minute of speech per
seven cards.

The draft is correct and a little mechanical. The openings, the transitions
between units and the closing are where the listenability is — rewrite those by
hand before rendering, the way the four shipped scripts are written.
