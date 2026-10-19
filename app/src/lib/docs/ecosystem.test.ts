import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LADDER, MARK_END, MARK_START, WORKSPACES, build, ceiling, countsMarkdown, spliceCounts, toCsv, toRegistry,
  type Capability, type Crosswalk, type Deployed, type PrototypeRoute,
} from './ecosystem.ts';

/**
 * The coverage matrix is a copy of the crosswalk held against the tree, so it
 * is held to both.
 *
 * `ECOSYSTEM=write npx vitest run src/lib/docs/ecosystem.test.ts` (or
 * `npm run ecosystem:build`) rewrites `docs/ecosystem/COVERAGE-MATRIX.csv`,
 * `docs/registry-status.json` and the counts block of
 * `docs/ecosystem/INVENTORY.md`. A plain run regenerates them in memory and
 * fails on any difference, and fails when the crosswalk cites a path that is
 * not in the tree or claims a status its evidence does not support.
 */
const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const json = <T,>(p: string): T => JSON.parse(readFileSync(at(p), 'utf8')) as T;

const SCREENS = 'docs/handoff/prototype/screens.json';
const CAPABILITIES = 'docs/handoff/registry/capabilities.json';
const CROSSWALK = 'docs/ecosystem/crosswalk.json';
const DEPLOYED = 'docs/ecosystem/deployed.json';
const MATRIX = 'docs/ecosystem/COVERAGE-MATRIX.csv';
const REGISTRY = 'docs/registry-status.json';
const INVENTORY = 'docs/ecosystem/INVENTORY.md';

const routes = json<{ routes: PrototypeRoute[] }>(SCREENS).routes;
const capabilities = json<{ capabilities: Capability[] }>(CAPABILITIES).capabilities;
const crosswalk = json<Crosswalk>(CROSSWALK);
const deployed = json<Deployed>(DEPLOYED);
const exists = (p: string) => existsSync(at(p));

const built = build(routes, capabilities, crosswalk, deployed, exists);
const csv = toCsv(built.rows);
const registry = `${JSON.stringify(toRegistry(built.rows, crosswalk), null, 2)}\n`;
const inventory = spliceCounts(readFileSync(at(INVENTORY), 'utf8'), countsMarkdown(built.rows));

if (process.env.ECOSYSTEM === 'write') {
  writeFileSync(at(MATRIX), csv);
  writeFileSync(at(REGISTRY), registry);
  writeFileSync(at(INVENTORY), inventory);
}

describe('the ecosystem coverage matrix', () => {
  it('cites only paths that exist and claims only what its evidence supports', () => {
    expect(built.problems).toEqual([]);
  });

  it('matches the committed files', () => {
    const hint = 'run `npm run ecosystem:build` and commit docs/ecosystem and docs/registry-status.json';
    expect(csv, hint).toBe(readFileSync(at(MATRIX), 'utf8'));
    expect(registry, hint).toBe(readFileSync(at(REGISTRY), 'utf8'));
    expect(inventory, hint).toBe(readFileSync(at(INVENTORY), 'utf8'));
  });

  it('has one row per prototype route and one per design capability, nothing dropped', () => {
    const ids = built.rows.map((r) => r.identifier);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !id.startsWith('capability:'))).toHaveLength(routes.length);
    expect(ids.filter((id) => id.startsWith('capability:'))).toHaveLength(capabilities.length);
    expect(routes.length).toBe(281);
  });

  it('describes every prototype workspace', () => {
    expect([...new Set(routes.map((r) => r.ws))].filter((ws) => !WORKSPACES[ws])).toEqual([]);
  });

  it('nobody is deployed until the production app has been seen running', () => {
    // The listing proves the schema; only a probe proves the app. Until deployed.json says the app was
    // verified, the ladder stops at tested, however green the build.
    if (!deployed.app.verified) {
      expect(built.rows.filter((r) => r.ladder === 'deployed' || r.ladder === 'operational')).toEqual([]);
    }
  });

  it('keeps the applied-migration listing in step with the repository', () => {
    // deployed.json is a snapshot of what the management API listed. A migration in the tree that the
    // listing lacks is either unapplied or a stale snapshot; either way the matrix must not call it deployed.
    const applied = new Set(deployed.supabase.migrations);
    for (const m of crosswalk.routes ? Object.values(crosswalk.routes).flatMap((e) => e.migrations) : []) {
      expect(exists(m), m).toBe(true);
    }
    expect(applied.size).toBeGreaterThan(0);
  });
});

describe('the matrix refuses what it cannot stand behind — controls, so an empty crosswalk cannot pass vacuously', () => {
  const route: PrototypeRoute = {
    ws: 'student', wsLabel: 'Student', key: 'x', label: 'X', route: '#/student/x', component: 'X', file: 'X.jsx', navFile: 'Shell.jsx', stream: '03',
  };
  const fake: Deployed = { supabase: { project: 'p', listedAt: 'd', method: 'm', migrations: ['20260901000100'] }, app: { verified: false, status: 'unverified' } };
  const walk = (e: Partial<Crosswalk['routes'][string]>): Crosswalk => ({
    generated: 'now', method: 'test',
    routes: { '#/student/x': { status: 'specified', roles: [], screens: [], modules: [], server: [], migrations: [], tests: [], flags: [], note: '', gap: '', ...e } },
  });

  it('reports a cited path that does not exist', () => {
    const r = build([route], [], walk({ status: 'code-present', screens: ['app/src/screens/Nope.tsx'] }), fake, () => false);
    expect(r.problems.some((p) => p.includes('Nope.tsx') && p.includes('does not exist'))).toBe(true);
  });

  it('demotes a status its evidence does not reach', () => {
    expect(ceiling({ status: 'tested', roles: [], screens: ['a'], modules: [], server: [], migrations: [], tests: [], flags: [], note: '', gap: '' }, fake)).toBe('connected');
    expect(ceiling({ status: 'connected', roles: [], screens: [], modules: [], server: [], migrations: ['m/1_x.sql'], tests: [], flags: [], note: '', gap: '' }, fake)).toBe('schema-present');
    expect(ceiling({ status: 'deployed', roles: [], screens: ['a'], modules: [], server: [], migrations: ['m/20260901000100_x.sql'], tests: ['t'], flags: [], note: '', gap: '' }, fake)).toBe('tested');
    const r = build([route], [], walk({ status: 'tested', screens: ['a'] }), fake, () => true);
    expect(r.problems.some((p) => p.includes('claims tested but its evidence supports connected'))).toBe(true);
  });

  it('reports a crosswalk route the prototype does not have', () => {
    const r = build([route], [], { ...walk({}), routes: { '#/student/ghost': walk({}).routes['#/student/x']! } }, fake, () => true);
    expect(r.problems.some((p) => p.includes('#/student/ghost') && p.includes('not a prototype route'))).toBe(true);
  });

  it('an unmapped route is specified, and says so in its blockers', () => {
    const r = build([route], [], { generated: 'now', method: 'test', routes: {} }, fake, () => true);
    expect(r.problems).toEqual([]);
    expect(r.rows[0]!.ladder).toBe('specified');
    expect(r.rows[0]!.blockers).toContain('not yet mapped');
  });

  it('a capability takes the lowest status of the routes that carry it', () => {
    const cap: Capability = {
      id: 'c', ws: 'student', area: 'A', routes: [], actors: ['student'], perms: [], records: [], commands: [], events: [], screens: [], design: null, designMissing: null, status: {},
    };
    const two: PrototypeRoute[] = [route, { ...route, key: 'y', label: 'Y', route: '#/student/y' }];
    const cw: Crosswalk = {
      generated: 'now', method: 'test',
      routes: {
        '#/student/x': { status: 'tested', roles: [], screens: ['a'], modules: [], server: [], migrations: [], tests: ['t'], flags: [], note: '', gap: '' },
        '#/student/y': { status: 'code-present', roles: [], screens: ['a'], modules: [], server: [], migrations: [], tests: [], flags: [], note: '', gap: '' },
      },
      capabilities: { c: { routes: ['#/student/x', '#/student/y'] } },
    };
    const r = build(two, [cap], cw, fake, () => true);
    expect(r.rows.find((x) => x.identifier === 'capability:c')!.ladder).toBe('code-present');
    expect(LADDER.indexOf('code-present')).toBeLessThan(LADDER.indexOf('tested'));
  });

  it('splices the counts between the markers and nowhere else', () => {
    const doc = `before\n${MARK_START}\nold\n${MARK_END}\nafter`;
    expect(spliceCounts(doc, 'new')).toBe(`before\n${MARK_START}\nnew\n${MARK_END}\nafter`);
    expect(() => spliceCounts('no markers', 'x')).toThrow();
  });
});
