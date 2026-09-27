// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EMPTY_PREFERENCES, explain, rankItem } from './feed';
import { communityPage, loadPreferences, savePreferences, toFeedItem } from './feedview';
import type { CommunityRow, PostRow } from './client';

const now = new Date('2026-09-27T12:00:00Z');
const course: CommunityRow = {
  id: 'c1',
  kind: 'course',
  name: 'ECON 1010',
  purpose: '',
  verification: 'faculty_approved',
  integrityPolicy: '',
  pseudonymityApproved: false,
  role: 'member',
};
const group: CommunityRow = { ...course, id: 'g1', kind: 'study_group', name: 'Study group' };

function post(id: string, patch: Partial<PostRow> = {}): PostRow {
  return {
    id,
    communityId: 'c1',
    authorRef: 'ref1',
    authorName: 'Jordan',
    body: 'A post',
    label: 'student_created',
    status: 'published',
    asAlias: false,
    media: null,
    createdAt: '2026-09-27T10:00:00Z',
    editedAt: null,
    mine: false,
    ...patch,
  };
}

describe('toFeedItem', () => {
  it('computes signals only from membership, course, recency and source', () => {
    const item = toFeedItem(post('a'), course, now);
    expect(item.signals).toEqual({ pathOrCourse: 1, time: expect.closeTo(1 - 2 / 168, 5), explicitFollow: 1, verifiedSource: 0, preference: 0 });
    // The adapter never smuggles in anything the ranker refuses.
    expect(() => rankItem(item)).not.toThrow();
  });

  it('explains itself in words', () => {
    const { reasons } = explain(toFeedItem(post('a', { label: 'faculty_approved' }), course, now));
    expect(reasons).toContain('It’s in one of your course communities.');
    expect(reasons).toContain('You joined ECON 1010.');
  });

  it('a study group is not a course', () => {
    expect(toFeedItem(post('a', { communityId: 'g1' }), group, now).signals.pathOrCourse).toBe(0);
  });

  it('maps every post status onto a moderation state the feed understands', () => {
    expect(toFeedItem(post('a', { status: 'held' }), course, now).moderation).toBe('held');
    expect(toFeedItem(post('a', { status: 'pending' }), course, now).moderation).toBe('under_review');
    expect(toFeedItem(post('a', { status: 'withdrawn' }), course, now).moderation).toBe('removed');
  });
});

describe('communityPage', () => {
  it('leaves out your own posts, which are listed separately', () => {
    const page = communityPage([post('a'), post('b', { mine: true })], course, EMPTY_PREFERENCES, now);
    expect(page.items.map((i) => i.item.id)).toEqual(['a']);
  });

  it('drops held and removed posts, and muted authors', () => {
    const posts = [post('a'), post('b', { status: 'held' }), post('c', { status: 'removed' }), post('d', { authorRef: 'muted' })];
    const page = communityPage(posts, course, { ...EMPTY_PREFERENCES, mutedRefs: ['muted'] }, now);
    expect(page.items.map((i) => i.item.id)).toEqual(['a']);
  });

  it('is at most twenty long', () => {
    const posts = Array.from({ length: 50 }, (_, i) => post(`p${i}`));
    expect(communityPage(posts, course, EMPTY_PREFERENCES, now).items).toHaveLength(20);
  });
});

describe('preferences', () => {
  afterEach(() => globalThis.localStorage?.clear());

  it('round-trips the device-local parts only', () => {
    savePreferences({ ...EMPTY_PREFERENCES, hiddenItems: ['x'], mode: 'chronological', blockedRefs: ['b'], mutedRefs: ['m'] });
    const back = loadPreferences();
    expect(back.hiddenItems).toEqual(['x']);
    expect(back.mode).toBe('chronological');
    expect(back.blockedRefs).toEqual([]);
    expect(back.mutedRefs).toEqual([]);
  });

  it('survives garbage', () => {
    globalThis.localStorage?.setItem('semester.community-feed.v1', '{"hiddenItems":[1,"a"],"mode":"loud","showLess":{"c":99}}');
    expect(loadPreferences()).toMatchObject({ hiddenItems: ['a'], mode: 'personalized', showLess: {} });
    globalThis.localStorage?.setItem('semester.community-feed.v1', 'not json');
    expect(loadPreferences()).toEqual(EMPTY_PREFERENCES);
  });
});
