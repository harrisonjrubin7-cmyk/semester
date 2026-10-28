// Transcript and GPA from official grade revisions only (spec §3.7). Never from the course gradebook or released course
// grades. The point scale and repeat treatment are institution policy. DEFAULT_POLICY (decided 28 Oct, D-2026-10-28-grading)
// is the sample policy every tenant uses until its own approved policy is configured, and the transcript says which applies.
export type RepeatRule = 'latest' | 'highest' | 'all';
export type GradingPolicy = {
  label: string; source: 'sample' | 'institution';
  scale: Record<string, number>;   // letter -> grade points; these grades count in GPA
  passing: string[];               // credit earned, outside GPA (P, S, CR)
  noCredit: string[];              // attempted, no credit, outside GPA (NP, U, NC)
  notAttempted: string[];          // neither attempted nor earned (W, AU)
  incomplete: string[];            // attempted, no credit yet, never replaces an earlier grade (I, IP)
  repeat: RepeatRule;              // how a course taken more than once counts
};
export const DEFAULT_POLICY: GradingPolicy = {
  label: 'Sample policy: 4.0 scale with plus/minus, latest attempt counts', source: 'sample',
  scale: { 'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0.0 },
  passing: ['P', 'S', 'CR'], noCredit: ['NP', 'U', 'NC'], notAttempted: ['W', 'AU'], incomplete: ['I', 'IP'], repeat: 'latest',
};
export const DEFAULT_SCALE = DEFAULT_POLICY.scale;
/** A grade that finishes an attempt (so it can replace an earlier one under a repeat rule). */
const completes = (g: string, p: GradingPolicy) => g in p.scale || p.passing.includes(g) || p.noCredit.includes(g);
const earns = (g: string, p: GradingPolicy) => p.passing.includes(g) || (g in p.scale && p.scale[g] > 0);
/** Problems with a policy that would make a GPA wrong; an institution policy is refused until this is empty. */
export function policyProblems(p: GradingPolicy): string[] {
  const out: string[] = []; const lists = [Object.keys(p.scale), p.passing, p.noCredit, p.notAttempted, p.incomplete];
  const seen = new Map<string, number>(); lists.forEach((l, i) => l.forEach((g) => { if (seen.has(g) && seen.get(g) !== i) out.push(`${g} is listed twice.`); seen.set(g, i); }));
  for (const [g, v] of Object.entries(p.scale)) if (!(v >= 0 && v <= 5)) out.push(`${g} must be worth 0 to 5 points.`);
  if (!Object.values(p.scale).some((v) => v === 0)) out.push('The scale needs a failing grade worth 0.');
  if (!['latest', 'highest', 'all'].includes(p.repeat)) out.push('Unknown repeat rule.');
  return out;
}

export type Entry = { enrollmentId: string; revision: number; grade: string; authority: string; term: string; termOrder: number; course: string; title: string; credits: number };
export type Row = { course: string; title: string; credits: number; grade: string; earned: number; inGpa: boolean; points: number | null; revision: number; corrected: boolean; repeat: 'counted' | 'excluded' | null };
export type Term = { term: string; rows: Row[]; attempted: number; earned: number; gpaCredits: number; qualityPoints: number; gpa: number | null };
export type Transcript = { terms: Term[]; attempted: number; earned: number; gpaCredits: number; qualityPoints: number; gpa: number | null; official: boolean; scale: 'default' | 'institution'; policy: { label: string; repeat: RepeatRule } };

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
/** Truncate (not round) GPA to two decimals, as most registrars report it. */
export const gpaOf = (qp: number, cr: number) => (cr > 0 ? Math.floor((qp / cr) * 100 + 1e-9) / 100 : null);

/** Uses the latest revision per enrollment, then applies the policy's repeat rule per course code.
 *  Official only when every row comes from pilot/authoritative records. */
export function buildTranscript(entries: Entry[], policy: GradingPolicy = DEFAULT_POLICY): Transcript {
  const latest = new Map<string, Entry>(); const maxRev = new Map<string, number>();
  for (const e of entries) { const cur = latest.get(e.enrollmentId); if (!cur || e.revision > cur.revision) latest.set(e.enrollmentId, e); maxRev.set(e.enrollmentId, Math.max(maxRev.get(e.enrollmentId) ?? 0, e.revision)); }
  // Repeats: among completed attempts of the same course, one counts (latest or highest); 'all' keeps every attempt.
  const excluded = new Set<string>(); const repeated = new Set<string>();
  if (policy.repeat !== 'all') {
    const byCourse = new Map<string, Entry[]>();
    for (const e of latest.values()) if (completes(e.grade, policy)) { const k = e.course.trim().toUpperCase(); byCourse.set(k, [...(byCourse.get(k) ?? []), e]); }
    for (const list of byCourse.values()) {
      if (list.length < 2) continue;
      const pts = (e: Entry) => (e.grade in policy.scale ? policy.scale[e.grade] : policy.passing.includes(e.grade) ? -1 : -2);
      const later = (a: Entry, b: Entry) => a.termOrder - b.termOrder || a.enrollmentId.localeCompare(b.enrollmentId);
      const keep = list.reduce((best, e) => (policy.repeat === 'highest' ? (pts(e) > pts(best) || (pts(e) === pts(best) && later(e, best) > 0) ? e : best) : (later(e, best) > 0 ? e : best)));
      for (const e of list) { repeated.add(e.enrollmentId); if (e !== keep) excluded.add(e.enrollmentId); }
    }
  }
  const byTerm = new Map<string, { order: number; rows: Row[] }>();
  for (const e of latest.values()) {
    const out = excluded.has(e.enrollmentId);
    const inGpa = !out && e.grade in policy.scale;
    const row: Row = { course: e.course, title: e.title, credits: e.credits, grade: e.grade, earned: !out && earns(e.grade, policy) ? e.credits : 0, inGpa,
      points: inGpa ? round(policy.scale[e.grade] * e.credits, 3) : null, revision: e.revision, corrected: (maxRev.get(e.enrollmentId) ?? 1) > 1,
      repeat: out ? 'excluded' : repeated.has(e.enrollmentId) ? 'counted' : null };
    const t = byTerm.get(e.term) ?? { order: e.termOrder, rows: [] }; t.rows.push(row); byTerm.set(e.term, t);
  }
  const terms: Term[] = [...byTerm.entries()].sort((a, b) => a[1].order - b[1].order).map(([term, t]) => {
    const rows = t.rows.sort((a, b) => a.course.localeCompare(b.course));
    const attempted = rows.filter((r) => !policy.notAttempted.includes(r.grade)).reduce((n, r) => n + r.credits, 0);
    const gpaCredits = rows.filter((r) => r.inGpa).reduce((n, r) => n + r.credits, 0);
    const qualityPoints = round(rows.reduce((n, r) => n + (r.points ?? 0), 0), 3);
    return { term, rows, attempted, earned: rows.reduce((n, r) => n + r.earned, 0), gpaCredits, qualityPoints, gpa: gpaOf(qualityPoints, gpaCredits) };
  });
  const sum = (k: 'attempted' | 'earned' | 'gpaCredits' | 'qualityPoints') => round(terms.reduce((n, t) => n + t[k], 0), 3);
  const all = [...latest.values()];
  return { terms, attempted: sum('attempted'), earned: sum('earned'), gpaCredits: sum('gpaCredits'), qualityPoints: sum('qualityPoints'), gpa: gpaOf(sum('qualityPoints'), sum('gpaCredits')),
    official: all.length > 0 && all.every((e) => e.authority === 'pilot' || e.authority === 'authoritative'),
    scale: policy.source === 'institution' ? 'institution' : 'default', policy: { label: policy.label, repeat: policy.repeat } };
}

/** Order terms like "Fall 2026", "Spring 2027": year, then Spring < Summer < Fall < Winter. Unknown → end. */
export function termOrder(term: string): number {
  const m = /(spring|summer|fall|autumn|winter)\s+(\d{4})/i.exec(term);
  if (!m) return 99999;
  return Number(m[2]) * 10 + ({ spring: 1, summer: 2, fall: 3, autumn: 3, winter: 4 } as Record<string, number>)[m[1].toLowerCase()];
}
