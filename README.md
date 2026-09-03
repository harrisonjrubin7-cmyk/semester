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
| `pipeline/` | Syllabus → course, and everything generated from a course: lessons, decks, handouts. See [`pipeline/README.md`](pipeline/README.md). |
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

## Six ways through the same material

Each course carries one body of material, and every study mode is a different
route through it — not a different copy. Cards, Read, Watch, Slides, Doc, Quiz,
Cram, Figures, Cases and Listen all read the same guide, so nothing can be
right in one place and stale in another.

| Mode | What it is |
| --- | --- |
| Cards | Tap-to-flip drilling, by unit or whole guide. |
| Read | The guide as prose, unit by unit. |
| Watch | A narrated lesson per unit — 44 of them — with the slide changing as the voice moves. |
| Slides | The same unit as a deck: one point per slide, question before answer. |
| Doc | The guide as a real .docx and .pdf, plus a print view. |
| Listen | The podcast editions, with chapter marks that seek. |

## Adding to a course mid-semester

A reading posted in week six, a handout before the midterm, a photograph of the
board: **Guide → New reading or handout**. What is pasted is parsed into cards
where it clearly is cards and kept as prose where it is not, then merged into
the guide at read time — so Cards, Read, Quiz, Cram, Figures, Slides and the
lesson slides all pick it up at once, and the unit's mastery is diluted by what
you have not seen, so it climbs back into tonight's plan.

Nothing added is invented. Prose that does not split cleanly into a question
and an answer stays prose.

## Connecting accounts

**Me → Connect accounts.** Two routes, and the screen says which is which:

- **The file route works now, for everyone.** Brightspace publishes a personal
  calendar feed (Calendar → Subscribe); Outlook, Google and Zoom all export
  .ics. Paste the link or drop the file and the dates are in. No password, no
  registration, no server.
- **The account route** is a real sign-in — Microsoft 365, Google, Zoom — over
  OAuth with PKCE, which needs a client ID registered by whoever runs the app.
  Put it in `app/.env.local`; without one the app says so and points at the file
  route instead.

Brightspace grades and submissions need D2L's Valence API, which Vanderbilt has
to issue a key for. The calendar feed is what a student can turn on alone.

## Claude, in the app

**Study → Ask Claude.** The course guide, its deadlines and what you are
weakest at go in with the question, so the answer is about this course rather
than the subject in general — and an answer worth keeping becomes cards on the
course with one tap.

It needs a key. A key in a browser can be read by anything in that browser, so
the app stores it on-device only, sends it only to Anthropic, and treats a
proxy that holds the key server-side as the better option rather than the
fallback.

## Phone, laptop, or its own window

The same build runs three ways. Under 900px it is the phone it was drawn as;
above that the tab bar unrolls into a rail beside the column. A web manifest and
a service worker make it installable — a real window on macOS or Windows, an
icon on a home screen — and keep the lessons playable with no signal. Audio is
never pre-cached: what you have played is kept, and nothing else.

## Not yet in

The ECON interactive study guide lives inside a Claude chat rather than as a
published artifact, so it could not be read from here. Its content is already in
the app from `econ1020_study_guide.pdf`, which is the same guide — but if the
interactive version has extras worth pulling in, publishing it (as the other
three field guides were published) makes it readable.
