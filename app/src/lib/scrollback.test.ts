import { beforeEach, describe, expect, it } from 'vitest';
import {
  STALE_AFTER,
  WORTH_KEEPING,
  forget,
  forgetAll,
  keep,
  opensAt,
  remembered,
} from './scrollback';

const AT = 1_788_000_000_000;
const FAR = 99_999;

beforeEach(() => forgetAll());

describe('coming back to a screen', () => {
  it('opens where you left it', () => {
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT + 5000, FAR)).toBe(1240);
  });

  it('opens at the top when you have never been', () => {
    expect(opensAt('courses', AT, FAR)).toBe(0);
  });

  it('keeps screens apart', () => {
    keep('courses', 1240, AT);
    keep('study', 300, AT);
    expect(opensAt('courses', AT, FAR)).toBe(1240);
    expect(opensAt('study', AT, FAR)).toBe(300);
  });
});

describe('what it refuses to remember', () => {
  it('does not bother with the top of a screen', () => {
    keep('courses', WORTH_KEEPING - 1, AT);
    expect(remembered('courses')).toBe(false);
  });

  it('treats scrolling back to the top as meaning it', () => {
    // Not "leave the old mark alone" — going back to the top is a deliberate
    // act and should be what you find when you return.
    keep('courses', 1240, AT);
    keep('courses', 0, AT + 1000);
    expect(opensAt('courses', AT + 2000, FAR)).toBe(0);
  });

  it('forgets on demand, which is what tapping the same tab means', () => {
    keep('courses', 1240, AT);
    forget('courses');
    expect(opensAt('courses', AT, FAR)).toBe(0);
  });
});

describe('a position that has gone stale', () => {
  it('is not used', () => {
    // Being dropped two thousand pixels into a list forty minutes later is
    // disorienting rather than helpful.
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT + STALE_AFTER + 1, FAR)).toBe(0);
  });

  it('is still good just inside the window', () => {
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT + STALE_AFTER - 1, FAR)).toBe(1240);
  });

  it('is dropped rather than left to go stale again', () => {
    keep('courses', 1240, AT);
    opensAt('courses', AT + STALE_AFTER + 1, FAR);
    expect(remembered('courses')).toBe(false);
  });
});

describe('content that moved while you were away', () => {
  it('never scrolls past what is there now', () => {
    // A list that lost four rows cannot honour a position past its own end.
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT, 600)).toBe(600);
  });

  it('opens at the top when there is nothing left to scroll', () => {
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT, 0)).toBe(0);
  });

  it('never returns a negative offset', () => {
    keep('courses', 1240, AT);
    expect(opensAt('courses', AT, -10)).toBe(0);
  });
});
