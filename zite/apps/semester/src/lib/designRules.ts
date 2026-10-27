// Instructional design (S-76 E04). Pure rules mirrored by lib/idnMigration.ts (the database is the authority).
export type Review = { draftId: number; kind: 'accessibility' | 'quality'; passed: boolean; at: string };

/** The latest review of each kind for one draft decides; older drafts' reviews never count. */
export function reviewStatus(reviews: Review[], draftId: number) {
  const last = (k: Review['kind']) => reviews.filter((r) => r.draftId === draftId && r.kind === k).sort((a, b) => b.at.localeCompare(a.at))[0];
  const a = last('accessibility'), q = last('quality');
  return { accessibility: a ? (a.passed ? 'passed' : 'changes') : 'pending', quality: q ? (q.passed ? 'passed' : 'changes') : 'pending' } as const;
}

export function approvalBlocker(p: { instructor: boolean; latestDraftId: number | null; draftId: number; reviews: Review[] }): string | null {
  if (!p.instructor) return 'Only an instructor of this section approves publication.';
  if (p.latestDraftId !== p.draftId) return 'Approve the latest draft.';
  const s = reviewStatus(p.reviews, p.draftId);
  if (s.accessibility !== 'passed' || s.quality !== 'passed') return 'This draft needs passing accessibility and quality reviews first.';
  return null;
}

export const reviewerBlocker = (p: { designer: boolean; reviewer: string; author: string }) =>
  !p.designer ? 'Only an instructional designer records accessibility and quality reviews.' : p.reviewer === p.author ? "Someone other than the draft's author reviews it." : null;

export const STAGE: Record<string, string> = { requested: 'Requested — waiting for a designer', scoped: 'Scoped — designer assigned', building: 'Building', in_review: 'In review', approved: 'Approved by faculty — ready to publish', released: 'Published', closed: 'Closed' };
