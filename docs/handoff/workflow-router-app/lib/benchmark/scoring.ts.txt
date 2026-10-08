import { CRITERIA, DEFAULT_WEIGHTS, type Criterion, type Weights } from './benchmark.config';

export type Grades = Partial<Record<Criterion, number | null>>;
export interface WeightedScore { outOf5: number | null; outOf100: number | null; missing: Criterion[]; weightUsed: number }

export function resolveWeights(override?: Weights): Record<Criterion, number> {
  const w = { ...DEFAULT_WEIGHTS, ...(override ?? {}) } as Record<Criterion, number>;
  for (const c of CRITERIA) w[c] = Math.max(0, w[c] ?? 0);
  return w;
}

/** Weighted 0–5 score. Missing grades are excluded and the remaining weights are renormalised; all-missing → null. */
export function weightedScore(grades: Grades, override?: Weights): WeightedScore {
  const w = resolveWeights(override);
  let sum = 0, used = 0; const missing: Criterion[] = [];
  for (const c of CRITERIA) {
    if (w[c] === 0) continue;
    const g = grades[c];
    if (g === null || g === undefined || Number.isNaN(g)) { missing.push(c); continue; }
    if (g < 0 || g > 5) throw new RangeError(c + ' must be 0–5');
    sum += g * w[c]; used += w[c];
  }
  if (used === 0) return { outOf5: null, outOf100: null, missing, weightUsed: 0 };
  const s = sum / used;
  return { outOf5: round(s, 2), outOf100: round((s / 5) * 100, 1), missing, weightUsed: round(used, 3) };
}

/** Average several graders' sheets criterion by criterion, then weight. */
export function aggregateGrades(sheets: Grades[], override?: Weights): WeightedScore & { graders: number } {
  const merged: Grades = {};
  for (const c of CRITERIA) {
    const vals = sheets.map((s) => s[c]).filter((v): v is number => typeof v === 'number');
    merged[c] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return { ...weightedScore(merged, override), graders: sheets.length };
}

export interface LeaderRow { key: string; score: number | null; tasks: number; graded: number }
export function leaderboard(entries: { key: string; score: number | null }[]): LeaderRow[] {
  const by = new Map<string, LeaderRow & { total: number }>();
  for (const e of entries) {
    const r = by.get(e.key) ?? { key: e.key, score: null, tasks: 0, graded: 0, total: 0 };
    r.tasks += 1; if (e.score !== null) { r.graded += 1; r.total += e.score; }
    by.set(e.key, r);
  }
  return [...by.values()].map(({ total, ...r }) => ({ ...r, score: r.graded ? round(total / r.graded, 2) : null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.key.localeCompare(b.key));
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
