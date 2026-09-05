import { describe, expect, it } from 'vitest';
import {
  KEEP_DAYS,
  KEPT_LINE,
  LEAVING,
  MOST_BYTES,
  MOST_ONE,
  draftKey,
  readDrafts,
  restoredLine,
  withDraft,
  withoutDraft,
  type Drafts,
} from './draft';

const now = new Date(2026, 8, 5, 14, 0, 0).getTime();
const ago = (hours: number) => now - hours * 3_600_000;

describe('where a draft is filed', () => {
  it('is keyed by screen and field, so two screens do not collide', () => {
    expect(draftKey('essay', 'draft')).toBe('essay:draft');
    expect(draftKey('essay', 'draft')).not.toBe(draftKey('mail', 'draft'));
  });

  it('can belong to one course rather than to the screen', () => {
    expect(draftKey('solve', 'work', 'econ')).toBe('solve:work:econ');
    expect(draftKey('solve', 'work', 'econ')).not.toBe(draftKey('solve', 'work', 'psci'));
  });
});

describe('reading them back', () => {
  it('takes a good set', () => {
    const raw = JSON.stringify({ 'essay:draft': { text: 'hello', at: 5 } });
    expect(readDrafts(raw)).toEqual({ 'essay:draft': { text: 'hello', at: 5 } });
  });

  it('is unbothered by nothing, by nonsense and by the wrong shape', () => {
    expect(readDrafts(null)).toEqual({});
    expect(readDrafts('not json')).toEqual({});
    expect(readDrafts('[1,2]')).toEqual({});
    expect(readDrafts('"a string"')).toEqual({});
  });

  it('drops a row that is not a draft, keeping the ones that are', () => {
    const raw = JSON.stringify({
      good: { text: 'x', at: 1 },
      noAt: { text: 'x' },
      notText: { text: 12, at: 1 },
      nothing: null,
    });
    expect(Object.keys(readDrafts(raw))).toEqual(['good']);
  });
});

describe('writing one', () => {
  it('keeps the text and when it was written', () => {
    const out = withDraft({}, 'essay:draft', 'a paragraph', now);
    expect(out['essay:draft']).toEqual({ text: 'a paragraph', at: now });
  });

  it('treats an emptied field as finished with, not as an empty draft', () => {
    // Otherwise clearing a field leaves a blank draft that comes back the
    // next time and says "picked up where you left off" about nothing.
    const had: Drafts = { 'essay:draft': { text: 'was here', at: ago(1) } };
    expect(withDraft(had, 'essay:draft', '   ', now)).toEqual({});
  });

  it('leaves other screens’ drafts alone', () => {
    const had: Drafts = { 'mail:body': { text: 'an email', at: ago(1) } };
    expect(withDraft(had, 'essay:draft', 'an essay', now)['mail:body'].text).toBe('an email');
  });

  it('sweeps out anything nobody came back to', () => {
    const had: Drafts = { old: { text: 'x', at: ago((KEEP_DAYS + 1) * 24) } };
    expect(withDraft(had, 'essay:draft', 'new', now).old).toBeUndefined();
  });

  it('caps one pasted book rather than refusing to save at all', () => {
    const huge = 'x'.repeat(MOST_ONE + 5000);
    expect(withDraft({}, 'essay:draft', huge, now)['essay:draft'].text).toHaveLength(MOST_ONE);
  });

  it('sheds the oldest to stay inside the budget, never the one being typed', () => {
    // The account's storage comes first — `lib/keep.ts` exists because it runs
    // out — and the person typing right now is the least willing to lose
    // anything.
    const had: Drafts = {
      a: { text: 'x'.repeat(MOST_ONE), at: ago(50) },
      b: { text: 'x'.repeat(MOST_ONE), at: ago(20) },
      c: { text: 'x'.repeat(MOST_ONE), at: ago(2) },
    };
    const out = withDraft(had, 'mine', 'x'.repeat(MOST_ONE), now);
    expect(out.mine).toBeDefined();
    expect(Object.entries(out).reduce((n, [k, d]) => n + (k.length + d.text.length) * 2, 0))
      .toBeLessThanOrEqual(MOST_BYTES);
    // And it dropped the oldest first.
    expect(out.a).toBeUndefined();
  });

  it('forgets one on request, and does not mind if it was never there', () => {
    expect(withoutDraft({ a: { text: 'x', at: 1 } }, 'a')).toEqual({});
    expect(withoutDraft({}, 'a')).toEqual({});
  });
});

describe('what it says', () => {
  it('says where text came from rather than filling a field silently', () => {
    // Text appearing on a screen somebody thought was blank is unsettling in
    // a way that is worth one line to avoid.
    expect(restoredLine(ago(0.01), new Date(now))).toBe('Picked up where you left off.');
    expect(restoredLine(ago(0.5), new Date(now))).toContain('30 minutes ago');
    expect(restoredLine(ago(3), new Date(now))).toContain('3 hours ago');
    expect(restoredLine(ago(30), new Date(now))).toContain('1 day ago');
  });

  it('says a draft is local, so nobody expects it on their laptop', () => {
    expect(KEPT_LINE).toContain('this device');
    expect(KEPT_LINE).toContain('not synced');
  });

  it('has one place saying what the leaving guard is for', () => {
    expect(LEAVING).toContain('not been saved');
  });
});
