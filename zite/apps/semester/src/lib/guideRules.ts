// Course study guides: the one structure every study mode reads (Cards, Read, Field guide, Watch, Slides, Doc, Quiz, Figures,
// Cases, Cram, Listen). Pure functions, no I/O, deterministic (no AI model): a guide is written or pasted by its owner and parsed
// here. Mirrors the original app's Guide shape (units with cards, terms, cases, figures).

export type Card = { q: string; a: string };
export type Figure = { title: string; shows: string; rows: { l: string; v: number }[] };
export type CaseFile = { title: string; when: string; claim: string; test: string; verdict: string; lesson: string };
export type Unit = { name: string; points: string[]; cards: Card[]; figures: Figure[] };
export type Term = { t: string; d: string };
export type Guide = { title: string; blurb: string; units: Unit[]; terms: Term[]; cases: CaseFile[] };

export const MODES = ['cards', 'read', 'field', 'watch', 'slides', 'doc', 'quiz', 'figures', 'cases', 'cram', 'listen'] as const;
export type Mode = (typeof MODES)[number];
export const MODE_LABEL: Record<Mode, string> = {
  cards: 'Cards', read: 'Read', field: 'Field guide', watch: 'Watch', slides: 'Slides', doc: 'Doc', quiz: 'Quiz',
  figures: 'Figures', cases: 'Cases', cram: 'Cram', listen: 'Listen',
};

/**
 * Plain-text guide format (what a student pastes or types):
 *   # Unit name            starts a unit
 *   Q: question :: answer  a card (also "question :: answer")
 *   Term — definition      a glossary term (em dash, or " - " after a short term), only under "## Terms"
 *   Figure: title | what it shows | label=3, label=5   a figure with optional bar values
 *   Case: title | when | claim | test | verdict | lesson   a worked case (under any unit)
 *   any other non-empty line is a point in the current unit
 * Lines before the first "#" become the blurb.
 */
export function parseGuide(title: string, text: string): Guide {
  const g: Guide = { title: title.trim(), blurb: '', units: [], terms: [], cases: [] };
  let unit: Unit | null = null;
  let inTerms = false;
  const blurb: string[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^##\s*terms?\s*$/i.test(line) || /^##\s*glossary\s*$/i.test(line)) { inTerms = true; continue; }
    if (/^#\s+/.test(line)) { inTerms = false; unit = { name: line.replace(/^#\s+/, '').trim(), points: [], cards: [], figures: [] }; g.units.push(unit); continue; }
    const card = line.match(/^(?:Q:\s*)?(.+?)\s*::\s*(.+)$/i);
    if (card) { (unit ?? ensureUnit(g, (u) => (unit = u))).cards.push({ q: card[1].trim(), a: card[2].trim() }); continue; }
    const fig = line.match(/^Figure:\s*(.+)$/i);
    if (fig) {
      const [t, shows = '', data = ''] = fig[1].split('|').map((s) => s.trim());
      const rows = data ? data.split(',').map((p) => p.split('=').map((s) => s.trim())).filter((p) => p.length === 2 && p[0] && Number.isFinite(Number(p[1]))).map(([l, v]) => ({ l, v: Number(v) })) : [];
      (unit ?? ensureUnit(g, (u) => (unit = u))).figures.push({ title: t, shows, rows });
      continue;
    }
    const cs = line.match(/^Case:\s*(.+)$/i);
    if (cs) {
      const [t, when = '', claim = '', test = '', verdict = '', lesson = ''] = cs[1].split('|').map((s) => s.trim());
      g.cases.push({ title: t, when, claim, test, verdict, lesson });
      continue;
    }
    if (inTerms) {
      const m = line.match(/^(.{1,60}?)\s+(?:—|–|-)\s+(.+)$/);
      if (m) { g.terms.push({ t: m[1].trim(), d: m[2].trim() }); continue; }
    }
    if (!unit) { blurb.push(line); continue; }
    unit.points.push(line.replace(/^[-*•]\s*/, ''));
  }
  g.blurb = blurb.join(' ');
  return g;
}

function ensureUnit(g: Guide, set: (u: Unit) => void): Unit {
  const u: Unit = { name: 'General', points: [], cards: [], figures: [] };
  g.units.push(u); set(u);
  return u;
}

/** What a guide can offer: a mode is available only when the guide has the material it needs. */
export function availableModes(g: Guide): Mode[] {
  const cards = g.units.reduce((n, u) => n + u.cards.length, 0);
  const points = g.units.reduce((n, u) => n + u.points.length, 0);
  const figures = g.units.reduce((n, u) => n + u.figures.length, 0);
  return MODES.filter((m) => {
    if (m === 'cards') return cards > 0;
    if (m === 'quiz') return cards >= 2;
    if (m === 'figures') return figures > 0;
    if (m === 'cases') return g.cases.length > 0;
    return points + cards > 0;
  });
}

/** Slides: one point per slide, a title slide per unit. */
export function slides(g: Guide): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [{ title: g.title, body: g.blurb }];
  for (const u of g.units) {
    out.push({ title: u.name, body: `${u.points.length} points · ${u.cards.length} cards` });
    for (const p of u.points) out.push({ title: u.name, body: p });
  }
  return out;
}

/** Narration script for Watch (per unit) and Listen (whole guide, with chapters). */
export function script(g: Guide): { chapter: string; text: string }[] {
  return g.units.map((u) => ({ chapter: u.name, text: [`${u.name}.`, ...u.points, ...u.cards.map((c) => `${c.q} ${c.a}.`)].join(' ') }));
}

/** Cram: everything on one page — every point, every answer, every term. */
export function cram(g: Guide): { unit: string; lines: string[] }[] {
  return [...g.units.map((u) => ({ unit: u.name, lines: [...u.points, ...u.cards.map((c) => `${c.q} → ${c.a}`)] })),
    ...(g.terms.length ? [{ unit: 'Terms', lines: g.terms.map((t) => `${t.t}: ${t.d}`) }] : [])];
}

// ---- Quiz: generated from cards, deterministic for a seed. ----
export type Question =
  | { kind: 'choice'; prompt: string; options: string[]; answer: number }
  | { kind: 'truefalse'; prompt: string; shown: string; answer: boolean }
  | { kind: 'match'; pairs: { q: string; a: string }[]; order: number[] };

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function shuffle<T>(xs: T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function buildQuiz(g: Guide, seed: number, max = 10): Question[] {
  const all = g.units.flatMap((u) => u.cards);
  if (all.length < 2) return [];
  const r = rng(seed);
  const picked = shuffle(all, r).slice(0, max);
  const qs: Question[] = [];
  picked.forEach((c, i) => {
    const others = all.filter((x) => x.a !== c.a).map((x) => x.a);
    if (i % 3 === 2 && all.length >= 3) {
      const pairs = shuffle(all.filter((x) => x !== c), r).slice(0, 2).concat([c]);
      qs.push({ kind: 'match', pairs, order: shuffle(pairs.map((_, k) => k), r) });
    } else if (i % 3 === 1) {
      const truthy = r() < 0.5 || !others.length;
      qs.push({ kind: 'truefalse', prompt: c.q, shown: truthy ? c.a : others[Math.floor(r() * others.length)], answer: truthy });
    } else {
      const wrong = shuffle([...new Set(others)], r).slice(0, 3);
      const options = shuffle([c.a, ...wrong], r);
      qs.push({ kind: 'choice', prompt: c.q, options, answer: options.indexOf(c.a) });
    }
  });
  return qs;
}

/** Marks one response. Match answers are the chosen answer index (into order) for each pair, in pair order. */
export function mark(q: Question, response: number | boolean | number[]): boolean {
  if (q.kind === 'choice') return response === q.answer;
  if (q.kind === 'truefalse') return response === q.answer;
  if (!Array.isArray(response) || response.length !== q.pairs.length) return false;
  return response.every((chosen, k) => q.order[chosen] === k);
}

// ---- Cards: Leitner boxes (1..5). Known moves up a box, Again goes back to box 1. Days until next review per box. ----
export const BOX_DAYS = [0, 1, 2, 4, 7, 14];
export function review(box: number, known: boolean): { box: number; inDays: number } {
  const b = known ? Math.min(5, Math.max(1, box) + 1) : 1;
  return { box: b, inDays: BOX_DAYS[b] };
}

/** Word document (HTML Word opens) for the Doc mode; all text is escaped. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function docHtml(g: Guide): string {
  const body = [`<h1>${esc(g.title)}</h1>`, g.blurb ? `<p>${esc(g.blurb)}</p>` : '',
    ...g.units.map((u) => `<h2>${esc(u.name)}</h2>${u.points.map((p) => `<p>${esc(p)}</p>`).join('')}${u.cards.length ? `<ul>${u.cards.map((c) => `<li><b>${esc(c.q)}</b> ${esc(c.a)}</li>`).join('')}</ul>` : ''}`),
    g.terms.length ? `<h2>Terms</h2><dl>${g.terms.map((t) => `<dt><b>${esc(t.t)}</b></dt><dd>${esc(t.d)}</dd>`).join('')}</dl>` : '',
    g.cases.length ? `<h2>Cases</h2>${g.cases.map((c) => `<h3>${esc(c.title)}</h3><p>${esc([c.when, c.claim, c.test, c.verdict, c.lesson].filter(Boolean).join(' · '))}</p>`).join('')}` : ''].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(g.title)}</title></head><body>${body}</body></html>`;
}
