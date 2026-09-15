# Semester implementation status

September 14, 2026 · Compared with the supplied complete product requirements and the follow-up list of student, professor, advisor and administrator work.

The existing app is preserved and expanded. **This build is a working student workspace with local planning tools and an institutional integration foundation. It is not yet a complete replacement for a university's LMS, email, registration, billing or campus-service systems.** The user confirmed that school-approved access is not yet available.

## September 15, 2026 — study evidence, the plan, and the hint ladder

Three capabilities the product blueprint names and this build did not have.
All three are device-local and need no university, no account service and no
AI key; that boundary is the whole point of the batch.

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

Verified with the full gate set — types, lint, 8,851 tests in file order and in
shuffled order, two timezones, production build, institution type-check — and
driven in a real browser at phone width with zero page errors. Thirty-odd
mutations were reverted under the new tests and watched go red; three of them
found weak tests rather than weak code, and one found a clause that could never
have been the deciding one, which was deleted rather than commented.

Three defects were found by looking at the screen with every test passing: a
count printed twice three lines apart, a percentage in a module the source grep
never reached, and a hint that quoted text visible verbatim as an option. A
fourth — two React children sharing a key — is not the kind of thing a test in
this suite sees at all.

### What still gates full operation, and what does not

| Gate | What it blocks | Whose it is |
| --- | --- | --- |
| University approval | Live rosters, registration, grades, billing, official records | The institution's. Nothing in this batch touches it; `app/server/institution/` still has an empty production adapter registry |
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
- **Design:** editable text/shapes/images, mouse and keyboard positioning, layer order, sizing, colors, undo/redo, SVG/PNG/JPG export and image exports saved in Files. This is a basic graphic editor, not Canva feature parity.
- **Video:** original-clip storage in Files, trimming, splitting, ordering, speed/volume, whole-clip captions, preview and browser-based 720p WebM rendering. It is a basic editor; automatic transcription, multi-track mixing, advanced effects, MP4 rendering and real-time collaboration are not implemented. Export needs a supporting browser and must be reviewed.
- **Study:** explicit top-level navigation, reusable original course files in the source picker, links back to original sources, teach-back self-comparison and a private mistake journal with review tasks and Write export. These additions do not constitute a complete adaptive learning engine or validated readiness model.
- **Athletics:** personal practices, training, competitions and travel; academic conflict review; calendar copies; professor-request drafts and travel-study checklists. Official rosters, eligibility, coaching, sports medicine and performance systems remain pending.
- **Career:** manually entered/imported opportunities, filters, saved listings, existing application tracker integration, experience-based resume/cover-letter drafts, opt-in networking records and follow-up tasks, study-abroad checklist. There is no live employer/alumni directory or verified opportunity feed yet.
- **Family:** separate local permission plans per person, no access by default, explicit item selection, expiration/removal, a restricted dashboard preview, support/checklist/budget items, local history and backup. This does not send invitations or activate parent accounts. The server policy building block enforces recipient/tenant/student/resource matching, accepted consent, expiration, revocation and payment-only separation; it still needs a server grant store and integration into every family endpoint. No parent has access to real student data in this build.
- **Pathway:** prospective-to-alumni stage preference, school/program search over imported or entered records, application-material preparation, self-reported statuses, comparable cost estimates, reusable draft profile and essay handoff. Eleven customizable milestone templates cover applications, arrival, transfer, international arrival, dissertation, publication, clinical preparation, graduation, faculty launch, pilot rollout and appeals. Owners, deadlines, notes and local preparation history are editable. These are not official decisions, signatures, approvals or transcripts.
- **Continuity:** Family and Pathway use account-scoped local stores independent of term. Their stage selection leaves all original coursework intact. New creative projects and portal selections reopen separately per app tab. A complete permanent identity lifecycle, alumni provisioning and school retention policy are still future work.

The registry now contains **60 destinations**. The institution transport recognizes **37 service areas**. Each added service has a preparation entry point; the count is not a claim of 37 implemented live integrations.

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
