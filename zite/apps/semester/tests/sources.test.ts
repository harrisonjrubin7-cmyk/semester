import { test, eq } from './harness';
import { sourceState, sisBlock, reconcile, SourceInput } from '../src/lib/sources';

const now = new Date('2026-10-23T12:00:00Z');
const s = (o: Partial<SourceInput> = {}): SourceInput => ({ name: 'Banner SIS', connector: 'SIS', enabled: true, authorized: true, syncStatus: 'Synced', lastSyncedAt: '2026-10-23T06:00:00Z', ...o });

test('recent SIS sync is fresh and does not block', () => {
  const v = sourceState(s(), now); eq(v.state, 'Fresh'); eq(sisBlock([v]), null);
});
test('SIS older than 24h is stale and blocks', () => {
  const v = sourceState(s({ lastSyncedAt: '2026-10-21T12:00:00Z' }), now); eq(v.state, 'Stale'); eq(typeof sisBlock([v]), 'string');
});
test('never-synced SIS is stale', () => eq(sourceState(s({ lastSyncedAt: null }), now).state, 'Stale'));
test('sync error blocks', () => eq(typeof sisBlock([sourceState(s({ syncStatus: 'Sync Error' }), now)]), 'string'));
test('enabled but not institution-authorized is unusable and blocks', () => {
  const v = sourceState(s({ authorized: false }), now); eq(v.state, 'Unauthorized'); eq(typeof sisBlock([v]), 'string');
});
test('disabled SIS does not block (no official feed)', () => eq(sisBlock([sourceState(s({ enabled: false }), now)]), null));
test('stale LMS does not block registrar commands', () => eq(sisBlock([sourceState(s({ connector: 'LMS', lastSyncedAt: null }), now)]), null));
test('reconcile flags count mismatches only', () => {
  const r = reconcile([{ sectionId: 'a', label: 'A', zite: 3, ledger: 3 }, { sectionId: 'b', label: 'B', zite: 2, ledger: 1 }]);
  eq(r.ok, false); eq(r.mismatches.map((m) => m.sectionId), ['b']);
});
