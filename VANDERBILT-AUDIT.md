# The Vanderbilt data in this app, audited against the university's own site

A pass over everything in `app/src` that claims to know something about
Vanderbilt — where that knowledge lives, whether it reaches a screen, and what
the university publishes that the app did not have.

Baseline and result are both green: `npx tsc -b`, `npm run lint`, `npm test`
(382 files, 7,951 tests).

## The constraint this pass ran under, stated first

**vanderbilt.edu was not read.** This session's network egress policy refuses
it. Three hosts were tried and all three failed the same way:

| Host | How it was tried | Result |
| --- | --- | --- |
| `www.vanderbilt.edu` | WebFetch | `EGRESS_BLOCKED` |
| `registrar.vanderbilt.edu` | WebFetch | `EGRESS_BLOCKED` |
| `vanderbilt.edu`, `registrar.…`, `www.library.…` | `curl` | `CONNECT tunnel failed, 403` |

The proxy's own log confirms it rather than leaving it to inference:
`connect_rejected — gateway answered 403 to CONNECT (policy denial)`,
`host: www.vanderbilt.edu:443`.

So no page on that site was parsed, and nothing below is a transcription of
one. What the pass could use was a search index, which returns titles and URLs
for pages that exist, and the repository itself, which is read directly and is
where most of the findings are. **Where a fact could not be established
without reading the page, it was left out rather than guessed at** — the rest
of this file says exactly where that line fell.

## What is verified, and what is not

Every value this audit added is listed here with the strongest source behind
it. The distinction that matters is not how confident the wording sounds but
whether anything independent of the source could contradict it.

**Independently corroborated.** Two Fall 2026 syllabi in `project/uploads`,
written by the instructors teaching the courses, agreeing with each other and
with the real calendar:

| Value | Date | Checked against |
| --- | --- | --- |
| Classes begin | Wed 26 Aug 2026 | Two syllabi; PSCI 1104's Tue/Thu lecture series |
| Fall Break | Thu 22 – Fri 23 Oct | ECON 1020 states the range; PSCI 1104 corroborates |
| Thanksgiving Break | Sat 21 – Sun 29 Nov | ECON 1020 states the range; PSCI 1104 has no lectures inside it |

**Not verified.** Everything below came from a search index. None of it was
read from `vanderbilt.edu`, which the network egress policy refused for the
whole of this work — the registrar's calendar, the dining pages, the
enrollment bulletin, the student newspaper and a third-party aggregator
alike:

| Value | Date or figure | Status |
| --- | --- | --- |
| Open enrollment ends | Fri 4 Sep 2026 | unverified |
| Last day to drop without a W | Fri 4 Sep 2026 | unverified date; the *policy* tying it to open enrollment is from two Vanderbilt pages |
| Spring 2027 registration opens | Mon 26 Oct 2026 | unverified |
| Last day to withdraw from a course | Fri 30 Oct 2026 | unverified |
| Last day to change to pass/fail | Fri 30 Oct 2026 | unverified date; the *policy* tying it to withdrawal is from two Vanderbilt pages |
| Final grades due | Mon 21 Dec 2026 | unverified |
| First-Year Plan | 335 meals · $225 | unverified |
| Upper-Division Plan | 305 meals · $275 | unverified |
| The ten campus service addresses | — | unverified; each is editable in the app, as `data/campus.ts` says of every address it ships |

### What "unverified" does and does not mean here

It does **not** mean unchecked. Each date was held against what this
repository *can* test, and that arithmetic rejected three values along the
way: the graduate calendar's 5–13 December exam window, a registration date
that was the window's closing rather than its opening, and a grades date
falling before two of the four courses sit their finals.

What those checks establish is internal consistency — the weekday is real,
the ordering is possible, nothing contradicts the syllabi. What they cannot
establish is that a date belongs to **this** academic year. A 2025–26
deadline would pass every one of them.

So the failure mode left open is a plausible date from the wrong year sitting
under a heading that reads "What Vanderbilt publishes". The Term deadlines
screen mitigates it by design — every row is proposed for confirmation and
nothing is saved until a student ticks it — but that mitigation is a student
reading carefully, not a check.

### Closing this out

One page settles all of them at once:
`registrar.vanderbilt.edu/calendars/2026-27-academic.php`. Two routes,
neither of which needs this session:

1. Paste that page into the app's own **"Paste the page"** door on Term
   deadlines. It parses the dates and matches each to a landmark through the
   same `HINTS` this profile's labels were chosen against, so a student's own
   confirmed dates override the bundled guesses.
2. Or hand it to whoever next works on this profile, and the September,
   October and December dates can be corrected at source in
   `vanderbilt.json`.

Until then the honest summary is: three dates in this profile are evidenced,
and the rest are educated, checked, and unconfirmed.

## Where Vanderbilt lives in the app

Three places, and only one of them reaches a screen.

| Where | What it holds | Reaches a screen? |
| --- | --- | --- |
| `data/campus.ts` | `CAMPUS_LINKS` — the addresses | **Yes.** Links, and by id from Meals, Costs, Bill, Housing, Runway |
| `data/schools/vanderbilt.json` | the school profile — capabilities and a data pack | **Now yes.** It did not when this pass began — see below |
| `lib/maps.ts`, `lib/findplace.ts` | the campus map: `CAMPUS_MAP`, and the bounding box campus search is biased towards | Yes |

## What was wrong

### 1. Half the school profile is written down and never read

`lib/school.ts` declares the profile, `data/schools/vanderbilt.json` fills it
in, and when this pass began ten of its fields were read by nothing. Grepped
across `app/src`, excluding the declaration itself and the tests:

| Field | Set in `vanderbilt.json`? | Was read by | Now rendered on |
| --- | --- | --- | --- |
| `capabilities.registrarUrl` | yes — `yes.vanderbilt.edu` | nothing | Links |
| `capabilities.lmsUrl` | yes — `brightspace.vanderbilt.edu` | nothing | Links |
| `capabilities.orgPortalUrl` | yes — `anchorlink.vanderbilt.edu` | nothing | Links |
| `capabilities.libraryUrl` | yes — `library.vanderbilt.edu` | nothing | Links |
| `capabilities.healthUrl` | yes — `vanderbilt.edu/student-health` | nothing | Links |
| `capabilities.advisingUrl` | yes — `vanderbilt.edu/academic-advising` | nothing | Links |
| `data.academicCalendar` | no | nothing | Term deadlines |
| `data.mealPlanTiers` | no | nothing | Meal plan |
| `data.athleticsFeedUrl` | no | nothing | Connect |
| `data.buildings` | no | nothing | —, and rightly |

The first three were not in the original count and belong in it: they are
addresses the profile carries, they were read by nothing either, and for
Vanderbilt they were invisible only because `CAMPUS_LINKS` names YES,
Brightspace and AnchorLink itself.

This is the finding that decided the shape of the rest of the pass. The
obvious reading of "put the university's data in the relevant field" is to
fill `data.academicCalendar` with the term dates and `capabilities` with the
service addresses — and it would have changed nothing on any screen, because
no screen asks for either. A populated field that renders nowhere is worse
than an empty one: it reads as done.

The six `*Url` capabilities are the sharper half of it, because they are
populated. Somebody filled them in expecting them to appear.

One of the ten is not missing work at all:

- **`data.buildings`** is unused because the map does not need it. `findplace.ts`
  searches OpenStreetMap live, biased to a box drawn around campus
  (`[-86.812, 36.155, -86.788, 36.136]`), so `capabilities.campusMap: true` is
  honest — the capability is backed by the map, not by a bundled list.
`lib/campusdirectory.ts` is not on the list for the same kind of reason: it
is a parser for a directory a student supplies, not a profile field.

The decision was to render them, and the second half of this branch does.
Where each one went, and why there:

- **The six addresses → Links**, through `lib/schoollinks.ts`, which turns a
  profile into ordinary `CampusLink` rows and drops any address the screen
  is drawing already. That dedupe is the whole reason this is not visible
  duplication: for Vanderbilt it suppresses four of the six, and what
  survives is Student health and Academic advising, which nothing had. For
  a school somebody added themselves all six survive, which is the case it
  is really for.
- **`academicCalendar` → Term deadlines**, as a third door beside "Fill them
  in" and "Paste the page". `fromCalendar` in `lib/registrar.ts` turns a
  published term into the same `Found[]` the paste door produces, so it
  arrives the same way: every row proposed, every row tickable, nothing
  saved until somebody says so. A school's own wording is matched to a
  landmark by the same `HINTS` the parser uses, so "Last day to drop a
  course without a W" lands on `drop-clean` rather than on a row of its own.
  The screen's promise — the app ships the questions, not the answers —
  survives a school that happens to know the answers, because a profile can
  be a year stale.
- **`mealPlanTiers` → Meal plan**, as what the school says a plan holds
  against what you have left. It is the one number the balance page never
  shows you.
- **`athleticsFeedUrl` → Connect**, as one button beside the paste field.

Every one of them is gated on the field being there: absent, and there is no
heading, no tab and no empty state apologising for somebody's university.
That is the rule `lib/school.ts` already states for screens, applied to the
rows inside them.

### 2. The links screen had the portals and none of the institution

`CAMPUS_LINKS` is the one live surface, and before this pass it held twelve
addresses: the sign-on portals (oneVU, myVU, Brightspace, YES ×3), the
transactional systems (CBORD, StarRez, Student Access, Top Hat, AnchorLink),
plus tickets, the bookstore and four social accounts.

What it did not hold was the university — the offices a student is actually
sent to. The registrar's published calendar is the clearest case: the app has
a **Term deadlines** feature whose entire input is dates a student types in,
and the page those dates are printed on was not linked from anywhere in the
app.

**Ten addresses added**, each one a URL that a search index returns for the
university's own site, each in the file's existing idiom — a starting point
the student can correct in one tap, with a note saying what it is for:

| Link | Address |
| --- | --- |
| Registrar · Academic calendar | `registrar.vanderbilt.edu/calendars/` |
| Registration dates | `vanderbilt.edu/enrollmentbulletin/registration-essentials/registration-dates/` |
| Campus Dining · Meal plans | `vanderbilt.edu/dining/meal-plans/undergraduate-plans/` |
| Housing and Residential Experience | `vanderbilt.edu/ohare/` |
| Financial Aid and Scholarships | `vanderbilt.edu/financialaid/` |
| Career Center | `vanderbilt.edu/career/` |
| Vanderbilt Libraries | `library.vanderbilt.edu` |
| Student Care Network | `vanderbilt.edu/student-care-network/` |
| Public Safety (VUPD) | `publicsafety.vanderbilt.edu/` |
| Vanderbilt IT | `it.vanderbilt.edu/` |

Three of them pair with a portal already in the list and the notes say so, so
the screen does not read as two links to the same thing: Campus Dining is what
a plan contains where CBORD is what is left of yours; O'HARE is the office
where StarRez is the portal; the registrar is the calendar the Term deadlines
come out of.

The notes carry three phone numbers, because a number you can dial from the
note is the point of the row: VUPD non-emergency **615-322-2745**, Student Care
Coordination **615-343-WELL (9355)**, the IT help desk **615-343-9999**.

## What was deliberately not done

**No term dates were written into the app.** This is the one that matters.

`data.academicCalendar` is shaped to hold exactly what the registrar
publishes — term start and end, deadlines, breaks, reading days, finals. The
temptation was to fill it. What a search index returned was one unattributed
fragment: *"Fall classes end on December 4, examinations and reading days are
December 5-13, Thanksgiving holidays are November 22-30"* — with no year
confirmed, and surfaced from a **graduate school** calendar, which is not the
undergraduate one.

Writing that into a deadline app would put a date in front of a student that
nobody checked. The file this pass spent most of its time in already states
the rule, and it applies to dates far more than to addresses:

> a wrong link that looks confident is worse than an empty field that asks

Nor were the unread `capabilities` or the unread `data` branches populated,
for the reason in finding 1: filling a field no screen reads is not an
implementation.

## The calendar, filled in from the syllabi rather than the registrar

The registrar's page is still unreachable, so `data.academicCalendar` was
filled from a source that *is* reachable: the Fall 2026 syllabi in
`project/uploads`, written by the instructors teaching the courses. Each date
below is corroborated by two of them independently, and the weekday each
falls on was checked against the real calendar:

| What | Date | Where it came from |
| --- | --- | --- |
| Classes begin | Wed 26 Aug 2026 | The BUS syllabus filename is dated 8/26/2026; PSCI 1104's first Tuesday/Thursday lecture is Thu 27 Aug, which a Wednesday start fits |
| Fall Break | Thu 22 – Fri 23 Oct | ECON 1020: *"Fall Break: October 22–23rd (I.e., No Class Friday)"*. PSCI 1104: *"Lecture 17 October 22: Fall Break"* |
| Thanksgiving Break | Sat 21 – Sun 29 Nov | ECON 1020: *"Thanksgiving Break: November 21st–29th (Full Week Off)"*. PSCI 1104 has no lectures on 24 and 26 Nov |

PSCI 1104's 31 lectures fall on a clean Tuesday/Thursday without exception,
and ECON 1020's two midterms land on the Wednesdays its syllabus claims. That
internal consistency is what makes these worth shipping.

### What was left blank, and why each one

- **The last day of classes.** PSCI 1104's last lecture is Thu 10 December,
  but a Monday/Wednesday/Friday course would still meet on Friday the 11th,
  and nothing here says which of the two the term ends on. `endsOn` is the
  empty string and `fromCalendar` skips it.
- **The final exam period.** ECON 1020 names its registrar-assigned slots —
  15 and 16 December — and PSCI 1104's final is the 17th, so the period
  certainly *includes* 15–17 December. That is a lower bound, not the period,
  and writing it as the period would understate it for anybody whose exam
  falls outside.
- **All six registrar deadlines.** See below: four written on the first pass,
  two refused and then written on better dates.

The earlier fragment quoted below — exams and reading days 5–13 December,
from a graduate calendar — is now positively **contradicted** by PSCI 1104's
final on 17 December. Good evidence that leaving it out was right.

### Two registrar deadlines, and the mislabel that nearly shipped

Two of the six are now written, at the owner's direction and on the same
search-index evidence as the meal plans:

| Deadline | Date | Landmark |
| --- | --- | --- |
| Open enrollment ends | Fri 4 Sep 2026 | `add-deadline` |
| Last day to drop without a W | Fri 4 Sep 2026 | `drop-clean` |
| Last day to withdraw from a course | Fri 30 Oct 2026 | `withdraw` |
| Last day to change to pass/fail | Fri 30 Oct 2026 | `passfail` |
| Spring 2027 registration opens | Mon 26 Oct 2026 | `registration` |
| Final grades due | Mon 21 Dec 2026 | `grades` |

**The label on the first one is the whole point of this entry.** The source's
own phrase for 4 September is *"add/drop deadline"* — and `HINTS` in
`lib/registrar.ts` matches "add/drop deadline" to **`drop-clean`**, the last
day to drop *without* a W, which the app describes as "The big one. After this
the course stays on your transcript with a W against it."

4 September is not that date. A second search established it as the close of
*open enrollment*, two weeks into term; a drop-without-a-W deadline falls six
weeks later. Writing the source's own wording would have filed an early
add/drop close as the deadline that decides whether a course lands on a
transcript — a student ticking that row would have believed they had until
September for a decision they actually have until late October to make, and
would have made it early or not at all.

So the label is chosen for the landmark it resolves to rather than copied:
"Open enrollment ends" matches `add-deadline`, which is what the date is. A
test pins both mappings.

### 4 September carries two meanings, and the first pass only wrote one

The entry above was, at first, filed under `add-deadline` alone, and the
audit recorded `drop-clean` as unfillable — "nothing reachable from here
carries a drop-without-a-W date for Fall 2026". That was too cautious, and the
thing that settled it is Vanderbilt's own policy rather than any date:

> A course dropped during Open Enrollment does not show on a transcript.
> Courses dropped after the deadline to "drop with no entry on the record"
> will be entered on the student's record with a grade of W.

Two searches returned that independently, citing the Enrollment Bulletin's
Open Enrollment page and the College of Arts and Science's course-withdrawal
page. It means the close of open enrollment **is** the last day to drop
without a W at this university: they are not two deadlines a week apart, they
are one date with two consequences.

So 4 September is now written twice, once per landmark, because the app has a
different cost line for each — "After this, adding anything needs a signature
and a good reason" against "The big one. After this the course stays on your
transcript with a W against it." A student ticking both sees both. A test
pins that the date resolves to `add-deadline` and `drop-clean` and to nothing
else.

Note what is and is not corroborated here. The **policy** — open enrollment
close equals drop-without-record — is well supported, from two of the
university's own pages. The **date** itself, 4 September, rests on the same
search-index evidence as before and is no stronger for this finding.

### 30 October carries two meanings as well

The same shape as 4 September, and again it is a policy rather than a date
that settles it:

> Students may elect the pass/fail option or change a course from pass/fail
> to graded status **until the deadline for withdrawal for each term.**

Corroborated across the Enrollment Bulletin's Pass/Fail page and the College
of Arts and Science's own pass/fail policy. So `passfail` is not a date of its
own at this university: it is the withdrawal date, and 30 October now carries
both landmarks for the same reason 4 September carries two.

### Both refusals were later overturned — by better dates, not by relenting

The two entries below were refused on the evidence available at the time. Asked
to add them anyway, the pass that followed searched again rather than writing
the rejected dates, and found that in each case the refusal had been right
about the date and wrong to stop there:

| | Refused | Written | Why the first one failed |
| --- | --- | --- | --- |
| Registration | Fri 13 Nov | **Mon 26 Oct** | The 13th is when registration *closes*. Registration runs 26 Oct – 13 Nov, and the landmark means the opening |
| Grades | 15 Dec | **Mon 21 Dec** | The 15th falls before two of the four courses sit their finals |

Both new dates land on the weekday their source claims, and 21 December clears
PSCI 1104's final on the 17th by four days where 15 December preceded it by
two. The original reasoning is kept below because it is what sent the second
pass looking for a different date instead of writing the wrong one.

### The two refusals, as they stood

`registration` and `grades` stay empty, and not for want of a candidate date.
Each had one, and each was rejected on evidence:

- **Registration.** The only date found *at the time* was Friday 13 November 2026 — and it is
  when Spring 2027 registration *windows close*. The landmark is "Registration
  opens for next term", whose cost line reads "Assigned by hour, and the
  sections you need go in the first morning". Filing a closing date there
  would tell a student registration opens on the day it actually shuts, and
  every label containing the word "registration" resolves to that landmark, so
  there is no safe wording for it either.
- **Grades.** The only date found *at the time* was 15 December, as a "final
  grading due date" — and the syllabi in `project/uploads` contradict it
  outright. ECON
  1020 sits a final exam slot **on** 15 December and another on the 16th, and
  PSCI 1104's final is the 17th. Grades cannot be due before the exams are
  sat, so whatever that date belongs to, it is not Fall 2026 undergraduate
  grading.

That second one is the third time primary sources in this repository have
caught a search result that looked fine: first the graduate calendar's
5–13 December exam window, then the "add/drop deadline" wording that resolved
to the wrong landmark, now this.

Both were written in the end, on different and better dates — see the section
above. The tests that once asserted their absence now pin the dates and the
reasoning that rejected the first candidates for each.

### Meal plan tiers: the counts and the Meal Money, at the owner's direction

`data.mealPlanTiers` is filled with two plans — First-Year 335 and
Upper-Division 305, both per semester. Where they came from matters, because
it is a weaker source than the syllabi that produced the calendar above:

- Not the dining page. `vanderbilt.edu/dining` is blocked here like the rest.
- Not the repository. No syllabus or study guide mentions dining at all.
- A **search index**, in two separate rounds: one returned "First-Year Plan:
  With 335 meals", the other "Sophomores receive the Upper-Division Plan, with
  305 meals per semester". Neither is attributed to a page or to an academic
  year, and the two are one backend agreeing with itself rather than two
  sources agreeing with each other.

That was put to the repository's owner with the reasoning above, and the
decision to ship the two numbers is theirs. It is recorded here rather than
left implicit, because the same source produced calendar dates this audit
declined to write, one of which the syllabi later contradicted outright.

**Meal Money followed, from the same kind of source.** A later search returned
both plans in one coherent shape — 335 meals with **$225** of Meal Money, 305
meals with **$275** — alongside per-semester costs of roughly $4,260 and
$4,216. That is the first corroboration the swipe counts had had, and it is
why they now carry a dollar figure each.

It is still not the dining page. The result's own links point at *The
Vanderbilt Hustler*, the student newspaper, and two third-party sites; none of
the three is reachable from here either, because the egress policy is an
allowlist rather than a block on `vanderbilt.edu`. The search claimed the
figures are 2026–27, but that attribution is the search engine's assertion
rather than anything quoted from a page.

What bounds the risk is that **nothing computes from `mealPlanTiers`**. Grepped
across `app/src`, its only reader is the reference table on the Meal plan
screen. The rate, the runway and the day-it-runs-out arithmetic all run on
balances the student logs off their own account, so a wrong figure here misprints
a row rather than producing a wrong answer about money.

The screen also now says, in one clause, that the balance page is the thing to
check these counts against. That is the same rule `data/campus.ts` keeps for
every address it ships: a starting point somebody can correct, not a fact.

### A bug the real data found

Writing two breaks into one term surfaced a defect in `fromCalendar`: `HINTS`
matches both "Fall Break" and "Thanksgiving Break" to the `break` landmark,
and treating that landmark as an identity dropped Thanksgiving silently. A
term having two breaks is ordinary, so a landmark is now proposed once and
anything else matching it is kept in the school's own words with no landmark
— exactly what the paste door does with a line it cannot place. A date the
school published is never silently dropped.

## What the live site would still settle

Everything here needs a page actually read, which this session could not do
at any point. Note the shift since the first pass: most of these are no
longer blanks to fill but values to confirm.

1. **Confirmation of all six registrar deadlines**, and the two bounds still
   blank — the last day of classes and the final exam period. The pages exist
   — `registrar.vanderbilt.edu/calendars/2026-27-academic.php` and
   `…/2026-27.php`. The deadlines are filled now, but from a search index:
   see the verification ledger near the top. This page would turn six
   unverified dates into six checked ones and fill the two gaps.
2. **Confirmation of the meal plan tiers** — the swipe and dollar figures are
   in `data.mealPlanTiers`, also unverified, and
   `vanderbilt.edu/dining/meal-plans/undergraduate-plans/` is where they can
   be checked against what the university actually publishes.
3. **Whether `healthUrl` and `advisingUrl` still resolve.** Both were in the
   profile before this pass and neither was verifiable from here.
4. **The homepage's own navigation and footer** — the audit's original brief.
   Whatever the top nav, utility nav and footer link to is the definitive list
   of what belongs on the Links screen, and the ten above are a reconstruction
   from search, not that list.
5. **The four social handles**, which the file already flags as the app's best
   guess rather than verified fact.
