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
    tests: ['apps/semester/dbchecks/submissions.ts', 'apps/semester/dbchecks/fileScan.ts', 'apps/semester/dbchecks/attempts.ts', RUN],
    gaps: ['Multiple attempts built 28 Oct: the published version sets the allowance, each receipt is numbered (dbchecks/attempts 8/8, real accounts 7/7); group submissions not modelled', 'Teaching-assistant grading scope not exercised with a real TA account'] },
  { id: 'C05', producer: 'faculty', consumer: 'institution', contract: 'Final-grade submission', owner: 'Academic records',
    boundary: 'Exact version; independent records validation', status: 'partial',
    code: [S + 'lib/ogrMigration.ts', S + 'api/officialGrades.ts', S + 'lib/gplMigration.ts'],
    tests: ['apps/semester/dbchecks/officialGrades.ts', 'apps/semester/dbchecks/gradingPolicy.ts', RUN],
    gaps: ['Proposal, release and certification observed; registrar posting to the official record not observed with a real registrar account'] },
  { id: 'C06', producer: 'site', consumer: 'applicants', contract: 'Application start', owner: 'Admissions',
    boundary: 'Public discovery does not reveal application data', status: 'observed',
    code: ['apps/semester-site/src/api/programs.ts', 'apps/semester-site/src/Programs.tsx', 'apps/semester-applicants/src/App.tsx'],
    tests: ['apps/semester/tests/endpointAuth.test.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['The Apply button appears only once company staff set the Applicants address in the app directory (not set yet)', 'The program choice survives sign-in through session storage; the redirect itself NOT RUN in a browser'] },
  { id: 'C07', producer: 'applicants', consumer: 'institution', contract: 'Submitted application', owner: 'Admissions',
    boundary: 'Assigned reviewers; confidential evidence separated', status: 'observed',
    code: [S + 'lib/admMigration.ts', S + 'api/admissions.ts', S + 'pages/Admissions.tsx', 'apps/semester-applicants/src/api/applications.ts'],
    tests: ['apps/semester/dbchecks/admissions.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['A reviewer sees only applications assigned to them; administrators see all to assign', 'References and fee waivers are not modelled, so there is no separate confidential evidence yet', 'Assignment and review by real staff accounts NOT RUN (needs the third account)'] },
  { id: 'C08', producer: 'institution', consumer: 'applicants', contract: 'Published decision', owner: 'Admissions',
    boundary: 'Only published decision to its applicant', status: 'observed',
    code: [S + 'lib/admMigration.ts', S + 'api/admissions.ts', 'apps/semester-applicants/src/api/applications.ts'],
    tests: ['apps/semester/dbchecks/admissions.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Drafts and internal notes never reach the applicant; only the released message does. Release by a real staff account NOT RUN'] },
  { id: 'C09', producer: 'applicants', consumer: 'student', contract: 'Learner transition', owner: 'Identity and admissions/records',
    boundary: 'Verified identity linking; preserve original records', status: 'unassessed',
    code: [S + 'api/admissions.ts', S + 'api/transition.ts'], tests: [],
    gaps: ['Admission activates a Student membership on the same account and keeps the application; identity verification beyond the signed-in account is not modelled'] },
  { id: 'C10', producer: 'student', consumer: 'family', contract: 'Delegate invitation and grant', owner: 'Delegation',
    boundary: 'Exact scope, purpose, expiry; revocable', status: 'observed',
    code: [S + 'api/privacy.ts', S + 'components/FamilyShare.tsx', 'apps/semester-family/src/api/familyView.ts'], tests: ['apps/semester/tests/shares.test.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Grant through the student endpoint and scope limits observed with a separate account; in the run, revocation was applied to the consent record directly, not through the privacy screen'] },
  { id: 'C11', producer: 'family', consumer: 'institution', contract: 'Authorized payer/payment request', owner: 'Student accounts',
    boundary: 'Payer grant; rail outcome reconciled', status: 'missing',
    code: [], tests: [], gaps: ['No payer grant or payment request exists; money movement stays disabled until approved'] },
  { id: 'C12', producer: 'institution', consumer: 'family', contract: 'Permitted billing/service projection', owner: 'Student accounts/services',
    boundary: 'Only granted fields and purpose', status: 'observed',
    code: ['apps/semester-family/src/api/familyView.ts', S + 'lib/billingRules.ts', S + 'lib/holdServer.ts'], tests: ['apps/semester/tests/billingRules.test.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['A Billing share shows per-term balance and next due date only; line items, aid and payment methods stay private'] },
  { id: 'C13', producer: 'employers', consumer: 'student', contract: 'Approved opportunity', owner: 'Career',
    boundary: 'Verified organization; eligibility and publication review', status: 'observed',
    code: [S + 'lib/crrMigration.ts', S + 'lib/crrServer.ts', S + 'api/campus.ts', 'apps/semester-employers/src/api/employer.ts', 'apps/semester-employers/src/Partners.tsx'],
    tests: ['apps/semester/dbchecks/careerPartners.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Approval is per institution and revocable (dbcheck); approving with a real staff account NOT RUN (needs the third account)', 'Per-posting publication review is not separate from partnership approval', 'Four unverified sample listings are hidden until an employer account posts them and is approved'] },
  { id: 'C14', producer: 'student', consumer: 'employers', contract: 'Application/shared evidence', owner: 'Career',
    boundary: 'Student-selected payload and organization audience', status: 'observed',
    code: [S + 'api/campus.ts', S + 'pages/Career.tsx', 'apps/semester-employers/src/api/employer.ts'],
    tests: ['apps/semester/dbchecks/careerPartners.ts'],
    gaps: ['The employer sees the name, the ticked portfolio items, and the email only if shared; a real approved application end to end NOT RUN (needs an approved partnership)'] },
  { id: 'C15', producer: 'institution', consumer: 'employers', contract: 'Employer approval/event partnership', owner: 'Career',
    boundary: 'Institution-specific approval; no global access', status: 'observed',
    code: [S + 'api/careerPartners.ts', 'apps/semester-institution/src/api/careerPartners.ts', 'apps/semester-institution/src/pages/Employers.tsx'],
    tests: ['apps/semester/dbchecks/careerPartners.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Event partnerships are not modelled; approval covers opportunities only'] },
  { id: 'C16', producer: 'faculty', consumer: 'student', contract: 'Verified portfolio evidence', owner: 'Career',
    boundary: 'Bounded claim; learner controls external publication', status: 'observed',
    code: [S + 'lib/vfyMigration.ts', S + 'api/portfolioVerify.ts', S + 'components/PortfolioVerify.tsx', 'apps/semester-faculty/src/api/portfolioVerify.ts', 'apps/semester-employers/src/api/employer.ts'],
    tests: ['apps/semester/dbchecks/portfolioVerify.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['The claim reaches an employer only with an item the student shares; that last hop NOT RUN (needs an approved employer partnership)'] },
  { id: 'C17', producer: 'institution', consumer: 'developers', contract: 'Integration authorization', owner: 'Integration control',
    boundary: 'Tenant-specific client scopes', status: 'unassessed',
    code: [S + 'api/devApps.ts', S + 'lib/devMigration.ts'], tests: ['docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Instructor and student refused an institution install (observed); an install by a real administrator NOT RUN (needs an administrator account)'] },
  { id: 'C18', producer: 'developers', consumer: 'institution', contract: 'Integration registration/status', owner: 'Integration control',
    boundary: 'Sandbox first; production separate approval', status: 'observed',
    code: ['apps/semester-developers/src/api/sandbox.ts', 'apps/semester-developers/src/api/platform.ts', S + 'lib/pg.ts'], tests: ['docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Fixed 28 Oct: the Developers app could not start until an institution administrator opened Developer apps; it now creates its own tables', 'Sandbox-only by design; there is no production path to approve'] },
  { id: 'C19', producer: 'institution', consumer: 'company', contract: 'Customer readiness metadata', owner: 'Company operations',
    boundary: 'Approved non-sensitive metadata only', status: 'unassessed',
    code: [S + 'lib/releaseRules.ts', S + 'lib/relMigration.ts', S + 'api/readinessShare.ts', 'apps/semester-institution/src/components/Releases.tsx', 'apps/semester-company-os/src/api/customerEvidence.ts'],
    tests: ['apps/semester/tests/releaseRules.test.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['An institution administrator shares check states only (allowlist tested); a real share NOT RUN (needs an administrator account)', 'Company OS reading only released snapshots observed with the founder account'] },
  { id: 'C20', producer: 'company', consumer: 'institution', contract: 'Implementation/support coordination', owner: 'Company operations',
    boundary: 'No standing tenant-record access', status: 'observed',
    code: ['apps/semester-company-os/src/api/supportAccess.ts', S + 'api/supportAccessApproval.ts'], tests: ['docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['A request gives no access until an institution administrator approves (observed, and the attempt is logged); approval and the time-limited view NOT RUN (needs an administrator account)'] },
  { id: 'C21', producer: 'lab', consumer: 'company', contract: 'Sanitized release evidence', owner: 'Assurance',
    boundary: 'Synthetic/sanitized; no sensitive payloads', status: 'unassessed',
    code: [S + 'lib/releaseRules.ts', 'apps/semester-security-lab/src/api/releaseAssurance.ts', 'apps/semester-security-lab/src/pages/ReleasesPage.tsx', 'apps/semester-company-os/src/api/customerEvidence.ts'],
    tests: ['apps/semester/tests/releaseRules.test.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['The sanitiser on all 131 real capabilities carried no evidence text; an actual release NOT RUN, because it publishes to institutions and needs your approval', 'Company OS Atlas still reads raw evidence internally, but shows coverage only'] },
  { id: 'C22', producer: 'lab', consumer: 'institution', contract: 'Sanitized assurance evidence', owner: 'Assurance',
    boundary: 'No production writes or automatic production access', status: 'unassessed',
    code: ['apps/semester-security-lab/src/api/releaseAssurance.ts', S + 'api/assuranceEvidence.ts', 'apps/semester-institution/src/components/Releases.tsx'],
    tests: ['apps/semester/tests/releaseRules.test.ts'],
    gaps: ['Production-environment evidence blocks a release; institution administrators read released coverage on Audit & assurance. A real release NOT RUN (needs your approval)'] },
  { id: 'C23', producer: 'institution', consumer: 'site', contract: 'Approved publication', owner: 'Publishing',
    boundary: 'Explicit publication; safe public projection', status: 'observed',
    code: [S + 'lib/spgMigration.ts', S + 'api/publicPrograms.ts', 'apps/semester-institution/src/pages/Programs.tsx', 'apps/semester-site/src/api/programs.ts'],
    tests: ['apps/semester/dbchecks/publicPrograms.ts', 'docs/execution/connection-audit-2026-10-28.md'],
    gaps: ['Covers program listings only; institution news or events are not publishable yet', 'Publishing by a real catalog manager NOT RUN (needs an administrator account)'] },
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
