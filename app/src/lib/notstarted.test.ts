import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyReview, unitMastery, type Reviews } from './review';
import { nextStep } from './nextstep';

/**
 * A course nobody has opened does not get a mastery figure.
 *
 * `unitMastery` blends what has been answered with what the guide declared,
 * and the declared figure stands in for every card not answered yet — which,
 * before the first answer, is all of them. That is right for what it was built
 * for: it keeps a part-answered course moving by exactly one card's worth per
 * answer, rather than lurching from nothing to a hundred per cent.
 *
 * It is wrong at one end of its own range. Measured in the browser on the
 * semester the app ships with, on a device that had answered nothing:
 *
 *     CORE 2500     6 units · 65 cards
 *     49% MASTERED · 65 UNSEEN
 *     Nothing answered in this course yet.
 *
 * Three lines apart, on one card, from the same state. Every card unseen and
 * a meter half full — and the half-full one is the number a person uses to
 * decide what to revise, which is the whole job of that screen.
 *
 * The fix is deliberately not in `unitMastery`: the blend is read by the
 * assistant, by the revise ranking and by search, and changing what it returns
 * would change all four for a case only one of them draws wrongly. The screen
 * already knows — it computes `started` and uses it two lines below — so the
 * screen is where it is said.
 */

const study = readFileSync('src/screens/Study.tsx', 'utf8');

describe('the blend at the end of its range', () => {
  it('is the guide’s own figure when nothing has been answered', () => {
    // Not a complaint about `unitMastery` — a record of why the screen cannot
    // treat what it returns as measured.
    expect(unitMastery(['a', 'b'], {}, 49, Date.now())).toBe(49);
  });

  it('moves off it as answers arrive', () => {
    const now = Date.now();
    // One card answered right three times running, and not due for a week.
    const reviews: Reviews = {
      a: { ...emptyReview(now), right: 3, streak: 3, interval: 7, seen: now, due: now + 7 * 86_400_000 },
    };
    expect(unitMastery(['a', 'b'], reviews, 49, now)).toBeGreaterThan(49);
  });
});

describe('what the card says before the first answer', () => {
  it('says the course is not started rather than a percentage', () => {
    expect(study).toContain("started ? `${g.mastery}% mastered` : 'Not started'");
  });

  it('draws the meter at nothing rather than at the estimate', () => {
    expect(study).toMatch(/pct=\{started \? g\.mastery : 0\}/);
  });

  it('still gives the figure once there is something behind it', () => {
    // The fix is the unmeasured case only. A course being answered keeps the
    // number that is now partly its own.
    expect(study).toContain('g.mastery');
  });
});

describe('the sentence it used to contradict', () => {
  it('is still the recommendation on the same card', () => {
    const step = nextStep({
      ways: [{ id: 'read', label: 'Start reading' }],
      guide: { units: [{ name: 'One', cards: [{ q: 'q', a: 'a' }], mastery: 49 }] } as never,
      due: 0,
      testIn: null,
      testKind: null,
      started: false,
    });
    expect(step?.why).toBe('Nothing answered in this course yet.');
  });
});

describe('the advice beside the next exam', () => {
  it('does not rank units by a figure nobody has earned', () => {
    // The week of an exam this sentence says what to drill. Ranked on the
    // blend, it said "4 are cold — drill those first" for a course never
    // opened, and — where the declared figures all sit above the line —
    // "all 11 units are above 40%, keep them warm" about units nobody had
    // seen. The second would cost somebody a grade.
    expect(study).toContain('none of them answered yet');
    expect(study).toMatch(/if \(!anyAnswered\(keys, state\.reviews\)\)/);
  });

  it('still says which are cold once some are', () => {
    expect(study).toContain('are above 40%. Keep them warm.');
    expect(study).toContain('Drill those first.');
  });
});
