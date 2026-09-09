import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import { fromHash } from './route';

/*
 * Where the grade table lives has been reversed four times, twice in each
 * direction: a tab of Courses, then a destination, then a tab again, then a
 * destination again. Every turn cost a migration of `#/grades`, the tab bar's
 * `root`, the assistant's context and the projection insight — and each was an
 * assistant re-reading `Courses.tsx` and reaching a different conclusion from
 * the same code.
 *
 * It is settled, by the person whose app it is: the table is the Grades tab of
 * Courses, and `grades` is not a destination. That is a preference, not
 * something derivable from the source, so re-deriving it is exactly how it
 * gets flipped a fifth time. This test is here to be in the way of that — it
 * fails on the change itself, and says why in the failure.
 *
 * If it ever should change, it changes because the person asked, and this test
 * and `SIMPLIFY-AUDIT.md` §T2 are updated in the same commit that does it.
 */
describe('where the grade table lives', () => {
  it('is not a destination of its own', () => {
    const grades = DESTINATIONS.filter((d) => d.screen === ('grades' as never));
    expect(
      grades.map((d) => d.screen),
      'grades is a tab of Courses, not a destination — see SIMPLIFY-AUDIT.md section T2 before changing this',
    ).toEqual([]);
  });

  it('keeps an old #/grades bookmark working, on the Courses grades tab', () => {
    // Through the parser a bookmark actually goes through, not the private
    // table behind it: what matters is where the URL lands.
    const landed = fromHash('#/grades');
    expect(landed, '#/grades must still resolve — a bookmark cannot open a blank screen').not.toBeNull();
    expect(landed!.screen).toBe('courses');
    expect(landed!.opens).toEqual({ courses: 'grades' });
  });

  it('still has a registry to check', () => {
    // Guards the emptiness assertion above: were DESTINATIONS to move or be
    // renamed, "no grades destination" would pass on an empty list.
    expect(DESTINATIONS.length).toBeGreaterThan(30);
  });
});
