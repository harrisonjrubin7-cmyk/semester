import { describe, expect, it, vi, afterEach } from 'vitest';
import { nextMinute } from './store';

/**
 * The clock's bail-out.
 *
 * `useReducer` re-renders unless the reducer hands back the value it already
 * held, and the clock below the provider fires twice a minute. Before this,
 * every one of those ticks produced a fresh `Date` — so half of them published
 * a minute that had not changed, and each one re-rendered the whole app,
 * because `now` rides the single store context that 298 call sites read and
 * nothing in the app is wrapped in `React.memo`.
 *
 * So the thing worth asserting is identity, not equality: the same minute must
 * come back as the *same object*, or React cannot tell that nothing happened.
 */
describe('nextMinute', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the very same object when the minute has not moved', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T10:30:00'));
    const was = nextMinute(new Date('2026-09-14T10:30:00'));

    // Thirty seconds on — the next tick, and the same minute.
    vi.setSystemTime(new Date('2026-09-14T10:30:30'));
    expect(nextMinute(was)).toBe(was);
  });

  it('returns a new object when the minute moves', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T10:30:00'));
    const was = nextMinute(new Date('2026-09-14T10:30:00'));

    vi.setSystemTime(new Date('2026-09-14T10:31:00'));
    const then = nextMinute(was);
    expect(then).not.toBe(was);
    expect(then.getMinutes()).toBe(31);
  });

  it('drops the seconds, so a label is about the minute and not the instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T10:31:47'));
    const d = nextMinute(new Date('2026-09-14T10:30:00'));
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});
