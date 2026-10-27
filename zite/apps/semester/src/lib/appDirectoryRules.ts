// The Semester education operating system: one account (ziteUsers is shared by every app in the workspace), one database,
// ten front doors. This decides which front doors a signed-in person sees, from facts the server reads about them. Pure.

export type AppKey = 'semester' | 'faculty' | 'institution' | 'family' | 'employers' | 'applicants' | 'site' | 'company' | 'security' | 'developers';
export type AppInfo = { key: AppKey; name: string; purpose: string; internal: boolean };

export const APPS: AppInfo[] = [
  { key: 'semester', name: 'Semester', purpose: 'Your courses, plan, study and campus life', internal: false },
  { key: 'faculty', name: 'Semester Faculty', purpose: 'Teaching: courses, grading, office hours, study guides', internal: false },
  { key: 'institution', name: 'Semester Institution', purpose: 'Registrar, sections, holds and institution settings', internal: false },
  { key: 'family', name: 'Semester Family', purpose: 'What a student has chosen to share with you', internal: false },
  { key: 'employers', name: 'Semester Employers', purpose: 'Postings, applicants and scholarships you sponsor', internal: false },
  { key: 'applicants', name: 'Semester Applicants', purpose: 'Applications and admission decisions', internal: false },
  { key: 'site', name: 'Semester Site', purpose: 'Public site, trust center and contact', internal: false },
  { key: 'company', name: 'Semester Company OS', purpose: 'Running the company: customers, finance, Atlas', internal: true },
  { key: 'security', name: 'Semester Security Lab', purpose: 'Capability register, evidence and security gates', internal: true },
  { key: 'developers', name: 'Semester Developers', purpose: 'Apps built on Semester and their installs', internal: true },
];

export type Facts = {
  roles: string[];            // roles on the person's active institution memberships
  hasMembership: boolean;     // any active membership in an institution
  delegate: boolean;          // a live grading delegation (teaching assistant)
  familyShares: number;       // active data-sharing consents where the person is the recipient
  employerPostings: number;   // postings the person owns in Employers
  applications: number;       // applications the person has made
  companyRoles: string[];     // co_roles held (company staff)
  developerApps: number;      // apps the person registered in Developers
};

/** Which apps this person should see. Shown where it makes sense for them; access is still enforced inside each app. */
export function visibleApps(f: Facts): AppKey[] {
  const out: AppKey[] = [];
  if (f.hasMembership) out.push('semester');
  if (f.roles.includes('Faculty') || f.delegate) out.push('faculty');
  if (f.roles.some((r) => r === 'Administrator' || r === 'Staff')) out.push('institution');
  if (f.familyShares > 0) out.push('family');
  if (f.employerPostings > 0) out.push('employers');
  if (f.applications > 0 || !f.hasMembership) out.push('applicants');
  out.push('site');
  if (f.companyRoles.some((r) => !r.startsWith('security_'))) out.push('company');
  if (f.companyRoles.some((r) => r.startsWith('security_'))) out.push('security');
  if (f.developerApps > 0 || f.companyRoles.includes('app_reviewer')) out.push('developers');
  return out;
}

/** A safe link into another app: only https URLs, path must start with "/". */
export function appLink(base: string | null | undefined, path = '/'): string | null {
  if (!base || !/^https:\/\/[^\s/]+/i.test(base)) return null;
  const p = path.startsWith('/') ? path : `/${path}`;
  return base.replace(/\/+$/, '') + p;
}
