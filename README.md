# Semester

Upload your syllabi; get the semester back as an app — every deadline with the
sentence it came from, a study guide you can drill, narrated lessons, a deck, a
document, and a calendar that knows when your classes are.

Built first for one Vanderbilt semester (Fall 2026, four courses, by hand), then
generalised: anyone can sign in, upload their own syllabus and readings, and get
the same thing for their own courses.

**Live: https://harrisonjrubin7-cmyk.github.io/semester/** · running your own
copy: [SETUP.md](SETUP.md)

On a phone, open that in Safari or Chrome and use *Add to Home Screen* — it then
runs full screen with its own icon, and keeps working with no signal. Lessons
and podcast editions are cached as you play them, never up front.

```bash
cd app && npm install && npm run dev
```

Every push to `main` runs the checks and redeploys the site
(`.github/workflows/`). Pages serves the app from `/semester/` rather than the
root, which is why nothing in the app reads a leading-slash path directly — see
`app/src/lib/asset.ts`.

## Layout

| Path | What it is |
| --- | --- |
| `app/` | The application. Vite + React + TypeScript. See [`app/README.md`](app/README.md). |
| `audio/` | Podcast scripts and the synthesiser that renders them. See [`audio/README.md`](audio/README.md). |
| `pipeline/` | Syllabus → course, and everything generated from a course: lessons, decks, handouts. See [`pipeline/README.md`](pipeline/README.md). |
| `project/` | The original Claude Design handoff — HTML prototypes, the Industry design system, the syllabus PDFs. Kept as the reference the app was built from. |
| `chats/` | The design conversation that produced it. |

`project/` and `chats/` are the source material and are not built or imported by
the app. The one thing the app does take from `project/` is the Industry
stylesheet, copied to `app/src/styles/industry.css` — verbatim but for its font
import, which is now `app/src/styles/typefaces.css` and served from this origin
rather than from Google.

## What was built, and from what

The design came over as two prototypes — a canvas (`Semester.dc.html`) showing
seven phones side by side, and the phone itself (`Semester Phone.dc.html`), a
2,300-line single-component app covering twenty screens.

Three things were decided rather than inherited:

- **Navigation and layout are two settings, not two apps.** The canvas compared
  a tab bar against a single filtered feed; rather than pick, both ship, and two
  more joined them. They are one axis — *how you move* — with exactly one
  navigation ever drawn. *How a screen is drawn* is the second axis, and adds no
  navigation of its own. Both are chosen on one page, **Settings → Layout and
  navigation**, with a drawing of each option. See
  [`app/src/lib/chrome.ts`](app/src/lib/chrome.ts) for the rule and the test that
  holds every combination to it.
- **Nothing with an order is static.** Every ordered list in the app can be
  dragged into a different order — the home screen's icons, folders and dock,
  the tiles on a shelf, the directory's rows, the tabs in the bar, your
  courses, the sections of Today (by the grip beside each heading, on Today
  itself), and everything on the calendar. One gesture,
  one implementation, in [`app/src/lib/arrange.ts`](app/src/lib/arrange.ts),
  with Alt and the arrow keys doing the same job without a pointer.
- **The date is live.** The prototype pinned itself to Thursday 3 September.
  Here every relative label, the class rail, the countdown and the exam radar are
  derived from the real clock, with that Thursday's specifics kept as dated
  exceptions so the design still reproduces exactly on the day it was drawn for.
- **The study content is the real guides**, not the prototype's condensed
  summaries — the three published field-guide artifacts plus the ECON study-guide
  PDF, with their full text, glossaries, exam frames and self-tests.

A fourth decision came later, once there were four courses to keep apart: **each
course wears its own colour**, and it is your accent turned rather than a box of
crayons. One hue anchors the wheel — whichever you chose, on whichever ground —
and your classes divide the rest of it between them, so a deadline row, a class
block, a calendar dot and a load bar all say whose they are before you read a
word. Every hue is held to WCAG's contrast bars against all thirteen grounds by
arithmetic rather than by eye. See
[`app/src/lib/tint.ts`](app/src/lib/tint.ts).

## Audio

Eight recordings ship in `app/public/audio`, wired into each guide's Listen mode
with chapter marks that seek:

- The four original narrated readings.
- Four two-voice podcast editions rendered from `audio/scripts` — including
  BUS 1600, which had no recording before.

Chapter marks were measured from the audio rather than estimated wherever the
recording allowed it. Details in [`audio/README.md`](audio/README.md).

## Starting from nothing

A new account is empty, and says so. **Add your first course** takes a syllabus —
PDF, Word or pasted text — plus any readings you have, reads them in the browser,
and asks Claude for the structure. What comes back is checked before you see it:
dates forced into the real calendar, ids made unique, and every quote tested
against the document it claims to come from, because the app presents those as
the syllabus's own words. Then you get a preview, including what was thrown out,
and decide whether to keep it.

Signing in is optional and does one thing: keeps the same semester on your phone
and your laptop. Accounts live in Supabase, and the two values the app needs to
find it are committed in `app/.env.production` — both are public by design, and
what protects an account is the row-level policy on every table, not the secrecy
of a key that ships inside the page. Signing in also lets you generate a course
without supplying an API key, through a server function that meters usage per
account.

## Six ways through the same material

Each course carries one body of material, and every study mode is a different
route through it — not a different copy. Cards, Read, Watch, Slides, Doc, Quiz,
Cram, Figures, Cases and Listen all read the same guide, so nothing can be
right in one place and stale in another.

| Mode | What it is |
| --- | --- |
| Cards | Tap-to-flip drilling, by unit or whole guide. |
| Read | The guide as prose, unit by unit. |
| Field guide | The whole thing as the published artifact read — masthead, contents, numbered sections with their figures, frames, case files, glossary, self-test. |
| Watch | A narrated lesson per unit — 44 of them — with the slide changing as the voice moves. |
| Slides | The same unit as a deck: one point per slide, question before answer. |
| Doc | The guide as a real .docx and .pdf, plus a print view. |
| Listen | The podcast editions, with chapter marks that seek. |

## Checking the quotes in your own writing

The app already checks quotes in one direction: when a course is generated, every
quote the model wrote is tested against the syllabus, because those are presented
as the document's own words. The same machinery had never been pointed at the
writing the student actually hands in — where a misquotation is not a bug report.

**Check the writing** now runs a second question over the same box. Every passage
in double quotes is looked for in the readings you have added to a course, the
guides built from them, or a file you drop in for the purpose. Three verdicts:
**found** word-for-word; **close**, where the words are there but the punctuation
is not — and the source's own sentence comes back, punctuation included, because
the instruction beside it is *copy those*; and **not in anything here**.

That third one is the wording the whole thing turns on. It is *not* "wrong". The
app holds a fraction of what a student reads, and a screen that turned "I have
never seen this book" into a red flag would be lying in the most damaging
possible direction — about somebody's academic honesty, in a tool they trust. So
the sentence says what was searched in the same breath as what was found, and
nothing is coloured like an error.

An ellipsis is honoured rather than failed on: each side of the gap is looked for
separately and in order, which is exactly what an ellipsis claims. Single quotes
are left alone, because an apostrophe is one and "don't" would otherwise open a
quotation that swallows the paragraph. Your own notes are not searched at all — a
quote found in your own notes has been checked against yourself. Nothing leaves
the device, here or in the rules pass. See
[`app/src/lib/quotes.ts`](app/src/lib/quotes.ts).

## What the exam actually covers

The exam runway counted the whole course. For a final that is fair; for the
midterm PSCI 1104's syllabus describes as "units 1 to 8" it was wrong in the
direction that hurts — fourteen units counted where eight are examinable, six of
them inflating the "untouched" figure, and a weakest-unit recommendation that
could point at material the paper will not ask about.

**Exam runway → Unit by unit** now says what is on the paper, and on whose
authority: what the syllabus said, in its own words, read out of the deadline the
app already keeps verbatim; what you said, in a box that takes "units 1 to 8",
"5-9" or "all"; or nobody, in which case it counts everything exactly as before
and says that is what it is doing.

What it will not do is guess. Three exams and fourteen units could be split
evenly by arithmetic, and a student told "Midterm 2 covers 6 to 10" will revise 6
to 10 — so when the real split was 5 to 9 the app has caused the failure it
exists to prevent. A default that is visibly a default costs nothing. See
[`app/src/lib/covers.ts`](app/src/lib/covers.ts).

## What this term does to your GPA

The app held every number for this and never did the sum. `lib/degree.ts`
computes a GPA and skips in-progress courses on purpose — a course with no
grade has no grade. `lib/grades.ts` knows where each course stands and what the
rest has to be. `lib/worth.ts` projects one course's landing. `lib/cutoffs.ts`
turns a percentage into a letter and a letter into grade points. Four files,
and the question a student actually asks in week ten went to a calculator at
midnight with four syllabi open.

**The degree → This term, projected** answers it, under the cumulative figure it
is going to change rather than on a screen of its own. It is a **band**, never a
number: every input is already a range, and folding four ranges into one
confident "3.62" would be the least earned figure in the app. So: *somewhere
between 2.34 and 3.87 — 3.42 if the rest goes like the graded part*, and the
line under it says what the term does to the cumulative.

A letter is a cliff and the arithmetic treats it as one — 89.94 is a B+, and no
percentage is rounded before the scale reads it. A course with nothing graded, a
course whose credit hours cannot be read from its syllabus line, and a scale with
cutoffs but no grade points are three different holes with three different fixes,
and each is named per course rather than silently dropped.

Then **what would move it**: one grade step in each course, what everything left
would have to average for it, and what the step is worth to the term — which is
not the same in a two-credit course as in a four-credit one. A step that has gone
out of reach is shown as out of reach rather than left off, because knowing a
grade is gone is what stops the hours going after it. See
[`app/src/lib/termgpa.ts`](app/src/lib/termgpa.ts).

## Where two courses meet

Every other study screen is one course at a time, which is how a term is
organised and how an exam is sat — and it makes four courses look like four
sealed boxes. **Study → Where courses meet** compares them against each other:
PSCI 1104 and BUS 1600 both define *margin of error*, ECON 1020's elasticity is
the elasticity BUS prices with, and until now nothing said so. A term you have
already learned once, met again in a second context, is the cheapest revision
there is; two courses using one word for two things is one of the commonest ways
to get a question wrong.

It is matching words, not ideas, and the screen is built around admitting that.
There is no model and no embedding — it is string work on the glossaries, the
cards, the frames and the case files. So it never says two things are the same.
Where both courses define the term, **both definitions are shown side by side**
and the judgement is yours; where one course merely uses the word, the sentence
it was found in is quoted rather than paraphrased. The four grades of evidence —
both define it, one phrase inside the other, defined here and used there, one
word in common — are separate headings rather than one mixed list.

A shared word has to earn its row. Generic academic furniture — *data*, *model*,
*value*, *effect* — joins every course to every other and says nothing, so it is
refused; a single word needs six characters or has to be an acronym; and a course
never meets itself. Four courses in four departments sharing nothing is a real
answer, and the screen says that rather than padding itself out. See
[`app/src/lib/meet.ts`](app/src/lib/meet.ts).

Asking Claude from this screen hands over the pairs and both courses' own words
for them, because *are these actually the same idea?* is the one question here
that no arithmetic can answer.

## Finding things

The search icon is in the header of every screen, and it searches the whole
app rather than the deadlines alone: courses, study units and the cards inside
them, your own notes and tasks, and the app's own screens. Type `monopoly` and
you land on that unit with it already open; type `gmail` and you get **Files &
mail**, without having to know that is what it is called.

Typed wrong, it still lands. `calender` reaches the calendar and `assignmnets`
the work screen, because when a query matches nothing exactly the search tries
again allowing a letter or two out of place — and says that is what it did,
rather than presenting a guess as a match. Only then: a query that found
something is never diluted with the words it is one letter from. See
[`app/src/lib/near.ts`](app/src/lib/near.ts).

The tab bar stays put while you move around — going into a guide no longer
leaves Back as the only exit — and **Me** is a directory of everything the app
can do, grouped, with a line under each saying what it is for.

## Folding a screen down to what you came for

Every section heading in the app, on every tab, is a control: tap it and that
section folds away, leaving the heading as a one-line summary of what is under
it. **Collapse all** at the top of a screen does the lot, and turns into
**Expand all** once everything is shut.

It is one gesture, everywhere — the sections a screen writes, the settings
groups, the ones drawn by a component shared between screens. A course is nine
sections and Today is five; folding the four you are not thinking about is the
difference between scrolling for the reading and seeing it.

What you fold is remembered on that device and nothing else. Not in the
account and not in a backup: which sections you closed on the phone in a
lecture is not a fact about you that the laptop should be told, and a fresh
device shows every screen the way it has always looked.

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

Once an account is connected, the same screen lists its recent files, so the
syllabus sitting in Drive or OneDrive can be opened without downloading and
re-uploading it. There was a second screen behind this one — Files & mail —
that listed the same files again, swept the inbox for course mail and pushed
deadlines out to Google or Microsoft. It has been deleted: two of its three
tabs were already here or under Write an email, and the whole thing was one
more thing to find. Nothing sends mail as you, and nothing did before.

Apple is a third case, and the screen says which half is which: **iCloud
calendars** come in with no account and no key — publish one from the Calendar
app and paste the `webcal://` link — while **Sign in with Apple** gives identity
only, and needs a paid developer account, an https redirect (Apple rejects
localhost) and the dev server to sign its client secret.

Brightspace grades and submissions need D2L's Valence API, which Vanderbilt has
to issue a key for. The calendar feed is what a student can turn on alone.

**oneVU, myVU, YES and AnchorLink** have no API a student can use alone, so the app
links out to them rather than pretending to read them: one tap from Connect,
opening the installed app where the phone recognises the address. Every address
is editable and your edit is what persists — myVU ships with none at all,
because where it opens differs between people and a confident wrong link is
worse than a field that asks. You can add links of your own beside them.

## Claude, in the app

**Study → Ask Claude.** The course guide, its deadlines and what you are
weakest at go in with the question, so the answer is about this course rather
than the subject in general — and an answer worth keeping becomes cards on the
course with one tap.

Three routes to the API, in the order the app prefers them: a proxy you run, the
shared key behind the Edge Function when you are signed in, or your own key on
the device. A key in a browser can be read by anything in that browser — which
is why the shared one lives in a function, metered per account, and why the
screen tells you which route a question is about to take.

## Working on an assignment

**Study → Work on it.** Paste the instructions, or drop the file your professor
posted, and you get the assignment taken apart: every deliverable including the
ones buried in a paragraph about margins, the rubric with its weights, a plan of
four to eight steps dated between now and the deadline, which of your own units
it draws on, a pre-submission checklist, and — the most useful part — the
questions the instructions do not answer, to ask in office hours. The steps
become tasks with one tap.

**Read my draft** gives feedback against that rubric: what is working, the two
or three things that would move the grade most, and any claim your course
material does not support. It does not rewrite your sentences, on purpose — a
paragraph handed back rewritten teaches nothing.

**Anything else** is a general Claude workspace with the course in front of it:
a revision timetable, practice questions, a summary of a reading, an email to a
professor. Anything worth keeping saves as a note.

What it will not do is write the work you submit. Ask it to and it says so in
one line and offers the version that helps you write it. Vanderbilt's Honor Code
is student-run and the work has to be yours.

## Phone, iPad, laptop, or its own window

One build, three layouts and a way of installing it. The two boundaries are
written once, in `app/src/lib/media.ts`, and repeated in the media queries of
`app/src/styles/app.css` because a stylesheet cannot import a constant —
`lib/tiers.test.ts` fails if the two copies ever disagree.

- **Phone** (under 760px) — as drawn, filling the screen: one column, the tab
  bar under the thumb, an 18px gutter.
- **Tablet** (760–1179px) — the tab bar unrolls into a rail beside the content,
  so every iPad in portrait (768–834pt) gets it, and landscape and Split View
  follow the window live. An iPad mini upright, and any half-width split, stay
  on the phone layout at full height. The touch sizes do not change: the finger
  holding an iPad is the finger that held the phone. The content column fills
  whatever the rail leaves, up to a 760px cap so a list row on a landscape iPad
  is not a metre of hairline with its value stranded at the far end.
- **Desktop** (1180px and up) — a window rather than a phone propped up. A
  wider sidebar with room for its labels; the app filling the window instead of
  a 560px column with black either side; a measured reading column with the
  header's title aligned to it; a wider canvas for the screens that are
  genuinely grids; a visible scrollbar; and the screens that have something to
  compare — the courses, the settings index — laid out in as many columns as
  there is room for. The month grid turns landscape and names what is on each
  day instead of drawing four dots under the numeral, which is also what stops
  the last week of the month falling off the bottom of a laptop screen. A
  fourth step at 1600px widens the measure again rather than stranding the
  layout in the middle of a large monitor.
- **Installed** — a manifest, PNG icons (iOS ignores an SVG tile) and a service
  worker make it a real window on macOS or Windows and an icon on a home screen,
  with the app shell and anything you have played working offline. Audio is
  never pre-cached: what you played is kept, and nothing else.

With no signal the app says which of the two kinds of missing it has hit. A
screen is fetched the first time it is opened, so one you have never opened is
not on the device — and that used to be reported as *this app was updated,
reload to pick up the new version*, which was false and prescribed the one
action that cannot work without a connection. It now says the screen has not
been downloaded and puts Today, which is on the device, first. The map is the
other one: its tiles are the single thing on that screen needing a connection,
and rather than drawing an empty panel it says so, over the map, until a tile
arrives. See [`app/src/lib/fault.ts`](app/src/lib/fault.ts).

Every difference between the three is a value in one block at the top of
`app/src/styles/app.css` — the gutter, the measure, the canvas, the rail's
width, the standalone column, how square a day in the month is — so a screen
asks for "the page gutter" and never asks which layout it is in.

## Not yet in

The ECON interactive study guide lives inside a Claude chat rather than as a
published artifact, so it could not be read from here. Its content is already in
the app from `econ1020_study_guide.pdf`, which is the same guide — but if the
interactive version has extras worth pulling in, publishing it (as the other
three field guides were published) makes it readable.
