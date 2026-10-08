export type Role = 'student' | 'applicant' | 'guardian' | 'alumni' | 'faculty' | 'ta' | 'advisor' | 'registrar' | 'finance' | 'affairs' | 'security' | 'support' | 'employer' | 'partner';
export type Level = 'full' | 'scoped' | 'shared' | 'read' | 'audited' | 'none';
export interface Share { grantee: string; screen: string; expiresAt: number; revoked?: boolean }
export interface Grant { kind: 'section' | 'ticket' | 'listing' | 'breakglass'; id: string; expiresAt: number; approvedBy?: string[] }
export interface Ctx { role: Role; userId: string; ownerId?: string; shares?: Share[]; grants?: Grant[]; now: number }
/** Default matrix; anything missing is none. Students own their own rows. */
export const MATRIX: Partial<Record<Role, Record<string, Level>>> = {
  guardian: { family: 'shared', billing: 'shared', grades: 'shared', calendar: 'shared' },
  advisor: { degree: 'shared', advising: 'shared', registration: 'read' },
  faculty: { course: 'scoped', grades: 'scoped', announce: 'scoped' },
  ta: { course: 'scoped', grades: 'scoped' },
  registrar: { registration: 'full', degree: 'full', grades: 'audited' },
  finance: { billing: 'full', costs: 'full' },
  affairs: { support: 'shared', housing: 'scoped', meals: 'scoped' },
  security: { privacy: 'audited', account: 'audited', connect: 'audited' },
  support: { support: 'scoped', connect: 'scoped' },
  employer: { opportunities: 'scoped', career: 'shared' },
  partner: { opportunities: 'scoped' },
};
export function level(role: Role, screen: string): Level {
  if (role === 'student') return 'full';
  return MATRIX[role]?.[screen] ?? 'none';
}
/** The runtime decision: the matrix says what kind of access, the context proves it right now. Mirrors the RLS policy. */
export function canRead(screen: string, c: Ctx): { ok: boolean; reason: string } {
  const l = level(c.role, screen);
  if (c.role === 'student') return c.ownerId == null || c.ownerId === c.userId ? { ok: true, reason: 'owner' } : { ok: false, reason: 'not the owner' };
  if (l === 'none') return { ok: false, reason: 'role has no access' };
  if (l === 'shared') { const s = (c.shares ?? []).find((x) => x.grantee === c.userId && x.screen === screen && !x.revoked && x.expiresAt > c.now); return s ? { ok: true, reason: 'active share' } : { ok: false, reason: 'no active share from the student' }; }
  if (l === 'scoped') { const g = (c.grants ?? []).find((x) => x.kind !== 'breakglass' && x.expiresAt > c.now); return g ? { ok: true, reason: g.kind + ' membership' } : { ok: false, reason: 'not a member of this scope' }; }
  if (l === 'audited') { const g = (c.grants ?? []).find((x) => x.kind === 'breakglass' && x.expiresAt > c.now && new Set(x.approvedBy).size >= 2 && !x.approvedBy!.includes(c.userId)); return g ? { ok: true, reason: 'break-glass, 2 approvers, logged' } : { ok: false, reason: 'needs break-glass with two other approvers' }; }
  return { ok: true, reason: l };
}
export const canWrite = (screen: string, c: Ctx) => { const l = level(c.role, screen); return (c.role === 'student' && canRead(screen, c).ok) || ((l === 'full' || l === 'scoped') && canRead(screen, c).ok); };
