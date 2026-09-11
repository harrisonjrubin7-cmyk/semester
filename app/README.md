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

<!--tabs-->Five<!--/--> tabs, <!--screens-->fifty-three<!--/--> screens. The tabs
are below; the screens are the registry in `src/lib/nav.ts`, which is also what
the directory, the search box and the home-screen icons are drawn from — there
is one list, and it is that one.

Both numbers are generated. They were hand-written once and wrong for months —
"twenty screens" while there were fifty — and then, once a test held them to
the registry, right and *fragile*: the screen count moved twice in one evening
and three branches raced to correct it. So `npm run counts` writes them from
the registries and the test only checks that it was run. See
`src/lib/counts.ts`.

- **Today** — the next class with a live countdown, what is due today as a
  checklist, the day's rail of classes, the next campus event, and what is
  coming.
- **Courses** — the four syllabi, how each grade is built, and every dated
  obligation with the syllabus line it came from.
- **Study** — an exam radar and three views of the same four courses.
  **Guides** is a card per course saying what is due, what is unseen and what
  to do next, with every way into it a tap away. **Revise** ranks every unit in
  every course by what has come round, how cold it is and what is tested soon,
  then fills the time you say you have — ten minutes, twenty-five or
  forty-five — and starts the cards. **Tools** is every tool the app has as a
  home screen, with the two or three this fortnight's deadlines actually ask
  for said out loud above it. Each guide has <!--modes-->eleven<!--/-->
  modes: **Cards** (tap-to-flip drill), **Read** (the guide as prose), **Field
  guide** (the whole thing as the published document, masthead and all),
  **Watch** (a narrated lesson per unit with slides that follow the voice),
  **Slides** (the unit as a deck), **Doc** (the guide as .docx, .pdf, or
  printed), **Quiz** (ten multiple choice, decoys drawn from other units),
  **Figures**, **Cases**, **Cram** and **Listen**. They are one list too —
  `src/lib/modes.ts`. **Where courses meet** is the one study screen that is
  not one course at a time: the terms two of your courses both use, with both
  definitions side by side and the evidence graded, because it matches words
  rather than ideas — `src/lib/meet.ts`.
- **Calendar** — a month grid of deadlines, and a Campus tab for athletics,
  clubs and university events.
- **Mine** — your own tasks, appointments, notes and files, kept visibly apart
  from anything a syllabus produced.
- **Progress** — where you stand, in one sentence, with the two or three things
  worth doing about it; the next seven days as a shape you can press a day of;
  the term, the drilling, the load per course and how long work actually takes
  you. Its other two tabs are the app's own directory — every screen by shelf,
  and every screen by what you are trying to do.

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
cannot both win. So the section is what a drop lands on, a grip just above its
heading is what starts the drag, and everything inside it answers a hold
exactly as it did. `zone` and `grip` on the hook are those two halves.

The grip sits inside the column rather than out in the page's margin, which is
where it started. The leftmost strip of a phone screen is where iOS Safari's
back-swipe begins, and a handle the browser can take the gesture from is a
handle that does not work — silently, and in a way that reads as the feature
being broken. It moves up into the gap above the heading instead, which is
empty on every section, so it clears both the swipe band and the words without
indenting eighteen sections.

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

`public/audio` holds <!--recordings-->eight<!--/--> recordings, wired into each
guide's **Listen** mode with chapter marks that seek.

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

`public/audio/lessons/<course>/unit-<n>.mp3` — <!--lessons-->forty-four<!--/--> narrated lessons, one
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
more than once. `src/lib/feedlink.ts` is the step before it: it repairs whatever
was pasted (`webcal://`, a missing scheme, a Google embed page, the angle
brackets a mail client added), works out from the host who published it, and
then fetches it by whichever route this build has — straight at the calendar
first, the forwarder second, deciding on whether what came back is a calendar
rather than on the status code, because a single-page host answers an unknown
path with its own index.html and a 200.

`src/lib/connect.ts` handles the OAuth route for Microsoft, Google and Zoom:
PKCE in the browser, client IDs from `.env.local`, tokens in this device's
storage and nowhere else. Zoom's API sends no CORS headers, so it goes through
the dev-server proxy in `vite.config.ts`; the same file forwards `/feed?url=` so
a subscribed calendar can be fetched at all. A deployment with its own forwarder
points `VITE_ICS_PROXY` at it; without one, pasted links still work for hosts
that allow the browser to read them, and the .ics file route works everywhere
and needs nothing.

Campus systems with no student-usable API — myVU, YES, AnchorLink — are links
rather than integrations, held in `src/data/campus.ts` with the addresses
editable in the app; the edit is what persists. Apple is half a connection: its
calendars arrive as a published `webcal://` feed with no account at all, while
Sign in with Apple needs a signed client secret, which `vite.config.ts` builds
server-side so the .p8 never reaches the browser.

`src/lib/claude.ts` is the Messages API client behind **Ask Claude** — streamed,
with the course guide as system context, and a card-maker that refuses anything
it cannot parse cleanly rather than inventing a card.

It reaches the API by four routes, preferred in this order: a proxy typed on
this device, a key typed on this device, a proxy this build was pointed at
(`VITE_CLAUDE_PROXY`), and the shared key that comes with signing in. The third
is what makes a fresh clone answer — put `ANTHROPIC_API_KEY` in
`app/.env.local` and `vite.config.ts` serves that proxy at `/anthropic`, adding
the key to each call and streaming the reply back, so the key stays in the dev
server and the page holds only an address. See [SETUP.md](../SETUP.md#the-assistant-on-your-own-machine).

### Two kinds of tool, and the rule that tells them apart

The assistant has two tool sets and they are opposites, split by risk.

`src/lib/tools.ts` **proposes**. A call there changes something — a task added,
a class marked absent, a screen opened — so nothing runs: it becomes one line
saying exactly what would happen, with a button, and you decide. Every write
carries its own undo, worked out before the change rather than after.

`src/lib/lookup.ts` **reads**. A call there changes nothing — it takes state and
returns a string, and there is no `dispatch` in the file to call — so waiting for
a tap would be friction protecting nobody. It runs at once and the answer goes
straight back to the model in a second request.

That second door exists because the first one is decided too early.
`src/lib/context.ts` chooses what travels with a question from keywords, before
anything has read the question properly, and a heuristic that misses used to
leave the model saying *I do not have your grades* about numbers on the same
device. Now it can go and get them: deadlines and their ids, a course's grading
and where you stand in it, absences against the policy, a search of your own
study guide, your own task list, and which classes meet on a day. What is read
is named on screen while it happens and joins the *what it read* row underneath
the answer.

Nothing about the boundary moved. Every lookup reaches a category
`context.ts`'s allowlist already names — what changed is who asks, not what may
be asked for — and `lookup.test.ts` runs every lookup against a state holding a
private note, a task note, another person and a letter, and asserts none of them
comes back.

## The three screens that make a file

Write, Sheet and the deck editor are the app's answers to a word processor, a
spreadsheet and a slide deck, and each of them had grown its own furniture.
The title was a form field on two of them and absent on the third. The exports
were three stacked buttons under "Take it away" on one, four under the same
words on the next, and a single button in a corner on the third. Deleting the
thing you were editing was a full-width button at the very bottom of the page,
under the exports. None of them had the one thing every editor a student has
ever opened has: a bar across the top reading **File Edit View Insert Format
Tools Help**.

All three open the same way now, and it is the way those applications open.

- **`lib/menus.ts`** holds a menu bar as a value — a list of menus, each a list
  of groups, each a list of commands. The rules are testable because of that:
  a command with nothing behind it is drawn greyed rather than live, the menus
  read in the order Word, Docs, Excel, Sheets, PowerPoint and Keynote all use,
  and an id used twice fails the suite rather than silently dropping an item.
- **`components/Bench.tsx`** draws it: the type's glyph, the title as the
  heading it is rather than as a box, the menu bar, and a toolbar. Above 760px
  the bar is the row of names; below it, all of them fold into one button whose
  panel lists every menu under its own name. That is the whole responsive rule
  — the title, the toolbar and everything under them are identical at every
  width.
- **`components/Gallery.tsx`** is the screen Write and the deck builder open
  on: a row of things to start from, then everything you already have, cut into
  Today / Previous 7 days / Previous 30 days / Earlier, as thumbnails or as
  rows, sorted by when you last opened it, by name, or by when it was made.
  `lib/shelf.ts` does the sorting and the grouping and is tested on its own.

The thumbnails are the real thing at small size: a document's own first lines
and a deck's first slide as a slide. So is the row of starters — the seven
document shapes in `lib/doctemplates.ts` used to be behind a button that had to
be pressed before anybody could find out there were any.

### The bar is not the toolbar

`Bench` takes an optional `tools` row and the two screens that came to it with
a toolbar of their own keep it: Sheet's formats, bold, alignments and undo, and
the deck editor's six slide actions. Excel and PowerPoint both put the same
commands on a bar and on a menu, and it is not a duplication anybody has ever
objected to — a button is for the hand that knows where it is, a menu is for
everybody else. `lib/onecontrol.test.ts` is about one *implementation* of a
control, not one route to a command.

### The shelf Sheet does not use

`screens/Sheet.tsx` has a shelf of its own, written alongside this one, and it
is richer in one way this is not: it knows when a sheet was last **opened** as
well as when it was last edited, which this model has no field for. Folding the
two together means widening `lib/shelf.ts` to carry an optional `opened` and a
fourth sort, and moving Sheet's five templates onto `Starter`. Worth doing;
deliberately not done inside a merge.

No keystrokes are printed beside the commands, because `lib/keys.ts` is right
that a shortcut carrying Meta or Control belongs to the browser — and a label
for a binding the app has not made would be worse than no label.

`screens/files.test.tsx` mounts all three cold, starts a file from the shelf the
way somebody would, and reads the bar off the DOM — at a laptop width and at a
phone's.

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
  a11y/         The rules a keyboard and a screen reader depend on, as tests
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
| What the assistant may offer to change, and how each is undone | `lib/tools.ts` |
| What the assistant may look up for itself, mid-answer | `lib/lookup.ts` |
| What leaves the device when a question is asked | `lib/context.ts` (`PICK`) |
| The spacing, type and leading scales every screen is held to | `styles/rules.ts` |
| What each screen is still owed off those scales, per file | `styles/budget.ts` (generated: `npm run lint:styles -- --fix`) |
| How a list is dragged into a different order, and what an arrow means | `lib/arrange.ts` |
| Which controls a screen reader can name | `a11y/labels.ts` (run by `npm run lint`) |
| How a dialog keeps the Tab key, and gives focus back | `a11y/modal.ts` |
| What the browser tab, the history entry and the installed window are called | `a11y/title.ts` |
| How the app scrolls, for somebody who asked for less movement | `lib/prefers.ts` |
| Whether a bar speaks its value or repeats the words beside it | `components/ui.tsx` (`Meter`), decided per call site |
| How big the type is, and whose setting decides | `lib/look.ts` (`SIZES`, `scaleFrom`) over the root in `App.tsx` |
| The lists the settings page can rearrange with arrows | `lib/springboard.ts` (`boardLists`) and `lib/launcher.ts` (`shelfLists`) |
| The words in the podcasts | `audio/scripts/` → `npm run transcripts` → `data/transcripts/` |

If a date looks wrong, `lib/select.ts` is where the clock becomes what a screen
shows. If a screen is unreachable, `lib/nav.ts` is why — and
`lib/findable.test.ts` fails until every screen is either in that registry or
named there as one you arrive at from somewhere else.

### Reachable without a pointer, and without sight

Eleven things hold the app together for somebody on a keyboard, a screen
reader, a body that does not want to be moved, eyes that need bigger words, or
a hand that cannot hold a drag — and each is one implementation rather than a
habit.

- **Every screen has a landmark, a heading and a name.** `<main>` is the one
  scrolling element, the header is a real `<header>`, and the screen's name is
  the page's `<h1>` — with focus moving to that heading on every navigation, so
  pressing a tab lands you *in* what you opened rather than leaving you in the
  bar you pressed. The same name is what the browser tab, the history entry and
  the installed window say (`a11y/title.ts`). Before that they all read
  "Semester", which is the one thing you already knew: fifty screens, fifty
  identical history entries, and three tabs you could only tell apart by
  opening them.
- **`aria-modal` is a promise the app keeps.** The attribute tells a reader
  that nothing outside the dialog exists; what it does not do is confine the
  Tab key, and that is the author's job. `a11y/modal.ts` is the one trap — it
  keeps Tab inside, takes focus on open, and gives it back to whatever opened
  it. Seven overlays declare the attribute and six were not keeping it: two had
  hand-rolled a ring each, with different selectors and different bugs, and the
  rest had none, so one press of Tab walked out of a dialog the markup had just
  called the only thing on the page. `a11y/modal.test.ts` fails if a dialog
  declares it without the trap, or if a third copy of the ring appears.
- **Every control has a name.** `a11y/labels.ts` runs as part of `npm run
  lint`: a `<select>` with a heading above it looks labelled and is not.
- **Every outcome is announced.** One live region, in `components/Said.tsx`,
  for the things that happened because somebody acted and are otherwise
  visible only as something on the screen having changed.
- **Every recording has its words.** The four podcasts are an hour and a half
  of speech, and a study mode nobody deaf or hard of hearing could use. Every
  line of it was already in this repository, in `audio/scripts/` — it is what
  the synthesiser spoke to make the MP3s — so `npm run transcripts` writes it
  into `data/transcripts/` and Listen shows it under the chapters that play
  it. Generated, never edited: `transcript.test.ts` compares the words on the
  page to the words in the script, so a re-recorded episode cannot go on
  showing the old one's lines. Loaded as a chunk per course when Listen is
  opened, because nineteen thousand words do not belong in front of a first
  paint. (A Full read has none, and needs none — it is the study guide spoken,
  and the guide is already in Read and Field guide.)
- **Reduced motion reaches the scrolls the app makes itself.** `app.css` has
  flattened every CSS animation and transition for a long time, which reads as
  complete and is half the job: `scrollTo({ behavior: 'smooth' })` is a script
  asking for motion, not a style declaring it, and no media query applies to
  it. Five places went on sweeping the page its whole length for somebody who
  had asked the operating system not to be moved like that — which is what
  provokes nausea and vertigo in a vestibular disorder, not a matter of taste.
  `scrollKindly` and `revealKindly` in `lib/prefers.ts` are the only way the
  app scrolls now, and `a11y/motion.test.ts` fails on a raw `'smooth'`.
- **Every bar says its number.** A meter is a number drawn as a length, and
  four of the app's seven were the only place their figure appeared — Study's
  mastery bar beside "11 units · 68 cards", the deck-coverage bar on Progress
  whose own comment says it shows *what the line does not show*. A screen
  reader met two nested `<div>`s. `Meter` takes a required `label` now: a
  string for a bar that has to speak, an explicit `null` for one whose number
  is already in the words, and no default — so the compiler asks the question
  at every site rather than letting a silent bar ship.
- **Every failure is announced.** `components/Trouble.tsx` had this right, and
  said why: "a failure that is only visible is a failure half the people using
  the app miss". Twelve other error messages did not — a plain `<div>` in the
  warn colour, appearing where nothing was before, so pressing Sign in with a
  wrong password did nothing a reader could tell you about. They carry
  `role="alert"` now, which changes nothing about how any of them looks.
  `a11y/tellings.test.ts` holds both of these, and fails on a thirteenth.
- **One main, one h1, and a navigation you can jump to.** Landmarks are how
  somebody moves around a page without reading it, and three places did not
  hold — all three the same mistake, a part written as though it were the whole
  page and then mounted inside a shell that already provided what it was
  providing. The home screen was a plain `<div>` where the bar, the rail and
  the shelves are all a `<nav>`, so choosing it left the app with no navigation
  landmark anywhere; and every settings page opened a second `<main>` *inside*
  `ScrollArea`'s (which is invalid — a `<main>` may not descend from one),
  printed a second `<h1>` under the header's, and made it a second focus target,
  so two effects raced to say where you were. `a11y/landmarks.test.ts` holds
  all three, reading the source with its comments stripped — the first draft
  failed on four files that were *describing* landmarks rather than opening
  them, including the paragraphs above the fixes.
- **The browser's own font size reaches the app.** Raising the default font
  size is how a great many people with low vision read the web — more often
  than zoom, because it leaves layouts alone and only makes the words bigger.
  This app set the root to a flat `16 * scale` px, which does not ignore that
  setting so much as overwrite it: driven against Chromium with its default
  raised from 16 to 24, the app came out pixel for pixel identical, root forced
  back to 16 and body text 12px either way. The root is a percentage of the
  inherited size now, and `--text-scale` — which the six type tokens and about
  twelve hundred inline sizes all multiply through — is read back from what
  that produced, so at the 16px default it is arithmetically the number that
  was there before and nothing moves. `a11y/type.test.ts` holds it.
- **What a drag does, a single pointer can do without dragging.** A drag is a
  press held still enough to travel, and a tremor, a head pointer or an eye
  tracker can put a pointer exactly where it needs to go and cannot hold it
  there while moving — and on a tablet there is no keyboard, so Alt with the
  arrow keys is an answer for a laptop and not for the device this app is
  mostly used on. WCAG 2.2 asks for it at 2.5.7. Three of the five orderings
  already had it, all by way of the `Reorder` arrows; the home screen and the
  shelves did not, and are now arranged from **Settings → Layout and
  navigation** beside Today's sections — arrows rather than a grid of them on
  forty-odd icons, and off the directory rows, which are each a single
  `<button>` that could not hold a pair. `a11y/dragging.test.ts` follows each
  handler one hop through its helpers to see which order it writes: two
  weaker drafts of that rule passed even with the whole shelves section
  deleted, which is the worst thing a rule can do.

  The one feed is deliberately not in that list: it draws no navigation chrome
  at all on a phone — its only fixed control is an Import button — and marking
  its filter row as a `<nav>` would be calling a filter a navigation. How you
  leave the feed is a design question, not a labelling one.
