# Repo audit — design catalog against the repository

**As of** 2026-10-05 · **Base** origin/main `2d8dda1` · **Stream** 00 (handoff `execute/00-setup.md`) · **Inputs** `SEMESTER_SCREEN_CATALOG.md` (589 screens), `SEMESTER_WORKFLOW_CATALOG.md` (319 steps)

> **Claim ceiling.** This is a read of the code, not a test result. `exists` means a reachable implementation was found and opened; it does not mean RLS, accessibility, monitoring or release evidence exist (the 22-point definition in the release gate catalog). The design catalog's own "Status" column (Catalogued / Designed) is ignored: it is design status, not repo evidence.

## How each row was judged

- **exists** — a user in the catalogued role can reach an implementation that does what the row says.
- **partial** — something real exists and a material part is absent; the note says what.
- **missing** — nothing implements it after a search; the note lists what was searched. A doc, a table with no screen, or a library nothing imports is *not* implementation.
- Every cited path was checked to exist by script (0 failures), and no row cites `design/`.
- Control: a random sample of 6 `exists` and 6 `missing` rows was drawn; four were re-checked independently by search and all four agreed with the verdict.
- Judged by twelve parallel read-only passes, one per slice of the catalog. Where a pass was unsure it chose the more conservative status. Rows the passes flagged as judgement calls are in the notes.

## Read this before trusting an `exists`

1. **Flag-gated is still `exists`.** Several `exists` rows sit behind a feature flag or module switch that is off by default or at every school (for example `advisor_meeting_mode`, `writeback.lms_grade_passback`, `module.dining`, `course_studio`, the enrolment module). Flag defaults were not checked row by row. Stream 03 must record each flag's default before any "ready for pilot" claim.
2. **User-entered is not official.** Degree and plan screens work from requirements the student types in; nothing here reads the SIS.
3. **Sandbox-only.** Career application, appointment and offer actions exist on the sandbox store only.
4. **Staff-side gaps dominate.** Most `partial` rows in K (institutional administration) and N (/ops) have a migration or library but no operator screen. The `/ops` console is ten tabs (Command center, Support, Approvals, Break-glass, Audit, Customers, Figures, Finance model, Evidence, Views).

## Summary — screens (589)

| Group | exists | partial | missing | total |
| --- | ---: | ---: | ---: | ---: |
| A · Public company, sales & marketing site | 53 | 26 | 1 | 80 |
| B · Student OS | 60 | 10 | 0 | 70 |
| C · Faculty & Course Studio | 8 | 18 | 10 | 36 |
| D · Advisor & student success | 3 | 13 | 9 | 25 |
| E · Registrar & academic operations | 13 | 19 | 3 | 35 |
| F · Student accounts, aid & commerce | 20 | 8 | 1 | 29 |
| G · Campus life | 17 | 13 | 5 | 35 |
| H · Community & moderation | 20 | 6 | 3 | 29 |
| I · Family & guardian | 7 | 3 | 2 | 12 |
| J · Career, employer, alumni | 12 | 18 | 10 | 40 |
| K · Institutional administration | 9 | 31 | 1 | 41 |
| L · Integrations | 6 | 19 | 3 | 28 |
| M · Trust, privacy, security | 20 | 22 | 6 | 48 |
| N · Operations Command Center (/ops) | 12 | 66 | 3 | 81 |
| **Total** | **260** | **272** | **57** | **589** |

## Summary — workflow steps (319)

| Workflow | exists | partial | missing | total |
| --- | ---: | ---: | ---: | ---: |
| Student journey | 33 | 7 | 0 | 40 |
| Faculty course lifecycle | 8 | 7 | 9 | 24 |
| Advising & student success | 2 | 5 | 10 | 17 |
| Registrar & academic operations | 8 | 12 | 1 | 21 |
| Institution implementation | 1 | 18 | 3 | 22 |
| Controlled integration | 0 | 20 | 0 | 20 |
| Governed AI request | 13 | 4 | 0 | 17 |
| Support request | 5 | 6 | 1 | 12 |
| Incident response | 0 | 8 | 9 | 17 |
| Domain migration | 8 | 8 | 1 | 17 |
| Student finance & payment | 6 | 9 | 1 | 16 |
| Campus services | 8 | 3 | 4 | 15 |
| Community & moderation | 11 | 3 | 6 | 20 |
| Career, employer & alumni | 5 | 4 | 9 | 18 |
| Family & guardian consent | 8 | 4 | 1 | 13 |
| Developer platform & marketplace | 0 | 3 | 13 | 16 |
| Analytics, outcomes & reliability | 0 | 7 | 7 | 14 |
| **Total** | **116** | **128** | **75** | **319** |

## Repo surface inventory

| Surface | Count |
| --- | ---: |
| Screen files (`app/src/screens/**/*.tsx`, non-test) | 119 |
| Components (`app/src/components/**/*.tsx`, non-test) | 382 |
| Test files (`app/src/**/*.test.ts(x)`) | 1351 |
| Migrations (`supabase/migrations/*.sql`) | 184 |
| Edge functions (`supabase/functions/*/`) | 16 |
| Gateway handlers (`app/api/**`, `app/server/**`, non-test) | 50 |
| Docs (`docs/**/*.md`) | 1562 |

### Screen files no catalog row cites (56 of 119)

These exist in the repo and are not evidence for any catalog row. They are the student-side product the catalog does not describe (or describes under another name); stream 03 should decide whether each is kept, merged or deferred. `app/src/screens.tsx` and `lib/nav.ts` remain the registry.

`Activity.tsx`, `Analyse.tsx`, `Behind.tsx`, `Clocks.tsx`, `Create.tsx`, `Deck.tsx`, `Directory.tsx`, `Draw.tsx`, `Drill.tsx`, `Equations.tsx`, `Exam.tsx`, `Field.tsx`, `Gap.tsx`, `GapOffer.tsx`, `Grades.tsx`, `Guess.tsx`, `Guide.tsx`, `Guides.tsx`, `Lesson.tsx`, `Mail.tsx`, `Meet.tsx`, `Nil.tsx`, `Proof.tsx`, `Recovery.tsx`, `Reports.tsx`, `Respond.tsx`, `Runway.tsx`, `Sheet.tsx`, `Slides.tsx`, `Solve.tsx`, `Springboard.tsx`, `WhatsNew.tsx`, `calendar/AddHere.tsx`, `calendar/Move.tsx`, `call/Bar.tsx`, `call/Green.tsx`, `call/Index.tsx`, `call/Lobby.tsx`, `call/Schedule.tsx`, `call/Stage.tsx`, `call/Tile.tsx`, `changes/AgainstCalendar.tsx`, `changes/FromText.tsx`, `deck/Canvas.tsx`, `deck/Edit.tsx`, `me/You.tsx`, `report/Day.tsx`, `report/Term.tsx`, `report/Week.tsx`, `settings/About.tsx`, `settings/Courses.tsx`, `settings/Grading.tsx`, `settings/Look.tsx`, `settings/Nav.tsx`, `settings/Page.tsx`, `sheet/Library.tsx`

## Screens

### A · Public company, sales & marketing site

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| A-001 | Homepage | exists | `company-site/index.html` | Home page (data-page=home) with persona picker, proof walkthrough, status map |
| A-002 | Product overview | exists | `company-site/index.html` | #product overview page: every module in one place |
| A-003 | Student workspace page | exists | `company-site/index.html`<br>`company-site/site.js` | #students page plus personal-academic-os page |
| A-004 | Institution platform page | exists | `company-site/index.html`<br>`app/src/site/pages.tsx` | #institutions page; also React /institutions/ in app/src/site |
| A-005 | Registration Readiness Pilot page | partial | `company-site/index.html`<br>`company-site/site.js` | No dedicated page; pilot shown on institutions/pricing/design-partners (25-100 student pilot CTA) |
| A-006 | Course Studio page | partial | `company-site/site.js`<br>`company-site/index.html` | Covered by #faculty page and a module row; no standalone Course Studio page |
| A-007 | Governed AI page | exists | `company-site/index.html`<br>`company-site/site.js` | #academic-integrity (AI within course rules) plus trust-ai AI governance page |
| A-008 | Advising and Student Success page | exists | `company-site/site.js` | #advising solution page: advising and student success |
| A-009 | Registrar and Academic Operations page | exists | `company-site/site.js` | #registrars solution page: registration readiness |
| A-010 | Campus Services page | partial | `company-site/site.js` | Only a "Campus Hub" module row and product overview mention; no Campus Services page |
| A-011 | Career and Lifelong Learning page | partial | `company-site/site.js`<br>`app/src/site/advancement.tsx` | Career module row, Career Office row, /alumni/ page; no dedicated career/lifelong page |
| A-012 | Integrations page | exists | `company-site/index.html`<br>`app/src/site/more.tsx` | #integrations directory with per-integration status |
| A-013 | Solutions: Students | exists | `company-site/index.html` | #students solution page |
| A-014 | Solutions: Advisors | exists | `company-site/site.js` | Advisors served by #advising solution page |
| A-015 | Solutions: Student Success | exists | `company-site/site.js` | Student success served by #advising "advising & student success" page |
| A-016 | Solutions: Faculty | exists | `company-site/site.js` | #faculty solution page |
| A-017 | Solutions: Registrars | exists | `company-site/site.js` | #registrars solution page |
| A-018 | Solutions: Departments | exists | `company-site/site.js` | #departments solution page |
| A-019 | Solutions: Institutions | exists | `company-site/index.html` | #institutions page |
| A-020 | Solutions: Enterprise/Multi-campus | exists | `company-site/site.js` | #enterprise solution page: multi-campus, native LMS |
| A-021 | Solutions: Partners | exists | `company-site/index.html`<br>`app/src/site/community.tsx` | #partner-portal page and /community/partners/ directory |
| A-022 | Pilot overview | partial | `company-site/index.html`<br>`company-site/site.js` | No standalone overview; design-partners page and institutions pilot CTA/timeline cover it |
| A-023 | Pilot scope | partial | `company-site/index.html`<br>`company-site/site.js` | Scope only as Registration & Path Pilot package row and launch types; no scope page |
| A-024 | Pilot success metrics | partial | `company-site/index.html` | #outcomes methodology and business-case calculator; no pilot-specific success metrics page |
| A-025 | Implementation approach | exists | `company-site/index.html`<br>`company-site/site.js` | #institutions timeline (Discover/Configure/UAT/Launch) and #launch page |
| A-026 | Request pilot form | exists | `company-site/index.html`<br>`company-site/site.js` | Contact form topic "An institutional pilot" -> lead-intake; also design-partners apply |
| A-027 | Pricing: Student plans | exists | `company-site/index.html`<br>`app/src/site/pages.tsx` | #solution pricing: Free/Plus/Pro student plans (Plus/Pro marked planned) |
| A-028 | Pricing: Department plans | partial | `company-site/index.html` | Department Launch package row (setup + subscription model) but no price or own page |
| A-029 | Pricing: Institution plans | exists | `company-site/index.html` | Semester Access institution tiers from $15K/35K/75K on pricing page |
| A-030 | Pricing: Enterprise plans | partial | `company-site/index.html` | University OS row "custom multi-year agreement"; no plan detail or own page |
| A-031 | Feature comparison | exists | `company-site/index.html`<br>`company-site/site.js` | #availability matrix by capability x individual/department/institution/enterprise |
| A-032 | AI usage policy | partial | `company-site/index.html`<br>`company-site/site.js` | AI use policy only a draft register row; trust-ai page and free-plan AI limit note; no policy page |
| A-033 | Request pricing | partial | `company-site/index.html`<br>`company-site/site.js` | Pricing CTAs route to contact form/launch estimator; no dedicated request-pricing form |
| A-034 | Demo request | partial | `company-site/index.html`<br>`company-site/site.js` | Contact form (enterprise briefing topic) and executive-briefing page; no dedicated demo request |
| A-035 | Calendar booking | missing | — | Searched booking/Calendly/schedule a demo/Book a in company-site, app/src/site; only "Book an executive briefing" link to contact |
| A-036 | Demo confirmation | partial | `company-site/site.js`<br>`supabase/functions/lead-intake/index.ts` | Generic lead submit confirmation with reference number; not demo-specific |
| A-037 | Qualification follow-up | partial | `company-site/index.html`<br>`company-site/site.js` | Contact "What happens next" (discovery, written scope) and lead-intake; no qualification flow |
| A-038 | Trust: Security overview | exists | `company-site/site.js` | trust-security page and #trust Trust Center |
| A-039 | Trust: Privacy overview | exists | `company-site/site.js`<br>`app/src/screens/Privacy.tsx` | trust-privacy page; in-app Privacy screen; policy itself draft |
| A-040 | Trust: Accessibility | exists | `company-site/index.html` | #accessibility center with self-assessment, known issues, report form |
| A-041 | Trust: Responsible AI | exists | `company-site/index.html`<br>`company-site/site.js` | #responsible-technology (ten lines) and trust-ai AI governance |
| A-042 | Trust: Data practices | exists | `company-site/index.html` | #trust-data-ai Data & AI transparency and #data-governance pages |
| A-043 | Trust: Subprocessors | exists | `company-site/site.js`<br>`company-site/index.html` | trust-subprocessors page and #trustsub |
| A-044 | Trust: Compliance roadmap | exists | `company-site/site.js`<br>`company-site/index.html` | Trust page compliance evidence table (SOC2/ISO/HECVAT/VPAT) and roadmap with gates |
| A-045 | Trust: Status/reliability | exists | `company-site/index.html`<br>`company-site/site.js` | #status live checks plus 90-day history; trust-reliability page |
| A-046 | Security document request | exists | `company-site/index.html`<br>`company-site/site.js`<br>`supabase/functions/lead-intake/index.ts` | #procurement document request form (accelerator) posting to lead-intake |
| A-047 | Trust room request | exists | `company-site/index.html`<br>`app/src/screens/TrustRoom.tsx`<br>`supabase/functions/trust-room/index.ts` | Procurement form requests room access; token-gated reviewer room screen and function |
| A-048 | Vulnerability disclosure | exists | `company-site/site.js` | trust-disclosure Responsible disclosure page |
| A-049 | Guides | partial | `app/src/site/pages.tsx` | Free tools library exists; written guides listed as "being written" |
| A-050 | Research | partial | `company-site/index.html` | #research partnerships page with method; no published research |
| A-051 | Webinars | partial | `company-site/index.html`<br>`app/src/site/community.tsx` | #events page with notify signup and /community/events/; no webinars published |
| A-052 | Product updates | exists | `company-site/index.html` | #roadmap changelog and #updates comms center with sample release note |
| A-053 | Case studies | partial | `app/src/site/community.tsx` | No case study published; stories page and fictional launch microsite only |
| A-054 | FAQ | exists | `company-site/index.html`<br>`company-site/site.js` | #help FAQ and trust-faq page |
| A-055 | Glossary | exists | `company-site/index.html`<br>`company-site/site.js` | #glossary page (nine terms) |
| A-056 | Newsletter | exists | `company-site/index.html` | #updates communications center topic subscribe form |
| A-057 | Compare: fragmented tools | exists | `company-site/site.js` | #compare "vs portals" tab (disconnected tools) |
| A-058 | Compare: LMS-only | exists | `company-site/site.js` | #compare "vs a legacy LMS experience" tab |
| A-059 | Compare: manual advising | exists | `company-site/site.js` | #compare "vs manual registration planning" and advising tabs |
| A-060 | Compare: separate AI tools | exists | `company-site/site.js` | #compare AI tab: generic/separate AI tools vs Semester |
| A-061 | Partners | exists | `company-site/index.html`<br>`app/src/site/community.tsx` | #partner-portal and /community/partners/ |
| A-062 | Ambassador program | exists | `company-site/index.html`<br>`app/src/site/community.tsx` | Ambassador rules in #careers and /community/ambassadors/ page |
| A-063 | Careers | exists | `company-site/index.html` | #careers page with roles and interview process |
| A-064 | Mission | exists | `company-site/index.html` | #company page "Our mission" section |
| A-065 | Leadership | exists | `company-site/index.html` | #leadership page with owners and commitments |
| A-066 | Values | exists | `company-site/index.html` | #principles and company operating principles page |
| A-067 | Press kit | partial | `company-site/index.html` | #brand center (logo, palette, descriptions); press kit "available on request" |
| A-068 | Contact | exists | `company-site/index.html`<br>`company-site/site.js` | #contact page: topic form, directory, lead-intake backed |
| A-069 | Terms | partial | `company-site/index.html`<br>`docs/legal/TERMS-OF-SERVICE-DRAFT.md` | Only listed in policy version register as draft/not in force; no terms text served |
| A-070 | Privacy | partial | `company-site/index.html`<br>`app/src/screens/Privacy.tsx` | Privacy register row (draft, not in force), trust-privacy and in-app Privacy; no policy text page |
| A-071 | Acceptable use | partial | `company-site/site.js`<br>`docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md` | Register row only (draft); text lives in docs draft |
| A-072 | DPA | partial | `company-site/index.html`<br>`company-site/site.js` | Register row: DPA not started, checklist published; student data addendum template |
| A-073 | Cookies | partial | `company-site/site.js`<br>`docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md` | Register row only (draft); no cookie notice page served |
| A-074 | Subprocessor terms | partial | `company-site/site.js` | Subprocessor list page exists; no separate subprocessor terms document |
| A-075 | Login | exists | `app/src/components/Credentials.tsx`<br>`app/src/lib/route.ts`<br>`company-site/index.html` | App #/login door to account sign-in; site links to it |
| A-076 | Sign up | exists | `app/src/components/Credentials.tsx`<br>`app/src/lib/route.ts`<br>`company-site/index.html` | App #/signup door to account creation; site links to it |
| A-077 | Password reset | exists | `app/src/lib/cloud.ts`<br>`app/src/components/Credentials.tsx` | sendReset reset-link flow and password-recovery handling in sign-in form |
| A-078 | System status handoff | exists | `company-site/index.html`<br>`app/public/status.html` | #status page links to app status.html and status-feed |
| A-079 | Help center handoff | exists | `company-site/index.html`<br>`app/src/screens/Help.tsx` | #help center on site and in-app Help screen |
| A-080 | 404 / maintenance / outage | partial | `company-site/index.html`<br>`app/src/components/StatusNotice.tsx` | Site notfound page and status incident notices; no maintenance/outage page |

### B · Student OS

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| B-001 | Today | exists | `app/src/screens/Today.tsx`<br>`app/src/components/TodayDecisionSurface.tsx` | Today screen: due, next, week ahead, decision surface |
| B-002 | Action Center | exists | `app/src/components/ActionCenter.tsx`<br>`app/src/components/TodayActionCenter.tsx` | Ranked action list mounted on Today via TodayDecisionSurface |
| B-003 | Notifications | exists | `app/src/screens/Me.tsx`<br>`app/src/screens/Hub.tsx` | Notifications screen (reminders, dismiss) plus Notices hub |
| B-004 | Calendar | exists | `app/src/screens/Calendar.tsx` | Day/week/month/semester calendar with drag-to-move |
| B-005 | Schedule | exists | `app/src/screens/Calendar.tsx`<br>`app/src/components/WeekGrid.tsx`<br>`app/src/components/RegistrationPortal.tsx` | Weekly timetable grid in Calendar; weekly schedule preview in cart |
| B-006 | Tasks | exists | `app/src/screens/Mine.tsx` | Personal tasks list with steps, due dates in Personal screen |
| B-007 | Goals | exists | `app/src/components/GoalPlan.tsx`<br>`app/src/screens/Today.tsx` | Goal turned into editable plan with milestones, mounted on Today |
| B-008 | Path | exists | `app/src/components/PathSnapshotCard.tsx`<br>`app/src/screens/Pathway.tsx`<br>`app/src/screens/Degree.tsx` | My Path snapshot plus Pathway workspace for long projects |
| B-009 | Degree progress | exists | `app/src/screens/Degree.tsx` | What is left / Taken / rollup per programme; user-entered requirements |
| B-010 | Program requirements | exists | `app/src/screens/Degree.tsx` | Requirements tab; user enters own requirements, app ships none by design |
| B-011 | Plan | exists | `app/src/components/GraduationSimulator.tsx`<br>`app/src/components/PathSnapshotCard.tsx`<br>`app/src/components/Plan.tsx` | Current plan and scenarios in Degree; weekly study Plan; estimates only |
| B-012 | Term planner | partial | `app/src/components/RegistrationPortal.tsx`<br>`app/src/components/GraduationSimulator.tsx` | Cart and saved potential schedules per term; no multi-term planner view |
| B-013 | Course comparison | exists | `app/src/components/CourseCompare.tsx`<br>`app/src/components/RegistrationPortal.tsx` | Up to three saved courses side by side; flag course_detail_v2 |
| B-014 | Workload planner | exists | `app/src/components/LifeBalance.tsx`<br>`app/src/components/CrunchWeekCard.tsx`<br>`app/src/screens/settings/Workload.tsx` | Weekly hours by category, crunch forecast, capacity settings; flagged |
| B-015 | Cost planner | exists | `app/src/components/CostPlanner.tsx`<br>`app/src/components/GraduationSimulator.tsx` | Per-term cost lines with source labels; flag cost_planner, in Degree Scenarios |
| B-016 | Registration readiness | exists | `app/src/components/RegistrationReadiness.tsx`<br>`app/src/components/PathSnapshotCard.tsx` | Readiness checklist routing to My Path and Registration |
| B-017 | Registration status | exists | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/screens/Registration.tsx` | Enrolled/waitlisted/pending state, waitlist position, drop; module-gated |
| B-018 | Holds | partial | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/lib/enrollment/client.ts` | Hold notice with office and link inside Registration; no holds list screen |
| B-019 | Course search | exists | `app/src/components/RegistrationPortal.tsx`<br>`app/src/screens/Yes.tsx` | Catalog search by term, dept, open seats, time, format |
| B-020 | Course details | exists | `app/src/components/CourseDetailV2.tsx`<br>`app/src/components/RegistrationPortal.tsx` | Course detail sheet/drawer with sections, seats as reported; flagged |
| B-021 | Section comparison | partial | `app/src/components/CourseCompare.tsx`<br>`app/src/components/RegistrationDay.tsx`<br>`app/src/components/RegistrationPortal.tsx` | Compares courses and saved schedules and backups; no per-section compare |
| B-022 | Seat watch | partial | `app/src/components/RegistrationDay.tsx`<br>`app/src/components/enrollment/StudentRegistration.tsx` | Seat counts and waitlist place shown; no seat alerts without live feed |
| B-023 | Graduation scenarios | exists | `app/src/components/GraduationSimulator.tsx`<br>`app/src/lib/scenario-compare.ts`<br>`app/src/screens/Degree.tsx` | What-if scenarios compared with current plan in Degree Scenarios tab |
| B-024 | Transfer credit view | partial | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/pathway.ts`<br>`app/src/lib/transferhub.ts` | Ledger lists transfer-credit records; Pathway checklist; no dedicated view |
| B-025 | Articulation view | partial | `app/src/lib/transferhub.ts`<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` | articulation_rules table and hub lib only; no student UI |
| B-026 | Courses | exists | `app/src/screens/Courses.tsx`<br>`app/src/components/CourseHub.tsx` | Course list, per-course hub, standing and deadlines |
| B-027 | Course Studio | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/screens/Account.tsx` | Faculty-only publish surface behind course_studio flag |
| B-028 | Course schedule | partial | `app/src/screens/Courses.tsx`<br>`app/src/components/CourseHub.tsx` | Meeting times, room and deadlines on course page; no dedicated schedule view |
| B-029 | Course assignments | exists | `app/src/components/CourseHub.tsx` | Assignments tab with search, upcoming/past/completed filters |
| B-030 | Course resources | exists | `app/src/components/CourseHub.tsx`<br>`app/src/components/SourceLocker.tsx` | Readings/materials tab plus source locker (flagged) |
| B-031 | Course announcements | partial | `app/src/screens/Changes.tsx`<br>`app/src/components/CourseStudio.tsx` | Student folds in announcements; instructor publishes via Course Studio; no feed |
| B-032 | Course AI guidance | exists | `app/src/components/toolkit/Toolkit.tsx`<br>`app/src/lib/toolkit/policy.ts`<br>`app/src/components/CourseAgreement.tsx` | Course AI policy card resolved over school/university rules in Toolkit |
| B-033 | Study packs | exists | `app/src/components/StudyStudio.tsx`<br>`app/src/screens/Study.tsx` | Study guides in 11 formats plus instructor study packs |
| B-034 | Notes | exists | `app/src/screens/Mine.tsx` | NoteEditor and notes list in Personal |
| B-035 | Files | exists | `app/src/screens/Mine.tsx`<br>`app/src/screens/mine/Drive.tsx`<br>`app/src/lib/files.ts` | File attach/open and Drive picker in Personal |
| B-036 | Documents | exists | `app/src/screens/Write.tsx`<br>`app/src/screens/write/Paper.tsx` | Write a document, exports real Word file |
| B-037 | Project workspace | exists | `app/src/components/ProjectFile.tsx`<br>`app/src/screens/Work.tsx`<br>`app/src/components/OperatingProjectMap.tsx` | Project file with runway, sources, rubric checklist; project map |
| B-038 | Group workspace | exists | `app/src/screens/Groupwork.tsx` | Shared list of parts, owners and whether it lands |
| B-039 | Focus mode | exists | `app/src/components/unity/modes.tsx`<br>`app/src/components/unity/QuickActions.tsx` | Focus mode bar and workspace mode picker |
| B-040 | Study sessions | exists | `app/src/components/Plan.tsx`<br>`app/src/lib/sessions.ts` | Planned study sessions with missed-session recovery |
| B-041 | Search | exists | `app/src/screens/Search.tsx`<br>`app/src/components/Command.tsx` | Search home and command palette over registry |
| B-042 | AI Copilot | exists | `app/src/ai/Chat.tsx`<br>`app/src/screens/Work.tsx` | Ask Semester chat with threads; Work on it assistant |
| B-043 | Research workspace | exists | `app/src/components/toolkit/ResearchPanel.tsx`<br>`app/src/screens/Sources.tsx` | Evidence audit, search strings, BibTeX/RIS, kept sources |
| B-044 | Writing workspace | exists | `app/src/screens/Write.tsx`<br>`app/src/screens/Essay.tsx`<br>`app/src/screens/Work.tsx` | Write a document, Draft it, Work on it |
| B-045 | Community | exists | `app/src/screens/Community.tsx` | Course and study-group spaces with moderation |
| B-046 | Organizations | exists | `app/src/screens/Activities.tsx`<br>`app/src/components/CampusDirectory.tsx` | Clubs directory and your own activities; school-supplied listings |
| B-047 | Events | exists | `app/src/screens/Activities.tsx`<br>`app/src/components/CampusDirectory.tsx` | Events tab from school directory import, upcoming/past |
| B-048 | Dining | exists | `app/src/screens/Dining.tsx`<br>`app/src/screens/Meals.tsx` | Meal plan screen live; Dining ordering behind module.dining, off by default |
| B-049 | Housing | exists | `app/src/screens/Housing.tsx` | Room and move-out date from last exam |
| B-050 | Campus services | exists | `app/src/screens/University.tsx`<br>`app/src/screens/Support.tsx` | University services with honest what-the-app-can-do per area |
| B-051 | Student account | exists | `app/src/screens/Bill.tsx`<br>`app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Costs.tsx` | Statement and aid set against bill |
| B-052 | Payment plan | exists | `app/src/screens/Bill.tsx`<br>`app/src/components/MyStudentAccount.tsx` | Instalment plan modeller that sums to balance; never moves money |
| B-053 | Financial-support handoff | partial | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx` | Emergency grants/basic-needs doors to offices; no aid-office handoff flow |
| B-054 | Support center | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Doors by need with privacy label per office |
| B-055 | Help request | exists | `app/src/screens/Help.tsx`<br>`app/src/components/AskAHuman.tsx`<br>`app/src/components/SupportTicketsPanel.tsx` | Ask a human and support tickets in Help; ticket flag |
| B-056 | Advisor sharing | exists | `app/src/components/AdvisorMeeting.tsx`<br>`app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-shares.ts` | Advisor meeting mode with shared view; flagged |
| B-057 | Family sharing | exists | `app/src/screens/Family.tsx`<br>`app/src/lib/familyshare.ts`<br>`app/src/components/FamilyInvite.tsx` | Item-by-item sharing with preview and invites |
| B-058 | Accessibility services | partial | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx` | Accommodation how-to doors to access office; no request workflow |
| B-059 | Career | exists | `app/src/screens/Career.tsx`<br>`app/src/components/CareerEvidence.tsx` | Career workspace with evidence, contacts, letters |
| B-060 | Skills | exists | `app/src/components/SkillsGraph.tsx`<br>`app/src/lib/skills-graph.ts`<br>`app/src/screens/Career.tsx` | Skills graph with suggested skills awaiting confirmation |
| B-061 | Portfolio | exists | `app/src/components/CareerEvidence.tsx`<br>`app/src/components/SaveAsEvidence.tsx` | Portfolio tab in Career Evidence; flag career_evidence |
| B-062 | Opportunities | exists | `app/src/screens/Opportunities.tsx`<br>`app/src/screens/Applying.tsx` | Jobs, research, abroad, internships list with steps |
| B-063 | Mentors | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts`<br>`app/src/screens/People.tsx` | Mentor finder plus people and letters |
| B-064 | Profile | exists | `app/src/screens/Profile.tsx` | Profile screen |
| B-065 | Account settings | exists | `app/src/screens/Account.tsx`<br>`app/src/screens/settings/Index.tsx`<br>`app/src/components/AccountSecurity.tsx` | Sign-in, sync, security and settings pages |
| B-066 | Privacy settings | exists | `app/src/screens/Privacy.tsx`<br>`app/src/components/DataRightsRequests.tsx` | What leaves device, rights requests, delete |
| B-067 | AI settings | exists | `app/src/screens/settings/Assistant.tsx` | Assistant settings page |
| B-068 | Notification settings | exists | `app/src/screens/settings/Alerts.tsx` | Alerts settings page |
| B-069 | Data export | exists | `app/src/screens/Export.tsx`<br>`app/src/screens/Privacy.tsx` | Take it with you export plus server data export |
| B-070 | Account deletion request | exists | `app/src/screens/Privacy.tsx`<br>`app/src/components/DataRightsRequests.tsx` | Delete my account button plus filed rights requests |

### C · Faculty & Course Studio

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| C-001 | Faculty dashboard | partial | `app/src/components/institutional/RoleWorkspace.tsx`<br>`app/src/components/CourseStudio.tsx` | Synthetic-preview faculty workspace plus Account 'Teaching' entry; no real faculty dashboard |
| C-002 | Course list | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | Only a picker of courses the account may publish for (myCourses); no course list screen |
| C-003 | Course home | partial | `app/src/components/CourseStudio.tsx` | Per-course Course Studio panel (rules, guidance, packs, history) acts as home; no wider course home |
| C-004 | Course setup | missing | — | Searched course setup/create course/EditCourse in app/src, supabase; only student EditCourse and gradebook scheme exist |
| C-005 | Syllabus | missing | — | Searched syllabus authoring in CourseStudio, lib, supabase; only an optional syllabus URL on AI rules; student-side syllabus import only |
| C-006 | Learning objectives | missing | — | Searched learning objective/outcome authoring in app/src, supabase; masterregister LMS-015 says no authoring |
| C-007 | Course schedule | missing | — | Searched course schedule publish/faculty schedule in app/src, supabase; only student calendar and import exist |
| C-008 | Course announcements | missing | — | Searched announcement/announce in app/src, supabase; 'announce' screen is student tool; no faculty course announcements |
| C-009 | Course guidance | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts`<br>`supabase/migrations/20260928309000_course_studio.sql` | GuidanceTab publishes versioned course guidance via publish_course_guidance; flag course_studio |
| C-010 | Course AI rules | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts`<br>`supabase/migrations/20260928309000_course_studio.sql` | RulesTab publishes per-use AI rules via publish_course_rules with student card preview |
| C-011 | Resource library | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/courserules.ts` | Study packs hold links/citations only; docs say no file hosting or resource library |
| C-012 | Approved sources | partial | `app/src/components/CourseStudio.tsx`<br>`supabase/migrations/20261001185348_approved_source_policy_scope.sql` | Pack refs marked authoritative/supplemental; approved_source is admin-written with no faculty UI |
| C-013 | Assignments | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/server/institution/sandbox.ts` | Gradebook items and sandbox assignments only; no assignment authoring or submissions (masterregister LMS-004) |
| C-014 | Assessment builder | partial | `app/src/lib/itembank.ts`<br>`app/src/lib/assessment/qti.ts` | Item bank/test assembly logic exists but is wired to no screen |
| C-015 | Question bank | partial | `app/src/lib/itembank.ts`<br>`app/src/lib/itembank.test.ts` | Versioned reviewed item bank logic only; no UI wired |
| C-016 | Rubric builder | partial | `app/src/lib/rubricengine.ts`<br>`app/src/lib/rubricengine.test.ts` | Rubric levels/scoring engine, header says wired to no screen; no builder UI |
| C-017 | Gradebook | exists | `app/src/screens/Gradebook.tsx`<br>`app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts`<br>`supabase/migrations/20260929310000_gradebook.sql` | Instructor gradebook of record: categories, scheme, versions; gated by writeback.lms_grade_passback flag |
| C-018 | Grade entry | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts`<br>`app/src/lib/gradebook/ledger.ts` | enterScore per item/student with draft versions, marks and reasons |
| C-019 | Grade moderation | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts`<br>`supabase/gradebook.check.sql` | moderate() second-person moderation (grades:moderate) before release |
| C-020 | Grade release | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | release() per item; students see only released versions |
| C-021 | Regrade queue | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/components/gradebook/StudentGrades.tsx`<br>`app/src/lib/gradebook/client.ts` | Student files regrade; instructor resolves open requests (resolveRegrade) |
| C-022 | Grade passback | partial | `app/src/lib/gradebook/passback.ts`<br>`app/src/lib/gradebook/client.ts`<br>`app/src/components/gradebook/InstructorBook.tsx` | Queues passback rows and CSV export; runPassback has no caller or live LMS adapter |
| C-023 | Feedback workspace | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/server/institution/sandbox.ts` | Per-grade comment and sandbox marking/feedback release; no annotation or batch feedback workspace |
| C-024 | Student progress view | missing | — | Searched student progress/roster view in app/src, supabase; deliberately refused per FACULTY-COURSE-STUDIO-DESIGN F5 and institution-ops |
| C-025 | Course activity aggregates | partial | `app/src/lib/institution-ops.ts`<br>`app/src/components/institutional/OperationsStudio.tsx` | n>=10 aggregate engine and metric dictionary; analyst pastes data, flag-gated, no course feed |
| C-026 | Study packs | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts`<br>`supabase/migrations/20260928309000_course_studio.sql` | PacksTab publishes ordered, versioned study packs via publish_study_pack |
| C-027 | Office hours | partial | `app/src/components/HelpInbox.tsx`<br>`app/src/lib/officehours.ts` | Faculty can answer routed help requests; office-hours nudge is student-side; no hours/queue management |
| C-028 | Discussions | partial | `app/src/lib/rooms.ts`<br>`app/src/screens/Classmates.tsx` | Student class rooms only; no faculty-run course discussions (masterregister LMS-007) |
| C-029 | Group management | partial | `app/src/lib/groupwork.ts`<br>`app/src/screens/Groupwork.tsx` | Student group work exists; no faculty group management |
| C-030 | TA management | missing | — | Searched TA management/ta_assign/teaching_assistant; only preview persona in RoleWorkspace and role_grants, no TA UI |
| C-031 | Course accessibility review | missing | — | Searched accessibility review in app/src, supabase; only per-item review inside unwired itembank.ts |
| C-032 | Academic-integrity workflow | missing | — | Searched academic integrity/integrity case; institution-ops FORBIDDEN refuses integrity accusations; no workflow |
| C-033 | Course imports/exports | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/components/institutional/MigrationCenter.tsx` | Released-grade CSV export and school-level migration; no course cartridge import/export |
| C-034 | Course archive | missing | — | Searched course archive/conclude/restore in app/src, supabase; only student term rollover (lib/rollover.ts) |
| C-035 | Course version history | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | HistoryTab lists immutable versions of rules, guidance and packs only; no course content history |
| C-036 | Course settings | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | Only gradebook scheme/letter settings; no general course settings screen |

### D · Advisor & student success

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| D-001 | Advisor dashboard | partial | `app/src/components/institutional/RoleWorkspace.tsx`<br>`app/src/components/AdvisorSharedView.tsx` | Synthetic-preview advisor workspace and shared-meeting list; no real advisor dashboard |
| D-002 | Caseload | missing | — | Searched caseload/advisee list in app/src, supabase; none; product says it does not flag or rank students |
| D-003 | Student profile | missing | — | Searched advisor student profile in app/src, supabase; advisor sees only the consented share snapshot |
| D-004 | Student path | partial | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-meeting.ts`<br>`app/src/screens/Pathway.tsx` | Advisor reads only a ticked plan scenario snapshot; student's own Pathway exists; no advisor path view |
| D-005 | Academic plan | partial | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-shares.ts`<br>`app/src/screens/Degree.tsx` | Student shares plan scenario/courses with advisor (expiring, audited); no advisor-side plan editor |
| D-006 | Action completion | partial | `app/src/components/OfficeActionDesk.tsx`<br>`app/src/lib/office-actions.ts` | Office sees completion count only at n>=10; not an advisor per-student action tracker |
| D-007 | Holds and registration status | partial | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/components/enrollment/RegistrarDesk.tsx` | Student sees own hold/registration status; registrar desk exists; no advisor view |
| D-008 | Check-ins | missing | — | Searched advisor check-in/check-ins in app/src, supabase; only community mentorship and student self check-ins |
| D-009 | Appointment schedule | partial | `app/server/institution/advising.ts`<br>`app/src/screens/University.tsx` | Student books advising slots against labelled sandbox; no advisor-side schedule |
| D-010 | Advising notes | partial | `app/src/components/AdvisorMeeting.tsx`<br>`app/src/lib/advisor-meeting.ts` | Student-prepared agenda, follow-ups and private notes; no advisor note-taking |
| D-011 | Success plan | missing | — | Searched success plan/student success plan in app/src, supabase; only commercial customer-success hits |
| D-012 | Referral workflow | partial | `app/src/lib/help-routes.ts`<br>`app/src/components/HelpInbox.tsx` | Student routes to offices and staff inbox answers; no advisor-initiated referral |
| D-013 | Support request history | partial | `app/src/components/HelpInbox.tsx`<br>`app/src/lib/help-routes.ts`<br>`app/src/components/SupportTicketsPanel.tsx` | Inbox closed/all filters and student ticket history; no per-student history for advisor |
| D-014 | Shared student workspace | exists | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-shares.ts`<br>`supabase/migrations/20260928301000_advisor_shares.sql` | Advisor lists and opens shares (read_advisor_share, logged); flag advisor_meeting_mode, in Degree tab |
| D-015 | Student consent/grant view | exists | `app/src/components/AdvisorMeeting.tsx`<br>`app/src/lib/advisor-shares.ts`<br>`supabase/migrations/20260930190000_advisor_share_audit.sql` | Student sees each share, state, advisor opens log, revoke and delete; every share expires |
| D-016 | Risk and priority signals | missing | — | Searched risk score/at-risk signals; refused by design: institution-ops FORBIDDEN risk_score; atrisk.ts is student's own absences |
| D-017 | Outreach queue | partial | `app/src/components/OfficeActionDesk.tsx`<br>`app/src/lib/office-actions.ts` | Office draft/approve/publish desk to cohorts; no advising outreach queue; no per-student targeting |
| D-018 | Communication composer | partial | `app/src/components/institutional/RoleWorkspace.tsx`<br>`app/src/components/institutional/role-workspace.ts` | Only local sample advising follow-up drafts in synthetic preview; nothing sent |
| D-019 | Cohort dashboard | missing | — | Searched cohort dashboard/cohort view in app/src, supabase; only aggregate engine and outcome_aggregates table, no dashboard |
| D-020 | Program dashboard | partial | `app/src/components/institutional/OperationsStudio.tsx`<br>`app/src/lib/institution-ops.ts` | Curriculum tab (prereq bottlenecks, capacity) on pasted data; flag-gated; no program dashboard |
| D-021 | Outcome aggregates | partial | `app/src/components/institutional/OperationsStudio.tsx`<br>`app/src/lib/institution-ops.ts`<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` | outcome_aggregates table (n>=10) and suppressed export from pasted counts; no UI reading the table |
| D-022 | Intervention tracker | missing | — | Searched intervention tracker/intervention in app/src, supabase; only an 'intervention' metric definition in institution-ops |
| D-023 | Escalation workflow | missing | — | Searched escalation/escalate in app/src, supabase; only community moderation escalation (components/community/Escalation.tsx) |
| D-024 | Student support resources | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts`<br>`app/src/lib/basicneeds.ts` | Support map of campus care/basic-needs offices with confidentiality shown first; student-facing |
| D-025 | Advisor settings | missing | — | Searched advisor settings/preferences in app/src/screens/settings, lib/settings.ts; no advisor-specific settings |

### E · Registrar & academic operations

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| E-001 | Registrar dashboard | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/screens/Registration.tsx`<br>`app/src/components/OfficeActionDesk.tsx` | Registrar tab on Registration (pending requests, overrides, term/section setup); no KPI dashboard or overview |
| E-002 | Term management | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | registrar_put_term via desk: open date, add/drop end, withdraw end, credit ceiling per term |
| E-003 | Academic calendar | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/screens/Registrar.tsx` | Only registration/add-drop/withdraw dates set by registrar; no published full calendar (holidays, finals); student-entered dates elsewhere |
| E-004 | Catalog management | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Course code/title/credits entered per section only; no standalone course catalog or description management (registration_sections) |
| E-005 | Course management | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Course created implicitly through section upsert (code, title, credits, prerequisites); no course-level lifecycle screen |
| E-006 | Section management | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Add/change section: seats, waitlist cap, meeting days/times, prerequisites, approval flag (registrar_put_section) |
| E-007 | Faculty assignment | missing | — | Searched instructor, faculty assign in registration migration, lib/enrollment, RegistrarDesk: sections have no instructor field |
| E-008 | Room scheduling | missing | — | Searched room schedul, rooms, location in registration migration, RegistrarDesk, lib/enrollment: no course room assignment |
| E-009 | Capacity management | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Seat limit and waitlist cap editable; raising capacity promotes waitlist, lowering never evicts (registrar_put_section) |
| E-010 | Waitlist management | partial | `supabase/migrations/20260929300000_registration_transaction.sql`<br>`app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/components/enrollment/RegistrarDesk.tsx` | Waitlist cap, positions, auto-promotion and student leave-waitlist exist; registrar has no waitlist view/reorder screen |
| E-011 | Prerequisite rules | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Prerequisites set per section and enforced by registration_blocker; waivable by override |
| E-012 | Co-requisite rules | missing | — | Searched corequisite in registration migration, lib/enrollment, RegistrarDesk: none; only student-side catalog text parsing |
| E-013 | Registration windows | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/components/RegistrationDay.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Term opens_at gates enrollment; registration_windows audience notices table has no UI; no per-cohort windows |
| E-014 | Time tickets | partial | `app/src/components/RegistrationDay.tsx`<br>`app/src/lib/registration-day.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Student enters own time ticket (unverified copy); server enforces only term opening; no staff ticket assignment |
| E-015 | Holds | partial | `app/src/components/enrollment/StudentRegistration.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Student sees SIS hold and enrollment is blocked; registration_holds has no place/release UI (SIS-owned, read only) |
| E-016 | Overrides | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Grant override waiving capacity/prereq/time conflict/credit limit/approval/late add, with reason; holds not waivable |
| E-017 | Enrollment queue | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/components/enrollment/StudentRegistration.tsx` | Requests waiting for approval list with approve/deny and reason, per term (registrar_decide) |
| E-018 | Add/drop/withdrawal workflow | exists | `app/src/components/enrollment/StudentRegistration.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql`<br>`app/src/lib/enrollment/client.ts` | Two-step enroll, drop (no W) and withdraw (records W) by phase; idempotent, stale-seat check |
| E-019 | Registration audit | partial | `supabase/migrations/20260929300000_registration_transaction.sql` | registration_audit_event table with registrar read policy written on every change; no screen in app reads it |
| E-020 | Academic record search | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts`<br>`app/src/lib/record/api.ts` | Find student record by school identifier, view as of any date, open entry history |
| E-021 | Record correction queue | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts` | Propose a change with reason; Waiting for a decision queue; second person approves, overrides flagged |
| E-022 | Grade ledger | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts`<br>`supabase/migrations/20260929210000_academic_record_ledger.sql` | Append-only record ledger with grade kind, previous value, source, approver, effective date |
| E-023 | Grade change workflow | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts` | Grade/standing/conferral corrections are registrar overrides needing record:override approver other than proposer |
| E-024 | Regrade resolution | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/components/gradebook/StudentGrades.tsx`<br>`supabase/migrations/20260929310000_gradebook.sql` | Student files regrade; instructor resolves (changed/unchanged) in gradebook; instructor-side, not registrar queue |
| E-025 | Degree audit rules | partial | `app/src/lib/degree.ts`<br>`app/src/screens/Degree.tsx` | Audit arithmetic exists but over student-entered requirements; no registrar rule authoring (Degree.tsx says ships no requirements) |
| E-026 | Program requirements | partial | `app/src/screens/Degree.tsx`<br>`app/src/lib/record/ledger.ts` | Student copies own requirements; ledger has requirement kind; no registrar-maintained program requirement definitions |
| E-027 | Transfer evaluation | partial | `app/src/lib/record/ledger.ts`<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql`<br>`app/src/lib/transferhub.ts` | transfer_evaluations table and transfer_credit ledger kind; no evaluation screen (transferhub.ts says no screen) |
| E-028 | Articulation rules | partial | `supabase/migrations/20260926150000_expansion_roles_and_features.sql`<br>`app/src/lib/transferhub.ts` | articulation_rules table + capabilities + RLS only; no UI (searched app/src for non-test use) |
| E-029 | Graduation review | partial | `app/src/components/GraduationSimulator.tsx`<br>`app/src/lib/graduation.ts`<br>`app/src/lib/record/ledger.ts` | Student-side graduation simulator and conferral ledger kind; no registrar graduation clearance/review queue |
| E-030 | Credential conferral | partial | `app/src/lib/record/ledger.ts`<br>`app/src/components/institutional/RecordLedger.tsx` | Degree conferral recordable via ledger (conferral kind, override-approved); no credential issuance or conferral batch workflow |
| E-031 | Transcript/export workflow | partial | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts` | Record-as-of-date CSV export headed Not an official transcript; no transcript request/issue workflow |
| E-032 | SIS reconciliation | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/migration/center.ts` | Migration Center reconcile (missing/extra/differing) and sync-run reconciliation_state; no ongoing registrar SIS discrepancy screen |
| E-033 | Migration dashboard | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Migration Center: staged projects, mapping, preview, validation, reconciliation, cutover approvals |
| E-034 | Data-quality exceptions | partial | `app/src/lib/migration/exceptions.ts`<br>`app/scripts/institution-migration.ts` | Exception queue state machine in lib and CLI script only; no UI screen mounts it |
| E-035 | Registrar settings | partial | `app/src/components/institutional/ConfigurationStudio.tsx`<br>`app/src/lib/config/studio.ts` | Configuration Studio has academic_structure/workflows settings, but says nothing in app reads them yet |

### F · Student accounts, aid & commerce

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| F-001 | Account summary | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx`<br>`app/src/lib/finance/mine.ts` | Student sees balance today, aging, hold line, next due, entries (MyStudentAccount on Bill) |
| F-002 | Charges | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx`<br>`app/src/lib/finance/accounts.ts` | Posted charges listed from ledger; Bill also tracks own charges by kind |
| F-003 | Credits | exists | `app/src/screens/Bill.tsx`<br>`app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/accounts.ts` | Aid/credit entries (scholarship, waiver, discount, adjustment credit) listed and netted in balance |
| F-004 | Balance | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts`<br>`app/src/lib/finance/accounts.ts` | Balance today, aging buckets, later-dated amounts shown separately |
| F-005 | Payment plan | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/plans.ts`<br>`supabase/migrations/20260929230000_student_payment_plans.sql` | Student requests plan, sees DB-computed schedule, staff approval, standing paid/late/due |
| F-006 | Installments | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx`<br>`app/src/lib/finance/accounts.ts` | Instalment schedule with paid/late/due/upcoming state; Bill splits balance exactly |
| F-007 | Due dates | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx`<br>`app/src/lib/finance/accounts.ts` | Next due date and per-instalment due dates shown; overdue aging |
| F-008 | Holds | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`app/src/lib/finance/mine.ts` | Financial hold status derived from aging and settings, with plan keeping hold off, said on screen |
| F-009 | Statements | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/accounts.ts` | Per-period statement selection with opening/closing and CSV download; receipts per payment |
| F-010 | Payment provider handoff | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx` | Pay on your school page link opened new tab; app never takes card or money by design |
| F-011 | Refund status | partial | `app/src/lib/finance/accounts.ts`<br>`app/src/lib/finance/mine.ts`<br>`app/src/components/MyStudentAccount.tsx` | Refund entries post to ledger and credit balance sentence; no refund request status tracker for student |
| F-012 | Scholarship view | exists | `app/src/screens/Bill.tsx`<br>`app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/accounts.ts` | Aid group lists awards incl. pending; ledger aid_credit categories scholarship/waiver/discount/sponsorship |
| F-013 | Financial-aid handoff | exists | `app/src/lib/offices.ts`<br>`app/src/screens/Launchpad.tsx`<br>`app/src/data/campus.ts` | OfficeDoor to Financial Aid office link; Launchpad aid-accept step; decisions stay with the office |
| F-014 | Budget planner | partial | `app/src/screens/Costs.tsx`<br>`app/src/lib/cost.ts` | Out-of-pocket term spend tracker with totals; no budget targets or monthly budgeting |
| F-015 | Cost planner | exists | `app/src/components/CostPlanner.tsx`<br>`app/src/lib/cost-plan.ts`<br>`app/src/components/GraduationSimulator.tsx` | Line-by-line term cost planner with source labels, feeding graduation simulator |
| F-016 | Emergency aid resources | exists | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx` | Emergency grants and loans directory entry routed to Dean of Students; also basic-needs navigator |
| F-017 | Financial support request | partial | `app/src/lib/help-routes.ts`<br>`app/src/lib/support.ts` | Money needs routed to official office as directory only by design; no in-app request submitted or stored |
| F-018 | Staff: Account queue | partial | `app/src/components/institutional/StudentAccounts.tsx` | Staff look up an account by student ID; no list/queue of accounts (only request and plan queues) |
| F-019 | Staff: Request queue | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Waiting for a decision queue; high-value and barred-approver rules shown; approve/reject |
| F-020 | Staff: Charge/credit request | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Make a request form: charge/payment/refund/adjustment/reversal/aid credit; approved by someone else |
| F-021 | Staff: Reconciliation | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Reconcile month against provider settlement file read in browser; ledger side computed by DB |
| F-022 | Staff: Month close | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Close a month only after passed reconciliation by different person; closed month takes nothing new |
| F-023 | Staff: Payment plan review | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`supabase/migrations/20260929230000_student_payment_plans.sql` | Payment plans waiting queue: approve/reject with note; requester cannot decide own |
| F-024 | Staff: Hold management | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Hold status shown from rule (overdue days, minimum); no place/release or threshold editing UI |
| F-025 | Staff: Refund review | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Refund requests tie to payment, cannot exceed it, high-value approver, payment approver barred; no dedicated screen |
| F-026 | Staff: Dunning | missing | — | Searched dunning in app/src, StudentAccounts, student_accounts migration: only Semester own-subscription dunning exists |
| F-027 | Staff: Dispute queue | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Chargeback request kind recorded against a payment; no dispute case queue or evidence workflow |
| F-028 | Staff: Audit ledger | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Append-only signed entries and audit trigger; UI shows account entries and statement, no audit-event viewer |
| F-029 | Staff: Reporting | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts` | Per-account aging, statement and receipt CSV; no cross-account or school-wide finance reports |

### G · Campus life

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| G-001 | Dining locations | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/locations.ts` | Dining screen lists school dining locations with open/closed state, behind module.dining flag |
| G-002 | Dining hours | exists | `app/src/lib/dining/locations.ts`<br>`app/src/screens/Dining.tsx` | openAt() and hoursLine() render weekly hours with source/freshness label |
| G-003 | Menus | exists | `app/src/lib/dining/locations.ts`<br>`app/src/screens/Dining.tsx` | menuToday() lists today's menu items per location, swipe eligibility shown |
| G-004 | Meal plan | exists | `app/src/screens/Meals.tsx`<br>`app/src/screens/Dining.tsx` | Meal plan screen (swipes pace, plan planner) and Dining plan summary; CBORD handoff |
| G-005 | Meal balance | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/client.ts` | Balances (swipes, dining dollars, campus cash) via loadBalances/balanceFigures |
| G-006 | Mobile order | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/orders.ts` | placeOrder/cancelOrder with status flow; staff Counter.tsx advances orders |
| G-007 | Donation/pool program | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/sharing.ts` | donateSwipes to shared pool with consent text; pool summary on counter |
| G-008 | Housing assignment | exists | `app/src/screens/Housing.tsx`<br>`app/src/lib/housing.ts` | My housing: hall/room/move-out entered by student, move-out countdown; no live feed |
| G-009 | Housing requests | partial | `app/src/components/CampusDirectory.tsx`<br>`app/src/screens/Housing.tsx` | Application plan is a private draft; no submit/track of housing requests |
| G-010 | Maintenance | missing | — | Searched maintenance, work order, repair request in app/src, supabase, packages: no feature |
| G-011 | Roommate resources | missing | — | Searched roommate in app/src screens/components/lib: only nav keywords and StarRez link note |
| G-012 | Housing handoff | exists | `app/src/screens/Housing.tsx`<br>`app/src/data/campus.ts` | Link out to StarRez portal (editable address) from Housing screen |
| G-013 | Campus calendar | partial | `app/src/screens/Activities.tsx`<br>`app/src/components/CampusDirectory.tsx` | Events tab lists school-imported JSON directory only; no live campus feed |
| G-014 | Event detail | partial | `app/src/components/CampusDirectory.tsx`<br>`app/src/lib/campusdirectory.ts` | Event card shows when/where/details; no dedicated event detail page |
| G-015 | Event registration | missing | — | Searched register/rsvp in CampusDirectory, community/, screens: no event registration (connect.ts roadmap text only) |
| G-016 | Personal schedule | exists | `app/src/screens/Calendar.tsx`<br>`app/src/screens/Activities.tsx` | Calendar plus Activities My week combine classes and commitments |
| G-017 | Organization directory | exists | `app/src/screens/Activities.tsx`<br>`app/src/components/CampusDirectory.tsx` | Clubs & organizations directory with search/filter/save; school-imported data |
| G-018 | Organization profile | partial | `app/src/components/CampusDirectory.tsx`<br>`app/src/lib/campusdirectory.ts` | Directory card with description/contact/details; no dedicated org profile page |
| G-019 | Membership | partial | `app/src/screens/Activities.tsx`<br>`app/src/lib/activities.ts` | Student logs own club commitments; no join/membership with the organization |
| G-020 | Organization events | partial | `app/src/screens/Activities.tsx`<br>`app/src/components/CampusDirectory.tsx` | Events directory and My week; events not linked to an organization |
| G-021 | Leadership tools | missing | — | Searched officer/leadership tools in screens, components, lib/activities: only Support pointer to running an org |
| G-022 | Study space availability | exists | `app/src/components/RoomsNow.tsx`<br>`app/src/lib/room-availability.ts` | Rooms free now/later from school space_availability sync, with freshness; Support Campus tab |
| G-023 | Study space booking | partial | `app/src/lib/room-availability.ts`<br>`app/src/components/RoomsNow.tsx` | Shows school booking URL only; writeback.space_booking not built |
| G-024 | Location details | exists | `app/src/screens/Maps.tsx`<br>`app/src/lib/nav.ts` | Maps screen: buildings, places search and hierarchy |
| G-025 | Transit and parking | partial | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx` | Shuttles/transit/parking only a pointer entry to the transit office; no schedules or permits |
| G-026 | Recreation | partial | `app/src/screens/Athletics.tsx`<br>`app/src/lib/support.ts` | Athletics schedule tracker plus recreation pointer; no rec facility hours/booking |
| G-027 | Library | partial | `app/src/data/campus.ts`<br>`app/src/lib/support.ts` | Library link and room entries; no library search or account |
| G-028 | Bookstore | partial | `app/src/data/campus.ts`<br>`app/src/screens/Costs.tsx` | Bookstore links and textbook cost tracking; no bookstore catalog |
| G-029 | Campus jobs | partial | `app/src/screens/Opportunities.tsx`<br>`app/src/lib/opportunities.ts` | Campus job tracker with stages/checklist; no job listings or apply |
| G-030 | Volunteer opportunities | partial | `app/src/lib/activities.ts`<br>`app/src/screens/Activities.tsx` | Service/volunteering commitment tracker; no volunteer listings |
| G-031 | Local services | missing | — | Searched local services/off-campus/nearby businesses in app/src: nothing |
| G-032 | Safety resources | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Support Right now tab: campus public safety, alerts, escalation routes with privacy labels |
| G-033 | Wellness resources | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Support Care tab: counseling, health, peer support, basic needs with confidentiality labels |
| G-034 | Accessibility resources | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Support Access tab: accommodations, materials, assistive tech, report a barrier |
| G-035 | Emergency official handoff | exists | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx` | 911, 988, campus safety call entries on Support Right now tab |

### H · Community & moderation

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| H-001 | Community directory | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | "At your school" list of communities by kind and verification, with Join |
| H-002 | Community feed | exists | `app/src/screens/Community.tsx`<br>`app/src/community/feedview.ts` | Per-community post feed with For you/Newest order and why-seeing-this |
| H-003 | Post creation | exists | `app/src/components/community/Composer.tsx`<br>`app/src/screens/Community.tsx` | Composer with alias, image, edit/delete own posts |
| H-004 | Comments/reactions | missing | — | Searched comment/reply/reaction in community/, screens/Community.tsx: none; migration says no reactions table by design |
| H-005 | Alias/pseudonym settings | exists | `app/src/components/community/AliasPanel.tsx`<br>`app/src/community/alias.ts` | Per-community pseudonym panel, behind school switch |
| H-006 | Community membership | exists | `app/src/screens/Community.tsx`<br>`app/src/community/communities.ts` | joinCommunity/leaveCommunity with roles and posting rules |
| H-007 | Community events | partial | `app/src/screens/Community.tsx`<br>`app/src/components/community/Sessions.tsx` | Event community kind exists; sessions only in course/study-group spaces; no RSVP |
| H-008 | Study sessions | exists | `app/src/components/community/Sessions.tsx`<br>`app/src/community/communities.ts` | Create/join/leave study sessions at approved venues with capacity cap |
| H-009 | Peer connections | exists | `app/src/screens/Classmates.tsx`<br>`app/src/community/connect.ts` | Classmates rooms per course, block/leave; consent-based, no open DMs |
| H-010 | Study groups | exists | `app/src/screens/Community.tsx`<br>`app/src/screens/Groupwork.tsx` | Start a study group community; Groupwork for project teams |
| H-011 | Peer mentor directory | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts` | Mentor offers matched on interests, shown in Launchpad/Opportunities |
| H-012 | Mentor requests | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts` | askMentor/answerRequest: mentee asks, mentor accepts |
| H-013 | Organization communities | partial | `app/src/screens/Community.tsx`<br>`app/src/community/communities.ts` | student_organization community kind with verification; no org-specific hub |
| H-014 | Community guidelines | missing | — | Searched guidelines/code of conduct in screens, components, community/: no page; doc only: docs/CAMPUS-MODERATION-SOP.md |
| H-015 | Report content | exists | `app/src/components/community/ReportSheet.tsx`<br>`app/src/community/moderation.ts` | Report form with 9 categories, imminent flag, crisis notice first |
| H-016 | Appeal decision | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | NoticeList shows decision, appeal button, pending/granted/upheld status |
| H-017 | Community safety resources | partial | `app/src/community/crisis.ts`<br>`app/src/components/community/ReportSheet.tsx` | CRISIS_NOTICE on report form and console; no resource list in Community itself |
| H-018 | Community settings | partial | `app/src/screens/Community.tsx`<br>`app/src/community/feedview.ts` | Feed order prefs, mute/block author, leave; no consolidated community settings screen |
| H-019 | Mod: Reports queue | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts` | Console queue, severity-then-age, open cases; reporters hidden |
| H-020 | Mod: Cases | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/moderation.ts` | CaseCard with severity, route, protection, detectors, decision actions |
| H-021 | Mod: Content review | exists | `app/src/screens/Moderation.tsx`<br>`app/src/components/community/PostImage.tsx` | Reviewer sees post, media, category, details and decides with reason code |
| H-022 | Mod: Escalations | exists | `app/src/components/community/Escalation.tsx`<br>`app/src/screens/Moderation.tsx` | Two-reviewer escalation to universities for P0/P1; waiting/decided lists |
| H-023 | Mod: Appeals | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts` | Appeals section with decideAppeal, by different reviewer |
| H-024 | Mod: Restriction actions | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/moderation.ts` | ACTIONS: remove, rate limit, community/account restriction with durations |
| H-025 | Mod: Audit trail | partial | `supabase/migrations/20260924223000_moderation_audit.sql`<br>`app/src/screens/Volunteers.tsx` | DB audit table and volunteer event log; no moderator audit-trail viewer |
| H-026 | Mod: Volunteer review tasks | exists | `app/src/screens/Volunteer.tsx`<br>`app/src/community/volunteer.ts` | Volunteer moderation: apply, attest, next tasks, decide with standing |
| H-027 | Mod: Calibration tasks | exists | `app/src/screens/Volunteers.tsx`<br>`app/src/community/volunteer.ts` | Calibration/practice cases: add, retire, shortfall warnings, quality line |
| H-028 | Mod: Policy configuration | partial | `app/src/screens/Agreements.tsx`<br>`app/src/screens/Volunteers.tsx` | Escalation agreements and school programme switches; no general policy editor |
| H-029 | Mod: Analytics | missing | — | Searched moderation analytics/metrics/stats in screens/Moderation, community/, components: none (register text only) |

### I · Family & guardian

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| I-001 | Invitation acceptance | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyinvites.ts` | ClaimFamilyCode: signed-in guardian enters 8-char code and accepts |
| I-002 | Relationship confirmation | partial | `app/src/lib/family.ts`<br>`app/src/components/FamilyInvite.tsx` | Relationship typed by student; guardian does not confirm it |
| I-003 | Consent scope | exists | `app/src/screens/Family.tsx`<br>`app/src/lib/family.ts` | Per-person category permissions, selected items only, exact preview |
| I-004 | Shared categories | exists | `app/src/lib/family.ts`<br>`app/src/screens/Family.tsx` | FAMILY_CATEGORIES with hand-selected items per category |
| I-005 | Time-limited access | exists | `app/src/lib/family.ts`<br>`app/src/components/FamilyInvite.tsx` | Plan end date, grant 1-200 days, code lapses in 7 days (migration) |
| I-006 | Shared items | exists | `app/src/components/SharedWithYou.tsx`<br>`app/src/screens/Family.tsx` | Recipient sees exactly the confirmed items shared by each student |
| I-007 | Billing/support handoff | partial | `app/src/screens/Family.tsx`<br>`app/src/lib/family.ts` | Payment-only preview and support-request items; no real payment/support handoff |
| I-008 | Resource center | missing | — | Searched family/parent/guardian resources in app/src screens, components, site: none; doc only: docs/FAMILY_REQUIREMENTS.md |
| I-009 | Communication preferences | missing | — | Searched notification/communication preference for family in lib/family*.ts, Family.tsx: none |
| I-010 | Access history | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyshare.ts` | readLog lists times recipient opened what was shared, no content |
| I-011 | Revocation | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyshare.ts` | revokeInvite and stopSharing; recipient sees revoked and expired identically |
| I-012 | Privacy/support information | partial | `app/src/screens/Family.tsx`<br>`app/src/components/SharedWithYou.tsx` | Student-side explainers only; no guardian-facing privacy/support page |

### J · Career, employer, alumni

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| J-001 | Skills graph | exists | `app/src/components/SkillsGraph.tsx`<br>`app/src/lib/skills-graph.ts`<br>`app/src/screens/Career.tsx` | Evidence-backed skill claims drawn in Career 'Skills & fit' tab |
| J-002 | Skill evidence | exists | `app/src/components/CareerEvidence.tsx`<br>`app/src/lib/career-evidence.ts` | Evidence, metrics, bullets, artifacts kept per student in Career Evidence tab |
| J-003 | Verified skill claims | partial | `app/src/lib/skills-graph.ts`<br>`app/src/lib/learnerrecord.ts` | Verification states and CLR export exist; no live institution verification source |
| J-004 | Credential wallet | exists | `app/src/components/CredentialWallet.tsx`<br>`app/src/lib/credential-wallet.ts` | Wallet of confirmed skills/artifacts with selective JSON export |
| J-005 | Portfolio | exists | `app/src/components/CareerEvidence.tsx`<br>`app/src/screens/Career.tsx` | Artifacts plus 'Build portfolio evidence draft'; no public portfolio page |
| J-006 | Resume builder | exists | `app/src/screens/Career.tsx`<br>`app/src/lib/career.ts`<br>`app/src/lib/career-evidence.ts` | Resume tab with templates, readout, markdown/document export |
| J-007 | Cover letter workspace | exists | `app/src/lib/career.ts`<br>`app/src/screens/Career.tsx` | coverLetter() drafts from recorded experience, written to a document |
| J-008 | Interview preparation | exists | `app/src/components/CareerEvidence.tsx`<br>`app/src/screens/Career.tsx` | interviewCards and 'Create interview practice' from a real opportunity |
| J-009 | Career plan | partial | `app/src/screens/Career.tsx`<br>`app/src/lib/career.ts` | Target roles/locations and tracker only; no structured career plan or goals |
| J-010 | Opportunity search | exists | `app/src/screens/Career.tsx`<br>`app/src/screens/Opportunities.tsx` | Search/filter over saved listings with target ordering; not a live feed |
| J-011 | Job postings | partial | `app/src/screens/Opportunities.tsx`<br>`app/src/lib/opportunities.ts`<br>`app/server/institution/career.ts` | Student-entered jobs; employer posting only in sandbox gateway, no live feed |
| J-012 | Internship postings | partial | `app/src/screens/Career.tsx`<br>`app/src/lib/career.ts`<br>`app/server/institution/career.ts` | Student-saved internships; sandbox listings only, no live postings |
| J-013 | Employer profiles | partial | `app/src/lib/career-evidence.ts`<br>`app/server/institution/sandbox.ts` | Fair-employer notes and sandbox Employer record; no employer profile page |
| J-014 | Applications | exists | `app/src/screens/Applying.tsx`<br>`app/src/lib/apply.ts`<br>`app/src/components/Applying.tsx` | Application tracker with stages, next action, deadlines on Today |
| J-015 | Career appointments | partial | `app/src/screens/Career.tsx`<br>`app/server/institution/advising.ts` | Appointment prep templates; booking only via sandbox advising adapter |
| J-016 | Mentor directory | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts`<br>`app/src/screens/Opportunities.tsx` | Alumni/peer mentor finder and requests; needs school roster |
| J-017 | Alumni mentor offers | partial | `app/src/lib/mentors.ts`<br>`app/src/components/MentorFinder.tsx`<br>`supabase/migrations/20260928021700_mentor_rosters.sql` | Student asks offers; no UI for alumni to publish offers (DB only) |
| J-018 | Networking | exists | `app/src/screens/Career.tsx`<br>`app/src/lib/career.ts` | Contacts tab with permission status and outreach drafts |
| J-019 | Career events | exists | `app/src/screens/Career.tsx`<br>`app/src/lib/career.ts` | Fairs tab: add/track career events and fair employers; not a live events feed |
| J-020 | Continuing education | partial | `app/src/lib/opportunities.ts`<br>`app/src/screens/Opportunities.tsx` | Certificate/short-course tracker steps only; no catalog or alumni offering |
| J-021 | Microcredentials | partial | `app/src/lib/opportunities.ts`<br>`app/src/components/CredentialWallet.tsx` | Certificate/badge kind tracked; no issuance or Open Badges import |
| J-022 | Credential renewal | missing | — | Searched renew/expir in opportunities, career, credential-wallet; no renewal tracking |
| J-023 | Career outcome history | missing | — | Searched outcome/first destination/post-graduation in app/src, server, docs; none implemented |
| J-024 | Employer: Organization profile | partial | `app/src/components/institutional/role-workspace.ts`<br>`app/server/institution/sandbox.ts` | Employer role preview and sandbox Employer record; no profile editor |
| J-025 | Employer: Opportunity creation | partial | `app/src/components/institutional/RoleWorkspace.tsx`<br>`app/server/institution/career.ts` | Local 'opportunity draft' and sandbox listings; no real posting UI |
| J-026 | Employer: Applicant criteria | missing | — | Searched criteria/requirements in server/institution/career.ts, role-workspace; no applicant criteria |
| J-027 | Employer: Talent discovery | missing | — | Searched talent/discovery/candidate in app/src, server; only a capability label in role-workspace.ts |
| J-028 | Employer: Consent-based profile | partial | `app/src/components/institutional/role-workspace.ts`<br>`app/src/data/institutional-preview.ts` | candidate-consent:read capability label only; no profile sharing flow |
| J-029 | Employer: Interview scheduling | missing | — | Searched interview scheduling in server/institution/career.ts, advising.ts, supabase; none for employers |
| J-030 | Employer: Hiring workflow | partial | `app/server/institution/career.ts`<br>`app/server/institution/sandbox.ts` | Sandbox shortlist/offer/pass with offer-cap; labelled demo, no employer UI |
| J-031 | Employer: Internship management | partial | `app/server/institution/career.ts`<br>`app/server/institution/sandbox.ts` | Sandbox internship listings, openings, close; no employer-facing screen |
| J-032 | Employer: Analytics | missing | — | Searched employer analytics/funnel in app/src, server; none |
| J-033 | Employer: Partnership settings | missing | — | Searched partnership/employer settings in app/src, server, supabase; none |
| J-034 | Alumni: Profile | partial | `app/src/components/institutional/RoleWorkspace.tsx`<br>`app/src/components/institutional/role-workspace.ts` | Alumni role workspace drafts a mentorship profile locally; no stored profile |
| J-035 | Alumni: Mentoring offers | partial | `supabase/migrations/20260928021700_mentor_rosters.sql`<br>`app/server/institution/advising.ts` | alumni_mentor_offers table and sandbox alumni adapter; no alumni publishing UI |
| J-036 | Alumni: Opportunities | missing | — | Searched alumni opportunities/job posting by alumni in app/src, server; none |
| J-037 | Alumni: Continuing education | missing | — | Searched alumni continuing education in app/src, server; only Pathway checklist items |
| J-038 | Alumni: Community | partial | `app/src/community/communities.ts`<br>`app/src/screens/Community.tsx` | career_alumni community kind policy; no alumni network screen |
| J-039 | Alumni: Donations/engagement handoff | missing | — | Planned only: app/src/lib/advancement/edition.ts says no giving or handoff built |
| J-040 | Alumni: Credential history | partial | `app/src/lib/learnerrecord.ts`<br>`app/src/components/CredentialWallet.tsx` | CLR export and wallet export; no alumni credential history view |

### K · Institutional administration

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| K-001 | Tenant overview | partial | `app/src/screens/University.tsx`<br>`app/src/components/console/Customers.tsx`<br>`app/src/components/console/CommandCenter.tsx` | Services/standing overview and operator tenant list; no single tenant dashboard |
| K-002 | Institution profile | partial | `app/src/lib/config/studio.ts`<br>`app/src/lib/school.ts` | Branding/display name via Configuration Studio; no dedicated profile screen |
| K-003 | Campus hierarchy | partial | `app/src/lib/governance/hierarchy.ts`<br>`supabase/migrations/20260927235000_governance_registries.sql` | governance_policy_nodes schema and rules; no admin UI |
| K-004 | School/department/program structure | partial | `app/src/lib/governance/hierarchy.ts`<br>`supabase/migrations/20260927235000_governance_registries.sql` | Policy node tiers system..course in code and DB; no editor |
| K-005 | Identity providers | partial | `app/src/components/Credentials.tsx`<br>`supabase/migrations/20260924150142_institution_identity_provisioning.sql`<br>`app/src/lib/cloud.ts` | SSO sign-in and identity binding exist; no IdP admin screen |
| K-006 | SSO configuration | partial | `supabase/migrations/20260928011845_tenant_sso_policy.sql`<br>`app/src/lib/cloud.ts` | tenant_sso_policy and institutionSsoConfig; no admin configuration UI |
| K-007 | SCIM provisioning | partial | `app/server/institution/scim.ts`<br>`app/server/institution/scim-route.ts`<br>`app/server/institution/postgres-scim.ts` | Gateway SCIM v2 endpoint (flag-gated); no admin screen |
| K-008 | Memberships | exists | `app/src/components/SchoolClaim.tsx`<br>`app/src/lib/schoolclaim.ts` | Request, withdraw, leave and admin approve/decline of school membership |
| K-009 | Roles | partial | `supabase/migrations/20260921161500_roles.sql`<br>`app/src/lib/capabilities.ts` | Roles in DB and read client-side; no role management UI |
| K-010 | Capabilities | partial | `supabase/migrations/20260922012000_capabilities.sql`<br>`app/src/lib/capabilities.ts` | Capability catalog and my_capabilities read; no admin catalog view |
| K-011 | Role grants | partial | `supabase/migrations/20260921223000_role_grants.sql`<br>`supabase/migrations/20260924213000_role_grant_audit.sql` | Grants and audit in DB; no grant/revoke screen |
| K-012 | Access reviews | missing | — | Searched access review/recertification in supabase, app/src; only break-glass review in console/BreakGlass.tsx |
| K-013 | Tenant plan | partial | `supabase/migrations/20260928004730_tenant_plan.sql`<br>`supabase/functions/_shared/ltientitlement.ts` | tenant_plan table read by entitlement; no plan screen |
| K-014 | Entitlements | partial | `supabase/functions/_shared/entitlement.ts`<br>`docs/ENTITLEMENT-RESOLUTION.md` | Entitlement resolution on LTI launch; no admin entitlements view |
| K-015 | Feature policies | partial | `app/src/lib/featurepolicy.ts`<br>`supabase/migrations/20260929370000_feature_policy_narrowing.sql` | Narrowing read by gates; no admin editor |
| K-016 | Feature cohorts | partial | `supabase/migrations/20260929340000_feature_cohorts.sql`<br>`app/src/lib/featurepolicy.ts` | Cohort tables and gate; no cohort management UI |
| K-017 | Kill switches | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/migrations/20260927170000_integration_control_plane.sql` | Engaged switches shown read-only; no toggle UI |
| K-018 | Module modes | exists | `app/src/components/institutional/ModulesPanel.tsx`<br>`app/src/lib/modulemode.ts` | Connect/Core mode per module with two-admin approval |
| K-019 | Tenant rollout | partial | `supabase/migrations/20260928050000_tenant_rollout.sql`<br>`app/src/lib/governance/rollout.ts` | Rollout schema and rules; no rollout screen |
| K-020 | Configuration studio | exists | `app/src/components/institutional/ConfigurationStudio.tsx`<br>`app/src/lib/config/studio.ts` | Versioned settings, second-person publish |
| K-021 | Workflow builder | exists | `app/src/components/institutional/WorkflowBuilder.tsx`<br>`supabase/migrations/20260930231000_workflow_builder.sql` | Steps, student-facing preview, versions, second-person publish |
| K-022 | Policy hierarchy | partial | `app/src/lib/governance/hierarchy.ts`<br>`app/src/components/institutional/PolicySimulator.tsx` | Hierarchy rules and policy simulator; no hierarchy editor |
| K-023 | Governance stewards | partial | `supabase/migrations/20260927235000_governance_registries.sql`<br>`app/src/lib/governance/charters.ts` | governance_steward_assignments table; no UI |
| K-024 | Governance decisions | partial | `supabase/migrations/20260927235000_governance_registries.sql`<br>`app/src/lib/governance/scorecard.ts` | governance_decisions table and scoring rules; no UI |
| K-025 | Integration control | exists | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/migrations/20260927170000_integration_control_plane.sql` | Connections, mappings, sync history, conflicts, dead letters |
| K-026 | Data classification | partial | `app/src/components/institutional/StandardsAudit.tsx`<br>`app/src/lib/trust/education-data-map.ts`<br>`app/server/institution/ai-data-class.ts` | Education data map with class labels; no tenant classification editor |
| K-027 | Consent policy | partial | `app/src/lib/trust/ferpa-consent.ts`<br>`supabase/migrations/20260928110700_consent_and_moderation_narrowing.sql` | Consent rules in code/DB; no tenant consent policy screen |
| K-028 | Retention policy | partial | `app/src/components/institutional/PolicySimulator.tsx`<br>`supabase/migrations/20260929030000_retention_sweeps.sql` | Retention sweeps and clock simulator; no policy editor |
| K-029 | Legal holds | partial | `supabase/migrations/20260930100000_legal_holds.sql`<br>`supabase/migrations/20260930130000_hold_gated_sweeps.sql` | Holds with two-person release enforced in DB; no UI |
| K-030 | Privacy requests | partial | `app/src/components/DataRightsRequests.tsx`<br>`supabase/migrations/20261004200000_answer_data_subject_requests.sql` | Student intake UI; admin answer/verify functions have no queue UI |
| K-031 | AI provider policy | partial | `app/src/lib/config/studio.ts`<br>`supabase/migrations/20260923210000_intelligence_policy.sql`<br>`app/server/institution/intelligence-repository.ts` | AI enable/mode/actions via studio and tenant policy tables; no provider screen |
| K-032 | Approved sources | partial | `supabase/migrations/20261001185348_approved_source_policy_scope.sql`<br>`app/server/institution/intelligence-repository.ts` | approved_source table and gateway binding; no approval UI |
| K-033 | Trust Center | exists | `app/src/components/institutional/TrustDashboard.tsx`<br>`app/src/screens/TrustRoom.tsx` | Institution Trust tab plus procurement trust room with signed docs |
| K-034 | Compliance controls | exists | `app/src/components/institutional/StandardsAudit.tsx`<br>`app/src/components/console/StandardsCrosswalk.tsx`<br>`app/src/lib/trust/standards-audit.ts` | Control matrix, 1EdTech/NIST readiness, RFP and evidence export |
| K-035 | Evidence register | exists | `app/src/components/console/Evidence.tsx`<br>`app/src/components/institutional/OperationsStudio.tsx`<br>`app/src/lib/ops/evidence.ts` | Evidence with owner, expiry and freshness states |
| K-036 | Accessibility program | partial | `app/src/site/pages.tsx`<br>`app/src/a11y` | Public accessibility statement and a11y contract tests; no program tracker |
| K-037 | Incident notices | partial | `app/src/components/StatusNotice.tsx`<br>`app/src/lib/governance/incident-comms.ts`<br>`supabase/migrations/20260927235000_governance_registries.sql` | Status notices shown; notice record rules in DB; no compose UI |
| K-038 | Risk register | partial | `app/src/lib/governance/risk.ts` | Risk register as code data with controls; no screen |
| K-039 | Audit explorer | exists | `app/src/components/console/Audit.tsx`<br>`supabase/migrations/20260929100000_console_control_plane.sql` | Searchable audit chain with status; operator console, platform scope |
| K-040 | Offboarding | partial | `supabase/migrations/20260930200000_school_offboarding.sql` | Staged offboarding procedure in DB; no UI |
| K-041 | Data export/portability | partial | `app/src/screens/Export.tsx`<br>`supabase/migrations/20260929010000_account_erasure_and_export.sql` | Student account export; tenant export manifest only in offboarding DB |

### L · Integrations

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| L-001 | Provider directory | partial | `app/src/site/benchmark.tsx`<br>`app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/catalog.ts` | Public standards registry + per-domain provider map; no browsable staff provider catalogue |
| L-002 | Connection list | exists | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Connections tab table: provider, status, mode, freshness, scopes, errors, owner, approval |
| L-003 | Connection setup | partial | `app/src/screens/Connect.tsx`<br>`app/src/screens/University.tsx` | Student account/calendar/LMS connect flow; no staff connection-setup wizard (gateway deployed by school) |
| L-004 | Security review | missing | — | No security-review screen/flow found (grep security review in app/src, server, migrations); only threat-model docs |
| L-005 | Scope approval | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/migrations/20260927170000_integration_control_plane.sql` | integration_approve_scope/connection RPCs exist; dashboard shows scopes read-only, no approval UI |
| L-006 | Credentials configuration | partial | `app/src/lib/integration/vault.ts`<br>`app/src/lib/integration/provider-client.ts` | Vault pointer broker + credentials_reference; dashboard deliberately has no credential config UI |
| L-007 | Mapping studio | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Migration field-mapping editor + read-only mappings tab; no live-connection mapping studio |
| L-008 | Mapping versions | partial | `app/src/lib/integration/mapping-versions.ts`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Propose/approve/rollback logic exists but unwired; UI only shows version column |
| L-009 | Field transformations | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/integration/adapter.ts` | Bounded transform picker in migration mapping; none/trim/lower/iso only, no standalone screen |
| L-010 | Sync schedule | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/functions/integration-tick/index.ts` | Cadence/freshness target shown read-only; cron tick exists; no schedule editor |
| L-011 | Sync run history | exists | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Sync history tab: last 50 runs with counts, retries, reconciliation state |
| L-012 | Sync errors | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Open errors counted per connection and grouped by category; no per-error list/detail |
| L-013 | Dead-letter queue | exists | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Dead letters list (reason, attempts, replay state) in Conflicts tab |
| L-014 | Replay request | exists | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/migrations/20260927170000_integration_control_plane.sql` | Request replay with reason + confirm via integration_request_replay RPC |
| L-015 | Reconciliation dashboard | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/integration/reconcile.ts` | Migration reconciliation stage + run column; integration reconcile.ts has no dashboard |
| L-016 | Schema drift dashboard | partial | `app/src/lib/integration/drift.ts`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Drift detection logic only, unwired; no dashboard (conflict kinds shown only) |
| L-017 | Duplicate resolution | partial | `app/src/lib/integration/duplicates.ts`<br>`app/src/components/institutional/MigrationCenter.tsx` | Dedupe/merge logic + migration duplicate-rule choice; no resolution screen |
| L-018 | Source owner management | partial | `app/src/components/institutional/IntegrationDashboard.tsx` | Owner shown as Assigned/Unassigned read-only; no owner assignment UI |
| L-019 | Data freshness | exists | `app/src/lib/integration/freshness.ts`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Freshness per connection/domain with word+glyph; also student SchoolRecords |
| L-020 | Integration analytics | partial | `app/src/components/institutional/IntegrationDashboard.tsx` | Health summary export + counts/last sync/errors; no trend analytics |
| L-021 | Webhook events | partial | `app/src/lib/integration/webhook-ingress.ts`<br>`app/src/components/institutional/OperationsStudio.tsx` | Event names listed + verifier lib unwired; no events viewer or ingress function |
| L-022 | LTI configuration | partial | `supabase/functions/lti/index.ts`<br>`app/src/screens/Connect.tsx` | LTI 1.3 launch endpoint + student landing; platform registration via SQL, no admin config UI |
| L-023 | OneRoster import | partial | `supabase/migrations/20260930220000_roster_import_staging.sql` | Staging/validate/promote DB foundation only; no import UI or OneRoster client |
| L-024 | OneRoster REST sync | missing | — | Searched oneroster in app/src, server, packages, supabase: only staging foundation; "no OneRoster client" |
| L-025 | Edu-API configuration | missing | — | Searched edu-api/eduapi in app, packages, supabase: only registers/docs mentions, no config |
| L-026 | Google/Microsoft integration | exists | `app/src/screens/Connect.tsx`<br>`app/src/lib/connect.ts`<br>`supabase/functions/calendar/index.ts` | OAuth sign-in, calendar pull/push, files for Google/Microsoft 365 in Connect |
| L-027 | AI provider integration | partial | `app/src/screens/Connect.tsx`<br>`app/src/lib/assistant.ts`<br>`app/server/institution/providers/openai.ts` | Student key/model setup + gateway OpenAI adapter; no school-level AI provider admin screen |
| L-028 | Integration offboarding | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/trust/exitplans.ts` | Pause/resume + disconnect status; offboarding plans in lib/docs only, no wizard |

### M · Trust, privacy, security

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| M-001 | Trust: Security overview | exists | `app/src/site/pages.tsx`<br>`company-site/site.js` | Public /security page + Trust Center security page with in-place/not-done lists |
| M-002 | Trust: Privacy overview | exists | `app/src/site/pages.tsx`<br>`app/src/screens/Privacy.tsx`<br>`company-site/site.js` | Public /privacy page, in-app Privacy screen, Trust Center privacy page |
| M-003 | Trust: Accessibility statement | exists | `app/src/site/pages.tsx`<br>`company-site/index.html` | Public /accessibility page and accessibility evidence/known-issues pages |
| M-004 | Trust: Responsible AI | exists | `app/src/site/benchmark.tsx`<br>`company-site/site.js` | Data & AI Transparency page + Trust Center AI governance page |
| M-005 | Trust: Data practices | exists | `app/src/site/benchmark.tsx`<br>`app/src/lib/transparency.ts` | Data & AI Transparency page: categories, sources, access, retention |
| M-006 | Trust: Retention/deletion | exists | `company-site/site.js`<br>`app/src/site/benchmark.tsx` | Trust Center data-retention page and retention/deletion section on transparency page |
| M-007 | Trust: Subprocessors | exists | `company-site/site.js`<br>`app/src/lib/trust/subprocessors.ts` | Public subprocessor page from product register, held by test |
| M-008 | Trust: Status | exists | `app/public/status.html`<br>`app/public/status-incidents.json`<br>`company-site/index.html` | Browser-side status page + incident feed; no uptime history (stated) |
| M-009 | Trust: Compliance roadmap | exists | `company-site/index.html`<br>`app/src/site/pages.tsx` | Frameworks/standards-we-plan-against table, roadmap and Are-we-ready pages |
| M-010 | Trust: HECVAT readiness | exists | `company-site/index.html`<br>`app/src/components/institutional/StandardsAudit.tsx` | HECVAT readiness simulator + release rules; RFP/evidence export |
| M-011 | Trust: DPA process | partial | `company-site/index.html`<br>`supabase/functions/lead-intake/index.ts` | DPA requested via procurement form; DPA itself draft/not in force |
| M-012 | Trust: Questionnaire request | exists | `company-site/index.html`<br>`supabase/functions/lead-intake/index.ts` | Questionnaire answer library + Request a response pack form (lead-intake) |
| M-013 | Trust: Trust room request | exists | `company-site/index.html`<br>`app/src/screens/TrustRoom.tsx`<br>`supabase/functions/trust-room/index.ts` | Procurement request form + reviewer trust room via expiring link |
| M-014 | Trust: Vulnerability disclosure | exists | `app/public/.well-known/security.txt`<br>`app/src/site/pages.tsx`<br>`company-site/site.js` | security.txt, Security page and responsible-disclosure page |
| M-015 | Sec: Overview | partial | `app/src/screens/Console.tsx`<br>`app/src/components/console/CommandCenter.tsx` | Ops console command center (release-gate exceptions); not a security-specific overview |
| M-016 | Sec: Asset inventory | missing | — | Searched asset inventory in app, supabase, docs: doc only: docs/trust/ASSET-INVENTORY.md |
| M-017 | Sec: Access review | partial | `app/src/components/console/Approvals.tsx`<br>`app/src/lib/ops/console.ts` | Role-grant approvals duty + audit; periodic access review is SQL check, no screen |
| M-018 | Sec: Secret inventory | missing | — | Searched secret inventory/register in app, supabase: doc only: SECRETS.md |
| M-019 | Sec: Vulnerability management | partial | `.github/workflows/codeql.yml`<br>`.github/workflows/hawkscan.yml`<br>`SECURITY.md` | CI scanning + policy; no vulnerability management screen |
| M-020 | Sec: Dependency findings | partial | `.github/dependabot.yml`<br>`.github/workflows/supply-chain.yml`<br>`.github/workflows/codeql.yml` | Dependabot/supply-chain CI findings; no in-app findings screen |
| M-021 | Sec: Alerts | partial | `app/src/components/console/CommandCenter.tsx`<br>`supabase/migrations/20260930173030_console_command_center.sql` | Live exception queue (release gates only); no security alert feed |
| M-022 | Sec: Threat models | missing | — | Searched threat model in app/src, supabase: doc only: docs/trust/THREAT-MODEL.md |
| M-023 | Sec: Incident queue | partial | `app/src/components/StatusNotice.tsx`<br>`app/src/components/institutional/TrustDashboard.tsx` | Public incident feed shown; no internal incident queue |
| M-024 | Sec: Incident command center | partial | `app/src/lib/ops/incidentplaybooks.ts` | Incident playbook register in code/docs only; no command-center screen |
| M-025 | Sec: Controls | exists | `app/src/components/console/StandardsCrosswalk.tsx`<br>`app/src/components/institutional/StandardsAudit.tsx` | Control crosswalk (NIST 800-53/1EdTech) in console Evidence and trust audit matrix |
| M-026 | Sec: Control evidence | exists | `app/src/components/console/Evidence.tsx`<br>`app/src/lib/ops/evidence.ts` | Evidence register view with expiry, escalation step and claims |
| M-027 | Sec: Pen-test evidence | missing | — | Searched pen-test/pentest: none done; doc only: docs/trust/PENETRATION-TEST-PLAN.md |
| M-028 | Sec: Vendor risk | missing | — | Searched vendor risk in app/src, supabase: doc only: docs/trust/VENDOR-RISK-REGISTER.md |
| M-029 | Sec: Exceptions | partial | `app/src/components/console/CommandCenter.tsx` | Operational exception queue; no security policy-exception register |
| M-030 | Sec: Audit log | exists | `app/src/components/console/Audit.tsx`<br>`app/src/screens/Console.tsx` | Audit chain status and recent events; reads are themselves audited |
| M-031 | Sec: Break-glass review | exists | `app/src/components/console/BreakGlass.tsx`<br>`app/src/screens/Console.tsx` | Open grants with ticket/expiry; close and review as a second person |
| M-032 | Sec: Backup/restore evidence | partial | `app/src/lib/ops/evidence.ts`<br>`supabase/migrations/20260930173030_console_command_center.sql` | Restore rehearsal records + production_restore release gate; no dedicated screen |
| M-033 | Sec: Disaster recovery | partial | `company-site/site.js`<br>`RESTORE.md` | Public business-continuity page + restore runbook; no internal DR screen |
| M-034 | Sec: Reporting | partial | `app/src/components/console/Figures.tsx`<br>`app/src/components/institutional/StandardsAudit.tsx` | Figures with provenance + evidence/RFP exports; no security report builder |
| M-035 | Priv: Data inventory | partial | `app/src/screens/Data.tsx`<br>`app/src/lib/inventory.ts`<br>`app/src/site/benchmark.tsx` | Per-user record inventory + public category table; no institutional inventory screen |
| M-036 | Priv: Data map | exists | `app/src/components/institutional/StandardsAudit.tsx`<br>`app/src/lib/trust/education-data-map.ts` | Education data map (entity, class, purpose, AI boundary) in institution Trust tab |
| M-037 | Priv: Classification rules | partial | `app/src/lib/integration/classification.ts`<br>`app/src/components/institutional/StandardsAudit.tsx` | Classification tiers enforced in code and shown in data map; no rules editor |
| M-038 | Priv: Retention schedule | partial | `RETENTION.md`<br>`app/src/site/benchmark.tsx`<br>`app/src/lib/config/studio.ts` | Schedule doc + public statement + after-exit setting; no schedule management screen |
| M-039 | Priv: Deletion runs | partial | `supabase/migrations/20261001170000_integration_governance_writes.sql`<br>`app/src/community/client.ts` | DB sweeps; only community last-sweep shown; no deletion-runs screen |
| M-040 | Priv: Legal holds | partial | `supabase/migrations/20260930100000_legal_holds.sql` | legal_holds table + place/release capabilities enforced; no UI |
| M-041 | Priv: Data subject requests | partial | `app/src/components/DataRightsRequests.tsx`<br>`app/src/lib/data-rights.ts`<br>`supabase/migrations/20261004200000_answer_data_subject_requests.sql` | Student intake/tracking UI + answer RPC; no steward queue screen |
| M-042 | Priv: Export requests | exists | `app/src/screens/Privacy.tsx`<br>`supabase/migrations/20260930000000_audit_and_subject_requests.sql` | Download my account data (export_my_data) plus tracked export requests |
| M-043 | Priv: Erasure requests | exists | `app/src/screens/Privacy.tsx`<br>`supabase/functions/delete-account/index.ts` | Delete my account + assisted erasure request; legal-hold aware |
| M-044 | Priv: Consent records | partial | `app/src/components/SchoolRecords.tsx`<br>`app/src/lib/integration/school-records.ts` | Student sees and revokes integration consents; no consent-records admin/ledger |
| M-045 | Priv: Subprocessor records | partial | `app/src/lib/trust/subprocessors.ts`<br>`company-site/site.js` | Register + public list kept in sync by test; no internal records screen |
| M-046 | Priv: Incidents | partial | `supabase/migrations/20260927235000_governance_registries.sql`<br>`app/src/components/StatusNotice.tsx` | governance_incident_notices table + public incident feed; no privacy incident screen |
| M-047 | Priv: Impact assessments | partial | `app/src/lib/governance/pia.ts` | PIA template/register in code, rendered to doc; no screen |
| M-048 | Priv: Reporting | missing | — | Searched privacy report(ing) in app/src, console: none; only generic Figures and trust scorecard |

### N · Operations Command Center (/ops)

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| N-001 | Executive Overview | partial | `app/src/screens/Console.tsx`<br>`app/src/components/console/CommandCenter.tsx`<br>`app/src/components/console/Figures.tsx` | Console opens on Command center + Figures; no exec KPI overview page (company-operations-console.md: manual snapshots only) |
| N-002 | Operations Inbox | partial | `app/src/components/console/CommandCenter.tsx`<br>`app/src/lib/console/client.ts` | Live exception queue with owner, next step, source; no inbox triage (assign/snooze/acknowledge) actions |
| N-003 | My Work | missing | — | no per-operator task view; searched "my work", "assigned to me" in components/console and Console.tsx; Approvals flags mine only |
| N-004 | Approvals | exists | `app/src/components/console/Approvals.tsx`<br>`app/src/screens/Console.tsx`<br>`app/src/lib/console/client.ts` | Console Approvals tab: raise, decide, act; duties matrix, two-person, MFA gate, production notice |
| N-005 | Approval request detail | exists | `app/src/components/console/Approvals.tsx` | Per-request card shows status, evidence required, decisions, requester, expiry; inline, no separate route |
| N-006 | Tenant Directory | partial | `app/src/components/console/Customers.tsx`<br>`app/src/lib/ops/console.ts` | Customers list is tenant-keyed with scope-to-tenant; no directory of all tenants/schools (tenant_rollout has no list UI) |
| N-007 | Tenant 360 | partial | `app/src/components/console/Customers.tsx`<br>`app/src/screens/Console.tsx` | Customer card per tenant: commitments, contracts, why-visible; no health/billing/support/pilot rollup, scope button only |
| N-008 | Customer Directory | exists | `app/src/components/console/Customers.tsx`<br>`app/src/lib/console/client.ts` | Console Customers view via console_customers RPC with filter, classification and access-basis fields |
| N-009 | Customer 360 | partial | `app/src/components/console/Customers.tsx` | Customer record with commitments and contracts only; no pilot, billing, health, support or integration panels |
| N-010 | GTM Pipeline | partial | `app/src/lib/gtm/stages.ts`<br>`supabase/migrations/20260928090000_gtm_foundation.sql`<br>`docs/business/sales/CRM_PIPELINE_DEFINITION.md` | 16 sales stages + gtm_accounts table + CRM doc; no pipeline board screen in console |
| N-011 | Accounts | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/gtm/stages.ts` | gtm_accounts table and stage model exist; no accounts list UI in console |
| N-012 | Stakeholders | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/gtm/pilot.ts` | gtm_stakeholders table and buying-committee rules in pilot.ts; no stakeholder UI |
| N-013 | Decision log | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/ops/decisionlog.ts`<br>`docs/DECISION-LOG.md` | gtm_decision_log table + repo decision log; no in-console decision log view |
| N-014 | Pilot Workspace | partial | `supabase/migrations/20260929140000_gtm_pilot_26_weeks.sql`<br>`app/src/lib/gtm/pilot.ts`<br>`supabase/migrations/20260928090000_gtm_foundation.sql` | gtm_pilots 26-week schema and pilot rules; no pilot workspace screen |
| N-015 | Pilot metrics | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/gtm/kpi.ts` | gtm_pilot_metrics table + KPI definitions; no metrics screen |
| N-016 | Pilot outcomes | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`docs/business/templates/FINAL_VALUE_REPORT.md` | gtm_pilot_outcomes table + final value report template; no outcomes UI |
| N-017 | Implementation projects | partial | `supabase/migrations/20260929070000_commercial_core.sql` | implementation_projects table (commercial core) only; no console view |
| N-018 | Implementation milestones | partial | `supabase/migrations/20260929070000_commercial_core.sql` | implementation_milestones table only; no console view |
| N-019 | Success plans | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`docs/business/customer-success/PILOT_SUCCESS_PLAN.md` | success_plans table + plan doc; no console view |
| N-020 | QBRs | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`docs/business/templates/QBR_TEMPLATE.md` | qbrs table + QBR template doc; no console view |
| N-021 | Renewals | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`docs/business/customer-success/RENEWAL_AND_EXPANSION_PLAYBOOK.md` | renewal_opportunities table + playbook doc; no console view |
| N-022 | Account health | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`docs/business/customer-success/CUSTOMER_HEALTH_SCORE.md` | account_health_snapshots + compute_account_health cron + score doc; no console view |
| N-023 | Revenue operations | partial | `docs/operations/company-operations-console.md`<br>`app/src/finance/FinancialModel.tsx`<br>`supabase/migrations/20260929070000_commercial_core.sql` | Revenue ops = schema + finance funnel model; doc says no connected CRM/billing view yet |
| N-024 | Products | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/lib/membership.ts` | commercial_products table; student side reads prices; no operator products screen |
| N-025 | Plans | partial | `supabase/migrations/20260929070000_commercial_core.sql` | commercial_plans table only; no operator plans UI |
| N-026 | Prices | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/lib/membership.ts` | commercial_prices table read by membership.ts; no operator price UI |
| N-027 | Quotes | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/lib/governance/deal-desk.ts` | quotes/quote_lines tables + deal-desk rules; no quotes UI |
| N-028 | Contracts | partial | `app/src/components/console/Customers.tsx`<br>`supabase/migrations/20260929070000_commercial_core.sql` | Customers view lists contracts read-only (customer_contract); contracts table has no workflow UI |
| N-029 | Subscriptions | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/components/MembershipPanel.tsx` | subscriptions table; student-side MembershipPanel only; no operator view |
| N-030 | Entitlements | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`docs/ENTITLEMENT-RESOLUTION.md` | entitlement_definitions/plan_entitlements tables; no operator entitlements UI |
| N-031 | Invoices | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`supabase/migrations/20261003083000_billing_tax_integrity.sql` | invoices/invoice_lines tables and billing integrity SQL; no invoice UI |
| N-032 | Payments | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`supabase/functions/billing-webhook/index.ts` | payment_events table fed by billing-webhook; no payments UI (read by nobody via API) |
| N-033 | Refunds/credits | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/lib/ops/console.ts` | credits_refunds table + refund approval duty in duties matrix; no refunds screen |
| N-034 | Dunning | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`supabase/migrations/20261003083000_billing_tax_integrity.sql` | dunning_cases/dunning_actions tables; no dunning UI |
| N-035 | Cancellations | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`supabase/functions/billing-cancel/index.ts`<br>`app/src/components/MembershipPanel.tsx` | Self-serve cancellation + cancellation_requests table; no staff cancellations queue |
| N-036 | Support operations | partial | `app/src/components/console/SupportQueue.tsx`<br>`app/src/screens/Console.tsx` | Console Support tab (queue, thread, reply, status) when flag+grant; no SLA/ops metrics overview |
| N-037 | Ticket queue | exists | `app/src/components/console/SupportQueue.tsx`<br>`app/src/components/console/supportqueue.test.tsx` | Support queue lists tickets with category, status, priority and filter |
| N-038 | Ticket detail | exists | `app/src/components/console/SupportQueue.tsx` | Ticket conversation view with student-approved context, reply and status change |
| N-039 | Escalations | partial | `app/src/screens/Moderation.tsx`<br>`app/src/components/community/Escalation.tsx` | Only community-safety escalation exists; no support-ticket escalation path or queue |
| N-040 | Support notifications | partial | `supabase/functions/support-reply-notify/index.ts`<br>`supabase/migrations/20261002003000_support_notification_outbox.sql` | Notification outbox + sender exist; no operator notifications view |
| N-041 | Product operations | partial | `docs/FEATURE-FLAG-REGISTRY.md`<br>`supabase/migrations/20260929340000_feature_cohorts.sql`<br>`supabase/migrations/20260928220000_private_beta.sql` | Flags, cohorts, beta back ends exist; no product-ops console hub |
| N-042 | Feature flags | partial | `app/src/lib/experience-flags.ts`<br>`docs/FEATURE-FLAG-REGISTRY.md` | Build-time experience flags + registry doc; no operator flag toggling UI |
| N-043 | Cohorts | partial | `supabase/migrations/20260929340000_feature_cohorts.sql`<br>`supabase/feature_cohorts.check.sql` | feature_cohorts schema + SQL check; no cohort management UI |
| N-044 | Beta programs | partial | `supabase/migrations/20260928220000_private_beta.sql`<br>`app/src/components/BetaPanel.tsx`<br>`app/src/lib/beta.ts` | Beta schema + member-side BetaPanel; no operator program management |
| N-045 | Beta feedback | partial | `app/src/components/BetaPanel.tsx`<br>`app/src/lib/beta.ts` | Members can send feedback; no operator triage screen (beta:triage capability only) |
| N-046 | Known issues | partial | `app/src/lib/beta.ts`<br>`app/src/components/KnownLimitations.tsx` | Known issues shown to members/help; no operator known-issues editor |
| N-047 | Release evidence | partial | `app/src/components/console/CommandCenter.tsx`<br>`app/src/components/console/Evidence.tsx`<br>`app/src/lib/console/client.ts` | Release gates from platform_release_evidence appear as exceptions; no per-release evidence browser |
| N-048 | Rollouts | partial | `supabase/migrations/20260928050000_tenant_rollout.sql`<br>`app/src/lib/governance/rollout.ts`<br>`app/src/components/institutional/ModulesPanel.tsx` | tenant_rollout state machine + school Modules tab; no company rollouts board |
| N-049 | Integrations | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/components/console/CommandCenter.tsx` | School-staff IntegrationDashboard (map, connections, runs); not a company-wide integrations view |
| N-050 | Sync health | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Per-school sync runs/freshness health; no cross-tenant sync health in console |
| N-051 | Errors/dead letters | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/dashboard.ts` | Conflicts and replay requests per school; no company-wide dead-letter queue |
| N-052 | Trust/compliance | partial | `app/src/components/console/Evidence.tsx`<br>`app/src/components/console/StandardsCrosswalk.tsx`<br>`app/src/lib/ops/trustcontrols.ts` | Evidence + standards crosswalk tabs; no unified trust/compliance overview |
| N-053 | Trust artifacts | partial | `app/src/components/TrustCenter.tsx`<br>`supabase/migrations/20260928100000_trust_room.sql`<br>`app/src/lib/ops/evidence.ts` | Trust artifacts as evidence register + trust-room docs; no artifact management screen |
| N-054 | Trust room | partial | `app/src/screens/TrustRoom.tsx`<br>`supabase/functions/trust-room/index.ts`<br>`supabase/migrations/20260928100000_trust_room.sql` | Reviewer-side room (#room= link) built; no operator UI to issue or withdraw grants |
| N-055 | Compliance frameworks | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/components/console/StandardsCrosswalk.tsx` | compliance_frameworks table; 1EdTech/NIST crosswalk view only; no framework manager |
| N-056 | Controls | exists | `app/src/components/console/StandardsCrosswalk.tsx`<br>`app/src/lib/ops/trustcontrols.ts` | Searchable control mappings with status, owner, purpose, evidence needed (read-only) in Evidence tab |
| N-057 | Evidence | exists | `app/src/components/console/Evidence.tsx`<br>`app/src/lib/ops/evidence.ts`<br>`app/src/screens/Console.tsx` | Evidence tab: each record with expiry, escalation step, claims resting on it |
| N-058 | Claims register | partial | `app/src/lib/ops/claims.ts`<br>`ops/claims/README.md`<br>`app/src/site/claims.tsx` | Claims register as data rendered to docs and public site; no console view |
| N-059 | Content register | partial | `supabase/migrations/20260929070000_commercial_core.sql`<br>`app/src/lib/gtm/copyregister.test.ts` | content_register table + copy register tests; no console view |
| N-060 | Privacy | partial | `app/src/lib/ops/console.ts`<br>`app/src/screens/Privacy.tsx`<br>`ops/operations-console/README.md` | Data classes defined and student Privacy screen exist; no operator privacy console |
| N-061 | Data requests | partial | `app/src/components/DataRightsRequests.tsx`<br>`app/src/lib/data-rights.ts`<br>`supabase/migrations/20260930000000_audit_and_subject_requests.sql` | Students file requests; subject_requests schema; no staff fulfilment queue in console |
| N-062 | Retention | partial | `supabase/migrations/20260929030000_retention_sweeps.sql`<br>`RETENTION.md`<br>`supabase/scheduler.sql` | Retention sweeps run by cron; no retention management UI |
| N-063 | Legal holds | partial | `supabase/migrations/20260930100000_legal_holds.sql`<br>`supabase/migrations/20260930130000_hold_gated_sweeps.sql` | legal_holds schema; sweeps and erasure honour holds; no console UI to place or release |
| N-064 | Security | partial | `app/src/components/console/BreakGlass.tsx`<br>`app/src/components/console/Audit.tsx`<br>`app/src/components/console/ContextBar.tsx` | Security controls scattered (MFA gate, break-glass, audit); no Security overview page |
| N-065 | Access review | missing | — | no access review/attestation tables or UI; searched access_review, attestation in app/src, supabase/migrations; no screen |
| N-066 | Break-glass | exists | `app/src/components/console/BreakGlass.tsx`<br>`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`<br>`app/src/lib/console/client.ts` | Break-glass tab: open grants, close, review; 4h cap, two-person approval, audited |
| N-067 | Incidents | partial | `supabase/migrations/20260927235000_governance_registries.sql`<br>`app/src/lib/governance/incident-comms.ts`<br>`app/src/components/StatusNotice.tsx` | Incident notices table + comms rules + public status feed; no incident management console |
| N-068 | SLOs | partial | `app/src/lib/sre/catalog.ts`<br>`app/src/lib/sre/scorecard.ts` | SLO catalog as pure TS; no SLI data source, tables or screen |
| N-069 | Error budgets | partial | `app/src/lib/governance/error-budgets.ts`<br>`app/src/lib/sre/burn-alerts.ts` | Budget and burn-rate logic as pure TS; no data feed or screen |
| N-070 | Audit explorer | exists | `app/src/components/console/Audit.tsx`<br>`app/src/lib/console/client.ts`<br>`supabase/migrations/20260929100000_console_control_plane.sql` | Audit tab: hash-chain status, newest-first events, filter; reads themselves audited |
| N-071 | Risk register | partial | `app/src/lib/governance/risk.ts`<br>`app/src/lib/ops/riskreview.ts`<br>`docs/business/templates/RISK_REGISTER.md` | Risk register as code data + review rules + template; no console view |
| N-072 | Vendor management | missing | — | no vendor mgmt UI/tables; searched vendor, subprocessor in app/src, supabase/migrations; doc only: docs/SUBPROCESSORS.md |
| N-073 | Finance dashboard | partial | `app/src/finance/FinancialModel.tsx`<br>`docs/finance/dashboard.html` | Finance dashboard tiles (ARR, runway, margin, CAC) on forecast data only; no actuals or billing feed |
| N-074 | Financial model | exists | `app/src/finance/FinancialModel.tsx`<br>`app/src/finance/financialModelEngine.ts`<br>`app/src/finance/financialModelFields.ts` | Console Finance model tab: 36-month driver engine, validated assumptions, exports, tests |
| N-075 | Forecast scenarios | exists | `app/src/finance/financialModelScenarios.ts`<br>`app/src/finance/FinancialModel.tsx` | Twelve named scenarios, comparison table and sensitivity view in Finance model |
| N-076 | Cash/runway | exists | `app/src/finance/FinancialModel.tsx`<br>`app/src/finance/financialModelEngine.ts` | Cash and runway view: billings, collections, ending cash, runway, funding need (forecast) |
| N-077 | Company KPI dashboard | partial | `app/src/components/console/Figures.tsx`<br>`app/src/lib/gtm/kpi.ts`<br>`app/src/finance/FinancialModel.tsx` | Figures (platform health with provenance) + KPI defs; no company KPI dashboard with actuals |
| N-078 | Operating review reports | partial | `app/src/finance/financialModelExports.ts`<br>`docs/business/templates/WEEKLY_REVENUE_REVIEW.md` | Markdown/CSV model exports + review template; no operating review report builder |
| N-079 | Board/investor reports | partial | `app/src/finance/financialModelExports.ts`<br>`docs/business/reports/BOARD_INVESTOR_SUMMARY.md`<br>`app/scripts/generate-gtm-pdf.mjs` | boardSummary export + board PDF build; forecast-only, no actuals reporting screen |
| N-080 | People/capacity plan | partial | `app/src/finance/financialModelFields.ts`<br>`docs/finance/12-GATED-HIRING-SCHEDULE.md`<br>`app/src/finance/FinancialModel.tsx` | Headcount inputs and delivery-capacity hours in model; no people/capacity planning screen |
| N-081 | Operator preferences | partial | `app/src/components/console/Views.tsx`<br>`app/src/lib/console/client.ts`<br>`supabase/migrations/20260929100000_console_control_plane.sql` | operator_preference stores saved views and last tab only; no wider preferences screen |

## Workflow steps

### Student journey

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Student journey#1 | Create account | exists | `app/src/lib/cloud.ts`<br>`app/src/screens/Account.tsx` | signUp via Supabase auth on Account screen |
| Student journey#2 | Join institution | exists | `app/src/components/SchoolClaim.tsx`<br>`app/src/lib/schoolclaim.ts`<br>`app/src/screens/Account.tsx` | claim_school RPC, join request/approve/leave in Account |
| Student journey#3 | Confirm identity | partial | `app/src/components/SchoolClaim.tsx`<br>`app/src/lib/schoolclaim.ts` | Server-confirmed email claim and approval; no institutional-IT identity review UI |
| Student journey#4 | Connect SSO | exists | `app/src/components/Credentials.tsx`<br>`app/src/lib/cloud.ts` | signInWithSSO by institution domain on sign-in form |
| Student journey#5 | Complete onboarding | exists | `app/src/screens/Onboarding.tsx`<br>`app/src/screens/FirstRun.tsx` | Multi-step onboarding screen |
| Student journey#6 | Select program/path | exists | `app/src/components/PathProfileForm.tsx`<br>`app/src/lib/path-profile.ts` | Programme/target term/goals form saved on device |
| Student journey#7 | Import or review course context | exists | `app/src/screens/Import.tsx`<br>`app/src/screens/Update.tsx`<br>`app/src/screens/EditCourse.tsx` | Add a course from syllabus; add readings; edit course |
| Student journey#8 | Review Today | exists | `app/src/screens/Today.tsx`<br>`app/src/components/TodayDecisionSurface.tsx` | Today screen with decision surface |
| Student journey#9 | Create action/task | exists | `app/src/composition/taskactions.ts`<br>`app/src/components/QuickAdd.tsx`<br>`app/src/components/ActionCenter.tsx` | QuickAdd creates tasks; Action Center ranks actions |
| Student journey#10 | Complete first meaningful action | exists | `app/src/components/ActionCenter.tsx`<br>`app/src/composition/taskactions.ts` | Mark done/snooze/dismiss on actions; toggle task |
| Student journey#11 | Build term plan | exists | `app/src/components/RegistrationPortal.tsx`<br>`app/src/components/GoalPlan.tsx` | Cart and saved potential schedules; goal plan; planning only |
| Student journey#12 | Compare courses/sections | exists | `app/src/components/CourseCompare.tsx`<br>`app/src/components/RegistrationPortal.tsx` | Side-by-side compare up to 3 sections with conflict checks |
| Student journey#13 | Review registration readiness | exists | `app/src/components/RegistrationReadiness.tsx`<br>`app/src/components/PathSnapshotCard.tsx` | Readiness view over path, plan, advisor meeting; imported data not official |
| Student journey#14 | Resolve hold through official handoff | partial | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/components/MyStudentAccount.tsx` | Hold notice names office and link; no in-app handoff or tracking |
| Student journey#15 | Enroll or request registration | exists | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`app/src/screens/Registration.tsx` | Enroll/waitlist/drop RPCs; gated off per school by module flag |
| Student journey#16 | Build study plan | exists | `app/src/components/Plan.tsx`<br>`app/src/lib/sessions.ts` | Weekly study plan with sessions and missed-day rollover |
| Student journey#17 | Join course workspace | exists | `app/src/screens/Classmates.tsx`<br>`app/src/screens/Groupwork.tsx` | Join per-class room and project groups |
| Student journey#18 | Read course guidance | exists | `app/src/components/StudyStudio.tsx`<br>`app/src/lib/courserules.ts` | Instructor-published guidance shown to student in study studio |
| Student journey#19 | Follow course AI rules | exists | `app/src/components/StudyStudio.tsx`<br>`app/src/lib/courserules.ts`<br>`app/src/lib/toolkit/policy.ts` | studyGate blocks/discloses by course AI rules before generation |
| Student journey#20 | Use AI copilot | exists | `app/src/ai/Assistant.tsx`<br>`app/src/ai/Chat.tsx` | Ask Semester chat assistant |
| Student journey#21 | Search approved sources | partial | `app/src/components/StudyStudio.tsx`<br>`app/src/lib/courserules.ts` | Instructor packs feed study guides and do-not-use guard; no search over approved sources |
| Student journey#22 | Create notes | exists | `app/src/screens/Mine.tsx`<br>`app/src/screens/mine/Drive.tsx` | Personal screen holds own notes |
| Student journey#23 | Organize files | exists | `app/src/screens/mine/Drive.tsx`<br>`app/src/screens/files.test.tsx` | Files in Personal/Drive |
| Student journey#24 | Join study group | exists | `app/src/screens/Community.tsx`<br>`app/src/screens/Groupwork.tsx` | createStudyGroup and joinCommunity |
| Student journey#25 | Request peer mentor | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts`<br>`app/src/screens/Launchpad.tsx` | request_mentor RPC for peer mentors; accept/decline |
| Student journey#26 | Request advisor support | exists | `app/src/lib/help-routes.ts`<br>`app/src/components/HelpInbox.tsx`<br>`app/src/screens/University.tsx` | send_help_request to advisor destination with minimum context |
| Student journey#27 | Share with advisor | exists | `app/src/components/AdvisorMeeting.tsx`<br>`app/src/lib/advisor-shares.ts` | share_with_advisor with preview, expiry, revoke, read log |
| Student journey#28 | Share with family | exists | `app/src/screens/Family.tsx`<br>`app/src/components/FamilyInvite.tsx` | Family invite, scoped sharing, revoke |
| Student journey#29 | Review student account | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts`<br>`app/src/screens/Bill.tsx` | Student reads posted ledger, statement, aging, hold |
| Student journey#30 | Request payment plan | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts` | askForPlan RPC; Student Accounts decides |
| Student journey#31 | Find campus resource | exists | `app/src/screens/Support.tsx`<br>`app/src/screens/University.tsx`<br>`app/src/screens/Links.tsx` | Support and campus directory/links screens |
| Student journey#32 | Order dining | exists | `app/src/screens/Dining.tsx`<br>`app/src/components/dining/Counter.tsx` | placeOrder/cancelOrder in Dining |
| Student journey#33 | Join organization/event | partial | `app/src/screens/Community.tsx`<br>`app/src/components/ConnectHub.tsx`<br>`app/src/screens/Activities.tsx` | Join organization communities; no event RSVP found |
| Student journey#34 | Build portfolio | exists | `app/src/screens/Career.tsx` | Skills evidence portfolio index and resume versions |
| Student journey#35 | Search opportunity | exists | `app/src/screens/Opportunities.tsx`<br>`app/src/components/VerifiedListings.tsx` | Verified listings plus tracker |
| Student journey#36 | Apply for opportunity | partial | `app/src/screens/Opportunities.tsx`<br>`app/src/screens/Applying.tsx` | Tracks applications and drafts; no submission to employer in app |
| Student journey#37 | Export personal data | exists | `app/src/screens/Privacy.tsx`<br>`app/src/lib/cloud.ts`<br>`app/src/screens/Export.tsx` | exportAccount via export_my_data RPC |
| Student journey#38 | Adjust privacy/AI settings | exists | `app/src/screens/Privacy.tsx`<br>`app/src/screens/settings/Assistant.tsx` | Privacy screen and assistant settings |
| Student journey#39 | Request deletion/correction | partial | `app/src/screens/Privacy.tsx`<br>`app/src/lib/cloud.ts` | Self-serve account deletion; no correction request or privacy-office handoff |
| Student journey#40 | Transition to alumni | partial | `app/src/screens/Pathway.tsx`<br>`app/src/lib/mentors.ts` | Graduation and alumni milestones and alumni mentors; no role transition to alumni |

### Faculty course lifecycle

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Faculty course lifecycle#1 | Accept course assignment | missing | — | grep course assignment, department chair, teaching assignment in app/src, supabase/migrations: none |
| Faculty course lifecycle#2 | Configure course workspace | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | Course Studio publishes rules/guidance/packs only; no course shell |
| Faculty course lifecycle#3 | Publish syllabus | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | Only an optional syllabus link inside AI rules; no syllabus publishing |
| Faculty course lifecycle#4 | Publish learning objectives | missing | — | grep learning objective(s) in app/src: no authoring or publishing |
| Faculty course lifecycle#5 | Publish course guidance | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | publish_course_guidance with preview, confirm, versioning, withdraw |
| Faculty course lifecycle#6 | Publish course AI policy | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | publish_course_rules per-use states; students see them |
| Faculty course lifecycle#7 | Add approved resources | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts`<br>`app/src/lib/courserules.ts` | Packs of cited references with authority incl. do-not-use |
| Faculty course lifecycle#8 | Create assignment | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | gradebook_add_item creates graded item; no assignment instructions/dates |
| Faculty course lifecycle#9 | Create rubric | missing | — | grep rubric in app/src, gradebook migration: only grading scheme, no rubric builder |
| Faculty course lifecycle#10 | Create assessment | missing | — | lib/itembank.ts is pure rules wired to no screen; no assessment builder UI |
| Faculty course lifecycle#11 | Create study pack | exists | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | publish_study_pack RPC, retire, history |
| Faculty course lifecycle#12 | Manage roster | missing | — | roster_stage migration has no app reader; gradebook roster not client readable; no roster UI |
| Faculty course lifecycle#13 | Review student work | missing | — | grep submissions, student work review in app/src: none; gradebook shows scores only |
| Faculty course lifecycle#14 | Provide feedback | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/model.ts` | Per-grade comment on score entry only; no feedback workspace/TA |
| Faculty course lifecycle#15 | Enter grade | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | gradebook_enter versioned scores; draft until released |
| Faculty course lifecycle#16 | Moderate grade | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | gradebook_moderate by second instructor (grades:moderate) |
| Faculty course lifecycle#17 | Release grade | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | gradebook_release makes grades student-visible |
| Faculty course lifecycle#18 | Resolve regrade | exists | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/components/gradebook/StudentGrades.tsx`<br>`app/src/lib/gradebook/client.ts` | Student files regrade; instructor resolves |
| Faculty course lifecycle#19 | Hold office hours | missing | — | grep office hours hold/schedule by instructor: OfficeHours.tsx only displays hours to students |
| Faculty course lifecycle#20 | Communicate with class | partial | `app/src/components/CourseStudio.tsx`<br>`app/src/lib/coursestudio.ts` | Only one-way published guidance; no announcements or messaging to class |
| Faculty course lifecycle#21 | Review aggregate learning signals | missing | — | grep aggregate learning signals, analytics for faculty in app/src: none |
| Faculty course lifecycle#22 | Review course accessibility | missing | — | grep course accessibility review in app/src: none for courses |
| Faculty course lifecycle#23 | Export/archive | partial | `app/src/components/gradebook/InstructorBook.tsx`<br>`app/src/lib/gradebook/client.ts` | Released-grades CSV export; no course archive or registrar handoff |
| Faculty course lifecycle#24 | Grade passback (if approved) | partial | `app/src/lib/gradebook/passback.ts`<br>`app/src/lib/gradebook/client.ts`<br>`app/src/components/gradebook/InstructorBook.tsx` | queuePassback in UI; runPassback adapter not invoked outside tests |

### Advising & student success

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Advising & student success#1 | Receive caseload | missing | — | grep caseload, student_success, service_case in app/src, app/server, supabase: none; sandbox advising only |
| Advising & student success#2 | Review student path | partial | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-shares.ts` | Advisor reads only student-consented share snapshot; no caseload path view |
| Advising & student success#3 | Review action completion | partial | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-meeting.ts` | Only ticked actions in a consented share; no completion review |
| Advising & student success#4 | Schedule meeting | missing | — | Sandbox advising.ts only lets student book/cancel; no advisor scheduling path |
| Advising & student success#5 | Record check-in | missing | — | grep check-in, advisor notes in app/src, supabase: none (replaceregister notes no notes system) |
| Advising & student success#6 | Create success plan | missing | — | grep success plan, student_success in app/src, app/server, supabase: none |
| Advising & student success#7 | Refer to office | missing | — | grep refer to office, referral workflow: only growth referrals and student help requests |
| Advising & student success#8 | Track referral outcome | missing | — | grep referral outcome tracking: none |
| Advising & student success#9 | Send approved outreach | partial | `app/src/components/OfficeActionDesk.tsx`<br>`app/src/lib/office-actions.ts`<br>`app/src/lib/office-actions-remote.ts` | Office drafts, reviews, approves actions published to Action Center; not per-student outreach |
| Advising & student success#10 | Review support request | exists | `app/src/components/HelpInbox.tsx`<br>`app/src/lib/help-routes.ts`<br>`app/src/screens/University.tsx` | help_inbox, open_help_request, answer_help_request; academic_advisor responds |
| Advising & student success#11 | Review consented share | exists | `app/src/components/AdvisorSharedView.tsx`<br>`app/src/lib/advisor-shares.ts` | read_advisor_share logs read; student sees log; expiry/revoke |
| Advising & student success#12 | Escalate risk through approved process | missing | — | grep escalate risk, risk signals, risk_score: institution-ops lists risk scores as never built |
| Advising & student success#13 | Review cohort aggregates | partial | `app/src/components/institutional/OperationsStudio.tsx`<br>`app/src/lib/institution-ops.ts` | Typed aggregate counts with n>=floor suppression; no live cohort dashboard |
| Advising & student success#14 | Conduct term review | missing | — | grep term review, student_success in app/src: none |
| Advising & student success#15 | Prepare registration readiness outreach | partial | `app/src/components/OfficeActionDesk.tsx`<br>`app/src/components/institutional/CampaignManager.tsx` | Office actions and campaigns can reach cohorts; no registration-readiness outreach page |
| Advising & student success#16 | Review intervention effectiveness | missing | — | doc only: intervention metric defined in app/src/lib/institution-ops.ts; no tracker UI or data |
| Advising & student success#17 | Close or transition case | missing | — | grep close case, case transition, student_success: none |

### Registrar & academic operations

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Registrar & academic operations#1 | Create term | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Registrar:put_term form (opens, add/drop end, withdrawal end, credit cap); registrar:administer gated |
| Registrar & academic operations#2 | Configure academic calendar | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/config/studio.ts` | Term dates + calendar_kind setting only; no academic-calendar event/holiday editor (student-side Registrar screen is personal) |
| Registrar & academic operations#3 | Import/manage catalog | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/domain-specs.ts` | Sections added one at a time; Migration Center validates catalog sample but never loads a catalog; no bulk import |
| Registrar & academic operations#4 | Create sections | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | registrar_put_section form: course, section, meetings, credits, approval flag |
| Registrar & academic operations#5 | Assign capacity/waitlists | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Seats + waitlist places set per section; server keeps seats_taken/waiting and promotes waitlist |
| Registrar & academic operations#6 | Define prerequisites/co-requisites | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Prerequisite course codes per section; no co-requisite rule anywhere |
| Registrar & academic operations#7 | Publish registration windows | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Term opens_at/add-drop/withdraw dates are what students are checked against; registration_windows notice table unused |
| Registrar & academic operations#8 | Issue time tickets | partial | `supabase/migrations/20260926150000_expansion_roles_and_features.sql`<br>`app/src/lib/enrollment/model.ts` | registration_time_tickets is student-writable own copy; registrar cannot issue/stagger tickets; server enforces opening only |
| Registrar & academic operations#9 | Sync holds | partial | `supabase/migrations/20260929300000_registration_transaction.sql`<br>`app/src/lib/integration/school-records.ts`<br>`app/server/integration/registry.ts` | registration_holds table server-only; hold adapter framework exists but ADAPTERS empty and no registrar sync action |
| Registrar & academic operations#10 | Grant override | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | registrar_grant_override waives capacity/prereq/clash/credit/approval/late_add (not holds), with reason + audit |
| Registrar & academic operations#11 | Review enrollment attempt | exists | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Pending-approval enrollment requests listed with approve/deny + reason via registrar_decide |
| Registrar & academic operations#12 | Approve/deny exception | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Approve/deny exists for enrollment requests only; no data-quality exception queue (integration conflicts are read-only) |
| Registrar & academic operations#13 | Manage add/drop/withdrawal | partial | `app/src/components/enrollment/RegistrarDesk.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`supabase/migrations/20260929300000_registration_transaction.sql` | Registrar sets windows and grants late-add override; student drops/withdraws; no registrar-initiated drop on behalf |
| Registrar & academic operations#14 | Reconcile with SIS | partial | `app/src/lib/integration/reconcile.ts`<br>`app/src/components/institutional/IntegrationDashboard.tsx`<br>`supabase/migrations/20260928040000_integration_quality.sql` | Reconcile logic + run/discrepancy tables + read-only conflicts view; no live SIS adapter or registrar reconcile action |
| Registrar & academic operations#15 | Correct academic record | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts`<br>`supabase/migrations/20260929210000_academic_record_ledger.sql` | Propose/approve/override ledger changes by registrar (record:propose/approve/override), append-only history |
| Registrar & academic operations#16 | Manage grade changes | exists | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts`<br>`supabase/migrations/20260929210000_academic_record_ledger.sql` | Grade corrections via ledger (override needs record:override; source faculty/appeal); regrade flow in gradebook migration |
| Registrar & academic operations#17 | Run degree audit | partial | `app/src/screens/Degree.tsx`<br>`app/src/components/GraduationSimulator.tsx` | Student-side degree/graduation arithmetic only; registrar cannot run an audit (Degree.tsx says it is not the registrar audit) |
| Registrar & academic operations#18 | Evaluate transfer credit | partial | `app/src/lib/record/ledger.ts`<br>`app/src/components/institutional/RecordLedger.tsx` | transfer_credit kind recorded via ledger (source transfer_evaluation); no evaluation workflow or transfer-student view |
| Registrar & academic operations#19 | Review graduation | partial | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/components/GraduationSimulator.tsx` | Conferral recorded in ledger with override; no graduation review/checklist workflow for registrar or advisor |
| Registrar & academic operations#20 | Export official records | partial | `app/src/components/institutional/RecordLedger.tsx`<br>`app/src/lib/record/ledger.ts` | Per-student ledger CSV export as-of date; no bulk official export and no transcript issuance (ledger.ts says not done) |
| Registrar & academic operations#21 | Close-of-term audit | missing | — | no close-of-term audit; searched: close.?of.?term, term close, registrar audit, RegistrarDesk, CloseTerm (student-side only) |

### Institution implementation

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Institution implementation#1 | Contract signed | partial | `supabase/migrations/20260929080000_commercial_automation.sql`<br>`supabase/migrations/20261004090000_order_form_never_downgrades_plan.sql` | contracts.status=signed trigger applies tenant_plan; no UI/API flow to execute a contract |
| Institution implementation#2 | Tenant created | missing | — | no create-tenant function/UI; searched schools, create school, tenant provision (schools written by service role/migration only) |
| Institution implementation#3 | Executive sponsor named | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/gtm/stages.ts` | gtm_stakeholders has executive_sponsor role in DB; no screen, no Executive Overview |
| Institution implementation#4 | Operational champion named | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/gtm/stages.ts` | gtm_stakeholders has operational_owner/champion roles in DB; no screen to name one |
| Institution implementation#5 | Security/privacy scope confirmed | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/lib/integration/classification.ts` | integration_approve_scope RPC only (university_admin); no privacy-scope confirmation screen or Privacy requests tie-in |
| Institution implementation#6 | Data/integration inventory | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Migration Center source-inventory stage + Integration dashboard system map; no tenant-wide data inventory screen |
| Institution implementation#7 | SSO/identity configured | partial | `app/server/institution/auth.ts`<br>`app/server/institution/membership.ts`<br>`app/server/institution/scim-route.ts`<br>`supabase/migrations/20260924150142_institution_identity_provisioning.sql` | SAML/SCIM runtime built; IdP rows/SSO policy set in DB, no admin screen to configure |
| Institution implementation#8 | Tenant policy configured | exists | `app/src/components/institutional/ConfigurationStudio.tsx`<br>`app/src/lib/config/studio.ts`<br>`supabase/migrations/20260930230000_configuration_studio.sql` | Configuration Studio: versioned drafts per domain, publisher differs from drafter |
| Institution implementation#9 | Roles configured | partial | `app/src/components/institutional/ConfigurationStudio.tsx`<br>`app/src/lib/config/studio.ts` | Studio enabled_roles setting; role grants come via SCIM group mapping/DB, no school screen to assign roles |
| Institution implementation#10 | Feature cohorts configured | partial | `app/src/lib/flags.ts`<br>`app/src/components/institutional/ConfigurationStudio.tsx` | feature_cohort_members read-only in flags.ts; Studio sets only a pilot cohort label, no cohort membership editor |
| Institution implementation#11 | Data mapping approved | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/api.ts` | Migration field-map + cutover approvals by data_owner/registrar/IT; integration mapping approval not persisted |
| Institution implementation#12 | Sandbox sync tested | partial | `app/server/institution/sandbox.ts`<br>`app/src/lib/integration/contract-harness.ts` | Sandbox adapters and contract harness exist; no per-tenant sandbox sync run/record; ADAPTERS empty |
| Institution implementation#13 | Reconciliation passed | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Migration reconciliation run recorded and gated in Migration Center; not integration sync reconciliation |
| Institution implementation#14 | Admin training | missing | — | doc only: docs/institutional-implementation/TRAINING-PLAN-AND-ACADEMY.md; searched training, academy in app/src |
| Institution implementation#15 | Student communication prepared | partial | `app/src/components/institutional/CampaignManager.tsx`<br>`supabase/migrations/20260928090000_gtm_foundation.sql` | School campaign manager (reviewed before live) for enrollment/adoption comms; not a Semester-CSM launch-comms step |
| Institution implementation#16 | Launch readiness gate passed | partial | `supabase/migrations/20260928050000_tenant_rollout.sql`<br>`app/src/lib/launchreadiness.ts` | tenant_rollout evidence-gated lifecycle in DB (service role writes); launchreadiness.decide pure fn; no UI |
| Institution implementation#17 | Controlled launch | partial | `supabase/migrations/20260928050000_tenant_rollout.sql`<br>`app/src/components/institutional/ModulesPanel.tsx` | Rollout states in DB, not wired to feature_state; ModulesPanel module-mode request/approval is the usable control |
| Institution implementation#18 | Adoption monitored | partial | `app/src/components/console/Figures.tsx`<br>`app/src/components/institutional/CampaignManager.tsx` | Console figures + campaign report; no per-school adoption dashboard for customer success |
| Institution implementation#19 | Support and incident path live | partial | `app/src/components/console/SupportQueue.tsx`<br>`app/src/components/StatusNotice.tsx`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Support tickets queue + status-incidents.json notices live; no go-live/path-live milestone step |
| Institution implementation#20 | Midpoint review | missing | — | no midpoint review; searched midpoint, mid-point, pilot review in app/src (no code) |
| Institution implementation#21 | Pilot outcome review | partial | `app/src/lib/gtm/pilot.ts`<br>`supabase/migrations/20260928090000_gtm_foundation.sql` | gtm_pilot_outcomes/metrics tables + pilot.ts logic; no review screen |
| Institution implementation#22 | Annual conversion or offboarding | partial | `supabase/migrations/20260930200000_school_offboarding.sql`<br>`supabase/migrations/20260929070000_commercial_core.sql` | Offboarding RPC procedure (propose..archive) exists, no UI; annual conversion only renewal tables, no flow |

### Controlled integration

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Controlled integration#1 | Integration request | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | Configurer can insert a connection under RLS (integration:configure); no request screen or handoff to security reviewer |
| Controlled integration#2 | Business purpose defined | partial | `supabase/migrations/20260927170000_integration_control_plane.sql` | integration_scopes.purpose column settable via API; no business-purpose form |
| Controlled integration#3 | Data classification identified | partial | `app/src/lib/integration/classification.ts`<br>`supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/components/institutional/OperationsStudio.tsx` | data_classification_rules + connection ceiling + routeAllowed; no classification review screen |
| Controlled integration#4 | Security/privacy review | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/screens/TrustRoom.tsx` | integration_approve_connection (owner cannot self-approve) RPC; no security/privacy review workflow or consent record |
| Controlled integration#5 | Scope requested | partial | `supabase/migrations/20260927170000_integration_control_plane.sql` | Unapproved scopes insertable by integration_admin via API; no scope-request screen |
| Controlled integration#6 | Tenant approval | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/lib/integration/dashboard.ts` | integration_approve_scope/approve_connection RPCs (university_admin); no client calls them, no approval UI |
| Controlled integration#7 | Credential configured server-side | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/lib/integration/vault.ts` | credentials_reference pointer + lease broker; no credential entry/rotation UI or live vault backend |
| Controlled integration#8 | Sandbox validated | partial | `app/src/lib/integration/contract-harness.ts`<br>`app/server/integration/registry-preflight.ts` | Contract harness/preflight gate adapters; no per-connection sandbox validation record |
| Controlled integration#9 | Mapping created | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | integration_mappings insertable under RLS; dashboard shows mappings read-only; no mapping studio |
| Controlled integration#10 | Mapping version approved | partial | `app/src/lib/integration/mapping-versions.ts`<br>`supabase/migrations/20260927170000_integration_control_plane.sql` | propose/approve/goLive logic is pure lib not wired; table has active flag, no approver column |
| Controlled integration#11 | Read-only sync enabled | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/server/integration/tick.ts`<br>`app/server/integration/registry.ts` | read direction + approval + scheduler exist; ADAPTERS registry empty so no connection actually syncs |
| Controlled integration#12 | Reconciliation passed | partial | `app/src/lib/integration/reconcile.ts`<br>`supabase/migrations/20260928040000_integration_quality.sql` | Reconcile plan + run/discrepancy tables; no trigger/UI or sign-off of a passed reconciliation |
| Controlled integration#13 | Monitoring enabled | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/integration/health.ts`<br>`app/src/lib/integration/lineage.ts` | Health/freshness/breach logic + dashboard + pause/resume; no alert routing to support operator |
| Controlled integration#14 | Write direction requested | partial | `supabase/migrations/20260927170000_integration_control_plane.sql` | sync_direction approved_write set only by approver at approval; no write-direction request step |
| Controlled integration#15 | Higher approval required | partial | `supabase/migrations/20260927170000_integration_control_plane.sql` | integration_approve_connection takes any approver; no tiered/higher approval for write directions |
| Controlled integration#16 | Controlled write pilot | partial | `app/server/institution/gateway.ts`<br>`app/server/institution/registration.ts` | Gateway two-phase prepare/commit writes exist against sandbox only; no real write adapter or pilot control |
| Controlled integration#17 | Rollback verified | partial | `app/src/lib/integration/mapping-versions.ts`<br>`app/src/lib/integration/parallel-run.ts` | Mapping rollback + parallel-run helpers (pure); no rollback drill/verification record |
| Controlled integration#18 | Production approval | partial | `supabase/migrations/20260927170000_integration_control_plane.sql` | Connection approved_by/approved_at only; no sandbox-to-production approval gate |
| Controlled integration#19 | Periodic scope review | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`app/server/integration/tick.ts` | integration_scopes.expires_at honored; no periodic scope review workflow or reminder |
| Controlled integration#20 | Retirement/offboarding | partial | `supabase/migrations/20260930200000_school_offboarding.sql`<br>`supabase/migrations/20260927200000_integration_hardening.sql` | School offboarding disconnects connections + tombstone fn; no per-connection retire UI or consent step |

### Governed AI request

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Governed AI request#1 | User asks | exists | `app/src/ai/Chat.tsx`<br>`app/src/ai/Composer.tsx`<br>`app/src/ai/converse.ts` | Ask tab composer sends to the governed gateway when configured |
| Governed AI request#2 | Intent identified | partial | `app/src/ai/converse.ts`<br>`app/src/lib/mode.ts` | Client readMode/category picks mode; no gateway-side intent classification |
| Governed AI request#3 | Role/tenant/course scope established | exists | `app/server/institution/intelligence.ts`<br>`app/server/institution/intelligence-repository.ts` | respond() checks tenant/person match, role, mode, approved-source and course scope |
| Governed AI request#4 | Data classification checked | exists | `packages/institution/src/ai-data-class.ts`<br>`app/server/institution/ai-data-class.ts`<br>`app/server/institution/intelligence.ts` | checkProviderRequest refuses fields above T2 ceiling before budget/provider |
| Governed AI request#5 | Consent checked | partial | `app/server/institution/intelligence.ts`<br>`app/src/ai/converse.ts` | Client sends consentIds: []; no per-request consent-grant check in gateway respond() |
| Governed AI request#6 | Course/tenant AI policy checked | exists | `app/server/institution/intelligence.ts`<br>`packages/institution/src/course-agent-policy.ts`<br>`app/server/institution/intelligence-repository.ts` | Tenant feature/ai_policy, kill switch and published course_ai_rules enforced per request |
| Governed AI request#7 | Provider/model selected | exists | `app/server/institution/intelligence.ts`<br>`packages/institution/src/index.ts` | chooseModel picks cheapest tenant-allowed route under cost ceiling (routes.ts failover not wired) |
| Governed AI request#8 | Allowed sources retrieved | exists | `app/server/institution/intelligence-repository.ts`<br>`app/server/institution/intelligence.ts` | approved_source rows + load_approved_source_content; unapproved/unscoped sources refused |
| Governed AI request#9 | Prompt/tool permission validated | exists | `app/server/institution/intelligence.ts`<br>`app/server/institution/intelligence-action-store.ts` | Agent role limited to prepare-class actions; confirm needs claimed action; injection guards on client |
| Governed AI request#10 | Response generated | exists | `app/server/institution/intelligence.ts`<br>`app/server/institution/providers/openai.ts` | Provider generation with cited-source and token validation; invalid responses discarded |
| Governed AI request#11 | Sources and limits shown | exists | `app/src/intelligence/Disclosure.tsx`<br>`app/src/ai/quality.ts`<br>`app/src/ai/Answer.tsx` | Answer shows origins, mode, source strength, policy state and what it cannot determine |
| Governed AI request#12 | Suggested action presented | exists | `app/src/ai/Actions.tsx`<br>`app/src/ai/converse.ts` | Confirmable proposal cards (nothing happens until pressed); governed path returns none |
| Governed AI request#13 | Official handoff offered | partial | `app/src/components/AskAHuman.tsx`<br>`app/src/lib/help-routes.ts`<br>`app/src/lib/aihandoff.ts` | Help routes to offices exist on Help screen; AI answer does not offer an official handoff |
| Governed AI request#14 | Human escalation offered | partial | `app/src/components/AskAHuman.tsx`<br>`app/src/ai/Opening.tsx` | Ask-a-human and advisor prompts exist; AI answer does not offer escalation itself |
| Governed AI request#15 | Usage/spend logged | exists | `app/server/institution/intelligence.ts`<br>`supabase/migrations/20261004170000_ai_spend_meter.sql`<br>`app/server/institution/intelligence-repository.ts` | reserve/settle_ai_budget meter + per-request audit of tokens and cost |
| Governed AI request#16 | Audit/evaluation signal recorded | exists | `app/server/institution/postgres-journal.ts`<br>`app/server/institution/intelligence.ts`<br>`app/server/institution/journal.ts` | auditIntelligence written before answer returned (discarded if unrecorded); no separate eval score |
| Governed AI request#17 | Feedback/correction captured | exists | `app/src/ai/quality.ts`<br>`app/src/ai/Turns.tsx`<br>`app/src/lib/feedback.ts`<br>`app/src/components/SaySomething.tsx` | Incorrect/source/policy reasons open report sent to feedback table; not linked to gateway audit record |

### Support request

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Support request#1 | User searches help | partial | `app/src/screens/Search.tsx`<br>`app/src/lib/desk.ts`<br>`app/src/screens/Help.tsx` | Global search finds screens/keywords; no help-article or KB search |
| Support request#2 | Opens support request | exists | `app/src/lib/supporttickets.ts`<br>`app/src/components/SupportTicketsPanel.tsx`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Student opens ticket via open_support_ticket RPC from Help screen |
| Support request#3 | Minimum safe context captured | exists | `app/src/lib/supporttickets.ts`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Student ticks six app-only context keys; DB validates (support_context_ok); no identity sent |
| Support request#4 | Categorized + severity | partial | `app/src/lib/supporttickets.ts`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Student picks category; DB derives priority high/normal; operator cannot recategorize or set severity |
| Support request#5 | Routed to team/office | partial | `app/src/lib/help-routes.ts`<br>`supabase/migrations/20260927230000_help_requests.sql`<br>`app/src/components/GetHelp.tsx` | Student picks destination office; no support-operator routing between teams/offices |
| Support request#6 | Owner accepts or routes | partial | `app/src/components/HelpInbox.tsx`<br>`app/src/lib/help-routes.ts`<br>`supabase/migrations/20260927230000_help_requests.sql` | Office staff can mark seen/scheduled/close in HelpInbox; no re-route to another owner |
| Support request#7 | User receives status | exists | `app/src/components/SupportTicketsPanel.tsx`<br>`app/src/lib/supporttickets.ts`<br>`supabase/functions/support-reply-notify/index.ts` | Student sees ticket status and replies in-app; optional email notice outbox |
| Support request#8 | Resolution delivered | exists | `app/src/components/console/SupportQueue.tsx`<br>`app/src/lib/supporttickets.ts`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Operator support_reply sets resolved/waiting; office staff answer_help_request returns reply |
| Support request#9 | Confirm or close | exists | `app/src/components/SupportTicketsPanel.tsx`<br>`app/src/lib/supporttickets.ts`<br>`supabase/migrations/20260928210000_support_tickets.sql` | Student closes ticket via close_my_ticket after resolved |
| Support request#10 | Root cause tagged | missing | — | Searched root_cause, rootcause, root cause tag in app/src, supabase/migrations: none |
| Support request#11 | Product/KB feedback loop | partial | `app/src/lib/momentfeedback.ts`<br>`app/src/components/FeedbackPanel.tsx` | Student moment feedback + what-changed log; no product-operator review/KB loop screen |
| Support request#12 | SLA and satisfaction recorded | partial | `supabase/migrations/20260928210000_support_tickets.sql`<br>`app/src/lib/supporttickets.ts`<br>`app/src/components/console/SupportQueue.tsx` | first_response_due/first_responded_at and overdue flag recorded; no satisfaction capture |

### Incident response

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Incident response#1 | Alert or report | partial | `app/src/components/console/CommandCenter.tsx`<br>`app/src/lib/console/client.ts`<br>`app/public/status.html` | Command center shows live exception queue; no incident intake/report record |
| Incident response#2 | Triage | missing | — | Searched triage, incident intake in app/src, supabase/migrations, server: no triage step |
| Incident response#3 | Severity declared | missing | — | Searched severity declare in console, supabase; SEV scale only in lib/incident-recovery.ts data; no declare action |
| Incident response#4 | Incident commander | missing | — | Searched incident commander/assign in console, supabase, server: none; Incidents capability absent |
| Incident response#5 | Technical lead | missing | — | Searched technical lead assignment in console, supabase, app/src: none |
| Incident response#6 | Communications lead | missing | — | Searched communications lead assignment: none; only playbook text in lib/ops/incidentplaybooks.ts |
| Incident response#7 | Impact assessed | missing | — | Searched impact assessment workflow: lib/governance/pia.ts is static data, no operator UI or table |
| Incident response#8 | Risky releases paused | partial | `app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/components/console/Approvals.tsx`<br>`app/src/lib/ops/console.ts` | Per-connection pause and approvals duty for release/rollback; no release-level pause action |
| Incident response#9 | Mitigation executed | partial | `app/src/components/console/BreakGlass.tsx`<br>`app/src/components/institutional/IntegrationDashboard.tsx`<br>`app/src/lib/ops/console.ts` | Break-glass grant tied to incident ticket and connection pause exist; no mitigation runner/log |
| Incident response#10 | Internal update | missing | — | Searched internal incident update/broadcast in app/src, supabase, server: none |
| Incident response#11 | Customer update | partial | `app/public/status.html`<br>`app/public/status-incidents.json`<br>`app/src/lib/statusnotice.ts` | Public status page and in-app notice from JSON file edited by merge; no per-customer exec notice |
| Incident response#12 | Recovery monitored | partial | `app/public/status.html`<br>`app/scripts/status-history.mjs`<br>`.github/workflows/production-smoke.yml` | Hourly smoke checks drawn as 90-day bars; no recovery tracking per incident |
| Incident response#13 | Resolved | partial | `app/public/status.html`<br>`app/src/lib/statusnotice.ts` | Incident status can be set to resolved by editing status-incidents.json; no resolve action/UI |
| Incident response#14 | Postmortem | missing | — | Searched postmortem/post-incident review: only a type in lib/incident-recovery.ts; doc only: docs/INCIDENT-RECOVERY-PLAYBOOK.md |
| Incident response#15 | Corrective actions to Inbox | missing | — | Searched corrective action, operations inbox in app/src, supabase: none; doc only: docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md |
| Incident response#16 | SLO/error budget reviewed | partial | `app/src/lib/governance/error-budgets.ts`<br>`app/src/lib/sre/burn-alerts.ts` | Error-budget and burn-rate computation as library code; no review screen or recorded review |
| Incident response#17 | Release policy updated | partial | `app/src/components/console/Approvals.tsx`<br>`app/src/lib/ops/console.ts`<br>`app/src/lib/governance/release-profiles.ts` | Tenant-policy/release duties via two-person approvals; no release-policy editor |

### Domain migration

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Domain migration#1 | Domain inventory | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Migration projects are per-domain (11 domains); no cross-domain inventory of domains to migrate |
| Domain migration#2 | Source data inventory | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Inventory stage records system, version, data owner only; no table/field-level source inventory |
| Domain migration#3 | Field mapping | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Mapping stage: source to target fields, transforms, key fields; gated by DB trigger |
| Domain migration#4 | Data classification | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Classification stage: sensitivity, retention, historical cutoff; DB-enforced gate |
| Domain migration#5 | Import staging | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`app/src/lib/interop.ts` | Sample import run records counts and SHA-256 in browser; no rows actually staged/imported |
| Domain migration#6 | Validation | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Validation stage: full export parsed in browser, every row must map; run recorded |
| Domain migration#7 | Duplicate/conflict resolution | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Cleaning stage picks duplicate rule (reject/keep first/last); no per-record conflict review |
| Domain migration#8 | Reconciliation | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Reconciliation stage compares mapped export vs Semester export; passing run required |
| Domain migration#9 | Dual run | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Parallel-run stage needs N passing period runs before moving on |
| Domain migration#10 | User acceptance | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Cutover approvals by area (faculty, leadership etc.) exist; no distinct user-acceptance sign-off |
| Domain migration#11 | Institution approval | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Per-area approvals (registrar, IT, finance...) with migration:approve; creator cannot approve |
| Domain migration#12 | Cutover | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Cutover stage needs date, rollback plan and all approvals; DB trigger refuses otherwise |
| Domain migration#13 | Enhanced monitoring | exists | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts`<br>`supabase/migrations/20260929200000_migration_center.sql` | Monitoring stage records post-cutover check runs |
| Domain migration#14 | Rollback window | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Rollback plan text and back-navigation only until cutover; no timed rollback window |
| Domain migration#15 | Archive/export | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Archive stage records archive/export location only; no export generation or auditor handoff |
| Domain migration#16 | Legacy retirement | missing | — | Searched legacy retirement/decommission in MigrationCenter, lib/migration, supabase: monitoring is terminal stage |
| Domain migration#17 | Post-migration review | partial | `app/src/components/institutional/MigrationCenter.tsx`<br>`app/src/lib/migration/center.ts` | Monitoring stage logs checks; no structured post-migration review or lessons record |

### Student finance & payment

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Student finance & payment#1 | Review student account | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts`<br>`app/src/screens/Bill.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Student reads balance, age, hold and ledger on Bill once registrar links identity |
| Student finance & payment#2 | Review charges and credits | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts`<br>`app/src/components/institutional/StudentAccounts.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Student sees every posted charge/credit entry, receipts and monthly statement CSV |
| Student finance & payment#3 | See hold blocking registration | exists | `app/src/components/enrollment/StudentRegistration.tsx`<br>`app/src/lib/enrollment/client.ts`<br>`app/src/components/MyStudentAccount.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | my_registration_hold shows hold + office; financial hold shown on Bill |
| Student finance & payment#4 | Open cost planner | exists | `app/src/screens/Costs.tsx`<br>`app/src/screens/Bill.tsx`<br>`app/src/lib/cost.ts` | Costs screen and Bill planner: student-entered costs, aid, instalment arithmetic |
| Student finance & payment#5 | Request payment plan | exists | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/plans.ts`<br>`app/src/components/institutional/StudentAccounts.tsx`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Student asks for plan (count, first due); request queues for Student Accounts |
| Student finance & payment#6 | Review plan terms | exists | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/plans.ts`<br>`app/src/lib/finance/accounts.ts`<br>`supabase/migrations/20260929220000_student_accounts.sql` | PlanQueue shows DB-computed schedule and balance for staff to review |
| Student finance & payment#7 | Accept payment plan | partial | `app/src/components/MyStudentAccount.tsx`<br>`app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/plans.ts` | Student requests schedule, staff agree/decline; no separate student acceptance of agreed terms |
| Student finance & payment#8 | Payment handoff to processor | partial | `app/src/components/MyStudentAccount.tsx`<br>`app/src/screens/Bill.tsx` | Opens school own payment URL in new tab; no processor handoff or token |
| Student finance & payment#9 | Processor confirms payment | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Staff record payment by provider reference; no processor webhook/auto confirmation |
| Student finance & payment#10 | Reconcile payment with SIS | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`app/src/lib/finance/api.ts` | Reconciles ledger with payment-provider settlement file and monthly close; not against SIS |
| Student finance & payment#11 | Release hold | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Financial hold is derived from overdue/plan state and lifts on payment; no explicit release action |
| Student finance & payment#12 | Notify student of hold release | missing | — | Searched hold release notify, notification in lib/finance, StudentAccounts, supabase/functions: none |
| Student finance & payment#13 | Request refund status | partial | `app/src/components/MyStudentAccount.tsx`<br>`app/src/lib/finance/mine.ts`<br>`app/src/components/institutional/StudentAccounts.tsx` | Student sees refund/credit ledger entries; no refund-status request handoff to staff |
| Student finance & payment#14 | Financial-aid handoff | partial | `app/src/lib/help-routes.ts`<br>`app/src/lib/ask-human.ts`<br>`app/src/components/AskAHuman.tsx` | financial_aid is directory-only (office link and hours); no handoff stored or sent |
| Student finance & payment#15 | Emergency support request | partial | `app/src/lib/support.ts`<br>`app/src/screens/Support.tsx`<br>`app/src/lib/ask-human.ts` | Emergency aid resources listed as directory; no emergency request submission |
| Student finance & payment#16 | Audit ledger reviewed | partial | `app/src/components/institutional/StudentAccounts.tsx`<br>`app/src/lib/finance/accounts.ts`<br>`supabase/migrations/20260929220000_student_accounts.sql` | Staff read ledger/audit trail and statements; no auditor handoff or review sign-off |

### Campus services

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Campus services#1 | Open campus map | exists | `app/src/screens/Maps.tsx`<br>`app/src/lib/findplace.ts`<br>`app/src/components/LiveMap.tsx` | Maps screen: buildings, place search, routes |
| Campus services#2 | Find study space | partial | `app/src/components/RoomsNow.tsx`<br>`app/src/lib/room-availability.ts`<br>`supabase/migrations/20260928041700_space_availability.sql` | Rooms-free-now only when school shares booking feed; no standalone study-space finder |
| Campus services#3 | Check dining hours and menus | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/locations.ts`<br>`app/src/lib/dining/client.ts` | Dining shows hours and menus with source labels; module flag gated |
| Campus services#4 | Order dining | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/orders.ts`<br>`app/src/lib/dining/client.ts` | Student places mobile order; needs card-office connection and module.dining on |
| Campus services#5 | Pay with meal balance | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/orders.ts`<br>`app/src/lib/dining/ledger.ts` | Pay kinds swipe, pool swipe, dining and campus cents on order; gated by card-office link |
| Campus services#6 | Pick up order | exists | `app/src/components/dining/Counter.tsx`<br>`app/src/lib/dining/orders.ts`<br>`app/src/lib/dining/client.ts` | Staff counter advances orders to ready and picked up |
| Campus services#7 | Donate meal swipes to pool | exists | `app/src/screens/Dining.tsx`<br>`app/src/lib/dining/sharing.ts`<br>`app/src/lib/dining/client.ts` | donateSwipes to basic-needs pool with consent text and cap |
| Campus services#8 | Submit housing maintenance request | missing | — | Searched maintenance request, work order, repair in screens/Housing.tsx, server/institution/housing.ts, supabase: none (contracts only) |
| Campus services#9 | Housing staff accepts request | missing | — | Searched housing staff queue/accept for maintenance in app/src, server, supabase: none |
| Campus services#10 | Request resolved | missing | — | Searched housing request resolved/notify in app/src, server: none |
| Campus services#11 | Find accessibility services | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Support Access tab lists accessibility offices, tools and how to request |
| Campus services#12 | Request accommodation | partial | `app/src/lib/support.ts`<br>`app/src/lib/help-routes.ts` | Directs student to access office; accessibility_office is directory-only, no request submitted |
| Campus services#13 | Accommodation approved | missing | — | Searched accommodation approval/status: by design never stored (support.ts says so); no decision flow |
| Campus services#14 | Find safety resources | exists | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts` | Support Now tab: 911, 988, campus safety, alerts, own emergency contacts, checklists |
| Campus services#15 | Wellness handoff | partial | `app/src/screens/Support.tsx`<br>`app/src/lib/support.ts`<br>`app/src/lib/help-routes.ts` | Counseling/wellbeing listed as directory with call links; no handoff request by design |

### Community & moderation

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Community & moderation#1 | Set profile visibility per field | missing | — | Searched visibility/per-field in Privacy, Profile, Classmates, Directory screens; only a single handle is shared |
| Community & moderation#2 | Choose alias for public posts | exists | `app/src/components/community/AliasPanel.tsx`<br>`app/src/community/alias.ts`<br>`app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | Scoped alias per community; Composer posts as alias where school approves pseudonymity |
| Community & moderation#3 | Join course community | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | joinCommunity RPC; course-kind communities listed and joinable |
| Community & moderation#4 | Join organization space | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts`<br>`app/src/community/communities.ts` | Same join path covers student_organization kind |
| Community & moderation#5 | Create post | exists | `app/src/screens/Community.tsx`<br>`app/src/components/community/Composer.tsx`<br>`app/src/community/client.ts` | createPost via create_community_post RPC with composer |
| Community & moderation#6 | AI pre-screen public post | partial | `app/src/community/detectors.ts`<br>`app/src/components/community/Composer.tsx`<br>`supabase/migrations/20260928032000_community.sql` | Regex rule detectors on device and DB, not an AI gateway pre-screen |
| Community & moderation#7 | Post published | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | Post goes live (or held) and author sees status/notice |
| Community & moderation#8 | Ask question in Q&A | partial | `app/src/community/questions.ts`<br>`app/src/lib/communitiesregister.ts` | Question/answer model only; no Q&A screen or ask flow wired (grep screens) |
| Community & moderation#9 | Answer endorsed by TA | missing | — | Searched endorse/teaching assistant/TA in community and screens; questions.ts verifies by office only, no TA role |
| Community & moderation#10 | Create marketplace listing | missing | — | Searched marketplace in app/src, supabase; governance.ts defers marketplace to later tier |
| Community & moderation#11 | Integrity filter checks listing | missing | — | No listings exist, so no integrity filter; searched marketplace/listing in community and migrations |
| Community & moderation#12 | Make offer in chat | missing | — | No marketplace chat/offers; searched marketplace, offer in community and screens |
| Community & moderation#13 | Arrange safe meet-up | missing | — | No meet-up flow for listings; community sessions are study sessions only, no safe-meetup logic |
| Community & moderation#14 | Report content | exists | `app/src/components/community/ReportSheet.tsx`<br>`app/src/screens/Community.tsx`<br>`app/src/community/client.ts` | reportPost via report_community_post RPC with categories |
| Community & moderation#15 | Moderator reviews report | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts`<br>`app/src/community/moderation.ts` | Reviewer queue with triage, severity and blind view |
| Community & moderation#16 | Remove content or warn | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts`<br>`supabase/migrations/20260928032000_community.sql` | decideCase -> decide_community_case; remove/label/restrict actions with reason |
| Community & moderation#17 | Student appeals | exists | `app/src/screens/Community.tsx`<br>`app/src/community/client.ts`<br>`supabase/migrations/20261004130000_community_appeal_window.sql` | appeal() with 30-day window and notice to author |
| Community & moderation#18 | Appeal decided | exists | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts`<br>`supabase/migrations/20260928032000_community.sql` | decideAppeal by different reviewer; grant or uphold |
| Community & moderation#19 | Safety escalation | exists | `app/src/components/community/Escalation.tsx`<br>`app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts` | requestEscalation/decideEscalation to university per agreement; flag-gated |
| Community & moderation#20 | Community health reviewed | partial | `app/src/screens/Moderation.tsx`<br>`app/src/community/client.ts` | Reviewer standing, sweep and volunteer events exist; no community health review view for product operator |

### Career, employer & alumni

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Career, employer & alumni#1 | Build skills profile | exists | `app/src/screens/Career.tsx`<br>`app/src/lib/skills-graph.ts`<br>`app/src/components/SkillsGraph.tsx` | Skills claims derived from student's own evidence, labelled unverified |
| Career, employer & alumni#2 | Add evidence to portfolio | exists | `app/src/components/CareerEvidence.tsx`<br>`app/src/lib/career-evidence.ts`<br>`app/src/screens/Career.tsx` | Evidence portfolio and bullets (device-local, student-controlled) |
| Career, employer & alumni#3 | Request skill verification | missing | — | Searched request verification/faculty verify in skills-graph, career-evidence, Career; no request to instructor |
| Career, employer & alumni#4 | Faculty verifies skill | missing | — | Searched verifiedBy/instructor verification flow; claims are labelled never institution verified |
| Career, employer & alumni#5 | Generate resume from evidence | exists | `app/src/screens/Career.tsx`<br>`app/src/lib/career-evidence.ts` | builtResume/resumeMarkdown, versions in CareerEvidence |
| Career, employer & alumni#6 | Search opportunities | exists | `app/src/screens/Career.tsx`<br>`app/src/screens/Opportunities.tsx` | Discover tab and Opportunities screen search a student-entered/static list |
| Career, employer & alumni#7 | Employer posts internship | missing | — | Searched employer post/listing creation; gateway career.ts has no post action, only shortlist/offer/pass/close on sandbox listings |
| Career, employer & alumni#8 | Career staff approves posting | missing | — | No career-staff posting approval action; career.ts employer state is sandbox data only |
| Career, employer & alumni#9 | Apply to internship | partial | `app/server/institution/career.ts`<br>`app/server/institution/sandbox.ts` | Apply action exists in gateway but sandbox-only, no real employer delivery |
| Career, employer & alumni#10 | Employer reviews approved evidence | missing | — | Searched employer review of approved evidence/skill evidence sharing; no employer-facing view |
| Career, employer & alumni#11 | Book career appointment | partial | `app/server/institution/advising.ts`<br>`app/server/institution/sandbox.ts` | Gateway book/cancel appointment is sandbox-only; not in career staff diary |
| Career, employer & alumni#12 | Interview scheduled | missing | — | Searched interview schedule/employer actor; only student interview-prep drafts in Career.tsx |
| Career, employer & alumni#13 | Offer recorded | partial | `app/server/institution/career.ts`<br>`app/server/institution/sandbox.ts` | Employer offer and student accept/decline in gateway sandbox only; not an academic record entry |
| Career, employer & alumni#14 | Career outcome captured | missing | — | Searched career outcome capture by staff in app/src, server, migrations; none |
| Career, employer & alumni#15 | Transition to alumni | missing | — | Searched alumni transition/graduate to alumni in app/src, server, migrations; only register text |
| Career, employer & alumni#16 | Alumni offers mentoring | partial | `app/src/lib/mentors.ts`<br>`supabase/migrations/20260928021700_mentor_rosters.sql`<br>`app/src/components/MentorFinder.tsx` | alumni_mentor_offers table with RLS exists; no UI for alumni to publish an offer |
| Career, employer & alumni#17 | Mentor matched with student | exists | `app/src/components/MentorFinder.tsx`<br>`app/src/lib/mentors.ts`<br>`supabase/migrations/20260928021700_mentor_rosters.sql` | request_mentor/answer_mentor_request; mentor accepts via MentorFinder |
| Career, employer & alumni#18 | Continuing education enrolment | missing | — | Searched continuing education/enrolment in app/src, server, migrations; unrelated hits only |

### Family & guardian consent

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Family & guardian consent#1 | Student opens family sharing | exists | `app/src/screens/Family.tsx`<br>`app/src/components/FamilyInvite.tsx` | Family screen with plan, preview and share tabs |
| Family & guardian consent#2 | Choose information categories | exists | `app/src/screens/Family.tsx`<br>`app/src/lib/family.ts` | FAMILY_CATEGORIES chosen per person/item |
| Family & guardian consent#3 | Set access expiry | exists | `app/src/screens/Family.tsx`<br>`app/src/lib/familyinvites.ts` | Expiry set per member with endProblem validation; carried as grant_expires_at |
| Family & guardian consent#4 | Send consent invitation | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyinvites.ts`<br>`supabase/migrations/20260928306000_family_invites.sql` | make_family_invite after confirm step; single-use 7-day code; needs sign-in |
| Family & guardian consent#5 | Guardian confirms relationship | partial | `app/src/components/FamilyInvite.tsx`<br>`supabase/migrations/20260928306000_family_invites.sql` | Guardian claims code; no separate relationship confirmation (relationship defaulted) |
| Family & guardian consent#6 | Guardian accepts scope | partial | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyinvites.ts` | Guardian accepts via code (claim_family_invite); scope is fixed by student, not shown for acceptance |
| Family & guardian consent#7 | Guardian views shared items | exists | `app/src/components/SharedWithYou.tsx`<br>`app/src/lib/familyshare.ts`<br>`supabase/migrations/20260928307000_family_shared_items.sql` | read_family_share lists items per live grant; reads are logged |
| Family & guardian consent#8 | Billing/support handoff | missing | — | Searched billing/support handoff from guardian in Family, Support, Bill screens and migrations; none |
| Family & guardian consent#9 | Access history reviewed | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyshare.ts`<br>`supabase/migrations/20260928307000_family_shared_items.sql` | readLog shows what each recipient read and when |
| Family & guardian consent#10 | Student narrows scope | partial | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyshare.ts` | Student can stop sharing (all items for a person); no per-category narrowing of a live grant |
| Family & guardian consent#11 | Student revokes access | exists | `app/src/components/FamilyInvite.tsx`<br>`app/src/lib/familyshare.ts`<br>`app/src/lib/familyinvites.ts` | revokeInvite and stopSharing end access immediately |
| Family & guardian consent#12 | Access expires automatically | exists | `supabase/migrations/20260928307000_family_shared_items.sql`<br>`app/src/lib/familyshare.ts` | Reads filter on expires_at > now(); expiry enforced server-side each read |
| Family & guardian consent#13 | Audit retained | partial | `supabase/migrations/20260928307000_family_shared_items.sql`<br>`app/src/lib/familyshare.ts` | Read log table retained and student-visible; no operator retention/review surface |

### Developer platform & marketplace

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Developer platform & marketplace#1 | Partner applies | missing | — | Searched partner/developer application/portal in app, server, packages, company-site; none |
| Developer platform & marketplace#2 | Partner agreement signed | missing | — | No partner agreement flow; searched agreement in developer/partner context (escalation agreements are for campuses) |
| Developer platform & marketplace#3 | Sandbox tenant created | missing | — | No sandbox tenant provisioning for partners; app/server/institution/sandbox.ts is an in-memory demo store |
| Developer platform & marketplace#4 | Request data scopes | missing | — | Searched scope request/approval for third-party apps; platform approval.ts is internal, no developer UI |
| Developer platform & marketplace#5 | Security review of app | missing | — | No app security-review workflow; searched security review in app/src, server, migrations |
| Developer platform & marketplace#6 | Scopes approved | missing | — | No scope approval flow for external apps; console Approvals are internal operator actions |
| Developer platform & marketplace#7 | Register OAuth client | missing | — | Searched register OAuth client/client_id issuance; lib/integration/oauth.ts is outbound to providers only |
| Developer platform & marketplace#8 | Configure webhooks | missing | — | Searched developer webhook config; webhook-ingress.ts is inbound only; docs/API-PLATFORM.md says specified only |
| Developer platform & marketplace#9 | Build against SDK | partial | `packages/platform/src/sdk/client.ts`<br>`packages/platform/src/gateway/command.ts` | Internal SDK client exists and is tested; no published developer SDK or portal |
| Developer platform & marketplace#10 | Integration certification | partial | `app/src/lib/integration/contract-harness.ts`<br>`app/server/integration/registry.ts` | Contract harness certifies adapters before registry; internal, not partner certification |
| Developer platform & marketplace#11 | App review | missing | — | Searched app review/marketplace app review; none |
| Developer platform & marketplace#12 | Listed in marketplace | missing | — | Searched marketplace listing; none beyond governance.ts deferral |
| Developer platform & marketplace#13 | Institution enables app | missing | — | Searched institution enable app/app allowlist; ModulesPanel toggles modules, not third-party apps |
| Developer platform & marketplace#14 | Metering and billing | missing | — | Searched metering/usage billing for platform; billing functions are student subscription only |
| Developer platform & marketplace#15 | Version deprecation notice | partial | `packages/platform/src/gateway/versioning.ts`<br>`app/src/lib/integration/mapping-versions.ts` | Deprecation/Sunset headers and registry in code; no notice delivered to developers |
| Developer platform & marketplace#16 | App retired | missing | — | Searched app retire/unpublish; no developer app lifecycle exists |

### Analytics, outcomes & reliability

| Key | Item | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| Analytics, outcomes & reliability#1 | Define success measures with sponsor | partial | `supabase/migrations/20260928090000_gtm_foundation.sql`<br>`app/src/lib/institution-ops.ts` | gtm_pilots holds sponsor/baseline/metrics in DB; no sponsor-facing UI for defining measures |
| Analytics, outcomes & reliability#2 | Measures sheet signed | missing | — | Searched measures sheet/signature in app, migrations; none |
| Analytics, outcomes & reliability#3 | Instrument events (no PII) | partial | `app/src/lib/activity.ts`<br>`supabase/migrations/20260921151000_activity.sql` | Three PII-free server marks exist (opened/course/studied); wider pilot events are definitions only |
| Analytics, outcomes & reliability#4 | Aggregate with minimum cell size | partial | `app/src/lib/institution-ops.ts`<br>`app/src/components/institutional/OperationsStudio.tsx`<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` | suppress()/n>=10 enforced in lib and DB; studio hidden until verified capability wired |
| Analytics, outcomes & reliability#5 | Weekly metrics review | partial | `app/src/screens/Console.tsx`<br>`app/src/components/console/Figures.tsx`<br>`app/src/lib/console/client.ts` | Console figures from console_figures rpc; no weekly pilot-metrics review |
| Analytics, outcomes & reliability#6 | SLO dashboard reviewed | partial | `app/src/screens/Console.tsx`<br>`app/src/components/console/CommandCenter.tsx`<br>`app/server/productivity/ops.ts` | Command center and /metrics exist; no SLO dashboard with targets |
| Analytics, outcomes & reliability#7 | Error budget checked | missing | — | Searched error budget in app, server, packages; only a journey-slo definition in lib/ops/firstyear.ts |
| Analytics, outcomes & reliability#8 | Pilot midpoint report | missing | — | Searched pilot midpoint/report in screens, lib, migrations; none |
| Analytics, outcomes & reliability#9 | Course analytics shared with faculty | missing | — | Searched course analytics sharing to faculty; no consented analytics share path (gradebook is grading only) |
| Analytics, outcomes & reliability#10 | Program outcomes reviewed | partial | `app/src/lib/institution-ops.ts`<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` | outcome_aggregates table (n>=10) and outcomes:read exist; no executive outcomes view |
| Analytics, outcomes & reliability#11 | Pilot results report | missing | — | Searched pilot results report generation; none |
| Analytics, outcomes & reliability#12 | Improvement backlog prioritized | missing | — | Searched improvement backlog prioritisation tool; none in app |
| Analytics, outcomes & reliability#13 | Release evidence recorded | partial | `app/src/components/console/Evidence.tsx`<br>`app/src/lib/ops/evidence.ts`<br>`app/src/screens/Console.tsx` | Evidence register view with expiry states; entries are static data, not recorded per release |
| Analytics, outcomes & reliability#14 | Quarterly operating review | missing | — | Searched quarterly/operating review reports for board; none |
