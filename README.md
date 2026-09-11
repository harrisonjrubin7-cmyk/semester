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

## <!--modes-->Eleven<!--/--> ways through the same material

Each course carries one body of material, and every study mode is a different
route through it — not a different copy. **Cards**, **Read**, **Field guide**,
**Watch**, **Slides**, **Doc**, **Quiz**, **Figures**, **Cases**, **Cram** and
**Listen** all read the same guide, so nothing can be right in one place and
stale in another.

The count and the list are written from `app/src/lib/modes.ts` rather than by
hand — `npm run counts` fills the number, and a test holds the list to the
same registry. Both had drifted before that: this heading said six, the
sentence under it named ten, and the table listed seven.

| Mode | What it is |
| --- | --- |
| Cards | Tap-to-flip drilling, by unit or whole guide. |
| Read | The guide as prose, unit by unit. |
| Field guide | The whole thing as the published artifact read — masthead, contents, numbered sections with their figures, frames, case files, glossary, self-test. |
| Watch | A narrated lesson per unit — 44 of them — with the slide changing as the voice moves. |
| Slides | The same unit as a deck: one point per slide, question before answer. |
| Doc | The guide as a real .docx and .pdf, plus a print view. |
| Quiz | Multiple choice, marked as you go, with the wrong answers drawn from the guide itself. |
| Figures | The diagrams — curves, flows and frames — each with what it shows. |
| Cases | The worked examples in full, with the reasoning left in. |
| Cram | Everything on one page for the night before: no flipping, no waiting. |
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

Beside the search icon is a grid of nine squares, and it is the other half of
the same job. Search finds a screen if you can name it; the grid is for the
half of the app you have seen once and cannot — the practice paper, the deck
builder, the thing that draws a diagram. It opens every screen the app has as
an icon with its name under it, filed under the shelf it lives on, over
whatever you were reading rather than instead of it: choose one and you are
there, change your mind and you are back on the page you were on.

It is on every screen, including the ones three levels into a course, which is
where the directory on **Progress** is furthest away. The order inside a shelf
is whatever you dragged your tiles into on **Progress → Everything**, so the
two cannot disagree about where you put something.

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

## Your profile

The round button at the top right of every root screen, which is where every
phone puts it. It opens **Profile**: the name the app calls you, what the app
is holding of yours, and a row into each of the screens that own the rest —
Account, Your data, Privacy, Take it with you, Settings.

The name is the one thing the screen owns rather than points at. It was a field
on Settings → Courses, because until there was a profile there was nowhere else
to put it; there is one box for it now and Settings keeps a row saying where it
went. Everything else on the profile is a link, deliberately: signing in is
explained by the account screen, byte counts belong to the data screen, and a
profile that re-implemented either would be a second door onto a room that
already has one.

The avatar is your initials, and only ever from the name you typed. It is never
guessed at from an email address — that is the promise
[`app/src/state/shape.ts`](app/src/state/shape.ts) makes where the field is
declared, and an avatar is exactly where it would get broken quietly, because
`H` from `harrison@…` looks like a reasonable guess and is somebody's name
invented and shown back to them as fact. With no name there are no initials:
the button draws a figure, and the screen asks.

There is no photograph, no bio and no "member since". A photograph needs bytes
in the same quota that already sheds data when it fills, and uploading one
needs a server this app does not have. A bio is for other people to read and
there are no other people here. The line at the foot says how long your
semester has been on this device, which is the date you would actually want
before wiping a phone.

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

## Making things: documents, sheets, tables and equations

The app could turn a semester into a deck and into CSV and could do nothing
between those two. So a memo with a table in it, a gradebook weighted by the
syllabus's own percentages, and every formula an econ or statistics course
prints happened in Word, Excel and a screenshot — and everything the app knows
stayed behind. Three screens now, on the **Make** shelf, and none of them has a
model in it or needs a key:

- **Write a document.** A block editor — headings, paragraphs, lists,
  quotations, tables, equations, page breaks — out as a real `.docx`, as
  Markdown, or printed to PDF from the browser. It is not **Draft it**, which
  writes prose and is fenced off from coursework, and it is not **Work on it**,
  which plans an assignment and refuses to write it. This one arranges what you
  type. Paste notes or Markdown in and it reads headings, lists, tables and
  `$$…$$` equations into blocks you can edit.
- **Sheet or table.** A grid you type into, with formulas computed on the
  device: `SUM`, `AVERAGE`, `MEDIAN`, `STDEV`, `MIN`, `MAX`, `COUNT`, `IF`,
  `ROUND`, `SQRT`, `SUMPRODUCT` and the arithmetic around them. It is a
  spreadsheet rather than a grid of text boxes: a **selection** you drag or
  arrow across, whose sum, average, count and range are read off the status
  line rather than written as a formula and deleted again; a **name box and
  formula bar**, because the cell is 92 pixels wide and `=SUMPRODUCT(B2:B9,C2:C9)`
  is not; a **toolbar** that puts a picture over a number — percentages,
  money, decimal places, bold, alignment — without changing the number
  underneath it; **undo and redo** inside the grid; and a **tab strip** along
  the bottom, so the gradebook and the budget beside it are one tap apart.
  It opens on **templates** — a to-do list, a monthly and a term budget, a
  reading tracker, a lab's readings — each arriving with its totals already
  written, beside the gradebook built from your own syllabus's weights. Out as
  a real `.xlsx` **with the formulas and the formats still in it** — a CSV of a
  gradebook is the answers with the working thrown away — or as a CSV, a
  Markdown table, or a table dropped into a document. A pasted table is read
  whether it is a copy out of Excel, a CSV or Markdown.
- **Equations, worked out and drawn.** A small piece of LaTeX — `\frac{a}{b}`,
  `x^2`, `x_i`, `\sqrt{x}`, `\sum_{i=1}^{n}`, `\bar{x}`, the greek and the
  relations — written once and rendered three ways: MathML on screen, a real
  Word equation object in the `.docx`, and one line of ordinary text for
  anywhere else. It opens on a library of the fifteen formulas these courses
  actually use, each with **every symbol named**, because that is the half a
  picture of an equation loses and the half a marker looks for.

  The same notation is now also **worked out** and **graphed**, by one engine
  with one test file: `app/src/lib/calc.ts`. *Work out* takes the formula you
  wrote — or one from the library, or one you kept — lists its letters, and
  fills in the answer as you name them, so a present value is `FV`, `r` and `n`
  rather than a line of brackets retyped into a phone keypad, which is where
  the bracket goes missing and the answer comes out plausible. *Graph* is the
  expression list beside the picture that every graphing calculator has:
  `y = 2x + 3`, `x = 4`, `x^2 + y^2 = 25` drawn as a relation by marching
  squares, `f(x) = …` for definitions, `a = 2` with a **slider**, `(2, 3)` for
  a point, and a list — `a = [1, 1.5, …, 4]` — drawn as a family of curves.
  Drag to move, pinch to zoom, press to read a point off it, and one button to
  fit the window to what is actually on it.

  Then the part a calculator leaves you to hunt with a cursor, written out
  instead: **where it crosses zero, where it turns, where two curves meet, the
  slope under your finger, and the area between two values** — bisection,
  thirds and Simpson's rule in `app/src/lib/plot.ts`, each with the test that
  holds it. An asymptote breaks the line rather than being joined through, one
  unit across is one unit down so a circle is round, and a reading is reported
  to the precision it was measured at rather than to twelve figures of false
  confidence.

**Make a deck** gained a third door beside *From a unit* and *From a brief*:
**From a sheet** puts a table you built onto slides as a real PowerPoint table
you can still edit, split across several slides when it is long rather than
shrunk until nobody at the back can read it.

And editing a deck is **the slide**, not a form about it. The middle of the
screen is the slide itself at sixteen by nine, in the deck's own colours, with
the title and the points where the exported file puts them — because the two
faults you cannot fix afterwards are a title that runs to three lines and
eleven points on a slide that holds six, and a stack of labelled boxes hides
both until the export. A rail of real thumbnails down the side, a layout you
can change on a slide that already exists (and which says what the change would
throw away before it does it), four **themes** — two for a projector, two for
printing — that go into the `.pptx` so the file opens in the colours you chose,
and speaker notes under the canvas where every slide editor puts them. The
presenter view draws from the same code, so what is on the wall is what is in
the file.

Two arithmetic engines, and they stay two. `app/src/lib/sheet.ts` evaluates
`=SUM(B2:B9)` against a grid of cells — A1 references, ranges, lookups, dates,
and now the scientific functions and a fitted line: `SIN`, `LOG` to any base,
`FACT`, `COMBIN`, `QUARTILE`, and `SLOPE`, `INTERCEPT`, `RSQ` and `FORECAST`
over two columns. `app/src/lib/calc.ts` works out a formula with *letters* in
it. Neither of those is the other wearing a hat, and what was refused before —
an equation renderer that quietly computed — is still refused: the engine that
does the arithmetic here is one engine with a test file that makes the sentence
true. Neither will rearrange: `x + 3 = 7` is drawn and tested, never solved for
x, because symbolic algebra is a different program and one that half-solved
would be worse than none.

An error is said rather than resolved to something that looks like an answer —
`#DIV/0!`, `#CYCLE!`, `#NAME?` in a cell; a blank and the name of the letter
you have not given a value to, on the calculator — because a spreadsheet is the
format where an invented figure travels furthest and a graph is the one where
it is hardest to notice.

Three writers, no libraries: `app/src/lib/docx.ts`, `app/src/lib/xlsx.ts` and
the `app/src/lib/pptx.ts` that was already here each write OOXML directly, the
way the app already *reads* a `.docx` syllabus. And the assistant can propose
any of them — `make_document`, `make_sheet` and `save_equation` in
`app/src/lib/tools.ts` — as a confirmation you accept, with an undo decided
before the write happens like every other tool in that file.

### They open the way every editor opens

Three screens that make a file, and each had invented its own furniture: the
title was a form field on two of them and absent on the third, the exports were
three stacked buttons under "Take it away" on one and four under the same words
on the next, and deleting the thing you were editing was a full-width button at
the very bottom of the page. None of them had the one thing Word, Pages, Excel,
Docs, Sheets and Keynote all have — a bar across the top reading **File · Edit ·
View · Insert · Format · Tools · Help**.

They all have it now, and it is the same bar, drawn once from a list. A menu
item with nothing behind it is greyed rather than left live, because a control
that does nothing when pressed cannot be told from a broken one. The menus read
in the order those applications read them, which is the order in the muscle
memory of anybody who has used any of them — so the reading is free, and a test
fails rather than a screen inventing a seventh menu called Actions. On a phone
the whole bar folds into one button whose panel lists every menu under its own
name; nothing is hidden, because a menu you have to discover by dragging a row
sideways is a menu that does not exist.

The bar does not replace a toolbar and is not replaced by one. Sheet keeps its
pictures — the formats, bold, the alignments, undo — one press away, and the
deck keeps its six slide actions, for the same reason Excel and PowerPoint keep
both: a button is for the hand that knows where it is, and a menu is for
everybody else.

**Write** and **Make a deck** now open on a shelf rather than a list: a row of
things to start from — a blank, then the seven document shapes that used to be
behind a button nobody pressed — and then everything you already have, under
**Today**, **Previous 7 days**, **Previous 30 days** and **Earlier**, as
thumbnails or as rows, sorted three ways and narrowable to one course. The
thumbnails are the real thing small: a document's own first lines, a deck's
first slide as a slide. Sheet has a shelf of its own, built alongside this one
and richer in one way this is not — it knows when a sheet was last *opened* as
well as last edited. Folding the two into one is worth doing and is not done
here.

What is deliberately absent is keystrokes printed beside the commands.
`app/src/lib/keys.ts` is right that a shortcut carrying Meta or Control belongs
to the browser, and a label for a binding the app has not made is worse than no
label at all.

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

## Work that knows which deadline it is for

Everything the app can make — a document, a sheet, a deck, an equation, a note,
a file dropped into the drive — could say which **course** it belonged to, and a
course is four months and a dozen deadlines wide. So the response paper due
Friday, the one due in November and week two's reading notes were all filed
identically as "ECON 1010", and the last step of every evening's work was the
same hunt: open Make, open Write, read six documents called *Draft* and guess.
Nothing was lost. It was just never in the same place as the thing it was for.

Each of those six now carries the deadline it is for as well as the course, and
the link is shown from both ends:

- **On the deadline.** Under the plan that breaks it into evenings, *Work for
  this* lists everything filed against it, and **＋ Document · Sheet · Deck ·
  Note · Upload** make something **already** filed against it — a picker you
  have to remember to use is a picker most work never reaches. Anything that
  already exists attaches from the same panel. **Unfile** takes the link off and
  leaves the work alone; nothing here deletes a draft.
- **On everything that makes something.** *What it is for* sits under the course
  chips in the document editor, the sheet, the deck editor, the equation screen,
  the note editor and the drive — the course's own deadlines, what is still
  ahead first and what has gone by after it, because the second commonest case
  is the thing that was due yesterday and is being finished now.
- **Back on the lists.** A deadline with work against it wears a paperclip and a
  count wherever it is drawn — Today, the calendar, the course page. A file in
  the drive says *for Quiz #1* beside its size and its course, and search finds
  a document by the deadline's name as well as by its own, because "the Rawls
  essay" is how people refer to a document called *Draft 3*.

A deadline can be edited out of a course, so a link can lose its other end. One
rule, in one place: a dangling link reads as **no link** rather than as a broken
one, and the id is left on the work rather than scrubbed, so re-importing the
course brings the filing back. `app/src/lib/forwork.ts` is the only module that
reads it; `app/src/lib/clips.ts` is what makes asking "how much is filed against
this" affordable on forty rows at once.

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
