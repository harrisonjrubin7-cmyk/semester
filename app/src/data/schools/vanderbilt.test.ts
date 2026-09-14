import { describe, expect, it } from 'vitest';
import { BUNDLED } from './index';
import { fromCalendar } from '../../lib/registrar';

/**
 * What the bundled Vanderbilt calendar actually proposes.
 *
 * Every date in it was read off a Fall 2026 syllabus in `project/uploads`,
 * written by the instructor teaching the course, because this build cannot
 * reach the registrar's page. That is a weaker source than the registrar and
 * the calendar is deliberately partial as a result — so this test pins what
 * is there and, more to the point, pins what is *not*.
 */
describe('Vanderbilt, Fall 2026', () => {
  const term = BUNDLED.vanderbilt.data.academicCalendar?.[0];

  it('ships one term, and it survives readSchool', () => {
    expect(BUNDLED.vanderbilt.data.academicCalendar).toHaveLength(1);
    expect(term?.termName).toBe('Fall 2026');
  });

  it('carries no registrar deadline, because none could be sourced', () => {
    // The drop, withdrawal and pass/fail dates are the ones that cost money.
    // If a future edit adds them, it should come with the registrar's page.
    expect(term?.deadlines).toEqual([]);
  });

  it('leaves the last day of classes blank rather than guessing between two', () => {
    expect(term?.endsOn).toBe('');
    expect(term?.finalsFrom).toBeUndefined();
  });

  it('proposes the term start and both breaks, and nothing else', () => {
    const rows = fromCalendar(term!);
    expect(rows.map((r) => [r.id, r.iso, r.until])).toEqual([
      ['classes-begin', '2026-08-26', ''],
      ['break', '2026-10-22', '2026-10-23'],
      // Matched by the same HINTS a pasted page goes through: "Thanksgiving
      // Break" hits the `break` landmark, which is already taken by Fall
      // Break, so this one keeps the school's own words with no landmark.
      ['', '2026-11-21', '2026-11-29'],
    ]);
  });

  it('dates the breaks the way two syllabi independently describe them', () => {
    const fall = term?.breaks?.find((b) => b.label === 'Fall Break');
    const thanks = term?.breaks?.find((b) => b.label === 'Thanksgiving Break');
    // ECON 1020: "Fall Break: October 22–23rd (I.e., No Class Friday)" — so it
    // ends on a Friday. PSCI 1104 corroborates with "Lecture 17 October 22".
    expect(new Date(`${fall?.to}T00:00:00`).getDay()).toBe(5);
    // ECON 1020: "Thanksgiving Break: November 21st–29th (Full Week Off)" — a
    // full week bounded by a Saturday and a Sunday.
    expect(new Date(`${thanks?.from}T00:00:00`).getDay()).toBe(6);
    expect(new Date(`${thanks?.to}T00:00:00`).getDay()).toBe(0);
  });
});
