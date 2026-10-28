# Recovered caption sources

The four JSON files here preserve timed cues recovered from the shipped legacy
single-narrator MP3s. Those recordings predate the renderer scripts and timing
metadata used by the newer podcast and lesson audio.

Each record names the exact source file and its SHA-256, the measured duration,
the transcription model, and the review state
`machine-generated-unreviewed`. `npm run captions -- --check` refuses a changed
audio hash, an empty cue set, or cues that stop materially before the recording
ends. `webvtt.test.ts` additionally requires an ordered, non-empty, full-length
track for every shipped prerecorded media file.

This is a fail-closed repository inventory. It is not a human caption-accuracy
review, an assistive-technology result, or a WCAG conformance claim. If an MP3
changes, recover its cues again from that exact file, update the hash and
duration, regenerate captions, and preserve the review label until a qualified
person has reviewed the track.
