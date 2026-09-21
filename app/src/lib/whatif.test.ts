import { describe, expect, it } from 'vitest';
import { COMMON_LETTER } from './cutoffs';
import { key, standing } from './grades';
import type { Course } from './types';
import {
  laidOver,
  runwayLine,
  supposing,
  swing,
  swingLine,
  thenNeeds,
  thenNeedsLine,
} from './whatif';

const course = (grading: { what: string; pct: string }[]) =>
  ({ id: 'econ', grading } as unknown as Course);

/** Three categories, a third of the grade each, so the arithmetic is readable. */
const econ = course([
  { what: 'Problem sets', pct: '30%' },
  { what: 'Midterm', pct: '30%' },
  { what: 'Final', pct: '40%' },
]);

const K = {
  sets: key('econ', 0),
  midterm: key('econ', 1),
  final: key('econ', 2),
};

describe('laidOver', () => {
  const over = (real: Record<string, string>, supposed: Record<string, string>) =>
    laidOver(real, supposed, COMMON_LETTER);

  it('puts a supposed score over a real one', () => {
    expect(over({ [K.sets]: '70' }, { [K.sets]: '95' })[K.sets]).toBe('95');
  });

  it('leaves a real score alone where the supposition is blank', () => {
    // The field being emptied must not erase a mark that is actually there.
    expect(over({ [K.sets]: '70' }, { [K.sets]: '   ' })[K.sets]).toBe('70');
  });

  it('reads a letter without waiting for the field to be left', () => {
    // `readScore` cannot read a letter at all, so laying the raw text over
    // would score this row as nothing. See the note on the function.
    expect(over({}, { [K.sets]: 'B+' })[K.sets]).toBe('87');
  });

  it('leaves an unreadable supposition out rather than passing it through', () => {
    // Passed through, `standing` would score it as nothing — the right
    // number for the wrong reason, and indistinguishable from an empty box.
    expect(over({}, { [K.sets]: 'pretty well' })[K.sets]).toBeUndefined();
  });

  it('does not mutate what it was given', () => {
    // The whole safety argument of this file: a supposition is a copy.
    const real = { [K.sets]: '70' };
    over(real, { [K.sets]: '95', [K.final]: '88' });
    expect(real).toEqual({ [K.sets]: '70' });
    expect(real[K.final]).toBeUndefined();
  });
});

describe('swing', () => {
  it('says nothing when nothing was supposed', () => {
    const s = swing(econ, { [K.sets]: '80' }, {}, {}, COMMON_LETTER);
    expect(supposing(s)).toBe(false);
    expect(swingLine(s)).toBe('');
    // The control: the real standing still comes back, untouched.
    expect(s.from).toBe(80);
    expect(s.to).toBe(80);
  });

  it('moves the grade by the supposed score and names the direction', () => {
    // 80 on 30% banked; suppose 90 on the 30% midterm -> 85 across 60%.
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '90' }, {}, COMMON_LETTER);
    expect(s.from).toBe(80);
    expect(s.to).toBe(85);
    expect(swingLine(s)).toContain('up 5 from 80%');
    expect(swingLine(s)).toContain('40% still to play for');
  });

  it('says the course is finished when the supposition closes it out', () => {
    const s = swing(
      econ,
      { [K.sets]: '80', [K.midterm]: '80' },
      { [K.final]: '90' },
      {},
      COMMON_LETTER,
    );
    expect(s.left).toBeLessThanOrEqual(0.5);
    expect(s.to).toBe(84);
    expect(swingLine(s)).toContain('finish the course at 84%');
    expect(swingLine(s)).not.toContain('to play for');
  });

  it('carries the letter from the scale in force', () => {
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '95' }, {}, COMMON_LETTER);
    expect(s.fromLetter).toBe('B−');
    expect(s.toLetter).toBe('B+');
    expect(swingLine(s)).toContain('B+');
  });

  it('does not announce a move that rounds to nothing', () => {
    // 80 banked, supposing 80 again: the number is the same and saying
    // "up 0" is how a figure stops being read.
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '80' }, {}, COMMON_LETTER);
    expect(swingLine(s)).toContain('where you already are');
    expect(swingLine(s)).not.toMatch(/up|down/);
  });

  it('never writes the supposition into the real standing', () => {
    // The guarantee the whole file rests on, checked against a standing
    // computed independently rather than against `s.now` alone.
    const real = { [K.sets]: '80' };
    const s = swing(econ, real, { [K.final]: '100' }, {}, COMMON_LETTER);
    expect(s.now).toEqual(standing(econ, { [K.sets]: '80' }, {}));
    expect(real).toEqual({ [K.sets]: '80' });
    expect(s.now.current).toBe(80);
  });
});

describe('supposing over a mark already on record', () => {
  it('names the row it wrote over', () => {
    const s = swing(econ, { [K.sets]: '60' }, { [K.sets]: '95' }, {}, COMMON_LETTER);
    expect(s.over).toEqual(['Problem sets']);
    expect(s.to).toBe(95);
  });

  it('does not name a row that had no mark to write over', () => {
    // The control for the case above. A probe that reported "overwritten"
    // for every supposed row would look identical on the test that matters.
    const s = swing(econ, { [K.sets]: '60' }, { [K.final]: '95' }, {}, COMMON_LETTER);
    expect(s.over).toEqual([]);
    expect(s.tried).toBe(1);
  });

  it('counts a category scored from its pieces as a mark on record', () => {
    // The case the raw score map cannot see: the single box is empty and the
    // category still has a mark, because `standing` read it off the pieces.
    const s = swing(
      econ,
      {},
      { [K.sets]: '95' },
      { pieces: { [K.sets]: '70, 80' } },
      COMMON_LETTER,
    );
    expect(s.over).toEqual(['Problem sets']);
  });
});

describe('a supposition that cannot be read', () => {
  it('names it rather than silently doing nothing', () => {
    // `standing` treats an unreadable score as no score at all, so without
    // this the field would sit there full of text and change no number.
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: 'pretty well' }, {}, COMMON_LETTER);
    expect(s.unreadable).toEqual(['Midterm']);
    expect(s.to).toBe(80);
  });

  it('reads the shapes people actually type', () => {
    for (const typed of ['90', '90%', '18/20', '0.9', 'A−', 'b+']) {
      const s = swing(econ, {}, { [K.midterm]: typed }, {}, COMMON_LETTER);
      expect(s.unreadable).toEqual([]);
      expect(s.to).not.toBeNull();
    }
  });
});

describe('thenNeeds', () => {
  it('answers the chained question against the supposed standing', () => {
    // 80 on the sets, supposing 90 on the midterm: 24 + 27 = 51 points
    // banked, 40% left, so an A at 90 needs (90 - 51) / 40 -> 97.5%.
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '90' }, {}, COMMON_LETTER);
    expect(Math.round(thenNeeds(s, 90) ?? 0)).toBe(98);
    expect(thenNeedsLine(s, 90, 'An A')).toBe('An A would then need 98% on everything left.');
  });

  it('is a different number from what the real standing needs', () => {
    // The control. If `thenNeeds` were reading the real standing this test
    // is the only thing that would notice: 80 alone leaves (90-24)/70 -> 94%.
    const s = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '90' }, {}, COMMON_LETTER);
    expect(Math.round(thenNeeds(s, 90) ?? 0)).not.toBe(94);
  });

  it('says nothing at all when nothing was supposed', () => {
    const s = swing(econ, { [K.sets]: '80' }, {}, {}, COMMON_LETTER);
    expect(thenNeeds(s, 90)).toBeNull();
    expect(thenNeedsLine(s, 90, 'An A')).toBe('');
  });

  it('says a target is already yours rather than printing a negative', () => {
    const s = swing(econ, { [K.sets]: '100' }, { [K.midterm]: '100' }, {}, COMMON_LETTER);
    expect(thenNeedsLine(s, 60, 'A pass')).toBe('A pass would already be yours.');
  });

  it('says a target is gone rather than printing an impossible number', () => {
    const s = swing(econ, { [K.sets]: '20' }, { [K.midterm]: '20' }, {}, COMMON_LETTER);
    expect(thenNeedsLine(s, 90, 'An A')).toBe('An A would no longer be reachable.');
  });

  it('returns null once the supposition leaves nothing to play for', () => {
    const s = swing(
      econ,
      { [K.sets]: '80', [K.midterm]: '80' },
      { [K.final]: '90' },
      {},
      COMMON_LETTER,
    );
    expect(thenNeeds(s, 90)).toBeNull();
  });
});

describe('the absence penalty survives the supposition', () => {
  it('is still subtracted from the supposed grade', () => {
    // Left out, a what-if would quietly hand back the points the syllabus
    // already took — and it would do it on the cheerful side.
    const plain = swing(econ, { [K.sets]: '80' }, { [K.midterm]: '80' }, {}, COMMON_LETTER);
    const docked = swing(
      econ,
      { [K.sets]: '80' },
      { [K.midterm]: '80' },
      { pointsOff: 5 },
      COMMON_LETTER,
    );
    expect(plain.to).toBe(80);
    expect(docked.to).toBe(75);
    // And the target it leaves the rest needing is harder, not the same.
    expect(thenNeeds(docked, 90)).toBeGreaterThan(thenNeeds(plain, 90) ?? 0);
  });
});

describe('a course nothing can be weighted in', () => {
  it('says there is no number to move rather than drawing a zero', () => {
    const unweighted = course([{ what: 'Participation', pct: 'graded pass/fail' }]);
    const s = swing(unweighted, {}, { [key('econ', 0)]: '90' }, {}, COMMON_LETTER);
    expect(s.to).toBeNull();
    expect(swingLine(s)).toBe('Nothing here can be weighted yet, so there is no number to move.');
  });
});

describe('runwayLine', () => {
  it('says how far off the test is and what the windows offer', () => {
    expect(runwayLine(14, 10)).toBe(
      'The next test is 14 days away — about 20 hours of study time between now and then, by your own windows.',
    );
  });

  it('says today and tomorrow rather than 0 and 1 days', () => {
    expect(runwayLine(0, 10)).toBe('The next test is today.');
    expect(runwayLine(1, 10)).toContain('tomorrow');
  });

  it('says nothing where there is no test to count to', () => {
    expect(runwayLine(null, 10)).toBe('');
  });

  it('names the test but not the hours where no windows are set', () => {
    // A student who has never opened the workload settings would otherwise be
    // told they have "about 0 hours", which is a fact about a settings screen
    // dressed up as a warning about their degree.
    expect(runwayLine(14, 0)).toBe('The next test is 14 days away.');
    expect(runwayLine(14, null)).toBe('The next test is 14 days away.');
  });

  it('uses the singular for one hour', () => {
    expect(runwayLine(2, 5)).toContain('about 1 hour of study time');
  });
});
