// Partner Administration (S-76 E30). Pure; mirrors lib/ptaMigration.ts and is unit-tested in tests/partner.test.ts.
// Rules: an outside organization registers once (name unique) and its first admin is whoever registered it; org admins add
// and remove their own organization's members only, cannot change their own role, and cannot remove the last admin. Each
// institution decides separately: a partner manager (granted by an administrator, never self, and never a member of the
// partner organization) verifies it, a different manager proposes the agreement with an end date and the exact scopes, and
// an org admin accepts that exact text (hash-pinned). Scopes are only ever granted by the institution; changing them or the
// terms needs acceptance again. Access is live only while active and before the end date; suspension and offboarding stop
// it, and offboarding keeps every record.
export const SCOPES = ['publish_listings', 'view_orders', 'propose_articulation', 'manage_course_mappings', 'submit_research_requests', 'post_opportunities'] as const;
export type Scope = (typeof SCOPES)[number];
export type RelState = 'applied' | 'verified' | 'agreement_pending' | 'active' | 'suspended' | 'offboarded' | 'rejected';

export const normOrgName = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();

/** Scopes outside the published list are never accepted. */
export const scopesOk = (s: string[]) => s.length > 0 && s.every((x) => (SCOPES as readonly string[]).includes(x)) && new Set(s).size === s.length;

/** Is this relationship granting access right now? */
export function accessLive(state: RelState, validTo: Date | null, now: Date): boolean {
  return state === 'active' && !!validTo && validTo.getTime() >= now.getTime();
}

/** Plain status shown to both sides. */
export function relStatus(state: RelState, validTo: Date | null, now: Date): string {
  if (state === 'active' && validTo && validTo.getTime() < now.getTime()) return 'Agreement expired — no access until renewed';
  return ({ applied: 'Waiting for verification', verified: 'Verified — terms being prepared', agreement_pending: 'Terms ready — waiting for the partner to accept',
    active: 'Active', suspended: 'Suspended — no access', offboarded: 'Offboarded — records kept', rejected: 'Not approved' } as Record<RelState, string>)[state];
}

/** Org-admin member changes. */
export function memberChangeBlocker(o: { actorIsAdmin: boolean; targetIsSelf: boolean; removingAdmin: boolean; admins: number }): string | null {
  if (!o.actorIsAdmin) return 'Only an administrator of this organization manages its members.';
  if (o.targetIsSelf) return 'Another administrator of your organization changes your own role.';
  if (o.removingAdmin && o.admins <= 1) return 'An organization keeps at least one administrator.';
  return null;
}
