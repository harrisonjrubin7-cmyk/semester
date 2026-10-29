import { test, eq } from './harness';
import { communityHealth, median } from '../src/lib/communityHealth';

const now = Date.parse('2026-10-29T12:00:00Z');
const ago = (d: number) => new Date(now - d * 86400000).toISOString();
const posts = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, sender: i % 2 ? 'a' : 'b', sentAt: ago(i) }));

test('median of odd and even lists', () => eq([median([3, 1, 2]), median([1, 2, 3, 4]), median([])], [2, 2.5, null]));
test('activity counts only the last 30 days', () => eq(communityHealth(5, [...posts, { id: 'old', sender: 'c', sentAt: ago(40) }], [], new Set(), now).posts30, 10));
test('distinct posters', () => eq(communityHealth(5, posts, [], new Set(), now).posters30, 2));
test('reports on other groups are ignored', () => eq(communityHealth(5, posts, [{ messageId: 'elsewhere', createdAt: ago(1), decidedAt: null, state: 'open' }], new Set(), now).openReports, 0));
test('decision speed and flags', () => {
  const reps = [{ messageId: 'p1', createdAt: ago(5), decidedAt: ago(1), state: 'decided' }, { messageId: 'p2', createdAt: ago(2), decidedAt: null, state: 'open' }];
  const h = communityHealth(5, posts, reps, new Set(['p1']), now);
  eq([h.reports30, h.openReports, h.medianHoursToDecision, h.hiddenNow, h.flags.includes('1 in 5 recent posts reported'), h.flags.includes('Reports take over 3 days to decide')], [2, 1, 96, 1, true, true]);
});
test('a quiet community is flagged', () => eq(communityHealth(5, [], [], new Set(), now).flags, ['No posts in 30 days']));
