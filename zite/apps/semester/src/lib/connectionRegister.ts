// Ten-app connection register (owner sources S-83 to S-88, 28 Oct: semester-ten-app-architecture.json, the connection
// register CSV and three PDFs). The owner's files are a proposal with every runtime status "not_assessed"; this file is
// the audit of the actual build against them. Pure data. tests/connectionRegister.test.ts checks that every cited file
// exists and that no status is stronger than its evidence.
//
// Status meanings (from the owner's audit prompt):
//   observed    implemented and observed passing with separate real accounts or a database check
//   failing     implemented but observed failing
//   partial     some of the contract is built; the gaps say what is not
//   missing     nothing in the build carries this connection
//   unassessed  built, but not yet exercised here
// Deployment, institutional authorisation and production enablement are never inferred: no app has been published from
// this session, the only tenant is a sample institution, and nothing is production-enabled.

export const APP_IDS = {
  student: 'jeabiv2536', faculty: 'wa43436gox', institution: '3nybmrumkp', site: 'qd1fxwimuc', company: 'sbjuykr2qw',
  lab: 'jw85ejkuj1', developers: 'sci91lofpm', employers: 'qmccgvt5tr', applicants: 'eqm85cdpm7', family: 'vpysx5dj4n',
} as const;
export type AppKey = keyof typeof APP_IDS;
export type Status = 'observed' | 'failing' | 'partial' | 'missing' | 'unassessed';
export const STATUSES: Status[] = ['observed', 'failing', 'partial', 'missing', 'unassessed'];

export type Connection = {
  id: string; producer: AppKey; consumer: AppKey; contract: string; owner: string; boundary: string;
  status: Status;
  /** Repository paths (from the repo root) that implement the connection. */
  code: string[];
  /** Observed results: a dbcheck file, a test file, or a run record under docs/execution. */
  tests: string[];
  gaps: string[];
};

const S = 'apps/semester/src/';
const RUN = 'docs/execution/signed-in-run-2026-10-28.md';

export const CONNECTIONS: Connection[] = [
  { id: 'C01', producer: 'institution', consumer: 'faculty', contract: 'Teaching assignment', owner: 'Academic staffing',
    boundary: 'Current verified section assignment; expiry revokes access', status: 'observed',
    code: [S + 'lib/sreqMigration.ts', S + 'api/teaching.ts', S + 'api/assignments.ts'],
    tests: ['apps/semester/dbchecks/sectionRequests.ts', RUN],
    gaps: ['Access follows the current instructor list on every request, so removal revokes at once; dated assignments that expire on their own are not modelled'] },
  { id: 'C02', producer: 'institution', consumer: 'student', contract: 'Enrollment and hold status', owner: 'Academic records/registration',
    boundary: 'Own record; authoritative confirmation required', status: 'partial',
    code: [S + 'api/registration.ts', S + 'api/institutionOps.ts', S + 'lib/holdServer.ts', S + 'lib/hldMigration.ts'],
    tests: ['apps/semester/dbchecks/registrationRace.ts', 'apps/semester/dbchecks/holds.ts', 'apps/semester/tests/holdRules.test.ts'],
    gaps: ['Fixed 28 Oct: student views read holds from a different store than registration enforced; all five now read Student Holds',
      'Hold placement and release with a real registrar account not yet observed (needs the third account)',
      'Student Affairs holds have no approved releasing template, so only an administrator can lift them'] },
  { id: 'C03', producer: 'faculty', consumer: 'student', contract: 'Published learning and released feedback', owner: 'Learning',
    boundary: 'Enrolled audience; drafts excluded', status: 'observed',
    code: [S + 'lib/asgMigration.ts', S + 'api/assignments.ts', S + 'components/AssignmentStudio.tsx', S + 'api/learn.ts'],
    tests: ['apps/semester/dbchecks/assignments.ts', 'docs/execution/connection-audit-2026-10-28.md', RUN],
    gaps: ['Calendar projection of a new due date is through the student task, not a separate calendar event'] },
  { id: 'C04', producer: 'student', consumer: 'faculty', contract: 'Submission attempt', owner: 'Learning',
    boundary: 'Exact persisted attempt; assigned grader only', status: 'observed',
    code: [S + 'lib/sbmMigration.ts', S + 'lib/filMigration.ts', S + 'api/files.ts'],
    tests: ['apps/semester/dbchecks/submissions.ts', 'apps/semester/dbchecks/fileScan.ts', RUN],
    gaps: ['One attempt per assignment; multiple attempts and group submissions not modelled', 'Teaching-assistant grading scope not exercised with a real TA account'] },
  { id: 'C05', producer: 'faculty', consumer: 'institution', contract: 'Final-grade submission', owner: 'Academic records',
    boundary: 'Exact version; independent records validation', status: 'partial',
    code: [S + 'lib/ogrMigration.ts', S + 'api/officialGrades.ts', S + 'lib/gplMigration.ts'],
    tests: ['apps/semester/dbchecks/officialGrades.ts', 'apps/semester/dbchecks/gradingPolicy.ts', RUN],
    gaps: ['Proposal, release and certification observed; registrar posting to the official record not observed with a real registrar account'] },
  { id: 'C06', producer: 'site', consumer: 'applicants', contract: 'Application start', owner: 'Admissions',
    boundary: 'Public discovery does not reveal application data', status: 'missing',
    code: [], tests: [], gaps: ['The public site has no route into Semester Applicants; applicants reach it only by its own address'] },
  { id: 'C07', producer: 'applicants', consumer: 'institution', contract: 'Submitted application', owner: 'Admissions',
    boundary: 'Assigned reviewers; confidential evidence separated', status: 'partial',
    code: ['apps/semester-applicants/src/api/applications.ts', S + 'api/admissions.ts'], tests: [],
    gaps: ['Any staff member with admission.decide in the institution sees every application; reviewer assignment is not modelled',
      'Confidential evidence (references, fee waivers) is not separated from the application body', 'Not exercised with separate accounts'] },
  { id: 'C08', producer: 'institution', consumer: 'applicants', contract: 'Published decision', owner: 'Admissions',
    boundary: 'Only published decision to its applicant', status: 'partial',
    code: [S + 'api/admissions.ts', 'apps/semester-applicants/src/api/applications.ts'], tests: [],
    gaps: ['Recording a decision publishes it at once, with the decision note; there is no draft or release step separating deliberation from publication'] },
  { id: 'C09', producer: 'applicants', consumer: 'student', contract: 'Learner transition', owner: 'Identity and admissions/records',
    boundary: 'Verified identity linking; preserve original records', status: 'unassessed',
    code: [S + 'api/admissions.ts', S + 'api/transition.ts'], tests: [],
    gaps: ['Admission activates a Student membership on the same account and keeps the application; identity verification beyond the signed-in account is not modelled'] },
  { id: 'C10', producer: 'student', consumer: 'family', contract: 'Delegate invitation and grant', owner: 'Delegation',
    boundary: 'Exact scope, purpose, expiry; revocable', status: 'unassessed',
    code: [S + 'api/privacy.ts', 'apps/semester-family/src/api/familyView.ts'], tests: ['apps/semester/tests/shares.test.ts'],
    gaps: ['Grant, expiry and revocation are checked on every family read; not exercised with a separate family account'] },
  { id: 'C11', producer: 'family', consumer: 'institution', contract: 'Authorized payer/payment request', owner: 'Student accounts',
    boundary: 'Payer grant; rail outcome reconciled', status: 'missing',
    code: [], tests: [], gaps: ['No payer grant or payment request exists; money movement stays disabled until approved'] },
  { id: 'C12', producer: 'institution', consumer: 'family', contract: 'Permitted billing/service projection', owner: 'Student accounts/services',
    boundary: 'Only granted fields and purpose', status: 'partial',
    code: ['apps/semester-family/src/api/familyView.ts', S + 'lib/holdServer.ts'], tests: [],
    gaps: ['Granted grades, holds and calendar are projected; balances and billing are not'] },
  { id: 'C13', producer: 'employers', consumer: 'student', contract: 'Approved opportunity', owner: 'Career',
    boundary: 'Verified organization; eligibility and publication review', status: 'partial',
    code: ['apps/semester-employers/src/api/employer.ts', 'apps/semester-employers/src/lib/hiringServer.ts', S + 'api/campus.ts'], tests: [],
    gaps: ['Opportunities reach students through an outbox without publication review or organization verification',
      'Students see every opportunity, not only those approved for their institution'] },
  { id: 'C14', producer: 'student', consumer: 'employers', contract: 'Application/shared evidence', owner: 'Career',
    boundary: 'Student-selected payload and organization audience', status: 'partial',
    code: [S + 'api/campus.ts', 'apps/semester-employers/src/api/employer.ts'], tests: [],
    gaps: ['Applying shares the student identity only; choosing what evidence to share is not built'] },
  { id: 'C15', producer: 'institution', consumer: 'employers', contract: 'Employer approval/event partnership', owner: 'Career',
    boundary: 'Institution-specific approval; no global access', status: 'missing',
    code: [], tests: [], gaps: ['No institution-level employer approval exists'] },
  { id: 'C16', producer: 'faculty', consumer: 'student', contract: 'Verified portfolio evidence', owner: 'Career',
    boundary: 'Bounded claim; learner controls external publication', status: 'missing',
    code: [], tests: [], gaps: ['No faculty-verified evidence claim exists'] },
  { id: 'C17', producer: 'institution', consumer: 'developers', contract: 'Integration authorization', owner: 'Integration control',
    boundary: 'Tenant-specific client scopes', status: 'unassessed',
    code: [S + 'api/devApps.ts', S + 'lib/devMigration.ts'], tests: [],
    gaps: ['Administrators install sandbox apps with scopes per institution; not exercised with separate accounts here'] },
  { id: 'C18', producer: 'developers', consumer: 'institution', contract: 'Integration registration/status', owner: 'Integration control',
    boundary: 'Sandbox first; production separate approval', status: 'unassessed',
    code: ['apps/semester-developers/src/api/sandbox.ts', 'apps/semester-developers/src/api/platform.ts'], tests: [],
    gaps: ['Sandbox-only by design; there is no production path to approve'] },
  { id: 'C19', producer: 'institution', consumer: 'company', contract: 'Customer readiness metadata', owner: 'Company operations',
    boundary: 'Approved non-sensitive metadata only', status: 'missing',
    code: [], tests: [], gaps: ['Institution readiness is read inside Semester Institution only; Company OS does not receive it'] },
  { id: 'C20', producer: 'company', consumer: 'institution', contract: 'Implementation/support coordination', owner: 'Company operations',
    boundary: 'No standing tenant-record access', status: 'unassessed',
    code: ['apps/semester-company-os/src/api/supportAccess.ts', S + 'api/supportAccessApproval.ts'], tests: [],
    gaps: ['Support access is time-limited (up to 8 hours), scoped, and needs an institution administrator; not exercised with separate accounts here'] },
  { id: 'C21', producer: 'lab', consumer: 'company', contract: 'Sanitized release evidence', owner: 'Assurance',
    boundary: 'Synthetic/sanitized; no sensitive payloads', status: 'partial',
    code: ['apps/semester-security-lab/src/api/capabilityEvidence.ts', 'apps/semester-company-os/src/api/atlas.ts'], tests: [],
    gaps: ['Company OS reads capability evidence; sanitisation of what is passed is not checked'] },
  { id: 'C22', producer: 'lab', consumer: 'institution', contract: 'Sanitized assurance evidence', owner: 'Assurance',
    boundary: 'No production writes or automatic production access', status: 'missing',
    code: [], tests: [], gaps: ['Institutions receive no assurance evidence'] },
  { id: 'C23', producer: 'institution', consumer: 'site', contract: 'Approved publication', owner: 'Publishing',
    boundary: 'Explicit publication; safe public projection', status: 'missing',
    code: [], tests: [], gaps: ['The site publishes Company OS posts after review; institutions cannot publish to it'] },
];

/** Rules a status must satisfy against its evidence. Returns problems; empty means consistent. */
export function statusProblems(c: Connection): string[] {
  const p: string[] = [];
  if (!STATUSES.includes(c.status)) p.push(`${c.id}: unknown status`);
  if (c.status === 'missing' && c.code.length) p.push(`${c.id}: missing but cites code`);
  if (c.status !== 'missing' && !c.code.length) p.push(`${c.id}: ${c.status} needs code references`);
  if (c.status === 'observed' && !c.tests.length) p.push(`${c.id}: observed needs test evidence`);
  if (c.status !== 'observed' && !c.gaps.length) p.push(`${c.id}: anything short of observed must say what is missing`);
  return p;
}

export function summary(cs: Connection[] = CONNECTIONS): Record<Status, number> {
  const out = { observed: 0, failing: 0, partial: 0, missing: 0, unassessed: 0 } as Record<Status, number>;
  for (const c of cs) out[c.status]++;
  return out;
}
