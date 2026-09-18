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
