# Semester

An app for one Vanderbilt semester — Fall 2026, four courses, every deadline and
study guide in one place.

```bash
cd app && npm install && npm run dev
```

## Layout

| Path | What it is |
| --- | --- |
| `app/` | The application. Vite + React + TypeScript. See [`app/README.md`](app/README.md). |
| `audio/` | Podcast scripts and the synthesiser that renders them. See [`audio/README.md`](audio/README.md). |
| `project/` | The original Claude Design handoff — HTML prototypes, the Industry design system, the syllabus PDFs. Kept as the reference the app was built from. |
| `chats/` | The design conversation that produced it. |

`project/` and `chats/` are the source material and are not built or imported by
the app. The one thing the app does take from `project/` verbatim is the Industry
stylesheet, copied to `app/src/styles/industry.css`.

## What was built, and from what

The design came over as two prototypes — a canvas (`Semester.dc.html`) showing
seven phones side by side, and the phone itself (`Semester Phone.dc.html`), a
2,300-line single-component app covering twenty screens.

Three things were decided rather than inherited:

- **Both navigation structures ship.** The canvas compared a tab bar against a
  single filtered feed. Rather than pick, both are built and switchable in
  Settings, so the comparison can be settled by using it.
- **The date is live.** The prototype pinned itself to Thursday 3 September.
  Here every relative label, the class rail, the countdown and the exam radar are
  derived from the real clock, with that Thursday's specifics kept as dated
  exceptions so the design still reproduces exactly on the day it was drawn for.
- **The study content is the real guides**, not the prototype's condensed
  summaries — the three published field-guide artifacts plus the ECON study-guide
  PDF, with their full text, glossaries, exam frames and self-tests.

## Audio

Five recordings ship in `app/public/audio`, wired into each guide's Listen mode
with chapter marks that seek:

- The four original narrated readings.
- Four two-voice podcast editions rendered from `audio/scripts` — including
  BUS 1600, which had no recording before.

Chapter marks were measured from the audio rather than estimated wherever the
recording allowed it. Details in [`audio/README.md`](audio/README.md).

## Not yet in

The ECON interactive study guide lives inside a Claude chat rather than as a
published artifact, so it could not be read from here. Its content is already in
the app from `econ1020_study_guide.pdf`, which is the same guide — but if the
interactive version has extras worth pulling in, publishing it (as the other
three field guides were published) makes it readable.
