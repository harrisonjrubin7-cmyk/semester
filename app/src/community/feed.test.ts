import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyFeedback,
  buildFeed,
  EMPTY_PREFERENCES,
  explain,
  FORBIDDEN_SIGNALS,
  ForbiddenSignal,
  PAGE_LIMIT,
  rankItem,
  WEIGHTS,
  type FeedItem,
} from './feed';

function item(id: string, patch: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    communityId: 'psy',
    surface: 'from_your_communities',
    label: 'student_created',
    title: id,
    postedAt: '2026-09-20T00:00:00Z',
    signals: { pathOrCourse: 0, time: 0, explicitFollow: 1, verifiedSource: 0, preference: 0 },
    reasons: { explicitFollow: 'You followed Psychology Students.' },
    fatigue: 0,
    duplication: 0,
    moderation: 'clear',
    authorRef: 'm_a',
    ...patch,
  };
}

describe('rankItem', () => {
  it('weights sum to one, in the published order', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(WEIGHTS).toEqual({ pathOrCourse: 0.3, time: 0.25, explicitFollow: 0.2, verifiedSource: 0.15, preference: 0.1 });
  });

  it('computes the published formula', () => {
    const i = item('a', {
      signals: { pathOrCourse: 1, time: 0.5, explicitFollow: 1, verifiedSource: 0, preference: 1 },
      fatigue: 0.1,
    });
    expect(rankItem(i)).toBeCloseTo(0.3 + 0.125 + 0.2 + 0.1 - 0.1);
  });

  it.each(FORBIDDEN_SIGNALS.map((s) => [s]))('refuses an item carrying %s', (signal) => {
    const tainted = { ...item('a'), [signal]: 1 } as FeedItem;
    expect(() => rankItem(tainted)).toThrow(ForbiddenSignal);
  });

  it('refuses a forbidden signal nested inside signals too', () => {
    const tainted = item('a', { signals: { ...item('a').signals, distanceKm: 0.2 } as FeedItem['signals'] });
    expect(() => rankItem(tainted)).toThrow(ForbiddenSignal);
  });

  it('never imports the account safety state', () => {
    const src = readFileSync(new URL('./feed.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from '\.\/safety-state'/);
  });
});

describe('buildFeed', () => {
  it('is finite: at most PAGE_LIMIT and always the end', () => {
    const items = Array.from({ length: 60 }, (_, n) => item(`i${n}`));
    const page = buildFeed({ items, surface: 'from_your_communities', preferences: EMPTY_PREFERENCES, limit: 500 });
    expect(page.items).toHaveLength(PAGE_LIMIT);
    expect(page.end).toBe(true);
  });

  it('never recommends reported, reduced, held or removed items', () => {
    const items = [
      item('ok'),
      item('rev', { moderation: 'under_review' }),
      item('red', { moderation: 'reduced' }),
      item('held', { moderation: 'held' }),
      item('gone', { moderation: 'removed' }),
    ];
    const page = buildFeed({ items, surface: 'from_your_communities', preferences: EMPTY_PREFERENCES });
    expect(page.items.map((x) => x.item.id)).toEqual(['ok']);
  });

  it('offers a chronological order inside a community', () => {
    const items = [
      item('old', { postedAt: '2026-09-01T00:00:00Z', signals: { ...item('x').signals, pathOrCourse: 1 } }),
      item('new', { postedAt: '2026-09-25T00:00:00Z' }),
    ];
    const ranked = buildFeed({ items, surface: 'community', communityId: 'psy', preferences: EMPTY_PREFERENCES });
    const chrono = buildFeed({
      items,
      surface: 'community',
      communityId: 'psy',
      preferences: { ...EMPTY_PREFERENCES, mode: 'chronological' },
    });
    expect(ranked.items[0].item.id).toBe('old');
    expect(chrono.items[0].item.id).toBe('new');
  });

  it('drops blocked and muted authors and hidden items', () => {
    const items = [item('a', { authorRef: 'm_blocked' }), item('b', { authorRef: 'm_muted' }), item('c'), item('d')];
    const page = buildFeed({
      items,
      surface: 'from_your_communities',
      preferences: { ...EMPTY_PREFERENCES, blockedRefs: ['m_blocked'], mutedRefs: ['m_muted'], hiddenItems: ['d'] },
    });
    expect(page.items.map((x) => x.item.id)).toEqual(['c']);
  });

  it('suppresses duplicates by topic in ranked mode', () => {
    const items = [item('a', { topicKey: 't' }), item('b', { topicKey: 't' }), item('c')];
    const page = buildFeed({ items, surface: 'from_your_communities', preferences: EMPTY_PREFERENCES });
    expect(page.items.map((x) => x.item.id).sort()).toEqual(['a', 'c']);
  });
});

describe('feedback', () => {
  const a = item('a');

  it('"helpful" changes nothing about ranking or enforcement', () => {
    expect(applyFeedback(EMPTY_PREFERENCES, a, 'helpful')).toBe(EMPTY_PREFERENCES);
  });

  it('"not relevant" hides for this student only', () => {
    const prefs = applyFeedback(EMPTY_PREFERENCES, a, 'not_relevant');
    expect(prefs.hiddenItems).toEqual(['a']);
    // Another student's feed is unaffected.
    const other = buildFeed({ items: [a], surface: 'from_your_communities', preferences: EMPTY_PREFERENCES });
    expect(other.items).toHaveLength(1);
  });

  it('"show less" halves that community', () => {
    const prefs = applyFeedback(EMPTY_PREFERENCES, a, 'show_less');
    const page = buildFeed({ items: [a], surface: 'from_your_communities', preferences: prefs });
    expect(page.items[0].score).toBeCloseTo(rankItem(a) / 2);
  });
});

describe('explain', () => {
  it('lists the strongest reasons in words, and the controls', () => {
    const i = item('e', {
      signals: { pathOrCourse: 1, time: 1, explicitFollow: 1, verifiedSource: 0, preference: 0 },
      reasons: {
        pathOrCourse: 'It matches your saved undergraduate-research goal.',
        time: 'Registration closes in two days.',
        explicitFollow: 'You followed Psychology Students.',
      },
    });
    const { reasons, controls } = explain(i);
    expect(reasons).toEqual([
      'It matches your saved undergraduate-research goal.',
      'Registration closes in two days.',
      'You followed Psychology Students.',
    ]);
    expect(controls).toContain('Switch to chronological');
  });
});
