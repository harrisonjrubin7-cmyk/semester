import { test, eq } from './harness';
import { validateSlots, expand, bookBlocker, cancelBlocker, markBlocker } from '../src/lib/aptRules';

const now = Date.parse('2026-10-26T12:00:00Z');
const ok = { kind: 'Office hours' as const, startsAt: '2026-10-27T15:00:00Z', minutes: 15, capacity: 1, weeks: 4, location: 'Room 210', sectionId: 'S1' };
test('a valid draft passes (control)', () => { eq(validateSlots(ok, now), null); eq(validateSlots({ ...ok, kind: 'Advising', sectionId: null }, now), null); });
test('invalid drafts are refused', () => {
  for (const bad of [{ startsAt: 'x' }, { startsAt: '2026-10-26T12:01:00Z' }, { startsAt: '2027-06-01T12:00:00Z' }, { minutes: 4 }, { minutes: 241 }, { capacity: 0 },
    { capacity: 51 }, { weeks: 0 }, { weeks: 17 }, { location: ' ' }, { sectionId: null }, { kind: 'Advising' as const }])
    eq(typeof validateSlots({ ...ok, ...bad }, now), 'string');
});
test('weekly repeats keep length', () => {
  const s = expand('2026-10-27T15:00:00Z', 15, 3);
  eq(s.length, 3); eq(s[2].start, '2026-11-10T15:00:00.000Z'); eq(s[0].end, '2026-10-27T15:15:00.000Z');
});
const slot = { start: '2026-10-27T15:00:00Z', end: '2026-10-27T15:15:00Z', capacity: 2, booked: 1, cancelled: false };
test('booking: open, eligible, free slot passes (control)', () => { eq(bookBlocker(slot, [], now, true), null); eq(bookBlocker(slot, [{ start: '2026-10-27T15:15:00Z', end: '2026-10-27T16:00:00Z' }], now, true), null); });
test('booking refusals', () => {
  eq(typeof bookBlocker(slot, [], now, false), 'string');
  eq(typeof bookBlocker({ ...slot, cancelled: true }, [], now, true), 'string');
  eq(typeof bookBlocker({ ...slot, booked: 2 }, [], now, true), 'string');
  eq(typeof bookBlocker(slot, [], Date.parse('2026-10-27T15:00:00Z'), true), 'string');
  eq(typeof bookBlocker(slot, [{ start: '2026-10-27T15:10:00Z', end: '2026-10-27T15:40:00Z' }], now, true), 'string');
});
test('cancel only before start; attendance only after', () => {
  eq(cancelBlocker(slot.start, now), null); eq(typeof cancelBlocker(slot.start, Date.parse(slot.start)), 'string');
  eq(typeof markBlocker(slot.start, now), 'string'); eq(markBlocker(slot.start, Date.parse(slot.start) + 1), null);
});
