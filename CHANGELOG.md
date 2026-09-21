# What changed

For people testing Semester, not for people writing it. Every entry says what
you will *see* and whether you have to do anything; the commit history has the
reasoning and the measurements.

Three rules for this file, because a changelog nobody trusts is worse than
none:

- **Anything a tester can notice goes in**, including things that got worse and
  things that were taken away again. A feature that vanishes without a word
  teaches people to distrust the whole app, and that is harder to win back than
  the deploy was.
- **A rollback gets an entry of its own**, saying what went back and what you
  will see change back. See [`ROLLBACK.md`](ROLLBACK.md).
- **Dates are when it reached the live page**, not when it was written.

The live page is <https://harrisonjrubin7-cmyk.github.io/semester/>. It updates
within a few minutes of anything landing. If a change here does not match what
you are looking at, hard-reload — the app keeps working offline, which means it
will happily serve you the copy you already had.

---

## Unreleased

### Photograph a score, and it lands in your grades

Top Hat, iClicker and the rest have no way to hand this app your score — there
is no student API to ask. So under each course's grading table there is now
**From a photo**: photograph the screen that shows your score, and the number
comes across.

What it does *not* do is decide anything for you. It reads the page, shows you
every number on it that could be a score with the line each one came from, and
you tap the one that is yours. Then it proposes which category it belongs to —
and where the line does not name one, it says so and leaves the choice to you
rather than guessing. **Nothing reaches your grades until you have picked
both.**

It files exactly what was on your screen. Photograph "13/14" and "13/14" is
what the field holds, the same as if you had typed it.

Needs the assistant set up, like every other place the app has to read a
photograph. Typing the number in is unchanged and still the fastest route for
a single figure.

### Settings now tells the truth about what it is connected to

*Settings › About* has a list headed **Where the numbers come from**. It said
Brightspace was on and had synced four courses at 6:40 AM, that Gradescope was
on, that Apple Calendar was two-way, and it printed a Top Hat join code.

**None of that was a connection.** This app has never synced Brightspace — the
Brightspace route is a calendar link you paste, and it is read-only. There is
no Gradescope route at all. Apple publishes a calendar *out*, one direction.
And no app, this one included, can read your Top Hat score: Top Hat has no
student API, so there is nothing to connect to.

The list now names the routes that actually exist — your syllabus, a calendar
link, a Canvas token you issue yourself, what you type in, and Top Hat marked
*not connected* — and the tag beside each says **what it takes** rather than
whether it is switched on, because there was never a switch.

**Nothing you had changes, and nothing stops working.** If you were reading
that screen as "my Brightspace is hooked up", it never was, and the rest of the
app has been telling you so on the Connect screen all along.

### Your university can send its own data as a file, and you load it

Until now there were two ways to tell Semester where you study: find your
school in the list, or answer eight short questions about it. Both are the
right size for one person filling in their own university, and neither is any
use for the thing a university actually has — a term calendar with thirty
dated deadlines on it, a list of every building with its coordinates, the meal
plans and what they cost.

**Now there is a third way.** If your university sends you a Semester school
pack, you load the file under *where do you study* and the screens that were
switched off come on: Term deadlines fills in, the map gets its buildings,
Meals gets the real plans, and the links go to your registrar rather than
nowhere.

- **You see what is in it before anything is kept.** Choosing the file shows
  the school's name, when the file was written, and how many terms, deadlines,
  buildings and meal plans it turned out to contain. Then it asks.
- **Anything it could not use is listed by name.** Not "some rows failed" —
  *"Featheringill Hall — this building was left out, lat must be a number
  between −90 and 90"*. That list is meant to be sent straight back to whoever
  sent you the file, and a first export from any university will have one.
- **Removing it puts everything back.** The profile the app already had is
  still there underneath.
- **It is a snapshot, not a connection.** The dates were true when the file was
  written, so the app shows you that date next to them. Nothing about this
  signs you in to anything, and Semester still cannot read your registrar.

There are two downloads on the same screen: a blank template, and your current
school saved as a pack — which is the one to send a university that is filling
one in, because correcting a file is a much smaller job than writing one.

Nothing changes if nobody sends you a file. The list and the eight questions
work exactly as they did.

### You can record a call, once everybody says yes

**Nobody is recorded without being asked.** Somebody asks, everybody else is
shown the question, and it does not start until every one of them has agreed.

- **Anyone can refuse, and refusing stops it for everyone.** Not just for them.
- **Anyone can stop it once it has started**, including people who agreed.
- **If somebody joins while it is running, it stops** — they have not been
  asked. Whoever was recording can ask again with them in the room.
- **The file is saved on the device of whoever recorded it.** Semester never
  receives it, and there is nothing in the app that could send it.

It is in the **More** panel rather than on the button bar, because pressing it
puts a question to everybody else and that is not a one-tap thing.

**Nothing to do.** If nobody asks, nothing changes.

### A sentence that had become untrue

The More panel used to say the call itself is *never* recorded, here or
anywhere. That was true until the above existed. It now says what is actually
the case: a call is only recorded if somebody asks and everybody agrees, and
the file then stays on their device.

---

## 2026-09-17

A long day. Most of it is the University screen, which went from four
demonstration areas to sixteen.

### University — a sandbox you can actually walk through

The University screen now has sixteen demonstration areas rather than four:
course registration, bills, financial aid, authorised family access, careers,
advising appointments, an alumni network, athletics, clubs, housing and dining.

**Everything in there is a sandbox and says so on every single record.** No
employer, team, club or building named in it exists. No money moves. No
election decides anything. Nobody is housed, cleared to compete, or hired.
Nothing reaches Vanderbilt or any other institution, and nothing here changes
that — connecting a real university needs an agreement this project does not
have.

What it is for is that you can *try* the things a real one would do, and find
out where they refuse:

- Enrol in a section until the seats run out, then meet the waiting list.
- Try to enrol with a hold on your account, or without the prerequisite.
- Pay a bill as a parent who has been granted payment access — and discover
  that the same parent cannot *read* the bill. That asymmetry is deliberate.
- Apply to a job, withdraw the application, and find that withdrawing is final.
- Get an offer, accept it, and watch your other outstanding offers decline
  themselves.
- Vote in a club election, then try to vote twice.
- Sign a housing contract, and read what it says you are agreeing to before you
  sign it. Cancel inside the week; try to cancel after it.

**Nothing to do.** It is on the University screen for anyone.

### Starting from nothing no longer starts at a locked door

If you opened the app with no courses and no API key, the one thing it asked
you to do — add a course from a syllabus — was the one thing that could not
work, and it told you so only after you had picked a file.

Now the first-run screen offers building a course **by hand** beside the
syllabus route whenever there is no key: no key, no upload, no network. A
syllabus can go over it later with every tick and grade kept.

**Nothing to do**, but if you gave up at that door before, it is worth another
go.

### Forms can be answered by people you send them to

A published form is now openable by a respondent rather than only by its
author, which it should have been from the start.

### Calls

Joining by code now needs more than the code. Captions can be written by the
person speaking. Two people can work on one canvas without overwriting each
other's layers.

**Recording is still not built**, and not because nobody got to it: recording a
call is something done *to* the other people in it, and the consent question —
who is told, whether they can refuse, and what happens to the file afterwards —
has to be answered before the engineering one.

### Things that are deliberately not built

These are decisions, not a backlog, and they are listed so nobody schedules
work to undo one:

- **Sending email.** The app writes the draft and opens it in your own mail
  client; you press send. Something that can post a message as you to your
  professor is a bigger promise than a study app should make.
- **Textbook prices.** A wrong price shown confidently is worse than a blank.
- **Writing your coursework.** Templates are headings and empty paragraphs.
- **Guessing what an exam covers.**

---

## Before this

This file starts here. Everything before it is in the commit history, which is
long and written for developers. Starting a changelog late is better than
backfilling one from memory and getting it wrong.
