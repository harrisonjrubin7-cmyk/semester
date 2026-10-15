/**
 * The program's dependency model, read out of `docs/program/02-…md`.
 *
 * The page is the source; this file only parses it and does the arithmetic, so
 * a figure on the page that no node explains fails `program.test.ts` instead of
 * standing. Estimates are the repository's own ranges; a node with none is
 * `null`, which is not zero, and the paths report every such node they cross.
 */

export interface Node {
  id: string;
  needs: string[];
  /** Weeks, lower and upper; `null` when the repository holds no estimate. */
  weeks: [number, number] | null;
}

export interface Motion {
  name: string;
  requires: string[];
  weeks: string;
  unestimated: string[];
}

const NODE_ID = /^(EXT|PGM)-\d{2,3}$/;
const DASH = /[–-]/;

const cells = (line: string): string[] => line.split('|').slice(1, -1).map((c) => c.trim());
const ids = (cell: string): string[] => (cell === '—' ? [] : cell.split(',').map((s) => s.trim()).filter(Boolean));

function weeksOf(cell: string): Node['weeks'] {
  if (cell === '—') return null;
  const [lo, hi] = cell.split(DASH).map(Number);
  const high = hi === undefined ? lo : hi;
  if (!Number.isFinite(lo) || !Number.isFinite(high)) throw new Error(`unreadable weeks "${cell}"`);
  return [lo, high];
}

export function parseNodes(md: string): Node[] {
  return md
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map(cells)
    .filter((c) => NODE_ID.test(c[0] ?? '') && c.length === 5)
    .map((c) => ({ id: c[0], needs: ids(c[2]), weeks: weeksOf(c[3]) }));
}

export function parseMotions(md: string): Motion[] {
  return md
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map(cells)
    .filter((c) => c.length === 4 && ids(c[1]).length > 0 && ids(c[1]).every((i) => NODE_ID.test(i)))
    .map((c) => ({ name: c[0], requires: ids(c[1]), weeks: c[2], unestimated: ids(c[3]) }));
}

export function byId(nodes: readonly Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Ids a node needs that are not nodes, so a typo cannot hide as a missing edge. */
export function unknownNeeds(nodes: readonly Node[]): string[] {
  const known = byId(nodes);
  return nodes.flatMap((n) => n.needs.filter((d) => !known.has(d)).map((d) => `${n.id} needs ${d}`));
}

/** The first cycle found, as a path, or null. */
export function cycle(nodes: readonly Node[]): string[] | null {
  const m = byId(nodes);
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const d of m.get(id)?.needs ?? []) {
      const found = visit(d);
      if (found) return found;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of nodes) {
    const found = visit(n.id);
    if (found) return found;
  }
  return null;
}

/** Every node a set of requirements depends on, the requirements included. */
export function closure(nodes: readonly Node[], requires: readonly string[]): Set<string> {
  const m = byId(nodes);
  const seen = new Set<string>();
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const d of m.get(id)?.needs ?? []) walk(d);
  };
  requires.forEach(walk);
  return seen;
}

/** Earliest finish in weeks, lower (0) or upper (1) estimate; unestimated nodes add nothing. */
export function finish(nodes: readonly Node[], id: string, bound: 0 | 1, memo = new Map<string, number>()): number {
  const hit = memo.get(`${id}:${bound}`);
  if (hit !== undefined) return hit;
  const n = byId(nodes).get(id);
  if (!n) throw new Error(`no node ${id}`);
  const own = n.weeks ? n.weeks[bound] : 0;
  const value = own + Math.max(0, ...n.needs.map((d) => finish(nodes, d, bound, memo)));
  memo.set(`${id}:${bound}`, value);
  return value;
}

export function pathWeeks(nodes: readonly Node[], requires: readonly string[]): [number, number] {
  const memo = new Map<string, number>();
  return [0, 1].map((b) => Math.max(0, ...requires.map((r) => finish(nodes, r, b as 0 | 1, memo)))) as [number, number];
}

export function unestimated(nodes: readonly Node[], requires: readonly string[]): string[] {
  const m = byId(nodes);
  return [...closure(nodes, requires)].filter((id) => m.get(id)!.weeks === null).sort();
}

/** The longest chain by the upper estimate, ending at `id`. */
export function longestPath(nodes: readonly Node[], id: string): string[] {
  const n = byId(nodes).get(id)!;
  if (n.needs.length === 0) return [id];
  const memo = new Map<string, number>();
  const best = n.needs.reduce((a, b) => (finish(nodes, b, 1, memo) > finish(nodes, a, 1, memo) ? b : a));
  return [...longestPath(nodes, best), id];
}

export const render = (weeks: [number, number]): string => (weeks[0] === weeks[1] ? `${weeks[0]}` : `${weeks[0]}–${weeks[1]}`);
