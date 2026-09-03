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
```

Everything after `guide_reader.py` reads the same guide through it, so a deck, a
handout and a lesson cannot disagree with the app or with each other.

`audio/synth.py` renders a script to an MP3 with exact chapter marks. See
[`../audio/README.md`](../audio/README.md).

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
