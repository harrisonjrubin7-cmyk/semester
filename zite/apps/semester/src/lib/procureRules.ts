// Procurement (S-76 E08). Pure rules mirrored by lib/prcMigration.ts (the database is the authority).
export const supplierKey = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Requests by the same person to the same supplier inside the window that together reach the approval threshold. */
export function looksSplit(p: { amount: number; threshold: number; recent: number[] }): boolean {
  const small = p.recent.filter((a) => a < p.threshold);
  return p.amount < p.threshold && small.length > 0 && small.reduce((s, a) => s + a, 0) + p.amount >= p.threshold;
}

export const approvalsNeeded = (p: { amount: number; threshold: number; split: boolean }) => (p.amount >= p.threshold || p.split ? 2 : 1);

/** Three-way match within tolerance: the invoiced total may not exceed the order or what was received. */
export function matchInvoice(p: { ordered: number; received: number; invoicedBefore: number; amount: number; tolerancePct: number }): string | null {
  const total = p.invoicedBefore + p.amount;
  const lim = (x: number) => Math.floor((x * (100 + p.tolerancePct)) / 100);
  if (total > lim(p.ordered)) return 'Invoiced total exceeds the order beyond tolerance';
  if (total > lim(p.received)) return 'Invoiced total exceeds what was received beyond tolerance';
  return null;
}

export const payable = (state: string) => state === 'matched' || state === 'accepted';
export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
