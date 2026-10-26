import { test, eq } from './harness';
import { moderationNeeded, releaseShortfall, moderatorBlocker } from '../src/lib/moderationRules';

test('sample size rounds up and off means none (control)', () => {
  eq(moderationNeeded(10, 0), 0); eq(moderationNeeded(10, 20), 2); eq(moderationNeeded(7, 20), 2); eq(moderationNeeded(3, 100), 3); eq(moderationNeeded(0, 50), 0);
});
const atts = [1, 2, 3, 4].map((id) => ({ id, state: 'graded', gradedAt: 100, gradedBy: 'G', student: `S${id}` }));
test('release needs enough current moderations', () => {
  eq(releaseShortfall(atts, [], 50), 2);
  eq(releaseShortfall(atts, [{ attemptId: 1, moderator: 'M', at: 150 }], 50), 1);
  eq(releaseShortfall(atts, [{ attemptId: 1, moderator: 'M', at: 150 }, { attemptId: 2, moderator: 'M', at: 150 }], 50), 0);
  eq(releaseShortfall(atts, [], 0), 0);
});
test('a moderation older than the latest grading does not count', () => {
  eq(releaseShortfall([{ ...atts[0], gradedAt: 200 }], [{ attemptId: 1, moderator: 'M', at: 150 }], 100), 1);
});
test('two moderations of one attempt count once', () => {
  eq(releaseShortfall(atts, [{ attemptId: 1, moderator: 'M', at: 150 }, { attemptId: 1, moderator: 'N', at: 160 }], 50), 1);
});
test('moderator must be a second person', () => {
  eq(moderatorBlocker(atts[0], 'M'), null);
  eq(typeof moderatorBlocker(atts[0], 'G'), 'string');
  eq(typeof moderatorBlocker(atts[0], 'S1'), 'string');
  eq(typeof moderatorBlocker({ ...atts[0], state: 'released' }, 'M'), 'string');
  eq(moderatorBlocker({ ...atts[0], gradedBy: null }, 'M'), null); // auto-scored: anyone but the student
});
