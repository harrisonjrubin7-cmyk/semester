/**
 * Performance budgets: how much JavaScript a student downloads before the
 * app appears, and how much more each screen costs to open.
 *
 * `docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md` asked for this as a file CI
 * checks against the build output, set from a measurement rather than a
 * guess. This is the file and the arithmetic; `scripts/budgets.ts` runs it
 * against `dist/` after every build, using the chunk graph the `bundle-graph`
 * plugin in `vite.config.ts` records.
 *
 * Every number is gzip bytes, because that is what crosses the network. Each
 * budget is the measurement it was set from plus ten per cent, rounded up to
 * the next kilobyte: room for ordinary growth, and a failure for a screen
 * that suddenly pulls a charting library into its first load.
 *
 * ## What is measured
 *
 * - **First load**: the entry chunk and everything it imports statically —
 *   what the browser fetches before anything is on screen.
 * - **Each route**: a lazily imported screen's chunk and everything it
 *   imports statically that the first load did not already bring. That is
 *   the cost of the tap that opens it.
 * - **The largest chunk anywhere**: the one file a slow connection waits
 *   longest for, whatever loads it.
 *
 * A dynamic import inside a screen (the diagram renderer, the PDF reader) is
 * not counted against that screen: it loads when the student asks for that
 * part, and the largest-chunk cap is what bounds it.
 */

export type Chunk = { file: string; source: string | null; entry: boolean; imports: string[]; dynamicImports: string[] };
export type Graph = { chunks: Chunk[] };

/** The measurement of 29 September 2026 at 40ad024, gzip bytes, that the budgets were set from. */
export const MEASURED_ON = '2026-09-29';

export const HEADROOM = 0.1;

/**
 * Measured plus headroom, rounded up to a whole kilobyte, and never less than
 * the measurement plus `FLOOR`: ten per cent of a one-kilobyte screen is a
 * hundred bytes, which a single new sentence would break.
 */
export const FLOOR = 8 * 1024;
export const budgetFrom = (measured: number) =>
  Math.max(Math.ceil(Math.round(measured * (1 + HEADROOM)) / 1024) * 1024, Math.ceil((measured + FLOOR) / 1024) * 1024);

/** What a new screen with no budget of its own may cost to open. */
export const NEW_ROUTE = 48 * 1024;

/** Every chunk reachable from `start` through static imports, `start` included. */
export function staticClosure(graph: Graph, start: string): Set<string> {
  const byFile = new Map(graph.chunks.map((c) => [c.file, c]));
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of byFile.get(file)?.imports ?? []) queue.push(next);
  }
  return seen;
}

/** The entry chunk; a build with none, or with two, is not one this understands. */
export function entryOf(graph: Graph): Chunk {
  const entries = graph.chunks.filter((c) => c.entry);
  if (entries.length !== 1) throw new Error(`expected one entry chunk, found ${entries.length}`);
  return entries[0];
}

/** A route: a screen the entry imports lazily, keyed by its source path. */
export const isRouteSource = (source: string | null): source is string =>
  !!source && (/^src\/screens\/.+\.tsx$/.test(source) || source === 'src/ai/Chat.tsx');

export type Measurement = {
  firstLoad: number;
  routes: Record<string, number>;
  largest: { file: string; bytes: number };
};

/** The three measurements, given each file's gzip size. */
export function measure(graph: Graph, gzip: (file: string) => number): Measurement {
  const entry = entryOf(graph);
  const initial = staticClosure(graph, entry.file);
  const sum = (files: Iterable<string>) => [...files].reduce((n, f) => n + gzip(f), 0);
  const routes: Record<string, number> = {};
  const byFile = new Map(graph.chunks.map((c) => [c.file, c]));
  for (const file of entry.dynamicImports) {
    const c = byFile.get(file);
    if (!c || !isRouteSource(c.source)) continue;
    routes[c.source] = sum([...staticClosure(graph, file)].filter((f) => !initial.has(f)));
  }
  let largest = { file: '', bytes: 0 };
  for (const c of graph.chunks) {
    const bytes = gzip(c.file);
    if (bytes > largest.bytes) largest = { file: c.file, bytes };
  }
  return { firstLoad: sum(initial), routes, largest };
}

export type Budgets = { firstLoad: number; largest: number; route: number; routes: Record<string, number> };

/**
 * What the measurement exceeds, one line each. A route with no budget of its
 * own is held to `route`, the default; a budgeted route that no longer
 * exists is reported too, so the file cannot quietly outlive the app.
 */
export function overBudget(m: Measurement, b: Budgets): string[] {
  const out: string[] = [];
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  if (m.firstLoad > b.firstLoad) out.push(`first load is ${kb(m.firstLoad)}, over its ${kb(b.firstLoad)} budget`);
  if (m.largest.bytes > b.largest) out.push(`${m.largest.file} is ${kb(m.largest.bytes)}, over the ${kb(b.largest)} cap on any one file`);
  for (const [route, bytes] of Object.entries(m.routes)) {
    const limit = b.routes[route] ?? b.route;
    if (bytes > limit) out.push(`${route} costs ${kb(bytes)} to open, over its ${kb(limit)} budget`);
  }
  for (const route of Object.keys(b.routes)) {
    if (!(route in m.routes)) out.push(`${route} has a budget but is no longer a route — remove it`);
  }
  return out;
}
