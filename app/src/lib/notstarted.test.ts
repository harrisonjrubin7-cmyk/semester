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
 *
 * ## What changed since, and why this file still has a job
 *
 * That fix covered one end of the range. After the first answer the meter went
 * back to being mostly the declared figure, and a percentage cannot say which
 * part of itself was measured — so `lib/knowing.ts` replaced the printed
 * number outright with a state read off the answers alone, and the bar beside
 * it with a count of cards holding.
 *
 * The assertions below therefore check the *stronger* property: the screens do
 * not print the blend at all, anywhere, started or not. The two tests at the
 * top are untouched and are the reason any of this is needed — they are the
 * record of what `unitMastery` returns at the bottom of its range, and they
 * are why it must not be printed as a measurement.
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

describe('what the guide card prints', () => {
  it('never prints the blend as a percentage', () => {
    // The whole class of bug, as one assertion. `${g.mastery}%` in any
    // wording is the declared estimate wearing a measurement's clothes.
    expect(study).not.toMatch(/\$\{g\.mastery\}%/);
    expect(study).not.toMatch(/\$\{u\.mastery\}%/);
    // And the third site, which lived a module away: the recommendation on
    // the same card said "12 · Monopoly is at 30%, the lowest here."
    expect(readFileSync('src/lib/nextstep.ts', 'utf8')).not.toMatch(/mastery\)\}%/);
  });

  it('says the state instead, in words', () => {
    expect(study).toMatch(/<Standing\b/);
    expect(study).toContain('knowingOf(keys, state.reviews, now.getTime())');
  });

  it('says the coverage once, and not twice', () => {
    // `Standing` prints "4 of 68 cards answered." The meta line under it used
    // to open with the mastery percentage; replacing that with the same count
    // put the sentence on the card twice, three lines apart. Both halves were
    // individually right, which is why no test caught it and a screenshot did.
    expect(study).not.toContain('${standing.evidence.answered} of ${standing.evidence.cards}');
    expect(study).toMatch(/due > 0 \? `\$\{due\} due`/);
  });

  it('still hands the blend to the ranking, which is what it is for', () => {
    // Not printed is not unused. `lib/revise.ts` ranks units by it, and that
    // is the job it was built for — an estimate is a fine tiebreak and a poor
    // claim.
    expect(study).toContain('mastery: u.mastery');
  });
});

describe('the other two screens that showed it', () => {
  const guide = readFileSync('src/screens/Guide.tsx', 'utf8');
  const slides = readFileSync('src/screens/Slides.tsx', 'utf8');

  it('the guide prints no unit percentage', () => {
    expect(guide).not.toMatch(/\$\{[a-zA-Z.]*mastery\}%/);
    expect(guide).toMatch(/<Standing\b/);
  });

  it('the last slide of a deck prints no unit percentage', () => {
    expect(slides).not.toMatch(/\$\{[a-zA-Z.]*mastery\}%/);
    expect(slides).toContain('says(standing.state)');
  });

  it('and every one of them can be argued with', () => {
    // The other half of replacing a number with a state: a state read off
    // evidence has to be resettable by the person it is about.
    expect(guide).toMatch(/<ClearEvidence\b/);
    expect(guide).toContain("type: 'forgetCards'");
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
    expect(study).toContain('is holding. Keep them warm.');
    expect(study).toContain('Drill those first.');
  });

  it('decides cold from the unit’s own answers, not from the course guard', () => {
    // `anyAnswered` asks about the whole course. One answer in unit 1 opened
    // the branch and the other ten units were then sorted by a figure that
    // was still entirely seeded — the same bug one level down, and the guard
    // above could not see it.
    expect(study).not.toContain('u.mastery < 40');
    expect(study).toMatch(/\.state !== 'retained'/);
  });
});
