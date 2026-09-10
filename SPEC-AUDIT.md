# SPEC-AUDIT.md

The product vision, section by section, against what `app/src` actually does.
Counted and read, not guessed from screen names.

**Measured on this machine, 2026-09-10, on `claude/awesome-rubin-63w34j`:**

| Measure | Value |
| --- | --- |
| `npx tsc -b` | exit 0 |
| `npm test` | 271 files, 5,692 passed, 10 skipped, 0 failed |
| `npm run lint` | passes — oxlint warnings only, style ledger and label rule both green |
| `npm run build` | exit 0 |
| Screens | 63 files, 52 destinations in `lib/nav.ts` |
| Study modes | 11 (`lib/modes.ts`) |
| Notification rules | 9 (`data/misc.ts`) |

Everything below was verified by reading the code that implements it. Where a
section says **shipped**, there is code and there are tests. Where it says
**partial**, some named capability in that section has no implementation.
Where it says **absent**, nothing in the repository does it.

---

## 0. The headline

The vision asks for one application that replaces an LMS, university email, a
calendar, a registration portal, an advising system, a financial portal and a
dozen campus services. Semester is not that, and cannot be — not because of
missing work but because of a constraint the codebase states repeatedly and
correctly:

> `get.cbord.com` is behind single sign-on and publishes no API a student can
> use. There is nothing to read even in principle without holding somebody's
> university credentials, which this app will never do. — `lib/meals.ts`

That reasoning is written into `lib/cost.ts`, `lib/registrar.ts`,
`lib/housing.ts`, `data/campus.ts`, `screens/Yes.tsx` and now `lib/bill.ts`.
Everywhere the university publishes nothing readable, the app **links out,
holds what the student types, and does the arithmetic the portal does not** —
and says which of those it is doing. The vision's §23 forbids becoming "a page
containing links to other university platforms," and the app clears that bar
because the arithmetic on top of the typed figures is the product.

So the honest reading of this document is not a completeness score. It is:
**where the app has real institutional data, does it do the whole job? And
where it does not, does it do the useful part instead of pretending?**

---

## 1. Unified home dashboard — **shipped**

`screens/Today.tsx`, `lib/feed.ts`. Eighteen sections, each its own component,
each reorderable and hideable from Settings; a saved order that predates a new
section appends rather than hides it (`ordered()`).

Present: today's classes, what is due, overdue, what changed since last look,
office hours worth dropping by, registrar dates, your own tasks, the day's
rail, walks between buildings, timers, applications, readings part-finished,
regrade windows still open, a payment due, and the "worth seeing coming" clash
warning.

"What should I do next?" is two screens. `screens/Tonight.tsx` orders
outstanding work by **points of final grade per hour** (`lib/worth.ts`,
`bestBuys`) — weight divided by how long that kind of work has actually taken
this student, calibrated against how wrong their own past estimates were, with
anything due today jumping the queue because a thing due tonight is not a
trade. `screens/Ahead.tsx` and `lib/start.ts` do the other half: when a thing
has to *begin*, walked backwards a day at a time through the hours the student
actually works, and refusing to date work it has never timed rather than
guessing.

So of the vision's seven inputs, five are in: deadline, weight, estimated time,
availability, and previously scheduled work. **Current course grade is not** —
`lib/grades.ts` knows where you stand in every course and `bestBuys` does not
read it. Nor are missing prerequisites, which is §9's problem rather than this
one's.

Not present: weather.

## 2. Learning-management system — **partial**

Shipped: course pages (`screens/Courses.tsx`), syllabus, weekly modules,
readings, assignment detail with instructions, weight, due time and the quoted
sentence it came from, grades (`lib/grades.ts`), announcements
(`screens/Changes.tsx`), professor and TA details, office hours
(`lib/officehours.ts`), class location, attendance with an absence-allowance
warning (`lib/attend.ts`), study materials, personal notes, and group work
(`screens/Groupwork.tsx`).

Absent, and structurally so: **submitting work to an institution.** There is no
LMS write path, and there cannot be one without an LTI or Canvas/Brightspace
integration this app does not have. Assignments are tracked, broken into
subtasks, timed and reminded about; handing them in still happens in
Brightspace. Discussion boards, instructor-authored quizzes, question banks,
academic-integrity controls and accommodation settings are likewise absent —
they are the faculty half of an LMS, and there is no faculty half here (§17).

## 3. Syllabus upload and processing — **shipped**

`screens/Import.tsx` → `lib/generate.ts` → `lib/extract.ts` (pdf.js) and
`lib/cite.ts`. A PDF goes to the model whole, so quotes come back with page
numbers that are checked against the file before anything reaches a screen
(`check`, `worthCiting`). Extracted: course code, professor, meeting times,
room, credits, grading weights, deadlines, and the LMS URL where the syllabus
gives one.

The rules are enforced in code, not just in a prompt: months are validated into
range, ids made unique, figures keyed past the end of the unit list dropped.
The preview lists what was adjusted or thrown out before you accept it.

`screens/Announce.tsx` and `lib/announce.ts` handle a date the instructor
moved. Search within a syllabus is the universal search (§13).

## 4. Study-guide generator, 11 formats — **partial, and not the same 11**

Eleven modes ship (`lib/modes.ts`), so the count matches. The mapping does not:

| The vision's format | What ships |
| --- | --- |
| Comprehensive study guide | `field` — the published guide, masthead to glossary |
| Simple summary | `cram` — everything on one page, closest thing |
| Outline format | *nothing distinct* |
| Bullet-point notes | `slides` — one point per slide |
| Flashcards | `cards`, with `screens/Drill.tsx` for spaced repetition |
| Practice quiz | `quiz` |
| Practice exam | `screens/Exam.tsx` — timed, marked, to a stated format |
| Key terms and definitions | the glossary inside `read`/`field`, not a format of its own |
| Concept map | `figures` and `lib/diagram.ts` (mermaid) |
| Formula and problem-solving | `cases`, plus `#/equations` and `#/solve` |
| Audio / read-aloud | `listen` and `watch`, with real narrated audio per unit |

Absent: the **controls**. `GenerationInput` takes documents, a hint, a year and
the ids already taken. There is no picker for length, difficulty, exam date,
reading level, number of questions, question types, time available, or areas of
weakness, and no "regenerate this section only". Citation, no-invention,
in-course saving, DOCX/PDF export and printing are all shipped.

## 5. Universal calendar — **shipped**

`screens/Calendar.tsx` (2,600 lines), four views — day, week, month, semester —
crossed with four sources. Drag to move in every view, double-tap empty space
to add. Recurring blocks, colour by course, conflict detection (`lib/clash.ts`),
time-zone handling tested under two zones (`npm run test:zones`).

ICS import is real (`lib/ics.ts`, feed sources in state, synced and merged).
Google/Microsoft/Apple/Zoom appear in `lib/connect.ts` as OAuth connections,
but the token exchange runs in dev-server middleware — treat two-way sync with
those three as **not shipped in a built page**.

"Plan my week" is `screens/Ahead.tsx` plus `lib/arrange.ts` and
`lib/windows.ts`. Room and appointment booking: absent.

## 6. Unified assignment center — **shipped**

`lib/select.ts` (`datedItems`) is the single derivation every surface reads.
Views: today, this week, upcoming, overdue, done, by course, by priority,
calendar, and a workload view. Start, percentage, subtasks (`components/BreakItUp.tsx` → `lib/steps.ts`, which makes them ordinary tasks and then stops having an opinion about them),
estimated time, scheduled work sessions, notes, files. The overload warning is
`lib/clash.ts` + `components/WorstDay.tsx`, and it fires on the arithmetic
rather than on a fixed count.

Submitting: see §2.

## 7. Gradebook — **shipped**

`lib/grades.ts` with `standing`, `needFor`, `reachFor`, `reaches` — what you
have, what you need on the final for each target grade, and the caveat when the
answer rests on too little (`needCaveat`). Category weights, dropped scores,
missing-work detection, term and cumulative GPA (`lib/termgpa.ts`,
`lib/credits.ts`), pass/fail, and a grade calculator.

Official versus estimated is kept apart the way the vision demands: entered
scores are the student's, the app's projections are labelled as projections,
and `needCaveat` refuses to project from one data point.

## 8. University email — **partial**

`screens/Mail.tsx` is a **composer**, not an inbox. It drafts the email you
have been putting off — purpose chips, the deadline named, the professor's
address pulled off the syllabus — checks it, and hands it to Gmail, Outlook or
the OS mail app at the compose window. It stops there on purpose.

Absent: inbox, sent, drafts, folders, search over mail, urgent-message
detection, deadline extraction from mail, phishing reporting. All of those need
mail-read scope on a university account, which is the `lib/connect.ts` OAuth
path and is not wired to a mail API.

## 9. Registration — **partial**

`screens/Yes.tsx`: deep links to the registration portal, plus a clipboard
bridge — select your classes in the portal, copy, paste, and `lib/yes.ts` reads
the block into courses with real meeting times and rooms. It refuses to invent
deadlines for them and says so.

Absent: catalog, course search, filters, prerequisite and corequisite checking,
seat availability, waitlist position, schedule builder, saved schedules to
compare, holds, add/drop, withdrawal, pass/fail requests, swaps. Registration
dates themselves are held as registrar landmarks and counted down.

This is the largest gap in the document and the one that most needs an SIS
integration rather than more code.

## 10. Advising and degree planning — **partial**

`screens/Degree.tsx` and `lib/degree.ts`: declared major and minor,
requirements, completed and current courses, what is left, courses that satisfy
more than one requirement, transfer and AP credit, credit totals, expected
progress.

Absent: booking an advising appointment, virtual meetings, advising forms,
advising notes from the advisor's side, major-change requests, advisor approval,
and the advisor's own dashboard. Multi-semester planning exists only as the
degree view, not as comparable plans.

## 11. Financial account management — **shipped on this branch; absent before it**

This was the one whole section of the vision with nothing behind it. `Costs`
held books, access codes and lab fees — what a student chooses to spend — and
nothing held the statement.

`lib/bill.ts` now holds charges, aid, payments and the payment plan, and exists
for four specific mistakes: work-study counted as covering the bill (it is paid
to you, for hours worked, and never reaches the statement); pending aid counted
as confirmed; a loan read as aid rather than as debt; and a payment plan divided
in the head. `split` returns whole cents that add back to the balance exactly
for every number of parts; `addMonths` clamps to the end of a shorter month so
an instalment cannot slide past its late fee.

Shipped with it: `#/costs` as two tabs rather than a second destination, a
`bill` reminder a week out and again the day before, a Today section, the soft
header reporting money instead of a receipt count, and the assistant handed
`owed` and `if_pending_aid_lands` as separate named fields so a model cannot
average a real balance with a hoped-for one.

Absent, and deliberately: **paying**. No card field, no account number, no
stored payment method — the university's own page does that. Also absent: tax
documents, authorised payers, direct deposit, and aid-document upload.

## 12. Campus services — **partial**

| Service | State |
| --- | --- |
| Dining | **shipped** — `lib/meals.ts`, balances logged rather than overwritten, burn rate, the date it runs dry |
| Housing | **shipped** — `lib/housing.ts`, room, term, move-out arithmetic |
| Maps and getting there | **shipped** — `screens/Maps.tsx` with leaflet, saved places, walk timing between buildings |
| Activities and organisations | **shipped** — `screens/Activities.tsx`, commitments with real hours |
| Classmates | **shipped** — one room per class |
| Bookstore | link plus the cost arithmetic (§11) |
| Student ID, dining/building access | **absent** — needs the campus card platform |
| Libraries | **absent** — no account, loans, renewals or room booking |
| Transportation / shuttle | **absent** — maps, but no live shuttle or arrival times |
| Health and counselling | **absent**, correctly: the vision itself says private medical detail should stay in authorised health systems |
| Career services | **partial** — `screens/Applying.tsx` tracks applications and `data/fellowships.ts` carries real fellowships and their deadlines; no appointments, job listings or fairs |
| Mail and packages, recreation, tutoring, tech support | **absent** |
| Emergency alerts | **absent** |

## 13. Unified search — **shipped, with a boundary**

`components/Command.tsx` + `lib/find.ts`. Searches destinations by label, blurb
and keywords, and live records: deadlines, courses, guide units, notes, tasks
and appointments. Scored, with a near-miss tier that tells you when it is
guessing at a spelling rather than matching what you typed (`spelled`).

Documents, sheets and decks are searched on this branch, by their contents as
well as their names — a document by its text, a sheet by what has been typed
into its cells, a deck by its slides — with the haystack capped at twenty
thousand characters so the fourth keystroke stays fast. Before this they were
unfindable, which reads as having lost them.

It still does **not** reach stored files or search inside file contents. The
natural-language examples in the vision mostly work because the destination
keywords are thorough — "financial aid", "payment plan" and "scholarship" now
reach the money screen.

## 14. Semester AI assistant — **shipped**

`src/ai/` — a provider per screen hands the assistant exactly what is on screen
after filters (`ai/shape.ts`), and `lib/context.ts` builds the payload.
`lib/context.test.ts` is the boundary test: a state stuffed with a private
therapy note, another person's name, a letter body and an API key, asserting
none of them appear in what would be sent. **If one of those fails, something
private is leaving the device, and the response is never to change the test.**

Citations are enforced in code (`lib/cite.ts`), not requested in a prompt.

## 15. Notes, files and productivity — **shipped**

Notes with course links, file storage over IndexedDB (`lib/files.ts`), folders,
document scanning, dictation and transcription (`lib/mic.ts`), a focus timer
and alarms, study-session planning, templates, and cross-device sync through
`lib/merge.ts` — which merges field by field with a table, defaulting to
`union` so a field added later and forgotten cannot silently drop one device's
work. Documents, sheets, decks and equations are all real, exporting hand-rolled
OOXML.

Absent: PDF annotation, lecture recording as an audio artefact, version history
on documents.

## 16. Notifications — **shipped**

Nine rules (`data/misc.ts`), each individually switchable, each landing on the
right screen rather than on home (`lib/land.ts`). Fired once per rule per day
by id. The categories the vision names map to: assignments (`two`, `today`),
exams (`exam`), registrar (`term`), money (`bill`), attendance (`attend`),
weekly summary (`sun`), classes (`class`), and the all-clear (`free`).

Quiet hours are on this branch: one window, wrapping midnight, covering every
rule with no exception and none hidden. Nothing is dropped by it — `fire`
keeps the seen list, so a reminder whose rule is still true when the window
lifts arrives then.

Per-course notification settings: absent. Push to a closed browser: not
possible, and Settings says so rather than implying otherwise.

## 17. User roles — **absent**

There is one role: the student. No faculty, advisor, administrator, authorised
payer or campus-staff interface exists, and none of the permission plumbing for
them does either. Everything in this app is a single student's data on a single
student's device.

This is the sharpest divergence from the vision and the one that decides whether
Semester is a student tool or an institutional platform. It should be a
deliberate decision, not a backlog item.

## 18. Accessibility — **shipped, and enforced**

`src/a11y/` is not documentation, it is tests that fail the build:
`labels.ts` walks every screen and fails on a form control a screen reader
cannot name; `landmarks`, `modal`, `motion`, `title`, `type` and `dragging`
cover the rest. `npm run lint` runs the label rule as a linter too, so it fires
in both places. High contrast, adjustable text size, reduced motion and
colour-independent labels are settings; the style ledger
(`src/styles/budget.ts`) holds every font size to a scale, per file, with no
slack to spend.

Every drag gesture in the app has a keyboard equivalent with a role and a name.

## 19. Security and privacy — **shipped for what this app is**

No server holds student data: state is IndexedDB with a localStorage fallback,
and sync is an account copy merged field by field. `screens/Privacy.tsx`,
`screens/Data.tsx` and `lib/erase.ts` give export, deletion and a plain account
of what is stored and how large it is. Addresses copied from portals had
student identifiers stripped out of them before being committed, with the
reason written next to each — `?studentId=`, `?commodoreIdToLoad=`,
`?UrlToken=`.

Absent, because there is no institution behind it: university SSO, MFA,
role-based permissions, audit logs, penetration testing, incident response.

## 20. Integrations — **partial**

ICS calendar feeds are real and merge. `lib/connect.ts` has Microsoft, Google,
Zoom and Apple as OAuth connections whose token exchange lives in dev-server
middleware. There is no Canvas, Brightspace, Blackboard, Moodle, SIS,
degree-audit, payment, campus-card, library, housing or dining integration, and
no LTI. The clipboard is the bridge in every case, which the code argues for
explicitly and which the vision's own §20 endorses over scraping.

## 21. Onboarding — **shipped**

`screens/Onboarding.tsx`, `screens/FirstRun.tsx`, `components/Adopting.tsx`,
`components/SchoolPicker.tsx`. Choose an institution, take or decline the four
shipped courses, import your own, set notifications, personalise the dashboard.
Capabilities per school (`lib/school.ts`) hide tiles a university does not
offer, so the app does not promise a meal plan to somebody who has none.

Absent: signing in with university credentials, and the permissions review that
would follow it.

## 22. Navigation — **shipped, and more than asked for**

Four selectable navigations — tab bar, one feed, springboard, shelves — over
three shells. A universal search and the assistant are on every screen. The
`.claude/commands/simplify.md` discipline ("every thing has exactly one home
and one route to it") is a standing effort with two audits behind it, and it is
why the bill in §11 is a tab rather than a fifty-third destination.

## 23. What to avoid — **held**

Not a link farm: every linked-out service has arithmetic on top of typed
figures. Not gamified: no points, streaks or badges anywhere. Not social. Not
an unsourced chatbot: citations are checked in code. Official and estimated are
labelled apart, in `lib/grades.ts` and now in `lib/bill.ts` and the assistant
payload. Notification volume is deliberately low — two strikes per deadline, at
a week and a day.

## 24. Roadmap position

Phase 1 is complete. Phase 2 is complete except for university email as an
inbox and two-way calendar sync in production. Phase 3 is not started and needs
faculty roles and an SIS. Phase 4 has dining, housing, maps and — as of this
branch — billing and aid; the card, library, transport, career and health
services are not started. Phase 5 is not applicable without an institution.

---

## What was changed on this branch

- **`lib/bill.ts` and the money screen** — §11, which had nothing behind it.
  See the commit message for the four mistakes it exists to prevent.
- **`money()` now groups thousands** — written for a $64.99 textbook, and
  `"$32415.00"` is misread at a glance.
- **The soft header on `#/costs`** reported "Costs · 0 · No costs yet" above a
  headline reading "$15,921.50 owed". A summary that disagrees with the screen
  under it is worse than no summary.
- **The add-a-line chooser** was a hand-rolled row of pills whose "Aid" button
  had the same accessible name as the "Aid" section above it. It is the shared
  `Segmented` now. Found by driving the screen in a browser.
- **Search reaches the things the app made** — §13. Documents, sheets and decks
  were real and unfindable; they are searched by their contents now, and each
  opens its own screen rather than the list that holds it.
- **Quiet hours** — §16, and the wrap around midnight is why `inQuiet` is a
  function with a test rather than a comparison at a call site.

## What is worth doing next, in order

1. **Decide on §17.** Whether Semester is a student tool or an institutional
   platform is the question every other gap hangs off. Registration (§9),
   advising appointments (§10), LMS submission (§2) and faculty gradebooks all
   wait behind it.
2. **Study-guide controls (§4).** The generator exists and is good; length,
   difficulty, question count and "regenerate this section" are additive, need
   no institution, and are the most-used feature's biggest gap.
3. **Stored files in search (§13).** Documents, sheets and decks are found now;
   files in IndexedDB are not, and they are the ones with a name and no
   preview, which is exactly when search matters most.
4. **Should the prioritiser read your standing (§1)?** It weighs points of
   final grade per hour and does not read `lib/grades.ts`. Whether it should is
   a real question rather than an oversight: an hour spent where you are on a
   grade boundary is worth more than the same hour in a course already settled,
   and it is also the change most likely to make a considered ordering feel
   arbitrary. It is left alone deliberately, and should be decided rather than
   drifted into.
5. **Per-course notification settings (§16).** The remaining half of the
   notification controls the vision names.
