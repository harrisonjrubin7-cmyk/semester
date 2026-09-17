# The competitor comparison, checked against the code — September 2026

The tracked copy of *Semester vs. the Competition — Feature Comparison &
Integration Plan*, which compares this app against ten direct competitors and
proposes nine things to adopt from them.

It is filed here for the reason `ACTION-PLAN.md` gives for its own existence:
**every item that names something about this repository was checked against the
code before it was filed.** That habit has now been run twice against two
different outside documents, and it has now returned the same answer twice.
The action plan found seven of seventeen items different from the claim. This
one found **six of the nine proposals already built** — four of them whole, two
of them in a form the document did not know to look for.

That is not a criticism of the research. The competitor work is first-hand and
the market reading is sound; what it could not do is read this codebase, and
`CLAUDE.md` says why that gap opens as fast as it does. The cost of not
checking is concrete and it is the reason this file exists: four of the six
below are sized in the document as sprint items, and building any of them would
have been a week spent rebuilding something a student can already use today.

**Checked against `a648a1b` on 17 September 2026.** Every verdict names what was
measured and where. Verdicts were reached twice — once by reading, once by an
adversarial pass told to assume the first reading was wrong and to go looking
for the code it missed. Two verdicts moved between the passes; both moved
towards *more already built*, never less.

Legend: **Open** · **Landed** (already in the app; nothing to do) · **Partly**
(some of it is in, the rest is named) · **Not a code item**.

---

## The nine proposals

### 1 · Fix the free-and-unlimited story · **Partly — the code half is fixed; the sentence is not, and should not be written yet**

> Every competitor caps or paywalls the exact action Semester currently also
> blocks — uploading your own syllabus without a key. The moment it's fixed,
> Semester can truthfully say what none of these ten can: free, unlimited
> courses, no credit card. Make that claim explicit in onboarding copy once
> it's true.

The code half landed before this document was written, and `ACTION-PLAN.md`
item 1 carries it at length: `screens/Import.tsx` has four doors in and three
of them need no key, the gate now stands *in the primary button's place* rather
than under a button that cannot succeed, and `screens/deadends.test.tsx` pins
both directions.

**The sentence is the open half, and the honest answer today is not to write
it.** It appears nowhere in the app — not in `screens/Onboarding.tsx`, not in
`screens/FirstRun.tsx`, not on the import screen — and two facts about this
repository say it would not yet be true:

- The shared key is still a deployment decision, not a shipped one.
  `lib/claude.ts` tells a student by name that there is no key yet, and
  `SETUP.md` covers deploying the function that would change that. Until it is
  deployed, "unlimited courses" means unlimited courses *typed in by hand*.
- `lib/invite.ts` landed on main this morning — an allow-list in front of the
  sign-up form. "No credit card" is true. "Free, for anyone" is, for now, not.

So the claim is not blocked on copywriting. It is blocked on the two decisions
above, and writing it first would put the app in the company of the thing this
document's own closing section says not to copy: *advertising integration you
don't have*. Make the decisions, then write the sentence, and it will be the
strongest sentence in the onboarding.

### 2 · Build a live "what grade do I need" calculator · **Landed — twice**

> UpAhead, Sylly, SyllySync and DormWay all ship some version of a live grade
> projection, and it's consistently one of the most-praised features in their
> reviews. The math to project forward from that same weighting data is a small
> addition on top of data the app already has.

It is not an addition. It is `lib/grades.ts`, and that file opens by stating
this proposal as its own reason for existing:

> The app already holds every course's grading table, straight from the
> syllabus. It was shown as a read-only list, which answers "how is this
> marked" and not the question a student asks in week ten: *what do I need on
> the final?*

`needFor(standing, target)` solves the weighted average for what everything
left has to average. `reachFor` turns that number into a verdict, because the
number alone is not the answer — 104% is arithmetically correct and means "not
happening", −12% is correct and means "already yours", and each is a different
thing to do about the same figure. `reaches` walks every letter band.
`needCaveat` carries the one caveat that has to travel with all of it, which is
that a syllabus whose weights add to 95 makes every figure a ratio of the wrong
denominator.

It ships on `screens/Grades.tsx:220`, recomputing as scores are typed, against
the school's own cutoffs through `lib/cutoffs.ts` rather than against assumed
bands. And it ships a **second** time: `lib/gradesheet.ts` builds a course its
own editable grade calculator as a real sheet, from `Course.grading` as parsed
off the syllabus — written against the same sentence, *what do I need on the
final*, and against the same failure mode, a spreadsheet built by hand from
weights re-typed off a PDF.

The competitors' version of this is the thing to compare against, and it is the
weaker one: a projection with no verdict attached, and none of them carrying the
caveat about weights that do not sum. Nothing to build. If anything here is
worth doing it is marketing, not engineering.

### 3 · Add proactive start-time (not due-time) nudges · **Was Partly — now built, in this change**

> Wick's single most-praised feature is a text that arrives when you should
> *start* something, not a generic "due tomorrow" ping. This is a
> notification-scheduling feature layered on math Semester already runs.

The document is right that the math was already here, and understates how much
of it. It guesses the input would be Tonight's hours-vs-available arithmetic.
The real input is better: `lib/start.ts` already walked each deadline backwards
through the hours the student's own work windows actually offer — taking half a
day for any one piece of work, because they have other courses — and refused to
produce a start date at all for work the app has never timed, on the grounds
that a made-up start date is the one number somebody would arrange a fortnight
around. `beginNow()` returns exactly the set a start-time nudge would announce,
and each entry carries a generic opener by kind, because *"Opera Philadelphia
case, 30% of the grade"* is the paralysing half of a notification and *"read
the case and write down what it is actually asking"* is the half that works.

**What was missing was one layer, and only one.** All nine reminder rules in
`lib/notify.ts` keyed on an end date — `two` at two days, `exam` at seven and
twenty-eight, `term` and `bill` at a week and a day. Nine countdowns to a
deadline, none to the work, in an app whose own start module opens by saying
that almost no missed piece of work was a forgotten deadline. `lib/start.ts`
reached exactly one surface: a card on the home screen, read by somebody who
had already opened the app — which is not the person who needed telling.

So it is built here, as a tenth rule that computes nothing new. See the commit
for the design; the part worth repeating is the one that decides whether this
is a reminder or a nag. A start date that has gone by stays in `beginNow` every
morning afterwards, so an id keyed on today would buzz about the same unstarted
paper daily until the student switched the feature off. Keyed on the start
date, each piece of work says its piece once.

Two pre-existing defects were found on the way through, because the new rule
had to pass through them, and both are fixed here: `muted` and `quiet` reached
one of the three callers that build a reminder's `Source`, so a muted course
still buzzed a phone and quiet hours held only for the surface that cannot wake
you; and one calibration had five copies in flight, which would have shown up
as the phone and the home screen naming different days for the same paper.

### 4 · Camera scan and voice capture for adding a course · **Partly — and the camera half is a decision somebody already made, not a gap**

> Semester's import flow (`#/import`) is currently upload-a-file only. Add a
> camera option alongside the file picker, and consider a voice/text quick-add
> for one-off tasks.

**"Upload-a-file only" is wrong**, in the same way `ACTION-PLAN.md` item 1
found the same screen described wrongly: `screens/Import.tsx` has four doors
and three need no key — paste the syllabus as text, open a course somebody
shared, add a course by hand with no syllabus at all.

**The camera exists and is wired.** `components/Capture.tsx` draws two inputs,
one with `capture="environment"` for the rear camera and one for the photo
library, hands back shots resized and re-encoded by `lib/shots.ts`, and
`readShots` in `lib/claude.ts` is the vision read that turns them into text. It
ships on `screens/Update.tsx` and `screens/Mine.tsx`.

**It is absent from Import on purpose**, and the purpose is written down.
`screens/Import.tsx:48`: *"Import takes documents only; Update is the one that
also takes a photo."* That is a decision, and this file is not the place to
overturn one — but it leaves a real edge worth naming, because it is a
contradiction inside the app rather than a difference of opinion with a
document:

> A student who photographs a paper syllabus and drops the images into Import
> is told, by `lib/intake.ts`, *"a photograph — read it with the camera, which
> can see it"*. There is no camera on Import, and Update adds material to a
> course that already exists — which this student does not have. The message
> gives directions nobody in that position can follow.

That is one decision to make, not a feature to schedule: either Import gains
the camera the document asks for, or the refusal on the Import path stops
pointing at a door that is not on that screen. Either is small. Picking one is
the owner's call, because the first reverses a stated division of labour.

**The voice half is already answered**, and by more than the document asks for.
`lib/mic.ts` records, `lib/transcribe.ts` runs a live recogniser alongside it
with a restart loop — because the browser's recogniser stops on a pause long
enough for a professor to write on a board, and a naive one goes quiet twenty
minutes into a fifty-minute class without saying so — and `components/RecordButton.tsx`
puts both on a screen. A one-off task with no syllabus behind it already has a
fast path in, through Import's by-hand door and through the calendar's own
add-here.

### 5 · Build genuine LMS read-sync, self-serve, per student · **Landed — in a form the comparison table scores as "None"**

> A student pastes in their own Canvas access token and the app does a
> read-only pull of assignments and due dates. A self-serve, per-student
> integration, buildable without anyone's permission but the student's.

The property the document identifies as the point — self-serve, per-student, no
institutional agreement — is exactly right, and it is exactly what ships.
`lib/feedlink.ts` takes the calendar link a student copies out of their LMS and
turns it into an address this app can fetch, and it knows Canvas by name:
`{ has: /(^|\.)instructure\.com$/i, kind: 'ics', name: 'Canvas' }`. Brightspace,
Outlook, Google and iCloud are in the same list.
`screens/Connect.tsx:396` tells the student so in as many words: *"Outlook,
Google, iCloud, Canvas and Zoom all publish the same"* feed.

The file is worth reading before anyone rebuilds it, because the hard parts are
done and they are not the parts you would predict. Nobody pastes a clean
`https://…/basic.ics` — what arrives is `webcal://`, or an address with no
scheme because the copy button dropped it, or the whole thing inside the angle
brackets a mail client put round it. And fetching needs two routes, decided not
by status code but by whether what came back begins `BEGIN:VCALENDAR`, because
a single-page host answers the proxy path with **200 and its own index.html** —
the worst possible failure, since it looks like success. Direct is tried first
and not for speed: the token in a Brightspace or Outlook feed URL is a
password, and a route that need not hand it to a proxy should not.

The comparison table's "LMS sync: None" row for Semester should read as Canvas,
Brightspace, Outlook, Google and iCloud, by student-held feed link. The one
honest gap against Coursicle is breadth of *mechanism*, not of provider: an ICS
subscription carries dates, and a REST pull would also carry submission state
and grades. That is a real difference and a much smaller project than the
document scopes, because the plumbing, the proxy and the reconciliation against
existing deadlines are all already here.

### 6 · A lightweight lecture-capture-to-notes feature · **Landed**

> Due Gooder and Sylly both offer record-the-lecture → transcript →
> auto-notes/flashcards. A recording-to-notes flow would sit naturally
> alongside them and is a genuine feature gap today, not just a polish item.

It is not a gap. `components/RecordButton.tsx` opens: *"Record a lecture, and
write it down while it happens."* Audio is kept regardless; the transcript is
taken live because that is the only kind a browser can produce, and the module
states that limit rather than implying otherwise — there is no offline
recogniser you can hand an hour of finished audio to. Timestamped segments,
paragraphing, and a restart loop for the silences. It is on `screens/Update.tsx`
and `screens/Mine.tsx`, and on Update the transcript lands in the same pipeline
every other piece of material goes through — `lib/parse.ts`, `lib/classify.ts`,
`lib/changeset.ts` — which is how it becomes cards and study parts rather than
a wall of text.

Where this app is ahead of the two competitors named is the honesty: the screen
says it mishears technical vocabulary, does not know who is speaking, and that
in Chrome the recognition happens on Google's servers rather than on the
device. A transcript trusted more than it deserves is worse than none.

### 7 · Borrow Notion Calendar's layering idea · **Landed, both halves**

> Let students toggle calendar layers — classes, deadlines, study blocks,
> work/clubs — on and off. Combined with the UI audit's recommendation to put a
> count (not just a colour dot) on each calendar day.

Both halves ship.

**Layers** are `lib/calsource.ts`, and the file exists because the four
calendar views had each written the filtering conditions out and had therefore
come to disagree — Week ignored the source axis entirely, and Semester had no
branch for classes, so the exact combination the feature advertises produced
"nothing from this source across the whole semester" about a term with four
courses meeting all week. The rule is one thing now and every view asks it.
Three buckets — classes, deadlines, campus — plus a second row of chips under
Campus.

**The count** is `dayCount` in `lib/monthgrid.ts`, and its docstring is the UI
audit's complaint in the audit's own terms: *"a day full of work and a day with
one reading drew the same unlabelled smear of colour"*, and worse, the cell drew
at most four dots and said nothing about the rest, so a week with a
nine-deadline Thursday looked exactly like a week without one.

This closes an item `ACTION-PLAN.md` left explicitly unchecked — Tier 3 item 17
lists "counts on calendar day-dots" as *"open — not checked in this pass"*. It
is checked now, and it is closed.

### 8 · Use the button-wall fix as the landing spot for new features · **Partly — the premise has moved; the design pass has not**

> The UI audit flagged the Study screen's six-plus equal-weight buttons as
> needing hierarchy. New AI features should surface there — one primary action
> plus a secondary row — rather than an eighth equal button.

The premise has partly moved. `screens/Study.tsx` is not flat: it draws a
`studio-entry` with a single `portal-primary` call to action, and several of
its `ActionButton`s already carry `tone="primary"` against plainer siblings. So
"six-plus buttons of equal weight" is not what the screen renders today.

What is still true is that the hierarchy is local rather than designed — each
section decided its own emphasis — and that is a real screen-level design pass,
not a nit. It stays open. The advice attached to it is worth keeping either
way, and this change follows it: nothing built here added a button to that
screen.

### 9 · Study Syllabuddy's ambassador mechanics · **Not a code item**

$5/mo credited per 10 active referrals is a concrete mechanic worth adapting
rather than designing from scratch, and it sharpens `ACTION-PLAN.md` Tier 2 item
7 — which flags the ambassador model as the untested, load-bearing assumption —
without changing its status.

No referral, ambassador or promo-code machinery exists in `app/src` or
`supabase/`, and none should be built before the assumption is tested. Worth
knowing for when it is: the plumbing an ambassador scheme would sit on is
already here, because sharing a built course is a shipped feature —
`lib/handoff.ts` packs one and `lib/shared.ts` opens it, and Import's third
door is somebody else's course arriving.

---

## What the table should say about Semester

Four rows of the comparison table are wrong about this app, in the same
direction each time. Correcting them matters more than it looks, because the
document's own strategic conclusions rest on them:

| Row | The table says | The code says |
| --- | --- | --- |
| LMS sync | None | Canvas, Brightspace, Outlook, Google, iCloud — student-held feed link, no institutional agreement (`lib/feedlink.ts`) |
| Grade calculator | Named as a gap to build | Shipping twice — `lib/grades.ts` on the Grades screen, and a per-course sheet in `lib/gradesheet.ts` |
| Lecture capture | "A genuine feature gap today" | Shipping — `components/RecordButton.tsx`, live transcript into the material pipeline |
| Screens | 60 | 74 in the `Screen` union (`lib/types.ts`); eleven of them shown to a new account, the rest unlocked by a fact about the semester (`lib/reveal.ts`) |

The three baseline claims the document rests its "bottom line up front" on all
check out, and one is stronger than stated. The workload-aware planner is real:
hours promised against hours available in `lib/ahead.ts`, and the sleep floor is
not a nudge but a floor — `lib/rest.ts` removes those hours from the week's
capacity *before* anything is planned, so a week that only fits by working at
half past one does not fit, and the app says so on Monday rather than letting it
fail on Thursday. Exam countdowns are `lib/runway.ts`. The money/housing/career
breadth is real. And the free-and-uncapped model is real in the app, with the
two deployment caveats under item 1.

## What this pass actually found

One buildable gap in nine proposals, and it is built. Four landed whole, two
landed in a form the document did not know to look for, one is not code, one is
a decision rather than a feature, and one — the Study screen's hierarchy —
stays open and stays a design pass.

The habit is worth more than the item, and it is the same conclusion
`ACTION-PLAN.md` reached from a different document:

**Check the claim against the code before scheduling the work.** Seventeen
items in that pass, seven different from the claim. Nine in this one, six
already built. Both documents were written by people who had read the app's own
description of itself, and the app had moved. It will have moved again by the
time the next one is written.

There is a second lesson specific to this document, and it is the more useful
one for a competitive comparison. **Every correction above ran the same way:
the app did more than the document credited, never less.** A comparison table
that undercounts your own product is not a neutral error — it points engineering
at work that is finished and points marketing away from claims that are already
true. Of the four corrected rows, three are features the document identifies as
the competitors' most-praised, and all three already ship here.
