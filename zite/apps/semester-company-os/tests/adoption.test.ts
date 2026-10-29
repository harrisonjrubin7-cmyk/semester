import { test, eq } from './harness';
import { adoption, show } from '../src/lib/adoption';

const M = (status: string, ...roles: string[]) => ({ status, roles });

test('counts of 1 to 4 are suppressed; zero and 5+ are shown', () => eq([show(0), show(1), show(4), show(5)], [0, 'fewer than 5', 'fewer than 5', 5]));
test('active members by role, each person once per role, small roles suppressed', () => {
  const a = adoption([...Array(6)].map(() => M('Active', 'Student', 'Student')).concat([M('Active', 'Faculty'), M('Pending', 'Faculty'), M('Suspended', 'Student')]), [], [], '2026-10-29');
  eq([a.activeMembers, a.pending, a.byRole], [7, 'fewer than 5', [{ role: 'Student', members: 6 }, { role: 'Faculty', members: 'fewer than 5' }]]);
});
test('usage compares the last 30 days with the 30 before, ignoring older and future days', () => {
  const a = adoption([], ['ai_assistant'], [
    { module: 'ai_assistant', day: '2026-10-28', calls: 40 }, { module: 'ai_assistant', day: '2026-09-20', calls: 20 },
    { module: 'ai_assistant', day: '2026-07-01', calls: 999 }, { module: 'ai_assistant', day: '2026-11-02', calls: 999 },
    { module: 'research_partners', day: '2026-10-10', calls: 3 }], '2026-10-29');
  eq(a.usage, [{ module: 'ai_assistant', last30: 40, prior30: 20, trend: 'up' }, { module: 'research_partners', last30: 3, prior30: 0, trend: 'new' }]);
});
test('no person appears in the output', () => {
  const a = adoption([M('Active', 'Student')], [], [], '2026-10-29');
  eq(Object.keys(a).sort(), ['activeMembers', 'byRole', 'modulesOn', 'pending', 'usage']);
});
