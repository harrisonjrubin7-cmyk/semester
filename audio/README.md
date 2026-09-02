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

Each run writes the MP3 into `app/public/audio` and a `*.chapters.json` beside
the script. **Chapter marks come out of the render**, measured from the actual
audio positions rather than estimated, so every seek lands on the first word of
its section. Paste them into `app/src/data/podcast.ts`.

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
