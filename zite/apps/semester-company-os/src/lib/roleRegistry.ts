// The Company OS view of the 69-role register (Semester Atlas, S-71). Derived from the canonical register in the
// Student app (apps/semester/src/lib/roleApps.ts, generated from the owner's role catalog) so the two can never
// drift. Status follows evidence only: a role with any built or partly built capability has a surface and is
// 'partial' — nothing here claims verified, activated or complete — and a role with no surface at all is 'missing'.
import { ROLE_APPS as CANONICAL } from '../../../semester/src/lib/roleApps';

export type RoleAppStatus = 'partial' | 'missing';
export type RoleAppEntry = { n: number; role: string; key: string; host: string; existing: boolean; status: RoleAppStatus };

export const ROLE_APPS: RoleAppEntry[] = CANONICAL.map((a, i) => {
  const existing = a.capabilities.some((c) => c.state === 'existing' || c.state === 'incomplete');
  return { n: i + 1, role: a.role, key: a.key, host: a.host, existing, status: (existing ? 'partial' : 'missing') as RoleAppStatus };
});

export type Journey = { id: string; name: string; roles: string[] };

/** The ten cross-app acceptance workflows (docs/execution/cross-app-workflows.csv, XW-01..XW-10), each step named
 *  by its registry role. Steps in the source that name a function rather than a role are not listed. */
export const JOURNEYS: Journey[] = [
  { id: 'XW-01', name: 'Inquiry to enrolled student', roles: ['Prospective Student', 'Admitted Student', 'Orientation Leader', 'Registrar', 'Student'] },
  { id: 'XW-02', name: 'Transfer to degree plan', roles: ['Transfer Student', 'Transfer Partner Admin', 'Registrar', 'Academic Advisor', 'Student'] },
  { id: 'XW-03', name: 'Accommodation delivery', roles: ['Student', 'Disability Services Officer', 'Disability Services Staff', 'Faculty'] },
  { id: 'XW-04', name: 'Course to career evidence', roles: ['Faculty', 'Student', 'Career Coach', 'Employer'] },
  { id: 'XW-05', name: 'Financial support', roles: ['Student', 'Financial Aid Officer', 'Scholarship Provider', 'Student Accounts Officer'] },
  { id: 'XW-06', name: 'Athletics support', roles: ['Athletic Academic Support', 'Faculty', 'Tutor', 'Athletics Compliance Officer'] },
  { id: 'XW-07', name: 'Housing issue', roles: ['Student', 'Resident Assistant', 'Residence Life Staff'] },
  { id: 'XW-08', name: 'Graduate research', roles: ['Graduate Student', 'Faculty', 'Research Partner'] },
  { id: 'XW-09', name: 'Customer launch', roles: ['Account Executive', 'Trust Officer', 'Implementation Manager', 'Integration Admin', 'University Admin', 'Customer Success'] },
  { id: 'XW-10', name: 'Safety appeal', roles: ['Moderator', 'Trust Safety Reviewer', 'Trust Safety Senior'] },
];
