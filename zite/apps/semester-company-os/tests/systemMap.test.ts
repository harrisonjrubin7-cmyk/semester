import { test, eq } from './harness';
import { NODES, byId, prerequisites, missingFor, STACK_AREAS, ZITE_FIT } from '../src/lib/systemMap';

test('every dependency points at a real node', () => { for (const n of NODES) for (const d of n.dependsOn) eq(!!byId[d], true); });
test('prerequisites are transitive and unique', () => {
  const p = prerequisites('advisor');
  eq(p.includes('identity') && p.includes('db') && p.includes('consent'), true);
  eq(new Set(p).size, p.length);
});
test('billing is flagged as missing transactions and webhooks', () => {
  const m = missingFor(['billing'])[0].missing.map((x) => x.id);
  eq(m.includes('transactions'), true); eq(m.includes('webhooks'), true);
});
test('files are flagged as not supported on Zite', () => eq(byId.files.verification, 'Not supported on Zite'));
test('every stack area has a verification label', () => eq(STACK_AREAS.every((a) => !!ZITE_FIT[a]?.verification), true));
test('advisor workspace has no missing prerequisites', () => eq(missingFor(['advisor'])[0].missing.length, 0));
