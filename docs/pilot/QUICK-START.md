# Semester — quick start for pilot users

**As of 2026-10-03.** Ten minutes from opening the app to your first deadline
on Today. Written from what the app does on a first run
(`app/src/screens/Onboarding.tsx`, walked in CI by `app/scripts/golden-path.mjs`),
not from what it will do later. If a step here does not match the screen in
front of you, that is a bug — report it (last section).

Semester works on your phone or laptop in a browser. It needs no account and
no app store. Everything you add is saved on the device first; an account is
what lets a second device show the same semester.

## 1. Open it and take the tour (2 minutes)

The first run is five short screens. Press the button on each:

| Screen | What it asks | Press |
| --- | --- | --- |
| Your syllabi. One brain. | Nothing yet — what the app is for | **Show me** |
| Drop one in. | Nothing yet — how a syllabus is read and checked | **Good** |
| When and where do you study? | Your **term** (pre-filled with the calendar's guess) and, optionally, your **school**. The term is what deadlines are filed under; the school switches on the campus screens (meals, housing, map) and nothing else | **Next** |
| One semester, every device. | An email address and a password, if you want the semester to follow you to another device. **Not now** is a real answer: everything still works on this device | **Not now**, or sign up |
| Alerts | Whether the app may remind you. Change it later under Me → Alerts | **Add your first course** |

You land on **Add a course**.

## 2. Add your first course (3 minutes)

On Add a course (`#/import`), drop in a syllabus as a **PDF, a Word file or
pasted text**. What comes back is checked before you see it: every date is
forced into the real calendar, and every quoted line is tested against your
own document. Read the course it made — dates, weightings, rooms, the AI
policy — and fix anything on **Edit the course** (`#/edit`) before you keep it.

Repeat for each course. A term is usually three to six.

**If your syllabus has no dates in it**, add them from the course screen, or
from your registrar's term calendar on **Term deadlines** (`#/registrar`):
add/drop, withdrawal and registration are the registrar's dates, not a
syllabus's.

## 3. Look at Today (1 minute)

**Today** (`#/home`) is the first tab: what is due, what is next, tonight's hours
and the week ahead. If a course's deadline is missing here, it is missing from
the course — open **Courses** (`#/courses`) and add it there.

Add something of your own: an action on **Personal** (`#/mine`) through
**+ New action** shows on Today as the next thing of yours. Tick it there when
it is done.

## 4. Decide about an account (2 minutes)

You can do this any time from **Me → Account** (`#/account`).

- **Without an account**, the semester lives on this device. To move it, use
  **Take it with you** (`#/export`) → *Everything, as data*, and restore that
  file on the other device. This is exercised on every build.
- **With an account**, the phone and the laptop show the same semester. Sign
  in on both. The Account screen says *Synced* when the two are in step.

Read [`KNOWN-LIMITATIONS.md`](KNOWN-LIMITATIONS.md) before relying on sync
across two devices: a record edited on both before either syncs is offered
to you as a choice on Account, and attachments do not sync.

## 5. Find the guide and the doors (2 minutes)

- **Help** (`#/help`) is the guide to every screen, generated from the app
  itself, with a chapter on what to do when two devices disagree, a link to
  the status page, and the list of known limitations. **Show me around again**
  replays the tour.
- **Support** (`#/support`) is the campus doors — care, basic needs,
  accommodations, safety — and which door, and whether what you say there
  stays there. Its first tab carries a crisis line.
- **I do not know who to ask**: on Help, describe the problem in your own
  words and Semester says whose question it is and what to bring.

## What Semester will not do

It does not register you for classes, pay a bill, submit work, or read your
school's systems. It points at the official system for each of those. Your
registrar, your learning system and your advisor stay authoritative; Semester
is where you see it all in one place and decide what to do next.

## Reporting a problem, or a barrier

Write to **harrisonjrubin7@gmail.com** with the screen, what you were trying
to do, and what happened. A reply comes from a person; no response time is
promised yet.

**Accessibility.** If something does not work with your screen reader,
keyboard, zoom or switch, put **Accessibility** in the subject and add the
browser and assistive technology you used. A barrier that stops you finishing
what you came to do is fixed before anything else in that screen ships. If the
reply does not resolve it, write again with **Accessibility escalation** in
the subject; it goes to the accessibility seat. This is the same route the
public site's Accessibility page describes under *Report a barrier*
(`app/src/site/pages.tsx`).
