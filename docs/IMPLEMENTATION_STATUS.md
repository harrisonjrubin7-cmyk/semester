# Semester implementation status

September 14, 2026 · Compared with the supplied complete product requirements and the follow-up list of student, professor, advisor and administrator work.

The existing app is preserved and expanded. **This build is a working student workspace with local planning tools and an institutional integration foundation. It is not yet a complete replacement for a university's LMS, email, registration, billing or campus-service systems.** The user confirmed that school-approved access is not yet available.

## September 15, 2026 — the mistake journal only ever wrote

`components/StudyJournal.tsx` has recorded mistakes since it shipped: the
topic, what kind of thing went wrong, what was tried, what was learned, and a
date to come back to it. Every entry went in and nothing ever came out. The
panel listed them newest first, which is a filing cabinet rather than a
journal — the reason to write a mistake down is that the next one rhymes with
it, and noticing that across fourteen entries written over two months is
exactly the job a student at 1am cannot do.

The blueprint asks for it in one line — "detect repeated misconception
patterns in a private mistake journal" — and the detecting was the missing
half.

`app/src/lib/again.ts` reads three things back, each arithmetic over what was
typed and each with a floor it will not speak below:

- **A mistake that came back** — a topic written down again after an earlier
  entry on it was marked reviewed. The strongest thing the journal can show,
  and it is shown first.
- **A kind that dominates** — "4 of your 6 entries here are units or sign."
- **Revisit dates that have gone by** with nothing done.

**The trap in the middle of this is the default value**, and most of the module
is written around it. "What needs attention" is a picker of eight kinds that
opens on *Concept*. A student who never touches it logs eleven Concept entries,
and an app reading that distribution would tell them they keep making
conceptual errors — a finding about a dropdown, not about their learning, and
indistinguishable from the real thing in the stored data. So no kind is
reported unless the journal shows kinds being *chosen*: at least two distinct
ones. One kind everywhere is the default, whatever that kind happens to be.

Below the floors it says what it is reading rather than going quiet — "3
entries so far, too few to call anything a pattern" — because a panel that is
silent at four entries and speaks at five looks broken at four, and naming the
count is the only way to tell "no pattern" from "not looking".

Verified with the full gate set and driven in Chromium at phone width against a
seeded term: the summary reads "· 3 worth a look" while the panel is shut, and
open it names the repeat, the dominant kind and the two missed dates in that
order. Fifteen mutations were reverted under the new tests and watched go red;
one survived and was a weak test rather than weak code — every small case was
being caught by the occurrence count, so nothing exercised the entry floor at
the four-entry boundary where it is the only thing deciding. A test was added
there. One test was also simply wrong and the code was right: it asserted that
five of nine was not a majority.

## September 15, 2026 — the scheduler had never been told the exam exists

`lib/review.ts` schedules cards on a plain SM-2 variant, and SM-2 does not
know what a semester is. Measured on the app's own numbers, a card answered
right every time it comes up goes away for one day, then six, then **sixteen**,
then **forty-five**. So a card answered right four times is gone for six weeks,
and a midterm three weeks out never sees it again.

The blueprint names the inputs spaced repetition should use — "accuracy,
confidence, response time, item difficulty, and **exam proximity**". The first
four were there. Nothing in the scheduler had ever been told when the exam is,
although `testedIn` in `lib/select.ts` has answered exactly that since the study
plan needed it; it was only ever read to write a sentence.

`app/src/lib/intime.ts` is the missing input. It promises one thing and says so
plainly: **every card gets at least one look in the three weeks before a test.**
Not a second, and not a revision plan — the card's own schedule is the revision
plan, and this is the floor under it.

**Adjusted where it is read, never where it is written.** Nothing here touches a
stored record: `inTime` returns a copy of the reviews with stranded cards
brought forward, and three things follow that are worth more than the
simplicity. It expires by itself the day after the test. It reaches cards
*already* scheduled past the exam, which is most of them for anybody who has
been studying, where a rule applying on the next answer would never fire. And
every existing reader — `dueFirst`, `dueCount`, `comeRound`, `catching` — gets it
for nothing, so the Drill, Gap, Study and You screens and the assistant's
context each opt in on one line. The card's course comes out of its key, which
`cardKey` already writes as `${courseId}:${hash}`.

The last looks are **dealt across the days that are left, least-certain first**,
ranked by the interval the scheduler itself assigned. Two earlier rules were
measured and thrown away: putting every stranded card on the eve of the test
(52 cards on one evening and nothing on the other thirteen), and spreading them
by `strength` (45 of those 52 still on the eve, because `strength` saturates at
a streak of three and every revised card is already there).

Verified with the full gate set — types, lint, 9,022 tests in file order and
shuffled, two timezones, production build, institution type-check — and driven
in Chromium at phone width. Twenty mutations were reverted under the new tests
and watched go red.

**Three probes in this change were wrong before they were right**, and each one
had reported a clean result first:

- The first census answered every card correctly on every day, sent all 325
  down one trajectory, and reported that **every card in every deck** would miss
  its test. A finding and a broken probe look identical at 100%.
- The census is a *snapshot*, and the feature is a *rollout*. Walking the
  twenty evenings before the shipped ECON midterm one at a time — which no
  other test did — found two faults that made the feature useless while
  everything passed: room counted in elapsed milliseconds rather than calendar
  days, so nothing ever became due and the whole deck fell on the eve; and a
  guarantee with no end, re-forcing cards it had already delivered, 209 answers
  dealt for a 67-card deck. `intime.rollout.test.ts` is that walk, kept.
- The census then disagreed with the dealer by exactly one card. It was neither:
  five questions are written out twice across the four shipped decks, so a deck
  that says "68 cards" has 67 distinct ones. That is a real defect in the
  shipped data — a drill can deal the same question twice in one sitting — and
  it is filed rather than fixed here.

After the fix the rollout is 3–5 cards an evening for twenty evenings, the whole
deck covered, each card asked for once, and nothing left for the morning of the
exam.

Two contradictions were found by looking at the screen with every test passing.
"nothing due · 68 back for the exam" on one line, where both halves were right —
the 68 are dealt across the fortnight, so none is due today. And then, after
that was reworded, "4 due" sitting three lines under a standing that reads
"nothing come round", which is the same word for two different things. The row
now says "4 of 68 up for the exam" where the test is the whole reason, and the
button under it says "4 cards are back ahead of the exam" rather than claiming
they came round.

One guard cannot be checked by the default suite and says so in its own
comment: `daysBack` round-trips through a `Date` because a day is not always
86,400,000 milliseconds, and vitest runs in UTC where both spellings agree. The
test for it uses dates straddling the 1 November clock change, so it is a guard
only under `npm run test:zones` — which runs Chicago, where the mutation is
caught.

## September 15, 2026 — the page number became a page

Every imported deadline carries the sentence it came from, `app/src/lib/cite.ts`
checks that sentence against the spans the API says it read, and the screen
printed the page underneath: `· p. 12`, under a comment claiming this was what
turned *"the app says the syllabus says this"* into something a student could
check in ten seconds.

It was a string. `Item` had no link to any document, and the import path did
not keep one — `intakeFiles` read the text out of the PDF and let the bytes go.
The app was printing a footnote to a library nobody could visit.

Three seams, and no new persisted field:

- **The syllabus is kept.** `keepSources` files each PDF the import carried
  whole into the drive against the course it built, deduplicated on name and
  size so a re-import does not leave two. Not awaited by the import and never
  fatal to it: a browser that refuses storage costs the link and nothing else.
- **The citation says which document.** `document_title` already came back on
  every citation and was being dropped; it now reaches `Item.checked.doc`. Two
  PDFs go up together often enough — a syllabus and a separately posted
  schedule — that a page number alone names a page in each.
- **The page is a press.** `app/src/lib/topage.ts` matches the named document
  against the drive, and `openFile(id, page)` appends `#page=N`.

**It refuses rather than guesses.** The drive holds readings and past papers
filed against the same course, so "use the only PDF here" would open a
student's week-three reading at page 12 under the words *straight from the
syllabus* — a stronger false claim than this app has ever made. Where the
document cannot be named, the page prints exactly as it did before. That is
most courses for now: everything imported before this, everything built from
pasted text, every deadline the API did not cite, and any syllabus somebody
has binned.

**What the press promises is "open it, at that page", not "land on it".**
`#page=` is a PDF open parameter that Chrome's viewer and Firefox's pdf.js
honour and some others ignore, with no way to ask beforehand and no answer
afterwards. A viewer that ignores it opens at page one, which is what pressing
the file in the drive already did. The label and the module header both say so
rather than claiming the page.

Verified with the full gate set — types, lint, 8,979 tests in file order and
shuffled, two timezones, production build, institution type-check — and driven
in Chromium at phone width against the real IndexedDB: the syllabus stored and
deduplicated, the bytes round-tripped, the named document resolved, an unkept
one refused, and `window.open` handed a blob URL ending `#page=3`. Seventeen
mutations were reverted under the new tests and watched go red, with a control
edit that left them green.

Two things were found by looking at the screen with every test passing. The
button drew as the app's default grey box in the middle of a caption — the
other text buttons borrow `.bare`, which ends in `width: 100%` and would have
taken the whole line — and the target was twelve-point text on a phone until
`tap-y` grew it to 44px without moving the caption. A contrast sweep across
eight grounds put the pressable part at 5.5:1 at worst and 10.8–13.8:1 with
"Increase contrast" on; its own first probe read `color` and ignored `opacity`,
reported the button and the filename identical everywhere, and had to be fixed
before any of that was worth reading.

## September 15, 2026 — study evidence, the plan, the hint ladder, and two kept promises

Five changes, none of which needs a university, an account service or an AI
key. That boundary is the whole point of the batch. Three are capabilities the
product blueprint names and this build did not have; two are promises the app
already made on screen and did not keep.

**Mastery is no longer a percentage.** `unitMastery` blends what has been
answered with the figure a person wrote into each guide, and the written figure
stands in for every card not yet answered. It is a reasonable ranking and it is
not a measurement, so it is no longer printed as one. `app/src/lib/knowing.ts`
reads five named states off the answers alone — **Unseen, Introduced,
Practising, Retained, Needs review** — each shown with the counts it was read
from, and each resettable by the student (`forgetCards`). Nine sites changed,
including the course context handed to the assistant, which had been sending
`mastered: "68%"` per unit for a model to repeat back as a fact about the
student. Two earlier fixes had guarded only the case where *nothing* had been
answered; one answer in a deck of a hundred leaves the blend ninety-nine
hundredths estimate. The blend still ranks. It is no longer quoted.

**The study plan can now be missed.** Every view of what to study was computed
on render, so the app had no yesterday: an evening nobody studied left no trace.
`app/src/lib/sessions.ts` commits a plan to days, detects what was missed, and
moves it forward in one press — with a ceiling. What will not fit inside the
horizon is dropped rather than stacked, and the button says so before it is
pressed. Conserving a backlog is what turns four missed evenings into a
four-hour Thursday and a plan into something somebody deletes.

**A quiz question you are stuck on has a third option.** `app/src/lib/ladder.ts`
builds hints in rungs out of the guide's own key terms and the question's own
options — nothing generated, nothing fetched, works offline. A rung that cannot
be built honestly is not offered, and the score reports what it cost
(`7 of 10, 3 with help`) without deducting for asking. Censused across the four
shipped decks: every question offers two or three rungs.

**A calendar that had stopped looked exactly like one that had not.**
`FeedSource.synced` was read by one thing — the "since you last looked" panel,
for what *arrived*. Nothing used it for what hasn't, so the Connect screen drew
the last pull's status text and never its age, and a subscription that
succeeded three weeks ago read identically to one that succeeded a minute ago.
`app/src/lib/where.ts` is the data-state vocabulary the blueprint asks for —
Official, Connected, Made here, Yours, Sample, Out of date — as one axis of how
far a row should be trusted. It marks a quiet subscription on Connect and, more
importantly, on the calendar entries that came out of it: Connect already told
students those were "marked with where they came from", which named the feed
without saying whether it was current. **Official ships unused on purpose** —
no adapter exists to earn it — and a test asserts the registry is still empty,
so the day one lands somebody has to decide what the word means.

**Search had promised regression since it learned about the maths screen.**
`nav.ts` lists it beside intersection, tangent and area under the curve; those
three are real and wired, and regression was not. A `point` line already takes
lists, so a scatter was always possible; `app/src/lib/fit.ts` is the
least-squares line through it, with the coefficient, the intercept, R² and the
count, drawn across the window in the dim colour because it is derived rather
than entered.

Verified with the full gate set — types, lint, 8,924 tests in file order and in
shuffled order, two timezones, production build, institution type-check — and
driven in a real browser at phone width with zero page errors. Thirty-odd
mutations were reverted under the new tests and watched go red; three of them
found weak tests rather than weak code, and one found a clause that could never
have been the deciding one, which was deleted rather than commented.

Six defects were found by looking at the screen with every test passing: a
count printed twice three lines apart; a percentage in a module the source grep
never reached; a hint that quoted text visible verbatim as an option; a plan
that put eight consecutive sittings of one course on a single evening, from a
comment claiming an interleaving the code did not do; two React children
sharing a key; and a fitted line that read "y = 1x + 1.2", which nobody
writes.

### What still gates full operation, and what does not

| Gate | What it blocks | Whose it is |
| --- | --- | --- |
| University approval | Live rosters, registration, grades, billing, official records | The institution's. `app/server/institution/` still has an empty production adapter registry |
| Nothing — since the school data pack landed | An institution's calendar, buildings, meal plans, grading scale and service addresses | **No longer a gate.** These are data rather than a connection, and a university sends them as one file a student loads on their own device. Adding a university is no longer a code change. See [SCHOOL_DATA_PACK.md](SCHOOL_DATA_PACK.md) |
| A Supabase project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`) | Accounts, multi-device sync, shared rooms, classmates | Configuration, not code. See `supabase/DEPLOY.md`. Signed out, the app is fully usable on one device |
| An AI route | Generated study drafts, the tutor, `Solve` | Configuration. Everything in this batch works without it |

## Changes included in this update

- Google-style search home, persistent top search, independent app tabs, new tabs, bookmarks and named/color-coded tab groups. Top search finds apps and saved courses, assignments, notes and documents. The central search is suppressed while the top search or app launcher is active.
- Familiar document, spreadsheet, presentation and file-library layouts. Existing editing, history and export functions remain; spreadsheet selection supports cell ranges. Chat/call layouts and the graphing workspace were expanded.
- Course hub organized around overview, assignments, study, readings and syllabus. A unified assignment center adds status filters, course/search filtering, a workload view, checklist planning and linked writing drafts.
- Eleven-format study guide creation with explicit source selection, personal notes excluded by default, course-policy checks, adjustable generation settings, matched source quotations, editable sections, section regeneration, browser read-aloud and saving into Write.
- Registration catalog imports, class filters/details, cart, schedule conflicts, saved alternatives and export. Housing, dining and clubs gain searchable institution-supplied directories, saved comparisons and planning tools. Maps has a larger searchable map/directions workspace.
- **University** is a new app with 37 service areas, six preparation roles, persistent editable drafts/checklists, import/export, a connected-records client and connection readiness. It reuses the existing course, study, registration, degree, billing, meal, housing and map tools.
- Server-side institution gateway with verified identity, school/record permission boundaries, per-service capabilities, preview/confirm, encrypted durable action journal, receipts and reconciliation. The production adapter registry remains empty until approved systems are implemented.

## Latest additions: productivity, study, family and education stages

- **Create:** a shared launchpad for original Write, Sheet, Deck, Math and Notes, plus new persistent Forms, Design and Video projects. Forms support nine question types, required and conditional questions, exact-answer practice grading, response windows/limits, response summaries, CSV export and linked Semester response sheets. A failed local save preserves entered answers.
- **Design:** editable text/shapes/images across five layer kinds (text, rectangle, ellipse, triangle, image), mouse and keyboard positioning, per-layer opacity, alignment against the page on both axes, layer duplication and ordering, named page-size presets alongside manual sizing, colors, undo/redo, eight starting templates, SVG/PNG/JPG export and image exports saved in Files. Pictures can have a flat background lifted (colour keying on the device, not subject segmentation — see `lib/cutout.ts`), and any layer can be freely rotated. Layer fills can fade to a second colour, and notes can be pinned to a spot on the design — threaded, settleable, shared live with anybody on the canvas, and never exported onto the artwork. Charts are a layer kind — column, bar, line or pie, drawn from a table pasted straight out of a spreadsheet, reusing the app's own chart engine and exported into the SVG/PNG like any other layer. This is still a basic graphic editor and not Canva feature parity: no ML background removal.
- **Video:** original-clip storage in Files, trimming, splitting, ordering, speed/volume, whole-clip captions, preview and browser-based 720p WebM rendering. It is a basic editor; automatic transcription, multi-track mixing, advanced effects, MP4 rendering and real-time collaboration are not implemented. Export needs a supporting browser and must be reviewed.
- **Study:** explicit top-level navigation, reusable original course files in the source picker, links back to original sources, teach-back self-comparison and a private mistake journal with review tasks and Write export. These additions do not constitute a complete adaptive learning engine or validated readiness model.
- **Athletics:** personal practices, training, competitions and travel; academic conflict review; calendar copies; professor-request drafts and travel-study checklists. Official rosters, eligibility, coaching, sports medicine and performance systems remain pending.
- **Career:** manually entered/imported opportunities, filters, saved listings, existing application tracker integration, experience-based resume/cover-letter drafts, opt-in networking records and follow-up tasks, study-abroad checklist. There is no live employer/alumni directory or verified opportunity feed yet.
- **Family:** separate local permission plans per person, no access by default, explicit item selection, expiration/removal, a restricted dashboard preview, support/checklist/budget items, local history and backup. This does not send invitations or activate parent accounts. The server policy building block enforces recipient/tenant/student/resource matching, accepted consent, expiration, revocation and payment-only separation; it still needs a server grant store and integration into every family endpoint. No parent has access to real student data in this build.
- **Pathway:** prospective-to-alumni stage preference, school/program search over imported or entered records, application-material preparation, self-reported statuses, comparable cost estimates, reusable draft profile and essay handoff. Eleven customizable milestone templates cover applications, arrival, transfer, international arrival, dissertation, publication, clinical preparation, graduation, faculty launch, pilot rollout and appeals. Owners, deadlines, notes and local preparation history are editable. These are not official decisions, signatures, approvals or transcripts.
- **Continuity:** Family and Pathway use account-scoped local stores independent of term. Their stage selection leaves all original coursework intact. New creative projects and portal selections reopen separately per app tab. A complete permanent identity lifecycle, alumni provisioning and school retention policy are still future work.

The registry now contains **58 destinations**. The institution transport recognizes **37 service areas**. Each added service has a preparation entry point; the count is not a claim of 37 implemented live integrations.

## Requested work: what can be done now

| User workflow | Working in this build | What remains for official operation |
| --- | --- | --- |
| View and manage courses | Course imports/editing, overview, assignments, study, readings, syllabus and grade tools | School roster/course synchronization; faculty publication and enrollment-controlled access |
| Upload/process syllabi | Existing extraction/review/correction workflow retained | Measured extraction accuracy, broader document benchmark and institution-approved processing deployment |
| Create all 11 study formats | Configurable AI-assisted editable study drafts; citation matching, source choice and regeneration; existing interactive practice tools retained | Configured AI service; real-provider quality evaluation. Generated card/quiz drafts do not automatically become native graded assessments |
| Complete and submit assignments | Assignment checklist, draft authoring, attached materials and progress tracking; submission preparation draft; gateway review/receipt interface | Approved LMS adapter, upload/scan pipeline, attempt rules and official submission receipts |
| Take quizzes and exams | Existing practice quiz/exam tools; new study formats and assessment preparation | Full official attempt lifecycle, server timing, accommodations, proctoring where required and grade return |
| View grades and feedback | Existing entered/returned grades, feedback and calculations | Official gradebook/roster adapter and publication controls |
| Send/receive university email | Draft composer and existing connected-account tooling retained; gateway record/action surface | Mail provider adapter, inbox/thread/attachment synchronization, delegated send scopes and recovery |
| Manage calendars/deadlines | Calendar, personal tasks, course dates, ICS and configured account integrations; linked assignment steps | Per-school calendar synchronization/conflict policy and operational reminder delivery verification |
| Register for courses | JSON/CSV catalog, class search, cart, credit/time conflicts and saved potential schedules | Live seats, holds, eligibility, add/drop/waitlist transactions and authoritative SIS receipts |
| Plan degrees | Existing transcript/requirement tracker, improved overview and requirement search | Official degree rules, substitutions, transfer evaluation and advisor approvals |
| Schedule advising | Advising preparation notes/checklist and existing calendar tools; gateway booking-capable action contract | Advisor availability, scheduling adapter, consented advisee access and confirmed bookings |
| View/pay bills | Existing bill/aid estimates, entered transactions, installment planning and official portal links | Authoritative ledger and hosted payment/tokenization adapter; no payment processing added |
| Manage financial aid | Award/requirement planning, existing financial tools and preparation checklist | Official awards, eligibility, acceptance/signature flows and document requirements |
| Dining/housing | Imported school profiles, comparison/favorites, meal estimates, housing preferences/checklists | Live balances/inventory, applications, room selection, binding agreements and purchases |
| Mail, transport, library, health, safety, ID | New service entries, routine request preparation; existing maps/directions | Approved domain systems, live notices, pickup/borrowing/reservation/appointment/ID functions |
| Professor work | Existing syllabus/material/study/document creation plus course and assessment preparation | Native roster management, graded assignments, faculty gradebook and publication workflow |
| Advisor/admin work | Local plans and launch checklist; verified role/capability plumbing | Multi-user institutional consoles, reporting, provisioning and audited administrative operations |

## Complete requirements coverage

| Requirement section | State and next work |
| --- | --- |
| 1. Unified dashboard | Today plus search home and primary navigation; full movable role-specific dashboard remains partial. |
| 2. LMS | Course/assignment/study workspace and communication tools exist; official assessment, submission, discussion moderation and teaching workflows remain incomplete. |
| 3. Syllabus processing | Existing extraction, source review and corrections retained; no claim of perfect extraction or universal accuracy. |
| 4. Eleven study formats | Comprehensive guide, summary, outline, bullets, flashcards, practice quiz, practice exam, key terms, concept map, formula sheet and audio script. Generation needs a configured AI route; outputs are editable study drafts. |
| 5. Calendar | Existing views, scheduling/import/export retained; assignment subtasks join the same calendar. Fully automatic workload rescheduling and all external sync paths are not complete. |
| 6. Assignment center | Unified list/status/search/course filters, suggested next work, workload, checklist and documents added. No false submitted state. |
| 7. Grades | Existing weighted/entered grades and return feedback retained; official school grade synchronization is pending. |
| 8. Email | Drafts and original account connections retained. A full university inbox replacement is pending. |
| 9. Registration | Course catalog/cart/schedules implemented locally. Official SIS enrollment still requires an adapter and institutional transaction tests. |
| 10. Advising/degree | Degree tracker improved; advising preparation and connection contract added. Live advisor booking and authorized rosters remain. |
| 11. Finances | Bill/aid planning retained; official financial reads and payments need approved providers. |
| 12. Campus services | Housing/dining/clubs/maps expanded. Library, mail, health, safety and ID have preparation/service entry points, not live operations. Career/application tracking remains available. |
| 13. Search | Apps plus existing academic/personal records available from top search and full command search. University records use their own authorized search; private institutional data is not indexed into AI context. |
| 14. AI assistant | Existing assistant retained; source-selected study generator added. School-approved backend configuration, limits, quality measurement and deployment operations remain. |
| 15. Productivity | Write/Sheet/Deck/Files layouts improved; original editing/export abilities preserved. Existing collaboration infrastructure retained; no new Google Office compatibility claim. |
| 16. Notifications | Existing rules, calendar and push code retained, including original server functions. Delivery credentials/deployment still need operational testing. |
| 17. Roles | Six local preparation intents and verified school-role transport. A local selection does not grant access to another person's records. Full role-specific consoles remain. |
| 18. Accessibility | Named inputs, focus states, keyboard search/tabs and responsive checks. Formal WCAG 2.2 AA audit, assistive-technology matrix and VPAT remain. |
| 19. Privacy/security | Gateway adds verified auth, tenant boundaries, encryption, preview/confirm, journals and audit events. Institution SSO lifecycle, compliance documents, security testing and operational policies remain. |
| 20. Integrations | Versioned institution adapter contract and executable gateway added. No vendor-specific live university adapter is installed. Original Supabase/connected-account code is preserved. |
| 21. Onboarding | Existing onboarding/sample/import paths retained. Multi-role and school-managed onboarding is still partial. |
| 22. Navigation | Home, Courses, Study, Calendar, Assignments, Messages, Campus, Career, Create and More in the persistent shell; advanced apps remain searchable and pinnable. |
| 23. Avoid noise | Added workflows focus on work and services; no leaderboards or social engagement scoring added. Existing customization retained. |
| 24. Roadmap | Student workspace expanded, institutional foundation started. Later financial/campus replacement and migration phases remain incomplete. |

## Final navigation and usability review

The September 14 audit added closed-tab recovery, safe tab-limit handling, predictable Enter-to-search, remembered-query clearing, exact study-unit/call-room tab destinations and reachable close controls in the mobile tab row. Calendar keyboard month changes now preserve the selected day and focus; timed assignment blocks have accurate accessible labels. Closed-tab history lasts for the current visit and is limited to ten entries.

The final suite passed 6,422 tests with ten existing skips across 317 files. The build, lint/style/label checks and institution-gateway type check passed. All 60 registered apps loaded on a clean reload; desktop/tablet/phone panel checks and shared search/launcher checks found no overlap in the tested states. This does not establish production readiness or completion of the full product vision. See the audit for evidence, limitations and next priorities.

## Storage and preservation

Core courses, dates, notes, grades and authored files remain in the original store. The audit expanded core backup and rolling snapshots to include more existing coursework, productivity, degree, financial and campus records. A separate versioned workspace backup now covers creative projects, athletics, career, family, pathway, university drafts, registration and campus portal plans; the main export includes it when “Everything, as data” is selected. Attachments must be included in the ZIP. Additional workspaces are still separate from core cloud synchronization and daily snapshots. Personal workspace backups are account-scoped; legacy registration/directories remain device-scoped. Credentials are excluded. See APPLICATION_AUDIT.md for tested restore and recovery behavior.

The localhost and 127.0.0.1 URLs have separate browser storage. Keep using the same origin to retain your current local data. Do not clear site data during installation or copy production credentials into a shared handoff ZIP.

## Validation

The update was checked with TypeScript, the existing automated suite, new gateway/assignment/study tests, lint/style/accessibility-label checks, and browser verification of key desktop/mobile paths. AI and institutional integration tests use controlled responses and identities. No real university submission, payment, message or enrollment was made. See the accompanying test summary for the final run counts.

## Scope that remains substantial

The full supplied vision is not complete. In addition to actual school adapters, the following need product and engineering work: verified family invitation/acceptance and access logs; SIS and admissions transactions; official transcripts; faculty grading/publication; secure multi-step approval routing and signatures; research/clinical record systems; parent billing/payments and restricted AI; full-text semantic course knowledge; source hierarchy and automatic conflict detection; validated diagnostics/adaptive paths; advanced exam simulation; transcription and synchronized lecture media; multilingual/oral rehearsal; sandboxed coding; offline packs with progress reconciliation; institution migration and rollback tooling; analytics/pilot evidence; full accessibility/security review and operational support.

A checkbox in a local workflow represents the user's preparation only. No newly built interface pretends to complete an institution's review or a financial transaction.

## Requested rollout order

1. Prove the connected student workflow: verified syllabus → due work → study sources → practice → review. Use an opted-in pilot and measured extraction/source accuracy.
2. Connect one approved institution/service with sandbox records, reconciliation, support and rollback. Keep original systems operating during the pilot.
3. Add faculty authoring and official grade/submission workflows, followed by records/registration/advising.
4. Introduce separately authenticated family access and finance through approved providers, with student resource consent and immediate server revocation.
5. Expand campus, athletics, career and lifecycle services based on actual partner readiness. Advanced creation and adaptive study capabilities remain staged implementation work.
