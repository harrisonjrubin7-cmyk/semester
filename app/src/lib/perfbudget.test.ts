import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLOOR, NEW_ROUTE, budgetFrom, measure, overBudget, staticClosure, type Budgets, type Graph } from './perfbudget';

/**
 * The budget arithmetic on a graph small enough to add up by hand, and
 * `perf-budgets.json` held to the screens that exist. Whether the real build
 * is inside its budgets is `npm run budgets`, which CI runs after the build;
 * this is what makes that check mean what it says.
 */

const app = join(import.meta.dirname, '../..');

const graph: Graph = {
  chunks: [
    { file: 'entry.js', source: 'index.html', entry: true, imports: ['react.js', 'shared.js'], dynamicImports: ['Today.js', 'Heavy.js', 'Widget.js'] },
    { file: 'react.js', source: null, entry: false, imports: [], dynamicImports: [] },
    { file: 'shared.js', source: null, entry: false, imports: ['react.js'], dynamicImports: [] },
    { file: 'Today.js', source: 'src/screens/Today.tsx', entry: false, imports: ['shared.js', 'chart.js'], dynamicImports: ['diagram.js'] },
    { file: 'Heavy.js', source: 'src/screens/Heavy.tsx', entry: false, imports: [], dynamicImports: [] },
    { file: 'Widget.js', source: 'src/components/Widget.tsx', entry: false, imports: [], dynamicImports: [] },
    { file: 'chart.js', source: null, entry: false, imports: [], dynamicImports: [] },
    { file: 'diagram.js', source: null, entry: false, imports: [], dynamicImports: [] },
  ],
};
const sizes: Record<string, number> = {
  'entry.js': 10_000, 'react.js': 40_000, 'shared.js': 5_000, 'Today.js': 3_000, 'Heavy.js': 90_000,
  'Widget.js': 1_000, 'chart.js': 20_000, 'diagram.js': 200_000,
};
const gzip = (f: string) => sizes[f];

describe('performance budgets', () => {
  it('follows static imports only, and each chunk once', () => {
    expect([...staticClosure(graph, 'Today.js')].sort()).toEqual(['Today.js', 'chart.js', 'react.js', 'shared.js']);
  });

  it('measures the first load, each route beyond it, and the largest file', () => {
    const m = measure(graph, gzip);
    expect(m.firstLoad).toBe(55_000); // entry + react + shared
    // Today brings chart.js with it; shared and react are already loaded,
    // and the diagram it imports lazily is not its cost.
    expect(m.routes).toEqual({ 'src/screens/Today.tsx': 23_000, 'src/screens/Heavy.tsx': 90_000 });
    // A lazily imported component is not a route.
    expect(m.routes).not.toHaveProperty('src/components/Widget.tsx');
    expect(m.largest).toEqual({ file: 'diagram.js', bytes: 200_000 });
  });

  it('sets a budget from a measurement with headroom and a floor', () => {
    expect(budgetFrom(100 * 1024)).toBe(110 * 1024);
    expect(budgetFrom(1024)).toBe(1024 + FLOOR);
  });

  const within: Budgets = {
    firstLoad: 60_000, largest: 250_000, route: NEW_ROUTE,
    routes: { 'src/screens/Today.tsx': 30_000, 'src/screens/Heavy.tsx': 100_000 },
  };

  it('passes a build inside every budget', () => {
    expect(overBudget(measure(graph, gzip), within)).toEqual([]);
  });

  it('names each budget a build exceeds', () => {
    const m = measure(graph, (f) => (f === 'chart.js' ? 400_000 : f === 'react.js' ? 50_000 : gzip(f)));
    const over = overBudget(m, within);
    expect(over).toHaveLength(3);
    expect(over[0]).toMatch(/^first load is .* over its/);
    expect(over[1]).toMatch(/^chart\.js is .* over the .* cap on any one file/);
    expect(over[2]).toMatch(/^src\/screens\/Today\.tsx costs .* to open, over its/);
  });

  it('holds a route with no budget of its own to the default for new screens', () => {
    const { ['src/screens/Heavy.tsx']: _gone, ...rest } = within.routes;
    expect(overBudget(measure(graph, gzip), { ...within, routes: rest })).toEqual([
      expect.stringMatching(/^src\/screens\/Heavy\.tsx costs .* over its 48\.0 KB budget/),
    ]);
  });

  it('refuses a budget for a route that no longer exists', () => {
    const b = { ...within, routes: { ...within.routes, 'src/screens/Gone.tsx': 10_000 } };
    expect(overBudget(measure(graph, gzip), b)).toEqual(['src/screens/Gone.tsx has a budget but is no longer a route — remove it']);
  });

  describe('perf-budgets.json', () => {
    const file: Budgets & { measuredOn: string; measured: { firstLoad: number; largest: { bytes: number }; routes: Record<string, number> } } =
      JSON.parse(readFileSync(join(app, 'perf-budgets.json'), 'utf8'));

    it('names only screens that exist and are lazily imported', () => {
      const sources = (readdirSync(join(app, 'src'), { recursive: true }) as string[])
        .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
        .map((f) => readFileSync(join(app, 'src', f), 'utf8'))
        .join('\n');
      for (const route of Object.keys(file.routes)) {
        expect(existsSync(join(app, route)), route).toBe(true);
        const tail = route.replace(/^src\//, '').replace(/\.tsx$/, '');
        expect(new RegExp(`import\\(\\s*'[./]*${tail.replace(/\//g, '\\/')}'\\s*\\)`).test(sources), `${route} is lazily imported`).toBe(true);
      }
    });

    it('was set from the measurement it records, not raised past it', () => {
      expect(file.firstLoad).toBe(budgetFrom(file.measured.firstLoad));
      expect(file.largest).toBe(budgetFrom(file.measured.largest.bytes));
      for (const [route, bytes] of Object.entries(file.measured.routes)) expect(file.routes[route], route).toBe(budgetFrom(bytes));
      expect(file.route).toBe(NEW_ROUTE);
    });
  });
});
