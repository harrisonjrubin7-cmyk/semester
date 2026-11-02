// Consent-based sharing (pilot workflows "Share with advisor", "Review consented share"). Pure; tested in tests/shares.test.ts.
// A share is a Consents row: consentType 'Data Sharing', member = student, recipient = person, label "<Prefix>: cat, cat".
export const ADVISOR_CATEGORIES = ['Degree progress', 'Registration plan', 'Holds', 'Advising agenda'] as const;
export type AdvisorCategory = (typeof ADVISOR_CATEGORIES)[number];

export type ConsentRow = { id: string; member: string[]; recipient: string[]; label: string; consentType: string; granted: boolean; revoked: boolean; expiresOn: string | null };
export type LiveShare = { studentId: string; categories: string[]; expiresOn: string | null; consentIds: string[] };

export const shareLabel = (prefix: string, cats: readonly string[]) => `${prefix}: ${[...new Set(cats)].join(', ')}`;

export function categoriesOf(label: string, prefix: string): string[] {
  if (!label.startsWith(`${prefix}:`)) return [];
  return label.slice(prefix.length + 1).split(',').map((x) => x.trim()).filter(Boolean);
}

/** A share counts only while it is granted, not revoked, not past its expiry date, and addressed to this recipient. */
export function isLive(c: ConsentRow, recipient: string, prefix: string, today: string): boolean {
  return c.consentType === 'Data Sharing' && c.granted && !c.revoked && (!c.expiresOn || c.expiresOn >= today)
    && c.recipient.includes(recipient) && c.label.startsWith(`${prefix}:`);
}

/** Students who currently share something with `recipient`, with the union of live categories per student. */
export function liveShares(rows: ConsentRow[], recipient: string, prefix: string, today: string): LiveShare[] {
  const by = new Map<string, LiveShare>();
  for (const c of rows) {
    if (!isLive(c, recipient, prefix, today)) continue;
    for (const s of c.member) {
      const cur = by.get(s) ?? { studentId: s, categories: [], expiresOn: null, consentIds: [] };
      cur.categories = [...new Set([...cur.categories, ...categoriesOf(c.label, prefix)])];
      cur.expiresOn = [cur.expiresOn, c.expiresOn].filter(Boolean).sort().reverse()[0] ?? null;
      cur.consentIds.push(c.id);
      by.set(s, cur);
    }
  }
  return [...by.values()];
}

/** Validates a new advisor share request. */
export function shareBlocker(p: { studentId: string; advisorId: string; advisorIsActiveAdvisorHere: boolean; categories: string[]; expiresOn: string; today: string }): string | null {
  if (p.advisorId === p.studentId) return 'You can’t share with yourself.';
  if (!p.advisorIsActiveAdvisorHere) return 'Pick an active advisor at your institution.';
  if (!p.categories.length) return 'Choose at least one thing to share.';
  if (p.categories.some((c) => !(ADVISOR_CATEGORIES as readonly string[]).includes(c))) return 'That category can’t be shared with an advisor.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.expiresOn) || p.expiresOn < p.today) return 'Pick an end date in the future.';
  return null;
}
