// Student account balances (pure). A charge adds to what is owed; payments, aid and credits reduce it.
export type LedgerEntry = { type: string; amount: number; term: string; dueDate: string };
export const signed = (type: string, amt: number) => (type === 'Charge' ? amt : -amt);
export type TermBalance = { term: string; balance: number; nextDue: string | null };

/** Per-term balance and the earliest due date of a charge in a term that still owes money. Rounded to cents. */
export function termBalances(entries: LedgerEntry[]): TermBalance[] {
  const terms = [...new Set(entries.map((e) => e.term))];
  return terms.map((term) => {
    const es = entries.filter((e) => e.term === term);
    const balance = Math.round(es.reduce((s, e) => s + signed(e.type, Number(e.amount) || 0), 0) * 100) / 100;
    const dues = es.filter((e) => e.type === 'Charge' && e.dueDate).map((e) => e.dueDate).sort();
    return { term, balance, nextDue: balance > 0 ? dues[0] ?? null : null };
  }).sort((a, b) => a.term.localeCompare(b.term));
}
