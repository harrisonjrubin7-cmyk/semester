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

Remotion brings a browser with it. Putting it in `app/package.json` would make
every `npm ci` in CI download a Chrome Headless Shell to run a test suite that
does not render video. So this is its own package, installed only when somebody
is actually making a video, and nothing in `app/` or CI depends on it.

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
