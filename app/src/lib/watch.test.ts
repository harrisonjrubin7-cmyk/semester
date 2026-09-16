import { describe, expect, it } from 'vitest';
import { MOST_CARDS, spokenLesson } from './watch';
import { loadSeed } from '../data/seed';
import type { Figure, Unit } from './types';

const card = (n: number) => ({ q: `Question ${n}?`, a: `Answer ${n}.` });
const unit = (cards: number, name = '3 · A unit'): Unit => ({
  name,
  mastery: 0,
  cards: Array.from({ length: cards }, (_, i) => card(i + 1)),
});

describe('the lesson a unit would have had', () => {
  it('opens on the unit, asks and answers every card, and closes', () => {
    const got = spokenLesson(0, unit(2));
    expect(got?.beats.map((b) => b.kind)).toEqual(['title', 'q', 'a', 'q', 'a', 'close']);
    expect(got?.title).toBe('A unit');
  });

  it('strips the number a unit is filed under from what it reads out', () => {
    // "3 · Optimization" is a filing label. Read aloud it is "three, middle
    // dot, optimization", which is not a sentence anybody says.
    const got = spokenLesson(0, unit(1, '14/16 · Competition & information'));
    expect(got?.title).toBe('Competition & information');
    expect(got?.beats[0].said).not.toContain('14/16');
  });

  it('says nothing for a unit with no cards, rather than a voice saying its name', () => {
    expect(spokenLesson(0, unit(0))).toBeNull();
    expect(spokenLesson(0, undefined)).toBeNull();
  });

  it('reads the answer without repeating the question', () => {
    // The question was read a moment ago. Hearing it twice is what makes
    // people switch the voice off — `lib/speak.ts` makes the same point about
    // a card in the drill.
    const got = spokenLesson(0, unit(1));
    const answer = got?.beats.find((b) => b.kind === 'a');
    expect(answer?.said).toBe('Answer 1.');
    expect(answer?.said).not.toContain('Question');
  });

  it('numbers the questions as it goes, because there is no progress bar', () => {
    const got = spokenLesson(0, unit(3));
    const asked = got?.beats.filter((b) => b.kind === 'q').map((b) => b.said) ?? [];
    expect(asked[0]).toContain('Question 1.');
    expect(asked[2]).toContain('Question 3.');
  });

  it('stops after ten cards and says how many are left and where', () => {
    const got = spokenLesson(0, unit(14));
    expect(got?.beats.filter((b) => b.kind === 'q')).toHaveLength(MOST_CARDS);
    const end = got?.beats[got.beats.length - 1];
    expect(end?.text).toContain('4 more questions');
    expect(end?.said).toContain('on the cards and in the deck');
  });

  it('closes plainly when it did reach the end', () => {
    const end = spokenLesson(0, unit(2))?.beats.at(-1);
    expect(end?.text).toBe('End of the unit');
    expect(end?.said).not.toContain('more question');
  });

  it('puts the unit’s figures after the cards, not under them', () => {
    // Nothing here knows which card a figure belongs to — `lib/live.ts`
    // places figures by unit — and a bar chart under an unrelated question
    // reads as the lesson having lost its place.
    const figure: Figure = { type: 'bars', title: 'Where it goes', caption: 'Outlays', unit: '%', max: 100, rows: [] };
    const got = spokenLesson(0, unit(2), [figure]);
    const kinds = got?.beats.map((b) => b.kind) ?? [];
    expect(kinds.indexOf('figure')).toBeGreaterThan(kinds.lastIndexOf('a'));
    expect(kinds.indexOf('figure')).toBeLessThan(kinds.indexOf('close'));
    expect(got?.beats.find((b) => b.kind === 'figure')?.said).toBe('Where it goes. Outlays');
  });

  it('reads a formula the way the script pipeline reads one', () => {
    // Through `speakable`, which is `lib/script.ts`'s and has two copies held
    // together by a test. A lesson and a podcast script saying `x²` two
    // different ways would be two voices for one course.
    const beats = spokenLesson(0, {
      name: 'U',
      mastery: 0,
      cards: [{ q: 'Is ε ≤ 1 for 40% of them?', a: 'E = mc² and 40% of it.' }],
    })?.beats;
    const answer = beats?.find((b) => b.kind === 'a')?.said;
    expect(answer).toContain('squared');
    expect(answer).toContain('percent');
    // The question too, and not only the answer. A question is where the
    // symbols mostly are — `%ΔQ`, `≤`, `vs.` — and reading one raw is a voice
    // saying "less than or equal to sign".
    const asked = beats?.find((b) => b.kind === 'q')?.said;
    expect(asked).toContain('at most');
    expect(asked).toContain('percent');
    expect(asked).not.toContain('≤');
  });
});

describe('every unit of every shipped course', () => {
  it('has a lesson it could read, recorded or not', () => {
    // §3.3's condition: a course offers Watch for every unit. The shipped
    // courses have recordings and do not need this, which is exactly why they
    // are the fixture — if the derivation fails on material somebody wrote by
    // hand, it will fail on material a model wrote.
    return loadSeed().then((mods) => {
      let units = 0;
      for (const m of mods) {
        for (const [i, u] of m.guide.units.entries()) {
          units += 1;
          const got = spokenLesson(i, u);
          expect(got, `${m.guide.code} unit ${i}`).not.toBeNull();
          expect(got?.beats.length, `${m.guide.code} unit ${i}`).toBeGreaterThanOrEqual(4);
        }
      }
      expect(units).toBe(44);
    });
  });
});
