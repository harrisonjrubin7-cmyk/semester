import fs from 'fs';
import path from 'path';
import { test, eq } from './harness';
import { latencyCheck, guardCheck, coverageCheck, deadTupleCheck, longQueryCheck, overall } from '../src/lib/healthRules';
import { scan } from '../src/lib/schemaScan';
import { GUARD_MANIFEST } from '../src/lib/guardManifest';

const G = (table: string, trigger: string) => ({ table, trigger, timing: 'BEFORE', events: 'UPDATE OR DELETE OR TRUNCATE' });

test('latency: median judged against thresholds; no answer fails', () => {
  eq(latencyCheck([40, 900, 50], null).status, 'ok');
  eq(latencyCheck([400, 350, 310], null).status, 'warn');
  eq(latencyCheck([2000, 1600, 1700], null).status, 'fail');
  eq(latencyCheck([], 'ECONNREFUSED').status, 'fail');
});
test('guards: a declared trigger missing on an existing table fails; unused modules do not', () => {
  const guards = [G('a_events', 'a_ao'), G('b_events', 'b_ao'), G('c_events', 'c_ao')];
  const r = guardCheck(guards, new Set(['a_events', 'b_events']), new Set(['a_events.a_ao']));
  eq([r.status, r.missing], ['fail', ['b_events.b_ao']]);
  const ok = guardCheck(guards, new Set(['a_events']), new Set(['a_events.a_ao']));
  eq([ok.status, ok.missing.length], ['ok', 0]);
});
test('guards: a same-named trigger on a different table does not count', () => {
  eq(guardCheck([G('a_events', 'ao')], new Set(['a_events']), new Set(['b_events.ao'])).status, 'fail');
});
test('coverage is information only', () => eq(coverageCheck(['x', 'y'], new Set(['x'])).status, 'info'));
test('bloat warns only for large tables that are mostly dead rows', () => {
  eq(deadTupleCheck([{ table: 't', live: 100, dead: 900 }]).status, 'ok');
  eq(deadTupleCheck([{ table: 't', live: 4000, dead: 9000 }]).status, 'warn');
});
test('long queries: hidden sessions are reported as not measured, not as healthy', () => {
  eq(longQueryCheck([], false).status, 'info');
  eq(longQueryCheck([10, 400], true).status, 'warn');
});
test('overall: any fail fails, then any warn; info never raises it', () => {
  eq(overall([{ key: 'a', label: '', status: 'info', detail: '' }, { key: 'b', label: '', status: 'ok', detail: '' }]), 'ok');
  eq(overall([{ key: 'a', label: '', status: 'warn', detail: '' }, { key: 'b', label: '', status: 'fail', detail: '' }]), 'fail');
});
test('the guard manifest matches the migration code (regenerate with scripts/genGuardManifest.mjs)', () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && p.includes(`${path.sep}src${path.sep}`) && !p.endsWith('guardManifest.ts')) files.push(p);
  } };
  for (const a of fs.readdirSync('apps')) if (fs.existsSync(path.join('apps', a, 'src'))) walk(path.join('apps', a, 'src'));
  const live = scan(files.sort().map((f) => fs.readFileSync(f, 'utf8')));
  eq([live.tables.length, live.guards.length], [GUARD_MANIFEST.tables.length, GUARD_MANIFEST.guards.length]);
  eq(JSON.stringify(live), JSON.stringify(GUARD_MANIFEST));
});
