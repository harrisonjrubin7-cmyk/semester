# Stream 19: Gradebook, degree audit, advising and transcripts

Branch `semester/academic-records` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/AcademicStudent.jsx`, `ui_kits/semester-app/AcademicStaff.jsx`, `ui_kits/semester-app/RecordsFlow.jsx`, `ui_kits/semester-app/AdvisingEngine.jsx`, `ui_kits/semester-app/AcademicPlan.jsx`, `ui_kits/semester-app/ExecAdvisor.jsx`, `ui_kits/semester-app/Exceptions.jsx`, `ui_kits/semester-app/Guardrails.jsx`, `ui_kits/semester-app/DegreeAI.jsx`, `ui_kits/semester-app/TermPlanner.jsx`, `ui_kits/semester-app/AssignmentFaculty.jsx`, `ui_kits/semester-app/AssignmentStudio.jsx`
- Source specifications (copy to `docs/specifications/source/`): `uploads/alternatives.pdf (copy of 'ons remain…' PDF)`; `uploads/degree-advising-spec.pdf + FERPA compliance audit checklist PDF`; `sis-advising-flow.pdf`; `FERPA compliance audit checklist for student advis.pdf`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 19)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Also: institution calendars
`#/institution/calendars` (TcxCalendar, `TermCalendars.jsx`): calendar record per institution with original term names, regular vs optional terms, separate exam and census dates, local credit unit, normal/min/max load, and effective dates (e.g. UNSW 2028 change). 20-university reference matrix. Never assume Fall/Spring/Summer or convert credit units silently. Tabs: Matrix (filter + CSV export), Credit converter (US hours ↔ ECTS, adjustable ratio default 0.5, workload columns, refuses MIT/quarter/UK/AU units), Teaching weeks (only evidenced entries). Specs: `x-term-structures.pdf`, `x-term-structures-2.pdf`.

## Screens to build (32)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/student/coursework` | Assignment Studio | Coursework (AssignmentStudio.jsx) |
| `#/student/quiz` | Quiz 4 (live) | Quiz (AssignmentStudio.jsx) |
| `#/student/feedback` | Feedback | Feedback (AssignmentStudio.jsx) |
| `#/student/briefing` | Briefing | Briefing (DegreeAI.jsx) |
| `#/student/recommendation` | Recommendation | Recommendation (DegreeAI.jsx) |
| `#/student/degree` | The degree | DegreeAudit (DegreeAI.jsx) |
| `#/student/gradebook` | Gradebook | ArxGradebook (AcademicStudent.jsx) |
| `#/student/transcript` | Transcript | ArxTranscript (AcademicStudent.jsx) |
| `#/student/scenario` | What-if path | RfxScenario (RecordsFlow.jsx) |
| `#/student/regplan` | Plan registration | ApxRegister (AcademicPlan.jsx) |
| `#/student/majors` | Explore majors | ApxMajors (AcademicPlan.jsx) |
| `#/student/nextsteps` | Executive Advisor | IexAdvisor (ExecAdvisor.jsx) |
| `#/faculty/builder` | Assignment builder | Builder (AssignmentFaculty.jsx) |
| `#/faculty/bank` | Question bank | QuestionBank (AssignmentFaculty.jsx) |
| `#/faculty/inbox` | Submission inbox | Inbox (AssignmentFaculty.jsx) |
| `#/faculty/gradebook` | Gradebook | Gradebook (AssignmentFaculty.jsx) |
| `#/faculty/requests` | Requests | Forms (AssignmentFaculty.jsx) |
| `#/faculty/gbcontrols` | Gradebook controls | ArsFacultyGradebook (AcademicStaff.jsx) |
| `#/faculty/posting` | Grade posting | RfxPosting (RecordsFlow.jsx) |
| `#/institution/term` | Term planner | TermPlanner (TermPlanner.jsx) |
| `#/institution/records` | Academic records | ArsRegistrar (AcademicStaff.jsx) |
| `#/institution/substitutions` | Substitution engine | ExxEngine (Exceptions.jsx) |
| `#/advisor/audit` | Shared degree audit | ArsAdvisorAudit (AcademicStaff.jsx) |
| `#/advisor/engine` | Recommendation engine | AexEngine (AdvisingEngine.jsx) |
| `#/advisor/access` | Permission walkthrough | GrxWalk (Guardrails.jsx) |
| `#/advisor/guard` | Explanation guard | GrxGuard (Guardrails.jsx) |
| `#/trust/ferpa` | FERPA checklist | ApxFerpa (AcademicPlan.jsx) |
| `#/trust/release` | Model release gate | GrxRelease (Guardrails.jsx) |
| `#/trust/drills` | Direct-control drills | ExxDrills (Exceptions.jsx) |
| `#/trust/fieldmap` | SIS field map | IexMap (ExecAdvisor.jsx) |
| `#/alumni/transcript` | Transcript | ArxTranscript (AcademicStudent.jsx) |
| `#/os/matrix` | Academic records matrix | RfxMatrix (RecordsFlow.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Executive Advisor (6 Oct):** ExecAdvisor.jsx (IEX*): #/student/nextsteps (5 questions answered with source + link, recommendation cards with requirement or “does not advance”, eligibility, why now, unlocks, condition, sections + freshness, alternative; save/compare/share/add to registration draft; 6-engine boundary), #/trust/fieldmap (14 SIS fields → tables, purpose, exposure limit, filter). From sis-advising-flow.pdf.
- **Exceptions + drills (6 Oct):** Exceptions.jsx (EXX*): #/institution/substitutions (6 exception types with non-effects, delegated-authority gate, approve/revoke/corrected version with supersedes id, 4-cr→3-cr allocation, prerequisite not satisfied by substitution, doesn’t carry into what-if program, JSON decision record), #/trust/drills (6 direct-control exercises with owner + status cycling, PII storage defaults). From FERPA compliance audit checklist for student advis.pdf.
- **Guardrails (6 Oct):** Guardrails.jsx (GRX*): #/advisor/access (9-step advisor permission walkthrough with assignment/shared-scenario/delegated-grant toggles + mid-session revocation), #/advisor/guard (AI explanation checked against structured result; blocks invented exceptions, overstated status, dropped conditions/unknowns; falls back to template), #/trust/release (7-item model release gate). DPA clauses 6 and 9 expanded (30-day subprocessor notice, derived-store deletion). Fixed focus loss in #/social/studio composer (inner components → function calls).
- **Majors + registration + FERPA (6 Oct):** AcademicPlan.jsx (APX*): #/student/majors (search by topic, requirement tree with your applied courses, admission conditions separate, compare with declared, 7-state declaration flow), #/student/regplan (requirement-first, plain-language search → visible filters, 8 applicability labels, grouped sections, compare 2, no-results relaxations, alternative schedules, pre-registration check ready/conditional/unavailable), #/trust/ferpa (27-item third-party checklist with status cycling + role view models). From uploads/degree-advising-spec.pdf + FERPA compliance audit checklist PDF.
- **Advising engine (6 Oct):** AdvisingEngine.jsx (AEX*): #/advisor/engine — 8-step pipeline with the 5 eligibility states, prerequisite path (CHEM 2210 → 2220 → 3010, toggle official result incl. alternative path), whole-term bundle validator (conflict / corequisite / load, labelled academic vs scheduling), proactive loop with idempotency-key duplicate demo, 13 acceptance criteria. From uploads/alternatives.pdf (copy of 'ons remain…' PDF).
- **Social + PRD controls (6 Oct):** Social.jsx (SOC*): #/student/feed (For You/Following/Campus/Communities/Network/Explore, 8-format composer with audience/comments/tags/reshare/download-off/hide-likes, threads, polls, video mode, mute/block/report, official-campus badge), #/student/me-social (modular profile, reorder/hide sections, field visibility, mentor preview, portfolio project page), #/student/social-privacy (12 controls, keyword filters, comment approval, moderation flow). Controls.jsx (CTX*): #/student/firstrun (4-step first login + 2-action activation), #/trust/permissions (4-check permission evaluator + spec cases), #/institution/exceptions (7-state exception, student/registrar views, delegated authority gate), #/finops/payments (payment-intent → ledger postings + 7 validation hooks; hold lifecycle + hold record), #/applicant/status, #/os/flows (11 demo flows). RecordsFlow.jsx (RFX*): #/faculty/posting (11-step pipeline, 4 state tracks, per-student partial rejection, configurable approval), #/student/scenario (what-if with snapshot, allocation changes, stale + recompute, draft plan), #/os/matrix (role matrices, integration note, FERPA). Uploads with & or () in names were copied to uploads/prd-figma-screen.pdf and uploads/social-outline-2.pdf to read.
- **Gradebook / audit / transcript (6 Oct):** AcademicStudent.jsx (ARX*; shared arxCalc on window): #/student/gradebook (all-course dashboard, category math with drops/excused/missing, current vs projected, what-if, target planner incl. not achievable, feedback + submission receipt, grade question, history) and #/student/transcript (record, unofficial PDF, 3-step official order with consent/fee/timing, order states, incoming upload = unverified, correction) — also #/alumni/transcript. AcademicStaff.jsx (ARS*): #/faculty/gbcontrols (versioned policy, graded≠released, override with reason + original kept, final-grade submit with accept/reject + change request, history), #/advisor/audit (shared audit, locked plan + draft, what-if, recommend-not-approve exception, visible vs restricted notes, decisions), #/institution/records (orders, intake, transfer evaluation, posting, access log, flow + record ownership).
- **Assignment Studio, student side:** AssignmentStudio.jsx covers #/student/coursework, studio/<id>, quiz and feedback. Faculty side in AssignmentFaculty.jsx: #/faculty/builder, bank, inbox, grade, gradebook, requests.
- **Degree and AI:** user/015_degree_and_ai.sql; DegreeAI.jsx (#/student/degree, recommendation, briefing).

## Tasks
1. Map each screen to the repo’s routing and layout; reuse existing components from the design system bundle before adding new ones.
2. Define or extend the data model and API for every state the screens show. Server-authoritative for permissions, grades, money and enrollment.
3. Enforce authorization on the server for every read and write (deny by default). Add negative tests.
4. Implement empty, loading, error, offline and permission-denied states shown in the prototype.
5. Write unit, integration and accessibility tests for each behavior bullet. Use synthetic data only.
6. Keep copy and labels from the prototype unless the repo’s content guide says otherwise.

## Exit gates
- [ ] Every screen above reachable from navigation for the right roles and absent for others
- [ ] Every behavior bullet covered by a passing test
- [ ] Typecheck, lint, unit, integration and a11y checks pass (`handoff/verify.sh`)
- [ ] No production data, secrets or remote migrations touched
- [ ] Report written to `docs/execute/19-academic-records-report.md` with evidence; PR opened; STOP for human review
