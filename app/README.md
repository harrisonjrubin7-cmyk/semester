# Semester

An app for one Vanderbilt semester — Fall 2026, four courses, every deadline and
study guide in one place. Built from the Claude Design handoff in `../project`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

It is a mobile-first web app that also has a desktop layout and installs as its
own application.

- **Phone** — fills the screen; add to the home screen from the share sheet.
- **Laptop** — from 900px the tab bar unrolls into a rail beside the column. The
  column keeps its width: the type and the touch targets were drawn for it.
- **Installed** — `public/manifest.webmanifest` and `public/sw.js` make it
  installable from Chrome or Edge as a standalone window, and keep the app shell
  and anything you have played working offline. Audio is cached as you play it,
  never up front — 46 MB of lessons downloaded on first open would be a hostile
  thing to do to a phone plan.

## What is in it

Five sections, twenty screens.

- **Today** — the next class with a live countdown, what is due today as a
  checklist, the day's rail of classes, the next campus event, and what is
  coming.
- **Courses** — the four syllabi, how each grade is built, and every dated
  obligation with the syllabus line it came from.
- **Study** — an exam radar, a guide per course, "tonight's 25 minutes" built
  from your weakest unit in each, and **Ask Claude**. Each guide has nine modes:
  **Cards** (tap-to-flip drill), **Read** (the guide as prose), **Watch** (a
  narrated lesson per unit with slides that follow the voice), **Slides** (the
  unit as a deck), **Doc** (the guide as .docx, .pdf, or printed), **Quiz** (ten
  multiple choice, decoys drawn from other units), **Figures**, **Cases**,
  **Cram** and **Listen**.
- **Calendar** — a month grid of deadlines, and a Campus tab for athletics,
  clubs and university events.
- **Mine** — your own tasks, appointments, notes and files, kept visibly apart
  from anything a syllabus produced.
- **Me** — load by course, the account connections, settings and the syllabus
  importer.

## Two navigation structures

The design compared two, and both ship. Switch in **Settings → Navigation**.

- **Tab bar** — Today / Courses / Study / Calendar / Me. Every thing has a fixed
  home. Costs you taps when comparing two courses.
- **One feed** — no tabs. Classes and deadlines interleave in one chronological
  scroll, sliced by a filter row. Fastest for "what is actually next", weaker
  for browsing a course whole. Since it has no tab bar, the Me screen carries
  links to the other sections.

## The date is real

The prototype pinned itself to Thursday 3 September so its screenshots would be
stable. Here the clock is live and everything that depends on it is derived:
relative due labels, which items count as today, the class rail, the next-class
countdown, the exam radar, and the calendar month.

The weekly schedule in `src/data/schedule.ts` comes from the meeting patterns on
the syllabi. That particular Thursday's one-offs — the BUS guest speaker, the
canceled PSCI class, the ECOALF group call — are kept as dated exceptions, so on
3 September the rail reproduces the design exactly and on any other day it shows
the real recurring schedule.

Course content itself is static. Two details were invented for the prototype and
are kept so the app matches it: BUS 1600's 11:00a meeting time (the syllabus
gives only T/R) and the ECON 9:05 section.

## Where the study content came from

Not the mockup's condensed decks — the real guides.

| Course | Source |
| --- | --- |
| ECON 1020 | `econ1020_study_guide.pdf` |
| PSCI 1104 | "PSCI 1104 Field Guide" artifact |
| CORE 2500 | "Sport, Culture & Society Field Guide" artifact |
| BUS 1600 | "BUS 1600 Field Manual" artifact |

Each carries its units and cards, its glossary, its exam frames, and its own
self-test. PSCI additionally carries the seven debates as claim / test / verdict
case files.

## Figures

`src/data/figures.ts` keys figures to the unit they illustrate. Bar and step
figures are laid out in `FigureCard`; the curve-based ones are hand-drawn inline
SVG in `src/components/Diagram.tsx` — supply and demand, price ceilings, cost
curves, monopoly, externalities, elasticity along a demand curve, the normal
curve, skew, the validity/reliability dartboard, causal diagrams, the 3-V
triangle, perceptual maps, the buying funnel, Keller's pyramid, channel levels
and the product life cycle.

If you add a unit to a guide, check the figure keys — they are unit indices.

## Audio

`public/audio` holds five recordings, wired into each guide's **Listen** mode
with chapter marks that seek.

- `econ-guide.mp3`, `psci-condensed.mp3`, `psci-full.mp3`, `core-full.mp3` —
  your own recordings.
- `*-podcast.mp3` — two-voice conversational editions, generated from the
  scripts in `../audio/scripts`. See `../audio/README.md`.

Chapter marks are real, not estimated, wherever the audio allowed it. PSCI's
published timestamps were confirmed against the recording with a silence
detector, which reproduced all twenty within a second; CORE's were recovered the
same way. ECON's original recording has no detectable pauses, so its marks
follow the guide's section order and are marked approximate in the data.

## Lessons

`public/audio/lessons/<course>/unit-<n>.mp3` — forty-four narrated lessons, one
per unit, rendered by `../pipeline/lessons.py`. The slides are not in the audio:
each course's `lessons.ts` carries a cue list giving the second each beat
begins, and **Watch** draws the slide from it. Real type at the device's own
resolution, a tenth of the bytes of video, and re-renderable from the guide the
moment the guide changes.

## Adding material to a course

`src/lib/live.ts` is the load-bearing part. A course module is what the pipeline
made from the syllabus and never changes by itself; a `CourseUpdate` is anything
you have added since. The two are merged at read time, for every screen at once,
so adding a reading updates Cards, Read, Quiz, Cram, Figures, Slides and the
lesson slides together and none of them can go stale.

Two details that matter:

- Added cards stay identifiable — the app says what is new rather than blending
  it in.
- A unit's mastery is diluted by what you add. Ten cards at 80% plus five you
  have never seen is not still 80%, and pretending otherwise would drop the unit
  out of tonight's plan exactly when it should be climbing it.

## Connections

`src/lib/ics.ts` reads any iCalendar feed — Brightspace's subscribe link,
Outlook, Google, Zoom — including weekly RRULEs so a repeating class appears
more than once. `src/lib/connect.ts` handles the OAuth route for Microsoft,
Google and Zoom: PKCE in the browser, client IDs from `.env.local`, tokens in
this device's storage and nowhere else. Zoom's API sends no CORS headers, so it
goes through the dev-server proxy in `vite.config.ts`; the same file forwards
`/feed?url=` so a subscribed calendar can be fetched at all.

`src/lib/claude.ts` is the Messages API client behind **Ask Claude** — streamed,
with the course guide as system context, and a card-maker that refuses anything
it cannot parse cleanly rather than inventing a card.

## What persists

`localStorage`, under `semester.v1`: ticked tasks, saved events, alert
preferences, nav mode, whether onboarding has been seen, your own tasks,
appointments and notes, the material you have added to courses, and connected
calendars. Files you attach are larger, so they live in IndexedDB
(`semester-files`) instead. Tokens and any Claude key are under their own keys
and are never bundled with the rest.

Navigation state is deliberately not persisted — the app opens on Today.

Clear it from the console with `localStorage.removeItem('semester.v1')`.

## Design system

`src/styles/industry.css` is the Industry design system, copied verbatim from
the handoff — it is the source of truth for tokens and component classes.
`src/styles/app.css` is the app layer over it: a stealth-chrome treatment with a
near-black ground, sterling hairlines and a brushed-metal gradient on display
type and primary actions.

Everything visual is a token. Screens read `var(--app-*)`, never a hex. If you
want a different look, retune the tokens at the top of `app.css` and the whole
app follows.

## Layout

```
src/
  components/   Blueprint frame, icons, diagrams, shared UI
  data/         Courses, items, schedule, guides, figures, events, audio, copy
  lib/          Types, date maths, selectors, quiz builder
  screens/      One file per area
  state/        Reducer, persistence, the live clock
  styles/       industry.css (the system) + app.css (this app)
```

Data is plain TypeScript, not fetched. Selectors in `lib/select.ts` are the only
place the current date turns into what a screen shows, so if a date looks wrong
that is where to look.
