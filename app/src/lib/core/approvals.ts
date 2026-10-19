export type St = 'requested' | 'approved-1' | 'approved' | 'rejected' | 'expired' | 'executed';
export interface Approval { id: string; requester: string; approvers: string[]; state: St; expiresAt: number; mfaAt: Record<string, number> }
export type Ev = { type: 'approve' | 'reject' | 'execute'; by: string; at: number };
const MFA_MS = 15 * 60e3;
/** Two-person duty: two distinct approvers, neither the requester, each with MFA in the last 15 min; execute only by the requester after full approval. */
export function step(a: Approval, e: Ev): Approval | { error: string } {
  if (e.at > a.expiresAt && a.state !== 'executed') return { ...a, state: 'expired' };
  if (e.type === 'execute') return a.state === 'approved' && e.by === a.requester ? { ...a, state: 'executed' } : { error: 'Needs two approvals; only the requester runs it.' };
  if (e.by === a.requester) return { error: 'You can’t approve your own request.' };
  if (a.approvers.includes(e.by)) return { error: 'You already decided this one.' };
  if (!a.mfaAt[e.by] || e.at - a.mfaAt[e.by] > MFA_MS) return { error: 'Verify a second factor first (within 15 minutes).' };
  if (!['requested', 'approved-1'].includes(a.state)) return { error: 'This request is ' + a.state + '.' };
  if (e.type === 'reject') return { ...a, state: 'rejected', approvers: [...a.approvers, e.by] };
  const approvers = [...a.approvers, e.by];
  return { ...a, approvers, state: approvers.length >= 2 ? 'approved' : 'approved-1' };
}
