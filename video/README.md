# Video

The movie-format lesson: the slides the app already draws, rendered to a real
video file with the narration under them.

Step 1 of [`../docs/VIDEO_PODCAST_ROADMAP.md`](../docs/VIDEO_PODCAST_ROADMAP.md).

## What this replaces

`pipeline/lessons.py --mp4` has always been able to write an MP4, and what it
wrote was ffmpeg's `lavfi` colour source at `0x0a0b0e`, 1280×720, for the
duration of the audio, with the voice over it. Its own comment says the app
renders the real thing. That flag still exists and still does that — it is a
fifty-kilobyte file for offline use, and sometimes that is what you want.

`--remotion` renders the real thing.

```bash
python3 pipeline/lessons.py econ --unit 3 --remotion
python3 pipeline/lessons.py econ --remotion --dry-run   # the shot list, first
```

Both go through `render.mjs`, which can also be driven directly:

```bash
cd video
npm install                       # once; see "Why a separate package" below
node render.mjs econ --unit 3
node render.mjs econ --ground parchment --accent copper
npm run studio                    # Remotion Studio, to look at the design
```

## Shorts

Step 2: one vertical short per flashcard, at 1080×1920.

```bash
python3 pipeline/shorts.py econ --unit 3
python3 pipeline/shorts.py econ --all --dry-run   # the shot list, first
python3 pipeline/shorts.py econ --unit 3 --card 2 # just the one
```

A short is a question, the beat the narration already leaves after it, and the
answer. It is cut out of the unit's own MP3 by the cue list — `trimBefore` and
`trimAfter` play the seconds that card occupies inside the file every student
streams. **Nothing is synthesised and no audio file is written**, which is why
278 shorts across four courses cost compute and nothing else.

Measured across all four: 8.4s to 35.5s, median 14.8s. The roadmap guessed
15–45s; half of them are shorter than that and none is longer.

The words on screen are the words being spoken, so these are captioned without
a captioning pass — but per *beat*, not per word. A cue records where a line
starts, not a syllable, so nothing here bounces along with the voice.

## Documentary cuts

Step 4's free half: the two-voice episode with its chapter marks drawn over it.

```bash
python3 pipeline/documentary.py econ --seconds 90   # a slice, to look at
python3 pipeline/documentary.py econ                # the whole 28 minutes
```

The spine is the podcast MP3 every student already streams and the picture is
its own chapter marks — the ones `audio/synth.py` measured while rendering it,
not the ones `chapters.py` recovers afterwards. Nothing is synthesised and no audio is cut.

**B-roll, when there is any.** `video/shots/<course>.json` says what each
insert is and when it lands; `pipeline/broll-shots.mjs` drafts, checks and
prices it. This renders whatever ended up in `app/public/video/broll/<course>/`
and looks exactly as it did before when that is nothing, which is every course
today. `--broll none` suppresses inserts that do exist.

An insert is a **full-width strip**, not a window, and that is the shape the
frame has spare rather than a preference — a 16:9 panel in the gap between the
running head and the chapter card is 390 pixels across on a 1920-wide frame.
It is also not full-bleed, and that was a measurement: the chapter kicker is
`--app-accent-deep`, which needs a scrim at 0.95 alpha to clear 4.5:1 over
white footage, and a scrim at 0.95 is a scrim with no footage visible through
it. `src/Documentary.tsx` has the table.

**The captions are per line, and the times under them are measured.** This
used to say there were none, because nothing recorded where a line started.
`pipeline/align-audio.mjs` recovers it from the audio and `audio/synth.py`
now writes it down exactly; `pipeline/README.md` has both. A line is one
speaker's turn, three to nine seconds of it, and that is the resolution the
captions get — `video/src/captions.ts` says why they are not cut finer.

The type is one size for the whole episode, chosen for the longest line it has:
PSCI's is 556 characters, which at the size a two-line caption wants would run
off the bottom of a frame that has no scrollbar. The box around it is a fixed
height for the same reason `fit.ts` exists — the column stacks from the bottom,
so a box that grew would walk the chapter title up the frame every time a long
line followed a short one.

**The chapter card holds rather than fading.** The first cut faded it after
seven seconds, which on a 28-minute episode with a chapter every two minutes
left twenty-six of those minutes as a near-empty dark frame — the thing `--mp4`
already did and step 1 existed to replace.

## Character sheets

Step 4's other half: the recurring characters of the animated series.

```bash
node pipeline/persona-sheet.mjs host-nell --layout
```

`src/Persona.tsx` draws the *layout* of a character reference sheet — nine
panels at the arrangement and proportion the prompt asks for, each labelled
with the view and expression that belongs in it, with a framing guide, in the
persona's own accent. It is not the sheet: the sheet is nine drawings of a
character that does not exist yet and only an image model is going to make
those.

It is 1080×1440 rather than 1920×1080, and that is not a preference. A 3×3
grid of portrait panels is a portrait page; at 16:9 each cell comes out about
550 by 200, and a letterbox is the one shape a head-and-shoulders portrait
cannot be composed in. A sheet is a still and owes nothing to a video's aspect.

## Spending, before anything is bought

`src/clipspend.ts` is the manifest the roadmap's §7 asks for: hash what decides a
clip, and a re-run of an unchanged course buys nothing. It was built *before* a
provider was wired, which is the whole point — the first paid run cannot happen
without it. `app/src/lib/clipspend.test.ts` is its guard, including the case that
matters: generate fourteen chapters, run the command again, spend zero.

Pricing and the spend ceiling moved to `pipeline/broll-shots.mjs`, which is
where the shot list is, because a run's cost is a fact about what it is asking
for. No per-second price is written into this repository: those move faster
than the code, and a stale one quoted in a `--dry-run` reads like a
measurement. Choosing a provider and a price is a spending decision, left to
whoever spends.

## It cannot disagree with the app

Two imports reach across the repo root into `app/src/lib`, and both are load-
bearing:

- **`cueIndexAt`** decides which slide is up at a given second — the same
  function `screens/Lesson.tsx` calls, including the 150ms lead that puts the
  type up just before the sentence starts. It used to be written inline in the
  player where nothing else could reach it. A video that disagreed with the app
  about which answer goes with which question would be worse than no video.
- **`tokensFor`** produces every colour. Thirteen grounds and two faded
  strengths have already been got wrong twice by being measured against the
  wrong surface — `CLAUDE.md` has the story and `lib/contrast.test.ts` walks the
  ramp. A palette retyped here would be a fourteenth ground nobody audited.

The cue list is the interface between the two halves of the pipeline:
`lessons.py` writes it, this reads it. Rendering a video never re-synthesises a
voice, so it is free and safe to re-run on a unit whose narration has not
changed.

## Fitting the words to the frame

A video has no scrollbar. `src/fit.ts` shrinks a slide's type when the words
need it and leaves it alone when they do not — estimated from the text rather
than measured out of the DOM, so two renders of the same lesson are identical.

Its guard is `app/src/lib/slidefit.test.ts`, which runs in the app's suite
rather than here. The module is pure, so vitest reads it across the root for
nothing, and that is where CI already is.

## Why a separate package

Remotion is 153 packages and 445MB installed. Putting it in `app/package.json`
would put all of that in the app's lockfile and in every `npm ci` that runs to
execute a test suite which does not render video. So this is its own package.

CI does now install it — `npm ci --ignore-scripts --omit=optional`, which is
184MB and seven seconds — because `npm run check:video` typechecks these files
and typechecking a package means resolving what it imports. That check exists
because `tsc -b` never opened this directory: six of ten files here, every
composition plus `index.ts`, were typechecked by nothing at all.

This section used to say the split was about a browser — that `npm ci` would
download a Chrome Headless Shell. It does not. Remotion fetches the browser
lazily at render time, which is why `REMOTION_BROWSER` exists and why the
paragraph below is needed at all.

On a machine whose network egress is filtered, Remotion's own browser download
will 403. Point it at one that is already installed:

```bash
REMOTION_BROWSER=/path/to/headless_shell node render.mjs econ --unit 3
```

## The rendered files are not committed

`app/public/audio/lessons/**/*.mp4` is in the root `.gitignore`. The MP3s beside
them are committed — 46MB for all 44 lessons across four courses — but two
1080p units alone come to 20MB. They are derived from the audio and the cues, so
they are re-rendered rather than stored.

## Licensing

Remotion is free for individuals and for-profit companies of up to three people,
and requires a paid Company License beyond that; its "Automators" tier is aimed
squarely at companies running automated video generation, which is what this
directory is. The roadmap calls this step `$0`, and that is true for a solo
project and stops being true at a company of four. Worth knowing before the
pipeline is load-bearing — see <https://www.remotion.pro/license>.
