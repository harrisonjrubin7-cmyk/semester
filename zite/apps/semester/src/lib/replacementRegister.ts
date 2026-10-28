// SIS/LMS replacement status register (replacement spec §11 "Status register", §16 first executable increment).
// Each capability carries six statuses, each needing its own evidence. Deployment does not prove authorization; tests do
// not prove production use. institution_authorized and production_enabled can only be set from an approval reference
// recorded by the owner; nothing in code sets them (tests/replacementRegister.test.ts enforces this).
export const STAGES = ['designed', 'implemented', 'tested', 'deployed', 'institution_authorized', 'production_enabled', 'operationally_supported'] as const;
/** Stages only an owner can grant, by a recorded approval reference (S-91 §11). */
export const OWNER_STAGES: Stage[] = ['institution_authorized', 'production_enabled', 'operationally_supported'];
export type Stage = (typeof STAGES)[number];
export type Evidence = { stage: Stage; ref: string };
export type Capability = { id: string; area: 'SIS' | 'LMS' | 'Platform'; name: string; spec: string; route: string | null; evidence: Evidence[]; gaps: string[] };

const D = (ref: string): Evidence => ({ stage: 'designed', ref });
const I = (ref: string): Evidence => ({ stage: 'implemented', ref });
const T = (ref: string): Evidence => ({ stage: 'tested', ref });

/** §16 path, in order: section → enrollment → roster → submission → released course grade → certified official entry. */
export const FIRST_PATH = ['sec.approved', 'reg.enroll', 'lms.roster', 'lms.submission', 'grd.course', 'rec.official'];

export const CAPABILITIES: Capability[] = [
  { id: 'sec.approved', area: 'SIS', name: 'Approved section (catalog course → section with capacity)', spec: '§3.4–3.5', route: '/institution/sections',
    evidence: [D('Master Build Book; sreq-001'), I('lib/sreqMigration.ts sreq_submit/sreq_step: department → chair → registrar → create → reconcile; room/instructor clash re-check under a per-term lock'), T('dbchecks/sectionRequests.ts 28 Oct: 21/21; concurrent clashing authorizations → 1 authorized, control without the term lock → 2')],
    gaps: ['Linked components (lab/lecture) and cross-listed capacity pools not modelled', 'Section changes after students enroll (room, time, cancellation) not governed by this workflow'] },
  { id: 'reg.enroll', area: 'SIS', name: 'Concurrency-safe enrollment (last seat, idempotent submit, receipts)', spec: '§3.6, §7 Workflow A', route: '/plan/registration',
    evidence: [D('migrations/001_registrar_backend.sql'), I('lib/pgMigration.ts reg_decide/reg_seats/reg_section_locks; subMigration submit keys; serMigration per-student serialization; wlMigration waitlists and all-or-nothing swap'), T('dbchecks/registrationRace.ts 27 Oct: 20 concurrent last-seat claims → 1 seat (also with a 0.3 s window); replay and reused-key conflict; control without the row lock double-booked 6')],
    gaps: ['Race test covers reg_decide only; swap and waitlist promotion races not yet run', 'Registration opening-burst load not measured'] },
  { id: 'lms.roster', area: 'LMS', name: 'Course roster from enrollments', spec: '§4.1', route: '/learn',
    evidence: [D('Native capability matrix'), I('Zite Enrollments → section pages, gradebook, group sets; api/reconciliation.ts run compares reg_seats with Enrollments and repairs only what the ledger proves'), T('tests/reconRules.test.ts diffLedger: repairable seat, matching control, unledgered enrollment flagged (8/8)')],
    gaps: ['Sections with no ledger seats are never compared, so an enrollment created outside the registrar there is not flagged', 'Reconciliation is a manual run by an integration admin, not scheduled', 'Course space is the section itself; one space for several sections not modelled'] },
  { id: 'lms.submission', area: 'LMS', name: 'Assignment submission with states', spec: '§4.2, §7 Workflow B', route: '/today',
    evidence: [D('Native capability matrix'), I('Tasks + Submissions; private file store (fil_*, SHA-256, locked on submit); sbm_submit receipts with file manifest, on-time/late stamp, request-key replay; dln_extensions per-student deadlines (instructor or accommodation letter) applied to the late stamp, receipt records due_source'), T('Two real accounts, endpoint-level run 28 Oct: extension, upload screen, submit, receipt, grading and release 19/19 (docs/execution/signed-in-run-2026-10-28.md)'), T('dbchecks/submissions.ts 27/27 + 3 mutants; dbchecks/fileScan.ts 13/13 + quarantine mutant; tests/fileScan.test.ts 8/8 (28 Oct)'), I('lib/asgMigration.ts asg_*: assignment drafts, append-only published versions (content SHA-256, what changed), version-checked publish; sbm_receipts record the assignment version the student submitted against'), T('dbchecks/assignments.ts 16/16 + 3 mutants; two real accounts 28 Oct: draft hidden from student, stale preview refused, v1 then v2 published, same task updated, history kept 11/11')],
    gaps: ['File safety is a format and content screen (lib/fileScan.ts: type check, executables, scripts, macros, active PDF content, archive bombs, EICAR) with quarantine; signature antivirus needs an approved scanning service', 'Multiple attempts are enforced (sbm_attempts, dbchecks/attempts.ts 8/8, 28 Oct)', 'Group submissions built 28 Oct: the published version names a group set; any member submits for the group, attempts are shared under a group lock, the receipt freezes the members (dbchecks/groupSubmissions 11/11, real accounts 13/13); a teammate’s view with a second real student NOT RUN; individual extensions do not move a group deadline (owner decision pending)'] },
  { id: 'grd.course', area: 'LMS', name: 'Released course grade (gradebook snapshot → proposal → release)', spec: '§4.4', route: '/records/final-grades',
    evidence: [D('Replacement spec §4.4 three-records rule'), I('lib/ogrMigration.ts ogr_propose/ogr_release; api/staff.ts setFinal now proposes only'), T('dbchecks/officialGrades.ts O1–O10 (32/32)')],
    gaps: ['Weighted categories, drop rules and late policies not modelled (basis is points earned/possible)'] },
  { id: 'rec.official', area: 'SIS', name: 'Certified official academic grade (append-only revisions, corrections)', spec: '§3.7, §7 Workflow C', route: '/records/final-grades',
    evidence: [D('Replacement spec §7 Workflow C'), I('lib/ogrMigration.ts ogr_certify/ogr_post/ogr_correct; aum_modes authority gate; lib/ogrServer.ts projection'), T('dbchecks/officialGrades.ts O11–O32 (32/32) + 3 mutants')],
    gaps: ['Institution approval routing beyond registrar posting not configurable'] },
  { id: 'rec.transcript', area: 'SIS', name: 'Transcript and GPA from official revisions only', spec: '§3.7', route: '/records/final-grades',
    evidence: [D('Replacement spec §3.7'), I('lib/transcriptRules.ts buildTranscript; ogrServer transcriptEntries; Word download; registrar view is audited'), T('tests/transcript.test.ts 16/16 incl. repeat rules, standing and honors, policy check; repeat and referral mutants fail (28 Oct)')],
    gaps: ['Institution grading policy is stored and two-registrar approved (gpl_*, dbchecks/gradingPolicy.ts 18/18); not yet exercised signed in by two registrars', 'Standing decisions, notices, suspension holds and appeals recorded (stn_*, dbchecks/standing.ts 21/21 + 3 mutants); not yet exercised signed in by a registrar and a student; notices are in-app only (no email)', 'No stored, signed transcript snapshot or verification code yet'] },
  // Broader inventory (coarse; detail lives in roleApps and the parity CSV)
  { id: 'sis.admissions', area: 'SIS', name: 'Admissions and onboarding', spec: '§3.3', route: '/plan/transition', evidence: [D('Master Build Book'), I('applications, transition (trn_*); admissions review adm_*, versioned packages apk_*, recommendations rcm_*'), T('dbchecks/transition.ts'), T('dbchecks/admissions.ts, applicationPackages.ts, recommendations.ts (28 Oct)')], gaps: ['Rubric scoring partial', 'Assignment and review by real staff accounts NOT RUN'] },
  { id: 'sis.degree', area: 'SIS', name: 'Degree audit and graduation', spec: '§3.8', route: '/progress/degree', evidence: [D('Master Build Book'), I('degree audit page')], gaps: ['Versioned requirement rules, allocation and conferral not built'] },
  { id: 'sis.finance', area: 'SIS', name: 'Student accounts and financial aid', spec: '§3.9', route: '/you/account', evidence: [D('Master Build Book'), I('ledger entries, payment plans, aid office (afo_*)'), T('dbchecks/aidOffice.ts')], gaps: ['Money movement disabled by standing rule; agency exchanges not built'] },
  { id: 'lms.assessment', area: 'LMS', name: 'Assessment engine (versions, attempts, moderation)', spec: '§4.3', route: '/learn', evidence: [D('Native capability matrix'), I('lib/asmMigration.ts asm_*')], gaps: ['Question-type registry, QTI import/export and accommodations timing not built'] },
  { id: 'lms.content', area: 'LMS', name: 'Course content, modules and versions', spec: '§4.1', route: '/learn', evidence: [D('Native capability matrix'), I('syllabi, resources, study guides (sgd_*)'), T('dbchecks/guides.ts')], gaps: ['Module release conditions, course copy/rollover and Common Cartridge not built'] },
  { id: 'plat.authority', area: 'Platform', name: 'Authority modes per tenant and domain', spec: '§2 operating modes', route: null, evidence: [D('Replacement spec §2'), I('aum_modes, aum_set (two administrators + evidence)'), T('dbchecks/officialGrades.ts O26–O31')], gaps: ['Only the records domain reads its mode so far'] },
  { id: 'plat.permissions', area: 'Platform', name: 'Zite deny-by-default permissions', spec: '§5 Zite controls', route: null, evidence: [D('Replacement spec §5')],
    gaps: ['zite.permissions.json has no defaultPolicy and no roles; direct-table access by signed-in users is NOT verified', 'Needs Zite documentation or a second test account to verify before any change'] },
];

/** Highest stage a capability reaches with unbroken evidence (no skipping). */
export function stageOf(c: Capability): Stage | null {
  let best: Stage | null = null;
  for (const s of STAGES) { if (c.evidence.some((e) => e.stage === s && e.ref.trim())) best = s; else break; }
  return best;
}
export function problems(list: Capability[]): string[] {
  const out: string[] = [];
  for (const c of list) {
    for (const e of c.evidence) {
      if (!e.ref.trim()) out.push(`${c.id}: ${e.stage} has no evidence`);
      const i = STAGES.indexOf(e.stage);
      if (i > 0 && !c.evidence.some((x) => x.stage === STAGES[i - 1])) out.push(`${c.id}: ${e.stage} claimed without ${STAGES[i - 1]}`);
      if (OWNER_STAGES.includes(e.stage)) { if (!/^APPROVAL:/.test(e.ref)) out.push(`${c.id}: ${e.stage} needs an owner approval reference (APPROVAL:…)`); }
    }
  }
  return out;
}

// ── University domain replacement register (owner source S-91 §3, §5, §11) ──────────────────────────────────────────────
// One row per domain in the owner's inventory: the domain, not a vendor. Vendors are listed only as the systems a domain
// would replace, never as requirements. Each row names its accountable owner role, the apps it lives in, the first
// end-to-end proof S-91 asks for, the code that exists today and the evidence for each stage. A domain with no code is
// "not started" — the row is scope, not a claim. The owner stages (institution_authorized, production_enabled,
// operationally_supported) need an APPROVAL: reference, and nothing in code sets one. Deployed is not claimed: the owner
// publishes the apps, and a published app is not evidence that a domain works.
export type DomainArea = 'Academic lifecycle and teaching' | 'Recruitment, support, campus life and careers' | 'University business and enterprise operations' | 'Physical campus, information services and governance' | 'Clinical (on hold)';
export type DomainApp = 'student' | 'faculty' | 'institution' | 'applicants' | 'family' | 'employers' | 'site' | 'company' | 'lab' | 'developers';
export type Domain = {
  id: string; area: DomainArea; name: string; scope: string; apps: DomainApp[]; owner: string; firstProof: string;
  replaces: string[]; capabilities: string[]; connections: string[]; files: string[]; evidence: Evidence[]; gaps: string[]; onHold?: string;
};
const S = 'apps/semester/src/', K = 'apps/semester/dbchecks/';
const A1 = 'Academic lifecycle and teaching', A2 = 'Recruitment, support, campus life and careers', A3 = 'University business and enterprise operations', A4 = 'Physical campus, information services and governance';
const none = (why: string): Pick<Domain, 'files' | 'evidence' | 'gaps'> => ({ files: [], evidence: [], gaps: [why] });

export const DOMAINS: Domain[] = [
  // A. Academic lifecycle and teaching
  { id: 'sis', area: A1, name: 'SIS and core records', scope: 'Academic context, enrollment, standing, records, transcripts, graduation, corrections', apps: ['institution', 'student'], owner: 'Registrar',
    firstProof: 'Authorized enrollment produces the correct student schedule and faculty roster', replaces: ['Banner', 'Colleague', 'Workday Student', 'PeopleSoft Campus Solutions', 'Anthology Student', 'Jenzabar One'],
    capabilities: ['sec.approved', 'reg.enroll', 'lms.roster', 'rec.official', 'rec.transcript'], connections: ['C01', 'C02', 'C05'],
    files: [S + 'api/registration.ts', S + 'api/registrarLedger.ts', S + 'api/officialGrades.ts', S + 'lib/ogrMigration.ts', S + 'lib/hldMigration.ts', S + 'lib/stnMigration.ts', S + 'lib/prvMigration.ts'],
    evidence: [D('Replacement spec §3; S-91 §3A'), I('registrar ledger, holds, standing, official grades, records-rights requests'), T(K + 'registrationRace.ts, officialGrades.ts, holds.ts, standing.ts, recordsRights.ts')],
    gaps: ['Graduation conferral not built', 'Enrollment → roster proof across separate accounts by a real registrar NOT RUN (needs the third account)'] },
  { id: 'curriculum', area: A1, name: 'Curriculum and catalog', scope: 'Course/program proposals, governance, effective versions, requirements, catalog publication', apps: ['institution', 'faculty', 'site'], owner: 'Curriculum committee / Registrar',
    firstProof: 'Approved course revision becomes available for scheduling without changing historical requirements', replaces: ['Watermark Curriculum', 'Coursemogul', 'Acalog', 'Clean Catalog'],
    capabilities: [], connections: ['C23'], files: [S + 'lib/catMigration.ts', S + 'lib/curMigration.ts', S + 'lib/prgMigration.ts', S + 'api/curriculum.ts'],
    evidence: [D('cur-001 governance states'), I('catalog versions, curriculum governance, programs and pathways'), T('apps/semester/tests/curriculum.test.ts, program.test.ts (rules only)')],
    gaps: ['No database check of the governance functions', 'Public catalog publication beyond program discovery not built'] },
  { id: 'degree', area: A1, name: 'Degree audit and planning', scope: 'Requirements engine, what-if plans, substitutions, transfer decisions, graduation evaluation', apps: ['student', 'institution'], owner: 'Registrar / Advising',
    firstProof: 'A requirement evaluation explains exactly which record satisfies each rule', replaces: ['Degree Works', 'uAchieve'],
    capabilities: ['sis.degree'], connections: [], files: [S + 'lib/trfMigration.ts', S + 'api/transfer.ts', S + 'api/progress.ts', S + 'lib/gtrMigration.ts'],
    evidence: [D('Replacement spec §3.8'), I('transfer credit, private GPA scenarios, degree progress page'), T('apps/semester/tests/transferPath.test.ts, gradeCalc.test.ts (rules only)')],
    gaps: ['Versioned requirement rules and per-rule allocation explanation not built'] },
  { id: 'scheduling', area: A1, name: 'Course, exam and section scheduling', scope: 'Sections, instructors, rooms, exams, demand scenarios, conflicts, reserved capacity', apps: ['institution', 'faculty', 'student'], owner: 'Registrar (scheduling)',
    firstProof: 'Approved section change updates affected schedules and identifies unresolved conflicts', replaces: ['Ad Astra', '25Live', 'UniTime'],
    capabilities: ['sec.approved'], connections: ['C01'], files: [S + 'lib/sreqMigration.ts', S + 'lib/calMigration.ts', S + 'lib/aptMigration.ts', S + 'api/sectionRequests.ts'],
    evidence: [D('sreq-001'), I('section requests with clash re-check, academic calendar, office hours'), T(K + 'sectionRequests.ts')],
    gaps: ['Changes to a section after enrollment (room, time, cancellation) not governed', 'Exam scheduling and demand forecasting not built'] },
  { id: 'lms', area: A1, name: 'Learning management', scope: 'Content, modules, assignments, submissions, discussions, gradebook, feedback', apps: ['faculty', 'student'], owner: 'Teaching and learning',
    firstProof: 'Student submission reaches only assigned graders; released feedback returns to the student', replaces: ['Canvas', 'Blackboard Learn', 'Moodle'],
    capabilities: ['lms.submission', 'grd.course', 'lms.content', 'lms.roster'], connections: ['C03', 'C04'], files: [S + 'lib/asgMigration.ts', S + 'lib/sbmMigration.ts', S + 'api/learn.ts', S + 'api/assignments.ts', S + 'api/courseDiscussion.ts'],
    evidence: [D('Native capability matrix'), I('versioned assignments, attempts, receipts, private files, discussions, groups, teaching team'), T(K + 'assignments.ts, attempts.ts, submissions.ts, groupwork.ts, groupSubmissions.ts; two-account live run 28 Oct')],
    gaps: ['Group submissions built 28 Oct (dbchecks/groupSubmissions.ts 11/11); one grade for the whole group, no individual adjustment yet', 'Module release conditions and course copy not built'] },
  { id: 'assessment', area: A1, name: 'Assessment and engagement', scope: 'Item banks, quizzes, polling, rubrics, peer review, accommodations on attempts', apps: ['faculty', 'student'], owner: 'Teaching and learning',
    firstProof: 'Assessment rules and permitted accommodations apply correctly to an individual attempt', replaces: ['Gradescope', 'Top Hat', 'Kahoot!', 'Honorlock', 'Respondus'],
    capabilities: ['lms.assessment'], connections: [], files: [S + 'lib/asmMigration.ts', S + 'lib/gplMigration.ts', S + 'lib/intMigration.ts', S + 'api/assessments.ts', S + 'api/regrade.ts'],
    evidence: [D('Native capability matrix §4.3'), I('assessment engine, grading policy, regrades, academic integrity cases'), T(K + 'gradingPolicy.ts; apps/semester/tests/assessRules.test.ts, extTime.test.ts')],
    gaps: ['Accommodation timing on an individual attempt not proven end to end', 'Remote proctoring deliberately not built: S-91 asks for assurance, accessibility, privacy, appeals and human review to be defined first'] },
  { id: 'continuing', area: A1, name: 'Continuing education', scope: 'Noncredit offerings, flexible dates, registrations, sponsored cohorts, certificates', apps: ['applicants', 'student', 'institution'], owner: 'Continuing education office',
    firstProof: 'Purchase or approved sponsorship creates the correct enrollment and learning access', replaces: ['Modern Campus Lumens', 'Destiny One'],
    capabilities: [], connections: [], files: [S + 'lib/cneMigration.ts', S + 'api/continuing.ts'], evidence: [D('cne-001'), I('offerings and registrations'), T(K + 'continuing.ts')],
    gaps: ['Purchase is blocked by the money-movement rule; sponsorship-to-access proof not run'] },
  { id: 'graduate', area: A1, name: 'Graduate education', scope: 'Committees, milestones, examinations, thesis/dissertation versions, deposit', apps: ['student', 'faculty', 'institution'], owner: 'Graduate school',
    firstProof: 'Approved milestone decision updates graduate progress without exposing restricted research', replaces: ['Graduate school dossier tools'],
    capabilities: [], connections: [], files: [S + 'lib/grdMigration.ts', S + 'api/graduate.ts'], evidence: [D('grd-001'), I('graduate milestones and committee decisions')],
    gaps: ['No database check', 'Thesis versions and deposit not built'] },
  { id: 'dual', area: A1, name: 'Dual enrollment', scope: 'High-school relationships, counselor approvals, consent, college enrollment', apps: ['applicants', 'student', 'institution'], owner: 'Admissions / Registrar', firstProof: 'Required approvals result in an authorized college enrollment and correct record', replaces: ['Dual-enrollment portals'], capabilities: [], connections: [], ...none('Not started. Consent for minors needs a privacy and legal design before any build') },
  { id: 'materials', area: A1, name: 'Course materials and bookstore', scope: 'Adoptions, required materials, inventory, entitlements, opt-outs, billing', apps: ['faculty', 'institution', 'student'], owner: 'Course materials office', firstProof: 'An eligible student receives the correct licensed material and financial treatment', replaces: ['Bookstore and inclusive-access platforms'], capabilities: [], connections: [], ...none('Not started. Licensing is an external obligation; billing depends on the blocked money-movement decision') },
  // B. Recruitment, support, campus life, careers
  { id: 'admissions', area: A2, name: 'Admissions and recruitment CRM', scope: 'Inquiries, consent, campaigns, applications, review, decisions, conditions, matriculation', apps: ['site', 'applicants', 'institution'], owner: 'Admissions',
    firstProof: 'Published offer transitions into an authorized student affiliation without duplicate identity', replaces: ['Slate', 'Salesforce Education Cloud', 'Ellucian CRM Recruit'],
    capabilities: ['sis.admissions'], connections: ['C06', 'C07', 'C08', 'C09'], files: [S + 'lib/admMigration.ts', S + 'lib/apkMigration.ts', S + 'lib/rcmMigration.ts', S + 'lib/spgMigration.ts', S + 'api/admissions.ts', 'apps/semester-applicants/src/api/applications.ts', 'apps/semester-applicants/src/api/recommendations.ts'],
    evidence: [D('S-90'), I('public programs, versioned packages, private documents, recommendations, review, release'), T(K + 'admissions.ts, applicationPackages.ts, recommendations.ts, publicPrograms.ts; live runs 28 Oct')],
    gaps: ['Offer → student affiliation (C09) unassessed', 'Campaigns and inquiry consent not built', 'Staff review by real accounts NOT RUN'] },
  { id: 'advising', area: A2, name: 'Advising and coordinated support', scope: 'Caseloads, appointments, plans, referrals, follow-ups, permitted notes', apps: ['institution', 'student'], owner: 'Advising',
    firstProof: 'A referral is accepted by a named service owner and its permitted outcome returns to the student', replaces: ['EAB Navigate', 'Civitas Learning'],
    capabilities: [], connections: [], files: [S + 'api/referrals.ts', S + 'api/advisorShare.ts'], evidence: [D('Advising case lifecycle (APP-003)'), I('referrals and student-chosen advisor sharing')],
    gaps: ['No database check of referral acceptance', 'Predictive risk scoring deliberately not built'] },
  { id: 'tutoring', area: A2, name: 'Tutoring and mentoring', scope: 'Matching, eligibility, bookings, sessions, resources, follow-up', apps: ['institution', 'student'], owner: 'Learning center',
    firstProof: 'Confirmed booking reaches both parties and handles cancellation correctly', replaces: ['WCOnline', 'TutorTrac'],
    capabilities: [], connections: [], files: [S + 'lib/tutMigration.ts', S + 'lib/supMigration.ts', S + 'api/tutoring.ts'], evidence: [D('tut-001, sup-001'), I('tutoring sessions, peer mentoring, TA escalation'), T(K + 'support.ts')], gaps: ['Two-party booking and cancellation not run live'] },
  { id: 'accessibility', area: A2, name: 'Accessibility services', scope: 'Requests, restricted evidence, decisions, implementation notices, exam arrangements', apps: ['institution', 'student', 'faculty'], owner: 'Accessibility services',
    firstProof: 'Instructor receives implementation instructions without diagnostic documentation', replaces: ['Symplicity Accommodate', 'ClockWork', 'AIM'],
    capabilities: [], connections: [], files: [S + 'lib/accMigration.ts', S + 'lib/dsaMigration.ts', S + 'api/accommodations.ts', S + 'api/disability.ts'], evidence: [D('acc-001, dsa-001'), I('requests, decisions, accommodation letters applied to deadlines'), T(K + 'disability.ts')],
    gaps: ['Instructor-view live run without diagnostic evidence NOT RUN in this increment'] },
  { id: 'housing', area: A2, name: 'Housing and residence life', scope: 'Applications, contracts, assignments, occupancy, room changes, staff work', apps: ['institution', 'student'], owner: 'Housing',
    firstProof: 'A confirmed assignment reserves the correct bed interval and coordinates approved charges', replaces: ['StarRez', 'Yardi Voyager Student Housing', 'Roompact', 'eRezLife'],
    capabilities: [], connections: [], files: [S + 'lib/hsgMigration.ts', S + 'lib/rlfMigration.ts', S + 'api/housing.ts', S + 'api/reslife.ts'], evidence: [D('hsg-001, rlf-001'), I('assignments and residence-life community work'), T(K + 'reslife.ts; apps/semester/tests/housing.test.ts')],
    gaps: ['Charges depend on the blocked money-movement decision', 'Bed-interval overlap race not run'] },
  { id: 'dining', area: A2, name: 'Dining and campus commerce', scope: 'Plans, entitlements, transactions, balances, refunds, reconciliation', apps: ['institution', 'student'], owner: 'Auxiliary services',
    firstProof: 'A permitted transaction changes the correct entitlement once, including after retry', replaces: ['CBORD', 'Atrium', 'Transact Campus'],
    capabilities: [], connections: [], files: [S + 'lib/dngMigration.ts', S + 'api/dining.ts'], evidence: [D('dng-001'), I('meal plans and swipes'), T('apps/semester/tests/dining.test.ts (rules only)')],
    gaps: ['No database check of retry-once behaviour', 'Point-of-sale and card hardware integrations not built'] },
  { id: 'organizations', area: A2, name: 'Organizations and student life', scope: 'Membership, officer terms, budgets, events, attendance, elections', apps: ['institution', 'student'], owner: 'Student affairs',
    firstProof: 'Officer authority ends with their term while historical records remain intact', replaces: ['Anthology Engage', 'Presence', 'CampusGroups'],
    capabilities: [], connections: [], files: [S + 'lib/orgMigration.ts', S + 'lib/modMigration.ts', S + 'api/organizations.ts'], evidence: [D('org-001, mod-001'), I('organizations, officers, moderation and appeals'), T(K + 'orgs.ts')],
    gaps: ['Elections and budgets not built'] },
  { id: 'career', area: A2, name: 'Career and experiential learning', scope: 'Coaching, opportunities, placements, employer relationships, applications, evidence', apps: ['student', 'employers', 'institution'], owner: 'Career services',
    firstProof: 'Consented evidence reaches a verified employer without exposing private academic records', replaces: ['Handshake', 'Symplicity CSM', 'uConnect'],
    capabilities: [], connections: ['C13', 'C14', 'C15', 'C16'], files: [S + 'lib/carMigration.ts', S + 'lib/crrMigration.ts', S + 'lib/vfyMigration.ts', S + 'api/careerPartners.ts', 'apps/semester-employers/src/api/employer.ts'],
    evidence: [D('S-89'), I('approved employers, student-chosen sharing, verified evidence'), T(K + 'careers.ts, careerPartners.ts, portfolioVerify.ts; live runs 28 Oct')],
    gaps: ['Interviews, offers, talent network, events and mentoring not built (S-89)'] },
  { id: 'advancement', area: A2, name: 'Alumni and advancement', scope: 'Alumni relationships, communities, campaigns, pledges, gifts, stewardship', apps: ['institution', 'student'], owner: 'Advancement',
    firstProof: 'A gift is recorded and reconciled against the correct designation and accounting treatment', replaces: ['Raiser’s Edge NXT', 'Blackbaud CRM', 'Almabase', 'Ellucian CRM Advance'],
    capabilities: [], connections: [], files: [S + 'api/alumni.ts'], evidence: [D('Alumni directory'), I('alumni affiliation views only')], gaps: ['Gifts and pledges not built; they need the finance foundation and the money-movement decision'] },
  { id: 'family', area: A2, name: 'Family and delegates', scope: 'Invitations, bounded shares, payer authority, communications, revocation', apps: ['family', 'student', 'institution'], owner: 'Delegation (Registrar + Student accounts)',
    firstProof: 'Revocation removes future access without deleting required transaction history', replaces: ['Parent portals'],
    capabilities: [], connections: ['C10', 'C11', 'C12'], files: [S + 'api/privacy.ts', S + 'lib/famMigration.ts', 'apps/semester-family/src/api/familyView.ts'], evidence: [D('S-89 Family'), I('invitations, acceptance, student-chosen categories, billing view, access history, revocation and leaving'), T(K + 'familyInvites.ts; live run 28 Oct')],
    gaps: ['Payer authority (C11) missing: money movement blocked', 'Shared tasks and documents (S-89) not built'] },
  // C. University business and enterprise operations
  { id: 'finance', area: A3, name: 'Finance and ERP', scope: 'Chart of accounts, funds, budgets, journals, receivables, payables, assets, close', apps: ['institution'], owner: 'Controller',
    firstProof: 'Approved transaction posts balanced entries and reconciles to supporting evidence', replaces: ['Workday Financials', 'Oracle Fusion', 'PeopleSoft Financials', 'SAP S/4HANA', 'Unit4'],
    capabilities: ['sis.finance'], connections: ['C11'], files: [S + 'lib/saMigration.ts', S + 'api/studentAccount.ts', S + 'api/reconciliation.ts'], evidence: [D('Replacement spec §3.9'), I('student-account disputes, adjustments, refund requests')],
    gaps: ['No institutional ledger: chart of accounts, balanced posting and close not built (S-91 §12 item 7)', 'Must stay separate from Company OS commercial accounts'] },
  { id: 'hr', area: A3, name: 'HR and payroll', scope: 'Positions, appointments, onboarding, time, leave, compensation, payroll', apps: ['institution'], owner: 'Human resources',
    firstProof: 'An approved appointment flows into validated pay calculations and reconciled payment', replaces: ['Workday HCM', 'PeopleSoft HCM', 'Banner HR'],
    capabilities: [], connections: [], files: [S + 'lib/hrmMigration.ts', S + 'lib/rcrMigration.ts', S + 'api/hr.ts', S + 'api/recruiting.ts'], evidence: [D('hrm-001, rcr-001'), I('positions, appointments, recruiting'), T(K + 'hr.ts, recruit.ts')],
    gaps: ['Payroll not built: tax and payment obligations are external and money movement is blocked'] },
  { id: 'procurement', area: A3, name: 'Procurement and suppliers', scope: 'Requisitions, catalogs, approvals, purchase orders, receiving, invoices, contracts', apps: ['institution'], owner: 'Procurement',
    firstProof: 'Purchase order, receipt and invoice agree before authorized payment', replaces: ['Jaggaer', 'Oracle Procurement'],
    capabilities: [], connections: [], files: [S + 'lib/prcMigration.ts', S + 'api/procurement.ts'], evidence: [D('prc-001'), I('requisitions, approvals, purchase orders, three-way match'), T(K + 'procurement.ts')],
    gaps: ['Payment is not executed (money movement blocked)'] },
  { id: 'expenses', area: A3, name: 'Travel, expenses and P-cards', scope: 'Preapproval, expense reports, receipts, allocations, policy checks, disputes', apps: ['institution'], owner: 'Controller', firstProof: 'Duplicate receipt or transaction is detected without duplicating reimbursement', replaces: ['Concur', 'P-card audit tools'], capabilities: [], connections: [], ...none('Not started; depends on the finance foundation') },
  { id: 'aid', area: A3, name: 'Financial aid', scope: 'Documents, eligibility, packaging, revisions, disbursements, reconciliation', apps: ['institution', 'student'], owner: 'Financial aid',
    firstProof: 'Approved enrollment change produces the correct reviewed aid adjustment', replaces: ['PowerFAIDS', 'Banner Financial Aid'],
    capabilities: ['sis.finance'], connections: [], files: [S + 'lib/faMigration.ts', S + 'lib/faOfficeMigration.ts', S + 'lib/schMigration.ts', S + 'api/aidOffice.ts', S + 'api/scholarships.ts'], evidence: [D('fa-001'), I('requirement checklists, aid office reviews, scholarships'), T(K + 'aidOffice.ts')],
    gaps: ['Disbursement blocked by the money-movement rule; agency exchanges not built'] },
  { id: 'research', area: A3, name: 'Research administration', scope: 'Proposals, routing, budgets, awards, subawards, sponsor reporting, closeout', apps: ['institution', 'faculty'], owner: 'Sponsored programs', firstProof: 'Award activation establishes permitted accounts and controls spending', replaces: ['Cayuse', 'InfoReady', 'Fluxx'], capabilities: [], connections: [], ...none('Not started; spending controls depend on the finance foundation') },
  { id: 'ethics', area: A3, name: 'Research ethics and participant pools', scope: 'Protocols, approvals, recruitment, consent, participation, credit', apps: ['institution', 'student'], owner: 'IRB office', firstProof: 'Participation credit is awarded without exposing identifiable study responses', replaces: ['SONA', 'IRB systems'], capabilities: [], connections: [], ...none('Not started; restricted workspace design needed first') },
  { id: 'corelabs', area: A3, name: 'Core facilities and laboratories', scope: 'Equipment, qualifications, reservations, inventory, service orders, billing', apps: ['institution', 'faculty'], owner: 'Research operations', firstProof: 'Qualified booking produces the correct usage record and approved charge', replaces: ['iLab', 'core-facility schedulers'], capabilities: [], connections: [], ...none('Not started') },
  { id: 'facultyaffairs', area: A3, name: 'Faculty affairs', scope: 'Dossiers, appointments, activity reports, review, promotion, tenure', apps: ['institution', 'faculty'], owner: 'Provost office', firstProof: 'Reviewer sees only the assigned dossier and authorized review period', replaces: ['Watermark Faculty Success', 'Interfolio'], capabilities: [], connections: [], ...none('Not started; hiring lives in HR recruiting (rcr-001), not here') },
  { id: 'ir', area: A3, name: 'Institutional effectiveness and BI', scope: 'Governed metrics, assessment, evaluations, accreditation evidence, reports', apps: ['institution'], owner: 'Institutional research',
    firstProof: 'A published metric reproduces from a defined population and source version', replaces: ['Watermark', 'HelioCampus', 'Ellucian Analytics'],
    capabilities: [], connections: [], files: [S + 'lib/dgvMigration.ts', S + 'api/institutionReadiness.ts'], evidence: [D('dgv-001'), I('data-governance catalog (metadata only), readiness')],
    gaps: ['Reproducible published metrics and course evaluations not built'] },
  // D. Physical campus, information services and governance
  { id: 'library', area: A4, name: 'Library operations', scope: 'Cataloging, acquisitions, circulation, reserves, licensing, discovery, loans', apps: ['institution', 'student', 'faculty'], owner: 'Library',
    firstProof: 'A patron receives only resources they are entitled to access', replaces: ['SirsiDynix Symphony', 'Alma', 'Koha', 'Evergreen'],
    capabilities: [], connections: [], files: [S + 'lib/lbyMigration.ts', S + 'api/library.ts'], evidence: [D('lby-001'), I('circulation and resource requests'), T(K + 'library.ts')], gaps: ['Licensing and discovery not built'] },
  { id: 'repository', area: A4, name: 'Repository and publishing', scope: 'Deposit, metadata, review, embargoes, versions, preservation, publication', apps: ['institution', 'faculty', 'student', 'site'], owner: 'Library (scholarly communication)', firstProof: 'Embargoed work remains private until its authorized release', replaces: ['DSpace', 'bepress', 'Figshare'], capabilities: [], connections: [], ...none('Not started; the private file store and release pattern (rel-001) are the parts to reuse') },
  { id: 'facilities', area: A4, name: 'Facilities and capital projects', scope: 'Assets, inspections, maintenance, work orders, utilities, projects', apps: ['institution', 'student'], owner: 'Facilities',
    firstProof: 'Work order moves from request to assigned owner to verified completion', replaces: ['TMA WebTMA', 'AssetWorks AiM'],
    capabilities: [], connections: [], files: [S + 'lib/facMigration.ts', S + 'lib/astMigration.ts', S + 'api/facilities.ts', S + 'api/assets.ts'], evidence: [D('fac-001, ast-001'), I('work orders and assets'), T(K + 'facilities.ts, inventory.ts')], gaps: ['Capital projects and utilities not built'] },
  { id: 'space', area: A4, name: 'Space and event management', scope: 'Reservations, capacity, accessibility, equipment, approvals, conflicts', apps: ['institution', 'student', 'faculty'], owner: 'Space management', firstProof: 'Concurrent bookings cannot confirm the same exclusive resource', replaces: ['25Live', 'EMS'], capabilities: [], connections: [], ...none('Not started as its own domain; rooms exist in sreq-001 for teaching sections only') },
  { id: 'transport', area: A4, name: 'Parking, fleet and transit', scope: 'Permits, citations, appeals, vehicles, maintenance, routes', apps: ['institution', 'student'], owner: 'Transportation',
    firstProof: 'Approved permit or booking updates the correct operational entitlement', replaces: ['T2 Flex'], capabilities: [], connections: [], files: [S + 'lib/prkMigration.ts', S + 'api/parking.ts'], evidence: [D('prk-001'), I('permits, citations, appeals'), T(K + 'parking.ts')], gaps: ['Fleet and transit routing not built'] },
  { id: 'access', area: A4, name: 'Campus identity and physical access', scope: 'Credentials, issuance, loss/revocation, access entitlements, device integrations', apps: ['institution', 'student'], owner: 'Campus card office',
    firstProof: 'Revocation reaches the approved access infrastructure and is verified', replaces: ['CBORD CS Gold', 'Atrium', 'Transact'], capabilities: [], connections: [], files: [S + 'lib/idcMigration.ts', S + 'api/idCard.ts'], evidence: [D('idc-001'), I('cards and door entitlements'), T(K + 'idcard.ts')],
    gaps: ['No door-hardware integration: revocation reaching the access system cannot be verified'] },
  { id: 'safety', area: A4, name: 'Safety and emergency coordination', scope: 'Authorized alerts, channels, acknowledgments, exercises, escalation', apps: ['institution', 'student', 'faculty', 'family'], owner: 'Public safety', firstProof: 'Approved exercise verifies delivery and fallback without claiming unobserved receipt', replaces: ['Rave', 'Everbridge'], capabilities: [], connections: [], ...none('Not started. Outside sending is disabled by the standing rule; an alerting service needs approval') },
  { id: 'conduct', area: A4, name: 'Conduct, Title IX, complaints and legal', scope: 'Restricted intake, cases, conflicts, notices, evidence, decisions, appeals, holds', apps: ['institution'], owner: 'Dean of students / Title IX coordinator', firstProof: 'Only designated participants can access a case or its attachments', replaces: ['Maxient', 'Symplicity Advocate'], capabilities: [], connections: [], ...none('Not started; academic integrity cases (int-001) are a separate, teaching-side domain and must not be merged') },
  { id: 'international', area: A4, name: 'International and study abroad', scope: 'Cases, documentation, program participation, deadlines, required reporting', apps: ['institution', 'student'], owner: 'International office',
    firstProof: 'Designated official validates a required submission and verifies its outcome', replaces: ['Sunapsis', 'Terra Dotta'], capabilities: [], connections: [], files: [S + 'lib/sabMigration.ts', S + 'api/studyAbroad.ts'], evidence: [D('sab-001'), I('study-abroad applications'), T('apps/semester/tests/abroad.test.ts (rules only)')],
    gaps: ['Immigration reporting needs legal review before any design'] },
  { id: 'athletics', area: A4, name: 'Athletics', scope: 'Eligibility, recruiting, schedules, travel, approved NIL workflows', apps: ['institution', 'student'], owner: 'Athletics compliance', firstProof: 'Eligibility changes reach the appropriate team operators with minimum disclosure', replaces: ['Teamworks', 'ARMS'], capabilities: [], connections: [], ...none('Not started') },
  { id: 'itsm', area: A4, name: 'ITSM and technology assets', scope: 'Tickets, service catalog, knowledge, assets, change, incidents', apps: ['institution', 'student', 'faculty'], owner: 'IT services',
    firstProof: 'Request is fulfilled, entitlement verified and closure communicated', replaces: ['ServiceNow', 'TeamDynamix'], capabilities: [], connections: [], files: [S + 'lib/itsMigration.ts', S + 'api/itService.ts'], evidence: [D('its-001'), I('tickets and service catalog'), T(K + 'it.ts')], gaps: ['Entitlement verification step not built'] },
  { id: 'cms', area: A4, name: 'Web CMS and communications', scope: 'Authoring, templates, approvals, accessible publication, campaigns', apps: ['institution', 'site'], owner: 'Communications',
    firstProof: 'Only approved content publishes to the correct institution and audience', replaces: ['Modern Campus CMS', 'Drupal', 'Salesforce Marketing Cloud'], capabilities: [], connections: ['C23'], files: [S + 'api/publicPrograms.ts', 'apps/semester-site/src/api/programs.ts'], evidence: [D('spg-001 (owned by admissions)'), I('approved program publication only')],
    gaps: ['General page authoring not built; institution-owned sites need separate branding, domain and publishing decisions (S-91 §3D)'] },
  { id: 'iam', area: A4, name: 'IAM and integration control', scope: 'Affiliation lifecycle, federation, grants, provisioning, APIs, jobs, reconciliation', apps: ['institution', 'developers'], owner: 'Platform + security',
    firstProof: 'Terminated assignment loses access across application, files, search, AI and jobs', replaces: ['Shibboleth', 'Okta', 'Entra ID', 'Grouper'],
    capabilities: ['plat.authority', 'plat.permissions'], connections: ['C17', 'C18'], files: [S + 'lib/affMigration.ts', S + 'lib/decMigration.ts', S + 'lib/mapMigration.ts', S + 'lib/obxMigration.ts', S + 'lib/recMigration.ts', S + 'lib/rgwMigration.ts', S + 'api/affiliation.ts', S + 'api/rosterImport.ts'],
    evidence: [D('S-76 E28, SEC-039'), I('affiliations, decision log, mappings, outbox, connector grants'), T(K + 'audit.ts, partners.ts, rosterGateway.ts; apps/semester/tests/authz.test.ts, rosterRules.test.ts, permissionEvidence.test.ts')],
    gaps: ['Roster import (S-92/S-93) runs in shadow mode only: staged, quarantined and compared, never written to enrollments; OneRoster-shaped CSV, no conformance claimed', 'S-92 §7 denial tests: 4 evidenced, 4 partial, 3 untested, 2 not built (lib/permissionEvidence.ts)', 'Edu-API and LTI 1.3 not built', 'Federation (SAML/OIDC) not built', 'Termination → access loss across files, search, AI and jobs not proven end to end', 'Zite deny-by-default permissions NOT verified'] },
  // Clinical
  { id: 'clinical', area: 'Clinical (on hold)', name: 'Student health and counseling records', scope: 'None until a separately approved clinical boundary exists', apps: [], owner: 'Owner decision required',
    firstProof: 'None: design is on hold', replaces: ['Medicat', 'Point and Click'], capabilities: [], connections: [], files: [], evidence: [],
    gaps: ['S-91 §1 corrects the earlier claim: campus-clinic records can be FERPA education or treatment records, or HIPAA, depending on provider and purpose; specialist review required'],
    onHold: 'Clinical design blocked pending separate clinical-boundary approval (S-91 §1, §9; standing rule)' },
];

export type DomainStatus = 'not started' | 'on hold' | Stage;
export function domainStatus(d: Domain): DomainStatus { return d.onHold ? 'on hold' : (stageOf({ id: d.id, area: 'Platform', name: d.name, spec: '', route: null, evidence: d.evidence, gaps: [] }) ?? 'not started'); }
export function domainProblems(list: Domain[], caps: Capability[] = CAPABILITIES, connectionIds: string[] = []): string[] {
  const out: string[] = []; const ids = new Set<string>(); const capIds = new Set(caps.map((c) => c.id));
  for (const d of list) {
    if (ids.has(d.id)) out.push(`${d.id}: duplicate domain`); ids.add(d.id);
    out.push(...problems([{ id: d.id, area: 'Platform', name: d.name, spec: '', route: null, evidence: d.evidence, gaps: [] }]));
    if (d.evidence.some((e) => e.stage === 'implemented') && !d.files.length) out.push(`${d.id}: implemented needs code files`);
    if (d.files.length && !d.evidence.some((e) => e.stage === 'implemented')) out.push(`${d.id}: code files listed but not marked implemented`);
    if (!d.onHold && !d.owner.trim()) out.push(`${d.id}: no accountable owner`);
    if (d.onHold && (d.files.length || d.evidence.length)) out.push(`${d.id}: on hold but has code or evidence`);
    if (!d.evidence.length && !d.gaps.length && !d.onHold) out.push(`${d.id}: not started needs a stated reason`);
    for (const c of d.capabilities) if (!capIds.has(c)) out.push(`${d.id}: unknown capability ${c}`);
    if (connectionIds.length) for (const c of d.connections) if (!connectionIds.includes(c)) out.push(`${d.id}: unknown connection ${c}`);
  }
  return out;
}
/** A migration file may belong to one domain only: two domains owning one table set is the duplicate S-91 §12 item 2 forbids. */
export function sharedFiles(list: Domain[]): string[] {
  const seen = new Map<string, string>(); const out: string[] = [];
  for (const d of list) for (const f of d.files.filter((x) => x.endsWith('Migration.ts'))) { const o = seen.get(f); if (o && o !== d.id) out.push(`${f}: ${o} and ${d.id}`); else seen.set(f, d.id); }
  return out;
}
