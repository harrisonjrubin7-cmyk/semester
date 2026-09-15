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

  it('carries all six registrar deadlines', () => {
    expect(term?.deadlines).toEqual([
      { label: 'Open enrollment ends', on: '2026-09-04' },
      { label: 'Last day to drop without a W', on: '2026-09-04' },
      { label: 'Spring 2027 registration opens', on: '2026-10-26' },
      { label: 'Last day to withdraw from a course', on: '2026-10-30' },
      { label: 'Last day to change to pass/fail', on: '2026-10-30' },
      { label: 'Final grades due', on: '2026-12-21' },
    ]);
  });

  it('takes the opening of registration, not its closing', () => {
    // Spring 2027 registration runs Mon 26 Oct to Fri 13 Nov. An earlier pass
    // had only the 13th and refused it: the landmark is "Registration opens
    // for next term", whose cost line is "the sections you need go in the
    // first morning", so a closing date there would name the day it shuts.
    expect(term?.deadlines.find((d) => /registration/.test(d.label))?.on).toBe('2026-10-26');
  });

  it('dates grades after the last exam is actually sat', () => {
    // The check that rejected 15 December. ECON 1020 sits a final exam slot
    // ON the 15th and another on the 16th, and PSCI 1104's is the 17th, so
    // grades could not be due on the 15th. The 21st clears all three.
    const grades = term?.deadlines.find((d) => /grade/.test(d.label))?.on ?? '';
    expect(new Date(`${grades}T00:00:00`) > new Date('2026-12-17T00:00:00')).toBe(true);
  });

  it('gives 30 October both of the meanings it carries', () => {
    // Vanderbilt's own policy, corroborated across the Enrollment Bulletin
    // and Arts and Science: pass/fail may be elected, or reversed, "until the
    // deadline for withdrawal for each term". So it is not a date of its own.
    const rows = fromCalendar(term!);
    expect(rows.filter((r) => r.iso === '2026-10-30').map((r) => r.id)).toEqual([
      'withdraw',
      'passfail',
    ]);
  });

  it('gives 4 September both of the meanings it carries', () => {
    // Vanderbilt's own policy, corroborated twice: a course dropped during
    // open enrollment leaves no entry on the record, and one dropped after
    // that deadline is entered with a W. So the close of open enrollment IS
    // the last day to drop without a W — one date, two consequences, and the
    // app has a landmark with its own cost line for each.
    const rows = fromCalendar(term!);
    const sep4 = rows.filter((r) => r.iso === '2026-09-04').map((r) => r.id);
    expect(sep4).toEqual(['add-deadline', 'drop-clean']);
  });

  it('files each of them under the landmark it actually is', () => {
    // The one that matters. The source's own phrase for 4 September is
    // "add/drop deadline", and `HINTS` matches "add/drop deadline" to
    // `drop-clean` — the last day to drop WITHOUT a W, which this is not: it
    // is the close of open enrollment, six weeks earlier. Writing the
    // source's wording would have filed it as the deadline the app calls
    // "the big one". The label is chosen so the landmark is right.
    const rows = fromCalendar(term!);
    expect(rows.find((r) => r.iso === '2026-09-04')?.id).toBe('add-deadline');
    expect(rows.find((r) => r.iso === '2026-10-30')?.id).toBe('withdraw');
  });

  it('leaves the last day of classes blank rather than guessing between two', () => {
    expect(term?.endsOn).toBe('');
    expect(term?.finalsFrom).toBeUndefined();
  });

  it('ships the two undergraduate plans, in meals a term', () => {
    const tiers = BUNDLED.vanderbilt.data.mealPlanTiers;
    expect(tiers?.map((t) => [t.name, t.swipes, t.period])).toEqual([
      ['First-Year Plan', 335, 'term'],
      ['Upper-Division Plan', 305, 'term'],
    ]);
  });

  it('carries the Meal Money each plan includes', () => {
    // Both figures arrived in the same search result as the swipe counts
    // already here, in a coherent shape — 335 meals with $225, 305 with $275
    // — which is the first corroboration those counts have had. Dollars here
    // is a printed reference, not an input: nothing computes from it, and the
    // runway arithmetic runs on balances the student logs.
    expect(BUNDLED.vanderbilt.data.mealPlanTiers?.map((t) => [t.name, t.dollars])).toEqual([
      ['First-Year Plan', 225],
      ['Upper-Division Plan', 275],
    ]);
  });

  it('proposes the term start, both breaks and all six deadlines', () => {
    const rows = fromCalendar(term!);
    expect(rows.map((r) => [r.id, r.iso, r.until])).toEqual([
      ['classes-begin', '2026-08-26', ''],
      ['break', '2026-10-22', '2026-10-23'],
      // Matched by the same HINTS a pasted page goes through: "Thanksgiving
      // Break" hits the `break` landmark, which is already taken by Fall
      // Break, so this one keeps the school's own words with no landmark.
      ['', '2026-11-21', '2026-11-29'],
      ['add-deadline', '2026-09-04', ''],
      ['drop-clean', '2026-09-04', ''],
      ['registration', '2026-10-26', ''],
      ['withdraw', '2026-10-30', ''],
      ['passfail', '2026-10-30', ''],
      ['grades', '2026-12-21', ''],
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
