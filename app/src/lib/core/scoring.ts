export type Crit = 'correctness' | 'codeQuality' | 'rendering' | 'state' | 'maintainability' | 'handoff' | 'sandboxFit' | 'persistence';
export const DEFAULT_W: Partial<Record<Crit, number>> = { correctness: .25, codeQuality: .2, rendering: .15, state: .15, maintainability: .1, handoff: .1, sandboxFit: .05 };
/** Weighted 0–5; weights renormalised over the criteria actually graded so a missing score never counts as zero. */
export function weighted(g: Partial<Record<Crit, number>>, w = DEFAULT_W): { of5: number | null; of100: number | null; missing: Crit[] } {
  const keys = Object.keys(w) as Crit[]; const missing = keys.filter((k) => g[k] == null);
  const have = keys.filter((k) => g[k] != null); const tw = have.reduce((s, k) => s + (w[k] ?? 0), 0);
  if (!tw) return { of5: null, of100: null, missing };
  const v = have.reduce((s, k) => s + (g[k]! * (w[k] ?? 0)), 0) / tw;
  return { of5: +v.toFixed(2), of100: Math.round(v * 20), missing };
}
