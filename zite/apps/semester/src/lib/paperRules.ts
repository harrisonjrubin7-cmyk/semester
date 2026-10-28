// Practice paper: a timed paper built from a study guide. Section A is marked against the key automatically;
// Section B is written and self-marked against the model answer. A practice record, never a grade.
import { buildQuiz, mark, type Guide, type Question, type Card } from './guideRules';

export type Written = { prompt: string; key: string; unit: string };
export type Paper = { seed: number; minutes: number; objective: Question[]; written: Written[] };
export type Responses = { objective: (number | boolean | number[] | null)[]; written: string[] };
export type SelfMark = 0 | 1 | 2 | null; // none, partly, fully
export const WRITTEN_MARKS = 2;

function rng(seed: number) { let s = (seed ^ 0x9e3779b9) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffle<T>(xs: T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Same seed, same paper. Written questions use cards that Section A did not. */
export function buildPaper(g: Guide, seed: number, opts: { objective?: number; written?: number; minutes?: number } = {}): Paper {
  const objective = buildQuiz(g, seed, opts.objective ?? 10);
  const usedQ = new Set(objective.flatMap((q) => (q.kind === 'match' ? q.pairs.map((p) => p.q) : [q.prompt])));
  const pool: (Card & { unit: string })[] = g.units.flatMap((u) => u.cards.map((c) => ({ ...c, unit: u.name })));
  const r = rng(seed); const fresh = pool.filter((c) => !usedQ.has(c.q)); const rest = pool.filter((c) => usedQ.has(c.q));
  const order = [...shuffle(fresh, r), ...shuffle(rest, r)];
  const written = order.slice(0, opts.written ?? 3).map((c) => ({ prompt: c.q, key: c.a, unit: c.unit }));
  const minutes = opts.minutes ?? Math.max(5, Math.ceil(objective.length * 1.5 + written.length * 5));
  return { seed, minutes, objective, written };
}
export const objectiveMax = (p: Paper) => p.objective.length;
export const maxMarks = (p: Paper) => objectiveMax(p) + p.written.length * WRITTEN_MARKS;

const STOP = new Set('a an the of to in on for and or but is are was were be by with as at from that this it its their they which who what when how why'.split(' '));
const content = (s: string) => [...new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)))];
/** A hint for self-marking only: which content words of the model answer appear in the student's answer. */
export function keywordHint(answer: string, key: string): { used: string[]; missing: string[] } {
  const a = new Set(content(answer)); const k = content(key);
  return { used: k.filter((w) => a.has(w) || [...a].some((x) => x.startsWith(w.slice(0, 5)) && w.length > 5)), missing: k.filter((w) => !(a.has(w) || [...a].some((x) => x.startsWith(w.slice(0, 5)) && w.length > 5))) };
}

export function score(p: Paper, res: Responses, self: SelfMark[]): { objective: number; written: number | null; total: number | null; max: number; unmarked: number; wrong: number[] } {
  const wrong: number[] = []; let objective = 0;
  p.objective.forEach((q, i) => { const r = res.objective[i]; if (r !== null && r !== undefined && mark(q, r)) objective++; else wrong.push(i); });
  const unmarked = p.written.filter((_, i) => self[i] === null || self[i] === undefined).length;
  const written = unmarked ? null : p.written.reduce((s, _, i) => s + (self[i] ?? 0), 0);
  return { objective, written, total: written === null ? null : objective + written, max: maxMarks(p), unmarked, wrong };
}

export function remaining(startedAt: number, minutes: number, now: number): number { return Math.max(0, Math.round((startedAt + minutes * 60000 - now) / 1000)); }
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
