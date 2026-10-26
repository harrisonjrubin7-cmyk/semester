import { test, eq } from './harness';
import { EXPANSION_APPS, expansionSummary } from '../src/lib/expansionApps';

test('32 distinct applications, E01–E32', () => {
  eq(EXPANSION_APPS.length, 32);
  eq(new Set(EXPANSION_APPS.map((r) => r.id)).size, 32);
  eq(EXPANSION_APPS.map((r) => r.id).join(','), Array.from({ length: 32 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`).join(','));
});
test('Health Services is blocked with a named approval and reuses nothing', () => {
  const h = EXPANSION_APPS.find((r) => r.id === 'E21')!;
  eq(h.cls, 'blocked'); eq(h.reuse, 'none'); eq(!!h.blockedBy, true);
});
test('every blocked row names what unblocks it', () => {
  eq(EXPANSION_APPS.filter((r) => r.cls === 'blocked' && !r.blockedBy).length, 0);
});
test('summary adds up', () => {
  const s = expansionSummary();
  eq(s.built + s.extend + s.new + s.blocked, 32);
});
