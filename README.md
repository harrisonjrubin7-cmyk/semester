# Semester

Upload your syllabi; get the semester back as an app — every deadline with the
sentence it came from, a study guide you can drill, narrated lessons, a deck, a
document, and a calendar that knows when your classes are.

Built first for one Vanderbilt semester (Fall 2026, four courses, by hand), then
generalised: anyone can sign in, upload their own syllabus and readings, and get
the same thing for their own courses.

It has since grown past the term it started as. Alongside the coursework there
is a place to make things that are not documents, the university's own services
with an honest account of which parts this app can do anything about, and four
workspaces for the parts of a degree that outlast a semester — the season you
train for, the job you are applying to, the people at home, and the degree after
this one. Those are the three sections near the end of this file.

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
  a tab bar against a single filtered feed; rather than pick, both ship, and
  three more joined them — the springboard, the shelves, and the **workspace**
  the app is now laid out as: a browser-shaped shell with a tab strip across the top,
  one search bar under it on every screen, a nine-dot launcher, a Drive-style
  directory of all 54 apps, and a sidebar where the window is wide enough.
  They are one axis — *how you move* — with exactly one
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

## Tabs, groups and bookmarks

The workspace is a browser-shaped shell, and the strip across the top is what
makes it one: a tab holds a place in the app, so "I was reading the guide, let
me check when that is due, now where was I" costs a click rather than four
navigations and a hunt for your place. A tab with nothing in it yet is a new
tab, and a new tab is the search page — opening one and typing is a single
gesture for *somewhere else, without losing this*.

**Groups** are for the Wednesday when there are nine of them. Right-click a tab
(or press the ⌄ on the one you are on) and **New group**: it and everything you
open out of it become one run on the strip, behind a coloured head you can
name. **Midterm** and **Essay** are then two objects rather than seven tabs,
and clicking the head folds the run away to its name and a count — which is
how a strip that has reached ten gets its room back. Folding the group you are
working in moves you out of it first, because its page is the window. The
colour is one of twelve, and they are the same twelve a course can be pinned
to: your accent, turned round the wheel, at a lightness measured against the
ground you are actually reading on.

The strip holds a hundred, which makes it somewhere to *keep* tabs rather than
a row anybody reads end to end — so the caret at the end of it opens **the open
tabs as a list**: every one of them in the strip's own order, with the group
each belongs to beside it, filtered as you type and forgiving of a typo the
same way the rest of the app's search is. Enter opens the one under the
cursor. It appears once there are four tabs; below that the strip is the
search. Each row also says whether its tab has a voice: a speaker on the one
that is playing, and a crossed one on a tab that is **muted and silent** —
which the strip never shows, because the strip is short of room and that state
has nothing happening to point at. It is the setting **Mute this tab** leaves
behind, and this is the only place you can see it or undo it. Pressing either
does what the strip's speaker does.

Under them is **Recently closed**, because the cross is eight pixels from the
name and on a phone that is inside a thumb: the last ten tabs you shut are
there to be put back, with what they were — the screen, the name, the group —
into the seat they were closed from, and one press does it. It survives a reload, which is
what a list kept on the strip can do and a list kept in a variable cannot.
Ten, and no more: a list of everything closed this term
is a history of your term, which is a different thing to keep and not one this
app decided to. **Clear** is beside the list, where somebody is when they want
it gone.

**Pinning** is the other half of a strip that has got long. The four or five
places you are in every day — Today, the calendar, the guide you are working
through — are never finished with, and everything else is opened beside them.
Pin one from its menu and it keeps its place at the front of the strip as its
glyph alone: five of them cost the width of a name rather than half the row,
a line separates them from what you merely have open, and they carry no cross,
because a target that small with a close on it is a tab you lose to a thumb
landing an inch out. Closing one is in the same menu, where it takes saying so.

Tabs are dragged into the order you want them in, the same hold-move-let-go
the rest of the app uses for anything with an order — and on the strip the
drop means something as well: let a tab go among a group's tabs and it joins
the group, drag it clear of them and it leaves. Alt with the left and right
arrows does the same without a pointer.

**Muting** is for the tab that is talking. A lesson is forty minutes of
narration and the thing you put on walking across campus, so it keeps playing
when you go and look at something else — the player is one element that lives
above every screen, and the *tab* owns it rather than the page. Whichever tab
is playing grows a speaker, and it is a button: press it and that tab goes
quiet without you having to go to it, which is the question every browser
added this control to answer. Muting is not stopping. The lesson runs on and
keeps its place, the way turning a tab down differs from closing it, and the
mute is remembered — a tab you silenced on the bus is still silent when you
come back to it, and **Mute this tab** in the menu silences one before it has
played anything at all, which is what you want in a library.

A sound ends the way it would in a browser: close the tab that owns it, or
navigate that tab somewhere else, and it stops. Only one thing plays at a
time — this is a place to study, and two narrations over each other is not a
feature anybody asked for.

**Bookmarks** are the other half. A tab is where you are; a bookmark is where
you keep going back to — the ECON study guide, the essay brief, the deadline
you are counting down to — and before this the only way to keep one to hand
was to leave a tab open for a fortnight. The star in the search field saves the
page the tab you are on is showing, `b` does the same from the keyboard, and
what is saved is the *place*: ECON 1020 rather than "Course", the guide unit in
the mode you were reading it in. They appear as a row under the search field,
one click from every screen; on the other navigations they are on the new tab
page and in the search overlay instead, because that is where those layouts
keep their tabs. Clicking one goes there in the tab you are on, middle-clicking
opens it beside, and the ⌄ on a chip renames it, moves it along the row or
removes it.

Neither the strip nor the bookmarks are account data. The store syncs to the
cloud and is what a backup contains; which places you happen to have open on
this laptop is neither, and a row of tabs restored onto a phone from a
desktop's backup is a row nobody opened. Both live on the device, under their
own keys, and **Erase from this device** takes them with everything else. See
[`app/src/lib/browser.ts`](app/src/lib/browser.ts) and
[`app/src/lib/bookmarks.ts`](app/src/lib/bookmarks.ts).

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
deadlines out to Google or Microsoft. It has been deleted: its files tab was
already here, its mail tab is now the Email screen itself — a whole mailbox
rather than a sweep — and pushing dates out lives here, under the accounts it
writes to. Nothing sends mail as you, and nothing did before.

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

## Email, in the shape you already know

**Email** is a mailbox: a rail of folders down the left, a list of
conversations, the message in a pane beside it, and compose docked over the
bottom right. That is Gmail's layout and Outlook's, to within a few pixels, and
it is deliberate — a mailbox that invented its own arrangement is one nobody
can use without being taught.

What is in it is the same vocabulary: **Inbox, Starred, Snoozed, Drafts, Sent,
Archive, Spam, Trash**; Gmail's **Primary / Social / Promotions / Updates**
tabs; conversations gathered by the provider's own thread; unread in bold; a
star you can hit without opening anything; archive, delete, snooze and mark-read
under the pointer where the date was, and across the top for everything
selected; date headings — Today, Yesterday, This week — the way Outlook cuts a
long list; `1–50 of 566` in the corner; reply, reply-all and forward with the
original quoted and folded; a reading pane you can put on the right, underneath,
or switch off. Search takes the operators both clients take — `from:stromme`,
`subject:"problem set"`, `is:unread`, `has:attachment`, `label:` — and asks the
provider as well as what is already loaded, so it reaches past the page in front
of you. On a phone it is the phone client: one pane at a time, folders behind a
button, compose as a sheet.

Two things in it are this app's rather than a mail client's. Every message that
names one of your courses wears that course's colour, and your courses are
labels in the rail — no filter to set up. And a message can become a task, or be
handed to **A change to a date**, which reads an announcement into proposed
edits with the sentence each one rests on quoted beside it.

**It reads; it never sends.** The scopes are `gmail.readonly` and `Mail.Read`,
and they are not going to change: a study app that could delete a professor's
email or post one as you is a bigger promise than this one makes, and the
failure mode is unrecoverable. Everything above still works, because reading,
starring, archiving, snoozing and deleting here are *your* marks kept over the
provider's copy — the app's own view of your inbox. What they do not do is reach
back into Gmail, and the screen says so rather than letting you find out. Every
message carries a link to the real one.

Writing is the screen this used to be, now inside the compose window under
**Help me write**: the nine things a student email ever is — an extension, a
question, a meeting, an absence, a grade, a recommendation, a follow-up, a
reply, a thank-you — the deadline it is about, and a box for the facts in your
own words. Nothing factual about you is invented: a reason you have not given
comes back as `[a blank]` to fill in, because putting a made-up excuse in your
name into a professor's inbox is a lie told on your behalf. **Send** opens the
finished draft in Gmail or Outlook with every field filled in, and you press
send there; the draft moves to Sent here at that moment, which is the last thing
the app can honestly know about it.

Drafts and Sent need no account at all — they are the app's own, and they
persist, because the commonest thing that happens to a student email is that it
gets half written and left.

## Making things: documents, sheets, tables and equations

The app could turn a semester into a deck and into CSV and could do nothing
between those two. So a memo with a table in it, a gradebook weighted by the
syllabus's own percentages, and every formula an econ or statistics course
prints happened in Word, Excel and a screenshot — and everything the app knows
stayed behind. Three screens now, on the **Make** shelf, and none of them has a
model in it or needs a key:

- **Write a document.** A block editor — headings, paragraphs, lists,
  checklists, quotations, tables, pictures, equations, code blocks, a contents
  page, dividers, page breaks — out as a real `.docx`, as
  Markdown, or printed to PDF from the browser. `**Bold**`, `*italic*` and
  `[a link](vanderbilt.edu)` are written the way Markdown writes them, and a
  link becomes a real hyperlink in the Word file rather than an address typed
  out dead on the page. Three schemes are allowed behind words — http, https
  and mailto — and anything else keeps its brackets and stays on the page as
  text, because a document is as often somebody else's writing pasted in. It is not **Draft it**, which
  writes prose and is fenced off from coursework, and it is not **Work on it**,
  which plans an assignment and refuses to write it. This one arranges what you
  type. Paste notes or Markdown in and it reads headings, lists, tables and
  `$$…$$` equations into blocks you can edit.

  A **checklist** is a list you can tick, and each item remembers whether it is
  done — out as `- [x]` in Markdown and as a ticked box in Word. A **code
  block** is the one place in the app where nothing is read as markup: `**` in
  a shell glob or a Python power operator is two asterisks somebody typed, not
  a request for bold, and the indentation that carries half of what code means
  survives into the Word file. Its Markdown fence grows longer than any run of
  backticks inside it, so a snippet *about* Markdown does not quietly end its
  own block halfway down.

  A **picture** is one of your own files — a PNG, a JPEG or a GIF, chosen from
  the drive or added from the device on the spot — with alt text and a caption
  beside it. The block holds the file's id and not its bytes: a document is
  saved in the browser's local storage with everything else, and a single
  phone screenshot written into it would spend the whole budget on one figure,
  so the picture stays in the drive and the export goes and fetches it. Two
  consequences worth knowing. A screenshot 1200 pixels wide is twelve and a
  half inches at the size Word reads pixels, so it is brought down to the
  6.5-inch text column — Word draws exactly the size it is told, and a picture
  written out at its natural size runs off the paper. And a file you later bin
  is not a broken document: the caption still exports, the picture does not,
  and the editor says so and offers to find another. The alt text is separate
  from the caption on purpose — it is what a screen reader in Word reads out,
  so it says what is *in* the picture, where a caption says what to make of
  it.

  A **divider** is a line between one section and the next, and a **page
  break** starts a new page. Two blocks, one line apart on the Insert bar,
  because they are two different things — which they had not been. The page
  break used to write `---` to Markdown, and `---` is Markdown's *thematic
  break*: a divider. So a document exported from here said divider and meant
  page break, and re-importing it only worked because both ends were wrong in
  the same direction. The divider has `---` now, which was always its
  spelling, and the page break is written as an HTML comment — invisible in
  GitHub, Obsidian, Pandoc and anything else that reads Markdown, so there is
  no noise where the page breaks were. One thing this costs, worth knowing
  rather than finding out: a Markdown file exported from this app *before*
  now will re-import its page breaks as dividers. That is the right reading
  of `---` and the wrong answer for that file, and it is visible on the page.
- **Sheet or table.** A grid you type into, with formulas computed on the
  device: `SUM`, `AVERAGE`, `MEDIAN`, `STDEV`, `MIN`, `MAX`, `COUNT`, `IF`,
  `ROUND`, `SQRT`, `VLOOKUP`, `SUMPRODUCT` and the arithmetic around them. It
  has the shape every spreadsheet has, because that shape is already in the
  hands of anybody who has opened one:
  - a **ribbon** — Home, Insert, Formulas, Data, View — with its controls in
    named groups (Clipboard, Font, Alignment, Number, Cells, Editing), rather
    than the flat row of fifteen buttons it was;
  - a **name box and formula bar**, because the cell is 92 pixels wide and
    `=SUMPRODUCT(B2:B9,C2:C9)` is not, and because typing `C14` into the name
    box should go there;
  - **frozen headings** and a **corner box** that selects the whole sheet, so a
    column of numbers whose heading has scrolled away stops happening;
  - a **status bar** carrying the selection's sum, average, count and range —
    the commonest question anybody asks a spreadsheet, answered by looking
    rather than by writing a `SUM` and deleting it again — plus the zoom;
  - a **tab strip** along the bottom, so the gradebook and the budget beside it
    are one tap apart.

  A formula can **read another sheet**: `=Marks!B2`, or
  `=SUM('Q1 marks'!B2:B9)` where the name has a space in it. That is the half
  of a spreadsheet that turns four separate grids into one model — a term
  sheet that totals a gradebook, a budget that reads a plan — and it comes
  with the two things that make it safe to rely on. **Rename a sheet** and
  every formula naming it follows, re-quoted if the new name needs quotes.
  **Insert or delete rows on it** and every formula on every other sheet
  pointing into it moves with them, undo included: the alternative is a total
  that quietly adds up the wrong nine rows with nothing on either screen
  looking wrong. A name no sheet has, or one that two sheets share, reads
  `#REF!` rather than guessing which grid was meant. Saving as Excel brings
  the sheets a formula reads along with it, under the names the tabs will
  actually carry.

  A **filter** hides the rows you are not looking at — pick a column, a test
  and a value, and set one on as many columns as you like. It hides rows and
  changes no number: `=SUM(B2:B20)` still adds up what is hidden, exactly as
  it does in Excel. That is the trap every spreadsheet has, so the figure
  people actually read for *so what does this come to* — the status bar's sum,
  average and count under the selection — counts only the rows you can see,
  and says how many it left out.

  And cells can **colour themselves**: a rule like *C2:C20, less than 60, red*
  paints the marks that are under sixty and keeps painting the right ones when
  a mark changes. A rule, not a colour: painting three cells red by hand and
  then editing one leaves the red where it was, which is worse than no colour
  at all because it is a claim about a figure that is no longer true. An empty
  cell is never painted by a numeric rule — a column of marks nobody has
  entered yet is not a column of zeroes.

  Both go into the `.xlsx` as what they are — hidden rows under a real
  autofilter, and real conditional-formatting rules — so taking the filter off
  in Excel brings the rows back and changing a mark there changes its colour.

  A block of cells can be **given a name**, and then a formula anywhere in the
  workbook can say what it means: `=AVERAGE(Marks)` rather than
  `=AVERAGE('Q1 marks'!$C$2:$C$40)`. A name is the only part of a spreadsheet
  that says out loud what a range *is*, which is why the sheet somebody
  inherits is unreadable and the one they wrote is not. It is a pointer, not a
  copy — insert rows inside the block and the name stretches over them, rename
  the sheet under it and the name follows, so it goes on meaning the marks
  rather than going on meaning rows 2 to 40. A one-cell name reads as that
  cell, so `=Rate` is a rate. Names go into the `.xlsx` as real defined names,
  under the tab names the file will carry, so `=SUM(Mark)` still adds up in
  Excel.

  And a block can be **summarised**: pick what to group by, what to measure and
  how — count, sum, average, smallest, largest — and the answer is a small
  table under the grid, with a second field if you want it down one edge and
  across the other. It is the question a spreadsheet is usually opened to
  answer — *what is the average mark per course, per term* — and the thing
  people do instead is sort the block, eyeball the runs and type the totals in
  by hand, which is a figure with no working behind it. A total is gathered
  from the values, never averaged from the averages, which is the arithmetic
  mistake that makes a hand-built summary wrong by a little. Past sixty groups
  it stops drawing and **says how many rows it left out of the totals**,
  because a summary that quietly answers a narrower question than the one
  asked is worse than one that refuses. And **Put it in cells** writes it into
  the sheet as live `SUMIFS` and `AVERAGEIFS` rather
  than as the answers, so it is still right after somebody changes a mark —
  in the app and in Excel, which both compute the same formula.

  A block can be pasted **five ways**: everything, the values alone — every
  formula becoming the answer it had, which is how a computed column is frozen
  before the sheet it was computed from is thrown away — the formulas without
  the colours, the colours without the contents, or transposed, so a row lands
  as a column. Pasting formatting changes no value, which is the whole of what
  somebody means by "make this column look like that one".

  And a block can be told **what it is allowed to hold**: one of a list of
  values, a whole number, a number, a number in a band, or text no longer than
  so many characters. A list is also an offer — the cell drops down the values,
  so nobody types `ECON 1O2O` with a letter O in it.

  It **marks; it never refuses and never changes anything.** A cell here is
  written on every keystroke rather than on Return, so a rule of *between 50
  and 100* that refused bad input would refuse the `8` on the way to `85` and
  the column could never be typed into. That turned out to be the better answer
  anyway: a rule that can reject is a rule that can lose what somebody typed.
  So a cell that breaks its rule is underlined, counted in the status bar, and
  the status bar says what the rule wanted — and the number underneath is still
  the number they typed. It is also why the marking is worth having, because
  Excel validates only what is *typed*: paste, fill and import all walk past it
  silently, which is exactly how a validated column fills up with values that
  break its own rule. Here the rule is re-read on every render, so a value that
  arrived by any road at all is checked the same way. The rules go into the
  `.xlsx` as real `dataValidation` elements, so the dropdown is a dropdown in
  Excel too.

  Long text can **wrap** rather than running off past the edge — which cost
  more than a line of CSS, because a cell is an `<input>` and no CSS folds
  one; a wrapped cell is drawn as a text box that can hold lines, and only a
  wrapped one, so every other cell is what it always was. Alt-Return puts a
  break in by hand.

  And a block can be **joined into one cell**, which is what a title across the
  top of a gradebook needs. Joining keeps the top-left value and clears the
  rest, and says how many it cleared. Keeping them hidden instead would have
  been the tempting thing and the wrong one: `=SUM(A1:C1)` would then add up
  two values nobody can see, on a sheet that shows one — the hidden-row trap
  again, with no filter visible to explain it. So what is shown is what is
  summed, and undo takes back the block and the values together. Both go into
  the `.xlsx` as what they are: a real `mergeCell`, and a real `wrapText`
  alignment.

  And the corner of the selection is a **fill handle**: drag it to pull a
  formula down a column or across a row, or press it to fill as far as the
  column beside it goes — which is what double-clicking it does in Excel, and
  is a real button with a name, so it works from the keyboard too. It is also
  what finally makes `$` mean something on the screen: until something moved a
  reference, nothing needed holding still.

  What it can now do to a sheet, none of which it could before: **rows and
  columns inserted and deleted in the middle**, with every formula rewritten to
  follow — a range a deletion reached into *shrinks* rather than breaking, and
  a reference to something genuinely gone says `#REF!` rather than quietly
  pointing one row down; **fill down and fill right** (⌘D and ⌘R), where `$`
  finally means what it means everywhere else — `=B2*$F$1` dragged down a
  column keeps the rate in F1; **cut, copy and paste** of a block, carrying its
  formulas in the app and tab-separated text to and from Excel; **sort** a
  block by one of its columns, refused outright where a formula in it would be
  broken by the move; **find and replace** over what was *typed*, not over the
  answers; and **type colour, fill colour, borders, underline and type size**
  beside the pictures — percentages, money, decimal places, bold, alignment —
  none of which change the number underneath. **Undo and redo** cover all of
  it, one step per thing you did.
  And it can **chart** what is in it: select a block, Insert → Chart, and
  columns, bars, a line or a pie are drawn under the grid in your own accent,
  from the *answers* rather than from the text, so a column of `=B2*C2` charts
  as the products. A bar starts at zero and a line does not have to — the
  first is how a chart lies and the second is how one stops saying anything —
  and a chart says what it is leaving out, because a pie draws one series and
  a column of grade letters cannot be drawn at all. The chart goes into the
  `.xlsx` as a live one, pointing at `'Term marks'!$B$2:$B$5`, so editing the
  cell in Excel moves the bar; the picture saves on its own as an `.svg` with
  its colours resolved. Data → **Analyse** sends the same numbers to the
  statistics screen — mean, spread, correlation, a fitted line — which until
  now could only be reached by pasting a table into it.
  It opens on **templates** — a to-do list, a monthly and a term budget, a
  reading tracker, a lab's readings, a grade calculator and a GPA planner —
  each arriving with its totals already written, beside the gradebook built
  from your own syllabus's weights.

  Those last two also come **built from what the app already holds**. The grade
  calculator is weighted the way your syllabus weights it. The **GPA planner**
  lists this term's courses with their credits, adds what is already on your
  record, and answers the question a student actually asks in week ten: *what
  would the rest of this term have to average for me to reach 3.6?* — and says
  when the answer is out of reach, rather than printing 10.95 and leaving you
  to work that out. The grade-point scale is a visible table in the sheet that
  every lookup reads, because a GPA depends entirely on what an A is worth and
  schools disagree; if yours counts A+ as 4.3, that is one cell to change and
  the whole sheet follows. A term GPA counts the credits that *have* a grade,
  not the credits taken — dividing by the latter makes one A in a ten-credit
  term read 1.2. Out as
  a real `.xlsx` **with the formulas and the formats still in it**, colours and
  borders included — a CSV of a gradebook is the answers with the working
  thrown away — or as a CSV, a Markdown table, or a table dropped into a
  document. The six colours are chosen twice, once for this app's dark panel
  and once for Excel's white page, so a cell marked red reads as red in both. A pasted table is read
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

  **A `z =` line is a surface**, in three dimensions: `z = x^2 - y^2` is the
  saddle, drawn over whatever window the axes are set to and turned with a
  finger. No WebGL and no 3D library — a surface plot of a formula is a few
  hundred quadrilaterals sorted back to front, which is the painter's
  algorithm, and it draws in the same SVG as everything else, prints, and
  costs nothing to ship. The camera is orthographic on purpose: a perspective
  one makes the far side of a symmetric bowl smaller than the near side, which
  reads as asymmetry in the function. Everything is worked in a unit cube, so
  a function reaching 10,000 and one reaching 0.001 are both a shape rather
  than a spike or a sheet; a piece with a corner that has no height is left
  out rather than drawn across, which is the hole in a dome; and the height,
  the depth and where each of them is are written out under the picture. See
  `app/src/lib/surface.ts`.

  The same `z =` line draws **as contours** as well: the level curves, one per
  round number, with zero heaviest and the spacing said in a sentence under the
  picture — because the whole reason to draw contours rather than the solid
  shape is to read values off, and a map whose spacing is not stated is a
  picture rather than a reading. It is a control on the screen rather than new
  notation, since which picture to draw is a choice about the drawing.

  **A pair with `x` or `y` in it is a field of arrows** — `(y, -x)` is a
  rotation, `(20 - 2x - y, x - 2)` is a phase diagram — drawn at every point of
  the window: which way it pushes, and how hard. The lengths are the honest
  difficulty and the choice is stated rather than hidden: drawn true, one fast
  corner turns every other arrow into a dot, so length is the magnitude against
  the largest under a square root, and the ink carries the rest.

  **`y' = x + y` is a differential equation**, and it is solved by walking it:
  the slope field underneath, and the solution through every `y(0) = 1` written
  under it — as many as you like, each its own curve, and none at all draws the
  whole family. Runge–Kutta, fourth order, checked against `y' = y` to ten
  places of *e*; Euler's method is a line shorter and drifts off the true
  solution smoothly enough to read as the answer. The curve is always walked,
  whatever else is printed beside it — where an equation is linear with
  constant coefficients its formula is printed under it too, by the Laplace
  transform below, and that is an addition to the picture rather than a
  replacement for it.
  A solution that runs to infinity — `y' = y^2` from `y(0) = 1`, at x = 1 —
  stops where it stops, and the reading says so rather than letting a steep
  line stand in for a thing that has no value. See `app/src/lib/ode.ts`.

  **`y'' = -y - 0.15y'` is second order** — a spring in treacle — and wants two
  conditions, the value and the rate: `y(0) = 4` and `y'(0) = 0`. The prime is
  part of the name in `app/src/lib/calc.ts`, so the rate is an ordinary
  quantity in the equation and the walk binds it at every step. No slope field
  under this one, and that is not an omission: a second-order equation gives a
  slope at a point *and a speed*, so there is nothing true to draw on the
  plane.

  **An `x' = …` beside a `y' = …` is a system**, drawn where a dynamics course
  draws it — the plane the two quantities share, with time running along the
  curve and appearing on neither axis. `x' = x - xy`, `y' = xy - y` is predator
  and prey, and it closes into the loop it should. Over its own field of
  arrows, since a system and a field are the same object seen two ways. The
  step is paced by distance on the page rather than by time, so a system that
  is slow in one place and fast in another comes out evenly drawn; a closed
  loop is drawn once rather than a hundred times; and a trajectory that starts
  at an equilibrium stays there, as a point.

  **`L{t^2 e^{-t}}` is a Laplace transform**, read and drawn against `s`, and
  `L^{-1}{1/(s^2 + 2s + 5)}` is the way back, read and drawn against `t`. Both
  are lines of the same list as everything else, so a transform sits above the
  equation it came from. The pole of a transform is worth seeing, which is why
  it is drawn rather than only printed.

  This is the one piece of symbolic work in the app, and the line it does not
  cross is worth saying precisely. `app/src/lib/calc.ts` still does not
  rearrange, and a program that half-solved would still be worse than none.
  What makes this different is that it is not general — it works over one
  family and is *closed* over it, so there is no half-solved case to fall into.
  The family is `c (t - d)^n e^{a(t - d)}` times a sine or a cosine of
  `b(t - d)`, switched on at `d`: a constant, a power, an exponential, a wave
  and a delay. Sums of those are exactly the functions whose transforms are
  rational in `s`, and rational functions of `s` are exactly what comes back.
  Everything outside it is refused by name — `\ln(t)` has a transform and it
  is not in this family, so the answer is a sentence saying so rather than an
  approximation nobody asked for. The step and the impulse are in, which is
  most of why the transform is taught: `L{t\,u(t - 2)}` is not `e^{-2s}/s^2`,
  because the ramp is already two high when it switches on, and the shift is
  done properly rather than by moving the exponent about.

  **And an equation with constant coefficients gets its formula under it.**
  `y'' = -4y` with `y(0) = 1` and `y'(0) = 0` prints `y = \cos(2x)` beside the
  curve the walk drew; `y'' = -y - 0.3y' + \sin(x)` from rest prints the four
  terms it actually is, transient and steady state, which is the thing a
  numerical walk has and cannot say. The coefficients are read off the
  right-hand side by sampling rather than by matching a shape — `-4y`,
  `-(y + 3y')/2` and `k^2 y - c y'` are the same equation written three ways —
  and then put back together and checked at points nobody used to build them.
  A logistic equation fails that check and is told so: it draws exactly as it
  did before, with no line of text under it.

  Coming back needs the denominator's roots and there is no formula for them
  past the quartic, so they are found numerically, and the honest part is what
  happens next. A repeated root is never found exactly — `(s+1)^3` comes back
  as three roots in a ring — so nearby roots are gathered, sharpened by
  Newton's step multiplied by the count, and then the factors are multiplied
  back out and compared with the polynomial they came from. If they do not
  reproduce it, a tighter radius is tried, down to no gathering at all. A wrong
  multiplicity is a wrong answer, and guessing one is worse than a clumsier
  partial fraction that is right. Every result is checked against a closed form
  worked by hand, and the solved equations are checked a second way as well —
  against the Runge–Kutta walk, which shares no code with any of this and
  agrees to six places. See `app/src/lib/laplace.ts`.

  **`conv(t, e^{-t})` is a convolution** — the integral of `f(τ)g(t - τ)` from
  0 to t — done as the product it is in `s`. That is the whole reason the
  convolution theorem is worth knowing, and it is what makes it cheap here: the
  family is closed in both directions, so the work is three steps that already
  exist, and the answer is exact rather than a quadrature over a grid. It comes
  out `t - 1 + e^{-t}`, which is what the integral comes to. Delays add, as
  they should: a thing switched on at two convolved with a thing switched on at
  three is switched on at five. Checked against the integral itself, worked by
  Simpson's rule inside the test rather than in the app, so the two methods
  share nothing.

  **An `H =` line with an `s` in it is a transfer function** —
  `H = \frac{1}{s^2 + 0.3s + 1}` — told apart from the letter H with a value by
  the same rule that tells `r = 5` from a polar curve: what is written in it.
  It is drawn as its impulse response, which is `H` itself read the other way,
  and the sentence under it is the part worth having: *poles at
  -0.15 ± 0.988686i — all left of the axis, so it settles*. Every term of the
  answer is `e^{(pole)t}` times something slower, so the poles are the whole of
  how a thing behaves without solving anything, which is why an engineer reads
  them before reading the curve.

  And an equation on the list gets the same treatment: under `y'' = -y - 0.3y'`
  the app prints `H(s) = \frac{1}{s^2 + 0.3s + 1}` and where its poles are,
  beside the exact solution. The transfer function is the same `Q(s)` the
  solution divides by, read on its own — which is not a coincidence: dividing
  by `Q` is what solving the equation *is*, once it is transformed. It carries
  no initial conditions, which is also right. A transfer function is the system
  and not the run, so it is there before anybody has written a `y(0) =`.

  It also found a bug that had been there all along. `s(s + 2)^2` was read as
  `(s(s + 2))^2` — a different function, which works out, draws and transforms
  without complaint. A bracket after a letter is a multiplication or a function
  call and is not decided until there is a scope; a power after that bracket is
  the same question again, and it was being answered before the question was
  asked. The power is now held inside the undecided node and applied to
  whichever reading wins, so `f(x)^2` is still the square of what `f` gives and
  `x(x - 1)^3` is `x` times a cube — which is what `y = x(x-2)^2` has always
  meant on every graph anybody has drawn here.

  **Polar and parametric** are the same box and the same notation, told apart
  by the letter in them: an `r =` line with the angle in it is polar —
  `r = 2 + 2\cos(\theta)`, a cardioid — and a pair with `t` in it is the path
  a moving point takes — `(5\sin(3t), 5\sin(2t))`, a Lissajous figure. Both
  are walked along their own parameter rather than across the window, so a
  curve that comes back on itself or crosses itself is drawn whole, on screen
  or off, and how far round θ and t go is a control rather than more notation.
  A negative radius is drawn on the opposite ray, which is what puts the other
  four petals on a rose.

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

## One door to making things

The app could already write a document, build a deck and fill a spreadsheet, on
three screens you had to know the names of. **Create** is the screen you open
when you know what you want to make and not which screen makes it: nine tiles,
six of which hand straight over to the editor that already exists — documents,
decks, spreadsheets, maths activities, study guides, notes — and three that are
its own. Forms, designs and videos share one project shape and one device
library (`app/src/lib/creations.ts`).

The asymmetry is deliberate. A second document editor behind a tile would be a
second place documents could live, which is the thing the rest of this app
spends its effort not doing. A project is told which course and which deadline
it belongs to before it is created, so its export lands in Files against the
right one without anybody filing it afterwards.

The three it owns are basic editors and say so: a form with nine question
types, response windows and CSV out; a design surface with text, shapes,
images, layers and SVG, PNG or JPG export; a video editor that trims, splits,
orders, re-times and renders 720p WebM in the browser. No transcription, no
multi-track mixing, no MP4, no real-time collaboration.

## The university itself

**University** is thirty-seven service areas — registration, the bursar,
dining, advising, accessibility, the library, health, transport, the ID card —
each saying plainly what this app can do for it. For nearly all of them the
answer is the same: it can help you *prepare*. It holds the questions for an
advising appointment, the checklist before a form is filed, the draft of an
appeal, and it reuses the course, study, registration, degree, billing, meal,
housing and map tools that are already here rather than growing copies of them.

It cannot file, register, pay or submit anything. Behind the screen there is a
real gateway — verified identity, per-school and per-record permission
boundaries, per-service capabilities, preview-then-confirm, an encrypted action
journal, receipts and reconciliation (`packages/institution/`, `app/server/`) —
and the production adapter registry is deliberately empty until a school
approves one. The hero on that screen counts *connected* services rather than
the thirty-seven, because thirty-seven is the impressive number and the wrong
one: it is nought until a school deploys something.

## Beyond the term

Four workspaces for the parts of a degree a semester does not contain. Each
keeps its work on the device, apart from the term, so none of it disappears when
the term is archived — and none of it reaches an institution.

- **Athletics** — the practices, the training and the travel, against the
  classes and deadlines they collide with. The conflict list is the screen; the
  absence request, the travel study pack and the calendar entries are all built
  from it. A roster, eligibility, medical clearance and an authorised absence
  belong to an athletics office, and the screen says so.
- **Career** — what is open, what you have done and who you have spoken to, in
  one place because for a student they are one job. There is no job board
  behind it: every opportunity was typed in or imported from a file, and the
  link goes to the official source. "Track it" hands the opportunity to the
  app's one applications tracker rather than starting a second.
- **Family** — deciding what a parent sees, item by item, with nothing shared
  by default. The version everybody builds is a parent login, which hands over
  the grades, the health administration and where somebody is at nine on a
  Tuesday. This is the opposite shape: a person, a category, the individual
  things chosen for them, an expiry, and a preview that shows exactly that and
  nothing else. No invitation is sent and no account is created.
- **Pathway** — applying somewhere, arriving, transferring, a thesis,
  graduating, leaving: eleven milestone templates that are the order the
  deadlines actually fall in, for somebody meeting each exactly once. Every
  status on it is what you typed, and every place one is drawn says whose claim
  it is. The cost table refuses to rank, convert currencies or subtract loans
  as aid.

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
  holding an iPad is the finger that held the phone — the rail's own rows
  included, which they were not. Unrolled, the five destinations that are 51px
  tall each in the tab bar came out at 41 in the rail, and the five under them
  — Ask Claude, Account, Settings — at 35, so the one piece of chrome on screen
  the whole time was the one part of a tablet build nobody had sized for a
  tablet. They have a 44px floor now, on `pointer: coarse` rather than on a
  width: an iPad at 1194 is in the desktop layout and still has a finger on it,
  and a browser window dragged to 820 is in the tablet layout and does not.
  The content column fills whatever the rail leaves, up to a 760px cap so a
  list row on a landscape iPad is not a metre of hairline with its value
  stranded at the far end.
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
- **Held, rather than opened in a window** — which is the thing width alone
  cannot tell you, and the three boundaries above are widths. An iPhone 15 Pro
  Max on its side is 932pt across, wider than an iPad mini is upright, so it
  was getting the tablet layout: a rail of ten rows down the side of 430px of
  height, taking 220px of the width for a navigation whose last items ran off
  the bottom. And the standalone column's 402px cap — the artboard the app was
  drawn on, which never comes into play on a phone held upright because the
  phone is narrower than it is — did come into play the moment the phone was
  turned, and again on an iPad mini upright at 744 and on any iPad in Split
  View: the app drawn as a column down the middle of the device with black
  either side of it and a tab bar reaching neither edge.
  Both are the same sentence — on a device the app fills the device, and a cap
  written for a window belongs to a window. `pointer: coarse` is what tells
  the two apart, paired with a short viewport (under 600px, which no tablet is
  at any rotation and every phone is on its side) or a narrow one. A desktop
  window dragged short or narrow has a mouse in it and keeps the desktop.
  `HANDHELD` in `app/src/lib/media.ts` is the query, the last block of the
  layout section in `app.css` is its copy, and `lib/tiers.test.ts` holds the
  two together the way it holds the widths. The side safe-area insets are read
  here too — a notch goes to whichever side is the top when a phone is turned,
  and `viewport-fit=cover` means the header and the tab bar sit under it
  unless something asks.
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
