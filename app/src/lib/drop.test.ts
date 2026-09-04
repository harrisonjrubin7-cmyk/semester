import { describe, expect, it } from 'vitest';
import { afterDrops, dropHelped, dropLine, readDrop, readScores } from './drop';

describe('reading a column of scores', () => {
  it('takes them however they were typed', () => {
    expect(readScores('88, 92, 76')).toEqual([88, 92, 76]);
    expect(readScores('88\n92\n76')).toEqual([88, 92, 76]);
    expect(readScores('88; 92 ; 76')).toEqual([88, 92, 76]);
  });

  it('reads each one the way the single-score box does', () => {
    // Somebody reading off a gradebook has "17/20", not 85.
    expect(readScores('17/20, 18/20')).toEqual([85, 90]);
    expect(readScores('88%, 0.92')).toEqual([88, 92]);
  });

  it('ignores blanks and anything that is not a score', () => {
    expect(readScores('88, , 92,')).toEqual([88, 92]);
    expect(readScores('88, missed, 92')).toEqual([88, 92]);
    expect(readScores('   ')).toEqual([]);
  });

  it('keeps a zero, which is a real score and the one most likely dropped', () => {
    expect(readScores('0, 88, 92')).toEqual([0, 88, 92]);
  });
});

describe('striking out the lowest', () => {
  it('drops the lowest n and averages the rest', () => {
    const out = afterDrops([54, 68, 88, 92, 96], 2);
    expect(out.dropped).toEqual([54, 68]);
    expect(out.kept).toEqual([88, 92, 96]);
    expect(out.mean).toBeCloseTo(92, 5);
  });

  it('is the plain average when nothing drops', () => {
    expect(afterDrops([80, 90], 0).mean).toBe(85);
  });

  it('never drops everything', () => {
    // "Lowest two dropped" with two sat so far means one counts, not none —
    // and a category averaging nothing would silently leave itself out of the
    // projection, which is worse than a thin figure.
    const out = afterDrops([70, 80], 2);
    expect(out.kept).toEqual([80]);
    expect(out.mean).toBe(80);
  });

  it('counts only what has been entered', () => {
    // A quiz you missed is a zero and is droppable. A quiz not yet held is
    // nothing, and must not be divided by.
    expect(afterDrops([90, 90, 90], 1).mean).toBe(90);
  });

  it('is nothing when nothing is entered', () => {
    expect(afterDrops([], 2)).toEqual({ kept: [], dropped: [], mean: null });
  });

  it('does not mutate what it was given', () => {
    const scores = [90, 50, 70];
    afterDrops(scores, 1);
    expect(scores).toEqual([90, 50, 70]);
  });

  it('drops duplicates of the same low score properly', () => {
    const out = afterDrops([50, 50, 90, 90], 2);
    expect(out.dropped).toEqual([50, 50]);
    expect(out.mean).toBe(90);
  });
});

describe('what it says', () => {
  it('names which scores went, not just how many', () => {
    // The commonest cause of a wrong average here is a score typed twice, and
    // you can only see that if the struck-out figures are shown.
    expect(dropLine([54, 68, 88, 92, 96], 2)).toBe(
      'Best 3 of 5 — 92%, with 54 and 68 dropped.',
    );
  });

  it('says the plain average when no rule applies', () => {
    expect(dropLine([80, 90], 0)).toBe('2 entered, averaging 85%.');
  });

  it('says nothing when there is nothing', () => {
    expect(dropLine([], 2)).toBe('');
  });
});

describe('whether the rule made a difference', () => {
  it('is what it gained you', () => {
    expect(dropHelped([50, 90, 90], 1)).toBeCloseTo(13.33, 1);
  });

  it('is nothing when every score is the same', () => {
    // A real rule that changes nothing, and a screen that announces it every
    // time is noise.
    expect(dropHelped([90, 90, 90], 1)).toBe(0);
  });

  it('is nothing when there is nothing to compare', () => {
    expect(dropHelped([], 2)).toBe(0);
  });
});

describe('reading a stored rule', () => {
  it('takes a whole number of drops', () => {
    expect(readDrop(2)).toBe(2);
    expect(readDrop('2')).toBe(2);
    expect(readDrop(2.8)).toBe(2);
  });

  it('is none for anything that is not one', () => {
    expect(readDrop(undefined)).toBe(0);
    expect(readDrop(-1)).toBe(0);
    expect(readDrop('lowest two')).toBe(0);
  });

  it('caps a figure nobody meant', () => {
    expect(readDrop(9999)).toBe(40);
  });
});
