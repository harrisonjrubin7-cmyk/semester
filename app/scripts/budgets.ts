/**
 * Checks a production build against the performance budgets in
 * `src/lib/perfbudget.ts` and `perf-budgets.json`. Run after `npm run build`:
 *
 *     npm run budgets            # fail on any overage
 *     npm run budgets -- --print # print the measurement as budget JSON
 *
 * It reads the chunk graph the `bundle-graph` plugin wrote and gzips each
 * file in `dist/` itself, at level 9, which is what a CDN serves.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { NEW_ROUTE, budgetFrom, measure, overBudget, type Budgets, type Graph } from '../src/lib/perfbudget.ts';

const app = join(import.meta.dirname, '..');
const graph: Graph = JSON.parse(readFileSync(join(app, 'node_modules/.cache/semester/bundle-graph.json'), 'utf8'));
const cache = new Map<string, number>();
const gzip = (file: string) => {
  let n = cache.get(file);
  if (n === undefined) {
    n = gzipSync(readFileSync(join(app, 'dist', file)), { level: 9 }).length;
    cache.set(file, n);
  }
  return n;
};

const m = measure(graph, gzip);

if (process.argv.includes('--print')) {
  const routes = Object.fromEntries(Object.entries(m.routes).sort(([a], [b]) => a.localeCompare(b)).map(([r, n]) => [r, budgetFrom(n)]));
  const suggested: Budgets & { measuredOn: string; measured: unknown } = {
    measuredOn: new Date().toISOString().slice(0, 10),
    firstLoad: budgetFrom(m.firstLoad),
    largest: budgetFrom(m.largest.bytes),
    route: NEW_ROUTE,
    routes,
    measured: { firstLoad: m.firstLoad, largest: m.largest, routes: m.routes },
  };
  console.log(JSON.stringify(suggested, null, 2));
  process.exit(0);
}

const budgets: Budgets = JSON.parse(readFileSync(join(app, 'perf-budgets.json'), 'utf8'));
const over = overBudget(m, budgets);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`first load ${kb(m.firstLoad)} of ${kb(budgets.firstLoad)}; largest file ${m.largest.file} ${kb(m.largest.bytes)} of ${kb(budgets.largest)}; ${Object.keys(m.routes).length} routes`);
if (over.length) {
  console.error(`\nOver budget:\n${over.map((l) => `  - ${l}`).join('\n')}\n\nIf the growth is deliberate, raise the number in app/perf-budgets.json in the same pull request and say why.`);
  process.exit(1);
}
console.log('budgets ok');
