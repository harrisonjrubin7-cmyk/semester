# NEXT_ACTIONS (checkpoint, 25 Oct 2026, afternoon)

Resume from here; do not restart the architecture. Registers: `source-manifest.csv`, `role-app-requirements.csv`,
`scope-coverage.md`, `conflicts-and-decisions.md`, `requirements-traceability.csv` (Book 2 pilot workflows).

## Baseline (pinned)
- Zite monorepo: commit 36e5838 (Integration mappings and drift). GitHub `main` d4f0053 contains `zite/` up to Zite d8ee54e (PR #1687 merged).
- Gates run on 36e5838: `check_app` ok; `sh apps/semester/tests/run.sh` all suites green. Browser, accessibility,
  load, hosted-sync and restore tests: NOT RUN.

## Method per increment
migration (CHECKs, append-only triggers, plpgsql returning NULL or error) -> rolled-back Neon batch with a control ->
endpoint (requireAction, audit, notification) -> UI with empty/error/permission states -> role-app state update ->
check_app -> unit suites -> mutation check on pure modules -> commit -> re-import to GitHub on a new branch.

## Queue added 26 Oct (owner: "add that to que")
Built 26 Oct, in order: Faculty teaching tools (6a0a252), housing (aba30b6), study abroad (7013a25), scholarships (b6bbc1e),
curriculum governance (9bc8d47), programs and pathways (a52825d), dining (b58d383). Each: rolled-back DB check + mutation check.
7. Semester Atlas (S-71, also S-69's single reconciled register): one interactive artifact generated from the repository's own
   registers (roleApps.ts, source-manifest.csv, conflicts-and-decisions.md, migrations), with independent status dimensions
   (maturity / authorization / activation / evidence / delivery / health), source and conflict registers, missing-coverage view,
   per-app build-prompt generator, JSON export. Statuses come from code evidence only; nothing is marked accepted or activated.
8. DONE 26 Oct (grade tracker + GPA simulator, /progress/tracker): Student Workspace grade tracker (S-72): transparent weighted and points-based calculations with the S-72 validation rules — DONE incl. syllabus hub (/learn/syllabi)
   (no negative scores, ungraded is not zero, excused leaves the denominator, weights must total 100% or no final grade, "Not
   enough graded work"), GPA scenarios kept separate from the official record, syllabus-rule review proposing policy updates.
9. Programs: outcome-to-assessment map (S-70), teach-out rules; institution time-zone field (dining reads America/Chicago).
10. International Student Adviser and High School Counselor: need owner rules on immigration and minors' records first.
11. S-69 enterprise apps (HR, payroll, procurement, finance, facilities, library, safety, advancement, research admin): not started.

## Role-app gap pass (27 Oct)
Built: student organizations (9f4a2d5), financial aid office (cce9b99), transition and orientation (/plan/transition: First Year
Staff, Orientation Leader, Admitted Student; DB check 27/27, mutations on self-verification and session capacity both went red).
Admitted Student now hosted in Semester (admission activates a Semester membership); decision acknowledgment stays incomplete
because the decision itself is shown in Applicants. Deposit is a record with an external reference; no money moves.
Data governance (/staff/governance, Data Steward): definitions with second-steward approval, classification (lowering needs a
second steward), lineage without cycles, quality rules and issues, retention with legal minimum (nothing deleted), source conflicts.
DB check 26/26; mutations on cycles, lowering and conflict settlement all went red.
Portfolio council (/staff/council): rubrics adopted by a second member, reviewer pool, declared conflicts block assignment,
validation needs two reviews all met, chair recommends to the registrar (no award), one appeal decided by a non-reviewing chair.
DB check 25/25; mutations on conflicts, validation rule and single appeal all went red.
Residence life (/campus/reslife, RA + Residence Life Staff): RA check-ins only with moved-in residents of their building, referrals
name a service; RA programs approved by other housing staff, building-only RSVPs with capacity, attendance by the running RA;
bounded incident reports (no resident names), RA sees own, closed by staff other than the filer. DB check 23/23; mutations red.
Career services (/plan/career-services, Career Coach + Career Center Staff): plan, per-coach expiring shares gate all coach access,
versioned resumes with feedback, mock interviews with rubric (no double booking), follow-up actions, fairs with capacity and
check-in, self-reported outcomes verified by center staff, reports suppress groups under five. DB check 29/29; mutations red.
Coach "portfolio review" stays incomplete (not built). Peer support (/help/peer-support): peer mentoring (supervisor-approved mentors, opted-in mentees, one active mentor, mentor
check-ins, mentee-owned goals, escalation resolved by another supervisor); TA questions to instructors (live delegates only);
tutoring ratings once per completed session, per-tutor averages at three or more, staff review notes. TAs with a live grading
delegation can now hold office hours for that section. DB check 27/27; mutations red. Disability services (/campus/disability-services, Officer + Staff): coordinators (admin-granted) handle assigned intake, document
status (no contents, no diagnosis) and implementation checks; officers verify documents, decide appeals they did not originally
decide (modified/overturned needs arrangements and an end date), clear not-delivered flags; instructors acknowledge letters.
The check also covers acc-001 for the first time (decide, letters, instructor view). DB check 38/38; mutations red.
Next: Academic Advisor, Department Chair.

## Original-app parity (owner, 27 Oct: "all these capabilities ... connected to each other")
Inventory of all 75 original-app tools vs Zite: GitHub docs/zite/original-app-parity.csv (12 built, 30 partial, 33 missing).
Order: (1) course study guide model (units, cards, lessons, figures, cases) and the 11 study modes on it (Cards, Read, Field guide,
Slides, Doc, Quiz, Figures, Cases, Cram; Watch/Listen via browser speech); (2) own-data tools with no external dependency: Reports,
Catching up, Exam runway, Where courses meet, Practice paper, Work the problem, Analyse data, Draw it, Sheet, Equations, Sources,
Timers, Links, NIL deals, Athletics, Settings, How this works, Create hub; (3) the 30 partials; (4) cross-app switcher in all 10
apps (needs each app's published URL from the owner); (5) gated on outside services/approval: Gmail, Connect accounts, Video call,
maps, Drive/OneDrive, and AI-model tools (Draft it, Check the writing, A change to a date) - student records never go to a model.

Parity step 1 done (27 Oct): study guides (/learn/guides in Semester, /guides in Faculty) with all 11 study modes
(Cards with Leitner reviews, Read, Field guide, Watch and Listen via browser speech, Slides, Doc as Word/print, Quiz with
choice/true-false/match marking and attempts, Figures, Cases, Cram). Instructors publish a guide to their section and enrolled
students see it and can copy it. guideRules unit tests 8/8; DB check 16/16; mutations red. Next: step 2 own-data tools.

Connected OS (27 Oct): one account across all ten apps (ziteUsers is workspace-wide) and one database; every app except the public
Site now shows the same Apps switcher (components/AppSwitcher.tsx + api/appDirectory.ts front doors), listing only the apps that
make sense for the person (lib/appDirectoryRules.ts, unit-tested). App addresses live in os_app_urls and are set by company staff
from the switcher. Owner: after publishing, paste each app's address into the switcher (or send them to Claude).

## Owner request 27 Oct 18:10: AI toolkit (subject workbench)
Toolkit page with "All tools", 9 intents (Study for an exam, Complete an assignment, Analyze data, Write a paper, Build or code,
Run a lab, Do research, Create a presentation, Prepare for office hours) and 32 subject workbenches plus tools every subject uses (STEM: maths, statistics,
biology, chemistry, physics, CS, data science, engineering; humanities: English/writing, history, philosophy, languages, religious
studies; social sciences/business: psychology, sociology, political science, economics, anthropology, business, finance/accounting,
education, communication, public policy, legal studies, criminal justice; arts: art/design, music, theatre/film/media; health:
nursing, public health, kinesiology/nutrition; field: environmental/earth science) mapping to tools. Toolkit tools: Case analysis
template, Research Studio, Data Studio, Assignment workspace, Rubric self-check (checklist only, never a grade prediction); Semester
tools: Spreadsheet, Diagram builder, Study guide from sources (quotations matched), Practice paper, Sources, Write a document,
Check the writing, Make a deck, Group work. Deterministic first; any model use only on material the student selects, never records.
DONE 27 Oct: /learn/toolkit hub (All tools, every-subject tools, 9 intents, 32 subjects) and the five toolkit tools at
/learn/toolkit/:kind (tlk_docs, private to owner, expected version; DB check 13/13 with owner-check mutant failing). Data Studio
describes CSV and charts counts with a table alternative; Rubric self-check is a checklist with no grade. Semester tools not built yet
(Spreadsheet, Diagram builder, Practice paper, Sources, Write a document, Check the writing, Make a deck, Group work) show as
"Not built yet" on the hub: next increments.
DONE 27 Oct: Sources at /learn/sources (Faculty: /sources "Reading lists"). Private readings with "what it is for", APA 7 / MLA 9
reference lines, BibTeX export and import (all or nothing, 500 max), instructor course reading lists that notify enrolled students
and that students copy into their own list. rdg_* DB check 20/20; mutants (no instructor check, copy ignores enrolment) fail.
Live teacher-to-student check BLOCKED: no sample section has an instructor assigned.
DONE 27 Oct: Spreadsheet at /learn/sheet. Safe formula engine (no eval; SUM AVERAGE MIN MAX COUNT MEDIAN STDEV ROUND ABS SQRT IF,
comparisons, &, %, ^; errors #DIV/0! #REF! #NAME? #VALUE! #CYCLE!), keyboard grid, CSV in (formulas never run on import) and out
(formula-injection guard), real .xlsx out with formulas kept (opened by openpyxl and recalculated by LibreOffice). Stored as
tlk_docs kind sheet; the kind check is widened in place for tables created earlier (upgrade path checked).
Owner approved assigning a sample instructor (27 Oct); BLOCKED until a second sign-in account exists (Northgate has one, a student).
DONE 27 Oct: Write a document. Learn → Write (existing Markdown editor) now downloads a real Word .docx (title, headings,
bold/italic/code, safe links only, bullet and numbered lists with nesting, quotes, tables, code, rules; verified with python-docx
and LibreOffice), prints to PDF, and shows a word count. Shared stored-zip writer moved to lib/zip.ts (xlsx and docx).
DONE 27 Oct: Make a deck at /learn/deck. Outline (# slide, - bullet, > speaker note) or a study guide becomes slides
(6 bullets per slide, continued slides, 80 max), live preview, keyboard Present mode, and a real 16:9 .pptx with title slide and
speaker notes (verified with python-pptx and a LibreOffice PDF render: text stays inside the slide). Stored as tlk_docs kind deck.
DONE 27 Oct: Check the writing at /learn/proof. In-page, no model, nothing saved: common misspellings (list) plus the browser
spellcheck, repeated words, could-of/a-an/capital I, wordy phrases, possible passive voice, long sentences, spacing and unmatched
brackets, Flesch-Kincaid grade. Quotations (4+ words) are checked word for word against pasted source text (ellipsis allowed,
"close" at 80% word overlap) and their (Author, Year) citations against the student's saved Sources. Loads text from Write.
Gap: no full dictionary or grammar parser (no dependency allowed); quotation check needs the source text pasted in.
DONE 27 Oct: Practice paper at /learn/paper. A timed paper from a study guide you can read (seeded, reproducible): Section A
objective questions marked against the key, Section B written answers self-marked against the model answer with a key-word hint.
Countdown hands in automatically at zero. Attempts are private and append-only (ppr_attempts; DB check 9/9, mutants fail).
DONE 27 Oct: Group work at /campus/groupwork. A shared part list per course group (grp_groups): owner, status, due date, note,
past-due and unowned counts. Membership is read from grp_members inside each function; owners must be in the group; only the
creator removes a part; every change goes to an append-only log. Instructors of the section read the list and log, never edit.
DB check 15/15; tenant and owner mutants fail. Remaining Semester tool not built: Diagram builder.
DONE 27 Oct (owner SIS/LMS replacement spec, §16 first increment): course grade → released → certified → official
revision (ogr_*, aum_* authority modes; DB check 32/32 + 3 mutants), gradebook setFinal now proposes only, last-seat race run
against reg_decide (20-way → 1 seat; unlocked control → 6), six-status replacement register. See SIS_LMS_REPLACEMENT.md.
OPEN: zite.permissions.json has no defaultPolicy (direct table access unverified) — owner decision; live 2-person run blocked.
DONE 28 Oct: submission receipts (sbm_*): the receipt is the submission — file manifest with SHA-256, locked atomically, on-time/late stamp, request-key replay; shown to student and instructor. DB check 14/14, 2 mutants fail.
DONE 28 Oct: transcript and GPA from official revisions only (transcriptRules 6/6), student and registrar views, Word download; UNOFFICIAL label outside pilot/authoritative.
DONE 28 Oct: section-request DB check (21/21) + concurrent clash race (real 1 authorized, unlocked control 2). Roster: existing reconciliation (reconRules 8/8) recorded as its test; all six §16 links now tested (not institution-authorized, not production-enabled).

## Queue (dependency order, unblocked first)
1. DONE 25 Oct: registrar (97 rows) and security (70 rows) registers; module register (135 apps, S-53). Remaining unreconciled: 15 sources.
   Fixed from them: tenant check on office-staff grants (SEC-034), withdrawn requests closed for the registrar (REG-039),
   reg.seat outbox rows applied (REG-060), reg_audit/reg_receipts append-only (REG-058).
   DONE 25 Oct: commit-time re-check (REG-036) and idempotent, resumable submit (REG-065).
   DONE 25 Oct: per-student commit serialization (REG-023).
   DONE 26 Oct: allow/deny decision log with correlation id (SEC-039, partial: forbid()/requireAccess denials not yet logged).
   Next from the registers, local and unblocked: DONE 26 Oct: per-user/per-tenant token bucket on ask.ts and onboarding (SEC-046 partial; SEC-045 is platform edge, not app-configurable);
   add/drop deadline and course withdrawal 'W' (REG-006/049).
2. DONE 25 Oct: waitlists and registrar-decided drop/atomic swap. Follow-up: C17 resolved 25 Oct (staff desk direct write removed); concurrent decide load test.
3. DONE 25 Oct: Integration Admin scopes and reconciliation runs (api/reconciliation.ts, Console tab, lib/reconRules tests).
4. Course Studio: assessments and submissions with gradebook release behind approval (area 4).
5. Prospective Student: program discovery and fit/cost comparison from published catalog (area 1).
6. Trace the 552-task board (S-12) against role-app-requirements and close duplicates.

## Decided 25 Oct
See `decisions-2026-10-25.md` (D1–D6). GitHub branch `zite/sync-2026-10-25` holds the Zite tree.
DONE 26 Oct: private file store (D2) — You → Files. DONE 26 Oct: files attach to course submissions and achievement evidence (locked at submit/verify); fixed cross-institution leak in the staff achievement review list. (Rate limits SEC-045/046 landed from the parallel session in 6ab3f6c.)
DONE 26 Oct: Course Studio assessments (asm-001). Not yet: rubrics, question banks reused across assessments, accommodations (extended time), regrade requests for assessments. Next: separate DDL credential (SEC-051) and staging database (SEC-061) need owner action; DONE 26 Oct: rubrics and grading delegation (team-001). DONE 26 Oct: delegated sections in the TA queue; course groups (grp-001). Next: advising appointments and office hours (MOD-042).

## Blocked (owner)
- Dependabot (4 alerts on GitHub main): all trace to better-auth 1.6.23 pinned inside zitejs (latest 0.9.148 too): GHSA-965c-763c-88jm
  critical (OAuth state as magic link), GHSA-r4xp-prcw-77qf high, GHSA-q84f-53jg-9ppm high, GHSA-44jh-23m7-hpcf low; fixed in 1.7.7.
  Hosted auth is Zite-run; reported to Zite 27 Oct at owner request. Blocked on Zite. Other lockfiles (pnpm, pipeline, video,
  workflow-lab, root) audit clean.
- Publish Semester / Company OS: founder presses Publish in Zite (publish_app was denied; do not work around).
- SSO/SIS live connections, private file storage, money movement, transcript posting: need institution authority and C5 decision.
- C14 repository authority (`app/` vs `zite/`); C13 role inventory; missing exports listed in `source-register.md`.

## Rules carried forward
No production deploy, live financial action, external send, destructive migration or permission change without explicit
approval. Synthetic data only. Student records never go to external model providers. Never authorize from client-supplied
role or tenant values. Never mark a feature complete because a page exists.

## Added 25 Oct: module inventory (parallel session)
`context/10-module-inventory.md` (135 modules, 13 domains) is now a build requirement. Each module has a row in
`docs/execution/module-build-records.csv`; every status column starts "not assessed" and moves only on evidence.
Next: fill owner, authority and operating mode, and map each module to the existing role apps.
`module-register.csv` (other session, same day) is a first-pass assessment of the same 135 modules against existing code.
Merge its evidence into `module-build-records.csv` after review and retire one of the two, so they cannot drift.

## 26 Oct: S-54 reconciled (expanded outline PDF)
- domain-families.csv: 45 families D01–D45; 34 partial, 11 missing (International/Veterans, Athletics, Housing, Dining, Facilities, Marketplace, Research admin, Research ethics, Library, HR/Payroll, Institutional finance). None are complete.
- proposed-roles.csv: 51 roles in 11 groups. 48 are proposals only and are not in roleApps.ts until the founder decides (C20). The other 3 are already covered by existing apps.
- cross-app-workflows.csv: 10 acceptance workflows XW-01..XW-10. 8 are partial and 2 missing; no end-to-end test has been run for any of them.
- Next: advising appointments and office hours (MOD-042, D14/D15). After that, accommodation extended time in assessments (closes a gap in XW-03).

## 26 Oct: Semester Institution, first workflow (S-55 §10)
- DONE: /institution command center (modules by role, waiting-on-you counts) and /institution/sections.
- Section request flow: department request → chair review (chair ≠ requester) → registrar authorization (≠ requester, ≠ approving chair; room and instructor clash re-checked under a per-term lock) → canonical Zite section created or adopted on retry (never duplicated) → instructor notified → opened for registration → reconciled against the request, with receipt SR-n.
- Evidence: 9 unit tests; 26 database checks rolled back, including a mutation check; typecheck. Browser NOT RUN.
- Gaps: creates in Semester's catalog only, with no write to the institution's SIS (operating mode: request_and_handoff for real tenants). No department membership or chair delegation. No demand view.
- S-56 recorded; capability-registry.csv started (first record).
- Next: Semester Faculty workspace (S-55 §11): Today for teaching, office hours, accommodation implementation, extended time. Then S-56 Prompt F readiness view, driven by capability-registry.csv.

## 26 Oct: Semester Faculty and office hours (S-55 §11, S-58 app factory)
- DONE: /faculty, the teaching home (sections taught, today's office hours, teaching tools, publishing office hours).
- DONE: /help/appointments for students (book, cancel before the start time, see host follow-ups).
- DONE: apt-001. Host slots have a capacity. Booking takes a per-student lock plus a row lock: no overbooking, no overlapping bookings, no host self-booking, and section office hours only for enrolled or completed students. Hosts cannot publish overlapping slots. A host cancel needs a reason and notifies booked students. Attendance and follow-up are host-only and only after the start time. The event log is append-only.
- FIXED: the race on legacy advising slots (read-then-update). Booking now goes through an atomic apt_claims insert and refuses slots that have started; cancel is allowed only before the start time.
- Role apps: "office hours", "appointments" and "availability" previously pointed at /plan and were marked existing. They now route to the real pages; the TA row is marked incomplete.
- S-57 (zip) and S-58 recorded: work-packages.csv (W01–W18) and acceptance-scenarios.csv (T01–T18), each with status, evidence and gaps.
- Next: accommodation extended time in assessments (W10/W11, T10). Then a readiness view driven by capability-registry.csv and acceptance-scenarios.csv (S-56 Prompt F).

## 26 Oct: Accommodation implementation, extended exam time (W10/W11, T10)
- DONE: acc-002. The accessibility office sets a 1.25x–3x time multiplier on an approved accommodation (staff only, not on their own request, with a version check; logged in acc_events).
- DONE: asm-002. At attempt start the database works out the extra minutes. They apply only if the student has an active letter for that section, the approval is still valid, and the assessment is timed. The extra time is stored on the attempt, so a resumed attempt keeps it. The late flag uses the extended limit and close time.
- The student sees their total time. Instructors see only "extended time applied" and never the request. The client never supplies the multiplier.
- Evidence: 5 unit tests; 18 database checks rolled back; a mutation check showed that removing section scoping leaks 1.5x into another course, and the test caught it. Browser NOT RUN.
- Next: readiness view (S-56 Prompt F) driven by capability-registry.csv and acceptance-scenarios.csv. Then T01, a cross-tenant sweep across all endpoints.
- BLOCKER (C23): apps/semester-institution (3nybmrumkp, from another agent session at 09:08) duplicates the section-request flow. Its "Section Requests" table is not in the live database and it fails typecheck. Founder to decide: keep it as a thin front door or remove it. One builder in Zite (D5) also needs re-confirming.

## 26 Oct: Brand kit applied to every Zite app (S-59)
- packages/components/brand:
  - semester-brand.css: Graphite and Brass colours mapped onto each app's shadcn variables. Parchment is the default; Ink is available behind .dark and is opt-in. The Ink chrome rail is used in both modes.
  - palette.ts: the source hex values and a contrast function.
  - Mark.tsx: the three-slab mark and the wordmark, using the geometry from the repo's mark.data.ts.
  - fonts/: 6 OFL woff2 files. Their sha256 hashes match the repo's app/public/semester-design/fonts.
- All 9 apps import the layer after index.css. Every Google Fonts @import is removed, so no third-party font request remains.
- The Wordmark replaces the text-only "SEMESTER" logos on splash screens, shell rails, onboarding, the site, Company OS, Developers and Security Lab.
- Deviation, recorded in palette.ts: the Ink warning ink is lifted from #cb7b62 to #d5937f to hold 4.6:1 on every dark surface.
- Evidence: tests/brand.test.ts (9 tests: contrast for every surface pair, mark centring, the import order guard and the no-Google-Fonts guard). The two structural tests failed before the change and pass after it. check_app passes for 8 of 9 apps; semester-institution was already failing (C23). Visual check NOT RUN (no browser).
- Not done:
  - The 13 grounds and 11 accents look picker from look.ts. Zite apps carry the canonical Parchment/Ink pair only.
  - The workspace-action orange is defined but not yet used.
  - Tenant branding envelope (ADR-0037).

## 26 Oct: S-60 recorded; grade moderation before release (W10)
- S-60 is mostly a restatement of S-55. faculty-modules.csv maps its 24 Faculty modules: 14 implemented, 6 partial, 3 missing (discussions, academic integrity, course accessibility review), and official grade handoff disabled by design.
- DONE: asm-003.
  - Instructors set a second-person review share (0–100%). Moderators agree, or adjust the total with a reason of 10+ characters, within the automatic score and the total points.
  - The grader and the student can never moderate.
  - Re-grading makes earlier reviews stale.
  - asm_release refuses until enough current reviews exist. The share cannot change after release.
  - The asm_moderations log is append-only.
- Evidence: 5 unit tests; 17 database checks rolled back; a mutation check showed that removing freshness lets a stale review count. Browser NOT RUN.
- Next (Faculty gaps): academic integrity case workflow; course discussions; accessibility check before publishing.

## 26 Oct: Academic integrity cases (int-001)
- /you/integrity is shared by students, reporting instructors and integrity officers. Officers are managed by administrators, who cannot grant themselves access.
- The instructor of record reports about a student who is Enrolled or Completed in their section. Reporting is idempotent, and only one live case is allowed per student and piece of work.
- The student responds.
- A course-level resolution stands only if the student accepts it; declining sends the case to the integrity office. The reporter can also refer directly.
- An officer who did not report the case, and is not its subject, records a finding with a sanction and a reason of 20+ characters.
- The student may appeal within 14 days. A different officer upholds, overturns or reduces the outcome.
- Visible only to the three parties. Notifications carry no details. No grade changes automatically.
- Evidence: 5 unit tests; 30 database checks rolled back; a mutation check showed that removing appeal independence lets the same officer decide the appeal. Browser NOT RUN.
- Faculty modules still missing: course discussions; accessibility check before publishing.

## 26 Oct: Course discussion upgraded; course accessibility review (Faculty list complete)
- Correction: course discussion already existed as a flat list. faculty-modules.csv had it wrong as "missing".
- Discussion, upgraded in place to api/courseDiscussion.ts + dis-001:
  - Threaded replies, kept within the same section and tenant.
  - Grading delegates may read, post and moderate.
  - Course staff remove a post with a reason and can restore it. The author is told why. The moderation log is append-only.
  - Hidden text stays visible only to its author and to staff.
  - Community now never lists course discussion groups.
- Accessibility: lib/a11yContentRules checks syllabus, materials, assignments and assessments.
  - Errors (image without alt text) block publishing an assessment.
  - Instructors record dated reviews (axr-001, append-only).
- Evidence:
  - Unit tests: 290 pass.
  - Discussion: 13 database checks rolled back, with a mutation check (cross-section replies).
  - Accessibility: mutation check (image-option alt); review log checked in a rolled-back batch.
  - Browser NOT RUN.
- Faculty modules: all 24 now implemented or partial. Official grade handoff stays disabled by design.
- Next: Institution side (W07). Teaching-assignment changes after a section is created, and a demand view for chairs. Then a cross-tenant sweep (T01) across endpoints.

## S-75 mapping (26 Oct)
S-75's schema is a proposed logical contract; it says itself not to migrate it over an existing database. Mapping:
- Identity/scopes/memberships/role_assignments → existing users, tenant memberships, staff role tables (granted_by <> user_id everywhere).
- extraction_candidates → `syl_reviews` (syllabus hub): nothing becomes a task or grade rule without the student accepting it.
- delegations / delegation_resources / delegation_actions → Family app grants; `delegation_access_events` DONE 28 Oct (below).
- organization_verifications / opportunity_versions / publications → Employers app; version-bound publication approval to be re-checked.
- institutions.timezone → DONE 28 Oct (below): Institutions "Time Zone" field; dining reads it.
- UI states `stale` and `uncertain` → not yet in components/kit — queued.

## S-76 — 32 enterprise and campus apps (26 Oct)
- Stage 0 DONE: 32-row register `apps/semester/src/lib/expansionApps.ts` (tested), shown in Console → Role apps. Today: 8 built, 5 partly covered, 11 not started, 8 blocked.
- E15 IT Service Management DONE (Campus → IT help, `/campus/it`, `its_*`): requests, incidents with problem review, security incidents visible only to security staff, owner-approved hash-pinned changes, emergency changes needing retrospective review. Not built: knowledge articles, configuration items, problem records as separate objects.
- E21 Health Services: registry entry only. Do not design.
- Blocked on owner decisions (money movement stays off): E07 Payroll, E10 Finance, E22 Advancement, E27 Authorized Payer; E19/E20 need specialist operational authorization; E03 needs placement boundaries.
- E18 Library DONE (Campus → Library, `/campus/library`, `lby_*`): catalog, loans, holds with ready window, renewals, desk returns, licence- and accessibility-reviewed requests. No reading history is kept; no fines (money stays off).
- E17 Transportation and Parking DONE (Campus → Parking, `/campus/parking`, `prk_*`): vehicles with normalised plates, zones with locked capacity and waitlists, permits, citations with logged plate corrections, appeals decided by a separate adjudicator role within 21 days. No payments, no location tracking; trips and schedules not built.
- E14 Assets and Inventory DONE (Campus → Inventory, `/campus/inventory`, `ast_*`): tagged assets with append-only custody and inspection history, disposal approved by a different controller, stock with CHECK (0 <= reserved <= on_hand) and locked rows, reservations → issue → partial returns, counts that create adjustments approved by someone other than the counter. Accounting treatment stays with Finance.
- E13 Facilities DONE (Campus → Facilities, `/campus/facilities`, `fac_*`): reports with minimum-necessary requester status, duplicate marking, work authorized before assignment, contractors barred from restricted locations and cut off at their end date, completion evidence required (table CHECK), inspection by someone other than the assignee, planned maintenance generated once per due date. Gap: parts are not yet reserved through Inventory (ast_reserve).
- DB-check counting fixed 26 Oct: a check row that evaluates to NULL used to count as neither pass nor fail; it now fails (`ok IS NOT TRUE`). Found by a Facilities mutant that went unreported. Checks are now kept in `apps/semester/dbchecks/` (Facilities first). DONE: the IT help, Library, Parking and Inventory checks were recovered from the session record, kept in `apps/semester/dbchecks/`, and re-run with the fixed counting: 38/38, 33/33, 34/34, 37/37. IT help had one hidden row (F19b): a fault in the check (same-statement read before the update), not in the app; split and re-run green.
- E16 Campus Identity and Card DONE (Campus → ID card, `/campus/card`, `idc_*`): office references only (CHECK refuses 8+ digit runs, so no card number is stored), one live card per person, restricted-zone access approved by security staff who did not request it, approval only *requests* provisioning and nothing is active or revoked until an officer records the controller's confirmation reference (table CHECK), lost card requests revocation of all access, replacement only after everything is confirmed revoked, unconfirmed requests flagged after 24h. No controller integration. DB check `dbchecks/idcard.ts` 29/29.
- Stage 6 (campus operations) is complete: E13–E18 built. Next without new approvals: stage 2 ecosystem/governance — E31 Records and Privacy Requests, E30 Partner Administration; then E28/E32 extensions.
- E31 correction (26 Oct): a new records-requests module was written over `src/lib/prvMigration.ts`, which already held APP-013 records rights (`recordsRights.ts`, `prv_*`). Caught at `git status` before commit; the file was restored and the new module discarded — nothing was committed, and its migration only ever ran inside rolled-back DB checks. E31 is reclassified **extend** (existing recordsRights + privacy.ts). Guard added: `tests/migrationNames.test.ts` fails when two migrations create the same table or function (verified red with a probe file). Next E31 step: extend recordsRights with holds, routing to record owners, per-record redaction, reviewer/approver separation, expiring delivery and appeals — inside `prv_*`, not beside it.
- E31 DONE 27 Oct by extending recordsRights in place (`prvMigration.ts`: prv_items, prv_responses, prv_holds, prv_hearings + 10 functions; prv_handle now requires an approved response to fulfil an inspect request and refuses amendments under a hold). UI on You → Privacy & data (student, record owner) and Console → Privacy office. DB check `dbchecks/recordsRights.ts` 30/30; removing the hold check turned F16 red. Behaviour change for existing users: an inspect request can no longer be fulfilled with a note alone.
- E30 Partner Administration DONE (`/partners`, `pta_*`; no existing partner-org system found — Employers verifies only employers, Transfer has a label only). Outside organizations register without an institution membership (the page renders standalone for them), manage their own members with delegated-admin limits, and apply per institution; partner managers verify, a *different* manager proposes hash-pinned terms with an end date and exact scopes, an org admin accepts; suspend/reinstate/offboard with records kept; `pta_live(tenant, org, scope)` is the single access check. DB check `dbchecks/partners.ts` 25/25; letting requested scopes count as granted turned F18 red. Gap: Marketplace, Research and Transfer screens do not yet call pta_live().
- E32 Audit and Assurance DONE (`/campus/audit`, `aud_*`). Institution audit lives in Semester, not Security Lab: Security Lab's `auditFindings` are the company's own RLS scan results, not institution audits. Grants are purpose-bound (one person, named areas, ≤180 days, never self-granted, revocation applies next request); evidence is a reference + SHA-256 (append-only; re-hash compare logs tamper suspicion); findings close only by an independent auditor citing post-remediation evidence. DB check 38/38; mutant (aud_live ignoring expiry/revocation) turned F30/F31 red.
- Security Lab hole fixed with E32: every Security Lab write endpoint (updateFinding, decideGate, savePolicy, updateCapability, addCapabilityEvidence, recordSimulationRun, requestSuiteRun) previously accepted any signed-in user; they now need the new `security_lead` company role. OWNER ACTION: open Company OS once (widens the co_roles check), then grant `security_lead` to whoever runs Security Lab — until then Security Lab is read-only. Reads now need `security_reader` or `security_lead` (decided 27 Oct).
- E28 Independent Learner DONE as an extension of the personal workspace (`/you/workspaces`, `aff_*`). Same account requests to join an institution by invite code (Pending until that institution's administrator approves; never Administrator; personal workspaces cannot be joined) and switches between its active workspaces. FIX ALONG THE WAY: lib/server.ts picked "the first Active membership" — admissions already creates a second active membership for applicants, so the tenant a request ran under depended on row order. Now `currentMembership()` picks one deterministically (stored choice if still active, else institution over personal/sample) for requireAccess, requireAction and getWorkspace. Nothing is copied between tenants; Export my data covers taking personal work along. NOT RUN: a live two-membership switch (would create real memberships); unit tests + mutant and a rolled-back migration check only.
- Partner access wired (27 Oct): a transfer partner with a live `propose_articulation` scope proposes articulation rules for its own courses from /partners (pta_propose_articulation → trf_propose_rule, tagged partner_org_id); a registrar decides in Transfer as usual and sees "proposed by the partner organization". DB check partnerLinks 8/8; mutant (pta_live check removed) 1/8. The other scopes (publish_listings, view_orders, submit_research_requests, post_opportunities, manage_course_mappings) have no target module yet — Marketplace and Research Administration (E23) do not exist; Employers keeps its own verification. Wire each when its module is built.
- E02 Continuing Education DONE (`/learn/continuing`, `cne_*`). Enrollment, payment, completion and refund are four columns that never overwrite each other; table CHECKs keep them consistent (no credential without completion, no completion without settled payment, no refund approval on a completed enrollment, refunds ≤ paid, nobody decides their own completion or refund). Public offerings accept independent learners without membership. No money moves: finance records external references. DB check 32/32; mutant (attendance threshold removed) turned F12 red. NOT RUN: browser walkthrough.
- 27 Oct: at the owner's request in chat, `security_lead` was granted to the owner's account (co_roles, granted_by "owner request 2026-10-27"). Security Lab is usable again for that account.
- E04 Instructional Design DONE (`/staff/design`, `idn_*`), reusing Course Studio's published store (crs_syllabus_versions via crs_publish_syllabus) rather than a second content store. The decisive test passes: editing a draft after approval voids the approval and cannot reach students; releases publish only the approved SHA-256; history kept. DB check 22/22 (it caught a NULL-comparison hole letting an unassigned designer through the edit check; fixed with IS NOT DISTINCT FROM); mutant (approval not voided) 16/22.
- E05 Human Resources DONE (`/you/work`, `hrm_*`). HR facts vs identity execution vs pay kept apart: appointments need officer + different approver; only an administrator executes the membership role change, recorded first so a failed membership write shows as drift. Decisive test (unit): ending employment removes only that job's role — a student stays a student, and a role still granted by another live job is kept. DB check 25/25; mutant (HR may execute access) 23/25. NOT RUN: live membership change.
- E06 Recruiting and Appointments DONE (`/you/recruiting`, `rcr_*` — `rec_` is taken). Decisive tests in DB check 22/22: committee recusal per applicant (no evaluation, recused evaluations never count toward the two needed), confidential references (chair/hiring only; hidden from recused members and applicants), offer approval tied to the exact SHA-256 version (edits supersede; stale or unapproved versions cannot be accepted). Mutant (recusal check removed from evaluate) 21/22 — the selection count still excluded the recused evaluation (second layer). HR handoff is a notification to HR officers; they propose the appointment in Work and HR.
- PROCESS FIX (27 Oct): the eight increments from E32 to E06 had been committed by hand inside the sandbox and never pushed to Zite main (they were synced to GitHub from the sandbox archive, so GitHub had them). They are now on Zite main as one squashed commit (be3b699) after the owner's authentication-settings commits. From now on every increment is committed with the Zite commit tool.
- E08 Procurement DONE (`/campus/procurement`, `prc_*`). Decisive tests in DB check 28/28: threshold-split detection (same requester, normalised supplier, inside window) forces two independent approvals; budget checked at final approval; two bids at the bid threshold; receiver ≠ buyer; duplicate invoice refused; match exceptions cannot reach finance until an approver independent of the buyer and the invoice enterer accepts; only finance posts, and only after an authorized handoff; no payment from Semester. Mutant (split detection off) 26/28.
- Role-app gap pass started 27 Oct (owner asked for every role app green). Rule kept: a capability turns green only when it works and is tested. Student organizations DONE (`/campus/organizations`, `org_*`, on the existing Zite Groups/Events): 13 capabilities across Organization Member/Officer/Admin now green. DB check 27/27 (secret ballot with voters and ballots in unlinked tables, one vote each, self-recognition and self-appointment refused, spending within line, treasurer cannot approve own spending or record own dues, suspension pauses activity, archive keeps records); mutant (double vote allowed) 23/27.
- Financial Aid Officer cluster DONE (`/you/aid`, fa-002 `fa_docs/fa_eligibility/fa_funds/fa_awards/fa_appeals`): 6 capabilities green. DB check aidOffice 20/20 (documents by reference only, verification before eligibility, need cap, fund budget, two-officer approval, student-only acceptance, SAP-ineligible blocks new awards, appeal decided by someone other than the original decider); mutant (need cap off) red. Design decision recorded in decisions-2026-10-27.md.
- Next: continue the gap pass cluster by cluster (largest red clusters first: Financial Aid Officer, Data Steward, Portfolio Council, First Year Staff, International Student Advisor, Admitted Student), interleaved with E09/E11/E12/E23/E24/E25.
- C26 DECIDED 27 Oct (decisions-2026-10-27.md): Zite authoritative, GitHub mirror, no Supabase/Vercel project authoritative. Was: which Supabase project (semester, Semester2, Semester-Platform, restore-drill) and which Vercel projects are authoritative per environment. No CI/CD or Supabase migration pipeline is added until decided; Zite remains the build and publish lane.

## 28 Oct (later session): queue items closed, Company OS suite repaired
- Student nav label overlaps (S-81 §3) resolved in Shell.tsx with matching page headers (a8716fd): Official grades / Released course grades / What-if grade tracker; Requests & letters vs Disability services; My housing; My career plan; Study workspace; My job & HR; Recruiting committees.
- Institution time zone DONE (2736114): Institutions gained a "Time Zone" field (Northgate set to America/Chicago; seed updated). Access carries the recorded zone from the caller's own institution record; dining reads hours and service dates in it via diningRules zoneOrFallback/localNowIn (fallback America/Chicago) and administrators set it from Dining → Locations (setTimeZone, Intl-validated, audited). dining.test 8/8 incl. 2 new; mutation on zoneOrFallback red. Other consumers (Faculty Today, office hours) still read their own clocks — follow-up, not done here.
- Hold journey completed (6a168b5): the missing student-response step. hld_responses (append-only, body 10–2000 by CHECK) + hld_respond; students answer from Registration (ownership checked against the Student Holds record; the placer is notified with a notice naming the hold only); the holds desk shows responses. dbchecks/holds RESULT pass=19 fails=0 with a released-hold-answer mutant; holdRules.test 10/10. The plan §6 journey now reads: hold → student response → authorized release → fresh eligibility, all built.
- delegation_access_events DONE (83750bd): fam_access_events (append-only) names the grant, student, viewer and categories per view. fam_log_access writes only against an Accepted, unexpired invitation bound to exactly that student and recipient ('not live' otherwise). Semester Family logs one event per live invitation behind each view; students see them at Privacy & data → "When family looked", which the share dialog already promised. dbchecks/familyInvites RESULT pass=30 fails=0 (F24–F30 new), ended-share mutant caught.
- Company OS test suite repaired (b590b05): roleRegistry.test.ts had been committed without its module; lib/roleRegistry.ts now derives the register from canonical roleApps.ts (status from evidence only: any surface → partial, none → missing) and carries XW-01..XW-10 with steps named by registry role. Suites 70/70 green; check_app ok for all ten apps; Semester suites 585 pass, 0 fail.
- Still open after this pass: course reuse (the teaching-shell copy — the term lifecycle half landed later the same day, below); the thin apps (Applicants, Family, Employers, Developers) beyond their front doors; E09/E11/E12/E23/E24/E25 and the role-app gap pass continue. Nothing here is deployed, institution-authorized or production-enabled; publishing stays the founder's action.

## 28 Oct (evening session): kit states, Wave 1 destinations, term lifecycle
- UI states stale/uncertain DONE (e2c6ff7): lib/freshness.ts (fresh/stale/unknown, 5-minute default) + routeLoadError; a failed refresh keeps the last good data and Loadable labels it with StaleNote instead of swapping in an error panel; UncertainNote names provisional values, first used by Transfer's degree-path planning panel; Institution States.tsx gained matching notes. freshness.test 4/4, boundary mutant red.
- Wave 1 shell destinations DONE (70729f2): Faculty and Institution gain a Personal manifest group — Action Center (/today), Mail (/mail), Calendar (/calendar), Workspace (/workspace), Files (/files) — mounting the shared Student pages behind C23 endpoint shims (inbox, getToday, manageTask, affiliation in both; files new in Institution). Student paths redirect. No capability gate: personal destinations serve the caller's own records, and the shared endpoints authorize server-side. check_app ok all ten apps; browser NOT RUN, so rendering in the two host apps is implemented_unverified.
- Term completion → archive → retention DONE (56599f8): term_lifecycle + term_complete/term_archive (approved calendar required, classes must have ended, each step once, cal_events + audit trail). Archiving deletes nothing; completed/archived terms refuse waitlist joins, drops and swaps in registrationChanges. Registrar UI on the Academic calendar page. dbchecks/terms RESULT pass=13 fails=0, both guard mutants caught; termRules.test 3/3; Semester suites 600 pass.
- Course reuse DONE (c78730d, later still): reuse_copy_shell + the courseReuse endpoint + a Reuse panel in Course Studio (Faculty shim included). Copies the latest syllabus as v1, assignments as fresh drafts from their latest published versions (due dates cleared, group sets detached), assessments as drafts with their latest question sets (windows shifted by the approved-calendar delta; flagged for review when no delta exists), visible materials and the AI policy — into a new section taught by the copier, duplicate labels refused. Student data is excluded by construction and by check: dbchecks/courseReuse RESULT pass=10 fails=0, mutants (due dates carried over; assessments copied published) caught. That closes the plan row 'term completion → archive → retention → course reuse'.

## 29 Oct (session 012Ao7hws4oRJVEmvS6aNJcj): role-app gap map re-verified; clusters claimed
- Owner asked to complete every missing and partial role-app capability (Atlas showed 274/460 built, 20/69 roles full). A read-only audit checked all 186 against code. Applied only evidence-backed changes in `lib/roleApps.ts`:
  - 8 turned green, each with a dbcheck or test;
  - 9 missing → incomplete;
  - 11 incomplete → missing (confirmed no code: Platform Admin flags/quotas/maintenance/configuration, attribution ×2, Customer Success adoption/success plans/QBRs, Content Owner licensing/accessibility);
  - 12 → new state `blocked`, waiting on owner decisions (immigration ×4, agency handoffs, counseling crisis routing, payment-processor reconciliation, vendor credentials, payment handoffs, marketplace orders/settlements/refunds).
- Now 282/460 built, 99 partial, 67 missing, 12 blocked; 21/69 roles full. Atlas and the Role apps page show "blocked" separately.
- **Claimed by this session, in order — please don't start these in parallel:**
  1. DONE 29 Oct: dbchecks for the five unverified promotions. studentAccounts 18/18, company-os migrations 25/25, campaigns 24/24, trustRoom 5/5, trustRules.test 12/12; mutants caught. 8 capabilities flipped to built: now 290/460 built, 92 partial, 66 missing, 12 blocked; 21/69 roles full.
  2. Office service layer. DONE 29 Oct for University Staff (osv-001: per-office queues, idempotent requests, claim/ask/refer/resolve/confirm/reopen-once, reviewed knowledge articles; dbchecks/officeService 48/48, 5 mutants caught; officeRules.test 13/13; pages /help/offices and /help/knowledge). University Staff is now a fully built role: 294/460 built, 89 partial, 65 missing, 12 blocked; 22/69 roles full. 29 Oct later: Support Agent help articles DONE (hkb-001, helpArticles 18/18), Billing Contact disputes DONE (dsp-001, disputes 18/18), Department Admin forms DONE (dfm-001, departmentForms 31/31). Department Admin staffing coordination and Department Chair demand DONE (dst-001, departmentStaffing 24/24; demandRules 8/8; /institution/staffing). Live Northgate read: 9 sections, none with capacity set, no seats yet, so demand shows 'No capacity set' until the registrar records capacities.
  3. Community safety. Moderator DONE 29 Oct (mod migration extended: mod_context for uninvolved moderators with two posts either side, mod_warn/mod_withdraw_warning with 7–180 day expiry and no account effect, mod_reverse by an uninvolved moderator within 30 days; dbchecks/moderation 32/32). Community Manager setup and health DONE 29 Oct (cmy-001: managers appointed by an administrator, communities with guidelines and open/request join policy, archive, join requests decided by another manager; communityHealth counts only; dbchecks/communities 26/26; communityHealth.test 6/6; /campus/communities). SECURITY FIX in the same commit: Campus toggleGroup let anyone join any group, including course discussions and groups with no institution; joining now goes through cmy_can_join (live data had none of either, so no existing member is affected).

## 29 Oct: capability evidence (Atlas "Implemented 9 of 131 / Tested 13 of 131")
- The Atlas dimension counts come only from signed evidence in Security Lab (capabilityEvidence). The 22 existing rows carry no reviewer; earlier sessions wrote them directly. This session did NOT write evidence.
- Built instead: Security Lab -> Capabilities -> Proposed evidence. 74 proposals (42 Implemented, 32 Tested) in apps/semester-security-lab/src/lib/evidenceProposals.ts, each citing commit 38a9033 files and checks re-run 29 Oct; guard test apps/semester/tests/evidenceProposals.test.ts (5/5; a bad path goes red).
- Accepting needs the security_lead role and records the evidence under the accepting person through lib/recordEvidence.ts (the only write path; manual entry uses it too). If all were accepted: Implemented 51 of 131, Tested 45 of 131.
- Owner decision: reviewer separation means one person cannot record both Implemented and Tested for the same capability. A second security lead is needed for the 32 Tested proposals whose Implemented is accepted by the same person.
- Not proposed (not built or not evidenced): SSO validation, SIS connector, staging environment, backups/restore, legal/HECVAT/pen test, registrar RLS and JWT API, billing entitlements, refunds, AI ag

## Later on 2026-10-28 — Applicants discovery and fit-and-cost built (session note)

- **Course reuse** landed first (c78730d): see the amended evening entry above — the term completion → archive → retention → course reuse plan row is closed.
- **Family schedule DONE (a04d37d, later)**: familyView assembles a Calendar-category schedule block (enrolled classes with meeting times by term + approved-calendar key dates for those terms); grades are now explicitly gated on the Grades category even though enrollment rows load for the schedule. New Schedule page at /schedule in the Family app, with the standard not-shared state when Calendar is not shared. The role register has no family role row; this list is the tracking record. Evidence: check_app all ten ok; suites 618 pass. Browser NOT RUN. Remaining thin apps: Employers candidate search and pipelines; Developers API keys and docs.
- **Employers candidate search + pipelines DONE (e8d0740, later)**: student discovery profiles (emp_profiles/emp_profile_save, edited on the student Career page; discoverable is opt-in and needs a headline) and emp_search_candidates, which returns only discoverable profiles at institutions that Approved the employer's partnership (crr_partners) — the same double gate as applying. Employers app gained /candidates (keyword + graduation-year filters, per-candidate application stages) and /pipeline (all applications by stage across postings, moves via the existing version-checked decide). Register: Employer 'approved talent discovery' now existing. Evidence: dbchecks/candidates 11/11, both gate mutants break the check; check_app all ten ok; suites 618 pass. Browser NOT RUN. Remaining thin app: Developers API keys and docs.
- **Institution front doors for campus operations DONE (29 Oct)**: the Institution app gained a Campus operations nav group mounting the shared, tested Student-app pages behind new C23 endpoint shims (procurement, contracts, budgetPlans, researchAdmin, grants, ethics): Procurement, Contracts, Budget & planning, Research admin, Grants, Ethics review. Institution staff no longer need the Student app for the E09/E11/E12/E23/E24/E25 modules; the endpoints keep authorizing every action server-side (buyer/manager/planner/officer/committee roles), and the pages render their limited non-staff states as designed. The six pages contain no host-specific internal links. check_app all ten ok; suites 632 pass. Browser NOT RUN — rendering in the Institution host remains implemented_unverified, like the Wave 1 shells.
- **S-82 §11 acceptance fixture DONE (29 Oct)**: apps/semester/dbchecks/acceptanceS82.ts — pass=18 fails=0 across the nine database-expressible scenarios (institution B isolation, student-also-TA, expired delegation, revoked delegate, interrupted upload scan gate, stale/released attempt grading, final-grade timeout reconciliation via ogr_post request keys, withdrawn enrollment access, empty course copy). Two remainders recorded in the build plan §8: dated instructor-of-record assignment expiry is not modelled (known gap, connectionRegister), and keyboard-only grading awaits the browser pass. check_app all ten ok; suites 632 pass.
- **Applicants visits DONE (dd8bd45, 29 Oct)**: adv_* — admissions staff (admin-granted) publish visit slots (tour / info session / interview, capacity, location, note; future only, closable); applicants book in the Applicants portal: one live booking per person per slot (partial unique index behind the friendly check), capacity counts guests across live bookings, cancellations free seats. Institution side: Visit slots page via the C23 shim (publish form, seats taken, attendee names, staff admin). Role register: Prospective Student visits missing → existing. Evidence: dbchecks/advVisits 15/15 (first run caught arithmetic errors in the check itself; corrected); both mutants break their checks; check_app all ten ok; suites 632 pass. Browser NOT RUN. The named build queue is now empty apart from the parallel session's gap pass and verification work (S-82 fixture, browser passes).
- **E25 Research Ethics and Protocol Review DONE (9146bc3, 29 Oct) — the enterprise queue from the 28 Oct plan is now COMPLETE** (E09, E11, E12, E23, E24, E25 all built): eth_* on the curriculum-committee pattern — researchers submit protocols (consent description required for subject research; optional E23 project link); committee members record one immutable review each; the chair decides only with ≥2 recorded reviews; the submitter can neither review nor be decided by themselves (conflict of interest, enforced in the functions); approvals require a future expiry, conditional approvals must state conditions, declines need a reason. Page /campus/ethics; non-committee users see only their own protocols. Expansion register E25 new → built. Evidence: dbchecks/ethProtocols 18/18; conflict and quorum mutants break their checks; check_app all ten ok; suites 632 pass. Browser NOT RUN. What remains in NEXT_ACTIONS overall: the role-app gap pass (parallel session), Applicants visits, the S-82 acceptance fixture, and browser verification of implemented_unverified surfaces. Blocked rows stay blocked on owner decisions.
- **E24 Grants and Sponsored Projects DONE (f00dbca, 29 Oct)**: grt_* on the E23 registry — an officer records a grant against a registered project; a different officer verifies the sponsor with a recorded note before activation (table CHECK: active/closed requires verified_by — the scholarship sponsor-verification pattern); decline needs a reason; the PI or an officer files cumulative spend reports on active grants (cannot exceed the award, cannot go down, append-only). Reports are records; no grant money moves. Page /campus/grants; PIs see only their own grants. Expansion register E24 new → built. Evidence: dbchecks/grtGrants 16/16, both mutants break their checks; check_app all ten ok; suites 632 pass. Browser NOT RUN. Remaining enterprise: E25 only.
- **E23 Research Administration DONE (d8be5b0, 29 Oct)**: rsa_* — members submit research requests; research administrators (admin-granted) review, approve by assigning the unique project code that registers the project (friendly check backed by a partial unique index), decline with a required reason, and close projects; append-only events. Partner organizations submit collaboration requests gated on membership + a live submit_research_requests scope (pta_live) — the last dangling partner scope now has its module. Institution page /campus/research; partner panel on the Partners page per live relationship. Expansion register E23 new → built. Evidence: dbchecks/rsaRequests 16/16; scope mutant breaks exactly its check, code mutant stopped by the unique index; check_app all ten ok; suites 632 pass. Browser NOT RUN. Remaining enterprise: E24, E25.
- **E11 Budget and Planning DONE (3de89dd, 29 Oct)**: bdg_* — admin-granted planner/approver roles; a planner drafts a fiscal-year plan of quarterly amounts per budget code (one open plan per year; proposing freezes lines); a different approver adopts it (the author can never approve their own) and adoption supersedes the year's previous approved plan, so exactly one approved plan per year is in force; send-back needs a reason. Page at /campus/budget-planning with the line editor, decide controls, and a variance table for the approved plan against procurement commitments (prc_used, labelled as commitments to date). Plans move no money; E10 stays blocked. Expansion register E11 new → built. Evidence: dbchecks/bdgPlans 16/16, both mutants break their checks; check_app all ten ok; suites 632 pass. Browser NOT RUN. Remaining enterprise: E23, E24, E25.
- **E12 Contracts DONE (7fc42a2, later)**: cnt_* mirrors the pta hash-pinned acceptance — administrator-granted contract managers draft contracts with partner organizations (a relationship must exist) and propose terms; cnt_hash pins terms + value + end date; only an org administrator accepts, only the exact hash at the current version, and the table CHECK makes active-with-mismatched-acceptance impossible. Amending an active contract returns it to proposed and voids the acceptance. Institution UI at /campus/contracts; partner admins accept from the Partners page under each relationship. Expansion register E12 new → built. Evidence: dbchecks/cntContracts 17/17, both mutants break their checks; check_app all ten ok; suites 626 pass. Browser NOT RUN. Note: the first commit attempt hit a Shell.tsx conflict with a parallel session's nav changes (Communities item) — resolved by keeping their nav and inserting the Contracts item. Remaining enterprise: E11, E23, E24, E25.
- **E09 Supplier Portal DONE (60a51b2, later)**: buyers link a procurement supplier name (prc_key) to a partner organization (sup_link/sup_unlink in lib/supMigration.ts); the org's members then see that name's purchase orders — with received/invoiced totals — only while their agreement's view_orders scope is live (sup_orders gates on the link join AND pta_live), and can acknowledge or report shipped (sup_ack; append-only prc_po_acks + a prc_events row for the buyer's trail). Partners page gained a Supplier orders panel per live relationship; Procurement gained a buyer-only Supplier portal panel. This gives the view_orders partner scope its target module (see the 27 Oct partner note above). Expansion register E09 new → built. Evidence: dbchecks/supPortal 11/11, both gate mutants break exactly their check; check_app all ten ok; suites 618 pass. Browser NOT RUN. Remaining enterprise: E11, E12, E23, E24, E25.
- **Developers API keys + docs DONE (0b58078, later)**: token rotation was the missing key operation — dev_rotate_token lets the owning institution replace an install's token in place (active installs of live apps only, 90-day cap, audited; the old hash is overwritten so the old token dies on the next call), wired into devApps as a rotate action with the shown-once banner and a Rotate confirm beside Revoke. The Developers app gained a My apps tab (myApps endpoint, no reviewer role needed): the developer's production apps with review state/note, installs at institutions with expiries and call counts, and self-suspend; token values are never exposed to developers. The API reference now shows per-scope example responses generated from the same payloads the request tester returns, plus a token lifecycle section. Evidence: dbchecks/devKeys 9/9, both gate mutants break exactly their check; check_app all ten ok; suites 618 pass. Browser NOT RUN. The thin-app queue from the 28 Oct plan is now closed; what remains is the enterprise set (E09/E11/E12/E23/E24/E25), the role-app gap pass, and Applicants visits.
- **Applicants program discovery + fit-and-cost DONE (be3f2b9)**: public listings gained institution-published cost/duration/format/requirements via spg_save_details (Institution Public programs editor); the Applicants Programs page gained search, institution/format/accepting filters, per-person shortlists (app_shortlist: published-only, cap 12) and a four-way side-by-side comparison labelled as institution-published figures with a confirm-in-the-catalog note. Register: Prospective Student discovery + fit/cost now existing. **Visits** remains missing — it needs admissions visit scheduling, its own increment. Evidence: dbchecks/programDiscovery 16/16 with mutants caught; check_app all ten ok; suites 613 pass. Browser NOT RUN (implemented_unverified for the new pages).ent bounds, institution IT/trust/analytics workspaces, and the remaining governance rows.

## 29 Oct morning: research data governance, part 1 (Institutional Researcher)
- DONE: rsd-001 cohorts, datasets and reproducible snapshots (/staff/research). Researchers appointed by an administrator; data stewards (dgv) approve exact definitions; approved versions are never edited; snapshots run only approved datasets, pass small-cell suppression twice (researchRules in code, rsd_snapshot in SQL), pin definition hash and code version, and say whether a re-run reproduces the last output. Aggregate SQL moved to lib/analyticsServer.ts and shared with institution analytics (same queries, now one place). dbchecks/researchData 27/27; researchRules.test 7/7. Live Northgate read: everything suppressed (fewer than 10 people), the cohort term join matches real enrollments.
- DONE: part 2, Research Partner (rpp-001, lib/rppMigration.ts). Partner side is the Developers app "Research access" tab (api/researchPartner.ts): protocol request to one institution naming its approved dataset versions, ethics reference and retention; accepting a data-use agreement bound to the terms hash; reading only the stored, suppressed snapshots rpp_read_ok allows; submitting outputs citing those snapshots. Steward side is /staff/research-protocols in the Student app (api/researchProtocols.ts): governance review bound to the protocol hash and never by the partner, agreements within the retention period, revocation with a reason, output review where text with a number from 1 to 9 needs explicit confirmation. dbchecks/researchPartners RESULT pass=33 fails=0; five mutants caught (three by checks, two by the table constraints). No e-signature, no export, no person-level data. Browser NOT RUN.
- Owner: appoint data stewards (dgv) at a real institution before any partner can be reviewed; decide whether agreements need an external legal signature process.

## 29 Oct: tenant control plane (tcp-001)
- DONE: University Admin at /console/control (api/controlPlane.ts, pages/ControlPlane.tsx): structure (colleges/schools/divisions, nested without cycles, departments assigned, archive refused while children or departments remain), versioned policies (another administrator approves the exact text; approving retires the previous version), allow-listed configuration validated in SQL with expected version and reason, entitlements shown read-only, staged rollout off -> pilot (named roles) -> all (pilot ran a day, a different administrator, never during maintenance).
- DONE: Platform Admin at Company OS /platform (api/platformAdmin.ts, PlatformPage.tsx): tenant fleet, entitlements with seat limit and daily API-call quota (revoking turns the rollout off), flags (kill switch immediate, default-on needs a second platform admin, per-institution overrides with reason), maintenance windows (1 hour notice, max 8 hours, shown in-app only).
- New company role platform_admin in co_roles; no code grants it. Constraint widening checked in a rolled-back transaction: existing 12 grants unchanged.
- Evidence: dbchecks/controlPlane RESULT pass=40 fails=0; 7 mutants caught. Browser NOT RUN.
- Role register, kept honest: built = University Admin structure, policy, configuration; Platform Admin tenant fleet, maintenance. Incomplete = entitlements, rollout, flags, platform configuration, quotas, because no module consults tcp_module_on / tcp_flag_on / tcp_quota_ok yet. NEXT: wire those checks into the gated modules (family portal, research partners, developer API, AI assistant).
- Still open: quotas are stored and checked by tcp_quota_ok but not yet enforced in the developer gateway (other session's area; left incomplete). Infrastructure health stays incomplete. tcp_module_on is not yet consulted by the modules themselves.
- Owner: grant platform_admin to the right people (two, so flag defaults can be approved); record entitlements from signed orders.
- DONE (later, 29 Oct): gating wired. tcp_gate (unmanaged institutions keep every module on; managed ones need entitlement + rollout; a module.<name> flag acts only as a stop: killed = off everywhere, overridden off = off there), tcp_consume (daily quota, only managed institutions limited), tcp_manage (platform admin puts an institution under entitlement control, with a reason). lib/tcpServer.ts requireModule/moduleOn, fail closed. Enforced today: AI assistant (api/ask.ts, with quota) and research partners (Developers researchPartner: submit, outputs and snapshot reading). TCP_ENFORCED lists them; both consoles label every other module "not yet enforced"; tests/tcpEnforced.test.ts (4/4) fails when a listed module stops calling the gate (checked by removing it from ask.ts). controlPlane now 49/49, 11 mutants caught (one real design bug found: a module flag's default-off would have switched the module off). Northgate verified unmanaged: AI assistant and research partners stay on.
- NEXT: enforce the remaining six modules (proctoring, payments, marketplace, family portal, employer network, developer API). Family, Employers and developer API code belong to the other session; ask before editing.

## 29 Oct: deans and college roll-ups (dea-001)
- DONE at /institution/college (api/deans.ts, pages/College.tsx). Deans are appointed to a control-plane unit by an administrator (never themselves) and cover departments in that unit and every unit nested under it. Department planning by the chair, decided by a covering dean; college plan by the dean, decided by an administrator; never by the author, bound to the plan seen. Resource requests by chairs, decided by a covering dean against the year's allocation of the dean's unit (set by an administrator, never cut below what is approved); planning figures only, no money moves. Escalations raised by chairs, acknowledged/resolved by a covering dean, flagged after 5 days. College motions: electorate = chairs of departments under the unit at opening; one changeable vote each; close after the deadline or when everyone voted; carries with quorum (half) and more yes than no. Department health: counts of waiting section requests, open staffing needs, form responses, escalations, resource requests and the latest plan.
- Evidence: dbchecks/deans RESULT pass=29 fails=0; 6 mutants caught. Health query run on Northgate live tables (rolled back): runs; Northgate has 0 departments set up, so health is empty there until an administrator creates departments and units. Browser NOT RUN.
- Still open: program review stays incomplete (/institution/programs).
- DONE (later, 29 Oct): program review (prw-001) at /institution/program-review. A dean over the department opens a review of a published program (one at a time per program); the chair writes and submits a four-section self-study; the dean records an external reviewer who declared no conflict, then the report, findings and an advisory recommendation; the chair answers every finding with dated, owned actions; another dean (never the plan's author) approves the plan seen; actions are tracked (overdue flagged) and the review closes when all are done or with a carry-forward note. Recommendations never change the program. dbchecks/programReview RESULT pass=25 fails=0; 5 mutants caught (the first run showed the self-approval check untested; R25 added). Dean role now fully built. Browser NOT RUN.
