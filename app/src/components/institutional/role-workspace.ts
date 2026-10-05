import type { FlightRole } from '../../lib/flight-plan';
import { resolveWorkspaceAccess, type VerifiedGrant } from '../../lib/institutional-access';

export interface RoleFunction {
  capability: string;
  label: string;
}

export const ROLE_WORKSPACE_TITLES: Record<FlightRole, string> = {
  student: 'Student workspace',
  faculty: 'Faculty workspace',
  teaching_assistant: 'Teaching-assistant workspace',
  advisor: 'Advisor workspace',
  campus_staff: 'Student-success workspace',
  university_admin: 'Administrator workspace',
  moderator: 'Community moderation workspace',
  employer: 'Employer workspace',
  applicant: 'Applicant workspace',
  authorized_payer: 'Authorized payer workspace',
  authorized_family: 'Authorized-family workspace',
  alumni: 'Alumni workspace',
};

export const ROLE_WORKSPACE_FUNCTIONS: Record<FlightRole, readonly RoleFunction[]> = {
  student: [
    { capability: 'work:manage', label: 'Plan my work' },
    { capability: 'course:read', label: 'Learn and practice' },
    { capability: 'profile:self', label: 'Review my evidence' },
  ],
  faculty: [
    { capability: 'course:manage', label: 'Prepare course materials' },
    { capability: 'course:manage', label: 'Prepare assignment drafts' },
    { capability: 'message:course', label: 'Prepare feedback drafts' },
  ],
  teaching_assistant: [
    { capability: 'learning-activity:prepare', label: 'Prepare learning activities' },
    { capability: 'office-hours:prepare', label: 'Prepare office-hours support' },
    { capability: 'course:assist', label: 'Review assigned course context' },
  ],
  advisor: [
    { capability: 'student-plan:read', label: 'Review consented plans' },
    { capability: 'appointment:manage', label: 'Prepare advising follow-up' },
    { capability: 'student-plan:read', label: 'Explain support signals' },
  ],
  campus_staff: [
    { capability: 'service-case:manage', label: 'Review consented service cases' },
    { capability: 'service-case:manage', label: 'Prepare student support' },
    { capability: 'student-directory:read', label: 'Use the scoped directory' },
  ],
  university_admin: [
    { capability: 'institution:report', label: 'Inspect identity and integrations' },
    { capability: 'catalog:manage', label: 'Prepare policy review' },
    { capability: 'institution:report', label: 'Review audit readiness' },
  ],
  moderator: [
    { capability: 'community:moderate', label: 'Review community reports' },
    { capability: 'report:resolve', label: 'Prepare moderation notes' },
    { capability: 'report:resolve', label: 'Escalate a sample case' },
  ],
  employer: [
    { capability: 'career-post:manage', label: 'Prepare opportunity drafts' },
    { capability: 'candidate-consent:read', label: 'Review consented career profiles' },
    { capability: 'career-post:manage', label: 'Plan recruiting follow-up' },
  ],
  applicant: [
    { capability: 'application:self-manage', label: 'Track my application preparation' },
    { capability: 'visit:self-manage', label: 'Prepare visit questions' },
    { capability: 'profile:self', label: 'Review my deadlines' },
  ],
  authorized_payer: [
    { capability: 'bill:shared-read', label: 'Review shared billing summaries' },
    { capability: 'payment:submit', label: 'Prepare a payment handoff' },
    { capability: 'bill:shared-read', label: 'Review authorization scope' },
  ],
  authorized_family: [
    { capability: 'student-shared:read', label: 'Review explicitly shared updates' },
    { capability: 'family-preference:self', label: 'Prepare student-approved questions' },
    { capability: 'student-shared:read', label: 'Review authorization scope' },
  ],
  alumni: [
    { capability: 'alumni-profile:self', label: 'Prepare a mentorship profile' },
    { capability: 'event:discover', label: 'Discover alumni events' },
    { capability: 'mentorship:participate', label: 'Review career-network preferences' },
  ],
};

export interface RoleDraftAction {
  capability: string;
  label: string;
  subject: string;
}

export const ROLE_DRAFT_ACTIONS: Partial<Record<FlightRole, RoleDraftAction>> = {
  faculty: { capability: 'course:manage', label: 'Prepare assignment draft', subject: 'Sample assignment draft' },
  teaching_assistant: { capability: 'office-hours:prepare', label: 'Prepare office-hours support', subject: 'Sample office-hours support draft' },
  advisor: { capability: 'appointment:manage', label: 'Prepare advising follow-up', subject: 'Sample advising follow-up' },
  campus_staff: { capability: 'service-case:manage', label: 'Prepare student support', subject: 'Sample student-support follow-up' },
  university_admin: { capability: 'catalog:manage', label: 'Prepare policy review', subject: 'Sample policy review' },
  moderator: { capability: 'report:resolve', label: 'Prepare moderation notes', subject: 'Sample moderation notes' },
  employer: { capability: 'career-post:manage', label: 'Prepare opportunity draft', subject: 'Sample opportunity draft' },
  applicant: { capability: 'visit:self-manage', label: 'Prepare visit questions', subject: 'Sample campus-visit questions' },
  authorized_payer: { capability: 'payment:submit', label: 'Prepare payment handoff', subject: 'Sample payment handoff' },
  authorized_family: { capability: 'family-preference:self', label: 'Prepare student-approved questions', subject: 'Sample family questions' },
  alumni: { capability: 'alumni-profile:self', label: 'Prepare mentorship profile', subject: 'Sample mentorship profile' },
};

/**
 * Presentation follows the selected role, but availability follows only live
 * grants for that exact role and synthetic institution. Capabilities from a
 * second role or tenant never bleed into this workspace, and this remains
 * only a client presentation gate: the server must authorize every
 * consequential read and write again.
 */
export function availableRoleFunctions(
  tenantId: string,
  role: FlightRole,
  grants: VerifiedGrant[],
  now?: string,
): RoleFunction[] {
  const tenantScopePrefix = `${tenantId}-`;
  const matching = grants.filter((grant) => (
    grant.role === role
    && (grant.scopeId === tenantId || grant.scopeId.startsWith(tenantScopePrefix))
  ));
  const access = resolveWorkspaceAccess({ selectedRole: role, grants: matching, now });
  const capabilities = new Set(access.authorizedCapabilities);
  return ROLE_WORKSPACE_FUNCTIONS[role].filter((item) => capabilities.has(item.capability));
}
