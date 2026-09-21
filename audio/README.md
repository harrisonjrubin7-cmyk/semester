# Audio

Two-voice podcast editions of the four study guides, and the synthesiser that
renders them.

## Why these exist

The recordings you already had are the guides read aloud by a single narrator —
thorough, and long. These are the other thing: a host asking the questions a
student would actually ask, and an expert answering with the numbers. Same
content, easier to follow with your hands full, and each one closes with a
spoken self-test that leaves you a beat to answer out loud.

They do not replace the originals. Both sit in the app's **Listen** mode as
separate editions, switchable per course.

| Script | Episode | Length |
| --- | --- | --- |
| `bus1600.json` | BUS 1600 — The Whole Semester, Out Loud | 30:50 |
| `psci1104.json` | PSCI 1104 — Real Finding or Good Story? | 35:03 |
| `core2500.json` | CORE 2500 — Why We Play | 26:30 |
| `econ1020.json` | ECON 1020 — Thinking at the Margin | 28:17 |

BUS 1600 had no recording at all before this, so that one is new rather than an
alternative.

## These scripts are also the transcripts

A script is the words of the recording, so it is also the text alternative the
recording needs — an audio-only study mode with nothing to read is unusable by
anybody deaf or hard of hearing, and awkward for everybody else, who cannot
search it, skim it or quote it into an essay.

```bash
cd app && npm run transcripts     # --check to fail rather than write
```

That reads every script here and writes `app/src/data/transcripts/<course>.ts`,
which the app's **Listen** mode shows beneath the chapter marks. Generated,
never edited by hand: change a script, re-render the audio, and run this, or
the page goes on showing the words of a recording that no longer exists.
`app/src/lib/transcript.test.ts` compares the two and fails when they part.

## Rendering

```bash
pip install piper-tts imageio-ffmpeg numpy
python3 audio/synth.py audio/scripts/bus1600.json app/public/audio
```

Voices are [Piper](https://github.com/rhasspy/piper) neural models. The script
looks for them in `$PIPER_VOICE_DIR`, defaulting to a scratch path; point it
wherever you keep them:

```bash
export PIPER_VOICE_DIR=~/piper-voices
curl -LO https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-high.tar.gz
curl -LO https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz
tar xzf voice-en-us-ryan-high.tar.gz -C ~/piper-voices
tar xzf voice-en-us-lessac-medium.tar.gz -C ~/piper-voices
```

`lessac-medium` is the host — quicker, brighter. `ryan-high` is the expert —
slower and more deliberate. The contrast is what makes it read as two people
rather than one voice switching topics.

Each run writes the MP3 into `app/public/audio` and two files beside the
script. **Both come out of the render**, measured from the actual audio
positions rather than estimated.

- `*.chapters.json` — the chapter marks, so every seek lands on the first word
  of its section. Paste them into `app/src/data/podcast.ts`.
- `*.lines.json` — the second every line starts and ends at, which is what the
  documentary cut captions from. This is the same running position the chapter
  marks come from; it used to be written down only where a chapter opened and
  discarded for every other line.

The four episodes that shipped before it recorded them had their line times
recovered from the audio instead, by `node pipeline/align-audio.mjs --all`.
Those are good to a fraction of a second rather than exact, and say so:
`source` in the file reads `recovered` rather than `synth`.

## Rendering only what changed

Both commands above speak everything they are pointed at. Measured with these
voices, that is **26.4 minutes** for the four courses and **2 minutes 14
seconds** to re-render econ because one card in it was corrected — of which
12.6 seconds was the unit that changed.

```bash
cd app
npm run audio -- --dry-run     # what is stale, and what skipping it saves
npm run audio                  # render exactly that
npm run audio -- econ          # one course
npm run audio -- --adopt       # take the files already on disk as current
```

The job keys every asset — a unit's lesson, an episode — by a hash of the
material it is spoken from *and* the source of the renderer that speaks it, and
keeps the answers in `audio/manifest.json`, which is committed. An edited unit
re-renders; the ten beside it do not; a changed gap constant in `synth.py`
re-renders everything it could reach, because it changed what every one of them
would sound like.

`--adopt` is how the manifest was first filled: the forty-eight files already
here are correct, and a cache whose first act is to re-render work that was
already right is worse than no cache. An adopted row records what is on disk
and **no render time**, because nobody timed it — the cost column only ever
holds figures this job measured itself.

`app/src/lib/audiobatch.test.ts` holds the decisions and checks them against
the real courses. It does not check that the audio is *current*: that would
mean a synthesiser on the CI runner. Run `--dry-run` before you trust what is
in `public/`.

## Writing a script

```json
{
  "id": "bus-podcast",
  "course": "bus",
  "title": "…",
  "voices": { "host": "en-us-lessac-medium", "expert": "en-us-ryan-high" },
  "lines": [
    { "chapter": "Cold open", "v": "host", "t": "…" },
    { "v": "expert", "t": "…" },
    { "v": "host", "t": "A self-test question.", "pause": 7 }
  ]
}
```

- `chapter` on a line opens a chapter there.
- `pause` adds silence after the line, in seconds — used for the self-tests.
- Turn changes and chapter breaks get their own gaps automatically.

Write for the ear, not the page. Spell numbers and symbols out — "eighty percent",
"minus zero point five six", "A B test", "R squared". A synthesiser reads `%`,
`|E|` and `→` badly or not at all, and a listener cannot see a formula anyway.
Describe every figure in words rather than referring to one.

## Hosting styles

The two-voice format is one way to say this material. `pipeline/styles.mjs`
holds three more as *structural* parameters — how often the host takes a turn,
whether a tangent returns, whether the expert is challenged or received — and
`pipeline/restyle-script.mjs` rewrites a script into one of them with a model.

```bash
cd pipeline && npm install                       # once, for the SDK
node pipeline/restyle-script.mjs audio/scripts/econ1020.json --all-styles --dry-run
node pipeline/restyle-script.mjs audio/scripts/econ1020.json --style storyteller
```

A restyle may change how the episode sounds and nothing else. `restyle.mjs`
checks the model's answer before anything is written and discards a rewrite
that invents a figure, drops one, renames a chapter, or loses a self-test's
answering silence — a script that sounds confident and has the wrong number in
it is worse than no restyle at all. The check counts figures rather than
merely looking for them, because "eighty" is said four times in the ECON
episode and three of those could otherwise be styled away unnoticed.

No preset names, imitates, or references a real presenter or show.

## Where this goes next

The two-voice format is one hosting style out of several the same draft could
be rewritten into, and the same scripts are the spine of a documentary-style
cut. [`../docs/VIDEO_PODCAST_ROADMAP.md`](../docs/VIDEO_PODCAST_ROADMAP.md) has
the plan and the cost model behind it.
