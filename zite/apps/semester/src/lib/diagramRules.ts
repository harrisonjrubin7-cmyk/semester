// Diagram builder: flows, timelines and matrices from a plain-text description, drawn as a standalone SVG.
// Pure and deterministic so the same text always gives the same picture (and so it can be tested).

export type DiagramKind = 'flow' | 'timeline' | 'matrix';
export const LIMITS = { nodes: 40, edges: 60, events: 30, cells: 8, label: 80 };

export type Flow = { kind: 'flow'; nodes: string[]; edges: { from: number; to: number; label: string }[] };
export type Timeline = { kind: 'timeline'; events: { when: string; what: string }[] };
export type Matrix = { kind: 'matrix'; rows: string[]; cols: string[]; cells: Record<string, string> };
export type Diagram = Flow | Timeline | Matrix;
export type Parsed = { diagram: Diagram; problems: string[] };

const clip = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, LIMITS.label);
const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));

/** Flow: one connection per line, `A -> B` or `A -> B: label`. A line with no arrow adds a step on its own. */
export function parseFlow(text: string): Parsed {
  const nodes: string[] = []; const edges: Flow['edges'] = []; const problems: string[] = [];
  const node = (name: string) => { const n = clip(name); if (!n) return -1; let i = nodes.indexOf(n); if (i < 0) { if (nodes.length >= LIMITS.nodes) { problems.push(`Only ${LIMITS.nodes} steps fit; "${n}" was left out.`); return -1; } nodes.push(n); i = nodes.length - 1; } return i; };
  lines(text).forEach((l, k) => {
    const m = l.match(/^(.*?)\s*(?:->|→|=>)\s*(.*)$/);
    if (!m) { node(l); return; }
    const [to, ...lab] = m[2].split(':');
    const a = node(m[1]); const b = node(to);
    if (a < 0 || b < 0) { if (!m[1].trim() || !to.trim()) problems.push(`Line ${k + 1}: an arrow needs a step on both sides.`); return; }
    if (edges.length >= LIMITS.edges) { problems.push(`Only ${LIMITS.edges} connections fit.`); return; }
    edges.push({ from: a, to: b, label: clip(lab.join(':')) });
  });
  if (!nodes.length) problems.push('Write at least one step, for example: Question -> Hypothesis');
  return { diagram: { kind: 'flow', nodes, edges }, problems };
}

/** Timeline: `when: what` per line, kept in the order written. */
export function parseTimeline(text: string): Parsed {
  const events: Timeline['events'] = []; const problems: string[] = [];
  lines(text).forEach((l, k) => {
    const i = l.indexOf(':');
    if (i <= 0) { problems.push(`Line ${k + 1}: use "when: what happened".`); return; }
    if (events.length >= LIMITS.events) { problems.push(`Only ${LIMITS.events} events fit.`); return; }
    events.push({ when: clip(l.slice(0, i)), what: clip(l.slice(i + 1)) });
  });
  if (!events.length && !problems.length) problems.push('Write at least one event, for example: 1914: War begins');
  return { diagram: { kind: 'timeline', events }, problems };
}

/** Matrix: `rows: a, b`, `cols: x, y`, then `a / x: text` for each cell. */
export function parseMatrix(text: string): Parsed {
  let rows: string[] = []; let cols: string[] = []; const cells: Record<string, string> = {}; const problems: string[] = [];
  const list = (s: string) => s.split(',').map(clip).filter(Boolean);
  for (const [k, l] of lines(text).entries()) {
    const head = l.match(/^(rows|columns|cols)\s*:\s*(.*)$/i);
    if (head) { const v = list(head[2]); if (/^rows$/i.test(head[1])) rows = v; else cols = v; continue; }
    const c = l.match(/^(.*?)\s*\/\s*(.*?)\s*:\s*(.*)$/);
    if (!c) { problems.push(`Line ${k + 1}: use "row / column: text".`); continue; }
    const r = clip(c[1]); const col = clip(c[2]);
    if (!rows.includes(r) || !cols.includes(col)) { problems.push(`Line ${k + 1}: "${r} / ${col}" is not a listed row and column.`); continue; }
    cells[`${r}\u0000${col}`] = clip(c[3]);
  }
  if (!rows.length || !cols.length) problems.push('List the rows and columns first, for example: rows: Low cost, High cost');
  if (rows.length > LIMITS.cells || cols.length > LIMITS.cells) { problems.push(`Up to ${LIMITS.cells} rows and ${LIMITS.cells} columns fit.`); rows = rows.slice(0, LIMITS.cells); cols = cols.slice(0, LIMITS.cells); }
  return { diagram: { kind: 'matrix', rows, cols, cells }, problems };
}

export const parse = (kind: DiagramKind, text: string): Parsed => (kind === 'flow' ? parseFlow(text) : kind === 'timeline' ? parseTimeline(text) : parseMatrix(text));

/** Layers for a flow: each step sits one column right of the furthest step leading into it. Loops are drawn as curved back-arrows. */
export function layers(f: Flow): { layer: number[]; back: Set<number> } {
  const n = f.nodes.length; const out: number[][] = Array.from({ length: n }, () => []);
  f.edges.forEach((e, i) => out[e.from].push(i));
  const state = new Array(n).fill(0); const back = new Set<number>();
  const dfs = (v: number) => { state[v] = 1; for (const i of out[v]) { const w = f.edges[i].to; if (state[w] === 1) back.add(i); else if (state[w] === 0) dfs(w); } state[v] = 2; };
  for (let v = 0; v < n; v++) if (state[v] === 0) dfs(v);
  const layer = new Array(n).fill(0);
  for (let pass = 0; pass < n; pass++) { let moved = false; f.edges.forEach((e, i) => { if (!back.has(i) && e.from !== e.to && layer[e.to] < layer[e.from] + 1) { layer[e.to] = layer[e.from] + 1; moved = true; } }); if (!moved) break; }
  return { layer, back };
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function wrap(s: string, width: number, max = 3): string[] {
  const out: string[] = []; let cur = '';
  for (const w of s.split(' ')) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= width) cur += ' ' + w; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  const kept = out.slice(0, max).map((l) => (l.length > width ? l.slice(0, width - 1) + '…' : l));
  if (out.length > max) kept[max - 1] = kept[max - 1].replace(/.?$/, '…');
  return kept;
}

export type Ink = { ink: string; paper: string; soft: string };
export const PRINT: Ink = { ink: '#1f2937', paper: '#ffffff', soft: '#f3f4f6' };
const FONT = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"';
const text = (x: number, y: number, ls: string[], size: number, ink: string, anchor = 'middle', weight = 400) =>
  `<text x="${x}" y="${y - ((ls.length - 1) * size * 0.6)}" font-size="${size}" fill="${ink}" text-anchor="${anchor}" font-weight="${weight}" dominant-baseline="middle">${ls.map((l, i) => `<tspan x="${x}" dy="${i ? size * 1.2 : 0}">${esc(l)}</tspan>`).join('')}</text>`;

/** A standalone SVG for the diagram. `title` becomes the accessible name. */
export function toSvg(d: Diagram, title: string, c: Ink = PRINT): string {
  let w = 320, h = 120, body = '';
  if (d.kind === 'flow') {
    const { layer, back } = layers(d); const BW = 168, BH = 56, GX = 72, GY = 28, P = 24;
    const cols = Math.max(0, ...layer) + 1; const per = Array.from({ length: cols }, () => 0); const row = d.nodes.map((_, i) => per[layer[i]]++);
    const tall = Math.max(1, ...per);
    w = P * 2 + cols * BW + (cols - 1) * GX; h = P * 2 + tall * BH + (tall - 1) * GY + (back.size ? 40 : 0);
    const pos = d.nodes.map((_, i) => { const x = P + layer[i] * (BW + GX); const off = ((tall - per[layer[i]]) * (BH + GY)) / 2; return { x, y: P + off + row[i] * (BH + GY) }; });
    const edges = d.edges.map((e, i) => {
      const a = pos[e.from], b = pos[e.to];
      if (e.from === e.to) return `<path d="M${a.x + BW - 30} ${a.y} C ${a.x + BW - 30} ${a.y - 26}, ${a.x + BW + 10} ${a.y - 26}, ${a.x + BW} ${a.y + 14}" fill="none" stroke="${c.ink}" stroke-width="1.5" marker-end="url(#arrow)"/>`;
      if (back.has(i)) { const y = h - 20; return `<path d="M${a.x + BW / 2} ${a.y + BH} C ${a.x + BW / 2} ${y}, ${b.x + BW / 2} ${y}, ${b.x + BW / 2} ${b.y + BH}" fill="none" stroke="${c.ink}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrow)"/>` + (e.label ? text((a.x + b.x + BW) / 2, y - 6, [e.label], 11, c.ink) : ''); }
      const x1 = a.x + BW, y1 = a.y + BH / 2, x2 = b.x, y2 = b.y + BH / 2;
      return `<line x1="${x1}" y1="${y1}" x2="${x2 - 2}" y2="${y2}" stroke="${c.ink}" stroke-width="1.5" marker-end="url(#arrow)"/>` + (e.label ? `<rect x="${(x1 + x2) / 2 - 30}" y="${(y1 + y2) / 2 - 9}" width="60" height="18" fill="${c.paper}"/>` + text((x1 + x2) / 2, (y1 + y2) / 2, [wrap(e.label, 12, 1)[0]], 11, c.ink) : '');
    }).join('');
    body = edges + d.nodes.map((n, i) => `<rect x="${pos[i].x}" y="${pos[i].y}" width="${BW}" height="${BH}" rx="8" fill="${c.soft}" stroke="${c.ink}" stroke-width="1.5"/>` + text(pos[i].x + BW / 2, pos[i].y + BH / 2, wrap(n, 20, 2), 13, c.ink)).join('');
  } else if (d.kind === 'timeline') {
    const SP = 150, P = 40, n = d.events.length; w = Math.max(320, P * 2 + Math.max(0, n - 1) * SP); h = 300; const y = h / 2;
    body = `<line x1="${P - 20}" y1="${y}" x2="${w - P + 20}" y2="${y}" stroke="${c.ink}" stroke-width="2" marker-end="url(#arrow)"/>` +
      d.events.map((e, i) => { const x = n === 1 ? w / 2 : P + i * SP; const up = i % 2 === 0; const ty = up ? y - 70 : y + 70;
        return `<circle cx="${x}" cy="${y}" r="6" fill="${c.ink}"/><line x1="${x}" y1="${y}" x2="${x}" y2="${up ? y - 40 : y + 40}" stroke="${c.ink}" stroke-width="1"/>` +
          text(x, up ? y - 52 : y + 52, [e.when], 13, c.ink, 'middle', 600) + text(x, ty + (up ? -12 : 12), wrap(e.what, 22, 3), 12, c.ink); }).join('');
  } else {
    const HW = 140, CW = 170, CH = 70, P = 16; w = P * 2 + HW + d.cols.length * CW; h = P * 2 + 40 + d.rows.length * CH;
    body = d.cols.map((col, j) => text(P + HW + j * CW + CW / 2, P + 20, wrap(col, 20, 2), 13, c.ink, 'middle', 600)).join('') +
      d.rows.map((r, i) => { const yy = P + 40 + i * CH; return text(P + HW - 8, yy + CH / 2, wrap(r, 16, 3), 13, c.ink, 'end', 600) +
        d.cols.map((col, j) => { const x = P + HW + j * CW; const v = d.cells[`${r}\u0000${col}`] ?? '';
          return `<rect x="${x}" y="${yy}" width="${CW}" height="${CH}" fill="${(i + j) % 2 ? c.paper : c.soft}" stroke="${c.ink}" stroke-width="1"/>` + (v ? text(x + CW / 2, yy + CH / 2, wrap(v, 22, 3), 12, c.ink) : ''); }).join(''); }).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title || 'Diagram')}" ${FONT}>` +
    `<title>${esc(title || 'Diagram')}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c.ink}"/></marker></defs>` +
    (c.paper === 'none' ? '' : `<rect width="${w}" height="${h}" fill="${c.paper}"/>`) + body + '</svg>';
}

/** A plain-language reading of the diagram, for screen readers and for pasting into notes. */
export function describe(d: Diagram): string {
  if (d.kind === 'flow') return d.nodes.length ? d.edges.map((e) => `${d.nodes[e.from]} leads to ${d.nodes[e.to]}${e.label ? ` (${e.label})` : ''}.`).concat(d.nodes.filter((_, i) => !d.edges.some((e) => e.from === i || e.to === i)).map((n) => `${n} stands alone.`)).join(' ') : '';
  if (d.kind === 'timeline') return d.events.map((e) => `${e.when}: ${e.what}.`).join(' ');
  return d.rows.flatMap((r) => d.cols.map((col) => { const v = d.cells[`${r}\u0000${col}`]; return v ? `${r}, ${col}: ${v}.` : ''; })).filter(Boolean).join(' ');
}

export const STARTERS: Record<DiagramKind, string> = {
  flow: 'Question -> Background research\nBackground research -> Hypothesis\nHypothesis -> Experiment\nExperiment -> Analysis\nAnalysis -> Conclusion: supported\nAnalysis -> Hypothesis: not supported',
  timeline: '1914: War begins in Europe\n1917: The United States enters\n1918: Armistice signed\n1919: Treaty of Versailles',
  matrix: 'rows: High impact, Low impact\ncols: Low effort, High effort\nHigh impact / Low effort: Do first\nHigh impact / High effort: Plan it\nLow impact / Low effort: Quick wins\nLow impact / High effort: Skip',
};
