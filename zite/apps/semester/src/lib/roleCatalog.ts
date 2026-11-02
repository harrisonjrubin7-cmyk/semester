// Role experience register. Presentation metadata only — never an authorization grant.
// destination is null when no real screen exists yet (no fake routes).
export type RoleState = 'Built' | 'Partial' | 'Not built';
export type RoleSpec = { role: string; layout: string; destination: string | null; grant: string; state: RoleState; gap?: string };
export type Family = { id: string; label: string; roles: RoleSpec[] };

const r = (role: string, layout: string, destination: string | null, grant: string, state: RoleState, gap?: string): RoleSpec => ({ role, layout, destination, grant, state, gap });

export const LAYOUTS: Record<string, string> = {
  L1: 'Personal focus', L2: 'Pathway', L3: 'Teaching studio', L4: 'Caseload', L5: 'Controlled operations', L6: 'Service operations',
  L7: 'Network', L8: 'Control plane', L9: 'Business operations', L10: 'Engineering/reliability', L11: 'Executive/governance', L12: 'Delegated access',
};

export const FAMILIES: Family[] = [
  { id: 'A', label: 'Learners and delegated access', roles: [
    r('Prospective student', 'L2', 'Applicants portal', 'none (public)', 'Partial', 'No program comparison or information requests'),
    r('Applicant', 'L2', 'Applicants portal', 'own application', 'Built'),
    r('Admitted student', 'L2→L1', '/staff/admissions → /today', 'Student membership on admission', 'Built'),
    r('Self-serve student', 'L1', '/today', 'Personal workspace', 'Built'),
    r('Institution-linked student', 'L1', '/today', 'Student', 'Built'),
    r('Transfer student', 'L2', null, 'Student', 'Not built', 'No transfer-credit evaluation'),
    r('Graduate/professional student', 'L1/L2', null, 'Student', 'Not built', 'No milestones or committees'),
    r('Student with accommodation needs', 'L1', null, 'Student', 'Not built', 'No restricted accommodation cases'),
    r('Alumni', 'L1/L7', '/staff/mentoring', 'Alumni', 'Built'),
    r('Family/guardian', 'L12', 'Family portal', 'Student-issued share', 'Partial'),
    r('Authorized payer', 'L12', null, 'Payer share', 'Not built', 'No payment provider connected'),
  ] },
  { id: 'B', label: 'Teaching and academic leadership', roles: [
    r('Faculty/instructor', 'L3', '/staff/gradebook', 'Faculty + section instructor', 'Built'),
    r('Teaching assistant', 'L3', '/staff/queue', 'Tutor/TA assignment', 'Partial'),
    r('Tutor', 'L4/L3', '/help/advising', 'Tutor', 'Built'),
    r('Course designer', 'L3', null, '—', 'Not built'),
    r('Department chair / program director / dean', 'L5/L11', null, '—', 'Not built'),
    r('Curriculum administrator / scheduler', 'L5', null, '—', 'Not built'),
  ] },
  { id: 'C', label: 'Advising, support and campus services', roles: [
    r('Academic advisor', 'L4', '/help/advising', 'Advisor', 'Built'),
    r('Student-affairs / help desk', 'L4', '/staff/affairs', 'Staff', 'Built'),
    r('Student-accounts officer', 'L5', '/staff/accounts', 'Staff', 'Partial', 'No payment processing'),
    r('Moderator', 'L4', '/console', 'Administrator', 'Partial'),
    r('Career-center staff', 'L7/L4', null, 'Staff', 'Not built'),
    r('Housing, dining, library, recreation, transport', 'L6', null, '—', 'Not built'),
    r('Accessibility, counseling, safety', 'L4/L5', null, '—', 'Not built', 'Need restricted record classes first'),
  ] },
  { id: 'D', label: 'Registrar and institutional operations', roles: [
    r('Registrar / registration specialist', 'L5', '/staff/registrar', 'Staff', 'Built'),
    r('Admissions staff', 'L5', '/staff/admissions', 'Staff', 'Built'),
    r('Institution administrator', 'L8', '/console', 'Administrator', 'Built'),
    r('IT / SSO administrator', 'L8', '/console', 'Administrator', 'Partial', 'Connectors off until authorized'),
    r('Security / privacy officer', 'L8', '/console', 'Administrator', 'Partial'),
    r('Institutional auditor (read-only)', 'L8', null, '—', 'Not built'),
  ] },
  { id: 'E', label: 'Career, community and employers', roles: [
    r('Community member / org leader', 'L7', '/campus/community', 'Member', 'Built'),
    r('Mentor', 'L7', '/staff/mentoring', 'Alumni', 'Built'),
    r('Employer recruiter', 'L7', 'Employers portal', 'Own postings', 'Built'),
    r('Employer org administrator', 'L7/L8', null, '—', 'Not built'),
  ] },
  { id: 'F', label: 'Partners, marketplace and developers', roles: [
    r('Developer / developer-org admin', 'L10', null, '—', 'Not built'),
    r('Marketplace seller / app publisher', 'L7/L10', null, '—', 'Not built'),
    r('Research / transfer / channel partner', 'L7/L9', null, '—', 'Not built'),
  ] },
  { id: 'G', label: 'Semester company operations', roles: [
    r('Support specialist (time-limited access)', 'L4', '/console', 'Administrator', 'Partial'),
    r('Sales, success, implementation, finance, people ops', 'L9', null, '—', 'Not built', 'Must stay separate from student records'),
    r('Engineering, SRE, security', 'L10', null, '—', 'Not built'),
  ] },
  { id: 'H', label: 'Executive, board and investors', roles: [
    r('Founder/CEO, board member, investor viewer', 'L11/L12', null, '—', 'Not built'),
  ] },
];
