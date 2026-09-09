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
- **iPad and laptop** — from 760px the tab bar unrolls into a rail beside the
  column (`lib/media.ts`). 760 rather than 900 so an iPad in portrait gets it:
  the 11-inch is 834pt wide, the 9.7-inch 768. The column keeps its width — the
  type and the touch targets were drawn for it — and the query follows Split
  View live. Below the breakpoint the column runs full height rather than
  floating in a frame, which is right for a tablet held upright and for a
  half-width split.
- **Installed** — `public/manifest.webmanifest`, PNG icons (iOS ignores an SVG
  `apple-touch-icon`, so `apple-touch-icon.png` is rendered from the SVG) and
  `public/sw.js` make it installable as a standalone window, and keep the app shell
  and anything you have played working offline. Audio is cached as you play it,
  never up front — 46 MB of lessons downloaded on first open would be a hostile
  thing to do to a phone plan.

## What is in it

Five tabs, forty-eight screens. The tabs are below; the forty-eight are the registry in
`src/lib/nav.ts`, which is also what the directory, the search box and the
home-screen icons are drawn from — there is one list, and it is that one.

- **Today** — the next class with a live countdown, what is due today as a
  checklist, the day's rail of classes, the next campus event, and what is
  coming.
- **Courses** — the four syllabi, how each grade is built, and every dated
  obligation with the syllabus line it came from.
- **Study** — an exam radar, a guide per course, "tonight's 25 minutes" built
  from your weakest unit in each, and **Ask Claude**. Each guide has eleven
  modes: **Cards** (tap-to-flip drill), **Read** (the guide as prose), **Field
  guide** (the whole thing as the published document, masthead and all),
  **Watch** (a narrated lesson per unit with slides that follow the voice),
  **Slides** (the unit as a deck), **Doc** (the guide as .docx, .pdf, or
  printed), **Quiz** (ten multiple choice, decoys drawn from other units),
  **Figures**, **Cases**, **Cram** and **Listen**. They are one list too —
  `src/lib/modes.ts`.
- **Calendar** — a month grid of deadlines, and a Campus tab for athletics,
  clubs and university events.
- **Mine** — your own tasks, appointments, notes and files, kept visibly apart
  from anything a syllabus produced.
- **Me** — load by course, the account connections, settings and the syllabus
  importer.

## Two axes: how you move, and how a screen is drawn

Both are chosen on one page — **Settings → Layout and navigation** — with a
drawing of each option beside its name. They are independent, and all twelve
pairings are a working app.

**Navigation** decides which single piece of chrome is drawn. One, always:
`src/lib/chrome.ts` is the whole rule, and `chrome.test.ts` runs every
combination of navigation, screen and width to prove no two are ever on screen
together.

- **Tab bar** — Today / Courses / Study / Calendar / Me. Every thing has a fixed
  home. Costs you taps when comparing two courses.
- **One feed** — no tabs. Classes and deadlines interleave in one chronological
  scroll, sliced by a filter row. Fastest for "what is actually next", weaker
  for browsing a course whole. Since it has no bar, the Me screen carries links
  to the other sections.
- **Home screen** — three pages of icons with a dock that does not move. Every
  icon goes to the same screen the tab bar would have.
- **Shelves** — two rows of pills, the shelf you are on and the screens on it,
  with the current screen's own sentence under them.

**Layout** decides how a screen is arranged once you are on it, and nothing
else: the same screen shows the same controls and the same content in all three
(`src/components/shell/useShell.ts`).

- **Drawn** — framed cards with registration marks, and room between them.
- **Grouped** — one inset panel per section, hairlines between rows.
- **Soft** — cards lifted off the page, and one figure per screen worth reading
  first.

The shelves used to be part of the soft layout rather than a navigation, so
choosing that layout drew its pills *on top of* the tab bar or the rail — two
live navigations in one window. They are a navigation now, available in all
three layouts, and no layout draws navigation of its own.

## Nothing with an order is static

Anything the app draws as an ordered list can be dragged into a different
order: the icons, folders and dock on the home screen, the tiles inside a
shelf, the rows of the directory in Me and in Everything, the tabs in the
bottom bar, your courses, the sections of Today — on Today itself, by the
grip beside each heading — and everything on the calendar. Hold it, move it,
let go.

One gesture and one arithmetic, in [`lib/arrange.ts`](src/lib/arrange.ts) over
the pointer handling in [`lib/drag.ts`](src/lib/drag.ts) — a press is a drag
only once it is held, so a finger on a list still scrolls it; a drop ends in a
click that is told to stand down; and Alt with the arrow keys does the same
move without a pointer, because a list whose only ordering gesture is a drag is
a list some people cannot order at all. The ↑ ↓ arrows stay wherever they were:
they are the visible sign that a list has an order.

A movable thing is usually its own handle. Today's sections are the exception
and the reason is worth knowing: a hold inside one already asks the assistant
about the row under your thumb, and two press-and-hold gestures on one element
cannot both win. So the section is what a drop lands on, a grip in the margin
beside its heading is what starts the drag, and everything inside it answers a
hold exactly as it did. `zone` and `grip` on the hook are those two halves.

Where the order is a preference rather than data, it is a look key —
`groupOrder` for the shelves, `boardOrder` for the home screen — and both are
read as a preference *over* the registry, never as a replacement for it. A
screen the school gate has switched off does not come back because an old
order names it; one added since the order was saved appears at the end rather
than not at all.

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

`public/audio` holds eight recordings, wired into each guide's **Listen** mode
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

Campus systems with no student-usable API — myVU, YES, AnchorLink — are links
rather than integrations, held in `src/data/campus.ts` with the addresses
editable in the app; the edit is what persists. Apple is half a connection: its
calendars arrive as a published `webcal://` feed with no account at all, while
Sign in with Apple needs a signed client secret, which `vite.config.ts` builds
server-side so the .p8 never reaches the browser.

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

`src/styles/industry.css` is the Industry design system, copied from the handoff
with one line changed — it is the source of truth for tokens and component
classes. `src/styles/app.css` is the app layer over it: a stealth-chrome
treatment with a near-black ground, sterling hairlines and a brushed-metal
gradient on display type and primary actions.

The changed line is the font import. Both sheets used to open with an
`@import` of fonts.googleapis.com; the faces are now in
`src/styles/typefaces.css` and served from this origin, which is what makes
three of the app's own claims true — *signed out, nothing leaves the device at
all* on the Privacy screen, "keeps working with no signal" above (the service
worker leaves cross-origin requests alone by design, so the fonts were never
cached), and a first paint that does not wait on two more hosts. The reasoning
is written out at the top of that file.

Everything visual is a token. Screens read `var(--app-*)`, never a hex. If you
want a different look, retune the tokens at the top of `app.css` and the whole
app follows.

### A colour per course

One exception, and it proves the rule: a course's colour cannot be a token,
because there is one token set and there are as many courses as you have. So
`src/lib/tint.ts` derives it. Your accent anchors a wheel and your courses
divide the rest of it between them — same saturation, same lightness, drawn for
whichever ground is actually on — so four classes are four colours that still
read as one family, and moving from Sterling to Copper takes the whole set with
you. Every deadline row, class block, calendar dot, load bar and course code
wears it, which turns "whose is this?" from something you read into something
you see.

Nothing was picked by eye: `tint.test.ts` runs WCAG's arithmetic over every hue
at five-degree steps against all thirteen grounds — a course code at 4.5:1, a
mark at 3:1. Hold a course to a particular colour under **Settings → Your
courses, your way**, or turn the whole thing off under **Settings → Look**,
where the app goes back to one metal throughout.

## Where things live

```
src/
  ai/           The assistant: prompt, tools, providers, the chat surface
  components/   Blueprint frame, icons, diagrams, shared UI
  data/         Courses, items, schedule, guides, figures, events, audio, copy
  lib/          Types, date maths, selectors, the registries below
  screens/      One file per area
  state/        Reducer, persistence, the live clock
  styles/       industry.css (the system) + app.css (this app) + typefaces.css
```

Data is plain TypeScript, not fetched.

### One list per thing

Each of these is the only place its subject is decided. Change it here and
every screen, the search, the directory and the guidebook follow — that is the
point of them, and adding a second list beside one is the bug they exist to
prevent.

| To change… | Edit |
| --- | --- |
| Which screens exist, what each is called, what it is for, and what somebody would search for to find it | `lib/nav.ts` (`DESTINATIONS`) |
| Which navigation is drawn, and when | `lib/chrome.ts` |
| The four navigations and the three layouts, with their names and blurbs | `lib/look.ts` (`NAVS`, `SHELLS`) |
| Every colour, ground, typeface, size and spacing token | `lib/look.ts` (`tokensFor`) |
| Which colour each course wears, everywhere it appears | `lib/tint.ts` |
| Which settings pages exist and what each holds | `lib/settings.ts` (`SETTINGS`) |
| What Today shows, and in what order | `lib/feed.ts` (`SECTIONS`) |
| Which screens a new account sees before it has earned the rest | `lib/reveal.ts` |
| Keyboard shortcuts | `lib/keys.ts` |
| What a school does and does not have (meal swipes, a card, an LMS) | `lib/school.ts` |
| What the date turns into on screen — labels, "today", countdowns | `lib/select.ts` |
| What the assistant can do | `ai/providers/` |
| The spacing, type and leading scales every screen is held to | `styles/rules.ts` |
| What each screen is still owed off those scales, per file | `styles/budget.ts` (generated: `npm run lint:styles -- --fix`) |
| How a list is dragged into a different order, and what an arrow means | `lib/arrange.ts` |

If a date looks wrong, `lib/select.ts` is where the clock becomes what a screen
shows. If a screen is unreachable, `lib/nav.ts` is why — and
`lib/findable.test.ts` fails until every screen is either in that registry or
named there as one you arrive at from somewhere else.
