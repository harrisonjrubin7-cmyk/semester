import { describe, expect, it } from 'vitest';
import { present } from './envelope';
import { calendarEnvelope, countSources, itemSources, sourceMixLine, tasksEnvelope, todayEnvelope, type SurfaceInput } from './surfaces';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const base = (over: Partial<SurfaceInput> = {}): SurfaceInput => ({
  loading: false,
  empty: false,
  count: 3,
  sources: { imported: 2, needs_review: 1 },
  online: true,
  now: NOW,
  ...over,
});
const surface = (env: ReturnType<typeof todayEnvelope>) => present(env, NOW);

describe('loading', () => {
  it('stands in for empty — the moment before the sample lands is not "nothing yet"', () => {
    expect(surface(todayEnvelope(base({ loading: true, empty: true, count: 0, sources: {} }))).surface).toBe('loading');
    // Control: the same empty screen, loaded, is empty.
    expect(surface(todayEnvelope(base({ loading: false, empty: true, count: 0, sources: {} }))).surface).toBe('empty');
  });

  it('never replaces content: somebody who has things keeps them while the sample arrives', () => {
    expect(surface(todayEnvelope(base({ loading: true, empty: false }))).surface).toBe('content');
    expect(surface(tasksEnvelope(base({ loading: true, empty: false }))).surface).toBe('content');
  });
});

describe('each screen keeps its own empty rule', () => {
  it('empty is exactly what the caller says, whatever the count', () => {
    expect(surface(todayEnvelope(base({ empty: true, count: 5 }))).surface).toBe('empty');
    expect(surface(calendarEnvelope({ ...base({ empty: false, count: 0 }), hasCampusFeed: false })).surface).toBe('content');
  });
});

describe('sources', () => {
  it('say what the content rests on, in the app’s own words', () => {
    expect(sourceMixLine({ imported: 2, needs_review: 1, student_entered: 3 })).toBe('Sources: 2 imported, 3 student entered, 1 needs review.');
    expect(sourceMixLine({})).toBeNull();
  });

  it('a date not checked against a syllabus is called out, and a checked one is not', () => {
    expect(itemSources([{ checked: { confirmed: true } }, { checked: { confirmed: false } }, {}])).toEqual(['imported', 'needs_review', 'needs_review']);
    const withReview = surface(todayEnvelope(base()));
    expect(withReview.limitations.join(' ')).toMatch(/needs review.*not been checked/);
    // Control: nothing unchecked, no warning.
    const clean = surface(todayEnvelope(base({ sources: { imported: 3 } })));
    expect(clean.limitations.join(' ')).not.toMatch(/not been checked/);
  });

  it('one kind of source is that kind; several are "mixed", which draws no single badge', () => {
    expect(tasksEnvelope(base({ sources: countSources(['student_entered', 'student_entered']) })).source.kind).toBe('student_entered');
    expect(todayEnvelope(base()).source.kind).toBe('mixed');
  });

  it('are never institution-verified for device-derived surfaces', () => {
    for (const env of [todayEnvelope(base()), tasksEnvelope(base()), calendarEnvelope({ ...base(), hasCampusFeed: true })]) {
      expect(['derived', 'student']).toContain(env.authority);
      expect(env.state).not.toBe('verified');
    }
  });
});

describe('offline', () => {
  it('only the calendar’s campus feed makes a screen offline — local screens stay content', () => {
    expect(surface(todayEnvelope(base({ online: false }))).surface).toBe('content');
    expect(surface(tasksEnvelope(base({ online: false }))).surface).toBe('content');
    const cal = surface(calendarEnvelope({ ...base({ online: false }), hasCampusFeed: true }));
    expect(cal.surface).toBe('offline');
    expect(cal.limitations[0]).toMatch(/Campus events can’t refresh/);
  });

  it('a calendar with no campus feed has nothing to say offline (control)', () => {
    expect(surface(calendarEnvelope({ ...base({ online: false }), hasCampusFeed: false })).surface).toBe('content');
  });

  it('a calendar online, with a feed, is plain content (control)', () => {
    expect(surface(calendarEnvelope({ ...base(), hasCampusFeed: true })).surface).toBe('content');
  });
});
