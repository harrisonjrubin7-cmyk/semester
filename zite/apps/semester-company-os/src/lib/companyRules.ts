// Company OS record rules, kept pure so they are tested directly (tests/companyRules.test.ts).
// The endpoint (api/companyMutate.ts) loads the record and its history, then asks these functions.

export type HistoryEntry = { actor: string; action: string; detail: string };

/** Fields that define what was commercially approved. Changing any of them voids the approval. */
export const DEAL_COMMERCIAL_FIELDS = ['name', 'account', 'amountMinor', 'currency', 'closeDate', 'owner'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const touchesOwner = (h: HistoryEntry) => h.action === 'updated' && h.detail.split(', ').includes('owner');

/**
 * Separation of duties for commercial approval. The approver must not be the current owner,
 * the person who created the deal, or anyone who has ever set its owner. The last rule closes
 * "reassign to a colleague, approve, reassign back".
 */
export function approvalBlocker(owner: string | null, me: string, history: HistoryEntry[]): string | null {
  if (owner === me) return 'Separation of duties: the deal owner cannot approve their own deal.';
  const mine = history.filter((h) => h.actor === me);
  if (mine.some((h) => h.action === 'created')) return 'Separation of duties: you created this deal, so someone else must approve it.';
  if (mine.some(touchesOwner)) return 'Separation of duties: you changed this deal’s owner, so someone else must approve it.';
  return null;
}

/** Which commercial fields an update actually changes. */
export function commercialChanges(existing: Record<string, unknown>, values: Record<string, unknown>): string[] {
  return DEAL_COMMERCIAL_FIELDS.filter((k) => k in values && !same(existing[k], values[k]));
}

/** Records that carry evidence are kept. Close, cancel or mark them instead of deleting. */
export function deleteBlocker(table: string, rec: Record<string, unknown>, linked: number): string | null {
  const list = (v: unknown) => (Array.isArray(v) ? v.length : v ? 1 : 0);
  switch (table) {
    case 'deals':
      if (rec.approvedAt || rec.stage === 'Won') return 'Approved or won deals are kept as evidence. Mark the deal Lost instead.';
      return null;
    case 'contracts':
      if (rec.state && rec.state !== 'Draft') return 'Only draft contracts can be deleted. Change the state instead.';
      if (rec.signedDocumentLink) return 'A contract with a signed document is kept as evidence.';
      return null;
    case 'projects':
      if (rec.state && rec.state !== 'Kickoff') return 'Projects past kickoff are kept as evidence.';
      if (list(rec.gatesPassed) || rec.gateEvidence) return 'A project with gate evidence is kept.';
      return null;
    case 'tickets':
      return 'Support tickets are kept. Close the ticket instead.';
    case 'accounts':
      if (linked > 0) return 'This account has linked deals, contracts or projects, so it is kept.';
      return null;
    default:
      return 'Unknown record type.';
  }
}
