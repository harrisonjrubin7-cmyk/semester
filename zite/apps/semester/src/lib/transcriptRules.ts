// Transcript and GPA from official grade revisions only (spec §3.7). Never from the course gradebook or released course
// grades. The point scale and repeat treatment are institution policy: DEFAULT_SCALE is a common 4.0 scale used until the
// institution's approved policy is configured, and the transcript says so.
export const DEFAULT_SCALE: Record<string, number> = { A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0.0 };
const EARNS = (g: string) => g === 'P' || (g in DEFAULT_SCALE && g !== 'F');
export type Entry = { enrollmentId: string; revision: number; grade: string; authority: string; term: string; termOrder: number; course: string; title: string; credits: number };
export type Row = { course: string; title: string; credits: number; grade: string; earned: number; inGpa: boolean; points: number | null; revision: number; corrected: boolean };
export type Term = { term: string; rows: Row[]; attempted: number; earned: number; gpaCredits: number; qualityPoints: number; gpa: number | null };
export type Transcript = { terms: Term[]; attempted: number; earned: number; gpaCredits: number; qualityPoints: number; gpa: number | null; official: boolean; scale: 'default' | 'institution' };

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
/** Truncate (not round) GPA to two decimals, as most registrars report it. */
export const gpaOf = (qp: number, cr: number) => (cr > 0 ? Math.floor((qp / cr) * 100 + 1e-9) / 100 : null);

/** Uses the latest revision per enrollment. Official only when every row comes from pilot/authoritative records. */
export function buildTranscript(entries: Entry[], scale: Record<string, number> = DEFAULT_SCALE, scaleKind: 'default' | 'institution' = 'default'): Transcript {
  const latest = new Map<string, Entry>(); const maxRev = new Map<string, number>();
  for (const e of entries) { const cur = latest.get(e.enrollmentId); if (!cur || e.revision > cur.revision) latest.set(e.enrollmentId, e); maxRev.set(e.enrollmentId, Math.max(maxRev.get(e.enrollmentId) ?? 0, e.revision)); }
  const byTerm = new Map<string, { order: number; rows: Row[] }>();
  for (const e of latest.values()) {
    const inGpa = e.grade in scale;
    const row: Row = { course: e.course, title: e.title, credits: e.credits, grade: e.grade, earned: EARNS(e.grade) ? e.credits : 0, inGpa, points: inGpa ? round(scale[e.grade] * e.credits, 3) : null, revision: e.revision, corrected: (maxRev.get(e.enrollmentId) ?? 1) > 1 };
    const t = byTerm.get(e.term) ?? { order: e.termOrder, rows: [] }; t.rows.push(row); byTerm.set(e.term, t);
  }
  const terms: Term[] = [...byTerm.entries()].sort((a, b) => a[1].order - b[1].order).map(([term, t]) => {
    const rows = t.rows.sort((a, b) => a.course.localeCompare(b.course));
    const attempted = rows.filter((r) => r.grade !== 'W').reduce((n, r) => n + r.credits, 0);
    const gpaCredits = rows.filter((r) => r.inGpa).reduce((n, r) => n + r.credits, 0);
    const qualityPoints = round(rows.reduce((n, r) => n + (r.points ?? 0), 0), 3);
    return { term, rows, attempted, earned: rows.reduce((n, r) => n + r.earned, 0), gpaCredits, qualityPoints, gpa: gpaOf(qualityPoints, gpaCredits) };
  });
  const sum = (k: 'attempted' | 'earned' | 'gpaCredits' | 'qualityPoints') => round(terms.reduce((n, t) => n + t[k], 0), 3);
  const all = [...latest.values()];
  return { terms, attempted: sum('attempted'), earned: sum('earned'), gpaCredits: sum('gpaCredits'), qualityPoints: sum('qualityPoints'), gpa: gpaOf(sum('qualityPoints'), sum('gpaCredits')),
    official: all.length > 0 && all.every((e) => e.authority === 'pilot' || e.authority === 'authoritative'), scale: scaleKind };
}

/** Order terms like "Fall 2026", "Spring 2027": year, then Spring < Summer < Fall < Winter. Unknown → end. */
export function termOrder(term: string): number {
  const m = /(spring|summer|fall|autumn|winter)\s+(\d{4})/i.exec(term);
  if (!m) return 99999;
  return Number(m[2]) * 10 + ({ spring: 1, summer: 2, fall: 3, autumn: 3, winter: 4 } as Record<string, number>)[m[1].toLowerCase()];
}
