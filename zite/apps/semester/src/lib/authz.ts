// Unified permission check. Pure and deny-by-default: every check must pass, and the first one that fails is the reason.
// Order: membership → tenant → role → resource ownership/assignment → capability switch → policy → consent → authority.
import { ROLE_TEMPLATES } from './roleTemplates';

export type Role = 'Student' | 'Faculty' | 'Advisor' | 'Tutor' | 'Staff' | 'Administrator' | 'Alumni' | 'Employer';
export type Action =
  | 'record.read.own' | 'record.read.assigned' | 'record.read.tenant'
  | 'grade.write' | 'enrollment.decide' | 'admission.decide' | 'regrade.decide'
  | 'advising.note.write' | 'catalog.manage' | 'member.manage' | 'connector.manage'
  | 'share.issue' | 'mentoring.offer' | 'job.post' | 'audit.read'
  // Semester-internal workflow decisions (not writes to the institution's official system):
  | 'registration.request.decide' | 'registrar.read' | 'readiness.read' | 'approval.decide'
  | 'teaching.queue' | 'caseload.read' | 'security.manage' | 'devapps.manage' | 'accounts.read';
export type Classification = 'public' | 'directory' | 'education_record' | 'restricted';

/** Role templates → what each role can ever do. Anything not listed is denied. */
export const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  Student: ['record.read.own', 'share.issue'],
  Alumni: ['record.read.own', 'mentoring.offer'],
  Employer: ['job.post'],
  Tutor: ['record.read.assigned', 'teaching.queue'],
  Advisor: ['record.read.assigned', 'advising.note.write', 'approval.decide', 'caseload.read'],
  Faculty: ['record.read.assigned', 'grade.write', 'regrade.decide', 'teaching.queue'],
  Staff: ['record.read.tenant', 'enrollment.decide', 'admission.decide', 'registration.request.decide', 'registrar.read', 'readiness.read', 'approval.decide', 'caseload.read', 'accounts.read'],
  Administrator: ['record.read.tenant', 'catalog.manage', 'member.manage', 'connector.manage', 'audit.read', 'enrollment.decide', 'admission.decide',
    'registration.request.decide', 'registrar.read', 'readiness.read', 'approval.decide', 'caseload.read', 'security.manage', 'devapps.manage', 'accounts.read'],
};

/**
 * Fine role templates from the 79-role register (lib/roleTemplates.ts). All are PROPOSED: a template adds its permissions
 * only once its name is listed here after owner review and allow/deny tests. Empty = templates grant nothing today.
 * Persona overlays and access-mode variants never grant, even if listed.
 */
export const APPROVED_TEMPLATES = new Set<string>([
  // Approved by the founder 23 Oct 2026 (first batch): registrar, student support and teaching groups.
  'Registrar staff', 'Registration specialist', 'Academic-records specialist',
  'Academic advisor', 'Success coach', 'Student accounts staff',
  'Faculty/instructor', 'Teaching assistant', 'Tutor',
]);

/**
 * Workbook permissions → the actions endpoints actually check. A workbook permission with no entry here grants nothing
 * in the app (it is still listed, so the gap is visible). Mappings never reach catalog, member, connector, security or audit.
 */
export const TEMPLATE_ACTION_MAP: Record<string, Action[]> = {
  'registration.assigned.process': ['registrar.read', 'registration.request.decide'],
  'registration.assigned.review': ['registrar.read'],
  'registration.authorized.execute': ['registration.request.decide'],
  'record.assigned.review': ['registrar.read'],
  'account.assigned.read': ['accounts.read'],
  'hold.release.request': ['accounts.read'],
  'caseload.assigned.read': ['caseload.read', 'record.read.assigned'],
  'advising.note.scoped.write': ['advising.note.write'],
  'case.assigned.followup': ['caseload.read'],
  'course.assigned.manage': ['teaching.queue', 'record.read.assigned'],
  'assessment.assigned.review': ['teaching.queue'],
  'grade.assigned.draft': ['grade.write'],
  'section.assigned.read': ['teaching.queue', 'record.read.assigned'],
  'feedback.assigned.write': ['teaching.queue'],
  'session.assigned.manage': ['teaching.queue'],
};
const NON_GRANTING_MODELS = new Set(['Persona overlay', 'Access-mode variant', 'Lifecycle persona', 'Temporary-affiliation persona']);
export function templatePermissions(names: string[], approved: Set<string> = APPROVED_TEMPLATES): string[] {
  return ROLE_TEMPLATES.filter((t) => names.includes(t.name) && approved.has(t.name) && !NON_GRANTING_MODELS.has(t.model))
    .flatMap((t) => [...t.permissions, ...t.permissions.flatMap((p) => TEMPLATE_ACTION_MAP[p] ?? [])]);
}

/** Actions that change an official record: they need the institution to have handed Semester authority for that domain. */
const OFFICIAL: Action[] = ['grade.write', 'enrollment.decide', 'admission.decide'];

export type AuthzInput = {
  actorId: string;
  membership: { status: string; tenantId: string; roles: string[]; templates?: string[]; activeRole?: string } | null;
  approvedTemplates?: Set<string>; // test hook; defaults to APPROVED_TEMPLATES
  action: Action | string;
  resource: { tenantId: string; ownerId?: string; assignedIds?: string[]; classification: Classification };
  capabilityEnabled?: boolean; // capability switch for this tenant; undefined = on
  policyBlocks?: string[];     // active policy holds (e.g. "registration window closed")
  consent?: boolean;           // required when a non-owner reads a restricted record; undefined = not given
  authorityGranted?: boolean;  // institution has transferred authority for an official write
};
export type AuthzDecision = { allow: true } | { allow: false; failed: string; reason: string };

const deny = (failed: string, reason: string): AuthzDecision => ({ allow: false, failed, reason });

export function authorize(i: AuthzInput): AuthzDecision {
  const m = i.membership;
  if (!m || m.status !== 'Active') return deny('membership', 'No active membership.');
  if (m.tenantId !== i.resource.tenantId) return deny('tenant', 'This record belongs to another institution.');
  // Active role context (build pack: "do not merge all permissions of a multi-role user"). When set, only that role counts,
  // and it must be one the person actually holds. Templates still apply: they are assigned duties, not a second role.
  if (m.activeRole !== undefined && !m.roles.includes(m.activeRole)) return deny('context', 'You do not hold the role you are acting as.');
  const roles = m.activeRole !== undefined ? [m.activeRole] : m.roles;
  const allowed = new Set<string>([...roles.flatMap((r) => ROLE_PERMISSIONS[r as Role] ?? []), ...templatePermissions(m.templates ?? [], i.approvedTemplates)]);
  if (!allowed.has(i.action)) return deny('role', 'Your role does not allow this.');
  if (i.action === 'record.read.own' && i.resource.ownerId !== i.actorId) return deny('resource', 'You can only see your own records.');
  if (i.action === 'record.read.assigned' && i.resource.ownerId !== i.actorId && !(i.resource.assignedIds ?? []).includes(i.actorId))
    return deny('resource', 'You are not assigned to this person or section.');
  if (i.capabilityEnabled === false) return deny('capability', 'This capability is switched off for your institution.');
  if (i.policyBlocks?.length) return deny('policy', i.policyBlocks[0]);
  if (i.resource.classification === 'restricted' && i.resource.ownerId !== i.actorId && i.consent !== true)
    return deny('consent', 'Restricted record: the student’s consent is required.');
  if (OFFICIAL.includes(i.action as Action) && i.authorityGranted !== true)
    return deny('authority', 'The institution’s system is still authoritative. Send a request instead.');
  return { allow: true };
}
