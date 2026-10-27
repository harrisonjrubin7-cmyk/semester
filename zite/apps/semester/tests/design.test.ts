import { test, eq } from './harness';
import { reviewStatus, approvalBlocker, reviewerBlocker } from '../src/lib/designRules';

const rv = (draftId: number, kind: 'accessibility' | 'quality', passed: boolean, at: string) => ({ draftId, kind, passed, at });
test('only the latest review of each kind on the same draft counts', () => {
  const r = [rv(1, 'quality', false, '2026-10-01'), rv(1, 'quality', true, '2026-10-02'), rv(2, 'accessibility', true, '2026-10-03')];
  eq(reviewStatus(r, 1).quality, 'passed');
  eq(reviewStatus(r, 1).accessibility, 'pending');
  eq(reviewStatus(r, 2).quality, 'pending');
});
test('approval needs instructor, latest draft, both reviews passed', () => {
  const both = [rv(3, 'accessibility', true, 'a'), rv(3, 'quality', true, 'b')];
  eq(approvalBlocker({ instructor: true, latestDraftId: 3, draftId: 3, reviews: both }), null);
  eq(approvalBlocker({ instructor: false, latestDraftId: 3, draftId: 3, reviews: both }) !== null, true);
  eq(approvalBlocker({ instructor: true, latestDraftId: 4, draftId: 3, reviews: both }), 'Approve the latest draft.');
  eq(approvalBlocker({ instructor: true, latestDraftId: 3, draftId: 3, reviews: [both[0]] }) !== null, true);
});
test('reviewers are designers other than the author', () => {
  eq(reviewerBlocker({ designer: true, reviewer: 'a', author: 'b' }), null);
  eq(reviewerBlocker({ designer: true, reviewer: 'a', author: 'a' }) !== null, true);
  eq(reviewerBlocker({ designer: false, reviewer: 'a', author: 'b' }) !== null, true);
});
