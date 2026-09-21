# Video and Podcast Generation — Roadmap

How to take the video and podcast generation Semester already has and grow it
into movie-format lessons, an animated series, YouTube- and TikTok-native cuts,
documentary-style units, and podcast episodes in several distinct hosting
styles — without breaking the cost model that makes the app work.

Companion to [`../pipeline/README.md`](../pipeline/README.md) and
[`../audio/README.md`](../audio/README.md), which describe what exists today.
This covers the *generation* side only: the in-app editor on the
[PRODUCTIVITY_REQUIREMENTS](PRODUCTIVITY_REQUIREMENTS.md) wishlist ("Semester
Video", §8 — record, trim, caption, submit) is a separate and much larger
project, and nothing below builds toward it.

Everything in §1 was read out of the code rather than remembered, because the
whole argument for what to build next rests on what the existing thing
actually costs.

## 1. What "video" and "podcast" are today

Worth stating plainly, because it changes what is cheap versus expensive to
build next.

**"Video" today is not AI-generated video.** `pipeline/lessons.py` renders
narration through Piper — a free, offline, open-source neural TTS — in a single
voice (`en-us-ryan-high`, the "tutor"), and records the second each beat
starts into a cue list. The app draws the matching slide live, in step with the
audio, rather than baking frames into a file. `--mp4` does write a real video
file per unit, but look at what it is: ffmpeg's `lavfi` colour source at
`0x0a0b0e`, 1280×720, for exactly the duration of the audio, with the audio
laid over it. A flat dark rectangle and a voice. Its own comment says so — "a
minimal video for offline use: the app renders the real thing." The product is
the synced audio+cue pair, and it costs **kilobytes and $0**, not
render-minutes and dollars.

**"Podcast" today is a two-voice script.** `make-script.mjs` drafts it
mechanically from a course guide; a human rewrites the opening, the transitions
and the close; `audio/synth.py` renders it with two Piper voices — each script
carries its own `voices` map, and all four ship the same pairing:
`en-us-lessac-medium` as a quicker, brighter **host** and `en-us-ryan-high` as
a slower, more deliberate **expert**. Four courses ship this way today, 26–35
minutes each, and the script doubles as the transcript for accessibility.

**Chapter marks come from two different places,** which matters for the YouTube
format below. `audio/synth.py` *emits* marks for scripts it renders, because it
knows where each line starts. `pipeline/chapters.py` *recovers* marks from a
recording that shipped without any, by measuring the narrator's pauses in the
waveform. New generated formats get theirs for free from the cue data, the same
way `synth.py` does — `chapters.py` is the rescue path for old recordings, not
a step in a new pipeline.

**Everything is rendered once per course, not once per student.** `unit-3.mp3`
for ECON is the same file every ECON student streams; the 44 lesson MP3s under
`app/public/audio/lessons/` total 46MB for all four courses. This is the single
most important fact for what follows. A $6 AI-generated clip is not a
$6-per-student cost, it is a one-time production cost amortised across every
student in that course, exactly the way the existing lesson audio already is.
That is what makes real AI video affordable *here* even though it would break
the per-user economics if it ran per-request. Course content generation is a
different, much smaller bucket than metered per-user AI: pay once per unit per
course, not per student per month.

## 2. The shape of the answer

Two things are better than they sound at first, given the economics above.

1. **Most of the "movie feel" does not need AI video generation at all.**
   Motion graphics — animated text, diagrams, charts, a moving camera over a
   slide — rendered locally with a code-driven video tool cost the same $0 the
   audio already costs. Reserve paid AI video generation for the small fraction
   of shots that need a *rendered scene*: an establishing shot, a recurring
   animated host, a documentary B-roll cutaway.
2. **One script-generation layer, many outputs.** The leverage is upstream of
   rendering. Turn a course guide into a style-tagged script once, and every
   format below is a different render of the same material rather than six
   separate content pipelines.

## 3. Visual formats

| Format | What it is | How to build it | Cost driver |
| --- | --- | --- | --- |
| **Movie-format lesson** (upgrade of today's lesson) | The existing narrated-lesson audio, but the flat `0x0a0b0e` rectangle becomes real animated typography, diagrams and highlight boxes moving with the cues already recorded | **Remotion** (React + ffmpeg, runs in the existing Node toolchain, renders locally) driven by the same cue list `pipeline/lessons.py` already writes | Compute only — but see the licence note in §7 |
| **Animated series** | A recurring host character, or two, appearing across every unit of a course — the visual equivalent of the two-voice podcast | Generate one **character reference sheet** (image model, ~$0.01–0.04/image) once per persona; feed it as the reference image to an **image-to-video** model with strong character consistency for short 5–10s reaction and gesture clips; composite those into the Remotion timeline instead of drawing a static avatar | ~$0.10–1.50 per short clip × a handful of clips per unit, reused across the whole course |
| **YouTube-length explainer** | 8–15 min, hook in the first 15s, chapter marks | Remotion for the graphics track, same as movie-format, plus 2–4 short AI-video B-roll inserts for the cold open and section transitions. Marks come from the cue list, the way `synth.py` does it — not from `chapters.py` | Same as above; B-roll is optional polish, not the backbone |
| **TikTok / Shorts** ✅ built | Vertical 9:16, one card per short, hook-first, burned-in captions. Measured at 8.4–35.5s, median 14.8s — the 15–45s guessed here was half wrong | **One short per flashcard**, cut from the cue list rather than from `guide.ts`: a cue already has the in and out points inside the unit's MP3, so Remotion trims the existing audio and nothing is re-synthesised | $0 — no new audio, no new file, just frames |
| **Documentary-style unit recap** ◐ partly built | Slower pacing, the two-voice episode with its own chapter marks drawn over it | Podcast audio as the spine, plus Remotion lower-thirds and per-line captions — `pipeline/align-audio.mjs` recovers the line times the four shipped episodes never recorded, and `audio/synth.py` writes them exactly from now on. Establishing shots would sit in the middle of the frame; no provider is wired | $0 as built; AI video would be the only paid part |

Model choice for the paid steps (Veo, Kling, Sora, Seedance and the rest) moves
faster than this document will, so the table names the *capability* each step
needs — image-to-video with character consistency, text-to-video without —
rather than a vendor. Price the two or three current options at the point you
build it.

**Concrete commands,** extending the existing pipeline naming convention rather
than introducing a new one:

```bash
# Movie-format: same source as today's lesson, richer visual layer
python3 pipeline/lessons.py econ --unit 3 --remotion   # a real composition
                                                       # driven by the cue list,
                                                       # where --mp4 renders a
                                                       # flat colour field

# Animated-series character sheet (once per persona, reused everywhere)
node pipeline/persona-sheet.mjs --all --dry-run        # the prompt, first
node pipeline/persona-sheet.mjs host-nell --layout     # the sheet's layout, $0

# Shorts: one clip per flashcard instead of one per unit
python3 pipeline/shorts.py econ --unit 3          # every card in unit 3 gets
                                                  # its own vertical short
python3 pipeline/shorts.py econ --all --dry-run   # the full short list and the
                                                  # estimated cost, first

# Documentary cut, reusing the two-voice podcast audio as the spine
python3 pipeline/documentary.py econ --unit 5 --broll none
```

`--dry-run` matters more here than it did for audio. `lessons.py --dry-run`
already prints each unit's beat count and estimated minutes without
synthesising anything; the video scripts need the same discipline with real
money behind it, printing the shot list and what it would cost before spending.

## 4. Podcast formats — several hosting styles from one script

Six podcast formats were named as tone references — long-form curious
interview, storyteller-comedian, pushback debate, high-energy reaction,
reflective first-person narrative, and casual direct-to-camera. Worth being
upfront before building: cloning a real, identifiable person's voice or
likeness without their consent is a legal and platform-policy problem — right
of publicity, several states' statutes, and every major voice-AI provider's
terms of use — and not something to build into a product students pay for.

The workable version is also the more useful one: lift the **structural
format** each of those shows runs on and build original hosts around it. Nobody
needs to sound like a particular podcaster. They need the *pacing* of a long
curious tangent that circles back to the point.

| Archetype | What actually makes the format work | Best use in Semester |
| --- | --- | --- |
| **Long-form curious duo** | Host asks broad, deliberately naive questions; expert free-associates and tangents, then circles back; minimal interruption; 45–90 min | The full-course "whole semester, out loud" episode already shipping — BUS 1600 is this today |
| **Storyteller-comedian** | Homespun analogy and personal anecdote carry the dry material; informal register, laughs built in | Making a dense unit — accounting, stats — relatable, analogy first |
| **Pushback debate duo** | Host plays devil's advocate and challenges the expert's claims rather than receiving them; productive friction | Concept clarification. The pushback forces the expert to defend and re-explain, which is active recall with better pacing |
| **High-energy reaction duo** | Big reactions to surprising facts, fast pace, hype framing | Exam-cram highlight reels — "ten facts that will be on your test" — where reaction energy is what makes them stick |
| **Reflective narrative** | First-person, vulnerable, "here is why this actually matters" framing wrapped around the material | Opening of a course or of a unit: the why-this-matters episode |
| **Casual direct-to-camera** | Intimacy, stream-of-consciousness asides, very short attention span, native to vertical short-form | The shorts audio track specifically — one card explained as an aside |

**Build this as one system, not six.** Extend `make-script.mjs` with a
`--style` flag backed by a small preset file that encodes each archetype as
*structural* parameters an LLM rewrite pass can follow: turn frequency,
tangent-then-return frequency, interruption rate, sentence length, aside
frequency, energy markers for TTS prosody. Structure, never a real person's
name, catchphrases or voice.

```bash
# One mechanical draft, several stylistic rewrites
node pipeline/make-script.mjs econ > audio/scripts/econ.draft.json
node pipeline/restyle-script.mjs audio/scripts/econ.draft.json --style curious-duo
node pipeline/restyle-script.mjs audio/scripts/econ.draft.json --style storyteller
node pipeline/restyle-script.mjs audio/scripts/econ.draft.json --all-styles

# Then render each exactly as today
python3 audio/synth.py audio/scripts/econ.curious-duo.json app/public/audio
```

`restyle-script.mjs` is the one new piece of real work, and it is now built —
see §6.3 for what in it is proven and what is not. Today's mechanical
draft says outright that the openings, the transitions between units and the
closing are where the listenability lives and that they want rewriting by hand.
That rewrite is exactly what an LLM pass is good at, and the shared key already
exists — `supabase/functions/claude/index.ts` proxies Anthropic with a
server-side `ANTHROPIC_API_KEY`. Note that this would be an **authoring-time**
call made by whoever runs the pipeline, not a per-student one, so it does not
touch the per-user AI budget at all. If the restyle script calls the Edge
Function rather than the API directly, it should be understood as an operator
tool borrowing that key, not as a student-facing path.

**Voices per style.** Piper stays the default — free, offline, and already
proven across 44 lessons and four podcast editions in 46MB. But two of the
archetypes above (high-energy reaction, direct-to-camera) lean on prosody and
emotional range Piper's neural voices do not really do. For those alone it is
worth budgeting a small number of expressive-voice renders per course from a
paid TTS tier; pricing there is volume-based and moves often enough to be worth
checking at build time rather than quoting here. Once per course, not per
student, so even a real per-minute rate stays small in aggregate.

## 5. Prototyping before touching the pipeline

The motion-graphics layer is worth looking at before it is worth building.
HeyGen's HyperFrames composes programmable HTML/GSAP video that renders to
MP4/WebM/MOV, which is the same shape as the Remotion work above.

One caveat found while writing this: from a CLI agent — Claude Code included —
the hosted HyperFrames `compose` and `render_video` tools are **disabled** by
design, on the reasoning that a client with a local filesystem should author
compositions as files it can edit, diff and commit. That is the better fit here
anyway. The local skills (`npx skills add heygen-com/hyperframes`) produce
standalone HTML compositions on disk, which is what this repository would want
to keep. The hosted MCP path is for chat clients with no filesystem, and is
still the right call if what is wanted is a shareable HeyGen project rather
than a file.

Either way, compose one lesson and one short from an existing unit's script
first. That gives something to look at and react to in an afternoon, against a
multi-day pipeline build. `lessons.py --remotion` is the productionise-it step
once the format is right.

## 6. Rollout order

1. **Remotion for the movie-format upgrade.** ✅ **Built** — `video/`, driven by
   `python3 pipeline/lessons.py <course> --remotion`. See
   [`../video/README.md`](../video/README.md). Two things learned in the doing,
   both recorded below: the licence is not unconditionally free, and the
   composition shares `cueIndexAt` and `tokensFor` with the app rather than
   restating either.
2. **`shorts.py`.** ✅ **Built** — `python3 pipeline/shorts.py <course> --all`.
   It was the cheapest format to stand up, and cheaper than this said: it needs
   no new audio at all. A cue already marks where each card's narration starts,
   so a short is a *trim* of the unit's MP3 rather than a new render of it.
   **278 shorts across the four courses**, 8.4–35.5s, median 14.8s.
3. **`restyle-script.mjs` with two or three styles.** ✅ **Built, with one
   thing unproven.** Three presets — curious-duo, storyteller, pushback-debate
   — in `pipeline/styles.mjs`, and `pipeline/restyle.mjs` checks the model's
   answer before anything is written. **The live model call has not been run**:
   it was built in a container with no API key, so everything around the call
   is exercised and the call itself is not. Whoever runs it first is running it
   first — start with `--dry-run`, then one style on one course, and read the
   result before rendering audio from it. ~$0.24 a style for a whole ECON
   episode.
4. **Animated-series character** and **documentary B-roll**. ◐ **Part built.**
   - **Documentary, `--broll none`:** ✅ built —
     `python3 pipeline/documentary.py econ`. The podcast spine with its own
     chapter marks over it, $0, no provider involved.
   - **Captions:** ✅ built — `pipeline/align-audio.mjs` recovers where every
     line of the four shipped episodes starts, and `audio/synth.py` records it
     exactly for everything rendered since. §7 has what it cost in precision
     and what the cheap alternative would have cost. Per line, not per word.
   - **The spending guardrail:** ✅ built —`video/src/clipspend.ts` and its guard.
     Deliberately built *before* any provider, so the first paid run cannot
     happen without the manifest that stops the second run paying again.
   - **B-roll generation:** ✗ not wired. `--broll <provider>` prints what it
     would ask for and exits non-zero. No provider is chosen and no per-second
     price is written down, because both are spending decisions.
   - **Animated-series character:** ◐ built up to the provider.
     `pipeline/personas.mjs` holds the two personas — one host, one expert,
     the podcast's own two roles — and `persona-sheet.mjs` builds the sheet
     prompt, checks the persona, prices the run through the same manifest the
     B-roll would use, and draws the sheet's *layout* through Remotion for
     nothing. `--image <provider>` is not wired and exits non-zero, for the
     same reason `--broll` does.

   The order above still stands: these are the only steps that cost money per
   clip, so the two unbuilt parts are worth doing once the pilot numbers say
   which courses have the students to justify a one-time production cost.

## 7. Guardrails worth keeping from day one

- **Every new generator gets a `--dry-run`** that prints the shot or clip list
  and an estimated cost before spending anything — the discipline `lessons.py`
  already has, now with real money on the line.
- **A manifest, the same pattern as `audio/manifest.json`.** That file already
  hashes each rendered artefact into a `key` alongside its recipe hash, so a
  re-render only touches what changed; `app/scripts/audiocache.ts` is the app
  side of the same idea. AI video is exactly the cost not to re-spend on an
  unchanged unit.
- **The restyle pass is an operator tool, not a student path.** It reads
  `ANTHROPIC_API_KEY` and calls the API directly rather than going through
  `supabase/functions/claude`. That Edge Function exists to give a signed-in
  student a metered share of a server-side key; whoever runs this pipeline is
  not a student, runs it once per course rather than per request, and should
  be spending their own budget. Routing authoring traffic through the student
  path would put it on a student's quota and turn the Edge Function's rate
  limits into something to work around. This roadmap suggested borrowing that
  key — it is the wrong key to borrow.
- **A restyle may change how an episode sounds and nothing else, and that is
  checked rather than asked for.** The prompt says it at length; `restyle.mjs`
  makes it true. A rewrite that invents a figure produces a script that sounds
  exactly as confident as the four that shipped, and a student revising from
  it has no way to tell. Figures are *counted*, not merely looked for: "eighty"
  is said four times in the ECON episode, so a check that only asked whether
  the number still appeared somewhere would have let three of the four be
  softened away.
- **The documentary is captioned, and the line times under it are measured.**
  This entry used to say captions were impossible on today's data: nothing
  recorded where a line of a *podcast* started, only chapter marks a couple of
  minutes apart, and spreading a chapter's lines across its duration drifted
  far enough to read as a broken player. Both halves of that turned out to be
  answerable without the machine learning "forced aligner" implies.

  Going forward there is nothing to infer. `audio/synth.py` already knew the
  second every line began at — it concatenates an episode piece by piece and
  keeps a running position — and threw the number away for every line that did
  not open a chapter. It writes all of them now.

  For the four episodes that shipped before it did, `pipeline/align-audio.mjs`
  recovers them from the audio. The silences between lines were not performed,
  they were *inserted*, at three lengths `synth.py` declares and in an order
  the script fixes, so finding them is arithmetic rather than acoustics — the
  move `pipeline/chapters.py` already makes for chapter marks. Every one of
  the 55 chapter marks across the four episodes lands inside the second it was
  recorded in, which is all the resolution those marks have. The control that
  makes that mean something: given the first and last mark of an episode and
  asked to fill in the rest by word count, the cheap method misses all 47
  interior marks, by up to 21 seconds — which is what this entry originally
  predicted, now measured.

  It refuses rather than guesses. A quiet-run arrangement that will not fit the
  script, or a single chapter mark missed, and nothing is written.
- **Nothing is bought twice.** `video/src/clipspend.ts` hashes what decides a clip
  — prompt, length, provider, model, and nothing else — so a re-run of an
  unchanged course spends nothing and an edited chapter re-buys only itself.
  Built before any provider was wired, which is the order that matters: a
  spending guardrail added after the first duplicated bill is a lesson, not a
  guardrail.
- **Captions are per beat, not per word.** This document said the shorts'
  captions "come free from the beat timings the TTS pass already records" and,
  elsewhere, from "exact word timing" — the second is wrong about the data. A
  cue is `{at, kind, text}`: the second a *line* begins, not a syllable. Words
  on screen therefore change with the line being spoken, which is enough to
  caption a short honestly and is not enough to bounce along with the voice.
  Per-word timing is still not available and the aligner does not change that:
  what it recovers is where a *line* starts, to a fraction of a second, which
  is the same resolution a cue already has. Captions stay per beat in the
  shorts and per line in the documentary. Splitting a line into phrases would
  mean apportioning its seconds by character count, which is the technique the
  entry above exists to avoid — only wrong by a second rather than by twenty.
- **Scripts stay the transcript,** as today. `npm run transcripts` regenerates
  `app/src/data/transcripts/<course>.ts` from the scripts, and Listen mode
  shows it under the chapter marks. Whatever style or format renders the words,
  what a deaf or hard-of-hearing student reads has to match what is spoken, and
  a short's burned-in captions should come from the same cue data rather than a
  separate manual pass.
- **Remotion is free up to three people, not unconditionally.** The rollout
  above called this step `$0`, and for a solo project it is: Remotion's free
  licence covers individuals and for-profit companies of up to three employees.
  A company of four needs a paid Company License, and the tier aimed at
  "companies launching automated video creation applications" carries a monthly
  minimum — which is a fair description of `pipeline/lessons.py --remotion` once
  it runs for every unit of every course. Nothing to do today; worth knowing
  before it is load-bearing, and worth re-checking rather than trusting this
  paragraph, since the terms move. <https://www.remotion.pro/license>
- **No real person's name, voice or likeness** in any persona preset or
  character sheet. The archetypes in §4 are described by structure, not by who
  they resemble, and that is also the version that survives a platform-policy
  or legal review later without a rewrite.

  Now enforced rather than promised, because a rule a document states is one a
  `--style "like <somebody>"` walks straight through — and the command line in
  §3 originally *had* a free-text `--style` flag, which is where this would
  have gone in. `pipeline/personas.mjs` makes appearance a choice from
  enumerated axes instead, so a likeness is unrepresentable rather than
  refused. The one free-text field is a note about lighting and posture, and
  it gets the two rules enforceable on free text: no construction that points
  at somebody ("like", "in the style of", "-esque"), and no capital letter
  anywhere but the first, since a name is capitalised and "leaning slightly
  in, mid-question" has no reason to be. What that misses — a description with
  neither, "the presenter from that programme about the bus" — is written down
  in the module rather than implied away, and what limits it is that a note
  can only modulate a character the axes have already fixed.

  It is also why `--layout` exists. The sheet is the one artefact nobody can
  un-make, so the mode that costs nothing draws the nine panels and the
  sentence that will be generated from them, and somebody looks at it first.

  The command moved from `persona-sheet.py` to `persona-sheet.mjs` for the
  reason `restyle-script.mjs` is not Python: the part worth guarding is pure
  and the suite that guards it is vitest.
