import { describe, expect, it } from 'vitest';
import { ASK, NUDGE, guessedLine, invite, pick, readPretested, studied, unitKey, verdict, worthGuessing } from './pretest';
import { cardKey, type Reviews } from './review';
import type { StudyCard } from './types';

const cards = (n: number): StudyCard[] =>
  Array.from({ length: n }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }) as StudyCard);

const answered = (courseId: string, card: StudyCard): Reviews => ({
  [cardKey(courseId, card.q)]: {
    right: 1,
    wrong: 0,
    streak: 1,
    ease: 2.5,
    interval: 1,
    due: 0,
    last: 0,
    seen: 1,
  } as Reviews[string],
});

describe('when a guess-first run is offered', () => {
  it('is offered on a unit nobody has answered', () => {
    expect(worthGuessing('econ', 3, cards(6), {}, {})).toBe(true);
  });

  it('is not offered on a unit already drilled', () => {
    // They would not be guessing, they would be being quizzed, and calling
    // that a pretest is a lie about what they are doing.
    const reviews = answered('econ', cards(6)[2]);
    expect(worthGuessing('econ', 3, cards(6), reviews, {})).toBe(false);
    expect(studied('econ', cards(6), reviews)).toBe(true);
  });

  it('is not offered twice', () => {
    const done = { [unitKey('econ', 3)]: Date.now() };
    expect(worthGuessing('econ', 3, cards(6), {}, done)).toBe(false);
    // A different unit of the same course is untouched by that.
    expect(worthGuessing('econ', 4, cards(6), {}, done)).toBe(true);
  });

  it('is not offered on a unit too small to ask anything of', () => {
    expect(worthGuessing('econ', 3, cards(1), {}, {})).toBe(false);
  });

  it('does not confuse two courses’ unit numbers', () => {
    expect(unitKey('econ', 3)).not.toBe(unitKey('psci', 3));
  });
});

describe('which questions get asked', () => {
  it('asks a few rather than all of them', () => {
    // A thirty-question pretest on unread material is a chore that gets
    // abandoned halfway, and the effect needs the attempt, not the volume.
    expect(pick(cards(30))).toHaveLength(ASK);
  });

  it('spreads them across the unit rather than taking the front', () => {
    const asked = pick(cards(20)).map((c) => c.q);
    expect(asked).toEqual(['Q0', 'Q5', 'Q10', 'Q15']);
  });

  it('asks everything when there is little enough', () => {
    expect(pick(cards(3))).toHaveLength(3);
  });

  it('asks the same questions every time, so it cannot be rerolled', () => {
    expect(pick(cards(30))).toEqual(pick(cards(30)));
  });
});

describe('what it says, where it feels like failing', () => {
  it('agrees that you do not know the answers, rather than denying it', () => {
    const said = invite(4, 'Supply and demand');
    expect(said).toContain('You will not know the answers');
    expect(said).toContain('Supply and demand');
  });

  it('says why being wrong is the point', () => {
    expect(invite(4, 'x')).toMatch(/wrong/i);
    expect(NUDGE).toMatch(/attempt/i);
  });

  it('does not sell it', () => {
    const said = `${invite(4, 'x')} ${NUDGE}`.toLowerCase();
    for (const word of ['boost', 'unlock', 'supercharge', 'proven to', 'optimis']) {
      expect(said, word).not.toContain(word);
    }
  });
});

describe('the verdict, which is not a score', () => {
  it('says nothing was recorded, every time', () => {
    // The thing somebody is actually wondering: will this count against me.
    for (const [right, asked] of [[0, 4], [2, 4], [4, 4], [0, 0]]) {
      expect(verdict(right, asked), `${right}/${asked}`).toMatch(/not scored|nothing went into/i);
    }
  });

  it('does not congratulate a full score', () => {
    // Getting them all right means the unit was not new. That is worth
    // knowing and it is not an achievement.
    const said = verdict(4, 4);
    expect(said.toLowerCase()).not.toMatch(/well done|great|nice|excellent/);
    expect(said).toMatch(/not new/i);
  });

  it('does not console a blank one', () => {
    const said = verdict(0, 4);
    expect(said.toLowerCase()).not.toMatch(/do not worry|don’t worry|unlucky|keep trying/);
    expect(said).toMatch(/what a pretest on unread material normally looks like/i);
  });

  it('tells somebody what the misses bought them', () => {
    expect(verdict(1, 4)).toMatch(/stick/i);
  });
});

describe('the record it keeps', () => {
  it('says when, in days, rather than a timestamp', () => {
    const now = Date.UTC(2026, 8, 10);
    expect(guessedLine(now, now)).toContain('today');
    expect(guessedLine(now - 86_400_000, now)).toContain('yesterday');
    expect(guessedLine(now - 5 * 86_400_000, now)).toContain('5 days ago');
  });

  it('says nothing about a unit never pretested', () => {
    expect(guessedLine(undefined)).toBe('');
  });

  it('drops anything stored that is not a time', () => {
    expect(readPretested({ a: 1, b: 'yesterday', c: 0, d: -5 })).toEqual({ a: 1 });
    expect(readPretested(null)).toEqual({});
    expect(readPretested([1])).toEqual({});
  });
});
