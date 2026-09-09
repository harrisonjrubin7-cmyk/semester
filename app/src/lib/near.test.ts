import { describe, expect, it } from 'vitest';
import { distance, near, nearAny, slack } from './near';

describe('how far off a word may be', () => {
  it('forgives nothing under five letters', () => {
    // "cost", "cast", "case" and "cars" are all one edit from each other, and
    // a tier that joins them up is noise.
    expect(slack('exam')).toBe(0);
    expect(near('cost', 'cast')).toBe(false);
    expect(near('exam', 'exam')).toBe(true);
  });

  it('forgives one letter in a short word and two in a long one', () => {
    expect(slack('grades')).toBe(1);
    expect(slack('assignments')).toBe(2);
    expect(near('gradess', 'grades')).toBe(true);
    expect(near('assignmnets', 'assignments')).toBe(true);
  });

  it('takes the tolerance from what was typed', () => {
    // A long word typed short is still somebody aiming at the long one.
    expect(near('calender', 'calendar')).toBe(true);
  });
});

describe('the distance itself', () => {
  it('counts a swap of two neighbours as one edit', () => {
    // The whole reason for optimal string alignment over plain Levenshtein:
    // under Levenshtein each of these is two edits, and each is the commonest
    // typo there is.
    expect(distance('teh', 'the', 2)).toBe(1);
    expect(distance('recieve', 'receive', 2)).toBe(1);
    expect(distance('lecutre', 'lecture', 2)).toBe(1);
    expect(distance('podacst', 'podcast', 2)).toBe(1);
  });

  it('does not mistake two substitutions for a swap', () => {
    // "schedual" is not "schedule" with two letters swapped round — the pair
    // that moved are not each other's neighbours — so it is two edits, and it
    // is only findable because a word that long is allowed two.
    expect(distance('schedual', 'schedule', 2)).toBe(2);
    expect(near('schedual', 'schedule')).toBe(true);
  });

  it('counts an insertion, a deletion and a substitution as one each', () => {
    expect(distance('calender', 'calendar', 2)).toBe(1);
    expect(distance('coursse', 'course', 2)).toBe(1);
    expect(distance('cours', 'course', 2)).toBe(1);
  });

  it('is nought for the same word and stops counting past the budget', () => {
    expect(distance('lecture', 'lecture', 2)).toBe(0);
    // Not the real distance, just "further than you asked about".
    expect(distance('lecture', 'parsnip', 2)).toBe(3);
  });

  it('gives up on a length difference before doing any work', () => {
    expect(distance('exam', 'examinations', 2)).toBe(3);
  });

  it('handles an empty side', () => {
    expect(distance('', '', 2)).toBe(0);
    expect(distance('ab', '', 2)).toBe(2);
    expect(distance('', 'ab', 2)).toBe(2);
  });
});

describe('a near miss anywhere in a haystack', () => {
  it('matches word by word rather than across the whole string', () => {
    // Against the whole sentence the distance is dominated by its length.
    expect(nearAny('calender', 'The calendar, and every deadline on it')).toBe(true);
  });

  it('splits on punctuation the way a reader does', () => {
    expect(nearAny('midterm', 'Exam 1 (midterms), in class')).toBe(true);
  });

  it('says no to a word that is simply not there', () => {
    expect(nearAny('parsnip', 'Calendar · every deadline in the term')).toBe(false);
  });

  it('says no to a short word rather than guessing', () => {
    expect(nearAny('quiz', 'Quit the term and start another')).toBe(false);
  });

  it('is safe with nothing to look at', () => {
    expect(nearAny('', 'calendar')).toBe(false);
    expect(nearAny('calender', '')).toBe(false);
  });
});
