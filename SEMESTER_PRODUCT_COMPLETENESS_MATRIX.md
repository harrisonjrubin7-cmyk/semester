# Semester — product completeness matrix

§226's deliverable. Every feature classified across the six states and thirteen
defect flags §226 names, measured against the tree rather than read off the
specification.

Measured at `origin/main` `e4cf671`, 21 September 2026.

§226's second instruction — *"Do not merely document gaps. Fix them according
to priority"* — is what the last section is for. This file is the first commit
of that work, not the whole of it.

---

## What the probe can and cannot see

Five readings in this document were wrong before they were right, and all
five were the probe rather than the tree. [CLAUDE.md](CLAUDE.md) requires
that a clean reading be treated as a claim about the probe too, so the
corrections are recorded here rather than quietly fixed:

1. **`ask` read as having no component.** It is imported from `ai/Chat` through
   a named-export unwrap — `lazy(() => import('./ai/Chat').then((m) => ({ default: m.Chat })))`
   — and the first regex only matched `screens/`. Probe fault.
2. **`meet` read as untested.** `lib/meet.test.ts` is 558 lines. The first
   probe matched on the *screen id* rather than the module. Probe fault — and
   the fix surfaced a real distinction worth keeping: `meet`'s **logic** is
   tested and its **screen** is not. Both are columns below.
3. **`equations` read as having no navigation group.** It has one. The field
   sat past the end of a fixed-size read window, behind the longest `keywords`
   string in the registry. Probe fault, and the only one of the four that had
   already been written up as a defect with a fix attached — see
   **DISCONNECTED** below.
4. **Thirty-eight screens read as untested, and `classmates` and `groupwork`
   were named as the worst.** The probe counted only tests that *import* a
   module, and missed structural tests that open a file by path — a genre this
   repository uses heavily and CLAUDE.md singles out for praise. The real
   figure is 17, and neither of those two is in it. See **MISSING TESTS**.
5. **`brief` and `announce` read as having no tested logic.** Their components
   are `screens/Reports.tsx` (78 lines) and `screens/Changes.tsx` (58 lines),
   thin containers that delegate to `./report/Day|Week|Term` and hold no `lib/`
   imports of their own. The probe looked one level deep. Probe fault.

**So the "tested logic" column understates container screens**, and every row
where it reads 0 was checked by hand. That is the limit of this measurement,
stated up front rather than discovered by whoever trusts it next.

Controls that must pass for the numbers below to mean anything, all passing:

| control | why |
| --- | --- |
| exactly one destination unresolved, and it is `home` | `home` is resolved by `homeShape` in `App.tsx`, not the screens table — documented in `screens.tsx` |
| `ask` resolves | catches correction 1 above |
| `meet` reads screen-untested **and** logic-tested | catches correction 2, in both directions |
| `classmates` reads server-backed | a probe that sees no server anywhere would otherwise pass |
| `clocks` reads device-only | and one that sees a server everywhere would too |
| 59 destinations found | the registry's own count |
| more than 100 `lib/` imports parsed across all screens | a parse that stops matching reports everything unconnected and looks like a finding |

---

## The shape of the answer

**59 destinations. 7 reach a server. 52 are device-only.**

That single number decides most of this matrix, and it is not a defect — it is
the product. `lib/privacy.ts` tells students *"Everything in this app runs on
your device… Signed out, nothing leaves the device at all."* So
**MISSING BACKEND applies to 52 of 59 features and is the wrong flag for all of
them**, in the same way that a bicycle is not a car with the engine missing.

§226's flag list assumes a product where the server is the system of record.
This one inverts that. Where the flag is applied below it means *this feature
needs a server it does not have*, not *this feature has no server*.

The seven that do reach one: `classmates`, `groupwork`, `calendar`, `connect`,
`account`, `privacy`, `profile`.

---

## Part 1 — the fifty-nine destinations

`logic` is the count of `lib/` modules the screen imports that have a test file,
over the count it imports. `screen` is component-level test files.

### Semester

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `home` Today | **CONNECTED** | device | — | — | resolved by `homeShape`; four tabs, two of them merged-in screens |
| `brief` Reports | **FUNCTIONAL** | device | container | 0 | delegates to `report/Day|Week|Term` |
| `calendar` Calendar | **CONNECTED** | **server** | 14/16 | 1 | external feeds via `public.calendar_feeds`; 2,356 lines |
| `work` Work on it | **FUNCTIONAL** | device | 7/10 | 0 | |
| `behind` When you are behind | **CONNECTED** | device | 5/6 | 0 | reads the same record the planner does |
| `me` Progress | **FUNCTIONAL** | device | 2/3 | 0 | |

### Courses

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `courses` Courses | **CONNECTED** | device | 9/10 | 0 | three grains incl. grades |
| `import` Add a course | **PRODUCTION READY** | device | 15/17 | 3 | §90's confirm-before-import; citations to page |
| `edit` Edit the course | **FUNCTIONAL** | device | 4/5 | 0 | |
| `degree` The degree | **CONNECTED** | device | 3/3 | 1 | |
| `registrar` Term deadlines | **FUNCTIONAL** | device | 3/3 | 0 | |
| `sources` Sources | **CONNECTED** | device | 2/3 | 0 | §115 materials library |
| `yes` Registration | **PARTIALLY FUNCTIONAL** | device | 2/3 | 0 | clipboard bridge; no registrar API exists |
| `announce` A change to a date | **FUNCTIONAL** | device | container | 0 | 37 lines |

### Study

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `study` Study | **CONNECTED** | device | 11/13 | 2 | eleven modes |
| `update` Add a reading | **CONNECTED** | device | 18/21 | 1 | every mode picks it up |
| `exam` Practice paper | **CONNECTED** | device | 6/8 | 0 | §110, sat and marked |
| `runway` Exam runway | **CONNECTED** | device | 10/11 | 0 | §104 |
| `solve` Work the problem | **FUNCTIONAL** | device | 5/7 | 1 | |
| `analyse` Analyse data | **FUNCTIONAL** | device | 5/7 | 0 | |
| `meet` Where courses meet | **FUNCTIONAL** | device | 4/5 | **0** | logic tested, screen not |
| `ask` Ask Claude | **CONNECTED** | device | 2/5 | 0 | `ai/Chat`; lowest logic coverage of any large screen |

### Make

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `sheet` Sheet or table | **FUNCTIONAL** | device | 23/26 | 2 | 4,033 lines — the largest screen in the app |
| `write` Write a document | **FUNCTIONAL** | device | 14/17 | 3 | 2,318 lines |
| `deck` Make a deck | **FUNCTIONAL** | device | 10/12 | 1 | real `.pptx` |
| `draw` Draw it | **FUNCTIONAL** | device | 5/7 | 0 | |
| `essay` Draft it | **FUNCTIONAL** | device | 4/7 | 1 | |
| `proof` Check the writing | **FUNCTIONAL** | device | 5/6 | 0 | |
| `create` Create | **CONNECTED** | device | 3/5 | 1 | fronts the seven above — §237's precedent |
| `equations` Equations | **FUNCTIONAL** | device | 4/5 | 0 | |

### Campus

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `classmates` Classmates | **CONNECTED** | **server** | 6/7 | structural | RLS-enforced; covered by `lib/roomkeys.test.ts` + `components/room/rooms.test.tsx` |
| `groupwork` Group work | **CONNECTED** | **server** | 4/4 | structural | covered by `lib/roomkeys.test.ts`, `lib/signedout.test.ts` |
| `university` University | **FUNCTIONAL** | device | 4/7 | 1 | |
| `maps` Getting there | **FUNCTIONAL** | device | 9/10 | 0 | 919 lines |
| `activities` Activities | **FUNCTIONAL** | device | 6/6 | 0 | §47.10's private half |
| `housing` Housing | **FUNCTIONAL** | device | 6/6 | 0 | |
| `meals` Meal plan | **FUNCTIONAL** | device | 5/5 | 0 | |
| `call` Video call | **UI ONLY** | device | 0/0 | 1 | 76 lines, launches an external call |

### Life

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `mine` Personal | **CONNECTED** | device | 11/12 | 1 | tasks, appointments, notes, files |
| `mail` Email | **FUNCTIONAL** | device | 6/7 | 1 | drafts, never sends |
| `people` People and letters | **FUNCTIONAL** | device | 2/2 | 1 | |
| `clocks` Timers and alarms | **FUNCTIONAL** | device | 3/4 | 0 | §101 |
| `costs` Money | **FUNCTIONAL** | device | 3/3 | 0 | |
| `links` Links | **FUNCTIONAL** | device | 2/3 | 1 | |
| `profile` Profile | **PARTIALLY FUNCTIONAL** | **server** | 4/4 | 0 | device-local; does not read `public.profiles` |

### Beyond

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `career` Career | **FUNCTIONAL** | device | 5/6 | 1 | 1,208 lines |
| `pathway` Pathway | **FUNCTIONAL** | device | 3/5 | 2 | 1,082 lines |
| `applying` Applications | **FUNCTIONAL** | device | 1/1 | 2 | |
| `athletics` Athletics | **FUNCTIONAL** | device | 4/6 | 0 | |
| `family` Family | **PARTIALLY FUNCTIONAL** | device | 2/4 | 0 | `family_grants` exists in schema |
| `nil` NIL deals | **FUNCTIONAL** | device | 4/5 | 0 | |

### Data

| destination | state | backing | logic | screen | note |
| --- | --- | --- | --- | --- | --- |
| `connect` Connect accounts | **CONNECTED** | **server** | 10/12 | 0 | §290; 987 lines |
| `account` Account | **CONNECTED** | **server** | 2/2 | 0 | §47.1 |
| `privacy` Privacy and your rights | **CONNECTED** | **server** | 7/7 | 0 | §297 |
| `data` Your data | **CONNECTED** | device | 6/7 | 0 | §297 |
| `export` Take it with you | **CONNECTED** | device | 4/5 | 0 | §267 |
| `notifs` Alerts | **FUNCTIONAL** | device | 2/3 | 0 | §47.13, academic types only |
| `settings` Settings | **FUNCTIONAL** | device | 0/0 | 1 | container |
| `help` How this works | **FUNCTIONAL** | device | 2/3 | 0 | |

**Nothing reads DOES NOT EXIST.** Every destination in the registry resolves to
a component that renders. One reads UI ONLY — `call`, which is 76 lines that
hand off to an external call service and hold no state.

---

## Part 2 — the Part C systems (§227–300)

Measured the same way. Only the rows where measurement changed the first
reading recorded in
[`SEMESTER_IMPLEMENTATION_PLAN.md`](SEMESTER_IMPLEMENTATION_PLAN.md) are called
out; the rest confirm it.

| § | system | state | evidence |
| --- | --- | --- | --- |
| 263 | Draft recovery | **FUNCTIONAL** | `lib/draft.ts` — written for exactly this, and names the five screens that held text in `useState` |
| 266 | Import center | **CONNECTED** | `lib/extract.ts` (PDF/DOCX/PPTX/text/zip), `lib/intake.ts`, `lib/import-review.ts` previews before committing |
| 267 | Export center | **CONNECTED** | `screens/Export.tsx`, `lib/export.ts`, `lib/docx.ts`, `lib/pdfout.ts` |
| 268 | **Print experience** | **FUNCTIONAL** | **corrected upward** — `components/PrintButton.tsx` and a deliberate `@media print` block in `styles/app.css:1407`: *"A document prints as the page, never as the editor."* That is §268's requirement verbatim, and the first reading had not looked |
| 270 | PDF → study material | **PRODUCTION READY** | the syllabus importer, and it keeps the source reference §270 requires |
| 262 | Autosave | **FUNCTIONAL** | `lib/draft.ts` plus debounce in `components/Page.tsx` |
| 264 | Trash / recovery | **PARTIALLY FUNCTIONAL** | **corrected** — `lib/undo.ts` is an undo, not a trash, and argues the case: *"a confirmation dialogue is the wrong answer twice over."* §264 wants a restore window; the app has a take-it-back. Adjacent, not equal |
| 236 | Command center | **PARTIALLY FUNCTIONAL** | `components/Command.tsx`, `lib/launcher.ts`; §236's list is wider than what they reach |
| 258 | Offline-first | **PRODUCTION READY** | by construction |
| 251–256 | Global search 2.0 | **PARTIALLY FUNCTIONAL** | `screens/Search.tsx` makes **no network call**; searches the registry, the guidebook and the student's own data |
| 257 | Search authorization | **see below** | the most important row in this file |
| 261 | Conflict resolution | **DOES NOT EXIST**, argued | `lib/cloud.ts`: last edit of the same record wins, and anything cleverer "is a distributed-systems project" |
| 247 | Time zone system | **DOES NOT EXIST** | no timezone module in `lib/` |
| 249–250 | i18n / locale | **DOES NOT EXIST** | no translation infrastructure |
| 229–235, 239–240 | save / collections / share / comments / mentions / activity / inbox / requests | **DOES NOT EXIST** | `lib/bookmarks.ts` saves *places*, not entities; the rest need §47.8's social graph first |

---

## Part 3 — the flags

§226 asks which features carry which defects. Applied honestly, most of the
list does not fire. The ones that do:

### MISSING TESTS — 17 of 58 screens, after the count was corrected twice

The draft of this file said **38**, and named `classmates` and `groupwork` as
the worst two. Both were wrong, for one reason: the probe counted only tests
that *import* a module, and **this repository deliberately favours structural
tests that read a file as text.**

`lib/roomkeys.test.ts` opens `src/screens/Groupwork.tsx` and
`src/screens/Classmates.tsx` by path and asserts against their source.
`lib/signedout.test.ts` does the same for `Groupwork.tsx`.
`components/room/rooms.test.tsx` renders the children `Classmates.tsx` mounts.
None of those appeared in the first count, and CLAUDE.md is explicit about why
they exist at all: *"A structural check catches what a runtime probe
misses."*

Counting both genres, **17 of 58 resolved destinations are neither imported by
a test nor named by one**:

`activities`, `analyse`, `announce`, `athletics`, `behind`, `brief`, `clocks`,
`costs`, `exam`, `export`, `family`, `help`, `meals`, `meet`, `nil`, `sources`,
`yes`

Every one of them still has tested logic underneath — the gap is at the
component seam, not in the reasoning, and the suite is 11,921 tests across 604
files. By size, the ones where that seam covers the most code:

| screen | lines | logic coverage |
| --- | --- | --- |
| `exam` Practice paper | 787 | 6/8 |
| `family` Family | 639 | 2/4 |
| `activities` Activities | 573 | 6/6 |
| `athletics` Athletics | 527 | 4/6 |
| `nil` NIL deals | 414 | 4/5 |

`family` is the one to look at first: it is the largest of them with the
weakest logic coverage underneath, and `family_grants` is a real table with
real row-level policies behind it.

Separately, `ask` has the lowest logic coverage of any screen over 300 lines —
5 `lib/` imports, 2 tested.

### MISSING AUTHORIZATION — one row, and it is not yet a defect

**§257.** Search applies no authorization, and today that is correct: it makes
no network call, so there is no shared index and nothing to leak. The flag is
raised here not because search is broken but because **§251 is what breaks
it** — the moment People, Organizations, Jobs or Housing enter the index, the
absence becomes the defect §257 calls critical.

Recorded as a flag on §251 rather than on search.

### MISSING BACKEND — 52 of 59, and the wrong flag for all of them

See *The shape of the answer*. Kept in the matrix because §226 asks for it,
marked as inapplicable because applying it would turn the product's premise
into 52 bug reports.

### DISCONNECTED — none found, and the one I thought I had was mine

The draft of this file carried a finding here: *"`equations` carries no
`group`, so it is absent from the grouped directory."* **It was false.**
`lib/nav.ts` gives it `group: 'Make'`. The probe read the field from a
900-character window after `screen:`, and that entry's `keywords` string — the
longest in the registry by a wide margin — pushed `group:` past the end of it.

It is recorded rather than deleted because of what it nearly was: a fabricated
defect **with a one-line fix proposed for it**, which would have been committed,
reviewed and merged as a real repair to a thing that was never broken. That is
the exact failure [CLAUDE.md](CLAUDE.md) describes — *"Measuring six suspects
and finding six problems is also what a broken probe looks like"* — and it is
the fourth probe fault in this one document.

The lesson for whoever extends this matrix: **the window-based field reader is
not safe on `lib/nav.ts`.** Parse the entry, or read the field by hand.

### BROKEN — one, and half of it is fixed in this commit

**`public.reports`** had no status column and **no select policy at all**: a
report could not be read by anybody, in principle. Half of that is now closed —
`20260921214500_report_status.sql` adds the four statuses and a read for
`private.is_app_admin()`, with `supabase/reports.check.sql` holding it at 14
checks.

**The other half is a person.** A table an administrator *may* read is not a
queue somebody *is* watching, and `lib/classmates.ts` still says *"Reports are
stored, not moderated. Nobody is watching a queue."* That sentence is still
true and the migration deliberately does not touch it. It changes when there
is an administrator dashboard and somebody reading it — §58's *"Review reports
through admin interface"*, which no screen in this app provides yet.

### Flags that did not fire

DUPLICATED, CONFUSING, UNNECESSARY, MISSING MOBILE, MISSING ERROR HANDLING —
no instance found that survives checking. MISSING ACCESSIBILITY — the lint gate
includes a label audit that passes, and 413 screen×width combinations are swept
for horizontal scroll; no instance found by this measurement, which is not the
same as none existing. MISSING ANALYTICS — applies to everything and is §54's
open product decision, not a per-feature defect.

---

## Part 4 — §227, the feature connection audit

§227 asks whether features actually chain together, and names three chains. It
was measured by asking which state fields more than one screen touches, across
all 745 source files with comments stripped.

**191 state fields — 124 persisted, 67 session.** The controls that had to pass
for the numbers to mean anything: `courses` must parse as a field and read as
shared; `query` must be absent (the thirty-third pass cut it); more than 80
fields must parse; and something must be read at the top level, which is what
caught the walk missing `src/App.tsx`.

### The finding is about how the connections are made

**A naive `state.X` matcher systematically undercounts connection in this
codebase**, and three separate mechanisms are why:

| mechanism | example | what a direct-read audit sees |
| --- | --- | --- |
| **derived structures** | `buildCatalog` in `data/catalog.ts` indexes every course's `items` | `items` looks like a field no screen reads — it is not a state-root field at all |
| **accessor functions** | `currentLook(state).favourites` | `favourites`, `shortcuts` and `boardOrder` look unread |
| **key-name registries** | `lib/merge.ts`, `lib/privacy.ts`, `lib/export.ts` each list field names as strings | `liveSession` looks unread |

All four of those fields are read. **Seven fields read as "touched by nothing"
and every one was the probe.** That matters beyond this document: any §227 silo
hunt that greps for direct reads will report false silos, and the fix it
proposes will be to connect things that are already connected.

`state/keyread.test.ts` and `state/sessionread.test.ts` already guard the real
version of this question, and their passing is what exposed the probe here.

### Chain 1 — COURSE → Assignment → Calendar → Study Plan → … → Exam

§227's first chain is the one this app is built around, and it connects:

| link | carried by | screens touching it |
| --- | --- | --- |
| COURSE | `courses` | **10** |
| Assignment | `CourseModule.items`, via `buildCatalog` | indirect — see above |
| ticked / in progress | `done`, `started` | **11**, 3 |
| Calendar | `feedEvents` | 2 |
| Study Plan | `sessions` | 1 |
| Mastery | `reviews` | **9** |
| Exam | `sittings` | 1 |
| Tasks | `tasks` | **9** |
| New material | `updates` | 6 |
| Notes | `notes` | 4 |

The chain holds. `done` at eleven screens and `courses` at ten are the spine —
ticking a deadline off in one place changes what every other screen says,
which is the property §227 is asking for.

### Chains 2 and 3 do not exist, and not because they are disconnected

§227's other two chains are `ORGANIZATION → Event → …` and
`CAREER → Job → Company → Event → …`. **Organizations, events, jobs and
companies have no table and no state field**, so there is nothing to connect.
Those chains are blocked on §47.10 and §47.11 — the product decision, not a
wiring job — and auditing them for silos would be measuring the absence of a
thing rather than its isolation.

`career` and `applying` exist as screens and share `documents` (2 screens) and
`applications`; that is the fragment of chain 3 that is real today.

---

## Part 5 — §228, the universal entity graph

§228 asks for a standardised relationship architecture over twelve entities,
and warns: *"Do not overengineer this into a graph database unless justified."*
Measured before deciding whether anything is justified.

### Ten of the twelve already exist

Table names taken from `create table public.…` across every migration; state
fields from the two interfaces in `state/shape.ts`; types from exact
`export interface`/`export type` declarations across the tree. Substring
matching was abandoned after it reported `public.profiles` as the `File`
entity.

| §228 entity | server table | state field | type |
| --- | --- | --- | --- |
| User | `profiles`, `app_admins` | `myName`, `aboutMe` | `Person`, `FamilyMember` |
| Course | `courses`, `enrollments` | `courses` | `Course`, `CourseModule` |
| Assignment | — | inside `CourseModule` | `Item`, `DatedItem` |
| Event | — | `feedEvents`, `commitments` | `FeedEvent`, `Commitment` |
| Document | — | `documents` | `Doc` |
| File | — | IndexedDB, by id | `ShotFile` |
| Meeting | — | `appointments` | `Appointment` |
| Job | — | `applications` | `Application` |
| Housing | — | `residences` | `Residence` |
| Campus Resource | — | `places` | `SavedPlace` |
| **Organization** | — | — | — |
| **Marketplace** | — | — | — |

**Two of twelve do not exist at all**, and one of those two is the §47.10
decision rather than a modelling gap. Marketplace has never been specified for
this app beyond §228's list.

### The relationship architecture is already here, and it is a foreign key

§228 names seven relationship kinds. The one that carries almost all of the
weight is `BELONGS_TO`, and it is already implemented the ordinary way: **seven
types carry a `CourseId`** — `Item`, `Note`, `PersonalTask`, `CourseUpdate`,
`FeedEvent`, `Block`, and the session state itself.

That is what makes §227's first chain hold. It is not a graph and does not need
to be.

The other kinds map onto things that exist rather than things to build:

| §228 kind | what carries it today |
| --- | --- |
| `BELONGS_TO` | `CourseId` on seven types |
| `PART_OF` | `CourseModule.items`, indexed by `buildCatalog` |
| `CREATED_BY` | implicit — a device holds one student's data |
| `SHARED_WITH` | `FamilyItem.memberId`, and `group_members` server-side |
| `ATTENDED_BY` | `attendance`, `sittings` |
| `LINKED_TO` | `lib/links.ts`, `bookmarks` |
| `RELATED_TO` | `lib/meet.ts` — the same term in two courses |

### So the answer to §228 is: do not build it

§228's own warning applies to §228. A universal entity graph over these twelve
would be a **device-local** graph for ten of them, because only User and Course
have a server table — and the value §228 imagines (relating one student's
record to another's) is not reachable from a device-local graph at all. It
would be a large abstraction over an existing foreign key, buying nothing until
the entities are on a server.

What would be worth doing, when §47.10 and §47.11 are decided, is far smaller:
give Organization and Event the same `BELONGS_TO` treatment the other ten
already have.

---

## Part 6 — §247, and why "not built" was the wrong first reading

The plan's first reading of Part C listed §247 (time zone system) as
**probably absent**, on the grounds that `lib/` has no timezone module. Measured,
that was wrong in the way that matters.

### There is no hardcoded Central Time, and CI proves it twice a commit

§247's one imperative is *"Never hardcode Central Time."* Grepping for it finds
three hits and all three are innocent: two are the string `W3CDTF` inside
`lib/docx.ts`, and the third is a comment in `screens/Calendar.tsx` recording
the timezone a **fixed** daylight-saving bug was measured in — the code around
it uses `setDate`, which knows a day can be 23 or 25 hours long.

What actually enforces §247 is a CI step:

```
"test:zones": "TZ=America/Chicago vitest run && TZ=Pacific/Kiritimati vitest run"
```

**The entire suite runs twice, under two zones nineteen hours apart**, on every
commit — `ci.yml` step 12. A hardcoded zone, or a date computed as
`getTime() + 86_400_000`, fails somewhere in 12,054 tests under one of them.
That is a stronger guarantee than §247 asks for, and it is the reason no
timezone module exists: the correctness is held by the test matrix rather than
by an abstraction.

### The one real absence, and why it should stay absent for now

§247 also asks for a **tenant timezone**. `public.schools` has `id`, `name`,
`short_name`, `email_domains` and `created_at` — no timezone column.

That is a genuine gap and it should not be filled yet. Nothing would read it:
every date the app shows is either a calendar day compared as a string in the
reader's own zone (`familyPlanActive`, deliberately — see its docblock) or a
time quoted in the syllabus's own words (`Item.dueTime`). A column added now
would be a field with no reader, which is exactly what the thirty-third pass
cut out of this app and what `state/keyread.test.ts` exists to prevent.

It becomes worth adding when a school's own calendar — term dates, an
institutional deadline — is served from the server rather than typed on the
device. That is §47.14's work.

---

## What to fix, in order

§226: *"Do not merely document gaps. Fix them according to priority."*

1. ~~**`public.reports`**~~ — **the database half is done in this commit.**
   Four statuses, an admin read and a status-only update, and a check suite
   that fails in both directions. What remains is the admin screen, and the
   sentence in `lib/classmates.ts` that must not change until a person is
   actually reading the queue.
2. ~~**A test at the component seam for `family`**~~ — **done in this commit,
   and it turned out to be the wrong seam.** Looking properly found that
   `lib/family.ts` itself had no test: 271 lines, the module behind the one
   screen in this app whose entire argument is restraint. `lib/family.test.ts`
   now guards `familyPreview`, including the line that would break quietly —
   `FamilyAccess` is `'none' | 'selected' | 'view' | 'payment'` and the four
   are **not an ordinal scale**, so the filter is an explicit
   `['selected', 'view']`. Read as a scale, adding `payment` is a one-word
   tidy that makes a payer a reader of the health administration and the
   calendar. Proven both ways: adding `payment` to the filter fails two cases,
   and making the preview return `[]` unconditionally fails four.
3. **§257 as a constraint on §251** — not a task yet. A note in the plan that
   authorization ships *in* the change that gives search its first server-side
   record, never after it.

Everything below that waited on the matrix being read, and on four product
decisions — §47.1, §54, §47.10, §261 — that looked like the author's rather
than a program's. Three of them were not: read against §258 and against
§47.10's own administrative list, the specification answers itself. All four
are settled in
[`SEMESTER_IMPLEMENTATION_PLAN.md`](SEMESTER_IMPLEMENTATION_PLAN.md), under
*The four product calls, decided*. §261 is the one this document raised, and
its answer is that `lib/cloud.ts` already does the merge — what §261 forbids
is doing it **silently**, which is a disclosure on §260's sync status, not a
three-pane merge UI.
