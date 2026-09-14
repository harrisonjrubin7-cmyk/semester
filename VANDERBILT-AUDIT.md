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

## Where Vanderbilt lives in the app

Three places, and only one of them reaches a screen.

| Where | What it holds | Reaches a screen? |
| --- | --- | --- |
| `data/campus.ts` | `CAMPUS_LINKS` — the addresses | **Yes.** Links, and by id from Meals, Costs, Bill, Housing, Runway |
| `data/schools/vanderbilt.json` | the school profile — capabilities and a data pack | **Partly.** See below |
| `lib/maps.ts`, `lib/findplace.ts` | the campus map: `CAMPUS_MAP`, and the bounding box campus search is biased towards | Yes |

## What was wrong

### 1. Half the school profile is written down and never read

`lib/school.ts` declares the profile, `data/schools/vanderbilt.json` fills it
in, and seven of its fields are read by nothing. Grepped across `app/src`,
excluding the declaration itself and the tests:

| Field | Set in `vanderbilt.json`? | Read by |
| --- | --- | --- |
| `capabilities.libraryUrl` | yes — `library.vanderbilt.edu` | nothing |
| `capabilities.healthUrl` | yes — `vanderbilt.edu/student-health` | nothing |
| `capabilities.advisingUrl` | yes — `vanderbilt.edu/academic-advising` | nothing |
| `data.academicCalendar` | no | nothing |
| `data.buildings` | no | nothing |
| `data.mealPlanTiers` | no | nothing |
| `data.athleticsFeedUrl` | no | nothing |

This is the finding that decided the shape of the rest of the pass. The
obvious reading of "put the university's data in the relevant field" is to
fill `data.academicCalendar` with the term dates and `capabilities` with the
service addresses — and it would have changed nothing on any screen, because
no screen asks for either. A populated field that renders nowhere is worse
than an empty one: it reads as done.

The three `*Url` capabilities are the sharper half of it, because they are
populated. Somebody filled them in expecting them to appear.

Two of the seven are not really missing work:

- **`data.buildings`** is unused because the map does not need it. `findplace.ts`
  searches OpenStreetMap live, biased to a box drawn around campus
  (`[-86.812, 36.155, -86.788, 36.136]`), so `capabilities.campusMap: true` is
  honest — the capability is backed by the map, not by a bundled list.
- **`lib/campusdirectory.ts`** is a parser for a directory a student supplies,
  not bundled data, so it is not a gap either.

The other five are a decision nobody has made yet: render them, or delete
them from the type. This pass did neither — it is a change to the app's
screens, not to its data, and it should be made deliberately.

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

## What the live site would still settle

Everything here needs a page actually read, which this session could not do:

1. **The 2026–27 undergraduate academic calendar.** The pages exist —
   `registrar.vanderbilt.edu/calendars/2026-27-academic.php` and
   `…/2026-27.php` — and would fill `data.academicCalendar` properly, once
   something reads that field.
2. **Undergraduate meal plan tiers** — the swipe and dollar figures per plan,
   for `data.mealPlanTiers`, from `vanderbilt.edu/dining/meal-plans/undergraduate-plans/`.
3. **Whether `healthUrl` and `advisingUrl` still resolve.** Both were in the
   profile before this pass and neither was verifiable from here.
4. **The homepage's own navigation and footer** — the audit's original brief.
   Whatever the top nav, utility nav and footer link to is the definitive list
   of what belongs on the Links screen, and the ten above are a reconstruction
   from search, not that list.
5. **The four social handles**, which the file already flags as the app's best
   guess rather than verified fact.
