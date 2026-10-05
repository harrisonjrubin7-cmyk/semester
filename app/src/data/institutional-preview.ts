import type { VerifiedGrant } from '../lib/institutional-access';
import type { School } from '../lib/school';

export const PREVIEW_ROLES = [
  'student',
  'faculty',
  'teaching_assistant',
  'advisor',
  'campus_staff',
  'university_admin',
  'moderator',
  'employer',
  'applicant',
  'authorized_payer',
  'authorized_family',
  'alumni',
] as const;

export type PreviewRole = (typeof PREVIEW_ROLES)[number];

export interface PreviewPerson {
  id: string;
  name: string;
  email: string;
  role: PreviewRole;
  grants: VerifiedGrant[];
}

export interface PreviewConnection {
  system: string;
  status: 'sandbox-connected' | 'sandbox-read-only' | 'sandbox-unavailable';
  detail: string;
}

export interface SyntheticPreviewRecord {
  id: string;
  kind: 'course' | 'event' | 'message' | 'hold' | 'bill' | 'housing' | 'career' | 'support';
  summary: string;
  synthetic: true;
}

export interface InstitutionalFixture {
  id: string;
  name: string;
  domain: string;
  readiness: 'pilot';
  school: School;
  connections: PreviewConnection[];
  people: PreviewPerson[];
  records: SyntheticPreviewRecord[];
}

const roleCapabilities: Record<PreviewRole, string[]> = {
  student: ['course:read', 'work:manage', 'profile:self'],
  faculty: ['course:manage', 'roster:read', 'message:course'],
  teaching_assistant: ['course:assist', 'learning-activity:prepare', 'office-hours:prepare'],
  advisor: ['student-plan:read', 'appointment:manage'],
  campus_staff: ['service-case:manage', 'student-directory:read'],
  university_admin: ['institution:report', 'catalog:manage'],
  moderator: ['community:moderate', 'report:resolve'],
  employer: ['career-post:manage', 'candidate-consent:read'],
  applicant: ['application:self-manage', 'visit:self-manage', 'profile:self'],
  authorized_payer: ['bill:shared-read', 'payment:submit'],
  authorized_family: ['student-shared:read', 'family-preference:self'],
  alumni: ['alumni-profile:self', 'mentorship:participate', 'event:discover'],
};

const scopeKind: Record<PreviewRole, VerifiedGrant['scopeKind']> = {
  student: 'institution',
  faculty: 'course',
  teaching_assistant: 'course',
  advisor: 'department',
  campus_staff: 'organization',
  university_admin: 'institution',
  moderator: 'organization',
  employer: 'organization',
  applicant: 'institution',
  authorized_payer: 'organization',
  authorized_family: 'organization',
  alumni: 'institution',
};

function people(
  institutionId: string,
  domain: string,
  names: Record<PreviewRole, string>,
): PreviewPerson[] {
  return PREVIEW_ROLES.map((role) => ({
    id: `${institutionId}-${role.replaceAll('_', '-')}`,
    name: names[role],
    email: `${role.replaceAll('_', '.')}@${domain}`,
    role,
    grants: [
      {
        role,
        scopeKind: scopeKind[role],
        scopeId: role === 'faculty' || role === 'teaching_assistant' ? `${institutionId}-course-101` : `${institutionId}-${role}`,
        capabilities: roleCapabilities[role],
        expiresAt: '2027-06-30T23:59:59.000Z',
      },
    ],
  }));
}

function records(prefix: string): SyntheticPreviewRecord[] {
  return [
    { id: `${prefix}-course`, kind: 'course', summary: 'Foundations seminar', synthetic: true },
    { id: `${prefix}-event`, kind: 'event', summary: 'Advising appointment', synthetic: true },
    { id: `${prefix}-message`, kind: 'message', summary: 'Course welcome', synthetic: true },
    { id: `${prefix}-hold`, kind: 'hold', summary: 'Advising review required', synthetic: true },
    { id: `${prefix}-bill`, kind: 'bill', summary: 'Sample term statement', synthetic: true },
    { id: `${prefix}-housing`, kind: 'housing', summary: 'Sample residence assignment', synthetic: true },
    { id: `${prefix}-career`, kind: 'career', summary: 'Sample internship posting', synthetic: true },
    { id: `${prefix}-support`, kind: 'support', summary: 'Sample support case', synthetic: true },
  ];
}

function school(id: string, name: string, domain: string, termName: string): School {
  return {
    id,
    name,
    emailDomains: [domain],
    verified: false,
    capabilities: {
      mealPlan: 'both',
      cardName: 'Campus funds',
      swipeUnit: 'meals',
      housing: true,
      registrarName: 'Sandbox registrar',
      registrarUrl: `https://registrar.${domain}`,
      orgPortalName: 'Sandbox involvement portal',
      orgPortalUrl: `https://activities.${domain}`,
      lmsName: 'Sandbox learning system',
      lmsUrl: `https://learn.${domain}`,
      lmsIcsHelpUrl: `https://help.${domain}/calendar`,
      campusMap: true,
      athleticsName: 'Preview athletics',
      libraryUrl: `https://library.${domain}`,
      healthUrl: `https://health.${domain}`,
      advisingUrl: `https://advising.${domain}`,
    },
    data: {
      academicCalendar: [
        {
          termName,
          startsOn: '2026-08-24',
          endsOn: '2026-12-11',
          deadlines: [
            { label: 'Sample add deadline', on: '2026-09-04' },
            { label: 'Sample withdrawal deadline', on: '2026-10-30' },
          ],
          breaks: [{ label: 'Sample autumn break', from: '2026-10-12', to: '2026-10-13' }],
          finalsFrom: '2026-12-07',
          finalsTo: '2026-12-11',
        },
      ],
    },
  };
}

const fixtures: InstitutionalFixture[] = [
  {
    id: 'northstar',
    name: 'Northstar University',
    domain: 'northstar.example',
    readiness: 'pilot',
    school: school('northstar', 'Northstar University', 'northstar.example', 'Sample Fall 2026'),
    connections: [
      { system: 'Student information', status: 'sandbox-connected', detail: 'Synthetic read-only records' },
      { system: 'Learning system', status: 'sandbox-connected', detail: 'Synthetic courses and assignments' },
      { system: 'Payments', status: 'sandbox-unavailable', detail: 'No transaction network attached' },
    ],
    people: people('northstar', 'northstar.example', {
      student: 'Avery Student',
      faculty: 'Riley Faculty',
      teaching_assistant: 'Emerson Teaching Assistant',
      advisor: 'Morgan Advisor',
      campus_staff: 'Casey Campus',
      university_admin: 'Jordan Administrator',
      moderator: 'Quinn Moderator',
      employer: 'Taylor Employer',
      applicant: 'Alex Applicant',
      authorized_payer: 'Parker Payer',
      authorized_family: 'Finley Family',
      alumni: 'Arden Alumni',
    }),
    records: records('northstar'),
  },
  {
    id: 'cedar-coast',
    name: 'Cedar Coast College',
    domain: 'cedarcoast.example',
    readiness: 'pilot',
    school: school('cedar-coast', 'Cedar Coast College', 'cedarcoast.example', 'Sample Autumn 2026'),
    connections: [
      { system: 'Student information', status: 'sandbox-read-only', detail: 'Synthetic roster snapshot' },
      { system: 'Learning system', status: 'sandbox-connected', detail: 'Synthetic course workspace' },
      { system: 'Housing', status: 'sandbox-unavailable', detail: 'Sample records only' },
    ],
    people: people('cedar-coast', 'cedarcoast.example', {
      student: 'Sage Student',
      faculty: 'Rowan Faculty',
      teaching_assistant: 'Hayden Teaching Assistant',
      advisor: 'Devon Advisor',
      campus_staff: 'Skyler Campus',
      university_admin: 'Cameron Administrator',
      moderator: 'Reese Moderator',
      employer: 'Ellis Employer',
      applicant: 'Ari Applicant',
      authorized_payer: 'Blake Payer',
      authorized_family: 'Frankie Family',
      alumni: 'Marley Alumni',
    }),
    records: records('cedar-coast'),
  },
];

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

export const INSTITUTIONAL_FIXTURES: readonly InstitutionalFixture[] = freezeDeep(fixtures);
