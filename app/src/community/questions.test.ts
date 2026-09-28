import { describe, expect, it } from 'vitest';
import { SOURCE_LABELS } from '../lib/source';
import { ANSWER_KINDS, REVIEW_DAYS, SCOPES, STALE_REPORTS_TO_REVIEW, STATUSES, arrange, claim, fromOffice, labelLine, reportOutdated, rereview, statusOf, unclaimed, verify, type Answer } from './questions';

const TODAY = '2026-09-28';
const answer = (over: Partial<Answer> = {}): Answer => ({ id: 'a', questionId: 'q', kind: 'student_experience', body: 'Book it at the desk on the second floor.', office: null, confirmation: null, link: null, reviewedOn: '2026-09-01', status: 'current', staleReports: 0, ...over });

describe('labels', () => {
  it('five answer kinds, four scopes, three statuses', () => {
    expect(ANSWER_KINDS.map((k) => k.kind)).toEqual(['institution_verified', 'office_owner', 'student_experience', 'official_link', 'needs_review']);
    expect(SCOPES).toEqual(['campus', 'course', 'club', 'private']);
    expect(STATUSES).toEqual(['current', 'needs_review', 'archived']);
  });

  it('uses the source vocabulary the rest of the app uses for the institution\'s label', () => {
    expect(SOURCE_LABELS).toContain('institution_verified');
    expect(SOURCE_LABELS).toContain('needs_review');
  });

  it('the label line says kind, office, date and status in words', () => {
    expect(labelLine(answer(), TODAY)).toBe('A student\'s experience · reviewed 2026-09-01');
    const v = verify(answer(), 'Library', 'Room booking policy 2026', TODAY);
    if (v.ok) expect(labelLine(v.answer, TODAY)).toBe('Institution-verified answer · Library · reviewed 2026-09-28');
    expect(labelLine(answer({ reviewedOn: '2025-01-01' }), TODAY)).toMatch(/· needs review$/);
  });
});

describe('the institution\'s label (DO-NOT-BUILD rule 7)', () => {
  it('is applied only with the office and what it confirmed against', () => {
    expect(verify(answer(), '', 'policy', TODAY).ok).toBe(false);
    expect(verify(answer(), 'Library', '  ', TODAY).ok).toBe(false);
    const v = verify(answer({ staleReports: 3 }), 'Library', 'Room booking policy 2026', TODAY);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.answer).toMatchObject({ kind: 'institution_verified', office: 'Library', confirmation: 'Room booking policy 2026', reviewedOn: TODAY, staleReports: 0 });
  });

  it('an office answering for itself is not the institution\'s record', () => {
    expect(fromOffice(answer(), 'Library', TODAY).kind).toBe('office_owner');
  });
});

describe('freshness', () => {
  it('turns to needs_review after the window, after two stale reports, and stays archived', () => {
    expect(statusOf(answer(), TODAY)).toBe('current');
    expect(statusOf(answer({ reviewedOn: '2026-03-01' }), TODAY)).toBe('needs_review');
    expect(REVIEW_DAYS).toBe(180);
    let a = reportOutdated(answer());
    expect(statusOf(a, TODAY)).toBe('current');
    a = reportOutdated(a);
    expect(STALE_REPORTS_TO_REVIEW).toBe(2);
    expect(statusOf(a, TODAY)).toBe('needs_review');
    expect(statusOf(rereview(a, TODAY), TODAY)).toBe('current');
    expect(statusOf(answer({ status: 'archived', reviewedOn: TODAY }), TODAY)).toBe('archived');
  });
});

describe('order and claims', () => {
  it('institution first, then office, link, students — and anything needing review last whatever it is', () => {
    const out = arrange([
      answer({ id: 's' }),
      answer({ id: 'v-stale', kind: 'institution_verified', office: 'Library', confirmation: 'x', reviewedOn: '2025-01-01' }),
      answer({ id: 'o', kind: 'office_owner', office: 'Library' }),
      answer({ id: 'l', kind: 'official_link', link: 'https://x' }),
      answer({ id: 'v', kind: 'institution_verified', office: 'Library', confirmation: 'x' }),
      answer({ id: 'gone', status: 'archived' }),
    ], TODAY);
    expect(out.map((a) => a.id)).toEqual(['v', 'o', 'l', 's', 'v-stale']);
  });

  it('an office can claim a question, and the unclaimed are listed most-asked first', () => {
    const qs = [{ id: '1', text: 'Study rooms?', scope: 'campus' as const, claimedBy: null }, { id: '2', text: 'Parking?', scope: 'campus' as const, claimedBy: null }];
    expect(claim(qs[0], 'Library').claimedBy).toBe('Library');
    expect(unclaimed([claim(qs[0], 'Library'), qs[1]], () => 1).map((q) => q.id)).toEqual(['2']);
    expect(unclaimed(qs, (q) => (q.id === '2' ? 5 : 1)).map((q) => q.id)).toEqual(['2', '1']);
  });
});
