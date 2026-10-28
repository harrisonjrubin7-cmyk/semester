import { test, eq } from './harness';
import { nextMeeting, countLabel, widget } from '../src/lib/facultyTodayRules';

const at = (s: string) => new Date(s);
test('next meeting: later today, in progress, or the next listed day', () => {
  // Wed 28 Oct 2026 08:00 local
  const r = nextMeeting('Tue/Thu 09:30-10:45', at('2026-10-28T08:00:00'))!;
  eq([r.start.getDate(), r.start.getHours(), r.start.getMinutes(), r.inProgress], [29, 9, 30, false]);
  const now = nextMeeting('Mon/Wed 07:30-08:45', at('2026-10-28T08:00:00'))!;
  eq([now.start.getDate(), now.inProgress], [28, true]);
  const after = nextMeeting('Mon/Wed 07:30-08:45', at('2026-10-28T09:00:00'))!;
  eq([after.start.getDate(), after.start.getDay()], [2, 1]);
});
test('a meeting pattern that does not parse gives no next class (control)', () => {
  eq(nextMeeting('TBA', at('2026-10-28T08:00:00')), null);
  eq(nextMeeting('', at('2026-10-28T08:00:00')), null);
});
test('a count is shown only when its data loaded; failures show a dash, never 0', () => {
  eq(countLabel({ state: 'ok', data: { count: 0 } }), '0');
  eq(countLabel({ state: 'unavailable', reason: 'x' }), '—');
  eq(countLabel({ state: 'denied', reason: 'x' }), '—');
  eq(countLabel(undefined, true), '…');
});
test('one failing widget is isolated and classified', async () => {
  eq(await widget(async () => 3), { state: 'ok', data: 3 });
  eq((await widget(async () => { throw Object.assign(new Error('authz:role:x:1'), { userFacingMessage: 'Your role does not allow this.' }); })).state, 'denied');
  eq((await widget(async () => { throw new Error('relation "dsa_acks" does not exist'); })).state, 'unavailable');
});
