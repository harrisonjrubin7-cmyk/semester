"""The 40-domain source for docs/master.

Edit this file, then run `python3 docs/master/tools/render.py` from the
repository root. It rewrites the five documents rendered from it (the domain
catalog, capability matrix, data authority matrix, replacement gates and the
domain section of the backlog).

Every rating below is a reading of the repository on 2026-10-05 (origin/main
790ebbf) taken from four read-only audits; none was measured in a running
production system. `ev` lists the repo-relative paths that settle a rating.
A rating may be lowered by editing this file; raising one needs a path in `ev`
that proves it and, above `tested`, a current artifact under docs/evidence/.
"""

# Maturity vocabulary (the first axis). One or two per domain.
NS = "Not started"
DD = "Designed/documented"
PL = "Planned"
NI = "Native but incomplete"
NV = "Native and verified (repo-level)"
IN = "Integrated"
TR = "Transitional"
PO = "Pilot-only"

# Review gates (the second axis). Each is a flag meaning "this review is required and not evidenced".
GATES = {
    "SEC": "Requires security review",
    "PRIV": "Requires privacy/legal review",
    "A11Y": "Requires accessibility review",
    "INST": "Requires institutional approval",
    "MIG": "Requires migration",
    "REC": "Requires reconciliation",
    "RBK": "Requires rollback",
}

# Readiness (the third axis). Exactly one per domain.
UNSAFE = "Unsafe to activate"
NOTREADY = "Not ready"
COND = "Conditional: invitation-only individual validation"
# "Ready for pilot", "Ready for production" and "Ready to become authoritative
# system of record" are defined in SEMESTER_DOMAIN_REPLACEMENT_GATES.md and are
# held by no domain today.

DOMAINS = []


def D(**k):
    DOMAINS.append(k)


D(id="D01", name="Student OS", ph=2, seat="product", pri="P1", mat=[NI], gates=["PRIV", "A11Y"], ready=COND, ladder="tested",
  ev=["app/src/screens/Today.tsx", "app/src/lib/today-center.ts", "app/src/domains/today/", "docs/TODAY-ACTION-CENTER.md"],
  vision="One daily surface that says what is due, what is at risk and what to do next, from the student's own data and any connected sources, labelled by authority.",
  users="Students (all levels), transfer and prospective students.",
  jobs="Know what needs attention today; act on it; understand where each fact came from.",
  cur="Student device state with optional account sync; seeded sample semester by default.",
  nat="Semester for student-owned planning data; official facts stay with the institution and carry a source label.",
  integ="Read-only connectors for deadlines, calendars and LMS context; official handoff for institutional actions.",
  model="Device state (state/slices), tasks/notes/productivity_* tables, source_records and source_freshness_events.",
  scope="Account-scoped; tenant context only for institution-sourced items.",
  caps="Own-data access by auth.uid(); no role reads private work by default.",
  cls="T2 (own work); T3 when institution-sourced.",
  consent="Account-owned; sharing is opt-in per item (advisor and family shares are separate domains).",
  ai="Explains and ranks; never decides an official matter; cites the item and its source.",
  cut=None,
  comm="Included in individual Plus ($7.99/mo, $59/yr; not on sale) and institutional packages (proposed, unapproved).",
  cs="Student onboarding playbook (docs/commercial/STUDENT-ONBOARDING-PLAYBOOK.md); invite-only cohort.",
  kpi="Weekly active share of a cohort that completes one Today action; deadline-miss rate (self-reported); time to first action.",
  deps="D02, D03, D06, D26, D27", risks="Seeded data read as real; device-only state lost on a new device; no accessibility evaluation.",
  br="domain/d01-student-os", tests="app/src/domains/today/*.test.ts; app/src/lib/today-center.test.ts; golden-path smoke",
  nxt=[("P1", "Flip the seeded semester to an explicit sample banner everywhere (SampleMark coverage test)"),
       ("P1", "Server-side sync of Today inputs for signed-in students with a restore test"),
       ("P2", "Source-freshness cards on (module.source_freshness_cards) behind a tenant gate")],
  repl=None, slo="C2")

D(id="D02", name="Workspace and productivity", ph=2, seat="product", pri="P1", mat=[NI], gates=["SEC", "PRIV", "A11Y"], ready=COND, ladder="tested",
  ev=["app/src/screens/Calendar.tsx", "app/src/screens/Mine.tsx", "app/src/screens/Write.tsx", "app/server/productivity/", "supabase/functions/calendar/", "supabase/functions/fetchcal/"],
  vision="Calendar, tasks, notes, documents, files and focus tools that are connected to courses, deadlines and the student's obligations.",
  users="Students, faculty (own notes and calendars), staff.",
  jobs="Capture, plan, write, store and find work; share it with a group; keep it across devices.",
  cur="Device (localStorage/IndexedDB); a real productivity service exists but is off unless a deployment enables it.",
  nat="Semester (student-owned content). Mail and files stay device-local until a sync design is accepted.",
  integ="ICS feeds, Google/Microsoft/Zoom calendars (student-directed), office-format import/export.",
  model="tasks, notes, productivity_workspace/task/event, private.productivity_command, calendar_feeds, push_queue.",
  scope="Account; group workspaces by membership.", caps="Owner; group member; (no staff read of personal content).",
  cls="T2; T3 when it holds institution records.", consent="Account-owned; group sharing is explicit; support access is time-limited and logged.",
  ai="Drafting and summarising on the student's own content under course AI rules; disclosure tools.",
  cut=None, comm="Individual Plus; institutional bundle.", cs="Student onboarding; faculty enablement for course notebooks.",
  kpi="Retention of weekly use; sync-conflict rate; task completion before due.",
  deps="D01, D26, D28", risks="Files IndexedDB-only; mail draft-only; Tasks API not mounted by default; offline engine flagged off.",
  br="domain/d02-workspace", tests="app/server/productivity/*.test.ts (incl. postgres.integration); app/src/domains/tasks; packages/offline-sync tests",
  nxt=[("P1", "Mount /api/productivity in a staging deployment and run postgres.integration against it (Phase 1 step 9)"),
       ("P2", "File sync design (tenant-prefixed keys, quarantine, retention) accepted as an ADR before any build"),
       ("P2", "Turn on offline_engine_tasks for the invited cohort with a conflict-rate readout")],
  repl=None, slo="C2")

D(id="D03", name="Path and degree planning", ph=2, seat="product", pri="P1", mat=[NI, TR], gates=["INST", "MIG", "REC"], ready=NOTREADY, ladder="building",
  ev=["app/src/screens/Pathway.tsx", "app/src/screens/Degree.tsx", "app/src/lib/degree.ts", "app/src/lib/graduation.ts", "docs/DOMAIN-REPLACEMENT-REGISTER.md"],
  vision="A student sees a verified path to graduation, tries scenarios, and knows which advice comes from the official audit and which is an estimate.",
  users="Students, advisors, registrar.", jobs="See remaining requirements; plan terms; test a major change; prepare for registration.",
  cur="Institution degree-audit system (unconnected); student-entered data in Semester.",
  nat="Semester for planning; the institution keeps the official audit until a catalog/rules engine passes the replacement gates (register: native row not-started).",
  integ="Read-only degree-audit status; catalog import; transfer articulation rules.",
  model="term_plan_courses, graduation_scenarios, articulation_rules, transfer_evaluations, catalog_sections.",
  scope="Tenant for catalog and rules; account for plans.", caps="record:read; record:propose; articulation:approve",
  cls="T2 plans; T3 audit results.", consent="Advisor visibility by student share.",
  ai="Explains a requirement from the official rule; never computes eligibility (deterministic engine does).",
  cut="Native catalog and rules engine (effective-dated, versioned) run beside the institution audit; reconcile every student's remaining-credit total; cutover per program; roll back by re-pointing the Source label to the institution audit.",
  comm="Institutional module.", cs="Registrar and advising implementation plan.", kpi="Audit agreement rate (native vs official) by program; plan-to-registration conversion.",
  deps="D10, D11, D12, D25", risks="Planning engine is client logic over student-entered data; no institution-verified catalog.",
  br="domain/d03-path", tests="app/src/lib/degree*.test.ts; app/src/lib/graduation*.test.ts",
  nxt=[("P1", "Deterministic rules-engine spec with effective dates and policy versions (ADR-0019 input)"),
       ("P2", "Audit-agreement harness against a de-identified degree-audit export")],
  repl="Institution approves catalog and rule authoring; registrar signs the audit parity report; two-person approval for rule publication.", slo="C1")

D(id="D04", name="Course Studio and LMS", ph=3, seat="product", pri="P1", mat=[NI, IN], gates=["SEC", "PRIV", "A11Y", "INST", "MIG", "REC", "RBK"], ready=UNSAFE, ladder="building",
  ev=["app/src/components/CourseStudio.tsx", "app/src/lib/coursestudio.ts", "supabase/functions/lti/", "supabase/functions/_shared/lti*.ts", "docs/LMS-INTEROPERABILITY-MATRIX.md"],
  vision="Faculty author and run courses natively, or keep their LMS and connect through LTI; either way the student sees one course.",
  users="Faculty, teaching assistants, students, instructional designers.",
  jobs="Publish syllabus, rules and guidance; deliver resources and assignments; communicate; set course AI rules.",
  cur="The institution's LMS (Canvas, Brightspace, Blackboard, Moodle); Semester holds guidance and rules only.",
  nat="Semester for courses an institution moves to Course Studio; no course shell, roster, submission store or question bank exists yet.",
  integ="LTI 1.3 launch, deep linking, AGS and NRPS (code built; 0 platform registrations); Canvas API proxy; OneRoster rosters (not built).",
  model="courses, course_guidance, course_ai_rules, lti_platform/identity/line_item, gradebook_*.",
  scope="Tenant; course.", caps="course-scoped roles: faculty, teaching_assistant; lti:launch",
  cls="T1 course material; T2 student work; T3 grades.", consent="Course AI policy is faculty-set; student preferences narrow it.",
  ai="Course-aware, policy-bound assistant; citations to course sources; integrity-aware.",
  cut="Per course: import from LMS (QTI 3, common cartridge), dual-run a section, reconcile enrolments and grades, cut over at a term boundary, roll back by relaunching the LMS tool.",
  comm="Institutional module (pricing unapproved).", cs="Faculty enablement (docs/FACULTY-ENABLEMENT.md).", kpi="Courses published; faculty weekly active; assignment-submission success; LTI launch success.",
  deps="D05, D26, D27, D11", risks="LTI unproven against a real LMS; Course Studio flag off; Brightspace registration pending.",
  br="domain/d04-course-studio", tests="supabase/*.check.sql (lti suites); app/src/lib/coursestudio*.test.ts",
  nxt=[("P0", "Register Semester as an LTI tool in one sandbox LMS and record a launch/grade passback run as evidence"),
       ("P1", "Course shell + roster model ADR (OneRoster import as the first roster source)"),
       ("P2", "Question bank and rubric levels on the QTI 3 model")],
  repl="LMS replacement for a course needs: faculty adoption sign-off, assessment/gradebook parity (D05), accessibility evaluation, records retention parity, rollback to LMS.", slo="C1")

D(id="D05", name="Learning evidence, assessment and gradebook", ph=3, seat="product", pri="P1", mat=[NI], gates=["SEC", "PRIV", "A11Y", "INST", "REC", "RBK"], ready=UNSAFE, ladder="building",
  ev=["app/src/lib/gradebook/", "app/src/screens/Gradebook.tsx", "app/src/lib/assessment/qti.ts", "supabase/migrations/ (gradebook_*, grade_entries, regrade_*)"],
  vision="Assessment and feedback that produce learning evidence, with an append-only gradebook, moderation, regrade and grade-release controls.",
  users="Faculty, TAs, students, registrar (grade export).", jobs="Grade, moderate, release, appeal; show a student where they stand and what evidence supports it.",
  cur="The LMS gradebook; the student's own arithmetic (device only).", nat="Semester gradebook of record only after the gates in D11 and a term-boundary parallel run.",
  integ="LTI AGS grade passback (writeback.lms_grade_passback, off).", model="gradebook_items/schemes/operations, grade_entries, grade_levels, grade_passbacks, regrade_requests/resolutions, mistake_evidence, concept_evidence.",
  scope="Tenant; course.", caps="grades:enter, grades:moderate, grades:release, grades:export, grades:receive",
  cls="T3 (education record).", consent="Student may share evidence; grades are institution-controlled.",
  ai="May suggest feedback drafts to the grader; never assigns a grade; human review queue (docs/operating-model/AI-GRADING-AND-INTEGRITY.md).",
  cut="Parallel-run one section per term: native ledger vs LMS gradebook, compare every grade, hold passback off until zero unexplained differences.",
  comm="Institutional module.", cs="Faculty enablement; registrar liaison.", kpi="Grading turnaround; regrade rate; ledger vs LMS discrepancy count.",
  deps="D04, D11, D26", risks="Off at every school; no moderation evidence from real faculty; AI grading is prohibited as authority.",
  br="domain/d05-gradebook", tests="app/src/lib/gradebook/*.test.ts; supabase grade check suites",
  nxt=[("P1", "Dual-control rule for grade change and release (ADR-0010) enforced in the database"),
       ("P2", "Learning-evidence model: objective-to-assessment alignment on the competency map")],
  repl="Institutional authority to hold the gradebook of record; registrar sign-off; immutable version history verified; passback reconciled for a full term.", slo="C0")

D(id="D06", name="AI gateway and copilot", ph=2, seat="engineering", pri="P0", mat=[NI], gates=["SEC", "PRIV", "INST"], ready=NOTREADY, ladder="tested",
  ev=["supabase/functions/claude/", "app/server/institution/intelligence.ts", "packages/institution/src/intelligence.ts", "app/src/ai/", "docs/evidence/ai/"],
  vision="One governed AI path: tenant policy, course rules, student preference, data class, consent, citations and audit applied before any model is called.",
  users="Every role.", jobs="Ask, plan, study, draft, summarise and escalate to a human.",
  cur="Student-key (BYOK) and metered shared-key calls through an edge function; institutional gateway routes exist.",
  nat="Semester (policy, audit, usage); model providers are subprocessors.", integ="Anthropic (shared key, blocked pending activation), OpenAI (institution-approved), student keys.",
  model="private.ai_usage_*, private.gateway_audit, gateway_intelligence_*, ai_policy, ai_memories, approved_source.",
  scope="Account; tenant policy; course rules.", caps="ai:configure, source:approve, audit:read", cls="Ceiling T2 for consumer AI; T3+ blocked unless a separately approved control set exists.",
  consent="Per-category consent; schools can turn context categories off.",
  ai="Is the AI domain: policy-bound, tenant-aware, permission-aware, source-aware, cost-metered, human-escalating, audited, evaluated.",
  cut=None, comm="Metered credits; institution-directed provider terms.", cs="AI governance board (docs/operating-model/AI-GOVERNANCE-BOARD.md).",
  kpi="Policy-refusal correctness on the eval set; cited-answer rate; cost per attaching student; kill-switch time-to-effect.",
  deps="D26, D28, D29", risks="BYOK path bypasses the kill switch (F-04); shared key blocked; one red-team run on one model; gateway not deployed.",
  br="domain/d06-ai", tests="app/src/ai/*.test.ts; app/server/institution/intelligence*.test.ts; live tests (need keys)",
  nxt=[("P0", "Route the BYOK path through the kill switch and add the regression test (finding F-04)"),
       ("P0", "Enforce tenant AI policy before invocation on every route (ADR-0005; Phase 1 step 3)"),
       ("P1", "Evaluation harness with a held-out set per role; run on every model/prompt change")],
  repl=None, slo="C1")

D(id="D07", name="Search and knowledge graph", ph=2, seat="product", pri="P2", mat=[NI], gates=["PRIV", "SEC"], ready=NOTREADY, ladder="building",
  ev=["app/src/lib/search.ts", "app/src/lib/find.ts", "app/src/lib/context-graph.ts", "app/src/lib/skills-graph.ts"],
  vision="Permission-aware search across personal, course, institutional and approved public sources, with provenance.",
  users="Every role.", jobs="Find a deadline, a policy, a reading, a person, an answer.", cur="Client-side search over the app registry, guide and the student's own data.",
  nat="Semester index per tenant (no server index exists).", integ="Source connectors feed the index only within approved scope.", model="evidence_reference, canonical_entity_references (vector/queue boundaries are ADR-0021).",
  scope="Account, then tenant, then course; scope is required on every query.", caps="Search requires scope; results filtered by the caller's capabilities.",
  cls="Inherits the class of each indexed object.", consent="Index only what the owner or institution authorised.", ai="Retrieval for the copilot uses the same permission filter.",
  cut=None, comm="Included.", cs="n/a", kpi="Search success rate; zero-result rate; permission-leak test count (must be 0).",
  deps="D06, D28", risks="Cross-tenant leakage in any shared index; no server index to test.",
  br="domain/d07-search", tests="app/src/lib/search*.test.ts; planned negative cross-tenant suite",
  nxt=[("P1", "Accept ADR-0021 (search/storage/queue/cache/vector boundaries) before building a server index")], repl=None, slo="C2")

D(id="D08", name="Faculty experience", ph=3, seat="product", pri="P1", mat=[DD, NI], gates=["A11Y", "INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/components/CourseStudio.tsx", "app/src/components/institutional/RoleWorkspace.tsx", "app/src/lib/rolelaunch.ts", "docs/FACULTY-COURSE-STUDIO-DESIGN.md"],
  vision="One place for faculty to teach, assess, communicate, hold office hours and govern AI use, without learning a second system.", users="Faculty, TAs, department chairs.",
  jobs="Publish guidance; manage a roster; grade; message; set course AI policy; see which students need help.", cur="LMS and email.", nat="Course Studio plus gradebook (D04, D05).",
  integ="LTI; SIS roster; calendar.", model="As D04/D05.", scope="Course; department.", caps="faculty, teaching_assistant, department_chair", cls="T1-T3.",
  consent="Student data seen only within course purpose.", ai="Course-authoring, rubric and accessible-content assistants; human review.", cut=None,
  comm="Institutional.", cs="Faculty enablement.", kpi="Faculty weekly active; time to publish a course; faculty satisfaction.", deps="D04, D05", risks="No faculty-only screen set beyond Course Studio; no faculty research done.",
  br="domain/d08-faculty", tests="app/src/lib/rolelaunch.test.ts",
  nxt=[("P1", "Five faculty discovery interviews recorded in docs/pilot/DISCOVERY-EVIDENCE-LOG.md before building more screens")], repl=None, slo="C2")

D(id="D09", name="Advisor and student success", ph=4, seat="success", pri="P1", mat=[NI, PO], gates=["PRIV", "A11Y", "INST", "SEC"], ready=NOTREADY, ladder="building",
  ev=["app/src/components/AdvisorMeeting.tsx", "app/src/lib/casework.ts", "app/server/institution/advising.ts", "app/src/lib/office-actions-remote.ts"],
  vision="Proactive, consented support: a student-controlled agenda, case workflow, referrals and success plans, measured by outcomes and not surveillance.",
  users="Advisors, success staff, students, tutors, mentors.", jobs="Prepare a meeting; share a plan; refer; follow up; see aggregate service bottlenecks.",
  cur="Advising/CRM systems; appointment tools.", nat="Semester for student-controlled shares and case workflow once an institution approves.", integ="Appointment scheduling; CRM handoff.",
  model="advisor_shares, advisor_share_events, success_plans, institution_actions, support_tickets.", scope="Tenant; office; per-student share.", caps="Per share grant; office capabilities.",
  cls="T3.", consent="Student share per advisor, revocable, time-limited.", ai="Summarises with citations; routes to humans; never a risk score without explanation (docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md).",
  cut="Case history import is optional; run beside the existing system for one office; no automatic migration of case notes.", comm="Institutional.", cs="Success playbook.",
  kpi="Appointment completion; referral closure time; student-reported usefulness. No predictive score is a metric.", deps="D26, D28, D24", risks="Advisor surface is UI plus sandbox; no advisor screen in the router; notes sensitivity.",
  br="domain/d09-success", tests="app/src/lib/advisor*.test.ts; supabase advisor-share suites",
  nxt=[("P1", "Advisor interviews (three) with a named office before extending the case model")], repl="Office head approves case workflow; privacy review of notes retention.", slo="C2")

D(id="D10", name="Registrar and academic operations", ph=5, seat="product", pri="P2", mat=[TR, NI], gates=["INST", "MIG", "REC", "RBK", "PRIV"], ready=UNSAFE, ladder="building",
  ev=["app/src/screens/Registrar.tsx", "app/src/lib/registrar.ts", "app/src/lib/enrollment/", "docs/REGISTRATION-DAY-MODE.md"],
  vision="Terms, catalog, sections, holds, rules and graduation workflows run natively once an institution authorises it.", users="Registrar staff, advisors, students.",
  jobs="Publish a catalog; manage terms and sections; apply holds and overrides; certify graduation.", cur="SIS (Banner, PeopleSoft, Workday Student, Colleague).",
  nat="Semester only after the gates in D11/D12; today a clipboard-style handoff.", integ="SIS connectors (none built; ADAPTERS is empty).", model="registration_terms/sections/windows/holds/overrides, catalog_sections.",
  scope="Tenant.", caps="registration_window:publish, catalog:sync, record:*", cls="T3.", consent="Institution authority; student visibility by policy.",
  ai="Explains policy; routes exceptions to humans; never the rule engine.", cut="Connect first (read), then dual-run one term of one program, reconcile, then native publish with two-person approval; rollback re-points authority to the SIS.",
  comm="Institutional.", cs="Registrar implementation.", kpi="Rule parity rate vs SIS; approval turnaround.", deps="D11, D12, D26, D27", risks="No SIS adapter; no registrar interviews; high regulatory exposure.",
  br="domain/d10-registrar", tests="app/src/lib/registrar.test.ts; enrollment tests", nxt=[("P2", "Build one read-only SIS adapter against a vendor sandbox (first design partner decides which)")],
  repl="Institution board or registrar authorises; effective-dated policy versioning; two-person approvals; reconciliation for two terms; rollback rehearsed.", slo="C0")

D(id="D11", name="Academic records and grade ledger", ph=5, seat="data", pri="P2", mat=[NI], gates=["SEC", "PRIV", "INST", "MIG", "REC", "RBK"], ready=UNSAFE, ladder="building",
  ev=["app/src/lib/record/ledger.ts", "app/src/components/institutional/RecordLedger.tsx", "supabase/migrations/20260929210000_academic_record_ledger.sql"],
  vision="An append-only, effective-dated academic record with propose/approve/override separation, transcript export and institutional reporting.", users="Registrar, records staff, students (own record).",
  jobs="Post and correct records; export a transcript; show a student their record.", cur="SIS.", nat="Semester only for records an institution migrates and certifies; the code states it is not an official transcript and issues none.",
  integ="Transcript exchange (standards not yet built).", model="academic_record_entries/changes/subjects, source_records/snapshots.", scope="Tenant.", caps="record:propose, record:approve, record:override, record:read",
  cls="T3.", consent="Institution authority; FERPA-aligned release.", ai="Explains; never edits.", cut="Import with lineage, reconcile row counts and checksums, parallel-run a term, cut over by a signed change record, rollback by restoring the SIS as authority.",
  comm="Institutional.", cs="Registrar.", kpi="Reconciliation exceptions; correction turnaround.", deps="D10, D26, D28", risks="Official-record claims before gates; no transcript standard implemented.",
  br="domain/d11-records", tests="app/src/lib/record/*.test.ts; record check suites", nxt=[("P2", "Immutability and restore proof for the ledger (hash chain verification in CI)")],
  repl="All 15 replaceability requirements tested; institutional authority; legal review; reconciliation; rollback; named steward.", slo="C0")

D(id="D12", name="Registration and enrollment", ph=5, seat="product", pri="P2", mat=[NI], gates=["SEC", "INST", "MIG", "REC", "RBK", "A11Y"], ready=UNSAFE, ladder="building",
  ev=["app/src/lib/enrollment/", "app/src/lib/registration-day.ts", "supabase/migrations/20260929300000_registration_transaction.sql"],
  vision="Idempotent, capacity-correct registration with waitlists, time tickets, add/drop and approvals.", users="Students, registrar, advisors.", jobs="Plan a schedule; register on the opening minute; add, drop, waitlist.",
  cur="SIS registration; Semester prepares a plan and hands off.", nat="Semester registration transaction only after the gates; closed at every school today.", integ="SIS write-back (writeback.registration_submit, off).",
  model="registration_* tables, seat_watches.", scope="Tenant.", caps="registration_window:publish; registrar desk.", cls="T3.", consent="n/a (institutional transaction).",
  ai="Explains eligibility; never decides.", cut="Plan-only, then handoff, then shadow-write in sandbox, then one window dual-run with seat reconciliation, then cutover.", comm="Institutional.", cs="Registrar.",
  kpi="Duplicate-registration count (must be 0); seat discrepancy; load at open.", deps="D10, D11, D27", risks="Over-enrolment; no live seats; load at registration open untested against a real SIS.",
  br="domain/d12-registration", tests="app/src/lib/enrollment/*.test.ts; load harness", nxt=[("P2", "Registration-day load test at 5x a named design partner's peak, in staging")],
  repl="As D10 plus load evidence and a registrar-run rehearsal.", slo="C0")

D(id="D13", name="Student finance, accounts and payment plans", ph=6, seat="finance", pri="P2", mat=[NI, TR], gates=["SEC", "PRIV", "INST", "MIG", "REC", "RBK"], ready=UNSAFE, ladder="building",
  ev=["app/src/lib/finance/accounts.ts", "app/src/components/institutional/StudentAccounts.tsx", "supabase/migrations/ (student_account_*, student_payment_plans)"],
  vision="Show balances, plans and deadlines, and hand off payment; run billing natively only where an institution and a payment provider approve.", users="Students, payers, student-accounts staff.",
  jobs="See what is owed and when; set up a plan; get a receipt; ask about a charge.", cur="Bursar/ERP and a payment provider.", nat="Ledger is built; nothing connects to a payment provider and nothing is sent to students. Raw card data is never stored.",
  integ="Hosted payment provider; ERP feed.", model="student_account_entries/closes/reconciliations/requests, student_payment_plans(_installments).", scope="Tenant.", caps="finance:read/request/approve/approve_high/close",
  cls="T3-T4 (financial).", consent="Payer and family grants are explicit.", ai="Explains; never states a balance as official without the source label.", cut="Read-only mirror, reconcile daily to the ledger of record, then hosted payment, then plans; rollback disables new charges and returns to the ERP.",
  comm="Institutional.", cs="Bursar implementation.", kpi="Reconciliation breaks; payment success; plan default rate.", deps="D26, D28, D29", risks="PCI scope creep; refund/dispute paths unexercised; financial retention rules.",
  br="domain/d13-finance", tests="app/src/lib/finance/*.test.ts; billing check suites", nxt=[("P2", "Dual-control for approve_high and close proven in database check suites")],
  repl="Institutional finance authority; auditor review; reconciliation for a full term; payment-provider contract; rollback.", slo="C0")

D(id="D14", name="Financial aid and scholarship handoffs", ph=6, seat="product", pri="P3", mat=[TR], gates=["PRIV", "INST"], ready=NOTREADY, ladder="building",
  ev=["app/server/institution/money.ts", "app/src/screens/Opportunities.tsx", "app/src/lib/basicneeds.ts"],
  vision="A checklist and official handoff for aid; scholarship discovery; emergency-aid routing. Native aid workflow only with regulatory expertise.", users="Students, aid staff.",
  jobs="Know what is missing; find funding; get urgent help.", cur="Aid office systems.", nat="Not started; the register says not to claim it until regulatory expertise exists.", integ="Official handoff links.",
  model="opportunities, help_requests.", scope="Tenant.", caps="financial_aid_officer", cls="T3-T4.", consent="Student-controlled.", ai="Never computes eligibility.", cut=None,
  comm="Included in handoff tier.", cs="n/a", kpi="Checklist completion; handoff click-through.", deps="D13", risks="Regulatory exposure (Title IV).", br="domain/d14-aid", tests="app/src/lib/basicneeds.test.ts",
  nxt=[("P3", "Keep as handoff; revisit native only after counsel and a named aid partner exist")], repl="Counsel; aid-office authority; regulator-aware controls.", slo="C2")

D(id="D15", name="Campus life and services", ph=6, seat="product", pri="P2", mat=[NI, TR], gates=["INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/screens/Support.tsx", "app/src/screens/Hub.tsx", "app/src/screens/Maps.tsx", "app/src/lib/serviceregister.ts"],
  vision="One service layer for campus offices: a request goes to the right owner with context and the student sees status.", users="Students, campus offices.", jobs="Find a service; ask for help; book a space; see status.",
  cur="Many office systems.", nat="Semester request routing; each office remains the record owner.", integ="Office feeds; booking write-back is off and not built.", model="help_requests, help_destinations, institution_actions, support_tickets.",
  scope="Tenant; office.", caps="office capabilities", cls="T2-T3.", consent="Minimum context only.", ai="Routes; summarises.", cut=None, comm="Institutional.", cs="Implementation per office.",
  kpi="Response and resolution time; repeat-issue rate; satisfaction.", deps="D26", risks="Data waits on school feeds.", br="domain/d15-campus", tests="app/src/lib/support*.test.ts",
  nxt=[("P2", "Office action feed for one office with a named owner")], repl=None, slo="C2")

D(id="D16", name="Housing", ph=6, seat="product", pri="P3", mat=[TR, PO], gates=["INST", "PRIV"], ready=NOTREADY, ladder="building",
  ev=["app/src/screens/Housing.tsx", "app/src/lib/housing.ts", "app/server/institution/housing.ts"], vision="Housing status, application support and maintenance handoff; native only with a partner or institutional approval.",
  users="Students, residence life.", jobs="Know status; apply; request maintenance.", cur="Housing system.", nat="Handoff now; native after gates.", integ="Housing vendor feed.", model="Sandbox adapter only.", scope="Tenant; residence.",
  caps="residence_life_staff, resident_assistant", cls="T3.", consent="Roommate data is mutual consent.", ai="Explains policy.", cut=None, comm="Institutional.", cs="Residence life.", kpi="Application completion.", deps="D15",
  risks="Sandbox only.", br="domain/d16-housing", tests="app/src/lib/housing.test.ts", nxt=[("P3", "Hold; no build until a design partner asks for it")], repl="Institution authority; partner contract.", slo="C2")

D(id="D17", name="Dining", ph=6, seat="product", pri="P3", mat=[NI], gates=["INST", "SEC"], ready=NOTREADY, ladder="tested",
  ev=["app/src/lib/dining/", "app/src/screens/Dining.tsx", "app/src/screens/Meals.tsx"], vision="Hours, meal plan status and ordering through a dining partner.", users="Students, dining staff.", jobs="Find food; see swipes; order.",
  cur="Dining partner.", nat="Semester ledger and service built behind module.dining; ordering needs a live partner connection.", integ="Dining/campus-card partner.", model="dining_* (about 9 tables), dining_ledger.", scope="Tenant.", caps="dining_staff",
  cls="T3.", consent="Swipe sharing is opt-in.", ai="n/a", cut=None, comm="Institutional.", cs="Dining operations.", kpi="Order success; ledger reconciliation.", deps="D13", risks="Partner dependency.",
  br="domain/d17-dining", tests="app/src/lib/dining/*.test.ts", nxt=[("P3", "Partner-connection acceptance test when a partner exists")], repl="Partner contract; institutional approval.", slo="C2")

D(id="D18", name="Events", ph=6, seat="product", pri="P3", mat=[NI], gates=["INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/data/events.ts", "app/src/screens/Activities.tsx"], vision="Verified campus events in the student's calendar.", users="Students, organisers.", jobs="Find, add, RSVP.", cur="Campus event systems; seed data.",
  nat="Semester event listings; no event backend found.", integ="ICS and event feeds.", model="Seed data.", scope="Tenant.", caps="organization_officer", cls="T0-T1.", consent="n/a", ai="Recommend with explanation.",
  cut=None, comm="Included.", cs="n/a", kpi="Events added to calendar.", deps="D02, D19", risks="No backend.", br="domain/d18-events", tests="none specific", nxt=[("P3", "Event feed import with source label")], repl=None, slo="C3")

D(id="D19", name="Community and organizations", ph=6, seat="trust", pri="P1", mat=[NI], gates=["SEC", "PRIV", "A11Y", "INST"], ready=UNSAFE, ladder="tested",
  ev=["app/src/community/", "app/src/screens/Community.tsx", "docs/COMMUNITY-PRIVACY-MODEL.md", "docs/CAMPUS-MODERATION-SOP.md"],
  vision="Moderated, pseudonymity-aware communities with reporting, appeals and safety escalation.", users="Students, organisation officers, moderators, volunteers, trust and safety.",
  jobs="Find a group; post; report; moderate; escalate.", cur="Social platforms and org portals.", nat="Semester (foundation built; high-risk parts refuse production).", integ="Escalation webhook to campus safety (two-reviewer, allow-listed).",
  model="communities, community_* (about 35 tables), reports, moderation_audit_event.", scope="Tenant; community.", caps="community_manager, moderator, trust_safety_reviewer", cls="T2; reports are T3.",
  consent="Minors off social surfaces until 18; alias policy.", ai="Detectors assist moderators; never auto-punish.", cut=None, comm="Institutional.", cs="Moderator calibration.", kpi="Report response time; appeal reversal rate; harassment recurrence.",
  deps="D21, D26", risks="Safety-critical; no trained moderators; no 24/7 coverage.", br="domain/d19-community", tests="app/src/community/*.test.ts",
  nxt=[("P1", "Safety-escalation tabletop with a named campus contact before any activation")], repl=None, slo="C1")

D(id="D20", name="Accessibility services", ph=6, seat="accessibility", pri="P1", mat=[DD], gates=["PRIV", "A11Y", "INST"], ready=NOTREADY, ladder="designed",
  ev=["supabase/migrations/ (accommodation_passports, accommodation_shares)", "app/src/lib/cara.ts", "docs/ACCESSIBILITY-POLISH-CHECKLIST.md"],
  vision="Accommodation passports a student controls and shares with faculty without disclosing the diagnosis; faster provisioning of accommodations.", users="Students, disability services, faculty.",
  jobs="Request, verify, share and apply accommodations; assessment accommodations in Course Studio.", cur="Disability services case system.", nat="Schema exists; no institutional service found in code.", integ="Disability services system handoff.",
  model="accommodation_passports/shares/access_events.", scope="Tenant; student.", caps="disability_services_officer, accommodation:verify", cls="T4 (disability).", consent="Student-controlled, minimal-disclosure.",
  ai="None on diagnosis data.", cut=None, comm="Institutional.", cs="DS office onboarding.", kpi="Time to accommodation in effect.", deps="D04, D05", risks="Sensitive; the product's own accessibility is unevaluated (separate concern, see D29/D30).",
  br="domain/d20-access-services", tests="supabase accommodation check suites", nxt=[("P1", "Commission the qualified accessibility evaluation (EXT-008) for the product itself")], repl="Institution DS authority; legal review.", slo="C2")

D(id="D21", name="Safety and emergency handoffs", ph=6, seat="trust", pri="P0", mat=[NI], gates=["SEC", "PRIV", "INST"], ready=UNSAFE, ladder="tested",
  ev=["app/src/community/crisis.ts", "supabase/functions/_shared/escalation.ts", "docs/CRISIS-RESPONSE-RUNBOOK.md", "docs/CAMPUS-ESCALATION-POLICY.md"],
  vision="Safe handoff to the institution's official emergency channels; Semester never replaces emergency response.", users="Students, campus safety, counselling liaisons.",
  jobs="Get to the right human fast; leave an auditable handoff.", cur="Institutional protocols.", nat="Handoff only; Semester is never the emergency system.", integ="Signed allow-listed webhooks; official numbers.",
  model="community escalation records.", scope="Tenant.", caps="trust_safety_senior", cls="T4-T6.", consent="Safety overrides handled by protocol, not by product defaults.",
  ai="Detects, never decides; human required.", cut=None, comm="Included with community.", cs="Named campus contact.", kpi="Handoff delivered; time to human.", deps="D19", risks="Highest harm potential; no 24/7 responder.",
  br="domain/d21-safety", tests="community crisis tests", nxt=[("P0", "No activation without a signed escalation agreement and a rehearsed handoff")], repl="Never replaces emergency response.", slo="C0")

D(id="D22", name="Library and research", ph=3, seat="product", pri="P3", mat=[NI], gates=["PRIV", "INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/lib/research.ts", "app/src/lib/cite.ts", "app/src/screens/Sources.tsx", "app/src/lib/source-locker.ts"], vision="Sources, citations and research workspace tied to the course.", users="Students, faculty, librarians.",
  jobs="Find, cite, organise sources.", cur="Library systems.", nat="Semester research workspace.", integ="Library discovery APIs (none built).", model="approved_source, evidence_reference.", scope="Account; course.",
  caps="source:approve", cls="T0-T2.", consent="n/a", ai="Citation assistance with provenance.", cut=None, comm="Included.", cs="n/a", kpi="Sources cited with provenance.", deps="D06, D07", risks="Licensing.",
  br="domain/d22-library", tests="app/src/lib/research.test.ts", nxt=[("P3", "Library discovery integration after a partner library asks")], repl=None, slo="C3")

D(id="D23", name="Career, employer and alumni", ph=7, seat="product", pri="P2", mat=[NI, PO], gates=["PRIV", "INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/screens/Career.tsx", "app/src/lib/career.ts", "app/src/lib/career-evidence.ts", "docs/CREDENTIAL-WALLET.md"],
  vision="Verified skills, portfolio and credential wallet; employers discover consented evidence; alumni mentor.", users="Students, career staff, employers, alumni.",
  jobs="Build evidence; find opportunities; share credentials; get mentored.", cur="Career services platforms.", nat="Semester skills and portfolio; self-reported claims never appear as institution-verified.",
  integ="Open Badges / CLR / verifiable credentials (not found in code).", model="skill_records, skill_claim(_evidence), talent_profiles, alumni_mentor_offers, opportunities.", scope="Account; tenant.", caps="skill:verify, talent:search, career_coach",
  cls="T2.", consent="Student-controlled sharing.", ai="Suggests; flags unverified claims.", cut=None, comm="Institutional, employer-side (unpriced).", cs="Career centre.", kpi="Verified claims issued; employer views with consent.",
  deps="D05, D11", risks="No employer-side surface exists.", br="domain/d23-career", tests="app/src/lib/career*.test.ts", nxt=[("P2", "Verified-claim issuance flow with faculty approval")], repl=None, slo="C2")

D(id="D24", name="Family and guardian grants", ph=4, seat="privacy", pri="P1", mat=[NI], gates=["PRIV", "SEC", "INST", "A11Y"], ready=UNSAFE, ladder="tested",
  ev=["app/src/screens/Family.tsx", "app/src/lib/family.ts", "supabase/ (family*.check.sql)", "docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md"],
  vision="Student-authorised, time-bound sharing with family and guardians; K-12 guardian links under legal basis.", users="Students, family, guardians, K-12 staff.",
  jobs="Grant a view; revoke; see what was seen.", cur="None (new).", nat="Semester (consent ledger).", integ="None.", model="family_grants, family_invites, family_shared_items, family_access_events, guardian_links(_history/_restrictions).",
  scope="Account; tenant.", caps="Grant-scoped.", cls="T3.", consent="Student grants; revocable; auditable; minors follow guardian law.", ai="No AI on shared family data.", cut=None,
  comm="Included.", cs="Student education.", kpi="Grants active; access events per grant; revocation time.", deps="D26, D28", risks="FERPA/COPPA interplay; high-risk activation profile.", br="domain/d24-family",
  tests="supabase family check suites; erasure clears consent snapshots", nxt=[("P1", "Counsel review of the consent model (EXT-003) before activation")], repl=None, slo="C1")

D(id="D25", name="Institutional governance and configuration", ph=8, seat="product", pri="P1", mat=[NI], gates=["SEC", "INST"], ready=NOTREADY, ladder="tested",
  ev=["app/src/lib/governance/", "app/src/lib/config/", "app/src/components/institutional/ConfigurationStudio.tsx", "app/src/components/institutional/WorkflowBuilder.tsx"],
  vision="Tenant hierarchy, policy, configuration, workflow, rollouts, approvals, two-person controls and offboarding.", users="Institution admins, registrar, IT, Semester operators.",
  jobs="Configure safely; approve; roll out; roll back; leave with data.", cur="Per-tool admin consoles.", nat="Semester control plane (staff-side, off by default).", integ="IdP; SIS.",
  model="tenant_*, school_config_versions, workflow_versions, approval_request/decision, school_offboarding.", scope="Tenant.", caps="tenant:configure, platform:configure", cls="T3.", consent="n/a",
  ai="Configuration assistant proposes; humans approve.", cut=None, comm="Institutional.", cs="Implementation playbook.", kpi="Config changes with approval evidence; offboarding exports verified.", deps="D26, D29",
  risks="Platform engines have 0 importers from the app; tenant isolation off for every school (F-01).", br="domain/d25-governance", tests="app/src/lib/governance/*.test.ts",
  nxt=[("P0", "Phase 1 step 8: adopt the policy gateway on ten sensitive actions")], repl=None, slo="C1")

D(id="D26", name="Identity, SSO and SCIM", ph=1, seat="security", pri="P0", mat=[NI], gates=["SEC", "INST", "MIG"], ready=UNSAFE, ladder="building",
  ev=["app/server/institution/auth.ts", "app/server/institution/scim.ts", "packages/institution/src/identity.ts", "supabase/migrations/ (bind_institution_sso_membership, tenant_sso_policy, scim_gateway)", "docs/INSTITUTIONAL-SSO-ARCHITECTURE.md"],
  vision="Membership-derived identity per tenant, SSO, lifecycle provisioning and access governance.", users="Everyone; IT; Semester operators.", jobs="Sign in once; get the right access; lose it on departure.",
  cur="Supabase Auth plus school email-domain membership; the institution's IdP once connected.", nat="Semester holds membership and grants; the institution's IdP stays the identity authority.",
  integ="SAML, OIDC, SCIM 2.0 (SCIM off unless enabled).", model="institution_membership, institution_identity_provider, scim_*, role_grants, app_roles, app_capabilities, role_capabilities.", scope="Tenant.", caps="integration_admin, tenant:configure",
  cls="T3.", consent="Claim mapping minimised (docs/SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md).", ai="None.", cut="Pilot SSO for one domain; dual sign-in; provision by SCIM in dry-run; cut over by domain; rollback re-enables email-domain sign-in.",
  comm="Institutional.", cs="IT onboarding (docs/SSO-TENANT-ONBOARDING.md).", kpi="SSO success; provisioning lag; orphaned access count.", deps="none (foundation)", risks="Cross-source conflict: the replacement register says SAML only; the code audit found no SAML protocol code outside docs (verify whether Supabase SSO carries it); no real IdP connected.",
  br="domain/d26-identity", tests="app/server/institution/*.test.ts; supabase membership check suites",
  nxt=[("P0", "Phase 1 step 7: one membership-derived tenancy source (ADR-0002)"), ("P1", "Reconcile SAML/OIDC status against code and Supabase config; record the result in docs/evidence/")],
  repl="IdP replacement is not proposed: Semester integrates with the institution's identity provider.", slo="C0")

D(id="D27", name="Integrations, LTI, OneRoster and Edu-API", ph=1, seat="engineering", pri="P0", mat=[NI, IN], gates=["SEC", "INST", "MIG", "REC"], ready=UNSAFE, ladder="building",
  ev=["app/src/lib/integration/", "app/server/integration/", "supabase/functions/lti/", "supabase/functions/integration-tick/", "docs/INTEGRATION-CONTROL-PLANE.md", "docs/INTEROPERABILITY-ROADMAP.md"],
  vision="A connector framework with scopes, mappings, sync runs, dead letters, reconciliation, drift detection and kill switches.", users="Integration admins, implementers, partners.",
  jobs="Connect a source safely; see its health; stop it; reconcile it.", cur="Institution systems.", nat="Semester integration control plane; adapters wait on a design partner. ADAPTERS is empty; every service answers 503 unless the sandbox is on.",
  integ="LTI 1.3 built (0 registrations); Canvas proxy; OneRoster/Edu-API/SIS adapters not built.", model="connections, integration_* (about 18 tables), lti_*, provider_registry, migration_*, private.roster_*.", scope="Tenant.",
  caps="integration:view/configure/approve/sync/replay/reconcile", cls="T3.", consent="Connection approval by the institution.", ai="None.", cut="See SEMESTER_MIGRATION_FACTORY.md.",
  comm="Institutional connector fees (unapproved).", cs="Integration operator runbook.", kpi="Sync success; freshness; reconciliation exceptions; time-to-connect.", deps="D26", risks="No real connection exists; no adapter certification.",
  br="domain/d27-integrations", tests="app/src/lib/integration/*.test.ts; supabase integration suites; sync simulation sandbox", nxt=[("P0", "Build the first read-only roster adapter (OneRoster CSV) end to end in the sandbox and stage it")],
  repl=None, slo="C1")

D(id="D28", name="Privacy, retention and legal holds", ph=1, seat="privacy", pri="P0", mat=[NI], gates=["PRIV", "SEC", "INST"], ready=NOTREADY, ladder="tested",
  ev=["supabase/migrations/ (retention_sweeps, legal_holds, financial_retention)", "app/src/screens/Privacy.tsx", "docs/DATA-RETENTION-EXPORT-DELETION.md", "docs/trust/DATA-CLASSIFICATION-STANDARD.md"],
  vision="Classification, consent, retention, export, deletion, holds and data-rights requests enforced in data and demonstrable.", users="Students, privacy officers, counsel, institutions.",
  jobs="Export or erase my data; place a hold; evidence retention.", cur="Per-system.", nat="Semester for its own data; institution records follow institution policy.", integ="Institution DSR workflows.",
  model="data_classification_rules, legal_holds, data_subject_request, consent_record, retention runs.", scope="Account; tenant; platform.", caps="data_steward, compliance_owner", cls="Defines T0-T6.",
  consent="Defines the consent model.", ai="Training-use policy forbids training on customer data (docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md).", cut=None, comm="Included.", cs="Privacy ops.", kpi="DSR time to close; sweeps run; holds honoured.",
  deps="D26", risks="Table classes are rule-derived, not human-reviewed; no counsel engaged; FORCE RLS not applied.", br="domain/d28-privacy", tests="supabase retention/legal-hold check suites; app/src/lib/tableclassification.test.ts",
  nxt=[("P0", "Human review of the 354 table classes, starting with T3+ (data steward)"), ("P1", "Counsel-reviewed retention schedule")], repl=None, slo="C1")

D(id="D29", name="Security, audit and incident response", ph=1, seat="security", pri="P0", mat=[NI], gates=["SEC"], ready=NOTREADY, ladder="tested",
  ev=["docs/security/FINDINGS-REGISTER.md", "docs/trust/INCIDENT-RESPONSE-PLAN.md", "supabase/*.check.sql", ".github/workflows/ci.yml", "database/TENANT_ISOLATION_MATRIX.md"],
  vision="Tenant isolation proven by negative tests, tamper-evident audit, alerts that reach a person, and rehearsed incident response.", users="Security, operators, customers' security reviewers.",
  jobs="Prevent, detect, respond, evidence.", cur="CI checks; one operator.", nat="Semester.", integ="DAST (HawkScan, not run), CodeQL (conditional), supply-chain attestations.",
  model="audit_event, private.console_audit_*, private.ledger_chain*, break_glass_grant.", scope="Platform; tenant.", caps="audit:read; incident_responder", cls="n/a", consent="n/a", ai="AI red-team and kill-switch drills.",
  cut=None, comm="Included.", cs="Trust room.", kpi="Open High findings (target 0); alert-to-human time; drill pass rate.", deps="all", risks="F-01 tenant isolation off for every school; F-08 no alerting; no pen test; no per-class cross-tenant negative suite (R-001).",
  br="domain/d29-security", tests="supabase/*.check.sql (111); app/src/lib/sre/*.test.ts", nxt=[("P0", "Write the cross-tenant negative suite per object class (risk R-001)"), ("P0", "Alert delivery to a person with a test page (F-08)"),
  ("P0", "Apply anon grant reduction (database/proposed/anon_grant_reduction.sql) after staging proof")], repl=None, slo="C0")

D(id="D30", name="Trust, compliance and HECVAT", ph=8, seat="trust", pri="P1", mat=[DD, NI], gates=["PRIV", "SEC", "A11Y", "INST"], ready=NOTREADY, ladder="building",
  ev=["docs/trust/", "docs/compliance/", "app/src/lib/trust/", "supabase/functions/trust-room/", "docs/SUBPROCESSORS.md"],
  vision="Evidence-backed trust centre, HECVAT, VPAT/ACR, DPAs, subprocessor governance and claims governance.", users="Procurement, security reviewers, counsel, institutions.",
  jobs="Answer a questionnaire truthfully; share evidence under NDA; keep claims within evidence.", cur="Drafts and readiness matrices.", nat="Semester.", integ="Trust-room private bucket.",
  model="trust_artifacts, trust_room_*, compliance_controls, control_evidence, claims_register.", scope="Platform.", caps="compliance_owner, trust_officer", cls="n/a", consent="n/a", ai="Draft only; humans approve claims.",
  cut=None, comm="Included.", cs="Trust room.", kpi="Questionnaire turnaround; claims in register vs on site (0 gap).", deps="D29", risks="No HECVAT, SOC 2, pen test, ACR, executed DPA; 15 public statements above evidence (docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md).",
  br="domain/d30-trust", tests="app/src/lib/trust/*.test.ts; claims tests", nxt=[("P0", "Close or withdraw the 15 over-evidence public statements (C-01..C-15)")], repl=None, slo="C2")

D(id="D31", name="Operations Command Center", ph=9, seat="operations", pri="P1", mat=[NI], gates=["SEC"], ready=NOTREADY, ladder="tested",
  ev=["app/src/screens/Console.tsx", "app/src/components/console/", "app/src/lib/console/client.ts", "docs/OPERATIONS-CONSOLE-MAP.md"],
  vision="One console for tenants, pilots, support, security, billing, releases and compliance, with approvals and break-glass.", users="Semester operators.", jobs="Triage; approve; support; release.",
  cur="Manual plus console.", nat="Semester.", integ="None.", model="console_action_record, console_duty, approval_request, support_access_*.", scope="Platform.", caps="platform_admin, support_agent, break-glass",
  cls="T3 (support access is time-limited).", consent="Customer data boundaries (ADR-0020).", ai="Support summarisation; humans act.", cut=None, comm="Internal.", cs="n/a", kpi="Open-incident age; approvals turnaround.", deps="D26, D29",
  risks="One operator; no on-call rota; no second approver.", br="domain/d31-ops-console", tests="app/src/lib/console/*.test.ts; app/src/lib/ops/*.test.ts", nxt=[("P1", "Name a second operator for two-person controls (Phase 1 step 0d)")], repl=None, slo="C1")

D(id="D32", name="Commercial, billing and customer success", ph=9, seat="finance", pri="P1", mat=[PO, NI], gates=["PRIV", "INST"], ready=NOTREADY, ladder="building",
  ev=["supabase/functions/billing-checkout/", "supabase/functions/billing-webhook/", "docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md", "commercial/READINESS_GAP_MATRIX.md", "app/src/lib/billing/"],
  vision="Enforceable plans and entitlements, invoices, renewals, dunning and customer health.", users="Students (individual), institutions, Semester finance and CS.", jobs="Buy, cancel, renew, invoice, expand.",
  cur="One live $7.99 monthly checkout/cancel test; checkout held off by flag.", nat="Semester with Stripe; institutional billing is documented-unimplemented.", integ="Stripe.", model="commercial_*, subscriptions, invoices, dunning_*, quotes, customer*.",
  scope="Account; tenant.", caps="billing_contact, finance_operator", cls="T3-T4 (financial; no card data).", consent="n/a", ai="None.", cut=None, comm="Plus $7.99/$59 (fact); everything else proposed.", cs="docs/commercial/CUSTOMER-SUCCESS-PLAYBOOK.md",
  kpi="Pilot-to-annual conversion (hypothesis 50%); net revenue retention; support cost per student.", deps="D26", risks="Annual, refund, failed renewal, dispute and tax unexercised; conflicting institutional price sets; take rate 12% vs 15%.",
  br="domain/d32-commercial", tests="app/src/lib/billing/*.test.ts", nxt=[("P1", "One authoritative price book decision (founder) and a test that site, plans.ts and finance model agree")], repl=None, slo="C1")

D(id="D33", name="Marketing, sales and the company site", ph=9, seat="founder", pri="P1", mat=[NI], gates=["PRIV"], ready=NOTREADY, ladder="tested",
  ev=["company-site/", "app/src/site/", "docs/PUBLIC-SITE.md", "PUBLIC-CLAIMS-APPROVAL-REGISTER.md"],
  vision="A truthful public site and sales motion whose every claim traces to evidence.", users="Prospects, buyers, press.", jobs="Learn what is true; start a pilot conversation.", cur="Static site; deployment revision unverified against repo.",
  nat="Semester.", integ="Resend; lead intake.", model="site_leads, cta_routes, gtm_*.", scope="Public.", caps="marketing_admin", cls="T1-T2 (lead data).", consent="gtm_consent append-only.", ai="Drafts only; claims reviewed.",
  cut=None, comm="Internal.", cs="n/a", kpi="Qualified conversations; claims audit gap.", deps="D30", risks="15 over-evidence statements; personal-mailbox and personal-domain dependencies.", br="domain/d33-site", tests="app/src/lib/companysiteconversion.test.ts; claims tests",
  nxt=[("P0", "Fix or withdraw C-01..C-15 on the deployed site and record the live check")], repl=None, slo="C3")

D(id="D34", name="Developer platform", ph=10, seat="engineering", pri="P2", mat=[NI], gates=["SEC"], ready=NOTREADY, ladder="building",
  ev=["docs/api/productivity.v1.openapi.json", "packages/platform/src/gateway/", "examples/", "docs/API-PLATFORM.md"],
  vision="Versioned APIs, OAuth/OIDC, webhooks, SDKs, sandbox tenants and certification.", users="Institution developers, partners.", jobs="Integrate, extend, test, get certified.", cur="One OpenAPI contract (productivity v1); four examples.",
  nat="Semester.", integ="n/a", model="provider_registry; webhook events.", scope="Tenant; app.", caps="Scopes per app.", cls="Per scope.", consent="Tenant install approval.", ai="None.", cut=None, comm="Platform fees (unapproved).", cs="Developer support.",
  kpi="Time to first call in sandbox; API error rate.", deps="D26, D27", risks="Only productivity API exists; OAuth app model not built.", br="domain/d34-developer", tests="app/server/productivity/openapi.test.ts",
  nxt=[("P2", "OAuth client + scope model ADR, then sandbox tenant provisioning")], repl=None, slo="C2")

D(id="D35", name="Marketplace and partners", ph=10, seat="founder", pri="P3", mat=[NS, DD], gates=["SEC", "PRIV", "INST"], ready=NOTREADY, ladder="designed",
  ev=["docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md", "docs/decisions/proposed/ (ADR-0024)", "docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md"],
  vision="Reviewed third-party apps with scopes, tenant approval, support and offboarding.", users="Partners, institutions, students.", jobs="Discover, install, pay, remove.", cur="None.", nat="Not started; gated by D-1236 (G-OWN, G-DATA, G-TERMS, G-QUEUE).",
  integ="n/a", model="none", scope="Tenant.", caps="Per app.", cls="Per scope.", consent="Tenant install approval.", ai="Providers are marketplace apps under AI policy.", cut=None, comm="Take rate undecided (12% vs 15%).", cs="Partner success.",
  kpi="n/a until built", deps="D34", risks="Premature: the first 3 partners should be integrations, not a marketplace.", br="domain/d35-marketplace", tests="none", nxt=[("P3", "Do not build; revisit when D34 has 3 certified integrations")], repl=None, slo="C3")

D(id="D36", name="Data, analytics and outcomes", ph=4, seat="data", pri="P1", mat=[NI], gates=["PRIV", "INST"], ready=NOTREADY, ladder="building",
  ev=["app/src/lib/institution-ops.ts", "app/src/insights/", "supabase/analytics.sql", "docs/PRODUCT-ANALYTICS-DATA-ETHICS.md"],
  vision="Aggregate-by-default analytics with visible definitions, freshness and minimum cohort size; no opaque risk scores.", users="Institution leaders, Semester operators, faculty.", jobs="See adoption, bottlenecks, outcomes honestly.",
  cur="Staff studio works on pasted data on the device; no institutional data ships.", nat="Semester.", integ="Warehouse export.", model="outcome_aggregates, account_health_snapshots.", scope="Tenant.", caps="outcomes:read, demand:read",
  cls="T2-T3 aggregates; cell size >= 10.", consent="Purpose-limited.", ai="Explains metrics; no punitive automation.", cut=None, comm="Institutional.", cs="Outcome reviews.", kpi="See SEMESTER_OUTCOME_MEASUREMENT.md", deps="D26, D28",
  risks="No outcome baseline (EXT-015 blocked).", br="domain/d36-analytics", tests="app/src/lib/institution-ops.test.ts", nxt=[("P1", "Metric dictionary with definition, source, freshness and cohort rule for every metric")], repl=None, slo="C2")

D(id="D37", name="Reliability, SLO and release operations", ph=1, seat="operations", pri="P0", mat=[DD, NI], gates=["SEC", "RBK"], ready=NOTREADY, ladder="building",
  ev=["docs/sre/", ".github/workflows/", "RESTORE.md", "ROLLBACK.md", "docs/evidence/restore/", "docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md"],
  vision="Measured SLOs, rehearsed restores, canary and rollback, alerts to a person.", users="Operators, customers.", jobs="Release safely; recover; know.", cur="CI gates; one operator; logical restore rehearsal only.",
  nat="Semester.", integ="Supabase, Vercel, GitHub.", model="platform_release_evidence.", scope="Platform.", caps="incident_responder", cls="n/a", consent="n/a", ai="Incident assistance only.", cut=None, comm="Included.",
  cs="Status page.", kpi="Restore time (measured); error-budget burn; change-failure rate; main-green rate.", deps="all", risks="Production restore never done; RTO/RPO unmeasured; 26 of last 30 main CI runs failed; no ruleset on main.",
  br="domain/d37-reliability", tests="supabase/restore.sh in CI; app/src/lib/sre/*.test.ts", nxt=[("P0", "Fix main CI red and apply the main ruleset (Phase 1 step 0a/0b)"), ("P0", "Run the restore drill into the second project and record the measured time (step 1)")], repl=None, slo="C0")

D(id="D38", name="People, hiring and company operations", ph=9, seat="founder", pri="P1", mat=[DD], gates=[], ready=NOTREADY, ladder="designed",
  ev=["docs/finance/12-GATED-HIRING-SCHEDULE.md", "OWNER-AND-ACCOUNTABILITY-MATRIX.md", "docs/company/COMPANY-OPERATING-MODEL.md"],
  vision="A staffed organisation where each seat has a person, a backup and an independent reviewer.", users="Founder, hires, advisors.", jobs="Hire against evidence gates; hold reviews independent.",
  cur="One person holds every seat; every backup unassigned; no advisor engaged.", nat="n/a (company).", integ="n/a", model="council_seat_holder.", scope="Company.", caps="n/a", cls="n/a", consent="n/a", ai="n/a", cut=None,
  comm="n/a", cs="n/a", kpi="Seats held by a second person; backups assigned.", deps="D39", risks="Single-person dependency (R-018); independent review impossible.", br="company/d38-people", tests="app/src/lib/launchreadiness.test.ts",
  nxt=[("P0", "Name an independent reviewer and a backup for security, privacy and release")], repl=None, slo="n/a")

D(id="D39", name="Finance, runway and board reporting", ph=9, seat="finance", pri="P1", mat=[DD], gates=["PRIV"], ready=NOTREADY, ladder="designed",
  ev=["docs/finance/README.md", "docs/finance/13-REAL-NUMBERS-INTAKE.md", "docs/finance/semester-financial-model.xlsx"],
  vision="Real cash, spend, collections and a board package.", users="Founder, advisors, investors.", jobs="Know runway; decide hires; report.", cur="Hypothesis model; opening cash $0 placeholder; no real runway number.",
  nat="n/a", integ="Accounting system (none).", model="n/a", scope="Company.", caps="n/a", cls="n/a", consent="n/a", ai="n/a", cut=None, comm="n/a", cs="n/a", kpi="Runway months (from real cash).", deps="D38",
  risks="No tax, accounting, insurance or revenue-recognition review (EXT-004/005).", br="company/d39-finance", tests="docs/finance/tools parity checks", nxt=[("P0", "Enter real cash and costs into 13-REAL-NUMBERS-INTAKE.md")], repl=None, slo="n/a")

D(id="D40", name="Globalization, localization and accessibility expansion", ph=10, seat="accessibility", pri="P2", mat=[DD], gates=["A11Y", "PRIV", "INST"], ready=NOTREADY, ladder="designed",
  ev=["docs/LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md", "docs/COLOR-AND-DARK-MODE-SPEC.md", "app/src/a11y/"], vision="Plain-language, localised, accessible-by-default experiences across languages and jurisdictions.",
  users="Students, institutions outside the US.", jobs="Use Semester in my language with my assistive tech.", cur="English; accessibility features present, no external evaluation.", nat="Semester.", integ="n/a", model="n/a", scope="All.", caps="n/a",
  cls="n/a", consent="Jurisdiction-specific (GDPR, UK, etc.).", ai="Language-aware evaluation.", cut=None, comm="n/a", cs="n/a", kpi="Screens meeting WCAG 2.2 AA by independent evaluation.", deps="D30", risks="No ACR; no localisation framework verified in code.",
  br="domain/d40-global", tests="app/src/a11y/*.test.ts (axe)", nxt=[("P1", "Independent accessibility evaluation (EXT-008) precedes any 'accessible' claim")], repl=None, slo="C3")


# The three flags below are universal wherever their rule holds, because no
# independent assessment exists for any domain (EXT-006 security, EXT-008
# accessibility, EXT-002/003 counsel). A card's own `gates` list adds the
# domain-specific ones (INST, MIG, REC, RBK). Applied after the cards so the
# matrix cannot read a missing flag as "reviewed".
_A11Y = {f"D{n:02d}" for n in list(range(1, 27))} | {"D30", "D31", "D33", "D36", "D40"}
_SEC = {f"D{n:02d}" for n in range(1, 38)}
_PRIV = {f"D{n:02d}" for n in list(range(1, 34))} | {"D36", "D40"}
for _d in DOMAINS:
    for _flag, _set in (("A11Y", _A11Y), ("SEC", _SEC), ("PRIV", _PRIV)):
        if _d["id"] in _set and _flag not in _d["gates"]:
            _d["gates"].append(_flag)
    _order = list(GATES)
    _d["gates"].sort(key=_order.index)
