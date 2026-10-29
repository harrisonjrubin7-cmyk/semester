// Office service (osv-001) helpers shared by the screens and tests. Pure. The database (lib/osvMigration.ts) is the authority;
// these only decide which buttons to show, and must never offer a step the database would refuse for that viewer.
export type OsvState = 'sent' | 'claimed' | 'waiting_on_student' | 'resolved' | 'closed' | 'withdrawn';
export type OsvStep = 'claim' | 'assign' | 'ask' | 'reply' | 'note' | 'refer' | 'resolve' | 'confirm' | 'reopen' | 'withdraw';
export type OsvViewer = { me: string; staff: boolean; lead: boolean };
export type OsvReq = { state: OsvState; requesterId: string; assigneeId: string | null; reopenCount: number; resolvedAt: string | null };

export const OSV_OUTCOMES = [['answered', 'Answered'], ['done', 'Done'], ['referred_out', 'Sent elsewhere'], ['declined', 'Declined']] as const;
export const OSV_LABEL: Record<OsvState, string> = { sent: 'Waiting for the office', claimed: 'Being handled', waiting_on_student: 'Waiting for you', resolved: 'Resolved — please confirm', closed: 'Closed', withdrawn: 'Withdrawn' };
export const REOPEN_DAYS = 14;

export function osvSteps(r: OsvReq, v: OsvViewer, now = Date.now()): OsvStep[] {
  if (r.state === 'closed' || r.state === 'withdrawn') return [];
  const mine = r.requesterId === v.me, handling = r.assigneeId === v.me, open = r.state === 'sent' || r.state === 'claimed' || r.state === 'waiting_on_student';
  const out: OsvStep[] = [];
  if (mine) {
    if (r.state === 'resolved') {
      out.push('confirm');
      const fresh = !!r.resolvedAt && now - Date.parse(r.resolvedAt) <= REOPEN_DAYS * 86400000;
      if (r.reopenCount < 1 && fresh) out.push('reopen');
    } else { out.push('reply', 'withdraw'); }
    return out;
  }
  if (!v.staff) return [];
  if (r.state === 'sent') out.push('claim');
  if (v.lead && open) out.push('assign');
  if (handling && r.state === 'claimed') out.push('ask');
  if (handling && (r.state === 'claimed' || r.state === 'waiting_on_student')) out.push('resolve');
  if ((handling || v.lead) && open) out.push('refer');
  out.push('note');
  return out;
}

/** Simple article search: every word must appear in the title or body; title hits rank first. */
export function searchArticles<T extends { title: string; body: string }>(items: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return items;
  const hit = items.filter((a) => { const t = (a.title + ' ' + a.body).toLowerCase(); return words.every((w) => t.includes(w)); });
  const score = (a: T) => words.filter((w) => a.title.toLowerCase().includes(w)).length;
  return hit.sort((a, b) => score(b) - score(a));
}
