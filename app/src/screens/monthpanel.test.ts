import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The month's day panel says what is on that day, and it has to say all of it.
 *
 * The panel is a run of sections — deadlines, your tasks, your appointments,
 * campus, a connected calendar — and then one condition that decides whether
 * to draw "Nothing due this day" instead. Every section added since has had
 * to remember to join that condition, and twice one did not: the campus
 * calendar first (see the note beside the marks in `Calendar.tsx`), and then
 * appointments, where a cell reading "Wednesday 16 September. 1 appointment."
 * said "Nothing due this day" the moment you tapped it. The grid had counted
 * the thing the panel then denied.
 *
 * It is the same mistake both times because nothing connects the two halves:
 * a section is JSX in one place and a name in a boolean two hundred lines
 * down, and the compiler is happy either way.
 *
 * ## What this test can and cannot do
 *
 * It cannot open the panel — that needs a browser, and the day holding one
 * appointment, the day holding two, every chip and a day with nothing on it
 * were all checked in one. What it can do is hold the join: a list drawn as
 * rows is a list the empty state must know about, so the next section added
 * cannot repeat this by omission.
 */

const SRC = readFileSync(new URL('./Calendar.tsx', import.meta.url), 'utf8');
const MONTH = SRC.slice(SRC.indexOf('function MonthView()'));

describe("the month day panel's empty state", () => {
  it('names every list the panel draws rows from', () => {
    const drawn = [...MONTH.matchAll(/\b(sel[A-Z]\w*)\.map\(/g)].map((m) => m[1]);
    expect(new Set(drawn).size).toBeGreaterThan(3); // the slice found the panel

    const at = MONTH.indexOf('title="Nothing due this day"');
    expect(at).toBeGreaterThan(0);
    const condition = MONTH.slice(Math.max(0, at - 400), at);

    for (const list of new Set(drawn)) {
      expect(condition, `${list} is drawn as rows but the empty state ignores it`).toContain(
        `${list}.length === 0`,
      );
    }
  });

  it('gates appointments in the panel on the chip that marks them on the grid', () => {
    // The marks and the panel read the same flag, so a chip cannot take
    // appointments off the grid and leave them listed underneath it — or, as
    // it was, mark them on the grid and leave them out from underneath.
    expect(MONTH).toMatch(/if \(on\.classes\) \{\s*state\.appointments\.forEach\(/);
    expect(MONTH).toMatch(/const selAppts = on\.classes \?/);
  });
});

describe("the semester bar's empty week", () => {
  /*
   * The same join, one view along, and the third time this view has been
   * caught by it.
   *
   * `Calendar.tsx` carries two notes above the semester view's sources: one
   * for the calendars you connect, which "plotted only the bundled listings",
   * and one for your own tasks, which it "had no branch for at all". Both were
   * found the same way — something dated and yours, plotted as an empty week.
   * Appointments were the third, and were still missing after both.
   *
   * Measured: a task and an appointment on the same day, and the bar carried
   * the task and not the appointment, with "1 of your own" in the summary.
   */
  const WEEK = MONTH.slice(MONTH.indexOf('const weeks:'));

  it('names every list a week draws from', () => {
    const drawn = [...WEEK.matchAll(/\bw\.(\w+)\.map\(|\.\.\.w\.(\w+)/g)]
      .map((m) => m[1] ?? m[2])
      .filter((n) => n !== 'start' && n !== 'classes');
    expect(new Set(drawn).size).toBeGreaterThan(3);

    const at = WEEK.indexOf('.length === 0 &&');
    expect(at).toBeGreaterThan(0);
    const condition = WEEK.slice(Math.max(0, at - 120), at + 260);

    for (const list of new Set(drawn)) {
      expect(condition, `a week draws w.${list} and the empty test ignores it`).toContain(
        `w.${list}.length === 0`,
      );
    }
  });

  /*
   * A source scan cannot see an emptied bucket.
   *
   * Replacing the filter with `appts: []` leaves every shape above intact and
   * the whole file green, while the bar goes back to plotting nothing. A
   * browser is what caught that — a task and an appointment on one day, and
   * only the task on the bar — and this is the cheap half of it: the bucket
   * has to be filled from the list, not from nothing.
   */
  it('fills each week from the list rather than from nothing', () => {
    for (const list of ['items', 'events', 'feed', 'tasks', 'appts']) {
      expect(WEEK, `w.${list} is declared and never filled`).toMatch(
        new RegExp(`${list}: ${list}\\.filter\\(|${list}: \\w+\\.filter\\(`),
      );
    }
  });

  it('counts appointments in what it calls your own', () => {
    // The summary said "48 deadlines, 1 of your own" with a task and an
    // appointment on the term. Both are things the student put there.
    expect(WEEK).toContain('of your own');
    expect(MONTH).toMatch(/on\.classes \? appts\.length : 0/);
  });
});
