// Pure publishing rules: draft → review by a non-author → approval → publish by a non-author. No sending.
export type PubAction = 'save' | 'submit' | 'approve' | 'requestChanges' | 'publish' | 'withdraw';
export type PubState = { status: string; authorId: string; body: string; claimTypes: string[]; claimSources: string; slug: string };
export type Decision = { ok: true; next: string } | { ok: false; reason: string };

const EDITABLE = ['Draft', 'Changes requested'];
const no = (reason: string): Decision => ({ ok: false, reason });

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function decide(action: PubAction, p: PubState, actorId: string, opts: { note?: string; slugTakenByOther?: boolean } = {}): Decision {
  const note = (opts.note ?? '').trim();
  switch (action) {
    case 'save':
      return EDITABLE.includes(p.status) ? { ok: true, next: p.status } : no('Only drafts can be edited. Withdraw or request changes first.');
    case 'submit':
      if (!EDITABLE.includes(p.status)) return no('Only drafts can be submitted.');
      if (p.body.trim().length < 20) return no('Write the body before submitting.');
      if (p.claimTypes.length && p.claimSources.trim().length < 10) return no('This post makes a price, customer, outcome, certification or compliance claim. Cite the approved source first.');
      return { ok: true, next: 'In review' };
    case 'approve':
    case 'requestChanges':
      if (p.status !== 'In review') return no('Only posts in review can be decided.');
      if (p.authorId === actorId) return no('You wrote this post, so someone else has to review it.');
      if (action === 'requestChanges' && note.length < 5) return no('Say what needs to change.');
      return { ok: true, next: action === 'approve' ? 'Approved' : 'Changes requested' };
    case 'publish':
      if (p.status !== 'Approved') return no('Only approved posts can be published.');
      if (p.authorId === actorId) return no('The author cannot publish their own post.');
      if (opts.slugTakenByOther) return no('Another published post already uses this web address.');
      return { ok: true, next: 'Published' };
    case 'withdraw':
      return p.status === 'Published' || p.status === 'Approved' ? { ok: true, next: 'Withdrawn' } : no('Only approved or published posts can be withdrawn.');
  }
}
